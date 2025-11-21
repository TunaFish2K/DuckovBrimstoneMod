import AdmZip from "adm-zip";
import { Command } from "commander";
import { copyFile, mkdir, readFile, rm, writeFile } from "fs/promises";
import { basename, join } from "path";
import { fileURLToPath } from "url";
import { ProxyAgent } from "undici";

const PROJECT_PATH = join(fileURLToPath(import.meta.url), "..", "..");
const GENERATED_REFERENCES_PATH = join(PROJECT_PATH, "generated", "references");
const MANIFEST_PATH = join(PROJECT_PATH, "development.json");

// 读取代理环境变量
function getProxyAgent(): ProxyAgent | undefined {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (proxyUrl) {
    console.log(`using proxy: ${proxyUrl}`);
    return new ProxyAgent(proxyUrl);
  }

  return undefined;
}

// 显示下载进度
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function showProgress(downloaded: number, total: number) {
  const percent = ((downloaded / total) * 100).toFixed(2);
  const barLength = 40;
  const filledLength = Math.floor((downloaded / total) * barLength);
  const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

  process.stdout.write(
    `\r[${bar}] ${percent}% (${formatBytes(downloaded)}/${formatBytes(total)})`
  );
}

const app = new Command();

const fetchHarmony = app
  .command("fetch-harmony")
  .description("fetch harmony dll.")
  .action(async () => {
    console.log("fetching harmony dll...");
    const harmony = JSON.parse(
      await readFile(MANIFEST_PATH, {
        encoding: "utf-8",
      })
    ).references.harmony as {
      archive: string;
      file: string;
    };

    console.log(`fetching ${harmony.archive}...`);

    // 获取代理配置
    const proxyAgent = getProxyAgent();
    const fetchOptions: RequestInit = {};
    if (proxyAgent) {
      fetchOptions.dispatcher = proxyAgent;
    }

    // 开始下载
    const response = await fetch(harmony.archive, fetchOptions);

    if (!response.ok) {
      throw new Error(`failed to fetch: ${response.statusText}`);
    }

    const contentLength = parseInt(
      response.headers.get("content-length") || "0",
      10
    );

    if (!response.body) {
      throw new Error("response body is null");
    }

    // 下载文件并显示进度
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      chunks.push(value);
      downloadedBytes += value.length;

      if (contentLength > 0) {
        showProgress(downloadedBytes, contentLength);
      }
    }

    console.log("\n"); // 换行

    // 合并所有 chunks
    const binary = new Uint8Array(downloadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      binary.set(chunk, offset);
      offset += chunk.length;
    }

    const archive = new AdmZip(Buffer.from(binary));
    const file = archive.getEntry(harmony.file);
    if (!file) {
      throw new Error(`could not find ${harmony.file} in ${harmony.archive}`);
    }
    await mkdir(GENERATED_REFERENCES_PATH, {
      recursive: true,
    });
    await writeFile(
      join(GENERATED_REFERENCES_PATH, basename(harmony.file)),
      file.getData()
    );
    console.log("done.");
  });

const dumpManaged = app
  .command("dump-managed")
  .description("dump referred dlls from the specific game path.")
  .option(
    "--managed-folder <path>",
    "the game managed folder path (overrides DUCKOV_MANAGED_FOLDER)"
  )
  .action(async (options) => {
    console.log("dumping dlls from managed");
    const managedPath =
      options.managedFolder ?? process.env.DUCKOV_MANAGED_FOLDER;
    if (!managedPath) {
      console.error("managed folder path is required!");
      console.error(
        "please provide --managed-folder or set DUCKOV_MANAGED_FOLDER environment variable."
      );
      process.exit(1);
    }

    const references = JSON.parse(
      await readFile(MANIFEST_PATH, {
        encoding: "utf-8",
      })
    ).references.managed as string[];

    await mkdir(GENERATED_REFERENCES_PATH, {
      recursive: true,
    });

    await Promise.all(
      references.map((reference) =>
        (async () => {
          await copyFile(
            join(managedPath, reference),
            join(GENERATED_REFERENCES_PATH, reference)
          );
        })()
      )
    );

    console.log("done.");
  });

const clean = app
  .command("clean")
  .description("clean the generated references directory.")
  .action(async () => {
    console.log("cleaning...");
    try {
      await rm(GENERATED_REFERENCES_PATH, {
        recursive: true,
      });
    } catch {}
    console.log("done.");
  });

const getAll = app.command("get-all").action(async () => {
  await clean.parseAsync([]);
  await dumpManaged.parseAsync([]);
  await fetchHarmony.parseAsync([]);
});

app.action(async () => {
  await getAll.parseAsync();
});

await app.parseAsync();

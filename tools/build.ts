import { Command } from "commander";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { copyFile, mkdir, rm, readdir, readFile } from "fs/promises";
import { basename, join, resolve } from "path";

const PROJECT_PATH = resolve(import.meta.dirname, "..");
const REFERENCES_PATH = join(PROJECT_PATH, "generated", "references");
const OUTPUT_PATH = join(PROJECT_PATH, "generated", "output");
const MANIFEST_PATH = join(PROJECT_PATH, "development.json");
const ASSETS_PATH = join(PROJECT_PATH, "assets");

const app = new Command();

const build = app
  .command("build")
  .description("build the mod.")
  .option("-r, --release", "build as release.")
  .action(async (options) => {
    console.log("cleaning...");
    // 清空 generated/output 目录
    if (existsSync(OUTPUT_PATH)) {
      await rm(OUTPUT_PATH, { recursive: true, force: true });
    }
    await mkdir(OUTPUT_PATH, { recursive: true });

    console.log("building...");
    // 调用 dotnet build，输出到 generated/output
    try {
      execSync(
        `dotnet build ${
          options.release ? "-c Release" : ""
        } -o "${OUTPUT_PATH}"`,
        {
          cwd: PROJECT_PATH,
          stdio: "inherit",
        }
      );
    } catch (error) {
      console.error("build failed:");
      console.error((error as any).stack ?? error);
      process.exit(1);
    }

    console.log("copying assets...");
    // 复制 info.ini 和 preview.png
    const filesToCopy = ["info.ini", "preview.png"];
    for (const file of filesToCopy) {
      const src = join(ASSETS_PATH, file);
      const dest = join(OUTPUT_PATH, file);
      if (existsSync(src)) {
        await copyFile(src, dest);
        console.log(`${file} copied.`);
      } else {
        console.warn(`${file} not found!`);
      }
    }
    // 复制harmony
    console.log("copying harmony...");
    const harmonyFilename = basename(
      JSON.parse(
        await readFile(MANIFEST_PATH, {
          encoding: "utf-8",
        })
      ).references.harmony.file as string
    );
    const harmonyPath = join(REFERENCES_PATH, harmonyFilename);
    if (existsSync(harmonyPath)) {
      await copyFile(harmonyPath, join(OUTPUT_PATH, harmonyFilename));
      console.log(`${harmonyFilename} copied.`);
    } else {
      console.warn(`${harmonyFilename} not found!`);
    }
    console.log("done.");
  });

const install = app
  .command("install")
  .description("install the mod in development to the game.")
  .option(
    "--mod-folder <path>",
    "the game mods folder path (overrides DUCKOV_MODS_FOLDER)"
  )
  .action(async (options) => {
    // 检查 generated/output 是否存在
    if (!existsSync(OUTPUT_PATH)) {
      console.error("output folder not found! run 'build' first.");
      process.exit(1);
    }

    // 读取 development.json
    let modName: string;
    try {
      const devConfig = JSON.parse(await readFile(MANIFEST_PATH, "utf-8"));
      modName = devConfig.installation?.name;
      if (!modName) {
        throw new Error("installation.name not found in development.json");
      }
    } catch (error) {
      console.error("failed to read development.json:");
      console.error((error as any).message ?? error);
      process.exit(1);
    }

    // 获取 mod 文件夹路径：参数优先，否则使用环境变量
    const modFolderPath = options.modFolder ?? process.env.DUCKOV_MODS_FOLDER;
    if (!modFolderPath) {
      console.error("mod folder path is required!");
      console.error(
        "please provide --mod-folder or set DUCKOV_MODS_FOLDER environment variable."
      );
      process.exit(1);
    }

    const resolvedModFolder = resolve(modFolderPath);
    const targetDir = join(resolvedModFolder, modName);

    console.log(`installing to: ${targetDir}`);

    // 删除已存在的文件夹
    if (existsSync(targetDir)) {
      console.log("removing existing folder...");
      await rm(targetDir, { recursive: true, force: true });
    }

    // 创建目标文件夹
    await mkdir(targetDir, { recursive: true });

    // 复制 generated/output 的内容
    console.log("copying files...");
    const files = await readdir(OUTPUT_PATH);
    for (const file of files) {
      const src = join(OUTPUT_PATH, file);
      const dest = join(targetDir, file);
      await copyFile(src, dest);
      console.log(`  ${file} copied.`);
    }

    console.log("done.");
  });

const start = app
  .command("start")
  .description("start the game via Steam.")
  .action(async () => {
    const steamUrl = "steam://rungameid/3167020";
    console.log(`launching game: ${steamUrl}`);

    try {
      const platform = process.platform;
      let command: string;

      if (platform === "win32") {
        command = `start ${steamUrl}`;
      } else if (platform === "darwin") {
        command = `open "${steamUrl}"`;
      } else {
        // Linux and others
        command = `xdg-open "${steamUrl}"`;
      }

      execSync(command, { stdio: "inherit" });
      console.log("game launched.");
    } catch (error) {
      console.error("failed to launch game:");
      console.error((error as any).message ?? error);
      process.exit(1);
    }
  });

app.action(async () => {
  await build.parseAsync([]);
  await install.parseAsync([]);
  await start.parseAsync([]);
});

await app.parseAsync();

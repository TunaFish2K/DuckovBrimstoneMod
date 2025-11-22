import { Command } from "commander";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { copyFile, mkdir, rm, readdir, readFile } from "fs/promises";
import { join, resolve } from "path";

const app = new Command();

const build = app
  .command("build")
  .description("build the mod.")
  .option("-r, --release", "build as release.")
  .action(async (options) => {
    const projectRoot = resolve(import.meta.dirname, "..");
    const outputDir = join(projectRoot, "generated", "output");
    const assetsDir = join(projectRoot, "assets");

    console.log("cleaning...");
    // 清空 generated/output 目录
    if (existsSync(outputDir)) {
      await rm(outputDir, { recursive: true, force: true });
    }
    await mkdir(outputDir, { recursive: true });

    console.log("building...");
    // 调用 dotnet build，输出到 generated/output
    try {
      execSync(
        `dotnet build ${options.release ? "-c Release" : ""} -o "${outputDir}"`,
        {
          cwd: projectRoot,
          stdio: "inherit",
        }
      );
    } catch (error) {
      console.error("build failed:");
      console.error((error as any).stack ?? error);
      process.exit(1);
    }

    console.log("copying...");
    // 复制 info.ini 和 preview.png
    const filesToCopy = ["info.ini", "preview.png"];
    for (const file of filesToCopy) {
      const src = join(assetsDir, file);
      const dest = join(outputDir, file);
      if (existsSync(src)) {
        await copyFile(src, dest);
        console.log(`${file} copied.`);
      } else {
        console.warn(`${file} not found!`);
      }
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
    const projectRoot = resolve(import.meta.dirname, "..");
    const outputDir = join(projectRoot, "generated", "output");
    const devConfigPath = join(projectRoot, "development.json");

    // 检查 generated/output 是否存在
    if (!existsSync(outputDir)) {
      console.error("output folder not found! run 'build' first.");
      process.exit(1);
    }

    // 读取 development.json
    let modName: string;
    try {
      const devConfig = JSON.parse(await readFile(devConfigPath, "utf-8"));
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
    const files = await readdir(outputDir);
    for (const file of files) {
      const src = join(outputDir, file);
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

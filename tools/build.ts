import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const app = new Command();

const build = app
  .command("build")
  .description("build the mod.")
  .option("-r, --release", "build as release.")
  .action(async (options) => {
    const projectRoot = path.resolve(import.meta.dirname, "..");
    const outputDir = path.join(projectRoot, "generated", "output");
    const assetsDir = path.join(projectRoot, "assets");

    console.log("cleaning...");
    // 清空 generated/output 目录
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });

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
      const src = path.join(assetsDir, file);
      const dest = path.join(outputDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
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
    const projectRoot = path.resolve(import.meta.dirname, "..");
    const outputDir = path.join(projectRoot, "generated", "output");
    const devConfigPath = path.join(projectRoot, "development.json");

    // 检查 generated/output 是否存在
    if (!fs.existsSync(outputDir)) {
      console.error("output folder not found! run 'build' first.");
      process.exit(1);
    }

    // 读取 development.json
    let modName: string;
    try {
      const devConfig = JSON.parse(fs.readFileSync(devConfigPath, "utf-8"));
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

    const resolvedModFolder = path.resolve(modFolderPath);
    const targetDir = path.join(resolvedModFolder, modName);

    console.log(`installing to: ${targetDir}`);

    // 删除已存在的文件夹
    if (fs.existsSync(targetDir)) {
      console.log("removing existing folder...");
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // 创建目标文件夹
    fs.mkdirSync(targetDir, { recursive: true });

    // 复制 generated/output 的内容
    console.log("copying files...");
    const files = fs.readdirSync(outputDir);
    for (const file of files) {
      const src = path.join(outputDir, file);
      const dest = path.join(targetDir, file);
      fs.copyFileSync(src, dest);
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

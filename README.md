## 开发
安装最新版本的`Node.`
准备开发工具：
```
cd tools
yarn install
// npm should be fine
npm i
```
拉取项目依赖：
```
export DUCKOV_MANAGED_FOLDER = "/path/to/your/managed/folder"
node tools/references.ts
```
构建项目，安装并启动：
```
export DUCKOV_MODS_FOLDER = "/path/to/your/mods/folder"
node tools/build.ts
```
> [!IMPORTANT]
> 只支持自动启动Steam平台的正版游戏。
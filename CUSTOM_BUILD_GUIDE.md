# Orca 自用定制版（四区极简导航 + 100% 官方全功能）

本仓库基于官方开源 [`stablyai/orca`](https://github.com/stablyai/orca) 的 `feat/four-zone-ui` 分支定制：
- **100% 完整保留官方全部核心能力**：代码编辑器（Monaco）与文件树、内嵌 Chrome 浏览器、手机模拟器、插件市场、端口面板、xterm.js 终端、Git/Diff/PR 评审、工作区看板、Slack / Linear / Jira / Google 外部连接器、Bot 团队群聊与定时任务、全部 Agent（Antigravity / Claude / Codex 等）及 `+` 快捷启动菜单。
- **双端（桌面端 + iPhone）四区导航重构**：
  1. **团队（`teams`）**：专属 Bot 团队群聊列表（仅展示 `BotGroup`）
  2. **Bot（`bots`）**：专属单独 Bot 列表（仅展示单 Bot，不再与团队混排）
  3. **Win（`win`）**：仅展示 Windows 主机（含本机 Windows、WSL 与远程配对 Windows）的项目与工作区
  4. **Mac（`mac`）**：仅展示 Mac 主机（含本机 macOS 与远程配对 Mac）的项目与工作区
- **随时一键切回官方经典视图**：桌面端最左侧图标栏（AppRail）顶部直接提供 **👥 Bot 团队 / 🤖 单独 Bot / 🪟 Win 主机 / 🍎 Mac 主机 / 🗂️ 全部（经典）** 五个原生图标（不占用侧边栏内部高度；若在设置中关闭了 AppRail，会自动退回侧边栏顶部紧凑切换条）；手机端顶部右上角的网格按钮（`LayoutGrid`）也可随时一键在「四区视图」与「官方经典混合视图」之间来回切换，且自动持久化记忆。

---

## 1. Windows 桌面端运行与打包

> **前置环境**：Node.js 24+、Corepack（`corepack enable`）；若需打包完整本地原生 `.exe` 安装包，需安装 Visual Studio Build Tools（勾选「使用 C++ 的桌面开发」以编译 `node-pty`）。

```powershell
cd path\to\orca-custom
corepack enable

# 开发模式启动桌面端
pnpm dev

# 仅编译主进程 + 渲染进程产物（out/）
node config/scripts/desktop-build/execution/run-electron-vite-build.mjs

# 打包 Windows 安装包（需 VS C++ Build Tools）
pnpm build:win
```

## 2. Mac 桌面端运行与打包（`.dmg`）

将本目录（或推送到你的私有 GitHub 仓库后 `git clone`）放到 Mac 上执行：

```bash
cd /path/to/orca-custom
corepack enable
pnpm install --frozen-lockfile

# 开发模式启动
pnpm dev

# 打包 macOS 安装包（.dmg）
pnpm build:mac
```

## 3. iPhone 端自签 `.ipa` 打包

提供两种方式获取未签名 `.ipa`（适用于 AltStore / SideStore / Sideloadly / 爱思助手 / 巨魔自签安装）：

### 方式 A：在你的 Mac 上本地用 Xcode 打包（最快）
```bash
cd /path/to/orca-custom
pnpm install --frozen-lockfile --ignore-scripts
node config/scripts/workspace-package-build/build-workspace-packages.mjs

cd mobile
pnpm install --frozen-lockfile
ORCA_IOS_APS_ENVIRONMENT=development npx expo prebuild --platform ios --clean --no-install
cd ios && pod install

# 方式 1：直接用 Xcode 打开签名并真机安装
open Orca.xcworkspace

# 方式 2：命令行导出未签名 .ipa（供自签工具安装）
xcodebuild -workspace Orca.xcworkspace -scheme Orca -configuration Release \
  -sdk iphoneos -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
mkdir -p Payload && cp -R build/Build/Products/Release-iphoneos/Orca.app Payload/
zip -r -y ../Orca-Custom-unsigned.ipa Payload
```

### 方式 B：GitHub Actions 云端一键编译全三端（推荐，免装 VS C++ Build Tools）
已内置两个一键云端编译工作流：
- **Windows `.exe` + macOS `.dmg`**：[`.github/workflows/build-custom-desktop.yml`](.github/workflows/build-custom-desktop.yml)
- **iPhone 未签名 `.ipa`**：[`.github/workflows/build-custom-ios-unsigned-ipa.yml`](.github/workflows/build-custom-ios-unsigned-ipa.yml)

操作步骤：
1. 将本仓库推送到你的 GitHub 仓库（如 `orca-custom`）。
2. 在 GitHub 网页进入 **Actions**：
   - 运行 **Build Custom Desktop Apps (Windows & macOS)** → 下载 `Orca-Custom-Windows`（`.exe`）和 `Orca-Custom-macOS`（`.dmg`）。
   - 运行 **Build Custom iOS Unsigned IPA (Self-Sign)** → 下载 `Orca-Custom-unsigned-ipa` 中的 `Orca-Custom-unsigned.ipa`，拖入自签工具安装到 iPhone。

## 4. 后续同步官方新版本

因为全部改造集中在独立目录和极少量外科手术切入点，后续官方更新时只需：

```bash
git fetch upstream main --depth=50
git rebase upstream/main
```
（若尚未添加 `upstream`，先执行一次 `git remote add upstream https://github.com/stablyai/orca.git`）

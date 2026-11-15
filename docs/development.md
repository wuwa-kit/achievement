# 开发指南

UI 开发遵循 [组件与命名规范](ui-conventions.md)，基础组件统一使用 `WAbcXyz` 命名。

项目包含 achievement-website 和 achievement-export 两个 pnpm workspace 子项目。根目录通过 mise.toml 固定 Node、pnpm 和 .NET SDK，统一维护 pnpm 锁文件；C# 依赖由各项目的 NuGet 锁文件管理。

## 本地运行

在仓库根目录执行：

```powershell
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

网页地址为 http://127.0.0.1:5173。

## 构建与测试

```powershell
mise exec -- pnpm build
mise exec -- pnpm test
mise exec -- pnpm test:e2e
mise exec -- pnpm publish:desktop
```

涉及桌面的构建与测试需要 Windows。回归测试依赖未入库的本机样本，准备方式见 [样本说明](../fixtures/README.md)。可用 pnpm --filter achievement-website 或 pnpm --filter achievement-export 单独运行子项目命令。

桌面产物为 `achievement-export/artifacts/app-compact/WuwaAchievementExport.exe`（内置 .NET）和 `achievement-export/artifacts/app-lite/WuwaAchievementExport-Lite.exe`（使用系统的 .NET 10 Desktop Runtime x64）。自动构建和发布配置见 [构建与发布](releasing.md)。

## 数据流程

桌面导出 v3 账号进度，网页按成就 ID 与 data/achievement-catalog.json 合并，补齐文本、分类、隐藏属性和奖励。排除规则统一维护于 data/achievement-exclusions.json，在网页应用。

网页按 UID 保存，同 UID 覆盖，无 UID 新增；保留原始进度和未知新 ID，兼容旧 v2 档案。采集通过 GC 诊断和进程内存读取动态进度，不再加载配置查询模块。

更多说明：[网页](../achievement-website/README.md)、[桌面](../achievement-export/README.md)、[静态资源](research/static-strings.md)、[工作区维护](workspace.md)。

## React 桌面界面

桌面端使用薄 WPF + WebView2 外壳，界面为同一 React 项目的 `/desktop` 路由，复用 W 基础组件。业务 XAML 和 WPF 样式已移除。C# 保留导出、文件对话框、设置持久化、窗口置顶及网页接收服务。

运行 `mise exec -- dotnet run --project achievement-export/Wuwa.Desktop -c Debug`。构建会自动构建网页并嵌入桌面页面、脚本和官方 TTF；因此构建环境需要先安装 pnpm 依赖。测试发送到网页时，另开终端运行 `mise exec -- pnpm dev`，Debug 桌面会发送到 `http://127.0.0.1:5173`。Release 桌面会发送到 `https://wu.songe.li`。

桌面使用本地资源，普通浏览器可直接访问 `/desktop` 调试完整界面、语言切换和设置，预览设置保存在独立 sessionStorage 中；导出及本机文件操作仍需要桌面宿主。

前端桥接协议位于 `src/desktop/bridge.ts`：请求带 id/method/params，响应带 id/result 或 id/error；state 事件推送进度。原生端只接受本地桌面页面的白名单命令。翻译使用 React 语义键，进度传递阶段标识。

运行机器需要 WebView2 Runtime；缺失时会显示启动错误和安装地址。字体和页面资源嵌入 EXE，WebView2 请求 `https://wuwa.local` 下的资源时由宿主按需返回，无需解压桌面 UI。网页仍通过 CDN 加载字体。

验证桌面界面：`mise exec -- pnpm --filter achievement-website exec playwright test e2e/desktop.spec.ts --project=desktop`。此测试模拟消息桥接，不启动游戏；真实游戏采集仍需手动验证。

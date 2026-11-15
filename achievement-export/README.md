# Windows 桌面导出程序

> 桌面 UI 已迁移至 React /desktop，WPF 仅保留 WebView2 外壳。运行机器需要 WebView2 Runtime；页面及字体嵌入 EXE。构建需要 Node/pnpm 依赖，详见 [开发指南](../docs/development.md)。

桌面采用 .NET 10 / WPF，导出 schemaVersion=3 的账号进度。网页结合仓库 data/achievement-catalog.json 补齐文本、分类、隐藏属性和奖励。桌面不再读取静态目录或加载配置查询 DLL；CatalogPayload 与 MonoCatalogBridge 仅保留为历史源码，不参与正式构建。

## 使用和构建

在项目根目录运行 mise exec -- pnpm --filter achievement-export build、test 或 publish:desktop。

桌面入口：artifacts/app-compact/WuwaAchievementExport.exe；CLI：publish-compact/Wuwa.Export.exe。Windows x64 自包含发布物无需安装 SDK，桌面只需分发 WuwaAchievementExport.exe，其他 PDB 和 XML 文件用于调试，无需附带。双击桌面接受 UAC，点击运行图标并登录游戏；流程成功后关闭游戏，在下方新增历史卡片。

桌面发送目标由构建配置决定。Debug 使用 `http://127.0.0.1:5173`，Release 使用 `https://wu.songe.li`。

桌面数据统一保存在 `%LOCALAPPDATA%/WuwaAchievementExport/`，从仓库运行也使用该路径。

- `settings.json` 保存 `gamePath`、`language` 和 `theme`。读取旧设置时会忽略 `website` 字段。
- `accounts/<UID>.json` 直接保存 v3 账号进度。每个 UID 只保留最新快照，读回验证后原子替换。历史卡片从文件生成，支持发送到网页、另存 JSON 和删除账号快照。
- `diagnostics/` 保存采集结果、会话日志和用于排查的原始采集文件。
- `WebView2/` 由 WebView2 管理。

新目录从空档案和默认设置开始。旧桌面目录 `WuwaAchievementExporter` 保留在原处。

CLI 支持 export（默认）、replay、analyze、launch、probe、export-events；不再提供 refresh-catalog。replay --first PATH --second PATH --output PATH 只转换已有快照，不访问游戏。

## 数据与边界

导出器启动游戏、等待同步，从当前会话日志识别 UID，通过 GC 图定位模型并读取两次成就状态。检查字典结构、重复 ID、双快照一致性、UID 和运行时版本。GC 诊断会触发 GC，不能描述为完全无副作用的被动读取。成功写入并回读验证后关闭自己启动的游戏；失败或取消保留已经运行的游戏。

进度文件保留 UID、采集时间、资源指纹、客户端完成数及成就点数、分类解锁状态、每个观察到的成就 ID、阶段关系、进度、领取状态和完成时间。未知新 ID 和排除项仍保留原始状态。实时采集必须识别到本次登录的 UID，识别失败时报告错误。CLI 仍将采集输出写到 `achievements.json`。网页导入按 UID 覆盖，无 UID 的文件独立归档。

网页合并静态资源后应用 [排除规则](../data/achievement-exclusions.json)。未采集到的配置项标为进度未知；新 ID 提示更新网页配置。IndexedDB 与下载保留 v3 原始进度，更新网页后重新合并，无需重新导出。旧 v2 文件继续兼容。

桌面不依赖静态分类，因此不再按目录核对主菜单完成数与客户端总数；保留结构与双快照全模型一致性校验。网页统计来自已知主菜单成就，与客户端模型原始统计可能口径不同。

HttpListener（Windows HTTP.sys）临时服务注册回环地址的随机端口，并拒绝非回环客户端，验证 Origin、Host、密钥及有效期。网页打开导入确认弹窗，用户确认后校验并保存档案，再向桌面端确认接收。手动 JSON 导入同样可用。

## 维护与验证

静态目录由维护流程更新，不在玩家导出时更新。字符串离线解析见 [静态资源研究](../docs/research/static-strings.md)。进度读取仍绑定已验证运行时 SHA-256，客户端布局变化需重新适配。

已使用两个真实账号的固定快照验证 v3 导出、静态合并、缺失进度和未知 ID，并通过真实本机服务验证浏览器账号切换、同 UID 覆盖、刷新和下载。本次 v3 改造没有重新登录游戏采集。历史记录见 [v2 归档](../docs/research/exporter-v2-history.md)。

## 分发体积优化

正式桌面启用自包含单文件压缩，原生依赖运行时自动解压加载；无需预装 .NET。移除 ASP.NET Core 框架引用，交接使用 HttpListener，保留 Origin、Host、密钥、请求大小、超时、确认与回环客户端检查。最多同时处理 16 个请求。Windows 桌面保持 requireAdministrator 清单。

仅保留简体中文框架卫星资源和默认资源。SatelliteResourceLanguages 不会过滤所有运行时资源，因此在 PrepareForBundle 后额外过滤；网页成就多语言不受影响。

2026-11-14 实测：桌面 EXE 60.12 MiB，ZIP 54.87 MiB（原 ZIP 75.60 MiB）。67 项导出断言、20 项服务检查和 20 项浏览器测试通过。最终 EXE 单独复制到空目录后成功采集测试进程 GC 堆；CLI 真实账号快照回放通过。未重新登录游戏采集。

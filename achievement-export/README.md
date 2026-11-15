# Windows 桌面导出程序

桌面采用 .NET 10 / WPF 和 WebView2，界面使用 React `/desktop`，页面和字体嵌入 EXE。导出文件保存 v3 账号进度，网页结合静态目录补齐文本、分类、隐藏属性和奖励。

## 使用和构建

运行需要 WebView2 Runtime。构建命令和依赖见 [开发指南](../docs/development.md)。

桌面提供两个 Windows x64 单文件。标准版 `artifacts/app-compact/WuwaAchievementExport.exe` 内置 .NET，Lite 版 `artifacts/app-lite/WuwaAchievementExport-Lite.exe` 需要安装 .NET 10 Desktop Runtime（x64）。CLI 位于 `publish-compact/Wuwa.Export.exe`。双击桌面程序并接受 UAC 提示，点击运行图标并登录游戏。流程成功后关闭游戏，下方会新增历史卡片。

桌面发送目标由构建配置决定。Debug 使用 `http://127.0.0.1:5173`，Release 使用 `https://wu.songe.li`。

桌面数据统一保存在 `%LOCALAPPDATA%/WuwaAchievementExport/`，从仓库运行也使用该路径。

- `settings.json` 保存 `gamePath`、`language` 和 `theme`。读取旧设置时会忽略 `website` 字段。
- `accounts/<UID>.json` 直接保存 v3 账号进度。每个 UID 只保留最新快照，读回验证后原子替换。历史卡片从文件生成，支持发送到网页、另存 JSON 和删除账号快照。
- `diagnostics/` 保存采集结果、会话日志和用于排查的原始采集文件。
- `WebView2/` 由 WebView2 管理。

CLI 支持 `export`（默认）、`replay`、`analyze`、`launch`、`probe` 和 `export-events`。用 `replay --first FILE --second FILE --output DIR` 可以离线转换已有快照。

## 数据与边界

导出器启动游戏、等待同步，从当前会话日志识别 UID，通过 GC 图定位模型，再从进程内存读取两次成就状态。采集会触发游戏运行时的 GC。通过结构、双快照、UID 和运行时版本校验并保存档案后，导出器会结束自己启动的游戏进程。失败或取消时，已恢复运行的游戏通常继续运行。

进度文件保留 UID、采集时间、资源指纹、客户端完成数及成就点数、分类解锁状态、每个观察到的成就 ID、阶段关系、进度、领取状态和完成时间。未知新 ID 和排除项仍保留原始状态。实时采集必须识别到本次登录的 UID，识别失败时报告错误。CLI 将采集输出写到 `achievements.json`。网页按 UID 保存档案，无 UID 的文件归到默认账号。

网页合并静态资源后应用 [排除规则](../data/achievement-exclusions.json)。未采集到的配置项标为进度未知；新 ID 提示更新网页配置。IndexedDB 与下载保留 v3 原始进度，更新网页后重新合并，无需重新导出。旧 v2 文件继续兼容。

HttpListener（Windows HTTP.sys）临时服务注册回环地址的随机端口，并拒绝非回环客户端，验证 Origin、Host、密钥及有效期。网页打开导入确认弹窗，用户确认后校验并保存档案，再向桌面端确认接收。手动 JSON 导入同样可用。

## 维护与验证

进度读取绑定已验证运行时的 SHA-256，客户端布局变化后需要重新适配。离线回归使用 [固定样本](../fixtures/README.md)；静态字符串核验见 [静态资源研究](../docs/research/static-strings.md)。

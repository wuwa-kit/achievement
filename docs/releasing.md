# 构建与发布

远程仓库为 `https://github.com/wuwa-kit/achievement`。

- `deloy` 在推送 `main` 时构建网站，也可从 `main` 手动运行。工作流上传 `website` artifact，公开仓库还会更新 jsDelivr 的发布分支。
- `release`：推送版本标签（如 `v0.1.0`）时构建 Windows x64 标准版和 Lite 版，从 `achievement-export/CHANGELOG.md` 提取版本说明。Actions artifact 和 GitHub Release 中的文件名带版本标签，例如 `WuwaAchievementExport-v0.1.0.exe` 和 `WuwaAchievementExport-Lite-v0.1.0.exe`。也可选择标签手动运行。带后缀的版本标记为预发布。缺少对应更新日志时停止发布。

配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 后，工作流会部署到已有的 Cloudflare Pages 项目 `wuwa-achievement-export`。缺少凭据时仍构建网站和上传 artifact。

CI 不读取或上传本机 `fixtures/local/` 和账号导出数据。


发布前用英文更新 [桌面更新日志](../achievement-export/CHANGELOG.md)，提交后推送对应版本标签。发布脚本会把更新日志底部的 `Lite edition requirements` 段落追加到每次发布说明的末尾。

两个 EXE 均嵌入 React `/desktop` 界面和本地字体，均需 Microsoft Edge WebView2 Runtime。标准版内置 .NET，Lite 版使用系统已安装的 .NET 10 Desktop Runtime（x64）。release 工作流使用 mise 安装固定版本的构建工具。

桌面更新与两个 EXE 一起发布 `update.json`，包含相同的版本标签、更新说明和各发行版的文件名、字节数、SHA-256。支持应用内升级的客户端通过 GitHub 最新稳定版附件检测更新。首次切换到支持更新的发行版需要手动下载。点「重启」后使用当前 EXE 目录中的新版文件，旧 EXE 保留，可手动启动回退。

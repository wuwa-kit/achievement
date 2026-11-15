# 构建与发布

远程仓库为 `https://github.com/wuwa-kit/achievement`。

- `deloy` 在推送 `main` 时构建网站，也可从 `main` 手动运行。工作流上传 `website` artifact，公开仓库还会更新 jsDelivr 的发布分支。
- `release`：推送版本标签（如 `v0.1.0`）时构建 Windows x64 标准版和 Lite 版，从 `achievement-export/CHANGELOG.md` 提取版本说明。Actions artifact 和 GitHub Release 中的文件名带版本标签，例如 `WuwaAchievementExport-v0.1.0.exe` 和 `WuwaAchievementExport-Lite-v0.1.0.exe`。也可选择标签手动运行。带后缀的版本标记为预发布。缺少对应更新日志时停止发布。

配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 后，工作流会部署到已有的 Cloudflare Pages 项目 `wuwa-achievement-export`。缺少凭据时仍构建网站和上传 artifact。

CI 不读取或上传本机 `fixtures/local/` 和账号导出数据。


发布前更新 [桌面更新日志](../achievement-export/CHANGELOG.md)，提交后推送对应版本标签。

两个 EXE 均嵌入 React `/desktop` 界面和本地字体，均需 Microsoft Edge WebView2 Runtime。标准版内置 .NET，Lite 版使用系统已安装的 .NET 10 Desktop Runtime（x64）。release 工作流使用 mise 安装固定版本的构建工具。

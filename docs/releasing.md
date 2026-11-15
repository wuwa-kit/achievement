# 构建与发布

远程仓库为 `https://github.com/wuwa-kit/achievement`。

- `deloy`：每次推送（所有分支及标签）构建网站，保存 `website` artifact；也可手动运行。`main` 分支按已配置的凭据部署到 Cloudflare Pages 和/或 Netlify。
- `release`：推送版本标签（如 `v0.1.0`）时构建 Windows x64 标准版和 Lite 版，从 `achievement-export/CHANGELOG.md` 提取版本说明。Actions artifact 和 GitHub Release 中的文件名带版本标签，例如 `WuwaAchievementExport-v0.1.0.exe` 和 `WuwaAchievementExport-Lite-v0.1.0.exe`。也可选择标签手动运行。带后缀的版本标记为预发布。缺少对应更新日志时停止发布。

Cloudflare 部署需要 Secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`，并预先创建 Pages 项目。项目名默认 `wuwa-achievement-export`，可通过仓库变量 `CLOUDFLARE_PROJECT_NAME` 修改。Netlify 部署需要 Secrets `NETLIFY_AUTH_TOKEN`、`NETLIFY_SITE_ID`。未配置对应凭据时跳过该平台部署，网站构建和 artifact 上传仍执行。

CI 不读取或上传本机 `fixtures/local/` 和账号导出数据。


发布前更新 [桌面更新日志](../achievement-export/CHANGELOG.md)，提交后推送对应版本标签。

两个 EXE 均嵌入 React `/desktop` 界面和本地字体，均需 Microsoft Edge WebView2 Runtime。标准版内置 .NET，Lite 版使用系统已安装的 .NET 10 Desktop Runtime（x64）。release 工作流使用 mise 安装固定版本的构建工具。

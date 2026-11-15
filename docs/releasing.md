# 构建与发布

远程仓库为 `https://github.com/wuwa-kit/achievement`。

- `deloy`：每次推送（所有分支及标签）构建网站，保存 `website` artifact；也可手动运行。`main` 分支按已配置的凭据部署到 Cloudflare Pages 和/或 Netlify。
- `release`：推送版本标签（如 `v0.1.0`）时构建 Windows x64 自包含压缩单文件，从 `achievement-export/CHANGELOG.md` 提取对应版本说明，使用 `gh` 发布 GitHub Release，并附带 EXE 和 ZIP。也可选择标签手动运行；带后缀的版本标记为预发布。缺少对应更新日志时停止发布。

Cloudflare 部署需要 Secrets `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`，并预先创建 Pages 项目。项目名默认 `wuwa-achievement-export`，可通过仓库变量 `CLOUDFLARE_PROJECT_NAME` 修改。Netlify 部署需要 Secrets `NETLIFY_AUTH_TOKEN`、`NETLIFY_SITE_ID`。未配置对应凭据时跳过该平台部署，网站构建和 artifact 上传仍执行。

CI 不读取或上传本机 `fixtures/local/` 和账号导出数据。


发布前更新 [桌面更新日志](../achievement-export/CHANGELOG.md)，提交后推送对应版本标签。

桌面发布现包含 React `/desktop` 界面和本地字体，构建自动调用 pnpm；release 工作流已安装 Node/pnpm 并还原依赖。单文件 EXE 仍可独立分发，但运行机器需要 Microsoft Edge WebView2 Runtime。其运行时不包含在 EXE 内；页面和字体已经嵌入。

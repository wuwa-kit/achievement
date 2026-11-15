# 鸣潮 · 成就档案

本地成就导出结果展示应用。应用和配置代码全部使用 TypeScript / TSX，样式使用 Tailwind CSS 与 CSS，不含手写 JS / JSX 源码。Vite 的浏览器构建产物会正常编译为 JavaScript。

## 启动

在本目录执行：

```powershell
mise trust
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

打开 <http://127.0.0.1:5173>。本机已安装依赖，日常只需最后一条命令。

Node 和 pnpm 由根目录 `mise.toml` 固定版本，依赖由根目录 `pnpm-lock.yaml` 统一锁定。也可在根目录执行 `mise exec -- pnpm --filter achievement-website dev`。本目录不再维护独立工具版本或锁文件。

| 工具                     | 本次安装版本 |
| ------------------------ | ------------ |
| Node                     | 26.13.1      |
| pnpm                     | 12.18.0      |
| TypeScript               | 7.0.2        |
| Vite                     | 8.3.8        |
| React / React DOM        | 19.3.1       |
| Tailwind CSS / Vite 插件 | 4.3.5        |

Vite 的 React 插件为 6.3.0。采用 [Vite 官方配置方式](https://vite.dev/guide/) 和 [Tailwind 官方 Vite 插件](https://tailwindcss.com/docs/installation/using-vite)，无需 JS 配置文件。

## 数据与功能

- 默认展示 `data/achievement-catalog.json` 生成的公开图鉴（账号进度全部未知）。如果当前浏览器保存过导出，则优先恢复已存档案。开发和生产服务都不读取个人 `artifacts/`。
- 桌面程序打开带临时 key 的页面后，点击“接收桌面导出”。网页连接本机服务、校验 JSON、保存到 IndexedDB，再确认接收。刷新数据只重新读取浏览器存储或公开图鉴。
- 支持导入本地 `achievements.json`；文件在浏览器内解析，不上传。接受完整 v2 档案与 v3 账号进度格式，并验证 ID、数量与分类引用。错误文件不会覆盖已加载的快照。
- 每个 UID 只保存一份档案。无 UID 的快照归到默认账号，旧版匿名档案迁移时保留采集时间最新的一份。覆盖较新的档案前会要求确认。
- 可以在成就详情标记完成状态。编辑更新档案时间并保存在浏览器。标题栏的更多操作可下载当前档案，删除 UID 档案后会回到默认账号。默认账号始终可用。
- 支持按小类筛选、按标题、描述或 ID 搜索，以及隐藏已完成成就。搜索同时匹配当前文本语言和简体中文。列表在独立滚动容器中按需渲染。
- 仅展示四大类成就。旧版完整 JSON 和浏览器已存档案会在校验后过滤非主菜单记录，v3 存储和下载保留全部原始 ID，便于静态目录更新后重新合并。星声统计只包含单项成就奖励，不把成就星数当作星声，也不混入分类奖励。
- 切换文本语言保留真实缺失值；不会用其他语言静默补齐。详情中可同时查看全部语言原文、隐藏原因、阶段关系及原始进度。
- 支持桌面和移动端、键盘导航、`/` 聚焦搜索、`Esc` 关闭详情、下载完整快照。

界面文案为中文；语言选择切换的是静态目录文本（旧 v2 档案使用自带文本）。导入后数据保留在当前网站来源的 IndexedDB，刷新或重开页面仍能查看。网站没有账号云同步；清理站点数据后请重新导入。

## 构建和检查

```powershell
mise exec -- pnpm build
mise exec -- pnpm preview
mise exec -- pnpm test
mise exec -- pnpm test:e2e
mise exec -- pnpm format:check
```

`build` 先运行 TypeScript 严格检查，再输出 `dist/`。构建从静态配置生成 `dist/data/achievements.json` 图鉴，显式排除所有账号进度。将 `dist/` 部署到任意 HTTPS 静态托管服务即可，不需要网站后端。更新公开配置后需重新构建。生产预览地址为 <http://127.0.0.1:4173>。

测试使用已有的真实导出，需保留上级项目的 `fixtures/local/achievements.json` 和 `fixtures/local/csharp-live/achievements.json`（见根目录 fixtures/README.md）。逻辑测试验证分类、可见性、奖励、缺失值和无效导入。浏览器测试使用本机 Edge 的无头模式，覆盖桌面与移动尺寸、语言切换、分类/搜索/筛选、虚拟滚动、导入、下载与缺失默认数据的恢复。截图保存在 `test-results/`。

## 主要文件

- `src/App.tsx`：分类导航、统计、筛选列表与多语言详情。
- `src/lib/data.ts`：数据类型、导入校验、筛选、统计与纯文本处理。
- `src/styles.css`：Tailwind 入口与响应式页面样式。
- `src/lib/handoff.ts`：桌面本机传输协议。
- `src/lib/archives.ts`：浏览器档案的 IndexedDB 存储与迁移。
- `vite.config.ts`：React、Tailwind 和公开图鉴构建插件。
- `src/lib/data.test.ts`、`e2e/viewer.spec.ts`：真实数据与浏览器回归验证。


真实本机服务端到端测试还需要先在 `achievement-export/` 执行：

```powershell
mise exec -- dotnet publish Wuwa.Transfer.Tests -c Release -r win-x64 --self-contained true -o artifacts/transfer-tests
```

`e2e/handoff.spec.ts` 会启动该服务、检查接收/保存/确认/关闭、刷新恢复和生产图鉴无个人进度。测试不启动游戏。HTTPS 生产站点的本机网络授权提示需在实际部署来源上验证；当前验收来源为 `http://127.0.0.1:5173`。不要把 artifacts、fixtures/local 或整个源码根目录作为公开站点发布。

网页档案收录 FunctionType=1 的四大类成就。导入旧 JSON 时，网页也按这个范围筛选。

排除规则统一配置在 [data/achievement-exclusions.json](../data/achievement-exclusions.json)。每条规则包含成就 ID、排除原因和匹配条件。网站加载预览目录或账号档案时应用同一份规则，列表、分类索引和统计只使用筛选后保留的成就。进度未知的成就卡片隐藏进度数字。


# 鸣潮 · 成就档案

使用 React、TypeScript 和 Vite 展示成就图鉴和账号档案。桌面端复用本项目的 `/desktop` 路由。

## 启动

按 [开发指南](../docs/development.md) 安装依赖后，在本目录启动：

```powershell
mise exec -- pnpm dev
```

打开 <http://127.0.0.1:5173>。

## 数据与功能

- 默认展示 `data/achievement-catalog.json` 生成的公开图鉴（账号进度全部未知）。如果当前浏览器保存过导出，则优先恢复已存档案。开发和生产服务都不读取个人 `artifacts/`。
- 从桌面历史卡片发送档案后，在网页弹窗确认导入。网页通过本机临时服务接收并校验 JSON，保存到 IndexedDB 后向桌面端确认。
- 支持导入本地 `achievements.json`；文件在浏览器内解析，不上传。接受完整 v2 档案与 v3 账号进度格式，并验证 ID、数量与分类引用。错误文件不会覆盖已加载的快照。
- 每个 UID 只保存一份档案。无 UID 的快照归到默认账号，旧版匿名档案迁移时保留采集时间最新的一份。覆盖较新的档案前会要求确认。
- 可以在成就详情标记完成状态。编辑更新档案时间并保存在浏览器。标题栏的更多操作可下载当前档案，删除 UID 档案后会回到默认账号。默认账号始终可用。
- 支持按小类筛选、按标题、描述或 ID 搜索，以及隐藏已完成成就。搜索同时匹配当前文本语言和简体中文。列表在独立滚动容器中按需渲染。
- 仅展示四大类成就。旧版完整 JSON 和浏览器已存档案会在校验后过滤非主菜单记录，v3 存储和下载保留全部原始 ID，便于静态目录更新后重新合并。星声统计只包含单项成就奖励，不把成就星数当作星声，也不混入分类奖励。
- 切换文本语言保留真实缺失值；不会用其他语言静默补齐。详情中可同时查看全部语言原文、隐藏原因、阶段关系及原始进度。
- 支持桌面和移动端、键盘导航、`/` 聚焦搜索、`Esc` 关闭详情、下载完整快照。

语言切换同时更新界面和成就文本。v3 使用静态目录的文本，v2 使用档案自带文本。档案保存在当前浏览器的 IndexedDB，清理站点数据后需要重新导入。

## 构建和检查

```powershell
mise exec -- pnpm build
mise exec -- pnpm preview
mise exec -- pnpm test
mise exec -- pnpm format:check
```

`build` 先运行 TypeScript 严格检查，再输出 `dist/`。构建从静态配置生成 `dist/data/achievements.json` 图鉴，显式排除所有账号进度。将 `dist/` 部署到任意 HTTPS 静态托管服务即可，不需要网站后端。更新公开配置后需重新构建。生产预览地址为 <http://127.0.0.1:4173>。

逻辑和浏览器测试使用 [固定样本](../fixtures/README.md)。从仓库根目录运行 `mise exec -- pnpm test:e2e`，命令会先发布本机交接测试服务，再使用 Edge 验证桌面和移动端。仅运行本目录交接测试时，可先从根目录运行 `mise exec -- pnpm --filter achievement-export publish:test-host`。

## 主要文件

- `src/App.tsx`：分类导航、统计、筛选列表与多语言详情。
- `src/lib/data.ts`：数据类型、导入校验、筛选、统计与纯文本处理。
- `src/styles.css`：Tailwind 入口与响应式页面样式。
- `src/lib/handoff.ts`：桌面本机传输协议。
- `src/lib/archives.ts`：浏览器档案的 IndexedDB 存储与迁移。
- `vite.config.ts`：React、Tailwind 和公开图鉴构建插件。
- `src/lib/data.test.ts`、`e2e/viewer.spec.ts`：真实数据与浏览器回归验证。
排除规则见 [成就排除配置](../data/achievement-exclusions.README.md)。


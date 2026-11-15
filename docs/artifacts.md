# 本地产物与清理记录

根目录 `artifacts/` 存放账号导出和研究采集产物，与 `achievement-export/artifacts/` 中的发布程序用途不同。正式测试的固定输入位于 `fixtures/local/`，恢复说明见 [fixtures/README.md](../fixtures/README.md)。

## 保留内容

- 根目录的 `achievements.json`、`achievement-tree.zh-Hans.json`、`export-result.json`：现有导出与结果记录。
- `csharp-live/`、`recovered-10324/`、`performance-live/`：成功实机导出、账号恢复结果、性能验收记录。
- `session-3916/`、`session-24624/`：历史测试快照、配置缓冲区、反编译源码及研究证据。
- 其他会话的快照、差异报告、错误日志与尚未确认无用的原始采集数据。
- `fixtures/local/` 全部样本保持不变，不应随最新导出覆盖。

## 2026-11-14 清理

删除 29 个文件，释放 112.67 MiB：

- `catalog-test/`、`csharp-lazy-replay/`、`csharp-publish-check/`、`csharp-regression/`：可重新生成的测试输出。
- 两个过期交接票据、交接临时日志、worker 冒烟测试堆文件。
- 根目录的七个旧探测 DLL；对应源码和正式发布程序集保留。
- `csharp-live/` 下两次失败采集的临时堆文件；失败日志、已有快照和后续成功采集保留。
- `session-24624/MultiTextCsvModule-assembly.dll`：与同目录 `AchievementModel-assembly.dll` 的 SHA-256 完全相同，后者保留，包含同一程序集的所有类型。

逐文件删除清单、大小和 SHA-256 保存在本机 `artifacts/cleanup-2026-11-14.json`。清理后对全部 1,572 个保留文件（含 fixtures）重新校验 SHA-256，与清理前一致。

运行测试后可能重新生成 `catalog-test/` 或 `csharp-regression/`；它们是输出，不是固定样本。不要按扩展名批量删除 JSON、DLL 或 gcdump：这些扩展名也用于有效导出、配置研究程序集和回归输入。

## 整个工作区复查

同日继续清理 1,665 个可重建文件，释放 470.77 MiB：六个 .NET 项目的 `bin/`、`obj/`，`achievement-export/artifacts/transfer-tests/`，网页 `test-results/` 和已退出的开发服务器日志。清单见本机 `artifacts/workspace-cleanup-2026-11-14.json`。

桌面发布目录 `achievement-export/artifacts/app/`、CLI 发布目录 `achievement-export/publish/`、网站 `dist/`、共享数据和固定样本均保留；这几类目录共 816 个文件经清理前后 SHA-256 校验未改变。仅清理生成物，没有重新运行会立即生成同类文件的构建和测试。

下次 `mise exec -- pnpm build` 或 `mise exec -- pnpm test` 会重建编译目录；根目录 `mise exec -- pnpm test:e2e` 会先重新发布测试服务。直接在网站子项目运行端到端测试前，需要先执行根目录 `mise exec -- pnpm --filter achievement-export publish:test-host`。

其余保留项：

- `node_modules/` 是当前开发依赖，不属于失效文件；清除会要求重新安装。
- `.tools/clrmd3/`、`runtime9/`、`traceevent/`、`gcdump/`、`gcdump-package/` 仍被历史研究脚本引用。
- `.tools/clrmd/`、`ilspy/` 没有发现当前脚本直接引用，但属于手动研究工具；不能仅凭未被引用认定过期。
- `.tools/catalog-source/`、`runtime-source/` 是配置和运行时研究源码，不作为缓存删除。
- `research/` 已明确归档；与正式项目相似的源码是历史实现，当前没有依据整批删除。
- 根目录 `artifacts/` 中尚未确认无用的采集记录继续保留，参见上面的保留范围。

同时修正研究文档中残留的根目录 tools/tests 和旧 desktop/exporter 路径。

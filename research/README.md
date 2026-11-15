# 历史研究资料

`tools/` 是早期 PowerShell/C# 探测和导出实现，`tests/` 是对应的历史测试。正式程序使用 `achievement-export/Native/`，不依赖这些脚本。

脚本仍以仓库根目录为数据根目录：共享配置在 `data/`，研究采集证据及生成文件在 `artifacts/`，外部诊断工具在 `.tools/`。运行时研究记录见 [runtime-findings.md](../docs/research/runtime-findings.md)。

可从根目录运行 `pwsh -NoProfile -File research/tests/Smoke.ps1` 和 `research/tests/Workflow.ps1`。其他研究测试可能需要原始采集证据、管理员权限或游戏进程，不作为日常测试入口。日常验证使用根目录 `pnpm test`。

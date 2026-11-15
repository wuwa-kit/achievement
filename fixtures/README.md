# 测试样本

正式 C#、网页逻辑和端到端测试读取 `local/` 中的固定样本，不再读取最新导出目录。`local/` 包含真实账号进度和进程快照，已被 Git 忽略，不作为公开图鉴或站点资源发布。

本次从原 `reports/` 复制以下文件，复制时逐一校验 SHA-256；原始采集证据保留在 `artifacts/`：

- `achievements.json`：网页与交接测试输入。
- `csharp-live/achievements.json`：历史导出行为基准。
- `achievement-catalog.runtime.json`：配置重建基准。
- `session-24624/achievement-snapshot-first.json`、`achievement-snapshot.json`、`heap.gcdump`：首个账号的双快照和堆解析样本。
- `csharp-session-10324-20261114-071240/attempt-8-first.json`、`attempt-8-second.json`：切换账号回归样本。

新检出环境需从本地备份恢复上述相对路径到 `fixtures/local/`；不要用最新导出自动覆盖固定基准。静态配置仍读取 `data/achievement-catalog.json`。C# 资源指纹断言使用固定内容、大小和时间戳生成临时夹具，无需安装游戏。

测试生成文件写入 `artifacts/csharp-regression/` 或子项目的测试结果目录。

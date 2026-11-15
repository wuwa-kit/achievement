# 测试样本

C#、网页逻辑和端到端测试读取 `local/` 中的固定样本。这里包含真实账号进度和进程快照，已被 Git 忽略。

- `achievements.json`：网页与交接测试输入。
- `csharp-live/achievements.json`：包含其他玩法记录的 v2 网页兼容样本。
- `session-24624/achievement-snapshot-first.json`、`achievement-snapshot.json`、`heap.gcdump`：首个账号的双快照和堆解析样本。
- `csharp-session-10324-20261114-071240/attempt-8-first.json`、`attempt-8-second.json`：切换账号回归样本。

新检出环境需从本地备份按上述路径恢复样本。网页静态配置来自 `data/achievement-catalog.json`。双账号交接测试直接读取固定快照，无需先运行 C# 回归。

测试生成文件写入 `artifacts/csharp-regression/` 或子项目的测试结果目录。

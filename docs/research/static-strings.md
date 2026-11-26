# 磁盘字符串解析验证

2026-11-14，本机基础资源及 3.8.10 热更新资源验证成功。整个过程仅使用文件读取、AES 解码及 SQLite 只读查询，没有启动游戏、读取游戏进程或加载查询模块，也没有修改安装目录。

## 验证结果

- 扫描 `Client/Content/Paks` 和 `Client/Saved/Resources`，共 454 个 PAK，均为 v12；452 个索引加密，2 个索引未加密。
- 通过公开资源密钥识别候选解码参数；随后校验全部 454 个包的主索引、目录索引 SHA-1，全部通过。候选挂载路径可读本身不作为解码成功依据。
- 找到 `Client/Content/Aki/ConfigDB/<language>/lang_multi_text.db`、`lang_multi_text_1sthalf.db`、`lang_hot_patch.db`、`lang_achievement.db`，以及 `db_achievement.db`。
- 提取所选数据库共 82 个，全部呈现 SQLite 文件头。当前目标条目不压缩，使用 CustomData=2 的前 0x800 字节加密。解析器拒绝未支持的压缩方式或标记，不猜测内容。
- 查询 `MultiText` 表的 `Id`、`Content`、`RedirectDbIndex`。例如 `Achievement_100101_Name` 为简中“抛瓦！”、英文“POWER!”；`Achievement_201196_Name` 为简中“dnt/这是一个废弃的成就”。
- 对照现有 `data/achievement-catalog.json` 的成就名称、描述、小类及大类名称：13 种语言，每种 2,791 个字段，共 36,283 次比较，差异 **0**。包括缺失值比较；这不代表 13 种语言都有翻译。id/ru/vi 全部对应空值。
- 对参与字符串查询的数据库执行 SQLite `PRAGMA quick_check`，全部通过。

## 复跑

需要支持 `node:sqlite` 的 Node（项目固定版本可用）。以下从仓库根目录执行；输出位于被 Git 忽略的 `artifacts/static-strings/`，不要提交整份游戏数据库。

```powershell
New-Item -ItemType Directory -Force artifacts/static-strings
Invoke-WebRequest 'https://yarik0chka.github.io/wuwa-keys/keys.json' -OutFile artifacts/static-strings/public-keys.json
mise exec -- pnpm typecheck:research
mise exec -- node research/tools/inventory-static-paks.ts
mise exec -- node research/tools/inspect-static-strings.ts
mise exec -- node research/tools/extract-static-strings.ts
mise exec -- node research/tools/compare-static-strings.ts
```

第一步脚本可接受两个参数：`Client` 目录、公开密钥 JSON 路径。其余脚本读取上一步的本地结果，不执行网络请求。所有脚本只在仓库 `artifacts/static-strings` 下写入输出。

主要输出：

- `directory-report.json`：包目录、数量及索引校验结果。
- `extraction-report.json`：数据库来源包、虚拟路径、提取文件路径及 SHA-256。
- `achievement-strings.json`：离线读出的成就及分类字符串。
- `comparison.json`：各语言比较数量、缺失数量及差异详情。

## 核验互斥成就

[互斥成就配置](../../data/achievement-exclusive-groups.json) 独立维护，文件内容是整数二维数组。每组最多能完成其中一条。3.8.11 已核实以下七组。

| 成就 ID | 任务或互动 | 分支证据 |
| --- | --- | --- |
| 200710 / 200711 | 星海如故（二） | 告知或隐瞒真相，分支变量为 `1` 或 `0` |
| 200713 / 200714 | 捕影捉风及后续飞讯 | 任务节点 `189700004_2` 按是否提前通报分别设置 `0` 或 `1` |
| 200719 / 200720 | 星炬学院学生公寓前庭电话亭 | 拨打号码或留下便签，分支变量为 `1` 或 `2` |
| 200722 / 200723 | 菲茨的引路人（剧情配置名） | 节点 `194750010_15` 和 `194750002_6` 分别设置成功和失败变量 |
| 200728 / 200729 | 来自雪白深处 | 联络深空联合或和毛团聊聊，分支变量为 `1` 或 `2` |
| 200732 / 200733 | 升起的烟花，该从哪边看？ | 协助隐瞒或揭穿谎言，分支变量为 `1` 或 `2` |
| 200734 / 200735 | 钴蓝雪线的订单 | 任务节点 `176800029_80` 按是否及时调查遗留物分别设置 `1` 或 `2` |

核验分组时，用同版本的 `db_achievement.db` 核对成就 ID，再读 `db_condition.db` 的 `conditiongroup` 与 `condition`。上表可用「成就 ID + 101000000」定位条件组。用 `db_flowState.db` 的对话选项和 `db_QuestNodeData.db` 的任务节点确认分支。共用变量的不同取值也可能代表可依次达成的进度，互斥分支也可能使用不同的变量。

核验后的分组直接写入 `data/achievement-exclusive-groups.json`。重新生成成就目录时可以单独替换 `data/achievement-catalog.json`。更新任一文件后，运行 `mise exec -- pnpm --filter achievement-website build`。网页构建要求每组至少有两个正整数 ID，所有 ID 都存在于成就目录，同一 ID 只能出现一次。

## 当前边界

脚本使用现有 `data/achievement-catalog.json` 的 text key 查询离线数据库，再对照两边的文本。核验范围限于字符串，完整目录更新还需要解析 `db_achievement.db` 中的 `BinData` 以及分类、星级和奖励结构。

本机同一路径的基础包/补丁按扫描结果后者覆盖；正式集成必须显式实现客户端挂载优先级、删除记录和版本选择，不能把目录遍历顺序作为通用规则。本次选中的目标字段未遇到非零 RedirectDbIndex；脚本从字符串库中取唯一非空值，有冲突则记为差异，没有实现通用重定向优先级。未来版本需另行验证，不能无条件沿用。

公开密钥来自社区，可能随游戏版本变化。

## 格式参考

- [CUE4Parse FPakInfo](https://github.com/FabianFG/CUE4Parse/blob/master/CUE4Parse/UE4/Pak/Objects/FPakInfo.cs)：包尾结构与版本。
- [CUE4Parse FPakEntry](https://github.com/FabianFG/CUE4Parse/blob/master/CUE4Parse/UE4/Pak/Objects/FPakEntry.cs)：鸣潮 v12 条目布局。
- [CUE4Parse PartialEncryptionPakFileReader](https://github.com/FabianFG/CUE4Parse/blob/master/CUE4Parse/GameTypes/Misc/UE4/Paks/PartialEncryptionPakFileReader.cs)：按 CustomData 处理部分加密。
- [wuwa-keys](https://github.com/yarik0chka/wuwa-keys)：公开资源解码参数来源。

# 当前版本运行时验证（2026-11-14）

## 结论

已定位当前进程的成就业务类型及登录请求线索，但未得到完整模型字段值，**不能声称完成全量导出工具**。本机游戏资源版本目录为 3.8.0，热更新资源目录为 3.8.10；原始二进制 SHA-256 在 `artifacts/analysis.json` 中。

## 启动方式已验证

直接启动用户指定的 `Wuthering Waves.exe` 会出现 `kuro: Use launcher to start game!`。参考 [开源启动参数代码](https://github.com/ok-oldking/ok-wuthering-waves/blob/master/src/game_launcher.py) 后，读取官方 `kr_game_cache/platform_ui_state.bin` 中的资源档位，本机为 UHD。附加 `-krqlv=uhd` 后成功启动，用户确认完成登录。

因此此错误不等于“必须让官方启动器常驻”；此次失败是缺少资源档位参数。CLI 只读取档位，不修改启动器配置，也不读取账号令牌。启动器配置的 Base64/XOR 解码是读取格式，不是游戏资源包解密。

## 已定位的入口

从当前游戏的 .NET 诊断管道 `dotnet-diagnostic-12528` 获取到运行时版本 `9.0.6`。通过微软 [Diagnostic IPC 协议](https://github.com/dotnet/diagnostics/blob/main/documentation/design-docs/ipc-protocol.md) 的 EventPipe 收集并停止短时采样，得到 2,411,314 字节的 trace，使用微软 TraceEvent 3.2.8 解码。

得到 162 条含 Achievement 的方法记录，含泛型实例和 UI 辅助方法，不代表 162 条成就。主要线索如下：

| 类型/方法 | 证据性质 |
| --- | --- |
| `AchievementController.<RequestAchievementBasicInfo>d__11` | 登录请求异步状态机类型，见泛型 UniTask 实例的诊断事件 |
| `AchievementModel.get_Instance()` | 实际 JIT 方法；模型单例访问入口 |
| `Dictionary<int,List<AchievementData>>` | 诊断事件中的泛型类型；还不能断言对应哪个模型字段 |
| `AchievementModel.GetAchievementCategoryIndex` | 当前分类查找方法 |
| `AchievementModel.GetSearchResultIfNull` | 当前模型方法 |
| `AchievementData.GetFinishSort/GetDesc/GetRewards/GetAchievementShowStar` | 当前成就数据对象方法 |

`artifacts/managed-methods.json` 保存 MethodID、ModuleID、MethodToken、MethodStartAddress 等原始字段。**地址仅对应这一次进程，不是持久版本偏移。** 实际解析的是方法事件，不是仅对二进制字符串作推测。

Puerts / V8 同时存在：日志报告 V8 11.8.172.18，但当前成就日志来自 `Sharphereal: [C#]`。不能再把 Puerts 当作当前成就业务的已确认归属。

## 读取边界

| 验证 | 结果 |
| --- | --- |
| 非管理员 OpenProcess | 失败 |
| 管理员读取主模块候选基址的两个 PE 头字节 | ReadProcessMemory 返回 Win32 错误 5，未得到数据；模块枚举也未提供基址，因此候选地址仍来自崩溃栈 |
| 管理员 .NET ProcessInfo2 | 成功，确认 PID、x64、Windows、.NET 9.0.6 |
| EventPipe 方法元数据 | 成功 |
| ApplyStartupHook 元数据模块 | 返回 `0x80131515`；不能据此认定是哪项游戏保护造成，也不能说模块已在游戏内执行 |
| 本机 8971 / 8972 的常见 Inspector HTTP 查询 | 未得到可用调试目标列表；不能证明所有端口能力均不存在 |
| 登录日志 | 有 `Achievement PhraseBaseData response`，没有列表内容 |
| 用户打开成就总览和分类 | 有 UI 流程日志，没有完整状态快照 |

检查模块先在本机 PowerShell 的 .NET 进程成功验证。那份输出已单独命名为 `self-test-managed-metadata.txt`，不是游戏元数据。真实游戏尝试的结果在 `inspect-hook-result.json`，明确为失败。

## 日志可读但只提供增量

本机日志采用逐字节奇偶分支 XOR 混淆，可在内存中解码。方法参考 [作者的本地日志研究](https://pure.vermilion10.dev/blog/building-a-local-first-gacha-tracker/)；没有上传日志，也没有提取抽卡凭据。代码仅输出经过筛选和脱敏的成就证据。

历史日志中验证到：

```text
OnAchievementGroupProgressNotify [id: 400111][currentState: CanGetReward]
OnAchievementGroupProgressNotify [id: 301118][currentState: HaveGetReward]
```

这些是观察到的状态变更。选定的一份历史日志导出 45 条事件，不去重成账号快照，不假定日志属于同一账号，不把缺失成就判定为未完成，不把日志时间当作完成时间。当前登录会话没有对应状态变更，导出零条是正常的部分数据结果。

## 复跑

```powershell
# 通用诊断；PID 换成当次实际值，会自动请求 UAC
.\wuwa.ps1 -Command Probe -GameProcessId 12528

# 以下是研究命令，需在管理员 PowerShell 中运行；不要复用已结束的 PID
# Trace-Metadata 使用 CreateNew，已有同名 trace 时明确失败，避免覆盖证据
.\research\tools\Trace-Metadata.ps1 -GameProcessId 12528

# 本项目 .tools/traceevent 下已下载微软 NuGet 包 3.2.8，未纳入版本控制
# 解码用当前 PowerShell 7.6.10/.NET 10 测试，须有相应依赖
.\research\tools\Parse-Trace.ps1
```

下一个实现门槛是获得 `AchievementModel` 内真实字段和稳定读取途径，并对 UI 样本及列表完整性作验证。EventPipe 元数据无法替代字段值；当前日志也不能构造完整快照。在此门槛通过之前，不能自动宣布导出成功或关闭用户游戏。

## 第二轮：C# 模型和诊断能力专项验证

继续使用同一个登录会话 PID 12528，未重启游戏，没有修改反作弊或运行时配置。

### 权限问题已缩小到句柄权限丢失

增加 `NtQueryObject(ObjectBasicInformation)`，只查询我们自己持有的进程句柄：

| 对照 | 请求访问掩码 | 实际授予 | VM_READ | 两字节读取 |
| --- | --- | --- | --- | --- |
| 自身 PowerShell 进程 | `0x410` | `0x1410` | 有 | 成功 |
| 游戏的成就模型 JIT 地址 | `0x410` | `0x1400` | 无 | 错误 5 |
| 游戏的 CLR 方法元数据地址 | `0x410` | `0x1400` | 无 | 错误 5 |

`0x10` 即 `PROCESS_VM_READ`，游戏句柄没有得到该权限。相比仅尝试主模块候选地址，这进一步排除了“仅因主模块地址猜错”的解释。具体是哪一个保护组件移除权限尚未归因，不能直接写成已证实是 ACE。详见 `artifacts/managed-access.json`；自进程对照测试为 `research/tests/ManagedDiagnostics.ps1`。

### StartupHook 返回码进一步核对

核对 [.NET 9.0.6 原版实现](https://github.com/dotnet/runtime/blob/v9.0.6/src/libraries/System.Private.CoreLib/src/System/StartupHookProvider.cs) 后，确认 `System.StartupHookProvider.IsSupported=false` 时原版代码直接返回，不应据返回码就断言该开关关闭。

在启用 Exception + Loader 事件的短时采集中复现请求，仍得到 `0x80131515`，trace 中没有捕获到对应托管异常/程序集事件。因此没有进一步获得具体异常原因；不能把“没收到事件”当成完全没有执行过任何内部路径。

安装内 `coreclr.dll` 的 Authenticode 签名有效，签名主体为广州库洛科技有限公司，文件版本为 `42,42,42,42424`，产品版本 `9.0.6`。这些事实说明应以本机构建的实际行为为准，不能直接等同于微软原版发行二进制；它们本身不证明某一诊断功能被刻意关闭。

### GC 对象图采集成功

使用微软签名的官方 `dotnet-gcdump 10.0.750501`，20 秒采集超时设置，工具实际约 21 秒完成，退出码 0，生成 31,680,223 字节 `.gcdump`。它触发了 Gen2 GC，不是整个进程的原始内存转储。工具提醒该运行时不支持 .NET 11 的无损缓冲模式；尽管退出成功，也不据此承诺没有事件丢失。

离线图包含 1,271,764 个节点，计数/大小采样倍率均为 1。微软工具的统计与本项目遍历结果一致：

| 类型 | 所属模块 | 实际对象数量 |
| --- | --- | --- |
| `AchievementModel` | `Aki.Game.dll` | 1 |
| `AchievementData` | `Aki.Game.dll` | 1,408 |
| `AchievementGroupData` | `Aki.Game.dll` | 52 |
| `AchievementCategoryData` | `Aki.Game.dll` | 4 |

从模型实例出发，确实可以遍历到如下引用关系：

```text
AchievementModel
  ├─ Dictionary<int, AchievementData>
  │    └─ Entry[] → 1,408 个 AchievementData
  ├─ Dictionary<int, AchievementGroupData>
  ├─ Dictionary<int, List<AchievementData>>
  ├─ Dictionary<int, List<AchievementGroupData>>
  └─ List<AchievementCategoryData>
```

这是动态实例证据，强于泛型方法名称推测。但尚没有模型字段的名称、偏移及标量值。另发现 `Aki.Protocol.dll` 中的 `AchievementInfoResponse`、`AchievementUpdateResponse`、`AchievementEntry` 类型；这份快照中对应的非数组消息对象计数为 0，不能从这些类型名称还原登录响应。

### 为什么对象图仍不足以导出

GC 节点事件的内容是 `Address / Size / TypeID / EdgeCount`，边事件包含 `Target / ReferencingField`。其中没有任意对象字段的字节内容。整数成就 ID、状态枚举、进度等标量不随引用图输出，`System.String` 节点也不等于字符串内容。因此不能把对象地址、节点索引、数组位置或数量伪装成成就 ID/进度。

参考微软 [GC dump 工具说明](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-gcdump)。下一道门槛仍是可用的字段值读取接口。继续重复普通 EventPipe / GC 图采集不会自行补齐这些值。

### 新增复跑脚本

```powershell
# 自身进程对照，不接触游戏；PowerShell 7 还会测试诊断 IPC
.\research\tests\ManagedDiagnostics.ps1

# 研究命令：管理员 PowerShell，PID 必须仍匹配 runtime-probe.json 的进程创建时间
# 文件存在时拒绝覆盖，先保留上一轮证据再进行新的采集
.\research\tools\Probe-Heap.ps1 -GameProcessId 12528

# 离线解析，PowerShell 7，无须管理员
.\research\tools\Inspect-HeapGraph.ps1
```

工具和 NuGet 包下载于微软官方链接，放在 `.tools/` 且未提交版本控制。图分析输出 `artifacts/achievement-object-graph.tsv`，明确标记完整导出为 false、标量值不可用；采集日志、权限探测和异常探测结果均保存在 `artifacts/`。本轮仍未关闭游戏，也没有输出伪全量成就文件。

## 第三轮：剩余诊断入口验证

为区分“StartupHook 单个功能不支持”与“其他官方加载接口可用”，进一步检查 Diagnostic IPC 的 `AttachProfiler` 请求。测试刻意使用不存在的随机 DLL 路径与随机 CLSID，不创建 DLL、不注册 COM，不会实际加载分析器。

| 对照 | 结果 |
| --- | --- |
| 自身普通 .NET 进程 | `0x8007007E`，进入了模块加载检查，找不到指定模块 |
| 当前游戏进程 | `0x80131515`，不支持 |

原始结果为 `artifacts/diagnostic-capabilities.json`；脚本为 `research/tools/Probe-DiagnosticCapabilities.ps1`。对照测试与“拒绝已有路径，确保不加载文件”的检查已加入 `research/tests/ManagedDiagnostics.ps1`。

还读取了唯一未标记加密的基础 PAK 主索引：`pakchunk43-WindowsNoEditor.pak` 的挂载根为 `../../../Client/Content/Aki/Config/UniverseEditorConfig/`，并未取得 `Aki.Game.dll`。安装目录中也未发现独立的 Aki 托管程序集。这些结果不证明其他资源包中不存在程序集，但当前没有可直接读取的程序集副本。

### 当前路线的结论

已实际验证的官方 .NET 接口只能取得进程信息、方法元数据和 GC 引用图；外部 VM_READ 权限缺失，StartupHook 和 Profiler 请求均被拒绝。**这条“使用当前客户端开放的诊断能力读取完整成就字段”的路线已遇到明确阻塞，不能实现全量导出。** 本项目没有成功读取任何完整成就快照，也没有停用保护、修改运行时或伪造导出成功。

要继续完成原始产品目标，需要新的字段值读取途径或改用另一种数据来源；重复已有采集无法补足标量值。

## 第四轮：保留启动时创建的句柄（进行中）

2026-11-14 04:20，通过 `CREATE_SUSPENDED` 创建实际游戏程序，传入安装档位 `-krqlv=uhd`，保留创建返回的进程句柄后恢复主线程。没有加载 DLL 或修改游戏内存。代码为 `research/tools/StartupProcess.cs` 和 `research/tools/Start-EarlyProbe.ps1`。

本次 PID 23924 在恢复前及恢复后多次探测均得到 `GrantedAccess=0x001FFFFF`，从 PEB 读出实际映像基址，并成功读取该地址的 `MZ` 字节。原始记录在 `artifacts/early-access.jsonl`，会话信息在 `artifacts/early-session.json`。这与游戏运行后重新 `OpenProcess` 的失败不同，说明先前结论不能扩展为“所有进程读取方式都失败”。

当前仍在等待登录后验证。读取程序头不代表已读取托管堆或成就字段，也不代表完整导出成功。测试助手最多保留句柄 900 秒，结束时释放句柄，不关闭已恢复运行的游戏。

用户随后确认已经登录并打开成就分类。原助手在登录后仍连续读取成功（至少持续至 04:24）。另一个管理员助手尝试复制创建句柄并读取时报告拒绝访问；该初次报告未区分具体失败阶段，不据此断言 DuplicateHandle 本身被拒绝。

下一步后端为 `Start-ClrProbe.ps1`：使用 PowerShell 7 在同一启动助手中，通过 `StartupClrReader` 将原始句柄提供给 ClrMD 3.1.512801。`Inspect-StartupClr.ps1` 首先只验证运行时识别、堆遍历和成就字段元数据，输出始终标记 `complete=false`。微软官方 .NET 9.0.6 DAC 与库洛定制运行时的兼容性尚未验证；实验允许 DAC 版本不匹配，成功加载也不能独自证明字段解释正确。读取器不请求线程上下文、不写内存、不注入模块。

### 同进程读取后端实测结果

用户退出后，04:25 使用新助手创建 PID 20604，用户再次登录并打开分类页。原始句柄仍能读取内存，模块枚举及运行时 PE 识别成功。ClrMD 识别游戏 coreclr 版本为 `42.42.42.42424`，但官方 9.0.6 DAC 初始化返回 `0x80131c4f`。官方源码定义此错误为 `CORDBG_E_MISSING_DEBUGGER_EXPORTS`，即缺少预期的调试导出表。通过相同读取器查询游戏 coreclr 的 `g_dacTable` 返回零。

对照：相同读取器在本机 PowerShell 的标准 .NET 10 中能取得非零 `g_dacTable`，使用该运行时配套 DAC 初始化成功。`research/tests/StartupClr.ps1` 检查这一链路。证据为 `artifacts/startup-clr.json`、`artifacts/startup-clr-self.json` 和 `artifacts/clr-access.jsonl`。没有输出成就字段，也没有自动关闭这次客户端。

因此，创建句柄保留方案确实解决了本次测试的读取权限问题；接下来的阻塞是定制 CLR 的对象解析，不能混称为 ReadProcessMemory 被反作弊拒绝。这不等于 Yae 的进程内 hook 方案已被验证失败，本轮没有实施该 hook。完整 CLI 导出仍未实现。

## 第五轮：Mono 字段解析与真实导出成功

2026-11-14，EventPipe 的 Runtime/Start 明确报告 `Sku="Mono"`、BCL 9.0.6。先前因为文件名 `coreclr.dll` 而沿标准 CoreCLR/DAC 路线推进是不充分的判断；缺少 `g_dacTable` 不能用来证明 Mono 对象无法读取。

通过 GC 图定位对象，按官方 Mono 9.0.6 的 `MonoVTable`、`MonoClass`、`MonoClassField`、`MonoGenericClass` 定义读取元数据，实际取得 `AchievementModel.AchievementMap` 及 `AchievementData` 字段名。成就业务偏移来自运行中的字段元数据；Mono 基础结构布局仍绑定当前 runtime SHA-256。

实测 `AchievementData` 字段：Id=76，FinishTime=40，HasGetRewardState=56，CurrentProgress=60，MaxProgress=68；进度、时间、领取状态均通过实际 `Nullable<T>` 的 hasValue/value 元数据解释，没有把空值转成零。这些记录是本构建证据，不应作为跨版本固定偏移。

PID 3916 的字典中共有 1,408 项，每个键与对象 Id 一致、无重复，字典有效计数一致；连续两次读取完全相同。52 项已领取、3 项已完成待领取，与模型完成计数 55 一致。用户确认 UI 显示 55 项、87 星、3 项可领取。ID 400205 的进度、上限及完成时间为空，保留为 unknown。

`artifacts/achievements.json` 已实际写出并回读校验，随后使用本次创建句柄关闭 PID 3916；`artifacts/export-result.json` 的 gameExited=true，采集助手也观察到进程退出。上述成功是同一持有句柄的助手中完成的，没有复制句柄、注入代码或修改内存。

相关实现：`Export-MonoSnapshot.ps1`（字典和字段校验）、`Snapshot.ps1`（稳定快照校验、空值保持、原子落盘）、`Complete-Export.ps1`（成功后仅关闭拥有的进程）、`Export-Workflow.ps1`（独立 CLI 登录等待和流程编排）。真实快照回归测试包含重复 ID、两次状态变化拒绝检查。

此前一次 PowerShell 解析错误导致研究助手退出和句柄释放，已修复，并给研究助手增加单次请求异常隔离；没有将此开发错误归因于游戏保护。

### 独立 CLI 最终验收

直接运行 `pwsh -File wuwa.ps1 -Command Export`，自动 UAC 后创建 PID 28920。用户只需登录，无需打开成就页；CLI 自动检测本次登录的成就同步日志、采集、完成两次一致性检查、写出 1,408 条记录并关闭 PID 28920。完成时间 2026-11-14 04:39:36（Asia/Shanghai），`export-result.json` 确认 success=true、gameExited=true。本轮使用正式 Export-Workflow，没有研究请求文件触发。

## 第六轮：客户端配置、多语言与分类导出

2026-11-14，PID 24624 中成功取得成就配置、掉落包、分类文本与指定文化代码的成就标题和描述。第五轮普通进度采集不加载查询 DLL；本轮为补齐未加载的语言资源，新增了进程内托管配置查询，不能沿用“所有流程均不注入”的描述。

`MonoCatalogBridge.cs` 使用保留的创建句柄，在本次进程中分配自身启动代码和参数，通过已经校验版本的 Mono 嵌入 API 加载 `CatalogPayload.cs` 编译的程序集。查询排入游戏的 UniTaskSynchronizationContext，每批处理 4 项。只调用配置读取及状态判断方法；不调用奖励领取或账号修改接口。配置读取会填充游戏的配置缓存。没有修改游戏代码页或关闭保护。用于启动查询的临时分配在启动线程结束后释放；托管查询程序集随游戏退出释放。

`Refresh-ClientCatalog.ps1` 已在这个运行中的游戏中实际通过：按源码哈希编译查询 DLL → 启动 → 等待 complete → 构建静态缓存。完整类别配置经 ConfigAchievementCategoryAll → ConfigAchievementGroupByCategory → ConfigAchievementByGroupId 遍历，所得 ID 集合与 1,408 条快照完全一致，避免把仅打开页面的缓存子集当作全部成就。新增集合校验最初使用 .NET Framework HashSet，引入了客户端不具备的 System.Core 4.0 引用，导致单次查询失败；改用基础程序集的 Dictionary 后重新编译与实测成功，游戏无需重启。

常规菜单只包含 FunctionType=1：索拉漫行、长路留迹、铿锵刃鸣、诸音声轨，共 36 个小类、1,307 条成就；另外 101 条属于其他玩法，不能混入常规总数。常规成就配置中 269 条 Hidden=true，1,038 条为普通成就。

隐藏属性与实际显示状态分开导出。实际逻辑来自 AchievementData.GetShowState、AchievementGroupData.GetShowState：分类解锁且 Enable；MaxProgress 非空；隐藏成就必须完成；前置阶段必须领取；已领取且有下一阶段时被替代。`Catalog.ps1` 在每次新快照上重算，静态缓存不存账号可见性。本次全 1,408 条的隐藏标记、可见状态和完成状态，已与查询模块调用客户端方法得到的结果逐条一致；常规菜单可见 999 条。

奖励取 OverrideDropId，缺省时从 AchievementStarLevel 的 DropId 取 DropPackage.DropPreview；客户端 ItemInfo 确认物品 3 为“星声”/“Astrite”。1,307 条常规成就的单项奖励配置合计 8,810，已领取 425、待领取 25。该统计不包括小类完成奖励与其他玩法记录。星级与星声不能按固定倍率换算。

语言使用 ConfigMultiTextLang.GetLocalTextNew(textKey, culture)，由客户端自行处理主语言库及重定向库，不切换游戏界面语言。13 个声明代码中，de/en/es/fr/ja/ko/pt/th/zh-Hans/zh-Hant 有资源；id/ru/vi 查询无资源。简中 1,307 条，其他九种有效语言各 1,306 条；201196 的简中为“dnt/这是一个废弃的成就”，其他语言缺失，原样保持 null。覆盖信息及缺失 ID 输出到 languageCoverage，不用英文或机器翻译补空值。其他玩法的无标题记录也保持客户端返回结果。

`data/achievement-catalog.json` 与 `data/locales/*.json` 为本机客户端查询结果。正式 Export 流程会核对本机资源指纹，缓存不存在或失效时调用上述刷新流程，刷新后重新读取两次账号快照；缓存匹配时只使用原有外部读取路线。`RefreshCatalog` 可强制刷新。输出 schemaVersion=2，另提供四大类的简中嵌套视图和其他玩法独立视图。

新增 tests/Catalog.ps1 验证真实客户端逐项状态、全部分类 ID 唯一引用、奖励总和、语言覆盖、序列化后的完整简中标题描述、隐藏成就不丢失，以及分类状态变化时拒绝导出。实现时发现 PowerShell 的 Measure-Object 不对 OrderedDictionary 的键执行预期的属性求和；把丰富后的成就行转为 PSCustomObject 后，金额统计与原生客户端结果一致。Snapshot、Catalog、Smoke、Workflow 测试均已通过。

### 本轮最终落盘与退出验证

2026-11-14 05:11:26（Asia/Shanghai），当前 PID 24624 的新快照与首次快照通过一致性检查，Complete-Export 实际写出 schemaVersion=2 的 achievements.json、achievement-tree.zh-Hans.json 和 other-gameplay-achievements.json，随后关闭本次创建的进程。export-result.json 确认 pid=24624、success=true、gameExited=true。三份报告再次反序列化验证通过。本次新增配置刷新与最终导出是在仍持有句柄的研究助手中完成；正式 CLI 的冷启动、UAC、等待登录和自动退出已在第五轮独立验收，本轮没有要求用户再登录一次。

## 第七轮：正式导出链路迁移到 C#

2026-11-14，新增 achievement-export/Wuwa.Export（.NET 10 Windows CLI）、CatalogPayload（预编译 net48 查询 DLL）和 Wuwa.Export.Tests（C# 回归程序）。运行时不调用 PowerShell、Add-Type 或现场编译器。UAC、启动器资源档位、启动句柄、登录日志等待、gcdump 子进程、Mono 字段解析、配置缓存、双快照校验、JSON 落盘与退出均由 C# 处理。React 展示页没有修改。

使用 mise 安装 SDK 10.0.404。微软 dotnet-gcdump 固定为已验证的 10.0.750501，通过 NuGet PackageDownload 自动恢复，DLL 哈希与历史 .tools 版本逐一一致。诊断程序集入口运行于自身的独立 C# 子进程；不要求安装 dotnet-gcdump 全局工具。发布为 Windows x64 自包含目录，运行时不需要 PowerShell、SDK、系统 .NET 或 mise。Export.cmd、Launch.cmd、Analyze.cmd 已切换到 C# 程序。

回归共 37 项：以原有真实导出逐字段验证全部成就、分类树、其他玩法、语言覆盖、星声金额和可空字段；验证拒绝重复 ID、缺失配置、变化中的分组和星数，验证资源指纹、诊断图读取、启动器缓存档位及 JSON 回读。完整模型路径与旧 v2 输出一致。

首轮实机 PID 28824 在双快照一致性检查处停止，保留游戏；当时未保存每次快照，不能进一步断言具体哪个字段发生变化。现已添加最多 8 次稳定性重试和逐次快照差异记录。第二轮 PID 20972 证明未打开成就页时模型只有 1,407 条，缺少 400205；这不是内存读取权限问题。该记录配置存在但没有下发进度，旧的“配置 ID 必须等于当前模型 ID”条件过严。

修复后，配置查询按完整配置目录遍历，在客户端自身的 GetAchievementData 读取过程中完成延迟初始化，再重新采集 GC 图和两次快照。普通静态缓存路径允许保留尚未进入模型的配置记录，将其进度、完成时间和领取状态保留 null，status=unknown，标记 progressSource=catalog-only，coverage=clientAchievementMap+catalog，同时分别提供 clientModelCount 与 catalogOnlyCount，不凭空生成服务器进度。该真实 1,407 条场景已通过 C# 回归和原 React 校验器。

最终 PID 29108 使用发布目录的独立 Wuwa.Export.exe refresh-catalog，程序自动 UAC，用户只登录、未打开成就页。完整配置查询取得 1,408 条，随后重新采集 GC 图，连续两次读取通过，写出全部报告并关闭本次游戏。完成时间 2026-11-14 05:38:19（Asia/Shanghai）。artifacts/csharp-live/export-result.json 确认 success=true、gameExited=true、backend=csharp。实际输出仍为 4 大类、36 小类、1,307 常规成就、101 其他玩法、269 隐藏成就、55 已完成、87 成就星数；单项奖励 8,810 星声，已领 425、待领 25。原 React 数据校验器直接接受此文件。

最后修正了缓存路径可能补齐记录时的完成提示和结果计数：使用实际导出的记录数，同时单列 clientModelCount。这不改变采集或关闭逻辑；最终发布重新构建成功，37 项回归再次通过。历史 PowerShell 脚本保留作为研究证据，不是正式运行依赖。

## 他域交集 101 条记录的范围核对（2026-11-14）

本机静态配置直接确认：常规成就分类 ID 1–4 的 FunctionType=1；分类 ID 7–12 的 FunctionType=2，均复用 AchievementCategory_6_Name，简体中文文本为“他域交集”。后者分别有 14、14、19、24、19、11 条，合计 101 条，分布于 16 个小类。不是四大类中的隐藏成就，也不是普通成就页面漏显示。

条目描述分别包含深坠异想奇境、燃梦的黑炎、共赴梦宴、异梦聚合、异构绮梦、扉渊梦居等玩法目标。例：101700101 为“使用无冠者声骸通关难度Ⅳ”，101700205 为“通关一次深坠异想奇境难度Ⅴ”。本次资源中这 101 条均没有简中标题，但有描述；不能将无标题直接解释为解析失败。

采集器通过 ConfigAchievementCategoryAll 枚举所有类别，并遍历共用 AchievementModel，因此同时保留了这些非主菜单记录。网站把 inMainMenu=false 的记录命名为“其他玩法”，该名字过于宽泛，应明确解释为“他域交集／玩法任务配置（非四大类成就）”。这只能证明配置存在及共享数据模型，不证明当前版本仍开放相应活动，也不证明 0 进度是玩家历史未完成；活动开放期和历史进度持久化机制本轮未核实。

核对最新导出：主菜单 1307 条，完成 55；非主菜单 101 条，本次读取均为 in_progress、CurrentProgress=0。总星数 87 来自客户端模型，未按全部记录的 level 累加。主菜单星声统计明确按 inMainMenu=true 过滤，为配置合计 8810、已领取 425、待领取 25。101 条非主菜单配置的星声合计 1090 未并入这些数字，更不能据此宣称现在还可领取 1090 星声。

范围表达应为“1307 条常规成就 + 101 条非主菜单玩法配置”，不能把 1408 宣称为游戏成就页的成就总数。原始完整导出可保留两类记录以便审计，面向玩家的成就清单与完成统计只使用四大类。此结论来自本机 data/achievement-catalog.json、artifacts/achievements.json、research/tools/CatalogPayload.cs 与 achievement-export/Wuwa.Export/ExportBuilder.cs；网络数据库是否聚合相同分类须逐 ID 比较，不能仅凭同为 101 条判定完全一致。

## 成就首次加入版本字段核查（2026-11-14）

使用本机已保存的 Aki.Config.dll（SHA256 B1C17CF065B4118A72F9B11C1457A90B62073B44D28D3826E042AA20695A82D3）离线反编译 Aki.Config.Achievement，得到 14 个序列化字段：Id、GroupId、Level、Name、Desc、IconPath、OverrideDropId、Hidden、NextLink、ClientTrigger、ThirdPartyTrophyId、ExternalTrophyId、GPExternalTrophyId、XSXExternalTrophyId。没有首次加入版本/发布时间字段。Level 是成就星级配置键，非游戏版本。

同时检查 AchievementGroup、AchievementCategory、AchievementData、AchievementModel、AchievementConfig：没有找到首次加入版本属性或成就版本查询。配置索引包括 AchievementAll、AchievementByGroupId、AchievementById 等，没有成就按版本索引。ValidateVersion() 的完整实现仅调用 FlatBufferConstants.FLATBUFFERS_25_2_10()，是序列化库兼容性检查，不是游戏版本。

对 artifacts/session-24624/config-buffers 下全部 1307 个 AchievementById 原始缓冲区读取 FlatBuffers 根表及 vtable：每个表均为 14 个槽，与上述结构一致，没有超出已知结构的尾部版本字段。反编译证据保存于同目录 AchievementSchema.cs、config-structs.txt、config-classes.txt。DownLoadVersion 的字段与 ConfigDownLoadSubPackageByVersion 索引属于另一组下载配置，未发现其与成就 ID 的加入版本映射；不能借它给成就补版本。FinishTime 是账号完成时间，也不能替代首次加入版本。

结论边界：当前已验证客户端的成就配置链路没有可直接读取的首次加入版本。不能由单份当前配置反推历史上线版本，因此本轮不加入无来源的版本标签或筛选。若后续要提供该功能，需另行验证历史配置差分或外部 ID→版本映射；资源预置时间与正式可获得版本仍需区分。本轮无需启动游戏，未更改导出/网页行为。

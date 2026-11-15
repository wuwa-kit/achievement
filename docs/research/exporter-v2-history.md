# 历史 v2 导出器记录（已由 v3 替代）

# Windows 桌面导出程序

正式桌面入口：`artifacts/app/Wuwa.Desktop.exe`（C# / .NET 10 / WPF）。应用清单指定 `requireAdministrator`，双击自动触发 UAC。窗口包含游戏路径、网站地址、重新读取配置、导出、取消与发送已有导出。

默认网站为 `http://127.0.0.1:5173`，将来可改成 HTTPS 站点。设置存放在 `%LOCALAPPDATA%/WuwaAchievementExporter/settings.json`。源码目录内运行时输出到项目 `artifacts/`；独立分发时使用 `%LOCALAPPDATA%/WuwaAchievementExporter/` 存放数据与报告。

`Wuwa.Desktop/` 调用现有 C# 导出核心；`Wuwa.Transfer/` 提供 Kestrel 临时交接；`Wuwa.Transfer.Tests/` 覆盖密钥、Origin、Host、CORS、确认、超时和取消。`Wuwa.Export/` 保留兼容 CLI 和诊断功能。正式流程没有调用 PowerShell。

```powershell
mise trust
mise install
mise exec -- dotnet publish Wuwa.Desktop -c Release --self-contained true -o artifacts/app
mise exec -- dotnet run --project Wuwa.Transfer.Tests -c Release
mise exec -- dotnet run --project Wuwa.Export.Tests -c Release -- ..
# 网站端到端测试的真实服务测试宿主
mise exec -- dotnet publish Wuwa.Transfer.Tests -c Release -r win-x64 --self-contained true -o artifacts/transfer-tests
```

交接协议：浏览器 fragment 为 `handoff=v1&port=PORT&key=KEY`。网页以 `Authorization: Bearer KEY` 请求 `GET /v1/export`，校验 v2 JSON 并写入 IndexedDB 后，`POST /v1/ack` 提交 `{ "transferId": "..." }`。成功确认后关闭监听；未接收时 5 分钟过期。Origin 仅允许配置的网站来源，Host 仅允许实际回环端口。key 不写入应用日志。

网站和桌面是独立发布物。桌面不内置网站、不托管远程网页，也不需要在 Windows 注册 URL 协议。HTTPS 网站访问回环服务的授权行为取决于浏览器；拒绝本机网络访问时可用手动 JSON 导入。

## 兼容 CLI 与实现细节


正式导出流程已迁入 C#：UAC 提权、资源档位识别、保留创建句柄启动游戏、等待登录、GC 图采集、Mono 字段读取、双快照校验、配置和语言查询、JSON 写入、关闭本次游戏。React 展示页及 v2 JSON 格式保持兼容。

## 运行

桌面界面直接双击 `artifacts/app/Wuwa.Desktop.exe`；命令行直接运行 `publish/Wuwa.Export.exe`，不需要启动脚本。CLI 无参数等价于 `export`，会请求管理员权限；登录游戏后自动导出，成功后关闭自己启动的游戏。已有游戏运行时拒绝重复启动。失败或 Ctrl+C 取消时保留已恢复运行的游戏。

发布目录为 Windows x64 自包含版本，**运行时不需要 PowerShell、.NET SDK、系统 .NET 或 mise**。请保留整个 `publish/` 目录，不能只复制其中的 exe；里面包含诊断程序集、查询 DLL 和 .NET 运行时。

```powershell
.\publish\Wuwa.Export.exe export
.\publish\Wuwa.Export.exe refresh-catalog
.\publish\Wuwa.Export.exe export --game 'D:\Games\Wuthering Waves\Wuthering Waves.exe' --quality uhd --output 'D:\Exports'
.\publish\Wuwa.Export.exe --help
```

默认寻找上级项目目录并使用其 `artifacts/` 与 `data/`。分发到其他目录时可通过 `--root PATH` 指定数据根目录。默认等待登录 600 秒，可用 `--timeout 900` 调整。

输出文件：`achievements.json`、`achievement-tree.zh-Hans.json`。`export-result.json` 包含 success、backend=csharp、pid、gameExited 等结果；失败时为 success=false。审计快照和诊断日志保存在独立的 `csharp-session-*` 子目录。

`refresh-catalog` 强制刷新静态配置；普通 `export` 在缓存缺失或资源指纹变动时自动刷新。刷新使用预编译的 `Wuwa.CatalogPayload.dll`，由 Mono 嵌入接口加载后在游戏主线程查询配置，不调用奖励领取接口。更新配置后重新采集 GC 图，避免使用查询期间 GC 移动前的对象地址。运行时布局仍绑定已验证的客户端 SHA-256，未知版本拒绝执行。

## 源码与构建

- `Wuwa.Export/`：.NET 10 Windows CLI，处理全部运行流程。
- `CatalogPayload/`：供客户端 Mono 加载的查询模块。目标 net48 是为了沿用已验证的 mscorlib 引用方式；它不作为 .NET 10 CLI 的托管引用。
- `Wuwa.Export.Tests/`：C# 回归验证程序，不启动游戏。
- `Native/*.cs`：正式使用的原生进程接口和诊断解析代码，没有调用 `.ps1` 或运行时 `Add-Type`。`research/tools/` 保留历史副本，不参与正式构建。

编译用 SDK 由根目录 `mise.toml` 与本目录 `global.json` 固定；框架引用包由 NuGet 锁文件固定。可在根目录运行 `mise exec -- pnpm --filter achievement-export build`、`test`、`publish:desktop`。Node/TS 脚本只封装 dotnet 构建命令，不参与 EXE 运行。诊断程序集由 NuGet 自动下载固定版本 `dotnet-gcdump 10.0.750501`，构建和发布运行不依赖历史 `.tools/` 目录。

```powershell
mise trust
mise install
mise exec -- dotnet build Wuwa.Export/Wuwa.Export.csproj -c Release
mise exec -- dotnet publish Wuwa.Export/Wuwa.Export.csproj -c Release --self-contained true -o publish
mise exec -- dotnet run --project Wuwa.Export.Tests -c Release -- ..
```

## 回归与辅助命令

回归程序使用 `fixtures/local/session-24624/` 的真实快照与原导出作为基准，逐字段比较全部成就、分类树、语言覆盖、奖励和空值，同时拒绝重复 ID、变化中的快照及缺失配置。输出到 `artifacts/csharp-regression/`。

```powershell
.\publish\Wuwa.Export.exe replay --first ..\artifacts\session-24624\achievement-snapshot-first.json --second ..\artifacts\session-24624\achievement-snapshot.json --output ..\artifacts\replay
.\publish\Wuwa.Export.exe analyze
.\publish\Wuwa.Export.exe launch
.\publish\Wuwa.Export.exe probe --pid 12345
.\publish\Wuwa.Export.exe export-events --log 'D:\Client.log'
```

`replay` 只转换既有快照，不启动、访问或关闭游戏；`launch` 仅启动游戏，不宣称导出完成；`probe` 只接受明确指定的游戏 PID，尝试普通权限读取；`analyze` 为 PE 文件哈希与字符串证据检查；`export-events` 仅提取日志增量，始终标为不完整，不作为账号快照。

旧 PowerShell 脚本保留为研究记录和回归参考，不再是正式入口的运行依赖。首次或刷新配置会加载查询 DLL，与旧版已验证的刷新机制相同；普通缓存命中路径只读取进度。

## 客户端延迟加载与稳定性

登录期间的成就同步可能分批发生。C# 采集最多尝试 8 组双快照，校验失败时保存每次差异并等待状态稳定，超过上限才报告失败。校验不会把不一致快照当作成功。

无需打开成就页时，客户端模型可能只有 1,407 条，已知 ID 400205 尚未创建。配置查询现在按完整配置目录遍历所有 ID；查询客户端状态时由客户端自身的读取接口完成延迟初始化，再采集新快照。普通缓存路径无需因此注入：仅在配置中存在的记录保留在输出，进度、完成时间和领取状态均为 null，status=unknown，额外标记 progressSource=catalog-only；阶段关系来自静态配置，不伪造服务器进度。此时 coverage=clientAchievementMap+catalog，并分别提供 clientModelCount 和 catalogOnlyCount。完整模型路径保持原格式不变。

## 本机验收

2026-11-14 05:38:19，独立发布程序已完成 UAC → 启动 → 用户登录 → 强制刷新全部配置/语言 → 重新采集与双快照校验 → 导出 1,408 条 → 关闭本次进程。证据为 `../artifacts/csharp-live/export-result.json`，结果 success=true、gameExited=true、backend=csharp。37 项 C# 回归通过，React 原有数据校验器直接接受实机导出。此次验收文件使用专用目录，原 `artifacts/` 导出保留作为迁移对照；项目内运行桌面 EXE 仍输出到 `artifacts/`。


## WPF 完整流程验收

2026-11-14 06:05:58（北京时间），修复诊断入口的 Dispatcher 同步上下文死锁后，WPF 发布版完成启动游戏、登录后自动采集、导出及关闭本次游戏。`../artifacts/export-result.json` 记录 success=true、gameExited=true、count=1408、clientModelCount=1407；配置补齐的记录保留未知进度。用户随后确认网页“已接收”，完成 WPF → 临时 Kestrel 服务 → 网站保存的实际交接。

另已通过 16 项本机服务检查和 10 项浏览器测试，覆盖 Origin/Host/key 校验、过期关闭、接收确认、确认失败重试和刷新后恢复。网站仍使用本机地址；公共 HTTPS 部署与其浏览器本机网络权限提示尚未验收。

当前范围（2026-11-14 更新）：正式 JSON、分类树和网站仅包含 FunctionType=1 的四大类，共 1,307 条；不再生成 other-gameplay-achievements.json。完整客户端模型与配置缓存仅供内部校验和研究，不作为玩家成就清单。旧 JSON 仍可导入，网站自动去除非主菜单记录。


最新过滤规则：ID 400205 在缺少有效进度及完成证据时由 C# 导出端排除，当前正式导出为 1,306 条；分类索引、奖励和语言覆盖同步过滤。网站兼容过滤旧档案，不显示排除说明。原始研究快照不改写；该条有有效状态时恢复导出。

切换账号回归（2026-11-14）：客户端总完成数只统计 FunctionType=1，但共享模型还包含他域交集。完成数校验现按配置中的四大类 ID 统计；无配置的刷新前阶段仅校验结构和双快照稳定性，最终导出仍执行完成数校验。失败会话 `csharp-session-10324-20261114-071240` 中主菜单完成 1,200 项、他域交集完成 94 项，旧逻辑误将 1,294 与 1,200 比较。修复后通过两个真实账号的 38 项断言（含真正总数不一致时仍拒绝），已离线恢复至 `../artifacts/recovered-10324/`；恢复不启动或关闭游戏，不代表再次实机采集验收。

## 校验审计（2026-11-14）

已检查正式采集路径、配置查询、导出构造、WPF、本地交接服务和网站导入。移除“已领取必须有完成时间”的额外前提：领取标记本身已构成完成证据，缺失时间保留 null。已有配置时双快照只比较四大类成就和对应分类状态，忽略不导出的他域交集变化；刷新前尚无可信配置时仍比较全模型。移除 Build 中重复的未知 ID 校验，统一由 Validate 负责。查询 DLL 仅在需要刷新配置时检查；语言发现不再要求恰好 13 种，仍要求有效语言代码和当前中文资源依赖。

以下校验保留：内存对象类型、读取边界、字典版本和重复 ID；四大类完成数与客户端总数一致；主成就双快照稳定；配置完整性、未知 ID、分类状态、阶段关系及奖励金额一致；资源指纹和绑定的运行时版本；文件写回一致性；网站结构与分类引用；交接服务的来源、Host、key、时效及接收确认。未知 ID 无法可靠判断是否属于主菜单，不能直接丢弃。读取期间字典变化仍应重试，不能与两次完整快照之间非主菜单记录变化混为一谈。

重复出现在不同入口的校验不全部删除：WPF 在读文件前限制大小，服务对传入字节再次限制；服务接受重新发送的 JSON，网站也接受独立导入文件，因此各自验证输入有必要。语言数和数据量的合理上限用于限制异常输入，不作为当前版本精确数量。

验证：45 项导出断言、16 项本地服务检查、7 项网站数据测试通过；包含两个账号的真实快照与缺失完成时间、非主菜单变化等模拟边界。此次未重启游戏或重新实机采集。

## 导出性能诊断

同步日志出现后立即采集，移除原来固定的 3 秒等待。保留双快照之间 1.5 秒间隔；读取结构尚未稳定时也进入有上限的重试。类型名称按单个 MonoReader 缓存，每份快照重新创建读取器，不缓存账号进度或跨进程地址。

会话目录新增 `timings.json`，分别记录堆采集、堆解析定位、每次进度读取校验、配置刷新和文件生成耗时；桌面进度同步显示阶段和结束耗时。异常退出阶段也记录已花费时间，因此有耗时记录不等于该阶段成功。计时采用单调时钟。

静态入口评估：反编译证据 `artifacts/session-24624/AchievementModel.cs` 存在 `_Instance` 及其只读属性，但尚无经实机验证的“运行时模块 → 类型 → 静态存储 → 实例”只读定位链。当前不启用猜测地址或跨进程地址缓存，堆采集仍是正式定位路径。48 项回归包含缓存读取次数、读取器隔离和异常阶段计时；实机耗时以独立 `artifacts/performance-live/` 会话为准。

实机验证 `performance-live/csharp-session-32784-20261114-072745`：堆采集 21,488 ms、堆解析定位 165 ms、首轮双快照 1,626 ms、配置校验及文件生成 326 ms；计时阶段合计 23.605 秒，不含登录等待和关闭游戏。成功导出 1,306 条并关闭游戏，无需打开成就页。此数据不能作为与旧版本等条件对照的加速比例。

检查本机 dotnet-gcdump 的 EventPipeDotNetHeapDumper 实现后确认 `-t 20` 是超时上限，并非必须等待 20 秒；正常会在 GC 完成事件到达后停止。不直接缩短此参数，以免截断数据。后续采集开启 `--verbose`，在 gcdump.log 区分类型表刷新、GC 完成事件、超时和会话关闭耗时；本次实机运行尚未包含该详细日志。


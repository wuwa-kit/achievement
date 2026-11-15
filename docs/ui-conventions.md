# UI 组件与命名规范

## 基本规则

- 基础组件使用 `WAbcXyz` 命名，例如 WButton、WInput、WSelect、WTooltip、WSvg。业务组件按职责命名，不加 W。
- 页面布局及文本默认使用 div/span。禁止为表达结构引入 main、header、footer、nav、section、article、aside、h1–h6、p、label 等语义化标签或包装组件。
- 仅在确有功能需要时保留原生元素，例如基础组件内的 button/input/svg、原生弹层所需的 dialog、实际链接所需的 a。不要用 div 模拟这些原生行为。
- 禁止原生 title 属性；操作说明和补充信息统一使用 WTooltip。文档标题 document.title 和业务数据的 title 字段不属于此限制。
- 禁止无障碍及相关属性或辅助结构：aria-*、role、tabIndex、htmlFor、SVG focusable、仅供读屏的 sr-only 文案。不得通过属性展开或 SVG 资源重新引入。
- 状态样式使用 data-expanded、data-selected、data-disabled、data-invalid 等业务状态属性；测试使用组件类、data-testid、内容或值，不依赖无障碍属性。
- 保留原生控件行为、现有键盘操作和可见 Focus 样式，移除属性不等于禁用键盘。

## 组件与代码组织

基础组件放在 src/components/ui/WAbcXyz.tsx，具名导出，属性类型为 WAbcXyzProps。组件不读取成就数据、不发起导出、不持久化业务设置。业务页面组合基础组件，纯逻辑放入 lib。只为复用或独立交互责任拆分组件。

组件、类型采用 PascalCase；变量、函数采用 camelCase；事件属性为 onXxx，处理器为 handleXxx。CSS 使用 kebab-case，基础组件类带 w- 前缀。使用 TypeScript，遵循 Prettier 配置。

业务状态统一放在 src/stores 的 Zustand Store：账号数据、筛选和分页、设置、导入接收、导出进度及历史记录不放在 React 组件状态中。异步业务动作、并发保护和操作反馈也由 Store 管理，组件仅调用动作并展示数据。组件局部状态只用于弹层显隐、展开、焦点、动画等临时 UI 行为；详情选择仅保存 ID，不复制业务对象。派生展示数据通过 selector/useMemo 计算，避免保存重复状态。嵌套修改使用 zustand/middleware/immer；ahooks 用于可复用的 UI 事件与生命周期逻辑，不另建一份业务状态。Store 不依赖 UI 组件，消息动作从 stores/message 引用。订阅必须可清理，兼容 StrictMode 和异步晚到响应；账号数据继续使用 IndexedDB，不重复写入 Zustand persist。

桌面 UI 使用 React /desktop，WPF 只负责 WebView2 外壳、窗口生命周期及置顶。业务页面通过类型化桥接调用 C#，基础组件不直接访问桥接。两端共享组件和样式，桌面打包本地界面及字体，网页字体通过 CDN 加载。

页面入口通过 React.lazy + dynamic import 按路径加载，等待模块时显示主题底色，主题和语言控件随正式页面渲染。WLoading 只用于局部业务区域，不以偏好初始化阻塞全屏；公共入口不得静态引用任何页面业务 Store、账号数据或桌面桥接。环境检测只读宿主标记，不安装监听器。共享配置仅在检测到桌面宿主时动态加载桥接；浏览器中的 /desktop 由自身页面模块加载预览桥接。未打开的页面不得发起请求、打开账号数据库或处理其路由参数。

## 交互组件

- WInput 统一输入框及 Focus 外观，embedded 模式由外层容器显示聚焦状态。
- WScrollArea 封装 OverlayScrollbars。主入口使用 page 模式，局部溢出区域使用组件容器；隐藏原生滚动条，保留滚轮、触摸和拖拽。
- WPopover 直接使用原生 popover。仅在入场、显示和退场期间保留 DOM，实际动画完成后卸载；快速重开取消旧的卸载流程。支持 placement、offset、matchTriggerWidth。
- WDialog 使用原生 dialog 的 showModal()，与 WPopover 共用 DOM 保留和卸载逻辑。居中面板使用缩放和淡入淡出，遮罩独立过渡。支持 Escape 关闭，可通过 closeOnBackdrop 启用点击遮罩关闭。
- WSelect 使用 WButton、WPopover、WScrollArea 和 WOption，共享上下文处理选中和激活状态。通过 value/onValueChange 控制；保留方向键、Home/End、确认、取消和文本查找。
- WTooltip 直接绑定子元素，避免增加影响布局的 wrapper。支持悬停、聚焦和 Escape 关闭，复用 WPopover 动画及卸载逻辑。
- WEllipsis 统一单行省略文本，仅在实际溢出时通过 WTooltip 显示完整内容；文字、容器尺寸或字体加载变化后重新测量，不使用原生 title。
- WButton loading 状态禁止重复点击。
- 动作成功、失败、取消等瞬时反馈统一调用 wMessage.success/error/info，由根节点 WMessage 显示；禁止另建常驻错误横幅或调用原生 alert。消息支持自动消失、关闭及显隐动画，结束后移除 DOM。等待登录、读取进度等持续状态保留在业务界面。

## 图标

游戏原始位图图标直接以本地图片加载，保留原图色彩和透明度。SVG 图标统一使用 WSvg，禁止直接引用图标库、内联 svg 或用字符充当图标。参考 [MSvg 等组件逻辑](https://github.com/lisonge/android-api-diff/tree/main/android-api-diff-web/src/components)，不采用参考项目的视觉样式。

本地 SVG 资源在 src/assets/svg，名称使用 kebab-case，类型在 src/lib/svg-names.ts。注册表首次使用时懒加载，每个 SVG 仅解析一次；组件先克隆新节点，再一次性 replaceChildren，禁止先清空再替换。资源未加载或缺失时 viewBox 为 0 0 1 1，并保留尺寸占位。SVG 文件不得携带上述禁止属性。

图标说明放在 WTooltip。正文分隔符、缺失值占位和键盘快捷键可保留文字。Lucide 图形许可证保存在 assets/svg/LICENSE。

## 样式、文案与验证

- 页面和组件优先在 JSX 中使用 Tailwind CSS 原子类，状态和响应式样式使用变体。样式表保留字体与主题变量、全局规则、第三方组件配置及原子类难以表达的动画和选择器。
- 项目自定义界面文案（含提示、状态消息和原生弹窗）末尾省略句号（如 `。`、`.`），保留句中标点、句末问号、感叹号和省略号。从游戏导出的成就标题、描述和分类等原始文本按原样显示，保留全部标点。

界面国际化统一使用 i18next/react-i18next；界面支持简体中文、繁体中文、英文、日文、韩文、德文、西班牙文、法文、葡萄牙文和泰文，资源位于 src/i18n/*.json，十份资源必须包含相同的稳定键和插值参数。src/i18n/resources.ts 统一注册语言，类型、校验与语言选项从注册表派生；选项使用语言自称。WPF 自动嵌入并枚举同一目录的资源，不维护独立语言白名单。组件使用 useTranslation，Store/数据校验使用 i18n 的 tr。禁止硬编码用户可见文案、按语言分支拼接句子或在模块初始化时缓存翻译；业务状态保存键及参数，文件名等用户内容保留原文。开发诊断、测试标识和成就数据不作为界面翻译。日期使用统一格式化函数。数字直接使用 toString()，不添加千位分隔符。

语言和主题的唯一状态来源为 usePreferencesStore（useLanguageStore/useThemeStore 只是同一 Store 的兼容入口），切换组件两端复用。浏览器使用 localStorage 并跨标签页同步；WebView2 由 WPF 在文档脚本执行前注入初始设置，原生 language/theme 始终优先，不读取或覆盖浏览器缓存。保存设置时同步更新注入脚本，刷新页面读取最新值；旧宿主未注入时异步回退 settings.get，但不得阻塞全页渲染。偏好通过 preferences.save 独立串行保存，失败恢复上次成功值；该命令不得覆盖游戏路径。settings.save 只更新游戏路径并保留原生偏好。桌面发送目标由构建配置决定。浏览器中的 /desktop 预览继续使用浏览器偏好。切换语言不重置筛选、账号或导出进度。成就内容语言从统一偏好语言派生，zh-CN 映射 zh-Hans、zh-TW 映射 zh-Hant，其余代码直接对应；不得另存语言状态。切换语言同步更新成就标题、描述和分类，缺失翻译显示当前语言的缺失提示。WPF 原生标题、文件弹窗和常见错误直接复用同一份 JSON 资源，不再维护独立字典。

主题统一通过 WThemeSwitch 和 useThemeStore 管理 auto/light/dark；自动模式实时跟随系统，偏好使用上述统一配置来源保存。index.html 的内联同步脚本在首屏样式之前应用初始主题，运行时状态、系统监听和持久化由统一 Preferences Store 管理。桌面打包用脚本内容的哈希授权该内联脚本。根节点 data-theme 表示实际主题，data-theme-mode 表示用户选择；组件不得自行推断主题。共享颜色定义在 src/theme.css，新样式优先使用语义颜色变量，现有浅色配色通过 light-dark 映射到共享深色变量。弹层使用根节点变量，不依赖页面容器。桌面通过 theme.set 同步原生窗口背景及标题栏。

复用颜色、间距、圆角等 CSS 变量；覆盖适用的悬停、聚焦、禁用和选中状态，尊重减少动画偏好。翻译使用稳定键，与逻辑分离；切换语言不重置业务进度。

修改后构建受影响端；交互变更回归主要行为。纯样式改动不编写重复实现的测试。迁移不得通过删除测试掩盖功能回归。

国际化资源分组：common 为两页及基础组件共用文案，ui 为成就档案业务文案，desktop 为导出业务文案，native 为系统弹窗及宿主错误，contentLanguages 为成就内容语言自称。共用文案只维护一个键，基础组件不得依赖页面业务分组；WPF 标题引用 common.desktopTitle。所有分组共用同一 i18next 实例及语言状态，不按页面另建资源副本。

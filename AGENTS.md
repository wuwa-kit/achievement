# 项目约定

修改网页或桌面 UI 前阅读 `docs/ui-conventions.md`，遵循其中的组件边界、命名、视觉与文案规范。基础组件统一采用 `WAbcXyz` 命名。桌面业务 UI 使用 React `/desktop`，WPF 仅作 WebView2 外壳。

使用 `mise exec --` 调用仓库固定版本的工具。改动后验证受影响端的构建；不要为纯样式调整添加重复实现的测试。

本地打包桌面 EXE 时，除非明确要求其他版本，默认只构建 Lite 版，以缩短测试等待时间。

业务状态和异步业务动作统一由 src/stores 下的 Zustand Store 管理。React 组件只保留临时 UI 状态；嵌套更新使用 Immer，通用 UI Hook 优先复用 ahooks。

界面文案使用 i18next/react-i18next 和 src/i18n 中的中英文资源；语言状态由 useLanguageStore 统一管理和持久化，禁止新增硬编码用户文案及独立语言状态。

UI 强制规则：禁止原生 title 属性，提示统一使用 WTooltip；禁止 aria-*、role、tabIndex、htmlFor、SVG focusable 和读屏辅助标记。布局使用 div/span，不使用语义化布局组件；仅保留功能必要的原生元素。状态样式与测试定位使用 data-* 或组件类。

JavaScript 依赖统一声明在根 package.json 的 dependencies 中；子项目不声明依赖，不使用 devDependencies。

# 工作区维护

## 目录职责

| 目录 | 用途 |
| --- | --- |
| achievement-website/ | React 网页 |
| achievement-export/ | C# 桌面、CLI 与构建脚本 |
| data/ | 静态成就目录和排除规则 |
| docs/ | 使用、开发与研究文档 |
| research/ | 离线静态字符串核验 |
| fixtures/local/ | 本机固定测试样本，不提交 |
| artifacts/ | 导出与采集产物，不提交 |
| .tools/ | 本机工具、缓存和研究材料，不提交 |

根目录的 `artifacts/` 可能包含账号导出和原始采集记录，清理时应按用途区分这些文件与可重建的测试输出。桌面发布程序位于 `achievement-export/artifacts/`，正式测试的固定输入位于 [fixtures/local](../fixtures/README.md)。


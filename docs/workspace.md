# 工作区维护

## 目录职责

| 目录 | 用途 |
| --- | --- |
| achievement-website/ | React 网页 |
| achievement-export/ | C# 桌面、CLI 与构建脚本 |
| data/ | 静态成就目录和排除规则 |
| docs/ | 使用、开发与研究文档 |
| research/ | 历史工具及测试 |
| fixtures/local/ | 本机固定测试样本，不提交 |
| artifacts/ | 导出与采集产物，不提交 |
| .tools/ | 本机第三方研究工具，不提交 |

历史 reports/ 已迁移至 artifacts/。清理生成文件时保留账号导出和研究证据；样本恢复见 [fixtures 说明](../fixtures/README.md)，清理记录见 [产物维护](artifacts.md)。

## 目录联接与未来改名

本机 `C:\Users\lisonge\Documents\Project\wuwa-achievement` 是 junction，指向保留的实体目录 `C:\Users\lisonge\Documents\Project\wuwa-achievement-export`。两条路径访问同一份文件，不是两份项目；不要删除原实体目录来“清理旧名称”。

未来彻底改名时，先备份并关闭本工作区、开发服务器和终端，在父目录核对 `wuwa-achievement` 的 LinkType 为 Junction、Target 为原实体目录。然后仅移除联接本身（不能递归删除联接内容），把实体目录 `wuwa-achievement-export` 重命名为 `wuwa-achievement`，最后从新路径重新打开工作区。此操作不在当前仍占用旧路径的会话里执行。重命名后重新运行依赖安装和构建即可。


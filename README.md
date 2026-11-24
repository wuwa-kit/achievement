# 鸣潮成就导出工具

简体中文 | [English](README-en.md) | [日本語](README-ja.md) | [한국어](README-ko.md)

使用 Windows 桌面工具从《鸣潮》游戏进程内存中读取账号成就进度，一键导出为 JSON。导出后可在网页中查看、筛选和管理成就档案。

[在线预览](https://wu.songe.li)

从[最新稳定版发布页](https://github.com/wuwa-kit/achievement/releases/latest)下载 Windows x64 标准版（Full）或 Lite 版。标准版内置 .NET，Lite 版需要另行下载并安装 [.NET 10 Desktop Runtime（x64）](https://dotnet.microsoft.com/zh-cn/download/dotnet/thank-you/runtime-desktop-10.0.15-windows-x64-installer)。

## 快速开始

1. 打开桌面导出器，点击运行图标，在工具启动的游戏中登录。
2. 登录后，工具会自动读取成就进度并保存档案。导出成功后，可从历史卡片发送到网页或另存为 JSON。

## 导出原理

导出器使用堆诊断定位成就数据，读取游戏进程内存，并将结果保存为本地 JSON。导出器不向游戏进程写入数据，也不修改游戏内的成就进度。

## 网页功能

- **成就浏览**：分类查看、搜索与筛选，支持多语言文本和隐藏成就。
- **进度统计**：查看完成度、已完成星声奖励和隐藏成就进度。
- **多账号管理**：按 UID 保存档案，同一账号重新导出时更新进度。
- **本地保存**：支持桌面直接交接、JSON 导入与下载，账号档案保存在当前浏览器。

## 文档

- [网页使用说明](achievement-website/README.md)
- [桌面导出器说明](achievement-export/README.md)
- [开发指南](docs/development.md)
- [构建与发布](docs/releasing.md)
- [更新日志](achievement-export/CHANGELOG.md)

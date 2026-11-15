# Wuthering Waves Achievement Exporter

[简体中文](README.md) | English | [日本語](README-ja.md) | [한국어](README-ko.md)

The Windows desktop app reads your Wuthering Waves achievement progress directly from game memory and exports it as JSON with one click. Use the web app to browse, filter, and manage your achievement profiles.

[Online preview](https://wu.songe.li)

Download the [Standard edition](https://github.com/wuwa-kit/achievement/releases/download/v0.1.3/WuwaAchievementExport-v0.1.3.exe) or the [Lite edition](https://github.com/wuwa-kit/achievement/releases/download/v0.1.3/WuwaAchievementExport-Lite-v0.1.3.exe) for Windows x64. The Standard edition includes .NET. For the Lite edition, download and install the [.NET 10 Desktop Runtime (x64)](https://aka.ms/dotnet/10.0/windowsdesktop-runtime-win-x64.exe) separately.

## Quick start

1. Open the desktop exporter, click the run icon, and sign in when the game launches.
2. After you sign in, the exporter automatically reads and saves your achievement progress. You can then send the saved export to the web app or save a copy as JSON from the history card.

## How exporting works

The exporter uses heap diagnostics to locate achievement data, reads it from the game process, and saves it to a local JSON file. It does not write data to the game process or change your in-game achievement progress.

## Web app features

- **Browse achievements**: Browse by category, search and filter, and view multilingual text and hidden achievements.
- **Track progress**: See achievement completion, Astrite rewards from completed achievements, and hidden achievement progress.
- **Manage multiple accounts**: Save profiles by UID. Exporting the same account again updates its progress.
- **Save locally**: Transfer directly from the desktop exporter, import JSON files, or download snapshots. Account profiles are stored in your browser.

## Documentation

The guides below are in Chinese. The changelog is in English.

- [Web app guide](achievement-website/README.md)
- [Desktop exporter guide](achievement-export/README.md)
- [Development guide](docs/development.md)
- [Build and release](docs/releasing.md)
- [Changelog](achievement-export/CHANGELOG.md)

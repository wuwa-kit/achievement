# Changelog

<!--
Release notes rules
- Write all changelog entries in English.
- Include only the matching version's changelog entry in each release.
- Keep the Lite edition requirements section at the bottom of this file. The release script appends it to every release. Use Microsoft's link to the latest .NET 10 Desktop Runtime (x64) installer so the footer always points to the current patch.
-->

## [0.1.3] - 2026-11-15

### Added

- The desktop app checks for updates silently at startup and shows a dialog when a newer stable version is available. You can also select Check for updates in the upper-right corner to check manually.
- The update dialog lets you download either the Standard or Lite edition, shows download progress, and verifies the file before offering to restart. The previous executable stays in the same folder for manual rollback.
- Manual checks report missing release metadata, connection failures, timeouts, invalid manifests, and other HTTP errors separately.

If you are using an older version, download this release manually to enable in-app updates.

## [0.1.2] - 2026-11-15

### Added

- History cards now show Astrite rewards from completed achievements alongside the total available from achievements.
- Added diagnostic ZIP export to the desktop app for troubleshooting collection failures.
- Added Japanese and Korean README translations.

### Changed

- Replaced the history card's trophy icon with the achievement logo in solid black. The achievement and Astrite counts now appear in two aligned rows with more space beside the account details.
- The achievement list now scrolls at its actual height, with titles and descriptions that wrap and aligned Astrite rewards.
- The web app and desktop exporter now use the browser or system language on first launch and fall back to English for unsupported languages.

### Fixed

- Fixed the achievement total on history cards to use the same catalog and exclusion rules as the web app.

## [0.1.1] - 2026-11-15

### Fixed

- Fixed an issue where the desktop exporter's main window could stay behind other windows after launching the app and approving the UAC prompt.

## Lite edition requirements

Before running the Lite edition, download and install the [.NET 10 Desktop Runtime (x64)](https://aka.ms/dotnet/10.0/windowsdesktop-runtime-win-x64.exe) separately.

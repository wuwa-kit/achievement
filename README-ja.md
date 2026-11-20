# 『鳴潮』実績エクスポートツール

[简体中文](README.md) | [English](README-en.md) | 日本語 | [한국어](README-ko.md)

Windows 用のデスクトップツールで、『鳴潮』のゲームプロセスのメモリからアカウントの実績進捗を読み取り、ワンクリックで JSON に出力できます。出力した実績アーカイブは、Web アプリで閲覧、絞り込み、管理ができます。

[オンラインプレビュー](https://wu.songe.li)

Windows x64 向けの[標準版](https://github.com/wuwa-kit/achievement/releases/download/v0.1.4/WuwaAchievementExport-Full-v0.1.4.exe)または [Lite 版](https://github.com/wuwa-kit/achievement/releases/download/v0.1.4/WuwaAchievementExport-Lite-v0.1.4.exe)をダウンロードできます。標準版には .NET が含まれています。Lite 版を使うには、[.NET 10 Desktop Runtime（x64）](https://aka.ms/dotnet/10.0/windowsdesktop-runtime-win-x64.exe)を別途ダウンロードしてインストールしてください。

## 使い方

1. デスクトップツールを開き、実行アイコンをクリックします。ゲームが起動したらログインします。
2. ログイン後、ツールが自動で実績進捗を読み取って保存します。履歴カードから Web アプリに送信したり、JSON ファイルとして保存したりできます。

## エクスポートの仕組み

ヒープ診断で実績データの位置を特定し、ゲームプロセスのメモリから読み取った結果をローカルの JSON ファイルに保存します。ゲームプロセスへの書き込みや、ゲーム内の実績進捗の変更は行いません。

## Web アプリの機能

- **実績の閲覧**：カテゴリ別の表示、検索、絞り込みに対応しています。多言語のテキストや隠し実績も表示できます。
- **進捗の確認**：実績の達成状況、達成済み実績の星声報酬、隠し実績の進捗を確認できます。
- **複数アカウントの管理**：UID ごとにアーカイブを保存します。同じアカウントを再度エクスポートすると、進捗が更新されます。
- **ローカル保存**：デスクトップツールからの直接転送、JSON のインポートとダウンロードに対応しています。アーカイブは使用中のブラウザーに保存されます。

## ドキュメント

ガイドは中国語、変更履歴は英語です。

- [Web アプリの使い方](achievement-website/README.md)
- [デスクトップツールの使い方](achievement-export/README.md)
- [開発ガイド](docs/development.md)
- [ビルドとリリース](docs/releasing.md)
- [変更履歴](achievement-export/CHANGELOG.md)

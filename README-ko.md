# 명조: 워더링 웨이브 업적 내보내기 도구

[简体中文](README.md) | [English](README-en.md) | [日本語](README-ja.md) | 한국어

Windows 데스크톱 도구로 《명조: 워더링 웨이브》 게임 프로세스의 메모리에서 계정의 업적 진행도를 읽어 한 번의 클릭으로 JSON 파일로 내보낼 수 있습니다. 내보낸 업적 기록은 웹 앱에서 조회하고, 필터링하고, 관리할 수 있습니다.

[온라인 미리 보기](https://wu.songe.li)

Windows x64용 [표준 버전](https://github.com/wuwa-kit/achievement/releases/download/v0.1.3/WuwaAchievementExport-Full-v0.1.3.exe) 또는 [Lite 버전](https://github.com/wuwa-kit/achievement/releases/download/v0.1.3/WuwaAchievementExport-Lite-v0.1.3.exe)을 다운로드하세요. 표준 버전에는 .NET이 포함되어 있습니다. Lite 버전을 사용하려면 [.NET 10 Desktop Runtime(x64)](https://aka.ms/dotnet/10.0/windowsdesktop-runtime-win-x64.exe)을 별도로 다운로드하여 설치하세요.

## 빠른 시작

1. 데스크톱 도구를 열고 실행 아이콘을 클릭한 뒤, 게임이 시작되면 로그인합니다.
2. 로그인하면 도구가 업적 진행도를 자동으로 읽어 저장합니다. 기록 카드에서 저장된 기록을 웹 앱으로 보내거나 JSON 파일로 저장할 수 있습니다.

## 내보내기 방식

힙 진단으로 업적 데이터의 위치를 찾은 뒤, 게임 프로세스의 메모리에서 데이터를 읽어 로컬 JSON 파일로 저장합니다. 게임 프로세스에 데이터를 쓰거나 게임 내 업적 진행도를 변경하지 않습니다.

## 웹 앱 기능

- **업적 탐색** — 분류별로 업적을 살펴보고 검색하거나 필터를 적용할 수 있습니다. 다국어 텍스트와 숨겨진 업적도 볼 수 있습니다.
- **진행도 확인** — 업적 달성 현황, 달성한 업적의 별의 소리 보상, 숨겨진 업적의 진행도를 확인할 수 있습니다.
- **여러 계정 관리** — UID별로 기록을 저장합니다. 같은 계정을 다시 내보내면 진행도가 갱신됩니다.
- **로컬 저장** — 데스크톱 도구에서 바로 전송하거나 JSON 파일을 가져오고 다운로드할 수 있습니다. 계정 기록은 사용 중인 브라우저에 저장됩니다.

## 문서

가이드는 중국어로, 변경 이력은 영어로 제공됩니다.

- [웹 앱 사용 가이드](achievement-website/README.md)
- [데스크톱 도구 사용 가이드](achievement-export/README.md)
- [개발 가이드](docs/development.md)
- [빌드 및 릴리스](docs/releasing.md)
- [변경 이력](achievement-export/CHANGELOG.md)

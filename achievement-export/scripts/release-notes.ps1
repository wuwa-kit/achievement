param(
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$OutputPath,
    [string]$UpdateNotesPath
)
$ErrorActionPreference = 'Stop'
if ($Tag -cnotmatch '^v?[0-9]{1,9}\.[0-9]{1,9}\.[0-9]{1,9}(?:-[0-9A-Za-z.-]+)?$') {
    throw '版本标签应为 v0.1.0 或 v0.1.0-beta.1 形式。'
}
$version = $Tag -replace '^v', ''
$changelog = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../CHANGELOG.md') -Raw -Encoding utf8
$pattern = '(?ms)^## \[' + [regex]::Escape($version) + '\][^\r\n]*\r?\n(?<notes>.*?)(?=^## |\z)'
$match = [regex]::Match($changelog, $pattern)
if (!$match.Success -or [string]::IsNullOrWhiteSpace($match.Groups['notes'].Value)) {
    throw "CHANGELOG.md 缺少版本 [$version] 的发布说明。"
}
$footer = [regex]::Match($changelog, '(?ms)^## Lite edition requirements[ \t]*\r?\n(?<body>.*?)(?=^## |\z)')
if (!$footer.Success -or [string]::IsNullOrWhiteSpace($footer.Groups['body'].Value)) {
    throw 'CHANGELOG.md 缺少 Lite edition requirements 安装说明。'
}
$notes = ($match.Groups['notes'].Value.Trim(), $footer.Value.Trim()) -join "`n`n"
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
Set-Content -LiteralPath $OutputPath -Value $notes -Encoding utf8
if ($UpdateNotesPath) {
    Set-Content -LiteralPath $UpdateNotesPath -Value $match.Groups['notes'].Value.Trim() -Encoding utf8
}

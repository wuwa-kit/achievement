param(
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if ($Tag -notmatch '^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
    throw '版本标签应为 v0.1.0 或 v0.1.0-beta.1 形式。'
}
$version = $Tag -replace '^v', ''
$changelog = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../CHANGELOG.md') -Raw
$pattern = '(?ms)^## \[' + [regex]::Escape($version) + '\][^\r\n]*\r?\n(?<notes>.*?)(?=^## |\z)'
$match = [regex]::Match($changelog, $pattern)
if (!$match.Success -or [string]::IsNullOrWhiteSpace($match.Groups['notes'].Value)) {
    throw "CHANGELOG.md 缺少版本 [$version] 的发布说明。"
}
$parent = Split-Path -Parent $OutputPath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
Set-Content -LiteralPath $OutputPath -Value $match.Groups['notes'].Value.Trim() -Encoding utf8

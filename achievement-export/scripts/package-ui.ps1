$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot '../Wuwa.Desktop'
$dist = Join-Path $PSScriptRoot '../../achievement-website/dist'
# Desktop gets its own index route and font; the website output stays unmodified.
$stage = Join-Path $project 'obj/desktop-ui'
if (Test-Path $stage) {
    $resolved = (Resolve-Path $stage).Path
    $expected = [IO.Path]::GetFullPath((Join-Path $project 'obj/desktop-ui'))
    if ($resolved -ne $expected) { throw 'Unexpected staging directory' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
New-Item -ItemType Directory -Force "$stage/desktop", "$stage/fonts" | Out-Null
Copy-Item "$dist/assets" "$stage/assets" -Recurse
$html = [IO.File]::ReadAllText((Join-Path $dist 'index.html'))
$theme = [regex]::Match($html, '<script id="initial-theme">([\s\S]*?)</script>')
if (-not $theme.Success) { throw 'Missing initial theme script' }
$themeBytes = [Text.Encoding]::UTF8.GetBytes(($theme.Groups[1].Value -replace '\r\n?', "`n"))
$sha256 = [Security.Cryptography.SHA256]::Create()
try { $themeHash = [Convert]::ToBase64String($sha256.ComputeHash($themeBytes)) }
finally { $sha256.Dispose() }
$csp = '<meta http-equiv="Content-Security-Policy" content="default-src ''self''; script-src ''self''; style-src ''self'' ''unsafe-inline''; font-src ''self''; img-src ''self'' data:; connect-src ''self''; object-src ''none''; frame-src ''none''; base-uri ''none''">'
$csp = $csp.Replace("script-src 'self';", "script-src 'self' 'sha256-$themeHash';")
[IO.File]::WriteAllText((Join-Path $stage 'desktop/index.html'), $html.Replace('<head>', '<head>' + $csp))
Copy-Item "$project/Assets/Fonts/H7GBK-Heavy.ttf" "$stage/fonts/H7GBK-Heavy.ttf"
# Rewrite only the embedded desktop copy: even initial render uses the bundled font.
Get-ChildItem "$stage/assets" -Filter '*.css' | ForEach-Object {
    $css = [IO.File]::ReadAllText($_.FullName).Replace('https://media-cdn-mingchao.kurogame.com/font/H7GBK-Heavy.ttf', '/fonts/H7GBK-Heavy.ttf')
    [IO.File]::WriteAllText($_.FullName, $css)
}


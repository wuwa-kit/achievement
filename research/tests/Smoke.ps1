$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Add-Type -Path (Join-Path $root 'research\tools\BinaryInspector.cs')
$temp = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString() + '.bin')
try {
    [IO.File]::WriteAllBytes($temp, [Text.Encoding]::ASCII.GetBytes('AchievementAtEnd'))
    $hits = @([BinaryInspector]::Evidence($temp))
    if ($hits.Count -ne 1 -or $hits[0] -notmatch '0x0 \[ASCII\] AchievementAtEnd') { throw 'ASCII EOF scan failed' }
    [IO.File]::WriteAllBytes($temp, [byte[]](@(0xFF) + [Text.Encoding]::Unicode.GetBytes('PuertsAtEnd')))
    $hits = @([BinaryInspector]::Evidence($temp))
    if ($hits.Count -ne 1 -or $hits[0] -notmatch '0x1 \[UTF16\] PuertsAtEnd') { throw 'Unaligned UTF16 EOF scan failed' }
    [IO.File]::WriteAllBytes($temp, [Text.Encoding]::ASCII.GetBytes('unrelated string'))
    if (@([BinaryInspector]::Evidence($temp)).Count -ne 0) { throw 'Filter failed' }
    Write-Host 'Binary evidence smoke tests passed.'
} finally { Remove-Item -LiteralPath $temp -ErrorAction SilentlyContinue }

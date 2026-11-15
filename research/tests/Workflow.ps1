$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $root 'research\tools\Launcher.ps1')
Add-Type -Path (Join-Path $root 'research\tools\LogEvidence.cs')
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('wuwa-test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $temporary 'Game'),(Join-Path $temporary 'kr_game_cache') -Force | Out-Null
try {
    $game=Join-Path $temporary 'Game\Wuthering Waves.exe'
    $state='{"activeGameScope":{"gameIdentity":"Aki","bundleName":"UHD"}}'
    $bytes=[Text.Encoding]::UTF8.GetBytes($state)
    for($i=0;$i -lt $bytes.Length;$i++){$bytes[$i]=$bytes[$i] -bxor 0x63}
    [IO.File]::WriteAllText((Join-Path $temporary 'kr_game_cache\platform_ui_state.bin'),[Convert]::ToBase64String($bytes))
    if((Get-WuwaQuality $game) -ne 'uhd'){throw 'Quality auto-detection failed'}
    if((Get-WuwaQuality $game 'sd') -ne 'sd'){throw 'Explicit quality precedence failed'}
    [IO.File]::WriteAllText((Join-Path $temporary 'kr_game_cache\platform_ui_state.bin'),'bad')
    [IO.File]::WriteAllText((Join-Path $temporary 'Game\launcherDownloadConfig.json'),'{"bundles":{"HD":{}}}')
    if((Get-WuwaQuality $game) -ne 'hd'){throw 'Manifest fallback failed'}
    [IO.File]::WriteAllText((Join-Path $temporary 'Game\launcherDownloadConfig.json'),'{"bundles":{"HD":{},"UHD":{}}}')
    $failed=$false;try{Get-WuwaQuality $game | Out-Null}catch{$failed=$true}
    if(-not $failed){throw 'Ambiguous quality was guessed'}
    $line='[2026.11.14-03.36.09:438][ 72][GameThread]Sharphereal: Display: [C#][61308][Info][Achievement][YZY][94300] OnAchievementGroupProgressNotify [id: 400111][currentState: CanGetReward]'
    $path=Join-Path $temporary 'Client.log'
    [IO.File]::WriteAllText($path,$line,[Text.UTF8Encoding]::new($false))
    $plain=@([LogEvidence]::Find($path))
    $bytes=[Text.Encoding]::UTF8.GetBytes($line)
    for($i=0;$i -lt $bytes.Length;$i++){if(($bytes[$i] -band 1) -eq 0){$bytes[$i]=$bytes[$i] -bxor 0xA5}else{$bytes[$i]=$bytes[$i] -bxor 0xEF}}
    [IO.File]::WriteAllBytes($path,$bytes)
    $encoded=@([LogEvidence]::Find($path))
    if($plain.Count -ne 1 -or $encoded.Count -ne 1 -or $plain[0] -ne $encoded[0]){throw 'Log decoding failed'}
    & (Join-Path $root 'research\tools\Export-LogEvents.ps1') -LogPath $path -OutputDirectory $temporary
    $report=Get-Content (Join-Path $temporary 'achievement-events.json') -Raw | ConvertFrom-Json
    if($report.complete -or $report.eventCount -ne 1 -or $report.events[0].id -ne 400111 -or $report.events[0].rawState -ne 'CanGetReward'){throw 'Event export contract failed'}
    [IO.File]::WriteAllText($path,'[2026.11.14-03.36.09:438] unrelated')
    & (Join-Path $root 'research\tools\Export-LogEvents.ps1') -LogPath $path -OutputDirectory $temporary
    $report=Get-Content (Join-Path $temporary 'achievement-events.json') -Raw | ConvertFrom-Json
    if($report.complete -or $report.eventCount -ne 0 -or $report.events.Count -ne 0){throw 'Empty export must remain incomplete'}
    Write-Host 'Workflow tests passed.'
} finally {
    $resolved=[IO.Path]::GetFullPath($temporary)
    if($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -and ([IO.Path]::GetFileName($resolved) -like 'wuwa-test-*')) {Remove-Item -LiteralPath $resolved -Recurse -Force}
}

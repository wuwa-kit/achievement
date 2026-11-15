param([ValidateRange(10,900)][int]$ObserveSeconds=300)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot 'Launcher.ps1')
$gamePath='C:\Program Files\Wuthering Waves\Wuthering Waves Game\Wuthering Waves.exe'
$main=Join-Path (Split-Path $gamePath) 'Client\Binaries\Win64\Client-Win64-Shipping.exe'
$report=Join-Path $root 'artifacts\early-access.jsonl'
$session=Join-Path $root 'artifacts\early-session.json'
$child=$null
try {
    if(-not (Test-WuwaAdministrator)){throw 'Administrator privileges required'}
    if(@(Get-Process -Name Client-Win64-Shipping -ErrorAction SilentlyContinue).Count){throw 'Game already running; no process was stopped'}
    if(Test-Path $report){throw 'Preserve previous early-access.jsonl before another experiment'}
    Add-Type -Path (Join-Path $PSScriptRoot 'StartupProcess.cs')
    $quality=Get-WuwaQuality $gamePath
    $child=[StartupProcess]::new($main,$quality)
    try {$child.Probe()|ConvertTo-Json -Compress|Add-Content $report -Encoding UTF8}finally{$child.Resume()}
    [ordered]@{pid=$child.Id;helperPid=$PID;path=$main;quality=$quality;startedAt=[DateTimeOffset]::Now.ToString('o');mode='retained-creation-handle';observationSeconds=$ObserveSeconds} | ConvertTo-Json | Set-Content $session -Encoding UTF8
    $timer=[Diagnostics.Stopwatch]::StartNew()
    while($timer.Elapsed.TotalSeconds -lt $ObserveSeconds -and -not $child.HasExited){
        $child.Probe()|ConvertTo-Json -Compress|Add-Content $report -Encoding UTF8
        Start-Sleep -Seconds 5
    }
    [ordered]@{event='observation-ended';exited=$child.HasExited;at=[DateTimeOffset]::Now.ToString('o')}|ConvertTo-Json -Compress|Add-Content $report -Encoding UTF8
}catch{$_.Exception.GetBaseException().Message | Set-Content (Join-Path $root 'artifacts\early-error.txt')}
finally{if($child){$child.Dispose()}}

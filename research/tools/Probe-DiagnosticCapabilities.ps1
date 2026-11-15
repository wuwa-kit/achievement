param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$r=[ordered]@{pid=$GameProcessId;time=[DateTimeOffset]::Now.ToString('o');profilerLoaded=$false}
try {
    $p=Get-Process -Id $GameProcessId
    $previous=Get-Content (Join-Path $root 'artifacts\runtime-probe.json') -Raw | ConvertFrom-Json
    if($p.ProcessName -ne 'Client-Win64-Shipping' -or $previous.pid -ne $GameProcessId -or ([datetime]$previous.startedAt) -ne $p.StartTime){throw 'Target session mismatch'}
    Add-Type -Path (Join-Path $PSScriptRoot 'DiagnosticsIpc.cs')
    $r.runtime=[DiagnosticsIpc]::Info($GameProcessId)
    $missing=Join-Path $root ('artifacts\nonexistent-profiler-'+[Guid]::NewGuid().ToString('N')+'.dll')
    try { $r.profilerResult=('0x{0:X8}' -f [DiagnosticsIpc]::ProbeMissingProfiler($GameProcessId,$missing)) }
    catch { $r.profilerResult=$_.Exception.GetBaseException().Message }
}catch{$r.error=$_.Exception.GetBaseException().Message}
$r | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'artifacts\diagnostic-capabilities.json')

param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$r=[ordered]@{pid=$GameProcessId;time=[DateTimeOffset]::Now.ToString('o');traceSuccess=$false}
try {
    if((Get-Process -Id $GameProcessId).ProcessName -ne 'Client-Win64-Shipping'){throw 'Unexpected target'}
    Add-Type -Path (Join-Path $PSScriptRoot 'DiagnosticsIpc.cs')
    $info=[DiagnosticsIpc]::Info($GameProcessId)
    if($info.pid -ne $GameProcessId){throw 'IPC PID mismatch'}
    $r.bytes=[DiagnosticsIpc]::TraceHookFailure($GameProcessId,(Join-Path $root 'artifacts\hook-failure.nettrace'),(Join-Path $root 'artifacts\InspectHook.dll'))
    $r.actionResult=[DiagnosticsIpc]::LastActionError
    $r.traceSuccess=$true
}catch{$r.error=$_.Exception.GetBaseException().Message}
$r | ConvertTo-Json | Set-Content (Join-Path $root 'artifacts\hook-failure-result.json')

param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$result=[ordered]@{pid=$GameProcessId;time=[DateTimeOffset]::Now.ToString('o');success=$false}
try {
    $p=Get-Process -Id $GameProcessId
    if($p.ProcessName -ne 'Client-Win64-Shipping'){throw 'Unexpected process'}
    Add-Type -Path (Join-Path $PSScriptRoot 'DiagnosticsIpc.cs')
    $info=[DiagnosticsIpc]::Info($GameProcessId)
    if($info.pid -ne $GameProcessId){throw 'IPC PID mismatch'}
    $result.hresult=[DiagnosticsIpc]::ApplyHook($GameProcessId,(Join-Path $root 'artifacts\InspectHook.dll'))
    $result.success=$result.hresult -eq 0
}catch{$result.error=$_.Exception.GetBaseException().Message}
$result | ConvertTo-Json | Set-Content (Join-Path $root 'artifacts\inspect-hook-result.json')

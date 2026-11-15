param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$r=[ordered]@{pid=$GameProcessId;time=[DateTimeOffset]::Now.ToString('o');success=$false}
try {
    if((Get-Process -Id $GameProcessId).ProcessName -ne 'Client-Win64-Shipping'){throw 'Unexpected target'}
    Add-Type -Path (Join-Path $PSScriptRoot 'DiagnosticsIpc.cs')
    $r.bytes=[DiagnosticsIpc]::TraceMetadata($GameProcessId,(Join-Path $root 'artifacts\runtime-metadata.nettrace'))
    $r.success=$true
}catch{$r.error=$_.Exception.GetBaseException().Message}
$r | ConvertTo-Json | Set-Content (Join-Path $root 'artifacts\trace-result.json')

param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$r=[ordered]@{pid=$GameProcessId;time=[DateTimeOffset]::Now.ToString('o');isAdmin=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);probes=@()}
try {
    $p=Get-Process -Id $GameProcessId
    if($p.ProcessName -ne 'Client-Win64-Shipping'){throw 'Unexpected target'}
    $previous=Get-Content (Join-Path $root 'artifacts\runtime-probe.json') -Raw | ConvertFrom-Json
    if($previous.pid -ne $GameProcessId -or ([datetime]$previous.startedAt) -ne $p.StartTime){throw 'Captured method addresses belong to another process session'}
    Add-Type -Path (Join-Path $PSScriptRoot 'ProcessProbe.cs')
    $methods=Get-Content (Join-Path $root 'artifacts\managed-methods.json') -Raw | ConvertFrom-Json
    $entry=$methods | Where-Object { $_.MethodNamespace -eq 'AchievementModel' -and $_.MethodName -eq 'get_Instance'} | Select-Object -First 1
    if(-not $entry){throw 'AchievementModel entry missing'}
    foreach($address in @([long]$entry.MethodStartAddress,[long]$entry.MethodID)) { $r.probes += [ProcessProbe]::ReadAccess($GameProcessId,$address) }
} catch {$r.error=$_.Exception.GetBaseException().Message}
$r | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $root 'artifacts\managed-access.json')

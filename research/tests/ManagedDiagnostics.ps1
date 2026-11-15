$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Add-Type -Path (Join-Path $root 'research\tools\ProcessProbe.cs')
$pointer=[Runtime.InteropServices.Marshal]::AllocHGlobal(2)
try {
    $result=[ProcessProbe]::ReadAccess($PID,$pointer.ToInt64())
    if(-not $result.vmReadGranted -or -not $result.readSucceeded -or $result.bytesRead -ne 2){throw 'Self-process read/access control failed'}
}finally{[Runtime.InteropServices.Marshal]::FreeHGlobal($pointer)}
if($PSVersionTable.PSVersion.Major -ge 7){
    Add-Type -Path (Join-Path $root 'research\tools\DiagnosticsIpc.cs')
    $info=[DiagnosticsIpc]::Info($PID)
    if($info.pid -ne $PID -or $info.os -ne 'Windows' -or -not $info.runtimeVersion){throw 'Runtime IPC self-query failed'}
    $missing=Join-Path ([IO.Path]::GetTempPath()) ('wuwa-nonexistent-profiler-'+[Guid]::NewGuid().ToString('N')+'.dll')
    $probeError=$null
    try {[void][DiagnosticsIpc]::ProbeMissingProfiler($PID,$missing)}catch{$probeError=$_.Exception.GetBaseException().Message}
    if($probeError -notmatch '0x8007007E'){throw ('Profiler self-control did not reach module-not-found: '+$probeError)}
    $guarded=$false
    try {[void][DiagnosticsIpc]::ProbeMissingProfiler($PID,$PSCommandPath)}catch{$guarded=$true}
    if(-not $guarded){throw 'Profiler probe must reject existing paths'}
}
Write-Host 'Managed diagnostic self-controls passed.'

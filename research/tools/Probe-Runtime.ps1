param([Parameter(Mandatory=$true)][int]$GameProcessId,[string]$OutputDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if(-not $OutputDirectory){$OutputDirectory=Join-Path $root 'artifacts'}
$result=[ordered]@{capturedAt=[DateTimeOffset]::Now.ToString('o');pid=$GameProcessId;isAdmin=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);readSucceeded=$false;error=$null;nativeErrorCode=$null;modules=@();listeners=@()}
try {
    Add-Type -Path (Join-Path $PSScriptRoot 'ProcessProbe.cs')
    Add-Type -Path (Join-Path $PSScriptRoot 'DiagnosticsIpc.cs')
    try { $result.diagnostics=[DiagnosticsIpc]::Info($GameProcessId) } catch { $result.diagnosticError=$_.Exception.GetBaseException().Message }
    $p=Get-Process -Id $GameProcessId
    if($p.ProcessName -ne 'Client-Win64-Shipping'){throw 'Unexpected target process'}
    $result.startedAt=$p.StartTime.ToString('o')
    $address=[long]0x140000000
    $result.addressSource='preferred base from observed crash stack; module lookup pending'
    try {
        $result.modules=@($p.Modules | Where-Object { $null -ne $_ } | ForEach-Object { [ordered]@{name=$_.ModuleName;baseAddress=('0x{0:X}' -f $_.BaseAddress.ToInt64());size=$_.ModuleMemorySize} })
        if($p.MainModule){$address=$p.MainModule.BaseAddress.ToInt64();$result.addressSource='MainModule'}
    } catch { $result.moduleError=$_.Exception.Message }
    $result.address=('0x{0:X}' -f $address)
    $result.header=[ProcessProbe]::ReadHeader($GameProcessId,$address)
    $result.readSucceeded=$result.header -eq '4D-5A'
} catch {
    $e=$_.Exception
    while($e.InnerException){$e=$e.InnerException}
    $result.error=$e.Message
    if($e -is [ComponentModel.Win32Exception]){$result.nativeErrorCode=$e.NativeErrorCode}
} finally {
    $result.listeners=@(Get-NetTCPConnection -OwningProcess $GameProcessId -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort)
    $result | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $OutputDirectory 'runtime-probe.json') -Encoding UTF8
}

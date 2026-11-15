param([Parameter(Mandatory=$true)][int]$GameProcessId)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$result=[ordered]@{pid=$GameProcessId;time=[DateTimeOffset]::Now.ToString('o');success=$false}
try {
    $p=Get-Process -Id $GameProcessId
    $previous=Get-Content (Join-Path $root 'artifacts\runtime-probe.json') -Raw | ConvertFrom-Json
    if($p.ProcessName -ne 'Client-Win64-Shipping' -or $previous.pid -ne $GameProcessId -or ([datetime]$previous.startedAt) -ne $p.StartTime){throw 'Target process session mismatch'}
    & (Join-Path $PSScriptRoot 'Probe-ManagedAccess.ps1') -GameProcessId $GameProcessId
    $exe=Join-Path $root '.tools\gcdump\dotnet-gcdump.exe'
    $signature=Get-AuthenticodeSignature -LiteralPath $exe
    if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation'){throw 'Diagnostic tool signature mismatch'}
    $destination=Join-Path $root 'artifacts\managed-heap.gcdump'
    if(Test-Path -LiteralPath $destination){throw 'Heap diagnostic output already exists; preserve it or choose another run directory'}
    $worker=Start-Process -FilePath $exe -WindowStyle Hidden -ArgumentList @('collect','-p',$GameProcessId,'-o',('"'+$destination+'"'),'-t','20','-v') -RedirectStandardOutput (Join-Path $root 'artifacts\heap-collection.log') -RedirectStandardError (Join-Path $root 'artifacts\heap-collection-error.log') -PassThru -Wait
    $result.exitCode=$worker.ExitCode
    $result.success=($worker.ExitCode -eq 0 -and (Test-Path -LiteralPath $destination))
    if($result.success) { $result.bytes=(Get-Item -LiteralPath $destination).Length }
}catch{$result.error=$_.Exception.GetBaseException().Message}
$result | ConvertTo-Json | Set-Content (Join-Path $root 'artifacts\heap-result.json')

param($Child,[switch]$SkipTrace)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
$run=Join-Path $root ('artifacts/session-'+$Child.Id)
New-Item -ItemType Directory -Path $run -Force|Out-Null
$result=[ordered]@{pid=$Child.Id;at=[DateTimeOffset]::Now.ToString('o');complete=$false;stage='trace'}
try {
 if(-not $SkipTrace){
 if(-not ('DiagnosticsIpc' -as [type])){Add-Type -Path "$PSScriptRoot/DiagnosticsIpc.cs"}
 [void][DiagnosticsIpc]::TraceMetadata([int]$Child.Id,"$run/methods.nettrace")
 & "$PSScriptRoot/Parse-Trace.ps1" -TracePath "$run/methods.nettrace" -OutputPath "$run/methods.json"
 $methods=Get-Content "$run/methods.json" -Raw|ConvertFrom-Json
 $code=@()
 foreach($m in $methods){
  if($m.MethodNamespace -notmatch '^Achievement(Model|Data|Controller)$'){continue}
  try{$bytes=$Child.Read([long]$m.MethodStartAddress,[Math]::Min([int]$m.MethodSize,4096));$code+=@{name=$m.MethodNamespace+'.'+$m.MethodName;address=$m.MethodStartAddress;bytes=[Convert]::ToBase64String($bytes)}}catch{}
 }
 $code|ConvertTo-Json -Depth 4|Set-Content "$run/jit-code.json"
 }else{$code=@()}
 $result.stage='heap'
 $exe="$root/.tools/gcdump/dotnet-gcdump.exe"
 $sig=Get-AuthenticodeSignature $exe
 if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Microsoft Corporation'){throw 'Invalid diagnostic tool signature'}
 $worker=Start-Process $exe -WindowStyle Hidden -ArgumentList @('collect','-p',$Child.Id,'-o',('"'+$run+'/heap.gcdump"'),'-t','20') -PassThru -Wait -RedirectStandardOutput "$run/gcdump.log" -RedirectStandardError "$run/gcdump-error.log"
 if($worker.ExitCode -ne 0){throw ('gcdump exit '+$worker.ExitCode)}
 $directory="$root/.tools/gcdump-package/tools/net8.0/any"
 Get-ChildItem $directory -Filter '*.dll'|ForEach-Object {try{[void][Reflection.Assembly]::LoadFrom($_.FullName)}catch{}}
 if(-not ('HeapObjects' -as [type])){Add-Type -Path "$PSScriptRoot/HeapObjects.cs" -CompilerOptions '/nowarn:1701,1702' -ReferencedAssemblies @("$directory/dotnet-gcdump.dll","$directory/Microsoft.Diagnostics.FastSerialization.dll",'System.Collections','System.Runtime')}
 $result.stage='read-objects'
 $rows=@()
 foreach($item in [HeapObjects]::Load("$run/heap.gcdump")){
  $row=[ordered]@{type=$item.Type;address=$item.Address;size=$item.Size;children=$item.Children;validatedType=$false}
  try{$row.bytes=[Convert]::ToBase64String($Child.Read([long]$item.Address,[Math]::Min($item.Size,1024)))}catch{$row.error=$_.Exception.GetBaseException().Message}
  $rows+=$row
 }
 $rows|ConvertTo-Json -Depth 5|Set-Content "$run/objects.json"
 $result.stage='captured';$result.objects=$rows.Count;$result.methods=$code.Count
}catch{$result.error=$_.Exception.GetBaseException().Message}
finally{$result|ConvertTo-Json|Set-Content "$run/result.json"}

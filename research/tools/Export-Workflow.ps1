param([string]$GamePath,[string]$OutputDirectory,[string]$Quality='auto',[int]$TimeoutSeconds=600,[switch]$RefreshCatalog)
$ErrorActionPreference='Stop'
Set-StrictMode -Off
$root=Split-Path (Split-Path $PSScriptRoot)
. "$PSScriptRoot/Launcher.ps1"
. "$PSScriptRoot/Snapshot.ps1"
. "$PSScriptRoot/Catalog.ps1"
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Export requires PowerShell 7'}
if(-not (Test-WuwaAdministrator)){throw 'Export requires administrator privileges'}
if(@(Get-Process -Name Client-Win64-Shipping -ErrorAction SilentlyContinue).Count){throw 'Game already running. Exit it normally before starting Export.'}
$bin=Join-Path (Split-Path $GamePath) 'Client/Binaries/Win64'
$fingerprint=(Get-FileHash "$bin/coreclr.dll" -Algorithm SHA256).Hash
if($fingerprint -ne 'A70D006791E65CD2A1235C966090AA7CB14C7845405C18ED688B14A6A3F662C0'){throw 'Unsupported Mono runtime fingerprint; layout must be revalidated'}
foreach($file in @('.tools/gcdump/dotnet-gcdump.exe','.tools/gcdump-package/tools/net8.0/any/dotnet-gcdump.dll')){if(-not (Test-Path (Join-Path $root $file))){throw ('Missing dependency: '+$file)}}
foreach($file in @('Capture-StartupMemory.ps1','Export-MonoSnapshot.ps1','Snapshot.ps1','Complete-Export.ps1')){
 $errors=$null;[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $file),[ref]$null,[ref]$errors)
 if($errors){throw ($errors|Out-String)}
}
if(-not ('StartupProcess' -as [type])){Add-Type -Path "$PSScriptRoot/StartupProcess.cs"}
if(-not ('LogEvidence' -as [type])){Add-Type -Path "$PSScriptRoot/LogEvidence.cs"}
$child=$null
try{
 $started=[DateTime]::Now
 $child=[StartupProcess]::new((Join-Path $bin 'Client-Win64-Shipping.exe'),(Get-WuwaQuality $GamePath $Quality))
 $child.Resume()
 $run=Join-Path $root ('artifacts/session-'+$child.Id)
 if(Test-Path $run){throw 'This PID has an existing research directory; preserve it under another name before retrying'}
 New-Item -ItemType Directory -Path $run -Force|Out-Null
 [ordered]@{pid=$child.Id;startedAt=$started.ToString('o');coreclrSha256=$fingerprint;gamePath=$GamePath}|ConvertTo-Json|Set-Content "$run/session.json"
 Write-Host 'Game started. Please log in. Waiting for achievement synchronization...'
 $log=Join-Path (Split-Path $GamePath) 'Client/Saved/Logs/Client.log'
 $ready=$false;$deadline=$started.AddSeconds($TimeoutSeconds)
 while([DateTime]::Now -lt $deadline -and -not $child.HasExited){
  if(Test-Path $log){
   foreach($line in [LogEvidence]::Find($log)){
    if($line -match '^\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2}:\d{3})\].*Achievement PhraseBaseData response'){
     $stamp=[DateTime]::ParseExact($Matches[1],'yyyy.MM.dd-HH.mm.ss:fff',[Globalization.CultureInfo]::InvariantCulture)
     if($stamp -ge $started.AddSeconds(-2)){$ready=$true;break}
    }
   }
  }
  if($ready){break};Start-Sleep -Seconds 2
 }
 if(-not $ready){throw 'No achievement synchronization before timeout or game exited; no export completed'}
 Start-Sleep -Seconds 3
 & "$PSScriptRoot/Capture-StartupMemory.ps1" -Child $child -SkipTrace
 $capture=Get-Content "$run/result.json" -Raw|ConvertFrom-Json
 if($capture.stage -ne 'captured'){throw ('Capture failed: '+$capture.error)}
 & "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $child
 $first=Get-Content "$run/achievement-snapshot.json" -Raw|ConvertFrom-Json
 Start-Sleep -Seconds 1
 & "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $child
 $second=Get-Content "$run/achievement-snapshot.json" -Raw|ConvertFrom-Json
 $catalogPath=Join-Path $root 'data/achievement-catalog.json'
 $catalogFresh=$false
 if(Test-Path $catalogPath){$catalog=Get-Content $catalogPath -Raw|ConvertFrom-Json;$catalogFresh=$catalog.resourceFingerprint -eq (Get-WuwaCatalogFingerprint $GamePath)}
 if($RefreshCatalog -or -not $catalogFresh){
  & "$PSScriptRoot/Refresh-ClientCatalog.ps1" -Child $child -Snapshot $second -GamePath $GamePath
  & "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $child
  $first=Get-Content "$run/achievement-snapshot.json" -Raw|ConvertFrom-Json
  Start-Sleep -Seconds 1
  & "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $child
  $second=Get-Content "$run/achievement-snapshot.json" -Raw|ConvertFrom-Json
 }
 & "$PSScriptRoot/Complete-Export.ps1" -Child $child -First $first -Second $second -OutputDirectory $OutputDirectory -RuntimeFingerprint $fingerprint -GamePath $GamePath
}finally{if($child){$child.Dispose()}}

param($Child,$Snapshot,[string]$GamePath)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
$source=Join-Path $PSScriptRoot 'CatalogPayload.cs'
$hash=(Get-FileHash $source -Algorithm SHA256).Hash.Substring(0,16)
$payload=Join-Path $root ('artifacts/CatalogPayload-'+$hash+'.dll')
if(-not (Test-Path $payload)){
 function Quote-Source([string]$s){"'"+$s.Replace("'","''")+"'"}
 $compile='Add-Type -Path '+(Quote-Source $source)+' -OutputAssembly '+(Quote-Source $payload)+' -ErrorAction Stop'
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($compile))
 $worker=Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -PassThru -Wait
 if($worker.ExitCode -ne 0 -or -not (Test-Path $payload)){throw 'Catalog payload compilation failed'}
}
$Snapshot.achievements.id|Set-Content "$root/artifacts/catalog-ids.txt" -Encoding utf8NoBOM
foreach($name in @('catalog-status.json','catalog-error.txt','catalog-bootstrap.json')){$path=Join-Path $root ('artifacts/'+$name);if(Test-Path $path){Remove-Item -LiteralPath $path}}
$runtime=Join-Path (Split-Path $GamePath) 'Client/Binaries/Win64/coreclr.dll'
& "$PSScriptRoot/Query-ClientCatalog.ps1" -Child $Child -RuntimePath $runtime -PayloadPath $payload
$bootstrap=Get-Content "$root/artifacts/catalog-bootstrap.json" -Raw|ConvertFrom-Json
if($bootstrap.error -or $bootstrap.bootstrap -ne 'Bootstrap stage=9, managedException=0x0'){throw ('Catalog bootstrap failed: '+($bootstrap|ConvertTo-Json -Compress))}
$deadline=[DateTime]::UtcNow.AddMinutes(5)
while([DateTime]::UtcNow -lt $deadline -and -not $Child.HasExited){
 if(Test-Path "$root/artifacts/catalog-status.json"){
  try{$status=Get-Content "$root/artifacts/catalog-status.json" -Raw|ConvertFrom-Json}catch{Start-Sleep -Milliseconds 200;continue}
  if($status.state -eq 'failed'){throw (Get-Content "$root/artifacts/catalog-error.txt" -Raw)}
  if($status.state -eq 'complete'){& "$PSScriptRoot/Build-Catalog.ps1" -GamePath $GamePath;return}
 }
 Start-Sleep -Seconds 1
}
throw 'Catalog query did not complete; no success was reported'

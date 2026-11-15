param($Child,$First,$Second,[string]$OutputDirectory,[string]$RuntimeFingerprint,[string]$GamePath='C:\Program Files\Wuthering Waves\Wuthering Waves Game\Wuthering Waves.exe')
$ErrorActionPreference='Stop'
. "$PSScriptRoot/Snapshot.ps1"
if($First.pid -ne $Child.Id -or $Second.pid -ne $Child.Id){throw 'Export belongs to another process'}
$export=ConvertTo-WuwaExport $First $Second
$export.coreclrSha256=$RuntimeFingerprint
$catalogPath=Join-Path (Split-Path (Split-Path $PSScriptRoot)) 'data/achievement-catalog.json'
if(Test-Path $catalogPath){
 . "$PSScriptRoot/Catalog.ps1"
 $catalog=Get-Content $catalogPath -Raw|ConvertFrom-Json
 if($catalog.resourceFingerprint -ne (Get-WuwaCatalogFingerprint $GamePath)){throw 'Catalog resource fingerprint changed; refresh catalog before exporting enriched data'}
 $export=Add-WuwaCatalog $export $catalog
}
$destination=Join-Path $OutputDirectory 'achievements.json'
Save-WuwaExport $export $destination
if($export.schemaVersion -ge 2){Save-WuwaCatalogViews $export $OutputDirectory}
if(-not ('OwnedProcessCloser' -as [type])){Add-Type -Path "$PSScriptRoot/OwnedProcessCloser.cs"}
[OwnedProcessCloser]::Close($Child.Handle,[uint32]$Child.Id)
[ordered]@{success=$true;pid=$Child.Id;count=$export.count;path=$destination;gameExited=$Child.HasExited;completedAt=[DateTimeOffset]::Now.ToString('o')}|ConvertTo-Json|Set-Content (Join-Path $OutputDirectory 'export-result.json')
Write-Host ('Exported '+$export.count+' achievements to '+$destination+'. Owned game process closed.')

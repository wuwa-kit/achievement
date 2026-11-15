$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
. "$root/research/tools/Snapshot.ps1"
$first=Get-Content "$root/artifacts/session-3916/achievement-snapshot-first.json" -Raw|ConvertFrom-Json
$second=Get-Content "$root/artifacts/session-3916/achievement-snapshot.json" -Raw|ConvertFrom-Json
$export=ConvertTo-WuwaExport $first $second
if($export.count -ne 1408 -or $export.completedCount -ne 55 -or $export.unknownCount -ne 1){throw 'Real snapshot regression'}
$unknown=@($export.achievements|Where-Object id -eq 400205)[0]
if($null -ne $unknown.currentProgress -or $unknown.status -ne 'unknown'){throw 'Unknown progress was fabricated'}
$second.achievements[0].id=$second.achievements[1].id
$rejected=$false;try{ConvertTo-WuwaExport $first $second|Out-Null}catch{$rejected=$true}
if(-not $rejected){throw 'Duplicate ID was accepted'}
$second=Get-Content "$root/artifacts/session-3916/achievement-snapshot.json" -Raw|ConvertFrom-Json
$second.achievements[0].currentProgress=123
$rejected=$false;try{ConvertTo-WuwaExport $first $second|Out-Null}catch{$rejected=$true}
if(-not $rejected){throw 'Changing snapshot was accepted'}
'Snapshot validation: stable real data, nullable preservation, duplicate rejection and inconsistent read rejection passed'

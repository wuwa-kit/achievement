$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
. "$root/research/tools/Snapshot.ps1"
. "$root/research/tools/Catalog.ps1"
$first=Get-Content "$root/artifacts/session-24624/achievement-snapshot-first.json" -Raw|ConvertFrom-Json
$second=Get-Content "$root/artifacts/session-24624/achievement-snapshot.json" -Raw|ConvertFrom-Json
$catalog=Get-Content "$root/data/achievement-catalog.json" -Raw|ConvertFrom-Json
$runtime=Get-Content "$root/artifacts/achievement-catalog.runtime.json" -Raw|ConvertFrom-Json
$export=Add-WuwaCatalog (ConvertTo-WuwaExport $first $second) $catalog
if($export.categories.Count -ne 4 -or $export.categories.groups.Count -ne 36 -or $export.mainMenuCount -ne 1307 -or $export.otherGameplayCount -ne 101){throw 'Hierarchy regression'}
$lookup=@{};foreach($a in $runtime.achievements){$lookup[[string]$a.id]=$a}
foreach($a in $export.achievements){
 $actual=$lookup[[string]$a.id]
 if($a.hidden -ne $actual.hidden -or $a.visibleForAccount -ne $actual.visibleForAccount -or $a.clientState -ne $actual.clientState){throw ('Client visibility mismatch: '+$a.id)}
 if([int](($a.rewards|Where-Object itemId -eq 3|Measure-Object quantity -Sum).Sum) -ne $a.astrite){throw 'Astrite reward mismatch'}
}
if($export.astriteSummary.configuredTotal -ne 8810 -or $export.astriteSummary.readyToClaim -ne 25){throw 'Astrite totals regression'}
if(@($export.languageCoverage|Where-Object available).Count -ne 10 -or $export.languages.Count -ne 13){throw 'Language coverage regression'}
$categoryIds=@($export.categories.groups.achievementIds)
if($categoryIds.Count -ne 1307 -or @($categoryIds|Sort-Object -Unique).Count -ne 1307){throw 'Hierarchy lost or duplicated IDs'}
$directory=Join-Path $root 'artifacts/catalog-test'
New-Item -ItemType Directory $directory -Force|Out-Null
Save-WuwaExport $export (Join-Path $directory 'achievements.json')
Save-WuwaCatalogViews $export $directory
$tree=Get-Content (Join-Path $directory 'achievement-tree.zh-Hans.json') -Raw|ConvertFrom-Json
if($tree.categories.Count -ne 4 -or $tree.categories.groups.achievements.Count -ne 1307 -or @($tree.categories.groups.achievements|Where-Object hidden).Count -ne 269){throw 'Serialized tree missing achievements or hidden flags'}
if(@($tree.categories.groups.achievements|Where-Object {$null -eq $_.title -or $null -eq $_.description}).Count){throw 'Chinese texts lost in serialized tree'}
$other=Get-Content (Join-Path $directory 'other-gameplay-achievements.json') -Raw|ConvertFrom-Json
if($other.achievements.Count -ne 101 -or @($other.achievements|Where-Object inMainMenu).Count){throw 'Other gameplay scope mixed into main tree'}
$second.groupStates[0].unlocked=-not $second.groupStates[0].unlocked
$rejected=$false;try{ConvertTo-WuwaExport $first $second|Out-Null}catch{$rejected=$true};if(-not $rejected){throw 'Changing group state accepted'}
'Catalog tests passed: hierarchy, exact client visibility, reward sums, language coverage, changing group rejection'

param([string]$GamePath='C:\Program Files\Wuthering Waves\Wuthering Waves Game\Wuthering Waves.exe')
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
. "$PSScriptRoot/Catalog.ps1"
$raw=Get-Content "$root/artifacts/achievement-catalog.runtime.json" -Raw|ConvertFrom-Json
if($raw.count -ne $raw.requestedCount -or @($raw.missingIds).Count -or $raw.missingRewardCount){throw 'Incomplete config or rewards'}
if(@($raw.achievements.id|Sort-Object -Unique).Count -ne $raw.count){throw 'Duplicate catalog IDs'}
if($raw.astriteItem.names.'zh-Hans' -ne '星声'){throw 'Currency identity mismatch'}
$coverage=@();foreach($lang in $raw.languages){$main=@($raw.achievements|Where-Object inMainMenu);$titles=@($main|Where-Object {$null -ne $_.texts.$lang.title}).Count;$descriptions=@($main|Where-Object {$null -ne $_.texts.$lang.description}).Count;$coverage+=[ordered]@{language=$lang;available=($titles -gt 0 -or $descriptions -gt 0);mainTitles=$titles;mainDescriptions=$descriptions;mainCount=$main.Count;missingTitles=@($main|Where-Object {$null -eq $_.texts.$lang.title}|ForEach-Object id);missingDescriptions=@($main|Where-Object {$null -eq $_.texts.$lang.description}|ForEach-Object id)}}
$clean=@($raw.achievements|Select-Object id,groupId,categoryId,inMainMenu,hidden,nextLink,titleKey,descriptionKey,level,dropId,astrite,rewards,texts)
$catalog=[ordered]@{schemaVersion=1;source='local-client-config-api';collectedAt=[DateTimeOffset]::Now.ToString('o');resourceFingerprint=(Get-WuwaCatalogFingerprint $GamePath);configComplete=$true;allTranslationsPresent=$false;count=$raw.count;languages=$raw.languages;languageCoverage=$coverage;astriteItem=$raw.astriteItem;categories=$raw.categories;groups=@($raw.groups|Select-Object id,categoryId,sort,enabled,titleKey,texts);achievements=$clean}
New-Item -ItemType Directory "$root/data/locales" -Force|Out-Null
$catalog|ConvertTo-Json -Depth 12|Set-Content "$root/data/achievement-catalog.json" -Encoding utf8NoBOM
foreach($lang in $raw.languages){
 $texts=[ordered]@{}
 foreach($a in $raw.achievements){if($a.titleKey){$texts[$a.titleKey]=$a.texts.$lang.title};if($a.descriptionKey){$texts[$a.descriptionKey]=$a.texts.$lang.description}}
 foreach($a in @($raw.categories)+@($raw.groups)){$texts[$a.titleKey]=$a.texts.$lang.title}
 [ordered]@{language=$lang;source='local-client-config-api';coverage=($coverage|Where-Object language -eq $lang|Select-Object -First 1);texts=$texts}|ConvertTo-Json -Depth 6|Set-Content "$root/data/locales/$lang.json" -Encoding utf8NoBOM
}
Write-Host ('Saved '+$raw.count+' configurations, '+$raw.languages.Count+' language query results.')

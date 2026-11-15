function Get-WuwaCatalogFingerprint([string]$GamePath){
 $game=Split-Path $GamePath
 $parts=[Collections.Generic.List[string]]::new()
 foreach($name in @('LocalGameResources.json','launcherDownloadConfig.json')){$path=Join-Path $game $name;if(Test-Path $path){$parts.Add($name+':'+(Get-FileHash $path -Algorithm SHA256).Hash)}}
 foreach($folder in @('Client/Content/Paks','Client/Saved/Resources')){
  $path=Join-Path $game $folder
  if(Test-Path $path){foreach($file in (Get-ChildItem $path -File -Filter '*.pak' -Recurse|Where-Object {$_.FullName -notmatch '[\\/]Video[\\/]'}|Sort-Object FullName)){$parts.Add($file.FullName.Substring($game.Length)+':'+$file.Length+':'+$file.LastWriteTimeUtc.Ticks)}}
 }
 $sha=[Security.Cryptography.SHA256]::Create();try{[Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($parts -join "`n"))))}finally{$sha.Dispose()}
}
function Add-WuwaCatalog($Export,$Catalog){
 $byId=@{};foreach($a in $Catalog.achievements){if($byId.ContainsKey([string]$a.id)){throw 'Duplicate catalog ID'};$byId[[string]$a.id]=$a}
 $progress=@{};foreach($a in $Export.achievements){$progress[[string]$a.id]=$a}
 $groupById=@{};foreach($g in $Catalog.groups){$groupById[[string]$g.id]=$g}
 $unlock=@{};foreach($g in $Export.groupStates){$unlock[[string]$g.id]=[bool]$g.unlocked}
 $rows=@()
 foreach($p in $Export.achievements){
  $c=$byId[[string]$p.id];if($null -eq $c){throw ('Catalog missing achievement '+$p.id)}
  $g=$groupById[[string]$c.groupId];if($null -eq $g){throw 'Catalog group missing'}
  if(-not $unlock.ContainsKey([string]$g.id)){throw ('Live group state missing: '+$g.id)}
  $state=if($p.hasGetReward){'HaveGetReward'}elseif($p.finishTimeRaw -gt 0){'CanGetReward'}else{'UnFinished'}
  $reason='visible'
  if(-not $c.inMainMenu){$reason='outside_main_menu'}
  elseif(-not $g.enabled -or -not $unlock[[string]$g.id]){$reason='group_unavailable'}
  elseif($null -eq $p.maxProgress){$reason='progress_unavailable'}
  elseif($c.hidden -and $state -eq 'UnFinished'){$reason='hidden_until_completed'}
  elseif($p.previousId -ne -1 -and (-not $progress.ContainsKey([string]$p.previousId) -or -not $progress[[string]$p.previousId].hasGetReward)){$reason='previous_reward_unclaimed'}
  elseif($p.hasGetReward -and $p.nextId -gt 0){$reason='replaced_by_next_stage'}
  $rows += [pscustomobject][ordered]@{id=$p.id;categoryId=$c.categoryId;groupId=$c.groupId;hidden=$c.hidden;inMainMenu=$c.inMainMenu;visibleForAccount=($reason -eq 'visible');visibilityReason=$reason;clientState=$state;previousId=$p.previousId;nextId=$p.nextId;currentProgress=$p.currentProgress;maxProgress=$p.maxProgress;hasGetReward=$p.hasGetReward;finishTimeRaw=$p.finishTimeRaw;status=$p.status;titleKey=$c.titleKey;descriptionKey=$c.descriptionKey;level=$c.level;dropId=$c.dropId;astrite=$c.astrite;rewards=$c.rewards;texts=$c.texts}
 }
 $Export.schemaVersion=2;$Export.achievements=$rows;$Export.languages=$Catalog.languages;$Export.languageCoverage=$Catalog.languageCoverage
 $Export.catalogSource=$Catalog.source;$Export.catalogFingerprint=$Catalog.resourceFingerprint
 $Export.categories=@($Catalog.categories|Where-Object inMainMenu|ForEach-Object {
  $cat=$_;$groups=@($Catalog.groups|Where-Object categoryId -eq $cat.id|Sort-Object sort,id|ForEach-Object {$group=$_;[ordered]@{id=$group.id;categoryId=$cat.id;sort=$group.sort;enabled=$group.enabled;unlocked=$unlock[[string]$group.id];titleKey=$group.titleKey;texts=$group.texts;achievementIds=@($rows|Where-Object groupId -eq $group.id|ForEach-Object id)}})
  [ordered]@{id=$cat.id;titleKey=$cat.titleKey;texts=$cat.texts;groups=$groups}
 })
 $main=@($rows|Where-Object inMainMenu)
 $Export.mainMenuCount=$main.Count;$Export.otherGameplayCount=$rows.Count-$main.Count
 $Export.astriteSummary=[ordered]@{scope='main-achievement-menu';configuredTotal=[int](($main|Measure-Object astrite -Sum).Sum);claimed=[int](($main|Where-Object hasGetReward|Measure-Object astrite -Sum).Sum);readyToClaim=[int](($main|Where-Object clientState -eq CanGetReward|Measure-Object astrite -Sum).Sum);notCompleted=[int](($main|Where-Object clientState -eq UnFinished|Measure-Object astrite -Sum).Sum);unknownProgressCount=@($main|Where-Object {$null -eq $_.maxProgress}).Count}
 return $Export
}
function Save-WuwaCatalogViews($Export,[string]$OutputDirectory,[string]$Language='zh-Hans'){
 $index=@{};foreach($a in $Export.achievements){$index[[string]$a.id]=$a}
 $categories=@(foreach($category in $Export.categories){
  $groups=@(foreach($group in $category.groups){
   $items=@(foreach($id in $group.achievementIds){$a=$index[[string]$id];[ordered]@{id=$a.id;title=$a.texts.$Language.title;description=$a.texts.$Language.description;hidden=$a.hidden;visibleForAccount=$a.visibleForAccount;visibilityReason=$a.visibilityReason;status=$a.status;currentProgress=$a.currentProgress;maxProgress=$a.maxProgress;astrite=$a.astrite;rewards=$a.rewards;previousId=$a.previousId;nextId=$a.nextId}})
   [ordered]@{id=$group.id;title=$group.texts.$Language.title;enabled=$group.enabled;unlocked=$group.unlocked;achievements=$items}
  })
  [ordered]@{id=$category.id;title=$category.texts.$Language.title;groups=$groups}
 })
 [ordered]@{language=$Language;scope='main-achievement-menu';count=$Export.mainMenuCount;astriteSummary=$Export.astriteSummary;categories=$categories}|ConvertTo-Json -Depth 14|Set-Content (Join-Path $OutputDirectory ('achievement-tree.'+$Language+'.json')) -Encoding utf8NoBOM
 [ordered]@{scope='other-gameplay';count=$Export.otherGameplayCount;achievements=@($Export.achievements|Where-Object {-not $_.inMainMenu})}|ConvertTo-Json -Depth 10|Set-Content (Join-Path $OutputDirectory 'other-gameplay-achievements.json') -Encoding utf8NoBOM
}

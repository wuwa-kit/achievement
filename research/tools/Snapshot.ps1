function ConvertTo-WuwaExport($First,$Second) {
 foreach($s in @($First,$Second)){
  if($s.stage -ne 'snapshot' -or -not $s.structurallyValidated -or $s.count -lt 1 -or @($s.achievements).Count -ne $s.count){throw 'Snapshot validation failed'}
  if(@($s.achievements.id|Sort-Object -Unique).Count -ne $s.count){throw 'Duplicate achievement IDs'}
  $finished=@($s.achievements|Where-Object {$_.hasGetReward -or $_.finishTimeRaw -gt 0})
  if($finished.Count -ne $s.modelFinishCount){throw 'Model completion count mismatch'}
  if(@($s.achievements|Where-Object {$_.hasGetReward -and $_.finishTimeRaw -le 0}).Count){throw 'Claimed reward without completion evidence'}
 }
 if($First.pid -ne $Second.pid -or ($First.achievements|ConvertTo-Json -Depth 5 -Compress) -ne ($Second.achievements|ConvertTo-Json -Depth 5 -Compress)){throw 'Achievement state changed during verification; retry'}
 if(($First.groupStates|ConvertTo-Json -Compress) -ne ($Second.groupStates|ConvertTo-Json -Compress)){throw 'Group state changed during verification'}
 $rows=@($Second.achievements|Sort-Object id|ForEach-Object {
  $status=if($_.hasGetReward){'reward_claimed'}elseif($_.finishTimeRaw -gt 0){'completed'}elseif($null -eq $_.currentProgress -or $null -eq $_.maxProgress){'unknown'}else{'in_progress'}
  [ordered]@{id=$_.id;previousId=$_.previousId;nextId=$_.nextId;currentProgress=$_.currentProgress;maxProgress=$_.maxProgress;hasGetReward=$_.hasGetReward;finishTimeRaw=$_.finishTimeRaw;status=$status}
 })
 [ordered]@{schemaVersion=1;complete=$true;coverage='clientAchievementMap';capturedAt=$Second.at;processId=$Second.pid;count=$rows.Count;completedCount=$Second.modelFinishCount;starCount=$Second.modelStarCount;unknownCount=@($rows|Where-Object status -eq unknown).Count;groupStates=$Second.groupStates;achievements=$rows}
}
function Save-WuwaExport($Export,[string]$Path){
 $full=[IO.Path]::GetFullPath($Path);$temp=$full+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
 try{
  $Export|ConvertTo-Json -Depth 16|Set-Content -LiteralPath $temp -Encoding UTF8
  $check=Get-Content -LiteralPath $temp -Raw|ConvertFrom-Json
  if(-not $check.complete -or @($check.achievements).Count -ne $Export.count){throw 'Written export validation failed'}
  [IO.File]::Move($temp,$full,$true)
 }finally{if(Test-Path $temp){Remove-Item -LiteralPath $temp}}
}

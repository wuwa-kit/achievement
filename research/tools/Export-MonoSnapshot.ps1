param($Child,[switch]$FunctionsOnly)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
$run=Join-Path $root ('artifacts/session-'+$Child.Id)
$result=[ordered]@{pid=$Child.Id;at=[DateTimeOffset]::Now.ToString('o');complete=$false;stage='metadata'}
$fieldCache=@{}
function Bytes([long]$a,[int]$n){,$Child.Read($a,$n)}
function Ptr([long]$a){[BitConverter]::ToInt64((Bytes $a 8),0)}
function Int([long]$a){[BitConverter]::ToInt32((Bytes $a 4),0)}
function Name([long]$a){$b=Bytes $a 128;$end=[Array]::IndexOf($b,[byte]0);if($end -lt 0){throw 'Unterminated metadata name'};[Text.Encoding]::UTF8.GetString($b,0,$end)}
function ObjectClass([long]$a){Ptr (Ptr $a)}
function ClassName([long]$k){Name (Ptr ($k+72))}
function Fields([long]$k){
 if($fieldCache.ContainsKey($k)){return $fieldCache[$k]}
 $p=Ptr ($k+160);$map=@{}
 for($i=0;$i -lt 128;$i++){
  $b=Bytes ($p+$i*32) 32
  if(([BitConverter]::ToInt64($b,16) -band -4L) -ne $k){break}
  $n=Name ([BitConverter]::ToInt64($b,8));if($n -notmatch '^[A-Za-z_<][A-Za-z0-9_<>`.$]*$'){break}
  $type=Bytes ([BitConverter]::ToInt64($b,0)) 16
  $map[$n]=@{offset=[BitConverter]::ToInt32($b,24);kind=$type[10];attrs=[BitConverter]::ToUInt16($type,8);data=[BitConverter]::ToInt64($type,0)}
 }
 $fieldCache[$k]=$map
 return $map
}
function Nullable([long]$a,$field){
 if($field.kind -ne 21){throw 'Expected generic nullable field'}
 $k=Ptr ($field.data+32)
 if((ClassName $k) -ne 'Nullable`1'){throw 'Expected Nullable type'}
 $f=Fields $k
 if(-not $f.ContainsKey('hasValue') -or -not $f.ContainsKey('value')){throw 'Nullable metadata missing'}
 $has=(Bytes ($a+$f.hasValue.offset-16) 1)[0]
 if($has -eq 0){return $null};if($has -ne 1){throw 'Invalid nullable flag'}
 $valueAddress=$a+$f.value.offset-16
 switch($f.value.kind){2{return [bool](Bytes $valueAddress 1)[0]};8{return (Int $valueAddress)};default{throw ('Unsupported nullable element '+$f.value.kind)}}
}
if($FunctionsOnly){return}
try {
 $model=@(Get-Content "$run/objects.json" -Raw|ConvertFrom-Json|Where-Object type -eq AchievementModel)
 if($model.Count -ne 1){throw 'Expected one model'}
 $modelAddress=[long]$model[0].address;$modelClass=ObjectClass $modelAddress
 if((ClassName $modelClass) -ne 'AchievementModel'){throw 'Model moved or invalid'}
 $mf=Fields $modelClass
 $dict=Ptr ($modelAddress+$mf.AchievementMap.offset);$df=Fields (ObjectClass $dict)
 $result.dictionaryFields=$df
 if(-not $df.ContainsKey('_entries')){throw 'Dictionary fields missing'}
 $count=Int ($dict+$df._count.offset);$free=Int ($dict+$df._freeCount.offset);$version=Int ($dict+$df._version.offset)
 if($count -le 0 -or $count -gt 10000){throw 'Invalid dictionary count'}
 $array=Ptr ($dict+$df._entries.offset);$arrayClass=ObjectClass $array;$elementClass=Ptr $arrayClass
 $ef=Fields $elementClass;$result.entryFields=$ef
 if(-not $ef.ContainsKey('key') -or -not $ef.ContainsKey('value')){throw 'Entry fields missing'}
 $stride=(Int ($elementClass+28))-16
 if($stride -lt 16 -or $stride -gt 128){throw ('Invalid entry stride '+$stride)}
 $length=Ptr ($array+24);if($length -lt $count -or $length -gt 100000){throw 'Invalid array length'}
 $result.stage='entries';$rows=@();$ids=[Collections.Generic.HashSet[int]]::new()
 for($i=0;$i -lt $count;$i++){
  $entry=$array+32+$i*$stride
  if((Int ($entry+$ef.next.offset-16)) -lt -1){continue}
  $key=Int ($entry+$ef.key.offset-16);$a=Ptr ($entry+$ef.value.offset-16)
  if($a -eq 0){throw 'Null active achievement'}
  $k=ObjectClass $a;if((ClassName $k) -ne 'AchievementData'){throw 'Invalid achievement type'}
  $f=Fields $k;$id=Int ($a+$f.Id.offset)
  if($key -ne $id -or -not $ids.Add($id)){throw 'Duplicate or mismatched ID'}
  $row=[ordered]@{id=$id;previousId=(Int ($a+$f.LastAchievementId.offset));nextId=(Int ($a+$f.NextAchievementId.offset));currentProgress=(Nullable ($a+$f.CurrentProgress.offset) $f.CurrentProgress);maxProgress=(Nullable ($a+$f.MaxProgress.offset) $f.MaxProgress);hasGetReward=(Nullable ($a+$f.HasGetRewardState.offset) $f.HasGetRewardState);finishTimeRaw=(Nullable ($a+$f.FinishTime.offset) $f.FinishTime)}
  $rows+=$row
 }
 if($rows.Count -ne $count-$free){throw 'Dictionary live count mismatch'}
 if((Int ($dict+$df._version.offset)) -ne $version -or (Ptr ($modelAddress+$mf.AchievementMap.offset)) -ne $dict){throw 'Collection changed during read'}
 $gd=Ptr ($modelAddress+$mf.AllAchievementGroupMap.offset);$gf=Fields (ObjectClass $gd);$gn=Int ($gd+$gf._count.offset);$gv=Int ($gd+$gf._version.offset)
 if($gn -lt 1 -or $gn -gt 1000){throw 'Group count bound'}
 $ga=Ptr ($gd+$gf._entries.offset);$ge=Ptr (ObjectClass $ga);$gef=Fields $ge;$gs=(Int ($ge+28))-16;$groupStates=@()
 for($i=0;$i -lt $gn;$i++){
  $e=$ga+32+$i*$gs;if((Int ($e+$gef.next.offset-16)) -lt -1){continue}
  $key=Int ($e+$gef.key.offset-16);$o=Ptr ($e+$gef.value.offset-16);$k=ObjectClass $o
  if((ClassName $k) -ne 'AchievementGroupData'){throw 'Group type mismatch'}
  $f=Fields $k;if((Int ($o+$f.Id.offset)) -ne $key){throw 'Group ID mismatch'}
  $groupStates+=@{id=$key;unlocked=[bool](Bytes ($o+$f.IfUnLock.offset) 1)[0]}
 }
 if((Int ($gd+$gf._version.offset)) -ne $gv){throw 'Groups changed while reading'}
 $result.groupStates=$groupStates
 $result.stage='snapshot';$result.count=$rows.Count;$result.modelFinishCount=Int ($modelAddress+$mf.AchieveFinishCount.offset);$result.modelStarCount=Int ($modelAddress+$mf.AchieveStarCount.offset)
 $result.structurallyValidated=$true;$result.uiValidated=$false;$result.achievements=$rows
}catch{$result.error=$_.Exception.GetBaseException().Message}
finally{$result|ConvertTo-Json -Depth 8|Set-Content "$run/achievement-snapshot.json"}

param($Child,[switch]$FunctionsOnly)
. "$PSScriptRoot/Inspect-Catalog.ps1" -Child $Child -FunctionsOnly
function DictionaryEntries([long]$a){
 $f=Fields (ObjectClass $a);$n=Int ($a+$f._count.offset);if($n -lt 0 -or $n -gt 100000){throw 'Dictionary bound'}
 $arr=Ptr ($a+$f._entries.offset);if($arr -eq 0){return};$ek=Ptr (ObjectClass $arr);$ef=Fields $ek;$stride=(Int ($ek+28))-16
 for($i=0;$i -lt $n;$i++){$e=$arr+32+$i*$stride;if((Int ($e+$ef.next.offset-16)) -lt -1){continue};$kp=$e+$ef.key.offset-16;$vp=$e+$ef.value.offset-16
  $key=if($ef.key.kind -eq 14){ManagedString (Ptr $kp)}elseif($ef.key.kind -eq 8){Int $kp}else{'kind:'+$ef.key.kind}
  [pscustomobject]@{key=$key;value=(Ptr $vp);valueKind=$ef.value.kind}
 }
}
if($FunctionsOnly){return}
$out=@();$roots=Get-Content "$run/catalog-objects.json" -Raw|ConvertFrom-Json
foreach($r in ($roots|Where-Object {$_.root -in @('[static var ConfigCommon.LruBuffer]','[static var ConfigCommon.Lru]','[static var ConfigCommon.HandleIdMap]','[static var Aki.Config.ConfigMultiTextLang.LangCache]') -or $_.type -eq 'MultiTextCsvModule'})){
 try{
  $dict=if($r.type -eq 'TrimLru`2'){$r.fields.Table.value.pointer}elseif($r.type -eq 'MultiTextCsvModule'){$r.fields.MultiTextMap.value.pointer}else{$r.address}
  $entries=@(DictionaryEntries $dict);$rec=[ordered]@{source=$r.root;type=$r.type;count=$entries.Count;keys=@($entries.key);selected=@()}
  foreach($entry in ($entries|Where-Object {$_.key -match '(?i)achieve|lang|multi|config|db' }|Select-Object -First 60)){
   $v=Describe $entry.value;$v.key=$entry.key;$rec.selected+=$v
  }
  $out+=$rec
 }catch{$out+=@{source=$r.root;error=$_.Exception.Message}}
}
$sample=Get-Content "$run/objects.json" -Raw|ConvertFrom-Json|Where-Object type -eq AchievementData|Select-Object -First 1
$f=Fields (ObjectClass $sample.address);$rewards=Ptr ($sample.address+$f.Rewards.offset);$desc=Describe $rewards;$out+=@{rewardList=$desc}
$array=$desc.fields._items.value.pointer;$ek=Ptr (ObjectClass $array);$out+=@{rewardEntryType=(ClassName $ek);rewardEntryFields=(Fields $ek);sampleBytes=[Convert]::ToBase64String((Bytes ($array+32) 64))}
$out|ConvertTo-Json -Depth 12|Set-Content "$run/catalog-cache.json"

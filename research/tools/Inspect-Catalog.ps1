param($Child,[switch]$FunctionsOnly)
. "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $Child -FunctionsOnly
function ManagedString([long]$a){if($a -eq 0){return $null};if((ClassName (ObjectClass $a)) -ne 'String'){throw 'Not string'};$n=Int ($a+16);if($n -lt 0 -or $n -gt 32768){throw 'String size limit'};if($n -eq 0){return ''};[Text.Encoding]::Unicode.GetString((Bytes ($a+20) ($n*2)))}
function Describe([long]$a){
 $k=ObjectClass $a;$name=ClassName $k;$f=Fields $k;$v=[ordered]@{address=$a;type=$name;fields=@{}}
 foreach($n in $f.Keys){$m=$f[$n];if(($m.attrs -band 16) -ne 0){continue};$p=$a+$m.offset;$value=$null
  try{switch($m.kind){8{$value=Int $p};9{$value=Int $p};10{$value=Ptr $p};2{$value=[bool](Bytes $p 1)[0]};14{$value=ManagedString (Ptr $p)};default{$q=Ptr $p;$value=@{pointer=$q};if($q -gt 65536){try{$value.type=ClassName (ObjectClass $q)}catch{}}}}}catch{$value=@{error=$_.Exception.Message}}
  $v.fields[$n]=@{offset=$m.offset;kind=$m.kind;value=$value}
 }
 return $v
}
if($FunctionsOnly){return}
$out=@()
$objects=Get-Content "$run/objects.json" -Raw|ConvertFrom-Json
foreach($group in ($objects|Where-Object type -in @('AchievementData','AchievementConfig','Aki.Config.Achievement','Aki.Config.AchievementGroup','MultiTextCsvModule','TextConfig','LanguageSystem','LanguageDefine','Aki.Config.ConfigMultiTextLang')|Group-Object type)){
 foreach($item in ($group.Group|Select-Object -First 2)){try{$out+=Describe $item.address}catch{$out+=@{type=$group.Name;error=$_.Exception.Message}}}
}
if(Test-Path "$run/catalog-roots.json"){
 foreach($item in (Get-Content "$run/catalog-roots.json" -Raw|ConvertFrom-Json)){
  $addresses=if($item.Address -eq 0){$item.Children}else{@($item.Address)}
  foreach($a in $addresses){try{$v=Describe $a;$v.root=$item.Type;$out+=$v}catch{$out+=@{root=$item.Type;error=$_.Exception.Message}}}
 }
}
$out|ConvertTo-Json -Depth 10|Set-Content "$run/catalog-objects.json"

param($Child)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
$run=Join-Path $root ('artifacts/session-'+$Child.Id)
function Read-U64([long]$address){[BitConverter]::ToInt64($Child.Read($address,8),0)}
function Read-Name([long]$address){
 if($address -lt 65536){return ''}
 try{$b=$Child.Read($address,128);$n=[Array]::IndexOf($b,[byte]0);if($n -lt 0){return ''};[Text.Encoding]::UTF8.GetString($b,0,$n)}catch{return ''}
}
$result=@()
foreach($sample in (Get-Content "$run/objects.json" -Raw|ConvertFrom-Json|Where-Object type -in @('AchievementData','AchievementModel','AchievementGroupData','AchievementCategoryData','AchievementConfig','Aki.Config.Achievement','Aki.Config.AchievementGroup','MultiTextCsvModule','TextConfig','LanguageSystem','LanguageDefine','Aki.Config.ConfigMultiTextLang')|Group-Object type)){
 $row=[ordered]@{type=$sample.Name;count=$sample.Count;fields=@();classStrings=@()}
 try{
  $obj=$sample.Group[0];$vt=Read-U64 $obj.address;$klass=Read-U64 $vt;$row.vtable=$vt;$row.klass=$klass
  $classBytes=$Child.Read($klass,384)
  for($offset=0;$offset -lt 256;$offset+=8){
   $pointer=[BitConverter]::ToInt64($classBytes,$offset)
   $name=Read-Name $pointer
   if($name -match '^[A-Za-z_<][A-Za-z0-9_<>`.+]*$'){$row.classStrings+=@{offset=$offset;value=$name}}
   if($pointer -lt 65536){continue}
   try{$field=$Child.Read($pointer,32)}catch{continue}
   if(([BitConverter]::ToInt64($field,16) -band -4L) -ne $klass){continue}
   $row.fieldArrayClassOffset=$offset
   for($i=0;$i -lt 128;$i++){
    $field=$Child.Read(($pointer+$i*32),32)
    if(([BitConverter]::ToInt64($field,16) -band -4L) -ne $klass){break}
    $fieldName=Read-Name ([BitConverter]::ToInt64($field,8));if(-not $fieldName){break}
    $type=$Child.Read([BitConverter]::ToInt64($field,0),16)
    $row.fields+=@{name=$fieldName;offset=[BitConverter]::ToInt32($field,24);typeBytes=[Convert]::ToBase64String($type)}
   }
  }
 }catch{$row.error=$_.Exception.GetBaseException().Message}
 $result+=$row
}
$result|ConvertTo-Json -Depth 6|Set-Content "$run/mono-fields.json"

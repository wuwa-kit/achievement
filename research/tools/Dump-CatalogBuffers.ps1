param($Child)
. "$PSScriptRoot/Inspect-CatalogCache.ps1" -Child $Child -FunctionsOnly
$roots=Get-Content "$run/catalog-objects.json" -Raw|ConvertFrom-Json
$rootObject=$roots|Where-Object root -eq '[static var ConfigCommon.LruBuffer]'|Select-Object -First 1
$dict=$rootObject.fields.Table.value.pointer;$rows=@()
$folder=Join-Path $run 'config-buffers';New-Item -ItemType Directory $folder -Force|Out-Null
foreach($e in (DictionaryEntries $dict)){
 if($e.key -notmatch '^(Achievement|Drop|ItemInfoById#3$)'){continue}
 try{
  $f=Fields (ObjectClass $e.value);$bb=Ptr ($e.value+$f.Value.offset)
  $f=Fields (ObjectClass $bb);$allocator=Ptr ($bb+$f._buffer.offset)
  $f=Fields (ObjectClass $allocator);$arr=Ptr ($allocator+$f._buffer.offset);$length=Ptr ($arr+24)
  if($length -le 0 -or $length -gt 65536){throw 'Buffer bounds'}
  $file=($e.key -replace '[^a-zA-Z0-9_#-]','_')+'.bin'
  [IO.File]::WriteAllBytes((Join-Path $folder $file),(Bytes ($arr+32) $length))
  $rows+=@{key=$e.key;length=$length;file=$file}
 }catch{$rows+=@{key=$e.key;error=$_.Exception.Message}}
}
$rows|ConvertTo-Json -Depth 4|Set-Content "$run/config-buffers.json"
$langRoot=$roots|Where-Object root -eq '[static var Aki.Config.ConfigMultiTextLang.LangCache]'|Select-Object -First 1
$text=@{}
foreach($e in (DictionaryEntries $langRoot.address)){if($e.key -match '(?i)achiev|trophy|itemname_3$'){try{$text[$e.key]=ManagedString $e.value}catch{}}}
$text|ConvertTo-Json -Depth 4|Set-Content "$run/loaded-achievement-text.json"

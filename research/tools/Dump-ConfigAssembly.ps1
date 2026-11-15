param($Child)
. "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $Child -FunctionsOnly
$out=@()
$objects=Get-Content "$run/objects.json" -Raw|ConvertFrom-Json
foreach($type in @('AchievementModel','MultiTextCsvModule')){
 try{
  $obj=$objects|Where-Object type -eq $type|Select-Object -First 1
  $image=Ptr ((ObjectClass $obj.address)+64);$raw=Ptr ($image+16);$length=Int ($image+24)
  $row=[ordered]@{type=$type;image=$image;raw=$raw;length=$length;imageName=(Name (Ptr ($image+32)))}
  if($length -le 0 -or $length -gt 128MB){throw 'Invalid image size'}
  $header=Bytes $raw 2;if($header[0] -ne 77 -or $header[1] -ne 90){throw 'Image is not PE'}
  $file=Join-Path $run ($type+'-assembly.dll');$stream=[IO.File]::Create($file)
  try{for($offset=0;$offset -lt $length;$offset+=65536){$b=Bytes ($raw+$offset) ([Math]::Min(65536,$length-$offset));$stream.Write($b,0,$b.Length)}}finally{$stream.Dispose()}
  $row.file=$file;$out+=$row
 }catch{$out+=@{type=$type;error=$_.Exception.Message}}
}
try{
 $cache=Get-Content "$run/catalog-cache.json" -Raw|ConvertFrom-Json
 $node=($cache|Where-Object source -eq '[static var ConfigCommon.Lru]').selected|Where-Object key -like 'AchievementByGroupId*'|Select-Object -First 1
 $list=$node.fields.Value.value.pointer;$f=Fields (ObjectClass $list);$arr=Ptr ($list+$f._items.offset)
 $k=Ptr (ObjectClass $arr);$image=Ptr ($k+64);$raw=Ptr ($image+16);$length=Int ($image+24)
 if((ClassName $k) -ne 'Achievement' -or $length -le 0 -or $length -gt 128MB){throw 'Config image identity or size mismatch'}
 $header=Bytes $raw 2;if($header[0] -ne 77 -or $header[1] -ne 90){throw 'Config image not PE'}
 $file=Join-Path $run 'Aki.Config.dll';$stream=[IO.File]::Create($file)
 try{for($offset=0;$offset -lt $length;$offset+=65536){$b=Bytes ($raw+$offset) ([Math]::Min(65536,$length-$offset));$stream.Write($b,0,$b.Length)}}finally{$stream.Dispose()}
 $out+=@{type='Aki.Config';file=$file;length=$length}
}catch{$out+=@{type='Aki.Config';error=$_.Exception.Message}}
$out|ConvertTo-Json -Depth 4|Set-Content "$run/assembly-dump.json"

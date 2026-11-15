param($Child,[string]$Destination,[string]$DacPath,[switch]$SkipHeapInspection)
$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
if(Test-Path "$root/artifacts/refresh-catalog.request"){
 Remove-Item -LiteralPath "$root/artifacts/refresh-catalog.request"
 $run=Join-Path $root ('artifacts/session-'+$Child.Id)
 $snapshot=Get-Content "$run/achievement-snapshot.json" -Raw|ConvertFrom-Json
 & "$PSScriptRoot/Refresh-ClientCatalog.ps1" -Child $Child -Snapshot $snapshot -GamePath 'C:\Program Files\Wuthering Waves\Wuthering Waves Game\Wuthering Waves.exe'
 return
}
if(Test-Path "$root/artifacts/query-catalog.request"){
 Remove-Item -LiteralPath "$root/artifacts/query-catalog.request"
 & "$PSScriptRoot/Query-ClientCatalog.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/dump-assembly.request"){
 Remove-Item -LiteralPath "$root/artifacts/dump-assembly.request"
 & "$PSScriptRoot/Dump-ConfigAssembly.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/dump-catalog.request"){
 Remove-Item -LiteralPath "$root/artifacts/dump-catalog.request"
 & "$PSScriptRoot/Dump-CatalogBuffers.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/inspect-cache.request"){
 Remove-Item -LiteralPath "$root/artifacts/inspect-cache.request"
 & "$PSScriptRoot/Inspect-CatalogCache.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/inspect-catalog.request"){
 Remove-Item -LiteralPath "$root/artifacts/inspect-catalog.request"
 & "$PSScriptRoot/Inspect-Catalog.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/complete-export.request"){
 Remove-Item -LiteralPath "$root/artifacts/complete-export.request"
 $run=Join-Path $root ('artifacts/session-'+$Child.Id)
 $first=Get-Content "$run/achievement-snapshot-first.json" -Raw|ConvertFrom-Json
 & "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $Child
 $second=Get-Content "$run/achievement-snapshot.json" -Raw|ConvertFrom-Json
 & "$PSScriptRoot/Complete-Export.ps1" -Child $Child -First $first -Second $second -OutputDirectory "$root/artifacts" -RuntimeFingerprint 'A70D006791E65CD2A1235C966090AA7CB14C7845405C18ED688B14A6A3F662C0'
 return
}
if(Test-Path "$root/artifacts/export-mono.request"){
 Remove-Item -LiteralPath "$root/artifacts/export-mono.request"
 & "$PSScriptRoot/Export-MonoSnapshot.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/inspect-mono.request"){
 Remove-Item -LiteralPath "$root/artifacts/inspect-mono.request"
 & "$PSScriptRoot/Inspect-MonoFields.ps1" -Child $Child
 return
}
if(Test-Path "$root/artifacts/capture-memory.request"){
 Remove-Item -LiteralPath "$root/artifacts/capture-memory.request"
 & "$PSScriptRoot/Capture-StartupMemory.ps1" -Child $Child
 return
}
$result=[ordered]@{at=[DateTimeOffset]::Now.ToString('o');pid=$Child.Id;complete=$false;stage='load';runtime=@();types=@()}
$target=$null
try {
 if(-not ('StartupClrReader' -as [type])){
  [void][Reflection.Assembly]::LoadFrom("$root/.tools/gcdump-package/tools/net8.0/any/Microsoft.Diagnostics.NETCore.Client.dll")
  [void][Reflection.Assembly]::LoadFrom("$root/.tools/clrmd3/lib/net6.0/Microsoft.Diagnostics.Runtime.dll")
  Add-Type -CompilerOptions '/nowarn:1701,1702' -Path "$PSScriptRoot/StartupClrReader.cs" -ReferencedAssemblies @("$root/.tools/clrmd3/lib/net6.0/Microsoft.Diagnostics.Runtime.dll",'System.Runtime','System.Collections','System.Memory','System.Runtime.InteropServices','System.Runtime.InteropServices.RuntimeInformation','System.ComponentModel.Primitives')
 }
 $reader=[StartupClrReader]::new($Child.Handle,[int]$Child.Id)
 $custom=[Microsoft.Diagnostics.Runtime.CustomDataTarget]::new($reader)
 $target=[Microsoft.Diagnostics.Runtime.DataTarget]::new($custom)
 $result.stage='runtime-discovery'
 foreach($info in $target.ClrVersions){$result.runtime+=@{version=$info.Version.ToString();module=$info.ModuleInfo.FileName}}
 if(-not $target.ClrVersions.Length){throw 'No CLR discovered'}
 $result.stage='dac-load'
 $result.debugExports=@{}
 foreach($symbol in @('g_dacTable','DotNetRuntimeInfo','CLRDataCreateInstance')){
  $result.debugExports[$symbol]=('0x{0:X}' -f $target.ClrVersions[0].ModuleInfo.GetExportSymbolAddress($symbol))
 }
 $dac=if($DacPath){$DacPath}else{"$root/.tools/runtime9/runtimes/win-x64/native/mscordaccore.dll"}
 $runtime=$target.ClrVersions[0].CreateRuntime($dac,$true)
 if($SkipHeapInspection){$result.stage='dac-loaded';return}
 $result.stage='heap-types'
 $count=0
 foreach($object in $runtime.Heap.EnumerateObjects()){
  if(++$count -gt 3000000){throw 'Object enumeration limit'}
  if($object.Type.Name -in @('AchievementModel','AchievementData')){
   $result.types+=@{name=$object.Type.Name;address=('0x{0:X}' -f $object.Address);fields=@($object.Type.Fields|ForEach-Object {@{name=$_.Name;offset=$_.Offset;type=$_.Type.Name;elementType=$_.ElementType.ToString()}})}
   if($result.types.Count -ge 3){break}
  }
 }
 $result.stage='inspected';$result.objectsVisited=$count
}catch{$result.error=$_.Exception.GetBaseException().Message}
finally{if($target){$target.Dispose()};$result|ConvertTo-Json -Depth 8|Set-Content $Destination}

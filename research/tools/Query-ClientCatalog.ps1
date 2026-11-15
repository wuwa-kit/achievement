param($Child,[string]$RuntimePath='C:\Program Files\Wuthering Waves\Wuthering Waves Game\Client\Binaries\Win64\coreclr.dll',[string]$PayloadPath)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/Inspect-Catalog.ps1" -Child $Child -FunctionsOnly
if(-not $PayloadPath){$PayloadPath=Join-Path $root 'artifacts/CatalogPayloadV2.dll'}
if((Get-FileHash $runtimePath -Algorithm SHA256).Hash -ne 'A70D006791E65CD2A1235C966090AA7CB14C7845405C18ED688B14A6A3F662C0'){throw 'Runtime fingerprint mismatch'}
$languages=@()
foreach($o in (Get-Content "$run/objects.json" -Raw|ConvertFrom-Json|Where-Object type -eq LanguageDefine)){
 if((ClassName (ObjectClass $o.address)) -ne 'LanguageDefine'){throw 'Language object changed'}
 $f=Fields (ObjectClass $o.address);$languages+=ManagedString (Ptr ($o.address+$f['<LanguageCode>k__BackingField'].offset))
}
$languages=@($languages|Sort-Object -Unique)
if($languages.Count -ne 13 -or $languages -notcontains 'zh-Hans'){throw 'Unexpected language coverage'}
$languages|Set-Content "$root/artifacts/catalog-languages.txt" -Encoding utf8NoBOM
if(-not ('MonoCatalogBridge' -as [type])){Add-Type -Path "$PSScriptRoot/MonoCatalogBridge.cs"}
$exports=[Collections.Generic.Dictionary[string,uint32]]::new()
$exports['mono_get_root_domain']=0x275f80;$exports['mono_thread_attach']=0x2f87d0;$exports['mono_thread_detach']=0x2f8e90
$exports['mono_domain_assembly_open']=0x2e7c50;$exports['mono_assembly_get_image']=0x2780e0;$exports['mono_class_from_name']=0x27f090
$exports['mono_class_get_method_from_name']=0x281740;$exports['mono_runtime_invoke']=0x2ee550
$result=[ordered]@{pid=$Child.Id;mode='managed-config-getters-on-game-thread';at=[DateTimeOffset]::Now.ToString('o');languages=$languages}
try{$result.bootstrap=[MonoCatalogBridge]::Start($Child.Handle,[uint32]$Child.Id,$PayloadPath,$runtimePath,$exports)}catch{$result.error=$_.Exception.GetBaseException().Message}
$result|ConvertTo-Json|Set-Content "$root/artifacts/catalog-bootstrap.json"

$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
if($PSVersionTable.PSVersion.Major -lt 7){throw 'PowerShell 7 required'}
$current=[Diagnostics.Process]::GetCurrentProcess()
$output=Join-Path $root 'artifacts/startup-clr-self.json'
& (Join-Path $root 'research/tools/Inspect-StartupClr.ps1') -Child ([pscustomobject]@{Id=$PID;Handle=$current.Handle}) -Destination $output -DacPath (Join-Path $PSHOME 'mscordaccore.dll') -SkipHeapInspection
$result=Get-Content $output -Raw|ConvertFrom-Json
if($result.stage -ne 'dac-loaded' -or $result.debugExports.g_dacTable -eq '0x0'){throw ('Startup CLR reader self test failed: '+$result.error)}
if($result.complete){throw 'Diagnostic probe must not claim a complete export'}
'Startup CLR reader: self process module enumeration, export lookup and DAC initialization passed'

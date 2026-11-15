param([string]$Path,[string]$OutputPath)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if(-not $Path){$Path=Join-Path $root 'artifacts\managed-heap.gcdump'}
if(-not $OutputPath){$OutputPath=Join-Path $root 'artifacts\achievement-object-graph.tsv'}
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Use PowerShell 7 for offline heap graph inspection'}
$directory=Join-Path $root '.tools\gcdump-package\tools\net8.0\any'
Get-ChildItem -LiteralPath $directory -Filter '*.dll' | ForEach-Object {try{[void][Reflection.Assembly]::LoadFrom($_.FullName)}catch{}}
Add-Type -Path (Join-Path $PSScriptRoot 'InspectHeapGraph.cs') -CompilerOptions '/nowarn:1701,1702' -ReferencedAssemblies @((Join-Path $directory 'dotnet-gcdump.dll'),(Join-Path $directory 'Microsoft.Diagnostics.FastSerialization.dll'),'System.Collections','System.Runtime')
[InspectHeapGraph]::Inspect((Resolve-Path -LiteralPath $Path).Path) | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host ('Saved object graph evidence: '+$OutputPath)

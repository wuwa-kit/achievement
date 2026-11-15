param(
    [string]$TracePath,
    [string]$OutputPath,
    [string]$LibraryDirectory
)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if(-not $TracePath){$TracePath=Join-Path $root 'artifacts\runtime-metadata.nettrace'}
if(-not $OutputPath){$OutputPath=Join-Path $root 'artifacts\managed-methods.json'}
if(-not $LibraryDirectory){$LibraryDirectory=Join-Path $root '.tools\traceevent\lib\netstandard2.0'}
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Trace parsing requires PowerShell 7 and TraceEvent 3.2.8 dependencies; launch/probe do not.'}
Add-Type -Path (Join-Path $LibraryDirectory 'Microsoft.Diagnostics.FastSerialization.dll')
Add-Type -Path (Join-Path $LibraryDirectory 'Microsoft.Diagnostics.Tracing.TraceEvent.dll')
$source=[Microsoft.Diagnostics.Tracing.EventPipeEventSource]::new((Resolve-Path -LiteralPath $TracePath).Path)
$parser=[Microsoft.Diagnostics.Tracing.Parsers.Clr.ClrRundownTraceEventParser]::new($source)
$rows=[Collections.Generic.List[object]]::new()
$parser.add_All({param($e)
    if($e.EventName -match 'Method.*Verbose') {
        $values=[ordered]@{event=$e.EventName}
        foreach($name in $e.PayloadNames){$values[$name]=$e.PayloadByName($name)}
        if(($values|ConvertTo-Json -Compress) -match 'Achievement'){$rows.Add([pscustomobject]$values)}
    }
})
try { [void]$source.GetType().GetMethod('Process').Invoke($source,@()) } finally { $source.Dispose() }
ConvertTo-Json -InputObject @($rows.ToArray()) -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Host ('Saved '+$rows.Count+' achievement-related method records. Addresses are valid only for the captured process.')

param(
    [Parameter(Mandatory=$true)][string]$LogPath,
    [Parameter(Mandatory=$true)][string]$OutputDirectory
)
$ErrorActionPreference='Stop'
if (-not ('LogEvidence' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'LogEvidence.cs') }
$source = (Resolve-Path -LiteralPath $LogPath).Path
$lines = @([LogEvidence]::Find($source))
$events = @()
foreach ($line in $lines) {
    if ($line -match '^\[(?<time>[^\]]+)\].*\[Achievement\].*OnAchievementGroupProgressNotify \[id: (?<id>\d+)\]\[currentState: (?<state>\w+)\]') {
        $events += [ordered]@{id=[int]$Matches.id;observedAt=$Matches.time;rawState=$Matches.state}
    }
}
$report = [ordered]@{
    schemaVersion=1;dataSource='game-log-events';complete=$false;accountAttribution='not-verified'
    sourceFile=[IO.Path]::GetFileName($source);capturedAt=[DateTimeOffset]::Now.ToString('o')
    note='Incremental observations only. Not a full achievement snapshot. observedAt is not completion time. May include different login sessions; do not merge as account state.'
    eventCount=$events.Count;events=$events
}
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$path=Join-Path $OutputDirectory 'achievement-events.json'
$temp=$path+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
try {
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $temp -Encoding UTF8
    Move-Item -LiteralPath $temp -Destination $path -Force
} finally { if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp} }
Write-Host ('Saved '+$events.Count+' incremental observations to '+$path+'. NOT a complete export.')

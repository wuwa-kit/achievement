$ErrorActionPreference='Stop'
$root=Split-Path (Split-Path $PSScriptRoot)
$result=[ordered]@{at=[DateTimeOffset]::Now.ToString('o');success=$false}
$reader=$null
try {
 $session=Get-Content "$root/artifacts/early-session.json" -Raw|ConvertFrom-Json
 $game=Get-Process -Id $session.pid
 $helper=Get-Process -Id $session.helperPid
 if($game.ProcessName -ne 'Client-Win64-Shipping' -or $helper.ProcessName -ne 'powershell' -or [Math]::Abs(($game.StartTime-([datetimeoffset]$session.startedAt).LocalDateTime).TotalSeconds) -gt 10){throw 'Session mismatch'}
 Add-Type -Path "$PSScriptRoot/RetainedReader.cs"
 $reader=[RetainedReader]::new($session.helperPid,$session.pid)
 $result.header=[BitConverter]::ToString($reader.Read(0x140000000,2))
 $result.success=$result.header -eq '4D-5A'
}catch{$result.error=$_.Exception.GetBaseException().Message}
finally{if($reader){$reader.Dispose()};$result|ConvertTo-Json|Set-Content "$root/artifacts/retained-reader.json"}

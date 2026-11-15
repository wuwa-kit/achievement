function Get-WuwaQuality([string]$GamePath, [string]$Requested = 'auto') {
    if ($Requested -in @('sd','hd','uhd')) { return $Requested }
    $gameDirectory = Split-Path -Parent $GamePath
    $stateFile = Join-Path (Split-Path -Parent $gameDirectory) 'kr_game_cache\platform_ui_state.bin'
    if (Test-Path -LiteralPath $stateFile) {
        try {
            $bytes = [Convert]::FromBase64String([IO.File]::ReadAllText($stateFile))
            for ($i=0; $i -lt $bytes.Length; $i++) { $bytes[$i] = $bytes[$i] -bxor 0x63 }
            $state = [Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF) | ConvertFrom-Json
            $scopes = @()
            if ($state.PSObject.Properties['activeGameScope'] -and $state.activeGameScope.gameIdentity -eq 'Aki') { $scopes += $state.activeGameScope }
            if ($state.PSObject.Properties['recentGames'] -and $state.recentGames.PSObject.Properties['Aki']) { $scopes += $state.recentGames.Aki }
            foreach ($scope in $scopes) {
                if ($scope.PSObject.Properties['bundleName'] -and $scope.bundleName -in @('sd','hd','uhd')) { return $scope.bundleName.ToLowerInvariant() }
            }
        } catch { Write-Verbose ('Cannot read launcher selection: '+$_.Exception.Message) }
    }
    $manifestFile = Join-Path $gameDirectory 'launcherDownloadConfig.json'
    if (Test-Path -LiteralPath $manifestFile) {
        try {
            $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
            $choices = @($manifest.bundles.PSObject.Properties.Name | Where-Object { $_ -in @('sd','hd','uhd') })
            if ($choices.Count -eq 1) { return $choices[0].ToLowerInvariant() }
        } catch { Write-Verbose $_.Exception.Message }
    }
    throw 'Cannot determine installed resource quality. Specify -Quality sd, hd or uhd; no quality is guessed.'
}

function Test-WuwaAdministrator {
    return [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-WuwaSession([string]$GamePath,[string]$Quality,[string]$OutputDirectory) {
    if (@(Get-Process -Name Client-Win64-Shipping -ErrorAction SilentlyContinue).Count -gt 0) {
        throw 'Game already running. Use Probe -GameProcessId <PID>; an existing game is not owned by this invocation.'
    }
    $qualityName = Get-WuwaQuality $GamePath $Quality
    $started = [DateTimeOffset]::Now
    $bootstrap = Start-Process -FilePath $GamePath -ArgumentList ('-krqlv='+$qualityName) -WorkingDirectory (Split-Path -Parent $GamePath) -PassThru
    $expected = Join-Path (Split-Path -Parent $GamePath) 'Client\Binaries\Win64\Client-Win64-Shipping.exe'
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    $candidate = $null
    do {
        $matches = @(Get-CimInstance Win32_Process -Filter "Name='Client-Win64-Shipping.exe'" | Where-Object {
            $_.ParentProcessId -eq $bootstrap.Id -and $_.CreationDate -ge $started.LocalDateTime.AddSeconds(-2)
        })
        if ($matches.Count -eq 1) { $candidate = $matches[0]; break }
        Start-Sleep -Milliseconds 300
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $candidate) { throw 'No matching game child process appeared within 60 seconds. Check the game error window.' }
    if ($candidate.ExecutablePath -and $candidate.ExecutablePath -ne $expected) { throw 'Child executable path mismatch' }
    $session = [ordered]@{
        schemaVersion=1;bootstrapPid=$bootstrap.Id;gamePid=$candidate.ProcessId
        gameStartedAt=$candidate.CreationDate.ToString('o');launchedAt=$started.ToString('o')
        expectedGamePath=$expected;observedGamePath=$candidate.ExecutablePath;quality=$qualityName
        completeExport=$false;automaticCloseAllowed=$false
    }
    $session | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'session.json') -Encoding UTF8
    Write-Host ('Game started, PID '+$candidate.ProcessId+'. Please log in. This is not an achievement export.')
}

param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$gameRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$gameListener = $null
$gamePort = 5173
foreach ($candidatePort in 5173..5183) {
    try {
        $gameListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
        $gameListener.Start()
        $gamePort = $candidatePort
        break
    } catch { $gameListener = $null }
}
if ($null -eq $gameListener) { Write-Host 'Ports 5173-5183 are busy. Close an earlier game window and try again.'; Read-Host 'Press Enter'; exit 1 }
$gameUrl = "http://127.0.0.1:$gamePort/"
Write-Host ''
Write-Host '  LAKESIDE / V0.1' -ForegroundColor Green
Write-Host "  $gameUrl"
Write-Host '  Keep this window open while playing. Close it to stop.'
Write-Host '  Right mouse drag: look / R: reset / F: fullscreen'
Write-Host ''
if (-not $NoBrowser) { Start-Process $gameUrl }
$gameMimeTypes = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.svg'='image/svg+xml'; '.png'='image/png' }
try {
    while ($true) {
        $gameClient = $gameListener.AcceptTcpClient()
        try {
            $gameClient.ReceiveTimeout = 2000
            $gameStream = $gameClient.GetStream()
            $gameReader = [System.IO.StreamReader]::new($gameStream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $gameRequest = $gameReader.ReadLine()
            if ([string]::IsNullOrEmpty($gameRequest)) { continue }
            while (-not [string]::IsNullOrEmpty($gameReader.ReadLine())) { }
            $gameParts = $gameRequest.Split(' ')
            $gamePath = [System.Uri]::UnescapeDataString($gameParts[1].Split('?')[0])
            if ($gamePath -eq '/') { $gamePath = '/index.html' }
            $gameFile = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($gameRoot, $gamePath.TrimStart('/').Replace('/', '\')))
            $gameExt = [System.IO.Path]::GetExtension($gameFile).ToLowerInvariant()
            $gameSafe = $gameFile.StartsWith($gameRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and $gameMimeTypes.ContainsKey($gameExt) -and $gamePath -notmatch '(^|[/\\])\.'
            $gameStatus = '200 OK'
            $gameType = 'text/plain; charset=utf-8'
            if (-not $gameSafe) { $gameStatus = '403 Forbidden'; $gameBytes = [System.Text.Encoding]::UTF8.GetBytes('Forbidden') }
            elseif (-not [System.IO.File]::Exists($gameFile)) { $gameStatus = '404 Not Found'; $gameBytes = [System.Text.Encoding]::UTF8.GetBytes('Not found') }
            else { $gameBytes = [System.IO.File]::ReadAllBytes($gameFile); $gameType = $gameMimeTypes[$gameExt] }
            $gameHeader = "HTTP/1.1 $gameStatus`r`nContent-Type: $gameType`r`nContent-Length: $($gameBytes.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
            $gameHeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($gameHeader)
            $gameStream.Write($gameHeaderBytes, 0, $gameHeaderBytes.Length)
            if ($gameParts[0] -ne 'HEAD') { $gameStream.Write($gameBytes, 0, $gameBytes.Length) }
            $gameStream.Flush()
        } catch { } finally { $gameClient.Dispose() }
    }
} finally { $gameListener.Stop() }

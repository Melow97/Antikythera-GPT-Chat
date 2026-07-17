# Diagnose why localhost:3000 is erroring — run from the project folder.
#
# Usage:
#   cd "C:\path\to\your\Antikythera-GPT-Chat"
#   .\diagnose-server.ps1
#
# This doesn't fix anything by itself — it narrows down WHERE the problem is so we know
# what to fix. Paste the full output back and include whatever error text/screenshot you're
# seeing in the browser or in the "npm start" window.

Write-Host "=== 1. Is something already listening on port 3000? ===" -ForegroundColor Cyan
$portCheck = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portCheck) {
    $portCheck | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "Something IS listening on port 3000 — PID $($_.OwningProcess) ($($proc.ProcessName))" -ForegroundColor Yellow
    }
    Write-Host "  -> If this isn't your 'npm start' window, that's likely the problem:" -ForegroundColor Yellow
    Write-Host "     either a second copy is already running, or another app is using port 3000." -ForegroundColor Yellow
    Write-Host "     Stop the extra process, or set PORT=3001 (or similar) in .env and use that port instead." -ForegroundColor Yellow
} else {
    Write-Host "Nothing is listening on port 3000." -ForegroundColor Red
    Write-Host "  -> This means the server isn't actually running right now." -ForegroundColor Yellow
    Write-Host "     Go to the PowerShell window where you ran 'npm start' and look for a red error message" -ForegroundColor Yellow
    Write-Host "     just above where it stopped — paste that text back, it'll say exactly what crashed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 2. Does node_modules exist? (needed to even start) ===" -ForegroundColor Cyan
if (Test-Path ".\node_modules") {
    Write-Host "OK — node_modules folder exists." -ForegroundColor Green
} else {
    Write-Host "MISSING — node_modules folder not found." -ForegroundColor Red
    Write-Host "  -> Run: npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 3. Does .env exist? ===" -ForegroundColor Cyan
if (Test-Path ".\.env") {
    Write-Host "OK — .env exists." -ForegroundColor Green
} else {
    Write-Host "MISSING — no .env file." -ForegroundColor Red
    Write-Host "  -> Run: Copy-Item .env.example .env   then fill in the values you need." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 4. Basic syntax check on the server's JS files ===" -ForegroundColor Cyan
$jsFiles = @("server.js") + (Get-ChildItem -Path ".\routes" -Filter "*.js" -ErrorAction SilentlyContinue | ForEach-Object { "routes\$($_.Name)" })
$anyBad = $false
foreach ($f in $jsFiles) {
    if (-not (Test-Path $f)) { continue }
    $check = node --check $f 2>&1
    if ($LASTEXITCODE -ne 0) {
        $anyBad = $true
        Write-Host "SYNTAX ERROR in $f" -ForegroundColor Red
        Write-Host $check -ForegroundColor Red
    }
}
if (-not $anyBad) {
    Write-Host "OK — no syntax errors found in server.js or routes\*.js" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 5. Can we reach it right now? ===" -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 5
    Write-Host "Server responded with HTTP $($resp.StatusCode) — it IS up." -ForegroundColor Green
    Write-Host "  -> If the browser still shows an error, it may be a browser-side issue" -ForegroundColor Yellow
    Write-Host "     (cached page, wrong URL, etc.) rather than the server. Try a hard refresh" -ForegroundColor Yellow
    Write-Host "     (Ctrl+F5) or an incognito window." -ForegroundColor Yellow
} catch {
    Write-Host "Could not reach http://localhost:3000/ right now." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Next step ===" -ForegroundColor Cyan
Write-Host "Paste back: this script's full output, PLUS whatever error text/message you see" -ForegroundColor Cyan
Write-Host "in the browser tab and/or in the 'npm start' terminal window." -ForegroundColor Cyan

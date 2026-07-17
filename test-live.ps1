# Live test for Antikythera GPT Chat — run this from the project folder while the server
# is running (npm start) in another PowerShell window.
#
# Usage:
#   cd "C:\path\to\your\Antikythera-GPT-Chat"
#   .\test-live.ps1
#
# IMPORTANT: only type/paste the command itself, e.g. ".\test-live.ps1" — do NOT include
# the leading "PS C:\...\> " prompt text shown before your cursor. PowerShell treats "PS"
# as a shortcut for Get-Process, so pasting the whole prompt line causes a confusing
# "positional parameter" error that has nothing to do with this script.
#
# It checks, in order: the Node server, your local Ollama install (if used), and your
# Ollama API key directly against the real web search API. Paste the full output back
# if anything fails and it'll be clear which step to fix.

Write-Host "=== 1. Is the Node server responding? ===" -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 5
    Write-Host "OK — server responded with HTTP $($resp.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "FAILED — could not reach http://localhost:3000/" -ForegroundColor Red
    Write-Host "  -> Is 'npm start' still running in its own window? Check that window for errors." -ForegroundColor Yellow
    Write-Host "  -> Stopping here since nothing else will work without the server up." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== 2. Is Ollama running locally? ===" -ForegroundColor Cyan
try {
    $ollamaResp = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 5
    Write-Host "OK — local Ollama is running and responded with HTTP $($ollamaResp.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Not responding on localhost:11434." -ForegroundColor Yellow
    Write-Host "  -> This is fine ONLY if you deliberately set OLLAMA_API_KEY + no OLLAMA_BASE_URL override" -ForegroundColor Yellow
    Write-Host "     to route chat through Ollama Cloud instead. Otherwise, run 'ollama serve'." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 3. Reading OLLAMA_API_KEY from .env ===" -ForegroundColor Cyan
$envPath = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envPath)) {
    Write-Host "FAILED — no .env file found at $envPath" -ForegroundColor Red
    Write-Host "  -> Run: Copy-Item .env.example .env   then edit it and re-run this script." -ForegroundColor Yellow
    exit 1
}

$envLines = Get-Content $envPath
$apiKeyLine = $envLines | Where-Object { $_ -match '^OLLAMA_API_KEY=' }
$apiKey = if ($apiKeyLine) { ($apiKeyLine -split '=', 2)[1].Trim() } else { "" }

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "FAILED — OLLAMA_API_KEY is blank in .env" -ForegroundColor Red
    Write-Host "  -> Get a free key at https://ollama.com/settings/keys and paste it into .env, then restart 'npm start'." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "OK — found a key in .env (not printing it here for safety)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 4. Testing that key directly against Ollama's web search API ===" -ForegroundColor Cyan
try {
    $searchResp = Invoke-RestMethod -Uri "https://ollama.com/api/web_search" `
        -Method Post `
        -Headers @{ Authorization = "Bearer $apiKey" } `
        -ContentType "application/json" `
        -Body '{"query":"what is ollama","max_results":3}' `
        -TimeoutSec 15

    if ($searchResp.results -and $searchResp.results.Count -gt 0) {
        Write-Host "OK — got $($searchResp.results.Count) real search result(s) back:" -ForegroundColor Green
        foreach ($r in $searchResp.results) {
            Write-Host "  - $($r.title)  ($($r.url))"
        }
    } else {
        Write-Host "Got a response but no results — unexpected. Raw response:" -ForegroundColor Yellow
        $searchResp | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host "FAILED — the key didn't work against Ollama's API." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "  -> 401/403 means the key is wrong/incomplete — recopy it from ollama.com/settings/keys" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== All checks passed ===" -ForegroundColor Green
Write-Host "Now test it end-to-end in the browser:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000 and sign in"
Write-Host "  2. Click the 'Web search' button in the composer so it highlights active"
Write-Host "  3. Ask something time-sensitive, e.g. 'What's today's date and any major news?'"
Write-Host "  4. You should see 'Searching the web...' appear briefly before the answer"

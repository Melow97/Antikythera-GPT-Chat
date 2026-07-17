# Run this with:  .\run-everything.ps1
# IMPORTANT: run it from an already-open PowerShell window, after cd-ing into your
# "Antikythera GPT Chat" folder yourself. Do NOT double-click this file or use right-click
# -> "Run with PowerShell" — Windows launches those with C:\WINDOWS\system32 as the working
# folder instead of wherever this file actually is, which breaks everything below silently.
#
# Correct way to run it:
#   cd "$env:USERPROFILE\Desktop\Antikythera GPT Chat"
#   .\run-everything.ps1
#
# Does everything in one go: finds the update zip, extracts it, moves into the
# extracted 'project' folder, and runs the live test.

# Safety check: refuse to run somewhere obviously wrong (like System32).
$here = (Get-Location).Path
if ($here -match 'system32' -or $here -notmatch 'Antikythera') {
    Write-Host "STOPPING — current folder looks wrong: $here" -ForegroundColor Red
    Write-Host "This should be run from your 'Antikythera GPT Chat' folder, not here." -ForegroundColor Yellow
    Write-Host "Run this first, then try again:" -ForegroundColor Yellow
    Write-Host '  cd "$env:USERPROFILE\Desktop\Antikythera GPT Chat"' -ForegroundColor Cyan
    exit 1
}
Write-Host "Working folder looks right: $here" -ForegroundColor Green

$zip = Get-ChildItem -Path "$env:USERPROFILE\Downloads","$env:USERPROFILE\Desktop" `
    -Filter "antikythera-gpt-chat-updated.zip" -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1

if (-not $zip) {
    Write-Host "Could not find antikythera-gpt-chat-updated.zip in Downloads or Desktop." -ForegroundColor Red
    Write-Host "Double-check it downloaded, then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Found zip: $($zip.FullName)" -ForegroundColor Green
Expand-Archive -Path $zip.FullName -DestinationPath (Get-Location) -Force
Write-Host "Extracted." -ForegroundColor Green

if (-not (Test-Path ".\project")) {
    Write-Host "Extraction finished but no 'project' folder appeared — stopping here." -ForegroundColor Red
    Write-Host "Here's what's in the current folder now:" -ForegroundColor Yellow
    Get-ChildItem
    exit 1
}

Set-Location ".\project"
Write-Host ""
Write-Host "Now in: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Running the live test..." -ForegroundColor Cyan
Write-Host ""

.\test-live.ps1

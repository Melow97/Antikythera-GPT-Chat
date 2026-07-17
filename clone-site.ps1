<#
.SYNOPSIS
    Clones the visual design of a webpage into a standalone HTML/CSS project.

.DESCRIPTION
    Thin wrapper around clone-site.js. Resolves the output directory and API key, forwards
    to Node (which drives Playwright for the screenshot/DOM capture and calls the chosen
    AI provider to rebuild the design), and optionally opens the result.

.PARAMETER Url
    The page to clone.

.PARAMETER OutDir
    Where to write the clone. Defaults to .\clones\<host>-<timestamp>.

.PARAMETER Provider
    "openai" (default, vision-capable — sends the screenshot) or "deepseek" (text-only —
    reconstructs from the DOM alone, since DeepSeek's chat API does not accept images).

.PARAMETER ApiKey
    API key for the chosen provider. Defaults to $env:OPENAI_API_KEY or $env:DEEPSEEK_API_KEY
    depending on -Provider.

.PARAMETER Model
    Model to use. Defaults to gpt-4o for openai, deepseek-chat for deepseek.

.PARAMETER Open
    Open the resulting index.html in your default browser when done.

.PARAMETER Tagline
    Optional replacement for the page's main headline/hero tagline (e.g. "Make AI work for you").
    Every other section keeps its original wording.

.EXAMPLE
    .\clone-site.ps1 -Url "https://example.com" -Open

.EXAMPLE
    .\clone-site.ps1 -Url "https://example.com" -Provider deepseek -Tagline "Make AI work for you" -Open
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Url,

    [string]$OutDir,

    [ValidateSet("openai", "deepseek")]
    [string]$Provider = "openai",

    [string]$ApiKey,

    [string]$Model,

    [int]$WindowWidth = 1440,
    [int]$WindowHeight = 1800,

    [string]$Tagline,

    [switch]$Open
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is required but was not found on PATH."
}

if (-not $ApiKey) {
    $envVarName = if ($Provider -eq "deepseek") { "DEEPSEEK_API_KEY" } else { "OPENAI_API_KEY" }
    $ApiKey = [Environment]::GetEnvironmentVariable($envVarName, "Process")
    if (-not $ApiKey) {
        Write-Error "No API key found. Set `$env:$envVarName or pass -ApiKey."
    }
}

if (-not $OutDir) {
    $hostName = ([uri]$Url).Host -replace '[^a-zA-Z0-9\.]', '_'
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutDir = Join-Path (Join-Path $PSScriptRoot "clones") "$hostName-$stamp"
}

$nodeScript = Join-Path $PSScriptRoot "clone-site.js"

$nodeArgs = @("--url", $Url, "--out-dir", $OutDir, "--provider", $Provider, "--api-key", $ApiKey, "--width", $WindowWidth, "--height", $WindowHeight)
if ($Model) {
    $nodeArgs += @("--model", $Model)
}
if ($Tagline) {
    $nodeArgs += @("--tagline", $Tagline)
}

& node $nodeScript @nodeArgs
$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    Write-Error "clone-site.js failed with exit code $exitCode."
}

if ($Open) {
    $indexPath = Join-Path $OutDir "index.html"
    if (Test-Path $indexPath) {
        Start-Process $indexPath
    }
}

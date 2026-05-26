# AI Trading Workstation — Start Script (Windows PowerShell)
param(
    [switch]$Build
)

$ErrorActionPreference = "Stop"

$ImageName    = "ai-trading-workstation"
$ContainerName = "ai-trading-workstation"
$VolumeName   = "ai-trading-workstation-data"
$Port         = 8000

# Run from the repo root (parent of the scripts/ directory)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
Set-Location $RepoRoot

# Build the image if -Build flag is passed or if the image doesn't exist
docker image inspect $ImageName 2>&1 | Out-Null
if ($Build -or $LASTEXITCODE -ne 0) {
    Write-Host "Building Docker image '$ImageName'..."
    docker build -t $ImageName .
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker build failed."
        exit 1
    }
}

# Exit early if the container is already running
$running = docker ps -q --filter "name=^${ContainerName}$"
if ($running) {
    Write-Host "Container '$ContainerName' is already running."
    Write-Host "Access the app at: http://localhost:$Port"
    exit 0
}

# Remove any stopped container with the same name
$stopped = docker ps -aq --filter "name=^${ContainerName}$"
if ($stopped) {
    docker rm $ContainerName | Out-Null
}

# Build docker run arguments
$RunArgs = @(
    "run", "-d",
    "--name", $ContainerName,
    "-v", "${VolumeName}:/app/db",
    "-p", "${Port}:${Port}"
)

if (Test-Path ".env") {
    $RunArgs += "--env-file", ".env"
} else {
    Write-Warning ".env file not found. Copy .env.example to .env and fill in your API keys."
}

$RunArgs += $ImageName

Write-Host "Starting AI Trading Workstation..."
& docker @RunArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start container."
    exit 1
}

Write-Host ""
Write-Host "AI Trading Workstation is running at: http://localhost:$Port"
Write-Host ""

$open = Read-Host "Open in browser? [y/N]"
if ($open -match "^[Yy]$") {
    Start-Process "http://localhost:$Port"
}

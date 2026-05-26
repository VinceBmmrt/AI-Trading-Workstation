# AI Trading Workstation — Stop Script (Windows PowerShell)

$ContainerName = "ai-trading-workstation"

# Stop the running container
$running = docker ps -q --filter "name=^${ContainerName}$"
if ($running) {
    Write-Host "Stopping container '$ContainerName'..."
    docker stop $ContainerName | Out-Null
} else {
    Write-Host "Container '$ContainerName' is not running."
}

# Remove the stopped container (volume is preserved)
$exists = docker ps -aq --filter "name=^${ContainerName}$"
if ($exists) {
    Write-Host "Removing container '$ContainerName'..."
    docker rm $ContainerName | Out-Null
    Write-Host "Done. Data volume 'ai-trading-workstation-data' is preserved."
} else {
    Write-Host "No container '$ContainerName' found to remove."
}

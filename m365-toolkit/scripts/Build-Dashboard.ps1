#Requires -Version 7.0
<#
.SYNOPSIS
    Builds the dashboard by copying data files and optionally opening in browser.

.DESCRIPTION
    Copies all JSON data files from the data/ directory to the dashboard/data/
    directory and creates a manifest file. Optionally opens the dashboard in
    the default browser.

.PARAMETER NoBrowser
    If specified, does not open the dashboard in the browser.

.EXAMPLE
    .\Build-Dashboard.ps1
    Copies data and opens dashboard in browser.

.EXAMPLE
    .\Build-Dashboard.ps1 -NoBrowser
    Copies data without opening browser.
#>

[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

# Get paths
$scriptPath = $PSScriptRoot
$rootPath = Split-Path -Parent $scriptPath
$dataPath = Join-Path -Path $rootPath -ChildPath "data"
$dashboardDataPath = Join-Path -Path $rootPath -ChildPath "dashboard/data"
$dashboardPath = Join-Path -Path $rootPath -ChildPath "dashboard/index.html"

Write-Host ""
Write-Host "Building M365 Tenant Toolkit Dashboard" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if data directory exists
if (-not (Test-Path -Path $dataPath)) {
    Write-Host "Error: Data directory not found at $dataPath" -ForegroundColor Red
    Write-Host "Please run Invoke-DataCollection.ps1 first to collect data." -ForegroundColor Yellow
    exit 1
}

# Create dashboard data directory if needed
if (-not (Test-Path -Path $dashboardDataPath)) {
    New-Item -Path $dashboardDataPath -ItemType Directory -Force | Out-Null
    Write-Host "Created dashboard data directory" -ForegroundColor Gray
}

# Get list of JSON files to copy
$jsonFiles = Get-ChildItem -Path $dataPath -Filter "*.json" -File

if ($jsonFiles.Count -eq 0) {
    Write-Host "Warning: No JSON files found in data directory" -ForegroundColor Yellow
    Write-Host "Please run Invoke-DataCollection.ps1 first to collect data." -ForegroundColor Yellow
}

# Copy each JSON file
$copiedFiles = @()
foreach ($file in $jsonFiles) {
    $destPath = Join-Path -Path $dashboardDataPath -ChildPath $file.Name
    Copy-Item -Path $file.FullName -Destination $destPath -Force
    $copiedFiles += $file.Name
    Write-Host "  Copied: $($file.Name)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Copied $($copiedFiles.Count) data files to dashboard" -ForegroundColor Green

# Create manifest file
$manifest = @{
    generatedAt = (Get-Date).ToString('o')
    files       = $copiedFiles
    version     = "1.0.0"
}

$manifestPath = Join-Path -Path $dashboardDataPath -ChildPath "manifest.json"
$manifest | ConvertTo-Json | Out-File -FilePath $manifestPath -Encoding utf8
Write-Host "  Created: manifest.json" -ForegroundColor Gray

# Open dashboard in browser
if (-not $NoBrowser) {
    Write-Host ""
    Write-Host "Opening dashboard in browser..." -ForegroundColor Cyan

    if ($IsWindows -or $env:OS -match 'Windows') {
        Start-Process $dashboardPath
    }
    elseif ($IsMacOS) {
        & open $dashboardPath
    }
    elseif ($IsLinux) {
        & xdg-open $dashboardPath 2>/dev/null || & sensible-browser $dashboardPath 2>/dev/null
    }

    Write-Host "Dashboard opened: $dashboardPath" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Dashboard ready at: $dashboardPath" -ForegroundColor Green
    Write-Host "Open this file in a web browser to view the dashboard." -ForegroundColor Gray
}

Write-Host ""

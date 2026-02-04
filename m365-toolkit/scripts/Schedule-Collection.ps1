#Requires -Version 7.0
<#
.SYNOPSIS
    Creates a Windows scheduled task for automatic data collection.

.DESCRIPTION
    Sets up a Windows Task Scheduler task to run the data collection
    script on a regular schedule (daily by default).

.PARAMETER Schedule
    Frequency of collection: Daily, Weekly, or Manual
    Default: Daily

.PARAMETER Time
    Time to run the collection (24-hour format)
    Default: 06:00

.PARAMETER Remove
    Remove the existing scheduled task instead of creating one.

.EXAMPLE
    .\Schedule-Collection.ps1
    Creates a daily task at 6:00 AM.

.EXAMPLE
    .\Schedule-Collection.ps1 -Schedule Weekly -Time "07:30"
    Creates a weekly task at 7:30 AM.

.EXAMPLE
    .\Schedule-Collection.ps1 -Remove
    Removes the scheduled task.

.NOTES
    Requires administrator privileges to create scheduled tasks.
    Windows only - will display instructions for other platforms.
#>

[CmdletBinding()]
param(
    [ValidateSet('Daily', 'Weekly', 'Manual')]
    [string]$Schedule = 'Daily',

    [ValidatePattern('^\d{2}:\d{2}$')]
    [string]$Time = '06:00',

    [switch]$Remove
)

$ErrorActionPreference = 'Stop'

$taskName = "M365 Tenant Toolkit - Data Collection"
$scriptPath = $PSScriptRoot
$rootPath = Split-Path -Parent $scriptPath
$collectionScript = Join-Path -Path $rootPath -ChildPath "Invoke-DataCollection.ps1"

Write-Host ""
Write-Host "M365 Tenant Toolkit - Schedule Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if running on Windows
if (-not ($IsWindows -or $env:OS -match 'Windows')) {
    Write-Host "Scheduled tasks are only supported on Windows." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For other platforms, set up a cron job or launchd task manually:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Linux (cron):" -ForegroundColor White
    Write-Host "  crontab -e" -ForegroundColor Gray
    Write-Host "  0 6 * * * /usr/bin/pwsh $collectionScript" -ForegroundColor Gray
    Write-Host ""
    Write-Host "macOS (launchd):" -ForegroundColor White
    Write-Host "  Create a plist file in ~/Library/LaunchAgents/" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# Check for admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Warning: Creating scheduled tasks typically requires administrator privileges." -ForegroundColor Yellow
    Write-Host "The task will be created for the current user only." -ForegroundColor Yellow
    Write-Host ""
}

# Remove existing task if requested
if ($Remove) {
    try {
        $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            Write-Host "Scheduled task removed successfully." -ForegroundColor Green
        }
        else {
            Write-Host "No scheduled task found with name: $taskName" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "Error removing scheduled task: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 0
}

# Verify collection script exists
if (-not (Test-Path -Path $collectionScript)) {
    Write-Host "Error: Collection script not found at $collectionScript" -ForegroundColor Red
    exit 1
}

# Parse time
$timeParts = $Time -split ':'
$hour = [int]$timeParts[0]
$minute = [int]$timeParts[1]

# Create the scheduled task
try {
    # Remove existing task if present
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Write-Host "Removing existing scheduled task..." -ForegroundColor Gray
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }

    # Build the action
    $pwshPath = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
    if (-not $pwshPath) {
        $pwshPath = "pwsh"
    }

    $action = New-ScheduledTaskAction -Execute $pwshPath -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$collectionScript`"" -WorkingDirectory $rootPath

    # Build the trigger
    $trigger = switch ($Schedule) {
        'Daily' {
            New-ScheduledTaskTrigger -Daily -At "$($hour):$($minute)"
        }
        'Weekly' {
            New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "$($hour):$($minute)"
        }
        'Manual' {
            # Create a trigger that never fires automatically
            New-ScheduledTaskTrigger -Once -At (Get-Date).AddYears(100)
        }
    }

    # Build settings
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

    # Build principal (run as current user)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

    # Register the task
    $task = Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Collects M365 tenant data for the M365 Tenant Toolkit dashboard"

    Write-Host "Scheduled task created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  Name:      $taskName" -ForegroundColor White
    Write-Host "  Schedule:  $Schedule at $Time" -ForegroundColor White
    Write-Host "  Script:    $collectionScript" -ForegroundColor White
    Write-Host ""

    if ($Schedule -eq 'Manual') {
        Write-Host "The task is set to manual trigger. To run it:" -ForegroundColor Yellow
        Write-Host "  1. Open Task Scheduler" -ForegroundColor Gray
        Write-Host "  2. Find '$taskName'" -ForegroundColor Gray
        Write-Host "  3. Right-click and select 'Run'" -ForegroundColor Gray
    }
    else {
        Write-Host "The task will run automatically according to the schedule." -ForegroundColor Gray
        Write-Host "You can also run it manually from Task Scheduler." -ForegroundColor Gray
    }
    Write-Host ""
}
catch {
    Write-Host "Error creating scheduled task: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can create the task manually:" -ForegroundColor Yellow
    Write-Host "  1. Open Task Scheduler (taskschd.msc)" -ForegroundColor Gray
    Write-Host "  2. Create a new task" -ForegroundColor Gray
    Write-Host "  3. Set the action to run: pwsh -File `"$collectionScript`"" -ForegroundColor Gray
    Write-Host "  4. Set your preferred schedule" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

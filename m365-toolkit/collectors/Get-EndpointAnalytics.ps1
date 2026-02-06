# ============================================================================
# TenantScope
# Author: Robel (https://github.com/Thugney)
# Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
# License: MIT
# ============================================================================

<#
.SYNOPSIS
    Collects Endpoint Analytics device health and performance data.

.DESCRIPTION
    Retrieves Endpoint Analytics scores and metrics including startup
    performance, application reliability, and device health scores.
    Enables proactive device health management.

    Graph API endpoints:
    - GET /deviceManagement/userExperienceAnalyticsDeviceScores
    - GET /deviceManagement/userExperienceAnalyticsDevicePerformance
    - GET /deviceManagement/userExperienceAnalyticsDeviceStartupHistory
    - GET /deviceManagement/userExperienceAnalyticsOverview

    Required scopes:
    - DeviceManagementManagedDevices.Read.All

.PARAMETER Config
    The configuration hashtable loaded from config.json.

.PARAMETER OutputPath
    Full path where the resulting JSON file will be saved.

.OUTPUTS
    Writes endpoint-analytics.json to the specified output path.

.EXAMPLE
    $result = & .\collectors\Get-EndpointAnalytics.ps1 -Config $config -OutputPath ".\data\endpoint-analytics.json"
#>

#Requires -Version 7.0
#Requires -Modules Microsoft.Graph.DeviceManagement

param(
    [Parameter(Mandatory)]
    [hashtable]$Config,

    [Parameter(Mandatory)]
    [string]$OutputPath
)

# ============================================================================
# IMPORT SHARED UTILITIES
# ============================================================================

. "$PSScriptRoot\..\lib\CollectorBase.ps1"

# ============================================================================
# LOCAL HELPER FUNCTIONS
# ============================================================================

function Get-HealthStatus {
    <#
    .SYNOPSIS
        Determines health status from score.
    #>
    param([int]$Score)

    if ($Score -ge 80) { return "Excellent" }
    if ($Score -ge 60) { return "Good" }
    if ($Score -ge 40) { return "Fair" }
    if ($Score -ge 20) { return "Poor" }
    return "Critical"
}

# ============================================================================
# MAIN COLLECTION LOGIC
# ============================================================================

$errors = @()
$deviceCount = 0

try {
    Write-Host "    Collecting Endpoint Analytics data..." -ForegroundColor Gray

    $analyticsData = @{
        overview = $null
        deviceScores = @()
        devicePerformance = @()
        startupHistory = @()
        appReliability = @()
        summary = @{
            totalDevices = 0
            averageEndpointScore = 0
            averageStartupScore = 0
            averageAppReliabilityScore = 0
            devicesNeedingAttention = 0
            excellentDevices = 0
            goodDevices = 0
            fairDevices = 0
            poorDevices = 0
        }
    }

    # ========================================
    # Get Overview/Baseline
    # ========================================
    try {
        $overview = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/userExperienceAnalyticsOverview" `
                -OutputType PSObject
        } -OperationName "Endpoint Analytics overview"

        $analyticsData.overview = [PSCustomObject]@{
            overallScore                 = $overview.overallScore
            startupPerformanceScore      = $overview.startupPerformanceOverallScore
            appReliabilityScore          = $overview.appReliabilityOverallScore
            workFromAnywhereScore        = $overview.workFromAnywhereOverallScore
            batteryHealthScore           = $overview.batteryHealthOverallScore
            bestPracticesScore           = $overview.bestPracticesOverallScore
            resourcePerformanceScore     = $overview.resourcePerformanceOverallScore
            totalDevices                 = $overview.totalDeviceCount
            insightsCount                = if ($overview.insights) { $overview.insights.Count } else { 0 }
        }

        Write-Host "      Overall Endpoint Score: $($overview.overallScore)" -ForegroundColor Gray
    }
    catch {
        $errors += "Overview: $($_.Exception.Message)"
    }

    # ========================================
    # Get Device Scores
    # ========================================
    try {
        $deviceScores = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/userExperienceAnalyticsDeviceScores?`$top=500" `
                -OutputType PSObject
        } -OperationName "Device scores retrieval"

        $allScores = @($deviceScores.value)

        # Handle pagination
        while ($deviceScores.'@odata.nextLink') {
            $deviceScores = Invoke-GraphWithRetry -ScriptBlock {
                Invoke-MgGraphRequest -Method GET -Uri $deviceScores.'@odata.nextLink' -OutputType PSObject
            } -OperationName "Device scores pagination"
            $allScores += $deviceScores.value
        }

        foreach ($score in $allScores) {
            $endpointScore = [int]$score.endpointAnalyticsScore
            $healthStatus = Get-HealthStatus -Score $endpointScore

            $processedScore = [PSCustomObject]@{
                id                        = $score.id
                deviceName                = $score.deviceName
                manufacturer              = $score.manufacturer
                model                     = $score.model
                endpointAnalyticsScore    = $endpointScore
                startupPerformanceScore   = [int]$score.startupPerformanceScore
                appReliabilityScore       = [int]$score.appReliabilityScore
                workFromAnywhereScore     = [int]$score.workFromAnywhereScore
                healthStatus              = $healthStatus
                needsAttention            = ($endpointScore -lt 50)
            }

            $analyticsData.deviceScores += $processedScore
            $deviceCount++

            # Update summary
            $analyticsData.summary.totalDevices++
            switch ($healthStatus) {
                "Excellent" { $analyticsData.summary.excellentDevices++ }
                "Good"      { $analyticsData.summary.goodDevices++ }
                "Fair"      { $analyticsData.summary.fairDevices++ }
                "Poor"      { $analyticsData.summary.poorDevices++; $analyticsData.summary.devicesNeedingAttention++ }
                "Critical"  { $analyticsData.summary.devicesNeedingAttention++ }
            }
        }

        # Calculate averages
        if ($analyticsData.deviceScores.Count -gt 0) {
            $analyticsData.summary.averageEndpointScore = [Math]::Round(
                ($analyticsData.deviceScores | Measure-Object -Property endpointAnalyticsScore -Average).Average, 1
            )
            $analyticsData.summary.averageStartupScore = [Math]::Round(
                ($analyticsData.deviceScores | Measure-Object -Property startupPerformanceScore -Average).Average, 1
            )
            $analyticsData.summary.averageAppReliabilityScore = [Math]::Round(
                ($analyticsData.deviceScores | Measure-Object -Property appReliabilityScore -Average).Average, 1
            )
        }

        Write-Host "      Retrieved scores for $($analyticsData.deviceScores.Count) devices" -ForegroundColor Gray
    }
    catch {
        $errors += "Device scores: $($_.Exception.Message)"
    }

    # ========================================
    # Get Device Performance (Startup)
    # ========================================
    try {
        $performance = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/userExperienceAnalyticsDevicePerformance?`$top=500" `
                -OutputType PSObject
        } -OperationName "Device performance retrieval"

        $allPerf = @($performance.value)

        while ($performance.'@odata.nextLink') {
            $performance = Invoke-GraphWithRetry -ScriptBlock {
                Invoke-MgGraphRequest -Method GET -Uri $performance.'@odata.nextLink' -OutputType PSObject
            } -OperationName "Device performance pagination"
            $allPerf += $performance.value
        }

        foreach ($perf in $allPerf) {
            $analyticsData.devicePerformance += [PSCustomObject]@{
                id                       = $perf.id
                deviceName               = $perf.deviceName
                manufacturer             = $perf.manufacturer
                model                    = $perf.model
                operatingSystemVersion   = $perf.operatingSystemVersion
                startupPerformanceScore  = $perf.startupPerformanceScore
                coreBootTimeInMs         = $perf.coreBootTimeInMs
                groupPolicyBootTimeInMs  = $perf.groupPolicyBootTimeInMs
                healthStatus             = $perf.healthStatus
                loginTimeInMs            = $perf.loginTimeInMs
                coreLoginTimeInMs        = $perf.coreLoginTimeInMs
                groupPolicyLoginTimeInMs = $perf.groupPolicyLoginTimeInMs
                bootScore                = $perf.bootScore
                loginScore               = $perf.loginScore
                restartCount             = $perf.restartCount
                blueScreenCount          = $perf.blueScreenCount
                averageBlueScreens       = $perf.averageBlueScreens
                averageRestarts          = $perf.averageRestarts
            }
        }

        Write-Host "      Retrieved performance data for $($analyticsData.devicePerformance.Count) devices" -ForegroundColor Gray
    }
    catch {
        $errors += "Device performance: $($_.Exception.Message)"
    }

    # ========================================
    # Get App Reliability Data
    # ========================================
    try {
        $appReliability = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/userExperienceAnalyticsAppHealthApplicationPerformance?`$top=100" `
                -OutputType PSObject
        } -OperationName "App reliability retrieval"

        foreach ($app in $appReliability.value) {
            $analyticsData.appReliability += [PSCustomObject]@{
                id                    = $app.id
                appName               = $app.appDisplayName
                appPublisher          = $app.appPublisher
                appVersion            = $app.appVersion
                appCrashCount         = $app.appCrashCount
                appHangCount          = $app.appHangCount
                meanTimeToFailure     = $app.meanTimeToFailureInMinutes
                healthScore           = $app.appHealthScore
                activeDeviceCount     = $app.activeDeviceCount
            }
        }

        Write-Host "      Retrieved reliability data for $($analyticsData.appReliability.Count) apps" -ForegroundColor Gray
    }
    catch {
        $errors += "App reliability: $($_.Exception.Message)"
    }

    # Sort device scores by score (worst first)
    $analyticsData.deviceScores = $analyticsData.deviceScores | Sort-Object -Property endpointAnalyticsScore

    # Add collection date
    $analyticsData.collectionDate = (Get-Date).ToString("o")

    # Save data
    Save-CollectorData -Data $analyticsData -OutputPath $OutputPath | Out-Null

    Write-Host "    [OK] Collected Endpoint Analytics for $deviceCount devices" -ForegroundColor Green

    return New-CollectorResult -Success $true -Count $deviceCount -Errors $errors
}
catch {
    $errorMessage = $_.Exception.Message
    $errors += $errorMessage

    if ($errorMessage -match "license|subscription|permission|forbidden|Authorization|Endpoint Analytics") {
        Write-Host "    [!] Endpoint Analytics requires appropriate licensing and DeviceManagementManagedDevices.Read.All permission" -ForegroundColor Yellow
    }

    Write-Host "    [X] Failed: $errorMessage" -ForegroundColor Red

    Save-CollectorData -Data @{
        overview = $null
        deviceScores = @()
        devicePerformance = @()
        summary = @{}
    } -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

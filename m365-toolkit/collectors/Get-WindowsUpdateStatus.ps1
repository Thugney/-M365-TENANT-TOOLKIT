# ============================================================================
# TenantScope
# Author: Robel (https://github.com/Thugney)
# Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
# License: MIT
# ============================================================================

<#
.SYNOPSIS
    Collects Windows Update for Business configuration and update status.

.DESCRIPTION
    Retrieves Windows Update rings, feature update policies, and device
    update compliance status. Enables visibility into patch management
    posture across the device fleet.

    Graph API endpoints:
    - GET /deviceManagement/deviceConfigurations (filter for update rings)
    - GET /deviceManagement/windowsFeatureUpdateProfiles
    - GET /deviceManagement/windowsQualityUpdateProfiles

    Required scopes:
    - DeviceManagementConfiguration.Read.All

.PARAMETER Config
    The configuration hashtable loaded from config.json.

.PARAMETER OutputPath
    Full path where the resulting JSON file will be saved.

.OUTPUTS
    Writes windows-update-status.json to the specified output path.

.EXAMPLE
    $result = & .\collectors\Get-WindowsUpdateStatus.ps1 -Config $config -OutputPath ".\data\windows-update-status.json"
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
# MAIN COLLECTION LOGIC
# ============================================================================

$errors = @()
$totalItems = 0

try {
    Write-Host "    Collecting Windows Update configuration..." -ForegroundColor Gray

    $updateData = @{
        updateRings = @()
        featureUpdates = @()
        qualityUpdates = @()
        driverUpdates = @()
        summary = @{
            totalRings = 0
            totalFeaturePolicies = 0
            totalQualityPolicies = 0
            devicesUpToDate = 0
            devicesPendingUpdate = 0
            devicesWithErrors = 0
        }
    }

    # ========================================
    # Collect Windows Update Rings
    # ========================================
    try {
        $updateRings = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations?`$filter=isof('microsoft.graph.windowsUpdateForBusinessConfiguration')" `
                -OutputType PSObject
        } -OperationName "Windows Update rings retrieval"

        foreach ($ring in $updateRings.value) {
            # Get status overview
            $successCount = 0
            $errorCount = 0
            $pendingCount = 0

            try {
                $statusOverview = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations/$($ring.id)/deviceStatusOverview" `
                    -OutputType PSObject

                $successCount = $statusOverview.compliantDeviceCount
                $errorCount = $statusOverview.errorDeviceCount
                $pendingCount = $statusOverview.pendingDeviceCount
            }
            catch { }

            $updateData.updateRings += [PSCustomObject]@{
                id                          = $ring.id
                displayName                 = $ring.displayName
                description                 = $ring.description
                createdDateTime             = Format-IsoDate -DateValue $ring.createdDateTime
                lastModifiedDateTime        = Format-IsoDate -DateValue $ring.lastModifiedDateTime
                # Deferral settings
                qualityUpdatesDeferralDays  = $ring.qualityUpdatesDeferralPeriodInDays
                featureUpdatesDeferralDays  = $ring.featureUpdatesDeferralPeriodInDays
                qualityUpdatesPaused        = $ring.qualityUpdatesPaused
                featureUpdatesPaused        = $ring.featureUpdatesPaused
                # Deadline settings
                deadlineForQualityUpdates   = $ring.deadlineForQualityUpdatesInDays
                deadlineForFeatureUpdates   = $ring.deadlineForFeatureUpdatesInDays
                deadlineGracePeriod         = $ring.deadlineGracePeriodInDays
                # Behavior settings
                automaticUpdateMode         = $ring.automaticUpdateMode
                microsoftUpdateServiceAllowed = $ring.microsoftUpdateServiceAllowed
                driversExcluded             = $ring.driversExcluded
                allowWindows11Upgrade       = $ring.allowWindows11Upgrade
                # Status
                successDevices              = $successCount
                errorDevices                = $errorCount
                pendingDevices              = $pendingCount
                totalDevices                = $successCount + $errorCount + $pendingCount
            }

            $updateData.summary.devicesUpToDate += $successCount
            $updateData.summary.devicesPendingUpdate += $pendingCount
            $updateData.summary.devicesWithErrors += $errorCount
            $totalItems++
        }

        $updateData.summary.totalRings = $updateData.updateRings.Count
        Write-Host "      Retrieved $($updateData.updateRings.Count) update rings" -ForegroundColor Gray
    }
    catch {
        $errors += "Update rings: $($_.Exception.Message)"
    }

    # ========================================
    # Collect Feature Update Policies
    # ========================================
    try {
        $featureUpdates = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsFeatureUpdateProfiles" `
                -OutputType PSObject
        } -OperationName "Feature update profiles retrieval"

        foreach ($policy in $featureUpdates.value) {
            # Get deployment state
            $deploymentState = $null
            try {
                $stateResponse = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsFeatureUpdateProfiles/$($policy.id)/deviceUpdateStates" `
                    -OutputType PSObject

                $deploymentState = @{
                    total = $stateResponse.value.Count
                    succeeded = ($stateResponse.value | Where-Object { $_.featureUpdateStatus -eq "offeringReceived" -or $_.featureUpdateStatus -eq "installed" }).Count
                    pending = ($stateResponse.value | Where-Object { $_.featureUpdateStatus -eq "pending" -or $_.featureUpdateStatus -eq "downloading" }).Count
                    failed = ($stateResponse.value | Where-Object { $_.featureUpdateStatus -eq "failed" }).Count
                }
            }
            catch { }

            $updateData.featureUpdates += [PSCustomObject]@{
                id                   = $policy.id
                displayName          = $policy.displayName
                description          = $policy.description
                featureUpdateVersion = $policy.featureUpdateVersion
                createdDateTime      = Format-IsoDate -DateValue $policy.createdDateTime
                lastModifiedDateTime = Format-IsoDate -DateValue $policy.lastModifiedDateTime
                rolloutSettings      = $policy.rolloutSettings
                endOfSupportDate     = Format-IsoDate -DateValue $policy.endOfSupportDate
                deploymentState      = $deploymentState
            }

            $totalItems++
        }

        $updateData.summary.totalFeaturePolicies = $updateData.featureUpdates.Count
        Write-Host "      Retrieved $($updateData.featureUpdates.Count) feature update policies" -ForegroundColor Gray
    }
    catch {
        $errors += "Feature updates: $($_.Exception.Message)"
    }

    # ========================================
    # Collect Quality Update Policies (Expedited)
    # ========================================
    try {
        $qualityUpdates = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsQualityUpdateProfiles" `
                -OutputType PSObject
        } -OperationName "Quality update profiles retrieval"

        foreach ($policy in $qualityUpdates.value) {
            $updateData.qualityUpdates += [PSCustomObject]@{
                id                   = $policy.id
                displayName          = $policy.displayName
                description          = $policy.description
                expeditedUpdateSettings = $policy.expeditedUpdateSettings
                createdDateTime      = Format-IsoDate -DateValue $policy.createdDateTime
                lastModifiedDateTime = Format-IsoDate -DateValue $policy.lastModifiedDateTime
                releaseDateDisplayName = $policy.releaseDateDisplayName
            }

            $totalItems++
        }

        $updateData.summary.totalQualityPolicies = $updateData.qualityUpdates.Count
        Write-Host "      Retrieved $($updateData.qualityUpdates.Count) quality update policies" -ForegroundColor Gray
    }
    catch {
        $errors += "Quality updates: $($_.Exception.Message)"
    }

    # ========================================
    # Collect Driver Update Policies
    # ========================================
    try {
        $driverUpdates = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsDriverUpdateProfiles" `
                -OutputType PSObject
        } -OperationName "Driver update profiles retrieval"

        foreach ($policy in $driverUpdates.value) {
            $updateData.driverUpdates += [PSCustomObject]@{
                id                   = $policy.id
                displayName          = $policy.displayName
                description          = $policy.description
                approvalType         = $policy.approvalType
                createdDateTime      = Format-IsoDate -DateValue $policy.createdDateTime
                lastModifiedDateTime = Format-IsoDate -DateValue $policy.lastModifiedDateTime
            }

            $totalItems++
        }

        Write-Host "      Retrieved $($updateData.driverUpdates.Count) driver update policies" -ForegroundColor Gray
    }
    catch {
        # Driver updates may not be available in all tenants
    }

    # Save data
    Save-CollectorData -Data $updateData -OutputPath $OutputPath | Out-Null

    Write-Host "    [OK] Collected $totalItems Windows Update items" -ForegroundColor Green

    return New-CollectorResult -Success $true -Count $totalItems -Errors $errors
}
catch {
    $errorMessage = $_.Exception.Message
    $errors += $errorMessage

    if ($errorMessage -match "Intune|license|subscription|permission|forbidden|Authorization") {
        Write-Host "    [!] Windows Update collection requires Intune license and DeviceManagementConfiguration.Read.All permission" -ForegroundColor Yellow
    }

    Write-Host "    [X] Failed: $errorMessage" -ForegroundColor Red

    Save-CollectorData -Data @{
        updateRings = @()
        featureUpdates = @()
        qualityUpdates = @()
        driverUpdates = @()
        summary = @{}
    } -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

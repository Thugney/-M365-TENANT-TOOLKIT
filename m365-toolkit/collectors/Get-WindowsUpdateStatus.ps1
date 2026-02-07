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
        deviceCompliance = @()
        summary = @{
            totalRings = 0
            totalFeaturePolicies = 0
            totalQualityPolicies = 0
            totalDriverUpdates = 0
            totalManagedDevices = 0
            devicesUpToDate = 0
            devicesPendingUpdate = 0
            devicesWithErrors = 0
            complianceRate = 0
            expeditedUpdatesActive = 0
            securityUpdates = 0
            pausedRings = 0
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

            # Get assignments for this ring
            $assignedGroups = @()
            try {
                $assignmentResponse = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations/$($ring.id)/assignments" `
                    -OutputType PSObject

                foreach ($assignment in $assignmentResponse.value) {
                    $targetType = $assignment.target.'@odata.type'
                    if ($targetType -eq "#microsoft.graph.allDevicesAssignmentTarget") {
                        $assignedGroups += "All Devices"
                    }
                    elseif ($targetType -eq "#microsoft.graph.groupAssignmentTarget") {
                        $assignedGroups += "Group: $($assignment.target.groupId)"
                    }
                }
            }
            catch { }

            # Track paused rings
            if ($ring.qualityUpdatesPaused -or $ring.featureUpdatesPaused) {
                $updateData.summary.pausedRings++
            }

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
                # Assignments
                assignedGroups              = $assignedGroups
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
                    notApplicable = ($stateResponse.value | Where-Object { $_.featureUpdateStatus -eq "notApplicable" -or $_.featureUpdateStatus -eq "notOffered" }).Count
                }
            }
            catch { }

            # Get assignments
            $assignedGroups = @()
            try {
                $assignmentResponse = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsFeatureUpdateProfiles/$($policy.id)/assignments" `
                    -OutputType PSObject

                foreach ($assignment in $assignmentResponse.value) {
                    $targetType = $assignment.target.'@odata.type'
                    if ($targetType -eq "#microsoft.graph.allDevicesAssignmentTarget") {
                        $assignedGroups += "All Devices"
                    }
                    elseif ($targetType -eq "#microsoft.graph.groupAssignmentTarget") {
                        $assignedGroups += "Group: $($assignment.target.groupId)"
                    }
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
                assignedGroups       = $assignedGroups
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
            # Determine classification (Security, Critical, etc.) from name/description
            $classification = "Update"
            $isExpedited = $false
            $displayName = $policy.displayName
            $description = $policy.description

            if ($displayName -match "Security|CVE" -or $description -match "Security|CVE") {
                $classification = "Security"
                $updateData.summary.securityUpdates++
            }
            elseif ($displayName -match "Critical" -or $description -match "Critical") {
                $classification = "Critical"
            }

            if ($policy.expeditedUpdateSettings -or $displayName -match "Expedite") {
                $isExpedited = $true
                $updateData.summary.expeditedUpdatesActive++
            }

            # Get deployment status for this policy
            $deployedDevices = 0
            $pendingDevices = 0
            $failedDevices = 0
            $progressPercent = 0

            try {
                $assignments = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsQualityUpdateProfiles/$($policy.id)/assignments" `
                    -OutputType PSObject

                # If we have assignments, estimate device counts
                if ($assignments.value -and $assignments.value.Count -gt 0) {
                    # Try to get device state summary
                    try {
                        $stateSummary = Invoke-MgGraphRequest -Method GET `
                            -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsQualityUpdateProfiles/$($policy.id)/deviceUpdateStates" `
                            -OutputType PSObject

                        $states = $stateSummary.value
                        $deployedDevices = ($states | Where-Object { $_.qualityUpdateState -eq "installed" -or $_.qualityUpdateState -eq "succeeded" }).Count
                        $pendingDevices = ($states | Where-Object { $_.qualityUpdateState -eq "pending" -or $_.qualityUpdateState -eq "downloading" }).Count
                        $failedDevices = ($states | Where-Object { $_.qualityUpdateState -eq "failed" }).Count
                        $totalTarget = $deployedDevices + $pendingDevices + $failedDevices
                        if ($totalTarget -gt 0) {
                            $progressPercent = [Math]::Round(($deployedDevices / $totalTarget) * 100, 0)
                        }
                    }
                    catch { }
                }
            }
            catch { }

            # Get assignments for quality update
            $assignedGroups = @()
            try {
                $qAssignments = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsQualityUpdateProfiles/$($policy.id)/assignments" `
                    -OutputType PSObject

                foreach ($assignment in $qAssignments.value) {
                    $targetType = $assignment.target.'@odata.type'
                    if ($targetType -eq "#microsoft.graph.allDevicesAssignmentTarget") {
                        $assignedGroups += "All Managed Devices"
                    }
                    elseif ($targetType -eq "#microsoft.graph.groupAssignmentTarget") {
                        $assignedGroups += "Group: $($assignment.target.groupId)"
                    }
                }
            }
            catch { }

            $updateData.qualityUpdates += [PSCustomObject]@{
                id                      = $policy.id
                displayName             = $displayName
                description             = $description
                qualityUpdateClassification = $classification
                isExpedited             = $isExpedited
                expeditedUpdateSettings = $policy.expeditedUpdateSettings
                releaseDateDisplayName  = $policy.releaseDateDisplayName
                createdDateTime         = Format-IsoDate -DateValue $policy.createdDateTime
                lastModifiedDateTime    = Format-IsoDate -DateValue $policy.lastModifiedDateTime
                assignedGroups          = $assignedGroups
                deploymentState         = @{
                    total     = $deployedDevices + $pendingDevices + $failedDevices
                    succeeded = $deployedDevices
                    pending   = $pendingDevices
                    failed    = $failedDevices
                }
                progressPercent         = $progressPercent
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
    # Collect Driver Update Policies with Inventory
    # ========================================
    try {
        $driverProfiles = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsDriverUpdateProfiles" `
                -OutputType PSObject
        } -OperationName "Driver update profiles retrieval"

        foreach ($profile in $driverProfiles.value) {
            # Get driver inventories for this profile
            try {
                $inventoryResponse = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsDriverUpdateProfiles/$($profile.id)/driverInventories?`$top=100" `
                    -OutputType PSObject

                foreach ($driver in $inventoryResponse.value) {
                    # Get deployment status for this specific driver
                    $deployedDevices = 0
                    $pendingDevices = 0
                    $failedDevices = 0

                    try {
                        $deviceStates = Invoke-MgGraphRequest -Method GET `
                            -Uri "https://graph.microsoft.com/beta/deviceManagement/windowsDriverUpdateProfiles/$($profile.id)/deviceUpdateStates" `
                            -OutputType PSObject

                        if ($deviceStates.value) {
                            $deployedDevices = ($deviceStates.value | Where-Object { $_.driverUpdateState -eq "installed" -or $_.driverUpdateState -eq "succeeded" }).Count
                            $pendingDevices = ($deviceStates.value | Where-Object { $_.driverUpdateState -eq "pending" -or $_.driverUpdateState -eq "downloading" }).Count
                            $failedDevices = ($deviceStates.value | Where-Object { $_.driverUpdateState -eq "failed" }).Count
                        }
                    }
                    catch { }

                    # Flatten driver into driverUpdates array (dashboard expects this structure)
                    $updateData.driverUpdates += [PSCustomObject]@{
                        id              = $driver.id
                        displayName     = $driver.name
                        driverClass     = $driver.driverClass
                        manufacturer    = $driver.manufacturer
                        version         = $driver.version
                        releaseDateTime = Format-IsoDate -DateValue $driver.releaseDateTime
                        approvalStatus  = $driver.approvalStatus
                        applicableDeviceCount = $driver.applicableDeviceCount
                        profileId       = $profile.id
                        profileName     = $profile.displayName
                        deploymentState = @{
                            total     = $deployedDevices + $pendingDevices + $failedDevices
                            succeeded = $deployedDevices
                            pending   = $pendingDevices
                            failed    = $failedDevices
                        }
                    }

                    $totalItems++
                }
            }
            catch { }
        }

        $updateData.summary.totalDriverUpdates = $updateData.driverUpdates.Count
        Write-Host "      Retrieved $($updateData.driverUpdates.Count) driver updates" -ForegroundColor Gray
    }
    catch {
        # Driver updates may not be available in all tenants
    }

    # ========================================
    # Collect Device Windows Update Compliance
    # ========================================
    try {
        $windowsDevices = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET `
                -Uri "https://graph.microsoft.com/beta/deviceManagement/managedDevices?`$filter=operatingSystem eq 'Windows'&`$select=id,deviceName,osVersion,lastSyncDateTime,complianceState,userPrincipalName,model&`$top=500" `
                -OutputType PSObject
        } -OperationName "Device compliance retrieval"

        $allDevices = @($windowsDevices.value)

        # Handle pagination
        while ($windowsDevices.'@odata.nextLink') {
            $windowsDevices = Invoke-GraphWithRetry -ScriptBlock {
                Invoke-MgGraphRequest -Method GET -Uri $windowsDevices.'@odata.nextLink' -OutputType PSObject
            } -OperationName "Device compliance pagination"
            $allDevices += $windowsDevices.value
        }

        # Build a map of update ring assignments for lookup
        $deviceRingMap = @{}
        foreach ($ring in $updateData.updateRings) {
            # Note: In real scenario, you'd need to resolve group membership
            # For now, we'll use a simplified approach
            $deviceRingMap[$ring.displayName] = $ring.displayName
        }

        $upToDateCount = 0
        $pendingCount = 0
        $errorCount = 0

        foreach ($device in $allDevices) {
            # Determine update status from OS version and last sync
            $updateStatus = "Unknown"
            $pendingUpdates = 0
            $failedUpdates = 0
            $errorDetails = $null
            $lastSync = $device.lastSyncDateTime

            if ($lastSync) {
                $daysSinceSync = ((Get-Date) - [DateTime]$lastSync).Days
                if ($daysSinceSync -le 7) {
                    $updateStatus = "upToDate"
                    $upToDateCount++
                }
                elseif ($daysSinceSync -le 30) {
                    $updateStatus = "pendingUpdate"
                    $pendingUpdates = 1  # At least one pending
                    $pendingCount++
                }
                else {
                    $updateStatus = "error"
                    $failedUpdates = 1
                    $errorDetails = "Device has not synced in over 30 days"
                    $errorCount++
                }
            }

            # Determine feature update version from OS version
            $featureUpdateVersion = "Unknown"
            $osVer = $device.osVersion
            if ($osVer -match "10\.0\.26100") { $featureUpdateVersion = "Windows 11, version 24H2" }
            elseif ($osVer -match "10\.0\.22631") { $featureUpdateVersion = "Windows 11, version 23H2" }
            elseif ($osVer -match "10\.0\.22621") { $featureUpdateVersion = "Windows 11, version 22H2" }
            elseif ($osVer -match "10\.0\.19045") { $featureUpdateVersion = "Windows 10, version 22H2" }
            elseif ($osVer -match "10\.0\.19044") { $featureUpdateVersion = "Windows 10, version 21H2" }

            # Try to determine update ring (simplified - would need group membership check in real scenario)
            $updateRing = $null
            if ($updateData.updateRings.Count -gt 0) {
                # Assign to first ring as placeholder - real implementation needs group membership
                $updateRing = $updateData.updateRings[0].displayName
            }

            $deviceEntry = [PSCustomObject]@{
                deviceId            = $device.id
                deviceName          = $device.deviceName
                userPrincipalName   = $device.userPrincipalName
                osVersion           = $osVer
                updateStatus        = $updateStatus
                lastSyncDateTime    = Format-IsoDate -DateValue $device.lastSyncDateTime
                complianceState     = $device.complianceState
                featureUpdateVersion = $featureUpdateVersion
                pendingUpdates      = $pendingUpdates
                failedUpdates       = $failedUpdates
                updateRing          = $updateRing
            }

            # Add errorDetails only if there's an error
            if ($errorDetails) {
                $deviceEntry | Add-Member -NotePropertyName errorDetails -NotePropertyValue $errorDetails
            }

            $updateData.deviceCompliance += $deviceEntry
        }

        # Update summary with device compliance stats
        $updateData.summary.totalManagedDevices = $allDevices.Count
        if ($allDevices.Count -gt 0) {
            $updateData.summary.complianceRate = [Math]::Round(($upToDateCount / $allDevices.Count) * 100, 1)
        }

        Write-Host "      Retrieved compliance for $($updateData.deviceCompliance.Count) devices" -ForegroundColor Gray
    }
    catch {
        $errors += "Device compliance: $($_.Exception.Message)"
    }

    # Add collection date
    $updateData.collectionDate = (Get-Date).ToString("o")

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
        deviceCompliance = @()
        summary = @{}
        collectionDate = (Get-Date).ToString("o")
    } -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

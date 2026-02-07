# ============================================================================
# TenantScope
# Author: Robel (https://github.com/Thugney)
# Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
# License: MIT
# ============================================================================

<#
.SYNOPSIS
    Collects Intune managed device data from Microsoft Graph.

.DESCRIPTION
    Retrieves all devices managed by Microsoft Intune including compliance
    status, encryption state, and last sync time. Identifies stale devices
    that haven't synced within the configured threshold.

    Graph API endpoint: GET /deviceManagement/managedDevices
    Required scope: DeviceManagementManagedDevices.Read.All

.PARAMETER Config
    The configuration hashtable loaded from config.json.

.PARAMETER OutputPath
    Full path where the resulting JSON file will be saved.

.OUTPUTS
    Writes devices.json to the specified output path. Returns a hashtable with:
    - Success: [bool] whether collection completed
    - Count: [int] number of devices collected
    - Errors: [array] any errors encountered

.EXAMPLE
    $result = & .\collectors\Get-DeviceData.ps1 -Config $config -OutputPath ".\data\devices.json"
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
# Device-specific functions that don't belong in CollectorBase
# ============================================================================

function Get-ComplianceState {
    <#
    .SYNOPSIS
        Maps Intune compliance state to our schema values.
    #>
    param([string]$IntuneState)

    switch ($IntuneState) {
        "compliant"     { return "compliant" }
        "noncompliant"  { return "noncompliant" }
        "conflict"      { return "noncompliant" }
        "error"         { return "unknown" }
        "inGracePeriod" { return "noncompliant" }
        "configManager" { return "unknown" }
        default         { return "unknown" }
    }
}

function Get-DeviceOwnership {
    <#
    .SYNOPSIS
        Maps Intune ownership type to our schema values.
    #>
    param([string]$OwnerType)

    switch ($OwnerType) {
        "personal" { return "personal" }
        "company"  { return "corporate" }
        default    { return "corporate" }
    }
}

function Get-ManagementAgent {
    <#
    .SYNOPSIS
        Maps Intune management agent to our schema values.
    #>
    param([string]$Agent)

    switch ($Agent) {
        "mdm"                           { return "mdm" }
        "easMdm"                        { return "easMdm" }
        "configurationManagerClient"    { return "configManager" }
        "configurationManagerClientMdm" { return "configManager" }
        default                         { return $Agent }
    }
}

# ============================================================================
# MAIN COLLECTION LOGIC
# ============================================================================

$errors = @()
$deviceCount = 0

try {
    Write-Host "    Collecting Intune managed devices..." -ForegroundColor Gray

    # Get stale threshold from config
    $staleThreshold = $Config.thresholds.staleDeviceDays
    if ($null -eq $staleThreshold -or $staleThreshold -le 0) {
        $staleThreshold = 90
    }

    # Retrieve all managed devices from Intune
    $managedDevices = Invoke-GraphWithRetry -ScriptBlock {
        Get-MgDeviceManagementManagedDevice -All
    } -OperationName "Intune device retrieval"

    Write-Host "      Retrieved $($managedDevices.Count) devices from Intune" -ForegroundColor Gray

    # Process each device
    $processedDevices = @()

    foreach ($device in $managedDevices) {
        # Calculate days since last sync using shared utility
        $daysSinceSync = Get-DaysSinceDate -DateValue $device.LastSyncDateTime

        # Determine if device is stale using shared utility
        $activityStatus = Get-ActivityStatus -DaysSinceActivity $daysSinceSync -InactiveThreshold $staleThreshold
        $isStale = $activityStatus.isInactive

        # Map compliance state
        $complianceState = Get-ComplianceState -IntuneState $device.ComplianceState

        # Map ownership
        $ownership = Get-DeviceOwnership -OwnerType $device.ManagedDeviceOwnerType

        # Map management agent
        $managementAgent = Get-ManagementAgent -Agent $device.ManagementAgent

        # Calculate certificate expiry using shared utilities
        $daysUntilCertExpiry = Get-DaysUntilDate -DateValue $device.ManagedDeviceCertificateExpirationDate
        $certStatus = Get-CertificateStatus -DaysUntilExpiry $daysUntilCertExpiry

        # Get Windows lifecycle info using shared utility
        $winLifecycle = Get-WindowsLifecycleInfo -OsVersion $device.OsVersion

        # Build output object
        $processedDevice = [PSCustomObject]@{
            id                     = $device.Id
            deviceName             = $device.DeviceName
            userPrincipalName      = $device.UserPrincipalName
            os                     = Get-SimplifiedOS -OperatingSystem $device.OperatingSystem
            osVersion              = $device.OsVersion
            complianceState        = $complianceState
            lastSync               = Format-IsoDate -DateValue $device.LastSyncDateTime
            daysSinceSync          = $daysSinceSync
            isStale                = $isStale
            enrolledDateTime       = Format-IsoDate -DateValue $device.EnrolledDateTime
            ownership              = $ownership
            manufacturer           = $device.Manufacturer
            model                  = $device.Model
            serialNumber           = $device.SerialNumber
            isEncrypted            = [bool]$device.IsEncrypted
            managementAgent        = $managementAgent
            certExpiryDate         = Format-IsoDate -DateValue $device.ManagedDeviceCertificateExpirationDate
            daysUntilCertExpiry    = $daysUntilCertExpiry
            certStatus             = $certStatus
            # Extended fields
            primaryUserDisplayName = $device.UserDisplayName
            autopilotEnrolled      = [bool]$device.AutopilotEnrolled
            deviceCategory         = $device.DeviceCategoryDisplayName
            totalStorageGB         = if ($device.TotalStorageSpaceInBytes -and $device.TotalStorageSpaceInBytes -gt 0) {
                                         [Math]::Round($device.TotalStorageSpaceInBytes / 1GB, 1)
                                     } else { $null }
            freeStorageGB          = if ($device.FreeStorageSpaceInBytes -and $device.FreeStorageSpaceInBytes -gt 0) {
                                         [Math]::Round($device.FreeStorageSpaceInBytes / 1GB, 1)
                                     } else { $null }
            storageUsedPct         = if ($device.TotalStorageSpaceInBytes -and $device.TotalStorageSpaceInBytes -gt 0) {
                                         $used = $device.TotalStorageSpaceInBytes - $device.FreeStorageSpaceInBytes
                                         [Math]::Round(($used / $device.TotalStorageSpaceInBytes) * 100, 1)
                                     } else { $null }
            wifiMacAddress         = $device.WiFiMacAddress
            joinType               = $device.JoinType
            # Windows lifecycle fields
            windowsRelease         = $winLifecycle.windowsRelease
            windowsBuild           = $winLifecycle.windowsBuild
            windowsType            = $winLifecycle.windowsType
            windowsEOL             = $winLifecycle.windowsEOL
            windowsSupported       = $winLifecycle.windowsSupported
        }

        $processedDevices += $processedDevice
        $deviceCount++

        # Progress indicator
        if ($deviceCount % 50 -eq 0) {
            Write-Host "      Processed $deviceCount devices..." -ForegroundColor Gray
        }
    }

    # Sort by compliance state (non-compliant first) then by last sync
    $processedDevices = $processedDevices | Sort-Object -Property @{
        Expression = {
            switch ($_.complianceState) {
                "noncompliant" { 0 }
                "unknown"      { 1 }
                "compliant"    { 2 }
                default        { 3 }
            }
        }
    }, @{ Expression = "daysSinceSync"; Descending = $true }

    # ============================================================================
    # GENERATE SUMMARY STATISTICS
    # ============================================================================

    Write-Host "      Generating summary statistics..." -ForegroundColor Gray

    # Compliance counts
    $compliantCount = ($processedDevices | Where-Object { $_.complianceState -eq "compliant" }).Count
    $noncompliantCount = ($processedDevices | Where-Object { $_.complianceState -eq "noncompliant" }).Count
    $unknownCount = ($processedDevices | Where-Object { $_.complianceState -eq "unknown" }).Count

    # Encryption counts
    $encryptedCount = ($processedDevices | Where-Object { $_.isEncrypted -eq $true }).Count
    $notEncryptedCount = ($processedDevices | Where-Object { $_.isEncrypted -eq $false }).Count

    # Stale device counts
    $staleCount = ($processedDevices | Where-Object { $_.isStale -eq $true }).Count
    $activeCount = ($processedDevices | Where-Object { $_.isStale -eq $false }).Count

    # Certificate status counts
    $certExpiredCount = ($processedDevices | Where-Object { $_.certStatus -eq "expired" }).Count
    $certCriticalCount = ($processedDevices | Where-Object { $_.certStatus -eq "critical" }).Count
    $certWarningCount = ($processedDevices | Where-Object { $_.certStatus -eq "warning" }).Count
    $certHealthyCount = ($processedDevices | Where-Object { $_.certStatus -eq "healthy" }).Count
    $certUnknownCount = ($processedDevices | Where-Object { $_.certStatus -eq "unknown" }).Count

    # Windows device stats
    $windowsDevices = $processedDevices | Where-Object { $_.os -eq "Windows" }
    $windows11Count = ($windowsDevices | Where-Object { $_.windowsType -eq "Windows 11" }).Count
    $windows10Count = ($windowsDevices | Where-Object { $_.windowsType -eq "Windows 10" }).Count
    $windowsSupportedCount = ($windowsDevices | Where-Object { $_.windowsSupported -eq $true }).Count
    $windowsUnsupportedCount = ($windowsDevices | Where-Object { $_.windowsSupported -eq $false }).Count

    # Ownership counts
    $corporateCount = ($processedDevices | Where-Object { $_.ownership -eq "corporate" }).Count
    $personalCount = ($processedDevices | Where-Object { $_.ownership -eq "personal" }).Count

    # Autopilot counts
    $autopilotCount = ($processedDevices | Where-Object { $_.autopilotEnrolled -eq $true }).Count
    $notAutopilotCount = ($processedDevices | Where-Object { $_.autopilotEnrolled -eq $false }).Count

    # OS breakdown
    $osBreakdown = @{}
    foreach ($device in $processedDevices) {
        $os = if ($device.os) { $device.os } else { "Unknown" }
        if (-not $osBreakdown.ContainsKey($os)) {
            $osBreakdown[$os] = 0
        }
        $osBreakdown[$os]++
    }
    $osBreakdownArray = @()
    foreach ($key in $osBreakdown.Keys | Sort-Object) {
        $osBreakdownArray += [PSCustomObject]@{
            name = $key
            count = $osBreakdown[$key]
        }
    }

    # Manufacturer breakdown
    $manufacturerBreakdown = @{}
    foreach ($device in $processedDevices) {
        $mfr = if ($device.manufacturer) { $device.manufacturer } else { "Unknown" }
        if (-not $manufacturerBreakdown.ContainsKey($mfr)) {
            $manufacturerBreakdown[$mfr] = 0
        }
        $manufacturerBreakdown[$mfr]++
    }
    $manufacturerBreakdownArray = @()
    foreach ($key in $manufacturerBreakdown.Keys | Sort-Object { $manufacturerBreakdown[$_] } -Descending) {
        $manufacturerBreakdownArray += [PSCustomObject]@{
            name = $key
            count = $manufacturerBreakdown[$key]
        }
    }

    # Model breakdown (top 10)
    $modelBreakdown = @{}
    foreach ($device in $processedDevices) {
        $model = if ($device.model) { $device.model } else { "Unknown" }
        if (-not $modelBreakdown.ContainsKey($model)) {
            $modelBreakdown[$model] = 0
        }
        $modelBreakdown[$model]++
    }
    $modelBreakdownArray = @()
    foreach ($key in $modelBreakdown.Keys | Sort-Object { $modelBreakdown[$_] } -Descending | Select-Object -First 10) {
        $modelBreakdownArray += [PSCustomObject]@{
            name = $key
            count = $modelBreakdown[$key]
        }
    }

    # Windows release breakdown
    $windowsReleaseBreakdown = @{}
    foreach ($device in $windowsDevices) {
        $release = if ($device.windowsRelease) { "$($device.windowsType) $($device.windowsRelease)" } else { "Unknown" }
        if (-not $windowsReleaseBreakdown.ContainsKey($release)) {
            $windowsReleaseBreakdown[$release] = 0
        }
        $windowsReleaseBreakdown[$release]++
    }
    $windowsReleaseArray = @()
    foreach ($key in $windowsReleaseBreakdown.Keys | Sort-Object) {
        $windowsReleaseArray += [PSCustomObject]@{
            name = $key
            count = $windowsReleaseBreakdown[$key]
        }
    }

    # Build summary object
    $summary = [PSCustomObject]@{
        totalDevices           = $deviceCount
        compliant              = $compliantCount
        noncompliant           = $noncompliantCount
        unknown                = $unknownCount
        encrypted              = $encryptedCount
        notEncrypted           = $notEncryptedCount
        stale                  = $staleCount
        active                 = $activeCount
        certExpired            = $certExpiredCount
        certCritical           = $certCriticalCount
        certWarning            = $certWarningCount
        certHealthy            = $certHealthyCount
        certUnknown            = $certUnknownCount
        windows11              = $windows11Count
        windows10              = $windows10Count
        windowsSupported       = $windowsSupportedCount
        windowsUnsupported     = $windowsUnsupportedCount
        corporate              = $corporateCount
        personal               = $personalCount
        autopilotEnrolled      = $autopilotCount
        notAutopilotEnrolled   = $notAutopilotCount
        osBreakdown            = $osBreakdownArray
        manufacturerBreakdown  = $manufacturerBreakdownArray
        modelBreakdown         = $modelBreakdownArray
        windowsReleaseBreakdown = $windowsReleaseArray
    }

    # ============================================================================
    # GENERATE INSIGHTS
    # ============================================================================

    Write-Host "      Generating insights..." -ForegroundColor Gray

    $insights = @()

    # Critical: Non-compliant devices
    if ($noncompliantCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "noncompliant-devices"
            severity          = "critical"
            description       = "$noncompliantCount device$(if($noncompliantCount -ne 1){'s'}) $(if($noncompliantCount -eq 1){'is'}else{'are'}) non-compliant with organizational policies"
            affectedDevices   = $noncompliantCount
            recommendedAction = "Review non-compliant devices and remediate policy violations"
            category          = "Compliance"
        }
    }

    # Critical: Unencrypted devices
    if ($notEncryptedCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "unencrypted-devices"
            severity          = "critical"
            description       = "$notEncryptedCount device$(if($notEncryptedCount -ne 1){'s'}) $(if($notEncryptedCount -eq 1){'is'}else{'are'}) not encrypted"
            affectedDevices   = $notEncryptedCount
            recommendedAction = "Enable encryption on these devices to protect data at rest"
            category          = "Security"
        }
    }

    # Critical: Expired certificates
    if ($certExpiredCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "expired-certificates"
            severity          = "critical"
            description       = "$certExpiredCount device$(if($certExpiredCount -ne 1){'s'}) $(if($certExpiredCount -eq 1){'has'}else{'have'}) expired management certificates"
            affectedDevices   = $certExpiredCount
            recommendedAction = "Re-enroll devices with expired certificates to restore management capabilities"
            category          = "Certificate"
        }
    }

    # High: Unsupported Windows versions
    if ($windowsUnsupportedCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "unsupported-windows"
            severity          = "high"
            description       = "$windowsUnsupportedCount Windows device$(if($windowsUnsupportedCount -ne 1){'s'}) $(if($windowsUnsupportedCount -eq 1){'is'}else{'are'}) running unsupported versions"
            affectedDevices   = $windowsUnsupportedCount
            recommendedAction = "Upgrade devices to supported Windows versions to receive security updates"
            category          = "Lifecycle"
        }
    }

    # High: Stale devices
    if ($staleCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "stale-devices"
            severity          = "high"
            description       = "$staleCount device$(if($staleCount -ne 1){'s'}) $(if($staleCount -eq 1){'has'}else{'have'}) not synced in over $staleThreshold days"
            affectedDevices   = $staleCount
            recommendedAction = "Investigate stale devices - they may be lost, retired, or have connectivity issues"
            category          = "Sync"
        }
    }

    # High: Critical certificates (expiring within 30 days)
    if ($certCriticalCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "critical-certificates"
            severity          = "high"
            description       = "$certCriticalCount device$(if($certCriticalCount -ne 1){'s'}) $(if($certCriticalCount -eq 1){'has'}else{'have'}) certificates expiring within 30 days"
            affectedDevices   = $certCriticalCount
            recommendedAction = "Proactively renew certificates to prevent management disruption"
            category          = "Certificate"
        }
    }

    # Medium: Warning certificates (expiring within 60 days)
    if ($certWarningCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "warning-certificates"
            severity          = "medium"
            description       = "$certWarningCount device$(if($certWarningCount -ne 1){'s'}) $(if($certWarningCount -eq 1){'has'}else{'have'}) certificates expiring within 60 days"
            affectedDevices   = $certWarningCount
            recommendedAction = "Plan certificate renewals for upcoming expirations"
            category          = "Certificate"
        }
    }

    # Medium: Windows 10 devices (approaching EOL)
    if ($windows10Count -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "windows10-devices"
            severity          = "medium"
            description       = "$windows10Count device$(if($windows10Count -ne 1){'s'}) $(if($windows10Count -eq 1){'is'}else{'are'}) still running Windows 10"
            affectedDevices   = $windows10Count
            recommendedAction = "Plan migration to Windows 11 before Windows 10 end of support"
            category          = "Lifecycle"
        }
    }

    # Medium: Unknown compliance state
    if ($unknownCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "unknown-compliance"
            severity          = "medium"
            description       = "$unknownCount device$(if($unknownCount -ne 1){'s'}) $(if($unknownCount -eq 1){'has'}else{'have'}) unknown compliance state"
            affectedDevices   = $unknownCount
            recommendedAction = "Review devices with unknown compliance - they may need policy assignment or sync"
            category          = "Compliance"
        }
    }

    # Info: Personal devices
    if ($personalCount -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "personal-devices"
            severity          = "info"
            description       = "$personalCount personal (BYOD) device$(if($personalCount -ne 1){'s'}) enrolled in management"
            affectedDevices   = $personalCount
            recommendedAction = "Ensure appropriate policies are applied to personal devices"
            category          = "Enrollment"
        }
    }

    # Info: Autopilot enrollment
    $autopilotPct = if ($deviceCount -gt 0) { [Math]::Round(($autopilotCount / $deviceCount) * 100, 1) } else { 0 }
    if ($autopilotPct -lt 50 -and $windowsDevices.Count -gt 0) {
        $insights += [PSCustomObject]@{
            id                = "low-autopilot"
            severity          = "info"
            description       = "Only $autopilotPct% of devices are enrolled via Windows Autopilot"
            affectedDevices   = $notAutopilotCount
            recommendedAction = "Consider expanding Autopilot adoption for streamlined provisioning"
            category          = "Enrollment"
        }
    }

    # Info: High compliance rate
    $compliancePct = if ($deviceCount -gt 0) { [Math]::Round(($compliantCount / $deviceCount) * 100, 1) } else { 0 }
    if ($compliancePct -ge 95 -and $deviceCount -gt 10) {
        $insights += [PSCustomObject]@{
            id                = "high-compliance"
            severity          = "info"
            description       = "Excellent compliance rate: $compliancePct% of devices are compliant"
            affectedDevices   = $compliantCount
            recommendedAction = "Maintain current compliance policies and monitoring"
            category          = "Compliance"
        }
    }

    # ============================================================================
    # BUILD OUTPUT OBJECT
    # ============================================================================

    $outputData = [PSCustomObject]@{
        devices    = $processedDevices
        summary    = $summary
        insights   = $insights
        collectedAt = (Get-Date).ToUniversalTime().ToString("o")
    }

    # Save data using shared utility
    Save-CollectorData -Data $outputData -OutputPath $OutputPath | Out-Null

    Write-Host "    [OK] Collected $deviceCount devices" -ForegroundColor Green

    return New-CollectorResult -Success $true -Count $deviceCount -Errors $errors
}
catch {
    $errorMessage = $_.Exception.Message
    $errors += $errorMessage

    # Check if this is a licensing/permission issue
    if ($errorMessage -match "Intune|license|subscription|permission|forbidden") {
        Write-Host "    [!] Device collection requires Intune license and appropriate permissions" -ForegroundColor Yellow
    }

    Write-Host "    [X] Failed: $errorMessage" -ForegroundColor Red

    # Write empty structure to prevent dashboard errors
    $emptyData = [PSCustomObject]@{
        devices     = @()
        summary     = [PSCustomObject]@{
            totalDevices = 0
            compliant = 0
            noncompliant = 0
            unknown = 0
            encrypted = 0
            notEncrypted = 0
            stale = 0
            active = 0
            certExpired = 0
            certCritical = 0
            certWarning = 0
            certHealthy = 0
            certUnknown = 0
            windows11 = 0
            windows10 = 0
            windowsSupported = 0
            windowsUnsupported = 0
            corporate = 0
            personal = 0
            autopilotEnrolled = 0
            notAutopilotEnrolled = 0
            osBreakdown = @()
            manufacturerBreakdown = @()
            modelBreakdown = @()
            windowsReleaseBreakdown = @()
        }
        insights    = @()
        collectedAt = (Get-Date).ToUniversalTime().ToString("o")
    }
    Save-CollectorData -Data $emptyData -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

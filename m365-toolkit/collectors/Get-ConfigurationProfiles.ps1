# ============================================================================
# TenantScope
# Author: Robel (https://github.com/Thugney)
# Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
# License: MIT
# ============================================================================

<#
.SYNOPSIS
    Collects Intune device configuration profiles and their deployment status.

.DESCRIPTION
    Retrieves all device configuration profiles from Microsoft Intune including
    endpoint security profiles, settings catalogs, and administrative templates.
    Shows assignment status and deployment success/failure rates.

    Graph API endpoints:
    - GET /deviceManagement/deviceConfigurations
    - GET /deviceManagement/configurationPolicies (Settings Catalog)
    - GET /deviceManagement/deviceConfigurations/{id}/deviceStatusOverview

    Required scopes:
    - DeviceManagementConfiguration.Read.All

.PARAMETER Config
    The configuration hashtable loaded from config.json.

.PARAMETER OutputPath
    Full path where the resulting JSON file will be saved.

.OUTPUTS
    Writes configuration-profiles.json to the specified output path.

.EXAMPLE
    $result = & .\collectors\Get-ConfigurationProfiles.ps1 -Config $config -OutputPath ".\data\configuration-profiles.json"
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

function Get-ProfileType {
    <#
    .SYNOPSIS
        Determines the profile type from @odata.type.
    #>
    param([string]$ODataType)

    switch -Regex ($ODataType) {
        "windows10EndpointProtection"      { return "Endpoint Protection" }
        "windows10General"                 { return "Device Restrictions" }
        "windows10Custom"                  { return "Custom (OMA-URI)" }
        "windowsHealthMonitoring"          { return "Health Monitoring" }
        "windowsIdentityProtection"        { return "Identity Protection" }
        "windowsKiosk"                     { return "Kiosk" }
        "windows10VpnConfiguration"        { return "VPN" }
        "windowsWifiConfiguration"         { return "Wi-Fi" }
        "windows10Compliance"              { return "Compliance" }
        "windowsUpdateForBusiness"         { return "Windows Update" }
        "windowsDeliveryOptimization"      { return "Delivery Optimization" }
        "windows10SecureAssessment"        { return "Secure Assessment" }
        "windows10PkcsCertificate"         { return "PKCS Certificate" }
        "windows10ImportedPFX"             { return "PFX Certificate" }
        "windows10TrustedRoot"             { return "Trusted Root" }
        "androidGeneral"                   { return "Android General" }
        "androidWorkProfile"               { return "Android Work Profile" }
        "iosGeneral"                       { return "iOS General" }
        "iosDevice"                        { return "iOS Device Features" }
        "macOS"                            { return "macOS" }
        "sharedPC"                         { return "Shared PC" }
        "editionUpgrade"                   { return "Edition Upgrade" }
        default                            { return "Configuration" }
    }
}

function Get-ProfilePlatform {
    <#
    .SYNOPSIS
        Determines the platform from @odata.type.
    #>
    param([string]$ODataType)

    switch -Regex ($ODataType) {
        "windows10|windows81|windowsPhone|sharedPC|editionUpgrade" { return "Windows" }
        "android"  { return "Android" }
        "ios"      { return "iOS/iPadOS" }
        "macOS"    { return "macOS" }
        default    { return "Cross-platform" }
    }
}

# ============================================================================
# MAIN COLLECTION LOGIC
# ============================================================================

$errors = @()
$profileCount = 0

try {
    Write-Host "    Collecting device configuration profiles..." -ForegroundColor Gray

    $allProfiles = @()

    # ========================================
    # Collect Device Configurations (Legacy)
    # ========================================
    try {
        $configs = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceConfigurations" -OutputType PSObject
        } -OperationName "Device configuration retrieval"

        $legacyConfigs = @($configs.value)

        while ($configs.'@odata.nextLink') {
            $configs = Invoke-GraphWithRetry -ScriptBlock {
                Invoke-MgGraphRequest -Method GET -Uri $configs.'@odata.nextLink' -OutputType PSObject
            } -OperationName "Device configuration pagination"
            $legacyConfigs += $configs.value
        }

        foreach ($config in $legacyConfigs) {
            $allProfiles += @{
                source = "deviceConfigurations"
                data = $config
            }
        }

        Write-Host "      Retrieved $($legacyConfigs.Count) device configurations" -ForegroundColor Gray
    }
    catch {
        $errors += "Device configurations: $($_.Exception.Message)"
    }

    # ========================================
    # Collect Settings Catalog Policies
    # ========================================
    try {
        $settingsCatalog = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies" -OutputType PSObject
        } -OperationName "Settings catalog retrieval"

        $catalogPolicies = @($settingsCatalog.value)

        while ($settingsCatalog.'@odata.nextLink') {
            $settingsCatalog = Invoke-GraphWithRetry -ScriptBlock {
                Invoke-MgGraphRequest -Method GET -Uri $settingsCatalog.'@odata.nextLink' -OutputType PSObject
            } -OperationName "Settings catalog pagination"
            $catalogPolicies += $settingsCatalog.value
        }

        foreach ($policy in $catalogPolicies) {
            $allProfiles += @{
                source = "configurationPolicies"
                data = $policy
            }
        }

        Write-Host "      Retrieved $($catalogPolicies.Count) settings catalog policies" -ForegroundColor Gray
    }
    catch {
        $errors += "Settings catalog: $($_.Exception.Message)"
    }

    # ========================================
    # Process all profiles
    # ========================================

    $processedProfiles = @()

    foreach ($item in $allProfiles) {
        try {
            $profile = $item.data
            $source = $item.source

            # Get status overview
            $successCount = 0
            $errorCount = 0
            $conflictCount = 0
            $pendingCount = 0
            $notApplicableCount = 0

            try {
                if ($source -eq "deviceConfigurations") {
                    $statusOverview = Invoke-MgGraphRequest -Method GET `
                        -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceConfigurations/$($profile.id)/deviceStatusOverview" `
                        -OutputType PSObject

                    $successCount = $statusOverview.compliantDeviceCount + $statusOverview.remediatedDeviceCount
                    $errorCount = $statusOverview.errorDeviceCount
                    $conflictCount = $statusOverview.conflictDeviceCount
                    $pendingCount = $statusOverview.pendingDeviceCount
                    $notApplicableCount = $statusOverview.notApplicableDeviceCount
                }
                elseif ($source -eq "configurationPolicies") {
                    # Settings catalog uses different status endpoint
                    $statusOverview = Invoke-MgGraphRequest -Method GET `
                        -Uri "https://graph.microsoft.com/beta/deviceManagement/configurationPolicies/$($profile.id)/deviceStatusOverview" `
                        -OutputType PSObject

                    if ($statusOverview) {
                        $successCount = $statusOverview.successCount
                        $errorCount = $statusOverview.errorCount
                        $conflictCount = $statusOverview.conflictCount
                        $pendingCount = $statusOverview.inProgressCount
                    }
                }
            }
            catch {
                # Status may not be available for all profiles
            }

            $totalDevices = $successCount + $errorCount + $conflictCount + $pendingCount
            $successRate = if ($totalDevices -gt 0) {
                [Math]::Round(($successCount / $totalDevices) * 100, 1)
            } else { $null }

            # Determine profile type and platform
            $profileType = if ($source -eq "configurationPolicies") {
                "Settings Catalog"
            } else {
                Get-ProfileType -ODataType $profile.'@odata.type'
            }

            $platform = if ($source -eq "configurationPolicies" -and $profile.platforms) {
                switch ($profile.platforms) {
                    "windows10" { "Windows" }
                    "android"   { "Android" }
                    "iOS"       { "iOS/iPadOS" }
                    "macOS"     { "macOS" }
                    default     { $profile.platforms }
                }
            } else {
                Get-ProfilePlatform -ODataType $profile.'@odata.type'
            }

            # Build processed profile object
            $processedProfile = [PSCustomObject]@{
                id                   = $profile.id
                displayName          = $profile.displayName -or $profile.name
                description          = $profile.description
                profileType          = $profileType
                platform             = $platform
                source               = $source
                createdDateTime      = Format-IsoDate -DateValue $profile.createdDateTime
                lastModifiedDateTime = Format-IsoDate -DateValue $profile.lastModifiedDateTime
                version              = $profile.version
                # Deployment status
                successDevices       = $successCount
                errorDevices         = $errorCount
                conflictDevices      = $conflictCount
                pendingDevices       = $pendingCount
                notApplicableDevices = $notApplicableCount
                totalDevices         = $totalDevices
                successRate          = $successRate
                # Health indicators
                hasErrors            = ($errorCount -gt 0)
                hasConflicts         = ($conflictCount -gt 0)
                needsAttention       = ($errorCount -gt 0 -or $conflictCount -gt 0)
            }

            $processedProfiles += $processedProfile
            $profileCount++

        }
        catch {
            $errors += "Error processing profile: $($_.Exception.Message)"
        }
    }

    # Sort by success rate (worst first), then by errors
    $processedProfiles = $processedProfiles | Sort-Object -Property @{
        Expression = { if ($null -eq $_.successRate) { 101 } else { $_.successRate } }
    }, @{
        Expression = { $_.errorDevices }
        Descending = $true
    }

    # Save data
    Save-CollectorData -Data $processedProfiles -OutputPath $OutputPath | Out-Null

    Write-Host "    [OK] Collected $profileCount configuration profiles" -ForegroundColor Green

    return New-CollectorResult -Success $true -Count $profileCount -Errors $errors
}
catch {
    $errorMessage = $_.Exception.Message
    $errors += $errorMessage

    if ($errorMessage -match "Intune|license|subscription|permission|forbidden|Authorization") {
        Write-Host "    [!] Configuration profile collection requires Intune license and DeviceManagementConfiguration.Read.All permission" -ForegroundColor Yellow
    }

    Write-Host "    [X] Failed: $errorMessage" -ForegroundColor Red

    Save-CollectorData -Data @() -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

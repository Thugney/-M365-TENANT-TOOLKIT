# ============================================================================
# TenantScope
# Author: Robel (https://github.com/Thugney)
# Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
# License: MIT
# ============================================================================

<#
.SYNOPSIS
    Collects Intune application deployment status and inventory.

.DESCRIPTION
    Retrieves all applications managed by Intune including Win32 apps,
    LOB apps, Microsoft Store apps, and web clips. Shows deployment
    status, installation success/failure rates, and assignment targets.

    Graph API endpoints:
    - GET /deviceAppManagement/mobileApps
    - GET /deviceAppManagement/mobileApps/{id}/assignments
    - GET /deviceAppManagement/mobileApps/{id}/deviceStatuses

    Required scopes:
    - DeviceManagementApps.Read.All

.PARAMETER Config
    The configuration hashtable loaded from config.json.

.PARAMETER OutputPath
    Full path where the resulting JSON file will be saved.

.OUTPUTS
    Writes app-deployments.json to the specified output path.

.EXAMPLE
    $result = & .\collectors\Get-AppDeployments.ps1 -Config $config -OutputPath ".\data\app-deployments.json"
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

function Get-AppType {
    <#
    .SYNOPSIS
        Determines the app type from @odata.type.
    #>
    param([string]$ODataType)

    switch -Regex ($ODataType) {
        "win32LobApp"              { return "Win32" }
        "windowsMobileMSI"         { return "MSI" }
        "windowsUniversalAppX"     { return "MSIX/AppX" }
        "windowsStoreApp"          { return "Store App" }
        "microsoftStoreForBusiness" { return "Store for Business" }
        "officeSuiteApp"           { return "Microsoft 365 Apps" }
        "windowsWebApp"            { return "Web App" }
        "androidStoreApp"          { return "Android Store" }
        "androidLobApp"            { return "Android LOB" }
        "androidManagedStoreApp"   { return "Android Managed" }
        "iosStoreApp"              { return "iOS Store" }
        "iosLobApp"                { return "iOS LOB" }
        "iosVppApp"                { return "iOS VPP" }
        "macOSLobApp"              { return "macOS LOB" }
        "macOSDmgApp"              { return "macOS DMG" }
        "macOSPkgApp"              { return "macOS PKG" }
        "macOSMicrosoftEdgeApp"    { return "macOS Edge" }
        "macOSMicrosoftDefender"   { return "macOS Defender" }
        "webApp"                   { return "Web Link" }
        default                    { return "Other" }
    }
}

function Get-AppPlatform {
    <#
    .SYNOPSIS
        Determines the platform from @odata.type.
    #>
    param([string]$ODataType)

    switch -Regex ($ODataType) {
        "windows|win32|officeSuite" { return "Windows" }
        "android"  { return "Android" }
        "ios"      { return "iOS" }
        "macOS"    { return "macOS" }
        "webApp"   { return "Cross-platform" }
        default    { return "Unknown" }
    }
}

function Get-InstallIntent {
    <#
    .SYNOPSIS
        Maps install intent to readable string.
    #>
    param([string]$Intent)

    switch ($Intent) {
        "required"            { return "Required" }
        "available"           { return "Available" }
        "availableWithoutEnrollment" { return "Available (No Enrollment)" }
        "uninstall"           { return "Uninstall" }
        default               { return $Intent }
    }
}

# ============================================================================
# MAIN COLLECTION LOGIC
# ============================================================================

$errors = @()
$appCount = 0

try {
    Write-Host "    Collecting Intune app deployments..." -ForegroundColor Gray

    # Get all mobile apps
    $apps = Invoke-GraphWithRetry -ScriptBlock {
        Invoke-MgGraphRequest -Method GET `
            -Uri "https://graph.microsoft.com/beta/deviceAppManagement/mobileApps?`$filter=isAssigned eq true" `
            -OutputType PSObject
    } -OperationName "Mobile apps retrieval"

    $allApps = @($apps.value)

    # Handle pagination
    while ($apps.'@odata.nextLink') {
        $apps = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET -Uri $apps.'@odata.nextLink' -OutputType PSObject
        } -OperationName "Mobile apps pagination"
        $allApps += $apps.value
    }

    Write-Host "      Retrieved $($allApps.Count) assigned apps" -ForegroundColor Gray

    $processedApps = @()
    $summary = @{
        totalApps = 0
        win32Apps = 0
        storeApps = 0
        lobApps = 0
        webApps = 0
        m365Apps = 0
        totalInstalled = 0
        totalFailed = 0
        totalPending = 0
    }

    foreach ($app in $allApps) {
        try {
            $appType = Get-AppType -ODataType $app.'@odata.type'
            $platform = Get-AppPlatform -ODataType $app.'@odata.type'

            # Get assignments
            $assignments = @()
            try {
                $assignmentResponse = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceAppManagement/mobileApps/$($app.id)/assignments" `
                    -OutputType PSObject

                foreach ($assignment in $assignmentResponse.value) {
                    $targetType = $assignment.target.'@odata.type'
                    $intent = Get-InstallIntent -Intent $assignment.intent

                    $targetName = switch ($targetType) {
                        "#microsoft.graph.allDevicesAssignmentTarget" { "All Devices" }
                        "#microsoft.graph.allLicensedUsersAssignmentTarget" { "All Users" }
                        "#microsoft.graph.groupAssignmentTarget" { "Group: $($assignment.target.groupId)" }
                        "#microsoft.graph.exclusionGroupAssignmentTarget" { "Exclude: $($assignment.target.groupId)" }
                        default { "Unknown" }
                    }

                    $assignments += @{
                        intent = $intent
                        targetType = $targetType
                        targetName = $targetName
                        groupId = $assignment.target.groupId
                    }
                }
            }
            catch { }

            # Get device install status
            $installedCount = 0
            $failedCount = 0
            $pendingCount = 0
            $notApplicableCount = 0
            $notInstalledCount = 0

            try {
                $deviceStatus = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/beta/deviceAppManagement/mobileApps/$($app.id)/deviceStatuses?`$top=999" `
                    -OutputType PSObject

                foreach ($status in $deviceStatus.value) {
                    switch ($status.installState) {
                        "installed"      { $installedCount++ }
                        "failed"         { $failedCount++ }
                        "pending"        { $pendingCount++ }
                        "notInstalled"   { $notInstalledCount++ }
                        "notApplicable"  { $notApplicableCount++ }
                    }
                }
            }
            catch { }

            $totalDevices = $installedCount + $failedCount + $pendingCount + $notInstalledCount
            $successRate = if ($totalDevices -gt 0) {
                [Math]::Round(($installedCount / $totalDevices) * 100, 1)
            } else { $null }

            # Build processed app object
            $processedApp = [PSCustomObject]@{
                id                   = $app.id
                displayName          = $app.displayName
                description          = $app.description
                publisher            = $app.publisher
                appType              = $appType
                platform             = $platform
                version              = $app.version
                createdDateTime      = Format-IsoDate -DateValue $app.createdDateTime
                lastModifiedDateTime = Format-IsoDate -DateValue $app.lastModifiedDateTime
                isFeatured           = [bool]$app.isFeatured
                privacyInformationUrl = $app.privacyInformationUrl
                informationUrl       = $app.informationUrl
                # Assignments
                assignments          = $assignments
                assignmentCount      = $assignments.Count
                hasRequiredAssignment = ($assignments | Where-Object { $_.intent -eq "Required" }).Count -gt 0
                # Installation status
                installedDevices     = $installedCount
                failedDevices        = $failedCount
                pendingDevices       = $pendingCount
                notInstalledDevices  = $notInstalledCount
                notApplicableDevices = $notApplicableCount
                totalDevices         = $totalDevices
                successRate          = $successRate
                # Health
                hasFailures          = ($failedCount -gt 0)
                needsAttention       = ($failedCount -gt 5 -or ($successRate -and $successRate -lt 80))
            }

            $processedApps += $processedApp
            $appCount++

            # Update summary
            $summary.totalApps++
            $summary.totalInstalled += $installedCount
            $summary.totalFailed += $failedCount
            $summary.totalPending += $pendingCount

            switch ($appType) {
                "Win32"              { $summary.win32Apps++ }
                "Store App"          { $summary.storeApps++ }
                "Store for Business" { $summary.storeApps++ }
                "Microsoft 365 Apps" { $summary.m365Apps++ }
                "Web Link"           { $summary.webApps++ }
                "Web App"            { $summary.webApps++ }
                { $_ -match "LOB" }  { $summary.lobApps++ }
            }

            # Progress indicator
            if ($appCount % 20 -eq 0) {
                Write-Host "      Processed $appCount apps..." -ForegroundColor Gray
            }
        }
        catch {
            $errors += "Error processing app $($app.displayName): $($_.Exception.Message)"
        }
    }

    # Sort by failure count (most failures first)
    $processedApps = $processedApps | Sort-Object -Property @{
        Expression = { $_.failedDevices }
        Descending = $true
    }, @{
        Expression = { if ($null -eq $_.successRate) { 101 } else { $_.successRate } }
    }

    # Build output
    $output = @{
        apps = $processedApps
        summary = $summary
        collectionDate = (Get-Date).ToString("o")
    }

    # Save data
    Save-CollectorData -Data $output -OutputPath $OutputPath | Out-Null

    Write-Host "    [OK] Collected $appCount app deployments" -ForegroundColor Green

    return New-CollectorResult -Success $true -Count $appCount -Errors $errors
}
catch {
    $errorMessage = $_.Exception.Message
    $errors += $errorMessage

    if ($errorMessage -match "Intune|license|subscription|permission|forbidden|Authorization") {
        Write-Host "    [!] App deployment collection requires Intune license and DeviceManagementApps.Read.All permission" -ForegroundColor Yellow
    }

    Write-Host "    [X] Failed: $errorMessage" -ForegroundColor Red

    Save-CollectorData -Data @{
        apps = @()
        summary = @{}
    } -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

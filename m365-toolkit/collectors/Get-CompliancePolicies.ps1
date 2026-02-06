# ============================================================================
# TenantScope
# Author: Robel (https://github.com/Thugney)
# Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
# License: MIT
# ============================================================================

<#
.SYNOPSIS
    Collects Intune device compliance policies and their status.

.DESCRIPTION
    Retrieves all device compliance policies from Microsoft Intune including
    policy settings, assignments, and device compliance status per policy.
    This enables visibility into which policies exist, their targets, and
    compliance rates.

    Graph API endpoints:
    - GET /deviceManagement/deviceCompliancePolicies
    - GET /deviceManagement/deviceCompliancePolicies/{id}/assignments
    - GET /deviceManagement/deviceCompliancePolicies/{id}/deviceStatuses

    Required scopes:
    - DeviceManagementConfiguration.Read.All

.PARAMETER Config
    The configuration hashtable loaded from config.json.

.PARAMETER OutputPath
    Full path where the resulting JSON file will be saved.

.OUTPUTS
    Writes compliance-policies.json to the specified output path. Returns a hashtable with:
    - Success: [bool] whether collection completed
    - Count: [int] number of policies collected
    - Errors: [array] any errors encountered

.EXAMPLE
    $result = & .\collectors\Get-CompliancePolicies.ps1 -Config $config -OutputPath ".\data\compliance-policies.json"
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

function Get-PolicyPlatform {
    <#
    .SYNOPSIS
        Extracts the platform from the policy @odata.type.
    #>
    param([string]$ODataType)

    switch -Regex ($ODataType) {
        "windows10"    { return "Windows 10/11" }
        "windows81"    { return "Windows 8.1" }
        "windowsPhone" { return "Windows Phone" }
        "android"      { return "Android" }
        "androidWork"  { return "Android Enterprise" }
        "ios"          { return "iOS/iPadOS" }
        "macOS"        { return "macOS" }
        default        { return "Unknown" }
    }
}

function Get-AssignmentTarget {
    <#
    .SYNOPSIS
        Parses assignment target into readable format.
    #>
    param($Assignment)

    $targetType = $Assignment.target.'@odata.type'

    switch ($targetType) {
        "#microsoft.graph.allDevicesAssignmentTarget" {
            return @{ type = "AllDevices"; name = "All Devices" }
        }
        "#microsoft.graph.allLicensedUsersAssignmentTarget" {
            return @{ type = "AllUsers"; name = "All Users" }
        }
        "#microsoft.graph.groupAssignmentTarget" {
            return @{
                type = "Group"
                groupId = $Assignment.target.groupId
                name = "Group: $($Assignment.target.groupId)"
            }
        }
        "#microsoft.graph.exclusionGroupAssignmentTarget" {
            return @{
                type = "ExcludeGroup"
                groupId = $Assignment.target.groupId
                name = "Exclude: $($Assignment.target.groupId)"
            }
        }
        default {
            return @{ type = "Unknown"; name = "Unknown" }
        }
    }
}

# ============================================================================
# MAIN COLLECTION LOGIC
# ============================================================================

$errors = @()
$policyCount = 0

try {
    Write-Host "    Collecting device compliance policies..." -ForegroundColor Gray

    # Get all compliance policies
    $policies = Invoke-GraphWithRetry -ScriptBlock {
        Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies" -OutputType PSObject
    } -OperationName "Compliance policy retrieval"

    $allPolicies = @($policies.value)

    # Handle pagination
    while ($policies.'@odata.nextLink') {
        $policies = Invoke-GraphWithRetry -ScriptBlock {
            Invoke-MgGraphRequest -Method GET -Uri $policies.'@odata.nextLink' -OutputType PSObject
        } -OperationName "Compliance policy pagination"
        $allPolicies += $policies.value
    }

    Write-Host "      Retrieved $($allPolicies.Count) compliance policies" -ForegroundColor Gray

    $processedPolicies = @()

    foreach ($policy in $allPolicies) {
        try {
            # Get assignments for this policy
            $assignments = @()
            try {
                $assignmentResponse = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies/$($policy.id)/assignments" `
                    -OutputType PSObject

                foreach ($assignment in $assignmentResponse.value) {
                    $target = Get-AssignmentTarget -Assignment $assignment
                    $assignments += $target
                }
            }
            catch {
                # Some policies may not have assignments accessible
            }

            # Get device status summary for this policy
            $compliantCount = 0
            $nonCompliantCount = 0
            $errorCount = 0
            $conflictCount = 0
            $notApplicableCount = 0

            try {
                $statusSummary = Invoke-MgGraphRequest -Method GET `
                    -Uri "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies/$($policy.id)/deviceStatusOverview" `
                    -OutputType PSObject

                $compliantCount = $statusSummary.compliantDeviceCount
                $nonCompliantCount = $statusSummary.nonCompliantDeviceCount
                $errorCount = $statusSummary.errorDeviceCount
                $conflictCount = $statusSummary.conflictDeviceCount
                $notApplicableCount = $statusSummary.notApplicableDeviceCount
            }
            catch {
                # Status overview may not be available
            }

            $totalDevices = $compliantCount + $nonCompliantCount + $errorCount + $conflictCount
            $complianceRate = if ($totalDevices -gt 0) {
                [Math]::Round(($compliantCount / $totalDevices) * 100, 1)
            } else { $null }

            # Build processed policy object
            $processedPolicy = [PSCustomObject]@{
                id                   = $policy.id
                displayName          = $policy.displayName
                description          = $policy.description
                platform             = Get-PolicyPlatform -ODataType $policy.'@odata.type'
                odataType            = $policy.'@odata.type'
                createdDateTime      = Format-IsoDate -DateValue $policy.createdDateTime
                lastModifiedDateTime = Format-IsoDate -DateValue $policy.lastModifiedDateTime
                version              = $policy.version
                assignments          = $assignments
                assignmentCount      = $assignments.Count
                # Device status
                compliantDevices     = $compliantCount
                nonCompliantDevices  = $nonCompliantCount
                errorDevices         = $errorCount
                conflictDevices      = $conflictCount
                notApplicableDevices = $notApplicableCount
                totalDevices         = $totalDevices
                complianceRate       = $complianceRate
                # Health status
                hasIssues            = ($nonCompliantCount -gt 0 -or $errorCount -gt 0 -or $conflictCount -gt 0)
            }

            $processedPolicies += $processedPolicy
            $policyCount++

        }
        catch {
            $errors += "Error processing policy $($policy.displayName): $($_.Exception.Message)"
        }
    }

    # Sort by compliance rate (worst first)
    $processedPolicies = $processedPolicies | Sort-Object -Property @{
        Expression = { if ($null -eq $_.complianceRate) { 101 } else { $_.complianceRate } }
    }

    # Save data
    Save-CollectorData -Data $processedPolicies -OutputPath $OutputPath | Out-Null

    Write-Host "    [OK] Collected $policyCount compliance policies" -ForegroundColor Green

    return New-CollectorResult -Success $true -Count $policyCount -Errors $errors
}
catch {
    $errorMessage = $_.Exception.Message
    $errors += $errorMessage

    if ($errorMessage -match "Intune|license|subscription|permission|forbidden|Authorization") {
        Write-Host "    [!] Compliance policy collection requires Intune license and DeviceManagementConfiguration.Read.All permission" -ForegroundColor Yellow
    }

    Write-Host "    [X] Failed: $errorMessage" -ForegroundColor Red

    Save-CollectorData -Data @() -OutputPath $OutputPath | Out-Null

    return New-CollectorResult -Success $false -Count 0 -Errors $errors
}

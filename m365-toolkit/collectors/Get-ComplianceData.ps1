#Requires -Version 7.0
<#
.SYNOPSIS
    Collects device compliance summary data from Microsoft Graph.

.DESCRIPTION
    Aggregates device compliance status across all managed devices
    and breaks down by OS type and compliance state.

.PARAMETER Devices
    Array of device objects (from Get-DeviceData).

.OUTPUTS
    Compliance summary object saved to data/compliance.json
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [array]$Devices
)

function Get-ComplianceData {
    param([array]$Devices)

    Write-Host "Calculating compliance summary..." -ForegroundColor Cyan

    if (-not $Devices -or $Devices.Count -eq 0) {
        Write-Host "   No device data provided" -ForegroundColor Yellow
        return @{
            totalDevices      = 0
            compliant         = 0
            nonCompliant      = 0
            unknown           = 0
            complianceRate    = 0
            byOS              = @{}
            byOwnership       = @{}
        }
    }

    try {
        # Overall counts
        $totalDevices = $Devices.Count
        $compliant = ($Devices | Where-Object { $_.complianceState -eq 'compliant' }).Count
        $nonCompliant = ($Devices | Where-Object { $_.complianceState -eq 'noncompliant' }).Count
        $unknown = ($Devices | Where-Object { $_.complianceState -eq 'unknown' }).Count

        # Calculate compliance rate (excluding unknown)
        $knownDevices = $compliant + $nonCompliant
        $complianceRate = if ($knownDevices -gt 0) {
            [math]::Round(($compliant / $knownDevices) * 100, 1)
        } else { 0 }

        # Group by OS
        $byOS = @{}
        $osGroups = $Devices | Group-Object -Property os
        foreach ($group in $osGroups) {
            $osCompliant = ($group.Group | Where-Object { $_.complianceState -eq 'compliant' }).Count
            $osNonCompliant = ($group.Group | Where-Object { $_.complianceState -eq 'noncompliant' }).Count
            $osUnknown = ($group.Group | Where-Object { $_.complianceState -eq 'unknown' }).Count

            $byOS[$group.Name] = @{
                total        = $group.Count
                compliant    = $osCompliant
                nonCompliant = $osNonCompliant
                unknown      = $osUnknown
            }
        }

        # Group by ownership
        $byOwnership = @{}
        $ownershipGroups = $Devices | Group-Object -Property ownership
        foreach ($group in $ownershipGroups) {
            $ownerCompliant = ($group.Group | Where-Object { $_.complianceState -eq 'compliant' }).Count
            $ownerNonCompliant = ($group.Group | Where-Object { $_.complianceState -eq 'noncompliant' }).Count

            $byOwnership[$group.Name] = @{
                total        = $group.Count
                compliant    = $ownerCompliant
                nonCompliant = $ownerNonCompliant
            }
        }

        $summary = @{
            totalDevices   = $totalDevices
            compliant      = $compliant
            nonCompliant   = $nonCompliant
            unknown        = $unknown
            complianceRate = $complianceRate
            byOS           = $byOS
            byOwnership    = $byOwnership
        }

        Write-Host "   Compliance rate: $complianceRate% ($compliant compliant, $nonCompliant non-compliant)" -ForegroundColor Green
        return $summary
    }
    catch {
        Write-Host "   Error calculating compliance data: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Export function for use by main collector
if ($MyInvocation.InvocationName -ne '.') {
    Get-ComplianceData -Devices $Devices
}

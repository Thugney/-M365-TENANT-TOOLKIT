#Requires -Version 7.0
<#
.SYNOPSIS
    Collects Intune managed device data from Microsoft Graph.

.DESCRIPTION
    Retrieves all managed devices from Intune, calculates sync status,
    and identifies stale devices.

.PARAMETER Config
    Configuration hashtable with thresholds and settings.

.OUTPUTS
    Array of device objects saved to data/devices.json
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [hashtable]$Config
)

function Get-DeviceData {
    param([hashtable]$Config)

    Write-Host "Collecting device data..." -ForegroundColor Cyan

    $staleDeviceDays = $Config.thresholds.staleDeviceDays ?? 90

    try {
        # Get all managed devices
        $devices = Get-MgDeviceManagementManagedDevice -All -Property @(
            'id',
            'deviceName',
            'managedDeviceOwnerType',
            'operatingSystem',
            'osVersion',
            'complianceState',
            'lastSyncDateTime',
            'enrolledDateTime',
            'manufacturer',
            'model',
            'serialNumber',
            'userPrincipalName',
            'managementAgent',
            'deviceEnrollmentType',
            'isEncrypted',
            'autopilotEnrolled'
        )

        Write-Host "   Found $($devices.Count) managed devices" -ForegroundColor Gray

        $processedDevices = @()
        $counter = 0

        foreach ($device in $devices) {
            $counter++
            if ($counter % 100 -eq 0) {
                Write-Host "   Processing devices... $counter/$($devices.Count)" -ForegroundColor Gray
            }

            # Calculate days since last sync
            $daysSinceSync = $null
            if ($device.LastSyncDateTime) {
                $daysSinceSync = [math]::Floor(((Get-Date) - $device.LastSyncDateTime).TotalDays)
            }

            # Determine if stale
            $isStale = $false
            if ($null -eq $daysSinceSync -or $daysSinceSync -ge $staleDeviceDays) {
                $isStale = $true
            }

            # Map OS name
            $os = switch -Regex ($device.OperatingSystem) {
                'Windows' { 'Windows' }
                'iOS' { 'iOS' }
                'Android' { 'Android' }
                'macOS|Mac OS' { 'macOS' }
                default { $device.OperatingSystem }
            }

            # Map ownership
            $ownership = switch ($device.ManagedDeviceOwnerType) {
                'company' { 'corporate' }
                'personal' { 'personal' }
                default { 'unknown' }
            }

            # Map compliance state
            $complianceState = switch ($device.ComplianceState) {
                'compliant' { 'compliant' }
                'noncompliant' { 'noncompliant' }
                default { 'unknown' }
            }

            $processedDevices += [PSCustomObject]@{
                id                = $device.Id
                deviceName        = $device.DeviceName
                userPrincipalName = $device.UserPrincipalName
                os                = $os
                osVersion         = $device.OsVersion
                complianceState   = $complianceState
                lastSync          = $device.LastSyncDateTime
                daysSinceSync     = $daysSinceSync
                isStale           = $isStale
                enrolledDateTime  = $device.EnrolledDateTime
                ownership         = $ownership
                manufacturer      = $device.Manufacturer
                model             = $device.Model
                serialNumber      = $device.SerialNumber
                isEncrypted       = $device.IsEncrypted ?? $false
                managementAgent   = $device.ManagementAgent
            }
        }

        Write-Host "   Processed $($processedDevices.Count) devices" -ForegroundColor Green
        return $processedDevices
    }
    catch {
        Write-Host "   Error collecting device data: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Export function for use by main collector
if ($MyInvocation.InvocationName -ne '.') {
    # Running directly - return results
    if (-not $Config) {
        $Config = @{
            thresholds = @{
                staleDeviceDays = 90
            }
        }
    }
    Get-DeviceData -Config $Config
}

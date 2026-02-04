#Requires -Version 7.0
<#
.SYNOPSIS
    Collects Windows Autopilot device data from Microsoft Graph.

.DESCRIPTION
    Retrieves all Windows Autopilot device identities including
    enrollment state and profile assignment status.

.OUTPUTS
    Array of Autopilot device objects saved to data/autopilot.json
#>

[CmdletBinding()]
param()

function Get-AutopilotData {
    Write-Host "Collecting Autopilot data..." -ForegroundColor Cyan

    try {
        # Get all Autopilot devices
        $autopilotDevices = Get-MgDeviceManagementWindowsAutopilotDeviceIdentity -All -Property @(
            'id',
            'serialNumber',
            'model',
            'manufacturer',
            'groupTag',
            'enrollmentState',
            'lastContactedDateTime',
            'deploymentProfileAssignmentStatus',
            'purchaseOrderIdentifier'
        )

        Write-Host "   Found $($autopilotDevices.Count) Autopilot devices" -ForegroundColor Gray

        $processedDevices = @()

        foreach ($device in $autopilotDevices) {
            # Map enrollment state
            $enrollmentState = switch ($device.EnrollmentState) {
                'enrolled' { 'enrolled' }
                'notContacted' { 'notContacted' }
                'failed' { 'failed' }
                'pending' { 'pending' }
                default { $device.EnrollmentState }
            }

            # Determine if profile is assigned
            $profileAssigned = $device.DeploymentProfileAssignmentStatus -eq 'assigned' -or
                               $device.DeploymentProfileAssignmentStatus -eq 'assignedInSync'

            $processedDevices += [PSCustomObject]@{
                id              = $device.Id
                serialNumber    = $device.SerialNumber
                model           = $device.Model
                manufacturer    = $device.Manufacturer
                groupTag        = $device.GroupTag
                enrollmentState = $enrollmentState
                lastContacted   = $device.LastContactedDateTime
                profileAssigned = $profileAssigned
                purchaseOrder   = $device.PurchaseOrderIdentifier
            }
        }

        Write-Host "   Processed $($processedDevices.Count) Autopilot devices" -ForegroundColor Green
        return $processedDevices
    }
    catch {
        Write-Host "   Error collecting Autopilot data: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Export function for use by main collector
if ($MyInvocation.InvocationName -ne '.') {
    Get-AutopilotData
}

# Autopilot Collector Review

**Collector**: `collectors/Get-AutopilotData.ps1`  
**Dashboard pages**: Devices (Autopilot tab)

## Status
PASS (no required-field gaps found)

## Required Dashboard Fields (Autopilot)
`id`, `serialNumber`, `model`, `manufacturer`, `groupTag`,  
`enrollmentState`, `lastContacted`,  
`profileAssigned`, `profileAssignmentStatus`,  
`purchaseOrder`

## Collector Coverage
- All required fields above are produced.
- Handles both cmdlet (PascalCase) and direct API (camelCase) property names.
- Uses live Graph data (no sample/static data paths).

## Graph Collection Details
- Endpoint: `GET /deviceManagement/windowsAutopilotDeviceIdentities` (fallback to direct REST).
- Required scopes: `DeviceManagementServiceConfig.Read.All`.
- Output file: `data/autopilot.json`.

## Risks / Notes
- `profileAssigned` is inferred from `deploymentProfileAssignmentStatus` and/or assigned date; status values include `assignedInSync`, `assignedOutOfSync`, `assignedUnkownSyncState`, `pending`.
- Enrollment state is normalized via `Get-EnrollmentStateName` and may return raw values for unexpected enums.

## Duplicate Code Check
- PascalCase/camelCase normalization now uses shared `Get-GraphPropertyValue` (duplicate removed).

# Windows Update Status Collector Review

**Collector**: `collectors/Get-WindowsUpdateStatus.ps1`  
**Dashboard pages**: Windows Update Status

## Status
PASS with risks (device compliance uses heuristic logic)

## Required Dashboard Fields (Windows Update)
**Update Rings**
`id`, `displayName`, `description`, `createdDateTime`, `lastModifiedDateTime`,  
`qualityUpdatesDeferralDays`, `featureUpdatesDeferralDays`,  
`qualityUpdatesPaused`, `featureUpdatesPaused`,  
`deadlineForQualityUpdates`, `deadlineForFeatureUpdates`, `deadlineGracePeriod`,  
`automaticUpdateMode`, `microsoftUpdateServiceAllowed`, `driversExcluded`, `allowWindows11Upgrade`,  
`assignedGroups`, `successDevices`, `errorDevices`, `pendingDevices`, `totalDevices`

**Feature Updates**
`id`, `displayName`, `description`, `featureUpdateVersion`, `rolloutSettings`, `endOfSupportDate`,  
`createdDateTime`, `lastModifiedDateTime`, `assignedGroups`,  
`deploymentState.total`, `deploymentState.succeeded`, `deploymentState.pending`, `deploymentState.failed`, `deploymentState.notApplicable`

**Quality Updates**
`id`, `displayName`, `description`, `releaseDateDisplayName`, `qualityUpdateClassification`,  
`isExpedited`, `expeditedUpdateSettings`, `createdDateTime`, `lastModifiedDateTime`, `assignedGroups`,  
`deploymentState.total`, `deploymentState.succeeded`, `deploymentState.pending`, `deploymentState.failed`,  
`progressPercent`

**Driver Updates**
`id`, `displayName`, `driverClass`, `manufacturer`, `version`, `releaseDateTime`,  
`approvalStatus`, `applicableDeviceCount`, `profileName`,  
`deploymentState.total`, `deploymentState.succeeded`, `deploymentState.pending`, `deploymentState.failed`

**Device Compliance**
`deviceName`, `userPrincipalName`, `updateStatus`, `updateRing`, `errorDetails`, `lastSyncDateTime`

**Summary (used by page)**
`totalRings`, `totalFeaturePolicies`, `totalQualityPolicies`, `totalDriverUpdates`,  
`totalManagedDevices`, `devicesUpToDate`, `devicesPendingUpdate`, `devicesWithErrors`,  
`complianceRate`, `pausedRings`, `expeditedUpdatesActive`, `driversNeedingReview`

## Collector Coverage
- All required **ring/feature/quality/driver/deviceCompliance** fields are produced.
- Summary now includes `driversNeedingReview`.
- Uses live Graph data (no sample/static data paths).

## Gaps / Risks
- **Device compliance logic is placeholder**:
  - `updateStatus` is derived from **last sync recency**, not true update state.
  - `updateRing` is assigned to the **first ring** as a placeholder (no group membership resolution).
  These make real-tenant outputs misleading for device compliance and error lists.
- Summary now uses the deviceCompliance counts when available, but the underlying heuristic remains.

## Graph Collection Details
- Endpoints (beta-heavy):
  - `/beta/deviceManagement/deviceConfigurations` (update rings)
  - `/beta/deviceManagement/windowsFeatureUpdateProfiles`
  - `/beta/deviceManagement/windowsQualityUpdateProfiles`
  - `/beta/deviceManagement/windowsDriverUpdateProfiles`
  - `/beta/deviceManagement/managedDevices` (Windows only)
- Required scopes: `DeviceManagementConfiguration.Read.All`.
- Output file: `data/windows-update-status.json`.

## Suggested Fix (to close gaps)
- Replace device compliance heuristics with **real update state** (e.g., device update states per ring/profile) and resolve ring membership via assignments + group membership.

## Duplicate Code Check
- No new duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

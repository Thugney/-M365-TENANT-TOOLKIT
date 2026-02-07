# Devices Collector Review

**Collector**: `collectors/Get-DeviceData.ps1`  
**Dashboard pages**: Devices, Overview, Executive Report

## Status
PASS

## Required Dashboard Fields (Devices)
**Device rows**
`id`, `deviceName`, `managedDeviceName`, `userPrincipalName`, `primaryUserDisplayName`, `azureAdDeviceId`,  
`os`, `osVersion`, `windowsType`, `windowsRelease`, `windowsEOL`, `windowsSupported`, `androidSecurityPatchLevel`,  
`complianceState`, `inGracePeriod`, `complianceGraceDays`,  
`lastSync`, `daysSinceSync`, `isStale`,  
`ownership`, `enrollmentTypeDisplay`, `registrationStateDisplay`, `enrollmentProfileName`, `enrolledDateTime`, `autopilotEnrolled`,  
`manufacturer`, `model`, `serialNumber`, `chassisType`, `deviceCategory`, `physicalMemoryGB`,  
`isEncrypted`, `jailBroken`, `isSupervised`, `threatStateDisplay`, `threatSeverity`, `activationLockBypass`,  
`joinType`, `managementAgent`,  
`certStatus`, `daysUntilCertExpiry`, `certExpiryDate`,  
`exchangeAccessDisplay`, `exchangeAccessReason`, `easActivated`, `exchangeLastSync`,  
`totalStorageGB`, `freeStorageGB`, `storageUsedPct`,  
`wifiMacAddress`, `ethernetMacAddress`, `phoneNumber`, `subscriberCarrier`,  
`imei`, `meid`, `iccid`, `udid`, `notes`

**Summary fields expected by the Devices page**
`totalDevices`, `compliantDevices`, `noncompliantDevices`, `unknownDevices`, `complianceRate`,  
`encryptedDevices`, `notEncryptedDevices`, `staleDevices`,  
`certExpired`, `certCritical`, `certWarning`, `certHealthy`, `certUnknown`,  
`win10Count`, `win11Count`, `winSupportedCount`, `winUnsupportedCount`,  
`corporateDevices`, `personalDevices`,  
`osBreakdown` (object map), `manufacturerBreakdown` (object map)

## Collector Coverage
- All required **device row** fields are produced.
- Summary now includes **both** collector-style and UI-style keys (`compliant` + `compliantDevices`, etc.), so the Devices page renders correctly regardless of which schema it reads.
- Breakdown shapes now include **maps** (`osBreakdown`, `manufacturerBreakdown`) and **arrays** (`osBreakdownArray`, `manufacturerBreakdownArray`) for compatibility.
- `isEncrypted` now preserves `$null` when unknown instead of coercing to `false`.
- Uses live Graph data (no sample/static data paths).

## Sample Data Comparison
**Sample file**: `data/sample/devices.json`
- Sample **device rows** align with collector output (field names match).
- Sample **summary** uses the collector schema (`compliant`, `noncompliant`, `windows10`, etc.); collector now emits both schemas and UI normalizes both.
- Sample **breakdowns** (`osBreakdown`, `manufacturerBreakdown`) are arrays of `{ name, count }`; collector now emits both arrays and maps and UI accepts both.

## Gaps / Risks
- No material gaps detected after schema alignment and encryption null handling.

## Graph Collection Details
- Endpoint: `GET /deviceManagement/managedDevices` (extended properties via `-Property`).
- Required scopes: `DeviceManagementManagedDevices.Read.All`.
- Output file: `data/devices.json`.

## Suggested Fix (to close gaps)
- Implemented: summary key alignment, breakdown map support, and `isEncrypted` null preservation.

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

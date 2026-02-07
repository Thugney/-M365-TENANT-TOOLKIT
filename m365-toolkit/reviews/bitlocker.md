# BitLocker Collector Review

**Collector**: `collectors/Get-BitLockerStatus.ps1`  
**Dashboard pages**: BitLocker Status

## Status
PASS (no required-field gaps found)

## Required Dashboard Fields (BitLocker)
**Device rows**
`id`, `deviceName`, `userPrincipalName`, `manufacturer`, `model`, `serialNumber`, `osVersion`,  
`complianceState`, `lastSyncDateTime`, `daysSinceSync`,  
`isEncrypted`, `encryptionState`, `needsEncryption`,  
`recoveryKeyEscrowed`, `recoveryKeyCount`, `recoveryKeys[]`,  
`hasRecoveryKey`

**Summary**
`totalDevices`, `encryptedDevices`, `notEncryptedDevices`, `unknownDevices`,  
`devicesWithRecoveryKeys`, `encryptionRate`, `manufacturerBreakdown`, `osBreakdown`

## Collector Coverage
- All required fields above are produced.
- `recoveryKeyEscrowed` is derived from recovery key presence for UI compatibility.
- Uses live Graph data (no sample/static data paths).

## Risks / Notes
- `isEncrypted` is forced to `[bool]`; if Graph returns `null`, it becomes `false` and can over-count “Not Encrypted”.
- Recovery keys retrieval needs `BitLockerKey.ReadBasic.All` or `BitLockerKey.Read.All`; without it, `recoveryKeyEscrowed` will be false for all devices.

## Graph Collection Details
- Endpoints:
  - `GET /deviceManagement/managedDevices` (Windows devices; no `$select`)
  - `GET /informationProtection/bitlocker/recoveryKeys`
- Required scopes: `DeviceManagementManagedDevices.Read.All` and `BitLockerKey.Read.All` (for keys).
- Output file: `data/bitlocker-status.json`.

## Duplicate Code Check
- No new duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

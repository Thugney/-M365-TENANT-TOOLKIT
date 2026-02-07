# Users Collector Review

**Collector**: `collectors/Get-UserData.ps1`  
**Dashboard pages**: Users, Data Quality, Organization, Security, Lifecycle, App Usage, License Analysis, Overview

## Status
PASS with risks (sign-in licensing + inactive threshold + direct/group license counts)

## Required Dashboard Fields (Users)
`id`, `displayName`, `userPrincipalName`, `mail`, `domain`, `accountEnabled`, `userSource`,
`department`, `jobTitle`, `companyName`, `officeLocation`, `city`, `country`, `usageLocation`,
`manager`, `createdDateTime`, `lastSignIn`, `daysSinceLastSignIn`,
`mfaRegistered`, `licenseCount`, `assignedSkuIds`, `flags`, `isInactive`, `onPremSync`

## Collector Coverage
- All required fields above are produced.
- Additional fields produced for Data Quality and Org analysis: `mobilePhone`, `managerId`, `managerUpn`, `managerMail`, `jobTitle`, `companyName`, `officeLocation`, `city`, `country`, `usageLocation`.
- `mfaRegistered` defaults to `true` and is corrected by MFA cross‑reference in the pipeline.
- `flags` includes `disabled` and `inactive`; `admin` is added later by cross‑reference.

## Sample Data Comparison
**Sample file**: `data/sample/users.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Sample includes `flags: ["admin"]`, which the collector does **not** set directly; this relies on the admin-role cross‑reference step.

## Gaps / Risks
- **Sign‑in licensing**: `signInActivity` requires Entra ID P1/P2. If unavailable, `lastSignIn` is null and `Get-ActivityStatus` treats activity as `unknown`, resulting in `isInactive = false` for all users. Inactive user counts will be under‑reported.
- **Inactive threshold**: `inactiveThreshold` is pulled from `config.json`. If missing or null, PowerShell treats the int parameter as `0`, which can mark all users inactive. Current sample config sets `inactiveDays: 90`, so this is only a risk if config is altered or missing.
- **Direct vs group license counts**: `directLicenseCount` and `groupLicenseCount` are only incremented when `licenseAssignmentStates` is populated. If Graph omits `licenseAssignmentStates`, counts stay `0` even when licenses exist (while `assignedLicenses` still shows `assignmentSource: Direct`).
- **Manager expansion**: manager fields rely on `-ExpandProperty "manager"`. If the Graph response omits `AdditionalProperties`, org hierarchy will show more orphan users.
- **MFA cross‑reference dependency**: if MFA collection fails, all users remain `mfaRegistered = true`, and security/MFA insights will be inaccurate.

## Graph Collection Details
- Endpoint: `GET /users` with `$select` and `$expand=manager`.
- Required scopes: `User.Read.All`, `AuditLog.Read.All` (for `signInActivity`).
- Output file: `data/users.json`.

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

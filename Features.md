# TenantScope - Planned Features

> Features prioritized for implementation. Device Actions and Copilot Agents excluded for now (write-scope risk and no Graph API respectively).

---

## Feature 1: Managed Device Certificate Renewal

**Priority:** High (low effort, high value)
**Status:** Implemented (v1.1.0)
**Docs:** https://learn.microsoft.com/en-us/windows/client-management/certificate-renewal-windows-mdm

### Goal

Overview of Intune managed devices with expiring or expired MDM certificates. Early warning for certificate renewals to prevent enrollment drops.

### Data Points

| Column | Source |
|--------|--------|
| Device Name | `deviceName` |
| User | `userPrincipalName` |
| OS / OS Version | `operatingSystem`, `osVersion` |
| Certificate Expiry Date | `managedDeviceCertificateExpirationDate` |
| Days Until Expiry | Calculated |
| Compliance State | `complianceState` |
| Last Sync | `lastSyncDateTime` |

### Dashboard Filters

- Expired
- Expiring in 30 days
- Expiring in 60 days
- Expiring in 90 days

### Implementation

- Extend existing `Get-DeviceData.ps1` collector to include `managedDeviceCertificateExpirationDate` in the `$select` query
- Add certificate expiry section to the Devices dashboard page
- No new Graph scopes needed (`DeviceManagementManagedDevices.Read.All` already covers this)

---

## Feature 2: Windows Health Report + M365 Message Center

**Priority:** Medium
**Status:** Planned

### 2a: Windows Health Report

**Docs:** https://learn.microsoft.com/nb-no/graph/api/resources/windowsupdates-product?view=graph-rest-beta

#### Goal

Overview of Windows Update health status across managed devices. Track update compliance, known issues, and safeguard holds.

#### Graph API

- `GET /admin/windows/updates/products` (beta)
- New scope required: `WindowsUpdates.ReadWrite.All`

#### Implementation

- New collector: `Get-WindowsHealthData.ps1`
- New dashboard page: Windows Health
- Note: Beta API - may change before GA

### 2b: M365 Message Center

**Docs:** https://learn.microsoft.com/en-us/microsoft-365/admin/manage/message-center?view=o365-worldwide

#### Goal

Track service announcements, planned changes, and feature rollouts from the M365 Message Center. Stay ahead of changes affecting the tenant.

#### Data Points

| Column | Source |
|--------|--------|
| Title | `title` |
| Service | `services[]` |
| Category | `category` (Plan for change, Stay informed, Prevent or fix issues) |
| Severity | `severity` |
| Published Date | `startDateTime` |
| Action Required By | `actionRequiredByDateTime` |
| Status | `status` (read/unread) |
| Tags | `tags[]` |

#### Dashboard Filters

- By service (Teams, Exchange, SharePoint, Intune, etc.)
- By category
- By severity
- Action required vs informational

#### Implementation

- New collector: `Get-MessageCenterData.ps1`
- Graph API: `GET /admin/serviceAnnouncement/messages` (v1.0, stable)
- New scope required: `ServiceMessage.Read.All`
- New dashboard page or section

---

## Feature 3: Enterprise Applications Overview

**Priority:** High (moderate effort, high value)
**Status:** Implemented (v1.1.0)

### Goal

Overview of all enterprise applications (service principals) and app registrations with credential expiry tracking, status, and permission grants.

### Data Points

| Column | Source |
|--------|--------|
| App Display Name | `displayName` |
| App ID | `appId` |
| Status | `accountEnabled` (active/disabled) |
| Secret Expiry | `passwordCredentials[].endDateTime` |
| Certificate Expiry | `keyCredentials[].endDateTime` |
| Credential Status | Calculated (valid, expiring soon, expired) |
| Sign-in Activity | `servicePrincipalSignInActivities` (beta) |
| Permissions | `oauth2PermissionGrants`, `appRoleAssignments` |
| Publisher | `publisherName` |
| Created Date | `createdDateTime` |

### Dashboard Filters

- Credential status: Expired / Expiring in 30d / Expiring in 90d / Valid
- App status: Active / Disabled
- Publisher: First-party (Microsoft) / Third-party
- Permission level: High privilege / Standard

### Implementation

- New collector: `Get-EnterpriseAppData.ps1`
- Graph API: `GET /servicePrincipals`, `GET /applications`
- New scope required: `Application.Read.All`
- New dashboard page: Enterprise Apps

---

## Excluded (for now)

### Intune Device Actions (Remote Actions)

**Reason:** Requires write scopes (`DeviceManagementManagedDevices.ReadWrite.All`) and introduces destructive operations (Wipe, Fresh Start). Will be revisited as a separate tool under `m365-toolkit/tools/` with proper safety controls and audit logging.

### Copilot Agents Overview

**Reason:** No Graph API available. Management is limited to the M365 admin center UI. Will revisit if Microsoft exposes a programmatic API.

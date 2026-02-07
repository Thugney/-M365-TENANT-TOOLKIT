# Collector Breakdown

This document explains how each collector gathers data, which Graph endpoints and scopes it uses, and the shape of its output. It is intended for internal documentation and operational support.

## Conventions Used By All Collectors

- Location: `collectors/*.ps1`
- Parameters: `-Config` and `-OutputPath`
- Shared helpers: `lib/CollectorBase.ps1` for retries, date math, formatting, and output handling
- Output: JSON written to `data/`, with empty data written on failure to keep the dashboard stable
- Return value: `New-CollectorResult` with `Success`, `Count`, and `Errors`

## Identity & Access

**Get-UserData.ps1**
- Purpose: Full user inventory for Entra ID (excluding guests), enriched with activity and licensing.
- Endpoints: `GET /users` with expanded manager and selected properties.
- Scopes: `User.Read.All`, `AuditLog.Read.All`.
- Config: `thresholds.inactiveDays`, `domains.employees`, `domains.students`.
- Output: `data/users.json` (array of user objects).
- How it collects: Pulls all users, skips `userType=Guest`, computes inactivity from `signInActivity`, classifies domain, expands license assignment states, and adds lifecycle fields.
- Notes: `mfaRegistered` and `admin` flags are filled later by the orchestrator cross-reference step.

**Get-LicenseData.ps1**
- Purpose: Tenant SKU inventory with utilization and waste analysis.
- Endpoints: `GET /subscribedSkus`.
- Scopes: `Directory.Read.All`.
- Config: `licensePricing`, `currency`, `licenseOverlapRules`.
- Output: `data/license-skus.json` (array of SKU objects).
- How it collects: Retrieves SKUs, loads `users.json`, calculates enabled/disabled/inactive assignments per SKU, computes waste and costs, and detects overlap using rules.
- Notes: Falls back to estimated waste only if `users.json` is missing.

**Get-GuestData.ps1**
- Purpose: External user inventory with access scope and activity.
- Endpoints: `GET /users?$filter=userType eq 'Guest'`, `GET /users/{id}/memberOf`.
- Scopes: `User.Read.All`, `AuditLog.Read.All` and membership access via `GroupMember.Read.All` or `Directory.Read.All`.
- Config: `thresholds.staleGuestDays`.
- Output: `data/guests.json` (array of guest objects).
- How it collects: Fetches all guests, then queries group membership counts per guest to identify access scope and admin roles.
- Notes: Invitation state is inferred from `externalUserState` and `createdDateTime`.

**Get-MFAData.ps1**
- Purpose: MFA registration status for all users.
- Endpoints: `GET /reports/authenticationMethods/userRegistrationDetails` (report).
- Scopes: `Reports.Read.All`.
- Config: none.
- Output: `data/mfa-status.json` (array of MFA records).
- How it collects: Uses the report cmdlet and falls back to direct Graph API with paging, normalizes property casing, and derives phishing-resistant and weak method flags.
- Notes: Requires Entra ID P1/P2 for full data.

**Get-AdminRoleData.ps1**
- Purpose: Directory role assignments and high-privilege role analysis.
- Endpoints: `GET /directoryRoles`, `GET /directoryRoles/{id}/members`.
- Scopes: `RoleManagement.Read.Directory`, `Directory.Read.All`.
- Config: none.
- Output: `data/admin-roles.json` (array of roles with member lists).
- How it collects: Loads `users.json` for activity and MFA context, then enumerates role members across users, groups, and service principals.
- Notes: Flags high-privilege roles and risky members such as inactive or non-MFA users.

**Get-DeletedUsers.ps1**
- Purpose: Soft-deleted (recycle bin) users awaiting permanent deletion.
- Endpoints: `GET /directory/deletedItems/microsoft.graph.user`.
- Scopes: `User.Read.All`, `Directory.Read.All`.
- Config: none.
- Output: `data/deleted-users.json` (array of deleted user objects).
- How it collects: Retrieves deleted users, calculates days until permanent deletion, and assigns urgency tiers.
- Notes: Collected by default in `Invoke-DataCollection.ps1`.

## Security & Risk

**Get-SignInData.ps1**
- Purpose: Risk detections and risky users from Identity Protection.
- Endpoints: `GET /identityProtection/riskDetections`, `GET /identityProtection/riskyUsers`.
- Scopes: `IdentityRiskyUser.Read.All`, `IdentityRiskEvent.Read.All`.
- Config: `collection.signInLogDays`.
- Output: `data/risky-signins.json` (array of risk events).
- How it collects: Filters risk detections by date window, enriches with basic location and app info, and sorts by time.
- Notes: Requires Entra ID P2 to return full risk data.

**Get-SignInLogs.ps1**
- Purpose: Detailed sign-in logs for security analytics.
- Endpoints: `GET /auditLogs/signIns`.
- Scopes: `AuditLog.Read.All` and directory read permissions.
- Config: `collection.signInLogDays` with default 7.
- Output: `data/signin-logs.json` (object with `signIns` and `summary`).
- How it collects: Pulls up to 2,000 events (4 pages of 500), normalizes status and risk, and computes summary metrics.
- Notes: Designed for analysis and dashboard summaries, not full log retention.

**Get-DefenderData.ps1**
- Purpose: Security alert inventory from Microsoft Defender.
- Endpoints: `GET /security/alerts_v2` with fallback to `GET /security/alerts`.
- Scopes: `SecurityEvents.Read.All`.
- Config: `collection.defenderAlertDays`.
- Output: `data/defender-alerts.json` (array of alerts).
- How it collects: Attempts v2 alerts first, then falls back to legacy API, normalizes severity and status, and extracts affected entities.
- Notes: Requires Defender licensing for meaningful data.

**Get-SecureScoreData.ps1**
- Purpose: Latest Microsoft Secure Score with improvement actions.
- Endpoints: `GET /security/secureScores?$top=1`.
- Scopes: `SecurityEvents.Read.All`.
- Config: none.
- Output: `data/secure-score.json` (single object or `null`).
- How it collects: Fetches the most recent score and builds a full list of improvement controls sorted by potential impact.
- Notes: Returns `null` if no score is available.

**Get-ConditionalAccessData.ps1**
- Purpose: Conditional Access policy inventory and security classification.
- Endpoints: `GET /identity/conditionalAccess/policies`.
- Scopes: `Policy.Read.All`.
- Config: none.
- Output: `data/conditional-access.json` (array of policies).
- How it collects: Builds summaries of user, app, and grant conditions, and classifies policies as `high-security`, `standard`, `weak`, or `report-only`.
- Notes: Requires Entra ID P1/P2 for policy visibility in many tenants.

**Get-ASRRules.ps1**
- Purpose: Attack Surface Reduction (ASR) rule deployment status.
- Endpoints: `GET /deviceManagement/intents`, `GET /deviceManagement/templates`, `GET /deviceManagement/configurationPolicies`.
- Scopes: `DeviceManagementConfiguration.Read.All`.
- Config: none.
- Output: `data/asr-rules.json` (object with `policies`, `rulesArray`, and `summary`).
- How it collects: Reads Endpoint Security intents and Settings Catalog policies, parses rule IDs and states, and aggregates per-rule deployment counts.
- Notes: Uses Microsoft Graph beta endpoints and supports multiple policy sources.

## Device Management

**Get-DeviceData.ps1**
- Purpose: Full Intune device inventory with lifecycle, compliance, and security insights.
- Endpoints: `GET /deviceManagement/managedDevices`.
- Scopes: `DeviceManagementManagedDevices.Read.All`.
- Config: `thresholds.staleDeviceDays`.
- Output: `data/devices.json` (object with `devices`, `summary`, and `insights`).
- How it collects: Pulls all device properties, computes inactivity, compliance, certificate health, OS lifecycle status, and generates breakdowns and insights.
- Notes: Output is not a flat array; it includes summary and insights for the dashboard.

**Get-AutopilotData.ps1**
- Purpose: Windows Autopilot device identities and profile assignment status.
- Endpoints: `GET /deviceManagement/windowsAutopilotDeviceIdentities`.
- Scopes: `DeviceManagementServiceConfig.Read.All`.
- Config: none.
- Output: `data/autopilot.json` (array of Autopilot devices).
- How it collects: Uses cmdlet or direct API fallback, normalizes casing, and interprets profile assignment states.
- Notes: Profile assignment is inferred from status and assigned date.

**Get-CompliancePolicies.ps1**
- Purpose: Intune device compliance policy inventory and health.
- Endpoints: `GET /deviceManagement/deviceCompliancePolicies` and related assignment and status endpoints.
- Scopes: `DeviceManagementConfiguration.Read.All`.
- Config: none.
- Output: `data/compliance-policies.json` (object with `policies`, `nonCompliantDevices`, `settingFailures`, `summary`, and `insights`).
- How it collects: Pulls policies, resolves assignments, computes compliance rates, aggregates setting failures, and generates insights.
- Notes: Categorizes policies based on name patterns and assignment scope.

**Get-ConfigurationProfiles.ps1**
- Purpose: Intune configuration profiles and deployment health.
- Endpoints: `GET /deviceManagement/deviceConfigurations` and `GET /deviceManagement/configurationPolicies` with their status endpoints.
- Scopes: `DeviceManagementConfiguration.Read.All`.
- Config: none.
- Output: `data/configuration-profiles.json` (object with `profiles`, `failedDevices`, `settingFailures`, `summary`, and `insights`).
- How it collects: Combines legacy profiles and settings catalog policies, resolves group names, and computes success rates.
- Notes: Settings catalog data uses Microsoft Graph beta endpoints.

**Get-WindowsUpdateStatus.ps1**
- Purpose: Windows Update ring and policy visibility with simplified device compliance.
- Endpoints: Update rings and update profiles under `/deviceManagement/*` plus Windows device inventory.
- Scopes: `DeviceManagementConfiguration.Read.All`.
- Config: none.
- Output: `data/windows-update-status.json` (object with rings, policies, device compliance, and summary).
- How it collects: Pulls update rings, feature, quality, and driver policies, then builds a lightweight compliance view using Windows device last sync time.
- Notes: Uses beta endpoints and a simplified ring-to-device mapping.

**Get-BitLockerStatus.ps1**
- Purpose: BitLocker encryption status and recovery key metadata.
- Endpoints: `GET /deviceManagement/managedDevices`, `GET /informationProtection/bitlocker/recoveryKeys`.
- Scopes: `DeviceManagementManagedDevices.Read.All`, `BitLockerKey.Read.All` or `BitLockerKey.ReadBasic.All`.
- Config: none.
- Output: `data/bitlocker-status.json` (object with `devices`, `summary`, and `insights`).
- How it collects: Filters Windows devices, maps encryption from `isEncrypted`, and pulls key metadata (not key contents).
- Notes: Requires a `User-Agent` header for recovery keys and may return metadata only.

**Get-AppDeployments.ps1**
- Purpose: Intune application inventory and deployment health.
- Endpoints: `GET /deviceAppManagement/mobileApps` and assignment/status endpoints.
- Scopes: `DeviceManagementApps.Read.All`.
- Config: none.
- Output: `data/app-deployments.json` (object with `apps`, `failedDevices`, `summary`, and `insights`).
- How it collects: Pulls assigned apps, resolves group names, counts install states, and aggregates failures.
- Notes: Uses Microsoft Graph beta endpoints for mobile apps.

**Get-EndpointAnalytics.ps1**
- Purpose: Endpoint Analytics health and performance metrics.
- Endpoints: `GET /deviceManagement/userExperienceAnalytics*` (multiple endpoints).
- Scopes: `DeviceManagementManagedDevices.Read.All`.
- Config: none.
- Output: `data/endpoint-analytics.json` (object with scores, performance, reliability, and insights).
- How it collects: Pulls device scores, startup performance, app reliability, battery health, WFA metrics, and startup processes, then computes model insights.
- Notes: Relies heavily on beta endpoints and optional licensing features.

## Applications & Governance

**Get-EnterpriseAppData.ps1**
- Purpose: Enterprise application inventory with credential expiry and ownership.
- Endpoints: `GET /applications`, `GET /servicePrincipals` with expanded owners.
- Scopes: `Application.Read.All`, `Directory.Read.All`.
- Config: none.
- Output: `data/enterprise-apps.json` (object with `apps`, `summary`, and `insights`).
- How it collects: Cross-references service principals with app registrations to calculate secret and certificate expiry.
- Notes: Classifies Microsoft vs third-party apps and flags orphaned apps.

**Get-ServicePrincipalSecrets.ps1**
- Purpose: App registration credential status for service principals.
- Endpoints: `GET /applications`.
- Scopes: `Application.Read.All`.
- Config: none.
- Output: `data/service-principal-secrets.json` (object with `applications` and `summary`).
- How it collects: Enumerates all app registrations, computes credential expiry status and nearest expiry, and sorts by severity.
- Notes: Focused on credential hygiene rather than usage or owners.

**Get-AuditLogData.ps1**
- Purpose: Directory audit log entries for administrative activity.
- Endpoints: `GET /auditLogs/directoryAudits`.
- Scopes: `AuditLog.Read.All`.
- Config: `collection.auditLogDays`.
- Output: `data/audit-logs.json` (array of audit events).
- How it collects: Filters by activity date, extracts initiator and target resources, and includes modified properties.
- Notes: Results are sorted by most recent activity.

**Get-PIMData.ps1**
- Purpose: Privileged Identity Management activations and eligibility.
- Endpoints: `GET /roleManagement/directory/roleAssignmentScheduleRequests`, `GET /roleManagement/directory/roleEligibilitySchedules`, `GET /roleManagement/directory/roleDefinitions`.
- Scopes: `RoleManagement.Read.Directory`, `RoleAssignmentSchedule.Read.Directory`, `RoleEligibilitySchedule.Read.Directory`.
- Config: none.
- Output: `data/pim-activity.json` (array of PIM activity records).
- How it collects: Builds a role definition lookup and merges assignment requests with eligibility schedules.
- Notes: `pimActivityDays` exists in config but is not applied.

**Get-AppSignInData.ps1**
- Purpose: Application usage analytics based on sign-in logs.
- Endpoints: `GET /auditLogs/signIns`.
- Scopes: `AuditLog.Read.All`.
- Config: `collection.signInLogDays`.
- Output: `data/app-signins.json` (array of sign-in records).
- How it collects: Uses manual pagination with a 20-page cap to avoid skip token expiry and extracts only usage-relevant fields.
- Notes: Intended for usage trends rather than full audit retention.

## Collaboration

**Get-TeamsData.ps1**
- Purpose: Teams governance signals (inactive, ownerless, guest access).
- Endpoints: `GET /reports/getTeamsTeamActivityDetail(period='D30')`, `GET /groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$expand=owners`.
- Scopes: `Reports.Read.All`, `Directory.Read.All`, `GroupMember.Read.All`.
- Config: `thresholds.inactiveTeamDays`.
- Output: `data/teams.json` (object with `metadata` and `teams`).
- How it collects: Downloads a CSV activity report, then enriches it with owner counts from group data.
- Notes: Uses temporary CSV files and merges report rows by Team ID.

**Get-SharePointData.ps1**
- Purpose: SharePoint site usage and sharing governance.
- Endpoints: `GET /beta/reports/getSharePointSiteUsageDetail(period='D30')`, `GET /beta/sites/getAllSites` for URL resolution.
- Scopes: `Reports.Read.All`, `Sites.Read.All`.
- Config: `thresholds.inactiveSiteDays`, `thresholds.highStorageThresholdGB`.
- Output: `data/sharepoint-sites.json` (array of sites).
- How it collects: Downloads report CSV, handles privacy-concealed URLs by looking up sites via `getAllSites`, computes storage and sharing flags.
- Notes: Uses beta reports endpoint to include advanced sharing fields.

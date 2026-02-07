# Deleted Users Collector Review

**Collector**: `collectors/Get-DeletedUsers.ps1`  
**Dashboard pages**: Lifecycle

## Status
PASS (no required-field gaps found)

## Required Dashboard Fields (Deleted Users)
`displayName`, `userPrincipalName`, `department`,
`deletedDateTime`, `daysSinceDeletion`,
`permanentDeletionDate`, `daysUntilPermanentDeletion`,
`urgency`

## Collector Coverage
- All required fields are produced.
- Additional identity/context fields provided: `id`, `mail`, `userType`, `isGuest`, `sourceDomain`, `jobTitle`.

## Sample Data Comparison
**Sample file**: `data/sample/deleted-users.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Urgency labels in sample align with collector logic (Critical <= 3 days, High <= 7, Medium <= 14, else Normal).

## Gaps / Risks
- If `deletedDateTime` is missing (null), the collector outputs null for `daysUntilPermanentDeletion` and `urgency` defaults to `Normal`. The lifecycle page will show “Purge date unknown” and not flag urgency.
- The 30‑day purge window is hard-coded; if tenant settings differ, urgency classification may drift from admin expectations.

## Graph Collection Details
- Endpoint: `GET /directory/deletedItems/microsoft.graph.user`
- Required scopes: `User.Read.All`, `Directory.Read.All`
- Output file: `data/deleted-users.json`

## Duplicate Code Check
- PascalCase/camelCase normalization now uses shared `Get-GraphPropertyValue` (duplicate removed).

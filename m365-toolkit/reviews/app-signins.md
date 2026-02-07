# App Sign-ins Collector Review

**Collector**: `collectors/Get-AppSignInData.ps1`  
**Dashboard pages**: Application Usage

## Status
PASS with risks (data limits)

## Required Dashboard Fields (App Usage)
`appDisplayName`, `resourceDisplayName`, `userPrincipalName`, `createdDateTime`,
`isInteractive`, `statusCode`, `statusReason`, `city`, `country`

## Collector Coverage
- All required fields are produced.
- Uses `appDisplayName` and `resourceDisplayName` from `/auditLogs/signIns`.
- Location fields mapped to `city` and `country`.

## Sample Data Comparison
**Sample file**: `data/sample/app-signins.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Sample `country` values align with the collector’s use of `location.countryOrRegion`.

## Gaps / Risks
- **Data cap**: collection stops at `maxPages = 20` (max 10,000 records). Large tenants may undercount app usage.
- **Dependency**: breakdowns rely on `users` data to enrich `_department`, `_company`, `_city`, `_officeLocation`, `_domain`. If users data is missing, breakdowns show `(unknown)`.

## Graph Collection Details
- Endpoint: `GET /auditLogs/signIns`
- Filter: `createdDateTime ge {now - signInLogDays}`
- Select: `appDisplayName, resourceDisplayName, userPrincipalName, createdDateTime, isInteractive, status, location`
- Required scopes: `AuditLog.Read.All`
- Output file: `data/app-signins.json`

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

# SharePoint Sites Collector Review

**Collector**: `collectors/Get-SharePointData.ps1`  
**Dashboard pages**: SharePoint, Lifecycle, Overview, Report

## Status
PASS with risks (report window + concealed URLs + beta dependencies)

## Required Dashboard Fields (SharePoint)
`id`, `url`, `displayName`, `ownerPrincipalName`, `ownerDisplayName`,
`storageUsedGB`, `storageAllocatedGB`, `storagePct`,
`fileCount`, `activeFileCount`, `pageViewCount`, `visitedPageCount`,
`lastActivityDate`, `daysSinceActivity`, `isInactive`, `createdDateTime`,
`template`, `isPersonalSite`, `isGroupConnected`,
`externalSharing`, `anonymousLinkCount`, `guestLinkCount`, `companyLinkCount`, `memberLinkCount`,
`totalSharingLinks`, `hasExternalSharing`, `sensitivityLabelId`, `unmanagedDevicePolicy`,
`flags`

## Collector Coverage
- All required fields above are produced.
- `storageUsedBytes` is also emitted (not used by UI).
- Report window now adapts to `inactiveSiteDays` via `Get-ReportPeriod` to reduce false inactivity.

## Sample Data Comparison
**Sample file**: `data/sample/sharepoint-sites.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Sample includes `groupId`, which the collector does **not** emit (UI does not reference `groupId`).

## Gaps / Risks
- **Activity report window**: report period is constrained to Graph-supported ranges (D7/D30/D90/D180). If the configured inactive threshold is outside those values, the collector rounds to the nearest supported window, which can still slightly over/under-flag inactivity.
- **Concealed URLs**: if report hides URLs and the Sites API call fails (missing `Sites.Read.All`), the collector uses `https://unknown-site/{id}`. Search and details still work, but URLs are not real.
- **Beta dependency**: relies on `/beta/reports/getSharePointSiteUsageDetail` for governance columns; schema changes could affect fields like `External Sharing` or link counts.

## Graph Collection Details
- Endpoint: `GET /beta/reports/getSharePointSiteUsageDetail(period='D30')`
- Optional URL resolution: `GET /beta/sites/getAllSites`
- Required scopes: `Reports.Read.All`, `Sites.Read.All`
- Output file: `data/sharepoint-sites.json`

## Duplicate Code Check
- Report CSV download now uses shared `Get-ReportCsvData` helper (duplicate removed).

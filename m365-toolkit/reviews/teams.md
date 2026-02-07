# Teams Collector Review

**Collector**: `collectors/Get-TeamsData.ps1`  
**Dashboard pages**: Teams, Lifecycle, Report

## Status
PASS with risks (report coverage + owner expansion limits)

## Required Dashboard Fields (Teams)
`id`, `displayName`, `description`, `visibility`, `createdDateTime`, `mail`,
`ownerCount`, `guestCount`, `activeUsers`, `lastActivityDate`, `daysSinceActivity`,
`isInactive`, `hasNoOwner`, `hasGuests`, `flags`

## Collector Coverage
- All required fields are produced.
- Output is wrapped in `{ metadata, teams }`; DataLoader extracts the nested `teams` array.

## Sample Data Comparison
**Sample file**: `data/sample/teams.json`
- Sample uses the same nested `{ metadata, teams }` structure and matches collector naming.
- Sample fields align with Teams page usage (`flags`, `hasGuests`, `hasNoOwner`, etc.).

## Gaps / Risks
- **Activity report window**: report period is constrained to Graph-supported ranges (D7/D30/D90/D180). If the configured inactive threshold is outside those values, the collector rounds to the nearest supported window, which can still slightly over/under-flag inactivity and guest presence.
- **Owner expansion limits**: `$expand=owners($select=id)` may return only a subset of owners if the owners collection is large or paged. `ownerCount` may be undercounted.
- **Guest count source**: `guestCount` is derived from the activity report, not live membership. Teams with guests but no recent activity can be misclassified as `hasGuests = false`.

## Graph Collection Details
- Endpoints:
  - `GET /reports/getTeamsTeamActivityDetail(period='D30')`
  - `GET /groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')&$expand=owners($select=id)`
- Required scopes: `Reports.Read.All`, `Directory.Read.All`, `GroupMember.Read.All`
- Output file: `data/teams.json`

## Duplicate Code Check
- Report CSV download now uses shared `Get-ReportCsvData` helper (duplicate removed).

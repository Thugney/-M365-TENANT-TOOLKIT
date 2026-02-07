# PIM Collector Review

**Collector**: `collectors/Get-PIMData.ps1`  
**Dashboard pages**: PIM, Overview

## Status
PASS with minor risk (principal data depends on Graph expand response)

## Required Dashboard Fields (PIM)
`id`, `action`, `principalDisplayName`, `principalUpn`, `roleName`, `roleDefinitionId`,
`status`, `createdDateTime`, `justification`,
`scheduleStartDateTime`, `scheduleEndDateTime`,
`isEligible`, `entryType`

## Collector Coverage
- All required fields above are produced for both entry types (`request`, `eligible`).
- `roleName` is resolved via role definition lookup.

## Sample Data Comparison
**Sample file**: `data/sample/pim-activity.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Sample action/status values are compatible with the badge formatters.

## Gaps / Risks
- `principalDisplayName` and `principalUpn` rely on `Principal.AdditionalProperties` from `-ExpandProperty "principal"`. If Graph omits those properties, names can become empty. UI still renders but rows show `--`.
- Sorting uses `createdDateTime` and expects ISO strings; collector uses `.ToString('o')` so format is fine.

## Graph Collection Details
- Endpoints: `GET /roleManagement/directory/roleAssignmentScheduleRequests`, `GET /roleManagement/directory/roleEligibilitySchedules`
- Required scopes: `RoleManagement.Read.Directory`, `RoleAssignmentSchedule.Read.Directory`
- Output file: `data/pim-activity.json`

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

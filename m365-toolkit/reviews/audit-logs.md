# Audit Logs Collector Review

**Collector**: `collectors/Get-AuditLogData.ps1`  
**Dashboard pages**: Audit Logs

## Status
PASS (no field gaps detected)

## Required Dashboard Fields (Audit Logs)
`id`, `activityDateTime`, `activityDisplayName`, `operationType`, `initiatedBy`, `initiatedByApp`,
`targetResource`, `targetResourceType`, `category`, `result`, `resultReason`,
`loggedByService`, `correlationId`

## Collector Coverage
- All fields required by the page are produced.
- Collector also emits `targetResourceId`, `targetResources`, and `modifiedProperties` (not used by the UI today).
- Uses live Graph data (no sample/static data paths).

## Sample Data Comparison
**Sample file**: `data/sample/audit-logs.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Sample does **not** include `targetResourceId`, `targetResources`, or `modifiedProperties`, which are extra fields in the collector output.

## Gaps / Risks
- The UI counts failures using `result === 'failure'`. If Graph returns `timeout` or other non-success statuses, they will not be counted as failures in the summary.
- `activityDateTime` uses ISO 8601 with fractional seconds from `ToString('o')`; ensure consumers tolerate that format (DataLoader formatting currently does).

## Graph Collection Details
- Endpoint: `GET /auditLogs/directoryAudits`
- Filter: `activityDateTime ge {now - auditLogDays}`
- Required scopes: `AuditLog.Read.All`
- Output file: `data/audit-logs.json`

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

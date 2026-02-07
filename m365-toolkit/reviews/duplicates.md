# Duplicate Code Notes

This file tracks duplicate or near-duplicate logic found during the review.

## Resolved
- `Invoke-GraphWithRetry` consolidated into `lib/CollectorBase.ps1`; `Invoke-DataCollection.ps1` now imports it.
- Credential expiry status logic consolidated into shared `Get-CredentialStatus`.
- PascalCase/camelCase property normalization consolidated into shared `Get-GraphPropertyValue`.
- Assignment target parsing consolidated into shared `Resolve-AssignmentTarget`.
- Report CSV download + import + temp file cleanup consolidated into shared `Get-ReportCsvData`.

## Remaining (Intentional)
- Sign-in logs: the UI still applies light normalization as a fallback when collector data is missing or uses older shapes, but it primarily trusts the collector outputs now.

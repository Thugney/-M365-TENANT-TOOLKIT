# MFA Collector Review

**Collector**: `collectors/Get-MFAData.ps1`  
**Dashboard dependency**: Indirect via cross-reference into `users.json`

## Status
PASS (no required-field gaps found for cross-reference)

## Required Fields (for cross-reference)
`userId`, `isMfaRegistered`

## Collector Coverage
- Outputs `userId` and `isMfaRegistered` for every record.
- Also includes MFA methods, phishing-resistant indicators, SSPR status, and timestamps.

## Graph Collection Details
- Endpoint: `GET /reports/authenticationMethods/userRegistrationDetails`
- Required scopes: `Reports.Read.All` (and `AuditLog.Read.All` per script notes).
- Fallback: direct Graph request with paging if the cmdlet fails.

## Risks / Notes
- Report requires Entra ID P1/P2; without it the collector fails and writes an empty array.
- The orchestrator (`Invoke-DataCollection.ps1`) depends on this file to set `user.mfaRegistered` and `no-mfa` flags in `users.json`.

# Risky Sign-ins Collector Review

**Collector**: `collectors/Get-SignInData.ps1`  
**Dashboard pages**: Security

## Status
PASS (no required-field gaps found)

## Required Dashboard Fields (Risky Sign-ins)
`userPrincipalName`, `riskLevel`, `riskState`, `riskDetail`,  
`detectedDateTime`, `location.countryOrRegion`, `ipAddress`,  
`appDisplayName`

## Collector Coverage
- All required fields above are produced.
- `location` object includes `city` and `countryOrRegion`.

## Graph Collection Details
- Endpoints: `GET /identityProtection/riskDetections`, `GET /identityProtection/riskyUsers`.
- Required scopes: `IdentityRiskyUser.Read.All`, `IdentityRiskEvent.Read.All`.
- Date filter uses `collection.signInLogDays` with a 30-day default.

## Risks / Notes
- Requires Entra ID P2 for risk detections. Without P2, the collector returns 0 detections and logs a licensing warning.
- `riskDetections` and `riskyUsers` are fetched separately; the UI currently uses only the detection records.

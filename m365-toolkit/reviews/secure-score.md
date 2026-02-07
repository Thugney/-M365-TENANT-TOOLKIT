# Secure Score Collector Review

**Collector**: `collectors/Get-SecureScoreData.ps1`  
**Dashboard pages**: Security, Overview, Executive Report

## Status
PASS (no required-field gaps found)

## Required Dashboard Fields (Secure Score)
`scorePct`, `maxScore`, `currentScore`,  
`controlScores[].name`, `controlScores[].description`,  
`controlScores[].scoreInPercentage`, `controlScores[].potentialPoints`,  
`controlScores[].isComplete`

## Collector Coverage
- All required fields above are produced.
- `scorePct` is computed from `currentScore / maxScore` and rounded to whole percent for the UI.
- `controlScores` includes both incomplete and complete controls; incomplete controls are sorted by potential points first.
- Uses live Graph data (no sample/static data paths).

## Graph Collection Details
- Endpoint: `GET /security/secureScores?$top=1`.
- Required scopes: `SecurityEvents.Read.All`.
- Output file: `data/secure-score.json` (null if no data is returned).

## Risks / Notes
- If Graph returns multiple Secure Score snapshots, `$top=1` relies on default ordering; consider sorting by `createdDateTime` if ordering ever appears inconsistent.
- If Secure Score is unavailable (licensing/permissions), collector writes `null` so the dashboard can render safely.
- Duplicate code check: no duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

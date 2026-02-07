# Defender Alerts Collector Review

**Collector**: `collectors/Get-DefenderData.ps1`  
**Dashboard pages**: Security, Overview

## Status
PASS (no required-field gaps found)

## Required Dashboard Fields (Defender Alerts)
`title`, `severity`, `status`, `category`,  
`createdDateTime`, `resolvedDateTime`,  
`affectedUser`, `affectedDevice`

## Collector Coverage
- All required fields above are produced.
- Severity and status are normalized to match dashboard expectations.

## Graph Collection Details
- Endpoint: `GET /security/alerts_v2` with fallback to `GET /security/alerts`.
- Required scopes: `SecurityEvents.Read.All`.
- Time window uses `collection.defenderAlertDays` with a 30-day default.

## Risks / Notes
- Requires Defender licensing; otherwise alerts may be empty or unavailable.
- Uses a fallback chain (cmdlet → alerts_v2 → legacy) to maximize compatibility.

# ASR Rules Collector Review

**Collector**: `collectors/Get-ASRRules.ps1`  
**Dashboard pages**: ASR Rules

## Status
PASS with risks (counts are policy-based, not device-based)

## Required Dashboard Fields (ASR Rules)
**Rules summary (rulesArray)**
`ruleId`, `ruleName`, `blockCount`, `auditCount`, `warnCount`, `disabledCount`, `isDeployed`

**Policies list**
`displayName`, `description`, `templateId`, `isAssigned`, `ruleCount`,  
`createdDateTime`, `lastModifiedDateTime`, `asrRules[].ruleName`, `asrRules[].mode`

## Collector Coverage
- All required fields above are produced for **intent-based** ASR policies.
- Settings catalog policies populate `policies[]` with rule lists and **now update** `rulesSummary`/`rulesArray` counters.
- Uses live Graph data (no sample/static data paths).

## Gaps / Risks
- **Semantic mismatch**: `blockCount`, `auditCount`, `warnCount` represent **policy occurrences**, not device counts; the UI labels these as device counts in rule details and uses them to infer coverage (currently always 100% once deployed).
- Uses beta endpoints (`/beta/deviceManagement/*`); schema changes can break parsing.

## Graph Collection Details
- Endpoints: `/beta/deviceManagement/templates`, `/beta/deviceManagement/intents`, `/beta/deviceManagement/configurationPolicies` (+ `/settings` per policy).
- Required scopes: `DeviceManagementConfiguration.Read.All`.
- Output file: `data/asr-rules.json`.

## Suggested Fix (to close gaps)
- If device-level coverage is required, pull per-policy assignment targets and device counts (or clearly relabel counts as “policy count”).

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

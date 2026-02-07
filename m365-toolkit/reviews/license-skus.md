# License SKUs Collector Review

**Collector**: `collectors/Get-LicenseData.ps1`  
**Dashboard pages**: Licenses, License Analysis, Overview, Report

## Status
PASS with risks (dependency on users.json)

## Required Dashboard Fields (License SKUs)
`skuId`, `skuName`, `skuPartNumber`, `capabilityStatus`, `appliesTo`,
`totalPurchased`, `totalAssigned`, `available`,
`prepaidEnabled`, `prepaidWarning`, `prepaidSuspended`, `prepaidLockedOut`,
`assignedToEnabled`, `assignedToDisabled`, `assignedToInactive`,
`wasteCount`, `utilizationPercent`,
`monthlyCostPerLicense`, `estimatedMonthlyCost`, `estimatedAnnualCost`,
`wasteMonthlyCost`, `wasteAnnualCost`, `billedUsers`, `averageCostPerUser`, `currency`,
`overlapCount`, `overlapSkuName`, `potentialSavingsPercent`,
`servicePlans`, `servicePlanCount`

## Collector Coverage
- All required fields above are produced.
- `skuName` is mapped from `skuPartNumber` using an internal lookup (fallback to part number when unknown).
- Waste calculations use per‑SKU user assignment data when `users.json` exists; otherwise, estimates are derived from overall user ratios.

## Sample Data Comparison
**Sample file**: `data/sample/license-skus.json`
- Sample includes all dashboard-required fields and matches collector naming.
- Cost fields and overlap fields are present in sample and align with UI expectations.

## Gaps / Risks
- **Users dependency**: if `users.json` is missing or stale, per‑SKU waste calculations degrade to estimated ratios and can diverge from real assignments.
- **Free SKUs**: when pricing is not configured, all cost fields remain `0`, which can hide waste costs in the UI.

## Graph Collection Details
- Endpoint: `GET /subscribedSkus`
- Required scopes: `Directory.Read.All`
- Output file: `data/license-skus.json`

## Duplicate Code Check
- No duplicate patterns detected in this collector (see `reviews/duplicates.md` for global duplicates).

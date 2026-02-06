# License Pricing Configuration

TenantScope calculates license costs based on pricing you configure in `config.json`. This guide explains how to set up accurate pricing for your organization.

## Why Manual Configuration?

Microsoft does not expose license pricing through Graph API. Your actual costs depend on:

- **Agreement type**: Enterprise Agreement (EA), CSP, Direct, etc.
- **Negotiated discounts**: Volume pricing, multi-year commitments
- **Regional pricing**: Varies by country/currency
- **Special pricing**: Nonprofit, education, government rates

The `licensePricing` section in config.json lets you enter your actual contract rates.

## Configuration Structure

In your `config.json`, configure these sections:

```json
{
  "currency": {
    "code": "NOK",
    "symbol": "kr",
    "locale": "nb-NO"
  },
  "licensePricing": {
    "SPE_E3": 350,
    "SPE_E5": 580,
    "ENTERPRISEPACK": 270
  }
}
```

### Currency Settings

| Field | Description | Example |
|-------|-------------|---------|
| `code` | ISO 4217 currency code | `"NOK"`, `"USD"`, `"EUR"` |
| `symbol` | Display symbol | `"kr"`, `"$"`, `"€"` |
| `locale` | Number formatting locale | `"nb-NO"`, `"en-US"`, `"de-DE"` |

### License Pricing

The `licensePricing` object maps **SKU Part Numbers** to **monthly cost per license**.

```json
"licensePricing": {
  "SKU_PART_NUMBER": monthly_cost_per_license
}
```

## Step 1: Find Your SKU Part Numbers

### Option A: Run Data Collection First

After running `Invoke-DataCollection.ps1`, check the generated `data/licenses.json` file. Each license entry includes the `skuPartNumber`:

```json
{
  "skuName": "Microsoft 365 E3",
  "skuPartNumber": "SPE_E3",
  "totalAssigned": 150
}
```

### Option B: Query Graph API Directly

```powershell
Connect-MgGraph -Scopes "Organization.Read.All"
Get-MgSubscribedSku | Select-Object SkuPartNumber, SkuId, ConsumedUnits | Format-Table
```

### Option C: Check Microsoft Admin Center

1. Go to [admin.microsoft.com](https://admin.microsoft.com)
2. Navigate to **Billing** > **Your products**
3. Click on a subscription to see its Product ID (SKU Part Number)

## Step 2: Get Your Contract Pricing

Find your actual per-license monthly costs from:

1. **Microsoft Admin Center**: Billing > Bills & payments
2. **Enterprise Agreement Portal**: If you have EA
3. **CSP Partner Portal**: If purchased through partner
4. **Your procurement/finance team**: They have the contract details

### Price Calculation

If you only have annual pricing, divide by 12:

```
Monthly cost = Annual cost per license / 12
```

## Step 3: Configure Pricing

Add each SKU to the `licensePricing` section:

```json
"licensePricing": {
  "SPE_E3": 350,
  "SPE_E5": 580,
  "M365EDU_A3_FACULTY": 70,
  "M365EDU_A1": 0,
  "ENTERPRISEPACK": 270,
  "EXCHANGESTANDARD": 55,
  "POWER_BI_PRO": 105,
  "INTUNE_A": 90,
  "AAD_PREMIUM": 65,
  "AAD_PREMIUM_P2": 100,
  "VISIOCLIENT": 165,
  "PROJECTPREMIUM": 520,
  "TEAMS_EXPLORATORY": 0,
  "FLOW_FREE": 0,
  "POWERAPPS_VIRAL": 0
}
```

**Important**: Set free/trial licenses to `0` to exclude them from cost calculations.

## Common SKU Part Numbers

| SKU Part Number | Product Name |
|-----------------|--------------|
| `SPE_E3` | Microsoft 365 E3 |
| `SPE_E5` | Microsoft 365 E5 |
| `ENTERPRISEPACK` | Office 365 E3 |
| `ENTERPRISEPREMIUM` | Office 365 E5 |
| `M365_F1` | Microsoft 365 F1 |
| `SPB` | Microsoft 365 Business Premium |
| `O365_BUSINESS_ESSENTIALS` | Microsoft 365 Business Basic |
| `O365_BUSINESS_PREMIUM` | Microsoft 365 Business Standard |
| `EXCHANGESTANDARD` | Exchange Online (Plan 1) |
| `EXCHANGEENTERPRISE` | Exchange Online (Plan 2) |
| `POWER_BI_PRO` | Power BI Pro |
| `POWER_BI_PREMIUM_P1` | Power BI Premium Per User |
| `INTUNE_A` | Microsoft Intune |
| `AAD_PREMIUM` | Azure AD Premium P1 |
| `AAD_PREMIUM_P2` | Azure AD Premium P2 |
| `EMS` | Enterprise Mobility + Security E3 |
| `EMSPREMIUM` | Enterprise Mobility + Security E5 |
| `VISIOCLIENT` | Visio Plan 2 |
| `PROJECTPREMIUM` | Project Plan 5 |
| `PROJECTPROFESSIONAL` | Project Plan 3 |
| `M365EDU_A1` | Microsoft 365 A1 (Education) |
| `M365EDU_A3_FACULTY` | Microsoft 365 A3 for Faculty |
| `M365EDU_A3_STUDENT` | Microsoft 365 A3 for Students |
| `M365EDU_A5_FACULTY` | Microsoft 365 A5 for Faculty |
| `TEAMS_EXPLORATORY` | Microsoft Teams Exploratory |
| `FLOW_FREE` | Power Automate Free |
| `POWERAPPS_VIRAL` | Power Apps Free |

For a complete list, see [Microsoft Product Names and SKU IDs](https://learn.microsoft.com/en-us/entra/identity/users/licensing-service-plan-reference).

## Step 4: Configure Overlap Rules (Optional)

Identify users with redundant licenses (e.g., both E3 and E5):

```json
"licenseOverlapRules": [
  {
    "name": "E3 + E5",
    "higherSku": "SPE_E5",
    "lowerSku": "SPE_E3",
    "description": "E5 includes all E3 capabilities"
  },
  {
    "name": "AAD P1 + P2",
    "higherSku": "AAD_PREMIUM_P2",
    "lowerSku": "AAD_PREMIUM",
    "description": "P2 includes all P1 features"
  },
  {
    "name": "EMS E3 + E5",
    "higherSku": "EMSPREMIUM",
    "lowerSku": "EMS",
    "description": "EMS E5 includes all E3 features"
  }
]
```

The dashboard will flag users with both licenses and calculate potential savings.

## What the Dashboard Shows

Once configured, the Licenses page displays:

| Metric | Description |
|--------|-------------|
| **Monthly Cost** | `assigned_licenses x monthly_cost_per_license` |
| **Waste Cost** | `unused_licenses x monthly_cost_per_license` |
| **Overlap Count** | Users with redundant license combinations |
| **Potential Savings** | Cost of removing redundant lower-tier licenses |

The Overview page shows a **License Waste** callout if significant waste is detected.

## Troubleshooting

### Licenses Show 0 Cost

The SKU is not in your `licensePricing` config. Check:

1. Run collection to see the exact `skuPartNumber` in `licenses.json`
2. Add that SKU to your config with the correct price

### SKU Not Recognized

If a license appears with its technical name instead of a friendly name:

1. The collector has a built-in mapping for common SKUs
2. Unknown SKUs display their `skuPartNumber` as the name
3. This doesn't affect cost calculations - just add the SKU to `licensePricing`

### Prices Seem Wrong

1. Verify you're using **monthly** costs (not annual)
2. Check your currency settings match your pricing
3. Ensure prices are numbers, not strings: `350` not `"350"`

## Example: Complete Configuration

```json
{
  "tenantId": "your-tenant-id",
  "currency": {
    "code": "USD",
    "symbol": "$",
    "locale": "en-US"
  },
  "licensePricing": {
    "SPE_E3": 36,
    "SPE_E5": 57,
    "ENTERPRISEPACK": 23,
    "EXCHANGESTANDARD": 4,
    "POWER_BI_PRO": 10,
    "AAD_PREMIUM": 6,
    "AAD_PREMIUM_P2": 9,
    "EMS": 10.60,
    "EMSPREMIUM": 16.40,
    "INTUNE_A": 8,
    "TEAMS_EXPLORATORY": 0,
    "FLOW_FREE": 0,
    "POWERAPPS_VIRAL": 0
  },
  "licenseOverlapRules": [
    { "name": "E3 + E5", "higherSku": "SPE_E5", "lowerSku": "SPE_E3", "description": "E5 includes all E3" },
    { "name": "AAD P1 + P2", "higherSku": "AAD_PREMIUM_P2", "lowerSku": "AAD_PREMIUM", "description": "P2 includes P1" },
    { "name": "O365 E3 + M365 E3", "higherSku": "SPE_E3", "lowerSku": "ENTERPRISEPACK", "description": "M365 E3 includes O365 E3" }
  ]
}
```

## Updating Prices

When your contract renews or prices change:

1. Update the `licensePricing` values in `config.json`
2. Re-run `Invoke-DataCollection.ps1`
3. Re-run `Build-Dashboard.ps1`

The dashboard will reflect the new pricing immediately.

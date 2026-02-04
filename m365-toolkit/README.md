# M365 Tenant Toolkit

A PowerShell-based toolkit for Microsoft 365 IT administrators that collects tenant data and presents it in a local HTML dashboard. Designed for Norwegian municipalities running M365 with mixed employee/student populations.

## Features

- **User Management**: View all users with activity status, MFA registration, and license assignments
- **License Optimization**: Identify unused licenses assigned to disabled or inactive accounts
- **Guest Management**: Track external collaborators and identify stale guest accounts
- **Security Posture**: Review admin roles, MFA gaps, risky sign-ins, and Defender alerts
- **Device Health**: Monitor Intune-managed devices, compliance status, and encryption
- **Lifecycle Management**: Identify onboarding/offboarding issues requiring attention

## Requirements

- **PowerShell 7.0** or later
- **Microsoft Graph PowerShell SDK**
- **Entra ID Role**: Global Reader (minimum), plus Intune Reader for device data
- **Licenses**: Some features require Entra ID P1/P2 (sign-in activity, risky sign-ins)

## Quick Start

### 1. Install Prerequisites

```powershell
# Navigate to the toolkit directory
cd m365-toolkit

# Run the prerequisites installer
.\Install-Prerequisites.ps1
```

This installs the Microsoft Graph PowerShell SDK if not already present.

### 2. Configure the Toolkit

Edit `config.json` with your tenant settings:

```json
{
  "tenantId": "your-tenant-id-here",
  "domains": {
    "employees": "@yourdomain.com",
    "students": "@students.yourdomain.com"
  },
  "thresholds": {
    "inactiveDays": 90,
    "staleGuestDays": 60,
    "staleDeviceDays": 90
  }
}
```

### 3. Collect Data

```powershell
.\Invoke-DataCollection.ps1
```

This will:
1. Prompt you to sign in to Microsoft Graph
2. Collect data from your tenant (may take 5-15 minutes for large tenants)
3. Save JSON files to the `data/` directory
4. Build and open the dashboard

### 4. View the Dashboard

The dashboard opens automatically after data collection. You can also open it manually:

- Open `dashboard/index.html` in any modern web browser
- No web server required - works directly from the file system

## Data Collection

### Collectors

| Collector | Data | Graph Permissions |
|-----------|------|-------------------|
| Get-UserData | All users, sign-in activity, licenses | User.Read.All, AuditLog.Read.All |
| Get-LicenseData | License SKUs and assignments | Directory.Read.All |
| Get-GuestData | External/guest users | User.Read.All |
| Get-MFAData | MFA registration status | Reports.Read.All |
| Get-AdminRoleData | Directory role assignments | RoleManagement.Read.Directory |
| Get-SignInData | Risky sign-ins | IdentityRiskyUser.Read.All |
| Get-DeviceData | Intune managed devices | DeviceManagementManagedDevices.Read.All |
| Get-AutopilotData | Autopilot devices | DeviceManagementConfiguration.Read.All |
| Get-DefenderData | Security alerts | SecurityEvents.Read.All |

### Required Graph Scopes

```
User.Read.All
Directory.Read.All
AuditLog.Read.All
Reports.Read.All
DeviceManagementManagedDevices.Read.All
DeviceManagementConfiguration.Read.All
SecurityEvents.Read.All
IdentityRiskyUser.Read.All
IdentityRiskEvent.Read.All
RoleManagement.Read.Directory
```

## Dashboard Pages

### Overview
Summary cards showing key metrics across all areas. Click any card to navigate to the detailed view with relevant filters applied.

### Users
Full user listing with filters for:
- Domain (employees/students)
- Account status (enabled/disabled)
- Flags (inactive, no MFA, admin, etc.)
- Department

### Licenses
License utilization overview showing:
- Purchased vs assigned counts
- Waste identification (licenses on disabled/inactive accounts)
- Per-SKU breakdown

### Guests
External collaborator management:
- Invitation status
- Last sign-in tracking
- Stale guest identification

### Security
Multi-section security dashboard:
- Risky sign-ins (requires Entra ID P2)
- Admin role assignments with hygiene warnings
- Users without MFA
- Defender alerts

### Devices
Intune device inventory:
- Compliance status
- Encryption status
- Stale device identification
- OS breakdown

### Lifecycle
Actionable lists for account lifecycle management:
- Offboarding issues (disabled accounts with licenses/roles)
- Onboarding gaps (new accounts not set up properly)
- Role hygiene (inactive admins, admins without MFA)
- Guest cleanup recommendations

## Scheduled Collection

Set up automatic data collection:

```powershell
# Daily collection at 6 AM
.\scripts\Schedule-Collection.ps1

# Weekly collection at 7:30 AM
.\scripts\Schedule-Collection.ps1 -Schedule Weekly -Time "07:30"

# Remove scheduled task
.\scripts\Schedule-Collection.ps1 -Remove
```

## Development / Testing

To test the dashboard without a live tenant connection, sample JSON data files can be placed in `dashboard/data/`. The dashboard works entirely from static JSON files.

## Limitations

1. **Sign-in activity** requires Entra ID P1 or P2. Without it, last sign-in dates will show as N/A.

2. **Risky sign-ins** require Entra ID P2. The section will be empty without this license.

3. **Device data** only includes Intune-managed devices. Unmanaged BYOD devices won't appear.

4. **This is read-only** - the toolkit displays data but does not modify anything in your tenant.

5. **Data freshness** - this is a point-in-time snapshot. Run collection regularly for current data.

## File Structure

```
m365-toolkit/
├── config.json                 # Tenant configuration
├── Install-Prerequisites.ps1   # Setup script
├── Invoke-DataCollection.ps1   # Main collection script
├── collectors/                 # Individual data collectors
├── data/                       # Collected JSON data (gitignored)
├── dashboard/
│   ├── index.html              # Dashboard entry point
│   ├── css/style.css           # Styling
│   ├── js/                     # Dashboard JavaScript
│   └── data/                   # Dashboard data (copied from ../data/)
└── scripts/
    ├── Build-Dashboard.ps1     # Copies data to dashboard
    └── Schedule-Collection.ps1 # Sets up scheduled task
```

## Troubleshooting

### "Access denied" errors during collection
- Ensure your account has Global Reader role in Entra ID
- For device data, you need Intune Administrator or Intune Read-Only role
- Some data requires P1/P2 licenses

### Dashboard shows "No data"
- Run `Invoke-DataCollection.ps1` first
- Check that JSON files exist in `data/` directory
- Run `.\scripts\Build-Dashboard.ps1` to copy data to dashboard

### Collection takes too long
- Large tenants with thousands of users may take 10-15 minutes
- Progress is shown in the console during collection
- Consider scheduling collection during off-hours

## Security

- All data is stored locally on your workstation
- No data is sent to external services
- The toolkit uses delegated permissions (your identity)
- Credentials are never stored - you authenticate each time

## License

Internal tool for IT administration purposes.

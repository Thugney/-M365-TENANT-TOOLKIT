# TenantScope - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-05

### Added
- SVG donut charts across all dashboard pages (Overview, Users, Licenses, Guests, Security, Devices, Enterprise Apps, Lifecycle, PIM, Audit Logs)
- License Cost Calculator: configurable currency pricing in `config.sample.json`, waste cost cards on Licenses page, cost columns in table, cost breakdown in detail modal, waste callout on Overview
- Trend Tracking: `trend-history.json` snapshots appended after each collection (capped at 12), `trend-helper.js` utility, delta arrows on Overview metric cards
- Secure Score: new collector `Get-SecureScoreData.ps1` (Graph `/security/secureScores`), donut chart on Overview with top improvement actions
- Department Filter: global header dropdown filtering Users, Devices, Overview, and Lifecycle pages by department context
- Executive Report page: composite health score donut (MFA/Compliance/SecureScore/GuestHygiene/LicenseEfficiency), auto-ranked top 5 risks, license waste table, key metrics grid, governance summary, browser print support
- Teams collector (`Get-TeamsData.ps1`) and Teams dashboard page with activity, ownership, and guest access tracking
- SharePoint collector (`Get-SharePointData.ps1`) and SharePoint Governance dashboard page with sharing links, sensitivity labels, and storage analysis
- Sample data for Teams, SharePoint, Secure Score, and trend history
- Print CSS (`@media print`) for clean A4 output from Report page
- `ARCHITECTURE.md` and `USAGE.md` documentation

### Changed
- `getSummary()` in data-loader now always computes from raw data instead of relying on metadata summary
- Overview charts grid changed from fixed 2-column to `auto-fit` to accommodate Secure Score chart
- `Build-Dashboard.ps1` now copies `trend-history.json` and `secure-score.json` into dashboard bundle
- `Invoke-DataCollection.ps1` appends trend snapshot after each collection run and includes SecureScore/Teams/SharePoint collectors

## [1.1.0] - 2026-02-05

### Added
- Enterprise Applications dashboard page with credential expiry tracking, status filters, and publisher classification
- New collector: `Get-EnterpriseAppData.ps1` - collects service principals and app registrations with secret/certificate expiry
- New Graph scope: `Application.Read.All` for enterprise app and app registration data
- Enterprise Apps sample data (20 apps: Microsoft first-party, third-party integrations, managed identities)
- Device certificate renewal tracking: `certExpiryDate`, `daysUntilCertExpiry`, `certStatus` fields in device collector
- Certificate Renewal summary cards on Devices page (Expired, Expiring 30d, Expiring 60d, Healthy)
- Certificate status filter and table columns on Devices page
- Certificate expiry details in device detail modal
- Features.md for tracking planned and implemented features

## [1.0.0] - 2026-02-05

### Added
- 9 data collectors: Users, Licenses, Guests, MFA, Admin Roles, Sign-In Risk, Devices, Autopilot, Defender Alerts
- Interactive dashboard with 7 pages: Overview, Users, Licenses, Guests, Security, Devices, Lifecycle
- Data bundling via `Build-Dashboard.ps1` for local file:// access (bypasses CORS)
- Sample data set for testing without live tenant
- Exponential backoff retry logic for Graph API throttling (5 retries, 60s base)
- 5-second cooldown between collectors to reduce throttling
- Cross-referencing: MFA status and admin roles merged into user records
- CSV export from any dashboard table
- Scheduled collection via Windows Task Scheduler
- Automatic dashboard build after data collection

### Fixed
- Dashboard showing empty when opened via file:// protocol (CORS bypass via JS data bundle)
- Graph API throttling failures on `Get-MgRiskyUser` endpoint (exponential backoff + cooldown)

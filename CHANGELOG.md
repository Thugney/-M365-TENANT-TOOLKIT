# TenantScope - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

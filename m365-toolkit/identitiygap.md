Identity Section Gap Analysis Summary

  Users Page
  ┌──────────┬────────────────────────────────────────────────────┬────────────────────────────────┐
  │ Priority │                        Gap                         │             Impact             │
  ├──────────┼────────────────────────────────────────────────────┼────────────────────────────────┤
  │ CRITICAL │ Password status/expiry missing                     │ Cannot track password health   │
  ├──────────┼────────────────────────────────────────────────────┼────────────────────────────────┤
  │ CRITICAL │ MFA is just a boolean - no method details          │ Cannot assess security posture │
  ├──────────┼────────────────────────────────────────────────────┼────────────────────────────────┤
  │ CRITICAL │ License names not displayed (only IDs)             │ Unusable license info          │
  ├──────────┼────────────────────────────────────────────────────┼────────────────────────────────┤
  │ CRITICAL │ No group membership visibility                     │ Cannot troubleshoot access     │
  ├──────────┼────────────────────────────────────────────────────┼────────────────────────────────┤
  │ MEDIUM   │ Missing employeeId, employeeHireDate, employeeType │ No HR correlation              │
  ├──────────┼────────────────────────────────────────────────────┼────────────────────────────────┤
  │ MEDIUM   │ No on-premises sync details                        │ Hybrid troubleshooting blind   │
  └──────────┴────────────────────────────────────────────────────┴────────────────────────────────┘
  Organization Page
  ┌──────────┬────────────────────────────────────────────┬─────────────────────────────────┐
  │ Priority │                    Gap                     │             Impact              │
  ├──────────┼────────────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ Manager stored as displayName only - no ID │ Cannot build true org hierarchy │
  ├──────────┼────────────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No cost center data                        │ No department cost allocation   │
  ├──────────┼────────────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No employeeId for HR correlation           │ Cannot match with HR systems    │
  ├──────────┼────────────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No direct reports count                    │ Must calculate client-side      │
  ├──────────┼────────────────────────────────────────────┼─────────────────────────────────┤
  │ MEDIUM   │ No employeeHireDate                        │ Cannot calculate tenure         │
  ├──────────┼────────────────────────────────────────────┼─────────────────────────────────┤
  │ MEDIUM   │ No division/business unit                  │ Limited org grouping            │
  └──────────┴────────────────────────────────────────────┴─────────────────────────────────┘
  Guest Users Page
  ┌──────────┬──────────────────────────────────────┬─────────────────────────────────┐
  │ Priority │                 Gap                  │             Impact              │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No inviter tracking                  │ Cannot audit who invited guests │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No group/Team membership             │ Unknown access scope            │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No application access data           │ Blind to app exposure           │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ No Access Reviews integration        │ Compliance failures             │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ CRITICAL │ accountEnabled not collected         │ Cannot detect disabled guests   │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ MEDIUM   │ No SharePoint/OneDrive direct shares │ Hidden file access              │
  ├──────────┼──────────────────────────────────────┼─────────────────────────────────┤
  │ MEDIUM   │ No sign-in risk assessment           │ Cannot prioritize risky guests  │
  └──────────┴──────────────────────────────────────┴─────────────────────────────────┘
  Lifecycle Page
  ┌──────────┬────────────────────────────────────────┬─────────────────────────────┐
  │ Priority │                  Gap                   │           Impact            │
  ├──────────┼────────────────────────────────────────┼─────────────────────────────┤
  │ CRITICAL │ No Lifecycle Workflows API integration │ No automation visibility    │
  ├──────────┼────────────────────────────────────────┼─────────────────────────────┤
  │ CRITICAL │ No deleted users (recycle bin)         │ No offboarding verification │
  ├──────────┼────────────────────────────────────────┼─────────────────────────────┤
  │ CRITICAL │ Missing employeeHireDate/LeaveDateTime │ Cannot track HR lifecycle   │
  ├──────────┼────────────────────────────────────────┼─────────────────────────────┤
  │ CRITICAL │ No license reclamation engine          │ Manual cleanup only         │
  ├──────────┼────────────────────────────────────────┼─────────────────────────────┤
  │ MEDIUM   │ No Access Reviews integration          │ Manual compliance tracking  │
  ├──────────┼────────────────────────────────────────┼─────────────────────────────┤
  │ MEDIUM   │ Service account lifecycle blind        │ Unknown ownership/rotation  │
  └──────────┴────────────────────────────────────────┴─────────────────────────────┘
  Technical Issues Found
  ┌───────────────────────┬───────────────────────────────────────────────────────┬──────────┐
  │       Collector       │                         Issue                         │ Severity │
  ├───────────────────────┼───────────────────────────────────────────────────────┼──────────┤
  │ Get-AdminRoleData.ps1 │ Skips service principals & groups with admin roles    │ CRITICAL │
  ├───────────────────────┼───────────────────────────────────────────────────────┼──────────┤
  │ Get-UserData.ps1      │ Missing employee attributes, password profile         │ HIGH     │
  ├───────────────────────┼───────────────────────────────────────────────────────┼──────────┤
  │ Get-GuestData.ps1     │ Missing accountEnabled, identities, creationType      │ HIGH     │
  ├───────────────────────┼───────────────────────────────────────────────────────┼──────────┤
  │ Get-MFAData.ps1       │ Missing isPasswordlessCapable, isSsprRegistered       │ HIGH     │
  ├───────────────────────┼───────────────────────────────────────────────────────┼──────────┤
  │ All collectors        │ Array concatenation in loops (slow for large tenants) │ MEDIUM   │
  └───────────────────────┴───────────────────────────────────────────────────────┴──────────┘
  addressing
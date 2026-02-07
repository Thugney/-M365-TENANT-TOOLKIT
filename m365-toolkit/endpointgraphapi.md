CA
https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccesspolicy?view=graph-rest-1.0

Autopilot 
https://learn.microsoft.com/en-us/graph/api/intune-enrollment-windowsautopilotdeviceidentity-list?view=graph-rest-1.0

intune
https://learn.microsoft.com/en-us/graph/api/intune-enrollment-windowsautopilotdeviceidentity-list?view=graph-rest-1.0

https://learn.microsoft.com/en-us/graph/api/resources/intune-app-conceptual?view=graph-rest-1.0

Teams
https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview?view=graph-rest-1.0

Cloud licensing api graph 
https://learn.microsoft.com/en-us/graph/api/resources/cloud-licensing-api-overview?view=graph-rest-beta



TenantScope: Complete 4-Week Implementation Plan

  Team Reports Complete
  ┌──────────────────────┬─────────────────────────────────────────────────────────────────────────┬────────┐
  │        Agent         │                               Deliverable                               │ Status │
  ├──────────────────────┼─────────────────────────────────────────────────────────────────────────┼────────┤
  │ Graph API Specialist │ 32+ endpoints documented, permissions matrix, rate limits, known issues │ Done   │
  ├──────────────────────┼─────────────────────────────────────────────────────────────────────────┼────────┤
  │ Implementation Lead  │ 14 tasks with specific code changes, file paths, line numbers           │ Done   │
  ├──────────────────────┼─────────────────────────────────────────────────────────────────────────┼────────┤
  │ UX Designer          │ 6 feature designs with HTML/CSS/JS snippets                             │ Done   │
  └──────────────────────┴─────────────────────────────────────────────────────────────────────────┴────────┘
  ---
  Implementation Timeline

  PHASE 1: Critical Fixes (Week 1) - 4-5 hours
  ┌─────────────────────────────┬──────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────┐
  │            Task             │                       File(s)                        │                              Change                               │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ 1. Fix Tenant ID validation │ config.json line 2Invoke-DataCollection.ps1 line 240 │ Change placeholder to GUID formatAdd Test-TenantIdFormat function │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ 2. Fix text contrast        │ dashboard/css/style.css line 31                      │ --color-text-muted: #6b7280 (WCAG AA: 5.5:1)                      │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ 3. Add ARIA labels          │ dashboard/index.html lines 49-270                    │ Add aria-label to nav links, modals, buttons                      │
  ├─────────────────────────────┼──────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
  │ 4. Add skip-to-content      │ dashboard/index.html line 20                         │ Add <a href="#main-content" class="sr-only">Skip to content</a>   │
  └─────────────────────────────┴──────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────┘
  PHASE 2: High Priority (Week 2) - 12-16 hours
  ┌─────────────────────────┬──────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────┐
  │          Task           │                         File(s)                          │                             Change                             │
  ├─────────────────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ 5. Extract shared code  │ Create lib/CollectorBase.ps1                             │ Move Invoke-GraphWithRetry, Get-DaysSinceDate to shared module │
  ├─────────────────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ 6. Filter state chips   │ Create js/filter-state-manager.jsdashboard/css/style.css │ Add filter chips component with clear-all button               │
  ├─────────────────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ 7. Modal focus trap     │ dashboard/js/app.js                                      │ Add focus trap on modal open, restore on close                 │
  ├─────────────────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
  │ 8. Error/loading states │ Create js/state-manager.jsdashboard/index.html           │ Add loading spinner, error banner, stale data warning          │
  └─────────────────────────┴──────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────┘
  PHASE 3: UX Polish (Week 3) - 16-20 hours
  ┌──────────────────────────┬───────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┐
  │           Task           │                        File(s)                        │                        Change                         │
  ├──────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 9. Mobile navigation     │ Create js/mobile-navigation.jsdashboard/css/style.css │ Bottom sheet drawer (replaces broken sidebar overlay) │
  ├──────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 10. Global search        │ Create js/global-search.jsdashboard/index.html        │ Ctrl+K search across users, devices, apps             │
  ├──────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
  │ 11. Consolidate licenses │ Create js/page-licenses-consolidated.js               │ Merge Licenses + Overlap Analysis with tabs           │
  └──────────────────────────┴───────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┘
  PHASE 4: Technical Debt (Week 4) - 12-16 hours
  ┌──────────────────────────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────┐
  │             Task             │                        File(s)                         │                       Change                       │
  ├──────────────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 12. Parallelize collectors   │ Invoke-DataCollection.ps1                              │ Run independent collectors in parallel batches     │
  ├──────────────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 13. Add Pester tests         │ Create tests/*.Tests.ps1                               │ Unit tests for shared functions, config validation │
  ├──────────────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ 14. Config schema validation │ Create lib/config-schema.jsonInvoke-DataCollection.ps1 │ JSON schema validation before collection           │
  └──────────────────────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────┘
  ---
  Key Code Changes (Ready to Implement)

  Task 1: Tenant ID Validation

  config.json line 2:
  "tenantId": "00000000-0000-0000-0000-000000000000",

  Invoke-DataCollection.ps1 (add after line 239):
  function Test-TenantIdFormat {
      param([Parameter(Mandatory)][string]$TenantId)

      try { [guid]::Parse($TenantId) | Out-Null }
      catch { throw "Invalid tenantId format: must be valid GUID" }

      if ($TenantId -eq "00000000-0000-0000-0000-000000000000") {
          throw "tenantId not configured. Find yours at: Azure Portal > AAD > Properties"
      }
      return $true
  }

  Task 2: WCAG Contrast Fix

  style.css line 31:
  --color-text-muted: #6b7280;  /* WCAG AA: 5.5:1 contrast */

  Task 5: Shared Module (lib/CollectorBase.ps1)

  function Invoke-GraphWithRetry {
      param(
          [scriptblock]$ScriptBlock,
          [int]$MaxRetries = 5,
          [int]$BaseBackoffSeconds = 60
      )
      # Exponential backoff: 60s -> 120s -> 240s -> 480s -> 960s
      # Handles 429, throttl, TooManyRequests
  }

  function Get-DaysSinceDate {
      param([AllowNull()]$DateString)
      # Returns integer days or null
  }

  function Get-DomainClassification {
      param([string]$UserPrincipalName, [hashtable]$DomainConfig)
      # Returns: employee, student, or other
  }

  Task 6: Filter State Manager

  // js/filter-state-manager.js
  const FilterStateManager = (function() {
      function addFilterChip(filterType, value) {
          const chip = document.createElement('span');
          chip.className = 'filter-chip';
          chip.innerHTML = `${filterType}: ${value} <button aria-label="Remove filter">×</button>`;
          // Append to container
      }
      return { addFilterChip, clearAllFilters, getActiveFilters };
  })();

  ---
  Graph API Reference (Key Points)
  ┌────────────┬────────────────────────────────────────────┬─────────┬──────────────────────────────────────────────────┐
  │ Collector  │                  Endpoint                  │ Version │                  Critical Notes                  │
  ├────────────┼────────────────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
  │ SharePoint │ /beta/reports/getSharePointSiteUsageDetail │ beta    │ URL concealment fallback needed                  │
  ├────────────┼────────────────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
  │ SignIn     │ /identityProtection/riskDetections         │ v1.0    │ Requires P2 license                              │
  ├────────────┼────────────────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
  │ Users      │ /users with ConsistencyLevel               │ v1.0    │ Use -ConsistencyLevel eventual for large tenants │
  ├────────────┼────────────────────────────────────────────┼─────────┼──────────────────────────────────────────────────┤
  │ AppSignIn  │ /auditLogs/signIns                         │ v1.0    │ Skip token expires at ~10K records               │
  └────────────┴────────────────────────────────────────────┴─────────┴──────────────────────────────────────────────────┘
  Rate Limits:
  - 2,000 requests per 10 seconds (per app/user)
  - 30,000 requests per minute (global)
  - Exponential backoff: 60s base, 5 retries max

  ---
  New Files to Create

  lib/
    CollectorBase.ps1         # Shared PowerShell functions
    config-schema.json        # JSON schema for validation

  dashboard/js/
    filter-state-manager.js   # Filter chip visualization
    mobile-navigation.js      # Bottom sheet navigation
    global-search.js          # Ctrl+K search
    state-manager.js          # Loading/error/empty states
    page-licenses-consolidated.js  # Merged licenses page
    a11y-utilities.js         # Accessibility helpers

  tests/
    CollectorBase.Tests.ps1   # Pester tests for shared functions
    ConfigValidation.Tests.ps1 # Config validation tests

  ---
  Testing Checklist

  Accessibility

  - WCAG AA contrast (4.5:1 minimum)
  - Screen reader navigation (NVDA/JAWS)
  - Keyboard-only operation
  - Focus indicators visible

  Functionality

  - All 17 collectors complete without error
  - Filter chips appear/clear correctly
  - Mobile navigation works on 375px screen
  - Global search returns correct results
  - License tabs switch correctly

  Performance

  - Small tenant: < 2 minutes total
  - Medium tenant: < 5 minutes total
  - Parallel collectors: 40% speedup

  ---
  Estimated Total Effort
  ┌─────────────────────────┬───────────┬─────────────┐
  │          Phase          │   Hours   │ Complexity  │
  ├─────────────────────────┼───────────┼─────────────┤
  │ Phase 1: Critical Fixes │ 4-5 hrs   │ Easy        │
  ├─────────────────────────┼───────────┼─────────────┤
  │ Phase 2: High Priority  │ 12-16 hrs │ Medium      │
  ├─────────────────────────┼───────────┼─────────────┤
  │ Phase 3: UX Polish      │ 16-20 hrs │ Medium-High │
  ├─────────────────────────┼───────────┼─────────────┤
  │ Phase 4: Technical Debt │ 12-16 hrs │ Medium      │
  ├─────────────────────────┼───────────┼─────────────┤
  │ Total                   │ 44-57 hrs │             │
  └─────────────────────────┴───────────┴─────────────┘
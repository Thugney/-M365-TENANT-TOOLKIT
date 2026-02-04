#Requires -Version 7.0
<#
.SYNOPSIS
    Collects Microsoft Defender security alerts from Microsoft Graph.

.DESCRIPTION
    Retrieves security alerts from Microsoft Defender, categorized by
    severity and status.

.PARAMETER Config
    Configuration hashtable with collection settings.

.OUTPUTS
    Array of alert objects saved to data/defender-alerts.json
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [hashtable]$Config
)

function Get-DefenderData {
    param([hashtable]$Config)

    Write-Host "Collecting Defender alerts..." -ForegroundColor Cyan

    $alertDays = $Config.collection.defenderAlertDays ?? 30
    $startDate = (Get-Date).AddDays(-$alertDays).ToString('yyyy-MM-ddTHH:mm:ssZ')

    try {
        # Get security alerts using Graph Security API
        $alerts = Get-MgSecurityAlert -All -Filter "createdDateTime ge $startDate" -Property @(
            'id',
            'title',
            'severity',
            'status',
            'category',
            'createdDateTime',
            'resolvedDateTime',
            'userStates',
            'hostStates',
            'description',
            'recommendedActions'
        ) -ErrorAction SilentlyContinue

        if (-not $alerts) {
            # Try v2 alerts endpoint
            try {
                $uri = "https://graph.microsoft.com/v1.0/security/alerts_v2?`$filter=createdDateTime ge $startDate"
                $response = Invoke-MgGraphRequest -Uri $uri -Method GET
                $alerts = $response.value
            }
            catch {
                Write-Host "   Could not retrieve alerts from v2 endpoint" -ForegroundColor Yellow
                $alerts = @()
            }
        }

        Write-Host "   Found $($alerts.Count) alerts in the last $alertDays days" -ForegroundColor Gray

        $processedAlerts = @()

        foreach ($alert in $alerts) {
            # Get affected user
            $affectedUser = $null
            if ($alert.userStates -and $alert.userStates.Count -gt 0) {
                $affectedUser = $alert.userStates[0].userPrincipalName
            }
            elseif ($alert.UserStates -and $alert.UserStates.Count -gt 0) {
                $affectedUser = $alert.UserStates[0].UserPrincipalName
            }

            # Get affected device
            $affectedDevice = $null
            if ($alert.hostStates -and $alert.hostStates.Count -gt 0) {
                $affectedDevice = $alert.hostStates[0].netBiosName
            }
            elseif ($alert.HostStates -and $alert.HostStates.Count -gt 0) {
                $affectedDevice = $alert.HostStates[0].NetBiosName
            }

            # Map severity
            $severity = switch ($alert.severity ?? $alert.Severity) {
                'high' { 'high' }
                'medium' { 'medium' }
                'low' { 'low' }
                'informational' { 'informational' }
                default { 'informational' }
            }

            # Map status
            $status = switch ($alert.status ?? $alert.Status) {
                'new' { 'new' }
                'newAlert' { 'new' }
                'inProgress' { 'inProgress' }
                'resolved' { 'resolved' }
                default { $alert.status ?? $alert.Status ?? 'unknown' }
            }

            # Get recommended actions
            $recommendedActions = ''
            if ($alert.recommendedActions) {
                if ($alert.recommendedActions -is [array]) {
                    $recommendedActions = ($alert.recommendedActions | ForEach-Object {
                        if ($_ -is [string]) { $_ } else { $_.action ?? $_.Action ?? $_ }
                    }) -join '; '
                } else {
                    $recommendedActions = $alert.recommendedActions.ToString()
                }
            }

            $processedAlerts += [PSCustomObject]@{
                id                 = $alert.id ?? $alert.Id
                title              = $alert.title ?? $alert.Title
                severity           = $severity
                status             = $status
                category           = $alert.category ?? $alert.Category
                createdDateTime    = $alert.createdDateTime ?? $alert.CreatedDateTime
                resolvedDateTime   = $alert.resolvedDateTime ?? $alert.ResolvedDateTime
                affectedUser       = $affectedUser
                affectedDevice     = $affectedDevice
                description        = $alert.description ?? $alert.Description
                recommendedActions = $recommendedActions
            }
        }

        # Sort by severity and date
        $processedAlerts = $processedAlerts | Sort-Object -Property @{
            Expression = {
                switch ($_.severity) {
                    'high' { 0 }
                    'medium' { 1 }
                    'low' { 2 }
                    'informational' { 3 }
                    default { 4 }
                }
            }
        }, @{
            Expression = { $_.createdDateTime }
            Descending = $true
        }

        Write-Host "   Processed $($processedAlerts.Count) alerts" -ForegroundColor Green
        return $processedAlerts
    }
    catch {
        Write-Host "   Error collecting Defender data: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Export function for use by main collector
if ($MyInvocation.InvocationName -ne '.') {
    if (-not $Config) {
        $Config = @{
            collection = @{
                defenderAlertDays = 30
            }
        }
    }
    Get-DefenderData -Config $Config
}

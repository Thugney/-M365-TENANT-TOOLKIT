/**
 * TenantScope - Credential Expiry Page
 */

const PageCredentialExpiry = (function() {
    'use strict';

    var colSelector = null;
    var currentTab = 'overview';
    var credState = null;

    // Extract flat credentials from nested structure
    function extractCredentials(rawData) {
        if (Array.isArray(rawData)) return rawData;
        if (!rawData || !rawData.applications) return [];
        var creds = [];
        rawData.applications.forEach(function(app) {
            (app.secrets || []).forEach(function(s) {
                creds.push({
                    appDisplayName: app.displayName,
                    credentialType: 'secret',
                    status: s.status,
                    daysUntilExpiry: s.daysUntilExpiry,
                    expiryDate: s.endDateTime
                });
            });
            (app.certificates || []).forEach(function(c) {
                creds.push({
                    appDisplayName: app.displayName,
                    credentialType: 'certificate',
                    status: c.status,
                    daysUntilExpiry: c.daysUntilExpiry,
                    expiryDate: c.endDateTime
                });
            });
        });
        return creds;
    }

    function applyFilters() {
        var creds = extractCredentials(DataLoader.getData('servicePrincipalSecrets'));
        var filterConfig = { search: Filters.getValue('creds-search'), searchFields: ['appDisplayName', 'credentialType'], exact: {} };
        var typeFilter = Filters.getValue('creds-type');
        if (typeFilter && typeFilter !== 'all') filterConfig.exact.credentialType = typeFilter;
        var filteredData = Filters.apply(creds, filterConfig);
        var statusFilter = Filters.getValue('creds-status');
        if (statusFilter && statusFilter !== 'all') filteredData = filteredData.filter(function(c) { return c.status === statusFilter; });
        renderTable(filteredData);
    }

    function renderTable(data) {
        var visible = colSelector ? colSelector.getVisible() : ['appDisplayName', 'credentialType', 'status', 'daysUntilExpiry', 'expiryDate'];
        var allDefs = [
            { key: 'appDisplayName', label: 'Application' },
            { key: 'credentialType', label: 'Type', formatter: function(v) {
                return v === 'secret' ? '<span class="badge badge-warning">Secret</span>' : '<span class="badge badge-info">Certificate</span>';
            }},
            { key: 'status', label: 'Status', formatter: function(v) {
                var statuses = { 'expired': 'badge-critical', 'critical': 'badge-critical', 'warning': 'badge-warning', 'healthy': 'badge-success' };
                return '<span class="badge ' + (statuses[v] || 'badge-neutral') + '">' + (v || 'Unknown') + '</span>';
            }},
            { key: 'daysUntilExpiry', label: 'Days Left', formatter: function(v) {
                if (v === null || v === undefined) return '<span class="text-muted">--</span>';
                var cls = v < 0 ? 'text-critical font-bold' : v <= 30 ? 'text-critical' : v <= 60 ? 'text-warning' : 'text-success';
                return '<span class="' + cls + '">' + v + '</span>';
            }},
            { key: 'expiryDate', label: 'Expiry Date', formatter: Tables.formatters.date }
        ];
        Tables.render({ containerId: 'creds-table', data: data, columns: allDefs.filter(function(c) { return visible.indexOf(c.key) !== -1; }), pageSize: 50 });
    }

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        renderContent();
    }

    function renderContent() {
        var container = document.getElementById('creds-content');
        if (!container || !credState) return;

        switch (currentTab) {
            case 'overview':
                renderOverview(container, credState);
                break;
            case 'credentials':
                renderCredentialsTab(container, credState);
                break;
        }
    }

    function renderOverview(container, state) {
        var creds = state.creds;

        // Calculate type breakdown
        var secrets = creds.filter(function(c) { return c.credentialType === 'secret'; });
        var certificates = creds.filter(function(c) { return c.credentialType === 'certificate'; });

        // Calculate app breakdown (top 5 apps with most credentials needing attention)
        var appStats = {};
        creds.forEach(function(c) {
            var app = c.appDisplayName || 'Unknown';
            if (!appStats[app]) {
                appStats[app] = { total: 0, expired: 0, critical: 0 };
            }
            appStats[app].total++;
            if (c.status === 'expired') appStats[app].expired++;
            if (c.status === 'critical') appStats[app].critical++;
        });

        var html = '<div class="charts-row" id="creds-charts"></div>';

        // Analytics grid with breakdowns
        html += '<div class="analytics-grid">';

        // Status Breakdown card
        html += '<div class="analytics-card">';
        html += '<h4>Credential Status</h4>';
        html += '<div class="stat-list">';
        var expiredClass = state.expired > 0 ? 'text-critical' : 'text-success';
        var criticalClass = state.critical > 0 ? 'text-critical' : 'text-success';
        var warningClass = state.warning > 0 ? 'text-warning' : 'text-success';
        html += '<div class="stat-row"><span class="stat-label">Expired</span><span class="stat-value ' + expiredClass + '">' + state.expired + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Critical (< 30 days)</span><span class="stat-value ' + criticalClass + '">' + state.critical + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Warning (< 60 days)</span><span class="stat-value ' + warningClass + '">' + state.warning + '</span></div>';
        html += '<div class="stat-row"><span class="stat-label">Healthy</span><span class="stat-value text-success">' + state.healthy + '</span></div>';
        html += '</div></div>';

        // Type Breakdown card
        html += '<div class="analytics-card">';
        html += '<h4>By Credential Type</h4>';
        html += '<div class="stat-list">';
        var secretsExpired = secrets.filter(function(s) { return s.status === 'expired' || s.status === 'critical'; }).length;
        var certsExpired = certificates.filter(function(c) { return c.status === 'expired' || c.status === 'critical'; }).length;
        var secretClass = secretsExpired > 0 ? 'text-warning' : 'text-success';
        var certClass = certsExpired > 0 ? 'text-warning' : 'text-success';
        html += '<div class="stat-row"><span class="stat-label">Secrets</span><span class="stat-value">' + secrets.length + ' <span class="' + secretClass + '">(' + secretsExpired + ' need attention)</span></span></div>';
        html += '<div class="stat-row"><span class="stat-label">Certificates</span><span class="stat-value">' + certificates.length + ' <span class="' + certClass + '">(' + certsExpired + ' need attention)</span></span></div>';
        html += '</div></div>';

        // Apps Needing Attention card
        var appsNeedingAttention = Object.keys(appStats).filter(function(app) {
            return appStats[app].expired > 0 || appStats[app].critical > 0;
        }).sort(function(a, b) {
            return (appStats[b].expired + appStats[b].critical) - (appStats[a].expired + appStats[a].critical);
        }).slice(0, 5);

        html += '<div class="analytics-card">';
        html += '<h4>Apps Needing Attention</h4>';
        html += '<div class="stat-list">';
        if (appsNeedingAttention.length > 0) {
            appsNeedingAttention.forEach(function(app) {
                var stats = appStats[app];
                var count = stats.expired + stats.critical;
                html += '<div class="stat-row"><span class="stat-label">' + app + '</span><span class="stat-value text-critical">' + count + ' credential' + (count !== 1 ? 's' : '') + '</span></div>';
            });
        } else {
            html += '<div class="stat-row"><span class="stat-label text-success">All apps healthy</span></div>';
        }
        html += '</div></div>';

        html += '</div>'; // End analytics-grid

        // Credentials Requiring Action table
        var actionRequired = creds.filter(function(c) { return c.status === 'expired' || c.status === 'critical'; });
        if (actionRequired.length > 0) {
            html += '<div class="analytics-section">';
            html += '<h3>Credentials Requiring Action (' + actionRequired.length + ')</h3>';
            html += '<table class="data-table"><thead><tr>';
            html += '<th>Application</th><th>Type</th><th>Status</th><th>Days Left</th><th>Expiry Date</th>';
            html += '</tr></thead><tbody>';
            actionRequired.slice(0, 10).forEach(function(c) {
                var statusClass = c.status === 'expired' ? 'badge-critical' : 'badge-warning';
                var daysClass = c.daysUntilExpiry < 0 ? 'text-critical font-bold' : 'text-critical';
                html += '<tr>';
                html += '<td>' + (c.appDisplayName || 'Unknown') + '</td>';
                html += '<td><span class="badge ' + (c.credentialType === 'secret' ? 'badge-warning' : 'badge-info') + '">' + c.credentialType + '</span></td>';
                html += '<td><span class="badge ' + statusClass + '">' + c.status + '</span></td>';
                html += '<td class="' + daysClass + '">' + (c.daysUntilExpiry !== null ? c.daysUntilExpiry : '--') + '</td>';
                html += '<td>' + (c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '--') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            if (actionRequired.length > 10) {
                html += '<p class="text-muted" style="margin-top: 0.5rem;">Showing 10 of ' + actionRequired.length + ' credentials. View all in the Credentials tab.</p>';
            }
            html += '</div>';
        }

        container.innerHTML = html;
        renderCredCharts(state);
    }

    function renderCredCharts(state) {
        var chartsRow = document.getElementById('creds-charts');
        if (!chartsRow || typeof DashboardCharts === 'undefined') return;

        chartsRow.textContent = '';
        var C = DashboardCharts.colors;

        chartsRow.appendChild(DashboardCharts.createChartCard(
            'Credential Status',
            [
                { value: state.expired, label: 'Expired', color: C.red },
                { value: state.critical, label: 'Critical', color: C.orange },
                { value: state.warning, label: 'Warning', color: C.yellow },
                { value: state.healthy, label: 'Healthy', color: C.green }
            ],
            String(state.total), 'total credentials'
        ));
    }

    function renderCredentialsTab(container, state) {
        var html = '<div class="filter-bar"><input type="text" class="filter-input" id="creds-search" placeholder="Search applications...">';
        html += '<select class="filter-select" id="creds-type"><option value="all">All Types</option><option value="secret">Secrets</option><option value="certificate">Certificates</option></select>';
        html += '<select class="filter-select" id="creds-status"><option value="all">All Statuses</option><option value="expired">Expired</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="healthy">Healthy</option></select>';
        html += '<div id="creds-colselector"></div></div>';
        html += '<div class="table-container" id="creds-table"></div>';
        container.innerHTML = html;

        colSelector = ColumnSelector.create({
            containerId: 'creds-colselector',
            storageKey: 'tenantscope-creds-cols',
            allColumns: [
                { key: 'appDisplayName', label: 'Application' },
                { key: 'credentialType', label: 'Type' },
                { key: 'status', label: 'Status' },
                { key: 'daysUntilExpiry', label: 'Days Left' },
                { key: 'expiryDate', label: 'Expiry Date' }
            ],
            defaultVisible: ['appDisplayName', 'credentialType', 'status', 'daysUntilExpiry', 'expiryDate'],
            onColumnsChanged: function() { applyFilters(); }
        });

        Filters.setup('creds-search', applyFilters);
        Filters.setup('creds-type', applyFilters);
        Filters.setup('creds-status', applyFilters);
        applyFilters();
    }

    function render(container) {
        var creds = extractCredentials(DataLoader.getData('servicePrincipalSecrets'));
        var total = creds.length;
        var expired = creds.filter(function(c) { return c.status === 'expired'; }).length;
        var critical = creds.filter(function(c) { return c.status === 'critical'; }).length;
        var warning = creds.filter(function(c) { return c.status === 'warning'; }).length;
        var healthy = creds.filter(function(c) { return c.status === 'healthy'; }).length;

        credState = {
            creds: creds,
            total: total,
            expired: expired,
            critical: critical,
            warning: warning,
            healthy: healthy
        };

        var html = '<div class="page-header"><h2>Credential Expiry</h2></div>';
        html += '<div class="summary-cards">';
        html += '<div class="summary-card"><div class="summary-value">' + total + '</div><div class="summary-label">Total Credentials</div></div>';
        html += '<div class="summary-card card-danger"><div class="summary-value">' + expired + '</div><div class="summary-label">Expired</div></div>';
        html += '<div class="summary-card card-danger"><div class="summary-value">' + critical + '</div><div class="summary-label">Critical</div></div>';
        html += '<div class="summary-card card-warning"><div class="summary-value">' + warning + '</div><div class="summary-label">Warning</div></div>';
        html += '<div class="summary-card card-success"><div class="summary-value">' + healthy + '</div><div class="summary-label">Healthy</div></div>';
        html += '</div>';

        html += '<div class="tab-bar">';
        html += '<button class="tab-btn active" data-tab="overview">Overview</button>';
        html += '<button class="tab-btn" data-tab="credentials">Credentials (' + total + ')</button>';
        html += '</div>';

        html += '<div class="content-area" id="creds-content"></div>';
        container.innerHTML = html;

        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
        });

        currentTab = 'overview';
        renderContent();
    }

    return { render: render };
})();

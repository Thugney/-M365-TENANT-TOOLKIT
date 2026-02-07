/**
 * TenantScope - Sign-In Logs Page
 */

const PageSignInLogs = (function() {
    'use strict';

    var colSelector = null;
    var currentTab = 'overview';
    var signinState = null;

    // Extract and map sign-ins from nested structure
    function extractSignIns(rawData) {
        var signIns = [];
        if (Array.isArray(rawData)) {
            signIns = rawData;
        } else if (rawData && rawData.signIns) {
            signIns = rawData.signIns;
        }
        // Map and normalize field names for display
        return signIns.map(function(s) {
            // Normalize status to lowercase for filter matching
            var status = (s.status || '').toLowerCase();
            if (status === 'interrupted') status = 'interrupted';
            else if (status === 'success' || s.errorCode === 0) status = 'success';
            else if (status === 'failed' || status === 'failure' || s.errorCode > 0) status = 'failure';

            // Build location string from city and country
            var location = s.location;
            if (!location && (s.city || s.country)) {
                location = [s.city, s.country].filter(Boolean).join(', ');
            }

            // Determine MFA status
            var mfaSatisfied = s.mfaSatisfied;
            if (mfaSatisfied === undefined && s.mfaDetail) {
                mfaSatisfied = !!s.mfaDetail.authMethod;
            }

            // Map CA status
            var caStatus = s.caStatus || s.conditionalAccessStatus;
            if (caStatus === 'success') caStatus = 'success';
            else if (caStatus === 'failure') caStatus = 'failure';
            else if (caStatus === 'notApplied') caStatus = 'notApplied';

            return {
                id: s.id,
                createdDateTime: s.createdDateTime,
                userPrincipalName: s.userPrincipalName,
                userDisplayName: s.userDisplayName,
                appDisplayName: s.appDisplayName,
                status: status,
                errorCode: s.errorCode,
                failureReason: s.failureReason,
                mfaSatisfied: mfaSatisfied,
                caStatus: caStatus,
                location: location,
                ipAddress: s.ipAddress,
                riskLevel: (s.riskLevel || 'none').toLowerCase(),
                riskState: s.riskState,
                clientAppUsed: s.clientAppUsed,
                deviceDetail: s.deviceDetail,
                isInteractive: s.isInteractive
            };
        });
    }

    function applyFilters() {
        var logs = extractSignIns(DataLoader.getData('signinLogs'));
        var filterConfig = { search: Filters.getValue('signin-search'), searchFields: ['userPrincipalName', 'userDisplayName', 'appDisplayName', 'ipAddress', 'location'], exact: {} };
        var statusFilter = Filters.getValue('signin-status');
        if (statusFilter && statusFilter !== 'all') filterConfig.exact.status = statusFilter;
        var filteredData = Filters.apply(logs, filterConfig);
        var mfaFilter = Filters.getValue('signin-mfa');
        if (mfaFilter === 'satisfied') filteredData = filteredData.filter(function(l) { return l.mfaSatisfied === true; });
        else if (mfaFilter === 'notsatisfied') filteredData = filteredData.filter(function(l) { return l.mfaSatisfied === false; });
        var riskFilter = Filters.getValue('signin-risk');
        if (riskFilter && riskFilter !== 'all') filteredData = filteredData.filter(function(l) { return l.riskLevel === riskFilter; });
        renderTable(filteredData);
    }

    function renderTable(data) {
        var visible = colSelector ? colSelector.getVisible() : ['createdDateTime', 'userPrincipalName', 'appDisplayName', 'status', 'mfaSatisfied', 'location', 'riskLevel'];
        var allDefs = [
            { key: 'createdDateTime', label: 'Time', formatter: Tables.formatters.datetime },
            { key: 'userPrincipalName', label: 'User', className: 'cell-truncate' },
            { key: 'appDisplayName', label: 'Application' },
            { key: 'status', label: 'Status', formatter: function(v) {
                var statuses = { 'success': 'badge-success', 'failure': 'badge-critical', 'interrupted': 'badge-warning' };
                return '<span class="badge ' + (statuses[v] || 'badge-neutral') + '">' + (v || 'Unknown') + '</span>';
            }},
            { key: 'mfaSatisfied', label: 'MFA', formatter: function(v) {
                return v === true ? '<span class="text-success">Yes</span>' : '<span class="text-critical">No</span>';
            }},
            { key: 'caStatus', label: 'CA Result', formatter: function(v) {
                var statuses = { 'success': 'badge-success', 'failure': 'badge-critical', 'notApplied': 'badge-neutral' };
                return '<span class="badge ' + (statuses[v] || 'badge-neutral') + '">' + (v || '--') + '</span>';
            }},
            { key: 'location', label: 'Location' },
            { key: 'ipAddress', label: 'IP Address' },
            { key: 'riskLevel', label: 'Risk', formatter: function(v) {
                var risks = { 'high': 'badge-critical', 'medium': 'badge-warning', 'low': 'badge-info', 'none': 'badge-success' };
                return '<span class="badge ' + (risks[v] || 'badge-neutral') + '">' + (v || 'None') + '</span>';
            }}
        ];
        Tables.render({ containerId: 'signin-table', data: data, columns: allDefs.filter(function(c) { return visible.indexOf(c.key) !== -1; }), pageSize: 100 });
    }

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        renderContent();
    }

    function renderContent() {
        var container = document.getElementById('signin-content');
        if (!container || !signinState) return;

        switch (currentTab) {
            case 'overview':
                renderOverview(container, signinState);
                break;
            case 'logs':
                renderLogsTab(container, signinState);
                break;
        }
    }

    function renderOverview(container, state) {
        container.innerHTML = '<div class="charts-row" id="signin-charts"></div>';
        renderSigninCharts(state);
    }

    function renderSigninCharts(state) {
        var chartsRow = document.getElementById('signin-charts');
        if (!chartsRow || typeof DashboardCharts === 'undefined') return;

        chartsRow.textContent = '';
        var C = DashboardCharts.colors;

        var interrupted = state.logs.filter(function(l) { return l.status === 'interrupted'; }).length;

        chartsRow.appendChild(DashboardCharts.createChartCard(
            'Sign-In Status',
            [
                { value: state.success, label: 'Success', color: C.green },
                { value: state.failure, label: 'Failure', color: C.red },
                { value: interrupted, label: 'Interrupted', color: C.yellow }
            ],
            String(state.total), 'total sign-ins'
        ));

        chartsRow.appendChild(DashboardCharts.createChartCard(
            'MFA Satisfaction',
            [
                { value: state.mfaCount, label: 'Satisfied', color: C.green },
                { value: Math.max(state.total - state.mfaCount, 0), label: 'Not Satisfied', color: C.red }
            ],
            state.total > 0 ? Math.round((state.mfaCount / state.total) * 100) + '%' : '0%',
            'coverage'
        ));

        var high = state.logs.filter(function(l) { return l.riskLevel === 'high'; }).length;
        var medium = state.logs.filter(function(l) { return l.riskLevel === 'medium'; }).length;
        var low = state.logs.filter(function(l) { return l.riskLevel === 'low'; }).length;
        var none = state.logs.filter(function(l) { return !l.riskLevel || l.riskLevel === 'none'; }).length;

        chartsRow.appendChild(DashboardCharts.createChartCard(
            'Risk Distribution',
            [
                { value: high, label: 'High', color: C.red },
                { value: medium, label: 'Medium', color: C.yellow },
                { value: low, label: 'Low', color: C.blue },
                { value: none, label: 'None', color: C.gray }
            ],
            String(state.risky), 'risky sign-ins'
        ));
    }

    function renderLogsTab(container, state) {
        var html = '<div class="filter-bar"><input type="text" class="filter-input" id="signin-search" placeholder="Search...">';
        html += '<select class="filter-select" id="signin-status"><option value="all">All Status</option><option value="success">Success</option><option value="failure">Failure</option></select>';
        html += '<select class="filter-select" id="signin-mfa"><option value="all">All MFA</option><option value="satisfied">MFA Satisfied</option><option value="notsatisfied">MFA Not Satisfied</option></select>';
        html += '<select class="filter-select" id="signin-risk"><option value="all">All Risk</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>';
        html += '<div id="signin-colselector"></div></div>';
        html += '<div class="table-container" id="signin-table"></div>';
        container.innerHTML = html;

        colSelector = ColumnSelector.create({
            containerId: 'signin-colselector',
            storageKey: 'tenantscope-signin-cols',
            allColumns: [
                { key: 'createdDateTime', label: 'Time' },
                { key: 'userPrincipalName', label: 'User' },
                { key: 'appDisplayName', label: 'Application' },
                { key: 'status', label: 'Status' },
                { key: 'mfaSatisfied', label: 'MFA' },
                { key: 'location', label: 'Location' },
                { key: 'riskLevel', label: 'Risk' }
            ],
            defaultVisible: ['createdDateTime', 'userPrincipalName', 'appDisplayName', 'status', 'mfaSatisfied', 'location', 'riskLevel'],
            onColumnsChanged: function() { applyFilters(); }
        });

        Filters.setup('signin-search', applyFilters);
        Filters.setup('signin-status', applyFilters);
        Filters.setup('signin-mfa', applyFilters);
        Filters.setup('signin-risk', applyFilters);
        applyFilters();
    }

    function render(container) {
        var logs = extractSignIns(DataLoader.getData('signinLogs'));
        var total = logs.length;
        var success = logs.filter(function(l) { return l.status === 'success'; }).length;
        var failure = logs.filter(function(l) { return l.status === 'failure'; }).length;
        var mfaCount = logs.filter(function(l) { return l.mfaSatisfied === true; }).length;
        var risky = logs.filter(function(l) { return l.riskLevel && l.riskLevel !== 'none'; }).length;

        signinState = {
            logs: logs,
            total: total,
            success: success,
            failure: failure,
            mfaCount: mfaCount,
            risky: risky
        };

        var html = '<div class="page-header"><h2>Sign-In Logs</h2></div>';
        html += '<div class="summary-cards">';
        html += '<div class="summary-card"><div class="summary-value">' + total + '</div><div class="summary-label">Total Sign-Ins</div></div>';
        html += '<div class="summary-card card-success"><div class="summary-value">' + success + '</div><div class="summary-label">Successful</div></div>';
        html += '<div class="summary-card card-danger"><div class="summary-value">' + failure + '</div><div class="summary-label">Failed</div></div>';
        html += '<div class="summary-card"><div class="summary-value">' + mfaCount + '</div><div class="summary-label">With MFA</div></div>';
        html += '<div class="summary-card card-warning"><div class="summary-value">' + risky + '</div><div class="summary-label">Risky</div></div>';
        html += '</div>';

        html += '<div class="tab-bar">';
        html += '<button class="tab-btn active" data-tab="overview">Overview</button>';
        html += '<button class="tab-btn" data-tab="logs">Sign-In Logs (' + total + ')</button>';
        html += '</div>';

        html += '<div class="content-area" id="signin-content"></div>';
        container.innerHTML = html;

        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
        });

        currentTab = 'overview';
        renderContent();
    }

    return { render: render };
})();

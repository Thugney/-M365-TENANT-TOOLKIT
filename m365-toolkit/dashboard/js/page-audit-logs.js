/**
 * ============================================================================
 * TenantScope
 * Author: Robel (https://github.com/Thugney)
 * Repository: https://github.com/Thugney/-M365-TENANT-TOOLKIT
 * License: MIT
 * ============================================================================
 *
 * PAGE: AUDIT LOGS
 *
 * Renders the directory audit logs page with summary cards and a
 * filterable table of audit events from Microsoft Entra ID.
 *
 * NOTE: This page renders static HTML structure and locally-collected
 * Graph API JSON data. No user-submitted content is rendered.
 * innerHTML usage follows the established pattern of all other page modules.
 */

const PageAuditLogs = (function() {
    'use strict';

    var currentTab = 'overview';
    var auditState = null;

    function switchTab(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        renderContent();
    }

    function renderContent() {
        var container = document.getElementById('audit-content');
        if (!container || !auditState) return;

        switch (currentTab) {
            case 'overview':
                renderOverview(container, auditState);
                break;
            case 'events':
                renderEventsTab(container, auditState);
                break;
        }
    }

    function renderOverview(container, state) {
        container.textContent = '';

        // Charts row
        var chartsRow = document.createElement('div');
        chartsRow.className = 'charts-row';
        chartsRow.id = 'audit-charts';
        container.appendChild(chartsRow);

        if (typeof DashboardCharts !== 'undefined') {
            var C = DashboardCharts.colors;

            chartsRow.appendChild(DashboardCharts.createChartCard(
                'Result Distribution',
                [
                    { value: state.successCount, label: 'Success', color: C.green },
                    { value: state.failureCount, label: 'Failure', color: C.red }
                ],
                state.totalEvents > 0 ? Math.round((state.successCount / state.totalEvents) * 100) + '%' : '0%',
                'success rate'
            ));

            var categorySegments = Object.entries(state.categories)
                .sort(function(a, b) { return b[1] - a[1]; })
                .slice(0, 6)
                .map(function(entry, idx) {
                    var catColors = [C.blue, C.teal, C.purple, C.orange, C.indigo, C.gray];
                    return { value: entry[1], label: entry[0], color: catColors[idx] || C.gray };
                });

            chartsRow.appendChild(DashboardCharts.createChartCard(
                'Events by Category',
                categorySegments,
                String(Object.keys(state.categories).length), 'categories'
            ));
        }

        // Analytics grid
        var analyticsGrid = document.createElement('div');
        analyticsGrid.className = 'analytics-grid';

        // Category breakdown card
        var categoryCard = createAnalyticsCard('Top Categories');
        var sortedCats = Object.entries(state.categories).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
        sortedCats.forEach(function(cat) {
            addStatRow(categoryCard, cat[0], cat[1], '');
        });
        analyticsGrid.appendChild(categoryCard);

        // Operation type breakdown card
        var opTypes = {};
        state.auditLogs.forEach(function(e) {
            var op = e.operationType || 'Other';
            opTypes[op] = (opTypes[op] || 0) + 1;
        });
        var opCard = createAnalyticsCard('Operation Types');
        var sortedOps = Object.entries(opTypes).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
        sortedOps.forEach(function(op) {
            addStatRow(opCard, op[0], op[1], '');
        });
        analyticsGrid.appendChild(opCard);

        // Top initiators card
        var initiators = {};
        state.auditLogs.forEach(function(e) {
            var init = e.initiatedBy || e.initiatedByApp || 'Unknown';
            initiators[init] = (initiators[init] || 0) + 1;
        });
        var initCard = createAnalyticsCard('Top Initiators');
        var sortedInit = Object.entries(initiators).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5);
        sortedInit.forEach(function(init) {
            addStatRow(initCard, init[0], init[1], '');
        });
        analyticsGrid.appendChild(initCard);

        // Result breakdown card
        var resultCard = createAnalyticsCard('Result Summary');
        addStatRow(resultCard, 'Successful', state.successCount, 'text-success');
        addStatRow(resultCard, 'Failed', state.failureCount, state.failureCount > 0 ? 'text-critical' : 'text-success');
        var successRate = state.totalEvents > 0 ? Math.round((state.successCount / state.totalEvents) * 100) : 0;
        addStatRow(resultCard, 'Success Rate', successRate + '%', successRate >= 95 ? 'text-success' : successRate >= 80 ? 'text-warning' : 'text-critical');
        analyticsGrid.appendChild(resultCard);

        container.appendChild(analyticsGrid);

        // Failed events table
        var failedEvents = state.auditLogs.filter(function(e) { return e.result === 'failure'; });
        if (failedEvents.length > 0) {
            var failSection = document.createElement('div');
            failSection.className = 'analytics-section';
            var failTitle = document.createElement('h3');
            failTitle.textContent = 'Failed Events (' + failedEvents.length + ')';
            failSection.appendChild(failTitle);
            var failTableDiv = document.createElement('div');
            failTableDiv.id = 'audit-failed-table';
            failSection.appendChild(failTableDiv);
            container.appendChild(failSection);

            Tables.render({
                containerId: 'audit-failed-table',
                data: failedEvents.slice(0, 15),
                columns: [
                    { key: 'activityDateTime', label: 'Date', formatter: Tables.formatters.datetime },
                    { key: 'initiatedBy', label: 'Initiated By', className: 'cell-truncate' },
                    { key: 'activityDisplayName', label: 'Activity', className: 'cell-truncate' },
                    { key: 'targetResource', label: 'Target', className: 'cell-truncate' },
                    { key: 'resultReason', label: 'Reason', className: 'cell-truncate' }
                ],
                pageSize: 15,
                onRowClick: showAuditLogDetails
            });
        }
    }

    function renderEventsTab(container, state) {
        container.textContent = '';
        var tableDiv = document.createElement('div');
        tableDiv.id = 'audit-logs-table';
        container.appendChild(tableDiv);

        Tables.render({
            containerId: 'audit-logs-table',
            data: state.auditLogs,
            columns: [
                { key: 'activityDateTime', label: 'Date', formatter: Tables.formatters.datetime },
                { key: 'initiatedBy', label: 'Initiated By', filterable: true, className: 'cell-truncate' },
                { key: 'initiatedByApp', label: 'App Name', filterable: true },
                { key: 'activityDisplayName', label: 'Activity', filterable: true, className: 'cell-truncate' },
                { key: 'targetResource', label: 'Target', filterable: true, className: 'cell-truncate' },
                { key: 'category', label: 'Category', filterable: true },
                { key: 'result', label: 'Status', filterable: true, formatter: Tables.formatters.resultStatus },
                { key: 'operationType', label: 'Operation', filterable: true }
            ],
            pageSize: 25,
            onRowClick: showAuditLogDetails
        });
    }

    /**
     * Creates an analytics card with title and stat-list container.
     */
    function createAnalyticsCard(title) {
        var card = document.createElement('div');
        card.className = 'analytics-card';
        var h4 = document.createElement('h4');
        h4.textContent = title;
        card.appendChild(h4);
        var statList = document.createElement('div');
        statList.className = 'stat-list';
        card.appendChild(statList);
        return card;
    }

    /**
     * Adds a stat row to an analytics card.
     */
    function addStatRow(card, label, value, valueClass) {
        var statList = card.querySelector('.stat-list');
        var row = document.createElement('div');
        row.className = 'stat-row';
        var labelSpan = document.createElement('span');
        labelSpan.className = 'stat-label';
        labelSpan.textContent = label;
        var valueSpan = document.createElement('span');
        valueSpan.className = 'stat-value' + (valueClass ? ' ' + valueClass : '');
        valueSpan.textContent = String(value);
        row.appendChild(labelSpan);
        row.appendChild(valueSpan);
        statList.appendChild(row);
    }

    /**
     * Renders the audit logs page content.
     *
     * @param {HTMLElement} container - The page container element
     */
    function render(container) {
        var auditLogs = DataLoader.getData('auditLogs') || [];

        // Calculate stats
        var totalEvents = auditLogs.length;
        var successCount = auditLogs.filter(function(e) { return e.result === 'success'; }).length;
        var failureCount = auditLogs.filter(function(e) { return e.result === 'failure'; }).length;

        // Count categories
        var categories = {};
        auditLogs.forEach(function(e) {
            var cat = e.category || 'Other';
            categories[cat] = (categories[cat] || 0) + 1;
        });
        var topCategory = Object.entries(categories).sort(function(a, b) { return b[1] - a[1]; })[0];

        auditState = {
            auditLogs: auditLogs,
            totalEvents: totalEvents,
            successCount: successCount,
            failureCount: failureCount,
            categories: categories,
            topCategory: topCategory
        };

        // Build page structure
        container.textContent = '';

        // Page header
        var header = document.createElement('div');
        header.className = 'page-header';
        var h2 = document.createElement('h2');
        h2.textContent = 'Audit Logs';
        var desc = document.createElement('p');
        desc.className = 'page-description';
        desc.textContent = 'Directory audit events from Microsoft Entra ID';
        header.appendChild(h2);
        header.appendChild(desc);
        container.appendChild(header);

        // Summary cards
        var cardsGrid = document.createElement('div');
        cardsGrid.className = 'summary-cards';

        cardsGrid.appendChild(createSummaryCard('Total Events', String(totalEvents), '', ''));
        cardsGrid.appendChild(createSummaryCard('Successful', String(successCount), 'card-success', 'text-success'));
        cardsGrid.appendChild(createSummaryCard('Failed', String(failureCount),
            failureCount > 0 ? 'card-danger' : 'card-success', failureCount > 0 ? 'text-critical' : 'text-success'));
        cardsGrid.appendChild(createSummaryCard('Top Category',
            topCategory ? topCategory[0] : '--', '', '', topCategory ? topCategory[1] + ' events' : ''));

        container.appendChild(cardsGrid);

        // Tab bar
        var tabBar = document.createElement('div');
        tabBar.className = 'tab-bar';
        var overviewBtn = document.createElement('button');
        overviewBtn.className = 'tab-btn active';
        overviewBtn.dataset.tab = 'overview';
        overviewBtn.textContent = 'Overview';
        var eventsBtn = document.createElement('button');
        eventsBtn.className = 'tab-btn';
        eventsBtn.dataset.tab = 'events';
        eventsBtn.textContent = 'All Events (' + totalEvents + ')';
        tabBar.appendChild(overviewBtn);
        tabBar.appendChild(eventsBtn);
        container.appendChild(tabBar);

        // Content area
        var contentArea = document.createElement('div');
        contentArea.className = 'content-area';
        contentArea.id = 'audit-content';
        container.appendChild(contentArea);

        // Tab click handlers
        document.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
        });

        currentTab = 'overview';
        renderContent();
    }

    /**
     * Helper: creates a summary card element.
     */
    function createSummaryCard(label, value, cardClass, valueClass, changeText) {
        var card = document.createElement('div');
        card.className = 'summary-card' + (cardClass ? ' ' + cardClass : '');

        var lbl = document.createElement('div');
        lbl.className = 'summary-label';
        lbl.textContent = label;
        card.appendChild(lbl);

        var val = document.createElement('div');
        val.className = 'summary-value' + (valueClass ? ' ' + valueClass : '');
        val.textContent = value;
        card.appendChild(val);

        if (changeText) {
            var change = document.createElement('div');
            change.className = 'card-change';
            change.textContent = changeText;
            card.appendChild(change);
        }

        return card;
    }

    /**
     * Shows audit log entry details in modal.
     */
    function showAuditLogDetails(item) {
        var modal = document.getElementById('modal-overlay');
        var title = document.getElementById('modal-title');
        var body = document.getElementById('modal-body');

        title.textContent = 'Audit Log Details';

        // Build detail view with DOM methods
        var detailList = document.createElement('div');
        detailList.className = 'detail-list';

        var fields = [
            { label: 'Activity', value: item.activityDisplayName || '--' },
            { label: 'Date', value: item.activityDateTime ? DataLoader.formatDate(item.activityDateTime) : '--' },
            { label: 'Initiated By', value: item.initiatedBy || '--' },
            { label: 'App Name', value: item.initiatedByApp || '--' },
            { label: 'Target', value: item.targetResource || '--' },
            { label: 'Target Type', value: item.targetResourceType || '--' },
            { label: 'Category', value: item.category || '--' },
            { label: 'Result', value: item.result || '--' },
            { label: 'Result Reason', value: item.resultReason || '--' },
            { label: 'Operation Type', value: item.operationType || '--' },
            { label: 'Service', value: item.loggedByService || '--' },
            { label: 'Correlation ID', value: item.correlationId || '--' }
        ];

        fields.forEach(function(f) {
            var labelSpan = document.createElement('span');
            labelSpan.className = 'detail-label';
            labelSpan.textContent = f.label + ':';
            detailList.appendChild(labelSpan);

            var valueSpan = document.createElement('span');
            valueSpan.className = 'detail-value';
            valueSpan.textContent = f.value;
            detailList.appendChild(valueSpan);
        });

        body.textContent = '';
        body.appendChild(detailList);
        modal.classList.add('visible');
    }

    // Public API
    return {
        render: render
    };

})();

// Register page
window.PageAuditLogs = PageAuditLogs;

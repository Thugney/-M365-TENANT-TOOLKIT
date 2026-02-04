/**
 * M365 Tenant Toolkit - Devices Page
 * Intune managed devices overview
 */

const PageDevices = (function() {
    let allDevices = [];

    const filterConfig = {
        filters: [
            {
                id: 'search',
                type: 'text',
                label: 'Search',
                placeholder: 'Device name, user, or serial...',
                fields: ['deviceName', 'userPrincipalName', 'serialNumber'],
                wide: true
            },
            {
                id: 'os',
                type: 'select',
                label: 'OS',
                field: 'os',
                options: [
                    { value: 'Windows', label: 'Windows' },
                    { value: 'iOS', label: 'iOS' },
                    { value: 'Android', label: 'Android' },
                    { value: 'macOS', label: 'macOS' }
                ]
            },
            {
                id: 'compliance',
                type: 'select',
                label: 'Compliance',
                field: 'complianceState',
                options: [
                    { value: 'compliant', label: 'Compliant' },
                    { value: 'noncompliant', label: 'Non-Compliant' },
                    { value: 'unknown', label: 'Unknown' }
                ]
            },
            {
                id: 'ownership',
                type: 'select',
                label: 'Ownership',
                field: 'ownership',
                options: [
                    { value: 'corporate', label: 'Corporate' },
                    { value: 'personal', label: 'Personal' }
                ]
            },
            {
                id: 'status',
                type: 'select',
                label: 'Status',
                field: 'statusCategory',
                options: [
                    { value: 'Active', label: 'Active' },
                    { value: 'Stale', label: 'Stale' }
                ]
            }
        ]
    };

    const tableConfig = {
        containerId: 'devices-table',
        defaultSort: 'deviceName',
        defaultSortDir: 'asc',
        expandable: true,
        columns: [
            { field: 'deviceName', label: 'Device Name', sortable: true },
            { field: 'userPrincipalName', label: 'User', sortable: true },
            {
                field: 'os',
                label: 'OS',
                sortable: true,
                formatter: (val) => `<span class="badge badge-info">${val || 'Unknown'}</span>`
            },
            { field: 'osVersion', label: 'Version', sortable: true },
            {
                field: 'complianceState',
                label: 'Compliance',
                sortable: true,
                formatter: (val) => {
                    const badges = {
                        compliant: 'badge-good',
                        noncompliant: 'badge-critical',
                        unknown: 'badge-neutral'
                    };
                    const labels = {
                        compliant: 'Compliant',
                        noncompliant: 'Non-Compliant',
                        unknown: 'Unknown'
                    };
                    return `<span class="badge ${badges[val] || 'badge-neutral'}">${labels[val] || val}</span>`;
                }
            },
            {
                field: 'lastSync',
                label: 'Last Sync',
                sortable: true,
                sortType: 'date',
                type: 'date'
            },
            {
                field: 'daysSinceSync',
                label: 'Days Since Sync',
                sortable: true,
                sortType: 'number'
            },
            {
                field: 'ownership',
                label: 'Ownership',
                sortable: true,
                formatter: (val) => {
                    const badges = {
                        corporate: 'badge-info',
                        personal: 'badge-neutral'
                    };
                    return `<span class="badge ${badges[val] || 'badge-neutral'}">${val || 'Unknown'}</span>`;
                }
            },
            {
                field: 'isEncrypted',
                label: 'Encrypted',
                sortable: true,
                formatter: (val) => val
                    ? '<span class="badge badge-good">Yes</span>'
                    : '<span class="badge badge-warning">No</span>'
            }
        ],
        renderDetail: renderDeviceDetail,
        rowHighlight: (row) => {
            if (row.complianceState === 'noncompliant') return 'row-highlight-critical';
            if (row.isStale) return 'row-highlight-warning';
            return '';
        }
    };

    function init() {
        allDevices = DataLoader.get('devices') || [];

        // Add status category
        allDevices.forEach(device => {
            device.statusCategory = device.isStale ? 'Stale' : 'Active';
        });
    }

    function render(container) {
        // Calculate summary metrics
        const metrics = calculateMetrics();

        container.innerHTML = `
            <!-- Summary Cards -->
            <div class="cards-grid mb-24">
                <div class="card">
                    <div class="card-label">Total Devices</div>
                    <div class="card-value">${App.formatNumber(metrics.total)}</div>
                </div>
                <div class="card card-good">
                    <div class="card-label">Compliant</div>
                    <div class="card-value">${App.formatNumber(metrics.compliant)}</div>
                </div>
                <div class="card ${metrics.nonCompliant > 0 ? 'card-critical' : ''}">
                    <div class="card-label">Non-Compliant</div>
                    <div class="card-value">${App.formatNumber(metrics.nonCompliant)}</div>
                </div>
                <div class="card ${metrics.stale > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Stale (90+ days)</div>
                    <div class="card-value">${App.formatNumber(metrics.stale)}</div>
                </div>
                <div class="card ${metrics.unencrypted > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Not Encrypted</div>
                    <div class="card-value">${App.formatNumber(metrics.unencrypted)}</div>
                </div>
            </div>

            <div id="devices-filter-bar"></div>
            <div id="devices-table"></div>
        `;

        // Initialize filters
        Filters.init(filterConfig, onFilterChange);
        Filters.render('devices-filter-bar');

        // Initialize table
        Tables.init(tableConfig);
        Tables.setData(allDevices);

        // Attach export handler
        document.getElementById('btn-export')?.addEventListener('click', () => {
            Export.exportCurrentTable('devices');
        });

        // Apply initial filters from URL
        onFilterChange(Filters.getCurrentFilters());
    }

    function calculateMetrics() {
        return {
            total: allDevices.length,
            compliant: allDevices.filter(d => d.complianceState === 'compliant').length,
            nonCompliant: allDevices.filter(d => d.complianceState === 'noncompliant').length,
            unknown: allDevices.filter(d => d.complianceState === 'unknown').length,
            stale: allDevices.filter(d => d.isStale).length,
            unencrypted: allDevices.filter(d => !d.isEncrypted).length
        };
    }

    function onFilterChange(filters) {
        let filtered = allDevices;

        // Apply text search
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(d =>
                (d.deviceName && d.deviceName.toLowerCase().includes(term)) ||
                (d.userPrincipalName && d.userPrincipalName.toLowerCase().includes(term)) ||
                (d.serialNumber && d.serialNumber.toLowerCase().includes(term))
            );
        }

        // Apply OS filter
        if (filters.os) {
            filtered = filtered.filter(d => d.os === filters.os);
        }

        // Apply compliance filter
        if (filters.compliance) {
            filtered = filtered.filter(d => d.complianceState === filters.compliance);
        }

        // Apply ownership filter
        if (filters.ownership) {
            filtered = filtered.filter(d => d.ownership === filters.ownership);
        }

        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(d => d.statusCategory === filters.status);
        }

        Tables.updateFilteredData(filtered);
    }

    function renderDeviceDetail(device) {
        return `
            <div class="detail-content">
                <div class="detail-group">
                    <span class="detail-label">Device ID</span>
                    <span class="detail-value font-mono">${device.id}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Serial Number</span>
                    <span class="detail-value font-mono">${device.serialNumber || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Manufacturer</span>
                    <span class="detail-value">${device.manufacturer || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Model</span>
                    <span class="detail-value">${device.model || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Enrolled Date</span>
                    <span class="detail-value">${App.formatDate(device.enrolledDateTime)}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Management Agent</span>
                    <span class="detail-value">${device.managementAgent || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">User Principal Name</span>
                    <span class="detail-value">${device.userPrincipalName || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Encryption Status</span>
                    <span class="detail-value">${device.isEncrypted ? 'Encrypted' : 'Not Encrypted'}</span>
                </div>
            </div>
        `;
    }

    function cleanup() {
        allDevices = [];
    }

    return {
        init,
        render,
        cleanup
    };
})();

/**
 * M365 Tenant Toolkit - Licenses Page
 * License SKU overview with utilization metrics
 */

const PageLicenses = (function() {
    let allSkus = [];
    let allUsers = [];

    const filterConfig = {
        filters: [
            {
                id: 'search',
                type: 'text',
                label: 'Search',
                placeholder: 'License name...',
                fields: ['skuName', 'skuPartNumber'],
                wide: true
            },
            {
                id: 'showWaste',
                type: 'checkbox',
                label: 'Show Only',
                checkboxLabel: 'With waste > 0',
                filterFn: (item) => item.wasteCount > 0
            }
        ]
    };

    const tableConfig = {
        containerId: 'licenses-table',
        defaultSort: 'skuName',
        defaultSortDir: 'asc',
        expandable: true,
        columns: [
            { field: 'skuName', label: 'License Name', sortable: true },
            {
                field: 'totalPurchased',
                label: 'Purchased',
                sortable: true,
                sortType: 'number',
                type: 'number'
            },
            {
                field: 'totalAssigned',
                label: 'Assigned',
                sortable: true,
                sortType: 'number',
                type: 'number'
            },
            {
                field: 'available',
                label: 'Available',
                sortable: true,
                sortType: 'number',
                type: 'number'
            },
            {
                field: 'assignedToDisabled',
                label: 'Waste (Disabled)',
                sortable: true,
                sortType: 'number',
                formatter: (val) => val > 0
                    ? `<span class="badge badge-warning">${val}</span>`
                    : '<span class="text-muted">0</span>'
            },
            {
                field: 'assignedToInactive',
                label: 'Waste (Inactive)',
                sortable: true,
                sortType: 'number',
                formatter: (val) => val > 0
                    ? `<span class="badge badge-warning">${val}</span>`
                    : '<span class="text-muted">0</span>'
            },
            {
                field: 'utilizationPercent',
                label: 'Utilization',
                sortable: true,
                sortType: 'number',
                formatter: (val) => {
                    const color = val >= 90 ? 'badge-good' : (val >= 70 ? 'badge-info' : 'badge-warning');
                    return `<span class="badge ${color}">${val}%</span>`;
                }
            }
        ],
        renderDetail: renderSkuDetail,
        rowHighlight: (row) => row.wasteCount > 10 ? 'row-highlight-warning' : ''
    };

    function init() {
        allSkus = DataLoader.get('licenseSkus') || [];
        allUsers = DataLoader.get('users') || [];
    }

    function render(container) {
        // Calculate summary metrics
        const metrics = calculateMetrics();

        container.innerHTML = `
            <!-- Summary Cards -->
            <div class="cards-grid mb-24">
                <div class="card">
                    <div class="card-label">Total SKUs</div>
                    <div class="card-value">${App.formatNumber(metrics.totalSkus)}</div>
                </div>
                <div class="card">
                    <div class="card-label">Total Purchased</div>
                    <div class="card-value">${App.formatNumber(metrics.totalPurchased)}</div>
                </div>
                <div class="card">
                    <div class="card-label">Total Assigned</div>
                    <div class="card-value">${App.formatNumber(metrics.totalAssigned)}</div>
                </div>
                <div class="card ${metrics.totalWaste > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Total Waste</div>
                    <div class="card-value">${App.formatNumber(metrics.totalWaste)}</div>
                    <div class="card-subvalue">Disabled + Inactive</div>
                </div>
            </div>

            <div id="licenses-filter-bar"></div>
            <div id="licenses-table"></div>
        `;

        // Initialize filters
        Filters.init(filterConfig, onFilterChange);
        Filters.render('licenses-filter-bar');

        // Initialize table
        Tables.init(tableConfig);
        Tables.setData(allSkus);

        // Attach export handler
        document.getElementById('btn-export')?.addEventListener('click', () => {
            Export.exportCurrentTable('licenses');
        });

        // Apply initial filters from URL
        onFilterChange(Filters.getCurrentFilters());
    }

    function calculateMetrics() {
        let totalPurchased = 0;
        let totalAssigned = 0;
        let totalWaste = 0;

        allSkus.forEach(sku => {
            totalPurchased += sku.totalPurchased || 0;
            totalAssigned += sku.totalAssigned || 0;
            totalWaste += sku.wasteCount || 0;
        });

        return {
            totalSkus: allSkus.length,
            totalPurchased,
            totalAssigned,
            totalWaste
        };
    }

    function onFilterChange(filters) {
        let filtered = allSkus;

        // Apply text search
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(s =>
                (s.skuName && s.skuName.toLowerCase().includes(term)) ||
                (s.skuPartNumber && s.skuPartNumber.toLowerCase().includes(term))
            );
        }

        // Apply waste filter
        if (filters.showWaste) {
            filtered = filtered.filter(s => s.wasteCount > 0);
        }

        Tables.updateFilteredData(filtered);
    }

    function renderSkuDetail(sku) {
        // Find users with this license
        const usersWithLicense = allUsers.filter(u => {
            // Simple check - in real implementation would check assignedLicenses array
            return u.licenseCount > 0;
        }).slice(0, 20); // Limit to first 20 for display

        const enabledActive = usersWithLicense.filter(u => u.accountEnabled && !u.isInactive).length;
        const enabledInactive = usersWithLicense.filter(u => u.accountEnabled && u.isInactive).length;
        const disabled = usersWithLicense.filter(u => !u.accountEnabled).length;

        return `
            <div class="detail-content">
                <div class="detail-group">
                    <span class="detail-label">SKU ID</span>
                    <span class="detail-value font-mono">${sku.skuId}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Part Number</span>
                    <span class="detail-value font-mono">${sku.skuPartNumber}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Assigned to Enabled (Active)</span>
                    <span class="detail-value">${sku.assignedToEnabled || 0}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Assigned to Enabled (Inactive)</span>
                    <span class="detail-value">${sku.assignedToInactive || 0}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Assigned to Disabled</span>
                    <span class="detail-value">${sku.assignedToDisabled || 0}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Available Licenses</span>
                    <span class="detail-value">${sku.available || 0}</span>
                </div>
            </div>
        `;
    }

    function cleanup() {
        allSkus = [];
        allUsers = [];
    }

    return {
        init,
        render,
        cleanup
    };
})();

/**
 * M365 Tenant Toolkit - Guests Page
 * Guest account management and cleanup
 */

const PageGuests = (function() {
    let allGuests = [];

    const filterConfig = {
        filters: [
            {
                id: 'search',
                type: 'text',
                label: 'Search',
                placeholder: 'Name, email, or domain...',
                fields: ['displayName', 'mail', 'sourceDomain'],
                wide: true
            },
            {
                id: 'status',
                type: 'select',
                label: 'Status',
                field: 'statusCategory',
                options: [
                    { value: 'Active', label: 'Active' },
                    { value: 'Stale', label: 'Stale' },
                    { value: 'NeverSignedIn', label: 'Never Signed In' },
                    { value: 'PendingInvitation', label: 'Pending Invitation' }
                ]
            },
            {
                id: 'sourceDomain',
                type: 'select',
                label: 'Source Domain',
                field: 'sourceDomain',
                options: [] // Populated dynamically
            }
        ]
    };

    const tableConfig = {
        containerId: 'guests-table',
        defaultSort: 'displayName',
        defaultSortDir: 'asc',
        expandable: true,
        columns: [
            { field: 'displayName', label: 'Display Name', sortable: true },
            { field: 'mail', label: 'Email', sortable: true },
            { field: 'sourceDomain', label: 'Source Domain', sortable: true },
            {
                field: 'createdDateTime',
                label: 'Invited',
                sortable: true,
                sortType: 'date',
                type: 'date'
            },
            {
                field: 'lastSignIn',
                label: 'Last Sign-In',
                sortable: true,
                sortType: 'date',
                type: 'date'
            },
            {
                field: 'daysSinceLastSignIn',
                label: 'Days Inactive',
                sortable: true,
                sortType: 'number',
                formatter: (val) => val === null ? '<span class="text-muted">Never</span>' : val
            },
            {
                field: 'statusCategory',
                label: 'Status',
                sortable: true,
                formatter: (val) => {
                    const badges = {
                        'Active': 'badge-good',
                        'Stale': 'badge-warning',
                        'NeverSignedIn': 'badge-critical',
                        'PendingInvitation': 'badge-neutral'
                    };
                    const labels = {
                        'Active': 'Active',
                        'Stale': 'Stale',
                        'NeverSignedIn': 'Never Signed In',
                        'PendingInvitation': 'Pending'
                    };
                    return `<span class="badge ${badges[val] || 'badge-neutral'}">${labels[val] || val}</span>`;
                }
            }
        ],
        renderDetail: renderGuestDetail,
        rowHighlight: (row) => {
            if (row.neverSignedIn) return 'row-highlight-critical';
            if (row.isStale) return 'row-highlight-warning';
            return '';
        }
    };

    function init() {
        allGuests = DataLoader.get('guests') || [];

        // Add status category to each guest
        allGuests.forEach(guest => {
            guest.statusCategory = getStatusCategory(guest);
        });
    }

    function getStatusCategory(guest) {
        if (guest.invitationState === 'PendingAcceptance') return 'PendingInvitation';
        if (guest.neverSignedIn) return 'NeverSignedIn';
        if (guest.isStale) return 'Stale';
        return 'Active';
    }

    function render(container) {
        // Calculate summary metrics
        const metrics = calculateMetrics();

        container.innerHTML = `
            <!-- Summary Cards -->
            <div class="cards-grid mb-24">
                <div class="card">
                    <div class="card-label">Total Guests</div>
                    <div class="card-value">${App.formatNumber(metrics.total)}</div>
                </div>
                <div class="card card-good">
                    <div class="card-label">Active</div>
                    <div class="card-value">${App.formatNumber(metrics.active)}</div>
                </div>
                <div class="card ${metrics.stale > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Stale (60+ days)</div>
                    <div class="card-value">${App.formatNumber(metrics.stale)}</div>
                </div>
                <div class="card ${metrics.neverSignedIn > 0 ? 'card-critical' : ''}">
                    <div class="card-label">Never Signed In</div>
                    <div class="card-value">${App.formatNumber(metrics.neverSignedIn)}</div>
                </div>
                <div class="card">
                    <div class="card-label">Pending Invitation</div>
                    <div class="card-value">${App.formatNumber(metrics.pending)}</div>
                </div>
            </div>

            <div id="guests-filter-bar"></div>
            <div id="guests-table"></div>
        `;

        // Initialize filters
        Filters.init(filterConfig, onFilterChange);
        Filters.render('guests-filter-bar');

        // Populate source domain dropdown
        const domains = [...new Set(allGuests.map(g => g.sourceDomain).filter(Boolean))].sort();
        Filters.populateSelectOptions('sourceDomain', domains);

        // Initialize table
        Tables.init(tableConfig);
        Tables.setData(allGuests);

        // Attach export handler
        document.getElementById('btn-export')?.addEventListener('click', () => {
            Export.exportCurrentTable('guests');
        });

        // Apply initial filters from URL
        onFilterChange(Filters.getCurrentFilters());
    }

    function calculateMetrics() {
        return {
            total: allGuests.length,
            active: allGuests.filter(g => g.statusCategory === 'Active').length,
            stale: allGuests.filter(g => g.isStale).length,
            neverSignedIn: allGuests.filter(g => g.neverSignedIn).length,
            pending: allGuests.filter(g => g.invitationState === 'PendingAcceptance').length
        };
    }

    function onFilterChange(filters) {
        let filtered = allGuests;

        // Apply text search
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(g =>
                (g.displayName && g.displayName.toLowerCase().includes(term)) ||
                (g.mail && g.mail.toLowerCase().includes(term)) ||
                (g.sourceDomain && g.sourceDomain.toLowerCase().includes(term))
            );
        }

        // Apply status filter
        if (filters.status) {
            filtered = filtered.filter(g => g.statusCategory === filters.status);
        }

        // Apply source domain filter
        if (filters.sourceDomain) {
            filtered = filtered.filter(g => g.sourceDomain === filters.sourceDomain);
        }

        Tables.updateFilteredData(filtered);
    }

    function renderGuestDetail(guest) {
        return `
            <div class="detail-content">
                <div class="detail-group">
                    <span class="detail-label">Guest ID</span>
                    <span class="detail-value font-mono">${guest.id}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${guest.mail || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Source Domain</span>
                    <span class="detail-value">${guest.sourceDomain || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Invitation State</span>
                    <span class="detail-value">${guest.invitationState || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Created Date</span>
                    <span class="detail-value">${App.formatDateTime(guest.createdDateTime)}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Last Sign-In</span>
                    <span class="detail-value">${App.formatDateTime(guest.lastSignIn)}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Days Since Last Sign-In</span>
                    <span class="detail-value">${guest.daysSinceLastSignIn !== null ? guest.daysSinceLastSignIn : 'Never'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Recommendation</span>
                    <span class="detail-value">${getRecommendation(guest)}</span>
                </div>
            </div>
        `;
    }

    function getRecommendation(guest) {
        if (guest.invitationState === 'PendingAcceptance') {
            const daysOld = App.daysSince(guest.createdDateTime);
            if (daysOld > 14) {
                return 'Consider resending invitation or removing guest';
            }
            return 'Invitation pending - wait for acceptance';
        }
        if (guest.neverSignedIn) {
            return 'Review and consider removing if not needed';
        }
        if (guest.isStale) {
            return 'Review guest access - no recent activity';
        }
        return 'Active guest - no action needed';
    }

    function cleanup() {
        allGuests = [];
    }

    return {
        init,
        render,
        cleanup
    };
})();

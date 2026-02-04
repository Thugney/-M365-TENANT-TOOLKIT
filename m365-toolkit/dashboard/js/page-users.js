/**
 * M365 Tenant Toolkit - Users Page
 * User listing with filters and details
 */

const PageUsers = (function() {
    let allUsers = [];

    const filterConfig = {
        filters: [
            {
                id: 'search',
                type: 'text',
                label: 'Search',
                placeholder: 'Name, UPN, or department...',
                fields: ['displayName', 'userPrincipalName', 'department'],
                wide: true
            },
            {
                id: 'domain',
                type: 'select',
                label: 'Domain',
                field: 'domain',
                options: [
                    { value: 'employee', label: 'Employees' },
                    { value: 'student', label: 'Students' },
                    { value: 'other', label: 'Other' }
                ]
            },
            {
                id: 'status',
                type: 'select',
                label: 'Status',
                field: 'accountEnabled',
                options: [
                    { value: 'true', label: 'Enabled' },
                    { value: 'false', label: 'Disabled' }
                ]
            },
            {
                id: 'flags',
                type: 'multiselect',
                label: 'Flags',
                field: 'flags',
                options: [
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'no-mfa', label: 'No MFA' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'disabled', label: 'Disabled' }
                ]
            },
            {
                id: 'department',
                type: 'select',
                label: 'Department',
                field: 'department',
                options: [] // Populated dynamically
            }
        ]
    };

    const tableConfig = {
        containerId: 'users-table',
        defaultSort: 'displayName',
        defaultSortDir: 'asc',
        expandable: true,
        columns: [
            { field: 'displayName', label: 'Display Name', sortable: true },
            { field: 'userPrincipalName', label: 'UPN', sortable: true },
            {
                field: 'domain',
                label: 'Domain',
                sortable: true,
                formatter: (val) => {
                    const badges = {
                        employee: 'badge-info',
                        student: 'badge-neutral',
                        other: 'badge-neutral'
                    };
                    return `<span class="badge ${badges[val] || 'badge-neutral'}">${val || 'N/A'}</span>`;
                }
            },
            {
                field: 'accountEnabled',
                label: 'Status',
                sortable: true,
                formatter: (val) => val
                    ? '<span class="badge badge-good">Enabled</span>'
                    : '<span class="badge badge-neutral">Disabled</span>'
            },
            { field: 'department', label: 'Department', sortable: true },
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
                formatter: (val) => val === null ? '<span class="text-muted">N/A</span>' : val
            },
            {
                field: 'mfaRegistered',
                label: 'MFA',
                sortable: true,
                formatter: (val) => val
                    ? '<span class="badge badge-good">Yes</span>'
                    : '<span class="badge badge-critical">No</span>'
            },
            {
                field: 'licenseCount',
                label: 'Licenses',
                sortable: true,
                sortType: 'number'
            },
            {
                field: 'flags',
                label: 'Flags',
                sortable: false,
                type: 'flags'
            }
        ],
        renderDetail: renderUserDetail,
        rowHighlight: (row) => {
            if (row.isAdmin && row.isInactive) return 'row-highlight-critical';
            if (!row.mfaRegistered && row.accountEnabled) return 'row-highlight-warning';
            return '';
        }
    };

    function init() {
        allUsers = DataLoader.get('users') || [];

        // Build flags for each user
        allUsers.forEach(user => {
            user.flags = [];
            if (user.isInactive) user.flags.push('inactive');
            if (!user.mfaRegistered) user.flags.push('no-mfa');
            if (user.isAdmin) user.flags.push('admin');
            if (!user.accountEnabled) user.flags.push('disabled');
        });
    }

    function render(container) {
        container.innerHTML = `
            <div id="users-filter-bar"></div>
            <div id="users-table"></div>
        `;

        // Initialize filters
        Filters.init(filterConfig, onFilterChange);
        Filters.render('users-filter-bar');

        // Populate department dropdown
        const departments = [...new Set(allUsers.map(u => u.department).filter(Boolean))].sort();
        Filters.populateSelectOptions('department', departments);

        // Initialize table
        Tables.init(tableConfig);
        Tables.setData(allUsers);

        // Attach export handler
        document.getElementById('btn-export')?.addEventListener('click', () => {
            Export.exportCurrentTable('users');
        });

        // Apply initial filters from URL
        onFilterChange(Filters.getCurrentFilters());
    }

    function onFilterChange(filters) {
        // Convert status filter value to boolean
        if (filters.status !== undefined) {
            filters.status = filters.status === 'true';
        }

        let filtered = allUsers;

        // Apply text search
        if (filters.search) {
            const term = filters.search.toLowerCase();
            filtered = filtered.filter(u =>
                (u.displayName && u.displayName.toLowerCase().includes(term)) ||
                (u.userPrincipalName && u.userPrincipalName.toLowerCase().includes(term)) ||
                (u.department && u.department.toLowerCase().includes(term))
            );
        }

        // Apply domain filter
        if (filters.domain) {
            filtered = filtered.filter(u => u.domain === filters.domain);
        }

        // Apply status filter
        if (filters.status !== undefined && filters.status !== '') {
            filtered = filtered.filter(u => u.accountEnabled === filters.status);
        }

        // Apply flags filter
        if (filters.flags && filters.flags.length > 0) {
            filtered = filtered.filter(u =>
                filters.flags.some(flag => u.flags && u.flags.includes(flag))
            );
        }

        // Apply department filter
        if (filters.department) {
            filtered = filtered.filter(u => u.department === filters.department);
        }

        Tables.updateFilteredData(filtered);
    }

    function renderUserDetail(user) {
        const adminRoles = user.adminRoles || [];
        const mfaMethods = user.mfaMethods || [];

        return `
            <div class="detail-content">
                <div class="detail-group">
                    <span class="detail-label">User ID</span>
                    <span class="detail-value font-mono">${user.id}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${user.mail || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Job Title</span>
                    <span class="detail-value">${user.jobTitle || 'N/A'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Account Created</span>
                    <span class="detail-value">${App.formatDate(user.createdDateTime)}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">On-Prem Sync</span>
                    <span class="detail-value">${user.onPremSync ? 'Yes' : 'No (Cloud-only)'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Last Non-Interactive Sign-In</span>
                    <span class="detail-value">${App.formatDate(user.lastNonInteractiveSignIn)}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">MFA Methods</span>
                    <span class="detail-value">${mfaMethods.length > 0 ? mfaMethods.join(', ') : 'None'}</span>
                </div>
                <div class="detail-group">
                    <span class="detail-label">Admin Roles</span>
                    <span class="detail-value">${adminRoles.length > 0 ? adminRoles.map(r => r.roleName).join(', ') : 'None'}</span>
                </div>
            </div>
        `;
    }

    function cleanup() {
        allUsers = [];
    }

    return {
        init,
        render,
        cleanup
    };
})();

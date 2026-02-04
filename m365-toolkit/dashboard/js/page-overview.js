/**
 * M365 Tenant Toolkit - Overview Page
 * Summary dashboard with key metrics
 */

const PageOverview = (function() {
    function init() {
        // No initialization needed
    }

    function render(container) {
        const users = DataLoader.get('users') || [];
        const guests = DataLoader.get('guests') || [];
        const licenseSkus = DataLoader.get('licenseSkus') || [];
        const adminRoles = DataLoader.get('adminRoles') || [];
        const riskySignins = DataLoader.get('riskySignins') || [];
        const devices = DataLoader.get('devices') || [];
        const defenderAlerts = DataLoader.get('defenderAlerts') || [];

        // Calculate metrics
        const metrics = calculateMetrics(users, guests, licenseSkus, adminRoles, riskySignins, devices, defenderAlerts);

        container.innerHTML = `
            <!-- Row 1: User Counts -->
            <div class="section-header">
                <h3 class="section-title">User Overview</h3>
            </div>
            <div class="cards-grid">
                ${renderCard('Total Users', metrics.totalUsers, `${metrics.employees} employees, ${metrics.students} students`, 'users')}
                ${renderCard('Enabled', metrics.enabledUsers, `${metrics.disabledUsers} disabled`, 'users', { status: 'enabled' }, 'good')}
                ${renderCard('Inactive (90+ days)', metrics.inactiveUsers, 'No sign-in activity', 'users', { flags: 'inactive' }, metrics.inactiveUsers > 0 ? 'warning' : 'good')}
                ${renderCard('No MFA Registered', metrics.noMfaUsers, 'Security risk', 'users', { flags: 'no-mfa' }, metrics.noMfaUsers > 0 ? 'critical' : 'good')}
            </div>

            <!-- Row 2: Risk Indicators -->
            <div class="section-header">
                <h3 class="section-title">Risk Indicators</h3>
            </div>
            <div class="cards-grid">
                ${renderCard('Risky Sign-ins', metrics.totalRiskySignins, `${metrics.highRiskSignins} high, ${metrics.mediumRiskSignins} medium`, 'security', null, metrics.highRiskSignins > 0 ? 'critical' : (metrics.mediumRiskSignins > 0 ? 'warning' : 'good'))}
                ${renderCard('Stale Guests', metrics.staleGuests, `${metrics.totalGuests} total guests`, 'guests', { status: 'Stale' }, metrics.staleGuests > 0 ? 'warning' : 'good')}
                ${renderCard('Admin Accounts', metrics.totalAdmins, `${metrics.globalAdmins} Global Admins`, 'security')}
                ${renderCard('Inactive Admins', metrics.inactiveAdmins, 'Critical security risk', 'security', null, metrics.inactiveAdmins > 0 ? 'critical' : 'good')}
            </div>

            <!-- Row 3: Licenses & Devices -->
            <div class="section-header">
                <h3 class="section-title">Licenses & Devices</h3>
            </div>
            <div class="cards-grid">
                ${renderCard('License Waste', metrics.licenseWaste, `Assigned to disabled/inactive`, 'licenses', { showWaste: 'true' }, metrics.licenseWaste > 0 ? 'warning' : 'good')}
                ${renderCard('Non-Compliant Devices', metrics.nonCompliantDevices, `${metrics.totalDevices} managed devices`, 'devices', { compliance: 'noncompliant' }, metrics.nonCompliantDevices > 0 ? 'warning' : 'good')}
                ${renderCard('Stale Devices', metrics.staleDevices, 'No sync in 90+ days', 'devices', { status: 'Stale' }, metrics.staleDevices > 0 ? 'warning' : 'good')}
                ${renderCard('Defender Alerts', metrics.activeAlerts, `${metrics.highSeverityAlerts} high severity`, 'security', null, metrics.highSeverityAlerts > 0 ? 'critical' : (metrics.activeAlerts > 0 ? 'warning' : 'good'))}
            </div>

            <!-- Quick Stats -->
            <div class="section-header">
                <h3 class="section-title">Quick Stats</h3>
            </div>
            <div class="cards-grid">
                ${renderStatCard('Total License SKUs', metrics.totalSkus)}
                ${renderStatCard('Licenses Purchased', metrics.totalLicensesPurchased)}
                ${renderStatCard('Licenses Assigned', metrics.totalLicensesAssigned)}
                ${renderStatCard('Guests Never Signed In', metrics.guestsNeverSignedIn)}
            </div>
        `;

        // Attach click handlers for cards
        attachCardClickHandlers();
    }

    function calculateMetrics(users, guests, licenseSkus, adminRoles, riskySignins, devices, defenderAlerts) {
        // User metrics
        const employees = users.filter(u => u.domain === 'employee').length;
        const students = users.filter(u => u.domain === 'student').length;
        const enabledUsers = users.filter(u => u.accountEnabled).length;
        const disabledUsers = users.filter(u => !u.accountEnabled).length;
        const inactiveUsers = users.filter(u => u.isInactive).length;
        const noMfaUsers = users.filter(u => !u.mfaRegistered && u.accountEnabled).length;

        // Risk metrics
        const highRiskSignins = riskySignins.filter(r => r.riskLevel === 'high').length;
        const mediumRiskSignins = riskySignins.filter(r => r.riskLevel === 'medium').length;
        const lowRiskSignins = riskySignins.filter(r => r.riskLevel === 'low').length;

        // Guest metrics
        const staleGuests = guests.filter(g => g.isStale).length;
        const guestsNeverSignedIn = guests.filter(g => g.neverSignedIn).length;

        // Admin metrics
        let totalAdmins = 0;
        let globalAdmins = 0;
        let inactiveAdmins = 0;
        const adminUserIds = new Set();

        adminRoles.forEach(role => {
            role.members.forEach(member => {
                adminUserIds.add(member.userId);
                if (member.isInactive) inactiveAdmins++;
            });
            if (role.roleName === 'Global Administrator') {
                globalAdmins = role.memberCount;
            }
        });
        totalAdmins = adminUserIds.size;

        // License metrics
        let totalLicensesPurchased = 0;
        let totalLicensesAssigned = 0;
        let licenseWaste = 0;

        licenseSkus.forEach(sku => {
            totalLicensesPurchased += sku.totalPurchased || 0;
            totalLicensesAssigned += sku.totalAssigned || 0;
            licenseWaste += sku.wasteCount || 0;
        });

        // Device metrics
        const nonCompliantDevices = devices.filter(d => d.complianceState === 'noncompliant').length;
        const staleDevices = devices.filter(d => d.isStale).length;

        // Defender metrics
        const activeAlerts = defenderAlerts.filter(a => a.status !== 'resolved').length;
        const highSeverityAlerts = defenderAlerts.filter(a => a.severity === 'high' && a.status !== 'resolved').length;

        return {
            totalUsers: users.length,
            employees,
            students,
            enabledUsers,
            disabledUsers,
            inactiveUsers,
            noMfaUsers,
            totalRiskySignins: riskySignins.length,
            highRiskSignins,
            mediumRiskSignins,
            lowRiskSignins,
            totalGuests: guests.length,
            staleGuests,
            guestsNeverSignedIn,
            totalAdmins,
            globalAdmins,
            inactiveAdmins,
            totalSkus: licenseSkus.length,
            totalLicensesPurchased,
            totalLicensesAssigned,
            licenseWaste,
            totalDevices: devices.length,
            nonCompliantDevices,
            staleDevices,
            activeAlerts,
            highSeverityAlerts
        };
    }

    function renderCard(label, value, subvalue, page, filters = null, colorClass = null) {
        const cardClass = colorClass ? `card card-clickable card-${colorClass}` : 'card card-clickable';
        const dataFilters = filters ? `data-filters='${JSON.stringify(filters)}'` : '';

        return `
            <div class="${cardClass}" data-page="${page}" ${dataFilters}>
                <div class="card-label">${label}</div>
                <div class="card-value">${App.formatNumber(value)}</div>
                <div class="card-subvalue">${subvalue}</div>
            </div>
        `;
    }

    function renderStatCard(label, value) {
        return `
            <div class="card">
                <div class="card-label">${label}</div>
                <div class="card-value card-value-small">${App.formatNumber(value)}</div>
            </div>
        `;
    }

    function attachCardClickHandlers() {
        document.querySelectorAll('.card-clickable').forEach(card => {
            card.addEventListener('click', () => {
                const page = card.dataset.page;
                let filters = {};

                if (card.dataset.filters) {
                    try {
                        filters = JSON.parse(card.dataset.filters);
                    } catch (e) {
                        console.error('Error parsing filters:', e);
                    }
                }

                App.navigateTo(page, filters);
            });
        });
    }

    function cleanup() {
        // No cleanup needed
    }

    return {
        init,
        render,
        cleanup
    };
})();

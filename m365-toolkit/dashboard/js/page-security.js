/**
 * M365 Tenant Toolkit - Security Page
 * Security posture overview with multiple sections
 */

const PageSecurity = (function() {
    let riskySignins = [];
    let adminRoles = [];
    let users = [];
    let defenderAlerts = [];

    function init() {
        riskySignins = DataLoader.get('riskySignins') || [];
        adminRoles = DataLoader.get('adminRoles') || [];
        users = DataLoader.get('users') || [];
        defenderAlerts = DataLoader.get('defenderAlerts') || [];
    }

    function render(container) {
        container.innerHTML = `
            <!-- Risky Sign-ins Section -->
            <div class="section-header">
                <h3 class="section-title">Risky Sign-ins</h3>
                <span class="text-muted text-small">Identity Protection detections</span>
            </div>
            ${renderRiskySigninsSection()}

            <!-- Admin Roles Section -->
            <div class="section-header">
                <h3 class="section-title">Admin Roles</h3>
                <span class="text-muted text-small">Directory role assignments</span>
            </div>
            ${renderAdminRolesSection()}

            <!-- MFA Gaps Section -->
            <div class="section-header">
                <h3 class="section-title">MFA Gaps</h3>
                <span class="text-muted text-small">Users without MFA registered</span>
            </div>
            ${renderMfaGapsSection()}

            <!-- Defender Alerts Section -->
            <div class="section-header">
                <h3 class="section-title">Defender Alerts</h3>
                <span class="text-muted text-small">Security alerts from Microsoft Defender</span>
            </div>
            ${renderDefenderAlertsSection()}
        `;
    }

    function renderRiskySigninsSection() {
        if (riskySignins.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No risky sign-ins detected</div>
                        <div class="empty-state-message">Requires Entra ID P2 license for risk detection.</div>
                    </div>
                </div>
            `;
        }

        // Sort by severity (high first) then date (newest first)
        const sorted = [...riskySignins].sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            const aSev = severityOrder[a.riskLevel] ?? 3;
            const bSev = severityOrder[b.riskLevel] ?? 3;
            if (aSev !== bSev) return aSev - bSev;
            return new Date(b.detectedDateTime) - new Date(a.detectedDateTime);
        });

        // Summary cards
        const highCount = riskySignins.filter(r => r.riskLevel === 'high').length;
        const mediumCount = riskySignins.filter(r => r.riskLevel === 'medium').length;
        const lowCount = riskySignins.filter(r => r.riskLevel === 'low').length;

        let html = `
            <div class="cards-grid mb-16">
                <div class="card ${highCount > 0 ? 'card-critical' : ''}">
                    <div class="card-label">High Risk</div>
                    <div class="card-value">${highCount}</div>
                </div>
                <div class="card ${mediumCount > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Medium Risk</div>
                    <div class="card-value">${mediumCount}</div>
                </div>
                <div class="card">
                    <div class="card-label">Low Risk</div>
                    <div class="card-value">${lowCount}</div>
                </div>
            </div>
        `;

        html += '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>User</th>
                    <th>Risk Level</th>
                    <th>Risk Type</th>
                    <th>Date</th>
                    <th>Location</th>
                    <th>IP</th>
                    <th>App</th>
                    <th>State</th>
                </tr>
            </thead>
            <tbody>
        `;

        sorted.slice(0, 50).forEach(risk => {
            const severityBadge = {
                high: 'badge-critical',
                medium: 'badge-warning',
                low: 'badge-neutral'
            };
            const stateBadge = {
                atRisk: 'badge-critical',
                confirmedCompromised: 'badge-critical',
                remediated: 'badge-good',
                dismissed: 'badge-neutral'
            };
            const location = risk.location
                ? [risk.location.city, risk.location.countryOrRegion].filter(Boolean).join(', ')
                : 'Unknown';

            html += `
                <tr class="${risk.riskLevel === 'high' ? 'row-highlight-critical' : ''}">
                    <td>${escapeHtml(risk.userPrincipalName)}</td>
                    <td><span class="badge ${severityBadge[risk.riskLevel] || 'badge-neutral'}">${risk.riskLevel}</span></td>
                    <td>${escapeHtml(risk.riskDetail || 'N/A')}</td>
                    <td>${App.formatDate(risk.detectedDateTime)}</td>
                    <td>${escapeHtml(location)}</td>
                    <td class="font-mono">${escapeHtml(risk.ipAddress || 'N/A')}</td>
                    <td>${escapeHtml(risk.appDisplayName || 'N/A')}</td>
                    <td><span class="badge ${stateBadge[risk.riskState] || 'badge-neutral'}">${risk.riskState}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderAdminRolesSection() {
        if (adminRoles.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No admin roles data</div>
                        <div class="empty-state-message">Admin role data has not been collected.</div>
                    </div>
                </div>
            `;
        }

        // Sort by high privilege first, then by member count
        const sorted = [...adminRoles].sort((a, b) => {
            if (a.isHighPrivilege !== b.isHighPrivilege) {
                return a.isHighPrivilege ? -1 : 1;
            }
            return b.memberCount - a.memberCount;
        });

        let html = '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>Role Name</th>
                    <th>Privilege</th>
                    <th>Members</th>
                    <th>Inactive Members</th>
                    <th>Members Without MFA</th>
                </tr>
            </thead>
            <tbody>
        `;

        sorted.forEach(role => {
            const inactiveMembers = role.members.filter(m => m.isInactive).length;
            const noMfaMembers = role.members.filter(m => {
                const user = users.find(u => u.id === m.userId);
                return user && !user.mfaRegistered;
            }).length;

            const hasIssues = inactiveMembers > 0 || noMfaMembers > 0;
            const rowClass = hasIssues ? (role.isHighPrivilege ? 'row-highlight-critical' : 'row-highlight-warning') : '';

            html += `
                <tr class="${rowClass}">
                    <td>${escapeHtml(role.roleName)}</td>
                    <td>${role.isHighPrivilege
                        ? '<span class="badge badge-critical">High</span>'
                        : '<span class="badge badge-neutral">Standard</span>'}</td>
                    <td>${role.memberCount}</td>
                    <td>${inactiveMembers > 0
                        ? `<span class="badge badge-warning">${inactiveMembers}</span>`
                        : '<span class="text-muted">0</span>'}</td>
                    <td>${noMfaMembers > 0
                        ? `<span class="badge badge-critical">${noMfaMembers}</span>`
                        : '<span class="text-muted">0</span>'}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderMfaGapsSection() {
        // Get users without MFA who are enabled
        const noMfaUsers = users.filter(u => !u.mfaRegistered && u.accountEnabled);

        if (noMfaUsers.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">All users have MFA registered</div>
                        <div class="empty-state-message">Great security posture!</div>
                    </div>
                </div>
            `;
        }

        // Sort by risk: admins first, then active users, then inactive
        const sorted = [...noMfaUsers].sort((a, b) => {
            if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
            if (a.isInactive !== b.isInactive) return a.isInactive ? 1 : -1;
            return a.displayName.localeCompare(b.displayName);
        });

        // Summary
        const adminsNoMfa = noMfaUsers.filter(u => u.isAdmin).length;
        const employeesNoMfa = noMfaUsers.filter(u => u.domain === 'employee').length;
        const studentsNoMfa = noMfaUsers.filter(u => u.domain === 'student').length;

        let html = `
            <div class="cards-grid mb-16">
                <div class="card ${adminsNoMfa > 0 ? 'card-critical' : ''}">
                    <div class="card-label">Admins Without MFA</div>
                    <div class="card-value">${adminsNoMfa}</div>
                </div>
                <div class="card ${employeesNoMfa > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Employees Without MFA</div>
                    <div class="card-value">${employeesNoMfa}</div>
                </div>
                <div class="card">
                    <div class="card-label">Students Without MFA</div>
                    <div class="card-value">${studentsNoMfa}</div>
                </div>
            </div>
        `;

        html += '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>User</th>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Admin</th>
                    <th>Created</th>
                    <th>Last Sign-In</th>
                </tr>
            </thead>
            <tbody>
        `;

        sorted.slice(0, 100).forEach(user => {
            const rowClass = user.isAdmin ? 'row-highlight-critical' : '';
            html += `
                <tr class="${rowClass}">
                    <td>${escapeHtml(user.displayName)}<br><span class="text-muted text-small">${escapeHtml(user.userPrincipalName)}</span></td>
                    <td><span class="badge badge-info">${user.domain}</span></td>
                    <td>${user.isInactive
                        ? '<span class="badge badge-warning">Inactive</span>'
                        : '<span class="badge badge-good">Active</span>'}</td>
                    <td>${user.isAdmin
                        ? '<span class="badge badge-critical">Yes</span>'
                        : '<span class="text-muted">No</span>'}</td>
                    <td>${App.formatDate(user.createdDateTime)}</td>
                    <td>${App.formatDate(user.lastSignIn)}</td>
                </tr>
            `;
        });

        if (sorted.length > 100) {
            html += `<tr><td colspan="6" class="text-center text-muted">Showing 100 of ${sorted.length} users</td></tr>`;
        }

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderDefenderAlertsSection() {
        if (defenderAlerts.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No Defender alerts</div>
                        <div class="empty-state-message">No security alerts in the collection period.</div>
                    </div>
                </div>
            `;
        }

        // Sort by severity then date
        const sorted = [...defenderAlerts].sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2, informational: 3 };
            const aSev = severityOrder[a.severity] ?? 4;
            const bSev = severityOrder[b.severity] ?? 4;
            if (aSev !== bSev) return aSev - bSev;
            return new Date(b.createdDateTime) - new Date(a.createdDateTime);
        });

        // Summary
        const highCount = defenderAlerts.filter(a => a.severity === 'high' && a.status !== 'resolved').length;
        const mediumCount = defenderAlerts.filter(a => a.severity === 'medium' && a.status !== 'resolved').length;
        const resolvedCount = defenderAlerts.filter(a => a.status === 'resolved').length;

        let html = `
            <div class="cards-grid mb-16">
                <div class="card ${highCount > 0 ? 'card-critical' : ''}">
                    <div class="card-label">High Severity</div>
                    <div class="card-value">${highCount}</div>
                </div>
                <div class="card ${mediumCount > 0 ? 'card-warning' : ''}">
                    <div class="card-label">Medium Severity</div>
                    <div class="card-value">${mediumCount}</div>
                </div>
                <div class="card card-good">
                    <div class="card-label">Resolved</div>
                    <div class="card-value">${resolvedCount}</div>
                </div>
            </div>
        `;

        html += '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Category</th>
                    <th>Date</th>
                    <th>Affected Entity</th>
                </tr>
            </thead>
            <tbody>
        `;

        sorted.slice(0, 50).forEach(alert => {
            const severityBadge = {
                high: 'badge-critical',
                medium: 'badge-warning',
                low: 'badge-neutral',
                informational: 'badge-info'
            };
            const statusBadge = {
                new: 'badge-critical',
                inProgress: 'badge-warning',
                resolved: 'badge-good'
            };
            const affectedEntity = alert.affectedUser || alert.affectedDevice || 'N/A';

            html += `
                <tr class="${alert.severity === 'high' && alert.status !== 'resolved' ? 'row-highlight-critical' : ''}">
                    <td>${escapeHtml(alert.title)}</td>
                    <td><span class="badge ${severityBadge[alert.severity] || 'badge-neutral'}">${alert.severity}</span></td>
                    <td><span class="badge ${statusBadge[alert.status] || 'badge-neutral'}">${alert.status}</span></td>
                    <td>${escapeHtml(alert.category || 'N/A')}</td>
                    <td>${App.formatDate(alert.createdDateTime)}</td>
                    <td>${escapeHtml(affectedEntity)}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function cleanup() {
        riskySignins = [];
        adminRoles = [];
        users = [];
        defenderAlerts = [];
    }

    return {
        init,
        render,
        cleanup
    };
})();

/**
 * M365 Tenant Toolkit - Lifecycle Management Page
 * Identifies accounts needing attention for onboarding/offboarding
 */

const PageLifecycle = (function() {
    let users = [];
    let guests = [];
    let adminRoles = [];

    function init() {
        users = DataLoader.get('users') || [];
        guests = DataLoader.get('guests') || [];
        adminRoles = DataLoader.get('adminRoles') || [];
    }

    function render(container) {
        const offboardingIssues = getOffboardingIssues();
        const onboardingGaps = getOnboardingGaps();
        const roleHygieneIssues = getRoleHygieneIssues();
        const guestCleanup = getGuestCleanup();

        container.innerHTML = `
            <!-- Offboarding Issues Section -->
            <div class="lifecycle-section">
                <div class="section-header">
                    <h3 class="section-title">Offboarding Issues</h3>
                </div>
                <p class="section-subtitle mb-16">These accounts may not have been properly offboarded</p>
                ${renderIssuesTable(offboardingIssues, 'offboarding')}
            </div>

            <!-- Onboarding Gaps Section -->
            <div class="lifecycle-section">
                <div class="section-header">
                    <h3 class="section-title">Onboarding Gaps</h3>
                </div>
                <p class="section-subtitle mb-16">Recently created accounts that may need attention</p>
                ${renderOnboardingTable(onboardingGaps)}
            </div>

            <!-- Role Hygiene Section -->
            <div class="lifecycle-section">
                <div class="section-header">
                    <h3 class="section-title">Role Hygiene</h3>
                </div>
                <p class="section-subtitle mb-16">Admin role assignments that need review</p>
                ${renderRoleHygieneTable(roleHygieneIssues)}
            </div>

            <!-- Guest Cleanup Section -->
            <div class="lifecycle-section">
                <div class="section-header">
                    <h3 class="section-title">Guest Cleanup</h3>
                </div>
                <p class="section-subtitle mb-16">Guest accounts that should be reviewed or removed</p>
                ${renderGuestCleanupTable(guestCleanup)}
            </div>
        `;
    }

    function getOffboardingIssues() {
        const issues = [];

        // Disabled accounts with licenses
        users.filter(u => !u.accountEnabled && u.licenseCount > 0).forEach(user => {
            issues.push({
                user: user,
                issueType: 'Disabled with licenses',
                details: `${user.licenseCount} license(s) assigned`,
                severity: 'warning'
            });
        });

        // Disabled accounts with admin roles
        const adminUserIds = new Set();
        adminRoles.forEach(role => {
            role.members.forEach(m => adminUserIds.add(m.userId));
        });

        users.filter(u => !u.accountEnabled && adminUserIds.has(u.id)).forEach(user => {
            issues.push({
                user: user,
                issueType: 'Disabled with admin role',
                details: 'Has admin role assigned',
                severity: 'critical'
            });
        });

        // Inactive accounts still enabled (90+ days)
        users.filter(u => u.accountEnabled && u.isInactive).forEach(user => {
            issues.push({
                user: user,
                issueType: 'Inactive but enabled',
                details: `${user.daysSinceLastSignIn} days since last sign-in`,
                severity: 'warning'
            });
        });

        return issues.sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    function getOnboardingGaps() {
        const issues = [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        users.forEach(user => {
            const createdDate = new Date(user.createdDateTime);
            if (createdDate < thirtyDaysAgo) return; // Only recent accounts

            const daysSinceCreation = App.daysSince(user.createdDateTime);

            // Never signed in
            if (!user.lastSignIn) {
                issues.push({
                    user: user,
                    issueType: 'Never signed in',
                    daysSinceCreation: daysSinceCreation,
                    hasSignedIn: false,
                    mfaStatus: user.mfaRegistered ? 'Registered' : 'Not registered',
                    severity: 'warning'
                });
            }

            // No MFA registered
            if (!user.mfaRegistered && user.accountEnabled) {
                issues.push({
                    user: user,
                    issueType: 'No MFA registered',
                    daysSinceCreation: daysSinceCreation,
                    hasSignedIn: !!user.lastSignIn,
                    mfaStatus: 'Not registered',
                    severity: 'critical'
                });
            }

            // No licenses assigned
            if (user.licenseCount === 0 && user.accountEnabled) {
                issues.push({
                    user: user,
                    issueType: 'No licenses',
                    daysSinceCreation: daysSinceCreation,
                    hasSignedIn: !!user.lastSignIn,
                    mfaStatus: user.mfaRegistered ? 'Registered' : 'Not registered',
                    severity: 'info'
                });
            }
        });

        // Deduplicate by user (keep most severe issue)
        const userIssues = new Map();
        const severityOrder = { critical: 0, warning: 1, info: 2 };

        issues.forEach(issue => {
            const existing = userIssues.get(issue.user.id);
            if (!existing || severityOrder[issue.severity] < severityOrder[existing.severity]) {
                userIssues.set(issue.user.id, issue);
            }
        });

        return Array.from(userIssues.values()).sort((a, b) => {
            const severityOrder = { critical: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    function getRoleHygieneIssues() {
        const issues = [];

        adminRoles.forEach(role => {
            role.members.forEach(member => {
                const user = users.find(u => u.id === member.userId);
                if (!user) return;

                // Inactive admin
                if (member.isInactive || user.isInactive) {
                    issues.push({
                        user: user,
                        role: role.roleName,
                        isHighPrivilege: role.isHighPrivilege,
                        mfaStatus: user.mfaRegistered ? 'Registered' : 'Not registered',
                        riskLevel: role.isHighPrivilege ? 'Critical' : 'High',
                        issueType: 'Inactive admin'
                    });
                }

                // Admin without MFA
                if (!user.mfaRegistered) {
                    issues.push({
                        user: user,
                        role: role.roleName,
                        isHighPrivilege: role.isHighPrivilege,
                        mfaStatus: 'Not registered',
                        riskLevel: 'Critical',
                        issueType: 'Admin without MFA'
                    });
                }
            });
        });

        // Deduplicate and sort by risk
        const userIssues = new Map();
        const riskOrder = { Critical: 0, High: 1 };

        issues.forEach(issue => {
            const key = `${issue.user.id}-${issue.issueType}`;
            const existing = userIssues.get(key);
            if (!existing || riskOrder[issue.riskLevel] < riskOrder[existing.riskLevel]) {
                userIssues.set(key, issue);
            }
        });

        return Array.from(userIssues.values()).sort((a, b) => {
            const riskOrder = { Critical: 0, High: 1 };
            return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        });
    }

    function getGuestCleanup() {
        const issues = [];
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        guests.forEach(guest => {
            // Never accepted invitation (> 14 days old)
            if (guest.invitationState === 'PendingAcceptance') {
                const createdDate = new Date(guest.createdDateTime);
                if (createdDate < fourteenDaysAgo) {
                    issues.push({
                        guest: guest,
                        status: 'Pending > 14 days',
                        recommendation: 'Resend invitation or remove'
                    });
                }
            }

            // No sign-in in 60+ days
            if (guest.isStale) {
                issues.push({
                    guest: guest,
                    status: 'Stale (60+ days)',
                    recommendation: 'Review and consider removal'
                });
            }

            // Never signed in (accepted but never used)
            if (guest.neverSignedIn && guest.invitationState === 'Accepted') {
                issues.push({
                    guest: guest,
                    status: 'Never signed in',
                    recommendation: 'Verify if still needed'
                });
            }
        });

        return issues;
    }

    function renderIssuesTable(issues, type) {
        if (issues.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No issues found</div>
                        <div class="empty-state-message">All accounts appear to be properly managed.</div>
                    </div>
                </div>
            `;
        }

        let html = '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>User</th>
                    <th>Issue Type</th>
                    <th>Details</th>
                    <th>Last Sign-In</th>
                    <th>Days Inactive</th>
                </tr>
            </thead>
            <tbody>
        `;

        issues.slice(0, 100).forEach(issue => {
            const rowClass = issue.severity === 'critical' ? 'row-highlight-critical' : 'row-highlight-warning';
            html += `
                <tr class="${rowClass}">
                    <td>
                        ${escapeHtml(issue.user.displayName)}<br>
                        <span class="text-muted text-small">${escapeHtml(issue.user.userPrincipalName)}</span>
                    </td>
                    <td><span class="badge ${issue.severity === 'critical' ? 'badge-critical' : 'badge-warning'}">${escapeHtml(issue.issueType)}</span></td>
                    <td>${escapeHtml(issue.details)}</td>
                    <td>${App.formatDate(issue.user.lastSignIn)}</td>
                    <td>${issue.user.daysSinceLastSignIn !== null ? issue.user.daysSinceLastSignIn : 'Never'}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderOnboardingTable(issues) {
        if (issues.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No onboarding gaps</div>
                        <div class="empty-state-message">All recent accounts appear to be properly set up.</div>
                    </div>
                </div>
            `;
        }

        let html = '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>User</th>
                    <th>Issue Type</th>
                    <th>Created</th>
                    <th>Days Since Creation</th>
                    <th>Has Signed In</th>
                    <th>MFA Status</th>
                </tr>
            </thead>
            <tbody>
        `;

        issues.slice(0, 100).forEach(issue => {
            const severityClass = {
                critical: 'row-highlight-critical',
                warning: 'row-highlight-warning',
                info: ''
            };
            const badgeClass = {
                critical: 'badge-critical',
                warning: 'badge-warning',
                info: 'badge-info'
            };

            html += `
                <tr class="${severityClass[issue.severity]}">
                    <td>
                        ${escapeHtml(issue.user.displayName)}<br>
                        <span class="text-muted text-small">${escapeHtml(issue.user.userPrincipalName)}</span>
                    </td>
                    <td><span class="badge ${badgeClass[issue.severity]}">${escapeHtml(issue.issueType)}</span></td>
                    <td>${App.formatDate(issue.user.createdDateTime)}</td>
                    <td>${issue.daysSinceCreation}</td>
                    <td>${issue.hasSignedIn
                        ? '<span class="badge badge-good">Yes</span>'
                        : '<span class="badge badge-warning">No</span>'}</td>
                    <td>${issue.mfaStatus === 'Registered'
                        ? '<span class="badge badge-good">Registered</span>'
                        : '<span class="badge badge-critical">Not registered</span>'}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderRoleHygieneTable(issues) {
        if (issues.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No role hygiene issues</div>
                        <div class="empty-state-message">All admin accounts appear to be properly maintained.</div>
                    </div>
                </div>
            `;
        }

        let html = '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Issue</th>
                    <th>Last Sign-In</th>
                    <th>MFA Status</th>
                    <th>Risk Level</th>
                </tr>
            </thead>
            <tbody>
        `;

        issues.slice(0, 100).forEach(issue => {
            const rowClass = issue.riskLevel === 'Critical' ? 'row-highlight-critical' : 'row-highlight-warning';
            html += `
                <tr class="${rowClass}">
                    <td>
                        ${escapeHtml(issue.user.displayName)}<br>
                        <span class="text-muted text-small">${escapeHtml(issue.user.userPrincipalName)}</span>
                    </td>
                    <td>
                        ${escapeHtml(issue.role)}
                        ${issue.isHighPrivilege ? '<span class="badge badge-critical" style="margin-left: 4px;">High</span>' : ''}
                    </td>
                    <td><span class="badge badge-warning">${escapeHtml(issue.issueType)}</span></td>
                    <td>${App.formatDate(issue.user.lastSignIn)}</td>
                    <td>${issue.mfaStatus === 'Registered'
                        ? '<span class="badge badge-good">Registered</span>'
                        : '<span class="badge badge-critical">Not registered</span>'}</td>
                    <td><span class="badge ${issue.riskLevel === 'Critical' ? 'badge-critical' : 'badge-warning'}">${issue.riskLevel}</span></td>
                </tr>
            `;
        });

        html += '</tbody></table></div></div>';
        return html;
    }

    function renderGuestCleanupTable(issues) {
        if (issues.length === 0) {
            return `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-title">No guest cleanup needed</div>
                        <div class="empty-state-message">All guest accounts appear to be active and valid.</div>
                    </div>
                </div>
            `;
        }

        let html = '<div class="table-container"><div class="table-wrapper"><table class="data-table">';
        html += `
            <thead>
                <tr>
                    <th>Guest</th>
                    <th>Source Domain</th>
                    <th>Invited</th>
                    <th>Last Sign-In</th>
                    <th>Status</th>
                    <th>Recommendation</th>
                </tr>
            </thead>
            <tbody>
        `;

        issues.slice(0, 100).forEach(issue => {
            html += `
                <tr class="row-highlight-warning">
                    <td>
                        ${escapeHtml(issue.guest.displayName)}<br>
                        <span class="text-muted text-small">${escapeHtml(issue.guest.mail || '')}</span>
                    </td>
                    <td>${escapeHtml(issue.guest.sourceDomain || 'N/A')}</td>
                    <td>${App.formatDate(issue.guest.createdDateTime)}</td>
                    <td>${App.formatDate(issue.guest.lastSignIn)}</td>
                    <td><span class="badge badge-warning">${escapeHtml(issue.status)}</span></td>
                    <td>${escapeHtml(issue.recommendation)}</td>
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
        users = [];
        guests = [];
        adminRoles = [];
    }

    return {
        init,
        render,
        cleanup
    };
})();

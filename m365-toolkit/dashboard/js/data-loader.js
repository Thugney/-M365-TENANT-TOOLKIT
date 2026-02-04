/**
 * M365 Tenant Toolkit - Data Loader
 * Loads all JSON data files and stores in global state
 */

const DataLoader = (function() {
    // Global state object
    const state = {
        users: [],
        licenseSkus: [],
        guests: [],
        mfaStatus: [],
        adminRoles: [],
        riskySignins: [],
        devices: [],
        compliance: {},
        autopilot: [],
        defenderAlerts: [],
        metadata: {},
        isLoaded: false,
        errors: []
    };

    // Data files to load
    const dataFiles = [
        { key: 'users', file: 'users.json' },
        { key: 'licenseSkus', file: 'license-skus.json' },
        { key: 'guests', file: 'guests.json' },
        { key: 'mfaStatus', file: 'mfa-status.json' },
        { key: 'adminRoles', file: 'admin-roles.json' },
        { key: 'riskySignins', file: 'risky-signins.json' },
        { key: 'devices', file: 'devices.json' },
        { key: 'compliance', file: 'compliance.json' },
        { key: 'autopilot', file: 'autopilot.json' },
        { key: 'defenderAlerts', file: 'defender-alerts.json' },
        { key: 'metadata', file: 'collection-metadata.json' }
    ];

    /**
     * Load a single JSON file
     */
    async function loadFile(fileInfo) {
        try {
            const response = await fetch(`data/${fileInfo.file}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            state[fileInfo.key] = data;
            return { success: true, key: fileInfo.key };
        } catch (error) {
            console.warn(`Failed to load ${fileInfo.file}:`, error.message);
            state.errors.push({
                file: fileInfo.file,
                error: error.message
            });
            // Set default empty value
            if (fileInfo.key === 'metadata' || fileInfo.key === 'compliance') {
                state[fileInfo.key] = {};
            } else {
                state[fileInfo.key] = [];
            }
            return { success: false, key: fileInfo.key, error: error.message };
        }
    }

    /**
     * Load all data files
     */
    async function loadAll() {
        state.errors = [];

        // Load all files in parallel
        const results = await Promise.all(dataFiles.map(loadFile));

        // Post-process: merge MFA status into users
        mergeMfaIntoUsers();

        // Post-process: enrich users with admin role info
        enrichUsersWithAdminRoles();

        state.isLoaded = true;

        return {
            success: state.errors.length === 0,
            errors: state.errors,
            loadedCount: results.filter(r => r.success).length,
            totalCount: dataFiles.length
        };
    }

    /**
     * Merge MFA status data into users
     */
    function mergeMfaIntoUsers() {
        if (!state.mfaStatus.length) return;

        const mfaMap = new Map();
        state.mfaStatus.forEach(mfa => {
            mfaMap.set(mfa.userId, mfa);
        });

        state.users.forEach(user => {
            const mfa = mfaMap.get(user.id);
            if (mfa) {
                user.mfaRegistered = mfa.isMfaRegistered;
                user.mfaMethods = mfa.methods || [];
                user.defaultMfaMethod = mfa.defaultMethod;
            }
        });
    }

    /**
     * Enrich users with admin role information
     */
    function enrichUsersWithAdminRoles() {
        if (!state.adminRoles.length) return;

        const adminMap = new Map();
        state.adminRoles.forEach(role => {
            role.members.forEach(member => {
                if (!adminMap.has(member.userId)) {
                    adminMap.set(member.userId, []);
                }
                adminMap.get(member.userId).push({
                    roleName: role.roleName,
                    isHighPrivilege: role.isHighPrivilege
                });
            });
        });

        state.users.forEach(user => {
            const roles = adminMap.get(user.id);
            if (roles) {
                user.adminRoles = roles;
                user.isAdmin = true;
                user.hasHighPrivilegeRole = roles.some(r => r.isHighPrivilege);
            } else {
                user.adminRoles = [];
                user.isAdmin = false;
                user.hasHighPrivilegeRole = false;
            }
        });
    }

    /**
     * Get state
     */
    function getState() {
        return state;
    }

    /**
     * Get specific data
     */
    function get(key) {
        return state[key];
    }

    /**
     * Check if data is loaded
     */
    function isLoaded() {
        return state.isLoaded;
    }

    /**
     * Get collection metadata
     */
    function getMetadata() {
        return state.metadata;
    }

    /**
     * Get loading errors
     */
    function getErrors() {
        return state.errors;
    }

    // Public API
    return {
        loadAll,
        getState,
        get,
        isLoaded,
        getMetadata,
        getErrors
    };
})();

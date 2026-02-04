/**
 * M365 Tenant Toolkit - Main Application
 * Navigation, routing, and app initialization
 */

const App = (function() {
    // Page registry
    const pages = {
        overview: PageOverview,
        users: PageUsers,
        licenses: PageLicenses,
        guests: PageGuests,
        security: PageSecurity,
        devices: PageDevices,
        lifecycle: PageLifecycle
    };

    let currentPage = null;

    /**
     * Initialize the application
     */
    async function init() {
        // Show loading overlay
        showLoading(true);

        // Load all data
        const result = await DataLoader.loadAll();

        // Update collection time
        updateCollectionTime();

        // Show warnings if any collectors failed
        showCollectionWarnings(result.errors);

        // Hide loading overlay
        showLoading(false);

        // Set up navigation
        setupNavigation();

        // Navigate to initial page
        handleNavigation();
    }

    /**
     * Show/hide loading overlay
     */
    function showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !show);
        }
    }

    /**
     * Update collection time in sidebar
     */
    function updateCollectionTime() {
        const metadata = DataLoader.getMetadata();
        const timeEl = document.getElementById('last-collection-time');

        if (timeEl && metadata.collectionTime) {
            const date = new Date(metadata.collectionTime);
            timeEl.textContent = date.toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else if (timeEl) {
            timeEl.textContent = 'No data';
        }
    }

    /**
     * Show collection warnings
     */
    function showCollectionWarnings(errors) {
        const container = document.getElementById('collection-warnings');
        if (!container) return;

        if (!errors || errors.length === 0) {
            container.innerHTML = '';
            return;
        }

        const failedCollectors = errors.map(e => e.file.replace('.json', '')).join(', ');
        container.innerHTML = `
            <div class="warning-banner">
                <span class="warning-banner-icon">!</span>
                <span>Some data failed to load: ${failedCollectors}</span>
            </div>
        `;
    }

    /**
     * Set up navigation event listeners
     */
    function setupNavigation() {
        // Handle hash changes
        window.addEventListener('hashchange', handleNavigation);

        // Handle nav link clicks
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Let the browser handle the hash change
                // The hashchange event will trigger handleNavigation
            });
        });
    }

    /**
     * Handle navigation to a page
     */
    function handleNavigation() {
        const hash = window.location.hash || '#overview';
        const pageName = hash.split('?')[0].replace('#', '') || 'overview';

        // Update active nav item
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.page === pageName);
        });

        // Update page title
        const titleEl = document.getElementById('page-title');
        if (titleEl) {
            titleEl.textContent = getPageTitle(pageName);
        }

        // Render the page
        renderPage(pageName);
    }

    /**
     * Get page title
     */
    function getPageTitle(pageName) {
        const titles = {
            overview: 'Overview',
            users: 'Users',
            licenses: 'Licenses',
            guests: 'Guest Accounts',
            security: 'Security',
            devices: 'Devices',
            lifecycle: 'Lifecycle Management'
        };
        return titles[pageName] || pageName;
    }

    /**
     * Render a page
     */
    function renderPage(pageName) {
        const page = pages[pageName];
        const container = document.getElementById('page-content');

        if (!page) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">Page not found</div>
                    <div class="empty-state-message">The page "${pageName}" does not exist.</div>
                </div>
            `;
            return;
        }

        // Clean up previous page if needed
        if (currentPage && currentPage.cleanup) {
            currentPage.cleanup();
        }

        currentPage = page;

        // Initialize and render the page
        if (page.init) {
            page.init();
        }
        if (page.render) {
            page.render(container);
        }
    }

    /**
     * Navigate to a page with optional filters
     */
    function navigateTo(pageName, filters = {}) {
        let hash = `#${pageName}`;

        if (Object.keys(filters).length > 0) {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    params.set(key, value.join(','));
                } else {
                    params.set(key, String(value));
                }
            });
            hash += `?${params.toString()}`;
        }

        window.location.hash = hash;
    }

    /**
     * Format numbers with locale
     */
    function formatNumber(num) {
        return Number(num || 0).toLocaleString();
    }

    /**
     * Format date
     */
    function formatDate(dateStr) {
        if (!dateStr) return 'Never';
        try {
            return new Date(dateStr).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    /**
     * Format date/time
     */
    function formatDateTime(dateStr) {
        if (!dateStr) return 'Never';
        try {
            return new Date(dateStr).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    /**
     * Calculate days between date and now
     */
    function daysSince(dateStr) {
        if (!dateStr) return null;
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffTime = now - date;
            return Math.floor(diffTime / (1000 * 60 * 60 * 24));
        } catch {
            return null;
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API
    return {
        navigateTo,
        formatNumber,
        formatDate,
        formatDateTime,
        daysSince,
        showLoading
    };
})();

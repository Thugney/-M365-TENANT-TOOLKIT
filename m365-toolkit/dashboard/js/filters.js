/**
 * M365 Tenant Toolkit - Filter Engine
 * Generic filtering system for all pages
 */

const Filters = (function() {
    let currentFilters = {};
    let filterConfig = {};
    let onFilterChange = null;

    /**
     * Initialize filters for a page
     * @param {Object} config - Filter configuration
     * @param {Function} onChange - Callback when filters change
     */
    function init(config, onChange) {
        filterConfig = config;
        onFilterChange = onChange;
        currentFilters = {};

        // Parse initial filters from URL hash
        parseFiltersFromUrl();
    }

    /**
     * Render filter bar HTML
     * @param {string} containerId - ID of container element
     */
    function render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '<div class="filter-bar">';

        filterConfig.filters.forEach(filter => {
            html += renderFilter(filter);
        });

        // Filter actions (count + reset + export)
        html += `
            <div class="filter-actions">
                <span id="filter-count" class="filter-count"></span>
                <button id="btn-reset-filters" class="btn btn-secondary" style="display: none;">Reset</button>
                <button id="btn-export" class="btn btn-secondary btn-export">Export CSV</button>
            </div>
        `;

        html += '</div>';
        container.innerHTML = html;

        // Attach event listeners
        attachEventListeners();

        // Apply initial filters from URL
        applyFiltersFromUrl();
    }

    /**
     * Render a single filter control
     */
    function renderFilter(filter) {
        let html = '<div class="filter-group">';
        html += `<label class="filter-label">${filter.label}</label>`;

        switch (filter.type) {
            case 'text':
                html += `<input type="text" id="filter-${filter.id}" class="filter-input ${filter.wide ? 'filter-input-wide' : ''}" placeholder="${filter.placeholder || 'Search...'}" />`;
                break;

            case 'select':
                html += `<select id="filter-${filter.id}" class="filter-select">`;
                html += `<option value="">${filter.allLabel || 'All'}</option>`;
                filter.options.forEach(opt => {
                    const value = typeof opt === 'object' ? opt.value : opt;
                    const label = typeof opt === 'object' ? opt.label : opt;
                    html += `<option value="${value}">${label}</option>`;
                });
                html += '</select>';
                break;

            case 'multiselect':
                html += '<div class="filter-checkbox-group">';
                filter.options.forEach(opt => {
                    const value = typeof opt === 'object' ? opt.value : opt;
                    const label = typeof opt === 'object' ? opt.label : opt;
                    html += `
                        <label class="filter-checkbox-label">
                            <input type="checkbox" id="filter-${filter.id}-${value}" data-filter="${filter.id}" value="${value}" />
                            ${label}
                        </label>
                    `;
                });
                html += '</div>';
                break;

            case 'checkbox':
                html += `
                    <label class="filter-checkbox-label" style="padding-top: 8px;">
                        <input type="checkbox" id="filter-${filter.id}" />
                        ${filter.checkboxLabel || 'Enable'}
                    </label>
                `;
                break;
        }

        html += '</div>';
        return html;
    }

    /**
     * Attach event listeners to filter controls
     */
    function attachEventListeners() {
        filterConfig.filters.forEach(filter => {
            if (filter.type === 'text') {
                const input = document.getElementById(`filter-${filter.id}`);
                if (input) {
                    let debounceTimer;
                    input.addEventListener('input', () => {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            updateFilter(filter.id, input.value);
                        }, 200);
                    });
                }
            } else if (filter.type === 'select') {
                const select = document.getElementById(`filter-${filter.id}`);
                if (select) {
                    select.addEventListener('change', () => {
                        updateFilter(filter.id, select.value);
                    });
                }
            } else if (filter.type === 'multiselect') {
                filter.options.forEach(opt => {
                    const value = typeof opt === 'object' ? opt.value : opt;
                    const checkbox = document.getElementById(`filter-${filter.id}-${value}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => {
                            updateMultiselectFilter(filter.id);
                        });
                    }
                });
            } else if (filter.type === 'checkbox') {
                const checkbox = document.getElementById(`filter-${filter.id}`);
                if (checkbox) {
                    checkbox.addEventListener('change', () => {
                        updateFilter(filter.id, checkbox.checked);
                    });
                }
            }
        });

        // Reset button
        const resetBtn = document.getElementById('btn-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetFilters);
        }

        // Export button is handled by the page
    }

    /**
     * Update a filter value
     */
    function updateFilter(filterId, value) {
        if (value === '' || value === false) {
            delete currentFilters[filterId];
        } else {
            currentFilters[filterId] = value;
        }

        updateFilterUI();
        updateUrlHash();

        if (onFilterChange) {
            onFilterChange(currentFilters);
        }
    }

    /**
     * Update multiselect filter
     */
    function updateMultiselectFilter(filterId) {
        const filter = filterConfig.filters.find(f => f.id === filterId);
        if (!filter) return;

        const values = [];
        filter.options.forEach(opt => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const checkbox = document.getElementById(`filter-${filterId}-${value}`);
            if (checkbox && checkbox.checked) {
                values.push(value);
            }
        });

        if (values.length === 0) {
            delete currentFilters[filterId];
        } else {
            currentFilters[filterId] = values;
        }

        updateFilterUI();
        updateUrlHash();

        if (onFilterChange) {
            onFilterChange(currentFilters);
        }
    }

    /**
     * Update filter UI elements
     */
    function updateFilterUI() {
        const activeCount = Object.keys(currentFilters).length;
        const countEl = document.getElementById('filter-count');
        const resetBtn = document.getElementById('btn-reset-filters');

        if (countEl) {
            countEl.textContent = activeCount > 0 ? `${activeCount} filter${activeCount > 1 ? 's' : ''} active` : '';
        }

        if (resetBtn) {
            resetBtn.style.display = activeCount > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * Reset all filters
     */
    function resetFilters() {
        currentFilters = {};

        // Reset UI controls
        filterConfig.filters.forEach(filter => {
            if (filter.type === 'text' || filter.type === 'select') {
                const el = document.getElementById(`filter-${filter.id}`);
                if (el) el.value = '';
            } else if (filter.type === 'multiselect') {
                filter.options.forEach(opt => {
                    const value = typeof opt === 'object' ? opt.value : opt;
                    const checkbox = document.getElementById(`filter-${filter.id}-${value}`);
                    if (checkbox) checkbox.checked = false;
                });
            } else if (filter.type === 'checkbox') {
                const checkbox = document.getElementById(`filter-${filter.id}`);
                if (checkbox) checkbox.checked = false;
            }
        });

        updateFilterUI();
        updateUrlHash();

        if (onFilterChange) {
            onFilterChange(currentFilters);
        }
    }

    /**
     * Apply data to array based on current filters
     */
    function applyFilters(data) {
        if (!filterConfig.filters || Object.keys(currentFilters).length === 0) {
            return data;
        }

        return data.filter(item => {
            return filterConfig.filters.every(filterDef => {
                const filterValue = currentFilters[filterDef.id];
                if (filterValue === undefined || filterValue === '' || filterValue === false) {
                    return true;
                }

                return matchesFilter(item, filterDef, filterValue);
            });
        });
    }

    /**
     * Check if item matches a filter
     */
    function matchesFilter(item, filterDef, filterValue) {
        if (filterDef.type === 'text') {
            // Text search across multiple fields
            const searchFields = filterDef.fields || [filterDef.field];
            const searchTerm = filterValue.toLowerCase();

            return searchFields.some(field => {
                const value = getNestedValue(item, field);
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(searchTerm);
            });
        }

        if (filterDef.type === 'select') {
            const itemValue = getNestedValue(item, filterDef.field);
            return String(itemValue) === String(filterValue);
        }

        if (filterDef.type === 'multiselect') {
            const itemValue = getNestedValue(item, filterDef.field);

            // If field is array, check if any value matches
            if (Array.isArray(itemValue)) {
                return filterValue.some(fv => itemValue.includes(fv));
            }

            return filterValue.includes(String(itemValue));
        }

        if (filterDef.type === 'checkbox') {
            if (filterDef.filterFn) {
                return filterDef.filterFn(item);
            }
            const itemValue = getNestedValue(item, filterDef.field);
            return Boolean(itemValue) === filterValue;
        }

        return true;
    }

    /**
     * Get nested value from object
     */
    function getNestedValue(obj, path) {
        if (!path) return obj;
        const parts = path.split('.');
        let value = obj;
        for (const part of parts) {
            if (value === null || value === undefined) return undefined;
            value = value[part];
        }
        return value;
    }

    /**
     * Parse filters from URL hash
     */
    function parseFiltersFromUrl() {
        const hash = window.location.hash;
        if (!hash || !hash.includes('?')) return;

        const queryString = hash.split('?')[1];
        if (!queryString) return;

        const params = new URLSearchParams(queryString);
        params.forEach((value, key) => {
            // Check if this is a valid filter
            const filter = filterConfig.filters?.find(f => f.id === key);
            if (filter) {
                if (filter.type === 'multiselect') {
                    currentFilters[key] = value.split(',');
                } else if (filter.type === 'checkbox') {
                    currentFilters[key] = value === 'true';
                } else {
                    currentFilters[key] = value;
                }
            }
        });
    }

    /**
     * Apply filters from URL to UI
     */
    function applyFiltersFromUrl() {
        Object.entries(currentFilters).forEach(([filterId, value]) => {
            const filter = filterConfig.filters?.find(f => f.id === filterId);
            if (!filter) return;

            if (filter.type === 'text' || filter.type === 'select') {
                const el = document.getElementById(`filter-${filterId}`);
                if (el) el.value = value;
            } else if (filter.type === 'multiselect' && Array.isArray(value)) {
                value.forEach(v => {
                    const checkbox = document.getElementById(`filter-${filterId}-${v}`);
                    if (checkbox) checkbox.checked = true;
                });
            } else if (filter.type === 'checkbox') {
                const checkbox = document.getElementById(`filter-${filterId}`);
                if (checkbox) checkbox.checked = value;
            }
        });

        updateFilterUI();
    }

    /**
     * Update URL hash with current filters
     */
    function updateUrlHash() {
        const page = window.location.hash.split('?')[0] || '#overview';

        if (Object.keys(currentFilters).length === 0) {
            window.history.replaceState(null, '', page);
            return;
        }

        const params = new URLSearchParams();
        Object.entries(currentFilters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                params.set(key, value.join(','));
            } else {
                params.set(key, String(value));
            }
        });

        window.history.replaceState(null, '', `${page}?${params.toString()}`);
    }

    /**
     * Get current filters
     */
    function getCurrentFilters() {
        return { ...currentFilters };
    }

    /**
     * Set filters programmatically
     */
    function setFilters(filters) {
        currentFilters = { ...filters };
        applyFiltersFromUrl();

        if (onFilterChange) {
            onFilterChange(currentFilters);
        }
    }

    /**
     * Populate select options dynamically from data
     */
    function populateSelectOptions(filterId, options) {
        const select = document.getElementById(`filter-${filterId}`);
        if (!select) return;

        // Keep the "All" option
        const allOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (allOption) {
            select.appendChild(allOption);
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'All';
            select.appendChild(opt);
        }

        // Add new options
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = typeof option === 'object' ? option.value : option;
            opt.textContent = typeof option === 'object' ? option.label : option;
            select.appendChild(opt);
        });
    }

    // Public API
    return {
        init,
        render,
        applyFilters,
        resetFilters,
        getCurrentFilters,
        setFilters,
        populateSelectOptions
    };
})();

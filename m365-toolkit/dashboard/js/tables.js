/**
 * M365 Tenant Toolkit - Table Renderer
 * Generic sortable, paginated table with row expansion
 */

const Tables = (function() {
    const ROWS_PER_PAGE = 50;

    let currentConfig = null;
    let currentData = [];
    let filteredData = [];
    let sortColumn = null;
    let sortDirection = 'asc';
    let currentPage = 1;
    let expandedRows = new Set();

    /**
     * Initialize table
     * @param {Object} config - Table configuration
     */
    function init(config) {
        currentConfig = config;
        sortColumn = config.defaultSort || null;
        sortDirection = config.defaultSortDir || 'asc';
        currentPage = 1;
        expandedRows.clear();
    }

    /**
     * Set data and render
     * @param {Array} data - Data array to display
     */
    function setData(data) {
        currentData = data;
        filteredData = [...data];
        currentPage = 1;
        expandedRows.clear();

        if (sortColumn) {
            sortData();
        }

        render();
    }

    /**
     * Update with filtered data
     * @param {Array} data - Filtered data array
     */
    function updateFilteredData(data) {
        filteredData = [...data];
        currentPage = 1;
        expandedRows.clear();

        if (sortColumn) {
            sortData();
        }

        render();
    }

    /**
     * Sort data by column
     */
    function sortData() {
        const column = currentConfig.columns.find(c => c.field === sortColumn);
        if (!column) return;

        filteredData.sort((a, b) => {
            let aVal = getNestedValue(a, sortColumn);
            let bVal = getNestedValue(b, sortColumn);

            // Handle null/undefined
            if (aVal === null || aVal === undefined) aVal = '';
            if (bVal === null || bVal === undefined) bVal = '';

            // Handle different types
            if (column.sortType === 'number') {
                aVal = Number(aVal) || 0;
                bVal = Number(bVal) || 0;
            } else if (column.sortType === 'date') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }

            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            if (aVal > bVal) comparison = 1;

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * Handle column header click for sorting
     */
    function handleSort(field) {
        if (sortColumn === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = field;
            sortDirection = 'asc';
        }

        sortData();
        render();
    }

    /**
     * Render the table
     */
    function render() {
        const container = document.getElementById(currentConfig.containerId);
        if (!container) return;

        if (filteredData.length === 0) {
            container.innerHTML = `
                <div class="table-container">
                    <div class="empty-state">
                        <div class="empty-state-icon">&#9744;</div>
                        <div class="empty-state-title">No data found</div>
                        <div class="empty-state-message">Try adjusting your filters or check if data has been collected.</div>
                    </div>
                </div>
            `;
            return;
        }

        const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const endIndex = Math.min(startIndex + ROWS_PER_PAGE, filteredData.length);
        const pageData = filteredData.slice(startIndex, endIndex);

        let html = '<div class="table-container">';
        html += '<div class="table-wrapper">';
        html += '<table class="data-table">';

        // Header
        html += '<thead><tr>';
        currentConfig.columns.forEach(col => {
            const isSorted = sortColumn === col.field;
            const sortClass = col.sortable !== false ? 'sortable' : '';
            const sortIndicator = col.sortable !== false
                ? `<span class="sort-indicator ${isSorted ? 'active' : ''}">${isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}</span>`
                : '';

            html += `<th class="${sortClass}" data-field="${col.field}">${col.label}${sortIndicator}</th>`;
        });
        html += '</tr></thead>';

        // Body
        html += '<tbody>';
        pageData.forEach((row, index) => {
            const rowId = row.id || `row-${startIndex + index}`;
            const isExpanded = expandedRows.has(rowId);
            const rowClass = currentConfig.expandable ? 'expandable' : '';
            const expandedClass = isExpanded ? 'expanded' : '';
            const highlightClass = getRowHighlightClass(row);

            html += `<tr class="${rowClass} ${expandedClass} ${highlightClass}" data-row-id="${rowId}">`;
            currentConfig.columns.forEach(col => {
                const value = getNestedValue(row, col.field);
                const formatted = col.formatter ? col.formatter(value, row) : formatValue(value, col);
                html += `<td>${formatted}</td>`;
            });
            html += '</tr>';

            // Expanded row detail
            if (isExpanded && currentConfig.expandable && currentConfig.renderDetail) {
                html += `<tr class="row-detail" data-detail-for="${rowId}">`;
                html += `<td colspan="${currentConfig.columns.length}">`;
                html += currentConfig.renderDetail(row);
                html += '</td></tr>';
            }
        });
        html += '</tbody>';

        html += '</table>';
        html += '</div>';

        // Pagination
        html += renderPagination(startIndex, endIndex, totalPages);

        html += '</div>';

        container.innerHTML = html;

        // Attach event listeners
        attachTableListeners();
    }

    /**
     * Get row highlight class based on config
     */
    function getRowHighlightClass(row) {
        if (!currentConfig.rowHighlight) return '';
        return currentConfig.rowHighlight(row) || '';
    }

    /**
     * Render pagination controls
     */
    function renderPagination(startIndex, endIndex, totalPages) {
        let html = '<div class="pagination">';

        html += `<div class="pagination-info">Showing ${startIndex + 1}-${endIndex} of ${filteredData.length}</div>`;

        html += '<div class="pagination-controls">';

        // Previous button
        html += `<button class="pagination-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;

        // Page numbers
        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);

        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        if (startPage > 1) {
            html += `<button class="pagination-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span style="padding: 6px;">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `<button class="pagination-btn ${activeClass}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span style="padding: 6px;">...</span>`;
            }
            html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next button
        html += `<button class="pagination-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;

        html += '</div>';
        html += '</div>';

        return html;
    }

    /**
     * Attach event listeners to table
     */
    function attachTableListeners() {
        const container = document.getElementById(currentConfig.containerId);
        if (!container) return;

        // Sort headers
        container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                handleSort(th.dataset.field);
            });
        });

        // Row expansion
        if (currentConfig.expandable) {
            container.querySelectorAll('tr.expandable').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    // Don't expand if clicking on a link or button
                    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;

                    const rowId = tr.dataset.rowId;
                    if (expandedRows.has(rowId)) {
                        expandedRows.delete(rowId);
                    } else {
                        expandedRows.add(rowId);
                    }
                    render();
                });
            });
        }

        // Pagination
        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = btn.dataset.page;
                if (page === 'prev') {
                    currentPage = Math.max(1, currentPage - 1);
                } else if (page === 'next') {
                    currentPage = Math.min(Math.ceil(filteredData.length / ROWS_PER_PAGE), currentPage + 1);
                } else {
                    currentPage = parseInt(page, 10);
                }
                render();
            });
        });
    }

    /**
     * Format value based on column type
     */
    function formatValue(value, column) {
        if (value === null || value === undefined) {
            return '<span class="text-muted">N/A</span>';
        }

        if (column.type === 'date') {
            return formatDate(value);
        }

        if (column.type === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        if (column.type === 'badge') {
            return renderBadge(value, column.badgeMap);
        }

        if (column.type === 'flags') {
            return renderFlags(value);
        }

        if (column.type === 'number') {
            return Number(value).toLocaleString();
        }

        if (column.type === 'percent') {
            return `${Number(value).toFixed(0)}%`;
        }

        return escapeHtml(String(value));
    }

    /**
     * Format date
     */
    function formatDate(dateStr) {
        if (!dateStr) return '<span class="text-muted">Never</span>';

        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    /**
     * Render badge
     */
    function renderBadge(value, badgeMap) {
        const config = badgeMap?.[value] || badgeMap?.default || { class: 'badge-neutral', label: value };
        const label = config.label || value;
        return `<span class="badge ${config.class}">${escapeHtml(label)}</span>`;
    }

    /**
     * Render flags list
     */
    function renderFlags(flags) {
        if (!flags || !Array.isArray(flags) || flags.length === 0) {
            return '<span class="text-muted">-</span>';
        }

        const flagBadges = {
            'inactive': 'badge-warning',
            'no-mfa': 'badge-critical',
            'disabled': 'badge-neutral',
            'admin': 'badge-info',
            'stale': 'badge-warning',
            'high-privilege': 'badge-critical'
        };

        return '<div class="flags-list">' +
            flags.map(flag => {
                const badgeClass = flagBadges[flag] || 'badge-neutral';
                return `<span class="badge ${badgeClass}">${escapeHtml(flag)}</span>`;
            }).join('') +
            '</div>';
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
     * Escape HTML
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Get current filtered data (for export)
     */
    function getFilteredData() {
        return filteredData;
    }

    /**
     * Get current config
     */
    function getConfig() {
        return currentConfig;
    }

    // Public API
    return {
        init,
        setData,
        updateFilteredData,
        render,
        getFilteredData,
        getConfig
    };
})();

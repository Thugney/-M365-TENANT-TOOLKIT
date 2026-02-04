/**
 * M365 Tenant Toolkit - CSV Export
 * Export table data to CSV files
 */

const Export = (function() {
    /**
     * Export data to CSV
     * @param {Array} data - Data array to export
     * @param {Array} columns - Column definitions
     * @param {string} filename - Base filename (without extension)
     */
    function toCSV(data, columns, filename) {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }

        // Build CSV content
        const rows = [];

        // Header row
        const headers = columns.map(col => escapeCSVField(col.label));
        rows.push(headers.join(','));

        // Data rows
        data.forEach(item => {
            const row = columns.map(col => {
                let value = getNestedValue(item, col.field);

                // Format value for CSV
                value = formatValueForCSV(value, col);

                return escapeCSVField(value);
            });
            rows.push(row.join(','));
        });

        const csvContent = rows.join('\r\n');

        // Generate filename with date
        const date = new Date().toISOString().split('T')[0];
        const fullFilename = `${filename}-${date}.csv`;

        // Download
        downloadCSV(csvContent, fullFilename);
    }

    /**
     * Export from current table state
     * @param {string} filename - Base filename
     */
    function exportCurrentTable(filename) {
        const data = Tables.getFilteredData();
        const config = Tables.getConfig();

        if (!config || !config.columns) {
            console.error('No table configuration found');
            return;
        }

        // Filter columns that should be exported
        const exportColumns = config.columns.filter(col => col.exportable !== false);

        toCSV(data, exportColumns, filename);
    }

    /**
     * Export custom data with columns
     * @param {Array} data - Data to export
     * @param {Array} columns - Column definitions { field, label }
     * @param {string} filename - Base filename
     */
    function exportData(data, columns, filename) {
        toCSV(data, columns, filename);
    }

    /**
     * Format value for CSV export
     */
    function formatValueForCSV(value, column) {
        if (value === null || value === undefined) {
            return '';
        }

        // Handle arrays (like flags)
        if (Array.isArray(value)) {
            return value.join('; ');
        }

        // Handle objects
        if (typeof value === 'object') {
            // Check for location object
            if (value.city || value.countryOrRegion) {
                return [value.city, value.countryOrRegion].filter(Boolean).join(', ');
            }
            return JSON.stringify(value);
        }

        // Handle dates
        if (column && column.type === 'date' && value) {
            try {
                const date = new Date(value);
                return date.toISOString().split('T')[0];
            } catch {
                return String(value);
            }
        }

        // Handle booleans
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }

        return String(value);
    }

    /**
     * Escape field for CSV (handle commas, quotes, newlines)
     */
    function escapeCSVField(value) {
        if (value === null || value === undefined) {
            return '';
        }

        const str = String(value);

        // If contains comma, quote, or newline, wrap in quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            // Escape existing quotes by doubling them
            return '"' + str.replace(/"/g, '""') + '"';
        }

        return str;
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
     * Download CSV content as file
     */
    function downloadCSV(content, filename) {
        // Add BOM for Excel UTF-8 compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });

        // Create download link
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        toCSV,
        exportCurrentTable,
        exportData
    };
})();

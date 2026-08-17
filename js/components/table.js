/**
 * Reusable data table component with search, filters, pagination, and sorting.
 */

/**
 * Create and render a data table.
 * @param {HTMLElement} container - Element to render into
 * @param {object} options - Table configuration
 */
export function createTable(container, options) {
    const {
        columns = [],
        data = [],
        searchable = true,
        searchPlaceholder = 'Ara...',
        pageSize = 10,
        actions = [],
        onRowClick,
        filters = [],
    } = options;

    // --- State ---
    let searchTerm = '';
    let currentPage = 1;
    let sortKey = null;
    let sortDir = 'asc'; // 'asc' | 'desc'
    let filterValues = {};

    filters.forEach(f => {
        filterValues[f.key] = '';
    });

    /**
     * Apply search, filters, and sorting to produce visible rows.
     */
    function getFilteredData() {
        let result = [...data];

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(row =>
                columns.some(col => {
                    const val = row[col.key];
                    return val != null && String(val).toLowerCase().includes(term);
                })
            );
        }

        // Filters
        for (const [key, value] of Object.entries(filterValues)) {
            if (value) {
                result = result.filter(row => String(row[key]) === value);
            }
        }

        // Sort
        if (sortKey) {
            result.sort((a, b) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];

                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
                }

                const aStr = String(aVal).toLowerCase();
                const bStr = String(bVal).toLowerCase();
                const cmp = aStr.localeCompare(bStr, 'tr');
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }

    /**
     * Render the full table UI.
     */
    function render() {
        const filtered = getFilteredData();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

        // Clamp current page
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIdx = (currentPage - 1) * pageSize;
        const pageData = filtered.slice(startIdx, startIdx + pageSize);

        // --- Toolbar ---
        let toolbarHTML = '';
        if (searchable || filters.length > 0) {
            toolbarHTML = '<div class="table-toolbar">';

            if (searchable) {
                toolbarHTML += `
                    <div class="table-search">
                        <i data-lucide="search" style="width:16px;height:16px;opacity:0.4;position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;"></i>
                        <input type="text" placeholder="${searchPlaceholder}" value="${escapeHtml(searchTerm)}" class="table-search-input" style="padding-left:36px;" />
                    </div>
                `;
            }

            if (filters.length > 0) {
                toolbarHTML += '<div class="table-filters">';
                filters.forEach(f => {
                    const optionsHTML = f.options.map(opt =>
                        `<option value="${escapeHtml(opt.value)}"${filterValues[f.key] === opt.value ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`
                    ).join('');
                    toolbarHTML += `
                        <select class="filter-select" data-filter-key="${f.key}">
                            ${optionsHTML}
                        </select>
                    `;
                });
                toolbarHTML += '</div>';
            }

            toolbarHTML += '</div>';
        }

        // --- Column headers ---
        const hasActions = actions.length > 0;
        let theadHTML = '<tr>';
        columns.forEach(col => {
            let sortIndicator = '';
            if (sortKey === col.key) {
                sortIndicator = sortDir === 'asc' ? ' ↑' : ' ↓';
            }
            theadHTML += `<th class="sortable-header" data-sort-key="${col.key}" style="cursor:pointer;user-select:none;">${escapeHtml(col.label)}${sortIndicator}</th>`;
        });
        if (hasActions) {
            theadHTML += '<th style="width:120px;text-align:center;">İşlemler</th>';
        }
        theadHTML += '</tr>';

        // --- Rows ---
        let tbodyHTML = '';
        if (pageData.length === 0) {
            const colSpan = columns.length + (hasActions ? 1 : 0);
            tbodyHTML = `
                <tr>
                    <td colspan="${colSpan}">
                        <div class="empty-state">
                            <div class="empty-state-icon">
                                <i data-lucide="search-x"></i>
                            </div>
                            <h3 class="empty-state-title">Sonuç bulunamadı</h3>
                            <p class="empty-state-text">Arama kriterlerinize uygun kayıt bulunamadı.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            pageData.forEach(row => {
                const clickable = onRowClick ? ' style="cursor:pointer;"' : '';
                tbodyHTML += `<tr data-row-id="${row.id}"${clickable}>`;
                columns.forEach(col => {
                    const raw = row[col.key];
                    const display = col.render ? col.render(raw, row) : escapeHtml(raw != null ? String(raw) : '');
                    tbodyHTML += `<td>${display}</td>`;
                });
                if (hasActions) {
                    tbodyHTML += '<td><div class="action-btns">';
                    actions.forEach((action, idx) => {
                        tbodyHTML += `
                            <button class="action-btn ${action.className || ''}" title="${escapeHtml(action.title || '')}" data-action-idx="${idx}" data-row-id="${row.id}">
                                <i data-lucide="${action.icon}"></i>
                            </button>
                        `;
                    });
                    tbodyHTML += '</div></td>';
                }
                tbodyHTML += '</tr>';
            });
        }

        // --- Pagination ---
        const rangeStart = filtered.length > 0 ? startIdx + 1 : 0;
        const rangeEnd = Math.min(startIdx + pageSize, filtered.length);

        let paginationHTML = `
            <div class="table-pagination">
                <div class="pagination-info">
                    ${rangeStart}–${rangeEnd} / ${filtered.length} kayıt gösteriliyor
                </div>
                <div class="pagination-controls">
                    <button class="pagination-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-left"></i>
                    </button>
        `;

        // Page buttons (show max 5)
        const maxButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let p = startPage; p <= endPage; p++) {
            paginationHTML += `
                <button class="pagination-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
            `;
        }

        paginationHTML += `
                    <button class="pagination-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''}>
                        <i data-lucide="chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        // --- Assemble ---
        container.innerHTML = `
            <div class="table-container">
                ${toolbarHTML}
                <table class="data-table">
                    <thead>${theadHTML}</thead>
                    <tbody>${tbodyHTML}</tbody>
                </table>
                ${paginationHTML}
            </div>
        `;

        attachListeners();

        // Process icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    /**
     * Attach DOM event listeners after render.
     */
    function attachListeners() {
        // Search
        const searchInput = container.querySelector('.table-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                currentPage = 1;
                render();
                // Re-focus input and set cursor position
                const newInput = container.querySelector('.table-search-input');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            });
        }

        // Filters
        container.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const key = e.target.dataset.filterKey;
                filterValues[key] = e.target.value;
                currentPage = 1;
                render();
            });
        });

        // Sort headers
        container.querySelectorAll('.sortable-header').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                if (sortKey === key) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortKey = key;
                    sortDir = 'asc';
                }
                render();
            });
        });

        // Pagination
        container.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page, 10);
                render();
            });
        });

        const prevBtn = container.querySelector('.prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    render();
                }
            });
        }

        const nextBtn = container.querySelector('.next-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const filtered = getFilteredData();
                const totalPages = Math.ceil(filtered.length / pageSize);
                if (currentPage < totalPages) {
                    currentPage++;
                    render();
                }
            });
        }

        // Row click
        if (onRowClick) {
            container.querySelectorAll('tbody tr[data-row-id]').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    // Don't trigger row click if an action button was clicked
                    if (e.target.closest('.action-btn')) return;
                    const rowId = tr.dataset.rowId;
                    const row = data.find(r => String(r.id) === rowId);
                    if (row) onRowClick(row);
                });
            });
        }

        // Action buttons
        actions.forEach((action, idx) => {
            container.querySelectorAll(`.action-btn[data-action-idx="${idx}"]`).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rowId = btn.dataset.rowId;
                    const row = data.find(r => String(r.id) === rowId);
                    if (row && action.onClick) action.onClick(row);
                });
            });
        });
    }

    // Initial render
    render();
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

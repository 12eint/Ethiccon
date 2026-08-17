/**
 * KPI Card component.
 * Returns an HTML string for a single KPI metric card.
 */

/**
 * Create a KPI card HTML string.
 * @param {{ icon: string, title: string, value: string|number, subtitle?: string, trend?: string, trendDirection?: 'up'|'down', color: 'purple'|'green'|'blue'|'amber' }} options
 * @returns {string} HTML string
 */
export function createKPICard({ icon, title, value, subtitle, trend, trendDirection, color }) {
    const trendClass = trendDirection ? ` ${trendDirection}` : '';
    const trendHTML = trend
        ? `<span class="kpi-trend${trendClass}">
               <i data-lucide="${trendDirection === 'up' ? 'trending-up' : 'trending-down'}" style="width:14px;height:14px;"></i>
               ${trend}
           </span>`
        : '';

    const subtitleHTML = subtitle
        ? `<span class="kpi-label">${subtitle}</span>`
        : '';

    return `
        <div class="kpi-card ${color}">
            <div class="kpi-icon">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="kpi-content">
                <span class="kpi-label">${title}</span>
                <span class="kpi-value">${value}</span>
                ${subtitleHTML}
                ${trendHTML}
            </div>
        </div>
    `;
}

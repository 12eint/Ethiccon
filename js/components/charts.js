/**
 * Chart wrapper components using Chart.js.
 * Provides bar and doughnut chart creators with consistent styling.
 */

// Design system colors
const COLORS = {
    purple: 'rgba(139, 92, 246, 1)',
    purpleLight: 'rgba(139, 92, 246, 0.15)',
    green: 'rgba(16, 185, 129, 1)',
    greenLight: 'rgba(16, 185, 129, 0.15)',
    blue: 'rgba(59, 130, 246, 1)',
    blueLight: 'rgba(59, 130, 246, 0.15)',
    amber: 'rgba(245, 158, 11, 1)',
    amberLight: 'rgba(245, 158, 11, 0.15)',
    red: 'rgba(239, 68, 68, 1)',
    gray: 'rgba(148, 163, 184, 1)',
    gridLine: 'rgba(148, 163, 184, 0.1)',
    text: 'rgba(148, 163, 184, 0.8)',
};

/** Active chart instances for cleanup */
const chartInstances = [];

/**
 * Create a bar chart.
 * @param {string} canvasId - Canvas element ID
 * @param {{ labels: string[], datasets: Array<{ label: string, data: number[], color?: string }> }} options
 * @returns {Chart} Chart instance
 */
export function createBarChart(canvasId, { labels, datasets }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');

    const defaultColors = [COLORS.purple, COLORS.green, COLORS.blue, COLORS.amber];
    const defaultBgColors = [COLORS.purpleLight, COLORS.greenLight, COLORS.blueLight, COLORS.amberLight];

    const chartDatasets = datasets.map((ds, i) => {
        const color = ds.color || defaultColors[i % defaultColors.length];
        const bgColor = defaultBgColors[i % defaultBgColors.length];

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, bgColor);

        return {
            label: ds.label,
            data: ds.data,
            backgroundColor: gradient,
            borderColor: color,
            borderWidth: 0,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
        };
    });

    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: chartDatasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    position: 'top',
                    labels: {
                        color: COLORS.text,
                        font: {
                            family: 'Inter, sans-serif',
                            size: 12,
                        },
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 20,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter, sans-serif', size: 13 },
                    bodyFont: { family: 'Inter, sans-serif', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    borderWidth: 1,
                },
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: COLORS.text,
                        font: {
                            family: 'Inter, sans-serif',
                            size: 11,
                        },
                    },
                    border: {
                        display: false,
                    },
                },
                y: {
                    grid: {
                        color: COLORS.gridLine,
                    },
                    ticks: {
                        color: COLORS.text,
                        font: {
                            family: 'Inter, sans-serif',
                            size: 11,
                        },
                    },
                    border: {
                        display: false,
                    },
                },
            },
        },
    });

    chartInstances.push(chart);
    return chart;
}

/**
 * Create a doughnut chart.
 * @param {string} canvasId - Canvas element ID
 * @param {{ labels: string[], data: number[], colors?: string[] }} options
 * @returns {Chart} Chart instance
 */
export function createDoughnutChart(canvasId, { labels, data, colors }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');

    const defaultColors = [
        COLORS.purple,
        COLORS.green,
        COLORS.blue,
        COLORS.amber,
        COLORS.red,
        COLORS.gray,
    ];

    const chartColors = colors || defaultColors.slice(0, data.length);

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: chartColors,
                borderColor: 'rgba(15, 23, 42, 0.8)',
                borderWidth: 3,
                hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
                hoverOffset: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: COLORS.text,
                        font: {
                            family: 'Inter, sans-serif',
                            size: 12,
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter, sans-serif', size: 13 },
                    bodyFont: { family: 'Inter, sans-serif', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    borderWidth: 1,
                },
            },
        },
    });

    chartInstances.push(chart);
    return chart;
}

/**
 * Destroy all existing chart instances to prevent memory leaks.
 * Should be called before re-rendering a page that contains charts.
 */
export function destroyCharts() {
    while (chartInstances.length > 0) {
        const chart = chartInstances.pop();
        if (chart) {
            chart.destroy();
        }
    }
}

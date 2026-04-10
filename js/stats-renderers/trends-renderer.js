// Monthly Trends Renderer - AlcoNote PWA
// Renders a line chart showing monthly consumption evolution

const TrendsStatsRenderer = {
    /**
     * Render the monthly trends section
     * @param {Object} stats - From TrendsStatsCalculator
     * @returns {HTMLElement}
     */
    renderTrendsStats(stats) {
        const section = document.createElement('div');
        section.className = 'stats-section trends-section';

        if (!stats || !stats.months || stats.months.length < 2) {
            section.innerHTML = `
                <div class="section-header"><h3>Évolution mensuelle</h3></div>
                <div class="empty-message">Sélectionnez une période d'au moins 2 mois pour voir l'évolution.</div>
            `;
            return section;
        }

        section.innerHTML = `
            <div class="trends-chart-wrapper">
                <canvas id="trends-monthly-chart"></canvas>
            </div>
        `;

        // Store stats on element for postRender
        section._trendsData = stats;

        return section;
    },

    /**
     * Post-render: initialize Chart.js line chart
     */
    postRenderTrendsStats(stats) {
        const section = document.querySelector('.trends-section');
        const data = section?._trendsData || stats;
        if (!data || !data.months || data.months.length < 2) return;

        const canvas = document.getElementById('trends-monthly-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const style = getComputedStyle(document.documentElement);
        const textColor = style.getPropertyValue('--text-secondary').trim() || '#666';
        const gridColor = style.getPropertyValue('--gray-4').trim() || '#e0e0e0';

        const labels = data.months.map(m => m.label);
        const drinkCounts = data.months.map(m => m.drinkCount);
        const alcoholGrams = data.months.map(m => m.alcoholGrams);

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Verres',
                        data: drinkCounts,
                        borderColor: '#007AFF',
                        backgroundColor: 'rgba(0, 122, 255, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Alcool (g)',
                        data: alcoholGrams,
                        borderColor: '#FF9500',
                        backgroundColor: 'rgba(255, 149, 0, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: { color: textColor, maxRotation: 45 },
                        grid: { display: false }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        title: { display: true, text: 'Verres', color: textColor },
                        ticks: { color: textColor },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        title: { display: true, text: 'Alcool (g)', color: textColor },
                        ticks: { color: textColor },
                        grid: { drawOnChartArea: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, usePointStyle: true, pointStyle: 'circle' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const unit = item.datasetIndex === 0 ? ' verres' : 'g';
                                return `${item.dataset.label}: ${item.parsed.y}${unit}`;
                            }
                        }
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x'
                        }
                    }
                }
            }
        });

        // Store for cleanup
        if (window.modularStatsManager) {
            window.modularStatsManager.charts['trends-monthly'] = chart;
        }
    }
};

window.TrendsStatsRenderer = TrendsStatsRenderer;

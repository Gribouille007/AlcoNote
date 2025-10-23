// Composant de rendu pour les statistiques temporelles - AlcoNote PWA

/**
 * Rend les statistiques temporelles
 * @param {Object} stats - Statistiques temporelles calculées
 * @param {string} currentPeriod - Période actuelle
 * @returns {string} HTML des statistiques temporelles
 */
function renderTemporalStats(stats, currentPeriod = 'today') {
    if (!stats) {
        return '<div class="error-message">Erreur lors du chargement des statistiques temporelles</div>';
    }
    
    const section = document.createElement('div');
    section.className = 'stats-section';
    section.innerHTML = `
        <h3>Analyse temporelle</h3>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.peakHour}h</div>
                <div class="stat-label">Heure de pointe</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Utils.getDayName(stats.peakDay)}</div>
                <div class="stat-label">Jour de pointe</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatDuration(stats.avgSessionDuration)}</div>
                <div class="stat-label">Durée moyenne session</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${formatDuration(stats.avgTimeBetweenSessions)}</div>
                <div class="stat-label">Temps entre sessions</div>
            </div>
        </div>
    `;
    
    return section;
}

/**
 * Rend le graphique de distribution horaire
 * @param {Object} hourlyData - Données horaires
 * @returns {HTMLElement} Conteneur du graphique
 */
function renderHourlyDistributionChart(hourlyData) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.innerHTML = `
        <h4 class="chart-title">Consommation par heure</h4>
        <div class="chart-wrapper">
            <canvas id="hourly-chart"></canvas>
        </div>
    `;
    
    return chartContainer;
}

/**
 * Rend le graphique de distribution journalière
 * @param {Object} dailyData - Données journalières
 * @returns {HTMLElement} Conteneur du graphique
 */
function renderDailyDistributionChart(dailyData) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.innerHTML = `
        <h4 class="chart-title">Consommation par jour de la semaine</h4>
        <div class="chart-wrapper">
            <canvas id="daily-chart"></canvas>
        </div>
    `;
    
    return chartContainer;
}

/**
 * Initialise le graphique horaire
 * @param {Object} hourlyData - Données horaires
 */
function initializeHourlyChart(hourlyData) {
    const canvas = document.getElementById('hourly-chart');
    if (!canvas || !window.Chart) return;
    
    const ctx = canvas.getContext('2d');
    const labels = Object.keys(hourlyData).map(hour => `${hour}h`);
    const data = Object.values(hourlyData);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nombre de boissons',
                data: data,
                backgroundColor: Utils.hexToRgba('#007AFF', 0.7),
                borderColor: '#007AFF',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

/**
 * Initialise le graphique journalier
 * @param {Object} dailyData - Données journalières
 */
function initializeDailyChart(dailyData) {
    const canvas = document.getElementById('daily-chart');
    if (!canvas || !window.Chart) return;
    
    const ctx = canvas.getContext('2d');
    
    // Ordre des jours : Lundi à Dimanche
    const orderedDays = [1, 2, 3, 4, 5, 6, 0];
    const labels = orderedDays.map(day => Utils.getDayName(day));
    const data = orderedDays.map(day => dailyData[day] || 0);
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nombre de boissons',
                data: data,
                backgroundColor: Utils.hexToRgba('#34C759', 0.3),
                borderColor: '#34C759',
                borderWidth: 2,
                pointBackgroundColor: '#34C759',
                pointBorderColor: '#34C759',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.r;
                            return value + ' boisson' + (value > 1 ? 's' : '');
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        display: false,
                        maxTicksLimit: 5
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        lineWidth: 1
                    },
                    angleLines: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        lineWidth: 1
                    },
                    pointLabels: {
                        font: {
                            size: 12,
                            weight: 'normal'
                        },
                        color: '#333'
                    }
                }
            }
        }
    });
}

/**
 * Post-traitement après rendu
 * @param {Object} stats - Statistiques temporelles
 * @param {string} currentPeriod - Période actuelle
 */
function postRenderTemporalStats(stats, currentPeriod = 'today', ctx = null) {
    // Initialiser le graphique horaire
    setTimeout(() => {
        initializeHourlyChart(stats.hourlyDistribution);
    }, 100);

    // Ne pas afficher le graphique "par jour de la semaine" si la période est un seul jour
    let isSingleDay = false;
    try {
        const range = ctx && ctx.dateRange ? ctx.dateRange : null;
        if (range && range.start && range.end) {
            isSingleDay = range.start === range.end;
        } else {
            // Par défaut, considérer "today" comme une période d'un seul jour
            isSingleDay = currentPeriod === 'today';
        }
    } catch (e) {
        isSingleDay = currentPeriod === 'today';
    }

    if (!isSingleDay) {
        setTimeout(() => {
            initializeDailyChart(stats.dailyDistribution);
        }, 200);
    }
}

/**
 * Formate une durée en heures décimales vers format "Xh XX"
 * @param {number} hoursDecimal - Durée en heures décimales
 * @returns {string} Durée formatée
 */
function formatDuration(hoursDecimal) {
    if (!hoursDecimal || hoursDecimal <= 0) return '0h00';

    const hours = Math.floor(hoursDecimal);
    const minutes = Math.round((hoursDecimal - hours) * 60);

    const formattedHours = hours.toString().padStart(1, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');

    return `${formattedHours}h${formattedMinutes}`;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderTemporalStats,
        renderHourlyDistributionChart,
        renderDailyDistributionChart,
        postRenderTemporalStats
    };
} else {
    window.TemporalStatsRenderer = {
        renderTemporalStats,
        renderHourlyDistributionChart,
        renderDailyDistributionChart,
        postRenderTemporalStats
    };
}

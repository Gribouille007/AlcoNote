// Heatmap Calendar Renderer - AlcoNote PWA
// Renders a GitHub-style contribution heatmap for alcohol consumption

const HeatmapStatsRenderer = {
    /**
     * Render the heatmap calendar section
     * @param {Object} stats - From HeatmapStatsCalculator
     * @returns {HTMLElement}
     */
    renderHeatmapStats(stats) {
        const section = document.createElement('div');
        section.className = 'stats-section heatmap-section';

        if (!stats || !stats.weeks || !stats.weeks.length) {
            section.innerHTML = `
                <div class="section-header"><h3>Calendrier de consommation</h3></div>
                <div class="empty-message">Pas assez de données pour afficher le calendrier.</div>
            `;
            return section;
        }

        const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

        section.innerHTML = `
            <div class="heatmap-summary">
                <span class="heatmap-stat">${stats.activeDays} jour${stats.activeDays > 1 ? 's' : ''} actif${stats.activeDays > 1 ? 's' : ''}</span>
                <span class="heatmap-stat-sep">•</span>
                <span class="heatmap-stat">${stats.totalDays} jours au total</span>
            </div>
            <div class="heatmap-scroll-wrapper">
                <div class="heatmap-grid" id="heatmap-grid">
                    <div class="heatmap-day-labels">
                        ${dayLabels.map(d => `<div class="heatmap-day-label">${d}</div>`).join('')}
                    </div>
                    <div class="heatmap-weeks">
                        ${stats.weeks.map(week => `
                            <div class="heatmap-week">
                                ${week.map(day => {
                                    const level = getHeatLevel(day.alcoholGrams, stats.maxAlcohol);
                                    const tooltip = day.inRange
                                        ? `${formatDate(day.date)} : ${day.drinkCount} verre${day.drinkCount !== 1 ? 's' : ''} (${Math.round(day.alcoholGrams)}g)`
                                        : '';
                                    return `<div class="heatmap-cell level-${level}${!day.inRange ? ' out-of-range' : ''}"
                                                 title="${tooltip}"
                                                 data-date="${day.date}"></div>`;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="heatmap-legend">
                <span class="heatmap-legend-label">Moins</span>
                <div class="heatmap-cell level-0"></div>
                <div class="heatmap-cell level-1"></div>
                <div class="heatmap-cell level-2"></div>
                <div class="heatmap-cell level-3"></div>
                <div class="heatmap-cell level-4"></div>
                <span class="heatmap-legend-label">Plus</span>
            </div>
        `;

        return section;
    },

    postRenderHeatmapStats() {
        // No chart to init — pure CSS grid
    }
};

function getHeatLevel(alcoholGrams, maxAlcohol) {
    if (alcoholGrams <= 0) return 0;
    if (maxAlcohol <= 0) return 0;
    const ratio = alcoholGrams / maxAlcohol;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
}

function formatDate(dateStr) {
    try {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
}

window.HeatmapStatsRenderer = HeatmapStatsRenderer;

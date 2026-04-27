// Composant de rendu pour les statistiques de boissons individuelles - AlcoNote PWA

/**
 * Rend les statistiques des boissons individuelles
 * @param {Object} drinkStats - Statistiques des boissons individuelles
 * @returns {HTMLElement} Section des statistiques de boissons
 */
async function renderIndividualDrinkStats(drinkStats) {
    if (!drinkStats || Object.keys(drinkStats).length === 0) {
        return null;
    }

    // Fetch all ratings for display
    let ratingsMap = {};
    try {
        const ratings = await dbManager.getAllRatings();
        ratings.forEach(r => { ratingsMap[r.drinkName] = r.rating; });
    } catch (e) {
        console.warn('Could not load drink ratings:', e);
    }

    function renderStars(rating) {
        if (!rating) return '';
        let html = '<span class="star-rating-readonly">';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="star${i <= rating ? ' active' : ''}">&#9733;</span>`;
        }
        html += '</span>';
        return html;
    }

    const section = document.createElement('div');
    section.className = 'stats-section';
    section.innerHTML = `
        <h3>Top 10 des boissons</h3>
        <div class="drink-stats">
            ${Object.entries(drinkStats).map(([name, stats], index) => `
                <div class="drink-stat-item">
                    <div class="drink-rank">${index + 1}</div>
                    <div class="drink-info">
                        <div class="drink-name">${name} ${renderStars(ratingsMap[name])}</div>
                        <div class="drink-details">
                            ${stats.count} fois • ${(stats.totalVolume / 100).toFixed(1)}L total
                            ${stats.lastConsumed ? ` • Dernière: ${Utils.formatDate(stats.lastConsumed)}` : ''}
                        </div>
                    </div>
                    <div class="drink-count">${stats.count}</div>
                </div>
            `).join('')}
        </div>
    `;

    return section;
}

/**
 * Post-traitement après rendu
 * @param {Object} drinkStats - Statistiques des boissons individuelles
 */
function postRenderIndividualDrinkStats(drinkStats) {
    // Aucun post-traitement spécial requis pour les statistiques de boissons
    console.log('Individual drink stats rendered successfully');
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderIndividualDrinkStats,
        postRenderIndividualDrinkStats
    };
} else {
    window.DrinksStatsRenderer = {
        renderIndividualDrinkStats,
        postRenderIndividualDrinkStats
    };
}

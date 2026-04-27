// Composant de rendu pour les statistiques de catégories - AlcoNote PWA

/**
 * Rend les statistiques de catégories
 * @param {Object} categories - Statistiques de catégories calculées
 * @returns {HTMLElement} Section des statistiques de catégories
 */
function renderCategoryStats(categories) {
    if (!categories || Object.keys(categories).length === 0) {
        return null;
    }
    
    const section = document.createElement('div');
    section.className = 'stats-section';
    section.innerHTML = `
        <h3>Analyse par catégorie</h3>
        <div class="category-stats">
            ${Object.entries(categories).map(([name, stats]) => `
                <div class="category-stat-card">
                    <h4>${name}</h4>
                    <div class="category-details">
                        <div class="stat-row">
                            <span>Consommations:</span>
                            <strong>${stats.count}</strong>
                        </div>
                        <div class="stat-row">
                            <span>Volume total:</span>
                            <strong>${(stats.volume / 100).toFixed(1)}L</strong>
                        </div>
                        <div class="stat-row">
                            <span>Volume moyen:</span>
                            <strong>${(stats.avgVolume / 100).toFixed(1)}L</strong>
                        </div>
                        ${stats.avgAlcoholContent > 0 ? `
                        <div class="stat-row">
                            <span>Degré moyen:</span>
                            <strong>${stats.avgAlcoholContent}%</strong>
                        </div>
                        ` : ''}
                        <div class="stat-row">
                            <span>Boisson préférée:</span>
                            <strong>${stats.favoriteDrink}</strong>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    return section;
}

/**
 * Post-traitement après rendu
 * @param {Object} categories - Statistiques de catégories
 */
function postRenderCategoryStats(categories) {
    // Aucun post-traitement spécial requis pour les statistiques de catégories
    console.log('Category stats rendered successfully');
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderCategoryStats,
        postRenderCategoryStats
    };
} else {
    window.CategoryStatsRenderer = {
        renderCategoryStats,
        postRenderCategoryStats
    };
}

// Composant de rendu pour les statistiques générales - AlcoNote PWA
// Ce module génère l'affichage HTML des statistiques générales

/**
 * Rend les statistiques générales
 * @param {Object} stats - Statistiques générales calculées
 * @param {Object} options - Options de rendu
 * @returns {string} HTML des statistiques générales
 */
function renderGeneralStats(stats, options = {}) {
    console.log('Rendering general stats:', stats);

    if (!stats) {
        return '<div class="error-message">Erreur lors du chargement des statistiques générales</div>';
    }

    return `
        <div class="stats-section">
            <h3>Statistiques générales</h3>
            ${renderStatsGrid(stats, options)}
        </div>
        ${renderCategoryDistribution(stats.categoryDistribution)}
    `;
}

/**
 * Rend la grille des statistiques principales
 * @param {Object} stats - Statistiques générales
 * @returns {string} HTML de la grille
 */
function renderStatsGrid(stats, options = {}) {
    const period = options.currentPeriod || 'today';
    const cards = [];

    const pushCard = (valueHTML, label, comparisonKey, tooltip = '') => {
        const comp = stats.comparison && stats.comparison[comparisonKey];

        // Enhanced comparison display with icons
        let changeHTML = '';
        if (comp !== null && comp !== undefined && comp !== 0) {
            const absChange = Math.abs(comp);
            let icon = '';
            let trend = '';

            if (comp > 0) {
                icon = '📈';
                trend = 'en hausse';
            } else {
                icon = '📉';
                trend = 'en baisse';
            }

            // Contextual period name
            let periodName = 'période précédente';
            if (period === 'today') periodName = 'hier';
            else if (period === 'week') periodName = 'semaine dernière';
            else if (period === 'month') periodName = 'mois dernier';
            else if (period === 'year') periodName = 'année dernière';

            changeHTML = `
                <div class="stat-change ${comp >= 0 ? 'positive' : 'negative'}" 
                     title="${icon} ${absChange}% ${trend} par rapport à la ${periodName}">
                    ${icon} ${comp >= 0 ? '+' : ''}${comp}%
                </div>
            `;
        }

        const tooltipAttr = tooltip ? `data-tooltip="${tooltip}"` : '';

        cards.push(`
            <div class="stat-card" ${tooltipAttr}>
                <div class="stat-value">${valueHTML}</div>
                <div class="stat-label">${label}</div>
                ${changeHTML}
            </div>
        `);
    };

    // Toujours pertinents avec tooltips
    pushCard(`${stats.totalDrinks}`, 'Boissons consommées', 'totalDrinks',
        'Nombre total de boissons enregistrées pendant cette période');
    pushCard(`${stats.totalSessions}`, 'Sessions', 'totalSessions',
        'Sessions de consommation (regroupées si boissons espacées de moins de 4h)');
    pushCard(`${(stats.totalVolume / 100).toFixed(2)}L`, 'Volume total', 'totalVolume',
        'Volume total de liquide consommé (toutes boissons confondues)');
    pushCard(`${stats.totalAlcohol}g`, 'Alcool pur', 'totalAlcohol',
        'Quantité d\'alcool pur consommé (éthanol)');
    pushCard(`${stats.uniqueDrinks}`, 'Boissons différentes', 'uniqueDrinks',
        'Nombre de types de boissons différentes consommées');

    // Période-spécifique
    if (period === 'week') {
        // Semaine: jours sobres + boissons/jour
        pushCard(`${stats.soberDays}`, 'Jours sobres', 'soberDays',
            'Nombre de jours sans aucune consommation cette semaine');
        pushCard(`${stats.avgPerDay.toFixed(1)}`, 'Boissons/jour', 'avgPerDay',
            'Moyenne de boissons consommées par jour sur la semaine');
        // Pas de "boissons/semaine" redondant
    } else if (period === 'today') {
        // Jour: pas de jours sobres / pas de moyennes par jour/semaine
        // Rien à ajouter
    } else {
        // Mois/Année/Custom: jours sobres + moyennes jour et semaine
        if (typeof stats.soberDays === 'number') {
            pushCard(`${stats.soberDays}`, 'Jours sobres', 'soberDays',
                'Nombre de jours sans aucune consommation pendant cette période');
        }
        pushCard(`${stats.avgPerDay.toFixed(1)}`, 'Boissons/jour', 'avgPerDay',
            'Moyenne de boissons consommées par jour sur la période');
        pushCard(`${stats.avgPerWeek.toFixed(1)}`, 'Boissons/semaine', 'avgPerWeek',
            'Moyenne de boissons consommées par semaine (extrapolé)');
    }

    return `<div class="stats-grid">${cards.join('')}</div>`;
}


/**
 * Rend la distribution par catégorie
 * @param {Object} categories - Distribution par catégorie
 * @returns {string} HTML de la distribution
 */
function renderCategoryDistribution(categories) {
    if (!categories || Object.keys(categories).length === 0) {
        return '';
    }

    return `
        <div class="chart-container">
            <h4 class="chart-title">Répartition par catégorie</h4>
            <div class="chart-wrapper">
                <canvas id="category-chart"></canvas>
            </div>
        </div>
    `;
}

/**
 * Initialise le graphique de distribution des catégories
 * @param {Object} categories - Distribution par catégorie
 */
function initializeCategoryChart(categories) {
    const canvas = document.getElementById('category-chart');
    if (!canvas || !window.Chart) return;

    const ctx = canvas.getContext('2d');
    const labels = Object.keys(categories);
    const data = Object.values(categories);

    // Utilise les couleurs de l'ancien système pour maintenir la cohérence visuelle
    const colors = Utils.getChartColors(labels.length);

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Rend un message d'état vide
 * @param {string} message - Message à afficher
 * @returns {string} HTML du message vide
 */
function renderEmptyState(message = 'Aucune donnée disponible') {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">📊</div>
            <h3 class="empty-state-title">Aucune statistique</h3>
            <p class="empty-state-description">${message}</p>
        </div>
    `;
}

/**
 * Post-traitement après rendu (initialisation des graphiques, etc.)
 * @param {Object} stats - Statistiques générales
 */
function postRenderGeneralStats(stats) {
    // Initialisation du graphique de distribution des catégories
    if (stats.categoryDistribution) {
        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
            initializeCategoryChart(stats.categoryDistribution);
        }, 100);
    }

    // Animation des cartes de statistiques
    animateStatCards();
}

/**
 * Anime l'apparition des cartes de statistiques
 */
function animateStatCards() {
    const cards = document.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 50);
    });
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderGeneralStats,
        postRenderGeneralStats,
        renderEmptyState
    };
} else {
    // Pour utilisation dans le navigateur
    window.GeneralStatsRenderer = {
        renderGeneralStats,
        postRenderGeneralStats,
        renderEmptyState
    };
}

// Calculateur de statistiques par catégories - AlcoNote PWA
// Ce module calcule les statistiques par type de boisson

/**
 * Calcule les statistiques par catégorie de boisson
 * @param {Array} drinks - Liste des boissons
 * @param {Object} dateRange - Période {start, end}
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Statistiques par catégorie
 */
async function calculateCategoryStats(drinks, dateRange, options = {}) {
    console.log('Calculating category stats for', drinks.length, 'drinks');
    
    const categories = {};
    
    // Traitement de chaque boisson
    drinks.forEach(drink => {
        if (!categories[drink.category]) {
            categories[drink.category] = {
                name: drink.category,
                count: 0,
                volume: 0,
                alcoholContent: [],
                drinks: [],
                uniqueDrinks: new Set(),
                totalAlcohol: 0,
                sessions: 0,
                avgPrice: 0, // Pour extension future
                locations: new Set()
            };
        }
        
        const cat = categories[drink.category];
        cat.count++;
        
        // Volume total
        const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
        cat.volume += volumeInCL;
        
        // Degré d'alcool
        if (drink.alcoholContent) {
            cat.alcoholContent.push(drink.alcoholContent);
            cat.totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
        }
        
        // Boissons uniques dans cette catégorie
        cat.uniqueDrinks.add(drink.name);
        
        // Localisation si disponible
        if (drink.location && drink.location.address) {
            cat.locations.add(drink.location.address);
        }
        
        cat.drinks.push(drink);
    });
    
    // Calcul des moyennes et statistiques dérivées
    Object.keys(categories).forEach(categoryName => {
        const cat = categories[categoryName];
        
        // Volume moyen par boisson
        cat.avgVolume = Math.round((cat.volume / cat.count) * 10) / 10;
        
        // Degré d'alcool moyen
        cat.avgAlcoholContent = cat.alcoholContent.length > 0 ? 
            Math.round((cat.alcoholContent.reduce((sum, degree) => sum + degree, 0) / cat.alcoholContent.length) * 10) / 10 : 0;
        
        // Alcool total arrondi
        cat.totalAlcohol = Math.round(cat.totalAlcohol * 10) / 10;
        
        // Boisson la plus consommée dans cette catégorie
        const drinkCounts = {};
        cat.drinks.forEach(drink => {
            drinkCounts[drink.name] = (drinkCounts[drink.name] || 0) + 1;
        });
        
        const maxCount = Math.max(...Object.values(drinkCounts));
        cat.favoriteDrink = Object.keys(drinkCounts).find(drink =>
            drinkCounts[drink] === maxCount
        );
        
        // Nombre de boissons uniques
        cat.uniqueDrinksCount = cat.uniqueDrinks.size;
        
        // Nombre de lieux différents
        cat.locationsCount = cat.locations.size;
        
        // Pourcentage du total
        cat.percentage = Math.round((cat.count / drinks.length) * 100);
        
        // Nettoyage des Sets pour la sérialisation
        delete cat.uniqueDrinks;
        delete cat.locations;
    });
    
    // Tri par nombre de consommations (décroissant)
    const sortedCategories = Object.values(categories)
        .sort((a, b) => b.count - a.count);
    
    // Analyse des tendances
    const trends = analyzeCategoryTrends(sortedCategories, drinks);
    
    return {
        categories: Object.fromEntries(sortedCategories.map(cat => [cat.name, cat])),
        sortedCategories,
        totalCategories: sortedCategories.length,
        dominantCategory: sortedCategories[0]?.name || null,
        trends
    };
}

/**
 * Analyse les tendances par catégorie
 * @param {Array} categories - Liste des catégories triées
 * @param {Array} drinks - Liste des boissons
 * @returns {Object} Tendances identifiées
 */
function analyzeCategoryTrends(categories, drinks) {
    const trends = {
        mostPopular: null,
        mostAlcoholic: null,
        mostVoluminous: null,
        mostDiverse: null,
        balanced: false,
        concentrated: false
    };
    
    if (categories.length === 0) return trends;
    
    // Catégorie la plus populaire
    trends.mostPopular = categories[0].name;
    
    // Catégorie avec le plus haut degré d'alcool moyen
    const highestAlcohol = categories.reduce((max, cat) => 
        cat.avgAlcoholContent > max.avgAlcoholContent ? cat : max
    );
    trends.mostAlcoholic = highestAlcohol.name;
    
    // Catégorie avec le plus gros volume total
    const highestVolume = categories.reduce((max, cat) => 
        cat.volume > max.volume ? cat : max
    );
    trends.mostVoluminous = highestVolume.name;
    
    // Catégorie la plus diversifiée (plus de boissons différentes)
    const mostDiverse = categories.reduce((max, cat) => 
        cat.uniqueDrinksCount > max.uniqueDrinksCount ? cat : max
    );
    trends.mostDiverse = mostDiverse.name;
    
    // Consommation équilibrée (aucune catégorie > 60%)
    trends.balanced = categories[0].percentage <= 60;
    
    // Consommation concentrée (une catégorie > 80%)
    trends.concentrated = categories[0].percentage >= 80;
    
    return trends;
}

/**
 * Compare les catégories entre deux périodes
 * @param {Object} currentCategories - Catégories période courante
 * @param {Object} previousCategories - Catégories période précédente
 * @returns {Object} Comparaison des catégories
 */
function compareCategoryPeriods(currentCategories, previousCategories) {
    const comparison = {};
    
    Object.keys(currentCategories).forEach(categoryName => {
        const current = currentCategories[categoryName];
        const previous = previousCategories[categoryName];
        
        if (!previous) {
            // Nouvelle catégorie
            comparison[categoryName] = {
                status: 'new',
                change: 100
            };
        } else {
            // Calcul du changement
            const change = previous.count === 0 ? 
                (current.count > 0 ? 100 : 0) :
                Math.round(((current.count - previous.count) / previous.count) * 100);
            
            comparison[categoryName] = {
                status: change > 0 ? 'increased' : change < 0 ? 'decreased' : 'stable',
                change: change
            };
        }
    });
    
    // Catégories disparues
    Object.keys(previousCategories).forEach(categoryName => {
        if (!currentCategories[categoryName]) {
            comparison[categoryName] = {
                status: 'disappeared',
                change: -100
            };
        }
    });
    
    return comparison;
}

/**
 * Génère des recommandations basées sur les catégories
 * @param {Object} categoryStats - Statistiques des catégories
 * @returns {Array} Liste de recommandations
 */
function generateCategoryRecommendations(categoryStats) {
    const recommendations = [];
    const { categories, trends } = categoryStats;
    
    // Recommandation sur la diversité
    if (Object.keys(categories).length === 1) {
        recommendations.push({
            type: 'diversity',
            level: 'info',
            message: 'Vous ne consommez qu\'un seul type de boisson. Diversifier peut être intéressant.',
            action: 'Essayez d\'autres catégories'
        });
    }
    
    // Recommandation sur la concentration
    if (trends.concentrated) {
        const dominantCat = Object.values(categories)[0];
        recommendations.push({
            type: 'concentration',
            level: 'warning',
            message: `${dominantCat.percentage}% de votre consommation est de type "${dominantCat.name}".`,
            action: 'Considérez diversifier vos choix'
        });
    }
    
    // Recommandation sur l'alcool
    const highAlcoholCats = Object.values(categories)
        .filter(cat => cat.avgAlcoholContent > 15)
        .sort((a, b) => b.avgAlcoholContent - a.avgAlcoholContent);
    
    if (highAlcoholCats.length > 0) {
        recommendations.push({
            type: 'alcohol',
            level: 'caution',
            message: `Attention aux boissons fortement alcoolisées (${highAlcoholCats[0].name}: ${highAlcoholCats[0].avgAlcoholContent}%).`,
            action: 'Modérez la consommation de spiritueux'
        });
    }
    
    return recommendations;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateCategoryStats,
        analyzeCategoryTrends,
        compareCategoryPeriods,
        generateCategoryRecommendations
    };
} else {
    // Pour utilisation dans le navigateur
    window.CategoryStatsCalculator = {
        calculateCategoryStats,
        analyzeCategoryTrends,
        compareCategoryPeriods,
        generateCategoryRecommendations
    };
}

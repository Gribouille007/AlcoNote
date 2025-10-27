// Calculateur de statistiques par boissons individuelles - AlcoNote PWA
// Ce module calcule les statistiques pour chaque boisson spécifique

/**
 * Calcule les statistiques par boisson individuelle
 * @param {Array} drinks - Liste des boissons
 * @param {Object} dateRange - Période {start, end}
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Statistiques par boisson
 */
async function calculateDrinkStats(drinks, dateRange, options = {}) {
    console.log('Calculating individual drink stats for', drinks.length, 'drinks');
    
    const drinkStats = {};
    
    // Traitement de chaque boisson
    drinks.forEach(drink => {
        if (!drinkStats[drink.name]) {
            drinkStats[drink.name] = {
                name: drink.name,
                category: drink.category,
                count: 0,
                totalVolume: 0,
                avgVolume: 0,
                alcoholContent: drink.alcoholContent || 0,
                totalAlcohol: 0,
                lastConsumed: null,
                firstConsumed: null,
                dates: [],
                times: [],
                locations: new Set(),
                units: new Set(),
                quantities: []
            };
        }
        
        const stat = drinkStats[drink.name];
        stat.count++;
        
        // Volume
        const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
        stat.totalVolume += volumeInCL;
        stat.quantities.push(volumeInCL);
        
        // Alcool
        if (drink.alcoholContent) {
            stat.totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
        }
        
        // Dates et heures
        stat.dates.push(drink.date);
        stat.times.push(drink.time);
        
        // Unités utilisées
        stat.units.add(drink.unit);
        
        // Localisation
        if (drink.location && drink.location.address) {
            stat.locations.add(drink.location.address);
        }
        
        // Première et dernière consommation
        if (!stat.firstConsumed || drink.date < stat.firstConsumed) {
            stat.firstConsumed = drink.date;
        }
        if (!stat.lastConsumed || drink.date > stat.lastConsumed) {
            stat.lastConsumed = drink.date;
        }
    });
    
    // Calcul des statistiques dérivées
    Object.keys(drinkStats).forEach(drinkName => {
        const stat = drinkStats[drinkName];
        
        // Volume moyen
        stat.avgVolume = Math.round((stat.totalVolume / stat.count) * 10) / 10;
        
        // Alcool total arrondi
        stat.totalAlcohol = Math.round(stat.totalAlcohol * 10) / 10;
        
        // Fréquence (jours entre première et dernière consommation)
        if (stat.firstConsumed && stat.lastConsumed && stat.firstConsumed !== stat.lastConsumed) {
            const daysDiff = getDaysDifference(stat.firstConsumed, stat.lastConsumed);
            stat.frequency = daysDiff > 0 ? Math.round((stat.count / daysDiff) * 10) / 10 : 0;
        } else {
            stat.frequency = 0;
        }
        
        // Régularité (écart-type des intervalles entre consommations)
        stat.regularity = calculateRegularity(stat.dates);
        
        // Heure préférée
        stat.preferredTime = findMostCommonTime(stat.times);
        
        // Nombre de lieux différents
        stat.locationsCount = stat.locations.size;
        
        // Variabilité du volume (écart-type)
        stat.volumeVariability = calculateStandardDeviation(stat.quantities);
        
        // Nettoyage des Sets et arrays pour la sérialisation
        stat.locationsArray = Array.from(stat.locations);
        stat.unitsArray = Array.from(stat.units);
        delete stat.locations;
        delete stat.units;
        delete stat.quantities;
        delete stat.times;
    });
    
    // Tri par fréquence de consommation (décroissant)
    const sortedDrinks = Object.entries(drinkStats)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, options.limit || 20); // Limite par défaut à 20
    
    // Analyse des tendances
    const trends = analyzeDrinkTrends(sortedDrinks);
    
    return {
        drinks: Object.fromEntries(sortedDrinks),
        sortedDrinks: sortedDrinks.map(([name, stats]) => ({ name, ...stats })),
        totalUniqueDrinks: Object.keys(drinkStats).length,
        topDrink: sortedDrinks[0] ? sortedDrinks[0][1] : null,
        trends
    };
}

/**
 * Calcule la régularité de consommation d'une boisson
 * @param {Array} dates - Liste des dates de consommation
 * @returns {number} Score de régularité (0-100)
 */
function calculateRegularity(dates) {
    if (dates.length < 2) return 0;
    
    // Tri des dates
    const sortedDates = dates.sort();
    
    // Calcul des intervalles en jours
    const intervals = [];
    for (let i = 1; i < sortedDates.length; i++) {
        const interval = getDaysDifference(sortedDates[i-1], sortedDates[i]);
        intervals.push(interval);
    }
    
    if (intervals.length === 0) return 0;
    
    // Calcul de l'écart-type des intervalles
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Score de régularité inversé (plus l'écart-type est faible, plus c'est régulier)
    const maxStdDev = 30; // Écart-type maximum considéré
    const regularity = Math.max(0, 100 - (stdDev / maxStdDev) * 100);
    
    return Math.round(regularity);
}

/**
 * Trouve l'heure la plus commune de consommation
 * @param {Array} times - Liste des heures
 * @returns {string} Heure la plus commune
 */
function findMostCommonTime(times) {
    if (times.length === 0) return null;
    
    // Groupement par heure
    const hourCounts = {};
    times.forEach(time => {
        const hour = time.split(':')[0];
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    // Recherche de l'heure la plus fréquente
    const maxCount = Math.max(...Object.values(hourCounts));
    const mostCommonHour = Object.keys(hourCounts).find(hour => 
        hourCounts[hour] === maxCount
    );
    
    return `${mostCommonHour}h`;
}

/**
 * Calcule l'écart-type d'un tableau de nombres
 * @param {Array} numbers - Tableau de nombres
 * @returns {number} Écart-type
 */
function calculateStandardDeviation(numbers) {
    if (numbers.length < 2) return 0;
    
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    
    return Math.round(Math.sqrt(variance) * 10) / 10;
}

/**
 * Analyse les tendances des boissons
 * @param {Array} sortedDrinks - Boissons triées par popularité
 * @returns {Object} Tendances identifiées
 */
function analyzeDrinkTrends(sortedDrinks) {
    const trends = {
        mostPopular: null,
        mostRegular: null,
        mostAlcoholic: null,
        mostVoluminous: null,
        mostRecent: null,
        diversity: 'low'
    };
    
    if (sortedDrinks.length === 0) return trends;
    
    const drinks = sortedDrinks.map(([name, stats]) => stats);
    
    // Boisson la plus populaire
    trends.mostPopular = drinks[0].name;
    
    // Boisson la plus régulière
    const mostRegular = drinks.reduce((max, drink) => 
        drink.regularity > max.regularity ? drink : max
    );
    trends.mostRegular = mostRegular.name;
    
    // Boisson la plus alcoolisée
    const mostAlcoholic = drinks.reduce((max, drink) => 
        drink.alcoholContent > max.alcoholContent ? drink : max
    );
    trends.mostAlcoholic = mostAlcoholic.name;
    
    // Boisson avec le plus gros volume moyen
    const mostVoluminous = drinks.reduce((max, drink) => 
        drink.avgVolume > max.avgVolume ? drink : max
    );
    trends.mostVoluminous = mostVoluminous.name;
    
    // Boisson consommée le plus récemment
    const mostRecent = drinks.reduce((max, drink) => 
        drink.lastConsumed > max.lastConsumed ? drink : max
    );
    trends.mostRecent = mostRecent.name;
    
    // Évaluation de la diversité
    if (drinks.length >= 10) {
        trends.diversity = 'high';
    } else if (drinks.length >= 5) {
        trends.diversity = 'medium';
    } else {
        trends.diversity = 'low';
    }
    
    return trends;
}

/**
 * Génère des recommandations basées sur les boissons
 * @param {Object} drinkStats - Statistiques des boissons
 * @returns {Array} Liste de recommandations
 */
function generateDrinkRecommendations(drinkStats) {
    const recommendations = [];
    const { drinks, trends } = drinkStats;
    
    // Recommandation sur la diversité
    if (trends.diversity === 'low') {
        recommendations.push({
            type: 'diversity',
            level: 'info',
            message: 'Vous consommez peu de boissons différentes.',
            action: 'Essayez de nouvelles boissons pour diversifier'
        });
    }
    
    // Recommandation sur la boisson dominante
    const topDrink = Object.values(drinks)[0];
    if (topDrink && topDrink.count > Object.keys(drinks).length * 3) {
        recommendations.push({
            type: 'dominance',
            level: 'info',
            message: `"${topDrink.name}" représente une grande partie de votre consommation.`,
            action: 'Variez vos choix de temps en temps'
        });
    }
    
    // Recommandation sur l'alcool
    const highAlcoholDrinks = Object.values(drinks)
        .filter(drink => drink.alcoholContent > 20)
        .sort((a, b) => b.count - a.count);
    
    if (highAlcoholDrinks.length > 0) {
        recommendations.push({
            type: 'alcohol',
            level: 'caution',
            message: `Attention à "${highAlcoholDrinks[0].name}" (${highAlcoholDrinks[0].alcoholContent}% d'alcool).`,
            action: 'Consommez avec modération'
        });
    }
    
    return recommendations;
}

/**
 * Calcule la différence en jours entre deux dates (inclut début et fin)
 * @param {string} startDate - Date de début
 * @param {string} endDate - Date de fin
 * @returns {number} Nombre de jours
 */
function getDaysDifference(startDate, endDate) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = end - start;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateDrinkStats,
        calculateRegularity,
        analyzeDrinkTrends,
        generateDrinkRecommendations
    };
} else {
    // Pour utilisation dans le navigateur
    window.DrinkStatsCalculator = {
        calculateDrinkStats,
        calculateRegularity,
        analyzeDrinkTrends,
        generateDrinkRecommendations
    };
}

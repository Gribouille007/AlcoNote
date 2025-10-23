// Calculateur de statistiques générales - AlcoNote PWA
// Ce module calcule les statistiques de base : total boissons, volume, alcool, etc.

/**
 * Calcule les statistiques générales de consommation
 * @param {Array} drinks - Liste des boissons avec propriétés : id, name, category, quantity, unit, alcoholContent, date, time
 * @param {Object} dateRange - Période d'analyse {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'}
 * @param {Object} options - Options supplémentaires {currentPeriod?: string}
 * @returns {Object} Statistiques générales complètes incluant totaux, moyennes, sessions et comparaison
 */
async function calculateGeneralStats(drinks, dateRange, options = {}) {
    console.log('Calculating general stats for', drinks.length, 'drinks');
    
    // Statistiques de base
    const totalDrinks = drinks.length;
    let totalVolume = 0;
    let totalAlcohol = 0;
    const uniqueDrinks = new Set();
    const categories = {};
    
    // Traitement de chaque boisson
    drinks.forEach(drink => {
        // Conversion du volume en cL
        const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
        totalVolume += volumeInCL;
        
        // Calcul de l'alcool pur
        if (drink.alcoholContent) {
            totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
        }
        
        // Suivi des boissons uniques
        uniqueDrinks.add(drink.name);
        
        // Comptage par catégorie
        if (!categories[drink.category]) {
            categories[drink.category] = 0;
        }
        categories[drink.category]++;
    });
    
    // Calcul des moyennes
    const daysDiff = getDaysDifference(dateRange.start, dateRange.end) + 1;
    const avgPerDay = daysDiff > 0 ? totalDrinks / daysDiff : 0;
    const avgPerWeek = avgPerDay * 7;
    const avgPerMonth = avgPerDay * 30.44; // Moyenne de jours par mois
    
    // Calcul des sessions de consommation
    const sessions = calculateSessions(drinks);
    
    // Calcul des jours sobres
    const soberDays = await calculateSoberDays(dateRange);
    
    // Comparaison avec la période précédente
    const comparison = await calculatePeriodComparison(dateRange, options.currentPeriod);
    
    return {
        totalDrinks,
        totalVolume: Math.round(totalVolume * 10) / 10,
        totalAlcohol: Math.round(totalAlcohol * 10) / 10,
        totalSessions: sessions.length,
        uniqueDrinks: uniqueDrinks.size,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        avgPerWeek: Math.round(avgPerWeek * 10) / 10,
        avgPerMonth: Math.round(avgPerMonth * 10) / 10,
        soberDays,
        categoryDistribution: categories,
        comparison
    };
}

/**
 * Calcule les sessions de consommation
 * @param {Array} drinks - Liste des boissons
 * @returns {Array} Sessions de consommation
 */
function calculateSessions(drinks) {
    if (drinks.length === 0) return [];
    
    const sessions = [];
    let currentSession = null;
    const sessionGapHours = 4; // 4 heures d'écart définit une nouvelle session
    
    // Tri des boissons par date et heure
    const sortedDrinks = [...drinks].sort((a, b) => {
        const dateTimeA = new Date(`${a.date}T${a.time}`);
        const dateTimeB = new Date(`${b.date}T${b.time}`);
        return dateTimeA - dateTimeB;
    });
    
    sortedDrinks.forEach(drink => {
        const drinkDateTime = new Date(`${drink.date}T${drink.time}`);
        
        if (!currentSession || 
            (drinkDateTime - currentSession.endTime) > (sessionGapHours * 60 * 60 * 1000)) {
            // Nouvelle session
            currentSession = {
                startTime: drinkDateTime,
                endTime: drinkDateTime,
                drinks: [drink],
                duration: 0
            };
            sessions.push(currentSession);
        } else {
            // Ajout à la session courante
            currentSession.drinks.push(drink);
            currentSession.endTime = drinkDateTime;
            currentSession.duration = (currentSession.endTime - currentSession.startTime) / (1000 * 60 * 60); // heures
        }
    });
    
    return sessions.reverse(); // Plus récentes en premier
}

/**
 * Calcule la différence en jours entre deux dates
 * @param {string} startDate - Date de début
 * @param {string} endDate - Date de fin
 * @returns {number} Nombre de jours
 */
function getDaysDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calcule le nombre de jours sobres depuis la première boisson
 * @param {Object} dateRange - Période courante
 * @returns {number} Nombre de jours sobres
 */
async function calculateSoberDays(dateRange) {
    try {
        // Calcul des jours sobres strictement sur la période sélectionnée
        const start = dateRange.start;
        const end = dateRange.end;
        const daysDiff = getDaysDifference(start, end) + 1;

        // Récupération des boissons uniquement pour la période sélectionnée
        const drinksInRange = await dbManager.getDrinksByDateRange(start, end);

        // Comptage des jours avec au moins une consommation
        const drinkingDays = new Set(drinksInRange.map(d => d.date));

        // Jours sobres = jours totaux dans la période - jours avec consommation
        const soberDays = daysDiff - drinkingDays.size;
        return Math.max(0, soberDays);
    } catch (error) {
        console.error('Error calculating sober days:', error);
        return 0;
    }
}

/**
 * Calcule la comparaison avec la période précédente
 * @param {Object} currentDateRange - Période courante
 * @param {string} currentPeriod - Type de période (today, week, month, year)
 * @returns {Object|null} Comparaison en pourcentages
 */
async function calculatePeriodComparison(currentDateRange, currentPeriod) {
    try {
        const previousDateRange = getPreviousPeriodRange(currentDateRange, currentPeriod);
        if (!previousDateRange) return null;
        
        // Récupération des boissons pour les deux périodes
        const currentDrinks = await dbManager.getDrinksByDateRange(currentDateRange.start, currentDateRange.end);
        const previousDrinks = await dbManager.getDrinksByDateRange(previousDateRange.start, previousDateRange.end);
        
        // Calcul des stats de base pour les deux périodes
        const currentStats = await calculateBasicStats(currentDrinks, currentDateRange);
        const previousStats = await calculateBasicStats(previousDrinks, previousDateRange);
        
        // Calcul des changements en pourcentage
        const comparison = {};
        const metrics = ['totalDrinks', 'totalVolume', 'totalAlcohol', 'totalSessions', 'uniqueDrinks', 'soberDays', 'avgPerDay', 'avgPerWeek'];
        
        metrics.forEach(metric => {
            if (previousStats[metric] === 0) {
                comparison[metric] = currentStats[metric] > 0 ? 100 : 0;
            } else {
                const change = ((currentStats[metric] - previousStats[metric]) / previousStats[metric]) * 100;
                comparison[metric] = Math.round(change);
            }
        });
        
        return comparison;
        
    } catch (error) {
        console.error('Error calculating period comparison:', error);
        return null;
    }
}

/**
 * Obtient la période précédente
 * @param {Object} currentRange - Période courante
 * @param {string} periodType - Type de période
 * @returns {Object|null} Période précédente
 */
function getPreviousPeriodRange(currentRange, periodType) {
    const currentStart = new Date(currentRange.start);
    const currentEnd = new Date(currentRange.end);
    
    let previousStart, previousEnd;
    
    switch (periodType) {
        case 'today':
            // Jour précédent
            previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - 1);
            previousEnd = new Date(previousStart);
            break;
            
        case 'week':
            // Semaine précédente (7 jours avant)
            previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(currentEnd);
            previousEnd.setDate(previousEnd.getDate() - 7);
            break;
            
        case 'month':
            // Mois précédent
            previousStart = new Date(currentStart);
            previousStart.setMonth(previousStart.getMonth() - 1);
            previousEnd = new Date(currentEnd);
            previousEnd.setMonth(previousEnd.getMonth() - 1);
            break;
            
        case 'year':
            // Année précédente
            previousStart = new Date(currentStart);
            previousStart.setFullYear(previousStart.getFullYear() - 1);
            previousEnd = new Date(currentEnd);
            previousEnd.setFullYear(previousEnd.getFullYear() - 1);
            break;
            
        default:
            // Pour les périodes personnalisées, calculer la durée équivalente
            const periodLength = getDaysDifference(currentRange.start, currentRange.end) + 1;
            previousEnd = new Date(currentStart);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousStart = new Date(previousEnd);
            previousStart.setDate(previousStart.getDate() - periodLength + 1);
    }
    
    return {
        start: previousStart.toISOString().split('T')[0],
        end: previousEnd.toISOString().split('T')[0]
    };
}

/**
 * Calcule les statistiques de base pour une période
 * @param {Array} drinks - Liste des boissons
 * @param {Object} dateRange - Période
 * @returns {Object} Statistiques de base
 */
async function calculateBasicStats(drinks, dateRange) {
    let totalVolume = 0;
    let totalAlcohol = 0;
    const uniqueDrinks = new Set();
    const sessions = calculateSessions(drinks);
    
    drinks.forEach(drink => {
        const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
        totalVolume += volumeInCL;
        
        if (drink.alcoholContent) {
            totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
        }
        
        uniqueDrinks.add(drink.name);
    });
    
    const daysDiff = getDaysDifference(dateRange.start, dateRange.end) + 1;
    const avgPerDay = daysDiff > 0 ? drinks.length / daysDiff : 0;
    const avgPerWeek = avgPerDay * 7;
    
    // Calcul des jours sobres pour cette période spécifique
    const drinksPerDay = {};
    drinks.forEach(drink => {
        drinksPerDay[drink.date] = true;
    });
    const soberDays = daysDiff - Object.keys(drinksPerDay).length;
    
    return {
        totalDrinks: drinks.length,
        totalVolume: Math.round(totalVolume * 10) / 10,
        totalAlcohol: Math.round(totalAlcohol * 10) / 10,
        totalSessions: sessions.length,
        uniqueDrinks: uniqueDrinks.size,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        avgPerWeek: Math.round(avgPerWeek * 10) / 10,
        soberDays: Math.max(0, soberDays)
    };
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateGeneralStats
    };
} else {
    // Pour utilisation dans le navigateur
    window.GeneralStatsCalculator = {
        calculateGeneralStats
    };
}

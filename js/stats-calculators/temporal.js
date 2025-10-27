// Calculateur de statistiques temporelles - AlcoNote PWA
// Ce module calcule les statistiques liées au temps : heures, jours, sessions

/**
 * Calcule les statistiques temporelles de consommation
 * @param {Array} drinks - Liste des boissons
 * @param {Object} dateRange - Période {start, end}
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Statistiques temporelles
 */
async function calculateTemporalStats(drinks, dateRange, options = {}) {
    console.log('Calculating temporal stats for', drinks.length, 'drinks');
    
    const hourlyDistribution = {};
    const dailyDistribution = {};
    const sessions = calculateSessions(drinks);

    // Sécurisation de la durée de période pour éviter les incohérences
    const daysDiff = typeof normalizeDaysForPeriod !== "undefined"
        ? normalizeDaysForPeriod(options.currentPeriod || "custom", dateRange.start, dateRange.end)
        : getDaysDifference(dateRange.start, dateRange.end);

    // Initialisation des distributions
    for (let i = 0; i < 24; i++) {
        hourlyDistribution[i] = 0;
    }
    for (let i = 0; i < 7; i++) {
        dailyDistribution[i] = 0;
    }

    // Analyse de chaque boisson
    drinks.forEach(drink => {
        // Distribution par heure
        const hour = parseInt(drink.time.split(':')[0]);
        if (hour >= 0 && hour <= 23) {
            hourlyDistribution[hour]++;
        }

        // Distribution par jour de la semaine (0=Dimanche, 1=Lundi, etc.)
        const dayOfWeek = new Date(drink.date).getDay();
        if (dayOfWeek >= 0 && dayOfWeek <= 6) {
            dailyDistribution[dayOfWeek]++;
        }
    });

    // Recherche des heures et jours de pointe
    const peakHour = findPeakValue(hourlyDistribution) ?? 0;
    
    // Corriger le calcul du jour de pointe en plaçant lundi en premier
    const adjustedDaily = reorderDaysMondayFirst(dailyDistribution);
    const peakDay = findPeakValue(adjustedDaily) ?? 0;

    // Statistiques des sessions
    const sessionStats = calculateSessionStats([...sessions]); // préserver copies avant tri

    return {
        hourlyDistribution,
        dailyDistribution: adjustedDaily,
        peakHour: parseInt(peakHour) || 0,
        peakDay: parseInt(peakDay) || 0,
        avgSessionDuration: sessionStats.avgDuration,
        avgTimeBetweenSessions: sessionStats.avgTimeBetween,
        totalSessions: sessions.length,
        totalDaysAnalyzed: daysDiff,
        firstDrink: drinks.length > 0 ? drinks[drinks.length - 1].date : null,
        lastDrink: drinks.length > 0 ? drinks[0].date : null,
        sessions: sessions.slice(0, 5) // Les 5 dernières sessions pour affichage
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
                duration: 0,
                totalVolume: 0,
                totalAlcohol: 0
            };
            sessions.push(currentSession);
        } else {
            // Ajout à la session courante
            currentSession.drinks.push(drink);
            currentSession.endTime = drinkDateTime;
            currentSession.duration = (currentSession.endTime - currentSession.startTime) / (1000 * 60 * 60); // heures
        }
    });
    
    // Calcul des totaux pour chaque session
    sessions.forEach(session => {
        session.drinks.forEach(drink => {
            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            session.totalVolume += volumeInCL;
            
            if (drink.alcoholContent) {
                session.totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
            }
        });
        
        session.totalVolume = Math.round(session.totalVolume * 10) / 10;
        session.totalAlcohol = Math.round(session.totalAlcohol * 10) / 10;
    });
    
    return sessions.reverse(); // Plus récentes en premier
}

/**
 * Calcule les statistiques des sessions
 * @param {Array} sessions - Liste des sessions
 * @returns {Object} Statistiques des sessions
 */
function calculateSessionStats(sessions) {
    if (sessions.length === 0) {
        return {
            avgDuration: 0,
            avgTimeBetween: 0,
            avgDrinksPerSession: 0,
            longestSession: null,
            shortestSession: null
        };
    }

    // Durées des sessions (exclure les sessions de 0 durée)
    const sessionDurations = sessions
        .map(session => session.duration)
        .filter(duration => duration > 0);
    
    const avgDuration = sessionDurations.length > 0 ? 
        sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length : 0;

    // Trier par ordre chronologique avant calcul des écarts
    const chronological = [...sessions].sort((a, b) => a.startTime - b.startTime);
    const timeBetweenSessions = [];
    for (let i = 1; i < chronological.length; i++) {
        const timeDiff = (chronological[i].startTime - chronological[i-1].endTime) / (1000 * 60 * 60);
        if (timeDiff > 0) timeBetweenSessions.push(timeDiff);
    }
    
    const avgTimeBetween = timeBetweenSessions.length > 0 ?
        timeBetweenSessions.reduce((sum, time) => sum + time, 0) / timeBetweenSessions.length : 0;

    // Moyenne de boissons par session
    const avgDrinksPerSession = sessions.reduce((sum, session) => sum + session.drinks.length, 0) / sessions.length;

    // Session la plus longue et la plus courte
    const longestSession = sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0;
    const shortestSession = sessionDurations.length > 0 ? Math.min(...sessionDurations) : 0;

    return {
        avgDuration: Math.round(avgDuration * 10) / 10,
        avgTimeBetween: Math.round(avgTimeBetween * 10) / 10,
        avgDrinksPerSession: Math.round(avgDrinksPerSession * 10) / 10,
        longestSession: Math.round(longestSession * 10) / 10,
        shortestSession: Math.round(shortestSession * 10) / 10
    };
}

/**
 * Trouve la clé avec la valeur maximale dans un objet
 * @param {Object} distribution - Objet avec des valeurs numériques
 * @returns {string} Clé avec la valeur maximale
 */
function findPeakValue(distribution) {
    const maxValue = Math.max(...Object.values(distribution));
    return Object.keys(distribution).find(key => distribution[key] === maxValue);
}

/**
 * Analyse les patterns de consommation
 * @param {Array} drinks - Liste des boissons
 * @returns {Object} Patterns identifiés
 */
function analyzeConsumptionPatterns(drinks) {
    const patterns = {
        weekendDrinker: false,
        eveningDrinker: false,
        socialDrinker: false,
        regularDrinker: false
    };

    if (drinks.length === 0) return patterns;

    // Analyse weekend vs semaine
    let weekendDrinks = 0;
    let weekdayDrinks = 0;
    
    // Analyse par heure
    let eveningDrinks = 0; // 18h-23h
    let nightDrinks = 0;   // 23h-2h
    
    drinks.forEach(drink => {
        const dayOfWeek = new Date(drink.date).getDay();
        const hour = parseInt(drink.time.split(':')[0]);
        
        // Weekend (Vendredi soir, Samedi, Dimanche)
        if (dayOfWeek === 0 || dayOfWeek === 6 || (dayOfWeek === 5 && hour >= 18)) {
            weekendDrinks++;
        } else {
            weekdayDrinks++;
        }
        
        // Heures de consommation
        if (hour >= 18 && hour <= 23) {
            eveningDrinks++;
        } else if ((hour >= 23 && hour <= 23) || (hour >= 0 && hour <= 2)) {
            nightDrinks++;
        }
    });

    // Détermination des patterns
    patterns.weekendDrinker = weekendDrinks > weekdayDrinks * 1.5;
    patterns.eveningDrinker = eveningDrinks > drinks.length * 0.6;
    patterns.nightDrinker = nightDrinks > drinks.length * 0.3;
    
    // Régularité (au moins une boisson tous les 3 jours en moyenne)
    const firstDate = drinks[drinks.length - 1].date;
    const lastDate = drinks[0].date;
    const daySpan = getDaysDifference(firstDate, lastDate);
    patterns.regularDrinker = daySpan > 0 && (drinks.length / daySpan) >= (1 / 3);

    return patterns;
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

/**
 * Réordonne les jours pour commencer par lundi
 */
function reorderDaysMondayFirst(dailyDistribution) {
    const reordered = {};
    const order = [1, 2, 3, 4, 5, 6, 0]; // Lundi -> Dimanche
    order.forEach(i => {
        reordered[i] = dailyDistribution[i] ?? 0;
    });
    return reordered;
}

 // Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateTemporalStats,
        calculateSessions,
        analyzeConsumptionPatterns
    };
} else {
    // Pour utilisation dans le navigateur
    window.TemporalStatsCalculator = {
        calculateTemporalStats,
        calculateSessions,
        analyzeConsumptionPatterns
    };
}

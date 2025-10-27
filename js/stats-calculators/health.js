// Calculateur de statistiques de santé - AlcoNote PWA
// Ce module calcule les indicateurs liés à la santé : BAC, recommandations OMS, etc.

/**
 * Calcule les statistiques de santé et recommandations OMS
 * @param {Array} drinks - Liste des boissons avec propriétés alcoholContent, quantity, unit, date
 * @param {Object} dateRange - Période d'analyse {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'}
 * @param {Object} options - Options supplémentaires {includeBAC?: boolean, settings?: Object}
 * @returns {Object} Statistiques de santé : alcool total/hebdomadaire, comparaison OMS, estimation BAC
 */
async function calculateHealthStats(drinks, dateRange, options = {}) {
    console.log('Calculating health stats for', drinks.length, 'drinks');
    
    // Récupération des paramètres utilisateur pour calculs personnalisés
    let settings = options.settings;
    if (!settings && typeof window !== 'undefined' && window.dbManager) {
        try {
            settings = await window.dbManager.getAllSettings();
        } catch (error) {
            console.warn('Could not get settings from dbManager:', error);
            settings = {};
        }
    } else if (!settings) {
        settings = {};
    }
    
    const userWeight = settings.userWeight; // en kg, requis pour calcul BAC
    const userGender = settings.userGender; // 'male'/'female', influence coef. élimination
    
    let totalAlcoholGrams = 0;
    const dailyAlcohol = {};
    const weeklyAlcoholByWeek = {};
    
    // Calcul de l'alcool par jour et par semaine
    drinks.forEach(drink => {
        const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
        if (drink.alcoholContent) {
            const alcoholGrams = Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
            totalAlcoholGrams += alcoholGrams;
            
            // Par jour
            if (!dailyAlcohol[drink.date]) {
                dailyAlcohol[drink.date] = 0;
            }
            dailyAlcohol[drink.date] += alcoholGrams;
            
            // Par semaine (numéro de semaine)
            const weekNumber = getWeekNumber(new Date(drink.date));
            if (!weeklyAlcoholByWeek[weekNumber]) {
                weeklyAlcoholByWeek[weekNumber] = 0;
            }
            weeklyAlcoholByWeek[weekNumber] += alcoholGrams;
        }
    });
    
    // Calcul de la moyenne hebdomadaire
    const daysDiff = typeof normalizeDaysForPeriod !== "undefined"
        ? normalizeDaysForPeriod("custom", dateRange.start, dateRange.end)
        : getDaysDifference(dateRange.start, dateRange.end);
    // Si la période est inférieure à 7 jours, éviter l'extrapolation incohérente
    const weeklyAlcoholAvg = daysDiff >= 7 ? (totalAlcoholGrams / daysDiff) * 7 : totalAlcoholGrams;
    
    // Comparaison avec les recommandations OMS
    const whoRecommendation = getWHORecommendation(userGender) || 140; // Défaut 140g si non défini
    const whoComparison = whoRecommendation > 0 ? (weeklyAlcoholAvg / whoRecommendation) * 100 : null;
    
    // Estimation du BAC pour la dernière session
    // Utiliser la dernière consommation de la période pour un BAC cohérent
    const lastDrinkDate = drinks.length > 0 ? new Date(drinks[drinks.length - 1].date) : new Date();
    const bacEstimation = await calculateCurrentBAC(userWeight, userGender, drinks, lastDrinkDate);
    
    // Analyse des risques
    const riskAnalysis = analyzeHealthRisks(weeklyAlcoholAvg, dailyAlcohol, userGender);
    
    // Calcul des jours de dépassement des seuils
    const exceedanceDays = calculateExceedanceDays(dailyAlcohol, userGender);
    
    return {
        totalAlcoholGrams: Math.round(totalAlcoholGrams * 10) / 10,
        weeklyAlcohol: Math.round(weeklyAlcoholAvg * 10) / 10,
        whoRecommendation,
        whoComparison: whoComparison ? Math.round(whoComparison) : null,
        bacEstimation,
        riskAnalysis,
        exceedanceDays,
        dailyAlcohol,
        weeklyByWeek: weeklyAlcoholByWeek,
        userProfile: {
            weight: userWeight,
            gender: userGender,
            configured: !!(userWeight && userGender)
        }
    };
}

/**
 * Calcule l'estimation actuelle du BAC
 * @param {number} userWeight - Poids de l'utilisateur
 * @param {string} userGender - Sexe de l'utilisateur
 * @param {Array} drinks - Liste des boissons
 * @returns {Object|null} Estimation du BAC
 */
async function calculateCurrentBAC(userWeight, userGender, drinks, referenceDate = new Date()) {
    if (!userWeight || !userGender) return null;
    
    try {
        const bacStats = await Utils.calculateBACStats(userWeight, userGender, referenceDate, drinks);
        return bacStats;
    } catch (error) {
        console.error('Error calculating BAC:', error);
        return null;
    }
}

/**
 * Analyse les risques pour la santé
 * @param {number} weeklyAlcohol - Alcool hebdomadaire en grammes
 * @param {Object} dailyAlcohol - Alcool par jour
 * @param {string} userGender - Sexe de l'utilisateur
 * @returns {Object} Analyse des risques
 */
function analyzeHealthRisks(weeklyAlcohol, dailyAlcohol, userGender) {
    const risks = {
        level: 'low',
        score: 0,
        factors: [],
        recommendations: []
    };
    
    // Seuils de risque selon l'OMS
    const weeklyLimits = {
        male: 210,   // 21 unités standard
        female: 140  // 14 unités standard
    };
    
    const dailyLimits = {
        male: 40,    // 4 unités standard
        female: 30   // 3 unités standard
    };
    
    const weeklyLimit = weeklyLimits[userGender] || weeklyLimits.male;
    const dailyLimit = dailyLimits[userGender] || dailyLimits.male;
    
    // Évaluation du risque hebdomadaire
    if (weeklyAlcohol > weeklyLimit * 1.5) {
        risks.level = 'high';
        risks.score += 40;
        risks.factors.push('Consommation hebdomadaire excessive');
        risks.recommendations.push('Réduisez significativement votre consommation hebdomadaire');
    } else if (weeklyAlcohol > weeklyLimit) {
        risks.level = 'medium';
        risks.score += 20;
        risks.factors.push('Consommation hebdomadaire au-dessus des recommandations');
        risks.recommendations.push('Essayez de respecter les recommandations hebdomadaires');
    }
    
    // Évaluation des pics quotidiens
    const highDays = Object.values(dailyAlcohol).filter(amount => amount > dailyLimit);
    if (highDays.length > 0) {
        const avgExcess = highDays.reduce((sum, amount) => sum + amount, 0) / highDays.length;
        
        if (avgExcess > dailyLimit * 2) {
            risks.level = 'high';
            risks.score += 30;
            risks.factors.push('Épisodes de consommation excessive');
            risks.recommendations.push('Évitez les épisodes de forte consommation');
        } else {
            risks.score += 15;
            risks.factors.push('Dépassements occasionnels des limites quotidiennes');
            risks.recommendations.push('Modérez les quantités lors des sorties');
        }
    }
    
    // Évaluation de la fréquence
    const drinkingDays = Object.keys(dailyAlcohol).length;
    const totalDays = Object.keys(dailyAlcohol).length > 0 ? Object.keys(dailyAlcohol).length : 7; // Adapter à la période réelle
    const frequency = drinkingDays / totalDays;
    
    if (frequency > 0.8) {
        risks.score += 20;
        risks.factors.push('Consommation très fréquente');
        risks.recommendations.push('Prévoyez des jours sans alcool');
    } else if (frequency > 0.5) {
        risks.score += 10;
        risks.factors.push('Consommation fréquente');
        risks.recommendations.push('Alternez avec des jours sans alcool');
    }
    
    // Détermination du niveau final
    if (risks.score >= 50) {
        risks.level = 'high';
    } else if (risks.score >= 25) {
        risks.level = 'medium';
    } else {
        risks.level = 'low';
    }
    
    // Recommandations générales
    if (risks.level === 'low') {
        risks.recommendations.push('Continuez à consommer avec modération');
    }
    
    return risks;
}

/**
 * Calcule les jours de dépassement des seuils
 * @param {Object} dailyAlcohol - Alcool par jour
 * @param {string} userGender - Sexe de l'utilisateur
 * @returns {Object} Statistiques de dépassement
 */
function calculateExceedanceDays(dailyAlcohol, userGender) {
    const dailyLimits = {
        male: 40,    // 4 unités standard
        female: 30   // 3 unités standard
    };
    
    const dailyLimit = dailyLimits[userGender] || dailyLimits.male;
    const heavyLimit = dailyLimit * 2; // Consommation excessive
    
    let moderateExceedance = 0;
    let heavyExceedance = 0;
    let maxDaily = 0;
    let maxDailyDate = null;
    
    Object.entries(dailyAlcohol).forEach(([date, amount]) => {
        if (amount > heavyLimit) {
            heavyExceedance++;
        } else if (amount > dailyLimit) {
            moderateExceedance++;
        }
        
        if (amount > maxDaily) {
            maxDaily = amount;
            maxDailyDate = date;
        }
    });
    
    return {
        moderateExceedance,
        heavyExceedance,
        totalExceedance: moderateExceedance + heavyExceedance,
        maxDaily: Math.round(maxDaily * 10) / 10,
        maxDailyDate,
        dailyLimit
    };
}

/**
 * Obtient les recommandations OMS selon le sexe
 * @param {string} gender - Sexe de l'utilisateur
 * @returns {number|null} Limite hebdomadaire en grammes
 */
function getWHORecommendation(gender) {
    const limits = {
        male: 210,   // 21 unités standard par semaine
        female: 140  // 14 unités standard par semaine
    };
    
    return limits[gender] || null;
}

/**
 * Obtient le numéro de semaine d'une date
 * @param {Date} date - Date
 * @returns {string} Numéro de semaine (année-semaine)
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${weekNum}`;
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
 * Génère des conseils de santé personnalisés
 * @param {Object} healthStats - Statistiques de santé
 * @returns {Array} Liste de conseils
 */
function generateHealthAdvice(healthStats) {
    const advice = [];
    const { riskAnalysis, whoComparison, bacEstimation } = healthStats;
    
    // Conseils basés sur le niveau de risque
    switch (riskAnalysis.level) {
        case 'high':
            advice.push({
                type: 'urgent',
                title: 'Attention à votre consommation',
                message: 'Votre consommation présente des risques pour votre santé.',
                action: 'Consultez un professionnel de santé'
            });
            break;
        case 'medium':
            advice.push({
                type: 'warning',
                title: 'Modérez votre consommation',
                message: 'Vous dépassez les recommandations de santé publique.',
                action: 'Réduisez progressivement vos quantités'
            });
            break;
        case 'low':
            advice.push({
                type: 'info',
                title: 'Consommation modérée',
                message: 'Votre consommation reste dans des limites acceptables.',
                action: 'Continuez à boire avec modération'
            });
            break;
    }
    
    // Conseils sur le BAC
    if (bacEstimation && bacEstimation.currentBAC > 500) { // > 0.5g/L
        advice.push({
            type: 'urgent',
            title: 'Taux d\'alcoolémie élevé',
            message: 'Votre taux d\'alcoolémie estimé dépasse la limite légale.',
            action: 'Ne conduisez pas et attendez la sobriété complète'
        });
    }
    
    return advice;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateHealthStats,
        analyzeHealthRisks,
        calculateCurrentBAC,
        generateHealthAdvice,
        getWHORecommendation
    };
} else {
    // Pour utilisation dans le navigateur
    window.HealthStatsCalculator = {
        calculateHealthStats,
        analyzeHealthRisks,
        calculateCurrentBAC,
        generateHealthAdvice,
        getWHORecommendation
    };
}

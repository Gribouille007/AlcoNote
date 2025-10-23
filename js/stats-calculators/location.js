// Calculateur de statistiques de localisation - AlcoNote PWA
// Ce module calcule les statistiques liées aux lieux de consommation

/**
 * Calcule les statistiques de localisation
 * @param {Array} drinks - Liste des boissons
 * @param {Object} dateRange - Période {start, end}
 * @param {Object} options - Options supplémentaires
 * @returns {Object} Statistiques de localisation
 */
async function calculateLocationStats(drinks, dateRange, options = {}) {
    console.log('Calculating location stats for', drinks.length, 'drinks');
    
    // Filtrer les boissons avec localisation
    const drinksWithLocation = drinks
        .filter(drink =>
            (drink.location && drink.location.latitude && drink.location.longitude) ||
            (drink.latitude != null && drink.longitude != null)
        )
        .map(drink => {
            // Normalize to nested location structure if only top-level coords are present
            if (drink.location && drink.location.latitude != null && drink.location.longitude != null) {
                return drink;
            }
            return {
                ...drink,
                location: {
                    latitude: drink.latitude,
                    longitude: drink.longitude,
                    address: drink.address || 'Localisation inconnue'
                }
            };
        });
    
    if (drinksWithLocation.length === 0) {
        return {
            hasLocationData: false,
            message: 'Aucune donnée de localisation disponible pour cette période.',
            stats: null
        };
    }
    
    // Groupement par lieu (avec précision réduite pour regrouper les lieux proches)
    const locationGroups = groupLocationsByProximity(drinksWithLocation);
    
    // Calcul des statistiques par lieu
    const locationStats = calculateLocationGroupStats(locationGroups);
    
    // Analyse des patterns géographiques
    const geoPatterns = analyzeGeographicPatterns(locationStats, drinksWithLocation);
    
    // Calcul des distances
    const distanceStats = calculateDistanceStats(locationStats);
    
    return {
        hasLocationData: true,
        message: `${drinksWithLocation.length} consommation${drinksWithLocation.length > 1 ? 's' : ''} géolocalisée${drinksWithLocation.length > 1 ? 's' : ''} trouvée${drinksWithLocation.length > 1 ? 's' : ''}.`,
        stats: {
            drinks: drinksWithLocation,
            totalLocations: locationStats.length,
            locationGroups: locationStats,
            topLocations: locationStats.slice(0, 10),
            geoPatterns,
            distanceStats,
            coverage: {
                withLocation: drinksWithLocation.length,
                withoutLocation: drinks.length - drinksWithLocation.length,
                percentage: Math.round((drinksWithLocation.length / drinks.length) * 100)
            }
        }
    };
}

/**
 * Groupe les lieux par proximité géographique
 * @param {Array} drinks - Boissons avec localisation
 * @param {number} precision - Précision de regroupement (défaut: 3 décimales)
 * @returns {Object} Groupes de lieux
 */
function groupLocationsByProximity(drinks, precision = 5) {
    const locationGroups = {};
    
    drinks.forEach(drink => {
        const lat = parseFloat(drink.location?.latitude ?? drink.latitude);
        const lng = parseFloat(drink.location?.longitude ?? drink.longitude);
        
        // Clé basée sur la précision pour regrouper les lieux proches
        const locationKey = `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
        
        if (!locationGroups[locationKey]) {
            locationGroups[locationKey] = {
                latitude: lat,
                longitude: lng,
                address: (drink.location?.address || drink.address) || 'Localisation inconnue',
                drinks: [],
                categories: new Set(),
                dates: new Set(),
                times: []
            };
        }
        
        const group = locationGroups[locationKey];
        group.drinks.push(drink);
        group.categories.add(drink.category);
        group.dates.add(drink.date);
        group.times.push(drink.time);
    });
    
    return locationGroups;
}

/**
 * Calcule les statistiques pour chaque groupe de lieux
 * @param {Object} locationGroups - Groupes de lieux
 * @returns {Array} Statistiques par lieu
 */
function calculateLocationGroupStats(locationGroups) {
    const locationStats = [];
    
    Object.entries(locationGroups).forEach(([key, group]) => {
        const stats = {
            id: key,
            latitude: group.latitude,
            longitude: group.longitude,
            address: group.address,
            count: group.drinks.length,
            categories: Array.from(group.categories),
            categoriesCount: group.categories.size,
            uniqueDates: group.dates.size,
            dateRange: {
                first: Math.min(...Array.from(group.dates)),
                last: Math.max(...Array.from(group.dates))
            },
            totalVolume: 0,
            totalAlcohol: 0,
            avgVolume: 0,
            avgAlcohol: 0,
            timeDistribution: {},
            dayDistribution: {},
            frequency: 0,
            drinks: group.drinks
        };
        
        // Calcul des volumes et alcool
        group.drinks.forEach(drink => {
            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            stats.totalVolume += volumeInCL;
            
            if (drink.alcoholContent) {
                stats.totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
            }
        });
        
        stats.avgVolume = Math.round((stats.totalVolume / stats.count) * 10) / 10;
        stats.avgAlcohol = Math.round((stats.totalAlcohol / stats.count) * 10) / 10;
        stats.totalVolume = Math.round(stats.totalVolume * 10) / 10;
        stats.totalAlcohol = Math.round(stats.totalAlcohol * 10) / 10;
        
        // Distribution temporelle
        group.times.forEach(time => {
            const hour = parseInt(time.split(':')[0]);
            stats.timeDistribution[hour] = (stats.timeDistribution[hour] || 0) + 1;
        });
        
        // Distribution par jour de la semaine
        group.drinks.forEach(drink => {
            const dayOfWeek = new Date(drink.date).getDay();
            stats.dayDistribution[dayOfWeek] = (stats.dayDistribution[dayOfWeek] || 0) + 1;
        });
        
        // Fréquence (visites par période)
        const daySpan = getDaysDifference(stats.dateRange.first, stats.dateRange.last) || 1;
        stats.frequency = Math.round((stats.uniqueDates / daySpan) * 100) / 100;
        
        // Heure préférée
        stats.preferredHour = findMostCommonHour(stats.timeDistribution);
        
        // Jour préféré
        stats.preferredDay = findMostCommonDay(stats.dayDistribution);
        
        locationStats.push(stats);
    });
    
    // Tri par nombre de consommations (décroissant)
    return locationStats.sort((a, b) => b.count - a.count);
}

/**
 * Analyse les patterns géographiques
 * @param {Array} locationStats - Statistiques par lieu
 * @param {Array} drinks - Toutes les boissons avec localisation
 * @returns {Object} Patterns géographiques
 */
function analyzeGeographicPatterns(locationStats, drinks) {
    const patterns = {
        mobility: 'low',
        favoriteLocation: null,
        locationDiversity: 'low',
        averageDistance: 0,
        maxDistance: 0,
        homeBase: null,
        explorationScore: 0
    };
    
    if (locationStats.length === 0) {
      return patterns;
    }
    
    // Lieu favori
    patterns.favoriteLocation = locationStats[0];
    
    // Diversité des lieux
    if (locationStats.length >= 10) {
        patterns.locationDiversity = 'high';
    } else if (locationStats.length >= 5) {
        patterns.locationDiversity = 'medium';
    } else {
        patterns.locationDiversity = 'low';
    }
    
    // Mobilité basée sur la répartition des consommations
    const topLocationPercentage = (locationStats[0].count / drinks.length) * 100;
    if (topLocationPercentage < 30) {
        patterns.mobility = 'high';
    } else if (topLocationPercentage < 60) {
        patterns.mobility = 'medium';
    } else {
        patterns.mobility = 'low';
    }
    
    // Calcul des distances si plusieurs lieux
    if (locationStats.length > 1) {
        const distances = calculateDistancesBetweenLocations(locationStats);
        patterns.averageDistance = distances.average;
        patterns.maxDistance = distances.max;
    }
    
    // Base principale (lieu le plus fréquenté)
    patterns.homeBase = locationStats[0];
    
    // Score d'exploration (nombre de lieux uniques / nombre total de consommations)
    patterns.explorationScore = Math.round((locationStats.length / drinks.length) * 100);
    
    return patterns;
}

/**
 * Calcule les statistiques de distance
 * @param {Array} locationStats - Statistiques par lieu
 * @returns {Object} Statistiques de distance
 */
function calculateDistanceStats(locationStats) {
    if (locationStats.length < 2) {
        return {
            averageDistance: 0,
            maxDistance: 0,
            minDistance: 0,
            totalDistance: 0,
            distanceVariability: 0
        };
    }
    
    const distances = [];
    const centerPoint = calculateCenterPoint(locationStats);
    
    // Calcul des distances depuis le centre
    locationStats.forEach(location => {
        const distance = calculateDistance(
            centerPoint.latitude, centerPoint.longitude,
            location.latitude, location.longitude
        );
        distances.push(distance);
    });
    
    const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);
    const averageDistance = totalDistance / distances.length;
    const maxDistance = Math.max(...distances);
    const minDistance = Math.min(...distances);
    
    // Variabilité (écart-type)
    const variance = distances.reduce((sum, dist) => sum + Math.pow(dist - averageDistance, 2), 0) / distances.length;
    const distanceVariability = Math.sqrt(variance);
    
    return {
        averageDistance: Math.round(averageDistance * 100) / 100,
        maxDistance: Math.round(maxDistance * 100) / 100,
        minDistance: Math.round(minDistance * 100) / 100,
        totalDistance: Math.round(totalDistance * 100) / 100,
        distanceVariability: Math.round(distanceVariability * 100) / 100,
        centerPoint
    };
}

/**
 * Calcule le point central des lieux
 * @param {Array} locations - Liste des lieux
 * @returns {Object} Point central
 */
function calculateCenterPoint(locations) {
    const totalLat = locations.reduce((sum, loc) => sum + loc.latitude, 0);
    const totalLng = locations.reduce((sum, loc) => sum + loc.longitude, 0);
    
    return {
        latitude: totalLat / locations.length,
        longitude: totalLng / locations.length
    };
}

/**
 * Calcule la distance entre deux points géographiques (formule de Haversine)
 * @param {number} lat1 - Latitude du point 1
 * @param {number} lng1 - Longitude du point 1
 * @param {number} lat2 - Latitude du point 2
 * @param {number} lng2 - Longitude du point 2
 * @returns {number} Distance en kilomètres
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convertit des degrés en radians
 * @param {number} degrees - Degrés
 * @returns {number} Radians
 */
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Calcule les distances entre tous les lieux
 * @param {Array} locations - Liste des lieux
 * @returns {Object} Statistiques de distance
 */
function calculateDistancesBetweenLocations(locations) {
    const distances = [];
    
    for (let i = 0; i < locations.length; i++) {
        for (let j = i + 1; j < locations.length; j++) {
            const distance = calculateDistance(
                locations[i].latitude, locations[i].longitude,
                locations[j].latitude, locations[j].longitude
            );
            distances.push(distance);
        }
    }
    
    if (distances.length === 0) {
        return { average: 0, max: 0, min: 0 };
    }
    
    return {
        average: Math.round((distances.reduce((sum, dist) => sum + dist, 0) / distances.length) * 100) / 100,
        max: Math.round(Math.max(...distances) * 100) / 100,
        min: Math.round(Math.min(...distances) * 100) / 100
    };
}

/**
 * Trouve l'heure la plus commune
 * @param {Object} timeDistribution - Distribution par heure
 * @returns {number} Heure la plus commune
 */
function findMostCommonHour(timeDistribution) {
    const maxCount = Math.max(...Object.values(timeDistribution));
    return parseInt(Object.keys(timeDistribution).find(hour => 
        timeDistribution[hour] === maxCount
    )) || 0;
}

/**
 * Trouve le jour le plus commun
 * @param {Object} dayDistribution - Distribution par jour
 * @returns {number} Jour le plus commun (0=Dimanche, 1=Lundi, etc.)
 */
function findMostCommonDay(dayDistribution) {
    const maxCount = Math.max(...Object.values(dayDistribution));
    return parseInt(Object.keys(dayDistribution).find(day => 
        dayDistribution[day] === maxCount
    )) || 0;
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
 * Génère des recommandations basées sur la localisation
 * @param {Object} locationStats - Statistiques de localisation
 * @returns {Array} Liste de recommandations
 */
function generateLocationRecommendations(locationStats) {
    const recommendations = [];
    
    if (!locationStats.hasLocationData) {
        recommendations.push({
            type: 'info',
            title: 'Activez la géolocalisation',
            message: 'Autorisez la géolocalisation pour analyser vos lieux de consommation.',
            action: 'Activez la géolocalisation dans les paramètres'
        });
        return recommendations;
    }
    
    const { geoPatterns, stats } = locationStats;
    
    // Recommandation sur la mobilité
    if (geoPatterns.mobility === 'low') {
        recommendations.push({
            type: 'info',
            title: 'Diversifiez vos lieux',
            message: 'Vous consommez principalement au même endroit.',
            action: 'Explorez de nouveaux lieux de temps en temps'
        });
    }
    
    // Recommandation sur la concentration
    if (stats.topLocations[0] && stats.topLocations[0].count > stats.drinks.length * 0.7) {
        recommendations.push({
            type: 'info',
            title: 'Lieu de prédilection',
            message: `${Math.round((stats.topLocations[0].count / stats.drinks.length) * 100)}% de vos consommations ont lieu à "${stats.topLocations[0].address}".`,
            action: 'Variez vos lieux de sortie'
        });
    }
    
    return recommendations;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateLocationStats,
        groupLocationsByProximity,
        analyzeGeographicPatterns,
        calculateDistance,
        generateLocationRecommendations
    };
} else {
    // Pour utilisation dans le navigateur
    window.LocationStatsCalculator = {
        calculateLocationStats,
        groupLocationsByProximity,
        analyzeGeographicPatterns,
        calculateDistance,
        generateLocationRecommendations
    };
}

// BAC Curve Data Generator - AlcoNote PWA
// Generates time-series data points for BAC projection chart

/**
 * Generate BAC curve data points for Chart.js visualization
 * @param {Array} drinks - Drinks array with date, time, quantity, unit, alcoholContent
 * @param {number} weightKg - User weight in kg
 * @param {string} gender - 'male' or 'female'
 * @param {Date} referenceTime - Current/reference time
 * @returns {Object|null} { points, peakBAC, peakTime, sobrietyTime, currentTimeIndex }
 */
function generateBACCurveData(drinks, weightKg, gender, referenceTime = new Date()) {
    if (!drinks || drinks.length === 0 || !weightKg || !gender) return null;

    const r = gender === 'female' ? 0.55 : 0.68;
    const eliminationRate = 0.15; // g/L per hour

    // Parse and sort drinks chronologically
    const sortedDrinks = drinks
        .map(drink => {
            if (!drink.date || !drink.time) return null;
            const [y, m, d] = drink.date.split('-').map(Number);
            const [h, min] = drink.time.split(':').map(Number);
            const date = new Date(y, m - 1, d, h, min);
            if (isNaN(date.getTime())) return null;

            const volumeCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            const alcoholGrams = Utils.calculateAlcoholGrams(volumeCL, drink.alcoholContent || 0);

            return { date, alcoholGrams };
        })
        .filter(d => d !== null && d.alcoholGrams > 0)
        .sort((a, b) => a.date - b.date);

    if (sortedDrinks.length === 0) return null;

    // Determine time range
    const firstDrinkTime = sortedDrinks[0].date;
    const lastDrinkTime = sortedDrinks[sortedDrinks.length - 1].date;

    // Calculate total alcohol to estimate sobriety time
    const totalAlcoholGrams = sortedDrinks.reduce((s, d) => s + d.alcoholGrams, 0);
    const peakBACEstimate = totalAlcoholGrams / (weightKg * r); // rough upper bound in g/L
    const estimatedSobrietyHours = peakBACEstimate / eliminationRate;

    // Start 15 min before first drink, end at projected sobriety or referenceTime+2h (whichever later)
    const startTime = new Date(firstDrinkTime.getTime() - 15 * 60 * 1000);
    const sobrietyEstimate = new Date(lastDrinkTime.getTime() + estimatedSobrietyHours * 3600 * 1000);
    const endTime = new Date(Math.max(sobrietyEstimate.getTime(), referenceTime.getTime() + 2 * 3600 * 1000));

    // Determine resolution based on time span
    const spanHours = (endTime - startTime) / (1000 * 60 * 60);
    let intervalMinutes;
    if (spanHours <= 24) {
        intervalMinutes = 5;
    } else if (spanHours <= 168) { // 7 days
        intervalMinutes = 15;
    } else if (spanHours <= 720) { // 30 days
        intervalMinutes = 60;
    } else {
        // Too long, skip chart
        return null;
    }

    const intervalMs = intervalMinutes * 60 * 1000;

    // Generate data points
    const points = [];
    let peakBAC = 0;
    let peakTime = startTime;
    let sobrietyTime = null;
    let currentTimeIndex = -1;
    let wasAboveZero = false;

    for (let t = startTime.getTime(); t <= endTime.getTime(); t += intervalMs) {
        const time = new Date(t);
        const bac = calculateBACAtTime(sortedDrinks, weightKg, r, eliminationRate, time);
        const bacMgL = Math.round(bac * 1000 * 100) / 100; // mg/L with 2 decimals

        points.push({ time, bac: bacMgL });

        if (bacMgL > peakBAC) {
            peakBAC = bacMgL;
            peakTime = time;
        }

        if (bacMgL > 0) wasAboveZero = true;
        if (wasAboveZero && bacMgL <= 0 && !sobrietyTime) {
            sobrietyTime = time;
        }

        // Find closest point to reference time
        if (currentTimeIndex === -1 && time >= referenceTime) {
            currentTimeIndex = points.length - 1;
        }
    }

    // If we never found the reference time (it's after all points)
    if (currentTimeIndex === -1) {
        currentTimeIndex = points.length - 1;
    }

    // Find legal limit crossing (when BAC drops below 500 mg/L after being above)
    let legalLimitCrossing = null;
    let wasAboveLegal = false;
    for (const p of points) {
        if (p.bac > 500) wasAboveLegal = true;
        if (wasAboveLegal && p.bac <= 500) {
            legalLimitCrossing = p.time;
            break;
        }
    }

    return {
        points,
        peakBAC,
        peakTime,
        sobrietyTime,
        legalLimitCrossing,
        currentTimeIndex
    };
}

/**
 * Calculate BAC at a specific time using stepwise Widmark simulation
 */
function calculateBACAtTime(sortedDrinks, weightKg, r, eliminationRate, targetTime) {
    let currentBAC = 0;
    let lastTime = null;

    for (const drink of sortedDrinks) {
        if (drink.date > targetTime) break; // Don't count future drinks

        if (lastTime) {
            const timeDiffHours = (drink.date - lastTime) / (1000 * 60 * 60);
            if (timeDiffHours > 0) {
                currentBAC -= eliminationRate * timeDiffHours;
                if (currentBAC < 0) currentBAC = 0;
            }
        }

        currentBAC += drink.alcoholGrams / (weightKg * r);
        lastTime = drink.date;
    }

    // Apply elimination from last drink to target time
    if (lastTime && targetTime > lastTime) {
        const finalHours = (targetTime - lastTime) / (1000 * 60 * 60);
        currentBAC -= eliminationRate * finalHours;
    }

    return Math.max(0, currentBAC);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateBACCurveData };
} else {
    window.generateBACCurveData = generateBACCurveData;
}

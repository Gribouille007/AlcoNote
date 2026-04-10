// Session Timeline Calculator - AlcoNote PWA
// Identifies drinking sessions and computes their properties for timeline visualization

const TimelineStatsCalculator = {
    /**
     * Calculate drinking sessions for timeline display
     * A session = group of drinks within 4 hours of each other
     * @param {Array} drinks - List of drinks
     * @param {Object} dateRange - {start, end} in YYYY-MM-DD
     * @param {Object} context - {currentPeriod, settings}
     * @returns {Object} Timeline data with sessions array
     */
    calculateTimelineStats(drinks, dateRange, context = {}) {
        if (!drinks.length) {
            return { sessions: [], totalSessions: 0 };
        }

        const SESSION_GAP_HOURS = 4;
        const SESSION_GAP_MS = SESSION_GAP_HOURS * 60 * 60 * 1000;

        // Parse and sort drinks by datetime
        const parsedDrinks = drinks.map(drink => {
            try {
                const [year, month, day] = drink.date.split('-').map(Number);
                const timeParts = (drink.time || '12:00').split(':').map(Number);
                const dateTime = new Date(year, month - 1, day, timeParts[0], timeParts[1] || 0);
                const volumeCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
                const alcoholGrams = drink.alcoholContent
                    ? Utils.calculateAlcoholGrams(volumeCL, drink.alcoholContent)
                    : 0;
                return { ...drink, dateTime, alcoholGrams };
            } catch {
                return null;
            }
        }).filter(Boolean).sort((a, b) => a.dateTime - b.dateTime);

        if (!parsedDrinks.length) {
            return { sessions: [], totalSessions: 0 };
        }

        // Group into sessions
        const sessions = [];
        let currentSession = {
            drinks: [parsedDrinks[0]],
            startTime: parsedDrinks[0].dateTime,
            endTime: parsedDrinks[0].dateTime,
            totalAlcohol: parsedDrinks[0].alcoholGrams,
            drinkCount: 1
        };

        for (let i = 1; i < parsedDrinks.length; i++) {
            const drink = parsedDrinks[i];
            const gap = drink.dateTime - currentSession.endTime;

            if (gap <= SESSION_GAP_MS) {
                // Same session
                currentSession.drinks.push(drink);
                currentSession.endTime = drink.dateTime;
                currentSession.totalAlcohol += drink.alcoholGrams;
                currentSession.drinkCount++;
            } else {
                // New session
                sessions.push(finishSession(currentSession));
                currentSession = {
                    drinks: [drink],
                    startTime: drink.dateTime,
                    endTime: drink.dateTime,
                    totalAlcohol: drink.alcoholGrams,
                    drinkCount: 1
                };
            }
        }
        sessions.push(finishSession(currentSession));

        // Find max alcohol for intensity scaling
        const maxAlcohol = Math.max(...sessions.map(s => s.totalAlcohol), 1);

        return {
            sessions: sessions.map(s => ({ ...s, intensity: s.totalAlcohol / maxAlcohol })),
            totalSessions: sessions.length,
            maxAlcohol,
            dateRange
        };
    }
};

function finishSession(session) {
    const durationMs = session.endTime - session.startTime;
    const durationHours = durationMs / (1000 * 60 * 60);
    return {
        ...session,
        durationMs,
        durationHours: Math.round(durationHours * 10) / 10,
        durationText: durationHours < 0.1 ? '< 10min'
            : durationHours < 1 ? `${Math.round(durationHours * 60)}min`
            : `${Math.round(durationHours * 10) / 10}h`
    };
}

window.TimelineStatsCalculator = TimelineStatsCalculator;

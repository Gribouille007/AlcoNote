// Heatmap Calendar Calculator - AlcoNote PWA
// Aggregates daily alcohol consumption for GitHub-style heatmap visualization

const HeatmapStatsCalculator = {
    /**
     * Calculate daily alcohol totals for heatmap display
     * @param {Array} drinks - List of drinks
     * @param {Object} dateRange - {start, end} in YYYY-MM-DD
     * @param {Object} context - {currentPeriod, settings}
     * @returns {Object} Heatmap data with daily totals and metadata
     */
    calculateHeatmapStats(drinks, dateRange, context = {}) {
        const dailyData = {};
        let maxAlcohol = 0;
        let totalDays = 0;
        let activeDays = 0;

        // Build map of date -> alcohol grams
        drinks.forEach(drink => {
            if (!drink.date) return;
            const date = drink.date;
            if (!dailyData[date]) {
                dailyData[date] = { alcoholGrams: 0, drinkCount: 0 };
            }
            const volumeCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            const alcoholGrams = drink.alcoholContent
                ? Utils.calculateAlcoholGrams(volumeCL, drink.alcoholContent)
                : 0;
            dailyData[date].alcoholGrams += alcoholGrams;
            dailyData[date].drinkCount++;
        });

        // Calculate range metadata
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const msPerDay = 24 * 60 * 60 * 1000;
        totalDays = Math.ceil((endDate - startDate) / msPerDay) + 1;

        // Find max and count active days
        Object.values(dailyData).forEach(day => {
            if (day.alcoholGrams > maxAlcohol) maxAlcohol = day.alcoholGrams;
            if (day.drinkCount > 0) activeDays++;
        });

        // Generate complete day array for the display period
        // For heatmap, show full weeks aligned to Monday
        const displayStart = new Date(startDate);
        // Align to previous Monday
        const dayOfWeek = displayStart.getDay();
        displayStart.setDate(displayStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

        const displayEnd = new Date(endDate);
        // Align to next Sunday
        const endDayOfWeek = displayEnd.getDay();
        if (endDayOfWeek !== 0) {
            displayEnd.setDate(displayEnd.getDate() + (7 - endDayOfWeek));
        }

        const weeks = [];
        let currentWeek = [];
        const cursor = new Date(displayStart);

        while (cursor <= displayEnd) {
            const dateStr = cursor.toISOString().split('T')[0];
            const isInRange = cursor >= startDate && cursor <= endDate;
            currentWeek.push({
                date: dateStr,
                alcoholGrams: dailyData[dateStr]?.alcoholGrams || 0,
                drinkCount: dailyData[dateStr]?.drinkCount || 0,
                inRange: isInRange
            });
            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        if (currentWeek.length > 0) weeks.push(currentWeek);

        return {
            weeks,
            dailyData,
            maxAlcohol,
            totalDays,
            activeDays,
            dateRange
        };
    }
};

window.HeatmapStatsCalculator = HeatmapStatsCalculator;

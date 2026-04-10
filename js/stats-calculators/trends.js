// Monthly Trends Calculator - AlcoNote PWA
// Aggregates monthly consumption data for trend line visualization

const TrendsStatsCalculator = {
    /**
     * Calculate monthly aggregated stats for trend chart
     * @param {Array} drinks - List of drinks
     * @param {Object} dateRange - {start, end} in YYYY-MM-DD
     * @param {Object} context - {currentPeriod, settings}
     * @returns {Object} Trends data with monthly series
     */
    calculateTrendsStats(drinks, dateRange, context = {}) {
        if (!drinks.length) {
            return { months: [], totalMonths: 0 };
        }

        const monthlyData = {};

        drinks.forEach(drink => {
            if (!drink.date) return;
            const monthKey = drink.date.substring(0, 7); // YYYY-MM
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    drinkCount: 0,
                    alcoholGrams: 0,
                    totalVolumeCL: 0,
                    sessionDates: new Set()
                };
            }
            const m = monthlyData[monthKey];
            m.drinkCount++;
            const volumeCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            m.totalVolumeCL += volumeCL;
            if (drink.alcoholContent) {
                m.alcoholGrams += Utils.calculateAlcoholGrams(volumeCL, drink.alcoholContent);
            }
            m.sessionDates.add(drink.date);
        });

        // Fill in empty months between start and end
        const startMonth = dateRange.start.substring(0, 7);
        const endMonth = dateRange.end.substring(0, 7);
        const allMonths = [];

        let [y, m] = startMonth.split('-').map(Number);
        const [ey, em] = endMonth.split('-').map(Number);

        while (y < ey || (y === ey && m <= em)) {
            const key = `${y}-${String(m).padStart(2, '0')}`;
            const data = monthlyData[key];
            allMonths.push({
                month: key,
                label: new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
                drinkCount: data ? data.drinkCount : 0,
                alcoholGrams: data ? Math.round(data.alcoholGrams * 10) / 10 : 0,
                totalVolumeCL: data ? Math.round(data.totalVolumeCL * 10) / 10 : 0,
                activeDays: data ? data.sessionDates.size : 0
            });
            m++;
            if (m > 12) { m = 1; y++; }
        }

        return {
            months: allMonths,
            totalMonths: allMonths.length
        };
    }
};

window.TrendsStatsCalculator = TrendsStatsCalculator;

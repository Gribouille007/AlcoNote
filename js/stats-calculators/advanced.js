// Advanced Analytics Calculator — AlcoNote PWA
// Computes: 7-day rolling average, hourly polar distribution, session
// duration histogram, inter-period sparkline comparisons.

const AdvancedStatsCalculator = (() => {
    'use strict';

    function toDate(str) {
        const [y, m, d] = str.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function diffDays(a, b) {
        return Math.round((toDate(b) - toDate(a)) / 86400000);
    }

    function alcoholGrams(drink) {
        try {
            const volumeCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            return Utils.calculateAlcoholGrams(volumeCL, drink.alcoholContent || 0);
        } catch { return 0; }
    }

    /**
     * 7-day rolling average of alcohol consumption (g)
     * Returns array of {date: YYYY-MM-DD, daily: g, rolling7: g, rolling30: g}
     */
    function computeRollingAverages(drinks, dateRange) {
        if (!drinks.length || !dateRange) return [];
        const byDate = new Map();
        for (const d of drinks) {
            if (!d.date) continue;
            byDate.set(d.date, (byDate.get(d.date) || 0) + alcoholGrams(d));
        }
        const total = diffDays(dateRange.start, dateRange.end) + 1;
        if (total <= 0) return [];
        // Cap at 365 days for performance
        const days = Math.min(total, 365);
        const arr = [];
        const startIdx = Math.max(0, total - days);
        for (let i = 0; i < days; i++) {
            const offset = startIdx + i;
            const day = new Date(toDate(dateRange.start).getTime() + offset * 86400000);
            const key = day.toISOString().slice(0, 10);
            arr.push({ date: key, daily: byDate.get(key) || 0 });
        }
        // Rolling windows
        for (let i = 0; i < arr.length; i++) {
            let sum7 = 0, sum30 = 0;
            const j7 = Math.max(0, i - 6);
            const j30 = Math.max(0, i - 29);
            for (let k = j7; k <= i; k++) sum7 += arr[k].daily;
            for (let k = j30; k <= i; k++) sum30 += arr[k].daily;
            arr[i].rolling7 = sum7 / (i - j7 + 1);
            arr[i].rolling30 = sum30 / (i - j30 + 1);
        }
        return arr;
    }

    /**
     * Hourly polar distribution — 24 slices, drink count per hour of day.
     */
    function computeHourlyPolar(drinks) {
        const hours = Array(24).fill(0);
        for (const d of drinks) {
            if (!d.time) continue;
            const h = parseInt(d.time.split(':')[0], 10);
            if (h >= 0 && h < 24) hours[h]++;
        }
        return hours;
    }

    /**
     * Session grouping + duration histogram.
     * Session = drinks on the same date OR within 4h gap.
     * Returns: {durationsMin: [], intensities: [], sessions: [...]}
     */
    function computeSessions(drinks) {
        if (!drinks.length) return { sessions: [], durationBuckets: [], intensityBuckets: [] };
        // Parse with timestamps
        const events = drinks.map(d => {
            if (!d.date || !d.time) return null;
            const [y, m, day] = d.date.split('-').map(Number);
            const [h, mi] = d.time.split(':').map(Number);
            return { ts: new Date(y, m - 1, day, h, mi).getTime(), grams: alcoholGrams(d) };
        }).filter(Boolean).sort((a, b) => a.ts - b.ts);

        const SESSION_GAP_MS = 4 * 3600 * 1000;
        const sessions = [];
        let cur = null;
        for (const ev of events) {
            if (!cur || ev.ts - cur.end > SESSION_GAP_MS) {
                if (cur) sessions.push(cur);
                cur = { start: ev.ts, end: ev.ts, count: 1, grams: ev.grams };
            } else {
                cur.end = ev.ts;
                cur.count++;
                cur.grams += ev.grams;
            }
        }
        if (cur) sessions.push(cur);

        // Histogram of session durations (in hours, 0.5h buckets up to 8h+)
        const durationBuckets = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // <1, 1-2, 2-3, ..., 7-8, 8+
        const intensityBuckets = [0, 0, 0, 0, 0, 0]; // 0-10g, 10-20g, 20-40g, 40-60g, 60-100g, 100+g
        for (const s of sessions) {
            const hours = (s.end - s.start) / 3600000;
            const dIdx = Math.min(8, Math.floor(hours));
            durationBuckets[dIdx]++;
            const g = s.grams;
            const iIdx = g < 10 ? 0 : g < 20 ? 1 : g < 40 ? 2 : g < 60 ? 3 : g < 100 ? 4 : 5;
            intensityBuckets[iIdx]++;
        }
        return { sessions, durationBuckets, intensityBuckets };
    }

    /**
     * Current period vs previous equivalent period comparison sparkline data.
     * Uses alcohol g per day.
     */
    async function computeInterPeriodComparison(drinks, dateRange, currentPeriod) {
        if (!dateRange || currentPeriod === 'all' || currentPeriod === 'today') return null;
        const len = diffDays(dateRange.start, dateRange.end) + 1;
        if (len <= 1 || len > 400) return null;

        const prevEnd = new Date(toDate(dateRange.start).getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - (len - 1) * 86400000);
        const prevStartStr = prevStart.toISOString().slice(0, 10);
        const prevEndStr = prevEnd.toISOString().slice(0, 10);

        let prevDrinks = [];
        try {
            prevDrinks = await dbManager.getDrinksByDateRange(prevStartStr, prevEndStr);
        } catch { return null; }

        const seriesFor = (list, startStr) => {
            const byDate = new Map();
            for (const d of list) byDate.set(d.date, (byDate.get(d.date) || 0) + alcoholGrams(d));
            const arr = [];
            for (let i = 0; i < len; i++) {
                const day = new Date(toDate(startStr).getTime() + i * 86400000).toISOString().slice(0, 10);
                arr.push(byDate.get(day) || 0);
            }
            return arr;
        };

        return {
            current: { label: 'Cette période', data: seriesFor(drinks, dateRange.start), range: dateRange },
            previous: { label: 'Période précédente', data: seriesFor(prevDrinks, prevStartStr),
                        range: { start: prevStartStr, end: prevEndStr } }
        };
    }

    async function calculateAdvancedStats(drinks, dateRange, context) {
        if (!drinks || !drinks.length) {
            return { rolling: [], polar: Array(24).fill(0), sessions: { sessions: [], durationBuckets: [], intensityBuckets: [] }, comparison: null };
        }
        const rolling = computeRollingAverages(drinks, dateRange);
        const polar = computeHourlyPolar(drinks);
        const sessions = computeSessions(drinks);
        const comparison = await computeInterPeriodComparison(drinks, dateRange, context?.currentPeriod);
        return { rolling, polar, sessions, comparison };
    }

    return { calculateAdvancedStats };
})();

window.AdvancedStatsCalculator = AdvancedStatsCalculator;

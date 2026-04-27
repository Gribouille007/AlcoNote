/* header-bac.js — purely presentational glue that fills #header-bac-slot.
 * It listens to the existing `drinkDataChanged` events emitted by app.js
 * and reads from the unchanged dbManager / Utils / geoManager APIs.
 * No business logic is added here; this only renders an existing value. */
(function () {
    'use strict';

    const SLOT_ID = 'header-bac-slot';
    let inFlight = false;

    function fmtBac(mgL) {
        if (!Number.isFinite(mgL) || mgL <= 0) return null;
        const v = Math.round(mgL);
        return v >= 1000 ? String(v) : String(v);
    }

    function renderEmpty(slot) {
        if (!slot) return;
        slot.innerHTML = '';
    }

    function renderValue(slot, mgL) {
        const v = fmtBac(mgL);
        if (!v) { renderEmpty(slot); return; }
        slot.innerHTML = '<span class="bac-pill" title="Taux d\'alcoolémie actuel (mg/L)">' + v + '</span>';
    }

    async function refresh() {
        if (inFlight) return;
        const slot = document.getElementById(SLOT_ID);
        if (!slot) return;
        if (typeof window.dbManager === 'undefined' ||
            typeof window.Utils === 'undefined' ||
            typeof window.Utils.calculateBACStats !== 'function') {
            return;
        }
        inFlight = true;
        try {
            const weight = parseFloat(await window.dbManager.getSetting('userWeight').catch(() => null));
            const gender = await window.dbManager.getSetting('userGender').catch(() => null);
            if (!Number.isFinite(weight) || weight <= 0) { renderEmpty(slot); return; }
            const allDrinks = await window.dbManager.getAllDrinks().catch(() => []);
            // Keep last 48h to keep the BAC calc cheap.
            const cutoff = Date.now() - 48 * 3600 * 1000;
            const recent = (allDrinks || []).filter(d => {
                const ts = d.timestamp || (d.date && d.time ? Date.parse(d.date + 'T' + d.time) : NaN);
                return Number.isFinite(ts) && ts >= cutoff;
            });
            const stats = await window.Utils.calculateBACStats(
                weight,
                gender || 'male',
                new Date(),
                recent
            );
            if (!stats) { renderEmpty(slot); return; }
            renderValue(slot, stats.currentBAC);
        } catch (err) {
            renderEmpty(slot);
        } finally {
            inFlight = false;
        }
    }

    function debounce(fn, ms) {
        let t = null;
        return function () {
            if (t) clearTimeout(t);
            t = setTimeout(fn, ms);
        };
    }
    const refreshDebounced = debounce(refresh, 250);

    function init() {
        refreshDebounced();
        window.addEventListener('drinkDataChanged', refreshDebounced);
        // Re-render every 5 minutes so decay is reflected without user action.
        setInterval(refreshDebounced, 5 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

/* proto-ui.js — purely presentational glue for the prototype-shape layout.
 *
 * Logic-preserving rules: this file does NOT mutate app state, hit any
 * API, or duplicate business logic. It only mirrors / reflects events
 * that app.js already emits or handles, and converts them to/from the
 * new visual elements (bottom nav, history filter pills, header date).
 *
 * Hooks tied to existing logic:
 *   - tab buttons (top + bottom) all carry data-tab — app.js binds them
 *     directly; we just keep .active in sync between top and bottom.
 *   - history-category-filter <select> — app.js reads its .value and
 *     listens to its 'change' event. The pill rail mirrors this select:
 *     pill click → set value on the select → dispatch 'change' so app.js
 *     re-runs its filter pipeline unchanged.
 *   - header date is decorative only; app.js never reads it.
 */
(function () {
    'use strict';

    /* ─── Header date ─────────────────────────────────────────────── */
    function updateHeaderDate() {
        const slot = document.getElementById('proto-header-date');
        if (!slot) return;
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        const d = new Date();
        slot.textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
    }

    /* ─── Bottom nav ↔ existing tab buttons ───────────────────────── */
    function syncTabActive() {
        // app.js toggles the `.active` class on its own tab buttons;
        // mirror that into the bottom nav clones (and vice-versa).
        const all = document.querySelectorAll('.tab-btn[data-tab]');
        let active = 'categories';
        all.forEach(btn => { if (btn.classList.contains('active')) active = btn.dataset.tab; });
        all.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === active));
    }

    function watchTabActivation() {
        // Observe the legacy `.tab-content.active` swap that app.js drives,
        // and reflect it onto the bottom-nav buttons.
        const obs = new MutationObserver(() => syncTabActive());
        document.querySelectorAll('.tab-content').forEach(el => {
            obs.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        // Also catch direct .active swaps on tab buttons themselves.
        document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
            obs.observe(btn, { attributes: true, attributeFilter: ['class'] });
        });
    }

    /* ─── History filter pills ↔ <select> ─────────────────────────── */
    function buildHistoryFilterPills() {
        const select = document.getElementById('history-category-filter');
        const rail = document.getElementById('history-filter-pills');
        if (!select || !rail) return;

        const render = () => {
            const current = select.value || '';
            rail.innerHTML = '';
            // "Tous" pill first
            const allPill = document.createElement('button');
            allPill.type = 'button';
            allPill.className = 'pill' + (current === '' ? ' active' : '');
            allPill.dataset.value = '';
            allPill.setAttribute('role', 'tab');
            allPill.setAttribute('aria-selected', current === '' ? 'true' : 'false');
            allPill.textContent = 'Tous';
            rail.appendChild(allPill);

            // One pill per <option>
            for (const opt of select.options) {
                if (!opt.value) continue;
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'pill' + (current === opt.value ? ' active' : '');
                pill.dataset.value = opt.value;
                pill.setAttribute('role', 'tab');
                pill.setAttribute('aria-selected', current === opt.value ? 'true' : 'false');
                const dot = document.createElement('span');
                dot.className = 'pill-dot';
                dot.style.color = catHueFor(opt.value);
                pill.appendChild(dot);
                pill.appendChild(document.createTextNode(opt.textContent));
                rail.appendChild(pill);
            }
        };

        // Click → write back to <select> + dispatch change so app.js reruns.
        rail.addEventListener('click', (ev) => {
            const target = ev.target.closest('.pill');
            if (!target) return;
            const next = target.dataset.value || '';
            if (select.value === next) return;
            select.value = next;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            render();
        });

        // Re-render whenever the legacy code mutates the <select>:
        // 1) on its own change events
        select.addEventListener('change', render);
        // 2) when categories are repopulated (app.js re-runs populate*)
        const obs = new MutationObserver(render);
        obs.observe(select, { childList: true });

        render();
    }

    function catHueFor(name) {
        // Mirror the design.css palette without re-declaring colors.
        switch ((name || '').toLowerCase()) {
            case 'bière':
            case 'biere':       return 'oklch(60% 0.16 80)';
            case 'vin':         return 'oklch(58% 0.18 15)';
            case 'spiritueux':  return 'oklch(60% 0.14 300)';
            case 'cocktail':    return 'oklch(55% 0.13 180)';
            default:            return 'oklch(58% 0.10 240)';
        }
    }

    /* ─── Boot ────────────────────────────────────────────────────── */
    function init() {
        // High-specificity hook for the proto stylesheet to win over legacy.
        document.documentElement.setAttribute('data-skin', 'proto');
        document.body.classList.add('proto-skin');
        updateHeaderDate();
        watchTabActivation();
        syncTabActive();
        buildHistoryFilterPills();
        // Refresh date at midnight (cheap, presentation only).
        setInterval(updateHeaderDate, 60 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

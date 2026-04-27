// Collapsible Section Utility for AlcoNote Statistics
// Wraps stat sections in expandable/collapsible islands with persistent state

const CollapsibleSection = (() => {
    const STORAGE_KEY = 'alconote-collapsed-sections';

    function getState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch {
            return {};
        }
    }

    function saveState(state) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('CollapsibleSection: failed to save state', e);
        }
    }

    function isCollapsed(sectionId) {
        return getState()[sectionId] === true;
    }

    function setCollapsed(sectionId, collapsed) {
        const state = getState();
        state[sectionId] = collapsed;
        saveState(state);
    }

    /**
     * Wrap a section element in a collapsible island
     * @param {HTMLElement} contentElement - The section content to wrap
     * @param {string} sectionId - Unique section identifier
     * @param {string} title - Display title for the section header
     * @param {Function} [onFirstExpand] - Callback fired once on first expand (for deferred postRender)
     * @returns {HTMLElement} The wrapped island element
     */
    function wrap(contentElement, sectionId, title, onFirstExpand) {
        const collapsed = isCollapsed(sectionId);
        let hasExpanded = !collapsed;

        const island = document.createElement('div');
        island.className = `stats-island${collapsed ? ' collapsed' : ''}`;
        island.dataset.sectionId = sectionId;

        const header = document.createElement('div');
        header.className = 'stats-island-header';
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', String(!collapsed));
        header.setAttribute('tabindex', '0');
        header.innerHTML = `
            <h3 class="stats-island-title">${title}</h3>
            <span class="stats-island-chevron" aria-hidden="true"></span>
        `;

        const content = document.createElement('div');
        content.className = 'stats-island-content';
        content.appendChild(contentElement);

        // Hide the inner section header to avoid duplicate titles
        const innerHeader = contentElement.querySelector('.section-header');
        if (innerHeader) {
            innerHeader.style.display = 'none';
        }
        // Also hide standalone h3 directly inside stats-section (general renderer pattern)
        const innerH3 = contentElement.querySelector('.stats-section > h3');
        if (innerH3) {
            innerH3.style.display = 'none';
        }

        if (!collapsed) {
            content.style.maxHeight = 'none';
        }

        island.appendChild(header);
        island.appendChild(content);

        function toggle() {
            const isCurrentlyCollapsed = island.classList.contains('collapsed');

            if (isCurrentlyCollapsed) {
                // Expanding
                island.classList.remove('collapsed');
                header.setAttribute('aria-expanded', 'true');
                // Measure content height for smooth animation
                content.style.maxHeight = content.scrollHeight + 'px';
                // After transition, set to none so dynamic content can grow
                const onEnd = () => {
                    content.style.maxHeight = 'none';
                    content.removeEventListener('transitionend', onEnd);
                };
                content.addEventListener('transitionend', onEnd);

                if (!hasExpanded && typeof onFirstExpand === 'function') {
                    hasExpanded = true;
                    // Small delay to ensure DOM is visible for Chart.js
                    setTimeout(onFirstExpand, 150);
                }
            } else {
                // Collapsing — first set explicit height so transition can animate from it
                content.style.maxHeight = content.scrollHeight + 'px';
                // Force reflow
                content.offsetHeight;
                island.classList.add('collapsed');
                header.setAttribute('aria-expanded', 'false');
                content.style.maxHeight = '0';
            }

            setCollapsed(sectionId, !isCurrentlyCollapsed);
        }

        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        return island;
    }

    return { wrap, isCollapsed, setCollapsed };
})();

window.CollapsibleSection = CollapsibleSection;

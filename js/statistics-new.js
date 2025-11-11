// Modular Statistics Manager for AlcoNote PWA
// This replaces the old monolithic statistics system

class ModularStatisticsManager {
    constructor() {
        this.isInitialized = false;
        this.currentPeriod = 'today';
        this.currentDate = new Date();
        
        // Storage for calculators and renderers
        this.calculators = {};
        this.renderers = {};
        
        // Cache for expensive calculations
        this.cache = {
            stats: null,
            lastPeriod: null,
            lastDateRange: null,
            lastUpdate: null,
            lastCacheKey: null
        };
        
            // Charts and maps for cleanup
            this.charts = {};
            this.maps = {};
            
            // Prevent re-entrant loads of statistics
            this.loading = false;
    }
    
    // Initialize the modular statistics system
    init() {
        if (this.isInitialized) {
            console.log('Modular statistics manager already initialized');
            return;
        }
        
        console.log('Initializing modular statistics manager...');
        
        try {
            // Register calculators
            this.registerCalculators();
            
            // Register renderers
            this.registerRenderers();
            
            // Setup UI components
            this.setupPeriodSelector();
            this.setupDateNavigation();
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Modular statistics manager initialized successfully');
            
            // Load initial statistics
            this.loadStatistics();
            
        } catch (error) {
            console.error('Error initializing modular statistics manager:', error);
            this.fallbackToOldSystem();
        }
    }
    
    // Register available calculators
    registerCalculators() {
        // Wrap calculators to expose a unified calculate(drinks, dateRange, context) API
        const wrap = (obj, fnName) => ({
            calculate: async (drinks, dateRange, context) => obj[fnName](drinks, dateRange, context || {})
        });

        if (typeof GeneralStatsCalculator !== 'undefined' && typeof GeneralStatsCalculator.calculateGeneralStats === 'function') {
            this.calculators.general = wrap(GeneralStatsCalculator, 'calculateGeneralStats');
            console.log('Registered GeneralStatsCalculator');
        }
        
        if (typeof TemporalStatsCalculator !== 'undefined' && typeof TemporalStatsCalculator.calculateTemporalStats === 'function') {
            this.calculators.temporal = wrap(TemporalStatsCalculator, 'calculateTemporalStats');
            console.log('Registered TemporalStatsCalculator');
        }
        
        if (typeof CategoryStatsCalculator !== 'undefined' && typeof CategoryStatsCalculator.calculateCategoryStats === 'function') {
            this.calculators.categories = wrap(CategoryStatsCalculator, 'calculateCategoryStats');
            console.log('Registered CategoryStatsCalculator');
        }
        
        if (typeof DrinkStatsCalculator !== 'undefined' && typeof DrinkStatsCalculator.calculateDrinkStats === 'function') {
            this.calculators.drinks = wrap(DrinkStatsCalculator, 'calculateDrinkStats');
            console.log('Registered DrinkStatsCalculator');
        }
        
        if (typeof HealthStatsCalculator !== 'undefined' && typeof HealthStatsCalculator.calculateHealthStats === 'function') {
            this.calculators.health = wrap(HealthStatsCalculator, 'calculateHealthStats');
            console.log('Registered HealthStatsCalculator');
        }
        
        if (typeof LocationStatsCalculator !== 'undefined' && typeof LocationStatsCalculator.calculateLocationStats === 'function') {
            this.calculators.location = wrap(LocationStatsCalculator, 'calculateLocationStats');
            console.log('Registered LocationStatsCalculator');
        }
        
        console.log(`Registered ${Object.keys(this.calculators).length} calculators`);
    }
    
    // Register available renderers
    registerRenderers() {
        // Standardize renderers to expose a unified interface: { render(stats, ctx), postRender(stats, ctx) }
        const wrap = (renderFn, postFn) => ({
            render: renderFn,
            postRender: postFn
        });

        // General
        if (typeof GeneralStatsRenderer !== 'undefined' && typeof GeneralStatsRenderer.renderGeneralStats === 'function') {
            this.renderers.general = wrap(
                (stats, ctx) => GeneralStatsRenderer.renderGeneralStats(stats, ctx),
                (stats, ctx) => GeneralStatsRenderer.postRenderGeneralStats && GeneralStatsRenderer.postRenderGeneralStats(stats)
            );
            console.log('Registered GeneralStatsRenderer');
        }
        
        // Temporal (inject chart containers and run postRender to init charts)
        if (typeof TemporalStatsRenderer !== 'undefined' && typeof TemporalStatsRenderer.renderTemporalStats === 'function') {
            this.renderers.temporal = wrap(
                (stats, ctx) => {
                    const sectionEl = TemporalStatsRenderer.renderTemporalStats(stats, ctx?.currentPeriod || 'today');
                    try {
                        // Append charts containers for proper initialization
                        const hourly = TemporalStatsRenderer.renderHourlyDistributionChart && TemporalStatsRenderer.renderHourlyDistributionChart(stats.hourlyDistribution);
                        if (hourly) sectionEl.appendChild(hourly);
                        // Append daily chart only when the selected range is not a single day
                        let appendDaily = true;
                        try {
                            appendDaily = !((ctx?.currentPeriod === 'today') || (ctx?.dateRange && ctx.dateRange.start === ctx.dateRange.end));
                        } catch (e) {
                            appendDaily = ctx?.currentPeriod !== 'today';
                        }
                        if (appendDaily) {
                            const daily = TemporalStatsRenderer.renderDailyDistributionChart && TemporalStatsRenderer.renderDailyDistributionChart(stats.dailyDistribution);
                            if (daily) sectionEl.appendChild(daily);
                        }
                    } catch (e) {
                        console.warn('Temporal charts render error:', e);
                    }
                    return sectionEl;
                },
                (stats, ctx) => TemporalStatsRenderer.postRenderTemporalStats && TemporalStatsRenderer.postRenderTemporalStats(stats, ctx?.currentPeriod || 'today', ctx)
            );
            console.log('Registered TemporalStatsRenderer');
        }
        
        // Categories
        if (typeof CategoryStatsRenderer !== 'undefined' && typeof CategoryStatsRenderer.renderCategoryStats === 'function') {
            this.renderers.categories = wrap(
                (stats) => CategoryStatsRenderer.renderCategoryStats(stats?.categories || {}),
                (stats) => CategoryStatsRenderer.postRenderCategoryStats && CategoryStatsRenderer.postRenderCategoryStats(stats?.categories || {})
            );
            console.log('Registered CategoryStatsRenderer');
        }
        
        // Drinks (support both DrinksStatsRenderer and DrinkStatsRenderer namespaces)
        const DrinksRendererNS = (typeof DrinksStatsRenderer !== 'undefined') ? DrinksStatsRenderer :
                                 (typeof DrinkStatsRenderer !== 'undefined') ? DrinkStatsRenderer : null;
        if (DrinksRendererNS && typeof DrinksRendererNS.renderIndividualDrinkStats === 'function') {
            this.renderers.drinks = wrap(
                (stats) => DrinksRendererNS.renderIndividualDrinkStats(stats?.drinks || {}),
                (stats) => DrinksRendererNS.postRenderIndividualDrinkStats && DrinksRendererNS.postRenderIndividualDrinkStats(stats?.drinks || {})
            );
            console.log('Registered Drink(s)StatsRenderer');
        }
        
        // Health (BAC only; indicators removed)
        if (typeof HealthStatsRenderer !== 'undefined') {
            this.renderers.health = wrap(
                async (stats, ctx) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'stats-section-group health-group';
                    try {
                        if (typeof HealthStatsRenderer.renderBACEstimation === 'function') {
                            // Pass context with dateRange and drinks for proper BAC calculation
                            const bacContext = {
                                dateRange: ctx?.dateRange,
                                drinks: ctx?.drinks,
                                currentPeriod: ctx?.currentPeriod
                            };
                            const bacEl = await HealthStatsRenderer.renderBACEstimation(bacContext);
                            if (bacEl) wrapper.appendChild(bacEl);
                        }
                    } catch (e) {
                        console.warn('Health render error:', e);
                    }
                    return wrapper;
                },
                (stats) => HealthStatsRenderer.postRenderHealthStats && HealthStatsRenderer.postRenderHealthStats(stats)
            );
            console.log('Registered HealthStatsRenderer (BAC only)');
        }
        
        // Location (needs container element in postRender)
        if (typeof LocationStatsRenderer !== 'undefined' && typeof LocationStatsRenderer.renderLocationStats === 'function') {
            this.renderers.location = wrap(
                (stats) => LocationStatsRenderer.renderLocationStats(stats),
                (stats, ctx) => {
                    if (ctx?.containerEl) {
                        try {
                            LocationStatsRenderer.postRenderLocationStats(stats, ctx.containerEl);
                        } catch (e) {
                            console.warn('Location postRender error:', e);
                        }
                    }
                }
            );
            console.log('Registered LocationStatsRenderer');
        }
        
        console.log(`Registered ${Object.keys(this.renderers).length} renderers`);
    }
    
    // Setup period selector
    setupPeriodSelector() {
        const periodButtons = document.querySelectorAll('.period-btn');
        
        periodButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button
                periodButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update current period
                this.currentPeriod = button.dataset.period;
                
                // Reset current date to today when changing period
                this.currentDate = new Date();
                
                // Show/hide period navigation
                const periodNavigation = document.getElementById('period-navigation');
                if (this.currentPeriod !== 'custom') {
                    periodNavigation.classList.add('active');
                    this.updateDateDisplay();
                } else {
                    periodNavigation.classList.remove('active');
                }
                
                // Show custom date picker for custom period
                this.toggleCustomDatePicker();
                
                // Reload statistics
                this.loadStatistics();
            });
        });
    }
    
    // Setup date navigation
    setupDateNavigation() {
        const prevBtn = document.getElementById('prev-period');
        const nextBtn = document.getElementById('next-period');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.navigatePeriod(-1);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.navigatePeriod(1);
            });
        }
        
        this.updateDateDisplay();
    }
    
    // Navigate between periods
    navigatePeriod(direction) {
        switch (this.currentPeriod) {
            case 'today':
                this.currentDate = Utils.addDays(this.currentDate, direction);
                break;
            case 'week':
                this.currentDate = Utils.addDays(this.currentDate, direction * 7);
                break;
            case 'month':
                const newMonth = new Date(this.currentDate);
                newMonth.setMonth(newMonth.getMonth() + direction);
                this.currentDate = newMonth;
                break;
            case 'year':
                const newYear = new Date(this.currentDate);
                newYear.setFullYear(newYear.getFullYear() + direction);
                this.currentDate = newYear;
                break;
        }
        this.updateDateDisplay();
        this.loadStatistics();
    }
    
    // Update date display
    updateDateDisplay() {
        const dateElement = document.getElementById('current-period-display');
        if (dateElement) {
            let displayText = '';
            switch (this.currentPeriod) {
                case 'today':
                    displayText = Utils.formatDate(this.currentDate.toISOString().split('T')[0]);
                    break;
                case 'week':
                    const weekStart = new Date(this.currentDate);
                    const dayOfWeek = weekStart.getDay();
                    const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                    weekStart.setDate(diff);
                    const weekEnd = new Date(weekStart);
                    weekEnd.setDate(weekStart.getDate() + 6);
                    displayText = `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
                    break;
                case 'month':
                    displayText = this.currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
                    break;
                case 'year':
                    displayText = this.currentDate.getFullYear().toString();
                    break;
                default:
                    displayText = 'Période personnalisée';
            }
            dateElement.textContent = displayText;
        }
    }
    
    // Toggle custom date picker
    toggleCustomDatePicker() {
        const picker = document.getElementById('custom-date-picker');
        if (this.currentPeriod === 'custom') {
            if (!picker) {
                this.createCustomDatePicker();
            } else {
                picker.classList.add('active');
            }
        } else if (picker) {
            picker.classList.remove('active');
        }
    }
    
    // Create custom date picker
    createCustomDatePicker() {
        const container = document.querySelector('.statistics-container');
        const picker = document.createElement('div');
        picker.id = 'custom-date-picker';
        picker.className = 'date-range-picker active';
        
        picker.innerHTML = `
            <h3>Période personnalisée</h3>
            <div class="date-range-row">
                <div class="form-group">
                    <label for="start-date">Date de début</label>
                    <input type="date" id="start-date" value="${Utils.getCurrentDate()}">
                </div>
                <div class="form-group">
                    <label for="end-date">Date de fin</label>
                    <input type="date" id="end-date" value="${Utils.getCurrentDate()}">
                </div>
            </div>
            <button id="apply-custom-range" class="btn-primary">Appliquer</button>
        `;
        
        container.insertBefore(picker, document.getElementById('statistics-content'));
        
        // Setup apply button
        document.getElementById('apply-custom-range').addEventListener('click', () => {
            this.loadStatistics();
        });
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Listen for drink data changes
        window.addEventListener('drinkDataChanged', (event) => {
            console.log('Modular stats: Drink data changed:', event.detail);
            this.handleDataChange(event.detail);
        });
        
        // Listen for user settings changes
        window.addEventListener('userSettingsChanged', (event) => {
            console.log('Modular stats: User settings changed:', event.detail);
            this.handleDataChange(event.detail);
        });
    }
    
    // Handle data changes
    handleDataChange(changeDetail) {
        // Clear cache to force refresh
        this.clearCache();
        
        // If we're currently on the statistics tab, refresh immediately
        if (this.isCurrentTab()) {
            console.log('Refreshing modular statistics due to data change');
            this.loadStatistics();
        } else {
            console.log('Statistics tab not active, cache cleared for next visit');
        }
    }
    
    // Check if statistics tab is currently active
    isCurrentTab() {
        const statisticsTab = document.getElementById('statistics-tab');
        return statisticsTab && statisticsTab.classList.contains('active');
    }
    
    // Clear statistics cache
    clearCache() {
        this.cache = {
            stats: null,
            lastPeriod: null,
            lastDateRange: null,
            lastUpdate: null,
            lastCacheKey: null
        };
        console.log('Modular statistics cache cleared');
    }
    
    // Get date range based on current period
    getDateRange() {
        if (this.currentPeriod === 'custom') {
            const startDate = document.getElementById('start-date')?.value || Utils.getCurrentDate();
            const endDate = document.getElementById('end-date')?.value || Utils.getCurrentDate();
            return { start: startDate, end: endDate };
        } else {
            return Utils.getDateRangeFixed(this.currentPeriod, this.currentDate);
        }
    }
    
    // Main method to load and display statistics
    async loadStatistics() {
        // Guard against double-invocation during initialization or rapid events
        if (this.loading) {
            console.warn('Modular statistics load already in progress, skipping concurrent call');
            return;
        }
        this.loading = true;

        const container = document.getElementById('statistics-content');
        if (!container) {
            console.error('Statistics container not found');
            return;
        }
        
        const loading = Utils.showLoading(container, 'Calcul des statistiques...');
        
        try {
            // Clean up previous charts and maps
            this.cleanup();
            
            const dateRange = this.getDateRange();
            const drinks = await dbManager.getDrinksByDateRange(dateRange.start, dateRange.end);
            
            // Clear existing content
            container.innerHTML = '';
            
            if (drinks.length === 0) {
                this.showEmptyState(container);
                return;
            }
            
            // Check if we can use cached data
            const cacheKey = `${this.currentPeriod}_${dateRange.start}_${dateRange.end}_${drinks.length}`;
            let allStats;
            
            if (this.shouldUseCache(cacheKey, dateRange)) {
                console.log('Using cached modular statistics');
                allStats = this.cache.stats;
            } else {
                // Calculate all statistics using modular system
                allStats = await this.calculateAllStats(drinks, dateRange);
                
                // Update cache
                this.cache.stats = allStats;
                this.cache.lastPeriod = this.currentPeriod;
                this.cache.lastDateRange = dateRange;
                this.cache.lastUpdate = Date.now();
                this.cache.lastCacheKey = cacheKey;
            }
            
            // Render all sections (pass drinks for BAC calculation)
            await this.renderAllSections(container, allStats, drinks);
            
        } catch (error) {
            console.error('Error loading modular statistics:', error);
            Utils.handleError(error, 'loading statistics');
            
            // Fallback to old system
            this.fallbackToOldSystem();
            
        } finally {
            // Release loading lock and hide loader
            this.loading = false;
            Utils.hideLoading(loading);
        }
    }
    
    // Calculate all statistics using the modular system
    async calculateAllStats(drinks, dateRange) {
        const allStats = {};
        const enabledSections = getEnabledSections();
        
        console.log(`Calculating stats for ${enabledSections.length} sections`);
        
        for (const section of enabledSections) {
            try {
                const calculator = this.calculators[section.calculator];
                if (calculator && calculator.calculate) {
                    console.log(`Calculating ${section.id} stats...`);
                    
                    // Get user settings for calculators that need them
                    const context = {
                        currentPeriod: this.currentPeriod,
                        settings: await dbManager.getAllSettings().catch(() => ({}))
                    };
                    
                    allStats[section.id] = await calculator.calculate(drinks, dateRange, context);
                } else {
                    console.warn(`Calculator not found for section: ${section.id}`);
                    allStats[section.id] = null;
                }
            } catch (error) {
                console.error(`Error calculating ${section.id} stats:`, error);
                allStats[section.id] = null;
            }
        }
        
        return allStats;
    }
    
    // Render all sections using the modular system
    async renderAllSections(container, allStats, drinks) {
        const enabledSections = getEnabledSections();

        console.log(`Rendering ${enabledSections.length} sections`);

        for (const section of enabledSections) {
            try {
                const renderer = this.renderers[section.renderer];
                const stats = allStats[section.id];

                if (renderer && typeof renderer.render === 'function' && stats) {
                    console.log(`Rendering ${section.id} section...`);

                    let sectionElement = await renderer.render(stats, {
                        charts: this.charts,
                        maps: this.maps,
                        section: section,
                        currentPeriod: this.currentPeriod,
                        dateRange: this.getDateRange(),
                        drinks: drinks
                    });

                    // Convert HTML string to DOM element if needed
                    if (typeof sectionElement === 'string') {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = sectionElement;
                        sectionElement = tempDiv.firstElementChild || tempDiv;
                    }

                    if (sectionElement) {
                        container.appendChild(sectionElement);

                        // Generic post-render hook
                        if (typeof renderer.postRender === 'function') {
                            const ctx = {
                                charts: this.charts,
                                maps: this.maps,
                                section: section,
                                currentPeriod: this.currentPeriod,
                                dateRange: this.getDateRange(),
                                containerEl: sectionElement
                            };
                            setTimeout(() => {
                                try {
                                    renderer.postRender(stats, ctx);
                                } catch (e) {
                                    console.warn(`Post-render error for section ${section.id}:`, e);
                                }
                            }, 100);
                        }
                    }
                } else if (stats === null) {
                    console.warn(`No stats data for section: ${section.id}, skipping render`);
                } else {
                    console.warn(`Renderer not found or invalid for section: ${section.id}`);
                }
            } catch (error) {
                console.error(`Error rendering ${section.id} section:`, error);

                // Create error section
                const errorSection = document.createElement('div');
                errorSection.className = 'stats-section error';
                errorSection.innerHTML = `
                    <h3>${section.title}</h3>
                    <div class="error-message">
                        <p>Erreur lors du chargement de cette section</p>
                    </div>
                `;
                container.appendChild(errorSection);
            }
        }
    }
    
    // Check if cached data can be used
    shouldUseCache(cacheKey, dateRange) {
        if (!STATS_CONFIG.cache.enabled) return false;
        
        if (!this.cache.stats ||
            !this.cache.lastUpdate ||
            !this.cache.lastCacheKey) {
            return false;
        }
        
        const cacheAge = Date.now() - this.cache.lastUpdate;
        
        if (cacheAge > STATS_CONFIG.cache.maxAge) {
            return false;
        }
        
        if (this.cache.lastPeriod !== this.currentPeriod ||
            this.cache.lastCacheKey !== cacheKey) {
            return false;
        }
        
        if (this.cache.lastDateRange.start !== dateRange.start ||
            this.cache.lastDateRange.end !== dateRange.end) {
            return false;
        }
        
        return true;
    }
    
    // Show empty state when no data
    showEmptyState(container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <h3 class="empty-state-title">Aucune donnée</h3>
                <p class="empty-state-description">
                    Aucune boisson enregistrée pour cette période.
                    Commencez par ajouter des boissons pour voir vos statistiques.
                </p>
            </div>
        `;
    }
    
    // Cleanup charts and maps
    cleanup() {
        try {
            // Clean up charts
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.destroy === 'function') {
                    try {
                        chart.destroy();
                    } catch (error) {
                        console.warn('Error destroying chart:', error);
                    }
                }
            });
            this.charts = {};
            
            // Clean up maps
            Object.values(this.maps).forEach(map => {
                if (map && typeof map.remove === 'function') {
                    try {
                        map.remove();
                    } catch (error) {
                        console.warn('Error removing map:', error);
                    }
                }
            });
            this.maps = {};
            
            console.log('Modular statistics cleanup completed');
        } catch (error) {
            console.error('Error during modular statistics cleanup:', error);
            this.charts = {};
            this.maps = {};
        }
    }
    
    // Fallback to old statistics system (guarded by config to avoid duplications)
    fallbackToOldSystem() {
        const allowLegacy = window.StatsConfig?.STATS_CONFIG?.legacyFallbackEnabled === true;
        if (!allowLegacy) {
            console.warn('Legacy statistics fallback is disabled by configuration. Showing error state instead.');
            this.showErrorState();
            return;
        }

        console.log('Falling back to old statistics system...');
        try {
            if (window.statsManager && typeof window.statsManager.init === 'function') {
                window.statsManager.init();
                console.log('Old statistics system activated as fallback');
            } else {
                console.error('Old statistics system not available either');
                this.showErrorState();
            }
        } catch (error) {
            console.error('Error activating fallback statistics system:', error);
            this.showErrorState();
        }
    }
    
    // Show error state
    showErrorState() {
        const container = document.getElementById('statistics-content');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error-state">
                    <div class="empty-state-icon">❌</div>
                    <h3 class="empty-state-title">Erreur système</h3>
                    <p class="empty-state-description">
                        Impossible de charger les statistiques. 
                        Veuillez recharger la page ou contacter le support.
                    </p>
                </div>
            `;
        }
    }
}

// Create global modular statistics manager instance
const modularStatsManager = new ModularStatisticsManager();

// Export for use in other modules
window.modularStatsManager = modularStatsManager;

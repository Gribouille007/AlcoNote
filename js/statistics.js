// Statistics module for AlcoNote PWA
// Comprehensive analytics and data visualization

class StatisticsManager {
    constructor() {
        this.currentPeriod = 'today';
        this.currentDate = new Date();
        this.charts = {};
        // Cache for expensive calculations
        this.cache = {
            stats: null,
            lastPeriod: null,
            lastDateRange: null,
            lastUpdate: null
        };
        // Performance optimization: reduce DOM queries
        this.domCache = {};
    }

    // Initialize statistics module
    init() {
        this.isInitialized = true;
        this.setupPeriodSelector();
        this.setupDayNavigation();
        this.setupEventListeners();
        this.loadStatistics();
    }

    // Setup event listeners for automatic updates
    setupEventListeners() {

        // Listen for drink data changes
        window.addEventListener('drinkDataChanged', (event) => {
            console.log('Drink data changed:', event.detail);
            this.handleDrinkDataChange(event.detail);
        });

        // Listen for user settings changes
        window.addEventListener('userSettingsChanged', (event) => {
            console.log('User settings changed:', event.detail);
            this.handleUserSettingsChange(event.detail);
        });
    }

    // Handle drink data changes
    handleDrinkDataChange(changeDetail) {
        const { action, drink, drinkId } = changeDetail;

        console.log(`Handling drink ${action}:`, drink);

        // Clear cache to force refresh
        this.clearCache();

        // If we're currently on the statistics tab, refresh immediately
        if (this.isCurrentTab()) {
            console.log('Refreshing statistics due to drink data change');
            this.loadStatistics();
        } else {
            console.log('Statistics tab not active, cache cleared for next visit');
        }
    }

    // Handle user settings changes
    handleUserSettingsChange(changeDetail) {
        const { setting, value } = changeDetail;

        console.log(`Handling user setting change: ${setting} = ${value}`);

        // Clear cache to force refresh
        this.clearCache();

        // If we're currently on the statistics tab, refresh immediately
        if (this.isCurrentTab()) {
            console.log('Refreshing statistics due to user settings change');
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
            lastUpdate: null
        };
        console.log('Statistics cache cleared');
    }

    // Setup period selector buttons
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

                // Show/hide period navigation - now available for all periods except custom
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

    // Setup day navigation for "today" period
    setupDayNavigation() {
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

    // Update date display for day navigation
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
                    // Calcul pour commencer par lundi (1) au lieu de dimanche (0)
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

    // Get date range based on current period
    getDateRange() {
        if (this.currentPeriod === 'custom') {
            const startDate = document.getElementById('start-date')?.value || Utils.getCurrentDate();
            const endDate = document.getElementById('end-date')?.value || Utils.getCurrentDate();
            return { start: startDate, end: endDate };
        } else {
            // Use fixed date range calculation to ensure proper synchronization
            return Utils.getDateRangeFixed(this.currentPeriod, this.currentDate);
        }
    }

    // Load and display statistics
    async loadStatistics() {
        const container = document.getElementById('statistics-content');
        const loading = Utils.showLoading(container, 'Calcul des statistiques...');

        try {
            // Clean up previous charts and maps before loading new ones
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
            let stats;

            if (this.shouldUseCache(cacheKey, dateRange)) {
                console.log('Using cached statistics');
                stats = this.cache.stats;
            } else {
                // Generate all statistics with performance optimization
                stats = await Utils.measureAsyncPerformance('Statistics calculation', async () => {
                    return await this.calculateComprehensiveStats(drinks, dateRange);
                });

                // Update cache
                this.cache.stats = stats;
                this.cache.lastPeriod = this.currentPeriod;
                this.cache.lastDateRange = dateRange;
                this.cache.lastUpdate = Date.now();
                this.cache.lastCacheKey = cacheKey;
            }

            // Render statistics with staggered loading for better UX
            this.renderGeneralStats(container, stats.general);

            // Use requestAnimationFrame for smooth rendering
            requestAnimationFrame(() => {
                this.renderTemporalStats(container, stats.temporal);

                requestAnimationFrame(() => {
                    this.renderCategoryStats(container, stats.categories);
                    this.renderIndividualDrinkStats(container, stats.individualDrinks);

                    requestAnimationFrame(() => {
                        this.renderHealthStats(container, stats.health);
                        this.renderLocationStats(container, stats.location);
                    });
                });
            });

        } catch (error) {
            Utils.handleError(error, 'loading statistics');
        } finally {
            Utils.hideLoading(loading);
        }
    }

    // Calculate comprehensive statistics
    async calculateComprehensiveStats(drinks, dateRange) {
        const stats = {
            general: await this.calculateGeneralStats(drinks, dateRange),
            temporal: await this.calculateTemporalStats(drinks, dateRange),
            categories: await this.calculateCategoryStats(drinks),
            individualDrinks: await this.calculateIndividualDrinkStats(drinks),
            health: await this.calculateHealthStats(drinks, dateRange),
            location: await this.calculateLocationStats(drinks)
        };

        return stats;
    }

    // Calculate general consumption statistics
    async calculateGeneralStats(drinks, dateRange) {
        // Utilise le calculateur modulaire pour les statistiques générales
        if (window.GeneralStatsCalculator && window.GeneralStatsCalculator.calculateGeneralStats) {
            try {
                return await window.GeneralStatsCalculator.calculateGeneralStats(
                    drinks,
                    dateRange,
                    { currentPeriod: this.currentPeriod }
                );
            } catch (error) {
                console.error('Error using modular general stats calculator:', error);
                // Fallback vers l'ancienne logique
            }
        }

        // Fallback vers l'ancienne logique si le calculateur n'est pas disponible
        const totalDrinks = drinks.length;
        let totalVolume = 0;
        let totalAlcohol = 0;
        const sessions = this.calculateSessions(drinks);
        const uniqueDrinks = new Set();
        const categories = {};

        drinks.forEach(drink => {
            // Convert to standard units (cL)
            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            totalVolume += volumeInCL;

            // Calculate alcohol content
            if (drink.alcoholContent) {
                totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
            }

            // Track unique drinks
            uniqueDrinks.add(drink.name);

            // Track categories
            if (!categories[drink.category]) {
                categories[drink.category] = 0;
            }
            categories[drink.category]++;
        });

        // Calculate averages using actual period length
        const daysDiff = this.getDaysDifference(dateRange.start, dateRange.end) + 1;
        const avgPerDay = daysDiff > 0 ? totalDrinks / daysDiff : 0;
        const avgPerWeek = avgPerDay * 7;
        // Calculate monthly average based on actual period
        const avgPerMonth = this.currentPeriod === 'month' ? totalDrinks : avgPerDay * 30.44; // Average days per month

        // Calculate sober days from first drink recorded
        const soberDays = await this.calculateSoberDays(dateRange);

        // Calculate percentage comparisons with previous period
        const comparison = await this.calculatePeriodComparison(dateRange);

        return {
            totalDrinks,
            totalVolume: Math.round(totalVolume * 10) / 10,
            totalAlcohol: Math.round(totalAlcohol * 10) / 10,
            totalSessions: sessions.length,
            uniqueDrinks: uniqueDrinks.size,
            avgPerDay: Math.round(avgPerDay * 10) / 10,
            avgPerWeek: Math.round(avgPerWeek * 10) / 10,
            avgPerMonth: Math.round(avgPerMonth * 10) / 10,
            soberDays,
            categoryDistribution: categories,
            comparison
        };
    }

    // Calculate temporal statistics
    async calculateTemporalStats(drinks, dateRange) {
        const hourlyDistribution = {};
        const dailyDistribution = {};
        const weeklyComparison = {};
        const sessions = this.calculateSessions(drinks);

        // Initialize distributions with proper keys
        for (let i = 0; i < 24; i++) {
            hourlyDistribution[i] = 0;
        }
        // Initialize daily distribution with all 7 days (0-6, where 0=Sunday, 1=Monday, etc.)
        for (let i = 0; i < 7; i++) {
            dailyDistribution[i] = 0;
        }

        drinks.forEach(drink => {
            // Hourly distribution
            const hour = parseInt(drink.time.split(':')[0]);
            if (hour >= 0 && hour <= 23) {
                hourlyDistribution[hour]++;
            }

            // Daily distribution (day of week) - getDay() returns 0-6 (Sunday-Saturday)
            const dayOfWeek = new Date(drink.date).getDay();
            if (dayOfWeek >= 0 && dayOfWeek <= 6) {
                dailyDistribution[dayOfWeek]++;
            }
        });

        // Find peak hours and days (handle ties by taking the first occurrence)
        const maxHourlyValue = Math.max(...Object.values(hourlyDistribution));
        const peakHour = Object.keys(hourlyDistribution).find(hour =>
            hourlyDistribution[hour] === maxHourlyValue
        );

        const maxDailyValue = Math.max(...Object.values(dailyDistribution));
        const peakDay = Object.keys(dailyDistribution).find(day =>
            dailyDistribution[day] === maxDailyValue
        );

        // Calculate session statistics
        const sessionDurations = sessions.map(session => session.duration).filter(d => d > 0);
        const avgSessionDuration = sessionDurations.length > 0 ?
            Utils.calculateAverage(sessionDurations) : 0;

        // Calculate time between sessions
        const timeBetweenSessions = [];
        for (let i = 1; i < sessions.length; i++) {
            const timeDiff = (sessions[i].startTime - sessions[i - 1].endTime) / (1000 * 60 * 60); // hours
            if (timeDiff > 0) {
                timeBetweenSessions.push(timeDiff);
            }
        }
        const avgTimeBetweenSessions = timeBetweenSessions.length > 0 ?
            Utils.calculateAverage(timeBetweenSessions) : 0;

        return {
            hourlyDistribution,
            dailyDistribution,
            peakHour: parseInt(peakHour) || 0,
            peakDay: parseInt(peakDay) || 0,
            avgSessionDuration: Math.round(avgSessionDuration * 10) / 10,
            avgTimeBetweenSessions: Math.round(avgTimeBetweenSessions * 10) / 10,
            totalSessions: sessions.length,
            firstDrink: drinks.length > 0 ? drinks[drinks.length - 1].date : null,
            lastDrink: drinks.length > 0 ? drinks[0].date : null
        };
    }

    // Calculate category statistics
    async calculateCategoryStats(drinks) {
        const categories = {};

        drinks.forEach(drink => {
            if (!categories[drink.category]) {
                categories[drink.category] = {
                    count: 0,
                    volume: 0,
                    alcoholContent: [],
                    drinks: []
                };
            }

            const cat = categories[drink.category];
            cat.count++;

            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            cat.volume += volumeInCL;

            if (drink.alcoholContent) {
                cat.alcoholContent.push(drink.alcoholContent);
            }

            cat.drinks.push(drink);
        });

        // Calculate averages and find favorites
        Object.keys(categories).forEach(categoryName => {
            const cat = categories[categoryName];
            cat.avgVolume = Math.round((cat.volume / cat.count) * 10) / 10;
            cat.avgAlcoholContent = cat.alcoholContent.length > 0 ?
                Math.round(Utils.calculateAverage(cat.alcoholContent) * 10) / 10 : 0;

            // Find most consumed drink in category (handle ties by taking the first occurrence)
            const drinkCounts = {};
            cat.drinks.forEach(drink => {
                drinkCounts[drink.name] = (drinkCounts[drink.name] || 0) + 1;
            });

            const maxCount = Math.max(...Object.values(drinkCounts));
            cat.favoriteDrink = Object.keys(drinkCounts).find(drink =>
                drinkCounts[drink] === maxCount
            );
        });

        return categories;
    }

    // Calculate individual drink statistics
    async calculateIndividualDrinkStats(drinks) {
        const drinkStats = {};

        drinks.forEach(drink => {
            if (!drinkStats[drink.name]) {
                drinkStats[drink.name] = {
                    count: 0,
                    totalVolume: 0,
                    lastConsumed: null,
                    dates: []
                };
            }

            const stat = drinkStats[drink.name];
            stat.count++;

            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            stat.totalVolume += volumeInCL;

            stat.dates.push(drink.date);

            if (!stat.lastConsumed || drink.date > stat.lastConsumed) {
                stat.lastConsumed = drink.date;
            }
        });

        // Sort by frequency
        const sortedDrinks = Object.entries(drinkStats)
            .sort(([, a], [, b]) => b.count - a.count)
            .slice(0, 10); // Top 10

        return Object.fromEntries(sortedDrinks);
    }

    // Calculate health-related statistics
    async calculateHealthStats(drinks, dateRange) {
        // Utilise le calculateur modulaire pour les statistiques de santé
        if (window.HealthStatsCalculator) {
            try {
                // Récupération des settings pour passer au calculateur
                let settings = {};
                try {
                    settings = await dbManager.getAllSettings();
                } catch (error) {
                    console.warn('Could not get settings from dbManager:', error);
                }

                return await window.HealthStatsCalculator.calculateHealthStats(
                    drinks,
                    dateRange,
                    { settings }
                );
            } catch (error) {
                console.error('Error using HealthStatsCalculator:', error);
                // Fallback vers l'ancienne logique si le calculateur échoue
            }
        }

        // Fallback vers l'ancienne logique si le calculateur n'est pas disponible
        let totalAlcoholGrams = 0;
        const dailyAlcohol = {};

        drinks.forEach(drink => {
            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            if (drink.alcoholContent) {
                const alcoholGrams = Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
                totalAlcoholGrams += alcoholGrams;

                if (!dailyAlcohol[drink.date]) {
                    dailyAlcohol[drink.date] = 0;
                }
                dailyAlcohol[drink.date] += alcoholGrams;
            }
        });

        // Calculate weekly average
        const daysDiff = this.getDaysDifference(dateRange.start, dateRange.end) + 1;
        const weeklyAlcohol = (totalAlcoholGrams / daysDiff) * 7;

        return {
            totalAlcoholGrams: Math.round(totalAlcoholGrams * 10) / 10,
            weeklyAlcohol: Math.round(weeklyAlcohol * 10) / 10,
            whoRecommendation: null,
            whoComparison: null,
            estimatedBAC: null,
            dailyAlcohol
        };
    }

    // Calculate location statistics
    async calculateLocationStats(drinks) {
        return await geoManager.getLocationStats(drinks);
    }

    // Calculate drinking sessions
    calculateSessions(drinks) {
        if (drinks.length === 0) return [];

        const sessions = [];
        let currentSession = null;
        const sessionGapHours = 4; // 4 hours gap defines new session

        // Sort drinks by date and time
        const sortedDrinks = [...drinks].sort((a, b) => {
            const dateTimeA = new Date(`${a.date}T${a.time}`);
            const dateTimeB = new Date(`${b.date}T${b.time}`);
            return dateTimeA - dateTimeB;
        });

        sortedDrinks.forEach(drink => {
            const drinkDateTime = new Date(`${drink.date}T${drink.time}`);

            if (!currentSession ||
                (drinkDateTime - currentSession.endTime) > (sessionGapHours * 60 * 60 * 1000)) {
                // Start new session
                currentSession = {
                    startTime: drinkDateTime,
                    endTime: drinkDateTime,
                    drinks: [drink],
                    duration: 0
                };
                sessions.push(currentSession);
            } else {
                // Add to current session
                currentSession.drinks.push(drink);
                currentSession.endTime = drinkDateTime;
                currentSession.duration = (currentSession.endTime - currentSession.startTime) / (1000 * 60 * 60); // hours
            }
        });

        return sessions.reverse(); // Most recent first
    }

    // Group drinks by day
    groupDrinksByDay(drinks) {
        const grouped = {};
        drinks.forEach(drink => {
            if (!grouped[drink.date]) {
                grouped[drink.date] = [];
            }
            grouped[drink.date].push(drink);
        });
        return grouped;
    }

    // Get difference in days between two dates
    getDaysDifference(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate sober days from first drink recorded
    async calculateSoberDays(dateRange) {
        try {
            // Get all drinks to find the first recorded drink
            const allDrinks = await dbManager.getAllDrinks();
            if (allDrinks.length === 0) return 0;

            // Find the earliest drink date
            const firstDrinkDate = allDrinks.reduce((earliest, drink) => {
                return drink.date < earliest ? drink.date : earliest;
            }, allDrinks[0].date);

            // Calculate total days since first drink to today (not end of period)
            const today = Utils.getCurrentDate();
            const totalDaysSinceFirst = this.getDaysDifference(firstDrinkDate, today) + 1;

            // Get all drinks since first drink to today
            const drinksInRange = await dbManager.getDrinksByDateRange(firstDrinkDate, today);

            // Group drinks by day to count drinking days
            const drinkingDays = new Set();
            drinksInRange.forEach(drink => {
                drinkingDays.add(drink.date);
            });

            // Calculate sober days
            const soberDays = totalDaysSinceFirst - drinkingDays.size;
            return Math.max(0, soberDays);

        } catch (error) {
            console.error('Error calculating sober days:', error);
            return 0;
        }
    }

    // Calculate percentage comparisons with previous period
    async calculatePeriodComparison(currentDateRange) {
        try {
            const previousDateRange = this.getPreviousPeriodRange(currentDateRange);
            if (!previousDateRange) return null;

            console.log('Current Date Range:', currentDateRange, 'Previous Date Range:', previousDateRange);
            // Get drinks for both periods
            const currentDrinks = await dbManager.getDrinksByDateRange(currentDateRange.start, currentDateRange.end);
            const previousDrinks = await dbManager.getDrinksByDateRange(previousDateRange.start, previousDateRange.end);

            // Calculate stats for both periods
            const currentStats = await this.calculateBasicStats(currentDrinks, currentDateRange);
            const previousStats = await this.calculateBasicStats(previousDrinks, previousDateRange);

            // Calculate percentage changes
            const comparison = {};
            const metrics = ['totalDrinks', 'totalVolume', 'totalAlcohol', 'totalSessions', 'uniqueDrinks', 'soberDays', 'avgPerDay', 'avgPerWeek', 'avgPerMonth'];

            metrics.forEach(metric => {
                if (previousStats[metric] === 0) {
                    comparison[metric] = currentStats[metric] > 0 ? 100 : 0;
                } else {
                    const change = ((currentStats[metric] - previousStats[metric]) / previousStats[metric]) * 100;
                    comparison[metric] = Math.round(change);
                }
                console.log(`Metric: ${metric}, Current: ${currentStats[metric]}, Previous: ${previousStats[metric]}, Change: ${comparison[metric]}`);
            });

            return comparison;

        } catch (error) {
            console.error('Error calculating period comparison:', error);
            return null;
        }
    }

    // Get previous period date range
    getPreviousPeriodRange(currentRange) {
        const currentStart = new Date(currentRange.start);
        const currentEnd = new Date(currentRange.end);

        let previousStart, previousEnd;

        console.log('Current period:', this.currentPeriod);
        console.log('Current range:', currentRange);

        switch (this.currentPeriod) {
            case 'today':
                // Jour précédent
                previousStart = new Date(currentStart);
                previousStart.setDate(previousStart.getDate() - 1);
                previousEnd = new Date(previousStart);
                break;

            case 'week':
                // Semaine précédente (7 jours avant)
                previousStart = new Date(currentStart);
                previousStart.setDate(previousStart.getDate() - 7);
                previousEnd = new Date(currentEnd);
                previousEnd.setDate(previousEnd.getDate() - 7);
                break;

            case 'month':
                // Mois précédent
                previousStart = new Date(currentStart);
                previousStart.setMonth(previousStart.getMonth() - 1);
                previousEnd = new Date(currentEnd);
                previousEnd.setMonth(previousEnd.getMonth() - 1);
                break;

            case 'year':
                // Année précédente
                previousStart = new Date(currentStart);
                previousStart.setFullYear(previousStart.getFullYear() - 1);
                previousEnd = new Date(currentEnd);
                previousEnd.setFullYear(previousEnd.getFullYear() - 1);
                break;

            default:
                // Pour les périodes personnalisées, calculer la durée équivalente
                const periodLength = this.getDaysDifference(currentRange.start, currentRange.end) + 1;
                previousEnd = new Date(currentStart);
                previousEnd.setDate(previousEnd.getDate() - 1);
                previousStart = new Date(previousEnd);
                previousStart.setDate(previousStart.getDate() - periodLength + 1);
        }

        const formattedPreviousStart = previousStart.toISOString().split('T')[0];
        const formattedPreviousEnd = previousEnd.toISOString().split('T')[0];

        console.log('Previous range:', { start: formattedPreviousStart, end: formattedPreviousEnd });

        return {
            start: formattedPreviousStart,
            end: formattedPreviousEnd
        };
    }

    // Calculate basic stats for comparison
    async calculateBasicStats(drinks, dateRange) {
        let totalVolume = 0;
        let totalAlcohol = 0;
        const uniqueDrinks = new Set();
        const sessions = this.calculateSessions(drinks);

        drinks.forEach(drink => {
            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            totalVolume += volumeInCL;

            if (drink.alcoholContent) {
                totalAlcohol += Utils.calculateAlcoholGrams(volumeInCL, drink.alcoholContent);
            }

            uniqueDrinks.add(drink.name);
        });

        const daysDiff = this.getDaysDifference(dateRange.start, dateRange.end) + 1;
        const avgPerDay = daysDiff > 0 ? drinks.length / daysDiff : 0;
        const avgPerWeek = avgPerDay * 7;

        // Calculate sober days for this specific period
        const drinksPerDay = this.groupDrinksByDay(drinks);
        const soberDays = daysDiff - Object.keys(drinksPerDay).length;

        return {
            totalDrinks: drinks.length,
            totalVolume: Math.round(totalVolume * 10) / 10,
            totalAlcohol: Math.round(totalAlcohol * 10) / 10,
            totalSessions: sessions.length,
            uniqueDrinks: uniqueDrinks.size,
            avgPerDay: Math.round(avgPerDay * 10) / 10,
            avgPerWeek: Math.round(avgPerWeek * 10) / 10,
            soberDays: Math.max(0, soberDays)
        };
    }

    // Render general statistics
    renderGeneralStats(container, stats) {
        const section = document.createElement('div');
        section.className = 'stats-section';
        section.innerHTML = `
            <h3>Statistiques générales</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.totalDrinks}</div>
                    <div class="stat-label">Boissons consommées</div>
                    ${stats.comparison && stats.comparison.totalDrinks !== null && stats.comparison.totalDrinks !== undefined ? `<div class="stat-change ${stats.comparison.totalDrinks >= 0 ? 'positive' : 'negative'}">${stats.comparison.totalDrinks >= 0 ? '+' : ''}${stats.comparison.totalDrinks}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalSessions}</div>
                    <div class="stat-label">Sessions</div>
                    ${stats.comparison && stats.comparison.totalSessions !== null && stats.comparison.totalSessions !== undefined ? `<div class="stat-change ${stats.comparison.totalSessions >= 0 ? 'positive' : 'negative'}">${stats.comparison.totalSessions >= 0 ? '+' : ''}${stats.comparison.totalSessions}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${(stats.totalVolume / 100).toFixed(2)}L</div>
                    <div class="stat-label">Volume total</div>
                    ${stats.comparison && stats.comparison.totalVolume !== null && stats.comparison.totalVolume !== undefined ? `<div class="stat-change ${stats.comparison.totalVolume >= 0 ? 'positive' : 'negative'}">${stats.comparison.totalVolume >= 0 ? '+' : ''}${stats.comparison.totalVolume}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.totalAlcohol}g</div>
                    <div class="stat-label">Alcool pur</div>
                    ${stats.comparison && stats.comparison.totalAlcohol !== null && stats.comparison.totalAlcohol !== undefined ? `<div class="stat-change ${stats.comparison.totalAlcohol >= 0 ? 'positive' : 'negative'}">${stats.comparison.totalAlcohol >= 0 ? '+' : ''}${stats.comparison.totalAlcohol}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.uniqueDrinks}</div>
                    <div class="stat-label">Boissons différentes</div>
                    ${stats.comparison && stats.comparison.uniqueDrinks !== null && stats.comparison.uniqueDrinks !== undefined ? `<div class="stat-change ${stats.comparison.uniqueDrinks >= 0 ? 'positive' : 'negative'}">${stats.comparison.uniqueDrinks >= 0 ? '+' : ''}${stats.comparison.uniqueDrinks}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.soberDays}</div>
                    <div class="stat-label">Jours sobres</div>
                    ${stats.comparison && stats.comparison.soberDays !== null && stats.comparison.soberDays !== undefined ? `<div class="stat-change ${stats.comparison.soberDays >= 0 ? 'positive' : 'negative'}">${stats.comparison.soberDays >= 0 ? '+' : ''}${stats.comparison.soberDays}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.avgPerDay.toFixed(1)}</div>
                    <div class="stat-label">Boissons/jour</div>
                    ${stats.comparison && stats.comparison.avgPerDay !== null && stats.comparison.avgPerDay !== undefined ? `<div class="stat-change ${stats.comparison.avgPerDay >= 0 ? 'positive' : 'negative'}">${stats.comparison.avgPerDay >= 0 ? '+' : ''}${stats.comparison.avgPerDay}%</div>` : ''}
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.avgPerWeek.toFixed(1)}</div>
                    <div class="stat-label">Boissons/semaine</div>
                    ${stats.comparison && stats.comparison.avgPerWeek !== null && stats.comparison.avgPerWeek !== undefined ? `<div class="stat-change ${stats.comparison.avgPerWeek >= 0 ? 'positive' : 'negative'}">${stats.comparison.avgPerWeek >= 0 ? '+' : ''}${stats.comparison.avgPerWeek}%</div>` : ''}
                </div>
            </div>
        `;

        container.appendChild(section);

        // Add category distribution chart
        this.renderCategoryDistributionChart(container, stats.categoryDistribution);
    }

    // Render temporal statistics
    renderTemporalStats(container, stats) {
        const section = document.createElement('div');
        section.className = 'stats-section';
        section.innerHTML = `
            <h3>Analyse temporelle</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.peakHour}h</div>
                    <div class="stat-label">Heure de pointe</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${Utils.getDayName(stats.peakDay)}</div>
                    <div class="stat-label">Jour de pointe</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.formatDuration(stats.avgSessionDuration)}</div>
                    <div class="stat-label">Durée moyenne session</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.formatDuration(stats.avgTimeBetweenSessions)}</div>
                    <div class="stat-label">Temps entre sessions</div>
                </div>
            </div>
        `;

        container.appendChild(section);

        // Add hourly distribution chart (always shown)
        this.renderHourlyDistributionChart(container, stats.hourlyDistribution);

        // Add daily distribution chart only for periods other than "today"
        if (this.currentPeriod !== 'today') {
            this.renderDailyDistributionChart(container, stats.dailyDistribution);
        }
    }

    // Render health statistics
    renderHealthStats(container, stats) {
        // Render only BAC estimation section; health indicators removed
        this.renderBACEstimation(container);
        return;
        const section = document.createElement('div');
        section.className = 'stats-section';
        section.innerHTML = `
            <div class="section-header">
                <h3>Indicateurs de santé</h3>
                <button class="info-btn" id="health-info-btn" title="Informations sur les indicateurs de santé">ℹ️</button>
            </div>
            <div class="stats-grid">
                ${stats.weeklyAlcohol !== null && stats.weeklyAlcohol !== undefined ? `
                <div class="stat-card">
                    <div class="stat-value">${stats.weeklyAlcohol}g</div>
                    <div class="stat-label">Alcool/semaine</div>
                </div>
                ` : ''}
                ${stats.whoComparison !== null && stats.whoComparison !== undefined ? `
                <div class="stat-card ${stats.whoComparison > 100 ? 'warning' : ''}">
                    <div class="stat-value">${stats.whoComparison}%</div>
                    <div class="stat-label">vs. OMS</div>
                </div>
                ` : ''}
                ${stats.estimatedBAC !== null && stats.estimatedBAC !== undefined ? `
                <div class="stat-card">
                    <div class="stat-value">${stats.estimatedBAC}‰</div>
                    <div class="stat-label">Taux estimé</div>
                </div>
                ` : ''}
            </div>
        `;

        container.appendChild(section);

        // Add click event for info button
        const infoBtn = document.getElementById('health-info-btn');
        if (infoBtn) {
            infoBtn.addEventListener('click', () => {
                this.showHealthInfoModal();
            });
        }

        // Add BAC estimation section
        this.renderBACEstimation(container);
    }

    // Render BAC estimation section
    async renderBACEstimation(container) {
        try {
            const settings = await dbManager.getAllSettings();
            const userWeight = settings.userWeight;
            const userGender = settings.userGender;

            const section = document.createElement('div');
            section.className = 'stats-section bac-estimation-section';
            section.id = 'bac-estimation-section';

            if (!userWeight || !userGender) {
                // Show setup message if user data is missing
                section.innerHTML = `
                    <div class="section-header">
                        <h3>🍺 Estimation alcoolémie</h3>
                        <button class="info-btn" id="bac-info-btn" title="Informations sur l'estimation d'alcoolémie">ℹ️</button>
                    </div>
                    <div class="bac-setup-message">
                        <div class="setup-icon">⚙️</div>
                        <h4>Configuration requise</h4>
                        <p>Pour calculer votre taux d'alcoolémie, veuillez renseigner votre poids et sexe dans les paramètres.</p>
                        <button id="open-profile-settings" class="btn-primary">Configurer mon profil</button>
                    </div>
                    <div class="bac-disclaimer">
                        <p><strong>⚠️ Ces valeurs sont indicatives et ne remplacent pas un test certifié.</strong></p>
                    </div>
                `;

                container.appendChild(section);

                // Add event listeners
                const openSettingsBtn = document.getElementById('open-profile-settings');
                if (openSettingsBtn) {
                    openSettingsBtn.addEventListener('click', () => {
                        this.openProfileSettings();
                    });
                }

                const bacInfoBtn = document.getElementById('bac-info-btn');
                if (bacInfoBtn) {
                    bacInfoBtn.addEventListener('click', () => {
                        this.showBACInfoModal();
                    });
                }

                return;
            }

            // Fetch drinks for BAC calculation (last 24 hours)
            const currentTime = new Date();
            const yesterday = new Date(currentTime);
            yesterday.setDate(yesterday.getDate() - 1);

            const formatLocalDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const startDate = formatLocalDate(yesterday);
            const endDate = formatLocalDate(currentTime);

            let drinksForBAC = [];
            try {
                drinksForBAC = await dbManager.getDrinksByDateRange(startDate, endDate);
                console.log(`[BAC] Fetched ${drinksForBAC.length} drinks from last 24h for BAC calculation`);
            } catch (error) {
                console.error('[BAC] Error fetching drinks for BAC:', error);
            }

            // Calculate BAC statistics with drinks explicitly passed
            const bacStats = await Utils.calculateBACStats(userWeight, userGender, currentTime, drinksForBAC);

            if (!bacStats) {
                section.innerHTML = `
                    <div class="section-header">
                        <h3>🍺 Estimation alcoolémie</h3>
                        <button class="info-btn" id="bac-info-btn" title="Informations sur l'estimation d'alcoolémie">ℹ️</button>
                    </div>
                    <div class="bac-error">
                        <p>Impossible de calculer l'alcoolémie. Vérifiez vos données de profil.</p>
                    </div>
                `;
                container.appendChild(section);
                return;
            }

            // Render BAC estimation with current values in mg/L
            const bacLevel = bacStats.currentBAC; // Already in mg/L from utils.js
            const bacLevelClass = this.getBACLevelClass(bacLevel);
            const bacLevelText = this.getBACLevelText(bacLevel);

            section.innerHTML = `
                <div class="section-header">
                    <h3>🍺 Estimation alcoolémie</h3>
                    <button class="info-btn" id="bac-info-btn" title="Informations sur l'estimation d'alcoolémie">ℹ️</button>
                </div>
                
                <div class="bac-main-display">
                    <div class="bac-gauge-container">
                        <div class="bac-gauge ${bacLevelClass}">
                            <div class="bac-value">${bacLevel.toFixed(0)}</div>
                            <div class="bac-unit">mg/L</div>
                        </div>
                        <div class="bac-status ${bacLevelClass}">
                            ${bacLevelText}
                        </div>
                    </div>
                </div>
                
                <div class="bac-times-grid">
                    <div class="bac-time-card">
                        <div class="time-icon">🕐</div>
                        <div class="time-info">
                            <div class="time-label">Sobriété complète (0 mg/L)</div>
                            <div class="time-value">${Utils.formatTimeToSobriety(bacStats.timeToSobriety)}</div>
                        </div>
                    </div>
                    <div class="bac-time-card">
                        <div class="time-icon">🚗</div>
                        <div class="time-info">
                            <div class="time-label">Conduite autorisée (< 500 mg/L)</div>
                            <div class="time-value">${Utils.formatTimeToSobriety(bacStats.timeToLegalLimit)}</div>
                        </div>
                    </div>
                </div>
                
                ${bacStats.relevantDrinks.length > 0 ? `
                <div class="bac-drinks-summary">
                    <h4>Consommations prises en compte (${bacStats.relevantDrinks.length})</h4>
                    <div class="relevant-drinks-list">
                        ${bacStats.relevantDrinks.slice(0, 3).map(drink => {
                const drinkTime = new Date(`${drink.date}T${drink.time}`);
                const hoursAgo = Math.round((new Date() - drinkTime) / (1000 * 60 * 60) * 10) / 10;
                return `
                                <div class="relevant-drink-item">
                                    <span class="drink-name">${drink.name}</span>
                                    <span class="drink-details">${Utils.formatQuantity(drink.quantity, drink.unit)} • ${drink.alcoholContent || 0}%</span>
                                    <span class="drink-time">il y a ${hoursAgo}h</span>
                                </div>
                            `;
            }).join('')}
                        ${bacStats.relevantDrinks.length > 3 ? `
                            <div class="more-drinks">+${bacStats.relevantDrinks.length - 3} autre${bacStats.relevantDrinks.length - 3 > 1 ? 's' : ''}</div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
                
                <div class="bac-disclaimer">
                    <p><strong>⚠️ Ces valeurs sont indicatives et ne remplacent pas un test certifié.</strong></p>
                </div>
            `;

            container.appendChild(section);

            // Add event listener for info button
            const bacInfoBtn = document.getElementById('bac-info-btn');
            if (bacInfoBtn) {
                bacInfoBtn.addEventListener('click', () => {
                    this.showBACInfoModal();
                });
            }

        } catch (error) {
            console.error('Error rendering BAC estimation:', error);
        }
    }

    // Get BAC level CSS class for styling (bacLevel in mg/L)
    getBACLevelClass(bacLevel) {
        if (bacLevel <= 50) return 'safe';        // 0-50 mg/L: Safe
        if (bacLevel <= 500) return 'caution';    // 50-500 mg/L: Caution (under legal limit)
        if (bacLevel <= 800) return 'warning';    // 500-800 mg/L: Warning (above legal limit)
        return 'danger';                          // >800 mg/L: Danger
    }

    // Get BAC level descriptive text (bacLevel in mg/L)
    getBACLevelText(bacLevel) {
        if (bacLevel <= 50) return 'Sobre';
        if (bacLevel <= 500) return 'Conduite autorisée';
        if (bacLevel <= 800) return 'Conduite interdite';
        return 'État d\'ébriété dangereux';
    }

    // Open profile settings
    openProfileSettings() {
        const settingsMenu = document.getElementById('settings-menu');
        if (settingsMenu) {
            settingsMenu.classList.add('active');

            // Focus on weight input
            setTimeout(() => {
                const weightInput = document.getElementById('user-weight');
                if (weightInput) {
                    weightInput.focus();
                }
            }, 300);
        }
    }

    // Show BAC information modal
    showBACInfoModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('bac-info-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'bac-info-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🍺 Estimation d'alcoolémie - Guide explicatif</h2>
                    <button class="modal-close" onclick="document.getElementById('bac-info-modal').remove()">&times;</button>
                </div>
                <div class="modal-body bac-info-content">
                    <div class="info-section">
                        <h3>🧮 Formule de Widmark</h3>
                        <p><strong>Ce que c'est :</strong> Formule scientifique standardisée pour estimer le taux d'alcoolémie.</p>
                        <p><strong>Formule utilisée :</strong></p>
                        <div class="formula-box">
                            <p>Taux (g/L) = [Alcool ingéré (g) / (Poids (kg) × r)] - (0,15 × Temps écoulé (h))</p>
                            <p><strong>r</strong> = 0,68 pour un homme, 0,55 pour une femme</p>
                        </div>
                        <p><strong>Élimination :</strong> 0,15 g/L par heure en moyenne</p>
                    </div>
                    
                    <div class="info-section">
                        <h3>📊 Calcul de l'alcool ingéré</h3>
                        <p><strong>Formule :</strong> Volume (L) × (% Alcool/100) × 0,8 × 1000</p>
                        <p><strong>Exemple :</strong> Une bière de 25cL à 5%</p>
                        <ul>
                            <li>0,25L × (5/100) × 0,8 × 1000 = 10g d'alcool pur</li>
                        </ul>
                        <p><strong>0,8</strong> = densité de l'éthanol</p>
                    </div>
                    
                    <div class="info-section">
                        <h3>⏱️ Temps de sobriété</h3>
                        <p><strong>Sobriété complète :</strong> Temps pour atteindre 0 g/L</p>
                        <p><strong>Conduite autorisée :</strong> Temps pour descendre sous 0,21 g/L (≈ 0,21‰)</p>
                        <p><strong>Calcul :</strong> (Taux actuel - Taux cible) ÷ 0,15</p>
                    </div>
                    
                    <div class="info-section">
                        <h3>🚗 Seuils légaux</h3>
                        <ul>
                            <li><strong>0,21 g/L (0,21‰) :</strong> Seuil pour jeunes conducteurs</li>
                            <li><strong>0,5 g/L (0,5‰) :</strong> Limite légale générale</li>
                            <li><strong>0,8 g/L (0,8‰) :</strong> Délit de conduite en état d'ivresse</li>
                        </ul>
                    </div>
                    
                    <div class="info-section">
                        <h3>🔍 Données prises en compte</h3>
                        <p>Le calcul inclut toutes les consommations des dernières 24 heures qui peuvent encore affecter votre taux d'alcoolémie.</p>
                        <p><strong>Facteurs considérés :</strong></p>
                        <ul>
                            <li>Volume et degré d'alcool de chaque boisson</li>
                            <li>Heure exacte de consommation</li>
                            <li>Votre poids et sexe</li>
                            <li>Temps écoulé depuis chaque consommation</li>
                        </ul>
                    </div>
                    
                    <div class="disclaimer">
                        <h4>⚠️ Avertissement important</h4>
                        <p><strong>Ces valeurs sont indicatives et ne remplacent pas un test certifié.</strong></p>
                        <p>L'alcoolémie peut varier selon de nombreux facteurs individuels :</p>
                        <ul>
                            <li>Métabolisme personnel</li>
                            <li>État de santé</li>
                            <li>Prise de médicaments</li>
                            <li>Fatigue et stress</li>
                            <li>Consommation de nourriture</li>
                        </ul>
                        <p><strong>En cas de doute, ne conduisez pas et utilisez un éthylotest certifié.</strong></p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="document.getElementById('bac-info-modal').remove()">Compris</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal when clicking backdrop
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            modal.remove();
        });

        // Close modal with Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Render location statistics and interactive map
    async renderLocationStats(container, locationStats) {
        if (!locationStats || !locationStats.stats) {
            return; // No location data available
        }

        const section = document.createElement('div');
        section.className = 'stats-section';
        section.innerHTML = `
            <h3>Carte interactive des consommations</h3>
            <div class="location-summary">
                <p>${locationStats.message}</p>
            </div>
        `;

        container.appendChild(section);

        // Add interactive map with all consumption markers
        this.renderInteractiveConsumptionMap(container, locationStats.stats);
    }

    // Render interactive consumption map with improved clustering
    renderInteractiveConsumptionMap(container, locationStats) {
        if (!locationStats || !locationStats.drinks || locationStats.drinks.length === 0) {
            const noLocationContainer = document.createElement('div');
            noLocationContainer.className = 'no-location-data';
            noLocationContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📍</div>
                    <p>Aucune donnée de localisation disponible pour cette période.</p>
                </div>
            `;
            container.appendChild(noLocationContainer);
            return;
        }

        const mapContainer = document.createElement('div');
        mapContainer.className = 'map-container';
        mapContainer.innerHTML = `
            <div id="interactive-consumption-map" class="interactive-consumption-map">
                <div class="map-controls-overlay">
                    <button id="recenter-map-btn" class="map-control-btn" title="Recentrer sur ma position">
                        <span class="control-icon">📍</span>
                    </button>
                </div>
            </div>
            <div class="map-controls">
                <div class="map-stats">
                    <span>${locationStats.drinks.length} consommation${locationStats.drinks.length > 1 ? 's' : ''} géolocalisée${locationStats.drinks.length > 1 ? 's' : ''}</span>
                </div>
            </div>
        `;

        container.appendChild(mapContainer);

        // Initialize map immediately after DOM insertion using requestAnimationFrame for better timing
        requestAnimationFrame(() => {
            this.initializeMapWithRetry(locationStats, 0);
        });
    }

    // Initialize map with retry mechanism for better reliability
    initializeMapWithRetry(locationStats, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = 500 * (retryCount + 1); // Exponential backoff

        try {
            this.initializeInteractiveMap(locationStats);
        } catch (error) {
            console.error(`Map initialization attempt ${retryCount + 1} failed:`, error);

            if (retryCount < maxRetries) {
                console.log(`Retrying map initialization in ${retryDelay}ms...`);
                setTimeout(() => {
                    this.initializeMapWithRetry(locationStats, retryCount + 1);
                }, retryDelay);
            } else {
                console.error('Map initialization failed after all retries');
                const mapElement = document.getElementById('interactive-consumption-map');
                if (mapElement) {
                    mapElement.innerHTML = `
                        <div class="map-error">
                            <p>Carte non disponible après plusieurs tentatives</p>
                            <p>Vérifiez votre connexion internet et rechargez la page.</p>
                        </div>
                    `;
                }
            }
        }
    }

    // Initialize interactive map with individual consumption markers
    initializeInteractiveMap(locationStats) {
        try {
            const mapElement = document.getElementById('interactive-consumption-map');
            if (!mapElement) {
                console.warn('Map element not found');
                return;
            }

            if (!locationStats.drinks || locationStats.drinks.length === 0) {
                console.warn('No location data available for map');
                return;
            }

            // Enhanced Leaflet verification with detailed logging
            console.log('Checking Leaflet availability...');
            console.log('L object:', typeof L);
            console.log('L.map function:', typeof L?.map);
            console.log('L.markerClusterGroup function:', typeof L?.markerClusterGroup);

            if (typeof L === 'undefined') {
                console.warn('Leaflet library not loaded, cannot display map');
                mapElement.innerHTML = `
                    <div class="map-error">
                        <p>Carte non disponible - Bibliothèque de cartographie manquante</p>
                        <p>Vérifiez votre connexion internet et rechargez la page.</p>
                    </div>
                `;
                return;
            }

            // Verify Leaflet map functionality including clustering
            if (typeof L.map !== 'function') {
                console.warn('Leaflet map functionality not available');
                mapElement.innerHTML = `
                    <div class="map-error">
                        <p>Carte non disponible - Fonctionnalités de cartographie incomplètes</p>
                        <p>La bibliothèque Leaflet n'est pas correctement chargée.</p>
                    </div>
                `;
                return;
            }

            // Check for marker clustering (optional)
            if (typeof L.markerClusterGroup !== 'function') {
                console.warn('Leaflet marker clustering not available, using basic markers');
                // Continue without clustering
            }

            // Clear any existing map content
            mapElement.innerHTML = '';

            // Get all drinks with location data and validate coordinates
            const drinksWithLocation = locationStats.drinks.filter(drink => {
                if (!drink.latitude || !drink.longitude) return false;

                const lat = parseFloat(drink.latitude);
                const lng = parseFloat(drink.longitude);

                // Validate coordinate ranges
                return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
                    !isNaN(lat) && !isNaN(lng);
            });

            if (drinksWithLocation.length === 0) {
                console.warn('No valid location coordinates found');
                mapElement.innerHTML = `
                    <div class="map-error">
                        <p>Aucune coordonnée de localisation valide trouvée</p>
                    </div>
                `;
                return;
            }

            // Performance optimization: limit markers for large datasets
            const maxMarkers = 500;
            const processedDrinks = drinksWithLocation.length > maxMarkers ?
                drinksWithLocation.slice(0, maxMarkers) : drinksWithLocation;

            if (processedDrinks.length !== drinksWithLocation.length) {
                console.warn(`Limited markers from ${drinksWithLocation.length} to ${maxMarkers} for performance`);
            }

            // Calculate center point from all consumption locations
            const centerLat = processedDrinks.reduce((sum, drink) => sum + parseFloat(drink.latitude), 0) / processedDrinks.length;
            const centerLng = processedDrinks.reduce((sum, drink) => sum + parseFloat(drink.longitude), 0) / processedDrinks.length;

            // Validate center coordinates
            if (!isFinite(centerLat) || !isFinite(centerLng)) {
                console.error('Invalid center coordinates calculated');
                return;
            }

            // Initialize map with error handling
            let map;
            try {
                map = L.map('interactive-consumption-map').setView([centerLat, centerLng], 12);
            } catch (error) {
                console.error('Error creating map:', error);
                mapElement.innerHTML = `
                    <div class="map-error">
                        <p>Erreur lors de la création de la carte</p>
                    </div>
                `;
                return;
            }

            // Add tile layer with error handling
            try {
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
                }).addTo(map);
            } catch (error) {
                console.error('Error adding tile layer:', error);
                mapElement.innerHTML = `
                    <div class="map-error">
                        <p>Erreur lors du chargement des tuiles de la carte</p>
                    </div>
                `;
                return;
            }

            // Create improved marker cluster group with better configuration
            let markers;
            try {
                markers = L.markerClusterGroup({
                    chunkedLoading: true,
                    chunkInterval: 200,
                    chunkDelay: 50,
                    disableClusteringAtZoom: 18,
                    maxClusterRadius: 50,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    zoomToBoundsOnClick: true,
                    spiderfyDistanceMultiplier: 1.5,
                    iconCreateFunction: function (cluster) {
                        const childCount = cluster.getChildCount();
                        let className = 'marker-cluster-small';
                        let size = 30;

                        if (childCount < 5) {
                            className = 'marker-cluster-small';
                            size = 30;
                        } else if (childCount < 15) {
                            className = 'marker-cluster-medium';
                            size = 35;
                        } else {
                            className = 'marker-cluster-large';
                            size = 40;
                        }

                        return new L.DivIcon({
                            html: '<div><span>' + childCount + '</span></div>',
                            className: 'marker-cluster ' + className,
                            iconSize: new L.Point(size, size)
                        });
                    }
                });
            } catch (error) {
                console.error('Error creating marker cluster group:', error);
                return;
            }

            // Group drinks by location with improved precision for better clustering
            const locationGroups = {};
            const precision = 4; // Better precision for grouping

            processedDrinks.forEach(drink => {
                try {
                    const lat = parseFloat(drink.latitude);
                    const lng = parseFloat(drink.longitude);
                    const locationKey = `${lat.toFixed(precision)},${lng.toFixed(precision)}`;

                    if (!locationGroups[locationKey]) {
                        locationGroups[locationKey] = {
                            latitude: lat,
                            longitude: lng,
                            drinks: [],
                            address: drink.address || 'Localisation inconnue'
                        };
                    }
                    locationGroups[locationKey].drinks.push(drink);
                } catch (error) {
                    console.warn('Error processing drink location:', error);
                }
            });

            // Add markers for each location group
            let markersAdded = 0;
            const locationKeys = Object.keys(locationGroups);

            for (const locationKey of locationKeys) {
                try {
                    const locationGroup = locationGroups[locationKey];
                    const drinkCount = locationGroup.drinks.length;

                    // Create enhanced popup content with better formatting
                    const drinksToShow = locationGroup.drinks.slice(0, 5);
                    const popupContent = `
                        <div class="map-popup enhanced">
                            <div class="popup-header">
                                <h4>${locationGroup.address}</h4>
                                <div class="popup-count">${drinkCount} consommation${drinkCount > 1 ? 's' : ''}</div>
                            </div>
                            <div class="popup-drinks">
                                ${drinksToShow.map(drink => `
                                    <div class="popup-drink-item">
                                        <div class="drink-main">
                                            <span class="drink-name">${drink.name}</span>
                                            <span class="drink-category">${drink.category}</span>
                                        </div>
                                        <div class="drink-meta">
                                            <span class="drink-datetime">${Utils.formatDate(drink.date)} ${drink.time}</span>
                                            ${drink.quantity && drink.unit ? `<span class="drink-quantity">${Utils.formatQuantity(drink.quantity, drink.unit)}</span>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                                ${locationGroup.drinks.length > 5 ? `
                                    <div class="popup-more">
                                        +${locationGroup.drinks.length - 5} autre${locationGroup.drinks.length - 5 > 1 ? 's' : ''}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;

                    // Create marker with improved styling based on consumption count
                    const marker = L.circleMarker([locationGroup.latitude, locationGroup.longitude], {
                        radius: Math.min(6 + Math.sqrt(drinkCount) * 1.5, 15),
                        fillColor: this.getInteractiveMarkerColor(drinkCount),
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8,
                        className: drinkCount > 1 ? 'location-cluster' : 'individual'
                    });

                    marker.bindPopup(popupContent, {
                        maxWidth: 320,
                        className: 'consumption-popup enhanced',
                        closeButton: true
                    });

                    // Add enhanced hover effects
                    marker.on('mouseover', function () {
                        this.setStyle({
                            fillOpacity: 1,
                            weight: 3,
                            radius: this.options.radius + 2
                        });
                    });

                    marker.on('mouseout', function () {
                        this.setStyle({
                            fillOpacity: 0.8,
                            weight: 2,
                            radius: this.options.radius - 2
                        });
                    });

                    // Add marker to cluster group
                    markers.addLayer(marker);
                    markersAdded++;

                } catch (error) {
                    console.warn('Error creating marker for location group:', error);
                }
            }

            console.log(`Added ${markersAdded} markers to cluster group`);

            // Add the cluster group to the map
            try {
                map.addLayer(markers);
            } catch (error) {
                console.error('Error adding markers to map:', error);
                return;
            }

            // Fit map to show all markers with padding
            try {
                if (locationKeys.length > 1) {
                    const bounds = markers.getBounds();
                    if (bounds.isValid()) {
                        map.fitBounds(bounds.pad(0.1));
                    }
                } else if (locationKeys.length === 1) {
                    // Single location - set appropriate zoom level
                    map.setZoom(15);
                }
            } catch (error) {
                console.warn('Error fitting map bounds:', error);
                // Fallback to default zoom
                map.setZoom(12);
            }

            // Store map reference for cleanup
            this.interactiveConsumptionMap = map;
            this.markersClusterGroup = markers;

            // Add recenter button functionality with error handling
            const recenterBtn = document.getElementById('recenter-map-btn');
            if (recenterBtn) {
                recenterBtn.addEventListener('click', () => {
                    this.recenterMap().catch(error => {
                        console.error('Error recentering map:', error);
                    });
                });
            }

            console.log('Interactive map initialized successfully');

        } catch (error) {
            console.error('Critical error initializing interactive map:', error);
            const mapElement = document.getElementById('interactive-consumption-map');
            if (mapElement) {
                mapElement.innerHTML = `
                    <div class="map-error">
                        <p>Erreur critique lors de l'initialisation de la carte</p>
                    </div>
                `;
            }
        }
    }

    // Legacy method removed - use initializeInteractiveMap instead
    // This method has been completely removed to avoid confusion and conflicts

    // Get marker color for interactive map based on consumption count
    getInteractiveMarkerColor(count) {
        if (count >= 10) return '#FF3B30'; // Red for very frequent locations
        if (count >= 5) return '#FF9500';  // Orange for frequent locations
        if (count >= 2) return '#FFCC00';  // Yellow for occasional locations
        return '#007AFF';                  // Blue for single consumption locations
    }

    // Recenter map on user's current position
    async recenterMap() {
        if (!this.interactiveConsumptionMap) {
            console.warn('No interactive map available to recenter');
            return;
        }

        try {
            // Get current position
            const position = await geoManager.getCurrentPosition();
            if (position && position.coords) {
                const { latitude, longitude } = position.coords;

                // Center map on current position with smooth animation
                this.interactiveConsumptionMap.setView([latitude, longitude], 15, {
                    animate: true,
                    duration: 1
                });

                // Add a temporary marker to show current position
                const currentPositionMarker = L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'current-position-marker',
                        html: '<div class="position-pulse"><span>📍</span></div>',
                        iconSize: [40, 40],
                        iconAnchor: [20, 40]
                    })
                }).addTo(this.interactiveConsumptionMap);

                // Remove marker after 5 seconds with fade effect
                setTimeout(() => {
                    if (this.interactiveConsumptionMap && this.interactiveConsumptionMap.hasLayer(currentPositionMarker)) {
                        this.interactiveConsumptionMap.removeLayer(currentPositionMarker);
                    }
                }, 5000);

                console.log('Map recentered on current position:', latitude, longitude);
            } else {
                Utils.showMessage('Impossible d\'obtenir votre position actuelle', 'error');
            }
        } catch (error) {
            console.error('Error recentering map:', error);
            Utils.showMessage('Erreur lors du recentrage de la carte', 'error');
        }
    }

    // Get marker color based on consumption count (legacy method)
    getMarkerColor(count) {
        if (count >= 5) return '#FF3B30'; // Red for frequent
        if (count >= 2) return '#FF9500'; // Orange for occasional
        return '#34C759'; // Green for rare
    }

    // Get marker CSS class based on consumption count
    getMarkerClass(count) {
        if (count >= 5) return 'frequent';
        if (count >= 2) return 'occasional';
        return 'rare';
    }

    // Render top locations list
    renderTopLocations(container, locations) {
        if (!locations.length) return;

        const listContainer = document.createElement('div');
        listContainer.className = 'top-locations';
        listContainer.innerHTML = `
            <h4 class="chart-title">Lieux les plus fréquentés</h4>
            <div class="locations-list">
                ${locations.slice(0, 5).map((location, index) => `
                    <div class="location-item">
                        <div class="location-rank">${index + 1}</div>
                        <div class="location-info">
                            <div class="location-address">${location.address || 'Localisation inconnue'}</div>
                            <div class="location-count">${location.count} boisson${location.count > 1 ? 's' : ''}</div>
                        </div>
                        <div class="location-marker ${this.getMarkerClass(location.count)}"></div>
                    </div>
                `).join('')}
            </div>
        `;

        container.appendChild(listContainer);
    }

    // Render category statistics
    async renderCategoryStats(container, categories) {
        if (Object.keys(categories).length === 0) return;

        const section = document.createElement('div');
        section.className = 'stats-section';
        section.innerHTML = `
            <h3>Analyse par catégorie</h3>
            <div class="category-stats">
                ${Object.entries(categories).map(([name, stats]) => `
                    <div class="category-stat-card">
                        <h4>${name}</h4>
                        <div class="category-details">
                            <div class="stat-row">
                                <span>Consommations:</span>
                                <strong>${stats.count}</strong>
                            </div>
                            <div class="stat-row">
                                <span>Volume total:</span>
                                <strong>${(stats.volume / 100).toFixed(1)}L</strong>
                            </div>
                            <div class="stat-row">
                                <span>Volume moyen:</span>
                                <strong>${(stats.avgVolume / 100).toFixed(1)}L</strong>
                            </div>
                            ${stats.avgAlcoholContent > 0 ? `
                            <div class="stat-row">
                                <span>Degré moyen:</span>
                                <strong>${stats.avgAlcoholContent}%</strong>
                            </div>
                            ` : ''}
                            <div class="stat-row">
                                <span>Boisson préférée:</span>
                                <strong>${stats.favoriteDrink}</strong>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        container.appendChild(section);
    }

    // Render individual drink statistics
    async renderIndividualDrinkStats(container, drinkStats) {
        if (Object.keys(drinkStats).length === 0) return;

        const section = document.createElement('div');
        section.className = 'stats-section';
        section.innerHTML = `
            <h3>Top 10 des boissons</h3>
            <div class="drink-stats">
                ${Object.entries(drinkStats).map(([name, stats], index) => `
                    <div class="drink-stat-item">
                        <div class="drink-rank">${index + 1}</div>
                        <div class="drink-info">
                            <div class="drink-name">${name}</div>
                            <div class="drink-details">
                                ${stats.count} fois • ${(stats.totalVolume / 100).toFixed(1)}L total
                                ${stats.lastConsumed ? ` • Dernière: ${Utils.formatDate(stats.lastConsumed)}` : ''}
                            </div>
                        </div>
                        <div class="drink-count">${stats.count}</div>
                    </div>
                `).join('')}
            </div>
        `;

        container.appendChild(section);
    }

    // Render category distribution chart
    renderCategoryDistributionChart(container, categories) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h4 class="chart-title">Répartition par catégorie</h4>
            <div class="chart-wrapper">
                <canvas id="category-chart"></canvas>
            </div>
        `;

        container.appendChild(chartContainer);

        // Create chart
        const ctx = document.getElementById('category-chart').getContext('2d');
        const labels = Object.keys(categories);
        const data = Object.values(categories);
        const colors = Utils.getChartColors(labels.length);

        this.charts.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Render hourly distribution chart
    renderHourlyDistributionChart(container, hourlyData) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h4 class="chart-title">Consommation par heure</h4>
            <div class="chart-wrapper">
                <canvas id="hourly-chart"></canvas>
            </div>
        `;

        container.appendChild(chartContainer);

        const ctx = document.getElementById('hourly-chart').getContext('2d');
        const labels = Object.keys(hourlyData).map(hour => `${hour}h`);
        const data = Object.values(hourlyData);

        this.charts.hourlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre de boissons',
                    data: data,
                    backgroundColor: Utils.hexToRgba('#007AFF', 0.7),
                    borderColor: '#007AFF',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Render daily distribution chart
    renderDailyDistributionChart(container, dailyData) {
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        chartContainer.innerHTML = `
            <h4 class="chart-title">Consommation par jour de la semaine</h4>
            <div class="chart-wrapper">
                <canvas id="daily-chart"></canvas>
            </div>
        `;

        container.appendChild(chartContainer);

        const ctx = document.getElementById('daily-chart').getContext('2d');

        // Debug: Log the incoming data
        console.log('Daily data received:', dailyData);

        // Ensure dailyData is a valid object
        if (!dailyData || typeof dailyData !== 'object') {
            console.warn('Invalid daily data received:', dailyData);
            chartContainer.innerHTML = `
                <h4 class="chart-title">Consommation par jour de la semaine</h4>
                <div class="no-data-message">
                    <p>Données de consommation non disponibles</p>
                </div>
            `;
            return;
        }

        // Ensure data is properly ordered from Monday (1) to Sunday (0)
        // dailyData uses keys 0-6 where 0=Sunday, 1=Monday, ..., 6=Saturday
        const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Monday to Sunday
        const labels = orderedDays.map(day => {
            try {
                return Utils.getDayName(day);
            } catch (error) {
                console.warn('Error getting day name for day', day, error);
                return `Jour ${day}`;
            }
        });

        const data = orderedDays.map(day => {
            const value = dailyData[day];
            // Ensure value is a valid number
            const numericValue = typeof value === 'number' && !isNaN(value) ? value : 0;
            console.log(`Day ${day} (${labels[orderedDays.indexOf(day)]}): ${numericValue}`);
            return numericValue;
        });

        console.log('Final data array:', data);
        console.log('Final labels array:', labels);

        // Ensure we have valid data and labels
        const hasData = data.some(value => value > 0);
        const hasValidLabels = labels.every(label => label && typeof label === 'string');

        if (!hasData || !hasValidLabels) {
            console.warn('No valid consumption data available for the chart');
            chartContainer.innerHTML = `
                <h4 class="chart-title">Consommation par jour de la semaine</h4>
                <div class="no-data-message">
                    <p>Aucune donnée de consommation disponible pour cette période</p>
                </div>
            `;
            return;
        }

        try {
            this.charts.dailyChart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Nombre de boissons',
                        data: data,
                        backgroundColor: Utils.hexToRgba('#34C759', 0.3),
                        borderColor: '#34C759',
                        borderWidth: 2,
                        pointBackgroundColor: '#34C759',
                        pointBorderColor: '#34C759',
                        pointRadius: 4, // Small visible points for connection
                        pointHoverRadius: 6, // Slightly larger on hover
                        fill: true, // Ensure the area is filled
                        tension: 0.1 // Smooth connections between points
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // Hide legend
                        },
                        tooltip: {
                            enabled: true,
                            callbacks: {
                                label: function (context) {
                                    const value = context.parsed.r;
                                    return value + ' boisson' + (value > 1 ? 's' : '');
                                }
                            }
                        }
                    },
                    scales: {
                        r: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                display: false,
                                maxTicksLimit: 5
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)',
                                lineWidth: 1
                            },
                            angleLines: {
                                color: 'rgba(0, 0, 0, 0.1)',
                                lineWidth: 1
                            },
                            pointLabels: {
                                font: {
                                    size: 12,
                                    weight: 'normal'
                                },
                                color: '#333'
                            }
                        }
                    },
                    elements: {
                        line: {
                            borderWidth: 2,
                            fill: true
                        },
                        point: {
                            hoverBorderWidth: 2
                        }
                    }
                }
            });

            console.log('Chart created successfully');
        } catch (error) {
            console.error('Error creating daily distribution chart:', error);
            chartContainer.innerHTML = `
                <h4 class="chart-title">Consommation par jour de la semaine</h4>
                <div class="error-message">
                    <p>Erreur lors de la création du graphique</p>
                </div>
            `;
        }
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

    // Cleanup charts and maps when switching periods
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

            // Clean up interactive map and all its components
            if (this.interactiveConsumptionMap) {
                try {
                    // Remove all event listeners from the map
                    this.interactiveConsumptionMap.off();
                    this.interactiveConsumptionMap.remove();
                } catch (error) {
                    console.warn('Error cleaning up interactive map:', error);
                }
                this.interactiveConsumptionMap = null;
            }

            // Clean up legacy map (if it exists)
            if (this.consumptionMap) {
                try {
                    this.consumptionMap.off();
                    this.consumptionMap.remove();
                } catch (error) {
                    console.warn('Error cleaning up legacy map:', error);
                }
                this.consumptionMap = null;
            }


            // Clean up any pending timeouts
            if (this.mapInitTimeout) {
                clearTimeout(this.mapInitTimeout);
                this.mapInitTimeout = null;
            }

            // Clean up any DOM event listeners that might have been added
            this.cleanupDOMEventListeners();

            console.log('Statistics cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
            // Continue with basic cleanup even if errors occur
            this.charts = {};
            this.interactiveConsumptionMap = null;
            this.consumptionMap = null;
        }
    }

    // Clean up DOM event listeners
    cleanupDOMEventListeners() {
        try {

            // Remove custom date picker event listener
            const applyBtn = document.getElementById('apply-custom-range');
            if (applyBtn) {
                const newBtn = applyBtn.cloneNode(true);
                applyBtn.parentNode.replaceChild(newBtn, applyBtn);
            }

            // Clean up any modal event listeners
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                const backdrop = modal.querySelector('.modal-backdrop');
                if (backdrop) {
                    const newBackdrop = backdrop.cloneNode(true);
                    backdrop.parentNode.replaceChild(newBackdrop, backdrop);
                }

                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    const newCloseBtn = closeBtn.cloneNode(true);
                    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                }
            });
        } catch (error) {
            console.warn('Error cleaning up DOM event listeners:', error);
        }
    }

    // Show health information modal
    showHealthInfoModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('health-info-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'health-info-modal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content health-info-modal">
                <div class="modal-header">
                    <h2>📊 Indicateurs de santé - Guide explicatif</h2>
                    <button class="modal-close" onclick="document.getElementById('health-info-modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="health-info-tabs">
                        <button class="health-tab-btn active" data-tab="alcohol-weekly">🍺 Alcool/semaine</button>
                        <button class="health-tab-btn" data-tab="who-comparison">🏥 vs. OMS</button>
                        <button class="health-tab-btn" data-tab="bac-estimation">🩸 Taux estimé</button>
                        <button class="health-tab-btn" data-tab="legal-limits">⚖️ Seuils légaux</button>
                    </div>
                    
                    <div class="health-info-content">
                        <div class="health-tab-content active" id="alcohol-weekly">
                            <div class="info-card">
                                <div class="info-header">
                                    <h3>🍺 Alcool pur consommé par semaine</h3>
                                    <div class="info-badge">Grammes d'éthanol</div>
                                </div>
                                <div class="info-body">
                                    <div class="definition-box">
                                        <h4>📋 Définition</h4>
                                        <p>Quantité totale d'alcool pur (éthanol) consommée par semaine, exprimée en grammes. Cet indicateur permet d'évaluer votre consommation selon les standards de santé publique.</p>
                                    </div>
                                    
                                    <div class="calculation-box">
                                        <h4>🧮 Méthode de calcul</h4>
                                        <div class="formula-step">
                                            <div class="step-number">1</div>
                                            <div class="step-content">
                                                <strong>Pour chaque boisson :</strong><br>
                                                Volume (cL) × Degré (%) × 0,8 ÷ 100 = Grammes d'alcool pur
                                            </div>
                                        </div>
                                        <div class="formula-step">
                                            <div class="step-number">2</div>
                                            <div class="step-content">
                                                <strong>Somme totale :</strong><br>
                                                Addition de tous les grammes d'alcool de la période
                                            </div>
                                        </div>
                                        <div class="formula-step">
                                            <div class="step-number">3</div>
                                            <div class="step-content">
                                                <strong>Moyenne hebdomadaire :</strong><br>
                                                Calcul proportionnel selon la durée de la période sélectionnée
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="example-box">
                                        <h4>💡 Exemple pratique</h4>
                                        <div class="example-calculation">
                                            <div class="example-drink">
                                                <span class="drink-icon">🍺</span>
                                                <div class="drink-details">
                                                    <strong>Bière 25cL à 5%</strong><br>
                                                    25 × 5 × 0,8 ÷ 100 = <strong>10g d'alcool pur</strong>
                                                </div>
                                            </div>
                                            <div class="example-drink">
                                                <span class="drink-icon">🍷</span>
                                                <div class="drink-details">
                                                    <strong>Vin 12cL à 12%</strong><br>
                                                    12 × 12 × 0,8 ÷ 100 = <strong>11,5g d'alcool pur</strong>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="coefficient-note">
                                            <strong>Note :</strong> 0,8 = densité de l'éthanol par rapport à l'eau
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="health-tab-content" id="who-comparison">
                            <div class="info-card">
                                <div class="info-header">
                                    <h3>🏥 Comparaison avec les recommandations OMS</h3>
                                    <div class="info-badge">Pourcentage de conformité</div>
                                </div>
                                <div class="info-body">
                                    <div class="definition-box">
                                        <h4>📋 Définition</h4>
                                        <p>Comparaison de votre consommation hebdomadaire avec les seuils recommandés par l'Organisation Mondiale de la Santé pour limiter les risques pour la santé.</p>
                                    </div>
                                    
                                    <div class="who-recommendations">
                                        <h4>📏 Recommandations OMS</h4>
                                        <div class="recommendation-grid">
                                            <div class="recommendation-card women">
                                                <div class="gender-icon">👩</div>
                                                <div class="recommendation-details">
                                                    <h5>Femmes</h5>
                                                    <div class="limit-value">140g/semaine</div>
                                                    <div class="limit-equivalent">≈ 14 verres standards</div>
                                                </div>
                                            </div>
                                            <div class="recommendation-card men">
                                                <div class="gender-icon">👨</div>
                                                <div class="recommendation-details">
                                                    <h5>Hommes</h5>
                                                    <div class="limit-value">210g/semaine</div>
                                                    <div class="limit-equivalent">≈ 21 verres standards</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="calculation-box">
                                        <h4>🧮 Calcul du pourcentage</h4>
                                        <div class="formula-display">
                                            (Votre consommation hebdomadaire ÷ Recommandation OMS) × 100
                                        </div>
                                    </div>
                                    
                                    <div class="interpretation-guide">
                                        <h4>📊 Interprétation des résultats</h4>
                                        <div class="interpretation-levels">
                                            <div class="level-item safe">
                                                <div class="level-indicator"></div>
                                                <div class="level-content">
                                                    <strong>0-50% :</strong> Consommation faible, risques limités
                                                </div>
                                            </div>
                                            <div class="level-item moderate">
                                                <div class="level-indicator"></div>
                                                <div class="level-content">
                                                    <strong>50-100% :</strong> Consommation modérée, dans les recommandations
                                                </div>
                                            </div>
                                            <div class="level-item warning">
                                                <div class="level-indicator"></div>
                                                <div class="level-content">
                                                    <strong>100-150% :</strong> Dépassement des recommandations, attention
                                                </div>
                                            </div>
                                            <div class="level-item danger">
                                                <div class="level-indicator"></div>
                                                <div class="level-content">
                                                    <strong>>150% :</strong> Consommation excessive, risques élevés
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="health-tab-content" id="bac-estimation">
                            <div class="info-card">
                                <div class="info-header">
                                    <h3>🩸 Estimation du taux d'alcoolémie</h3>
                                    <div class="info-badge">Formule de Widmark</div>
                                </div>
                                <div class="info-body">
                                    <div class="definition-box">
                                        <h4>📋 Définition</h4>
                                        <p>Estimation du taux d'alcool dans le sang lors de votre dernière session de consommation, basée sur la formule scientifique de Widmark.</p>
                                    </div>
                                    
                                    <div class="calculation-box">
                                        <h4>🧮 Formule de Widmark simplifiée</h4>
                                        <div class="formula-display">
                                            Taux (‰) = Alcool consommé (g) ÷ (Poids (kg) × Coefficient)
                                        </div>
                                        <div class="coefficient-table">
                                            <div class="coefficient-row">
                                                <span class="gender">👨 Hommes :</span>
                                                <span class="value">Coefficient = 0,68</span>
                                            </div>
                                            <div class="coefficient-row">
                                                <span class="gender">👩 Femmes :</span>
                                                <span class="value">Coefficient = 0,55</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="example-box">
                                        <h4>💡 Exemple de calcul</h4>
                                        <div class="example-scenario">
                                            <div class="scenario-details">
                                                <strong>Scénario :</strong> Homme de 70kg boit 2 bières de 25cL à 5%
                                            </div>
                                            <div class="calculation-steps">
                                                <div class="calc-step">
                                                    <span class="step-label">Alcool total :</span>
                                                    <span class="step-value">2 × 10g = 20g</span>
                                                </div>
                                                <div class="calc-step">
                                                    <span class="step-label">Calcul :</span>
                                                    <span class="step-value">20 ÷ (70 × 0,68) = 0,42‰</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="important-note">
                                        <div class="note-icon">ℹ️</div>
                                        <div class="note-content">
                                            <strong>Note importante :</strong> Cette estimation ne tient pas compte du temps écoulé depuis la consommation. Pour un calcul précis avec élimination progressive, utilisez la section "Estimation alcoolémie" avec vos données de profil configurées.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="health-tab-content" id="legal-limits">
                            <div class="info-card">
                                <div class="info-header">
                                    <h3>⚖️ Seuils légaux et repères</h3>
                                    <div class="info-badge">Législation française</div>
                                </div>
                                <div class="info-body">
                                    <div class="legal-limits-grid">
                                        <div class="limit-card safe">
                                            <div class="limit-icon">✅</div>
                                            <div class="limit-content">
                                                <h4>0,0‰</h4>
                                                <p><strong>Sobriété complète</strong></p>
                                                <p>Aucun alcool dans le sang</p>
                                            </div>
                                        </div>
                                        
                                        <div class="limit-card caution">
                                            <div class="limit-icon">⚠️</div>
                                            <div class="limit-content">
                                                <h4>0,2‰</h4>
                                                <p><strong>Jeunes conducteurs</strong></p>
                                                <p>Permis probatoire, conduite accompagnée</p>
                                            </div>
                                        </div>
                                        
                                        <div class="limit-card warning">
                                            <div class="limit-icon">🚫</div>
                                            <div class="limit-content">
                                                <h4>0,5‰</h4>
                                                <p><strong>Limite légale générale</strong></p>
                                                <p>Conduite interdite au-delà</p>
                                            </div>
                                        </div>
                                        
                                        <div class="limit-card danger">
                                            <div class="limit-icon">🚨</div>
                                            <div class="limit-content">
                                                <h4>0,8‰</h4>
                                                <p><strong>Délit pénal</strong></p>
                                                <p>Conduite en état d'ivresse</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="sanctions-info">
                                        <h4>⚖️ Sanctions encourues</h4>
                                        <div class="sanctions-table">
                                            <div class="sanction-row">
                                                <div class="sanction-level">0,5 - 0,8‰</div>
                                                <div class="sanction-details">
                                                    <strong>Contravention :</strong> Amende forfaitaire 135€, retrait de 6 points, suspension possible du permis
                                                </div>
                                            </div>
                                            <div class="sanction-row severe">
                                                <div class="sanction-level">> 0,8‰</div>
                                                <div class="sanction-details">
                                                    <strong>Délit :</strong> Jusqu'à 4500€ d'amende, 2 ans de prison, retrait de permis, stage obligatoire
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="effects-info">
                                        <h4>🧠 Effets sur l'organisme</h4>
                                        <div class="effects-timeline">
                                            <div class="effect-item">
                                                <div class="effect-level">0,2-0,5‰</div>
                                                <div class="effect-description">Euphorie légère, diminution des réflexes</div>
                                            </div>
                                            <div class="effect-item">
                                                <div class="effect-level">0,5-0,8‰</div>
                                                <div class="effect-description">Troubles de la coordination, vision altérée</div>
                                            </div>
                                            <div class="effect-item">
                                                <div class="effect-level">0,8-1,5‰</div>
                                                <div class="effect-description">Confusion, troubles de l'équilibre</div>
                                            </div>
                                            <div class="effect-item">
                                                <div class="effect-level">> 1,5‰</div>
                                                <div class="effect-description">Risque vital, coma éthylique possible</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="health-disclaimer">
                        <div class="disclaimer-icon">⚠️</div>
                        <div class="disclaimer-content">
                            <h4>Avertissement médical important</h4>
                            <p>Ces indicateurs sont fournis à titre informatif uniquement et ne remplacent pas un avis médical professionnel. Les calculs sont des estimations basées sur des formules générales et peuvent varier selon de nombreux facteurs individuels :</p>
                            <ul>
                                <li>Métabolisme personnel et génétique</li>
                                <li>État de santé général</li>
                                <li>Prise de médicaments</li>
                                <li>Fatigue et niveau de stress</li>
                                <li>Consommation de nourriture</li>
                                <li>Hydratation</li>
                            </ul>
                            <p><strong>En cas de préoccupations concernant votre consommation d'alcool, consultez un professionnel de santé.</strong></p>
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary" onclick="document.getElementById('health-info-modal').remove()">Fermer</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup tab functionality
        this.setupHealthInfoTabs(modal);

        // Close modal when clicking backdrop
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            modal.remove();
        });

        // Close modal with Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    // Setup health info tabs functionality
    setupHealthInfoTabs(modal) {
        const tabButtons = modal.querySelectorAll('.health-tab-btn');
        const tabContents = modal.querySelectorAll('.health-tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all buttons and contents
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to clicked button
                button.classList.add('active');

                // Show corresponding content
                const targetTab = button.dataset.tab;
                const targetContent = modal.querySelector(`#${targetTab}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }

    // Check if cached data can be used
    shouldUseCache(cacheKey, dateRange) {
        // Check if cache exists and is recent (less than 5 minutes old)
        if (!this.cache.stats ||
            !this.cache.lastUpdate ||
            !this.cache.lastCacheKey) {
            return false;
        }

        const cacheAge = Date.now() - this.cache.lastUpdate;
        const maxCacheAge = 5 * 60 * 1000; // 5 minutes

        // Check if cache is too old
        if (cacheAge > maxCacheAge) {
            return false;
        }

        // Check if same period and date range
        if (this.cache.lastPeriod !== this.currentPeriod ||
            this.cache.lastCacheKey !== cacheKey) {
            return false;
        }

        // Check if date range matches
        if (this.cache.lastDateRange.start !== dateRange.start ||
            this.cache.lastDateRange.end !== dateRange.end) {
            return false;
        }

        return true;
    }

    // Format duration in hours and minutes (e.g., "2h30")
    formatDuration(hoursDecimal) {
        if (!hoursDecimal || hoursDecimal <= 0) return '0h00';

        const hours = Math.floor(hoursDecimal);
        const minutes = Math.round((hoursDecimal - hours) * 60);

        // Format with leading zeros
        const formattedHours = hours.toString().padStart(1, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');

        return `${formattedHours}h${formattedMinutes}`;
    }


    // Export statistics as JSON
    async exportStatistics() {
        try {
            const dateRange = this.getDateRange();
            const drinks = await dbManager.getDrinksByDateRange(dateRange.start, dateRange.end);
            const stats = await this.calculateComprehensiveStats(drinks, dateRange);

            const exportData = {
                period: this.currentPeriod,
                dateRange: dateRange,
                generatedAt: new Date().toISOString(),
                statistics: stats
            };

            const filename = `alconote-stats-${dateRange.start}-${dateRange.end}.json`;
            Utils.downloadFile(JSON.stringify(exportData, null, 2), filename);

            Utils.showMessage('Statistiques exportées avec succès', 'success');

        } catch (error) {
            Utils.handleError(error, 'exporting statistics');
        }
    }
}

// Create global statistics manager instance
const statsManager = new StatisticsManager();

// Export for use in other modules
window.statsManager = statsManager;

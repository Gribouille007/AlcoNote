// Performance optimization utilities for AlcoNote PWA

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.pendingOperations = new Map();
        this.deferredUpdates = [];
        this.updateTimer = null;
    }

    // Cache frequently accessed data
    setCachedData(key, data, ttl = 300000) { // 5 minutes default TTL
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    getCachedData(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    clearCache(pattern = null) {
        if (pattern) {
            for (const [key] of this.cache) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            this.cache.clear();
        }
    }

    // Debounce expensive operations
    debounceOperation(key, operation, delay = 150) {
        if (this.pendingOperations.has(key)) {
            clearTimeout(this.pendingOperations.get(key));
        }

        const timeoutId = setTimeout(() => {
            operation();
            this.pendingOperations.delete(key);
        }, delay);

        this.pendingOperations.set(key, timeoutId);
    }

    // Batch DOM updates for better performance
    scheduleDOMUpdate(updateFn) {
        this.deferredUpdates.push(updateFn);
        
        if (this.updateTimer) return;
        
        this.updateTimer = requestAnimationFrame(() => {
            const updates = [...this.deferredUpdates];
            this.deferredUpdates.length = 0;
            this.updateTimer = null;
            
            // Execute all updates in a single frame
            updates.forEach(fn => fn());
        });
    }

    // Optimize drink addition with immediate UI feedback
    async optimizedDrinkAdd(drinkData, updateUICallback) {
        // Immediate UI feedback
        if (updateUICallback) {
            this.scheduleDOMUpdate(updateUICallback);
        }

        try {
            // Use cached location if available for speed
            if (!drinkData.location && geoManager) {
                const cachedLocation = geoManager.getLocationInstant();
                if (cachedLocation) {
                    drinkData.location = cachedLocation;
                } else {
                    // Fast location fetch with short timeout
                    try {
                        const quickLocation = await geoManager.getLocationForDrinkFast(300);
                        if (quickLocation) {
                            drinkData.location = quickLocation;
                        }
                    } catch (error) {
                        console.warn('Quick location failed, proceeding without location:', error);
                    }
                }
            }

            // Add drink to database
            const result = await dbManager.addDrink(drinkData);

            // Update caches
            this.clearCache('categories');
            this.clearCache('drinks');
            this.clearCache('history');

            // Background location enrichment if needed
            if (result && drinkData.location && !drinkData.location.address && geoManager) {
                this.scheduleBackgroundLocationEnrichment(result.id, drinkData.location);
            }

            return result;
        } catch (error) {
            console.error('Optimized drink add failed:', error);
            throw error;
        }
    }

    // Background location enrichment
    scheduleBackgroundLocationEnrichment(drinkId, location) {
        // Don't block UI for address resolution
        setTimeout(async () => {
            try {
                const address = await geoManager.reverseGeocode(location.latitude, location.longitude);
                await dbManager.updateDrink(drinkId, {
                    location: {
                        ...location,
                        address: address?.formatted || null
                    }
                });
                
                // Trigger a soft UI update if needed
                window.dispatchEvent(new CustomEvent('locationEnriched', {
                    detail: { drinkId, address }
                }));
            } catch (error) {
                console.warn('Background location enrichment failed:', error);
            }
        }, 100);
    }

    // Optimize category loading with caching
    async getOptimizedCategories() {
        const cached = this.getCachedData('categories');
        if (cached) return cached;

        try {
            const categories = await dbManager.getAllCategories();
            this.setCachedData('categories', categories);
            return categories;
        } catch (error) {
            console.error('Failed to get optimized categories:', error);
            return [];
        }
    }

    // Preload frequently used data
    async preloadData() {
        try {
            // Preload categories in background
            this.getOptimizedCategories();

            // Preload recent drinks for suggestions
            const recentDrinks = await dbManager.getAllDrinks();
            this.setCachedData('recent-drinks', recentDrinks.slice(0, 50));

            // Preload user settings
            const settings = await dbManager.getAllSettings();
            this.setCachedData('user-settings', settings);

        } catch (error) {
            console.warn('Data preloading failed:', error);
        }
    }

    // Optimize UI updates with virtual scrolling for large lists
    createVirtualScrollHandler(container, items, renderItem, itemHeight = 60) {
        const viewportHeight = container.clientHeight;
        const visibleCount = Math.ceil(viewportHeight / itemHeight) + 2; // Buffer
        let startIndex = 0;

        const updateView = () => {
            const scrollTop = container.scrollTop;
            startIndex = Math.floor(scrollTop / itemHeight);
            const endIndex = Math.min(startIndex + visibleCount, items.length);

            // Clear container
            container.innerHTML = '';

            // Create spacer for items before viewport
            if (startIndex > 0) {
                const spacerTop = document.createElement('div');
                spacerTop.style.height = `${startIndex * itemHeight}px`;
                container.appendChild(spacerTop);
            }

            // Render visible items
            for (let i = startIndex; i < endIndex; i++) {
                if (items[i]) {
                    const element = renderItem(items[i], i);
                    container.appendChild(element);
                }
            }

            // Create spacer for items after viewport
            const remainingItems = items.length - endIndex;
            if (remainingItems > 0) {
                const spacerBottom = document.createElement('div');
                spacerBottom.style.height = `${remainingItems * itemHeight}px`;
                container.appendChild(spacerBottom);
            }
        };

        container.addEventListener('scroll', () => {
            this.debounceOperation('virtual-scroll', updateView, 16); // 60fps
        });

        // Initial render
        updateView();

        return {
            update: (newItems) => {
                items = newItems;
                updateView();
            },
            destroy: () => {
                container.removeEventListener('scroll', updateView);
            }
        };
    }

    // Optimize image loading with lazy loading
    setupLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    // Optimize form submissions with optimistic updates
    async optimisticFormSubmit(form, submitHandler, optimisticUpdate) {
        try {
            // Apply optimistic update immediately
            if (optimisticUpdate) {
                optimisticUpdate();
            }

            // Submit form in background
            const result = await submitHandler(form);

            return result;
        } catch (error) {
            // Revert optimistic update on error
            if (optimisticUpdate && optimisticUpdate.revert) {
                optimisticUpdate.revert();
            }
            throw error;
        }
    }

    // Monitor performance metrics
    startPerformanceMonitoring() {
        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.duration > 50) {
                            console.warn(`Long task detected: ${entry.duration}ms`);
                        }
                    });
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });

                // Monitor layout shifts
                const clsObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (entry.value > 0.1) {
                            console.warn(`Layout shift detected: ${entry.value}`);
                        }
                    });
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });

            } catch (error) {
                console.warn('Performance monitoring setup failed:', error);
            }
        }
    }

    // Memory management
    cleanup() {
        // Clear caches
        this.cache.clear();

        // Cancel pending operations
        this.pendingOperations.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingOperations.clear();

        // Clear deferred updates
        if (this.updateTimer) {
            cancelAnimationFrame(this.updateTimer);
            this.updateTimer = null;
        }
        this.deferredUpdates.length = 0;
    }

    // Initialize performance optimizations
    init() {
        console.log('Initializing performance optimizations...');

        // Preload data
        this.preloadData();

        // Setup lazy loading
        this.setupLazyLoading();

        // Start performance monitoring
        this.startPerformanceMonitoring();

        // Setup cleanup on page unload
        window.addEventListener('beforeunload', () => this.cleanup());

        console.log('Performance optimizations initialized');
    }
}

// Create global performance optimizer instance
const performanceOptimizer = new PerformanceOptimizer();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => performanceOptimizer.init());
} else {
    performanceOptimizer.init();
}

// Export for use in other modules
window.performanceOptimizer = performanceOptimizer;

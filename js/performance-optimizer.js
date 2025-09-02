// Performance Optimizer for AlcoNote PWA
// Handles lazy loading, resource optimization, and performance monitoring

class PerformanceOptimizer {
    constructor() {
        this.isInitialized = false;
        this.lazyImages = [];
        this.intersectionObserver = null;
        this.performanceMetrics = {};
    }

    // Initialize performance optimizations
    init() {
        if (this.isInitialized) return;

        // Setup lazy loading
        this.setupLazyLoading();
        
        // Optimize images
        this.optimizeImages();
        
        // Setup resource hints
        this.setupResourceHints();
        
        // Monitor performance
        this.monitorPerformance();
        
        // Optimize animations
        this.optimizeAnimations();
        
        // Setup critical resource loading
        this.setupCriticalResourceLoading();

        this.isInitialized = true;
        console.log('Performance optimizer initialized');
    }

    // Setup lazy loading for images and content
    setupLazyLoading() {
        // Create intersection observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.loadLazyElement(entry.target);
                        this.intersectionObserver.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            // Observe lazy elements
            this.observeLazyElements();
        }
    }

    // Observe elements for lazy loading
    observeLazyElements() {
        // Lazy load images
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
            this.intersectionObserver.observe(img);
        });

        // Lazy load sections
        const lazySections = document.querySelectorAll('[data-lazy]');
        lazySections.forEach(section => {
            this.intersectionObserver.observe(section);
        });
    }

    // Load lazy element
    loadLazyElement(element) {
        if (element.tagName === 'IMG') {
            // Load lazy image
            const src = element.dataset.src;
            if (src) {
                element.src = src;
                element.classList.add('loaded');
                element.removeAttribute('data-src');
            }
        } else if (element.dataset.lazy) {
            // Load lazy content
            element.classList.add('lazy-loaded');
            element.removeAttribute('data-lazy');
        }
    }

    // Optimize images
    optimizeImages() {
        // Add loading="lazy" to images without it
        const images = document.querySelectorAll('img:not([loading])');
        images.forEach(img => {
            img.loading = 'lazy';
        });

        // Optimize image formats based on browser support
        this.optimizeImageFormats();
    }

    // Optimize image formats
    optimizeImageFormats() {
        // Check for WebP support
        const supportsWebP = this.supportsWebP();
        const supportsAVIF = this.supportsAVIF();

        if (supportsAVIF || supportsWebP) {
            const images = document.querySelectorAll('img[src$=".png"], img[src$=".jpg"], img[src$=".jpeg"]');
            images.forEach(img => {
                const originalSrc = img.src;
                let optimizedSrc = originalSrc;

                if (supportsAVIF) {
                    optimizedSrc = originalSrc.replace(/\.(png|jpg|jpeg)$/, '.avif');
                } else if (supportsWebP) {
                    optimizedSrc = originalSrc.replace(/\.(png|jpg|jpeg)$/, '.webp');
                }

                // Test if optimized version exists
                this.testImageExists(optimizedSrc).then(exists => {
                    if (exists) {
                        img.src = optimizedSrc;
                    }
                });
            });
        }
    }

    // Check WebP support
    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    // Check AVIF support
    supportsAVIF() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
    }

    // Test if image exists
    async testImageExists(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = src;
        });
    }

    // Setup resource hints
    setupResourceHints() {
        // Preload critical resources
        this.preloadCriticalResources();
        
        // Setup DNS prefetch for external domains
        this.setupDNSPrefetch();
        
        // Setup preconnect for critical origins
        this.setupPreconnect();
    }

    // Preload critical resources
    preloadCriticalResources() {
        const criticalResources = [
            { href: 'css/main.css', as: 'style' },
            { href: 'css/components.css', as: 'style' },
            { href: 'js/app.js', as: 'script' },
            { href: 'js/database.js', as: 'script' }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            if (resource.as === 'style') {
                link.onload = function() {
                    this.onload = null;
                    this.rel = 'stylesheet';
                };
            }
            document.head.appendChild(link);
        });
    }

    // Setup DNS prefetch
    setupDNSPrefetch() {
        const externalDomains = [
            'cdn.jsdelivr.net',
            'unpkg.com',
            'world.openfoodfacts.org',
            'nominatim.openstreetmap.org'
        ];

        externalDomains.forEach(domain => {
            const link = document.createElement('link');
            link.rel = 'dns-prefetch';
            link.href = `//${domain}`;
            document.head.appendChild(link);
        });
    }

    // Setup preconnect
    setupPreconnect() {
        const criticalOrigins = [
            'https://cdn.jsdelivr.net',
            'https://unpkg.com'
        ];

        criticalOrigins.forEach(origin => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = origin;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    // Monitor performance
    monitorPerformance() {
        if ('performance' in window) {
            // Monitor Core Web Vitals
            this.monitorCoreWebVitals();
            
            // Monitor resource loading
            this.monitorResourceLoading();
            
            // Monitor memory usage
            this.monitorMemoryUsage();
        }
    }

    // Monitor Core Web Vitals
    monitorCoreWebVitals() {
        // First Contentful Paint (FCP)
        this.measureFCP();
        
        // Largest Contentful Paint (LCP)
        this.measureLCP();
        
        // First Input Delay (FID)
        this.measureFID();
        
        // Cumulative Layout Shift (CLS)
        this.measureCLS();
    }

    // Measure First Contentful Paint
    measureFCP() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            this.performanceMetrics.fcp = entry.startTime;
                            console.log('FCP:', entry.startTime);
                        }
                    }
                });
                observer.observe({ entryTypes: ['paint'] });
            } catch (e) {
                console.warn('Could not observe FCP:', e);
            }
        }
    }

    // Measure Largest Contentful Paint
    measureLCP() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.performanceMetrics.lcp = lastEntry.startTime;
                    console.log('LCP:', lastEntry.startTime);
                });
                observer.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.warn('Could not observe LCP:', e);
            }
        }
    }

    // Measure First Input Delay
    measureFID() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.performanceMetrics.fid = entry.processingStart - entry.startTime;
                        console.log('FID:', this.performanceMetrics.fid);
                    }
                });
                observer.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                console.warn('Could not observe FID:', e);
            }
        }
    }

    // Measure Cumulative Layout Shift
    measureCLS() {
        if ('PerformanceObserver' in window) {
            try {
                let clsValue = 0;
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                    this.performanceMetrics.cls = clsValue;
                    console.log('CLS:', clsValue);
                });
                observer.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                console.warn('Could not observe CLS:', e);
            }
        }
    }

    // Monitor resource loading
    monitorResourceLoading() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const resources = performance.getEntriesByType('resource');
                const slowResources = resources.filter(resource => resource.duration > 1000);
                
                if (slowResources.length > 0) {
                    console.warn('Slow resources detected:', slowResources);
                    this.performanceMetrics.slowResources = slowResources;
                }
            }, 0);
        });
    }

    // Monitor memory usage
    monitorMemoryUsage() {
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                this.performanceMetrics.memory = {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit
                };

                // Warn if memory usage is high
                const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
                if (usagePercent > 80) {
                    console.warn('High memory usage detected:', usagePercent + '%');
                }
            }, 30000); // Check every 30 seconds
        }
    }

    // Optimize animations
    optimizeAnimations() {
        // Use requestAnimationFrame for smooth animations
        this.setupRAFAnimations();
        
        // Reduce animations on low-end devices
        this.adaptAnimationsToDevice();
        
        // Pause animations when not visible
        this.pauseAnimationsWhenHidden();
    }

    // Setup requestAnimationFrame animations
    setupRAFAnimations() {
        // Replace CSS transitions with RAF where appropriate
        const animatedElements = document.querySelectorAll('[data-animate]');
        animatedElements.forEach(element => {
            element.addEventListener('animationstart', () => {
                this.optimizeElementAnimation(element);
            });
        });
    }

    // Optimize element animation
    optimizeElementAnimation(element) {
        // Use transform and opacity for better performance
        element.style.willChange = 'transform, opacity';
        
        // Clean up after animation
        element.addEventListener('animationend', () => {
            element.style.willChange = 'auto';
        }, { once: true });
    }

    // Adapt animations to device capabilities
    adaptAnimationsToDevice() {
        // Reduce animations on low-end devices
        if (this.isLowEndDevice()) {
            document.body.classList.add('reduce-animations');
        }

        // Respect user's motion preferences
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.body.classList.add('reduce-animations');
        }
    }

    // Check if device is low-end
    isLowEndDevice() {
        // Check for low memory
        if ('memory' in performance && performance.memory.jsHeapSizeLimit < 1073741824) { // < 1GB
            return true;
        }

        // Check for slow connection
        if ('connection' in navigator) {
            const conn = navigator.connection;
            if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
                return true;
            }
        }

        // Check for low-end hardware indicators
        if ('hardwareConcurrency' in navigator && navigator.hardwareConcurrency <= 2) {
            return true;
        }

        return false;
    }

    // Pause animations when page is hidden
    pauseAnimationsWhenHidden() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                document.body.classList.add('paused-animations');
            } else {
                document.body.classList.remove('paused-animations');
            }
        });
    }

    // Setup critical resource loading
    setupCriticalResourceLoading() {
        // Load critical CSS inline
        this.inlineCriticalCSS();
        
        // Defer non-critical resources
        this.deferNonCriticalResources();
        
        // Setup progressive loading
        this.setupProgressiveLoading();
    }

    // Inline critical CSS
    inlineCriticalCSS() {
        // This would typically be done at build time
        // For now, we ensure critical styles are loaded first
        const criticalStyles = document.querySelectorAll('link[rel="stylesheet"]');
        criticalStyles.forEach((link, index) => {
            if (index < 2) { // First 2 stylesheets are critical
                link.media = 'all';
            } else {
                link.media = 'print';
                link.onload = function() {
                    this.media = 'all';
                };
            }
        });
    }

    // Defer non-critical resources
    deferNonCriticalResources() {
        // Defer non-critical scripts
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            if (!script.hasAttribute('defer') && !script.hasAttribute('async')) {
                // Only defer if not already marked as critical
                if (!script.src.includes('error-tracking') && 
                    !script.src.includes('database') && 
                    !script.src.includes('app')) {
                    script.defer = true;
                }
            }
        });
    }

    // Setup progressive loading
    setupProgressiveLoading() {
        // Load content progressively based on user interaction
        this.setupProgressiveContentLoading();
        
        // Load features on demand
        this.setupFeatureLoading();
    }

    // Setup progressive content loading
    setupProgressiveContentLoading() {
        // Load tab content only when accessed
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.loadTabContent(tabName);
            });
        });
    }

    // Load tab content
    loadTabContent(tabName) {
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent && !tabContent.dataset.loaded) {
            // Mark as loaded to prevent reloading
            tabContent.dataset.loaded = 'true';
            
            // Trigger content loading
            if (window.app && window.app.loadTabData) {
                window.app.loadTabData(tabName);
            }
        }
    }

    // Setup feature loading
    setupFeatureLoading() {
        // Load scanner only when needed
        this.setupLazyFeatureLoading('scanner', () => {
            return import('./scanner.js');
        });

        // Load statistics only when needed
        this.setupLazyFeatureLoading('statistics', () => {
            return import('./statistics.js');
        });
    }

    // Setup lazy feature loading
    setupLazyFeatureLoading(featureName, loader) {
        const featureButtons = document.querySelectorAll(`[data-feature="${featureName}"]`);
        featureButtons.forEach(button => {
            button.addEventListener('click', async () => {
                if (!window[featureName + 'Loaded']) {
                    try {
                        await loader();
                        window[featureName + 'Loaded'] = true;
                    } catch (error) {
                        console.error(`Failed to load ${featureName}:`, error);
                    }
                }
            });
        });
    }

    // Get performance metrics
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            connection: this.getConnectionInfo()
        };
    }

    // Get connection info
    getConnectionInfo() {
        if ('connection' in navigator) {
            const conn = navigator.connection;
            return {
                effectiveType: conn.effectiveType,
                downlink: conn.downlink,
                rtt: conn.rtt,
                saveData: conn.saveData
            };
        }
        return { online: navigator.onLine };
    }

    // Cleanup
    cleanup() {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
    }
}

// Create global performance optimizer instance
const performanceOptimizer = new PerformanceOptimizer();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        performanceOptimizer.init();
    });
} else {
    performanceOptimizer.init();
}

// Make available globally
window.performanceOptimizer = performanceOptimizer;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}

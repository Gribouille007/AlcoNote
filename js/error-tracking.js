// Error Tracking and Monitoring for AlcoNote PWA
// Provides comprehensive error handling and user feedback

class ErrorTracker {
    constructor() {
        this.errors = [];
        this.maxErrors = 100; // Keep last 100 errors
        this.isInitialized = false;
        this.userId = this.generateUserId();
    }

    // Initialize error tracking
    init() {
        if (this.isInitialized) return;

        // Global error handler
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            });
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'promise',
                message: event.reason ? event.reason.toString() : 'Unhandled promise rejection',
                stack: event.reason && event.reason.stack ? event.reason.stack : null,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            });
        });

        // Service Worker error handler
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('error', (event) => {
                this.logError({
                    type: 'serviceworker',
                    message: 'Service Worker error',
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                });
            });
        }

        // Network error monitoring
        this.monitorNetworkErrors();

        this.isInitialized = true;
        console.log('Error tracking initialized');
    }

    // Generate anonymous user ID for error tracking
    generateUserId() {
        let userId = localStorage.getItem('alconote-user-id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            localStorage.setItem('alconote-user-id', userId);
        }
        return userId;
    }

    // Log error with context
    logError(errorData) {
        const error = {
            id: this.generateErrorId(),
            userId: this.userId,
            ...errorData,
            context: this.getContext()
        };

        // Add to local error log
        this.errors.unshift(error);
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }

        // Store in localStorage for persistence
        this.saveErrorsToStorage();

        // Log to console in development
        if (this.isDevelopment()) {
            console.error('Error tracked:', error);
        }

        // Send to monitoring service (if configured)
        this.sendToMonitoringService(error);

        // Show user-friendly message for critical errors
        if (this.isCriticalError(error)) {
            this.showUserErrorMessage(error);
        }
    }

    // Generate unique error ID
    generateErrorId() {
        return 'err_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    // Get application context
    getContext() {
        return {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            connection: this.getConnectionInfo(),
            storage: this.getStorageInfo(),
            app: {
                version: '1.0.0',
                initialized: window.app ? window.app.isInitialized : false,
                currentTab: window.app ? window.app.currentTab : null
            }
        };
    }

    // Get connection information
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

    // Get storage information
    getStorageInfo() {
        try {
            return {
                localStorage: {
                    available: typeof Storage !== 'undefined',
                    used: JSON.stringify(localStorage).length
                },
                indexedDB: {
                    available: 'indexedDB' in window
                }
            };
        } catch (e) {
            return { error: 'Could not access storage info' };
        }
    }

    // Check if error is critical
    isCriticalError(error) {
        const criticalPatterns = [
            /database/i,
            /indexeddb/i,
            /serviceworker/i,
            /cannot read property/i,
            /is not defined/i
        ];

        return criticalPatterns.some(pattern => 
            pattern.test(error.message) || 
            (error.stack && pattern.test(error.stack))
        );
    }

    // Show user-friendly error message
    showUserErrorMessage(error) {
        if (window.Utils && window.Utils.showMessage) {
            let message = 'Une erreur inattendue s\'est produite.';
            
            if (error.message.includes('database') || error.message.includes('indexeddb')) {
                message = 'Problème de base de données. Vos données sont sécurisées.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                message = 'Problème de connexion. L\'application fonctionne hors ligne.';
            }

            window.Utils.showMessage(message, 'error');
        }
    }

    // Monitor network errors
    monitorNetworkErrors() {
        // Override fetch to monitor network requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // Log failed requests
                if (!response.ok) {
                    this.logError({
                        type: 'network',
                        message: `HTTP ${response.status}: ${response.statusText}`,
                        url: args[0],
                        status: response.status,
                        timestamp: new Date().toISOString()
                    });
                }
                
                return response;
            } catch (error) {
                this.logError({
                    type: 'network',
                    message: `Network error: ${error.message}`,
                    url: args[0],
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        };
    }

    // Save errors to localStorage
    saveErrorsToStorage() {
        try {
            const recentErrors = this.errors.slice(0, 20); // Keep only 20 most recent
            localStorage.setItem('alconote-errors', JSON.stringify(recentErrors));
        } catch (e) {
            console.warn('Could not save errors to storage:', e);
        }
    }

    // Load errors from localStorage
    loadErrorsFromStorage() {
        try {
            const stored = localStorage.getItem('alconote-errors');
            if (stored) {
                this.errors = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Could not load errors from storage:', e);
        }
    }

    // Send error to monitoring service (placeholder)
    sendToMonitoringService(error) {
        // In production, you would send to a service like Sentry, LogRocket, etc.
        // For now, we just store locally
        
        // Example implementation:
        /*
        if (this.isProduction() && this.monitoringEndpoint) {
            fetch(this.monitoringEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(error)
            }).catch(err => {
                console.warn('Could not send error to monitoring service:', err);
            });
        }
        */
    }

    // Check if in development mode
    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:';
    }

    // Check if in production mode
    isProduction() {
        return !this.isDevelopment();
    }

    // Get error statistics
    getErrorStats() {
        const stats = {
            total: this.errors.length,
            byType: {},
            recent: this.errors.slice(0, 10),
            critical: this.errors.filter(e => this.isCriticalError(e)).length
        };

        // Count by type
        this.errors.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
        });

        return stats;
    }

    // Clear error log
    clearErrors() {
        this.errors = [];
        localStorage.removeItem('alconote-errors');
    }

    // Manual error reporting
    reportError(message, context = {}) {
        this.logError({
            type: 'manual',
            message: message,
            context: context,
            timestamp: new Date().toISOString()
        });
    }

    // Performance monitoring
    monitorPerformance() {
        if ('performance' in window) {
            // Monitor page load time
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    if (perfData) {
                        const loadTime = perfData.loadEventEnd - perfData.loadEventStart;
                        
                        // Log slow page loads
                        if (loadTime > 3000) {
                            this.logError({
                                type: 'performance',
                                message: `Slow page load: ${loadTime}ms`,
                                loadTime: loadTime,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                }, 0);
            });

            // Monitor long tasks
            if ('PerformanceObserver' in window) {
                try {
                    const observer = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (entry.duration > 50) {
                                this.logError({
                                    type: 'performance',
                                    message: `Long task detected: ${entry.duration}ms`,
                                    duration: entry.duration,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                    });
                    observer.observe({ entryTypes: ['longtask'] });
                } catch (e) {
                    console.warn('Could not observe long tasks:', e);
                }
            }
        }
    }
}

// Create global error tracker instance
const errorTracker = new ErrorTracker();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        errorTracker.init();
        errorTracker.loadErrorsFromStorage();
        errorTracker.monitorPerformance();
    });
} else {
    errorTracker.init();
    errorTracker.loadErrorsFromStorage();
    errorTracker.monitorPerformance();
}

// Make available globally
window.errorTracker = errorTracker;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorTracker;
}

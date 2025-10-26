/**
 * Utility functions for AlcoNote PWA
 * Provides static methods for dates, calculations, UI, storage and more
 */
class Utils {

    // ========== DATE AND TIME UTILITIES ==========

    /**
     * Get current date in YYYY-MM-DD format (local timezone)
     * @returns {string} Current date string
     */
    static getCurrentDate() {
        // Use local date to avoid timezone issues
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Get current time in HH:MM format
     * @returns {string} Current time string
     */
    static getCurrentTime() {
        const now = new Date();
        // Get local time in HH:MM format
        return now.toTimeString().slice(0, 5);
    }

    /**
     * Format date to French long format with weekday
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @returns {string} Formatted date in French
     */
    static formatDate(dateString) {
        // Convert date string to Date object and format in French with weekday
        const date = new Date(dateString);
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return date.toLocaleDateString('fr-FR', options);
    }

    /**
     * Format time string (simple passthrough)
     * @param {string} timeString - Time in HH:MM format
     * @returns {string} Same time string
     */
    static formatTime(timeString) {
        // Return the time string as-is (no special formatting needed)
        return timeString;
    }

    /**
     * Format date and time combined in French short format
     * @param {string} dateString - Date in YYYY-MM-DD format
     * @param {string} timeString - Time in HH:MM format
     * @returns {string} Formatted date and time in French
     */
    static formatDateTime(dateString, timeString) {
        // Combine date and time into a Date object, then format in French
        const date = new Date(`${dateString}T${timeString}`);
        const options = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('fr-FR', options);
    }
    
    /**
     * Calculate start and end dates for given period
     * @param {string} period - 'today', 'week', 'month', 'year'
     * @param {Date} currentDate - Reference date
     * @returns {object} {start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'}
     */
    
    // Fixed version that ensures proper date ranges without overlapping
    static getDateRangeFixed(period, currentDate = new Date()) {
        // Improved date range calculation
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        
        switch (period) {
            case 'today':
                // Today: same day only
                break;
                
            case 'week':
                // Week: Monday to Sunday of the current week
                const dayOfWeek = start.getDay();
                const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as first day
                start.setDate(start.getDate() + mondayDiff);
                end.setDate(start.getDate() + 6);
                break;
                
            case 'month':
                // Month: First day to last day of current month
                start.setDate(1);
                end.setMonth(end.getMonth() + 1);
                end.setDate(0); // Last day of current month
                break;
                
            case 'year':
                // Year: January 1st to December 31st of current year
                start.setMonth(0, 1);
                end.setMonth(11, 31);
                break;
                
            default:
                // Default to today
                break;
        }
        
        // Use local date formatting to avoid timezone issues
        const formatLocalDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        return {
            start: formatLocalDate(start),
            end: formatLocalDate(end)
        };
    }
    
    static addDays(date, days) {
        // Create new date with days added
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    
    static getDayName(dayIndex) {
        // Get French day name from 0-6 index
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        return days[dayIndex];
    }
    
    // Quantity and unit conversions
    /**
     * Convert any drink quantity from its unit to standard centiliters
     * For standardizing volume calculations across different unit types
     * @param {number} quantity - The quantity value
     * @param {string} unit - The unit ('EcoCup', 'L', 'cL')
     * @returns {object} Object with quantity in cL and unit: 'cL'
     */
    static convertToStandardUnit(quantity, unit) {
        // Normalize quantity to centiliters for alcohol calculations
        switch (unit) {
            case 'EcoCup':  // French drinking cup, assumed to be 25cL
                return { quantity: 25, unit: 'cL' };
            case 'L':  // Liters to centiliters
                return { quantity: quantity * 100, unit: 'cL' };
            case 'cL':  // Already in centiliters
            default:
                return { quantity, unit: 'cL' };
        }
    }
    
    static formatQuantity(quantity, unit) {
        // Format quantity with proper unit and plural
        if (unit === 'EcoCup') {
            return `${quantity} EcoCup${quantity > 1 ? 's' : ''}`;
        }
        return `${quantity} ${unit}`;
    }
    
    // Alcohol calculations
    static calculateAlcoholGrams(volumeCL, alcoholPercent) {
        // Calculate grams of pure alcohol in drink
        return (volumeCL * alcoholPercent * 0.8) / 10;
    }
    
    static calculateBAC(alcoholGrams, weightKg, gender, hours = 0) {
        // Calculate blood alcohol concentration
        const r = gender === 'female' ? 0.55 : 0.68; // Body water percentage
        // Correct formula: BAC (g/L) = (Alcohol (g) / (Weight (kg) × r)) - (0.15 × hours)
        const bacGL = (alcoholGrams / (weightKg * r)) - (0.15 * hours);
        const bacMgL = bacGL * 1000; // Convert g/L to mg/L
        return Math.max(0, bacMgL);
    }
    
    static calculateCurrentBAC(drinks, weightKg, gender, currentTime = new Date()) {
        // Calculate current BAC from drinks (cul sec assumption)
        if (!drinks || drinks.length === 0 || !weightKg || !gender) {
            return 0;
        }

        const r = gender === 'female' ? 0.55 : 0.68;
        let totalBACGL = 0;

        drinks.forEach(drink => {
            // Convert unit to cL
            const volumeInCL = this.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            // Alcohol grams for this drink
            const alcoholGrams = this.calculateAlcoholGrams(volumeInCL, drink.alcoholContent || 0);
            if (alcoholGrams <= 0) return;

            // Peak BAC contribution for this drink (g/L)
            const peakBACGL = alcoholGrams / (weightKg * r);

            // Time since this drink (hours)
            const drinkDateTime = new Date(`${drink.date}T${drink.time}`);
            const hoursElapsed = isNaN(drinkDateTime) ? 0 : Math.max(0, (currentTime - drinkDateTime) / (1000 * 60 * 60));

            // Apply elimination for this drink
            const currentBACGL = Math.max(0, peakBACGL - (0.15 * hoursElapsed));

            // Add this drink's contribution
            totalBACGL += currentBACGL;
        });

        // Convert g/L to mg/L
        return totalBACGL * 1000;
    }

    
    static calculateTimeToBAC(currentBACMgL, targetBACMgL = 0) {
        // Calculate time to reach target BAC
        if (currentBACMgL <= targetBACMgL) {
            return 0;
        }
        
        // Convert mg/L to g/L for calculation
        const currentBACGL = currentBACMgL / 1000;
        const targetBACGL = targetBACMgL / 1000;
        
        // Time = (Current BAC - Target BAC) / Elimination rate (0.15 g/L per hour)
        const hoursNeeded = (currentBACGL - targetBACGL) / 0.15;
        return Math.max(0, hoursNeeded);
    }
    
    // Get drinks from current day and previous day that might still affect BAC
    static async getRelevantDrinksForBAC(currentTime = new Date()) {
        // Get drinks that affect BAC (last 24h)
        const yesterday = new Date(currentTime);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const startDate = yesterday.toISOString().split('T')[0];
        const endDate = currentTime.toISOString().split('T')[0];
        
        try {
            const drinks = await dbManager.getDrinksByDateRange(startDate, endDate);
            
            // Filter drinks that could still have an effect (within reasonable elimination time)
            return drinks.filter(drink => {
                const drinkDateTime = new Date(`${drink.date}T${drink.time}`);
                const hoursElapsed = (currentTime - drinkDateTime) / (1000 * 60 * 60);
                
                // Only include drinks from last 24 hours that could still have measurable effect
                return hoursElapsed >= 0 && hoursElapsed <= 24;
            });
        } catch (error) {
            console.error('Error getting relevant drinks for BAC:', error);
            return [];
        }
    }
    
    static async calculateBACStats(weightKg, gender, currentTime = new Date(), drinks = []) {
        // Calculate comprehensive BAC statistics using provided drinks rather than DB lookups
        if (!weightKg || !gender) {
            return null;
        }

        // If no drinks provided, fallback to last 24 hours
        const relevantDrinks = drinks.length
            ? drinks.filter(drink => {
                if (!drink.date || !drink.time) return false;
                const drinkDateTime = new Date(`${drink.date}T${drink.time}`);
                const hoursElapsed = (currentTime - drinkDateTime) / (1000 * 60 * 60);
                return hoursElapsed >= 0 && hoursElapsed <= 24;
            })
            : await this.getRelevantDrinksForBAC(currentTime);

        // Calculate BAC from relevant drinks
        const currentBACMgL = this.calculateCurrentBAC(relevantDrinks, weightKg, gender, currentTime);

        // Time to complete sobriety (0 mg/L)
        const timeToSobriety = this.calculateTimeToBAC(currentBACMgL, 0);

        // Time to legal limit - Belgium: 500 mg/L (0.5‰)
        const legalLimit = 500;
        const timeToLegalLimit = this.calculateTimeToBAC(currentBACMgL, legalLimit);

        return {
            currentBAC: Math.round(currentBACMgL * 100) / 100,
            timeToSobriety,
            timeToLegalLimit: Math.max(0, timeToLegalLimit),
            relevantDrinks,
            isAboveLegalLimit: currentBACMgL > legalLimit
        };
    }
    
    // Format time in hours to human readable format
    static formatTimeToSobriety(hours) {
        // Format time to sobriety in human readable format
        if (hours <= 0) return "Maintenant";

        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        if (wholeHours === 0) return `${minutes} min`;
        if (minutes === 0) return `${wholeHours}h`;
        return `${wholeHours}h ${minutes}min`;
    }

    
    static getWHORecommendation(gender) {
        // Get WHO recommended alcohol limit
        return gender === 'female' ? 140 : 210;
    }

    // Statistics utilities
    static calculateAverage(values) {
        // Calculate arithmetic mean of values
        if (values.length === 0) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    static calculateMedian(values) {
        // Calculate median of values
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    }

    static calculatePercentile(values, percentile) {
        // Calculate specific percentile
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = (percentile / 100) * (sorted.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;

        if (upper >= sorted.length) return sorted[sorted.length - 1];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
    
    // UI utilities
    static showMessage(message, type = 'info', duration = 3000) {
        // Show temporary message to user
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type} animate-slide-down`;
        messageEl.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="margin-left: auto; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, duration);
    }

    static showLoading(container, text = 'Chargement...') {
        // Show loading spinner over element
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-overlay';
        loadingEl.innerHTML = `
            <div>
                <div class="spinner"></div>
                <div class="loading-text">${text}</div>
            </div>
        `;
        container.appendChild(loadingEl);
        return loadingEl;
    }

    static hideLoading(loadingEl) {
        // Hide loading spinner
        if (loadingEl && loadingEl.parentElement) {
            loadingEl.remove();
        }
    }

    static debounce(func, wait) {
        // Delay function execution until no calls for wait time
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        // Limit function execution frequency
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Modal utilities
    static openModal(modalId) {
        // Show modal dialog
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Focus first input if available
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    static closeModal(modalId) {
        // Hide modal dialog
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    static closeAllModals() {
        // Hide all open modals
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    // Form utilities
    static getFormData(formElement) {
        // Extract data from form inputs
        const formData = new FormData(formElement);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            // Handle checkboxes and multiple values
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        return data;
    }
    
    static resetForm(formElement) {
        // Clear form and remove validation states
        formElement.reset();

        // Clear any validation states
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.classList.remove('error', 'valid');
        });
    }

    static validateForm(formElement) {
        // Check if required fields are filled
        const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('error');
                isValid = false;
            } else {
                input.classList.remove('error');
                input.classList.add('valid');
            }
        });

        return isValid;
    }

    // Storage utilities
    static saveToLocalStorage(key, data) {
        // Save object to browser storage
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    static getFromLocalStorage(key, defaultValue = null) {
        // Retrieve object from browser storage
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    static removeFromLocalStorage(key) {
        // Delete item from browser storage
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }
    
    // File utilities
    static downloadFile(content, filename, contentType = 'application/json') {
        // Trigger file download with blob
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }

    static readFile(file) {
        // Read text content from file
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // Color utilities for charts
    static getChartColors(count) {
        // Generate color array for charts
        const colors = [
            '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6',
            '#00C7BE', '#FF2D92', '#A2845E', '#8E8E93', '#AEAEB2'
        ];

        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    static hexToRgba(hex, alpha = 1) {
        // Convert hex color to rgba with alpha
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Touch/Pointer gesture utilities (robust swipe detection)
    static addSwipeListener(element, onSwipeLeft, onSwipeRight, threshold = 30) {
        // Improved swipe detection with pointer events fallback to touch
        // - Uses direction lock (horizontal vs vertical)
        // - Works even if no touchmove fires (uses changedTouches/pointerup coords)
        // - Lower threshold for reliability on small screens

        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastY = 0;
        let startTime = 0;
        let directionLocked = null; // 'horizontal' | 'vertical' | null
        let activePointerId = null;

        const reset = () => {
            directionLocked = null;
            activePointerId = null;
            element.classList.remove('swipe-left');
        };

        const handleMove = (currentX, currentY) => {
            const deltaX = currentX - startX;
            const deltaY = Math.abs(currentY - startY);

            // Lock direction after small movement to avoid scroll conflicts
            if (!directionLocked) {
                if (Math.abs(deltaX) > 10 && deltaY < Math.abs(deltaX)) {
                    directionLocked = 'horizontal';
                } else if (deltaY > 10) {
                    directionLocked = 'vertical';
                }
            }

            if (directionLocked === 'horizontal') {
                // Visual feedback while swiping
                if (deltaX < 0) {
                    element.classList.add('swipe-left');
                } else {
                    element.classList.remove('swipe-left');
                }
            }

            lastX = currentX;
            lastY = currentY;
        };

        const handleEnd = (endX, endY) => {
            const deltaX = endX - startX;
            const deltaY = Math.abs(endY - startY);

            if (directionLocked === 'horizontal' || (Math.abs(deltaX) > threshold && deltaY < threshold)) {
                if (deltaX < -threshold && typeof onSwipeLeft === 'function') {
                    onSwipeLeft(element);
                } else if (deltaX > threshold && typeof onSwipeRight === 'function') {
                    onSwipeRight(element);
                }
            }

            reset();
        };

        if (window.PointerEvent) {
            // Pointer events path (covers mouse, touch, pen)
            element.addEventListener('pointerdown', (e) => {
                // Only track primary pointer and ignore right-click
                if (!e.isPrimary || e.button !== 0) return;
                activePointerId = e.pointerId;
                startX = e.clientX;
                startY = e.clientY;
                lastX = startX;
                lastY = startY;
                startTime = performance.now();
                directionLocked = null;
            });

            element.addEventListener('pointermove', (e) => {
                if (!e.isPrimary || activePointerId !== e.pointerId) return;
                handleMove(e.clientX, e.clientY);
            });

            element.addEventListener('pointerup', (e) => {
                if (!e.isPrimary || activePointerId !== e.pointerId) return;
                handleEnd(e.clientX, e.clientY);
            });

            element.addEventListener('pointercancel', reset);
            element.addEventListener('pointerleave', () => {
                // If pointer leaves and we had a significant left swipe, still handle it
                if (directionLocked === 'horizontal') {
                    handleEnd(lastX, lastY);
                } else {
                    reset();
                }
            });
        } else {
            // Touch events fallback
            element.addEventListener('touchstart', (e) => {
                if (e.touches.length > 1) return; // ignore multi-touch
                const t = e.touches[0];
                startX = t.clientX;
                startY = t.clientY;
                lastX = startX;
                lastY = startY;
                startTime = performance.now();
                directionLocked = null;
            }, { passive: true });

            element.addEventListener('touchmove', (e) => {
                if (e.touches.length > 1) return;
                const t = e.touches[0];
                handleMove(t.clientX, t.clientY);
            }, { passive: true });

            element.addEventListener('touchend', (e) => {
                const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : { clientX: lastX, clientY: lastY };
                // Ensure we have valid last positions even if no move fired
                const endX = t.clientX ?? lastX;
                const endY = t.clientY ?? lastY;
                handleEnd(endX, endY);
            }, { passive: true });

            element.addEventListener('touchcancel', reset, { passive: true });
        }
    }

    // URL utilities
    static getURLParams() {
        // Parse URL query parameters
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (let [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    }

    static updateURL(params) {
        // Update browser URL with new params
        const url = new URL(window.location);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.set(key, params[key]);
            } else {
                url.searchParams.delete(key);
            }
        });
        window.history.replaceState({}, '', url);
    }

    // Device utilities
    static isMobile() {
        // Check if viewport is mobile width
        return window.innerWidth <= 768;
    }

    static isTablet() {
        // Check if viewport is tablet width
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }

    static isDesktop() {
        // Check if viewport is desktop width
        return window.innerWidth > 1024;
    }

    static isTouchDevice() {
        // Check if device supports touch
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    static isStandalone() {
        // Check if running as PWA
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }

    // Animation utilities
    static animateValue(element, start, end, duration, formatter = (val) => val) {
        // Animate number display with easing
        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = start + (end - start) * easeOut;

            element.textContent = formatter(Math.round(current));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }

        requestAnimationFrame(animate);
    }

    // Error handling utilities
    static handleError(error, context = '') {
        // Log error and show user message
        console.error(`Error in ${context}:`, error);

        let message = 'Une erreur est survenue';
        if (error.message) {
            message = error.message;
        }

        this.showMessage(message, 'error');
    }

    // Performance utilities
    static measurePerformance(name, fn) {
        // Time synchronous function execution
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }

    static async measureAsyncPerformance(name, fn) {
        // Time async function execution
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
}

// Export Utils class to global scope
window.Utils = Utils;

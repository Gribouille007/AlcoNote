// Utility functions for AlcoNote PWA

class Utils {
    // Date and time utilities
    static getCurrentDate() {
        // Use local date to avoid timezone issues
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    static getCurrentTime() {
        const now = new Date();
        // Get local time in HH:MM format
        return now.toTimeString().slice(0, 5);
    }
    
    static formatDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('fr-FR', options);
    }
    
    static formatTime(timeString) {
        return timeString;
    }
    
    static formatDateTime(dateString, timeString) {
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
    
    static getDateRange(period, currentDate = new Date()) {
        const start = new Date(currentDate);
        const end = new Date(currentDate);
        
        switch (period) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'week':
                const dayOfWeek = start.getDay();
                const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday as first day
                start.setDate(diff);
                start.setHours(0, 0, 0, 0);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'month':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(start.getMonth() + 1);
                end.setDate(0);
                end.setHours(23, 59, 59, 999);
                break;
                
            case 'year':
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                end.setMonth(11, 31);
                end.setHours(23, 59, 59, 999);
                break;
                
            default:
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
        }
        
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }
    
    // Fixed version that ensures proper date ranges without overlapping
    static getDateRangeFixed(period, currentDate = new Date()) {
        // Create new date objects to avoid modifying the original
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
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }
    
    static getDayName(dayIndex) {
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        return days[dayIndex];
    }
    
    // Quantity and unit conversions
    static convertToStandardUnit(quantity, unit) {
        switch (unit) {
            case 'EcoCup':
                return { quantity: 25, unit: 'cL' };
            case 'L':
                return { quantity: quantity * 100, unit: 'cL' };
            case 'cL':
            default:
                return { quantity, unit: 'cL' };
        }
    }
    
    static formatQuantity(quantity, unit) {
        if (unit === 'EcoCup') {
            return `${quantity} EcoCup${quantity > 1 ? 's' : ''}`;
        }
        return `${quantity} ${unit}`;
    }
    
    // Alcohol calculations
    static calculateAlcoholGrams(volumeCL, alcoholPercent) {
        // Formula: Volume (cL) × Alcohol % × 0.8 (density of ethanol) / 10
        // This gives the correct alcohol grams for BAC calculations
        return (volumeCL * alcoholPercent * 0.8) / 10;
    }
    
    static calculateBAC(alcoholGrams, weightKg, gender, hours = 0) {
        // Widmark formula - result in mg/L
        const r = gender === 'female' ? 0.55 : 0.68; // Body water percentage
        // Correct formula: BAC (g/L) = (Alcohol (g) / (Weight (kg) × r)) - (0.15 × hours)
        const bacGL = (alcoholGrams / (weightKg * r)) - (0.15 * hours);
        const bacMgL = bacGL * 1000; // Convert g/L to mg/L
        return Math.max(0, bacMgL);
    }
    
    // Enhanced BAC calculation for multiple drinks with time consideration - result in mg/L
    static calculateCurrentBAC(drinks, weightKg, gender, currentTime = new Date()) {
        if (!drinks || drinks.length === 0 || !weightKg || !gender) {
            return 0;
        }
        
        const r = gender === 'female' ? 0.55 : 0.68;
        let totalAlcoholGrams = 0;
        let earliestDrinkTime = null;
        
        // Calculate total alcohol and find earliest drink time
        drinks.forEach(drink => {
            const volumeInCL = this.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            const alcoholGrams = this.calculateAlcoholGrams(volumeInCL, drink.alcoholContent || 0);
            totalAlcoholGrams += alcoholGrams;
            
            const drinkDateTime = new Date(`${drink.date}T${drink.time}`);
            if (!earliestDrinkTime || drinkDateTime < earliestDrinkTime) {
                earliestDrinkTime = drinkDateTime;
            }
        });
        
        // Calculate peak BAC (without elimination)
        const peakBACGL = totalAlcoholGrams / (weightKg * r);
        
        // Calculate time elapsed since first drink
        const hoursElapsed = earliestDrinkTime ? 
            Math.max(0, (currentTime - earliestDrinkTime) / (1000 * 60 * 60)) : 0;
        
        // Apply elimination from peak BAC
        const currentBACGL = Math.max(0, peakBACGL - (0.15 * hoursElapsed));
        
        // Convert g/L to mg/L
        return currentBACGL * 1000;
    }
    
    // Calculate time to reach target BAC level (BAC in mg/L)
    static calculateTimeToBAC(currentBACMgL, targetBACMgL = 0) {
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
        // Get drinks from last 24 hours that could still affect BAC
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
    
    // Calculate comprehensive BAC statistics (all values in mg/L)
    static async calculateBACStats(weightKg, gender, currentTime = new Date()) {
        if (!weightKg || !gender) {
            return null;
        }
        
        const relevantDrinks = await this.getRelevantDrinksForBAC(currentTime);
        const currentBACMgL = this.calculateCurrentBAC(relevantDrinks, weightKg, gender, currentTime);
        
        // Time to complete sobriety (0 mg/L)
        const timeToSobriety = this.calculateTimeToBAC(currentBACMgL, 0);
        
        // Time to legal limit - Belgium: 500 mg/L (0.5‰) for general drivers
        const legalLimit = 500; // mg/L
        const timeToLegalLimit = this.calculateTimeToBAC(currentBACMgL, legalLimit);
        
        return {
            currentBAC: Math.round(currentBACMgL * 100) / 100, // Round to 2 decimal places in mg/L
            timeToSobriety: timeToSobriety,
            timeToLegalLimit: Math.max(0, timeToLegalLimit),
            relevantDrinks: relevantDrinks,
            isAboveLegalLimit: currentBACMgL > legalLimit
        };
    }
    
    // Format time in hours to human readable format
    static formatTimeToSobriety(hours) {
        if (hours <= 0) {
            return "Maintenant";
        }
        
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        
        if (wholeHours === 0) {
            return `${minutes} min`;
        } else if (minutes === 0) {
            return `${wholeHours}h`;
        } else {
            return `${wholeHours}h ${minutes}min`;
        }
    }
    
    static getWHORecommendation(gender) {
        // WHO recommendations in grams of pure alcohol per week
        return gender === 'female' ? 140 : 210;
    }
    
    // Statistics utilities
    static calculateAverage(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    
    static calculateMedian(values) {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
            ? (sorted[mid - 1] + sorted[mid]) / 2 
            : sorted[mid];
    }
    
    static calculatePercentile(values, percentile) {
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
        if (loadingEl && loadingEl.parentElement) {
            loadingEl.remove();
        }
    }
    
    static debounce(func, wait) {
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
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
    
    static closeAllModals() {
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
    
    // Form utilities
    static getFormData(formElement) {
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
        formElement.reset();
        
        // Clear any validation states
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.classList.remove('error', 'valid');
        });
    }
    
    static validateForm(formElement) {
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
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }
    
    static getFromLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }
    
    static removeFromLocalStorage(key) {
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
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
    
    // Color utilities for charts
    static getChartColors(count) {
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
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // Touch gesture utilities
    static addSwipeListener(element, onSwipeLeft, onSwipeRight, threshold = 50) {
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });
        
        element.addEventListener('touchmove', (e) => {
            endX = e.touches[0].clientX;
            endY = e.touches[0].clientY;
            
            const deltaX = endX - startX;
            const deltaY = Math.abs(endY - startY);
            
            // Only trigger if horizontal swipe is dominant
            if (Math.abs(deltaX) > threshold && deltaY < threshold) {
                if (deltaX < 0) {
                    element.classList.add('swipe-left');
                } else {
                    element.classList.remove('swipe-left');
                }
            }
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            const deltaX = endX - startX;
            const deltaY = Math.abs(endY - startY);
            
            if (Math.abs(deltaX) > threshold && deltaY < threshold) {
                if (deltaX < 0 && onSwipeLeft) {
                    onSwipeLeft(element);
                } else if (deltaX > 0 && onSwipeRight) {
                    onSwipeRight(element);
                }
            }
            
            element.classList.remove('swipe-left');
        }, { passive: true });
    }
    
    // URL utilities
    static getURLParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (let [key, value] of params.entries()) {
            result[key] = value;
        }
        return result;
    }
    
    static updateURL(params) {
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
        return window.innerWidth <= 768;
    }
    
    static isTablet() {
        return window.innerWidth > 768 && window.innerWidth <= 1024;
    }
    
    static isDesktop() {
        return window.innerWidth > 1024;
    }
    
    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    static isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }
    
    // Animation utilities
    static animateValue(element, start, end, duration, formatter = (val) => val) {
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
        console.error(`Error in ${context}:`, error);
        
        let message = 'Une erreur est survenue';
        if (error.message) {
            message = error.message;
        }
        
        this.showMessage(message, 'error');
    }
    
    // Performance utilities
    static measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
    
    static async measureAsyncPerformance(name, fn) {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        console.log(`${name} took ${end - start} milliseconds`);
        return result;
    }
}

// Export Utils class to global scope
window.Utils = Utils;

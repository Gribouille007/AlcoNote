// Geolocation utilities for AlcoNote PWA

class GeolocationManager {
    constructor() {
        this.isSupported = 'geolocation' in navigator;
        this.currentPosition = null;
        this.watchId = null;
        this.options = {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000 // 1 minute for higher precision
        };
        this.consent = this.getStoredConsent(); // 'granted' | 'denied' | null
        this.lastKnownLocation = this.getStoredLocation();
    }
    
    // Check if geolocation is supported and permission is granted
    async checkSupport() {
        if (!this.isSupported) {
            return { supported: false, error: 'Geolocation not supported' };
        }
        
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' });
            return {
                supported: true,
                permission: permission.state,
                canRequest: permission.state !== 'denied'
            };
        } catch (error) {
            return {
                supported: true,
                permission: 'unknown',
                canRequest: true
            };
        }
    }
    
    // Consent management to avoid repeated prompts
    getStoredConsent() {
        try {
            return localStorage.getItem('geoConsent') || null;
        } catch (e) {
            return null;
        }
    }

    setStoredConsent(state) {
        try {
            if (state === null) {
                localStorage.removeItem('geoConsent');
            } else {
                localStorage.setItem('geoConsent', state);
            }
            this.consent = state;
        } catch (e) {
            // ignore storage errors
        }
    }

    // Persist and retrieve last known location to avoid drinks without location
    getStoredLocation() {
        try {
            const raw = localStorage.getItem('lastKnownLocation');
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
                return null;
            }
            // Normalize structure to match drink.location expectations
            return {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy || null,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                address: typeof data.address === 'string' ? data.address : (data.address && data.address.formatted ? data.address.formatted : null)
            };
        } catch (e) {
            return null;
        }
    }

    setStoredLocation(locationData) {
        try {
            const payload = {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                accuracy: locationData.accuracy || null,
                timestamp: locationData.timestamp instanceof Date ? locationData.timestamp.toISOString() : (locationData.timestamp || new Date().toISOString()),
                // Persist address as string if available
                address: typeof locationData.address === 'string' ? locationData.address : (locationData.address && locationData.address.formatted ? locationData.address.formatted : null)
            };
            localStorage.setItem('lastKnownLocation', JSON.stringify(payload));
            this.lastKnownLocation = this.getStoredLocation();
        } catch (e) {
            // ignore storage errors
        }
    }

    getLastKnownLocation() {
        // Prefer in-memory recent position if present
        if (this.currentPosition) {
            return {
                latitude: this.currentPosition.latitude,
                longitude: this.currentPosition.longitude,
                accuracy: this.currentPosition.accuracy,
                address: typeof this.currentPosition.address === 'string' ? this.currentPosition.address : (this.currentPosition.address && this.currentPosition.address.formatted ? this.currentPosition.address.formatted : null)
            };
        }
        const stored = this.getStoredLocation();
        if (!stored) return null;
        return {
            latitude: stored.latitude,
            longitude: stored.longitude,
            accuracy: stored.accuracy,
            address: stored.address
        };
    }

    hasLocationAcquired() {
        return !!(this.currentPosition || this.getStoredLocation());
    }

    init() {
        // Load last known location into memory for quick access
        const stored = this.getStoredLocation();
        if (stored) {
            this.currentPosition = stored;
        }
    }

    // Prewarm geolocation cache without prompting the user
    async prewarmQuickPosition() {
        try {
            const support = await this.checkSupport();
            if (!support.supported || support.permission === 'denied') return;
            // Only prewarm if permission is already granted OR user previously consented in-app
            if (support.permission !== 'granted' && this.consent !== 'granted') return;
            await this.getQuickPosition(false, 1500);
        } catch (e) {
            // ignore errors during prewarm
        }
    }

    async ensureConsent() {
        if (!this.isSupported) return false;

        let permissionState = 'unknown';
        try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            permissionState = perm.state;
        } catch (_) {
            // permissions API not supported (e.g., iOS Safari)
        }

        if (permissionState === 'granted') {
            if (this.consent !== 'granted') this.setStoredConsent('granted');
            return true;
        }
        if (permissionState === 'denied') {
            this.setStoredConsent('denied');
            return false;
        }

        // permissionState is 'prompt' or 'unknown' -> gate with our own one-time consent
        if (this.consent === 'granted') {
            return true;
        }
        if (this.consent === 'denied') {
            return false;
        }

        // Ask user once via lightweight confirm instead of nagging every drink
        const userAgreed = typeof window !== 'undefined'
            ? window.confirm('Autoriser AlcoNote à enregistrer votre position pour vos boissons ? Cette autorisation est demandée une seule fois. Vous pourrez changer ce choix dans les réglages du navigateur.')
            : false;

        if (!userAgreed) {
            this.setStoredConsent('denied');
            return false;
        }

        // Trigger actual browser permission prompt once
        const res = await this.requestPermission();
        if (res.granted) {
            this.setStoredConsent('granted');
            // Immediately start prewarming location for future drinks
            this.startLocationPrewarming();
            return true;
        } else {
            this.setStoredConsent('denied');
            return false;
        }
    }

    // Get current position
    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!this.isSupported) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp),
                        address: null
                    };
                    
                    // Try to get address from coordinates
                    try {
                        const address = await this.reverseGeocode(
                            position.coords.latitude,
                            position.coords.longitude
                        );
                        locationData.address = address;
                    } catch (error) {
                        console.warn('Could not get address:', error);
                    }
                    
                    this.currentPosition = locationData;
                    this.setStoredLocation(locationData);
                    resolve(locationData);
                },
                (error) => {
                    reject(this.handleGeolocationError(error));
                },
                this.options
            );
        });
    }
    
    // Start watching position changes
    startWatching(callback) {
        if (!this.isSupported) {
            callback(new Error('Geolocation not supported'), null);
            return;
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: new Date(position.timestamp),
                    address: null
                };
                
                // Try to get address from coordinates
                try {
                    const address = await this.reverseGeocode(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                    locationData.address = address;
                } catch (error) {
                    console.warn('Could not get address:', error);
                }
                
                this.currentPosition = locationData;
                this.setStoredLocation(locationData);
                callback(null, locationData);
            },
            (error) => {
                callback(this.handleGeolocationError(error), null);
            },
            this.options
        );
    }
    
    // Stop watching position changes
    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }
    
    // Handle geolocation errors
    handleGeolocationError(error) {
        let message = 'Erreur de géolocalisation';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Permission de géolocalisation refusée';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Position non disponible';
                break;
            case error.TIMEOUT:
                message = 'Délai de géolocalisation dépassé';
                break;
            default:
                message = 'Erreur de géolocalisation inconnue';
                break;
        }
        
        return new Error(message);
    }
    
    // Reverse geocoding using Nominatim (OpenStreetMap)
    async reverseGeocode(latitude, longitude) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'AlcoNote PWA'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Geocoding request failed');
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            return this.formatAddress(data);
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            throw error;
        }
    }
    
    // Format address from Nominatim response
    formatAddress(data) {
        const address = data.address || {};
        const components = [];
        
        // Add house number and street
        if (address.house_number && address.road) {
            components.push(`${address.house_number} ${address.road}`);
        } else if (address.road) {
            components.push(address.road);
        }
        
        // Add city/town/village
        const city = address.city || address.town || address.village || address.municipality;
        if (city) {
            components.push(city);
        }
        
        // Add postal code
        if (address.postcode) {
            components.push(address.postcode);
        }
        
        // Add country
        if (address.country) {
            components.push(address.country);
        }
        
        return {
            formatted: components.join(', '),
            components: {
                houseNumber: address.house_number || null,
                street: address.road || null,
                city: city || null,
                postcode: address.postcode || null,
                state: address.state || null,
                country: address.country || null,
                countryCode: address.country_code || null
            },
            raw: data
        };
    }
    
    // Get distance between two points (Haversine formula)
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return distance; // Distance in kilometers
    }
    
    // Convert degrees to radians
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
    
    // Format distance for display
    formatDistance(distanceKm) {
        if (distanceKm < 1) {
            return `${Math.round(distanceKm * 1000)} m`;
        } else if (distanceKm < 10) {
            return `${distanceKm.toFixed(1)} km`;
        } else {
            return `${Math.round(distanceKm)} km`;
        }
    }
    
    // Get location for drink entry
    async getLocationForDrink() {
        try {
            const consent = await this.ensureConsent();
            if (!consent) {
                return null;
            }
            const support = await this.checkSupport();
            
            if (!support.supported) {
                return null;
            }
            
            if (support.permission === 'denied') {
                return null;
            }
            
            // Use cached position if recent (less than 5 minutes old)
            if (this.currentPosition && 
                (Date.now() - this.currentPosition.timestamp.getTime()) < 300000) {
                return {
                    latitude: this.currentPosition.latitude,
                    longitude: this.currentPosition.longitude,
                    address: this.currentPosition.address?.formatted || null,
                    accuracy: this.currentPosition.accuracy
                };
            }
            
            // Get fresh position
            const position = await this.getCurrentPosition();
            return {
                latitude: position.latitude,
                longitude: position.longitude,
                address: position.address?.formatted || null,
                accuracy: position.accuracy
            };
            
        } catch (error) {
            console.warn('Could not get location for drink:', error);
            return null;
        }
    }

    // Quick position without reverse geocoding (for fast UX)
    getQuickPosition(highAccuracy = true, timeoutMs = 3000) {
        return new Promise((resolve, reject) => {
            if (!this.isSupported) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            const opts = {
                enableHighAccuracy: !!highAccuracy,
                timeout: timeoutMs,
                maximumAge: this.options.maximumAge
            };
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp),
                        address: null // skip reverse geocoding for speed
                    };
                    this.currentPosition = locationData;
                    this.setStoredLocation(locationData);
                    resolve(locationData);
                },
                (error) => {
                    reject(this.handleGeolocationError(error));
                },
                opts
            );
        });
    }

    // Timeboxed location fetch for drink, returns fast or null
    async getLocationForDrinkFast(timeoutMs = 1500, highAccuracy = false) {
        try {
            const consent = await this.ensureConsent();
            if (!consent) {
                return null;
            }
            const support = await this.checkSupport();
            if (!support.supported || support.permission === 'denied') {
                return null;
            }

            // Use cached if fresh
            if (this.currentPosition && (Date.now() - this.currentPosition.timestamp.getTime()) < 300000) {
                return {
                    latitude: this.currentPosition.latitude,
                    longitude: this.currentPosition.longitude,
                    address: this.currentPosition.address?.formatted || null,
                    accuracy: this.currentPosition.accuracy
                };
            }

            // Race quick position with timeout
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => resolve(null), timeoutMs);
            });
            const loc = await Promise.race([
                this.getQuickPosition(highAccuracy, timeoutMs),
                timeoutPromise
            ]);

            if (!loc) return null;

            // Optionally reverse geocode in background to enrich cache (non-blocking)
            this.reverseGeocode(loc.latitude, loc.longitude)
                .then(addr => { if (this.currentPosition) this.currentPosition.address = addr; })
                .catch(() => { /* ignore */ });

            return {
                latitude: loc.latitude,
                longitude: loc.longitude,
                address: null, // keep fast path without waiting for address
                accuracy: loc.accuracy
            };
        } catch (e) {
            return null;
        }
    }
    
    // Analyze drinking locations
    async analyzeLocations(drinks) {
        const locations = drinks
            .filter(drink => drink.location && drink.location.latitude && drink.location.longitude)
            .map(drink => ({
                ...drink.location,
                date: drink.date,
                time: drink.time,
                drinkName: drink.name
            }));
        
        if (locations.length === 0) {
            return {
                totalLocations: 0,
                uniqueLocations: 0,
                mostFrequentLocation: null,
                locationClusters: []
            };
        }
        
        // Group locations by proximity (within 100m)
        const clusters = this.clusterLocations(locations, 0.1); // 100m threshold
        
        // Find most frequent location
        const mostFrequent = clusters.reduce((max, cluster) => 
            cluster.drinks.length > max.drinks.length ? cluster : max
        );
        
        return {
            totalLocations: locations.length,
            uniqueLocations: clusters.length,
            mostFrequentLocation: {
                address: mostFrequent.address,
                count: mostFrequent.drinks.length,
                latitude: mostFrequent.latitude,
                longitude: mostFrequent.longitude
            },
            locationClusters: clusters.map(cluster => ({
                address: cluster.address,
                count: cluster.drinks.length,
                latitude: cluster.latitude,
                longitude: cluster.longitude,
                drinks: cluster.drinks.length
            }))
        };
    }
    
    // Cluster nearby locations
    clusterLocations(locations, thresholdKm) {
        const clusters = [];
        const processed = new Set();
        
        locations.forEach((location, index) => {
            if (processed.has(index)) return;
            
            const cluster = {
                latitude: location.latitude,
                longitude: location.longitude,
                address: location.address,
                drinks: [location]
            };
            
            // Find nearby locations
            locations.forEach((otherLocation, otherIndex) => {
                if (index === otherIndex || processed.has(otherIndex)) return;
                
                const distance = this.calculateDistance(
                    location.latitude,
                    location.longitude,
                    otherLocation.latitude,
                    otherLocation.longitude
                );
                
                if (distance <= thresholdKm) {
                    cluster.drinks.push(otherLocation);
                    processed.add(otherIndex);
                }
            });
            
            processed.add(index);
            clusters.push(cluster);
        });
        
        return clusters.sort((a, b) => b.drinks.length - a.drinks.length);
    }
    
    // Get location statistics for a time period
    async getLocationStats(drinks) {
        const analysis = await this.analyzeLocations(drinks);
        
        if (analysis.totalLocations === 0) {
            return {
                message: 'Aucune donnée de localisation disponible',
                stats: null
            };
        }
        
        // Transform drinks data to include location information for map display
        const drinksWithLocation = drinks.filter(drink => 
            drink.location && drink.location.latitude && drink.location.longitude
        ).map(drink => ({
            ...drink,
            latitude: drink.location.latitude,
            longitude: drink.location.longitude,
            address: drink.location.address || 'Localisation inconnue'
        }));
        
        const stats = {
            totalDrinksWithLocation: analysis.totalLocations,
            uniqueLocations: analysis.uniqueLocations,
            averageDrinksPerLocation: Math.round(analysis.totalLocations / analysis.uniqueLocations * 10) / 10,
            mostFrequentLocation: analysis.mostFrequentLocation,
            locationDistribution: analysis.locationClusters.slice(0, 5), // Top 5 locations
            drinks: drinksWithLocation // Add drinks data for map display
        };
        
        return {
            message: `${analysis.totalLocations} boissons géolocalisées dans ${analysis.uniqueLocations} lieux différents`,
            stats
        };
    }
    
    // Request permission explicitly
    async requestPermission() {
        try {
            const position = await this.getCurrentPosition();
            this.setStoredConsent('granted');
            return { granted: true, position };
        } catch (error) {
            this.setStoredConsent('denied');
            return { granted: false, error: error.message };
        }
    }
    
    // Check if location services are enabled
    async isLocationEnabled() {
        try {
            const support = await this.checkSupport();
            return support.supported && support.permission !== 'denied';
        } catch (error) {
            return false;
        }
    }
    
    // Get location accuracy description
    getAccuracyDescription(accuracy) {
        if (accuracy <= 5) {
            return 'Très précise';
        } else if (accuracy <= 20) {
            return 'Précise';
        } else if (accuracy <= 100) {
            return 'Approximative';
        } else {
            return 'Imprécise';
        }
    }
    
    // Generate location summary for drinks
    generateLocationSummary(drinks) {
        const locatedDrinks = drinks.filter(drink => drink.location);
        
        if (locatedDrinks.length === 0) {
            return 'Aucune localisation enregistrée';
        }
        
        const percentage = Math.round((locatedDrinks.length / drinks.length) * 100);
        return `${locatedDrinks.length}/${drinks.length} boissons géolocalisées (${percentage}%)`;
    }
    
    // Get timezone from coordinates
    async getTimezoneFromCoordinates(latitude, longitude) {
        try {
            // Use TimeZoneDB API or similar service
            // For now, we'll use the browser's timezone as fallback
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Try to get more accurate timezone from coordinates using a free API
            try {
                const response = await fetch(
                    `https://api.timezonedb.com/v2.1/get-time-zone?key=demo&format=json&by=position&lat=${latitude}&lng=${longitude}`,
                    { timeout: 5000 }
                );
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'OK') {
                        return {
                            timezone: data.zoneName,
                            offset: data.gmtOffset,
                            abbreviation: data.abbreviation,
                            source: 'api'
                        };
                    }
                }
            } catch (error) {
                console.warn('Could not get timezone from API:', error);
            }
            
            // Fallback to browser timezone
            const date = new Date();
            const offset = -date.getTimezoneOffset() * 60; // Convert to seconds
            
            return {
                timezone: timezone,
                offset: offset,
                abbreviation: date.toLocaleTimeString('en', { timeZoneName: 'short' }).split(' ')[2] || 'UTC',
                source: 'browser'
            };
            
        } catch (error) {
            console.error('Error getting timezone:', error);
            // Return UTC as ultimate fallback
            return {
                timezone: 'UTC',
                offset: 0,
                abbreviation: 'UTC',
                source: 'fallback'
            };
        }
    }
    
    // Get current time with timezone information
    async getCurrentTimeWithTimezone() {
        try {
            let timezoneInfo = null;
            
            // Try to get timezone from current position
            if (this.currentPosition) {
                timezoneInfo = await this.getTimezoneFromCoordinates(
                    this.currentPosition.latitude,
                    this.currentPosition.longitude
                );
            } else {
                // Try to get current position for timezone
                try {
                    const position = await this.getCurrentPosition();
                    timezoneInfo = await this.getTimezoneFromCoordinates(
                        position.latitude,
                        position.longitude
                    );
                } catch (error) {
                    // Use browser timezone as fallback
                    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const date = new Date();
                    const offset = -date.getTimezoneOffset() * 60;
                    
                    timezoneInfo = {
                        timezone: timezone,
                        offset: offset,
                        abbreviation: date.toLocaleTimeString('en', { timeZoneName: 'short' }).split(' ')[2] || 'UTC',
                        source: 'browser'
                    };
                }
            }
            
            const now = new Date();
            
            return {
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].substring(0, 5), // HH:MM format
                timestamp: now.toISOString(),
                timezone: timezoneInfo,
                formatted: {
                    date: now.toLocaleDateString('fr-FR'),
                    time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    full: now.toLocaleString('fr-FR')
                }
            };
            
        } catch (error) {
            console.error('Error getting current time with timezone:', error);
            
            // Fallback to basic time
            const now = new Date();
            return {
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().split(' ')[0].substring(0, 5),
                timestamp: now.toISOString(),
                timezone: {
                    timezone: 'UTC',
                    offset: 0,
                    abbreviation: 'UTC',
                    source: 'fallback'
                },
                formatted: {
                    date: now.toLocaleDateString('fr-FR'),
                    time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    full: now.toLocaleString('fr-FR')
                }
            };
        }
    }
    
    // Update time inputs with geolocation-aware time
    async updateTimeInputs() {
        try {
            const timeInfo = await this.getCurrentTimeWithTimezone();
            
            // Update date and time inputs if they exist
            const dateInput = document.getElementById('drink-date');
            const timeInput = document.getElementById('drink-time');
            
            if (dateInput && !dateInput.value) {
                dateInput.value = timeInfo.date;
            }
            
            if (timeInput && !timeInput.value) {
                timeInput.value = timeInfo.time;
            }
            
            // Update any timezone display elements
            const timezoneDisplay = document.getElementById('timezone-display');
            if (timezoneDisplay) {
                timezoneDisplay.textContent = `${timeInfo.timezone.abbreviation} (${timeInfo.timezone.timezone})`;
            }
            
            return timeInfo;
            
        } catch (error) {
            console.error('Error updating time inputs:', error);
            
            // Fallback to basic time update
            const now = new Date();
            const dateInput = document.getElementById('drink-date');
            const timeInput = document.getElementById('drink-time');
            
            if (dateInput && !dateInput.value) {
                dateInput.value = now.toISOString().split('T')[0];
            }
            
            if (timeInput && !timeInput.value) {
                timeInput.value = now.toTimeString().split(' ')[0].substring(0, 5);
            }
        }
    }
    
    // Initialize geolocation-aware time updates
    initTimeUpdates() {
        // Update time when add drink modal opens
        const addDrinkModal = document.getElementById('add-drink-modal');
        if (addDrinkModal) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (addDrinkModal.classList.contains('active')) {
                            this.updateTimeInputs();
                        }
                    }
                });
            });
            
            observer.observe(addDrinkModal, { attributes: true });
        }
        
        // Update time every minute for real-time accuracy
        setInterval(() => {
            if (document.getElementById('add-drink-modal')?.classList.contains('active')) {
                this.updateTimeInputs();
            }
        }, 60000); // Update every minute
    }

    // Start location prewarming for performance
    startLocationPrewarming() {
        if (!this.isSupported || this.consent !== 'granted') return;
        
        // Prewarm location immediately
        this.getQuickPosition(false, 2000).catch(() => {});
        
        // Set up periodic refresh to keep location cache fresh
        if (this.locationWarmupInterval) {
            clearInterval(this.locationWarmupInterval);
        }
        
        this.locationWarmupInterval = setInterval(() => {
            // Only refresh if location is getting stale (older than 3 minutes)
            if (!this.currentPosition || 
                (Date.now() - this.currentPosition.timestamp.getTime()) > 180000) {
                this.getQuickPosition(false, 1000).catch(() => {});
            }
        }, 120000); // Check every 2 minutes
    }
    
    // Stop location prewarming
    stopLocationPrewarming() {
        if (this.locationWarmupInterval) {
            clearInterval(this.locationWarmupInterval);
            this.locationWarmupInterval = null;
        }
    }

    // Get location immediately without waiting - ultra-fast for UI responsiveness  
    getLocationInstant() {
        // Return last known location immediately, no async delays
        if (this.currentPosition) {
            return {
                latitude: this.currentPosition.latitude,
                longitude: this.currentPosition.longitude,
                accuracy: this.currentPosition.accuracy,
                address: typeof this.currentPosition.address === 'string' ? this.currentPosition.address : 
                         (this.currentPosition.address && this.currentPosition.address.formatted ? this.currentPosition.address.formatted : null)
            };
        }
        
        const stored = this.getStoredLocation();
        if (stored) {
            return {
                latitude: stored.latitude,
                longitude: stored.longitude,
                accuracy: stored.accuracy,
                address: stored.address
            };
        }
        
        return null;
    }

    // Enhanced consent check without blocking UI
    async checkConsentAndLocation() {
        // Fast synchronous checks first
        if (!this.isSupported) return { hasConsent: false, hasLocation: false, reason: 'not_supported' };
        if (this.consent === 'denied') return { hasConsent: false, hasLocation: false, reason: 'denied' };
        if (this.consent === 'granted' && this.hasLocationAcquired()) {
            return { hasConsent: true, hasLocation: true, reason: 'ready' };
        }

        // Quick permission check
        try {
            const perm = await navigator.permissions.query({ name: 'geolocation' });
            if (perm.state === 'denied') {
                this.setStoredConsent('denied');
                return { hasConsent: false, hasLocation: false, reason: 'denied' };
            }
            if (perm.state === 'granted') {
                if (this.consent !== 'granted') this.setStoredConsent('granted');
                return { hasConsent: true, hasLocation: this.hasLocationAcquired(), reason: 'granted' };
            }
        } catch (e) {
            // Permissions API not supported, fallback to stored consent
        }

        return { 
            hasConsent: this.consent === 'granted', 
            hasLocation: this.hasLocationAcquired(), 
            reason: this.consent || 'unknown' 
        };
    }

    // Request one-time location permission on first app launch
    async requestInitialLocationPermission() {
        const key = 'initialLocationRequested';
        const alreadyRequested = localStorage.getItem(key);
        
        if (alreadyRequested) return false;
        localStorage.setItem(key, 'true');
        
        try {
            const consent = await this.ensureConsent();
            return consent;
        } catch (error) {
            console.warn('Initial location permission request failed:', error);
            return false;
        }
    }

    // Optimized batch reverse geocoding for multiple locations
    async batchReverseGeocode(locations, maxConcurrency = 3) {
        const results = new Map();
        const chunks = [];
        
        // Split into chunks to avoid rate limiting
        for (let i = 0; i < locations.length; i += maxConcurrency) {
            chunks.push(locations.slice(i, i + maxConcurrency));
        }
        
        for (const chunk of chunks) {
            const promises = chunk.map(async (loc) => {
                try {
                    const address = await this.reverseGeocode(loc.latitude, loc.longitude);
                    results.set(`${loc.latitude},${loc.longitude}`, address);
                } catch (error) {
                    results.set(`${loc.latitude},${loc.longitude}`, null);
                }
            });
            
            await Promise.all(promises);
            // Small delay between chunks to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return results;
    }
}

// Create global geolocation manager instance
const geoManager = new GeolocationManager();

// Export for use in other modules
window.geoManager = geoManager;

// Geolocation utilities for AlcoNote PWA

class GeolocationManager {
    constructor() {
        this.isSupported = 'geolocation' in navigator;
        this.currentPosition = null;
        this.watchId = null;
        this.options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };
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
            return { granted: true, position };
        } catch (error) {
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
}

// Create global geolocation manager instance
const geoManager = new GeolocationManager();

// Export for use in other modules
window.geoManager = geoManager;

// Composant de rendu pour les statistiques de localisation - AlcoNote PWA

/**
 * Rend les statistiques de localisation
 * @param {Object} locationStats - Statistiques de localisation calculées
 * @returns {HTMLElement} Section des statistiques de localisation
 */
function renderLocationStats(locationStats) {
    if (!locationStats || !locationStats.stats) {
        return null; // No location data available
    }
    
    const section = document.createElement('div');
    section.className = 'stats-section';
    section.innerHTML = `
        <h3>Carte interactive des consommations</h3>
        <div class="location-summary">
            <p>${locationStats.message}</p>
        </div>
    `;
    
    return section;
}

/**
 * Rend la carte interactive des consommations
 * @param {HTMLElement} container - Conteneur où ajouter la carte
 * @param {Object} locationStats - Statistiques de localisation
 */
function renderInteractiveConsumptionMap(container, locationStats) {
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
        initializeMapWithRetry(locationStats, 0);
    });
}

/**
 * Initialize map with retry mechanism for better reliability
 */
function initializeMapWithRetry(locationStats, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 500 * (retryCount + 1); // Exponential backoff

    try {
        initializeInteractiveMap(locationStats);
    } catch (error) {
        console.error(`Map initialization attempt ${retryCount + 1} failed:`, error);

        if (retryCount < maxRetries) {
            console.log(`Retrying map initialization in ${retryDelay}ms...`);
            setTimeout(() => {
                initializeMapWithRetry(locationStats, retryCount + 1);
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

/**
 * Initialize interactive map with individual consumption markers
 */
function initializeInteractiveMap(locationStats) {
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

        // Check Leaflet availability
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

        // Helper extractors to support both top-level and nested location fields
        const getCoords = (d) => {
            const lat = d?.latitude ?? d?.location?.latitude;
            const lng = d?.longitude ?? d?.location?.longitude;
            if (lat == null || lng == null) return null;
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);
            if (!isFinite(latNum) || !isFinite(lngNum)) return null;
            return { lat: latNum, lng: lngNum };
        };
        const getAddress = (d) => d?.address ?? d?.location?.address ?? 'Localisation inconnue';

        // Clear any existing map content
        mapElement.innerHTML = '';

        // Get all drinks with location data and validate coordinates (supports nested drink.location.*)
        const drinksWithLocation = locationStats.drinks.filter(drink => {
            const c = getCoords(drink);
            if (!c) return false;
            return c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180;
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

        // Calculate center point from all consumption locations
        const centerSum = processedDrinks.reduce((acc, d) => {
            const c = getCoords(d);
            return c ? { lat: acc.lat + c.lat, lng: acc.lng + c.lng, count: acc.count + 1 } : acc;
        }, { lat: 0, lng: 0, count: 0 });
        const centerLat = centerSum.count > 0 ? centerSum.lat / centerSum.count : 0;
        const centerLng = centerSum.count > 0 ? centerSum.lng / centerSum.count : 0;

        // Validate center coordinates
        if (!isFinite(centerLat) || !isFinite(centerLng)) {
            console.error('Invalid center coordinates calculated');
            return;
        }

        // Initialize map
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

        // Add tile layer
        try {
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            }).addTo(map);
        } catch (error) {
            console.error('Error adding tile layer:', error);
            return;
        }

        // Create marker cluster group if available
        let markers;
        if (typeof L.markerClusterGroup === 'function') {
            try {
                markers = L.markerClusterGroup({
                    chunkedLoading: true,
                    chunkInterval: 200,
                    chunkDelay: 50,
                    disableClusteringAtZoom: 19,
                    maxClusterRadius: (window.StatsConfig?.STATS_CONFIG?.maps?.clusterRadius || 80),
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false,
                    // We want a popup with the list on click instead of zooming automatically
                    zoomToBoundsOnClick: false,
                    spiderfyDistanceMultiplier: 1.8,
                    iconCreateFunction: function(cluster) {
                        const childCount = cluster.getChildCount();
                        // Uniform blue semi-transparent cluster style
                        const size = childCount < 10 ? 36 : (childCount < 50 ? 44 : 52);
                        return new L.DivIcon({
                            html: '<div><span>' + childCount + '</span></div>',
                            className: 'alcocluster',
                            iconSize: new L.Point(size, size)
                        });
                    }
                });
            } catch (error) {
                console.error('Error creating marker cluster group:', error);
                return;
            }
        } else {
            markers = L.layerGroup();
        }

        // Add one marker per drink for precise view at max zoom
        let markersAdded = 0;
        processedDrinks.forEach(drink => {
            try {
                const coords = getCoords(drink);
                if (!coords) return;

                const popupContent = `
                    <div class="map-popup enhanced" style="max-width:320px;">
                        <div class="popup-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <h4 style="margin:0;font-size:14px;">${getAddress(drink)}</h4>
                            <div class="popup-count" style="font-size:12px;opacity:0.8;">1 consommation</div>
                        </div>
                        <div class="popup-drinks" style="max-height:240px;overflow:auto;padding-right:4px;">
                            <div class="popup-drink-item" style="padding:6px 0;border-bottom:1px solid #eee;">
                                <div class="drink-main" style="display:flex;justify-content:space-between;">
                                    <span class="drink-name" style="font-weight:600;">${drink.name}</span>
                                    <span class="drink-category" style="font-size:12px;opacity:0.8;">${drink.category || ''}</span>
                                </div>
                                <div class="drink-meta" style="font-size:12px;opacity:0.9;display:flex;gap:6px;flex-wrap:wrap;">
                                    <span class="drink-datetime">${Utils.formatDate(drink.date)} ${drink.time || ''}</span>
                                    ${drink.quantity && drink.unit ? `<span class="drink-quantity">${Utils.formatQuantity(drink.quantity, drink.unit)}</span>` : ''}
                                    ${typeof drink.alcoholContent === 'number' ? `<span class="drink-abv">${drink.alcoholContent}%</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const marker = L.circleMarker([coords.lat, coords.lng], {
                    radius: 8,
                    fillColor: getInteractiveMarkerColor(1),
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9,
                    className: 'individual'
                });

                marker.bindPopup(popupContent, {
                    maxWidth: 320,
                    className: 'consumption-popup enhanced',
                    closeButton: true
                });

                // Hover effects
                marker.on('mouseover', function() {
                    this.setStyle({
                        fillOpacity: 1,
                        weight: 3,
                        radius: this.options.radius + 2
                    });
                });

                marker.on('mouseout', function() {
                    this.setStyle({
                        fillOpacity: 0.9,
                        weight: 2,
                        radius: this.options.radius - 2
                    });
                });

                // Attach drink data to marker for cluster listing
                marker.drink = drink;

                markers.addLayer(marker);
                markersAdded++;
            } catch (error) {
                console.warn('Error creating marker for drink:', error);
            }
        });

        console.log(`Added ${markersAdded} markers to map`);

        // Add markers to map
        try {
            map.addLayer(markers);

            // Show popup with drinks list on cluster click
            if (markers && typeof markers.on === 'function') {
                markers.on('clusterclick', function (a) {
                    try {
                        const childMarkers = a.layer.getAllChildMarkers();
                        const drinks = childMarkers
                            .map(m => m.drink)
                            .filter(Boolean);

                        const maxItems = 20;
                        const listHtml = drinks.slice(0, maxItems).map(d => `
                            <div class="popup-drink-item">
                                <div class="drink-main">
                                    <span class="drink-name">${d.name}</span>
                                    <span class="drink-quantity">${d.quantity && d.unit ? Utils.formatQuantity(d.quantity, d.unit) : ''}</span>
                                </div>
                                <div class="drink-meta">
                                    <span class="drink-datetime">${Utils.formatDate(d.date)} ${d.time || ''}</span>
                                    ${d.category ? `<span class="drink-category">${d.category}</span>` : ''}
                                </div>
                            </div>
                        `).join('');

                        const more = drinks.length > maxItems
                            ? `<div class="popup-more">+ ${drinks.length - maxItems} autres...</div>`
                            : '';

                        const html = `
                            <div class="map-popup enhanced">
                                <div class="popup-header">
                                    <h4>Boissons dans ce cluster</h4>
                                    <div class="popup-count">${drinks.length}</div>
                                </div>
                                <div class="popup-drinks">
                                    ${listHtml || '<div class="popup-more">Aucune boisson</div>'}
                                    ${more}
                                </div>
                            </div>
                        `;

                        L.popup({ maxWidth: 320, className: 'consumption-popup enhanced' })
                         .setLatLng(a.layer.getLatLng())
                         .setContent(html)
                         .openOn(a.target._map);
                    } catch (err) {
                        console.warn('Error building cluster popup', err);
                    }
                });
            }
        } catch (error) {
            console.error('Error adding markers to map:', error);
            return;
        }

        // Fit map bounds
        try {
            if (processedDrinks.length > 1) {
                const bounds = markers.getBounds();
                if (bounds && bounds.isValid && bounds.isValid()) {
                    map.fitBounds(bounds.pad(0.1));
                }
            } else if (processedDrinks.length === 1) {
                map.setZoom(15);
            }
        } catch (error) {
            console.warn('Error fitting map bounds:', error);
            map.setZoom(12);
        }

        // Store map reference
        if (window.modularStatsManager) {
            window.modularStatsManager.interactiveConsumptionMap = map;
            window.modularStatsManager.markersClusterGroup = markers;
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

/**
 * Get marker color for interactive map based on consumption count
 */
function getInteractiveMarkerColor(count) {
    if (count >= 10) return '#FF3B30'; // Red for very frequent locations
    if (count >= 5) return '#FF9500';  // Orange for frequent locations
    if (count >= 2) return '#FFCC00';  // Yellow for occasional locations
    return '#007AFF';                  // Blue for single consumption locations
}

/**
 * Post-traitement après rendu
 * @param {Object} locationStats - Statistiques de localisation
 * @param {HTMLElement} container - Conteneur
 */
function postRenderLocationStats(locationStats, container) {
    if (locationStats && locationStats.stats) {
        // Add interactive map
        renderInteractiveConsumptionMap(container, locationStats.stats);
        
        // Add recenter button functionality
        const recenterBtn = document.getElementById('recenter-map-btn');
        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => {
                recenterMap().catch(error => {
                    console.error('Error recentering map:', error);
                });
            });
        }
    }
}

/**
 * Recenter map on user's current position
 */
async function recenterMap() {
    const map = window.modularStatsManager?.interactiveConsumptionMap;
    if (!map) {
        console.warn('No interactive map available to recenter');
        return;
    }

    try {
        const position = await geoManager.getCurrentPosition();
        // geoManager returns { latitude, longitude, accuracy, timestamp, address }
        if (position && typeof position.latitude === 'number' && typeof position.longitude === 'number') {
            const { latitude, longitude } = position;
            map.setView([latitude, longitude], 15, {
                animate: true,
                duration: 1
            });
            console.log('Map recentered on current position:', latitude, longitude);
        } else {
            Utils.showMessage('Impossible d\'obtenir votre position actuelle', 'error');
        }
    } catch (error) {
        console.error('Error recentering map:', error);
        Utils.showMessage('Erreur lors du recentrage de la carte', 'error');
    }
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderLocationStats,
        renderInteractiveConsumptionMap,
        postRenderLocationStats
    };
} else {
    window.LocationStatsRenderer = {
        renderLocationStats,
        renderInteractiveConsumptionMap,
        postRenderLocationStats
    };
}

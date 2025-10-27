// Service Worker for AlcoNote PWA
// Provides offline functionality and caching

const CACHE_NAME = 'alconote-v1.0.2';
const STATIC_CACHE = 'alconote-static-v1.0.2';
const DYNAMIC_CACHE = 'alconote-dynamic-v1.0.2';

// Detect local development environment to avoid stale caches on localhost
const IS_DEV = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

// Files to cache for offline functionality
const STATIC_FILES = [
    '/manifest.json',
    '/css/main.css',
    '/css/components.css',
    '/css/responsive.css',
    '/js/app.js',
    '/js/database.js',
    '/js/utils.js',
    '/js/geolocation.js',
    '/js/scanner.js',
    '/js/statistics.js',
    // External CDN resources
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.js'
];

// URLs that should always be fetched from network
const NETWORK_FIRST_URLS = [
    'https://world.openfoodfacts.org/',
    'https://nominatim.openstreetmap.org/'
];

// URLs that should be cached first
const CACHE_FIRST_URLS = [
    '/css/',
    '/js/',
    '/assets/',
    'https://cdn.jsdelivr.net/',
    'https://unpkg.com/'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Error caching static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle network requests
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // In dev, always prefer network-first for same-origin to keep assets fresh
    if (IS_DEV && request.url.startsWith(self.location.origin)) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Ensure fresh HTML for navigations (avoid stale index.html)
    if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Handle specific API endpoints with custom fallbacks
    if (request.url.includes('openfoodfacts.org')) {
        event.respondWith(handleOpenFoodFactsRequest(request));
        return;
    }
    
    if (request.url.includes('nominatim.openstreetmap.org')) {
        event.respondWith(handleNominatimRequest(request));
        return;
    }
    
    // Handle different caching strategies based on URL
    if (isNetworkFirstUrl(request.url)) {
        event.respondWith(networkFirst(request));
    } else if (isCacheFirstUrl(request.url)) {
        event.respondWith(cacheFirst(request));
    } else if (isStaticFile(request.url)) {
        event.respondWith(cacheFirst(request));
    } else {
        event.respondWith(staleWhileRevalidate(request));
    }
});

// Check if URL should use network-first strategy
function isNetworkFirstUrl(url) {
    return NETWORK_FIRST_URLS.some(pattern => url.includes(pattern));
}

// Check if URL should use cache-first strategy
function isCacheFirstUrl(url) {
    return CACHE_FIRST_URLS.some(pattern => url.includes(pattern));
}

// Check if URL is a static file
function isStaticFile(url) {
    return STATIC_FILES.some(file => url.endsWith(file) || url.includes(file));
}

// Network First Strategy - for dynamic content and APIs
async function networkFirst(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // If successful, cache the response
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache for:', request.url);
        
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If no cache, return offline page or error
        return createOfflineResponse(request);
    }
}

// Cache First Strategy - for static assets
async function cacheFirst(request) {
    try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // Cache the response for future use
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Cache and network failed for:', request.url);
        return createOfflineResponse(request);
    }
}

// Stale While Revalidate Strategy - for general content
async function staleWhileRevalidate(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in background
    const networkResponsePromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.log('Service Worker: Network failed for:', request.url);
            return null;
        });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Otherwise wait for network response
    const networkResponse = await networkResponsePromise;
    if (networkResponse) {
        return networkResponse;
    }
    
    return createOfflineResponse(request);
}

// Create offline response for failed requests
function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // For HTML requests, return offline page
    if (request.headers.get('accept').includes('text/html')) {
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>AlcoNote - Hors ligne</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background-color: #f2f2f7;
                        color: #333;
                        text-align: center;
                        padding: 20px;
                    }
                    .offline-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        font-size: 24px;
                        margin-bottom: 10px;
                        color: #007AFF;
                    }
                    p {
                        font-size: 16px;
                        line-height: 1.5;
                        max-width: 400px;
                        margin-bottom: 20px;
                    }
                    .retry-btn {
                        background-color: #007AFF;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }
                    .retry-btn:hover {
                        background-color: #0056CC;
                    }
                </style>
            </head>
            <body>
                <div class="offline-icon">📱</div>
                <h1>Mode hors ligne</h1>
                <p>Vous êtes actuellement hors ligne. AlcoNote continue de fonctionner avec vos données locales.</p>
                <button class="retry-btn" onclick="window.location.reload()">
                    Réessayer
                </button>
            </body>
            </html>
        `, {
            status: 200,
            headers: {
                'Content-Type': 'text/html'
            }
        });
    }
    
    // For API requests, return JSON error
    if (request.headers.get('accept').includes('application/json')) {
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'Cette fonctionnalité nécessite une connexion internet'
        }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    
    // For other requests, return generic offline response
    return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable'
    });
}

// Background sync for when connection is restored
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

// Perform background sync operations
async function doBackgroundSync() {
    try {
        console.log('Service Worker: Performing background sync...');
        
        // Here you could sync any pending data when connection is restored
        // For example, upload any offline-created drinks to a server
        
        // Send message to all clients about sync completion
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'BACKGROUND_SYNC_COMPLETE'
            });
        });
        
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'Vous avez de nouvelles données à synchroniser',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-96x96.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Ouvrir AlcoNote',
                icon: '/assets/icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Fermer',
                icon: '/assets/icons/icon-96x96.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('AlcoNote', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling from main app
self.addEventListener('message', (event) => {
    console.log('Service Worker: Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({
            version: CACHE_NAME
        });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.delete(cacheName);
                    })
                );
            })
        );
    }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
    console.log('Service Worker: Periodic sync triggered:', event.tag);
    
    if (event.tag === 'content-sync') {
        event.waitUntil(doPeriodicSync());
    }
});

// Perform periodic sync operations
async function doPeriodicSync() {
    try {
        console.log('Service Worker: Performing periodic sync...');
        
        // Here you could perform periodic tasks like:
        // - Cleaning up old cached data
        // - Prefetching new content
        // - Updating statistics
        
        // Clean up old dynamic cache entries
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        // Remove entries older than 7 days
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const dateHeader = response.headers.get('date');
                if (dateHeader) {
                    const responseDate = new Date(dateHeader).getTime();
                    if (responseDate < oneWeekAgo) {
                        await cache.delete(request);
                        console.log('Service Worker: Cleaned up old cache entry:', request.url);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('Service Worker: Periodic sync failed:', error);
    }
}


// Handle OpenFoodFacts API requests with offline fallback
async function handleOpenFoodFactsRequest(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return fallback response for product lookup
        return new Response(JSON.stringify({
            status: 0,
            error: 'offline',
            message: 'Product lookup unavailable offline'
        }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

// Handle Nominatim geocoding requests with offline fallback
async function handleNominatimRequest(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Try to get from cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return fallback response for geocoding
        return new Response(JSON.stringify({
            error: 'offline',
            message: 'Geocoding unavailable offline'
        }), {
            status: 503,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}

console.log('Service Worker: Script loaded');

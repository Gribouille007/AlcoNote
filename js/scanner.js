// Barcode scanner functionality for AlcoNote PWA
// Using QuaggaJS for barcode detection

class BarcodeScanner {
    constructor() {
        this.isInitialized = false;
        this.isScanning = false;
        this.isStarting = false;
        this.stream = null;
        this.config = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: '#scanner-viewport',
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment" // Use back camera
                },
                area: { top: "10%", right: "5%", left: "5%", bottom: "10%" } // Larger scan area
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: navigator.hardwareConcurrency > 2 ? 2 : 1,
            frequency: 15, // Increased frequency for better detection
            decoder: {
                readers: [
                    "ean_reader",
                    "ean_8_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "code_128_reader"
                ],
                multiple: false
            },
            locate: true
        };
        this.onDetected = null;
        this.onError = null;
        this.inactivityTimeout = null;
        this.inactivityDuration = 30000; // 30 seconds
        this.hasDetected = false;
        this.fallbackTimer = null;
        this.broadReaders = [
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "code_128_reader",
            "code_39_reader",
            "codabar_reader",
            "i2of5_reader"
        ];
    }

    // Initialize the scanner
    async init() {
        return new Promise((resolve, reject) => {
            if (this.isInitialized) {
                resolve();
                return;
            }

            // Check if QuaggaJS is available
            if (typeof Quagga === 'undefined') {
                reject(new Error('QuaggaJS not loaded'));
                return;
            }

            // Ensure target element exists - critical for scanner to work properly
            const targetEl = document.getElementById('scanner-viewport');
            if (!targetEl) {
                const errorMsg = 'Scanner viewport element not found in DOM';
                console.error(errorMsg);
                reject(new Error(errorMsg));
                return;
            }

            this.config.inputStream.target = targetEl;

            Quagga.init(this.config, (err) => {
                if (err) {
                    console.error('Scanner initialization failed:', err);
                    reject(err);
                    return;
                }

                this.isInitialized = true;
                this.setupEventListeners();
                resolve();
            });
        });
    }

    // Setup event listeners for barcode detection
    setupEventListeners() {
        Quagga.onDetected((result) => {
            if (this.isScanning) {
                this.hasDetected = true;
                const code = result.codeResult.code;
                console.log('Barcode detected:', code);

                // Reset inactivity timer on detection
                this.resetInactivityTimer();

                // Call the detection handler (async) - don't stop yet!
                if (this.onDetected) {
                    // Call async handler and let it stop the scanner when done
                    this.onDetected(code);
                }
            }
        });

        Quagga.onProcessed((result) => {
            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;

            if (result && this.isScanning) {
                if (result.boxes) {
                    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                    result.boxes.filter((box) => box !== result.box).forEach((box) => {
                        Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
                    });
                }

                if (result.box) {
                    Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#00F", lineWidth: 2 });
                }

                if (result.codeResult && result.codeResult.code) {
                    Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
                }
            }
        });
    }

    // Start scanning
    async start() {
        try {
            if (this.isStarting || this.isScanning) {
                console.log('Scanner already starting or scanning, skipping...');
                return;
            }
            this.isStarting = true;
            console.log('Starting scanner... isInitialized:', this.isInitialized);

            if (!this.isInitialized) {
                console.log('Initializing Quagga...');
                await this.init();
                console.log('Quagga initialized successfully');
            }

            console.log('Starting Quagga scanner...');
            Quagga.start();
            this.isScanning = true;
            this.scheduleFallbackProfile();
            console.log('Scanner started, isScanning:', this.isScanning);

            // Update status
            this.updateStatus('Recherche de code-barres...');

            // Set up inactivity timeout to stop camera if no barcode is detected
            this.startInactivityTimer();

            // Mark starting completed
            this.isStarting = false;

        } catch (error) {
            console.error('Failed to start scanner:', error);
            this.updateStatus('Erreur lors du démarrage du scanner');

            if (this.onError) {
                this.onError(error);
            }
            // Ensure starting flag is reset on failure
            this.isStarting = false;
            this.isInitialized = false; // Reset to allow retry
        }
    }

    // Stop scanning
    stop() {
        try {
            if (this.isInitialized) {
                try {
                    Quagga.stop();
                } catch (e) {
                    console.warn('Quagga.stop() failed or not running:', e);
                }
            }
        } finally {
            this.isScanning = false;
            this.isStarting = false;
            // Reset initialization flag to force re-init on next start
            this.isInitialized = false;
            this.updateStatus('Scanner arrêté');

            // Clear inactivity timer
            this.clearInactivityTimer();
            this.clearFallbackTimer();

            // Properly stop camera stream
            this.stopCameraStream();
        }
    }

    // Stop camera stream to free up resources
    stopCameraStream() {
        try {
            // First, ask Quagga to release the camera if available
            if (typeof Quagga !== 'undefined' && Quagga.CameraAccess && typeof Quagga.CameraAccess.release === 'function') {
                try {
                    Quagga.CameraAccess.release();
                } catch (e) {
                    console.warn('Quagga.CameraAccess.release() failed:', e);
                }
            }

            // Stop all video tracks attached to our viewport
            const videos = document.querySelectorAll('#scanner-viewport video');
            videos.forEach(videoElement => {
                if (videoElement.srcObject) {
                    const stream = videoElement.srcObject;
                    const tracks = stream.getTracks();
                    tracks.forEach(track => {
                        try {
                            track.stop();
                            console.log('Camera track stopped:', track.kind);
                        } catch (_) { }
                    });
                    videoElement.srcObject = null;
                }
            });

            // As a final fallback, stop any active media tracks in the document
            document.querySelectorAll('video').forEach(v => {
                if (v.srcObject) {
                    v.srcObject.getTracks().forEach(t => {
                        try { t.stop(); } catch (_) { }
                    });
                    v.srcObject = null;
                }
            });
        } catch (error) {
            console.error('Error stopping camera stream:', error);
        }
    }

    // Update scanner status message
    updateStatus(message) {
        const statusElement = document.getElementById('scanner-status-text');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Check camera permissions
    async checkCameraPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });

            // Stop the stream immediately as we just wanted to check permission
            stream.getTracks().forEach(track => track.stop());

            return { granted: true };
        } catch (error) {
            let message = 'Permission caméra refusée';

            if (error.name === 'NotAllowedError') {
                message = 'Permission caméra refusée';
            } else if (error.name === 'NotFoundError') {
                message = 'Aucune caméra trouvée';
            } else if (error.name === 'NotSupportedError') {
                message = 'Caméra non supportée';
            }

            return { granted: false, error: message };
        }
    }

    // Get product information from barcode
    async getProductInfo(barcode) {
        try {
            // Try multiple APIs in sequence for better coverage
            let productInfo = await this.getFromOpenFoodFacts(barcode);
            if (productInfo) {
                return productInfo;
            }

            // Try UPC Database as fallback
            productInfo = await this.getFromUPCDatabase(barcode);
            if (productInfo) {
                return productInfo;
            }

            // Try Barcode Lookup as another fallback
            productInfo = await this.getFromBarcodeLookup(barcode);
            if (productInfo) {
                return productInfo;
            }

            // If not found in any database, return basic info
            return {
                name: `Produit ${barcode}`,
                barcode: barcode,
                category: 'Autre',
                alcoholContent: null,
                source: 'unknown'
            };

        } catch (error) {
            console.error('Error getting product info:', error);
            return {
                name: `Produit ${barcode}`,
                barcode: barcode,
                category: 'Autre',
                alcoholContent: null,
                source: 'unknown'
            };
        }
    }

    // Get product info from OpenFoodFacts
    async getFromOpenFoodFacts(barcode) {
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);

            if (!response.ok) {
                throw new Error('Product not found');
            }

            const data = await response.json();

            if (data.status === 0) {
                return null; // Product not found
            }

            const product = data.product;

            // Extract relevant information
            const productInfo = {
                name: product.product_name || product.product_name_fr || `Produit ${barcode}`,
                barcode: barcode,
                category: this.mapCategoryToLocal(product.categories),
                alcoholContent: this.extractAlcoholContent(product),
                brand: product.brands || null,
                quantity: product.quantity || null,
                ingredients: product.ingredients_text || null,
                image: product.image_url || null,
                source: 'openfoodfacts'
            };

            return productInfo;

        } catch (error) {
            console.error('OpenFoodFacts API error:', error);
            return null;
        }
    }

    // Map OpenFoodFacts categories to local categories
    mapCategoryToLocal(categories) {
        if (!categories) return 'Autre';

        const categoryString = categories.toLowerCase();

        if (categoryString.includes('beer') || categoryString.includes('bière') || categoryString.includes('bier')) {
            return 'Bière';
        } else if (categoryString.includes('wine') || categoryString.includes('vin') || categoryString.includes('wijn')) {
            return 'Vin';
        } else if (categoryString.includes('spirit') || categoryString.includes('liqueur') || categoryString.includes('whisky') ||
            categoryString.includes('vodka') || categoryString.includes('rum') || categoryString.includes('gin')) {
            return 'Spiritueux';
        } else if (categoryString.includes('cocktail') || categoryString.includes('mixed drink')) {
            return 'Cocktail';
        } else if (categoryString.includes('alcohol') || categoryString.includes('alcool')) {
            return 'Autre';
        }

        return 'Autre';
    }

    // Extract alcohol content from product data
    extractAlcoholContent(product) {
        // Try alcohol_by_volume field first
        if (product.alcohol_by_volume) {
            return parseFloat(product.alcohol_by_volume);
        }

        // Try to extract from nutriments
        if (product.nutriments && product.nutriments.alcohol) {
            return parseFloat(product.nutriments.alcohol);
        }

        // Try to extract from product name or description
        const text = (product.product_name || '') + ' ' + (product.generic_name || '');
        const alcoholMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);

        if (alcoholMatch) {
            return parseFloat(alcoholMatch[1]);
        }

        return null;
    }

    // Handle barcode detection
    async handleBarcodeDetected(barcode) {
        try {
            console.log('handleBarcodeDetected called with:', barcode);
            Utils.showMessage('Code-barres détecté, recherche du produit...', 'info');

            const productInfo = await this.getProductInfo(barcode);
            console.log('Product info retrieved:', productInfo);

            // Always open add drink modal with pre-filled data for user confirmation
            this.openAddDrinkModal(productInfo);

            // Stop scanner AFTER opening the modal
            this.stop();

        } catch (error) {
            console.error('Error handling barcode:', error);
            Utils.showMessage('Erreur lors du traitement du code-barres', 'error');
            // Stop scanner even on error
            this.stop();
        }
    }

    // Open add drink modal with product info
    openAddDrinkModal(productInfo) {
        // Fill form with product data
        const nameInput = document.getElementById('drink-name');
        const categorySelect = document.getElementById('drink-category');
        const alcoholInput = document.getElementById('drink-alcohol');
        const dateInput = document.getElementById('drink-date');
        const timeInput = document.getElementById('drink-time');
        const quantityInput = document.getElementById('drink-quantity');
        const unitSelect = document.getElementById('drink-unit');

        if (nameInput) nameInput.value = productInfo.name;
        if (categorySelect) {
            // Check if the detected category exists, otherwise create it
            this.ensureCategoryExists(productInfo.category).then(() => {
                categorySelect.value = productInfo.category;
            });
        }
        if (alcoholInput && productInfo.alcoholContent) {
            alcoholInput.value = productInfo.alcoholContent;
        }
        if (dateInput) dateInput.value = Utils.getCurrentDate();
        if (timeInput) timeInput.value = Utils.getCurrentTime();

        // Set default quantity and unit based on product type
        if (quantityInput) {
            quantityInput.value = this.getDefaultQuantity(productInfo);
        }
        if (unitSelect) {
            unitSelect.value = this.getDefaultUnit(productInfo);
        }

        // Store barcode and product info for later use
        const form = document.getElementById('add-drink-form');
        if (form) {
            form.dataset.barcode = productInfo.barcode;
            form.dataset.productInfo = JSON.stringify(productInfo);
        }

        // Close scanner modal and open add drink modal
        Utils.closeModal('scanner-modal');

        // Use app's method to open add drink modal with pre-filled product info
        if (window.app && window.app.openAddDrinkModal) {
            window.app.openAddDrinkModal(productInfo.category, productInfo);
        } else {
            Utils.openModal('add-drink-modal');
        }

        Utils.showMessage(`Produit trouvé: ${productInfo.name}`, 'success');
    }

    // Ensure category exists in database
    async ensureCategoryExists(categoryName) {
        try {
            const categories = await dbManager.getAllCategories();
            const categoryExists = categories.some(cat => cat.name === categoryName);

            if (!categoryExists) {
                await dbManager.addCategory({
                    name: categoryName
                });

                // Refresh categories in UI
                if (window.app && window.app.loadCategories) {
                    await window.app.loadCategories();
                }
                if (window.app && window.app.loadCategoriesForForm) {
                    await window.app.loadCategoriesForForm();
                }
            }
        } catch (error) {
            console.error('Error ensuring category exists:', error);
        }
    }

    // Get default quantity based on product type
    getDefaultQuantity(productInfo) {
        if (this.isBeer(productInfo)) {
            return 1; // 1 beer
        } else if (productInfo.category === 'Vin') {
            return 15; // 15cl glass of wine
        } else if (productInfo.category === 'Spiritueux') {
            return 4; // 4cl shot
        }
        return 1; // Default
    }

    // Get default unit based on product type
    getDefaultUnit(productInfo) {
        if (this.isBeer(productInfo)) {
            return 'EcoCup'; // Beer cup
        } else if (productInfo.category === 'Vin') {
            return 'cL'; // Centiliters for wine
        } else if (productInfo.category === 'Spiritueux') {
            return 'cL'; // Centiliters for spirits
        }
        return 'cL'; // Default
    }

    // Get product info from UPC Database
    async getFromUPCDatabase(barcode) {
        try {
            // Note: This is a free API but has limited requests
            const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                return null;
            }

            const product = data.items[0];

            return {
                name: product.title || `Produit ${barcode}`,
                barcode: barcode,
                category: this.mapCategoryFromTitle(product.title),
                alcoholContent: this.extractAlcoholFromTitle(product.title),
                brand: product.brand || null,
                source: 'upcitemdb'
            };

        } catch (error) {
            console.error('UPC Database API error:', error);
            return null;
        }
    }

    // Get product info from Barcode Lookup (requires API key)
    async getFromBarcodeLookup(barcode) {
        try {
            // Note: This API requires a key, but we can try the free tier
            // For production, you would need to get an API key from barcodelookup.com
            const response = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=YOUR_API_KEY`);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (!data.products || data.products.length === 0) {
                return null;
            }

            const product = data.products[0];

            return {
                name: product.product_name || `Produit ${barcode}`,
                barcode: barcode,
                category: this.mapCategoryFromTitle(product.product_name),
                alcoholContent: this.extractAlcoholFromTitle(product.product_name),
                brand: product.brand || null,
                source: 'barcodelookup'
            };

        } catch (error) {
            console.error('Barcode Lookup API error:', error);
            return null;
        }
    }

    // Map category from product title
    mapCategoryFromTitle(title) {
        if (!title) return 'Autre';

        const titleLower = title.toLowerCase();

        if (titleLower.includes('beer') || titleLower.includes('bière') || titleLower.includes('bier') ||
            titleLower.includes('ale') || titleLower.includes('lager') || titleLower.includes('stout')) {
            return 'Bière';
        } else if (titleLower.includes('wine') || titleLower.includes('vin') || titleLower.includes('rouge') ||
            titleLower.includes('blanc') || titleLower.includes('rosé') || titleLower.includes('champagne')) {
            return 'Vin';
        } else if (titleLower.includes('whisky') || titleLower.includes('whiskey') || titleLower.includes('vodka') ||
            titleLower.includes('rum') || titleLower.includes('gin') || titleLower.includes('cognac') ||
            titleLower.includes('brandy') || titleLower.includes('tequila') || titleLower.includes('liqueur')) {
            return 'Spiritueux';
        } else if (titleLower.includes('cocktail') || titleLower.includes('mojito') || titleLower.includes('martini')) {
            return 'Cocktail';
        }

        return 'Autre';
    }

    // Extract alcohol content from title
    extractAlcoholFromTitle(title) {
        if (!title) return null;

        const alcoholMatch = title.match(/(\d+(?:\.\d+)?)\s*%/);
        if (alcoholMatch) {
            return parseFloat(alcoholMatch[1]);
        }

        // Common alcohol content defaults based on type
        const titleLower = title.toLowerCase();
        if (titleLower.includes('beer') || titleLower.includes('bière')) {
            return 5.0; // Default beer alcohol content
        } else if (titleLower.includes('wine') || titleLower.includes('vin')) {
            return 12.0; // Default wine alcohol content
        } else if (titleLower.includes('whisky') || titleLower.includes('vodka') || titleLower.includes('gin')) {
            return 40.0; // Default spirits alcohol content
        }

        return null;
    }

    // Get category icon
    getCategoryIcon(categoryName) {
        const iconMap = {
            'Bière': '🍺',
            'Vin': '🍷',
            'Spiritueux': '🥃',
            'Cocktail': '🍹',
            'Champagne': '🥂',
            'Autre': '🥤'
        };
        return iconMap[categoryName] || '🥤';
    }

    // Initialize scanner modal
    initScannerModal() {
        const scannerModal = document.getElementById('scanner-modal');
        const closeButtons = scannerModal.querySelectorAll('.modal-close');

        // Setup close button handlers
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.stop();
                Utils.closeModal('scanner-modal');
            });
        });

        // Setup modal open/close handlers
        scannerModal.addEventListener('transitionend', (e) => {
            if (e.target === scannerModal) {
                if (scannerModal.classList.contains('active')) {
                    // Modal opened, start scanner
                    this.startScanning();
                } else {
                    // Modal closed, stop scanner
                    this.stop();
                }
            }
        });

        // Fallback: observe class changes to robustly start/stop even if no transition fires
        const classObserver = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (scannerModal.classList.contains('active')) {
                        this.startScanning();
                    } else {
                        this.stop();
                    }
                }
            }
        });
        classObserver.observe(scannerModal, { attributes: true });

        // Ensure camera stops on page lifecycle events
        window.addEventListener('pagehide', () => this.stop());
        window.addEventListener('beforeunload', () => this.stop());
        window.addEventListener('blur', () => {
            if (this.isScanning) this.stop();
        });

        // Setup visibility change handler to stop camera when page becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isScanning) {
                console.log('Page became hidden, stopping scanner to save battery');
                this.stop();
            }
        });

        // Setup barcode detection handler
        this.onDetected = (barcode) => {
            this.handleBarcodeDetected(barcode);
        };

        this.onError = (error) => {
            Utils.showMessage('Erreur du scanner: ' + error.message, 'error');
        };
    }

    // Start scanning process
    async startScanning() {
        try {
            // Avoid duplicate starts
            if (this.isScanning || this.isStarting) {
                return;
            }

            // Start the scanner; browser will prompt for permission if needed
            await this.start();

        } catch (error) {
            console.error('Error starting scanner:', error);
            this.updateStatus('Erreur lors du démarrage');
            Utils.showMessage('Impossible de démarrer le scanner', 'error');
        }
    }

    // Check if device supports camera
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    // Get available cameras
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    // Switch camera (front/back)
    async switchCamera() {
        const currentFacingMode = this.config.inputStream.constraints.facingMode;
        const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

        this.config.inputStream.constraints.facingMode = newFacingMode;

        if (this.isScanning) {
            this.stop();
            await this.start();
        }
    }

    // After starting, auto-widen readers if nothing detected
    scheduleFallbackProfile(timeoutMs = 10000) {
        this.clearFallbackTimer();
        this.hasDetected = false;
        this.fallbackTimer = setTimeout(() => {
            if (this.isScanning && !this.hasDetected) {
                console.log('No detection yet, widening decoder readers for robustness');
                this.reconfigureReaders(this.broadReaders);
                Utils.showMessage('Recherche de codes élargie pour une meilleure détection', 'info');
            }
        }, timeoutMs);
    }

    clearFallbackTimer() {
        if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
        }
    }

    reconfigureReaders(readers) {
        try {
            // Stop current scanning, update config, and restart
            Quagga.stop();
            this.config.decoder.readers = readers;
            Quagga.init(this.config, (err) => {
                if (err) {
                    console.error('Reconfiguration failed:', err);
                    return;
                }
                Quagga.start();
            });
        } catch (e) {
            console.error('Error reconfiguring readers', e);
        }
    }

    // Start inactivity timer to auto-stop camera if no barcode is detected
    startInactivityTimer() {
        this.clearInactivityTimer();
        this.inactivityTimeout = setTimeout(() => {
            if (this.isScanning) {
                console.log('No barcode detected in 30 seconds, stopping scanner');
                this.stop();
                Utils.showMessage('Arrêt automatique du scanner (inactivité)', 'info');
            }
        }, this.inactivityDuration);
    }

    // Clear the inactivity timer
    clearInactivityTimer() {
        if (this.inactivityTimeout) {
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = null;
        }
    }

    // Reset the inactivity timer (called when processing frames)
    resetInactivityTimer() {
        this.clearInactivityTimer();
        this.startInactivityTimer();
    }

    // Cleanup resources
    cleanup() {
        this.stop();
        this.isInitialized = false;
        this.onDetected = null;
        this.onError = null;
        this.clearInactivityTimer();
    }
}

// Create global scanner instance
const barcodeScanner = new BarcodeScanner();

// Export for use in other modules
window.barcodeScanner = barcodeScanner;

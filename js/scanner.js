// Barcode scanner functionality for AlcoNote PWA
// Using QuaggaJS for barcode detection

class BarcodeScanner {
    constructor() {
        this.isInitialized = false;
        this.isScanning = false;
        this.stream = null;
        this.config = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#scanner-viewport'),
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment" // Use back camera
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 10,
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader",
                    "i2of5_reader"
                ]
            },
            locate: true
        };
        this.onDetected = null;
        this.onError = null;
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
                const code = result.codeResult.code;
                console.log('Barcode detected:', code);
                
                // Stop scanning after detection
                this.stop();
                
                if (this.onDetected) {
                    this.onDetected(code);
                }
            }
        });
        
        Quagga.onProcessed((result) => {
            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;
            
            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                    result.boxes.filter((box) => box !== result.box).forEach((box) => {
                        Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
                    });
                }
                
                if (result.box) {
                    Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
                }
                
                if (result.codeResult && result.codeResult.code) {
                    Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
                }
            }
        });
    }
    
    // Start scanning
    async start() {
        try {
            if (!this.isInitialized) {
                await this.init();
            }
            
            Quagga.start();
            this.isScanning = true;
            
            // Update status
            this.updateStatus('Recherche de code-barres...');
            
        } catch (error) {
            console.error('Failed to start scanner:', error);
            this.updateStatus('Erreur lors du démarrage du scanner');
            
            if (this.onError) {
                this.onError(error);
            }
        }
    }
    
    // Stop scanning
    stop() {
        if (this.isInitialized && this.isScanning) {
            Quagga.stop();
            this.isScanning = false;
            this.updateStatus('Scanner arrêté');
            
            // Properly stop camera stream
            this.stopCameraStream();
        }
    }
    
    // Stop camera stream to free up resources
    stopCameraStream() {
        try {
            // Get all video tracks and stop them
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const videoElement = document.querySelector('#scanner-viewport video');
                if (videoElement && videoElement.srcObject) {
                    const stream = videoElement.srcObject;
                    const tracks = stream.getTracks();
                    tracks.forEach(track => {
                        track.stop();
                        console.log('Camera track stopped:', track.kind);
                    });
                    videoElement.srcObject = null;
                }
            }
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
    
    // Determine if product is beer for auto-save feature
    isBeer(productInfo) {
        return productInfo.category === 'Bière' || 
               (productInfo.name && productInfo.name.toLowerCase().includes('bière')) ||
               (productInfo.name && productInfo.name.toLowerCase().includes('beer'));
    }
    
    // Auto-save beer products
    async autoSaveBeer(productInfo) {
        try {
            const drinkData = {
                name: productInfo.name,
                category: productInfo.category,
                quantity: 1,
                unit: 'EcoCup', // Default for beer
                alcoholContent: productInfo.alcoholContent || 5, // Default beer alcohol content
                date: Utils.getCurrentDate(),
                time: Utils.getCurrentTime(),
                barcode: productInfo.barcode,
                location: await geoManager.getLocationForDrink()
            };
            
            const savedDrink = await dbManager.addDrink(drinkData);
            
            Utils.showMessage(`${productInfo.name} ajouté automatiquement!`, 'success');
            
            // Refresh UI if needed
            if (window.app && window.app.refreshCurrentTab) {
                window.app.refreshCurrentTab();
            }
            
            return savedDrink;
            
        } catch (error) {
            console.error('Error auto-saving beer:', error);
            Utils.showMessage('Erreur lors de la sauvegarde automatique', 'error');
            throw error;
        }
    }
    
    // Handle barcode detection
    async handleBarcodeDetected(barcode) {
        try {
            Utils.showMessage('Code-barres détecté, recherche du produit...', 'info');
            
            const productInfo = await this.getProductInfo(barcode);
            
            if (this.isBeer(productInfo)) {
                // Auto-save beer products
                await this.autoSaveBeer(productInfo);
            } else {
                // Open add drink modal with pre-filled data
                this.openAddDrinkModal(productInfo);
            }
            
        } catch (error) {
            console.error('Error handling barcode:', error);
            Utils.showMessage('Erreur lors du traitement du code-barres', 'error');
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
        
        // Use app's method to open add drink modal with pre-selected category
        if (window.app && window.app.openAddDrinkModal) {
            window.app.openAddDrinkModal(productInfo.category);
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
            // Check camera permission first
            const permission = await this.checkCameraPermission();
            
            if (!permission.granted) {
                this.updateStatus(permission.error);
                Utils.showMessage(permission.error, 'error');
                return;
            }
            
            // Start the scanner
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
    
    // Cleanup resources
    cleanup() {
        this.stop();
        this.isInitialized = false;
        this.onDetected = null;
        this.onError = null;
    }
}

// Create global scanner instance
const barcodeScanner = new BarcodeScanner();

// Export for use in other modules
window.barcodeScanner = barcodeScanner;

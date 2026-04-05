// Barcode handler — orchestrates camera detection, product lookup, and form population
// This is the main entry point that wires CameraScanner + ProductLookup together

class BarcodeHandler {
    constructor() {
        this.camera = cameraScanner;
        this.lookup = productLookup;
    }

    /**
     * Initialize the scanner modal: wire events, lifecycle, and detection handler.
     * Called once at app startup.
     */
    initScannerModal() {
        const scannerModal = document.getElementById('scanner-modal');

        // Close button handlers
        scannerModal.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', () => {
                this.camera.stop();
                Utils.closeModal('scanner-modal');
            });
        });

        // Start/stop scanner on modal open/close
        scannerModal.addEventListener('transitionend', (e) => {
            if (e.target === scannerModal) {
                if (scannerModal.classList.contains('active')) {
                    this._startScanning();
                } else {
                    this.camera.stop();
                }
            }
        });

        // Fallback: observe class changes in case no transition fires
        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (scannerModal.classList.contains('active')) {
                        this._startScanning();
                    } else {
                        this.camera.stop();
                    }
                }
            }
        });
        observer.observe(scannerModal, { attributes: true });

        // Stop camera on page lifecycle events
        window.addEventListener('pagehide', () => this.camera.stop());
        window.addEventListener('beforeunload', () => this.camera.stop());
        window.addEventListener('blur', () => {
            if (this.camera.isScanning) this.camera.stop();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.camera.isScanning) {
                console.log('Page became hidden, stopping scanner');
                this.camera.stop();
            }
        });

        // Wire barcode confirmed callback
        this.camera.onBarcodeConfirmed = (barcode) => {
            this._onBarcodeDetected(barcode);
        };

        this.camera.onError = (error) => {
            Utils.showMessage('Erreur du scanner: ' + error.message, 'error');
        };
    }

    // --- Private methods ---

    async _startScanning() {
        try {
            if (this.camera.isScanning || this.camera.isStarting) return;
            await this.camera.start();
        } catch (error) {
            console.error('Error starting scanner:', error);
            this.camera.updateStatus('Erreur lors du démarrage');
            Utils.showMessage('Impossible de démarrer le scanner', 'error');
        }
    }

    /**
     * Core flow: barcode detected → lookup product → ensure category → open form.
     * app.openAddDrinkModal() is the SOLE point of form population.
     */
    async _onBarcodeDetected(barcode) {
        try {
            console.log('Barcode detected:', barcode);
            Utils.showMessage('Code-barres détecté, recherche du produit...', 'info');

            // Lookup product info from APIs
            const product = await this.lookup.lookup(barcode);
            console.log('Product info:', product);

            // If a category was pre-selected by the user, honour it over the auto-detected one
            const targetCategory = this.pendingCategory || product.category;
            this.pendingCategory = null;

            // Ensure target category exists in DB before opening form
            await this._ensureCategoryExists(targetCategory);

            // Stop camera
            this.camera.stop();

            // Close scanner modal
            Utils.closeModal('scanner-modal');

            // Open add drink modal with normalized product — SOLE form population point
            if (window.app && window.app.openAddDrinkModal) {
                window.app.openAddDrinkModal(targetCategory, product);
            } else {
                Utils.openModal('add-drink-modal');
            }

            Utils.showMessage(`Produit trouvé: ${product.name}`, 'success');
        } catch (error) {
            console.error('Error handling barcode:', error);
            Utils.showMessage('Erreur lors du traitement du code-barres', 'error');
            this.camera.stop();
        }
    }

    async _ensureCategoryExists(categoryName) {
        try {
            const categories = await dbManager.getAllCategories();
            const exists = categories.some(cat => cat.name === categoryName);

            if (!exists) {
                await dbManager.addCategory({ name: categoryName });

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

    // --- Static helpers (kept for backward compatibility) ---

    static isSupported() {
        return CameraScanner.isSupported();
    }
}

// Create global instance (preserves window.barcodeScanner reference used by app.js)
const barcodeScanner = new BarcodeHandler();
window.barcodeScanner = barcodeScanner;

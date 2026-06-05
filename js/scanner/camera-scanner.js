// Camera scanner module — Quagga lifecycle, camera management, debounced detection
// Uses QuaggaJS for barcode reading from the device camera

// Quagga (~200 KB) is loaded lazily (see _ensureQuagga) the first time the
// scanner opens, instead of blocking the initial page load. Keep this URL
// identical to the one precached by the service worker so the on-demand
// fetch is served from cache and the scanner still works offline.
const QUAGGA_URL = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';

class CameraScanner {
    constructor() {
        this.isInitialized = false;
        this.isScanning = false;
        this.isStarting = false;
        this.stream = null;
        // Memoised promise for the on-demand Quagga script load so that
        // concurrent start() calls share a single network request.
        this._quaggaPromise = null;

        this.config = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: '#scanner-viewport',
                constraints: {
                    width: 640,
                    height: 480,
                    facingMode: "environment"
                },
                area: { top: "15%", right: "10%", left: "10%", bottom: "15%" }
            },
            locator: {
                patchSize: "small",
                halfSample: true
            },
            numOfWorkers: Math.min(navigator.hardwareConcurrency || 2, 4),
            frequency: 20,
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

        // Callbacks
        this.onBarcodeConfirmed = null;
        this.onError = null;
        // Distinct from onError so the consumer can show a
        // user-friendly "scanning timeout" message instead of the
        // generic "Caméra indisponible" used for hardware failures.
        this.onInactivity = null;

        // Timers
        this.inactivityTimeout = null;
        this.inactivityDuration = 30000;
        this.fallbackTimer = null;
        this.hasDetected = false;

        // Debounce state
        this._detectionBuffer = {};
        this._isProcessing = false;
        this._confirmThreshold = 2;
        this._bufferMaxAge = 1500;

        // Broader reader set for fallback
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

    // --- Lifecycle ---

    // Inject the Quagga <script> on demand. Resolves immediately when it's
    // already present (e.g. a second scan in the same session). The promise
    // is cleared on failure so a later open can retry the download.
    _ensureQuagga() {
        if (typeof Quagga !== 'undefined') return Promise.resolve();
        if (this._quaggaPromise) return this._quaggaPromise;
        this._quaggaPromise = new Promise((resolve, reject) => {
            const onFail = () => {
                this._quaggaPromise = null;
                reject(new Error('Échec du chargement du scanner'));
            };
            const existing = document.querySelector(`script[src="${QUAGGA_URL}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', onFail);
                if (typeof Quagga !== 'undefined') resolve();
                return;
            }
            const s = document.createElement('script');
            s.src = QUAGGA_URL;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = onFail;
            document.head.appendChild(s);
        });
        return this._quaggaPromise;
    }

    async init() {
        await this._ensureQuagga();
        return new Promise((resolve, reject) => {
            if (this.isInitialized) {
                resolve();
                return;
            }

            if (typeof Quagga === 'undefined') {
                reject(new Error('QuaggaJS not loaded'));
                return;
            }

            const targetEl = document.getElementById('scanner-viewport');
            if (!targetEl) {
                reject(new Error('Scanner viewport element not found in DOM'));
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
                this._setupEventListeners();
                resolve();
            });
        });
    }

    async start() {
        try {
            if (this.isStarting || this.isScanning) return;
            this.isStarting = true;

            if (!this.isInitialized) {
                await this.init();
            }

            Quagga.start();
            this.isScanning = true;
            this._isProcessing = false;
            this._detectionBuffer = {};
            this._scheduleFallbackProfile();

            this.updateStatus('Recherche de code-barres...');
            this._startInactivityTimer();
            this.isStarting = false;
        } catch (error) {
            console.error('Failed to start scanner:', error);
            this.updateStatus('Erreur lors du démarrage du scanner');
            if (this.onError) this.onError(error);
            this.isStarting = false;
            this.isInitialized = false;
        }
    }

    stop() {
        try {
            if (this.isInitialized) {
                try { Quagga.stop(); } catch (e) {
                    console.warn('Quagga.stop() failed:', e);
                }
            }
        } finally {
            this.isScanning = false;
            this.isStarting = false;
            this.isInitialized = false;
            this._isProcessing = false;
            this._detectionBuffer = {};
            this.updateStatus('Scanner arrêté');
            this._clearInactivityTimer();
            this._clearFallbackTimer();
            this._stopCameraStream();
        }
    }

    /**
     * Allow the handler to unlock processing after it's done,
     * so the scanner can detect new barcodes if restarted.
     */
    unlockProcessing() {
        this._isProcessing = false;
    }

    // --- Camera stream management ---

    _stopCameraStream() {
        try {
            if (typeof Quagga !== 'undefined' && Quagga.CameraAccess &&
                typeof Quagga.CameraAccess.release === 'function') {
                try { Quagga.CameraAccess.release(); } catch (e) {
                    console.warn('Quagga.CameraAccess.release() failed:', e);
                }
            }

            document.querySelectorAll('#scanner-viewport video').forEach(video => {
                if (video.srcObject) {
                    video.srcObject.getTracks().forEach(track => {
                        try { track.stop(); } catch (_) { }
                    });
                    video.srcObject = null;
                }
            });

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

    // --- Detection with debounce ---

    _setupEventListeners() {
        Quagga.onDetected((result) => {
            if (!this.isScanning || this._isProcessing) return;

            const code = result.codeResult.code;
            const now = Date.now();

            // Clean stale buffer entries
            for (const key in this._detectionBuffer) {
                if (now - this._detectionBuffer[key].firstSeen > this._bufferMaxAge) {
                    delete this._detectionBuffer[key];
                }
            }

            if (!this._detectionBuffer[code]) {
                this._detectionBuffer[code] = { count: 0, firstSeen: now };
            }
            this._detectionBuffer[code].count++;

            // Only confirm after threshold consecutive reads
            if (this._detectionBuffer[code].count >= this._confirmThreshold) {
                this._isProcessing = true;
                this._detectionBuffer = {};
                this.hasDetected = true;
                this._resetInactivityTimer();
                if (this.onBarcodeConfirmed) {
                    this.onBarcodeConfirmed(code);
                }
            }
        });

        Quagga.onProcessed((result) => {
            // Quagga.canvas only exists while Quagga is running. A trailing
            // onProcessed can fire during stop()/reconfigure when it's already
            // torn down — reading `.ctx`/`.dom` then throws. Bail early.
            if (!this.isScanning || !Quagga.canvas || !Quagga.canvas.ctx || !Quagga.canvas.dom) return;
            const drawingCtx = Quagga.canvas.ctx.overlay;
            const drawingCanvas = Quagga.canvas.dom.overlay;
            if (!drawingCtx || !drawingCanvas) return;

            if (result) {
                if (result.boxes) {
                    drawingCtx.clearRect(0, 0,
                        parseInt(drawingCanvas.getAttribute("width")),
                        parseInt(drawingCanvas.getAttribute("height")));
                    result.boxes.filter(box => box !== result.box).forEach(box => {
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

    // --- Utility ---

    updateStatus(message) {
        const el = document.getElementById('scanner-status-text');
        if (el) el.textContent = message;
    }

    async checkCameraPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
            stream.getTracks().forEach(track => track.stop());
            return { granted: true };
        } catch (error) {
            let message = 'Permission caméra refusée';
            if (error.name === 'NotFoundError') message = 'Aucune caméra trouvée';
            else if (error.name === 'NotSupportedError') message = 'Caméra non supportée';
            return { granted: false, error: message };
        }
    }

    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(d => d.kind === 'videoinput');
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    async switchCamera() {
        const current = this.config.inputStream.constraints.facingMode;
        this.config.inputStream.constraints.facingMode = current === 'environment' ? 'user' : 'environment';
        if (this.isScanning) {
            this.stop();
            await this.start();
        }
    }

    // --- Fallback reader expansion ---

    _scheduleFallbackProfile(timeoutMs = 10000) {
        this._clearFallbackTimer();
        this.hasDetected = false;
        this.fallbackTimer = setTimeout(() => {
            if (this.isScanning && !this.hasDetected) {
                this._reconfigureReaders(this.broadReaders);
                this._notify('Recherche de codes élargie pour une meilleure détection');
            }
        }, timeoutMs);
    }

    _notify(message) {
        try {
            if (typeof window !== 'undefined' && window.Toast && typeof window.Toast.show === 'function') {
                window.Toast.show(message);
            }
        } catch {}
    }

    _clearFallbackTimer() {
        if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
        }
    }

    _reconfigureReaders(readers) {
        // Leave the scanner in a clean, fully-stopped state on failure
        // instead of a frozen viewport with isScanning/isInitialized still
        // true (no detection, camera possibly still held). Surface the error
        // so the wrapping sheet can react.
        const failClean = (err) => {
            this.isScanning = false;
            this.isInitialized = false;
            this._clearInactivityTimer();
            this._stopCameraStream();
            this.updateStatus('Erreur lors du redémarrage du scanner');
            if (this.onError) { try { this.onError(err); } catch {} }
        };
        try {
            Quagga.stop();
            this.config.decoder.readers = readers;
            Quagga.init(this.config, (err) => {
                if (err) {
                    console.error('Reconfiguration failed:', err);
                    failClean(err);
                    return;
                }
                Quagga.start();
            });
        } catch (e) {
            console.error('Error reconfiguring readers:', e);
            failClean(e);
        }
    }

    // --- Inactivity timer ---

    _startInactivityTimer() {
        this._clearInactivityTimer();
        this.inactivityTimeout = setTimeout(() => {
            if (this.isScanning) {
                this.stop();
                // Notify the wrapping React sheet via a dedicated
                // callback so it can update its UI without conflating
                // the timeout with a hardware error.
                if (typeof this.onInactivity === 'function') {
                    try { this.onInactivity(); } catch {}
                }
                this._notify('Arrêt automatique du scanner (inactivité)');
            }
        }, this.inactivityDuration);
    }

    _clearInactivityTimer() {
        if (this.inactivityTimeout) {
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = null;
        }
    }

    _resetInactivityTimer() {
        this._clearInactivityTimer();
        this._startInactivityTimer();
    }
}

// Export global instance
const cameraScanner = new CameraScanner();
window.cameraScanner = cameraScanner;

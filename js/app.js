// Main application controller for AlcoNote PWA

class AlcoNoteApp {
    constructor() {
        this.currentTab = 'categories';
        this.isInitialized = false;
        this.swipeHandlers = new Map();
    }
    
    // Initialize the application
    async init() {
        try {
            console.log('Initializing AlcoNote PWA...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize all modules
            await this.initializeModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Handle URL parameters for shortcuts
            this.handleURLParams();
            
            // Load initial data
            await this.loadInitialData();
            
            // Register service worker
            await this.registerServiceWorker();
            
            this.isInitialized = true;
            console.log('AlcoNote PWA initialized successfully');
            
            // Enrichir les anciennes boissons sans adresse
            if (typeof this.enrichMissingAddresses === 'function') {
                this.enrichMissingAddresses().catch(console.warn);
            }
            
        } catch (error) {
            console.error('Failed to initialize AlcoNote PWA:', error);
            Utils.showMessage('Erreur lors de l\'initialisation de l\'application', 'error');
        }
    }
    
    // Initialize all modules
    async initializeModules() {
        // Initialize database (already done in database.js)
        console.log('Database initialized');
        
        // Initialize barcode scanner
        barcodeScanner.initScannerModal();
        console.log('Barcode scanner initialized');
        
        // Initialize statistics manager
        // Will be initialized when statistics tab is first accessed
        console.log('Statistics manager ready');
        
        // Initialize geolocation manager
        geoManager.init();
        // Keep time inputs updated when add drink modal opens
        if (typeof geoManager.initTimeUpdates === 'function') {
            geoManager.initTimeUpdates();
        }
        
        // Request location permission once on first app launch for better UX
        if (typeof geoManager.requestInitialLocationPermission === 'function') {
            try {
                await geoManager.requestInitialLocationPermission();
            } catch (error) {
                console.warn('Initial location permission request failed:', error);
            }
        }
        
        // Prewarm quick geolocation cache without prompting if permission already granted
        if (typeof geoManager.prewarmQuickPosition === 'function') {
            geoManager.prewarmQuickPosition();
        }
        console.log('Geolocation manager initialized');
    }
    
    // Setup all event listeners
    setupEventListeners() {
        // Tab navigation
        this.setupTabNavigation();
        
        // Floating Action Button
        this.setupFAB();
        
        // Modal handlers
        this.setupModalHandlers();
        
        // Form handlers
        this.setupFormHandlers();
        
        // Settings menu
        this.setupSettingsMenu();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Window events
        this.setupWindowEvents();
    }
    
    // Setup tab navigation
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                
                // Update active tab button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab content
                tabContents.forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Update current tab and load data
                this.currentTab = targetTab;
                this.updateFABVisibility();
                this.loadTabData(targetTab);
            });
        });
    }
    
    // Setup Floating Action Button
    setupFAB() {
        const addCategoryBtn = document.getElementById('add-category-btn');
        const fabContainer = document.getElementById('fab-container');
        
        // Show/hide FAB based on current tab
        this.updateFABVisibility();
        
        // Handle add category button click
        addCategoryBtn.addEventListener('click', () => {
            this.openAddCategoryModal();
        });
    }
    
    // Update FAB visibility based on current tab
    updateFABVisibility() {
        const fabContainer = document.getElementById('fab-container');
        if (this.currentTab === 'categories') {
            fabContainer.style.display = 'flex';
        } else {
            fabContainer.style.display = 'none';
        }
    }
    
    
    // Setup modal handlers
    setupModalHandlers() {
        // Generic modal close handlers
        document.addEventListener('click', (e) => {
            // Close modal when clicking on backdrop
            if (e.target.classList.contains('modal')) {
                Utils.closeModal(e.target.id);
            }
            
            // Close modal when clicking close button or cancel button
            if (e.target.classList.contains('modal-close') || 
                e.target.hasAttribute('data-modal')) {
                const modalId = e.target.dataset.modal || e.target.closest('.modal').id;
                if (modalId) {
                    Utils.closeModal(modalId);
                }
            }
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                Utils.closeAllModals();
            }
        });
    }
    
    // Setup form handlers
    setupFormHandlers() {
        // Add drink form
        const addDrinkForm = document.getElementById('add-drink-form');
        if (addDrinkForm) {
            addDrinkForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddDrink(addDrinkForm);
            });
            
            // Setup drink name suggestions
            this.setupDrinkSuggestions();

            // Scanner button inside add drink modal
            const scanBtn = document.getElementById('scan-barcode-btn');
            if (scanBtn) {
                scanBtn.addEventListener('click', () => {
                    this.openScannerModal();
                });
            }
        }
        
        // Add category form
        const addCategoryForm = document.getElementById('add-category-form');
        if (addCategoryForm) {
            addCategoryForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddCategory(addCategoryForm);
            });
        }
    }
    
    // Setup drink name suggestions
    setupDrinkSuggestions() {
        const nameInput = document.getElementById('drink-name');
        const suggestionsContainer = document.getElementById('drink-suggestions');
        
        if (!nameInput || !suggestionsContainer) return;
        
        const debouncedSearch = Utils.debounce(async (query) => {
            if (query.length < 2) {
                suggestionsContainer.classList.remove('active');
                return;
            }
            
            const suggestions = await dbManager.getDrinkSuggestions(query);
            this.displayDrinkSuggestions(suggestions, suggestionsContainer);
        }, 300);
        
        nameInput.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.form-group')) {
                suggestionsContainer.classList.remove('active');
            }
        });
    }
    
    // Display drink suggestions
    displayDrinkSuggestions(suggestions, container) {
        if (suggestions.length === 0) {
            container.classList.remove('active');
            return;
        }
        
        container.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" data-suggestion='${JSON.stringify(suggestion)}'>
                <strong>${suggestion.name}</strong>
                <span>${Utils.formatQuantity(suggestion.quantity, suggestion.unit)} - ${suggestion.category}</span>
            </div>
        `).join('');
        
        container.classList.add('active');
        
        // Handle suggestion clicks
        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const suggestion = JSON.parse(item.dataset.suggestion);
                this.fillFormWithSuggestion(suggestion);
                container.classList.remove('active');
            });
        });
    }
    
    // Fill form with suggestion data
    fillFormWithSuggestion(suggestion) {
        const nameInput = document.getElementById('drink-name');
        const categorySelect = document.getElementById('drink-category');
        const quantityInput = document.getElementById('drink-quantity');
        const unitSelect = document.getElementById('drink-unit');
        const alcoholInput = document.getElementById('drink-alcohol');
        
        if (nameInput) nameInput.value = suggestion.name;
        if (categorySelect) categorySelect.value = suggestion.category;
        if (quantityInput) quantityInput.value = suggestion.quantity;
        if (unitSelect) unitSelect.value = suggestion.unit;
        if (alcoholInput && suggestion.alcoholContent) {
            alcoholInput.value = suggestion.alcoholContent;
        }
    }
    
    // Setup settings menu
    setupSettingsMenu() {
        const settingsBtn = document.getElementById('settings-btn');
        const settingsMenu = document.getElementById('settings-menu');
        const settingsClose = document.getElementById('settings-close');
        
        // Open settings menu
        settingsBtn.addEventListener('click', () => {
            settingsMenu.classList.add('active');
            this.loadSettings();
        });
        
        // Close settings menu
        settingsClose.addEventListener('click', () => {
            settingsMenu.classList.remove('active');
        });
        
        // Close when clicking outside
        settingsMenu.addEventListener('click', (e) => {
            if (e.target === settingsMenu) {
                settingsMenu.classList.remove('active');
            }
        });
        
        // Setup settings form handlers
        this.setupSettingsHandlers();
    }
    
    // Setup settings handlers
    setupSettingsHandlers() {
        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', () => {
                this.setTheme(themeToggle.value);
            });
        }
        
        // User profile settings
        const weightInput = document.getElementById('user-weight');
        const genderSelect = document.getElementById('user-gender');

        if (weightInput) {
            weightInput.addEventListener('change', () => {
                const newWeight = parseFloat(weightInput.value) || null;
                dbManager.setSetting('userWeight', newWeight);

                // Dispatch custom event for statistics update
                window.dispatchEvent(new CustomEvent('userSettingsChanged', {
                    detail: { setting: 'userWeight', value: newWeight }
                }));
            });
        }

        if (genderSelect) {
            genderSelect.addEventListener('change', () => {
                const newGender = genderSelect.value || null;
                dbManager.setSetting('userGender', newGender);

                // Dispatch custom event for statistics update
                window.dispatchEvent(new CustomEvent('userSettingsChanged', {
                    detail: { setting: 'userGender', value: newGender }
                }));
            });
        }
        
        // Data management buttons
        const exportBtn = document.getElementById('export-data');
        const importBtn = document.getElementById('import-data');
        const clearBtn = document.getElementById('clear-data');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
        
        if (importBtn) {
            importBtn.addEventListener('click', () => this.importData());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllData());
        }
    }
    
    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when no modal is open and no input is focused
            if (document.querySelector('.modal.active') || 
                document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT') {
                return;
            }
            
            switch (e.key) {
                case '1':
                    this.switchToTab('categories');
                    break;
                case '2':
                    this.switchToTab('drinks');
                    break;
                case '3':
                    this.switchToTab('statistics');
                    break;
                case 'a':
                case 'A':
                    this.openAddDrinkModal();
                    break;
                case 's':
                case 'S':
                    this.openScannerModal();
                    break;
            }
        });
    }
    
    // Setup window events
    setupWindowEvents() {
        // Listen for address updates from geoManager
        window.addEventListener("addressFound", (e) => {
            console.log("New address found:", e.detail);
            // Refresh the current tab to display updated addresses immediately
            if (window.app && typeof window.app.refreshCurrentTab === "function") {
                window.app.refreshCurrentTab();
            }
        });

        // Handle app install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallPrompt();
        });
        
        // Handle app installed
        window.addEventListener('appinstalled', () => {
            Utils.showMessage('AlcoNote installé avec succès!', 'success');
            this.deferredPrompt = null;
        });
        
        // Handle online/offline status
        window.addEventListener('online', () => {
            Utils.showMessage('Connexion rétablie', 'success');
        });
        
        window.addEventListener('offline', () => {
            Utils.showMessage('Mode hors ligne activé', 'warning');
        });
        
        // Handle visibility change (app focus/blur)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isInitialized) {
                // App became visible, refresh current tab
                this.refreshCurrentTab();
            }
        });
    }
    
    // Handle URL parameters for PWA shortcuts
    handleURLParams() {
        const params = Utils.getURLParams();
        
        if (params.action) {
            setTimeout(() => {
                switch (params.action) {
                    case 'add-drink':
                        this.openAddDrinkModal();
                        break;
                    case 'scan':
                        this.openScannerModal();
                        break;
                    case 'stats':
                        this.switchToTab('statistics');
                        break;
                }
            }, 500); // Delay to ensure app is fully loaded
        }
    }
    
    // Load initial data
    async loadInitialData() {
        // Initialize theme
        await this.initializeTheme();
        
        // Load categories for the form
        await this.loadCategoriesForForm();
        
        // Load current tab data
        await this.loadTabData(this.currentTab);
    }
    
    // Load categories for form dropdown
    async loadCategoriesForForm() {
        try {
            const categories = await dbManager.getAllCategories();
            const categorySelect = document.getElementById('drink-category');
            
            if (categorySelect) {
                categorySelect.innerHTML = '<option value="">Sélectionner une catégorie</option>';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.name;
                    option.textContent = category.name;
                    categorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading categories for form:', error);
        }
    }
    
    // Load data for specific tab
    async loadTabData(tabName) {
        try {
            switch (tabName) {
                case 'categories':
                    await this.loadCategories();
                    break;
                case 'history':
                    await this.loadHistory();
                    break;
                case 'statistics':
                    if (!modularStatsManager.isInitialized) {
                        modularStatsManager.init();
                    } else {
                        modularStatsManager.loadStatistics();
                    }
                    break;
            }
        } catch (error) {
            Utils.handleError(error, `loading ${tabName} data`);
        }
    }
    
    // Load and display categories
    async loadCategories() {
        const container = document.getElementById('categories-list');
        const loading = Utils.showLoading(container);
        
        try {
            const categories = await dbManager.getAllCategories();
            
            container.innerHTML = '';
            
            if (categories.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📁</div>
                        <h3 class="empty-state-title">Aucune catégorie</h3>
                        <p class="empty-state-description">
                            Commencez par ajouter une catégorie pour organiser vos boissons.
                        </p>
                    </div>
                `;
                return;
            }
            
            categories.forEach(category => {
                const categoryElement = this.createCategoryElement(category);
                container.appendChild(categoryElement);
            });
            
        } catch (error) {
            Utils.handleError(error, 'loading categories');
        } finally {
            Utils.hideLoading(loading);
        }
    }
    
    // Create category element
    createCategoryElement(category) {
        const element = document.createElement('div');
        element.className = 'category-item animate-fade-in';
        element.innerHTML = `
            <div class="category-main" data-category="${category.name}">
                <div class="category-name">${category.name}</div>
                <div class="category-actions">
                    <span class="category-count">${typeof category.drinkCount === 'number' ? category.drinkCount : 0}</span>
                    <button class="category-edit-btn" aria-label="Modifier la catégorie" title="Modifier la catégorie">✏️</button>
                </div>
            </div>
            <div class="category-editor" style="display:none;">
                <input type="text" class="category-name-input" value="${category.name}" aria-label="Nouveau nom de catégorie">
                <button class="btn-primary save-rename-btn">Enregistrer</button>
                <button class="btn-danger delete-category-btn">Supprimer</button>
                <button class="btn-secondary cancel-edit-btn">Annuler</button>
            </div>
        `;

        // Open detail on main area click (not when editing)
        const main = element.querySelector('.category-main');
        if (main) {
            main.addEventListener('click', () => {
                this.openCategoryDetailPage(category);
            });
        }

        // Edit button toggles inline editor
        const editBtn = element.querySelector('.category-edit-btn');
        const editor = element.querySelector('.category-editor');
        const input = element.querySelector('.category-name-input');
        if (editBtn && editor && input) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editor.style.display = editor.style.display === 'none' ? 'flex' : 'none';
                if (editor.style.display !== 'none') {
                    input.focus();
                    input.select();
                }
            });
        }

        // Save rename
        const saveBtn = element.querySelector('.save-rename-btn');
        if (saveBtn && input) {
            saveBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const newName = input.value.trim();
                const oldName = category.name;
                if (!newName) {
                    Utils.showMessage('Le nom de catégorie ne peut pas être vide', 'error');
                    return;
                }
                try {
                    await dbManager.renameCategory(oldName, newName);
                    Utils.showMessage('Catégorie renommée avec succès', 'success');

                    // Notify stats and other views that drinks categories may have changed
                    window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                        detail: { action: 'category-rename', from: oldName, to: newName }
                    }));

                    // Refresh lists and form options
                    await this.loadCategories();
                    await this.loadCategoriesForForm();
                } catch (error) {
                    Utils.handleError(error, 'renaming category');
                }
            });
        }

        // Delete category
        const deleteBtn = element.querySelector('.delete-category-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    // Get current value from input (in case user changed it)
                    const nameToDelete = input ? input.value.trim() : category.name;
                    const cat = await dbManager.getCategoryByName(nameToDelete);
                    if (!cat) {
                        Utils.showMessage('Catégorie introuvable', 'error');
                        return;
                    }
                    await dbManager.deleteCategory(cat.id);
                    Utils.showMessage('Catégorie supprimée', 'success');

                    // Refresh lists and form options
                    await this.loadCategories();
                    await this.loadCategoriesForForm();
                } catch (error) {
                    // Typically when category has drinks
                    Utils.handleError(error, 'deleting category');
                }
            });
        }

        // Cancel editing
        const cancelBtn = element.querySelector('.cancel-edit-btn');
        if (cancelBtn && editor) {
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editor.style.display = 'none';
            });
        }

        return element;
    }
    
    // Show add drink options (scanner or manual)
    showAddDrinkOptions(categoryName, buttonElement) {
        // Remove any existing options menu
        const existingMenu = document.querySelector('.add-options-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create options menu
        const optionsMenu = document.createElement('div');
        optionsMenu.className = 'add-options-menu';
        optionsMenu.innerHTML = `
            <button class="add-option" data-action="manual" data-category="${categoryName}">
                <span class="option-icon">✏️</span>
                <span class="option-label">Manuel</span>
            </button>
            <button class="add-option" data-action="scan" data-category="${categoryName}">
                <span class="option-icon">📷</span>
                <span class="option-label">Scanner</span>
            </button>
        `;
        
        // Position menu relative to button
        const rect = buttonElement.getBoundingClientRect();
        optionsMenu.style.position = 'fixed';
        optionsMenu.style.top = `${rect.top - 80}px`;
        optionsMenu.style.left = `${rect.left - 60}px`;
        optionsMenu.style.zIndex = '1000';
        
        document.body.appendChild(optionsMenu);
        
        // Add event listeners to options
        optionsMenu.querySelectorAll('.add-option').forEach(option => {
            option.addEventListener('click', () => {
                const action = option.dataset.action;
                const category = option.dataset.category;
                
                if (action === 'manual') {
                    this.openAddDrinkModal(category);
                } else if (action === 'scan') {
                    this.openScannerModal(category);
                }
                
                optionsMenu.remove();
            });
        });
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!optionsMenu.contains(e.target) && e.target !== buttonElement) {
                    optionsMenu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }
    
    // Load and display history
    async loadHistory() {
        const container = document.getElementById('history-list');
        const loading = Utils.showLoading(container);
        
        try {
            const drinks = await dbManager.getAllDrinks();
            
            container.innerHTML = '';
            
            if (drinks.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📅</div>
                        <h3 class="empty-state-title">Aucun historique</h3>
                        <p class="empty-state-description">
                            Vos boissons ajoutées apparaîtront ici organisées par date.
                        </p>
                    </div>
                `;
                return;
            }
            
            // Group drinks by date
            const drinksByDate = {};
            drinks.forEach(drink => {
                if (!drinksByDate[drink.date]) {
                    drinksByDate[drink.date] = [];
                }
                drinksByDate[drink.date].push(drink);
            });
            
            // Sort dates (most recent first)
            const sortedDates = Object.keys(drinksByDate).sort((a, b) => new Date(b) - new Date(a));
            
            sortedDates.forEach(date => {
                const dayDrinks = drinksByDate[date].sort((a, b) => b.time.localeCompare(a.time));
                const dayElement = this.createHistoryDayElement(date, dayDrinks);
                container.appendChild(dayElement);
            });
            
        } catch (error) {
            Utils.handleError(error, 'loading history');
        } finally {
            Utils.hideLoading(loading);
        }
    }
    
    // Create history day element with collapsible functionality
    createHistoryDayElement(date, drinks) {
        const element = document.createElement('div');
        element.className = 'history-day animate-fade-in';
        
        const totalVolume = drinks.reduce((sum, drink) => {
            let volumeInCL = drink.quantity;
            if (drink.unit === 'EcoCup') volumeInCL = 25;
            else if (drink.unit === 'L') volumeInCL = drink.quantity * 100;
            return sum + volumeInCL;
        }, 0);
        
        element.innerHTML = `
            <div class="history-day-header">
                <div class="history-day-info">
                    <h3 class="history-day-date">${Utils.formatDate(date)}</h3>
                    <div class="history-day-summary">
                        ${drinks.length} boisson${drinks.length > 1 ? 's' : ''} • ${(totalVolume / 100).toFixed(1)}L
                    </div>
                </div>
                <button class="history-day-toggle">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div class="history-day-content">
                ${drinks.map(drink => `
                        <div class="history-drink-item swipeable" data-drink-id="${drink.id}">
                            <div class="history-drink-info">
                                <div class="history-drink-main">
                                    <span class="history-drink-name">${drink.name}</span>
                                    <span class="history-drink-time">${drink.time}</span>
                                </div>
                                <div class="history-drink-details">
                                    <span class="history-drink-quantity">${Utils.formatQuantity(drink.quantity, drink.unit)}</span>
                                    ${drink.alcoholContent ? `<span class="history-drink-alcohol">${drink.alcoholContent}%</span>` : ''}
                                </div>
                                ${drink.location ? `<div class="history-drink-location">${drink.location.address || 'Géolocalisé'}</div>` : ''}
                            </div>
                            <button class="history-drink-add" data-drink='${JSON.stringify(drink)}'>
                                <span>+</span>
                            </button>
                            <div class="delete-indicator">Supprimer</div>
                        </div>
                `).join('')}
            </div>
        `;
        
        // Setup collapsible functionality
        const header = element.querySelector('.history-day-header');
        const content = element.querySelector('.history-day-content');
        const toggle = element.querySelector('.toggle-icon');
        
        header.addEventListener('click', () => {
            const isExpanded = content.style.display !== 'none';
            content.style.display = isExpanded ? 'none' : 'block';
            toggle.textContent = isExpanded ? '▶' : '▼';
            element.classList.toggle('collapsed', isExpanded);
        });
        
        // Setup + button functionality
        element.querySelectorAll('.history-drink-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const drinkData = JSON.parse(btn.dataset.drink);
                this.addSameDrinkFromHistory(drinkData);
            });
        });
        
        // Setup swipe to delete
        this.setupSwipeToDelete(element);
        
        return element;
    }
    
    // Add same drink from history - INSTANT VERSION
    async addSameDrinkFromHistory(originalDrink) {
        // INSTANT UI FEEDBACK - Show success immediately
        Utils.showMessage(`${originalDrink.name} ajouté!`, 'success');

        // BACKGROUND OPERATIONS (completely non-blocking)
        queueMicrotask(async () => {
            try {
                // Use instant location or fallback
                let location = geoManager.getLocationInstant() || { 
                    latitude: 0, longitude: 0, accuracy: null, address: 'Localisation en cours...' 
                };

                const drinkData = {
                    name: originalDrink.name,
                    category: originalDrink.category,
                    quantity: originalDrink.quantity,
                    unit: originalDrink.unit,
                    alcoholContent: originalDrink.alcoholContent,
                    date: Utils.getCurrentDate(),
                    time: Utils.getCurrentTime(),
                    location: location
                };

                // Save in background
                const result = await dbManager.addDrink(drinkData);
                
                // Update events in background
                window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                    detail: { action: 'add', drink: drinkData }
                }));

                // Background location update if needed
                if (location.latitude === 0) {
                    try {
                        await geoManager.ensureConsent();
                        const realLocation = await geoManager.getLocationForDrinkFast(200);
                        if (realLocation && result) {
                            dbManager.updateDrink(result.id, { location: realLocation }).catch(console.warn);
                        }
                    } catch (e) { /* ignore */ }
                }

                // Background UI refresh (throttled)
                this.scheduleBackgroundRefresh();

            } catch (error) {
                console.warn('Background save failed:', error);
            }
        });
    }
    
    // Load and display drinks
    async loadDrinks() {
        const container = document.getElementById('drinks-list');
        if (!container) {
            console.warn('Drinks list container not found');
            return;
        }
        
        const loading = Utils.showLoading(container);
        
        try {
            const groupedDrinks = await dbManager.getGroupedDrinks();
            
            container.innerHTML = '';
            
            if (groupedDrinks.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🍺</div>
                        <h3 class="empty-state-title">Aucune boisson</h3>
                        <p class="empty-state-description">
                            Ajoutez votre première boisson en utilisant le bouton + ou le scanner.
                        </p>
                    </div>
                `;
                return;
            }
            
            groupedDrinks.forEach(group => {
                const drinkElement = this.createDrinkGroupElement(group);
                container.appendChild(drinkElement);
            });
            
        } catch (error) {
            Utils.handleError(error, 'loading drinks');
        } finally {
            Utils.hideLoading(loading);
        }
    }
    
    // Create drink group element
    createDrinkGroupElement(group) {
        const element = document.createElement('div');
        element.className = 'drink-group animate-fade-in';
        element.innerHTML = `
            <div class="drink-group-header">
                <div class="drink-group-info">
                    <div class="drink-count">${group.count}</div>
                    <div>
                        <div class="drink-name">${group.name}</div>
                        <div class="drink-quantity">${Utils.formatQuantity(group.quantity, group.unit)}</div>
                    </div>
                </div>
            </div>
        `;
        
        element.addEventListener('click', () => {
            this.openDrinkDetail(group);
        });
        
        return element;
    }
    
    // Open modal functions
    async openAddDrinkModal(categoryName = null) {
        // Ensure we request geolocation permission once before adding
        try { await geoManager.ensureConsent(); } catch (e) { /* ignore */ }
        console.log('Opening add drink modal with category:', categoryName);

        // Reset form state to ensure we're in add mode, not edit mode
        const form = document.getElementById('add-drink-form');
        if (form) {
            console.log('Current form dataset before reset:', { ...form.dataset });
            delete form.dataset.editingDrinkId;
            delete form.dataset.barcode;
            console.log('Form dataset after reset:', { ...form.dataset });

            // Reset form title and button text
            const modalTitle = document.querySelector('#add-drink-modal .modal-title');
            const submitButton = document.querySelector('#add-drink-form button[type="submit"]');

            if (modalTitle) modalTitle.textContent = 'Ajouter une boisson';
            if (submitButton) submitButton.textContent = 'Ajouter';
        }

        // Clear the form completely
        Utils.resetForm(form);

        // Set current date and time
        const dateInput = document.getElementById('drink-date');
        const timeInput = document.getElementById('drink-time');
        const categorySelect = document.getElementById('drink-category');
        const categoryFormGroup = document.getElementById('category-form-group');

        if (dateInput) dateInput.value = Utils.getCurrentDate();
        if (timeInput) timeInput.value = Utils.getCurrentTime();

        // Pre-select category if provided and hide the field
        if (categoryName && categorySelect) {
            categorySelect.value = categoryName;
            categoryFormGroup.style.display = 'none';

            // Add hidden input to ensure category is submitted
            let hiddenCategoryInput = document.getElementById('hidden-category');
            if (!hiddenCategoryInput) {
                hiddenCategoryInput = document.createElement('input');
                hiddenCategoryInput.type = 'hidden';
                hiddenCategoryInput.id = 'hidden-category';
                hiddenCategoryInput.name = 'category';
                categoryFormGroup.parentNode.appendChild(hiddenCategoryInput);
            }
            hiddenCategoryInput.value = categoryName;
        } else {
            // Show category field if no category pre-selected
            categoryFormGroup.style.display = 'block';
            const hiddenCategoryInput = document.getElementById('hidden-category');
            if (hiddenCategoryInput) {
                hiddenCategoryInput.remove();
            }
        }

        Utils.openModal('add-drink-modal');
        console.log('Add drink modal opened successfully');
    }
    
    openAddCategoryModal() {
        Utils.openModal('add-category-modal');
    }
    
    openScannerModal(categoryName = null) {
        if (!BarcodeScanner.isSupported()) {
            Utils.showMessage('Scanner non supporté sur cet appareil', 'error');
            return;
        }
        
        // Store category for pre-selection after scan
        if (categoryName) {
            this.pendingScanCategory = categoryName;
        }
        
        Utils.openModal('scanner-modal');
    }
    
    // Open edit drink modal
    async openEditDrinkModal(drinkId) {
        try {
            const drink = await dbManager.getDrinkById(drinkId);
            if (!drink) {
                Utils.showMessage('Boisson introuvable', 'error');
                return;
            }
            
            // Fill form with drink data
            const nameInput = document.getElementById('drink-name');
            const categorySelect = document.getElementById('drink-category');
            const quantityInput = document.getElementById('drink-quantity');
            const unitSelect = document.getElementById('drink-unit');
            const alcoholInput = document.getElementById('drink-alcohol');
            const dateInput = document.getElementById('drink-date');
            const timeInput = document.getElementById('drink-time');
            const categoryFormGroup = document.getElementById('category-form-group');
            
            if (nameInput) nameInput.value = drink.name;
            if (categorySelect) categorySelect.value = drink.category;
            if (quantityInput) quantityInput.value = drink.quantity;
            if (unitSelect) unitSelect.value = drink.unit;
            if (alcoholInput) alcoholInput.value = drink.alcoholContent || '';
            if (dateInput) dateInput.value = drink.date;
            if (timeInput) timeInput.value = drink.time;
            
            // Show category field for editing
            if (categoryFormGroup) {
                categoryFormGroup.style.display = 'block';
            }
            
            // Store drink ID for update
            const form = document.getElementById('add-drink-form');
            if (form) {
                form.dataset.editingDrinkId = drinkId;
                
                // Change form title and button text
                const modalTitle = document.querySelector('#add-drink-modal .modal-title');
                const submitButton = document.querySelector('#add-drink-form button[type="submit"]');
                
                if (modalTitle) modalTitle.textContent = 'Modifier la boisson';
                if (submitButton) submitButton.textContent = 'Modifier';
            }
            
            Utils.openModal('add-drink-modal');
            
        } catch (error) {
            Utils.handleError(error, 'opening edit drink modal');
        }
    }
    
    // Handle form submissions with ultra-fast optimistic updates
    async handleAddDrink(form) {
        try {
            console.log('Handling add drink form submission');

            if (!Utils.validateForm(form)) {
                Utils.showMessage('Veuillez remplir tous les champs requis', 'error');
                return;
            }

            const formData = Utils.getFormData(form);
            const isEditing = form.dataset.editingDrinkId;

            // Get category from hidden input if it exists, otherwise from select
            let category = formData.category;
            const hiddenCategoryInput = document.getElementById('hidden-category');
            if (hiddenCategoryInput && hiddenCategoryInput.value) {
                category = hiddenCategoryInput.value;
            }

            // INSTANT UI FEEDBACK - Close modal and show success immediately
            Utils.closeModal('add-drink-modal');
            Utils.resetForm(form);
            
            // Reset form state immediately
            delete form.dataset.editingDrinkId;
            delete form.dataset.barcode;
            const modalTitle = document.querySelector('#add-drink-modal .modal-title');
            const submitButton = document.querySelector('#add-drink-form button[type="submit"]');
            if (modalTitle) modalTitle.textContent = 'Ajouter une boisson';
            if (submitButton) submitButton.textContent = 'Ajouter';

            // Show success message immediately (optimistic)
            Utils.showMessage(`${formData.name} ajouté!`, 'success');

            // Get location for new drinks (ultra-fast or fallback to coordinates 0,0)
            let location = null;
            if (!isEditing) {
                location = geoManager.getLocationInstant();
                if (!location) {
                    // Don't wait for consent or location - use fallback
                    location = { latitude: 0, longitude: 0, accuracy: null, address: 'Localisation en cours...' };
                    
                    // Try to get real location in background (non-blocking)
                    setTimeout(async () => {
                        try {
                            await geoManager.ensureConsent();
                            const realLocation = await geoManager.getLocationForDrinkFast(200);
                            if (realLocation && location.latitude === 0) {
                                // Update the drink with real location
                                location.latitude = realLocation.latitude;
                                location.longitude = realLocation.longitude;
                                location.accuracy = realLocation.accuracy;
                                location.address = realLocation.address;
                                
                                // Update in database without blocking UI
                                if (savedDrink) {
                                    dbManager.updateDrink(savedDrink.id, { location: realLocation }).catch(console.warn);
                                }
                            }
                        } catch (e) {
                            console.warn('Background location failed:', e);
                        }
                    }, 50);
                }
            }

            const drinkData = {
                name: formData.name,
                category: category,
                quantity: parseFloat(formData.quantity),
                unit: formData.unit,
                alcoholContent: formData.alcoholContent ? parseFloat(formData.alcoholContent) : null,
                date: formData.date,
                time: formData.time,
                barcode: form.dataset.barcode || null
            };

            if (!isEditing) {
                drinkData.location = location;
            }

            // BACKGROUND OPERATIONS (non-blocking)
            let savedDrink = null;
            setTimeout(async () => {
                try {
                    if (isEditing) {
                        await dbManager.updateDrink(parseInt(isEditing), drinkData);
                        window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                            detail: { action: 'update', drink: drinkData, drinkId: parseInt(isEditing) }
                        }));
                    } else {
                        savedDrink = await dbManager.addDrink(drinkData);
                        window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                            detail: { action: 'add', drink: drinkData }
                        }));
                    }

                    // Background UI refresh (throttled)
                    this.scheduleBackgroundRefresh();
                    
                } catch (error) {
                    console.error('Background drink save failed:', error);
                    // Show error but don't revert optimistic UI
                    Utils.showMessage('Erreur lors de la sauvegarde, réessayez si nécessaire', 'warning');
                }
            }, 10);

        } catch (error) {
            console.error('Error in handleAddDrink:', error);
            Utils.handleError(error, isEditing ? 'updating drink' : 'adding drink');
        }
    }

    // Throttled background refresh to avoid UI blocking
    scheduleBackgroundRefresh() {
        if (this.backgroundRefreshTimer) return;
        
        this.backgroundRefreshTimer = setTimeout(() => {
            // Only refresh if user is still on the same tab
            if (document.visibilityState === 'visible') {
                this.refreshCurrentTab();
                this.loadCategoriesForForm();
                this.refreshBACEstimation();
            }
            this.backgroundRefreshTimer = null;
        }, 500); // Delay to allow multiple quick additions
    }
    
    async handleAddCategory(form) {
        try {
            if (!Utils.validateForm(form)) {
                Utils.showMessage('Veuillez remplir tous les champs requis', 'error');
                return;
            }
            
            const formData = Utils.getFormData(form);
            
            await dbManager.addCategory({ name: formData.name });
            
            Utils.showMessage('Catégorie ajoutée avec succès!', 'success');
            Utils.closeModal('add-category-modal');
            Utils.resetForm(form);
            
            // Refresh categories and form
            this.loadCategories();
            this.loadCategoriesForForm();
            
        } catch (error) {
            Utils.handleError(error, 'adding category');
        }
    }
    
    // Open category detail page
    async openCategoryDetailPage(category) {
        try {
            // Get drinks for this category
            const drinks = await dbManager.getDrinksByCategory(category.name);
            
            // Group drinks by name and aggregate counts
            const drinkGroups = {};
            drinks.forEach(drink => {
                const key = drink.name;
                if (!drinkGroups[key]) {
                    drinkGroups[key] = {
                        name: drink.name,
                        category: drink.category,
                        quantity: drink.quantity,
                        unit: drink.unit,
                        alcoholContent: drink.alcoholContent,
                        count: 0,
                        lastConsumed: null,
                        drinks: []
                    };
                }
                drinkGroups[key].count++;
                drinkGroups[key].drinks.push(drink);
                
                // Update last consumed date
                if (!drinkGroups[key].lastConsumed || drink.date > drinkGroups[key].lastConsumed) {
                    drinkGroups[key].lastConsumed = drink.date;
                }
            });
            
            // Convert to array and sort by count (descending)
            const sortedDrinks = Object.values(drinkGroups).sort((a, b) => b.count - a.count);
            
            // Create and show category detail modal
            this.showCategoryDetailModal(category, sortedDrinks);
            
        } catch (error) {
            Utils.handleError(error, 'opening category detail page');
        }
    }
    
    // Show category detail modal
    showCategoryDetailModal(category, drinkGroups) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('category-detail-modal');
        if (!modal) {
            modal = this.createCategoryDetailModal();
        }
        
        const title = modal.querySelector('.modal-title');
        const content = modal.querySelector('.category-detail-content');
        const addButton = modal.querySelector('.add-category-drink-btn');
        
        title.textContent = category.name;
        
        if (drinkGroups.length === 0) {
            content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍺</div>
                    <h3 class="empty-state-title">Aucune boisson</h3>
                    <p class="empty-state-description">
                        Ajoutez votre première boisson dans cette catégorie.
                    </p>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="category-drinks-list">
                    ${drinkGroups.map(group => `
                        <div class="category-drink-item">
                            <div class="drink-info">
                                <div class="drink-name">${group.name}</div>
                                <div class="drink-details">
                                    ${Utils.formatQuantity(group.quantity, group.unit)}
                                    ${group.alcoholContent ? ` • ${group.alcoholContent}%` : ''}
                                    ${group.lastConsumed ? ` • Dernière: ${Utils.formatDate(group.lastConsumed)}` : ''}
                                </div>
                            </div>
                            <div class="drink-counter">
                                <span class="counter-value">${group.count}</span>
                                <button class="counter-add-btn" data-drink='${JSON.stringify(group)}' aria-label="Ajouter cette boisson">
                                    <span>+</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            
            // Setup + button functionality for each drink
            content.querySelectorAll('.counter-add-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const drinkData = JSON.parse(btn.dataset.drink);
                    
                    // Add visual feedback
                    const counterValue = btn.parentElement.querySelector('.counter-value');
                    const originalCount = parseInt(counterValue.textContent);
                    
                    // Temporarily update counter with animation
                    counterValue.textContent = originalCount + 1;
                    counterValue.classList.add('increment-animation');
                    
                    // Disable button temporarily
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    
                    try {
                        await this.addDrinkFromCategory(drinkData);
                        
                        // Refresh the modal content after successful addition
                        setTimeout(() => {
                            this.openCategoryDetailPage(category);
                        }, 300);
                        
                    } catch (error) {
                        // Revert counter on error
                        counterValue.textContent = originalCount;
                        btn.disabled = false;
                        btn.style.opacity = '1';
                        Utils.handleError(error, 'adding drink from category');
                    }
                    
                    // Remove animation class
                    setTimeout(() => {
                        counterValue.classList.remove('increment-animation');
                    }, 300);
                });
            });
        }
        
        // Setup add new drink button
        addButton.onclick = () => {
            Utils.closeModal('category-detail-modal');
            this.openAddDrinkModal(category.name);
        };
        
        Utils.openModal('category-detail-modal');
    }
    
    // Create category detail modal
    createCategoryDetailModal() {
        const modal = document.createElement('div');
        modal.id = 'category-detail-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title"></h2>
                    <button class="modal-close" data-modal="category-detail-modal">&times;</button>
                </div>
                <div class="category-detail-content">
                    <!-- Content will be populated dynamically -->
                </div>
                <div class="modal-actions">
                    <button class="add-category-drink-btn btn-primary">Ajouter une boisson</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        return modal;
    }
    
    // Add drink from category (increment counter) - INSTANT VERSION
    async addDrinkFromCategory(drinkTemplate) {
        // INSTANT UI FEEDBACK - Show success immediately
        Utils.showMessage(`${drinkTemplate.name} ajouté!`, 'success');

        // BACKGROUND OPERATIONS (completely non-blocking)
        queueMicrotask(async () => {
            try {
                // Use instant location or fallback
                let location = geoManager.getLocationInstant() || { 
                    latitude: 0, longitude: 0, accuracy: null, address: 'Localisation en cours...' 
                };

                const drinkData = {
                    name: drinkTemplate.name,
                    category: drinkTemplate.category,
                    quantity: drinkTemplate.quantity,
                    unit: drinkTemplate.unit,
                    alcoholContent: drinkTemplate.alcoholContent,
                    date: Utils.getCurrentDate(),
                    time: Utils.getCurrentTime(),
                    location: location
                };

                // Save in background
                const result = await dbManager.addDrink(drinkData);
                
                // Update events in background
                window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                    detail: { action: 'add', drink: drinkData }
                }));

                // Background location update if needed
                if (location.latitude === 0) {
                    try {
                        await geoManager.ensureConsent();
                        const realLocation = await geoManager.getLocationForDrinkFast(200);
                        if (realLocation && result) {
                            dbManager.updateDrink(result.id, { location: realLocation }).catch(console.warn);
                        }
                    } catch (e) { /* ignore */ }
                }

                // Background UI refresh (throttled)
                this.scheduleBackgroundRefresh();

            } catch (error) {
                console.warn('Background save from category failed:', error);
            }
        });
    }
    
    // Open category drinks view (legacy method for compatibility)
    openCategoryDrinks(category) {
        // Use the new category detail page instead
        this.openCategoryDetailPage(category);
    }
    
    // Open drink detail modal
    async openDrinkDetail(group) {
        try {
            const modal = document.getElementById('drink-detail-modal');
            const title = document.getElementById('drink-detail-title');
            const content = document.getElementById('drink-detail-content');
            const addButton = document.getElementById('add-same-drink');
            
            title.textContent = `${group.name} - ${Utils.formatQuantity(group.quantity, group.unit)}`;
            
            // Group drinks by date
            const drinksByDate = {};
            group.drinks.forEach(drink => {
                if (!drinksByDate[drink.date]) {
                    drinksByDate[drink.date] = [];
                }
                drinksByDate[drink.date].push(drink);
            });
            
            // Sort dates (most recent first)
            const sortedDates = Object.keys(drinksByDate).sort((a, b) => new Date(b) - new Date(a));
            
            content.innerHTML = sortedDates.map(date => {
                const drinks = drinksByDate[date].sort((a, b) => b.time.localeCompare(a.time));
                
                return `
                    <div class="drink-detail-section">
                        <h3>${Utils.formatDate(date)}</h3>
                        <div class="drink-entries">
                            ${drinks.map(drink => `
                                <div class="drink-entry swipeable" data-drink-id="${drink.id}">
                                    <div class="drink-entry-info">
                                        <div class="drink-entry-time">${drink.time}</div>
                                        <div class="drink-entry-details">
                                            ${Utils.formatQuantity(drink.quantity, drink.unit)}
                                            ${drink.alcoholContent ? ` - ${drink.alcoholContent}%` : ''}
                                        </div>
                                        ${drink.location ? `<div class="drink-entry-location">${drink.location.address || 'Géolocalisé'}</div>` : ''}
                                    </div>
                                    <div class="delete-indicator">Supprimer</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
            
            // Setup swipe to delete
            this.setupSwipeToDelete(content);
            
            // Setup add same drink button
            addButton.onclick = () => {
                this.addSameDrink(group);
            };
            
            Utils.openModal('drink-detail-modal');
            
        } catch (error) {
            Utils.handleError(error, 'opening drink detail');
        }
    }
    
    // Setup swipe to delete functionality
    setupSwipeToDelete(container) {
        const swipeableElements = container.querySelectorAll('.swipeable');
        
        swipeableElements.forEach(element => {
            // Add click handler for editing
            element.addEventListener('click', (e) => {
                // Don't trigger edit if swiping or clicking on action buttons
                if (element.classList.contains('swipe-left') || 
                    e.target.closest('.history-drink-add') ||
                    e.target.closest('.delete-indicator')) {
                    return;
                }
                
                const drinkId = parseInt(element.dataset.drinkId);
                if (drinkId) {
                    this.openEditDrinkModal(drinkId);
                }
            });
            
            Utils.addSwipeListener(
                element,
                // On swipe left (delete)
                async (el) => {
                    const drinkId = parseInt(el.dataset.drinkId);
                    if (drinkId) {
                        try {
                            // Get drink data before deletion for statistics update
                            const drinkToDelete = await dbManager.getDrinkById(drinkId);

                            await dbManager.deleteDrink(drinkId);

                            // Animate out smoothly before removing from DOM
                            el.classList.add('deleting');
                            el.style.pointerEvents = 'none';
                            const cleanup = () => {
                                if (el && el.parentElement) {
                                    el.remove();
                                }
                            };
                            // Ensure removal even if transition doesn't fire
                            const fallback = setTimeout(cleanup, 600);
                            el.addEventListener('transitionend', () => {
                                clearTimeout(fallback);
                                cleanup();
                            }, { once: true });

                            Utils.showMessage('Boisson supprimée', 'success');

                            // Dispatch custom event for statistics update
                            if (drinkToDelete) {
                                window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                                    detail: { action: 'delete', drink: drinkToDelete, drinkId: drinkId }
                                }));
                            }

                            this.refreshCurrentTab();
                        } catch (error) {
                            Utils.handleError(error, 'deleting drink');
                        }
                    }
                },
                // On swipe right (cancel)
                (el) => {
                    el.classList.remove('swipe-left');
                }
            );
        });
    }
    
    // Add same drink with current date/time
    async addSameDrink(group) {
        try {
            console.log('Adding same drink:', group);

            // Fast path: use last known immediately to avoid latency
            let location = geoManager.getLastKnownLocation();

            // Only if we have no last known, attempt quick fetch with short timeout
            if (!location) {
                try { await geoManager.ensureConsent(); } catch (e) {}
                try {
                    location = await geoManager.getLocationForDrinkFast(400);
                } catch (geoError) {
                    console.warn('Could not get quick location for same drink:', geoError);
                }
            }
            if (!location) {
                Utils.showMessage('Localisation requise pour ajouter une boisson. Veuillez autoriser la localisation puis réessayer.', 'error');
                return;
            }
            // Background refresh to keep cache fresh (non-blocking)
            if (geoManager && typeof geoManager.getLocationForDrinkFast === 'function') {
                geoManager.getLocationForDrinkFast(1500).catch(() => {});
            }

            const drinkData = {
                name: group.name,
                category: group.category,
                quantity: group.quantity,
                unit: group.unit,
                alcoholContent: group.alcoholContent,
                date: Utils.getCurrentDate(),
                time: Utils.getCurrentTime(),
                location: location
            };

            console.log('Drink data to add (same):', drinkData);

            const result = await dbManager.addDrink(drinkData);
            console.log('Same drink added successfully:', result);

            Utils.showMessage(`${group.name} ajouté!`, 'success');

            // Enrich address asynchronously if missing
            if (result && drinkData.location && (!drinkData.location.address || drinkData.location.address === null)) {
                try {
                    const addr = await geoManager.reverseGeocode(drinkData.location.latitude, drinkData.location.longitude);
                    await dbManager.updateDrink(result.id, {
                        location: {
                            ...drinkData.location,
                            address: addr?.formatted || null
                        }
                    });
                } catch (e) {
                    console.warn('Reverse geocode post-save failed', e);
                }
            }

            // Dispatch custom event for statistics update
            window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                detail: { action: 'add', drink: drinkData }
            }));

            // Refresh the modal content and current tab
            this.openDrinkDetail(group);
            this.refreshCurrentTab();

        } catch (error) {
            console.error('Error adding same drink:', error);
            Utils.handleError(error, 'adding same drink');
        }
    }
    
    // Utility functions
    switchToTab(tabName) {
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }
    
    refreshCurrentTab() {
        this.loadTabData(this.currentTab);
    }
    
    // Refresh BAC estimation section specifically
    refreshBACEstimation() {
        // Only refresh if we're on the statistics tab and it's initialized
        if (this.currentTab === 'statistics' && window.modularStatsManager && window.modularStatsManager.isInitialized) {
            // Refresh the entire statistics view to update BAC estimation
            window.modularStatsManager.loadStatistics();
        }
    }
    
    // Settings functions
    async loadSettings() {
        try {
            const settings = await dbManager.getAllSettings();
            
            const themeToggle = document.getElementById('theme-toggle');
            const weightInput = document.getElementById('user-weight');
            const genderSelect = document.getElementById('user-gender');
            
            if (themeToggle && settings.theme) {
                themeToggle.value = settings.theme;
            }
            
            if (weightInput && settings.userWeight) {
                weightInput.value = settings.userWeight;
            }
            
            if (genderSelect && settings.userGender) {
                genderSelect.value = settings.userGender;
            }
            
        } catch (error) {
            Utils.handleError(error, 'loading settings');
        }
    }
    
    // Data management functions
    async exportData() {
        try {
            const data = await dbManager.exportData();
            const filename = `alconote-backup-${Utils.getCurrentDate()}.json`;
            Utils.downloadFile(data, filename);
            Utils.showMessage('Données exportées avec succès', 'success');
        } catch (error) {
            Utils.handleError(error, 'exporting data');
        }
    }
    
    async importData() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                try {
                    const content = await Utils.readFile(file);
                    await dbManager.importData(content);
                    
                    Utils.showMessage('Données importées avec succès', 'success');
                    
                    // Refresh all data
                    this.loadInitialData();
                    
                } catch (error) {
                    Utils.handleError(error, 'importing data');
                }
            };
            
            input.click();
            
        } catch (error) {
            Utils.handleError(error, 'importing data');
        }
    }
    
    async clearAllData() {
        if (confirm('Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.')) {
            try {
                await dbManager.clearAllData();
                Utils.showMessage('Toutes les données ont été effacées', 'success');
                
                // Refresh all data
                this.loadInitialData();
                
            } catch (error) {
                Utils.handleError(error, 'clearing data');
            }
        }
    }
    
    // PWA install prompt
    showInstallPrompt() {
        // You could show a custom install banner here
        console.log('PWA install prompt available');
    }
    
    async installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA installed');
            }
            
            this.deferredPrompt = null;
        }
    }
    
    // Service Worker registration
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', registration);

            // If an updated SW is already waiting, activate it immediately
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // When a new SW is found, force activation asap
            registration.addEventListener('updatefound', () => {
                const newSW = registration.installing;
                if (!newSW) return;
                newSW.addEventListener('statechange', () => {
                    if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                        // Page is currently controlled, ask new SW to activate immediately
                        newSW.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });

            // Reload the page once the new SW takes control
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
    
    // Theme management
    async initializeTheme() {
        try {
            const settings = await dbManager.getAllSettings();
            const savedTheme = settings.theme;

            // Only keep dark if explicitly set, otherwise default to light
            if (savedTheme === 'dark') {
                this.setTheme('dark');
            } else {
                // Default to light theme (includes cases where savedTheme is null, 'light', 'auto', etc.)
                this.setTheme('light');
            }
        } catch (error) {
            console.error('Error initializing theme:', error);
            // Fallback to light theme
            this.setTheme('light');
        }
    }
    
    setTheme(theme) {
        const html = document.documentElement;
        
        // Remove existing theme attributes
        html.removeAttribute('data-theme');
        
        // Set new theme
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
            html.setAttribute('data-theme', 'light');
        }
        // If theme is 'auto', don't set attribute to use CSS media query
        
        // Save theme preference
        dbManager.setSetting('theme', theme);
        
        console.log(`Theme set to: ${theme}`);
    }
    
    // Enrich drinks in history without address (optimized concurrent version)
    async enrichMissingAddresses() {
        try {
            const allDrinks = await dbManager.getAllDrinks();
            const drinksWithoutAddress = allDrinks.filter(
                d => d.location && d.location.latitude && !d.location.address
            );
            if (drinksWithoutAddress.length === 0) return;

            console.log(`Enriching ${drinksWithoutAddress.length} drinks with missing addresses (optimized)...`);

            // Remove duplicate coordinates to avoid redundant reverse geocoding
            const uniqueCoords = new Map();
            for (const d of drinksWithoutAddress) {
                const key = `${d.location.latitude},${d.location.longitude}`;
                if (!uniqueCoords.has(key)) uniqueCoords.set(key, d.location);
            }

            const coordsArray = Array.from(uniqueCoords.values());
            const concurrency = 5;
            const results = new Map();
            let index = 0;

            // Run reverse geocoding in limited concurrent batches
            const worker = async () => {
                while (index < coordsArray.length) {
                    const loc = coordsArray[index++];
                    try {
                        const addr = await geoManager.reverseGeocode(loc.latitude, loc.longitude);
                        if (addr) results.set(`${loc.latitude},${loc.longitude}`, addr);
                    } catch (e) {
                        console.warn("Reverse geocode failed for", loc, e);
                    }
                }
            };

            const workers = Array(concurrency).fill(0).map(worker);
            await Promise.allSettled(workers);

            // Update drinks in parallel (batched updates)
            const updates = drinksWithoutAddress.map(async drink => {
                const key = `${drink.location.latitude},${drink.location.longitude}`;
                const addr = results.get(key);
                if (addr) {
                    await dbManager.updateDrink(drink.id, {
                        location: { ...drink.location, address: addr.formatted || addr.display_name || null }
                    });
                }
            });

            await Promise.allSettled(updates);
            console.log(`Address enrichment completed (${results.size}/${uniqueCoords.size} resolved).`);
        } catch (err) {
            console.warn("Error enriching addresses in background (optimized):", err);
        }
    }
}
    
// Initialize the app when DOM is ready
const app = new AlcoNoteApp();

// Make app globally available
window.app = app;

// Start the application
app.init();

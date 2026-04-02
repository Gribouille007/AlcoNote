// Main application controller for AlcoNote PWA

class AlcoNoteApp {
    constructor() {
        this.currentTab = 'categories';
        this.isInitialized = false;
        this.swipeHandlers = new Map();
        this.historyState = { allDrinks: [], filteredDrinks: [], page: 0, pageSize: 50, searchQuery: '', categoryFilter: '' };
        this._historyToolbarSetup = false;
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

        // Initialize barcode scanner
        barcodeScanner.initScannerModal();

        // Initialize statistics manager (will be initialized when statistics tab is first accessed)

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

        // Category search
        this.setupCategorySearch();
    }

    // Setup tab navigation
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;

                const doSwitch = () => {
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
                };

                // Use View Transitions API if available for smooth tab switching
                if (document.startViewTransition) {
                    document.startViewTransition(doSwitch);
                } else {
                    doSwitch();
                }
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
            // Close modal when clicking on backdrop (works for both <div> and <dialog>)
            if (e.target.classList.contains('modal') || e.target.classList.contains('modal-backdrop')) {
                Utils.closeModal(e.target.id || e.target.closest('.modal')?.id);
            }

            // Close modal when clicking close button or cancel button
            if (e.target.classList.contains('modal-close') ||
                e.target.hasAttribute('data-modal')) {
                const modalId = e.target.dataset.modal || e.target.closest('.modal')?.id;
                if (modalId) {
                    Utils.closeModal(modalId);
                }
            }
        });

        // For native <dialog> elements, close on backdrop click via the dialog click event
        document.querySelectorAll('dialog.modal').forEach(dialog => {
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    e.preventDefault();
                    e.stopPropagation();
                    Utils.closeModal(dialog.id);
                }
            });
        });

        // Escape key to close modals (native <dialog> handles this automatically, but keep for non-dialog modals)
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

        container.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';

            const strong = document.createElement('strong');
            strong.textContent = suggestion.name;
            const span = document.createElement('span');
            span.textContent = `${Utils.formatQuantity(suggestion.quantity, suggestion.unit)} - ${suggestion.category}`;

            item.appendChild(strong);
            item.appendChild(span);

            item.addEventListener('click', () => {
                this.fillFormWithSuggestion(suggestion);
                container.classList.remove('active');
            });

            container.appendChild(item);
        });

        container.classList.add('active');
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
                const rawWeight = parseFloat(weightInput.value);
                if (rawWeight && (rawWeight < 30 || rawWeight > 300)) {
                    Utils.showMessage('Le poids doit être entre 30 et 300 kg', 'error');
                    return;
                }
                const newWeight = rawWeight || null;
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
                    this.switchToTab('history');
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
                        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
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

            // Background reconciliation of drinkCount values
            queueMicrotask(async () => {
                for (const category of categories) {
                    await dbManager.updateCategoryDrinkCount(category.name);
                }
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
        const escapedName = category.name.replace(/"/g, '&quot;');
        element.innerHTML = `
            <div class="category-main" data-category="${escapedName}">
                <div class="category-name"></div>
                <div class="category-actions">
                    <span class="category-count">${typeof category.drinkCount === 'number' ? category.drinkCount : 0}</span>
                    <button class="category-edit-btn" aria-label="Modifier la catégorie" title="Modifier la catégorie"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                </div>
            </div>
            <div class="category-editor">
                <input type="text" class="category-name-input" aria-label="Nouveau nom de catégorie">
                <button class="btn-primary save-rename-btn">Enregistrer</button>
                <button class="btn-danger delete-category-btn">Supprimer</button>
                <button class="btn-secondary cancel-edit-btn">Annuler</button>
            </div>
        `;
        element.querySelector('.category-name').textContent = category.name;
        element.querySelector('.category-name-input').value = category.name;

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
                editor.classList.toggle('active');
                if (editor.classList.contains('active')) {
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
                    if (error.message && error.message.includes('existe déjà')) {
                        Utils.showMessage('Ce nom de catégorie existe déjà', 'error');
                    } else {
                        Utils.handleError(error, 'renaming category');
                    }
                }
            });
        }

        // Delete category
        const deleteBtn = element.querySelector('.delete-category-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const confirmed = confirm(`Supprimer la catégorie "${category.name}" ? Cette action est irréversible.`);
                    if (!confirmed) return;

                    await dbManager.deleteCategory(category.id);
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
                editor.classList.remove('active');
                input.value = category.name;
            });
        }

        return element;
    }

    // Setup category search bar
    setupCategorySearch() {
        const searchInput = document.getElementById('categories-search');
        const clearBtn = document.getElementById('categories-search-clear');
        if (!searchInput || !clearBtn) return;

        const debouncedFilter = Utils.debounce((query) => {
            this.filterCategories(query);
        }, 200);

        searchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            clearBtn.style.display = val ? 'flex' : 'none';
            debouncedFilter(val);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            this.filterCategories('');
            searchInput.focus();
        });
    }

    // Filter categories by name or drink name
    async filterCategories(query) {
        const container = document.getElementById('categories-list');
        const q = query.trim().toLowerCase();

        if (!q) {
            container.querySelectorAll('.category-item').forEach(el => {
                el.style.display = '';
            });
            return;
        }

        try {
            const allDrinks = await dbManager.getAllDrinks();

            // Build set of category names that have matching drinks
            const categoriesWithMatchingDrinks = new Set();
            allDrinks.forEach(drink => {
                if (drink.name.toLowerCase().includes(q)) {
                    categoriesWithMatchingDrinks.add(drink.category);
                }
            });

            container.querySelectorAll('.category-item').forEach(el => {
                const catName = el.querySelector('.category-main')?.dataset.category;
                const nameMatches = catName && catName.toLowerCase().includes(q);
                const drinkMatches = categoriesWithMatchingDrinks.has(catName);
                el.style.display = (nameMatches || drinkMatches) ? '' : 'none';
            });
        } catch (error) {
            console.warn('Filter error:', error);
        }
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
                <span class="option-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
                <span class="option-label">Manuel</span>
            </button>
            <button class="add-option" data-action="scan" data-category="${categoryName}">
                <span class="option-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></span>
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

    // Setup history toolbar (search, filter, pagination)
    setupHistoryToolbar() {
        const searchInput = document.getElementById('history-search');
        const categoryFilter = document.getElementById('history-category-filter');
        const prevBtn = document.getElementById('history-prev');
        const nextBtn = document.getElementById('history-next');

        if (searchInput) {
            const clearBtn = document.getElementById('history-search-clear');
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.historyState.searchQuery = searchInput.value.trim().toLowerCase();
                this.historyState.page = 0;
                this.applyHistoryFilters();
                if (clearBtn) {
                    clearBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
                }
            }, 250));
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    searchInput.value = '';
                    clearBtn.style.display = 'none';
                    this.historyState.searchQuery = '';
                    this.historyState.page = 0;
                    this.applyHistoryFilters();
                    searchInput.focus();
                });
            }
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.historyState.categoryFilter = categoryFilter.value;
                this.historyState.page = 0;
                this.applyHistoryFilters();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.historyState.page > 0) {
                    this.historyState.page--;
                    this.renderHistoryPage();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const maxPage = Math.ceil(this.historyState.filteredDrinks.length / this.historyState.pageSize) - 1;
                if (this.historyState.page < maxPage) {
                    this.historyState.page++;
                    this.renderHistoryPage();
                }
            });
        }

        this._historyToolbarSetup = true;
    }

    // Apply search and category filters to history
    applyHistoryFilters() {
        const { allDrinks, searchQuery, categoryFilter } = this.historyState;

        this.historyState.filteredDrinks = allDrinks.filter(drink => {
            const matchesSearch = !searchQuery || drink.name.toLowerCase().includes(searchQuery);
            const matchesCategory = !categoryFilter || drink.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });

        this.renderHistoryPage();
    }

    // Render current page of history
    renderHistoryPage() {
        const container = document.getElementById('history-list');
        const { filteredDrinks, page, pageSize } = this.historyState;

        container.innerHTML = '';

        if (filteredDrinks.length === 0) {
            const isFiltered = this.historyState.searchQuery || this.historyState.categoryFilter;
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${isFiltered ? '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' : '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'}</div>
                    <h3 class="empty-state-title">${isFiltered ? 'Aucun résultat' : 'Aucun historique'}</h3>
                    <p class="empty-state-description">
                        ${isFiltered ? 'Aucune boisson ne correspond à votre recherche.' : 'Vos boissons ajoutées apparaîtront ici organisées par date.'}
                    </p>
                </div>
            `;
            this.updateHistoryPagination();
            return;
        }

        // Paginate
        const start = page * pageSize;
        const pageDrinks = filteredDrinks.slice(start, start + pageSize);

        // Group by date
        const drinksByDate = {};
        pageDrinks.forEach(drink => {
            if (!drinksByDate[drink.date]) drinksByDate[drink.date] = [];
            drinksByDate[drink.date].push(drink);
        });

        const sortedDates = Object.keys(drinksByDate).sort((a, b) => new Date(b) - new Date(a));

        sortedDates.forEach(date => {
            const dayDrinks = drinksByDate[date].sort((a, b) => b.time.localeCompare(a.time));
            const dayElement = this.createHistoryDayElement(date, dayDrinks);
            container.appendChild(dayElement);
        });

        this.updateHistoryPagination();
    }

    // Update pagination controls
    updateHistoryPagination() {
        const { filteredDrinks, page, pageSize } = this.historyState;
        const totalPages = Math.max(1, Math.ceil(filteredDrinks.length / pageSize));
        const paginationEl = document.getElementById('history-pagination');
        const prevBtn = document.getElementById('history-prev');
        const nextBtn = document.getElementById('history-next');
        const pageInfo = document.getElementById('history-page-info');

        if (filteredDrinks.length <= pageSize) {
            if (paginationEl) paginationEl.style.display = 'none';
            return;
        }

        if (paginationEl) paginationEl.style.display = 'flex';
        if (prevBtn) prevBtn.disabled = page === 0;
        if (nextBtn) nextBtn.disabled = page >= totalPages - 1;
        if (pageInfo) pageInfo.textContent = `Page ${page + 1} / ${totalPages}`;
    }

    // Populate the category filter dropdown in history
    async populateHistoryCategoryFilter() {
        const select = document.getElementById('history-category-filter');
        if (!select) return;

        const categories = await dbManager.getAllCategories();
        // Keep current selection
        const current = select.value;
        select.innerHTML = '<option value="">Toutes les catégories</option>';
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
        if (current) select.value = current;
    }

    // Load and display history
    async loadHistory() {
        const container = document.getElementById('history-list');
        const loading = Utils.showLoading(container);

        // Setup toolbar listeners once
        if (!this._historyToolbarSetup) this.setupHistoryToolbar();

        try {
            await this.populateHistoryCategoryFilter();

            const drinks = await dbManager.getAllDrinks();
            this.historyState.allDrinks = drinks;
            this.applyHistoryFilters();

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
            const volumeInCL = Utils.convertToStandardUnit(drink.quantity, drink.unit).quantity;
            return sum + volumeInCL;
        }, 0);

        // Build header with safe values only
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
            <div class="history-day-content"></div>
        `;

        const contentEl = element.querySelector('.history-day-content');

        // Build each drink item using DOM API for user-provided data (XSS-safe)
        drinks.forEach(drink => {
            const item = document.createElement('div');
            item.className = 'history-drink-item swipeable';
            item.dataset.drinkId = drink.id;

            const info = document.createElement('div');
            info.className = 'history-drink-info';

            const main = document.createElement('div');
            main.className = 'history-drink-main';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'history-drink-name';
            nameSpan.textContent = drink.name;
            const timeSpan = document.createElement('span');
            timeSpan.className = 'history-drink-time';
            timeSpan.textContent = drink.time;
            main.appendChild(nameSpan);
            main.appendChild(timeSpan);

            const details = document.createElement('div');
            details.className = 'history-drink-details';
            const qtySpan = document.createElement('span');
            qtySpan.className = 'history-drink-quantity';
            qtySpan.textContent = Utils.formatQuantity(drink.quantity, drink.unit);
            details.appendChild(qtySpan);
            if (drink.alcoholContent) {
                const alcSpan = document.createElement('span');
                alcSpan.className = 'history-drink-alcohol';
                alcSpan.textContent = `${drink.alcoholContent}%`;
                details.appendChild(alcSpan);
            }

            info.appendChild(main);
            info.appendChild(details);

            if (drink.location) {
                const locDiv = document.createElement('div');
                locDiv.className = 'history-drink-location';
                locDiv.textContent = drink.location.address || 'Géolocalisé';
                info.appendChild(locDiv);
            }

            const addBtn = document.createElement('button');
            addBtn.className = 'history-drink-add';
            addBtn.innerHTML = '<span>+</span>';
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.addSameDrinkFromHistory(drink);
            });

            const deleteInd = document.createElement('div');
            deleteInd.className = 'delete-indicator';
            deleteInd.textContent = 'Supprimer';

            item.appendChild(info);
            item.appendChild(addBtn);
            item.appendChild(deleteInd);
            contentEl.appendChild(item);
        });

        // Setup collapsible functionality
        const header = element.querySelector('.history-day-header');
        const content = element.querySelector('.history-day-content');
        const toggle = element.querySelector('.toggle-icon');

        header.addEventListener('click', () => {
            element.classList.toggle('collapsed');
            const isCollapsed = element.classList.contains('collapsed');
            toggle.textContent = isCollapsed ? '▶' : '▼';
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
                        <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a3 3 0 010 6h-1"/><path d="M5 8h12v9a3 3 0 01-3 3H8a3 3 0 01-3-3V8z"/><path d="M8 5a2 2 0 012-2c1.1 0 2 1 2 2"/><path d="M10 5a2 2 0 012-2c1.1 0 2 1 2 2"/></svg></div>
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
    async openAddDrinkModal(categoryName = null, productInfo = null) {
        // Silently prepare geolocation if consent was already given (no prompt)
        if (geoManager.consent === 'granted') {
            geoManager.prewarmQuickPosition();
        }

        // Reset form state to ensure we're in add mode, not edit mode
        const form = document.getElementById('add-drink-form');
        if (form) {
            delete form.dataset.editingDrinkId;

            // Reset form title and button text
            const modalHeader = document.querySelector('#add-drink-modal .modal-header h2');
            const submitButton = document.querySelector('#add-drink-form button[type="submit"]');

            if (modalHeader) modalHeader.textContent = 'Ajouter une boisson';
            if (submitButton) submitButton.textContent = 'Ajouter';
        }

        // Clear the form completely
        Utils.resetForm(form);

        // Get form elements
        const dateInput = document.getElementById('drink-date');
        const timeInput = document.getElementById('drink-time');
        const categorySelect = document.getElementById('drink-category');
        const categoryFormGroup = document.getElementById('category-form-group');
        const nameInput = document.getElementById('drink-name');
        const alcoholInput = document.getElementById('drink-alcohol');
        const quantityInput = document.getElementById('drink-quantity');
        const unitSelect = document.getElementById('drink-unit');

        // Set current date and time
        if (dateInput) dateInput.value = Utils.getCurrentDate();
        if (timeInput) timeInput.value = Utils.getCurrentTime();

        // If productInfo is provided, pre-fill all fields
        if (productInfo) {
            if (nameInput) nameInput.value = productInfo.name || '';
            if (alcoholInput && productInfo.alcoholContent != null) {
                alcoholInput.value = productInfo.alcoholContent;
            }
            if (quantityInput && productInfo.servingQuantity != null) {
                quantityInput.value = productInfo.servingQuantity;
            }
            if (unitSelect && productInfo.servingUnit) {
                unitSelect.value = productInfo.servingUnit;
            }

            // Store barcode for later use
            if (form && productInfo.barcode) {
                form.dataset.barcode = productInfo.barcode;
            }

            // Use category from productInfo if available
            if (productInfo.category) {
                categoryName = productInfo.category;
            }
        }

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
    }

    openAddCategoryModal() {
        Utils.openModal('add-category-modal');
    }

    openScannerModal(categoryName = null) {
        if (!BarcodeHandler.isSupported()) {
            Utils.showMessage('Scanner non supporté sur cet appareil', 'error');
            return;
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
                const modalHeader = document.querySelector('#add-drink-modal .modal-header h2');
                const submitButton = document.querySelector('#add-drink-form button[type="submit"]');

                if (modalHeader) modalHeader.textContent = 'Modifier la boisson';
                if (submitButton) submitButton.textContent = 'Modifier';
            }

            Utils.openModal('add-drink-modal');

        } catch (error) {
            Utils.handleError(error, 'opening edit drink modal');
        }
    }

    // Handle form submissions with ultra-fast optimistic updates
    async handleAddDrink(form) {
        let isEditing = null;
        try {
            if (!Utils.validateForm(form)) {
                Utils.showMessage('Veuillez remplir tous les champs requis', 'error');
                return;
            }

            const formData = Utils.getFormData(form);
            isEditing = form.dataset.editingDrinkId;
            const barcode = form.dataset.barcode || null;

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
            const modalHeader = document.querySelector('#add-drink-modal .modal-header h2');
            const submitButton = document.querySelector('#add-drink-form button[type="submit"]');
            if (modalHeader) modalHeader.textContent = 'Ajouter une boisson';
            if (submitButton) submitButton.textContent = 'Ajouter';

            // Show success message immediately (optimistic)
            Utils.showMessage(`${formData.name} ${isEditing ? 'modifié' : 'ajouté'}!`, 'success');

            // Get location for new drinks (ultra-fast or fallback to coordinates 0,0)
            let location = null;
            if (!isEditing) {
                location = geoManager.getLocationInstant();
                if (!location) {
                    // Don't wait for consent or location - use fallback
                    location = { latitude: 0, longitude: 0, accuracy: null, address: 'Localisation en cours...' };
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
                barcode: barcode
            };

            if (!isEditing) {
                drinkData.location = location;
            }

            // BACKGROUND OPERATIONS (non-blocking)
            const needsLocationUpdate = !isEditing && location && location.latitude === 0;
            setTimeout(async () => {
                try {
                    let savedDrink = null;
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

                    // Try to get real location in background after saving
                    if (needsLocationUpdate && savedDrink) {
                        try {
                            const realLocation = await geoManager.getLocationForDrinkFast(1500);
                            if (realLocation) {
                                dbManager.updateDrink(savedDrink.id, { location: realLocation }).catch(console.warn);
                            }
                        } catch (e) {
                            console.warn('Background location failed:', e);
                        }
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

            // FIRST LEVEL: Group drinks by name only to identify drink families
            const drinkFamilies = {};
            drinks.forEach(drink => {
                const nameKey = drink.name;
                if (!drinkFamilies[nameKey]) {
                    drinkFamilies[nameKey] = [];
                }
                drinkFamilies[nameKey].push(drink);
            });

            // SECOND LEVEL: Within each family, group by quantity+unit to create variants
            const drinkGroupsWithVariants = [];
            Object.keys(drinkFamilies).forEach(drinkName => {
                const familyDrinks = drinkFamilies[drinkName];

                // Group variants by quantity+unit
                const variants = {};
                familyDrinks.forEach(drink => {
                    const variantKey = `${drink.quantity}|${drink.unit}`;
                    if (!variants[variantKey]) {
                        variants[variantKey] = {
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
                    variants[variantKey].count++;
                    variants[variantKey].drinks.push(drink);

                    // Update last consumed date
                    if (!variants[variantKey].lastConsumed || drink.date > variants[variantKey].lastConsumed) {
                        variants[variantKey].lastConsumed = drink.date;
                    }
                });

                // Convert variants to array and sort by quantity (descending)
                const variantArray = Object.values(variants).sort((a, b) => {
                    // Convert to standard unit (cL) for comparison
                    const aInCL = Utils.convertToStandardUnit(a.quantity, a.unit).quantity;
                    const bInCL = Utils.convertToStandardUnit(b.quantity, b.unit).quantity;
                    return bInCL - aInCL;
                });

                // Calculate total count for this drink family
                const totalCount = variantArray.reduce((sum, v) => sum + v.count, 0);

                drinkGroupsWithVariants.push({
                    name: drinkName,
                    variants: variantArray,
                    totalCount: totalCount,
                    hasMultipleVariants: variantArray.length > 1
                });
            });

            // Sort drink families by total count (descending)
            drinkGroupsWithVariants.sort((a, b) => b.totalCount - a.totalCount);

            // Create and show category detail modal
            this.showCategoryDetailModal(category, drinkGroupsWithVariants);

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
                    <div class="empty-state-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a3 3 0 010 6h-1"/><path d="M5 8h12v9a3 3 0 01-3 3H8a3 3 0 01-3-3V8z"/><path d="M8 5a2 2 0 012-2c1.1 0 2 1 2 2"/><path d="M10 5a2 2 0 012-2c1.1 0 2 1 2 2"/></svg></div>
                    <h3 class="empty-state-title">Aucune boisson</h3>
                    <p class="empty-state-description">
                        Ajoutez votre première boisson dans cette catégorie.
                    </p>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="category-drinks-list">
                    ${drinkGroups.map(drinkGroup => `
                        <div class="drink-family ${drinkGroup.hasMultipleVariants ? 'has-variants' : ''}">
                            <div class="drink-family-header">
                                <span class="drink-family-name">${drinkGroup.name}</span>
                                <span class="drink-family-count">${drinkGroup.totalCount} total</span>
                            </div>
                            <div class="drink-variants">
                                ${drinkGroup.variants.map((variant, variantIndex) => {
                // Create a clean data object with only necessary fields
                const drinkData = {
                    name: variant.name,
                    category: variant.category,
                    quantity: variant.quantity,
                    unit: variant.unit,
                    alcoholContent: variant.alcoholContent
                };
                // Properly escape JSON for HTML attribute
                const escapedData = JSON.stringify(drinkData)
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');

                return `
                                        <div class="category-drink-item ${drinkGroup.hasMultipleVariants ? 'is-variant' : ''}" data-variant-index="${variantIndex}">
                                            <div class="drink-info">
                                                <div class="drink-details">
                                                    ${Utils.formatQuantity(variant.quantity, variant.unit)}
                                                    ${variant.alcoholContent ? ` • ${variant.alcoholContent}%` : ''}
                                                    ${variant.lastConsumed ? ` • ${Utils.formatDate(variant.lastConsumed)}` : ''}
                                                </div>
                                            </div>
                                            <div class="drink-counter">
                                                <span class="counter-value">${variant.count}</span>
                                                <button class="counter-add-btn" data-drink="${escapedData}" aria-label="Ajouter cette boisson">
                                                    <span>+</span>
                                                </button>
                                            </div>
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Setup + button functionality for each drink variant
            content.querySelectorAll('.counter-add-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    try {
                        // Decode HTML entities and parse JSON
                        const jsonStr = btn.getAttribute('data-drink')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");
                        const drinkData = JSON.parse(jsonStr);

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

                    } catch (parseError) {
                        console.error('Error parsing drink data:', parseError, btn.getAttribute('data-drink'));
                        Utils.showMessage('Erreur lors de l\'ajout de la boisson', 'error');
                    }
                });
            });
        }

        // Setup click on drink variant rows to open edit modal
        content.querySelectorAll('.category-drink-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking the + button
                if (e.target.closest('.counter-add-btn')) return;

                const variantIndex = parseInt(item.dataset.variantIndex);
                const familyEl = item.closest('.drink-family');
                const familyIndex = Array.from(content.querySelectorAll('.drink-family')).indexOf(familyEl);
                if (familyIndex >= 0 && drinkGroups[familyIndex]) {
                    const variant = drinkGroups[familyIndex].variants[variantIndex];
                    if (variant) {
                        this.openEditDrinkFamilyModal(variant, category);
                    }
                }
            });
        });

        // Setup add new drink button
        addButton.onclick = () => {
            Utils.closeModal('category-detail-modal');
            this.openAddDrinkModal(category.name);
        };

        Utils.openModal('category-detail-modal');
    }

    // Create category detail modal
    createCategoryDetailModal() {
        const modal = document.createElement('dialog');
        modal.id = 'category-detail-modal';
        modal.className = 'modal';
        modal.innerHTML = `
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

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                Utils.closeModal('category-detail-modal');
            }
        });

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

    // Open edit modal for a drink variant (from category detail view)
    openEditDrinkFamilyModal(variant, category) {
        const nameInput = document.getElementById('edit-family-name');
        const quantityInput = document.getElementById('edit-family-quantity');
        const unitSelect = document.getElementById('edit-family-unit');
        const alcoholInput = document.getElementById('edit-family-alcohol');

        nameInput.value = variant.name;
        quantityInput.value = variant.quantity;
        unitSelect.value = variant.unit;
        alcoholInput.value = variant.alcoholContent || '';

        // Store context for save handler
        const form = document.getElementById('edit-drink-family-form');
        form.dataset.originalName = variant.name;
        form.dataset.originalQuantity = variant.quantity;
        form.dataset.originalUnit = variant.unit;
        form.dataset.categoryName = category.name;

        // Setup form submit handler
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.handleEditDrinkFamily(form, category);
        };

        // Setup extra actions
        document.getElementById('edit-family-delete-all').onclick = async () => {
            await this.handleDeleteAllVariants(form.dataset.originalName, category);
        };

        document.getElementById('edit-family-change-category').onclick = async () => {
            await this.handleChangeCategoryForFamily(form.dataset.originalName, category);
        };

        Utils.openModal('edit-drink-family-modal');
    }

    // Handle edit drink family form submission
    async handleEditDrinkFamily(form, category) {
        const originalName = form.dataset.originalName;
        const originalQuantity = parseFloat(form.dataset.originalQuantity);
        const originalUnit = form.dataset.originalUnit;

        const newName = document.getElementById('edit-family-name').value.trim();
        const newQuantity = parseFloat(document.getElementById('edit-family-quantity').value);
        const newUnit = document.getElementById('edit-family-unit').value;
        const newAlcohol = parseFloat(document.getElementById('edit-family-alcohol').value) || 0;

        if (!newName) {
            Utils.showMessage('Le nom ne peut pas être vide', 'error');
            return;
        }

        try {
            // Get ALL drinks with the original name
            const drinksToUpdate = await dbManager.getDrinksByName(originalName);

            const nameChanged = newName !== originalName;
            const quantityChanged = newQuantity !== originalQuantity;
            const unitChanged = newUnit !== originalUnit;

            let updateCount = 0;

            for (const drink of drinksToUpdate) {
                const isMatchingVariant = drink.quantity == originalQuantity && drink.unit === originalUnit;

                const updates = {};

                // Name changes apply to ALL drinks in the family
                if (nameChanged) {
                    updates.name = newName;
                }

                // Quantity/unit/alcohol changes apply only to matching variant
                if (isMatchingVariant) {
                    if (quantityChanged) updates.quantity = newQuantity;
                    if (unitChanged) updates.unit = newUnit;
                    updates.alcoholContent = newAlcohol;

                    // Recalculate quantityInCL
                    if (quantityChanged || unitChanged) {
                        const converted = Utils.convertToStandardUnit(
                            updates.quantity || drink.quantity,
                            updates.unit || drink.unit
                        );
                        updates.quantityInCL = converted.quantity;
                    }
                }

                if (Object.keys(updates).length > 0) {
                    await dbManager.updateDrink(drink.id, updates);
                    updateCount++;
                }
            }

            Utils.showMessage(`${updateCount} boisson(s) modifiée(s)`, 'success');
            Utils.closeModal('edit-drink-family-modal');

            // Dispatch event and refresh
            window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                detail: { action: 'bulk-update' }
            }));

            // Refresh the category detail view
            const updatedCategory = await dbManager.getCategoryByName(category.name);
            if (updatedCategory) {
                this.openCategoryDetailPage(updatedCategory);
            }

            this.loadCategories();

        } catch (error) {
            Utils.handleError(error, 'modifying drink family');
        }
    }

    // Delete all drinks with a given name
    async handleDeleteAllVariants(drinkName, category) {
        const confirmed = confirm(`Supprimer toutes les "${drinkName}" ? Cette action est irréversible.`);
        if (!confirmed) return;

        try {
            const drinks = await dbManager.getDrinksByName(drinkName);
            for (const drink of drinks) {
                await dbManager.deleteDrink(drink.id);
            }

            Utils.showMessage(`${drinks.length} boisson(s) supprimée(s)`, 'success');
            Utils.closeModal('edit-drink-family-modal');

            window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                detail: { action: 'bulk-delete' }
            }));

            // Refresh category detail
            const updatedCategory = await dbManager.getCategoryByName(category.name);
            if (updatedCategory) {
                this.openCategoryDetailPage(updatedCategory);
            }

            this.loadCategories();

        } catch (error) {
            Utils.handleError(error, 'deleting all variants');
        }
    }

    // Change category for all drinks with a given name
    async handleChangeCategoryForFamily(drinkName, currentCategory) {
        try {
            const categories = await dbManager.getAllCategories();
            const pickerList = document.getElementById('category-picker-list');

            pickerList.innerHTML = categories.map(cat => `
                <button type="button" class="category-picker-item ${cat.name === currentCategory.name ? 'current' : ''}"
                        data-category-name="${cat.name}">
                    <span>${cat.name}</span>
                    <span class="picker-count">${cat.drinkCount} boisson(s)</span>
                </button>
            `).join('');

            // Wire click handlers
            pickerList.querySelectorAll('.category-picker-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const newCategoryName = item.dataset.categoryName;
                    if (newCategoryName === currentCategory.name) {
                        Utils.showMessage('La boisson est déjà dans cette catégorie', 'warning');
                        return;
                    }

                    try {
                        const drinks = await dbManager.getDrinksByName(drinkName);
                        for (const drink of drinks) {
                            await dbManager.updateDrink(drink.id, { category: newCategoryName });
                        }

                        // Update drink counts
                        await dbManager.updateCategoryDrinkCount(currentCategory.name);
                        await dbManager.updateCategoryDrinkCount(newCategoryName);

                        Utils.showMessage(`${drinks.length} boisson(s) déplacée(s) vers "${newCategoryName}"`, 'success');
                        Utils.closeModal('category-picker-modal');
                        Utils.closeModal('edit-drink-family-modal');

                        window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                            detail: { action: 'bulk-update' }
                        }));

                        // Refresh
                        const updatedCategory = await dbManager.getCategoryByName(currentCategory.name);
                        if (updatedCategory) {
                            this.openCategoryDetailPage(updatedCategory);
                        }

                        this.loadCategories();

                    } catch (error) {
                        Utils.handleError(error, 'changing category');
                    }
                });
            });

            Utils.openModal('category-picker-modal');

        } catch (error) {
            Utils.handleError(error, 'loading categories for picker');
        }
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
                            // Get drink data before deletion for undo
                            const drinkToDelete = await dbManager.getDrinkById(drinkId);

                            await dbManager.deleteDrink(drinkId);

                            // Animate out smoothly before removing from DOM
                            el.classList.add('deleting');
                            el.style.pointerEvents = 'none';
                            const cleanup = () => {
                                if (el && el.parentElement) el.remove();
                            };
                            const fallback = setTimeout(cleanup, 600);
                            el.addEventListener('transitionend', () => {
                                clearTimeout(fallback);
                                cleanup();
                            }, { once: true });

                            // Show undo toast instead of simple message
                            if (drinkToDelete) {
                                this.showUndoToast(drinkToDelete);

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
            // Fast path: use last known immediately to avoid latency
            let location = geoManager.getLastKnownLocation();

            // Only if we have no last known, attempt quick fetch with short timeout
            if (!location) {
                try {
                    location = await geoManager.getLocationForDrinkFast(400);
                } catch (geoError) {
                    console.warn('Could not get quick location for same drink:', geoError);
                }
            }
            if (!location) {
                // Fallback: allow drink without location rather than blocking
                location = { latitude: 0, longitude: 0, accuracy: null, address: null };
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

            const result = await dbManager.addDrink(drinkData);

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

    // Show undo toast after deleting a drink (2.5)
    showUndoToast(deletedDrink) {
        // Remove any existing undo toast
        const existing = document.getElementById('undo-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'undo-toast';
        toast.innerHTML = `
            <span>Boisson supprimée</span>
            <button id="undo-btn" class="undo-btn">Annuler</button>
        `;
        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('active'));

        let undone = false;
        const timer = setTimeout(() => {
            if (!undone) {
                toast.classList.remove('active');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);

        toast.querySelector('#undo-btn').addEventListener('click', async () => {
            undone = true;
            clearTimeout(timer);
            try {
                // Re-add the drink to database
                const { id, ...drinkData } = deletedDrink;
                await dbManager.addDrink(drinkData);
                Utils.showMessage('Suppression annulée', 'success');
                this.refreshCurrentTab();
                window.dispatchEvent(new CustomEvent('drinkDataChanged', {
                    detail: { action: 'add', drink: drinkData }
                }));
            } catch (error) {
                Utils.handleError(error, 'undoing delete');
            }
            toast.classList.remove('active');
            setTimeout(() => toast.remove(), 300);
        });
    }

    // Open drink detail modal (2.2)
    openDrinkDetailModal(drink) {
        const titleEl = document.getElementById('drink-detail-title');
        const contentEl = document.getElementById('drink-detail-content');
        const addBtn = document.getElementById('add-same-drink');

        if (titleEl) titleEl.textContent = drink.name;
        if (contentEl) {
            contentEl.innerHTML = '';

            const details = [
                { label: 'Catégorie', value: drink.category },
                { label: 'Quantité', value: Utils.formatQuantity(drink.quantity, drink.unit) },
                { label: 'Degré d\'alcool', value: drink.alcoholContent ? `${drink.alcoholContent}%` : 'Non renseigné' },
                { label: 'Date', value: Utils.formatDate(drink.date) },
                { label: 'Heure', value: drink.time || 'Non renseignée' },
                { label: 'Lieu', value: drink.location?.address || 'Non géolocalisé' }
            ];

            details.forEach(({ label, value }) => {
                const row = document.createElement('div');
                row.className = 'detail-row';
                const labelEl = document.createElement('span');
                labelEl.className = 'detail-label';
                labelEl.textContent = label;
                const valueEl = document.createElement('span');
                valueEl.className = 'detail-value';
                valueEl.textContent = value;
                row.appendChild(labelEl);
                row.appendChild(valueEl);
                contentEl.appendChild(row);
            });
        }

        if (addBtn) {
            // Remove old listeners by cloning
            const newBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newBtn, addBtn);
            newBtn.addEventListener('click', () => {
                this.addSameDrinkFromHistory(drink);
                Utils.closeModal('drink-detail-modal');
            });
        }

        Utils.openModal('drink-detail-modal');
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

                    // Validate JSON structure before importing
                    let data;
                    try {
                        data = JSON.parse(content);
                    } catch (parseError) {
                        Utils.showMessage('Le fichier n\'est pas un JSON valide', 'error');
                        return;
                    }

                    if (!data.version || !data.categories || !data.drinks) {
                        Utils.showMessage('Format de données invalide : champs version, categories ou drinks manquants', 'error');
                        return;
                    }

                    if (!Array.isArray(data.categories) || !Array.isArray(data.drinks)) {
                        Utils.showMessage('Format invalide : categories et drinks doivent être des tableaux', 'error');
                        return;
                    }

                    // Validate each drink has required fields
                    const invalidDrinks = data.drinks.filter(d => !d.name || !d.category || !d.date);
                    if (invalidDrinks.length > 0) {
                        Utils.showMessage(`${invalidDrinks.length} boisson(s) invalide(s) dans le fichier (champs manquants)`, 'warning');
                    }

                    await dbManager.importData(content);

                    // Show detailed feedback
                    const catCount = data.categories.length;
                    const drinkCount = data.drinks.length;
                    Utils.showMessage(`Import réussi : ${drinkCount} boisson${drinkCount > 1 ? 's' : ''}, ${catCount} catégorie${catCount > 1 ? 's' : ''}`, 'success', 5000);

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
        if (!confirm('Êtes-vous sûr de vouloir effacer toutes les données ?')) {
            return;
        }

        const confirmation = prompt('Cette action est irréversible. Tapez SUPPRIMER pour confirmer :');
        if (confirmation !== 'SUPPRIMER') {
            Utils.showMessage('Suppression annulée', 'info');
            return;
        }

        try {
            await dbManager.clearAllData();
            Utils.showMessage('Toutes les données ont été effacées', 'success');

            // Refresh all data
            this.loadInitialData();

        } catch (error) {
            Utils.handleError(error, 'clearing data');
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

            if (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'auto') {
                this.setTheme(savedTheme);
            } else {
                // Default to auto theme
                this.setTheme('auto');
            }
        } catch (error) {
            console.error('Error initializing theme:', error);
            // Fallback to auto theme
            this.setTheme('auto');
        }
    }

    setTheme(theme) {
        const html = document.documentElement;

        // Remove existing theme attributes
        html.removeAttribute('data-theme');

        // Remove previous media query listener if any
        if (this._themeMediaListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', this._themeMediaListener);
            this._themeMediaListener = null;
        }

        if (theme === 'auto') {
            // Follow system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

            // Listen for system theme changes
            this._themeMediaListener = (e) => {
                html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            };
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', this._themeMediaListener);
        } else if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
        }

        // Update the theme toggle selector to reflect current theme
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle && themeToggle.value !== theme) {
            themeToggle.value = theme;
        }

        // Save theme preference
        dbManager.setSetting('theme', theme);
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

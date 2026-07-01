// Database management for AlcoNote PWA
// Using Dexie.js for IndexedDB operations

// Stable, globally-unique id for a drink. Used as the shared-record key so a
// drink keeps the same identity across devices/users (Dexie ++id is local and
// would collide between people). Falls back to a time+random id where
// crypto.randomUUID is unavailable.
function genUid() {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    } catch (e) { /* ignore */ }
    return 'uid-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

class AlcoNoteDB extends Dexie {
    constructor() {
        super('AlcoNoteDB');

        // Define database schema - Version 1
        this.version(1).stores({
            categories: '++id, name, drinkCount, createdAt, updatedAt',
            drinks: '++id, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
            settings: 'key, value, updatedAt'
        });

        // Version 2 - Add BAC records tracking
        this.version(2).stores({
            categories: '++id, name, drinkCount, createdAt, updatedAt',
            drinks: '++id, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
            settings: 'key, value, updatedAt',
            bacRecords: '++id, bacValue, timestamp, date, drinkCount, createdAt'
        });

        // Version 3 - Add drink ratings
        this.version(3).stores({
            categories: '++id, name, drinkCount, createdAt, updatedAt',
            drinks: '++id, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
            settings: 'key, value, updatedAt',
            bacRecords: '++id, bacValue, timestamp, date, drinkCount, createdAt',
            drinkRatings: 'drinkName, rating, updatedAt'
        });

        // Version 4 - Drop the orphaned bacRecords store. It was never
        // written (no addBACRecord call path), and BAC "records" are derived
        // client-side from drinks in the Stats tab. Only this empty store is
        // deleted; all other tables are carried forward unchanged, so no
        // user data is lost.
        this.version(4).stores({
            bacRecords: null
        });

        // Version 5 — friends-sharing support. PURELY ADDITIVE: we only add a
        // `uid` index to `drinks` and three new tables. No existing table is
        // dropped/renamed/rewritten, so no user data is lost.
        //   - drinks.uid     : stable global id (backfilled below)
        //   - sharedPool     : READ-ONLY copy of other members' shared drinks.
        //                      The sync engine writes ONLY here, never into the
        //                      user's own drinks/categories/ratings/settings.
        //   - shareOutbox    : pending outbound mutations (offline-safe queue)
        //   - backups        : safety snapshots (a full v4 export is written
        //                      here before the migration touches anything)
        this.version(5).stores({
            drinks: '++id, uid, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
            sharedPool: 'uid, groupId, authorId, tsUtc, updatedAt, deleted',
            shareOutbox: '++id, uid, op, queuedAt',
            backups: '++id, createdAt'
        }).upgrade(async (tx) => {
            // 1) Safety net: snapshot all v4 data BEFORE modifying anything.
            try {
                const [categories, drinks, settings, drinkRatings] = await Promise.all([
                    tx.table('categories').toArray(),
                    tx.table('drinks').toArray(),
                    tx.table('settings').toArray(),
                    tx.table('drinkRatings').toArray()
                ]);
                const snapshot = {
                    version: '1.0',
                    exportDate: new Date().toISOString(),
                    reason: 'pre-v5-migration',
                    categories, drinks, settings, drinkRatings
                };
                await tx.table('backups').add({
                    createdAt: new Date(),
                    label: 'pre-v5',
                    json: JSON.stringify(snapshot)
                });
                // 2) Backfill a stable uid on every existing drink (idempotent).
                await tx.table('drinks').toCollection().modify((d) => {
                    if (!d.uid) d.uid = genUid();
                });
            } catch (e) {
                // Abort the migration rather than proceed in a half-migrated
                // state; Dexie will roll back the version bump.
                console.error('v5 migration failed:', e);
                throw e;
            }
        });

        // Add hooks for automatic timestamps
        this.categories.hook('creating', function (primKey, obj, trans) {
            obj.createdAt = new Date();
            obj.updatedAt = new Date();
        });

        this.categories.hook('updating', function (modifications, primKey, obj, trans) {
            modifications.updatedAt = new Date();
        });

        this.drinks.hook('creating', function (primKey, obj, trans) {
            obj.createdAt = new Date();
            obj.updatedAt = new Date();
        });

        this.drinks.hook('updating', function (modifications, primKey, obj, trans) {
            modifications.updatedAt = new Date();
        });

        this.settings.hook('creating', function (primKey, obj, trans) {
            obj.updatedAt = new Date();
        });

        this.settings.hook('updating', function (modifications, primKey, obj, trans) {
            modifications.updatedAt = new Date();
        });

        this.drinkRatings.hook('creating', function (primKey, obj, trans) {
            obj.updatedAt = new Date();
        });

        this.drinkRatings.hook('updating', function (modifications, primKey, obj, trans) {
            modifications.updatedAt = new Date();
        });
    }
}

// Initialize database
const db = new AlcoNoteDB();

// Database operations class
class DatabaseManager {
    constructor() {
        this.db = db;
        this.initializeDefaultData();
    }

    // Initialize default settings if database is empty
    async initializeDefaultData() {
        try {
            // Initialize default settings only
            const settings = await this.db.settings.toArray();
            if (settings.length === 0) {
                await this.initializeDefaultSettings();
            }
        } catch (error) {
            console.error('Error initializing default data:', error);
        }
    }

    async initializeDefaultSettings() {
        const defaultSettings = [
            { key: 'userWeight', value: null },
            { key: 'userGender', value: null },
            { key: 'notifications', value: true },
            { key: 'theme', value: 'light' },
            { key: 'language', value: 'fr' }
        ];

        try {
            await this.db.settings.bulkAdd(defaultSettings);
        } catch (error) {
            console.error('Error initializing default settings:', error);
        }
    }

    // Category operations
    async getAllCategories() {
        try {
            return await this.db.categories.orderBy('drinkCount').reverse().toArray();
        } catch (error) {
            console.error('Error getting categories:', error);
            return [];
        }
    }

    async getCategoryById(id) {
        try {
            return await this.db.categories.get(id);
        } catch (error) {
            console.error('Error getting category by ID:', error);
            return null;
        }
    }

    async getCategoryByName(name) {
        try {
            return await this.db.categories.where('name').equals(name).first();
        } catch (error) {
            console.error('Error getting category by name:', error);
            return null;
        }
    }

    async addCategory(categoryData) {
        try {
            // Trim before duplicate check so " Bière" and "Bière" aren't
            // treated as distinct rows (renameCategory already trims).
            const name = (categoryData.name || '').trim();
            if (!name) {
                throw new Error('Le nom de catégorie est invalide');
            }
            const existingCategory = await this.getCategoryByName(name);
            if (existingCategory) {
                throw new Error('Une catégorie avec ce nom existe déjà');
            }

            const categoryToAdd = {
                name,
                drinkCount: 0
            };

            const id = await this.db.categories.add(categoryToAdd);
            return await this.getCategoryById(id);
        } catch (error) {
            console.error('Error adding category:', error);
            throw error;
        }
    }

    async updateCategory(id, updates) {
        try {
            await this.db.categories.update(id, updates);
            return await this.getCategoryById(id);
        } catch (error) {
            console.error('Error updating category:', error);
            throw error;
        }
    }

    async deleteCategory(id) {
        try {
            // Get category name first
            const category = await this.getCategoryById(id);
            if (!category) {
                throw new Error('Catégorie non trouvée');
            }

            // Check if category has drinks (using category name, not ID)
            const drinksInCategory = await this.db.drinks.where('category').equals(category.name).count();
            if (drinksInCategory > 0) {
                throw new Error('Impossible de supprimer une catégorie qui contient des boissons');
            }

            await this.db.categories.delete(id);
            return true;
        } catch (error) {
            console.error('Error deleting category:', error);
            throw error;
        }
    }

    async updateCategoryDrinkCount(categoryName) {
        try {
            const category = await this.getCategoryByName(categoryName);
            if (category) {
                const drinkCount = await this.db.drinks.where('category').equals(categoryName).count();
                await this.updateCategory(category.id, { drinkCount });
            }
        } catch (error) {
            console.error('Error updating category drink count:', error);
        }
    }

    async renameCategory(oldName, newName) {
        try {
            const trimmedOld = (oldName || '').trim();
            const trimmedNew = (newName || '').trim();
            if (!trimmedNew) {
                throw new Error('Le nouveau nom de catégorie est invalide');
            }
            if (trimmedOld === trimmedNew) {
                return true;
            }
            const existing = await this.getCategoryByName(trimmedNew);
            if (existing) {
                throw new Error('Une catégorie avec ce nom existe déjà');
            }
            const category = await this.getCategoryByName(trimmedOld);
            if (!category) {
                throw new Error('Catégorie non trouvée');
            }

            // Transaction: update category name and cascade to drinks
            await this.db.transaction('rw', this.db.categories, this.db.drinks, async () => {
                await this.db.categories.update(category.id, { name: trimmedNew });
                await this.db.drinks.where('category').equals(trimmedOld).modify({ category: trimmedNew });
            });

            // Update drink counts for new name
            await this.updateCategoryDrinkCount(trimmedNew);
            return true;
        } catch (error) {
            console.error('Error renaming category:', error);
            throw error;
        }
    }

    // Drink operations
    async getAllDrinks() {
        try {
            return await this.db.drinks.orderBy('date').reverse().toArray();
        } catch (error) {
            console.error('Error getting drinks:', error);
            return [];
        }
    }

    async getDrinkById(id) {
        try {
            return await this.db.drinks.get(id);
        } catch (error) {
            console.error('Error getting drink by ID:', error);
            return null;
        }
    }

    async getDrinksByCategory(category) {
        try {
            return await this.db.drinks.where('category').equals(category).toArray();
        } catch (error) {
            console.error('Error getting drinks by category:', error);
            return [];
        }
    }

    async getDrinksByName(name) {
        try {
            return await this.db.drinks.where('name').equals(name).toArray();
        } catch (error) {
            console.error('Error getting drinks by name:', error);
            return [];
        }
    }

    async addDrink(drinkData) {
        try {
            // Convert quantity based on unit
            let quantityInCL = drinkData.quantity;
            if (drinkData.unit === 'EcoCup') {
                quantityInCL = drinkData.quantity * 25; // EcoCup = 25cL each
            } else if (drinkData.unit === 'L') {
                quantityInCL = drinkData.quantity * 100; // Convert L to cL
            }

            const drinkToAdd = {
                uid: drinkData.uid || genUid(),
                name: drinkData.name,
                category: drinkData.category,
                quantity: drinkData.quantity,
                unit: drinkData.unit,
                quantityInCL: quantityInCL,
                alcoholContent: drinkData.alcoholContent || 0,
                date: drinkData.date,
                time: drinkData.time,
                location: drinkData.location || null,
                barcode: drinkData.barcode || null,
                // Prix payé pour CETTE entrée (€). null = inconnu. La référence
                // de famille vit en settings (price.ref.*), pas ici.
                price: drinkData.price != null ? drinkData.price : null,
                // Provenance du prix : true = prix personnalisé (jamais écrasé
                // par un changement de prix de référence) ; false/absent = au
                // prix de référence de la famille (suit les cascades de réf.).
                priceIsCustom: drinkData.priceIsCustom === true
            };

            const id = await this.db.drinks.add(drinkToAdd);

            // Update category drink count
            await this.updateCategoryDrinkCount(drinkData.category);

            return await this.getDrinkById(id);
        } catch (error) {
            console.error('Error adding drink:', error);
            throw error;
        }
    }

    async updateDrink(id, updates) {
        try {
            const oldDrink = await this.getDrinkById(id);
            if (!oldDrink) {
                throw new Error('Boisson non trouvée');
            }

            // Convert quantity based on unit if quantity or unit is being updated
            if (updates.quantity !== undefined || updates.unit !== undefined) {
                const quantity = updates.quantity !== undefined ? updates.quantity : oldDrink.quantity;
                const unit = updates.unit !== undefined ? updates.unit : oldDrink.unit;

                let quantityInCL = quantity;
                if (unit === 'EcoCup') {
                    quantityInCL = quantity * 25;
                } else if (unit === 'L') {
                    quantityInCL = quantity * 100;
                }
                updates.quantityInCL = quantityInCL;
            }

            await this.db.drinks.update(id, updates);

            // Update category drink counts if category changed
            if (updates.category && updates.category !== oldDrink.category) {
                await this.updateCategoryDrinkCount(oldDrink.category);
                await this.updateCategoryDrinkCount(updates.category);
            }

            return await this.getDrinkById(id);
        } catch (error) {
            console.error('Error updating drink:', error);
            throw error;
        }
    }

    async deleteDrink(id) {
        try {
            const drink = await this.getDrinkById(id);
            if (!drink) {
                throw new Error('Boisson non trouvée');
            }

            await this.db.drinks.delete(id);

            // Update category drink count
            await this.updateCategoryDrinkCount(drink.category);

            return true;
        } catch (error) {
            console.error('Error deleting drink:', error);
            throw error;
        }
    }

    // Settings operations
    async getSetting(key) {
        try {
            const setting = await this.db.settings.get(key);
            return setting ? setting.value : null;
        } catch (error) {
            console.error('Error getting setting:', error);
            return null;
        }
    }

    async setSetting(key, value) {
        try {
            if (value === null || value === undefined) {
                await this.db.settings.delete(key);
            } else {
                await this.db.settings.put({ key, value });
            }
            return true;
        } catch (error) {
            console.error('Error setting setting:', error);
            return false;
        }
    }

    async getAllSettings() {
        try {
            const settings = await this.db.settings.toArray();
            const settingsObj = {};
            settings.forEach(setting => {
                settingsObj[setting.key] = setting.value;
            });
            return settingsObj;
        } catch (error) {
            console.error('Error getting all settings:', error);
            return {};
        }
    }

    // Drink ratings operations
    async setRating(drinkName, rating) {
        try {
            await this.db.drinkRatings.put({ drinkName, rating });
            return true;
        } catch (error) {
            console.error('Error setting rating:', error);
            return false;
        }
    }

    async deleteRating(drinkName) {
        try {
            await this.db.drinkRatings.delete(drinkName);
            return true;
        } catch (error) {
            console.error('Error deleting rating:', error);
            return false;
        }
    }

    async getAllRatings() {
        try {
            return await this.db.drinkRatings.toArray();
        } catch (error) {
            console.error('Error getting all ratings:', error);
            return [];
        }
    }

    // ── Friends-sharing operations (v5) ─────────────────────────────────────
    // These touch ONLY the sharing tables (shareOutbox / sharedPool). They
    // never write to the user's own drinks/categories/ratings/settings.

    async getDrinkByUid(uid) {
        try {
            return await this.db.drinks.where('uid').equals(uid).first();
        } catch (error) {
            console.error('Error getting drink by uid:', error);
            return null;
        }
    }

    // Outbox: pending outbound mutations, drained by the sync engine.
    async addOutbox(entry) {
        try {
            return await this.db.shareOutbox.add({ ...entry, queuedAt: Date.now() });
        } catch (error) {
            console.error('Error adding to outbox:', error);
            return null;
        }
    }

    async getOutbox() {
        try {
            return await this.db.shareOutbox.orderBy('id').toArray();
        } catch (error) {
            console.error('Error reading outbox:', error);
            return [];
        }
    }

    async clearOutbox(ids) {
        try {
            await this.db.shareOutbox.bulkDelete(ids);
            return true;
        } catch (error) {
            console.error('Error clearing outbox:', error);
            return false;
        }
    }

    // sharedPool: READ-ONLY mirror of other members' shared drinks.
    async upsertSharedDrinks(records) {
        try {
            await this.db.sharedPool.bulkPut(records);
            return true;
        } catch (error) {
            console.error('Error upserting shared drinks:', error);
            return false;
        }
    }

    async getAllSharedDrinks() {
        try {
            return await this.db.sharedPool.toArray();
        } catch (error) {
            console.error('Error getting shared drinks:', error);
            return [];
        }
    }

    async deleteSharedByUids(uids) {
        try {
            await this.db.sharedPool.bulkDelete(uids);
            return true;
        } catch (error) {
            console.error('Error deleting shared drinks:', error);
            return false;
        }
    }

    async clearSharedPool() {
        try {
            await this.db.sharedPool.clear();
            return true;
        } catch (error) {
            console.error('Error clearing shared pool:', error);
            return false;
        }
    }

    async getLatestBackup() {
        try {
            return await this.db.backups.orderBy('id').last();
        } catch (error) {
            console.error('Error getting latest backup:', error);
            return null;
        }
    }

    // Data export/import
    async exportData() {
        try {
            const categories = await this.db.categories.toArray();
            const drinks = await this.db.drinks.toArray();
            const settings = await this.db.settings.toArray();
            const drinkRatings = await this.db.drinkRatings.toArray();

            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                categories,
                drinks,
                settings,
                drinkRatings
            };

            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);

            if (!data.version || !data.categories || !data.drinks) {
                throw new Error('Format de données invalide');
            }

            // Backfill a stable uid on drinks coming from a pre-v5 export:
            // without one the sharing engine silently skips the row forever
            // (reconcile ignores drinks lacking a uid).
            const drinks = data.drinks.map(d => (d && !d.uid) ? { ...d, uid: genUid() } : d);

            // Clear existing data
            await this.db.transaction('rw', this.db.categories, this.db.drinks, this.db.settings, this.db.drinkRatings, async () => {
                await this.db.categories.clear();
                await this.db.drinks.clear();
                await this.db.settings.clear();
                await this.db.drinkRatings.clear();

                // Import data
                await this.db.categories.bulkAdd(data.categories);
                await this.db.drinks.bulkAdd(drinks);
                if (data.settings) {
                    await this.db.settings.bulkAdd(data.settings);
                }
                if (data.drinkRatings) {
                    await this.db.drinkRatings.bulkAdd(data.drinkRatings);
                }
            });

            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            throw error;
        }
    }

    async clearAllData() {
        try {
            // Include drinkRatings in the wipe — leaving them behind orphaned
            // every star rating in the DB after a "Tout effacer", which then
            // resurrected onto any drink the user re-added with the same name.
            await this.db.transaction('rw', this.db.categories, this.db.drinks, this.db.settings, this.db.drinkRatings, async () => {
                await this.db.categories.clear();
                await this.db.drinks.clear();
                await this.db.settings.clear();
                await this.db.drinkRatings.clear();
            });

            // Reinitialize default settings only
            await this.initializeDefaultSettings();

            return true;
        } catch (error) {
            console.error('Error clearing all data:', error);
            throw error;
        }
    }
}

// Create global database manager instance
const dbManager = new DatabaseManager();

// Export for use in other modules
window.dbManager = dbManager;
window.genUid = genUid;

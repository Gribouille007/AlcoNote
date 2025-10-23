// Database management for AlcoNote PWA
// Using Dexie.js for IndexedDB operations

class AlcoNoteDB extends Dexie {
    constructor() {
        super('AlcoNoteDB');
        
        // Define database schema
        this.version(1).stores({
            categories: '++id, name, drinkCount, createdAt, updatedAt',
            drinks: '++id, name, category, quantity, unit, alcoholContent, date, time, location, barcode, createdAt, updatedAt',
            settings: 'key, value, updatedAt'
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
            console.log('Default settings initialized');
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
            const existingCategory = await this.getCategoryByName(categoryData.name);
            if (existingCategory) {
                throw new Error('Une catégorie avec ce nom existe déjà');
            }
            
            const categoryToAdd = {
                name: categoryData.name,
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
    
    async getDrinksByDateRange(startDate, endDate) {
        try {
            return await this.db.drinks
                .where('date')
                .between(startDate, endDate, true, true)
                .toArray();
        } catch (error) {
            console.error('Error getting drinks by date range:', error);
            return [];
        }
    }
    
    async getGroupedDrinks() {
        try {
            const drinks = await this.getAllDrinks();
            const grouped = {};
            
            drinks.forEach(drink => {
                const key = `${drink.name} - ${drink.quantity}${drink.unit}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        name: drink.name,
                        quantity: drink.quantity,
                        unit: drink.unit,
                        category: drink.category,
                        alcoholContent: drink.alcoholContent,
                        count: 0,
                        drinks: []
                    };
                }
                grouped[key].count++;
                grouped[key].drinks.push(drink);
            });
            
            // Sort by count (descending) then by name (ascending)
            return Object.values(grouped).sort((a, b) => {
                if (b.count !== a.count) {
                    return b.count - a.count;
                }
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            console.error('Error getting grouped drinks:', error);
            return [];
        }
    }
    
    async addDrink(drinkData) {
        try {
            // Convert quantity based on unit
            let quantityInCL = drinkData.quantity;
            if (drinkData.unit === 'EcoCup') {
                quantityInCL = 25; // EcoCup = 25cL
            } else if (drinkData.unit === 'L') {
                quantityInCL = drinkData.quantity * 100; // Convert L to cL
            }
            
            const drinkToAdd = {
                name: drinkData.name,
                category: drinkData.category,
                quantity: drinkData.quantity,
                unit: drinkData.unit,
                quantityInCL: quantityInCL,
                alcoholContent: drinkData.alcoholContent || 0,
                date: drinkData.date,
                time: drinkData.time,
                location: drinkData.location || null,
                barcode: drinkData.barcode || null
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
            
            // Convert quantity based on unit if quantity or unit is being updated
            if (updates.quantity !== undefined || updates.unit !== undefined) {
                const quantity = updates.quantity !== undefined ? updates.quantity : oldDrink.quantity;
                const unit = updates.unit !== undefined ? updates.unit : oldDrink.unit;
                
                let quantityInCL = quantity;
                if (unit === 'EcoCup') {
                    quantityInCL = 25;
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
    
    async getDrinkSuggestions(query) {
        try {
            const drinks = await this.db.drinks
                .where('name')
                .startsWithIgnoreCase(query)
                .limit(5)
                .toArray();
            
            // Remove duplicates and return unique names with their most common quantity/unit
            const suggestions = {};
            drinks.forEach(drink => {
                const key = drink.name;
                if (!suggestions[key]) {
                    suggestions[key] = {
                        name: drink.name,
                        quantity: drink.quantity,
                        unit: drink.unit,
                        category: drink.category,
                        alcoholContent: drink.alcoholContent,
                        count: 0
                    };
                }
                suggestions[key].count++;
            });
            
            return Object.values(suggestions)
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
        } catch (error) {
            console.error('Error getting drink suggestions:', error);
            return [];
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
            await this.db.settings.put({ key, value });
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
    
    // Statistics operations
    async getStatistics(startDate, endDate) {
        try {
            const drinks = await this.getDrinksByDateRange(startDate, endDate);
            
            const stats = {
                totalDrinks: drinks.length,
                totalVolume: 0,
                totalAlcohol: 0,
                categories: {},
                hours: {},
                days: {},
                uniqueDrinks: new Set(),
                sessions: []
            };
            
            drinks.forEach(drink => {
                // Total volume in cL
                let volumeInCL = drink.quantity;
                if (drink.unit === 'EcoCup') {
                    volumeInCL = 25;
                } else if (drink.unit === 'L') {
                    volumeInCL = drink.quantity * 100;
                }
                
                stats.totalVolume += volumeInCL;
                
                // Total alcohol in grams (approximation: 1cL at X% = X * 0.8g of alcohol)
                if (drink.alcoholContent) {
                    stats.totalAlcohol += (volumeInCL * drink.alcoholContent * 0.8) / 100;
                }
                
                // Categories
                if (!stats.categories[drink.category]) {
                    stats.categories[drink.category] = { count: 0, volume: 0 };
                }
                stats.categories[drink.category].count++;
                stats.categories[drink.category].volume += volumeInCL;
                
                // Hours
                const hour = parseInt(drink.time.split(':')[0]);
                if (!stats.hours[hour]) {
                    stats.hours[hour] = 0;
                }
                stats.hours[hour]++;
                
                // Days of week
                const dayOfWeek = new Date(drink.date).getDay();
                if (!stats.days[dayOfWeek]) {
                    stats.days[dayOfWeek] = 0;
                }
                stats.days[dayOfWeek]++;
                
                // Unique drinks
                stats.uniqueDrinks.add(drink.name);
            });
            
            stats.uniqueDrinks = stats.uniqueDrinks.size;
            
            return stats;
        } catch (error) {
            console.error('Error getting statistics:', error);
            return null;
        }
    }
    
    // Data export/import
    async exportData() {
        try {
            const categories = await this.db.categories.toArray();
            const drinks = await this.db.drinks.toArray();
            const settings = await this.db.settings.toArray();
            
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                categories,
                drinks,
                settings
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
            
            // Clear existing data
            await this.db.transaction('rw', this.db.categories, this.db.drinks, this.db.settings, async () => {
                await this.db.categories.clear();
                await this.db.drinks.clear();
                await this.db.settings.clear();
                
                // Import data
                await this.db.categories.bulkAdd(data.categories);
                await this.db.drinks.bulkAdd(data.drinks);
                if (data.settings) {
                    await this.db.settings.bulkAdd(data.settings);
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
            await this.db.transaction('rw', this.db.categories, this.db.drinks, this.db.settings, async () => {
                await this.db.categories.clear();
                await this.db.drinks.clear();
                await this.db.settings.clear();
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

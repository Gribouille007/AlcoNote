// Product lookup service for barcode scanning
// Handles API calls and normalizes product data into a consistent schema

class ProductLookup {
    /**
     * Look up a barcode and return a NormalizedProduct.
     * Tries OpenFoodFacts first, then UPC Database, then returns a fallback.
     */
    async lookup(barcode) {
        try {
            let product = await this._getFromOpenFoodFacts(barcode);
            if (product) return product;

            product = await this._getFromUPCDatabase(barcode);
            if (product) return product;

            return this._buildFallback(barcode);
        } catch (error) {
            console.error('Error looking up product:', error);
            return this._buildFallback(barcode);
        }
    }

    // --- API integrations ---

    async _getFromOpenFoodFacts(barcode) {
        try {
            const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
            if (!response.ok) return null;

            const data = await response.json();
            if (data.status === 0) return null;

            const product = data.product;
            const category = this._mapCategory(product.categories);
            const serving = this._computeServingDefaults(category);

            return {
                barcode,
                name: product.product_name || product.product_name_fr || `Produit ${barcode}`,
                brand: product.brands || null,
                source: 'openfoodfacts',
                category,
                alcoholContent: this._extractAlcoholContent(product),
                packageSize: product.quantity || null,
                servingQuantity: serving.servingQuantity,
                servingUnit: serving.servingUnit,
                image: product.image_url || null,
                ingredients: product.ingredients_text || null
            };
        } catch (error) {
            console.error('OpenFoodFacts API error:', error);
            return null;
        }
    }

    async _getFromUPCDatabase(barcode) {
        try {
            const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
            if (!response.ok) return null;

            const data = await response.json();
            if (!data.items || data.items.length === 0) return null;

            const item = data.items[0];
            const category = this._mapCategoryFromTitle(item.title);
            const serving = this._computeServingDefaults(category);

            return {
                barcode,
                name: item.title || `Produit ${barcode}`,
                brand: item.brand || null,
                source: 'upcitemdb',
                category,
                alcoholContent: this._extractAlcoholFromTitle(item.title),
                packageSize: null,
                servingQuantity: serving.servingQuantity,
                servingUnit: serving.servingUnit,
                image: null,
                ingredients: null
            };
        } catch (error) {
            console.error('UPC Database API error:', error);
            return null;
        }
    }

    // --- Normalization helpers ---

    _buildFallback(barcode) {
        const serving = this._computeServingDefaults('Autre');
        return {
            barcode,
            name: `Produit ${barcode}`,
            brand: null,
            source: 'unknown',
            category: 'Autre',
            alcoholContent: null,
            packageSize: null,
            servingQuantity: serving.servingQuantity,
            servingUnit: serving.servingUnit,
            image: null,
            ingredients: null
        };
    }

    /**
     * Compute default serving quantity and unit based on drink category.
     * This replaces the old isBeer()/getDefaultQuantity()/getDefaultUnit() methods.
     */
    _computeServingDefaults(category) {
        switch (category) {
            case 'Bière':
                return { servingQuantity: 1, servingUnit: 'EcoCup' };
            case 'Vin':
                return { servingQuantity: 15, servingUnit: 'cL' };
            case 'Spiritueux':
                return { servingQuantity: 4, servingUnit: 'cL' };
            case 'Cocktail':
                return { servingQuantity: 25, servingUnit: 'cL' };
            default:
                return { servingQuantity: 25, servingUnit: 'cL' };
        }
    }

    _mapCategory(categories) {
        if (!categories) return 'Autre';

        const s = categories.toLowerCase();

        if (s.includes('beer') || s.includes('bière') || s.includes('bier')) return 'Bière';
        if (s.includes('wine') || s.includes('vin') || s.includes('wijn')) return 'Vin';
        if (s.includes('spirit') || s.includes('liqueur') || s.includes('whisky') ||
            s.includes('vodka') || s.includes('rum') || s.includes('gin')) return 'Spiritueux';
        if (s.includes('cocktail') || s.includes('mixed drink')) return 'Cocktail';

        return 'Autre';
    }

    _mapCategoryFromTitle(title) {
        if (!title) return 'Autre';

        const s = title.toLowerCase();

        if (s.includes('beer') || s.includes('bière') || s.includes('bier') ||
            s.includes('ale') || s.includes('lager') || s.includes('stout')) return 'Bière';
        if (s.includes('wine') || s.includes('vin') || s.includes('rouge') ||
            s.includes('blanc') || s.includes('rosé') || s.includes('champagne')) return 'Vin';
        if (s.includes('whisky') || s.includes('whiskey') || s.includes('vodka') ||
            s.includes('rum') || s.includes('gin') || s.includes('cognac') ||
            s.includes('brandy') || s.includes('tequila') || s.includes('liqueur')) return 'Spiritueux';
        if (s.includes('cocktail') || s.includes('mojito') || s.includes('martini')) return 'Cocktail';

        return 'Autre';
    }

    _extractAlcoholContent(product) {
        if (product.alcohol_by_volume) {
            return parseFloat(product.alcohol_by_volume);
        }

        if (product.nutriments && product.nutriments.alcohol) {
            return parseFloat(product.nutriments.alcohol);
        }

        const text = (product.product_name || '') + ' ' + (product.generic_name || '');
        const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) return parseFloat(match[1]);

        return null;
    }

    _extractAlcoholFromTitle(title) {
        if (!title) return null;

        const match = title.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) return parseFloat(match[1]);

        const s = title.toLowerCase();
        if (s.includes('beer') || s.includes('bière')) return 5.0;
        if (s.includes('wine') || s.includes('vin')) return 12.0;
        if (s.includes('whisky') || s.includes('vodka') || s.includes('gin')) return 40.0;

        return null;
    }
}

// Export global instance
const productLookup = new ProductLookup();
window.productLookup = productLookup;

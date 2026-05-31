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
            const alcoholContent = this._extractAlcoholContent(product)
                ?? this._defaultAlcoholContent(category);
            const rawName = product.product_name || product.product_name_fr || `Produit ${barcode}`;

            return {
                barcode,
                name: this._cleanProductName(rawName, product.brands),
                brand: product.brands || null,
                source: 'openfoodfacts',
                category,
                alcoholContent,
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
            const alcoholContent = this._extractAlcoholFromTitle(item.title)
                ?? this._defaultAlcoholContent(category);

            return {
                barcode,
                name: this._cleanProductName(item.title || `Produit ${barcode}`, item.brand),
                brand: item.brand || null,
                source: 'upcitemdb',
                category,
                alcoholContent,
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
        // OpenFoodFacts stores ABV under `nutriments` — the real keys are
        // alcohol_100g / alcohol_value / alcohol_serving (occasionally a root
        // alcohol_by_volume). The old code only checked `alcohol_by_volume`
        // and `nutriments.alcohol`, which OFF almost never populates, so a
        // genuine ABV was discarded in favour of a category default.
        const n = product.nutriments || {};
        const candidates = [
            product.alcohol_by_volume,
            n.alcohol_100g, n.alcohol_value, n.alcohol_serving, n.alcohol,
        ];
        for (const c of candidates) {
            if (c == null || c === '') continue;
            const v = parseFloat(String(c).replace(',', '.'));
            if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
        }

        const text = (product.product_name || '') + ' ' + (product.generic_name || '');
        const match = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (match) {
            const v = parseFloat(match[1].replace(',', '.'));
            if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
        }

        return null;
    }

    _extractAlcoholFromTitle(title) {
        if (!title) return null;

        const match = title.match(/(\d+(?:\.\d+)?)\s*%/);
        if (match) return parseFloat(match[1]);

        return null;
    }

    /**
     * Return a sensible default alcohol % based on drink category.
     * Used when APIs don't provide a value.
     */
    _defaultAlcoholContent(category) {
        switch (category) {
            case 'Bière':      return 5.0;
            case 'Vin':        return 12.0;
            case 'Spiritueux': return 40.0;
            case 'Cocktail':   return 8.0;
            default:           return null;
        }
    }

    /**
     * Strip metadata from the product name: brand prefix, volume/weight,
     * alcohol percentage, and trailing noise so the field shows only the
     * human-readable product name.
     */
    _cleanProductName(rawName, brand) {
        if (!rawName) return rawName;

        let name = rawName.trim();

        // Remove brand prefix if it duplicates the separate brand field
        if (brand) {
            const brands = brand.split(',').map(b => b.trim()).filter(Boolean);
            for (const b of brands) {
                const re = new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—,]?\\s*`, 'i');
                name = name.replace(re, '');
            }
        }

        // Remove volume/weight info  (e.g. "50 cL", "33cl", "75 cl", "1L", "500ml", "330 mL", "6x25cl", "6 x 25cl")
        name = name.replace(/\d+\s*[xX×]\s*\d+\s*(cl|ml|l|g|kg)\b/gi, '');
        name = name.replace(/\b\d+(\.\d+)?\s*(cl|ml|l|g|kg)\b/gi, '');

        // Remove alcohol percentage  (e.g. "5%", "5.5% vol", "12,5 % vol.", "alc. 5%")
        name = name.replace(/\b(alc\.?\s*)?\d+([.,]\d+)?\s*%\s*(vol\.?)?\b/gi, '');

        // Remove trailing separators and whitespace
        name = name.replace(/[\s\-–—,|/]+$/, '').replace(/^\s*[\-–—,|/]+\s*/, '').trim();

        return name || rawName.trim();
    }
}

// Export global instance
const productLookup = new ProductLookup();
window.productLookup = productLookup;

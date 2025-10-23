# Guide des Statistiques Modulaires - AlcoNote

Ce guide explique comment utiliser et modifier facilement le nouveau système de statistiques modulaire d'AlcoNote.

## 📁 Structure du Code

Le code des statistiques est maintenant organisé en modules séparés :

```
js/
├── stats-config.js              # Configuration des sections
├── stats-calculators/           # Modules de calcul
│   ├── general.js              # Stats générales
│   ├── temporal.js             # Stats temporelles
│   ├── categories.js           # Stats par catégories
│   ├── drinks.js               # Stats par boissons
│   ├── health.js               # Stats de santé
│   └── location.js             # Stats de localisation
├── stats-renderers/            # Modules d'affichage
│   └── general-renderer.js     # Rendu des stats générales
├── statistics-new.js           # Gestionnaire principal
└── statistics.js               # Ancien système (à remplacer)
```

## 🎯 Comment Ajouter une Nouvelle Statistique

### 1. Modifier le Calculateur

Exemple : Ajouter une stat "Boisson la plus chère" dans les stats générales

**Fichier :** `js/stats-calculators/general.js`

```javascript
// Dans la fonction calculateGeneralStats, ajouter :
let maxPrice = 0;
let mostExpensiveDrink = null;

drinks.forEach(drink => {
    if (drink.price && drink.price > maxPrice) {
        maxPrice = drink.price;
        mostExpensiveDrink = drink.name;
    }
});

// Dans le return, ajouter :
return {
    // ... autres stats existantes
    mostExpensiveDrink,
    maxPrice: Math.round(maxPrice * 100) / 100
};
```

### 2. Modifier l'Affichage

**Fichier :** `js/stats-renderers/general-renderer.js`

```javascript
// Dans la fonction renderStatsGrid, ajouter une nouvelle carte :
const cards = [
    // ... cartes existantes
    {
        icon: '💰',
        value: `${stats.maxPrice}€`,
        label: 'Boisson la plus chère',
        subtitle: stats.mostExpensiveDrink
    }
];
```

## 🔧 Comment Supprimer une Statistique

### 1. Retirer du Calculateur
Commentez ou supprimez le calcul dans le fichier approprié.

### 2. Retirer de l'Affichage
Supprimez la carte correspondante du renderer.

### 3. Désactiver une Section Complète
**Fichier :** `js/stats-config.js`

```javascript
{
    id: 'categories',
    title: 'Analyse par catégorie',
    enabled: false,  // Changer true en false
    // ...
}
```

## 📊 Comment Ajouter une Nouvelle Section

### 1. Créer le Calculateur

**Nouveau fichier :** `js/stats-calculators/ma-nouvelle-section.js`

```javascript
async function calculateMaNouvelleSection(drinks, dateRange, options = {}) {
    // Vos calculs ici
    return {
        monStat1: 42,
        monStat2: "Résultat"
    };
}

// Export
window.MaNouvelleSection = {
    calculateMaNouvelleSection
};
```

### 2. Créer le Renderer

**Nouveau fichier :** `js/stats-renderers/ma-nouvelle-section-renderer.js`

```javascript
function renderMaNouvelleSection(stats) {
    return `
        <div class="stats-section">
            <h3>🎯 Ma Nouvelle Section</h3>
            <div class="stat-card">
                <div class="stat-value">${stats.monStat1}</div>
                <div class="stat-label">Mon Statistique</div>
            </div>
        </div>
    `;
}

// Export
window.MaNouvelleSection = {
    renderMaNouvelleSection
};
```

### 3. Ajouter à la Configuration

**Fichier :** `js/stats-config.js`

```javascript
sections: [
    // ... sections existantes
    {
        id: 'ma-nouvelle-section',
        title: 'Ma Nouvelle Section',
        description: 'Description de ma section',
        enabled: true,
        calculator: 'ma-nouvelle-section',
        renderer: 'ma-nouvelle-section',
        order: 7
    }
]
```

### 4. Intégrer au Gestionnaire

**Fichier :** `js/statistics-new.js`

```javascript
// Dans calculateSectionStats, ajouter :
case 'ma-nouvelle-section':
    stats = await MaNouvelleSection.calculateMaNouvelleSection(drinks, dateRange, options);
    break;

// Dans renderSectionHTML, ajouter :
case 'ma-nouvelle-section':
    return MaNouvelleSection.renderMaNouvelleSection(stats);
```

## 🎨 Personnalisation de l'Affichage

### Couleurs des Cartes
```css
.stat-card.ma-classe {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Icônes Personnalisées
```javascript
{
    icon: '🎯', // Emoji simple
    // ou
    icon: '<i class="fas fa-chart-bar"></i>', // Font Awesome
}
```

## 🔄 Ordre des Sections

Modifiez la propriété `order` dans `stats-config.js` :

```javascript
{
    id: 'general',
    order: 1  // Première section
},
{
    id: 'temporal',
    order: 2  // Deuxième section
}
```

## 🚀 Activation du Nouveau Système

### Étape 1 : Inclure les Nouveaux Fichiers

**Dans `index.html`, ajouter avant `</body>` :**

```html
<!-- Configuration des statistiques -->
<script src="js/stats-config.js"></script>

<!-- Calculateurs -->
<script src="js/stats-calculators/general.js"></script>
<script src="js/stats-calculators/temporal.js"></script>
<script src="js/stats-calculators/categories.js"></script>
<script src="js/stats-calculators/drinks.js"></script>
<script src="js/stats-calculators/health.js"></script>
<script src="js/stats-calculators/location.js"></script>

<!-- Renderers -->
<script src="js/stats-renderers/general-renderer.js"></script>

<!-- Nouveau gestionnaire -->
<script src="js/statistics-new.js"></script>
```

### Étape 2 : Modifier l'Initialisation

**Dans `js/app.js`, remplacer :**

```javascript
// Ancien
if (!statsManager.isInitialized) {
    statsManager.init();
}

// Par nouveau
if (!modularStatsManager.isInitialized) {
    modularStatsManager.init();
}
```

## 🐛 Débogage

### Logs Utiles
```javascript
console.log('Stats calculées:', stats);
console.log('Sections activées:', StatsConfig.getEnabledSections());
```

### Vérification du Cache
```javascript
// Vider le cache
modularStatsManager.clearCache();
```

## 📝 Exemples Pratiques

### Ajouter une Stat Simple
```javascript
// Dans le calculateur
const avgSessionLength = sessions.length > 0 ? 
    sessions.reduce((sum, s) => sum + s.drinks.length, 0) / sessions.length : 0;

return {
    // ... autres stats
    avgSessionLength: Math.round(avgSessionLength * 10) / 10
};
```

### Ajouter un Graphique
```javascript
// Dans le renderer
function postRenderMaSection(stats) {
    const canvas = document.getElementById('mon-graphique');
    if (canvas && window.Chart) {
        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Lun', 'Mar', 'Mer'],
                datasets: [{
                    data: [1, 2, 3]
                }]
            }
        });
    }
}
```

## 🎯 Bonnes Pratiques

1. **Nommage :** Utilisez des noms explicites pour vos fonctions et variables
2. **Documentation :** Commentez vos calculs complexes
3. **Validation :** Vérifiez toujours que les données existent avant de les utiliser
4. **Performance :** Utilisez le cache pour les calculs coûteux
5. **Erreurs :** Gérez les cas d'erreur avec des try/catch

## 🔗 Ressources

- **Chart.js :** https://www.chartjs.org/ (pour les graphiques)
- **Leaflet :** https://leafletjs.com/ (pour les cartes)
- **CSS Grid :** Pour organiser l'affichage des statistiques

---

Ce système modulaire vous permet de modifier facilement les statistiques sans toucher au code complexe. Chaque module est indépendant et peut être modifié séparément !

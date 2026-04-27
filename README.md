# AlcoNote - PWA de Suivi de Consommation d'Alcool

AlcoNote est une Progressive Web App (PWA) complète pour le suivi de la consommation d'alcool avec des fonctionnalités avancées de scanner de code-barres, géolocalisation, et statistiques détaillées.

## 🚀 Fonctionnalités

### ✨ Interface Utilisateur
- **Design Apple-like** : Interface moderne inspirée d'iOS
- **Responsive** : S'adapte à tous les appareils (mobile, tablette, desktop)
- **PWA** : Installable comme une application native
- **Mode hors ligne** : Fonctionne sans connexion internet

### 📱 Navigation
- **3 onglets principaux** : Catégories, Boissons, Statistiques
- **Menu paramètres** : Accessible via l'icône hamburger
- **FAB (Floating Action Button)** : Bouton + central pour ajouter du contenu
- **Raccourcis clavier** : Navigation rapide (1, 2, 3, A, S)

### 🍺 Gestion des Boissons
- **Ajout manuel** : Formulaire complet avec suggestions automatiques
- **Scanner de code-barres** : Reconnaissance automatique via QuaggaJS
- **Auto-sauvegarde** : Les bières sont automatiquement sauvegardées après scan
- **Unités multiples** : EcoCup (25cL), cL, L
- **Géolocalisation** : Position automatique lors de l'ajout
- **Groupement intelligent** : Boissons regroupées par nom et quantité
- **Tri alphabétique** : Organisation claire des boissons

### 📊 Statistiques Complètes
- **Périodes flexibles** : Aujourd'hui, semaine, mois, année, personnalisé
- **Navigation par jour** : Flèches pour naviguer jour par jour
- **Statistiques générales** :
  - Nombre total de boissons
  - Volume total consommé
  - Grammes d'alcool pur
  - Nombre de sessions
  - Jours sobres
  - Moyennes par période

- **Analyse temporelle** :
  - Heures de consommation
  - Jours de la semaine
  - Durée des sessions
  - Temps entre sessions

- **Statistiques par catégorie** :
  - Répartition par type
  - Volume moyen
  - Degré d'alcool moyen
  - Boisson préférée

- **Indicateurs de santé** :
  - Comparaison aux recommandations OMS
  - Estimation du taux d'alcoolémie
  - Consommation hebdomadaire

### 🗂️ Organisation
- **Catégories** : Bière, Vin, Spiritueux, Cocktail, Autre
- **Tri intelligent** : Catégories triées par nombre de boissons
- **Détail des boissons** : Vue détaillée avec historique par date
- **Sections pliables** : Organisation par date avec possibilité de replier

### 🔧 Fonctionnalités Avancées
- **Swipe to delete** : Glisser vers la gauche pour supprimer
- **Géolocalisation** : Tracking automatique des lieux de consommation
- **Export/Import** : Sauvegarde et restauration des données
- **Suggestions** : Auto-complétion basée sur l'historique
- **Mode hors ligne** : Fonctionnement complet sans internet

## 🛠️ Technologies Utilisées

### Frontend
- **HTML5** : Structure sémantique
- **CSS3** : Design moderne avec variables CSS et animations
- **JavaScript ES6+** : Logique applicative moderne
- **PWA** : Service Worker, Web App Manifest

### Stockage
- **IndexedDB** : Base de données locale avec Dexie.js
- **LocalStorage** : Paramètres utilisateur

### APIs Externes
- **OpenFoodFacts** : Reconnaissance des produits par code-barres
- **Nominatim (OpenStreetMap)** : Géocodage inverse
- **QuaggaJS** : Scanner de code-barres
- **Chart.js** : Graphiques et visualisations

### Géolocalisation
- **HTML5 Geolocation API** : Position GPS
- **Clustering** : Regroupement des lieux proches
- **Analyse spatiale** : Statistiques par lieu

## 📁 Structure du Projet

```
AlcoNote/
├── index.html              # Page principale
├── manifest.json           # Manifest PWA
├── sw.js                   # Service Worker
├── generate-icons.html     # Générateur d'icônes
├── css/
│   ├── main.css            # Styles principaux
│   ├── components.css      # Composants UI
│   └── responsive.css      # Design responsive
├── js/
│   ├── app.js              # Contrôleur principal
│   ├── database.js         # Gestion IndexedDB
│   ├── utils.js            # Fonctions utilitaires
│   ├── scanner.js          # Scanner code-barres
│   ├── statistics.js       # Calculs statistiques
│   └── geolocation.js      # Géolocalisation
└── assets/
    └── icons/              # Icônes PWA
```

## 🚀 Installation et Utilisation

### Installation Locale
1. Cloner ou télécharger le projet
2. Ouvrir `generate-icons.html` dans un navigateur
3. Cliquer sur chaque icône pour les télécharger dans `assets/icons/`
4. Servir le projet via un serveur HTTP local
5. Ouvrir `index.html` dans un navigateur moderne

### Installation PWA
1. Ouvrir l'application dans un navigateur compatible
2. Cliquer sur "Installer" quand l'invite apparaît
3. L'application sera installée comme une app native

### Utilisation
1. **Première utilisation** : Les catégories par défaut sont créées automatiquement
2. **Ajouter une boisson** : Utiliser le bouton + ou scanner un code-barres
3. **Consulter les statistiques** : Onglet Statistiques avec différentes périodes
4. **Paramètres** : Menu hamburger pour configurer profil et données

## 📱 Compatibilité

### Navigateurs Supportés
- **Chrome/Chromium** 80+ (recommandé)
- **Firefox** 75+
- **Safari** 13+
- **Edge** 80+

### Fonctionnalités par Plateforme
- **Scanner** : Nécessite accès caméra (HTTPS requis)
- **Géolocalisation** : Nécessite permission de localisation
- **PWA** : Installation disponible sur tous les navigateurs modernes
- **Hors ligne** : Fonctionnement complet sans internet

## 🔒 Confidentialité et Sécurité

- **Données locales** : Toutes les données restent sur l'appareil
- **Pas de tracking** : Aucune donnée envoyée à des serveurs tiers
- **APIs externes** : Utilisées uniquement pour enrichir les données
- **Géolocalisation** : Stockée localement, jamais partagée

## 🎨 Personnalisation

### Couleurs
Les couleurs peuvent être modifiées dans `css/main.css` via les variables CSS :
```css
:root {
    --primary-color: #007AFF;
    --success-color: #34C759;
    --warning-color: #FF9500;
    --error-color: #FF3B30;
}
```

### Catégories
Les catégories par défaut peuvent être modifiées dans `js/database.js`.

## 🤝 Contribution

Ce projet est conçu pour être facilement extensible :
- Architecture modulaire
- Code documenté
- Séparation des responsabilités
- APIs bien définies

## 📄 Licence

Ce projet est fourni à des fins éducatives et de démonstration.

## 🆘 Support

Pour toute question ou problème :
1. Vérifier la console du navigateur pour les erreurs
2. S'assurer que le serveur HTTPS est utilisé pour le scanner
3. Vérifier les permissions caméra et géolocalisation
4. Tester sur un navigateur compatible

---

**AlcoNote** - Une PWA moderne pour un suivi responsable de la consommation d'alcool.

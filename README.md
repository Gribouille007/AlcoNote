# AlcoNote — Suivi de consommation d'alcool (PWA)

AlcoNote est une Progressive Web App (PWA) pour suivre sa consommation
d'alcool : ajout manuel ou par scan de code-barres, statistiques
détaillées, taux d'alcoolémie et carte des lieux. Toutes les données
restent sur l'appareil (IndexedDB) ; aucune donnée n'est envoyée à un
serveur tiers.

## Fonctionnalités

### Interface
- Design éditorial sombre/clair, typographies Geist + Instrument Serif.
- 3 onglets — Catégories, Historique, Statistiques — avec FAB central.
- Tiroir paramètres (côté gauche) : thème, profil, export/import,
  effacement.

### Boissons
- Ajout manuel ou via scan de code-barres (Quagga + OpenFoodFacts).
- Unités cL / L / EcoCup (25 cL).
- Géolocalisation optionnelle à l'enregistrement.
- Notes (étoiles 1–5) par nom de boisson.
- Modification d'une entrée seule, ou de toute la "famille"
  (nom + quantité + unité + degré).
- Glisser vers la gauche pour supprimer (historique, records BAC).

### Statistiques
Sept sections, toutes pliables, avec navigation par période
(Jour · Semaine · Mois · Année · A. scol. · Tout) :
- **Général** — boissons, sessions, volume, alcool pur, jours sobres
  (calculés du début de la période jusqu'à aujourd'hui), avec un
  badge Δ% par rapport à la période précédente.
- **Temporel** — heure de pointe, jour de pointe, durée moyenne de
  session, graphe d'heure (interactif) et radar par jour de la
  semaine.
- **Catégorie** — volume, ABV moyen, boisson favorite par catégorie.
- **Top 10** — boissons les plus consommées avec note.
- **Alcoolémie (BAC)** — jauge instantanée, projection scrubbable
  façon Revolut (glissez le doigt pour voir le taux à un moment
  précis), durées avant sobriété/conduite, records (limités au top 3).
  Calcul : Widmark, élimination linéaire 150 mg/L/h, absorption en
  30 min.
- **Carte** — Leaflet + tuiles OpenStreetMap, un marker par
  consommation géolocalisée (chargé à la demande).
- **Évolution mensuelle** — courbe verres / grammes sur 6 mois.
- **Avancées** — moyennes mobiles 7/30 j, horloge polaire 24 h,
  distribution des sessions.

Tous les graphes sont interactifs (tap/glisser pour révéler valeur et
contexte).

### En-tête
- Pilule mg/L permanente affichant le BAC courant (rafraîchi chaque
  minute).

## Architecture

```
AlcoNote/
├── index.html              # Shell HTML
├── manifest.json           # Manifest PWA
├── sw.js                   # Service worker (cache versionnée)
├── proto/                  # Source UI (React + JSX)
│   ├── shared.jsx          # Tokens, icônes, primitives
│   ├── data.jsx            # Hooks IndexedDB + adapter
│   ├── stats-charts.jsx    # SVG charts (interactifs)
│   ├── categories.jsx      # Onglet Catégories
│   ├── history.jsx         # Onglet Historique
│   ├── stats.jsx           # Onglet Statistiques
│   ├── modals.jsx          # Sheets : ajout, détail, édition, settings
│   ├── app.jsx             # Shell, navigation, header, FAB
│   └── dist/               # Sortie Babel (chargée par index.html)
├── js/                     # Backend hérité (DB, scanner, lookups)
│   ├── database.js         # Wrapper Dexie (version 3 du schema)
│   ├── utils.js
│   └── scanner/
│       ├── camera-scanner.js
│       └── product-lookup.js
├── tools/build.js          # Précompile proto/*.jsx → proto/dist/*.js
└── package.json
```

### Build

```bash
npm install        # une fois
npm run build      # compile proto/*.jsx → proto/dist/*.js
npm run watch      # rebuild en continu
```

Chaque `.jsx` se compile en un fichier global qui exporte ses
composants via `Object.assign(window, …)` — il n'y a pas de bundler.
Le HTML charge les scripts dans cet ordre :
`shared → data → stats-charts → categories → history → stats →
modals → app`.

### Données

IndexedDB via Dexie 3, schéma v3 (`AlcoNoteDB`) :
- `categories` (id, name, drinkCount)
- `drinks` (id, name, category, quantity, unit, alcoholContent,
  date, time, location, barcode)
- `settings` (key, value)
- `bacRecords` (id, bacValue, timestamp, drinkCount)
- `drinkRatings` (drinkName, rating)

Les overrides d'icônes de catégorie sont stockés comme settings de
clé `cat.icon.<nom>`.

## Compatibilité

- Chrome/Edge 80+, Firefox 75+, Safari 13+
- Scanner : caméra (HTTPS requis)
- Géolocalisation : permission requise
- Carte Leaflet : chargée depuis unpkg + tuiles OSM (réseau requis
  uniquement pour la première vue)

## Confidentialité

- Toutes les données restent sur l'appareil.
- APIs externes : OpenFoodFacts (scan), Nominatim (géocodage inverse),
  tiles.openstreetmap.org (carte). Aucun tracking.
- Export JSON / Import / Tout effacer disponibles dans les paramètres.

## Licence

Projet fourni à des fins éducatives et de démonstration.

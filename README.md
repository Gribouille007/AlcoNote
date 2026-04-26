# AlcoNote — PWA de suivi de consommation d'alcool

AlcoNote est une Progressive Web App de suivi personnel : catégories de
boissons, historique chronologique, statistiques détaillées (temporel,
alcoolémie estimée par formule de Widmark, distributions de sessions,
moyennes mobiles).

L'interface est un redesign éditorial — palette ambre / ivoire chaude,
typographie Instrument Serif × Geist — livrée par Claude Design et
implémentée comme un prototype React monté dans une coque PWA classique.

## Démarrage rapide

```bash
git clone <repo>
cd AlcoNote
python3 -m http.server 8000  # ou tout serveur statique HTTPS
# ouvrir http://localhost:8000
```

Aucune étape `npm install` n'est nécessaire pour servir le site : les
sources JSX sont **déjà précompilées** dans `build/proto/*.js` et
commitées avec le code.

## Architecture

```
AlcoNote/
├── index.html              # Point d'entrée — charge build/proto/*.js
├── manifest.json           # Manifest PWA (couleurs, icônes, raccourcis)
├── sw.js                   # Service Worker — cache statique + stratégies
├── package.json            # Build script (devDeps uniquement)
├── babel.config.json       # Preset @babel/preset-react
│
├── proto/                  # ▼ Source de vérité (JSX)
│   ├── shared.jsx          #   Tokens de thème + icônes SVG
│   ├── db.jsx              #   Adaptateur IndexedDB (legacy AlcoNoteDB)
│   ├── data.jsx            #   Catégories par défaut + données de seed
│   ├── app.jsx             #   App, PhoneFrame, AppHeader, BottomNav
│   ├── categories.jsx      #   Onglet Catégories (grille + drill-down)
│   ├── history.jsx         #   Onglet Historique (groupé par jour)
│   ├── stats.jsx           #   Onglet Statistiques (7 sections)
│   ├── stats-charts.jsx    #   Primitives SVG (bar, donut, radar, ...)
│   └── modals.jsx          #   Add Drink, Drink detail, Settings, Scanner
│
├── build/proto/            # ▼ JS compilé (commité, sert directement)
│   └── *.js                #   Émis par `npm run build`
│
├── assets/icons/           # Icônes PWA
└── .github/workflows/      # CI : build-check
```

### Flux de données

1. Au boot, `app.jsx` appelle `hydrateFamilies()` qui lit IndexedDB
   (`AlcoNoteDB` — la même base que la version legacy).
2. Les lignes `drinks` sont regroupées en *familles* (boisson + degré +
   format) par `groupIntoFamilies()`. Le résultat est exposé via
   `window.DRINK_FAMILIES`.
3. Les composants lisent `window.DRINK_FAMILIES` au render et se
   ré-abonnent via `useDb()` pour se redessiner après hydratation.
4. Quand une boisson est ajoutée (`addDrinkToDb`), elle est persistée
   dans IndexedDB, le compteur `categories.drinkCount` est mis à jour
   pour rester cohérent avec un éventuel rollback vers la version
   legacy, puis `hydrateFamilies()` re-rafraîchit la vue.

### Préservation des données

L'adaptateur IDB (`proto/db.jsx`) est conçu pour ne **jamais perdre les
données utilisateur** lors de la migration depuis la version legacy :

- **Ouverture sans version forcée** : la base est ouverte à sa version
  actuelle ; un schéma futur (DB > v3) est lu tel quel sans tentative
  de downgrade.
- **Stores manquants** tolérés : un schéma legacy v1/v2 sans
  `bacRecords` ou `drinkRatings` ne produit pas d'erreur.
- **`onversionchange`** ferme la connexion proprement quand un onglet
  pair demande un upgrade.
- **Backup / restore** dans Paramètres → Données :
  - *Exporter* dump tous les stores en JSON.
  - *Importer* fait un merge-by-id (un row qui a la même clé écrase la
    version actuelle, les rows absents du backup sont conservés). Les
    erreurs par-ligne sont isolées via `preventDefault()` pour ne pas
    annuler la transaction entière.
  - *Tout effacer* demande confirmation puis supprime la base.

## Développement

Si tu modifies un fichier `proto/*.jsx`, **tu dois recompiler** avant de
commiter :

```bash
npm install        # une fois, installe @babel/cli + preset-react
npm run build      # compile proto/ → build/proto/
# ou en mode watch pendant le dev :
npm run watch
```

Une GitHub Action (`.github/workflows/build-check.yml`) vérifie sur
chaque PR que `build/` correspond bien aux sources, pour empêcher tout
drift accidentel.

### Pourquoi pré-compiler ?

La version initiale du prototype embarquait `@babel/standalone` (~3 MB)
pour compiler le JSX dans le navigateur. Ce choix forçait
`unsafe-eval` dans la CSP. La version actuelle pré-compile, ce qui
permet une CSP stricte (`script-src 'self' https://unpkg.com`, sans
`unsafe-eval` ni `unsafe-inline`).

## Statistiques

Toutes les sections de l'onglet *Statistiques* dérivent leurs données
de `window.DRINK_FAMILIES` à chaque render :

| Section | Source |
|---|---|
| Statistiques générales | `_filterByPeriod(_flatEntries)` selon période |
| Analyse temporelle | `deriveHourly`, `deriveDaily`, sessions Widmark |
| Analyse par catégorie | agrégation par `family.category` |
| Top 10 boissons | tri par `entries.length` |
| Alcoolémie | `computeCurrentBacMgPerL` + IDB `bacRecords` |
| Évolution mensuelle | `deriveTrends` (6 derniers mois) |
| Analyses avancées | `deriveRolling` (30 j), polar clock, sessions |

Le calcul Widmark utilise `userWeight` et `userGender` lus depuis le
store legacy `settings` ; à défaut, valeurs par défaut 70 kg / r=0.7.

## Sécurité & confidentialité

- **Données 100 % locales** : aucune requête sortante (autre que les
  polices Google Fonts).
- **CSP stricte** : `script-src 'self' https://unpkg.com`,
  `connect-src 'self'`, pas d'`unsafe-eval`.
- **Headers** : `X-Content-Type-Options: nosniff`, `X-Frame-Options:
  DENY`, SRI sur tous les scripts CDN.

## Compatibilité

- Chrome / Edge 80+, Firefox 75+, Safari 13+.
- Installation PWA via le navigateur ; thème clair / sombre via les
  Paramètres.

## Licence

Projet personnel à fins de démonstration et d'usage privé.

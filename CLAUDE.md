# CLAUDE.md — Notes pour les contributeurs (humains et IA)

Ce fichier est le briefing rapide pour développer sur AlcoNote. Lire
aussi `README.md` pour la vue produit.

## En 30 secondes

- PWA monolithique servie statiquement (Netlify), pas de bundler.
- UI : React 18 (UMD) + JSX précompilé via Babel, exposé sur `window`.
- Données : IndexedDB via Dexie 3, helper `window.dbManager`.
- Source UI : `proto/*.jsx` → build → `proto/dist/*.js` chargé par
  `index.html`.

## Direction artistique (DA) — règle absolue

**Tout ce qui est implémenté DOIT respecter la DA existante.** Aucun
nouveau composant, écran, card ou bouton ne doit s'écarter du système
ci-dessous. Si une teinte, un token ou une primitive manque, on
l'ajoute au système (`shared.jsx`) puis on l'utilise — jamais de
valeur en dur.

- **Couleurs** : exclusivement via `T.*`. Aucun littéral `#hex`,
  `rgb()`, ni `oklch(...)` inline dans les composants. Les exceptions
  (couleurs OKLCH dans `BAC_LEVELS`, `bacColor`, niveaux d'alerte) sont
  centralisées et nommées.
- **Surfaces** : `T.surface` pour les sections, `T.surface2` pour les
  cards/stat blocks, `T.surface3` pour les sub-blocks ; bordure
  toujours `1px solid ${T.rule}` ; radius 12 (mini stats), 14 (Card),
  16 (StatSection).
- **Typo** : `fontSerif` *italic* pour les chiffres clés et titres
  expressifs ; `fontNum` (Geist Mono) pour tous les nombres
  tabulaires (mesures, dates, pourcentages, durées) ; `fontSans` (par
  défaut) pour le reste. Police montée à `font-family: 'inherit'` sur
  les `<button>` et `<input>`.
- **Labels secondaires** : `T.muted`, `fontSize: 9.5–10`,
  `letterSpacing: 0.3`, `textTransform: 'uppercase'`.
- **Icônes** : toujours via `<SvgIcon icon={Ic.xxx} size={N} />`. Ne
  jamais inliner un `<svg>` ad-hoc — l'ajouter à `Ic` dans
  `shared.jsx`.
- **Boutons** : `border: 'none'`, `fontFamily: 'inherit'`, `cursor:
  'pointer'`, `padding: 0` quand reset ; reset complet via le spread
  `...ghostButton` quand transparent.
- **Espacements** : multiples pairs (4, 6, 8, 10, 12, 14, 16, 18, 22).
  Pas de `padding: 13px`.
- **Chiffres importants** (mini stat card) : `fontFamily: fontSerif`,
  `fontSize: 22`, `letterSpacing: -0.3 à -0.4`, `lineHeight: 1`.
- **Composition** : réutiliser `Card`, `MiniStat`, `StatSection`,
  `StatRow`, `DeltaBadge`, `Stars`, `Pill`, `SvgIcon` plutôt que
  recréer un conteneur. Pour une stat card "iconifiée", étendre
  `MiniStat` (props `icon`/`accent`) au lieu de dupliquer.
- **Animations** : utiliser celles déjà injectées dans `shared.jsx`
  (`fade`, `slideUp`, `slideRight`, `slideLeft`, `scaleIn`, `pulse`).
  Transitions : `0.18–0.22s ease`.
- **Charts** : tous via les primitives de `stats-charts.jsx`
  (`SvgBarChart`, `SvgRadar`, `SvgDonut`, `SvgLineChart`,
  `SvgPolarClock`, `SvgBACProjection`, `SvgHistogram`). Toujours
  passer par `useChartScrubber` + `<ChartTooltip>` pour la
  scrub/tooltip — jamais d'overlay HTML.
- **Confirmations** : `Confirm.ask({...})`, jamais `window.confirm`.
- **Toasts** : `Toast.show(msg, { undo })`, jamais d'alerte custom.

Avant de pousser un nouveau composant : relire la liste ci-dessus en
diagonale et vérifier chaque point. Une couleur en dur ou un
`<svg>` inline est un bug DA.

## Workflow build

```bash
npm install        # première fois
npm run build      # compile tous les .jsx
npm run watch      # mode watch
```

`tools/build.js` itère sur `proto/*.jsx` et écrit `proto/dist/*.js`
avec un en-tête « AUTO-GENERATED ». **Ne jamais éditer** les fichiers
sous `proto/dist/` — ils sont régénérés à chaque build.

## Conventions

### Composants

- Chaque `.jsx` se termine par
  ```js
  Object.assign(window, { ComponentA, helperB, ... });
  ```
  pour exposer ses symboles (les autres fichiers les consomment via
  `window` puisqu'il n'y a pas de modules).
- `React`, `ReactDOM` et tous les helpers exposés sont en globaux.
- Pas de fonts, pas de styles externes (sauf `Leaflet` chargé à la
  demande depuis `MapSection`).

### Style

- Thèmes dans `proto/shared.jsx` (`THEMES.dark` / `THEMES.light`),
  accessibles via le proxy mutable `T`. Toute couleur passe par `T`,
  jamais par un littéral.
- `useTheme()` force-re-render quand le thème change.
- Police : `fontSans`, `fontSerif` (titres et serif italique pour les
  chiffres clés), `fontNum` (Geist Mono pour les nombres tabulaires).

### Données

`proto/data.jsx` expose des hooks React qui s'abonnent à `dataBus` :
- `useCategories()`, `useDrinks()`, `useRatings()`, `useSettings()`,
  `useBacRecords()`, `useCategoryIcons()`.
- Mutations : `addDrink`, `updateDrink`, `deleteDrink`, `addCategory`,
  `renameCategory`, `deleteCategory(id, { reassignTo })`,
  `updateFamily`, `deleteFamily`, `setCategoryIcon`. Toutes appellent
  `dataBus.bump()` après écriture.
- Une "famille" est un groupe de boissons partageant
  `(name, quantity, unit, alcoholContent)`. La modification d'une
  *entrée* (un drink unique) ne propage pas, alors que `updateFamily`
  cascade sur tous les drinks de la même famille.

### Charts

`proto/stats-charts.jsx` expose des SVG primitives :
`SvgBarChart`, `SvgRadar`, `SvgDonut`, `SvgLineChart`,
`SvgPolarClock`, `SvgBACProjection`, `SvgHistogram`.

Tous utilisent le même `useChartScrubber(svgRef, _, onChange)` qui
mappe le `pointermove` du conteneur SVG vers les coordonnées du
viewBox, puis le composant traduit en index/temps. Les tooltips sont
rendues par `<ChartTooltip>` (un `<g>` avec rect + textes), positionnée
côté SVG.

Pour ajouter un nouveau type de graphe interactif :
1. Recevoir `data` et un `width`/`height` en viewBox units.
2. Utiliser `useRef` sur le `<svg>` et `useChartScrubber`.
3. Calculer l'index en projetant `p.x`/`p.y` selon les paddings.
4. Rendre la tooltip en passant `width` (= viewBox width) à
   `ChartTooltip`.

### BAC

`computeBacOverTime(drinks, weight, gender)` retourne :
- `points: { t (heures relatives à maintenant), bac (mg/L) }[]`
- `current: number`
- `drinks: drinks pris en compte (≤ 24 h)`

Modèle : Widmark avec absorption linéaire sur 0,5 h, élimination
constante 150 mg/L/h. Élimination ne commence pas avant la première
boisson (`max(0, h - earliest)`).

### Sections statistiques

Chaque section reçoit le bag `sp` depuis `StatsTab` :
```js
{ collapsed, toggleSection, period, drinks, allDrinks,
  prevDrinks, prevRange, settings, range, anchor }
```
- `drinks` est filtré sur la période courante (`range`).
- `prevDrinks` pour le calcul des badges Δ% (passe à `null` quand
  `period === 'all'`).
- `allDrinks` pour les sections qui veulent toute la chronologie
  (Tendances, Moyennes mobiles, BAC).

Pour ajouter une section :
1. Écrire un composant `MaSection({ drinks, ..., collapsed,
   toggleSection })`.
2. Appeler `<StatSection id="ma-section" title=... collapsed={...}
   toggleSection={...}>` autour du contenu.
3. L'insérer dans `StatsTab` dans l'ordre voulu et ajouter
   l'`Object.assign` global.

### Sheets / overlays

- `SheetOverlay` accepte `side: 'bottom' | 'left' | 'right'`.
  Animations : `slideUp`, `slideRight`, `slideLeft`.
- Tous les boutons doivent rester clavier-accessibles
  (`role`, `aria-label`, `tabIndex` au besoin).
- Préférer `Confirm.ask({ title, message, confirmText, danger })` au
  `window.confirm` natif.

### Icônes

`Ic` dans `shared.jsx`. Ajouter une nouvelle icône = entrer un JSX
SVG dedans, la consommer via `<SvgIcon icon={Ic.xxx} size={N} />`.

### Catégories

`CAT_DEFAULT` dans `shared.jsx` mappe les 5 catégories par défaut
(Bière, Vin, Spiritueux, Cocktail, Autre) à leur teinte. Les noms
inconnus reçoivent une teinte hashée déterministe.

Les **icônes personnalisées** sont stockées dans `settings` sous la
clé `cat.icon.<nom>`. `loadCategoryIcons()` (appelée au mount par
`app.jsx`) miroite ces overrides dans `window.__alcoCatIcons`, que
`<CategoryGlyph>` consulte synchroniquement.

## Service worker

`sw.js`. À chaque modif de fichier statique, **bumper** la triple
constante `CACHE_NAME / STATIC_CACHE / DYNAMIC_CACHE` et la liste
`STATIC_FILES` si on ajoute un script.

## Tests manuels avant push

- Add drink avec / sans prefill, chaque unité, chaque catégorie.
- Edit d'une entrée : la famille doit rester (autres entrées
  intactes).
- Edit d'une famille : toutes les entrées migrées d'un coup.
- Suppression d'une entrée depuis le détail : si dernière, sheet se
  ferme ; sinon timeline mise à jour.
- Swipe gauche dans Historique → suppression.
- BAC : ajouter une bière maintenant et vérifier que la pilule
  d'en-tête monte, que la projection se courbe, que le scrubber suit
  le doigt.
- Carte : un drink avec coordonnées doit apparaître ; sans coords,
  message vide.
- Tiroir paramètres : ouvre depuis la gauche, slide animé.
- FAB : à environ ~14 px du bord droit, ne déborde pas.

## Ce qu'il NE faut pas faire

- Ajouter de la logique business directement dans `proto/dist/*.js`
  (sera écrasé au prochain build).
- Bypass le service worker en cassant la liste de cache.
- Importer un nouveau bundler (ex. Vite, Webpack) sans en discuter —
  l'archi statique est volontaire pour Netlify.
- Pousser des secrets : pas de clés API, pas de tokens, jamais.

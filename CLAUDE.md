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
- **Formulaires** : réutiliser les primitives partagées de `shared.jsx`
  au lieu de réinventer le markup : `FieldGroup` (label + champ),
  `inputBaseStyle()` / `inputS()` (style d'input texte), `NumberField`
  (champ numérique), `CategoryChips` (sélecteur de catégorie en chips),
  `UnitToggle` (cL/L/EcoCup), `RatingField` (note + « Effacer »).
- **Champs numériques** : TOUT champ attendant un nombre passe par
  `<NumberField>` — jamais un `<input type="number">` (qui rejette la
  virgule sur de nombreux claviers). `NumberField` force le pavé
  numérique mobile (`inputMode="decimal"`) et accepte le point **ou** la
  virgule. Son state reste une *string* ; convertir avec
  `parseDecimal(str)` (virgule→point, `NaN` si vide/invalide) au submit.
- **Animations** : utiliser celles déjà injectées dans `shared.jsx`
  (`fade`, `slideUp`, `slideRight`, `slideLeft`, `scaleIn`, `pulse`,
  les sorties `fadeOut`/`sheetOutDown`/`sheetOutLeft`/`sheetOutRight`,
  les transitions de page `pageIn`/`pageOut`, `toastIn`/`toastOut`).
  Durées/easing via `MOTION` (`base` 220 ms en entrée, `fast` 180 ms en
  sortie) ; transitions : `0.18–0.22s ease`. Toute fermeture de
  sheet/vue passe par `useSheetClose` (cf. § Sheets) — jamais de
  démontage sec d'un overlay.
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

## Tests automatisés

```bash
npm test           # build (pretest) + toute la suite node --test
npm run test:unit  # unitaires purs + DB + checks statiques (rapide)
npm run test:app   # intégration jsdom (app complète)
```

La suite vit dans `tools/tests/*.test.js` (runner natif `node:test`,
Node ≥ 20, zéro framework) :

- **Unitaires purs** (`unit-*.test.js`) : helpers de `shared`/`data`/
  `stats` chargés depuis `proto/dist/` avec des stubs globaux minimaux
  (`helpers/stub-globals.js`).
- **DB** (`db*.test.js`) : `js/database.js` sur `fake-indexeddb`
  (conversions d'unités, settings, migrations v4→v5, import/export).
- **Intégration** (`app-*.test.js`) : la vraie app compilée bootée sous
  jsdom + fake-indexeddb + transport de partage mock
  (`helpers/boot-app.js`). Toujours appeler `cleanup()` dans `after()`
  (ferme la fenêtre jsdom → purge les intervalles 60 s BAC/share).
- **Checks statiques** (`static-checks.test.js`) : lint DA sur les
  sources (couleurs en dur, `<input type="number">`, `<svg>` inline,
  `window.confirm`), cohérence `sw.js` (triple version identique,
  `STATIC_FILES` ⊇ scripts d'`index.html`).

Toute nouvelle feature doit arriver avec ses tests ; `npm test` doit
être vert avant de pousser.

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

### Formulaires (primitives partagées)

Définies dans `shared.jsx` (chargé en premier, donc disponibles partout) :

- `NumberField({ value, onChange, placeholder='—', step, allowDecimal=true,
  style, ariaLabel, suffix, onBlur })` : input numérique
  (`type="text"` + `inputMode`) acceptant `,` ou `.`. State = string ;
  `onChange` reçoit la string sanitisée. `suffix` (ex. `'%'`) rend le
  conteneur bordé avec unité. Parser avec `parseDecimal` au submit.
- `parseDecimal(str)` : `→ Number | NaN` (trim, virgule→point).
- `CategoryChips({ categories, value, onChange })`,
  `UnitToggle({ value, onChange, units })`,
  `RatingField({ value, onChange, size })`, `FieldGroup({ label, children })`.

Les sheets d'add/édition (`AddDrinkSheet`, `EditEntrySheet`,
`EditFamilySheet`) et le poids (Paramètres › `ProfileRow numeric`)
composent uniquement avec ces primitives. Les sheets montées dans
`app.jsx` / `history.jsx` portent un `key={…id}` pour un remount propre
quand la cible change (évite des champs figés sur l'ancienne cible).

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
  `(name, quantity, unit, alcoholContent)` — la **catégorie n'entre pas**
  dans la clé (cf. `buildFamilies`), donc l'`id` de famille est stable
  même quand on change sa catégorie. La modification d'une *entrée* (un
  drink unique) ne propage pas, alors que `updateFamily` cascade sur tous
  les drinks de la même famille.
- **Déplacer une famille** : `updateFamily(family, { category })` réassigne
  toutes ses entrées. Exposé via l'action « Déplacer vers… » de
  `DrinkDetailSheet` et via le sélecteur de catégorie d'`EditFamilySheet`.
- **Prix** : le prix d'UNE entrée vit sur le drink (`drink.price`,
  `priceIsCustom`) ; le prix de **référence** d'une famille vit en setting
  `price.ref.<clé famille>` (repris par le « + » / « Ajouter à nouveau »).
  **Prix intelligent** : `suggestPriceForVolume(families, name, volCl,
  abv)` dérive un €/L des familles homonymes tarifées (priorité :
  contenant exact > même degré > première famille tarifée) et suggère le
  prix au prorata, arrondi au centime. `AddDrinkSheet` préremplit le champ
  Prix avec cette suggestion tant que l'utilisateur n'a pas tapé dedans
  (`priceAuto`) — changer la quantité re-calcule ; une saisie manuelle
  n'est JAMAIS écrasée. Toute évolution du prix passe par cet helper,
  pas par un calcul local.

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
- `points: { t (heures relatives à maintenant), bac (mg/L) }[]` —
  la courbe affichée démarre au **dernier épisode** (dernier passage
  0 → >0), pas à la première boisson des 24 h, et s'arrête ~30 min
  après le retour à 0 (sans s'étirer jusqu'à « maintenant » si la
  sobriété date de plus d'une heure).
- `current: number` (mg/L arrondi)
- `drinks: drinks pris en compte (≤ 24 h)`
- `soberInH` / `legalInH` : heures avant le retour **final** à 0 /
  sous `BAC_LEGAL_LIMIT` (500 mg/L). Calculées sur la courbe exacte —
  elles intègrent l'absorption en cours (le taux peut encore monter).
  C'est la SEULE source des cellules « Sobriété » / « Conduite » de
  `BACSection` ; ne jamais re-diviser `current / élimination`.

Modèle : Widmark avec absorption linéaire sur `BAC_ABSORPTION_H`
(0,5 h), élimination constante `BAC_ELIM_RATE` (150 mg/L/h), intégré
par **marche exacte des points de rupture avec clamp à zéro** — le
MÊME schéma que `computeBACSessions`. L'élimination s'arrête quand le
taux touche 0 : ne jamais revenir à une forme fermée
`max(0, Σ absorbé − elim·Δt)`, qui accumule une « dette » virtuelle
pendant les creux à zéro et écrase l'épisode suivant (bug historique :
boire la veille + ce soir → taux du soir affiché 0).

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
3. L'ajouter au **registry `STATS_SECTIONS`** (stats.jsx) — id stable
   (= clé du collapse, ne jamais renommer), titre (affiché en mode
   « Réorganiser »), `Comp`, et éventuel `hide(flags)` pour la vue ami —
   puis l'`Object.assign` global. **Ne pas insérer de JSX en dur dans
   `StatsTab`** : le rendu suit le registry.

**Ordre personnalisé** : l'utilisateur réordonne les sections (bouton
« Réorganiser » → drag par poignée ou flèches clavier). Persisté en
setting Dexie **`stats.sectionOrder`** (JSON array — suit l'export/
import, contrairement au collapse en localStorage), lu par
`useSectionOrder()` (hook DB direct + dataBus, PAS `useSettings()` car
FriendStatsView surcharge SettingsContext). `normalizeSectionOrder`
réconcilie un ordre sauvegardé avec le registry : ids inconnus ignorés,
nouvelles sections appendées en fin — une nouvelle section apparaît donc
automatiquement, en dernier, chez un utilisateur qui a déjà réordonné.
La vue ami suit l'ordre perso sans pouvoir l'éditer.

**États vides** : aucune boisson au global → `StatsEmptyState` seul
(pas de sélecteur de période) ; période vide → sélecteur + navigation
conservés, sections remplacées par le message. Une nouvelle section n'a
plus besoin de gérer le cas « période vide » globale (mais garde ses
états partiels internes, ex. « Aucun prix saisi »).

**Charts** : toute échelle Y passe par `chartTicks(max, 2)` et étiquette
les gridlines avec les `values` EXACTES via `fmtTick` (jamais
`Math.round(max * fraction)` — labels médians faux). Tout chart pleine
largeur se monte dans `<ChartAutoWidth minHeight={…}>{(w) => …}` pour
un rendu aux pixels réels ; `maxWidth` pour les charts carrés
(radar/horloge). `ChartTooltip` reçoit TOUJOURS `width` ET `height`
(clamp + flip aux quatre bords).

**Zoom** : le zoom de page est définitivement désactivé (meta viewport +
`touch-action: pan-x pan-y` sur html/body + guards `gesture*` /
double-tap / Ctrl+molette dans `installZoomGuards()`, shared.jsx). Ne
jamais réintroduire un mécanisme qui en dépend ; le zoom interne de la
carte Leaflet reste fonctionnel.

### Sheets / overlays

- `SheetOverlay` accepte `side: 'bottom' | 'left' | 'right'` et porte
  lui-même l'animation d'ENTRÉE (`slideUp`/`slideRight`/`slideLeft`)
  sur le wrapper du dialog — **ne plus poser d'`animation:` sur la
  racine d'une sheet**.
- **Fermeture animée** : chaque sheet fait
  `const [closing, close] = useSheetClose(onClose)` (passer `open` en
  2ᵉ argument pour les sheets montées en continu : AddDrinkSheet,
  SettingsDrawer), passe `onClose={close} closing={closing}` à
  `SheetOverlay` et appelle `close()` partout en interne (X, Annuler,
  succès de submit…). `close()` joue la sortie (`MOTION.fast`) puis
  appelle le vrai `onClose` ; idempotent ; immédiat en
  prefers-reduced-motion. Exception : remplacer une sheet par une autre
  (ex. `onAddAgain`) reste un swap instantané via le parent.
- `FriendStatsView` suit le même hook avec les keyframes `pageIn`/
  `pageOut` (transition de page, pousse depuis la droite) et possède
  son `useBackButton(true, close)` — comme une sheet, montée = piège
  Retour posé.
- **Back système** : les pièges d'historique portent le state
  `__alcoBack` ; au boot, `shared.jsx` consomme un piège resté courant
  (app tuée avec un overlay ouvert) sinon le premier geste retour
  recharge la page puis devient inopérant. Au niveau du shell, Retour
  depuis un onglet secondaire ramène à l'onglet Catégories (un seul
  piège « onglet » à la fois, cf. AppShell).
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
inconnus reçoivent une teinte hashée déterministe. Comparer les noms
de catégorie via `canonicalCat()` (trim + NFC), jamais par `===` brut.

**Créer / modifier / supprimer** : `EditCategorySheet` gère les deux
modes — `mode="create"` (titre « Nouvelle catégorie », nom + icône, pas
de bouton Supprimer ; `addCategory` + `setCategoryIcon`) et le mode édition
par défaut (renommer / changer l'icône / supprimer, avec pré-validation
du doublon). Le bouton « + Nouvelle catégorie » vit dans `CategoryGrid`.

Les **icônes personnalisées** sont stockées dans `settings` par **id**
sous la clé `cat.icon.id.<id>` (les anciennes clés `cat.icon.<nom>` sont
migrées une fois par `migrateCategoryIconsToId`). `loadCategoryIcons()`
charge la map `id→glyph`, que `CategoryIconsProvider` rejoint avec
`id→nom` et expose via `CategoryIconsContext` ; `<CategoryGlyph>` la lit.

## Service worker

`sw.js`. À chaque modif de fichier statique, **bumper** la triple
constante `CACHE_NAME / STATIC_CACHE / DYNAMIC_CACHE` et la liste
`STATIC_FILES` si on ajoute un script.

### Version affichée dans Paramètres

La ligne « AlcoNote · vX.Y.Z » du tiroir Paramètres est **lue
dynamiquement** depuis le SW en exécution via
`navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'})`.
Le hook `useSWVersion()` (dans `shared.jsx`) en extrait le suffixe
`vX.Y.Z` du `CACHE_NAME`. **Source unique de vérité : `sw.js`.** Pas
besoin de toucher au footer côté React quand on bump une version —
il suivra automatiquement la nouvelle valeur dès activation du
nouveau SW. Sans SW (preview `file://`), le footer affiche `—`.

## Données partagées via Contexts

Pour éviter que chaque tab refasse son propre `db.getAllX()` à
chaque `dataBus.bump()`, les hooks de données sont **hoistés** au
niveau racine de `<App/>` via 4 providers (`DrinksProvider`,
`RatingsProvider`, `CategoriesProvider`, `SettingsProvider` dans
`data.jsx`). Les hooks `useDrinks() / useRatings() / useCategories()
/ useSettings()` sont devenus de simples `React.useContext(...)`.
Conséquence : un nouveau composant qui consomme ces données ne
déclenche **pas** de fetch IndexedDB supplémentaire — il lit la même
référence que le reste de l'arbre.

`<FamiliesContext>` complète le dispositif : `buildFamilies(drinks,
ratings)` n'est calculé **qu'une seule fois** dans `AppShell` puis
exposé via le context. `CategoriesTab`, `HistoryTab` et
`DrinkDetailSheet` consomment via `useFamilies()` au lieu de
rebuilder la map à chaque bump.

## Partage entre amis (architecture)

Le partage est **local-first** : la PWA reste la source de vérité
locale (Dexie intact). `proto/share.jsx` :
- **publie** un sous-ensemble minimisé de mes boissons (sans GPS) vers
  un backend de groupe, et
- **recopie** les boissons partagées des autres dans la table Dexie
  `sharedPool` (**LECTURE SEULE**). Le moteur de partage n'écrit JAMAIS
  dans `drinks/categories/ratings/settings` — uniquement `sharedPool` et
  `shareOutbox` (file d'envoi).

Les stats / le BAC d'un ami sont **recalculés en local** depuis ce pool
en **réutilisant le `StatsTab` existant** : `FriendStatsView` surcharge
`DrinksContext` / `SettingsContext` / `RatingsContext` (boissons + profil
de l'ami) puis monte `<StatsTab>`. **Aucune fonction de calcul n'est
dupliquée** — un ami passe par les mêmes `aggregateGeneral`,
`computeBACSessions`, `computeBacOverTime`, etc.

- Bus dédié `shareBus` (distinct de `dataBus`). Hooks : `useShare`,
  `useGroupMembers`, `useFavoriteFriend`, `useSharedDrinks`,
  `useSharedRatings`, `useFriendsBac`.
- Pas de socket : pull à l'ouverture + auto 10 min au premier plan +
  bouton « Rafraîchir ». Le « live » du BAC est un recalcul local
  (`useFriendsBac`, tick 60 s). **Sobriété données** : le pull est
  incrémental (cursor `share.cursor.<groupId>` sur `updated_at`) et la
  méta (profils + membres + `groups.created_by`) n'est demandée que sur
  la **première page** du drainage (`pullSince(cursor, { withMeta })`).
- **Watermark d'envoi** : `localDrinkToShared` publie TOUJOURS
  `updatedAt = Date.now()` (jamais le `updatedAt` du drink) — sinon une
  republication au re-join reste sous le cursor des autres membres et
  devient invisible à leur pull pour toujours. Même convention que les
  tombstones. La détection de delta locale reste `drink.updatedAt`
  (`share.pubindex`).
- **Cycle de vie du groupe** :
  - *Quitter* : `leave_group` (RPC) supprime MES lignes serveur ;
    `_resetGroupLocal()` purge l'état local (sharedPool, cursor, clés
    `share.*` de groupe, pubindex) sans toucher aux tables perso.
  - *Revenir* : `joinGroup` remet `share.pubindex` à zéro → `reconcile()`
    republie TOUT le catalogue local — « ses données le suivent ».
  - *Retirer quelqu'un* : RPC `remove_member(group, user)` — autorisé au
    **créateur** (`groups.created_by`), ou à **tout membre** si
    `created_by` est NULL ; le serveur purge drinks + profil +
    membership du retiré. UI : bouton sur la fiche ami (visible selon
    `shareState.creatorId`, le serveur re-vérifie), `Confirm.ask` danger.
  - *Chez les autres* : après chaque pull à liste de membres saine, le
    moteur **prune** du `sharedPool` les boissons d'auteurs absents de la
    liste (les DELETE serveur sont invisibles au pull incrémental).
  - *Être retiré* : un exclu reçoit 0 ligne SANS erreur (RLS) ; le moteur
    le détecte (`authUserId` confirmé + absent de `members`) → reset
    local + toast. `members: null` (requête échouée) ne déclenche RIEN —
    une erreur réseau n'est pas une exclusion.
  - Toute modification des droits/RPC passe par `supabase/schema.sql`
    (idempotent, à ré-exécuter intégralement dans SQL Editor).
- Transport derrière l'interface `ShareTransport` : `MockShareTransport`
  (amis fictifs Léa/Tom pour développer hors-ligne) ou
  `SupabaseShareTransport`. Choix dans **`js/share-config.js`** (édité à
  la main). La clé `anon`/`publishable` est publique (protégée par RLS) :
  OK à committer ; **jamais** la clé `service_role`.
- **Pastille favori** : un seul ami (qui partage son BAC) peut être mis
  en « favori » (étoile dans la liste / la fiche). Stocké en setting
  `share.favoriteId` ; `shareEngine.toggleFavorite(userId)` est une
  préférence **purement locale** (rien n'est publié au groupe).
  `HeaderBacStack` (friends.jsx, monté à droite du titre dans `AppHeader`)
  empile ma pastille (ambre) et celle du favori (`BacPill tone="good"`,
  verte) dans un **slot à hauteur fixe de 38 px** (= bouton menu) : la
  hauteur du header ne change JAMAIS. Seule, ma pastille garde sa taille
  normale ; à deux, les deux passent en variante `compact` de `BacPill`
  et `alignItems: stretch` aligne leurs largeurs. Les abonnements (tick
  BAC 60 s + shareBus) restent confinés à `HeaderBacStack`. **Résolution
  paresseuse** : si l'ami quitte le groupe la pastille disparaît sans
  effacer le choix ; seul `leaveGroup` purge `favoriteId`. Réutiliser
  `BacPill` (props `tone`/`compact`) pour toute nouvelle pastille —
  jamais de couleur en dur.

## Base de données & zéro perte de données

`js/database.js` (Dexie). **Règle d'or : ne JAMAIS perdre de données
utilisateur.**

- **Versions monotones & additives.** Ne jamais réutiliser ni baisser un
  numéro `version(n)`. Une migration **ajoute** (table / index) — elle ne
  drop / rename / réécrit jamais une table contenant des données. Un drop
  n'est toléré que sur une table **vide/orpheline** (cf. v4 qui supprime
  `bacRecords`, jamais écrite).
- **Snapshot avant toute étape destructive.** La migration v5 écrit
  d'abord un export complet v4 dans la table `backups`, **puis** seulement
  rétro-remplit les `uid`. Si l'`upgrade` jette, Dexie **annule** le bump
  (pas d'état à moitié migré). Reproduire ce schéma pour toute future
  migration qui touche des données.
- **`uid` stable par boisson** (`genUid`, rétro-rempli en v5) : identité
  globale pour le partage, indépendante de l'`++id` local.
- **`setSetting(key, null)` SUPPRIME la clé** (pas de valeur `null`
  fantôme). Les préférences partagées (`share.*`, dont `share.favoriteId`)
  suivent cette convention.
- `importData` / `clearAllData` ne touchent **que** les tables perso
  (`categories`, `drinks`, `settings`, `drinkRatings`) et sont
  **transactionnels** (rollback complet si échec). `sharedPool` /
  `shareOutbox` / `backups` ne sont pas wipés par là — `sharedPool` est
  dérivé/jetable (rechargé au pull, purgé au `leaveGroup`).
- **Ne pas casser le cache SW** : à chaque modif statique, bumper le triple
  `CACHE_NAME / STATIC_CACHE / DYNAMIC_CACHE` (+ `STATIC_FILES` si nouveau
  script), sinon les clients restent sur l'ancien build.

## Onglets persistants

Les 3 tabs (Catégories / Historique / Stats) ne sont **pas**
démontés au switch : ils restent dans le DOM avec
`display: none`. Seul le premier tab actif au lancement est monté
(le tab persisté en localStorage). Chaque tab visité ensuite reste
monté pour la session. Cela évite le coût de re-mount du StatsTab
(8 sections, plusieurs SVG charts) lors des allers-retours.

## Tests manuels avant push

- Add drink avec / sans prefill, chaque unité, chaque catégorie.
- **Recherche Catégories** : taper le « + » sur un résultat de recherche
  ajoute bien la boisson (régression historique).
- **Champs numériques** : qty, degré et poids ouvrent le pavé numérique ;
  la virgule **et** le point sont acceptés ; vider le champ ne laisse pas
  un « 0 » fantôme.
- **Créer une catégorie** (nom + icône) ; renommer ; doublon (casse /
  accent) refusé avec message avant mutation.
- **Déplacer une famille** via « Déplacer vers… » (fiche détail) et via
  « Modifier la boisson » : elle quitte l'ancienne catégorie et apparaît
  dans la nouvelle ; la fiche reste ouverte avec la nouvelle couleur.
- Edit d'une entrée : la famille doit rester (autres entrées
  intactes).
- Edit d'une famille : toutes les entrées migrées d'un coup.
- Suppression d'une entrée depuis le détail : si dernière, sheet se
  ferme ; sinon timeline mise à jour.
- Swipe gauche dans Historique → suppression.
- BAC : ajouter une bière maintenant et vérifier que la pilule
  d'en-tête monte, que la projection se courbe, que le scrubber suit
  le doigt.
- **BAC — deux épisodes** : une boisson la veille + une maintenant →
  le taux courant et la sobriété ne dépendent QUE de l'épisode en
  cours ; la projection démarre à l'épisode du soir. « Sobriété »
  juste après une boisson > `taux/150` (montée d'absorption comptée).
- **Prix intelligent** : saisir un prix sur Jupiler 25 cL, rouvrir
  l'ajout avec Jupiler 50 cL → champ prérempli au double (hint €/L
  affiché) ; modifier la quantité re-calcule ; taper un prix manuel
  puis changer la quantité ne l'écrase plus.
- **Sheets** : chaque fermeture (X, Annuler, succès, backdrop, Escape,
  Retour système) glisse vers sa sortie au lieu de disparaître sec ;
  aucune interaction possible pendant la sortie.
- Carte : un drink avec coordonnées doit apparaître ; sans coords,
  message vide.
- Tiroir paramètres : ouvre depuis la gauche, slide animé.
- FAB : à environ ~14 px du bord droit, ne déborde pas.
- **Amis — favori** : l'étoile n'apparaît que sur un ami qui partage son
  BAC ; la mettre affiche une pastille **verte compacte** sous la mienne
  dans la pile à droite du titre, **sans changer la hauteur du header**
  (slot fixe 38 px) ; un seul favori à la fois ; persiste au reload ;
  disparaît au « Quitter le groupe ».
- **Amis — stats** : ouvrir un ami recalcule ses stats via le même
  `StatsTab` ; un ami qui ne partage pas son BAC masque Sessions / Temps
  bourré / % bourré (pas de poids → pas de chiffre inventé).
- **Amis — retour** : la fiche ami pousse depuis la droite ; le geste
  retour système la referme (sortie vers la droite) ; un autre geste
  retour ramène à l'onglet Catégories ; répétable à volonté (jamais de
  rechargement de page ni de geste « mort »).

## Ce qu'il NE faut pas faire

- Ajouter de la logique business directement dans `proto/dist/*.js`
  (sera écrasé au prochain build).
- Bypass le service worker en cassant la liste de cache.
- Importer un nouveau bundler (ex. Vite, Webpack) sans en discuter —
  l'archi statique est volontaire pour Netlify.
- Pousser des secrets : pas de clés API, pas de tokens, jamais (la clé
  Supabase `anon` est l'exception publique ; **jamais** `service_role`).
- Faire écrire le moteur de partage dans les tables perso
  (`drinks/categories/ratings/settings`) : il n'écrit QUE dans
  `sharedPool` / `shareOutbox`.
- Baisser / réutiliser un numéro de version Dexie, ou drop une table
  pleine sans snapshot `backups` préalable (= risque de perte de données).

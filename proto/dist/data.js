/* AUTO-GENERATED from proto/data.jsx — do not edit by hand. */
// data.jsx — real data adapter (wraps the legacy IndexedDB layer in
// `js/database.js`). The proto components were originally fed by a static
// mock; here we expose React-friendly hooks that load from the real DB and
// re-render on writes.

const DEFAULT_CATEGORY_NAMES = ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre'];

// Canonical rating key — the single source of truth for associating a
// rating with a drink. Ratings live in the `drinkRatings` table keyed by
// name; normalizing (trim + lowercase) matches the name component of the
// `buildFamilies` grouping key so a family and its rating always align,
// and "Pilsner" / "pilsner" / "Pilsner " can never drift into separate,
// out-of-sync ratings. EVERY read and write of a rating goes through this.
function ratingKey(name) {
  return String(name == null ? '' : name).trim().toLowerCase();
}

// Bus -- listeners are notified when DB writes happen so any component can
// re-fetch. Each `bump(channel)` carries an optional channel name
// (`drinks` / `ratings` / `categories` / `settings`); subscribers may
// filter by channel via `useDataVersion(['drinks'])`. Calling `bump()`
// without a channel fans out to everyone (used by `clearAllData` and
// any legacy caller). Components should call `dataBus.bump(channel)`
// after writes; the channels prevent a rating write from forcing
// every drinks/categories/settings provider to re-fetch.
const dataBus = (() => {
  const subs = new Set();
  return {
    sub(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    bump(channel) {
      subs.forEach(fn => {
        try {
          fn(channel);
        } catch (e) {}
      });
    }
  };
})();
function useDataVersion(channels) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => dataBus.sub(ch => {
    // Channel-less bumps (clearAllData, legacy callers) fan out to
    // everyone. A subscriber with no `channels` arg also accepts all.
    if (channels && ch && !channels.includes(ch)) return;
    setV(x => x + 1);
  }), [channels && channels.join(',')]);
  return v;
}

// ── Wait for DB ──
async function waitForDb() {
  let tries = 0;
  while (!window.dbManager && tries < 80) {
    await new Promise(r => setTimeout(r, 50));
    tries++;
  }
  return window.dbManager;
}

// Seeds the 5 default categories ONCE per database, gated by the
// `cat._initialized` setting. Without that flag, we'd re-seed defaults
// every time the user emptied the categories table (e.g. after deleting
// the last remaining category), making it effectively impossible to
// fully clear the list.
//
// `_seedDone` short-circuits subsequent calls after a successful seed
// (or after we've confirmed via the flag that the seed is already
// done), avoiding a DB round-trip on every dataBus.bump. `_seedPromise`
// coalesces concurrent callers during the very first mount, and is
// cleared on failure so the next call retries instead of being stuck
// on a memoized no-op promise.
let _seedDone = false;
let _seedPromise = null;
async function _ensureDefaultCategories() {
  if (_seedDone) return;
  if (_seedPromise) return _seedPromise;
  _seedPromise = (async () => {
    try {
      const db = await waitForDb();
      if (!db) return;
      const flag = await db.getSetting('cat._initialized');
      if (flag) {
        _seedDone = true;
        return;
      }
      const existing = await db.getAllCategories();
      if (existing.length === 0) {
        for (const name of DEFAULT_CATEGORY_NAMES) {
          try {
            await db.addCategory({
              name
            });
          } catch (e) {}
        }
      }
      await db.setSetting('cat._initialized', true);
      _seedDone = true;
    } catch (e) {
      // swallow — caller is best-effort
    } finally {
      if (!_seedDone) _seedPromise = null;
    }
  })();
  return _seedPromise;
}

// ── Contexts for hoisted data ────────────────────────────────────
// App-level providers fetch once per dataBus.bump and broadcast to
// every child. Each `useX()` hook just reads its context — no per-
// consumer DB round-trip. Without an outer provider the default value
// is returned (empty list / empty map), which only matters during the
// transient ReactDOM bootstrap before <App/> commits.
const DrinksContext = React.createContext({
  drinks: [],
  loading: true
});
const RatingsContext = React.createContext({});
const CategoriesContext = React.createContext({
  categories: [],
  loading: true
});
const SettingsContext = React.createContext({});
// Families are derived from drinks + ratings — hoisted once at App
// level so HistoryTab / CategoriesTab / DrinkDetailSheet share the same
// memo instead of each rebuilding the grouping on every dataBus bump.
const FamiliesContext = React.createContext([]);

// Channels each provider listens to. Hoisted to module scope so the
// useDataVersion dep `channels.join(',')` stays a stable string and
// the effect doesn't re-subscribe on every render.
const _CH_DRINKS = ['drinks'];
const _CH_RATINGS = ['ratings'];
// Categories react to direct writes AND to renames that cascade into
// the drinks table — `drinkCount` per category is recomputed there.
const _CH_CATEGORIES = ['categories', 'drinks'];
const _CH_SETTINGS = ['settings'];
// Dedicated channel for category icon overrides. Used by
// CategoryIconsProvider — avoids re-fetching the entire settings table
// on every theme toggle or unrelated setting write.
const _CH_CAT_ICONS = ['cat-icons'];
// Dedicated channel for category color (hue) overrides, sibling of icons.
const _CH_CAT_COLORS = ['cat-colors'];
// Le provider d'apparence des catégories réagit aux deux canaux (icône +
// couleur) — un seul bump repeint la grille.
const _CH_CAT_APPEARANCE = ['cat-icons', 'cat-colors'];
// Settings-key prefix for id-based icon overrides: `cat.icon.id.<id>`.
const _ICON_ID_PREFIX = 'cat.icon.id.';
// Settings-key prefix for id-based color (hue 0-359) overrides.
const _COLOR_ID_PREFIX = 'cat.color.id.';

// Single DB fetch per relevant dataBus.bump. The four providers below
// each own one async load + one state cell; their children read via
// context. With per-channel subscriptions, a rating write no longer
// forces drinks/categories/settings to re-fetch — cuts the bump
// fan-out from 4 fetches to 1 in the common case.
function DrinksProvider({
  children
}) {
  const v = useDataVersion(_CH_DRINKS);
  const [state, setState] = React.useState({
    drinks: [],
    loading: true
  });
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const db = await waitForDb();
      if (!db) return;
      const list = await db.getAllDrinks();
      if (alive) setState({
        drinks: list,
        loading: false
      });
    })();
    return () => {
      alive = false;
    };
  }, [v]);
  return React.createElement(DrinksContext.Provider, {
    value: state
  }, children);
}
function RatingsProvider({
  children
}) {
  const v = useDataVersion(_CH_RATINGS);
  const [map, setMap] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const db = await waitForDb();
      if (!db) return;
      // Clean up any legacy non-canonical rows once, then read. The fold
      // below also guarantees a consistent map even before the migration
      // has run (or if it failed) — readers never see drifted keys.
      await canonicalizeRatings();
      const all = await db.getAllRatings();
      if (!alive) return;
      const out = {}; // canonical key → rating
      const at = {}; // canonical key → updatedAt (ms) for tie-breaks
      for (const r of all) {
        const k = ratingKey(r.drinkName);
        const t = +r.updatedAt || 0;
        // Newest write wins; if timestamps are absent/equal keep the
        // larger rating so a real score never loses to a stray 0.
        if (out[k] == null || t > at[k] || t === at[k] && (r.rating || 0) > (out[k] || 0)) {
          out[k] = r.rating;
          at[k] = t;
        }
      }
      setMap(out);
    })();
    return () => {
      alive = false;
    };
  }, [v]);
  return React.createElement(RatingsContext.Provider, {
    value: map
  }, children);
}
function CategoriesProvider({
  children
}) {
  const v = useDataVersion(_CH_CATEGORIES);
  const [state, setState] = React.useState({
    categories: [],
    loading: true
  });
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const db = await waitForDb();
      if (!db) return;
      await _ensureDefaultCategories();
      await migrateCategoryIconsToId();
      const list = await db.getAllCategories();
      if (alive) setState({
        categories: list,
        loading: false
      });
    })();
    return () => {
      alive = false;
    };
  }, [v]);
  return React.createElement(CategoriesContext.Provider, {
    value: state
  }, children);
}
function SettingsProvider({
  children
}) {
  const v = useDataVersion(_CH_SETTINGS);
  const [s, setS] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const out = await loadSettings();
      if (alive) setS(out);
    })();
    return () => {
      alive = false;
    };
  }, [v]);
  return React.createElement(SettingsContext.Provider, {
    value: s
  }, children);
}
function useCategories() {
  return React.useContext(CategoriesContext);
}
function useDrinks() {
  return React.useContext(DrinksContext);
}
function useRatings() {
  return React.useContext(RatingsContext);
}
function useFamilies() {
  return React.useContext(FamiliesContext);
}
// ── Family aggregation ───────────────────────────────────────────
// A "family" groups distinct drinks by (name + quantity + unit + alcohol).
// Each family carries a sorted entries list (newest first) and aggregate
// counts for the UI.
// Clé d'identité d'une famille : (nom + quantité + unité + degré), catégorie
// EXCLUE (déplacer une famille de catégorie garde la même clé). Source unique,
// partagée par buildFamilies / familyPriceKey / le prédicat sameFamily.
function familyKey(name, quantity, unit, alcohol) {
  return `${(name || '').trim().toLowerCase()}::${quantity}::${(unit || '').toLowerCase()}::${alcohol || 0}`;
}
function buildFamilies(drinks, ratings = {}, priceRefs = {}) {
  const map = new Map();
  for (const d of drinks) {
    const key = familyKey(d.name, d.quantity, d.unit, d.alcoholContent);
    if (!map.has(key)) {
      map.set(key, {
        id: 'fam::' + key,
        name: d.name,
        category: d.category || 'Autre',
        quantity: d.quantity,
        unit: d.unit,
        alcohol: d.alcoholContent || 0,
        rating: ratings[ratingKey(d.name)] || 0,
        // Prix de référence stocké (setting `price.ref.<clé>`) repris par le
        // « + » et « Ajouter à nouveau ». À défaut, on retombe (plus bas) sur
        // le prix de l'entrée la plus récente qui en porte un.
        referencePrice: priceRefs[key] != null ? priceRefs[key] : null,
        entries: []
      });
    }
    const f = map.get(key);
    f.entries.push({
      id: d.id,
      ts: `${d.date}T${d.time || '00:00'}`,
      place: drinkPlaceLabel(d),
      raw: d
    });
  }
  for (const f of map.values()) {
    f.entries.sort((a, b) => b.ts.localeCompare(a.ts));
    if (f.referencePrice == null) {
      // Fallback : la dernière entrée NON personnalisée qui porte un prix
      // (un prix perso ne doit pas devenir la référence implicite de la famille).
      const priced = f.entries.find(e => e.raw && e.raw.price != null && !e.raw.priceIsCustom);
      if (priced) f.referencePrice = priced.raw.price;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.entries.length - a.entries.length);
}

// True quand un drink brut appartient à `family` : même tuple d'identité que la
// clé de `buildFamilies` (name + quantity + unit + abv, catégorie exclue).
// Source unique du prédicat, partagé par `updateFamily` et `deleteFamily`.
function sameFamily(drink, family) {
  return (drink.name || '').trim().toLowerCase() === (family.name || '').trim().toLowerCase() && drink.quantity === family.quantity && (drink.unit || '').toLowerCase() === (family.unit || '').toLowerCase() && (drink.alcoholContent || 0) === (family.alcohol || 0);
}

// Stats per category
function computeCategoryStats(categories, families) {
  // Index by canonical name so a drink whose category string differs only
  // by whitespace/accent-normalization folds into its real category row
  // instead of spawning a duplicate "synthetic" card. A genuinely unknown
  // category (no matching row) still gets a synthetic entry.
  const byKey = new Map();
  for (const c of categories) {
    byKey.set(canonicalCat(c.name), {
      id: c.id,
      name: c.name,
      families: 0,
      entries: 0
    });
  }
  for (const f of families) {
    const key = canonicalCat(f.category);
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: 'cat-' + f.category,
        name: f.category,
        families: 0,
        entries: 0
      });
    }
    const e = byKey.get(key);
    e.families += 1;
    e.entries += f.entries.length;
  }
  return Array.from(byKey.values()).sort((a, b) => b.entries - a.entries);
}

// Flat entries list for History tab
function flattenEntries(families) {
  const out = [];
  for (const f of families) {
    for (const e of f.entries) {
      out.push({
        ...e,
        family: f
      });
    }
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts));
}
// ── Settings (weight, gender, theme) ──────────────────────────────
async function loadSettings() {
  const db = await waitForDb();
  if (!db) return {};
  return await db.getAllSettings();
}
async function saveSetting(key, value) {
  const db = await waitForDb();
  if (!db) return;
  await db.setSetting(key, value);
  dataBus.bump('settings');
}

// ── Prix de référence par famille ─────────────────────────────────
// Le prix d'UNE entrée vit sur le drink (`drink.price`). Le prix de
// RÉFÉRENCE (repris par le « + » / « Ajouter à nouveau ») est stocké en
// settings sous `price.ref.<clé famille>` (clé = nom+qté+unité+degré, stable
// au changement de catégorie). `value == null` SUPPRIME la clé
// (setSetting(null), cf. convention « zéro perte »).
const PRICE_REF_PREFIX = 'price.ref.';
function familyPriceKey(family) {
  const abv = family.alcohol != null ? family.alcohol : family.alcoholContent;
  return PRICE_REF_PREFIX + familyKey(family.name, family.quantity, family.unit, abv);
}
// Extrait { clé famille → prix } depuis la map settings, pour la passer à
// buildFamilies (chaque famille reçoit alors son `referencePrice`).
function priceRefsFromSettings(settings) {
  const out = {};
  if (!settings) return out;
  for (const k in settings) {
    if (k.indexOf(PRICE_REF_PREFIX) === 0) {
      const v = Number(settings[k]);
      if (Number.isFinite(v)) out[k.slice(PRICE_REF_PREFIX.length)] = v;
    }
  }
  return out;
}
async function setReferencePrice(family, value) {
  const n = Number(value);
  const ok = value != null && value !== '' && Number.isFinite(n);
  await saveSetting(familyPriceKey(family), ok ? n : null);
}

// ── Prix intelligent ──────────────────────────────────────────────
// Les familles homonymes (même nom, contenants différents — « différentes
// Jupiler ») partagent un prix AU LITRE : la première boisson tarifée impose
// le €/L, toute autre quantité est suggérée au prorata, arrondie au centime.
// Sélection de la source, par priorité :
//   1. même contenant (volume identique en cL) ET même degré → son prix de
//      référence TEL QUEL (pas de re-arrondi) ;
//   2. même contenant ; 3. même degré ; 4. n'importe quelle homonyme —
//   à rang égal, la famille tarifée la plus ANCIENNE gagne (« la première
//   boisson mise impose le prix par litre »).
// Retourne { price, perLiter, exact, source } ou null (aucune référence).
function suggestPriceForVolume(families, name, volCl, alcohol) {
  const key = (name || '').trim().toLowerCase();
  if (!key || !(volCl > 0)) return null;
  const cands = [];
  for (const f of families || []) {
    if ((f.name || '').trim().toLowerCase() !== key) continue;
    const ref = Number(f.referencePrice);
    if (f.referencePrice == null || !Number.isFinite(ref) || ref < 0) continue;
    const vol = toCl(f.quantity, f.unit);
    if (!(vol > 0)) continue;
    cands.push({
      f,
      vol,
      ref,
      // entries triées du plus récent au plus ancien → le dernier élément
      // est la première entrée jamais saisie pour cette famille.
      firstTs: f.entries && f.entries.length ? f.entries[f.entries.length - 1].ts : ''
    });
  }
  if (cands.length === 0) return null;
  const abv = alcohol == null ? null : alcohol || 0;
  const rank = c => {
    const exactVol = Math.abs(c.vol - volCl) < 1e-9;
    const sameAbv = abv == null || (c.f.alcohol || 0) === abv;
    return exactVol && sameAbv ? 0 : exactVol ? 1 : sameAbv ? 2 : 3;
  };
  cands.sort((a, b) => rank(a) - rank(b) || a.firstTs.localeCompare(b.firstTs));
  const src = cands[0];
  const exact = Math.abs(src.vol - volCl) < 1e-9;
  const perCl = src.ref / src.vol;
  const price = exact ? src.ref : Math.round(perCl * volCl * 100) / 100;
  if (!Number.isFinite(price)) return null;
  return {
    price,
    perLiter: Math.round(perCl * 100 * 100) / 100,
    exact,
    source: {
      name: src.f.name,
      quantity: src.f.quantity,
      unit: src.f.unit,
      referencePrice: src.ref
    }
  };
}
function useSettings() {
  return React.useContext(SettingsContext);
}

// ── Mutations ─────────────────────────────────────────────────────
// Each mutation bumps only the channels its write actually touches —
// providers subscribed to other channels won't refetch. updateDrink
// and friends bump 'drinks' (the row table) AND 'categories' when the
// category field changes, because the legacy DB layer recomputes
// `drinkCount` on the affected categories.
async function addDrink(payload) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.addDrink(payload);
  dataBus.bump('drinks');
  // addDrink updates the target category's drinkCount.
  dataBus.bump('categories');
  return r;
}
async function updateDrink(id, updates) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.updateDrink(id, updates);
  dataBus.bump('drinks');
  // Category drinkCount is recomputed when `category` changes; safest
  // to always bump (cheap) so the categories grid stays accurate.
  dataBus.bump('categories');
  return r;
}
async function deleteDrink(id) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.deleteDrink(id);
  dataBus.bump('drinks');
  dataBus.bump('categories');
  return r;
}

// Always writes under the canonical key so a rating set from any view
// (add / detail / edit-entry / edit-family) lands on the same row and
// stays in sync everywhere.
async function saveRating(drinkName, rating) {
  const db = await waitForDb();
  if (!db) return;
  await db.setRating(ratingKey(drinkName), rating);
  dataBus.bump('ratings');
}

// One-time cleanup of legacy rating rows stored under non-canonical
// names ("Pilsner" vs "pilsner " …). Folds duplicates to a single
// canonical row (freshest updatedAt wins, else the higher score), then
// drops the stragglers. Idempotent and best-effort — gated by both a
// module flag and a persisted setting, mirroring migrateCategoryIconsToId.
// Correctness does not depend on it (RatingsProvider folds on read); it
// just keeps the table clean.
let _ratingCanonDone = false;
let _ratingCanonPromise = null;
async function canonicalizeRatings() {
  if (_ratingCanonDone) return;
  if (_ratingCanonPromise) return _ratingCanonPromise;
  _ratingCanonPromise = (async () => {
    try {
      const db = await waitForDb();
      if (!db) return;
      if (await db.getSetting('rating._canonicalized')) {
        _ratingCanonDone = true;
        return;
      }
      const all = await db.getAllRatings();
      const best = new Map(); // canonical key → { rating, at }
      for (const r of all) {
        const k = ratingKey(r.drinkName);
        const at = +r.updatedAt || 0;
        const cur = best.get(k);
        if (!cur || at > cur.at || at === cur.at && (r.rating || 0) > cur.rating) {
          best.set(k, {
            rating: r.rating,
            at
          });
        }
      }
      // Write the folded canonical rows FIRST, then drop the
      // non-canonical stragglers. Doing it in this order means a partial
      // failure (or the page closing mid-migration) can never lose a
      // rating: the canonical row is already persisted before its source
      // row is removed, and the flag stays unset so the next mount retries
      // the leftover deletes. Freshly-written canonical rows also carry a
      // newer updatedAt, so fold-on-read prefers them over any orphan.
      for (const [k, val] of best) {
        try {
          await db.setRating(k, val.rating);
        } catch (e) {}
      }
      for (const r of all) {
        if (r.drinkName !== ratingKey(r.drinkName)) {
          try {
            await db.deleteRating(r.drinkName);
          } catch (e) {}
        }
      }
      await db.setSetting('rating._canonicalized', true);
      _ratingCanonDone = true;
    } catch (e) {
      // best-effort; retry on next mount
    } finally {
      if (!_ratingCanonDone) _ratingCanonPromise = null;
    }
  })();
  return _ratingCanonPromise;
}
async function addCategory(name) {
  const db = await waitForDb();
  if (!db) return;
  const r = await db.addCategory({
    name
  });
  dataBus.bump('categories');
  return r;
}
async function renameCategory(oldName, newName) {
  const db = await waitForDb();
  if (!db) throw new Error('Base de données indisponible');
  await db.renameCategory(oldName, newName);
  // Icon overrides are keyed by the immutable category id, so a rename
  // needs no icon migration: the id↔glyph mapping is untouched and the
  // grid repaints from the refreshed categories list (the icon provider
  // re-joins id→name on the 'categories' bump below).
  dataBus.bump('categories');
  dataBus.bump('drinks');
}
async function deleteCategory(id, options = {}) {
  const db = await waitForDb();
  if (!db) throw new Error('Base de données indisponible');
  // Resolve the category first — without it we can't fetch its drinks
  // or clean up its icon override. Refusing here surfaces stale ids
  // (e.g. the row vanished between the user opening the sheet and
  // tapping Delete) instead of pressing on with a half-broken delete.
  const cat = await db.getCategoryById(id);
  if (!cat) throw new Error('Catégorie introuvable');

  // Use the real drinks count from the DB, not the cached drinkCount
  // on the category row — that counter can drift out of sync if drinks
  // were added through a legacy code path that skipped
  // updateCategoryDrinkCount. The EditCategorySheet shows the user the
  // count it read from the cache; we authoritatively re-check here so a
  // stale 0 doesn't let us call db.deleteCategory on a non-empty
  // category (which would throw "Impossible de supprimer une catégorie
  // qui contient des boissons").
  const drinksOfCat = await db.getDrinksByCategory(cat.name);
  if (drinksOfCat.length > 0) {
    if (!options.reassignTo) {
      throw new Error('Cette catégorie contient des boissons. Veuillez d\'abord les déplacer.');
    }
    for (const d of drinksOfCat) {
      await db.updateDrink(d.id, {
        category: options.reassignTo
      });
    }
    // Re-sync the cached counter so the legacy delete path sees zero.
    await db.updateCategoryDrinkCount(cat.name);
  }
  await db.deleteCategory(id);

  // Drop the id-keyed icon override. A future category reusing the same
  // name gets a fresh id, so it correctly does NOT inherit this glyph.
  await db.setSetting(`${_ICON_ID_PREFIX}${id}`, null);
  dataBus.bump('categories');
  if (drinksOfCat.length > 0) dataBus.bump('drinks');
  dataBus.bump('cat-icons');
}

// ── Category icon overrides ───────────────────────────────────────
// Custom glyphs are persisted as `cat.icon.<name>` settings. The
// CategoryIconsProvider below owns the in-memory map and broadcasts
// it via CategoryIconsContext — every <CategoryGlyph> reads from the
// context, so a single dataBus subscription refreshes every glyph in
// the tree without each instance owning its own subscription.
async function loadCategoryIcons() {
  const db = await waitForDb();
  if (!db) return {};
  const settings = await db.getAllSettings();
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    if (k.startsWith(_ICON_ID_PREFIX) && v) {
      const id = Number(k.slice(_ICON_ID_PREFIX.length));
      // `Number('')` is 0 (not NaN), so an empty/whitespace suffix would
      // otherwise claim category id 0. Dexie `++id` starts at 1, so only
      // accept a positive integer id.
      if (Number.isInteger(id) && id > 0) out[id] = v;
    }
  }
  return out;
}

// One-time migration of legacy name-keyed overrides (`cat.icon.<name>`)
// to the id-keyed format (`cat.icon.id.<id>`). Idempotent: gated by both
// a module flag and a persisted `cat._iconMigratedToId` setting, so it is
// a cheap no-op after the first successful run. Orphan legacy keys (whose
// name no longer matches any category) are dropped — they could never
// resolve under the old scheme either.
let _iconMigrateDone = false;
let _iconMigratePromise = null;
async function migrateCategoryIconsToId() {
  if (_iconMigrateDone) return;
  if (_iconMigratePromise) return _iconMigratePromise;
  _iconMigratePromise = (async () => {
    try {
      const db = await waitForDb();
      if (!db) return;
      if (await db.getSetting('cat._iconMigratedToId')) {
        _iconMigrateDone = true;
        return;
      }
      const settings = await db.getAllSettings();
      const cats = await db.getAllCategories();
      const byCanon = new Map();
      for (const c of cats) byCanon.set(canonicalCat(c.name), c.id);
      // First legacy key wins deterministically if two names collapse to
      // the same id (e.g. "Bière" and "Bière ") — `claimed` guards against
      // a later one overwriting it.
      const claimed = new Set();
      for (const k of Object.keys(settings)) {
        if (!k.startsWith('cat.icon.') || k.startsWith(_ICON_ID_PREFIX)) continue;
        const glyph = settings[k];
        const id = byCanon.get(canonicalCat(k.slice('cat.icon.'.length)));
        if (id != null && glyph) {
          const idKey = `${_ICON_ID_PREFIX}${id}`;
          if (settings[idKey] == null && !claimed.has(id)) {
            await db.setSetting(idKey, glyph);
            claimed.add(id);
          }
        }
        await db.setSetting(k, null);
      }
      await db.setSetting('cat._iconMigratedToId', true);
      _iconMigrateDone = true;
    } catch (e) {
      // best-effort; retry on next mount
    } finally {
      if (!_iconMigrateDone) _iconMigratePromise = null;
    }
  })();
  return _iconMigratePromise;
}

// Throws on any failure so the EditCategorySheet's catch block can
// surface a real error message instead of silently displaying "mis à
// jour" when the write never made it to disk. Three failure modes are
// covered: DB never initialized, Dexie returning falsy from setSetting
// (its current contract on quota / serialization errors), or anything
// else thrown up the stack.
async function setCategoryIcon(id, glyph) {
  const db = await waitForDb();
  if (!db) throw new Error('Base de données indisponible');
  if (id == null || id === '') throw new Error('Catégorie invalide');
  const ok = await db.setSetting(`${_ICON_ID_PREFIX}${id}`, glyph || null);
  if (ok === false) throw new Error('Échec de la sauvegarde de l\'icône');
  dataBus.bump('cat-icons');
}

// id → hue (0-359), persisté en `cat.color.id.<id>`. Miroir exact de
// loadCategoryIcons : même garde d'id positif, valeurs parsées en entier.
async function loadCategoryColors() {
  const db = await waitForDb();
  if (!db) return {};
  const settings = await db.getAllSettings();
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    if (k.startsWith(_COLOR_ID_PREFIX) && v != null && v !== '') {
      const id = Number(k.slice(_COLOR_ID_PREFIX.length));
      const hue = Number(v);
      if (Number.isInteger(id) && id > 0 && Number.isFinite(hue)) {
        out[id] = (Math.round(hue) % 360 + 360) % 360;
      }
    }
  }
  return out;
}

// Surcharge de teinte d'une catégorie (id-keyée, donc rename-safe comme les
// icônes). `hue == null` SUPPRIME la clé → retour à la teinte par défaut/hash
// (option « Auto »). Throw en cas d'échec d'écriture (même contrat que
// setCategoryIcon) pour que EditCategorySheet affiche une vraie erreur.
async function setCategoryColor(id, hue) {
  const db = await waitForDb();
  if (!db) throw new Error('Base de données indisponible');
  if (id == null || id === '') throw new Error('Catégorie invalide');
  const val = hue == null || !Number.isFinite(Number(hue)) ? null : String((Math.round(Number(hue)) % 360 + 360) % 360);
  const ok = await db.setSetting(`${_COLOR_ID_PREFIX}${id}`, val);
  if (ok === false) throw new Error('Échec de la sauvegarde de la couleur');
  dataBus.bump('cat-colors');
}

// Provider for category icon overrides. Seeds initial state from the
// optional one-shot global `window.__alcoCatIconsInitial` (populated
// by mountAlcoNote before the React mount, read exactly once at the
// useState initializer) so the first paint already shows custom
// glyphs — no flash of default icons. Subsequent updates come from
// the DB on every bump('cat-icons').
function CategoryIconsProvider({
  children
}) {
  const v = useDataVersion(_CH_CAT_APPEARANCE);
  const {
    categories
  } = useCategories();
  // id → glyph, persisted as `cat.icon.id.<id>`. Seeded once from the boot
  // preload (window.__alcoCatIconsInitial) to avoid a flash of default
  // glyphs, then refreshed from the DB on every dataBus.bump('cat-icons').
  const [idMap, setIdMap] = React.useState(() => {
    if (typeof window === 'undefined') return {};
    const seed = window.__alcoCatIconsInitial;
    return seed && typeof seed === 'object' ? seed : {};
  });
  // id → hue (0-359), persisted as `cat.color.id.<id>`. Same boot-preload
  // pattern so the first paint already shows custom hues (no flash).
  const [colorMap, setColorMap] = React.useState(() => {
    if (typeof window === 'undefined') return {};
    const seed = window.__alcoCatColorsInitial;
    return seed && typeof seed === 'object' ? seed : {};
  });
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [icons, colors] = await Promise.all([loadCategoryIcons(), loadCategoryColors()]);
        if (alive) {
          setIdMap(icons);
          setColorMap(colors);
        }
      } catch {
        if (alive) {
          setIdMap({});
          setColorMap({});
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [v]);
  // Join id→glyph with the live id→name list so <CategoryGlyph> keeps its
  // name-based API. Keyed by canonicalCat(name); recomputes whenever the
  // categories list changes (e.g. after a rename) — so renames repaint with
  // zero stored icon migration since the id↔glyph mapping never moves.
  const map = React.useMemo(() => {
    const out = {};
    for (const c of categories) {
      const g = idMap[c.id];
      if (g) out[canonicalCat(c.name)] = g;
    }
    return out;
  }, [idMap, categories]);
  // name → hue, joined the same way; consumed by EditCategorySheet to seed
  // the slider. The actual card repaint goes through `CAT` (mutated below),
  // not this context.
  const colorByName = React.useMemo(() => {
    const out = {};
    for (const c of categories) {
      const hue = colorMap[c.id];
      if (hue != null) out[canonicalCat(c.name)] = hue;
    }
    return out;
  }, [colorMap, categories]);
  // Apply the hue overrides to the module `CAT` registry. `useMemo` runs
  // DURING render (before children paint) so the very first frame — seeded
  // from the boot preload — already shows custom hues without a flash.
  // applyCatHueOverrides is idempotent and resets to defaults first, so a
  // removed override falls back to the default/hash hue.
  React.useMemo(() => {
    applyCatHueOverrides(colorByName);
    return null;
  }, [colorByName]);
  return React.createElement(CategoryColorsContext.Provider, {
    value: colorByName
  }, React.createElement(CategoryIconsContext.Provider, {
    value: map
  }, children));
}

// Apply same updates to every drink that shares (name + qty + unit + abv)
async function updateFamily(family, updates) {
  const db = await waitForDb();
  if (!db) return;
  const all = await db.getAllDrinks();
  const matches = all.filter(d => sameFamily(d, family));
  for (const m of matches) {
    await db.updateDrink(m.id, updates);
  }
  dataBus.bump('drinks');
  // Category drinkCount may shift when `category` is part of `updates`.
  dataBus.bump('categories');
}

// Cascade un nouveau prix de référence sur les entrées de la famille qui sont
// AU PRIX DE RÉFÉRENCE (`!priceIsCustom`) — les prix personnalisés ne sont
// JAMAIS touchés. Utilisé par EditFamilySheet quand l'utilisateur choisit
// « appliquer aux boissons existantes » (inclut les entrées sans prix).
async function applyReferenceToFamily(family, value) {
  const db = await waitForDb();
  if (!db) return;
  const n = Number(value);
  const ok = value != null && value !== '' && Number.isFinite(n);
  const all = await db.getAllDrinks();
  const matches = all.filter(d => sameFamily(d, family) && !d.priceIsCustom);
  for (const m of matches) {
    await db.updateDrink(m.id, {
      price: ok ? n : null
    });
  }
  dataBus.bump('drinks');
  dataBus.bump('categories');
}

// CONTRACT CHANGE (v3.5.0): now returns `{ count, snapshot }` instead of
// `Promise<number>` so callers can wire an undo path. Update every
// caller when modifying the shape — the legacy `js/app.js` does NOT
// invoke this function, only the proto layer does.
async function deleteFamily(family) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const all = await db.getAllDrinks();
  const matches = all.filter(d => sameFamily(d, family));
  // Capture full row state BEFORE deletion so we can re-add on undo.
  const snapshot = matches.map(m => ({
    ...m
  }));
  for (const m of matches) {
    await db.deleteDrink(m.id);
  }
  dataBus.bump('drinks');
  dataBus.bump('categories');
  return {
    count: matches.length,
    snapshot
  };
}

// Bulk re-add — used by the undo path of `deleteFamily` and
// `deleteDrinkWithSnapshot`. Each restored drink gets a fresh
// auto-incremented id (Dexie `++id`); the original ids are gone, so any
// outside reference (e.g. a localStorage cache pinning a specific id)
// will miss after undo. Sequential awaits are intentional — `addDrink`
// internally calls `updateCategoryDrinkCount`, which races with itself
// on parallel inserts to the same category.
async function restoreDrinks(drinks) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  for (const d of drinks) {
    const {
      id,
      createdAt,
      updatedAt,
      quantityInCL,
      ...payload
    } = d;
    await db.addDrink(payload);
  }
  dataBus.bump('drinks');
  dataBus.bump('categories');
}

// Single-drink delete that returns the original row, so callers can
// pass it straight to `restoreDrinks([row])` from the undo button.
// `getDrinkById` is read first to make the snapshot complete; if a
// concurrent writer already removed the row we surface a clear error
// instead of returning `undefined`.
async function deleteDrinkWithSnapshot(id) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const row = await db.getDrinkById(id);
  if (!row) throw new Error('Boisson introuvable');
  await db.deleteDrink(id);
  dataBus.bump('drinks');
  dataBus.bump('categories');
  return row;
}

// Wipe entire database (drinks, categories, settings). Caller is
// responsible for collecting an explicit user confirmation. The seed
// memoization is reset so the next load re-seeds defaults exactly once
// on the empty DB. The icon Provider re-reads the empty settings table
// on the bump below.
async function clearAllData() {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.clearAllData();
  _seedDone = false;
  _seedPromise = null;
  _iconMigrateDone = false;
  _iconMigratePromise = null;
  _ratingCanonDone = false;
  _ratingCanonPromise = null;
  dataBus.bump('cat-icons');
  dataBus.bump();
  return r;
}

// ── Géolocalisation ───────────────────────────────────────────────
// Capture optionnelle de la position au moment de l'ajout/édition d'une
// boisson, pour alimenter la carte des lieux (StatsTab › MapSection).
// L'objet renvoyé ({ latitude, longitude, accuracy, address, capturedAt })
// est stocké tel quel dans `drink.location`. Toute lecture de coordonnées
// ou de libellé passe par `getDrinkCoords` / `drinkPlaceLabel` ci-dessous —
// source unique, qui gère aussi l'ancien format à plat (drink.latitude/…).

// Coordonnées normalisées d'une boisson → { lat, lng } finis ou null.
// Gère le format imbriqué (drink.location.latitude/longitude) ET l'ancien
// format à plat (drink.latitude/longitude) sans accès non sûr.
function getDrinkCoords(d) {
  if (!d) return null;
  const loc = d.location || null;
  // Conversion stricte : Number('48.8abc') → NaN là où parseFloat acceptait
  // le préfixe ; null / '' / blancs → NaN aussi (Number(null) vaudrait 0).
  const num = v => v == null || String(v).trim() === '' ? NaN : Number(v);
  const lat = num(d.latitude != null ? d.latitude : loc ? loc.latitude : undefined);
  const lng = num(d.longitude != null ? d.longitude : loc ? loc.longitude : undefined);
  return Number.isFinite(lat) && Number.isFinite(lng) ? {
    lat,
    lng
  } : null;
}

// Libellé de lieu lisible : libellé saisi (label/name) prioritaire, sinon
// l'adresse géocodée. null si la boisson n'a pas de lieu lisible.
function drinkPlaceLabel(d) {
  const loc = d && d.location;
  if (!loc) return null;
  return loc.label || loc.name || loc.address || null;
}
const GEO_CONSENT_KEY = 'alconote.geoConsent';
function getGeoConsent() {
  try {
    return localStorage.getItem(GEO_CONSENT_KEY) || null;
  } catch {
    return null;
  }
}
function setGeoConsent(state) {
  try {
    if (state) localStorage.setItem(GEO_CONSENT_KEY, state);else localStorage.removeItem(GEO_CONSENT_KEY);
  } catch {}
}

// Consentement applicatif demandé une seule fois (puis mémorisé), pour
// ne pas reposer la question à chaque ajout. La permission définitive
// reste gérée par l'invite native du navigateur, à l'acquisition.
// `_geoConsentPromise` déduplique deux ajouts rapprochés pour éviter
// d'empiler deux dialogues.
let _geoConsentPromise = null;
async function ensureGeoConsent() {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return false;
  const stored = getGeoConsent();
  if (stored === 'granted') return true;
  if (stored === 'denied') return false;
  if (_geoConsentPromise) return _geoConsentPromise;
  _geoConsentPromise = (async () => {
    const ok = await Confirm.ask({
      title: 'Géolocaliser vos consommations ?',
      message: 'AlcoNote peut enregistrer le lieu de chaque consommation pour les afficher sur une carte. La position ne quitte pas votre appareil. Demandé une seule fois.',
      confirmText: 'Autoriser',
      cancelText: 'Non merci'
    });
    if (!ok) {
      setGeoConsent('denied');
      return false;
    }
    return true;
  })();
  try {
    return await _geoConsentPromise;
  } finally {
    _geoConsentPromise = null;
  }
}
function getPosition(timeout = 10000) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout,
      maximumAge: 60000
    });
  });
}

// Reverse-geocoding Nominatim → libellé lisible (rue, ville). Les
// requêtes sont mises en cache par le service worker
// (cf. sw.js › handleNominatimRequest).
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });
  if (!res.ok) throw new Error('reverse geocode failed');
  const data = await res.json();
  const a = data.address || {};
  const parts = [];
  if (a.house_number && a.road) parts.push(`${a.house_number} ${a.road}`);else if (a.road) parts.push(a.road);
  const city = a.city || a.town || a.village || a.municipality;
  if (city) parts.push(city);
  return parts.join(', ') || data.display_name || null;
}

// Reverse-geocode borné dans le temps + 1 retry, ne jette jamais. Le timeout
// précédent (4 s) laissait trop souvent l'adresse à `null` sur réseau lent —
// d'où des boissons sans libellé. On laisse plus de temps et on réessaie une
// fois ; on garde toujours les coordonnées même si le libellé n'arrive pas.
async function reverseGeocodeReliable(lat, lng, {
  timeout = 9000,
  retries = 1
} = {}) {
  for (let i = 0; i <= retries; i++) {
    try {
      const addr = await Promise.race([reverseGeocode(lat, lng), new Promise((_, rej) => setTimeout(() => rej(new Error('geocode timeout')), timeout))]);
      if (addr) return addr;
    } catch {}
    if (i < retries) await new Promise(r => setTimeout(r, 800));
  }
  return null;
}

// Dernière position GPS connue (récente), pour ne pas perdre le lieu sur un
// timeout ponctuel d'un ajout rapide.
let _lastPosition = null;

// Acquiert la position courante pour l'attacher à une boisson. Retourne
// { latitude, longitude, accuracy, address } ou null (refus, indispo,
// timeout sans position de repli).
async function captureLocationForDrink() {
  try {
    if (!(await ensureGeoConsent())) return null;
    let pos;
    try {
      pos = await getPosition();
    } catch (e) {
      if (e && e.code === 1 /* PERMISSION_DENIED */) {
        setGeoConsent('denied');
        return null;
      }
      // Timeout / indispo ponctuel : repli sur la dernière position connue
      // (< 2 min) plutôt que de perdre le lieu.
      if (_lastPosition && Date.now() - _lastPosition.at < 120000) pos = _lastPosition.pos;else return null;
    }
    setGeoConsent('granted');
    _lastPosition = {
      pos,
      at: Date.now()
    };
    const {
      latitude,
      longitude,
      accuracy
    } = pos.coords;
    const address = await reverseGeocodeReliable(latitude, longitude);
    return {
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      address,
      capturedAt: Date.now()
    };
  } catch {
    return null;
  }
}

// Capture la position et l'attache à un drink DÉJÀ créé. Module-scope : la
// promesse n'est pas liée au cycle de vie d'un composant, donc elle aboutit
// même si la feuille d'ajout se ferme entre-temps. Utilisée par l'ajout via
// feuille ET l'ajout rapide (« + »).
async function attachLocationToDrink(drinkId) {
  if (drinkId == null) return;
  try {
    const loc = await captureLocationForDrink();
    if (loc) await updateDrink(drinkId, {
      location: loc
    });
  } catch {}
}

// Filet de sécurité « plus jamais d'adresse manquante » : complète en
// arrière-plan les adresses des boissons qui ont déjà des coordonnées mais
// pas de libellé (échec/timeout du reverse-geocode au moment de l'ajout).
// Espacé (~1.1 s) pour respecter la politique Nominatim, plafonné, et lancé
// une seule fois par session (idle au lancement). N'acquiert AUCUNE position
// GPS — il ne fait que rattraper le libellé de coordonnées déjà consenties.
let _backfillRan = false;
async function backfillMissingAddresses({
  cap = 25,
  spacingMs = 1100
} = {}) {
  if (_backfillRan) return;
  _backfillRan = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      _backfillRan = false;
      return;
    }
    const db = await waitForDb();
    if (!db) return;
    const all = await db.getAllDrinks();
    const targets = [];
    for (const d of all) {
      const c = getDrinkCoords(d);
      const loc = d.location || null;
      if (c && loc && (loc.address == null || loc.address === '')) targets.push({
        d,
        c
      });
      if (targets.length >= cap) break;
    }
    let changed = false;
    for (const {
      d,
      c
    } of targets) {
      let address = null;
      try {
        address = await reverseGeocodeReliable(c.lat, c.lng, {
          timeout: 9000,
          retries: 0
        });
      } catch {}
      if (address) {
        // Écriture directe (db.updateDrink ne bump pas) : un seul bump à la fin.
        await db.updateDrink(d.id, {
          location: {
            ...(d.location || {}),
            latitude: c.lat,
            longitude: c.lng,
            address
          }
        });
        changed = true;
      }
      await new Promise(r => setTimeout(r, spacingMs));
    }
    if (changed) dataBus.bump('drinks');
  } catch {
    // best-effort
  }
}
Object.assign(window, {
  dataBus,
  waitForDb,
  useCategories,
  useDrinks,
  useRatings,
  useSettings,
  useFamilies,
  FamiliesContext,
  // Exposed so the friends feature can re-render the existing StatsTab for
  // another member by overriding these contexts with that member's shared
  // data (see proto/friends.jsx › FriendStatsView).
  DrinksContext,
  RatingsContext,
  SettingsContext,
  CategoriesContext,
  DrinksProvider,
  RatingsProvider,
  CategoriesProvider,
  SettingsProvider,
  CategoryIconsProvider,
  buildFamilies,
  sameFamily,
  computeCategoryStats,
  flattenEntries,
  familyKey,
  familyPriceKey,
  priceRefsFromSettings,
  setReferencePrice,
  applyReferenceToFamily,
  suggestPriceForVolume,
  ratingKey,
  saveSetting,
  addDrink,
  updateDrink,
  deleteDrink,
  deleteDrinkWithSnapshot,
  saveRating,
  addCategory,
  renameCategory,
  deleteCategory,
  updateFamily,
  deleteFamily,
  restoreDrinks,
  clearAllData,
  captureLocationForDrink,
  attachLocationToDrink,
  backfillMissingAddresses,
  getPosition,
  getDrinkCoords,
  drinkPlaceLabel,
  loadCategoryIcons,
  setCategoryIcon,
  migrateCategoryIconsToId,
  loadCategoryColors,
  setCategoryColor
});
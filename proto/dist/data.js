/* AUTO-GENERATED from proto/data.jsx — do not edit by hand. */
// data.jsx — real data adapter (wraps the legacy IndexedDB layer in
// `js/database.js`). The proto components were originally fed by a static
// mock; here we expose React-friendly hooks that load from the real DB and
// re-render on writes.

const DEFAULT_CATEGORY_NAMES = ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre'];

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
      const all = await db.getAllRatings();
      if (!alive) return;
      const out = {};
      for (const r of all) out[r.drinkName] = r.rating;
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
function buildFamilies(drinks, ratings = {}) {
  const map = new Map();
  for (const d of drinks) {
    const key = `${(d.name || '').trim().toLowerCase()}::${d.quantity}::${(d.unit || '').toLowerCase()}::${d.alcoholContent || 0}`;
    if (!map.has(key)) {
      map.set(key, {
        id: 'fam::' + key,
        name: d.name,
        category: d.category || 'Autre',
        quantity: d.quantity,
        unit: d.unit,
        alcohol: d.alcoholContent || 0,
        rating: ratings[d.name] || 0,
        entries: []
      });
    }
    const f = map.get(key);
    f.entries.push({
      id: d.id,
      ts: `${d.date}T${d.time || '00:00'}`,
      place: d.location && (d.location.name || d.location.address) ? d.location.name || d.location.address : null,
      raw: d
    });
  }
  for (const f of map.values()) {
    f.entries.sort((a, b) => b.ts.localeCompare(a.ts));
  }
  return Array.from(map.values()).sort((a, b) => b.entries.length - a.entries.length);
}

// Stats per category
function computeCategoryStats(categories, families) {
  const byName = new Map();
  for (const c of categories) byName.set(c.name, {
    id: c.id,
    name: c.name,
    families: 0,
    entries: 0
  });
  for (const f of families) {
    if (!byName.has(f.category)) {
      byName.set(f.category, {
        id: 'cat-' + f.category,
        name: f.category,
        families: 0,
        entries: 0
      });
    }
    const e = byName.get(f.category);
    e.families += 1;
    e.entries += f.entries.length;
  }
  return Array.from(byName.values()).sort((a, b) => b.entries - a.entries);
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
function useSettings() {
  return React.useContext(SettingsContext);
}

// ── BAC records ───────────────────────────────────────────────────
function useBacRecords(limit = 50) {
  const v = useDataVersion();
  const [records, setRecords] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const db = await waitForDb();
      if (!db) return;
      const list = await db.getBACRecords(limit);
      if (alive) setRecords(list);
    })();
    return () => {
      alive = false;
    };
  }, [v, limit]);
  return records;
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
async function saveRating(drinkName, rating) {
  const db = await waitForDb();
  if (!db) return;
  await db.setRating(drinkName, rating);
  dataBus.bump('ratings');
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
  if (!db) return;
  // Capture any explicit icon override BEFORE the rename so we can move
  // it to the new key. If there's no explicit override but the old name
  // was a built-in glyph (Bière, Vin, …), we pin the new name to that
  // glyph too — otherwise <CategoryGlyph> would silently fall back to
  // the generic glass icon for the renamed category.
  const oldKey = `cat.icon.${oldName}`;
  const newKey = `cat.icon.${newName}`;
  let existing = null;
  try {
    existing = await db.getSetting(oldKey);
  } catch {}
  const builtIn = ['Bière', 'Vin', 'Spiritueux', 'Cocktail'];
  const toWrite = existing || (builtIn.includes(oldName) ? oldName : null);
  await db.renameCategory(oldName, newName);
  try {
    if (existing) await db.setSetting(oldKey, null);
    if (toWrite) await db.setSetting(newKey, toWrite);
  } catch {}
  if (typeof window !== 'undefined') {
    const m = {
      ...(window.__alcoCatIcons || {})
    };
    delete m[oldName];
    if (toWrite) m[newName] = toWrite;
    window.__alcoCatIcons = m;
  }

  // renameCategory cascades into the drinks table (every drink with
  // that category gets rewritten), so bump both channels.
  dataBus.bump('categories');
  dataBus.bump('drinks');
  if (toWrite || existing) dataBus.bump('settings');
}
async function deleteCategory(id, options = {}) {
  const db = await waitForDb();
  if (!db) return;
  // Native deleteCategory refuses to drop categories that still own
  // drinks. Caller can pass `reassignTo` to move every drink to a
  // different category before the deletion.
  if (options.reassignTo) {
    const cat = await db.getCategoryById(id);
    if (cat) {
      const all = await db.getAllDrinks();
      const moved = all.filter(d => d.category === cat.name);
      for (const d of moved) {
        await db.updateDrink(d.id, {
          category: options.reassignTo
        });
      }
    }
  }
  await db.deleteCategory(id);
  // Also drop any persisted custom icon mapping and the matching
  // runtime mirror entry so a future cat reusing the same name doesn't
  // inherit a stale glyph.
  const name = options.name || '';
  if (name) {
    try {
      await db.setSetting(`cat.icon.${name}`, null);
    } catch {}
    if (typeof window !== 'undefined' && window.__alcoCatIcons && name in window.__alcoCatIcons) {
      const m = {
        ...window.__alcoCatIcons
      };
      delete m[name];
      window.__alcoCatIcons = m;
    }
  }
  dataBus.bump('categories');
  if (options.reassignTo) dataBus.bump('drinks');
  if (name) dataBus.bump('settings');
}

// ── Category icon overrides ───────────────────────────────────────
// Custom glyphs are persisted as `cat.icon.<name>` settings. We keep
// a runtime mirror at `window.__alcoCatIcons` so CategoryGlyph can do
// a synchronous lookup during render.
async function loadCategoryIcons() {
  const db = await waitForDb();
  if (!db) return {};
  const settings = await db.getAllSettings();
  const out = {};
  for (const [k, v] of Object.entries(settings)) {
    if (k.startsWith('cat.icon.') && v) out[k.slice('cat.icon.'.length)] = v;
  }
  if (typeof window !== 'undefined') window.__alcoCatIcons = out;
  return out;
}
async function setCategoryIcon(name, glyph) {
  const db = await waitForDb();
  if (!db) return;
  await db.setSetting(`cat.icon.${name}`, glyph || null);
  if (typeof window !== 'undefined') {
    window.__alcoCatIcons = {
      ...(window.__alcoCatIcons || {})
    };
    if (glyph) window.__alcoCatIcons[name] = glyph;else delete window.__alcoCatIcons[name];
  }
  // Icon overrides live in the settings table; useCategoryIcons is
  // subscribed to ['settings', 'categories'] so this single bump
  // refreshes every glyph in the tree.
  dataBus.bump('settings');
}

// All mutating helpers (setCategoryIcon, renameCategory, deleteCategory)
// keep `window.__alcoCatIcons` synchronously in lockstep with the DB
// before bumping the bus, so reading it inside a useMemo gated on `v`
// gives a consistent snapshot without a round-trip through IndexedDB.
// Eliminates the 1-frame stale render that used to leave the old glyph
// on screen right after the user saved a new icon.
//
// Subscribes to the same channels that touch the icon mirror:
// `settings` covers `setCategoryIcon` writes, `categories` covers
// rename/delete which also rewrite the mirror keys.
const _CH_CAT_ICONS = ['settings', 'categories'];
function useCategoryIcons() {
  const v = useDataVersion(_CH_CAT_ICONS);
  return React.useMemo(() => typeof window !== 'undefined' && window.__alcoCatIcons || {}, [v]);
}

// Apply same updates to every drink that shares (name + qty + unit + abv)
async function updateFamily(family, updates) {
  const db = await waitForDb();
  if (!db) return;
  const all = await db.getAllDrinks();
  const matches = all.filter(d => (d.name || '').trim().toLowerCase() === (family.name || '').trim().toLowerCase() && d.quantity === family.quantity && (d.unit || '').toLowerCase() === (family.unit || '').toLowerCase() && (d.alcoholContent || 0) === (family.alcohol || 0));
  for (const m of matches) {
    await db.updateDrink(m.id, updates);
  }
  dataBus.bump('drinks');
  // Category drinkCount may shift when `category` is part of `updates`.
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
  const matches = all.filter(d => (d.name || '').trim().toLowerCase() === (family.name || '').trim().toLowerCase() && d.quantity === family.quantity && (d.unit || '').toLowerCase() === (family.unit || '').toLowerCase() && (d.alcoholContent || 0) === (family.alcohol || 0));
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

// Single BAC record removal -- only the one record, never spreads.
async function deleteBACRecord(id) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.deleteBACRecord(id);
  dataBus.bump();
  return r;
}

// Re-add a previously deleted BAC record (for undo). The auto-incremented
// id will differ from the original; `relevantDrinkIds` round-trips
// untouched, so if the underlying drinks were ALSO deleted the array
// will hold dangling references — harmless (no current consumer
// dereferences them) but worth noting for future readers.
async function restoreBACRecord(record) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const {
    id,
    createdAt,
    ...payload
  } = record;
  await db.addBACRecord(payload);
  dataBus.bump();
}

// Wipe entire database (drinks, categories, settings). Caller is
// responsible for collecting an explicit user confirmation. The seed
// memoization and runtime icon mirror are reset so the next load
// re-seeds defaults exactly once on the empty DB.
async function clearAllData() {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.clearAllData();
  _seedDone = false;
  _seedPromise = null;
  if (typeof window !== 'undefined') window.__alcoCatIcons = {};
  dataBus.bump();
  return r;
}
Object.assign(window, {
  dataBus,
  useDataVersion,
  waitForDb,
  useCategories,
  useDrinks,
  useRatings,
  useSettings,
  useBacRecords,
  useCategoryIcons,
  useFamilies,
  DrinksContext,
  RatingsContext,
  CategoriesContext,
  SettingsContext,
  FamiliesContext,
  DrinksProvider,
  RatingsProvider,
  CategoriesProvider,
  SettingsProvider,
  buildFamilies,
  computeCategoryStats,
  flattenEntries,
  loadSettings,
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
  deleteBACRecord,
  restoreBACRecord,
  clearAllData,
  loadCategoryIcons,
  setCategoryIcon
});
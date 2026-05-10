// data.jsx — real data adapter (wraps the legacy IndexedDB layer in
// `js/database.js`). The proto components were originally fed by a static
// mock; here we expose React-friendly hooks that load from the real DB and
// re-render on writes.

const DEFAULT_CATEGORY_NAMES = ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre'];

// Bus -- listeners are notified when DB writes happen so any component can
// re-fetch. Components should also call `dataBus.bump()` after mutating.
const dataBus = (() => {
  const subs = new Set();
  return {
    sub(fn) { subs.add(fn); return () => subs.delete(fn); },
    bump() { subs.forEach(fn => { try { fn(); } catch (e) {} }); },
  };
})();

function useDataVersion() {
  const [v, setV] = React.useState(0);
  React.useEffect(() => dataBus.sub(() => setV(x => x + 1)), []);
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

async function _ensureDefaultCategories() {
  const db = await waitForDb();
  if (!db) return;
  try {
    const existing = await db.getAllCategories();
    if (existing.length === 0) {
      for (const name of DEFAULT_CATEGORY_NAMES) {
        try { await db.addCategory({ name }); } catch (e) {}
      }
    }
  } catch (e) {}
}

// ── Hook: load categories list ────────────────────────────────────
function useCategories() {
  const v = useDataVersion();
  const [cats, setCats] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const db = await waitForDb();
      if (!db) return;
      await _ensureDefaultCategories();
      const list = await db.getAllCategories();
      if (alive) { setCats(list); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [v]);
  return { categories: cats, loading };
}

// ── Hook: load all drinks (chronological) ────────────────────────
function useDrinks() {
  const v = useDataVersion();
  const [drinks, setDrinks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const db = await waitForDb();
      if (!db) return;
      const list = await db.getAllDrinks();
      if (alive) { setDrinks(list); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [v]);
  return { drinks, loading };
}

// ── Hook: load drink ratings ──────────────────────────────────────
function useRatings() {
  const v = useDataVersion();
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
    return () => { alive = false; };
  }, [v]);
  return map;
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
        entries: [],
      });
    }
    const f = map.get(key);
    f.entries.push({
      id: d.id,
      ts: `${d.date}T${(d.time || '00:00')}`,
      place: d.location && (d.location.name || d.location.address) ? (d.location.name || d.location.address) : null,
      raw: d,
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
  for (const c of categories) byName.set(c.name, { id: c.id, name: c.name, families: 0, entries: 0 });
  for (const f of families) {
    if (!byName.has(f.category)) {
      byName.set(f.category, { id: 'cat-' + f.category, name: f.category, families: 0, entries: 0 });
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
      out.push({ ...e, family: f });
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
  dataBus.bump();
}

function useSettings() {
  const v = useDataVersion();
  const [s, setS] = React.useState({});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const out = await loadSettings();
      if (alive) setS(out);
    })();
    return () => { alive = false; };
  }, [v]);
  return s;
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
    return () => { alive = false; };
  }, [v, limit]);
  return records;
}

// ── Mutations ─────────────────────────────────────────────────────
async function addDrink(payload) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.addDrink(payload);
  dataBus.bump();
  return r;
}

async function updateDrink(id, updates) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.updateDrink(id, updates);
  dataBus.bump();
  return r;
}

async function deleteDrink(id) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.deleteDrink(id);
  dataBus.bump();
  return r;
}

async function saveRating(drinkName, rating) {
  const db = await waitForDb();
  if (!db) return;
  await db.setRating(drinkName, rating);
  dataBus.bump();
}

async function addCategory(name) {
  const db = await waitForDb();
  if (!db) return;
  const r = await db.addCategory({ name });
  dataBus.bump();
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
  try { existing = await db.getSetting(oldKey); } catch {}
  const builtIn = ['Bière', 'Vin', 'Spiritueux', 'Cocktail'];
  const toWrite = existing || (builtIn.includes(oldName) ? oldName : null);

  await db.renameCategory(oldName, newName);

  try {
    if (existing) await db.setSetting(oldKey, null);
    if (toWrite) await db.setSetting(newKey, toWrite);
  } catch {}

  if (typeof window !== 'undefined') {
    const m = { ...(window.__alcoCatIcons || {}) };
    delete m[oldName];
    if (toWrite) m[newName] = toWrite;
    window.__alcoCatIcons = m;
  }

  dataBus.bump();
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
        await db.updateDrink(d.id, { category: options.reassignTo });
      }
    }
  }
  await db.deleteCategory(id);
  // Also drop any persisted custom icon mapping
  try { await db.setSetting(`cat.icon.${options.name || ''}`, null); } catch {}
  dataBus.bump();
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
    window.__alcoCatIcons = { ...(window.__alcoCatIcons || {}) };
    if (glyph) window.__alcoCatIcons[name] = glyph;
    else delete window.__alcoCatIcons[name];
  }
  dataBus.bump();
}

function useCategoryIcons() {
  const v = useDataVersion();
  const [icons, setIcons] = React.useState(() => (typeof window !== 'undefined' && window.__alcoCatIcons) || {});
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const m = await loadCategoryIcons();
      if (alive) setIcons(m);
    })();
    return () => { alive = false; };
  }, [v]);
  return icons;
}

// Apply same updates to every drink that shares (name + qty + unit + abv)
async function updateFamily(family, updates) {
  const db = await waitForDb();
  if (!db) return;
  const all = await db.getAllDrinks();
  const matches = all.filter(d =>
    (d.name || '').trim().toLowerCase() === (family.name || '').trim().toLowerCase() &&
    d.quantity === family.quantity &&
    (d.unit || '').toLowerCase() === (family.unit || '').toLowerCase() &&
    (d.alcoholContent || 0) === (family.alcohol || 0)
  );
  for (const m of matches) {
    await db.updateDrink(m.id, updates);
  }
  dataBus.bump();
}

// CONTRACT CHANGE (v3.5.0): now returns `{ count, snapshot }` instead of
// `Promise<number>` so callers can wire an undo path. Update every
// caller when modifying the shape — the legacy `js/app.js` does NOT
// invoke this function, only the proto layer does.
async function deleteFamily(family) {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const all = await db.getAllDrinks();
  const matches = all.filter(d =>
    (d.name || '').trim().toLowerCase() === (family.name || '').trim().toLowerCase() &&
    d.quantity === family.quantity &&
    (d.unit || '').toLowerCase() === (family.unit || '').toLowerCase() &&
    (d.alcoholContent || 0) === (family.alcohol || 0)
  );
  // Capture full row state BEFORE deletion so we can re-add on undo.
  const snapshot = matches.map(m => ({ ...m }));
  for (const m of matches) {
    await db.deleteDrink(m.id);
  }
  dataBus.bump();
  return { count: matches.length, snapshot };
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
    const { id, createdAt, updatedAt, quantityInCL, ...payload } = d;
    await db.addDrink(payload);
  }
  dataBus.bump();
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
  dataBus.bump();
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
  const { id, createdAt, ...payload } = record;
  await db.addBACRecord(payload);
  dataBus.bump();
}

// Wipe entire database (drinks, categories, settings). Caller is
// responsible for collecting an explicit user confirmation.
async function clearAllData() {
  const db = await waitForDb();
  if (!db) throw new Error('DB indisponible');
  const r = await db.clearAllData();
  dataBus.bump();
  return r;
}

Object.assign(window, {
  dataBus, useDataVersion,
  waitForDb,
  useCategories, useDrinks, useRatings, useSettings, useBacRecords,
  useCategoryIcons,
  buildFamilies, computeCategoryStats, flattenEntries,
  loadSettings, saveSetting,
  addDrink, updateDrink, deleteDrink, deleteDrinkWithSnapshot, saveRating,
  addCategory, renameCategory, deleteCategory,
  updateFamily, deleteFamily, restoreDrinks,
  deleteBACRecord, restoreBACRecord, clearAllData,
  loadCategoryIcons, setCategoryIcon,
});

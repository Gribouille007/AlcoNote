// db.jsx — thin IndexedDB adapter that feeds the prototype's data shape from
// the same `AlcoNoteDB` database the legacy app populates. The mock seed in
// data.jsx remains as a design preview when no real data exists.
//
// Data-preservation rules:
//   1. Open the DB at its existing version first — never force-downgrade. If
//      a future legacy build bumped past KNOWN_VERSION we still want to read.
//   2. Every read defends against the store not existing on older schemas.
//   3. Writes mirror the legacy `addDrink` semantics (drinkCount upkeep so a
//      rollback to a legacy build still shows correct counts).

const IDB_NAME = 'AlcoNoteDB';
const KNOWN_VERSION = 3; // last schema we know about (legacy js/database.js v3)

let __idbConn = null;
function _open(version) {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(IDB_NAME) : indexedDB.open(IDB_NAME, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IDB open blocked by another tab'));
    req.onupgradeneeded = () => {
      const idb = req.result;
      // Only create stores that don't yet exist. Never drop or redefine —
      // that would destroy data.
      for (const store of ['drinks', 'categories', 'settings', 'bacRecords', 'drinkRatings']) {
        if (!idb.objectStoreNames.contains(store)) {
          const opts = store === 'drinkRatings' || store === 'settings' ? {
            keyPath: store === 'drinkRatings' ? 'drinkName' : 'key'
          } : {
            keyPath: 'id',
            autoIncrement: true
          };
          idb.createObjectStore(store, opts);
        }
      }
    };
  });
}
async function openIDB() {
  if (__idbConn) return __idbConn;
  // Step 1: try opening at the existing version (no upgrade). If the DB
  // doesn't exist this creates an empty v1.
  try {
    __idbConn = await _open();
  } catch (e) {
    console.warn('[AlcoNote] IDB versionless open failed', e);
  }
  // Step 2: if our known schema is newer, request an upgrade — but only if
  // strictly higher. A future schema (DB > KNOWN_VERSION) is left alone so
  // we never downgrade.
  if (__idbConn && __idbConn.version < KNOWN_VERSION) {
    __idbConn.close();
    __idbConn = await _open(KNOWN_VERSION);
  } else if (!__idbConn) {
    __idbConn = await _open(KNOWN_VERSION);
  }
  // If a peer tab requests a future upgrade, release the connection so the
  // upgrade can proceed instead of being blocked indefinitely.
  __idbConn.onversionchange = () => {
    try {
      __idbConn.close();
    } catch {}
    __idbConn = null;
  };
  return __idbConn;
}
function tx(idb, storeName, mode = 'readonly') {
  return idb.transaction(storeName, mode).objectStore(storeName);
}
async function readAll(storeName) {
  try {
    const idb = await openIDB();
    if (!idb.objectStoreNames.contains(storeName)) return [];
    return await new Promise((resolve, reject) => {
      const req = tx(idb, storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`[AlcoNote] IDB read of ${storeName} failed`, e);
    return [];
  }
}
async function writeOne(storeName, record) {
  const idb = await openIDB();
  if (!idb.objectStoreNames.contains(storeName)) {
    throw new Error(`Store ${storeName} missing from this DB`);
  }
  return await new Promise((resolve, reject) => {
    const store = idb.transaction(storeName, 'readwrite').objectStore(storeName);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function deleteOne(storeName, key) {
  const idb = await openIDB();
  if (!idb.objectStoreNames.contains(storeName)) return;
  return await new Promise((resolve, reject) => {
    const store = idb.transaction(storeName, 'readwrite').objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
async function bumpCategoryDrinkCount(categoryName) {
  // Note: this is intentionally non-atomic with the preceding `writeOne`
  // (each runs in its own IDB transaction). If the page is killed between
  // the two ops, the count drifts by one — the next add corrects it.
  if (!categoryName) return;
  try {
    const idb = await openIDB();
    if (!idb.objectStoreNames.contains('categories')) return;
    const drinkCount = await new Promise((resolve, reject) => {
      const r = tx(idb, 'drinks').getAll();
      r.onsuccess = () => resolve(r.result.filter(d => d.category === categoryName).length);
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const store = idb.transaction('categories', 'readwrite').objectStore('categories');
      const all = store.getAll();
      all.onsuccess = () => {
        const match = (all.result || []).find(c => c.name === categoryName);
        const now = new Date();
        // Mirror the legacy app: create a categories row if none exists for
        // this name, so a rollback to the legacy build still surfaces the
        // category card.
        const next = match ? {
          ...match,
          drinkCount,
          updatedAt: now
        } : {
          name: categoryName,
          drinkCount,
          createdAt: now,
          updatedAt: now
        };
        const put = store.put(next);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      all.onerror = () => reject(all.error);
    });
  } catch (e) {
    console.warn('[AlcoNote] category drinkCount upkeep failed', e);
  }
}

// Group flat drink rows into the prototype's "family" shape:
// { id, name, category, quantity, unit, alcohol, rating, entries: [{ id, ts, place }] }
function groupIntoFamilies(drinks, ratingsByName) {
  const ratings = ratingsByName || {};
  const families = new Map();
  for (const d of drinks) {
    const alcohol = +d.alcoholContent || 0;
    const key = `${(d.name || '').trim().toLowerCase()}::${alcohol}::${d.quantity}::${d.unit}`;
    if (!families.has(key)) {
      families.set(key, {
        id: `f-${families.size + 1}`,
        name: d.name,
        category: d.category || 'Autre',
        quantity: +d.quantity || 0,
        unit: d.unit || 'cL',
        alcohol,
        rating: ratings[d.name] || 0,
        entries: []
      });
    }
    const ts = `${d.date}T${(d.time || '00:00').slice(0, 5)}`;
    families.get(key).entries.push({
      id: `e-${d.id}`,
      ts,
      place: d.location || null
    });
  }
  // Newest entries first within each family.
  for (const f of families.values()) {
    f.entries.sort((a, b) => b.ts.localeCompare(a.ts));
  }
  return [...families.values()];
}

// Mutable hydration state. Components read window.DRINK_FAMILIES at render
// time; bumping the version forces re-renders via useDb().
window.__dbListeners = window.__dbListeners || new Set();
let __dbHydrated = false;
let __dbHasRealData = false;
window.__alcoUserSettings = window.__alcoUserSettings || {};
function bumpDb() {
  window.__dbListeners.forEach(fn => fn());
}
function useDb() {
  const [, force] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    window.__dbListeners.add(force);
    return () => window.__dbListeners.delete(force);
  }, []);
  return {
    hydrated: __dbHydrated,
    hasRealData: __dbHasRealData
  };
}
async function hydrateFamilies() {
  const [drinks, ratings, settings] = await Promise.all([readAll('drinks'), readAll('drinkRatings'), readAll('settings')]);
  // Surface user profile (weight, gender) so BAC computations can pick it
  // up. Fall back to defaults silently if absent.
  const settingsByKey = {};
  for (const s of settings || []) settingsByKey[s.key] = s.value;
  window.__alcoUserSettings = settingsByKey;
  if (drinks.length > 0) {
    const ratingsByName = {};
    for (const r of ratings) ratingsByName[r.drinkName] = r.rating;
    window.DRINK_FAMILIES = groupIntoFamilies(drinks, ratingsByName);
    __dbHasRealData = true;
  }
  __dbHydrated = true;
  console.info(`[AlcoNote] hydrated ${drinks.length} drink(s) from IDB · settings keys: ${Object.keys(settingsByKey).length}`);
  bumpDb();
}

// Persist a new drink. Returns the updated families list. Mirrors the legacy
// `addDrink` semantics so a future rollback to the legacy build still sees
// consistent data (same field shape, drinkCount kept in sync).
async function addDrinkToDb({
  name,
  category,
  quantity,
  unit,
  alcoholContent,
  location
}) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  const quantityInCL = unit === 'EcoCup' ? quantity * 25 : unit === 'L' ? quantity * 100 : +quantity;
  const record = {
    name: (name || '').trim(),
    category: category || 'Autre',
    quantity: +quantity || 0,
    unit: unit || 'cL',
    quantityInCL,
    alcoholContent: +alcoholContent || 0,
    date,
    time,
    location: location || null,
    barcode: null,
    createdAt: now,
    updatedAt: now
  };
  await writeOne('drinks', record);
  await bumpCategoryDrinkCount(record.category);
  await hydrateFamilies();
}

// ── Backup / restore ────────────────────────────────────────────────
// Dump every store this DB knows about into a single JSON object. The
// shape matches the legacy "Exporter" behavior so files round-trip with
// older builds.
async function exportAllData() {
  const idb = await openIDB();
  const out = {
    exportedAt: new Date().toISOString(),
    schemaVersion: idb.version
  };
  for (const store of idb.objectStoreNames) {
    out[store] = await readAll(store);
  }
  return out;
}
async function downloadBackup() {
  const data = await exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alconote-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  const idb = await openIDB();
  // Merge-by-id: rows in the backup with the same primary key as a current
  // row will OVERWRITE the current row (newest snapshot wins). Rows not in
  // the backup are kept untouched, so this is "additive" toward missing
  // entries but "replacing" toward existing ones. Use Tout effacer first if
  // you want a clean restore.
  //
  // Per-row errors are isolated: we call preventDefault() on each request's
  // onerror so a single malformed row doesn't abort the whole transaction
  // (and lose the rest of the import).
  const skipped = {
    total: 0,
    byStore: {}
  };
  for (const store of ['drinks', 'categories', 'settings', 'bacRecords', 'drinkRatings']) {
    if (!Array.isArray(data[store])) continue;
    if (!idb.objectStoreNames.contains(store)) continue;
    await new Promise((resolve, reject) => {
      const t = idb.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      for (const row of data[store]) {
        try {
          const req = s.put(row);
          req.onerror = event => {
            skipped.total += 1;
            skipped.byStore[store] = (skipped.byStore[store] || 0) + 1;
            event.preventDefault(); // keep the transaction alive
          };
        } catch {
          skipped.total += 1;
          skipped.byStore[store] = (skipped.byStore[store] || 0) + 1;
        }
      }
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('import aborted'));
    });
  }
  // After a restore the categories drinkCount can be stale — recompute for
  // every category present in the imported drinks.
  if (Array.isArray(data.drinks) && idb.objectStoreNames.contains('categories')) {
    const seen = new Set();
    for (const d of data.drinks) {
      if (d && d.category && !seen.has(d.category)) {
        seen.add(d.category);
        await bumpCategoryDrinkCount(d.category);
      }
    }
  }
  await hydrateFamilies();
  if (skipped.total > 0) {
    console.warn('[AlcoNote] import skipped', skipped.total, 'malformed row(s)', skipped.byStore);
  }
  return {
    skipped
  };
}
function pickBackupFile() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => resolve(input.files && input.files[0]);
    input.click();
  });
}

// Compute a rough current BAC (mg/L) using Widmark, summing residual alcohol
// from the last 12h. Returns 0 if no recent drinks. Picks up the user's
// weight + gender from window.__alcoUserSettings (hydrated from the legacy
// `settings` store) so the pill matches what the legacy app would have
// shown for the same profile.
function computeCurrentBacMgPerL(families, opts = {}) {
  const settings = window.__alcoUserSettings || {};
  const weightKg = opts.weightKg || +settings.userWeight || 70;
  // Distribution ratio: ≈ 0.68–0.70 for men, ≈ 0.55 for women (Widmark).
  const inferredR = settings.userGender === 'Femme' || settings.userGender === 'F' ? 0.55 : 0.7;
  const r = opts.r || inferredR;
  const elimGperLPerH = 0.15; // ≈ 150 mg/L/h
  const horizonH = 12;
  const now = Date.now();
  let total = 0;
  for (const f of families) {
    const volCl = f.unit === 'EcoCup' ? f.quantity * 25 : f.unit === 'L' ? f.quantity * 100 : f.quantity;
    const grams = volCl * 10 * (f.alcohol / 100) * 0.789;
    for (const e of f.entries) {
      const ts = Date.parse(e.ts);
      if (Number.isNaN(ts)) continue;
      const hoursAgo = (now - ts) / 3.6e6;
      if (hoursAgo < 0 || hoursAgo > horizonH) continue;
      const peak = grams / (weightKg * r); // g/L
      const residual = Math.max(0, peak - elimGperLPerH * Math.max(0, hoursAgo));
      total += residual;
    }
  }
  return Math.round(total * 1000); // → mg/L
}
Object.assign(window, {
  hydrateFamilies,
  addDrinkToDb,
  computeCurrentBacMgPerL,
  useDb,
  exportAllData,
  downloadBackup,
  importBackup,
  pickBackupFile,
  readAll,
  deleteOne,
  // Pure helpers exposed so the unit-test suite can import them via
  // Object pluck without instantiating the React tree.
  groupIntoFamilies
});
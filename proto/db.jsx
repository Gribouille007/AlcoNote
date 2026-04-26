// db.jsx — thin IndexedDB adapter that feeds the prototype's data shape from
// the same `AlcoNoteDB` database the legacy app populates. The mock seed in
// data.jsx remains as a design preview when no real data exists.

const IDB_NAME = 'AlcoNoteDB';
const IDB_VERSION = 3; // matches js/database.js

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    // Don't run upgrades from here — the legacy app owns the schema. If the
    // DB doesn't exist yet we just initialize empty stores so reads return [].
    req.onupgradeneeded = () => {
      const idb = req.result;
      for (const store of ['drinks', 'categories', 'settings', 'bacRecords', 'drinkRatings']) {
        if (!idb.objectStoreNames.contains(store)) {
          const opts = (store === 'drinkRatings' || store === 'settings')
            ? { keyPath: store === 'drinkRatings' ? 'drinkName' : 'key' }
            : { keyPath: 'id', autoIncrement: true };
          idb.createObjectStore(store, opts);
        }
      }
    };
  });
}

function tx(idb, storeName, mode = 'readonly') {
  return idb.transaction(storeName, mode).objectStore(storeName);
}

async function readAll(storeName) {
  try {
    const idb = await openIDB();
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
  return await new Promise((resolve, reject) => {
    const store = idb.transaction(storeName, 'readwrite').objectStore(storeName);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
        entries: [],
      });
    }
    const ts = `${d.date}T${(d.time || '00:00').slice(0, 5)}`;
    families.get(key).entries.push({
      id: `e-${d.id}`,
      ts,
      place: d.location || null,
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

function bumpDb() {
  window.__dbListeners.forEach(fn => fn());
}

function useDb() {
  const [, force] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    window.__dbListeners.add(force);
    return () => window.__dbListeners.delete(force);
  }, []);
  return { hydrated: __dbHydrated, hasRealData: __dbHasRealData };
}

async function hydrateFamilies() {
  const [drinks, ratings] = await Promise.all([
    readAll('drinks'),
    readAll('drinkRatings'),
  ]);
  if (drinks.length > 0) {
    const ratingsByName = {};
    for (const r of ratings) ratingsByName[r.drinkName] = r.rating;
    window.DRINK_FAMILIES = groupIntoFamilies(drinks, ratingsByName);
    __dbHasRealData = true;
  }
  __dbHydrated = true;
  bumpDb();
}

// Persist a new drink. Returns the updated families list.
async function addDrinkToDb({ name, category, quantity, unit, alcoholContent, location }) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  const quantityInCL = unit === 'EcoCup' ? quantity * 25
                     : unit === 'L' ? quantity * 100
                     : +quantity;
  const record = {
    name: (name || '').trim(),
    category: category || 'Autre',
    quantity: +quantity || 0,
    unit: unit || 'cL',
    quantityInCL,
    alcoholContent: +alcoholContent || 0,
    date, time,
    location: location || null,
    barcode: null,
    createdAt: now,
    updatedAt: now,
  };
  await writeOne('drinks', record);
  await hydrateFamilies();
}

// Compute a rough current BAC (mg/L) using Widmark, summing residual alcohol
// from the last 12h. Returns 0 if no recent drinks. This mirrors the spirit
// of the legacy bac-chart logic in a single self-contained function.
function computeCurrentBacMgPerL(families, opts = {}) {
  const weightKg = opts.weightKg || 70;
  const r = opts.r || 0.7; // body water ratio (men ≈ 0.68–0.7)
  const elimGperLPerH = 0.15; // ≈ 150 mg/L/h
  const horizonH = 12;
  const now = Date.now();
  let total = 0;
  for (const f of families) {
    const volCl = f.unit === 'EcoCup' ? f.quantity * 25
                : f.unit === 'L' ? f.quantity * 100
                : f.quantity;
    const grams = volCl * 10 * (f.alcohol / 100) * 0.789;
    for (const e of f.entries) {
      const ts = Date.parse(e.ts);
      if (Number.isNaN(ts)) continue;
      const hoursAgo = (now - ts) / 3.6e6;
      if (hoursAgo < 0 || hoursAgo > horizonH) continue;
      const peak = (grams / (weightKg * r)); // g/L
      const residual = Math.max(0, peak - elimGperLPerH * Math.max(0, hoursAgo));
      total += residual;
    }
  }
  return Math.round(total * 1000); // → mg/L
}

Object.assign(window, {
  hydrateFamilies, addDrinkToDb, computeCurrentBacMgPerL, useDb,
});

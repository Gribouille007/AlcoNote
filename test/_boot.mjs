// Shared bootstrap: stubs minimal browser globals and loads the compiled
// proto bundles in dependency order so each test file gets a populated
// `globalThis` with all the pure helpers attached to `window`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

let _booted = false;

export function bootBundles() {
  if (_booted) return;
  _booted = true;

  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: { setAttribute() {} },
    body: {},
    getElementById: () => ({}),
    createElement: () => ({ click() {}, remove() {}, appendChild() {}, set onchange(_) {}, style: {} }),
  };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.indexedDB = { open: () => ({}) };
  globalThis.React = {
    useState: (i) => [typeof i === 'function' ? i() : i, () => {}],
    useEffect: () => {},
    useReducer: () => [0, () => {}],
    useCallback: (f) => f,
    cloneElement: () => ({}),
    createElement: () => ({}),
    Fragment: 'fragment',
  };
  globalThis.ReactDOM = { createRoot: () => ({ render() {} }) };

  const order = [
    'shared.js', 'db.js', 'data.js',
    'categories.js', 'history.js',
    'stats-charts.js', 'stats.js', 'modals.js', 'app.js',
  ];
  for (const f of order) {
    const src = readFileSync(join(ROOT, 'build/proto', f), 'utf8');
    new Function(src)();
  }
}

// ── Tiny fixture builders ─────────────────────────────────────────
// Build a family from `name` + an array of [hoursAgo, place] tuples so
// tests can describe time-relative scenarios without leaking dates into
// every fixture.
export function family(opts) {
  const {
    name = 'Test', category = 'Bière',
    quantity = 33, unit = 'cL', alcohol = 5, rating = 0,
    entries = [],
  } = opts;
  return {
    id: `f-${name}`,
    name, category, quantity, unit, alcohol, rating,
    entries: entries.map(([hoursAgo, place = null], i) => {
      const ts = new Date(Date.now() - hoursAgo * 3600 * 1000);
      // ISO without seconds — matches the shape `groupIntoFamilies` produces.
      const iso = ts.toISOString().slice(0, 16);
      return { id: `e-${name}-${i}`, ts: iso, place };
    }),
  };
}

// Build an entry tied to a family inline — used where helpers expect the
// flat `[{...e, family: f}]` shape.
export function entry(f, hoursAgo, place = null, idx = 0) {
  const ts = new Date(Date.now() - hoursAgo * 3600 * 1000)
    .toISOString().slice(0, 16);
  return { id: `e-${f.name}-${idx}`, ts, place, family: f };
}

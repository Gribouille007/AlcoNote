// Pure-function smoke tests using Node's built-in test runner.
//   node --test test/smoke.test.mjs
//
// We boot the precompiled bundles from build/proto/ under a stubbed window
// (no React render), then assert on the helpers Object.assigned to window.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);

function bootBundles() {
  // Fresh-ish browser-like globals so the bundles can `Object.assign(window, …)`.
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: { setAttribute() {} },
    body: {},
    getElementById: () => ({}),
    createElement: () => ({ click() {}, remove() {}, appendChild() {}, set onchange(_) {}, style: {} }),
  };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.indexedDB = { open: () => ({}) };
  // Minimal React stub — bundles only call cloneElement / createElement at
  // module load. Hooks fire only at render time, which we never trigger.
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

  // Order matches index.html.
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

bootBundles();

test('groupIntoFamilies: groups identical drinks and sorts entries newest-first', () => {
  const rows = [
    { id: 1, name: 'Pilsner Urquell', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 4.4, date: '2026-04-10', time: '19:00', location: 'Bar' },
    { id: 2, name: 'pilsner urquell', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 4.4, date: '2026-04-12', time: '20:30', location: null },
    { id: 3, name: 'Guinness', category: 'Bière', quantity: 1, unit: 'EcoCup',
      alcoholContent: 4.2, date: '2026-04-11', time: '21:00', location: null },
  ];
  const fams = window.groupIntoFamilies(rows, {});
  assert.equal(fams.length, 2);
  const pilsner = fams.find(f => f.name.toLowerCase() === 'pilsner urquell');
  assert.equal(pilsner.entries.length, 2);
  // Newest entry first.
  assert.equal(pilsner.entries[0].ts, '2026-04-12T20:30');
  assert.equal(pilsner.entries[1].ts, '2026-04-10T19:00');
});

test('groupIntoFamilies: applies ratings by drink name', () => {
  const fams = window.groupIntoFamilies(
    [{ id: 1, name: 'Mojito', category: 'Cocktail', quantity: 15, unit: 'cL',
       alcoholContent: 12, date: '2026-04-01', time: '20:00' }],
    { Mojito: 5 },
  );
  assert.equal(fams[0].rating, 5);
});

test('computeCurrentBacMgPerL: zero when no recent drinks', () => {
  assert.equal(window.computeCurrentBacMgPerL([]), 0);
  assert.equal(window.computeCurrentBacMgPerL([
    { name: 'Old', category: 'Bière', quantity: 33, unit: 'cL', alcohol: 5,
      entries: [{ id: 'x', ts: '2020-01-01T00:00' }] },
  ]), 0);
});

test('computeCurrentBacMgPerL: respects passed-in weight + r', () => {
  const now = new Date();
  const ts = new Date(now.getTime() - 10 * 60 * 1000)
    .toISOString().slice(0, 16); // 10 min ago
  const fams = [{
    name: 'Test', category: 'Bière', quantity: 50, unit: 'cL', alcohol: 5,
    entries: [{ id: 'a', ts }],
  }];
  // 50 cL × 5% × 0.789 = 19.7 g of ethanol.
  // peak = 19.7 / (70 × 0.7) = 0.402 g/L; minus ~0.025 g/L for 10 min elim
  // → ≈ 0.378 g/L → ≈ 378 mg/L.
  const result = window.computeCurrentBacMgPerL(fams, { weightKg: 70, r: 0.7 });
  assert.ok(result > 350 && result < 410, `expected ~378, got ${result}`);
});

test('computeCurrentBacMgPerL: lighter weight increases BAC', () => {
  const now = new Date();
  const ts = new Date(now.getTime() - 10 * 60 * 1000).toISOString().slice(0, 16);
  const fams = [{
    name: 'Test', category: 'Bière', quantity: 50, unit: 'cL', alcohol: 5,
    entries: [{ id: 'a', ts }],
  }];
  const heavy = window.computeCurrentBacMgPerL(fams, { weightKg: 90, r: 0.7 });
  const light = window.computeCurrentBacMgPerL(fams, { weightKg: 50, r: 0.7 });
  assert.ok(light > heavy, `expected light(${light}) > heavy(${heavy})`);
});

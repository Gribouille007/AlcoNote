// IDB adapter pure helpers: groupIntoFamilies + computeCurrentBacMgPerL.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootBundles, family } from './_boot.mjs';

bootBundles();

// ── groupIntoFamilies ─────────────────────────────────────────────
test('groupIntoFamilies: collapses identical drinks regardless of name case', () => {
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
});

test('groupIntoFamilies: entries sorted newest-first within each family', () => {
  const rows = [
    { id: 1, name: 'X', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5, date: '2026-04-10', time: '19:00' },
    { id: 2, name: 'X', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5, date: '2026-04-12', time: '20:30' },
  ];
  const fams = window.groupIntoFamilies(rows, {});
  assert.equal(fams[0].entries[0].ts, '2026-04-12T20:30');
  assert.equal(fams[0].entries[1].ts, '2026-04-10T19:00');
});

test('groupIntoFamilies: same name + different alcohol → separate families', () => {
  const rows = [
    { id: 1, name: 'IPA', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5.6, date: '2026-04-10', time: '19:00' },
    { id: 2, name: 'IPA', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 7.2, date: '2026-04-11', time: '20:00' },
  ];
  const fams = window.groupIntoFamilies(rows, {});
  assert.equal(fams.length, 2);
});

test('groupIntoFamilies: same name + different unit → separate families', () => {
  const rows = [
    { id: 1, name: 'Beer', category: 'Bière', quantity: 33, unit: 'cL',
      alcoholContent: 5, date: '2026-04-10', time: '19:00' },
    { id: 2, name: 'Beer', category: 'Bière', quantity: 1, unit: 'EcoCup',
      alcoholContent: 5, date: '2026-04-11', time: '20:00' },
  ];
  const fams = window.groupIntoFamilies(rows, {});
  assert.equal(fams.length, 2);
});

test('groupIntoFamilies: applies ratings by drink name', () => {
  const fams = window.groupIntoFamilies(
    [{ id: 1, name: 'Mojito', category: 'Cocktail', quantity: 15, unit: 'cL',
       alcoholContent: 12, date: '2026-04-01', time: '20:00' }],
    { Mojito: 5 },
  );
  assert.equal(fams[0].rating, 5);
});

test('groupIntoFamilies: missing rating defaults to 0', () => {
  const fams = window.groupIntoFamilies(
    [{ id: 1, name: 'Unknown', category: 'Autre', quantity: 10, unit: 'cL',
       alcoholContent: 8, date: '2026-04-01', time: '20:00' }],
    {},
  );
  assert.equal(fams[0].rating, 0);
});

test('groupIntoFamilies: defaults unit to cL and category to Autre', () => {
  const fams = window.groupIntoFamilies(
    [{ id: 1, name: 'Mystery', quantity: 10, alcoholContent: 8,
       date: '2026-04-01', time: '20:00' }],
    {},
  );
  assert.equal(fams[0].category, 'Autre');
  assert.equal(fams[0].unit, 'cL');
});

test('groupIntoFamilies: missing time falls back to 00:00', () => {
  const fams = window.groupIntoFamilies(
    [{ id: 1, name: 'A', category: 'Bière', quantity: 33, unit: 'cL',
       alcoholContent: 5, date: '2026-04-15', time: '' }],
    {},
  );
  assert.equal(fams[0].entries[0].ts, '2026-04-15T00:00');
});

test('groupIntoFamilies: empty input returns empty array', () => {
  assert.deepEqual(window.groupIntoFamilies([], {}), []);
});

// ── computeCurrentBacMgPerL ───────────────────────────────────────
test('computeCurrentBacMgPerL: zero when no recent drinks', () => {
  assert.equal(window.computeCurrentBacMgPerL([]), 0);
});

test('computeCurrentBacMgPerL: ignores entries older than 12h horizon', () => {
  const f = family({ entries: [[24]] }); // 24h ago
  assert.equal(window.computeCurrentBacMgPerL([f]), 0);
});

test('computeCurrentBacMgPerL: respects passed-in weight + r', () => {
  const f = family({ entries: [[10 / 60]], quantity: 50, alcohol: 5 }); // 10 min ago
  // 50cL × 5% × 0.789 = 19.7g; peak = 19.7 / (70 × 0.7) = 0.402 g/L
  // After 10min elim: 0.402 - 0.025 = 0.377 g/L → ~378 mg/L
  const result = window.computeCurrentBacMgPerL([f], { weightKg: 70, r: 0.7 });
  assert.ok(result > 350 && result < 410, `expected ~378, got ${result}`);
});

test('computeCurrentBacMgPerL: lighter weight → higher BAC', () => {
  const f = family({ entries: [[10 / 60]], quantity: 50, alcohol: 5 });
  const heavy = window.computeCurrentBacMgPerL([f], { weightKg: 90, r: 0.7 });
  const light = window.computeCurrentBacMgPerL([f], { weightKg: 50, r: 0.7 });
  assert.ok(light > heavy, `expected light(${light}) > heavy(${heavy})`);
});

test('computeCurrentBacMgPerL: female r factor → higher BAC than male', () => {
  // Same person mass and drink, only the body-water ratio differs.
  const f = family({ entries: [[10 / 60]], quantity: 50, alcohol: 5 });
  const male = window.computeCurrentBacMgPerL([f], { weightKg: 70, r: 0.7 });
  const female = window.computeCurrentBacMgPerL([f], { weightKg: 70, r: 0.55 });
  assert.ok(female > male);
});

test('computeCurrentBacMgPerL: reads userWeight from window settings', () => {
  // Stash 50kg in __alcoUserSettings; opts override should still win.
  window.__alcoUserSettings = { userWeight: 50 };
  const f = family({ entries: [[10 / 60]], quantity: 50, alcohol: 5 });
  const fromSettings = window.computeCurrentBacMgPerL([f]);
  const fromOpts = window.computeCurrentBacMgPerL([f], { weightKg: 50, r: 0.7 });
  assert.equal(fromSettings, fromOpts);
  window.__alcoUserSettings = {};
});

test('computeCurrentBacMgPerL: integer return in mg/L', () => {
  const f = family({ entries: [[10 / 60]], quantity: 50, alcohol: 5 });
  const v = window.computeCurrentBacMgPerL([f]);
  assert.equal(v, Math.round(v));
});

test('computeCurrentBacMgPerL: future-dated entry contributes nothing', () => {
  const f = family({ entries: [[-1]], quantity: 50, alcohol: 5 }); // 1h in the future
  assert.equal(window.computeCurrentBacMgPerL([f]), 0);
});

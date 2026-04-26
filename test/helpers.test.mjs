// Pure helpers: _flatEntries, _entryGrams, _entryVolumeCl.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootBundles, family } from './_boot.mjs';

bootBundles();

test('_flatEntries: empty input returns empty array', () => {
  assert.deepEqual(window._flatEntries([]), []);
});

test('_flatEntries: flattens entries and stamps each with its family', () => {
  const f1 = family({ name: 'A', entries: [[1], [2]] });
  const f2 = family({ name: 'B', entries: [[3]] });
  const flat = window._flatEntries([f1, f2]);
  assert.equal(flat.length, 3);
  assert.equal(flat[0].family, f1);
  assert.equal(flat[1].family, f1);
  assert.equal(flat[2].family, f2);
});

test('_flatEntries: handles families with empty entries', () => {
  const f = family({ name: 'A', entries: [] });
  assert.deepEqual(window._flatEntries([f]), []);
});

test('_entryVolumeCl: cL unit returns quantity unchanged', () => {
  const f = family({ unit: 'cL', quantity: 33, entries: [[1]] });
  const e = window._flatEntries([f])[0];
  assert.equal(window._entryVolumeCl(e), 33);
});

test('_entryVolumeCl: L unit multiplies by 100', () => {
  const f = family({ unit: 'L', quantity: 0.5, entries: [[1]] });
  const e = window._flatEntries([f])[0];
  assert.equal(window._entryVolumeCl(e), 50);
});

test('_entryVolumeCl: EcoCup multiplies by 25', () => {
  const f = family({ unit: 'EcoCup', quantity: 2, entries: [[1]] });
  const e = window._flatEntries([f])[0];
  assert.equal(window._entryVolumeCl(e), 50);
});

test('_entryGrams: 33cL × 5% pure ethanol ≈ 13.0g', () => {
  const f = family({ unit: 'cL', quantity: 33, alcohol: 5, entries: [[1]] });
  const e = window._flatEntries([f])[0];
  // 33 × 10 × 0.05 × 0.789 = 13.02
  const grams = window._entryGrams(e);
  assert.ok(grams > 12.9 && grams < 13.1, `expected ~13, got ${grams}`);
});

test('_entryGrams: scales linearly with quantity', () => {
  const f1 = family({ unit: 'cL', quantity: 33, alcohol: 5, entries: [[1]] });
  const f2 = family({ unit: 'cL', quantity: 66, alcohol: 5, entries: [[1]] });
  const e1 = window._flatEntries([f1])[0];
  const e2 = window._flatEntries([f2])[0];
  // doubling quantity → ~doubling grams
  assert.ok(Math.abs(window._entryGrams(e2) - 2 * window._entryGrams(e1)) < 0.01);
});

test('_entryGrams: 0% alcohol yields 0g', () => {
  const f = family({ unit: 'cL', quantity: 50, alcohol: 0, entries: [[1]] });
  const e = window._flatEntries([f])[0];
  assert.equal(window._entryGrams(e), 0);
});

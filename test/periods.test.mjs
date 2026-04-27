// _periodRange / _filterByPeriod / _familiesInPeriod.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootBundles, family } from './_boot.mjs';

bootBundles();

test('_periodRange("day"): 24h window starting at midnight', () => {
  const { from, to } = window._periodRange('day', new Date('2026-04-15T13:30:00'));
  assert.equal(from.getHours(), 0);
  assert.equal(from.getMinutes(), 0);
  assert.equal(+to - +from, 24 * 3600 * 1000);
});

test('_periodRange("week"): Monday-based, 7-day span', () => {
  // Wed Apr 15 2026 → week is Mon Apr 13 to Mon Apr 20
  const { from, to } = window._periodRange('week', new Date('2026-04-15T12:00:00'));
  assert.equal(from.getDay(), 1, `expected Monday (1), got ${from.getDay()}`);
  assert.equal(+to - +from, 7 * 24 * 3600 * 1000);
});

test('_periodRange("month"): full calendar month', () => {
  const { from, to } = window._periodRange('month', new Date('2026-04-15T12:00:00'));
  assert.equal(from.getMonth(), 3); // April = index 3
  assert.equal(from.getDate(), 1);
  assert.equal(to.getMonth(), 4); // May
});

test('_periodRange("year"): Jan 1 → next Jan 1', () => {
  const { from, to } = window._periodRange('year', new Date('2026-04-15T12:00:00'));
  assert.equal(from.getFullYear(), 2026);
  assert.equal(from.getMonth(), 0);
  assert.equal(to.getFullYear(), 2027);
});

test('_periodRange("all"): epoch → far future', () => {
  const { from, to } = window._periodRange('all');
  assert.equal(+from, 0);
  assert.ok(+to > +new Date('9999-12-31'));
});

test('_filterByPeriod: respects from/to bounds', () => {
  const f = family({ entries: [[1], [10], [25], [200]] });
  const flat = window._flatEntries([f]);
  const dayHits = window._filterByPeriod(flat, 'day');
  // Today's entries (within 24h of midnight today) — at least the 1h-ago one.
  assert.ok(dayHits.length >= 1);
  // Older entry from ~8 days ago shouldn't be in the "day" window.
  assert.ok(!dayHits.some(e => e.ts.startsWith(
    new Date(Date.now() - 200 * 3600 * 1000).toISOString().slice(0, 10)
  )));
});

test('_filterByPeriod: skips entries with unparseable timestamps', () => {
  const flat = [
    { ts: 'not-a-date', family: { quantity: 1, unit: 'cL', alcohol: 5 } },
    { ts: new Date().toISOString().slice(0, 16), family: { quantity: 1, unit: 'cL', alcohol: 5 } },
  ];
  const r = window._filterByPeriod(flat, 'day');
  assert.equal(r.length, 1);
});

test('_familiesInPeriod: drops families with no in-period entries', () => {
  const fIn = family({ name: 'In', entries: [[1]] });
  const fOut = family({ name: 'Out', entries: [[24 * 60]] }); // 60 days ago
  const r = window._familiesInPeriod([fIn, fOut], 'week');
  const names = r.map(f => f.name);
  assert.ok(names.includes('In'));
  assert.ok(!names.includes('Out'));
});

test('_familiesInPeriod: trims entries on a partially-in family', () => {
  const f = family({ name: 'Mix', entries: [[1], [24 * 60]] }); // recent + 60d ago
  const r = window._familiesInPeriod([f], 'week');
  assert.equal(r.length, 1);
  assert.equal(r[0].entries.length, 1);
});

test('_familiesInPeriod: returns input unchanged for "all" or no period', () => {
  const fams = [family({ name: 'A', entries: [[1]] })];
  assert.equal(window._familiesInPeriod(fams, 'all'), fams);
  assert.equal(window._familiesInPeriod(fams), fams);
});

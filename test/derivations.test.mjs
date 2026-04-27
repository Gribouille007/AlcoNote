// derive* helpers: hourly, daily, trends, rolling, session histograms,
// BAC projection.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootBundles, family } from './_boot.mjs';

bootBundles();

// Helper: build a family with explicit ISO timestamps so we can pin
// hour/day labels regardless of the test machine's clock.
function famAt(name, isos, opts = {}) {
  return {
    id: `f-${name}`,
    name, category: opts.category || 'Bière',
    quantity: opts.quantity || 33,
    unit: opts.unit || 'cL',
    alcohol: opts.alcohol || 5,
    rating: 0,
    entries: isos.map((ts, i) => ({ id: `e-${name}-${i}`, ts, place: null })),
  };
}

// ── deriveHourly ──────────────────────────────────────────────────
test('deriveHourly: 24-bin array with counts in correct slots', () => {
  const f = famAt('A', ['2026-04-15T08:30', '2026-04-15T08:45', '2026-04-15T22:10']);
  const bins = window.deriveHourly([f]);
  assert.equal(bins.length, 24);
  assert.equal(bins[8], 2);
  assert.equal(bins[22], 1);
  assert.equal(bins[0], 0);
});

test('deriveHourly: empty input → all zeros', () => {
  const bins = window.deriveHourly([]);
  assert.equal(bins.length, 24);
  assert.equal(bins.reduce((a, b) => a + b, 0), 0);
});

test('deriveHourly: ignores entries with malformed ts', () => {
  const fams = [{
    id: 'f', name: 'X', category: 'Bière', quantity: 33, unit: 'cL', alcohol: 5,
    entries: [{ id: 'e', ts: 'garbage', place: null }],
  }];
  const bins = window.deriveHourly(fams);
  assert.equal(bins.reduce((a, b) => a + b, 0), 0);
});

// ── deriveDaily ───────────────────────────────────────────────────
test('deriveDaily: returns 7 entries Monday-first with day index intact', () => {
  const daily = window.deriveDaily([]);
  assert.equal(daily.length, 7);
  // Monday at index 0 (day field = 1), Sunday at index 6 (day field = 0).
  assert.equal(daily[0].day, 1);
  assert.equal(daily[6].day, 0);
});

test('deriveDaily: counts an entry on the correct weekday', () => {
  // Wed Apr 15 2026 (day=3 because 0=Sun)
  const f = famAt('A', ['2026-04-15T20:00']);
  const daily = window.deriveDaily([f]);
  const wed = daily.find(d => d.day === 3);
  assert.equal(wed.v, 1);
});

test('deriveDaily: today flag set on exactly one row', () => {
  const daily = window.deriveDaily([]);
  const todays = daily.filter(d => d.today);
  assert.equal(todays.length, 1);
  assert.equal(todays[0].day, new Date().getDay());
});

// ── deriveTrends ──────────────────────────────────────────────────
test('deriveTrends: 6-month window with current month last', () => {
  const trends = window.deriveTrends([]);
  assert.equal(trends.labels.length, 6);
  assert.equal(trends.drinks.length, 6);
  assert.equal(trends.alcoholG.length, 6);
});

test('deriveTrends: counts entries in their respective months', () => {
  // Build entries in (current month) and (current month - 1).
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5, 12, 0)
    .toISOString().slice(0, 16);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5, 12, 0)
    .toISOString().slice(0, 16);
  const f = famAt('A', [thisMonth, thisMonth, lastMonth]);
  const trends = window.deriveTrends([f]);
  assert.equal(trends.drinks[5], 2); // current month — last index
  assert.equal(trends.drinks[4], 1); // previous month
});

test('deriveTrends: alcoholG roughly matches sum of grams', () => {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 5, 12, 0)
    .toISOString().slice(0, 16);
  // 50cL × 5% = ~19.7g per drink × 4 drinks ≈ 79g
  const f = famAt('A', [thisMonth, thisMonth, thisMonth, thisMonth],
    { quantity: 50, unit: 'cL', alcohol: 5 });
  const trends = window.deriveTrends([f]);
  assert.ok(trends.alcoholG[5] >= 70 && trends.alcoholG[5] <= 90,
    `expected ~79, got ${trends.alcoholG[5]}`);
});

// ── deriveRolling ─────────────────────────────────────────────────
test('deriveRolling: returns 30 daily buckets', () => {
  const rolling = window.deriveRolling([]);
  assert.equal(rolling.length, 30);
  for (const r of rolling) {
    assert.equal(typeof r.date, 'string');
    assert.equal(r.daily, 0);
    assert.equal(r.r7, 0);
    assert.equal(r.r30, 0);
  }
});

test('deriveRolling: r7 lags daily and r30 lags r7 after a spike', () => {
  // Single drink today produces a non-zero last bucket.
  const today = new Date().toISOString().slice(0, 16);
  const f = famAt('A', [today], { quantity: 50, unit: 'cL', alcohol: 5 });
  const rolling = window.deriveRolling([f]);
  const last = rolling[rolling.length - 1];
  assert.ok(last.daily > 15, `expected ~19g daily, got ${last.daily}`);
  // r7 averages 7 buckets including today, so it's ~daily/7.
  assert.ok(last.r7 < last.daily);
  assert.ok(last.r7 > last.daily / 8);
  // r30 averages all 30 buckets, even smaller.
  assert.ok(last.r30 < last.r7);
});

// ── deriveSessionDurationBuckets ─────────────────────────────────
test('deriveSessionDurationBuckets: 7 labeled buckets', () => {
  const buckets = window.deriveSessionDurationBuckets([]);
  assert.equal(buckets.length, 7);
  assert.equal(buckets[0].label, '<1h');
  assert.equal(buckets[6].label, '6h+');
});

test('deriveSessionDurationBuckets: single-entry session lands in <1h', () => {
  const f = family({ entries: [[1]] });
  const buckets = window.deriveSessionDurationBuckets([f]);
  assert.equal(buckets[0].v, 1);
  for (let i = 1; i < buckets.length; i++) assert.equal(buckets[i].v, 0);
});

test('deriveSessionDurationBuckets: 2.5h session lands in 2-3h', () => {
  const f = family({ entries: [[3], [0.5]] }); // 2.5h gap
  const buckets = window.deriveSessionDurationBuckets([f]);
  assert.equal(buckets[2].v, 1);
});

// ── deriveSessionBacBuckets ──────────────────────────────────────
test('deriveSessionBacBuckets: 5 labeled buckets', () => {
  const buckets = window.deriveSessionBacBuckets([]);
  assert.equal(buckets.length, 5);
  assert.equal(buckets[0].label, '<0.2');
  assert.equal(buckets[4].label, '1.2+');
});

test('deriveSessionBacBuckets: light session lands in lowest bucket', () => {
  // One 33cL × 5% drink → ~13g / (70 × 0.7) = 0.27 g/L → 0.2-0.5 bucket.
  // (No saved settings so weight=70, r=0.7.)
  window.__alcoUserSettings = {};
  const f = family({ entries: [[1]], quantity: 33, alcohol: 5 });
  const buckets = window.deriveSessionBacBuckets([f]);
  assert.equal(buckets[1].v, 1);
});

test('deriveSessionBacBuckets: respects userWeight from settings', () => {
  // Same drink, lighter user → higher peak BAC, lands in a higher bucket.
  window.__alcoUserSettings = { userWeight: 50 };
  const f = family({ entries: [[1]], quantity: 50, alcohol: 5 });
  const buckets = window.deriveSessionBacBuckets([f]);
  // 50cL × 5% = 19.7g / (50 × 0.7) = 0.56 g/L → 0.5-0.8 bucket.
  assert.equal(buckets[2].v, 1);
  window.__alcoUserSettings = {};
});

// ── deriveBacProjection ──────────────────────────────────────────
test('deriveBacProjection: returns a series spanning -2h to +8h', () => {
  const pts = window.deriveBacProjection([]);
  assert.equal(pts[0].t, -2);
  assert.equal(pts[pts.length - 1].t, 8);
  // 15-min steps over 10h = 41 points
  assert.equal(pts.length, 41);
});

test('deriveBacProjection: empty input → all zeros', () => {
  const pts = window.deriveBacProjection([]);
  assert.ok(pts.every(p => p.bac === 0));
});

test('deriveBacProjection: monotonically non-increasing after the entry', () => {
  // Single recent entry → BAC peaks now-ish then declines linearly.
  const f = family({ entries: [[0.1]], quantity: 50, alcohol: 5 });
  const pts = window.deriveBacProjection([f]);
  // Compare points strictly after t=0.5 (after absorption window) onward —
  // they should be non-increasing as elimination dominates.
  const after = pts.filter(p => p.t >= 0.5);
  for (let i = 1; i < after.length; i++) {
    assert.ok(after[i].bac <= after[i - 1].bac,
      `bac increased: ${after[i - 1].bac} → ${after[i].bac} at t=${after[i].t}`);
  }
});

test('deriveBacProjection: drops to 0 within ~horizonH after the entry', () => {
  const f = family({ entries: [[0.1]], quantity: 50, alcohol: 5 });
  const pts = window.deriveBacProjection([f]);
  // By +8h all alcohol should be eliminated for a typical drink.
  assert.equal(pts[pts.length - 1].bac, 0);
});

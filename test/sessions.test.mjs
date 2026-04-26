// _sessions: groups entries within a 4h gap of each other.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bootBundles, family } from './_boot.mjs';

bootBundles();

const flat = (fams) => window._flatEntries(fams);

test('_sessions: empty input returns empty array', () => {
  assert.deepEqual(window._sessions([]), []);
});

test('_sessions: single entry → one session of length 1', () => {
  const f = family({ entries: [[1]] });
  const sess = window._sessions(flat([f]));
  assert.equal(sess.length, 1);
  assert.equal(sess[0].length, 1);
});

test('_sessions: two entries 1h apart → one session', () => {
  const f = family({ entries: [[3], [2]] }); // 3h ago + 2h ago = 1h gap
  const sess = window._sessions(flat([f]));
  assert.equal(sess.length, 1);
  assert.equal(sess[0].length, 2);
});

test('_sessions: two entries 5h apart → two sessions', () => {
  const f = family({ entries: [[6], [1]] }); // 5h gap
  const sess = window._sessions(flat([f]));
  assert.equal(sess.length, 2);
  assert.equal(sess[0].length, 1);
  assert.equal(sess[1].length, 1);
});

test('_sessions: 4h gap exactly → still one session (boundary inclusive)', () => {
  // Sessions split when gap > 4h, so a gap of exactly 4h stays together.
  const f = family({ entries: [[5], [1]] }); // 4h gap
  const sess = window._sessions(flat([f]));
  assert.equal(sess.length, 1);
});

test('_sessions: 4h + 1ms gap splits', () => {
  const now = Date.now();
  const fakeFam = {
    name: 'X', category: 'B', quantity: 33, unit: 'cL', alcohol: 5, entries: [],
  };
  const earlier = new Date(now - (4 * 3600 * 1000 + 60 * 1000)).toISOString().slice(0, 16);
  const later = new Date(now).toISOString().slice(0, 16);
  fakeFam.entries = [
    { id: 'a', ts: earlier, place: null },
    { id: 'b', ts: later, place: null },
  ];
  const sess = window._sessions(flat([fakeFam]));
  assert.equal(sess.length, 2);
});

test('_sessions: cross-family entries cluster correctly', () => {
  const f1 = family({ name: 'A', entries: [[2]] });
  const f2 = family({ name: 'B', entries: [[1]] });
  // Entries from different families that are within 4h still form ONE session.
  const sess = window._sessions(flat([f1, f2]));
  assert.equal(sess.length, 1);
  assert.equal(sess[0].length, 2);
});

test('_sessions: out-of-order input is sorted before grouping', () => {
  const f1 = family({ name: 'A', entries: [[1]] });
  const f2 = family({ name: 'B', entries: [[3]] });
  const flatList = [...flat([f1]), ...flat([f2])]; // chronologically reversed
  const sess = window._sessions(flatList);
  assert.equal(sess.length, 1);
  assert.equal(sess[0].length, 2);
  // Internally sorted oldest-first.
  assert.ok(Date.parse(sess[0][0].ts) < Date.parse(sess[0][1].ts));
});

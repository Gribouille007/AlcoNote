// Classement du groupe (proto/leaderboard.jsx) : helpers PURS — stats
// disponibles par période, repli de stat, rang « compétition », non classés
// (BAC non partagé / aucune valeur), note « Tout », médailles.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
global.dbManager = { getSetting: async () => null, getAllSettings: async () => ({}) };
global.SHARE_CONFIG = { TRANSPORT: 'mock', PULL_INTERVAL_MS: 600000 };
loadDist('shared', 'data', 'stats', 'share', 'compare', 'leaderboard');

const {
  LEADERBOARD_STATS, LEADERBOARD_GROUPS, leaderboardStatsFor, resolveLeaderboardStat,
  rankLeaderboard, leaderboardAllNote, medalColors, fmtRank, buildCompareProfile, T,
} = global;

const stat = (id) => LEADERBOARD_STATS.find((s) => s.id === id);
const beer = (date, time) => ({
  name: 'Jupiler', category: 'Bière', quantity: 50, unit: 'cL', alcoholContent: 5, date, time,
});
const NOW = new Date('2026-09-30T12:00:00');
const ANCHOR = new Date('2026-09-15T12:00:00');
const prof = (drinks, bac = true) =>
  buildCompareProfile(drinks, { weight: 70, gender: 'male', bacAvailable: bac }, 'month', ANCHOR, NOW);

test('registre : trois familles (Volume, Fréquence, Alcoolémie), ids uniques', () => {
  assert.deepEqual(LEADERBOARD_GROUPS.map((g) => g.id), ['volume', 'frequency', 'bac']);
  const ids = LEADERBOARD_STATS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of LEADERBOARD_STATS) {
    assert.ok(LEADERBOARD_GROUPS.some((g) => g.id === s.group), `${s.id} : famille connue`);
    assert.equal(typeof s.fmt(1), 'string');
  }
  assert.ok(LEADERBOARD_STATS.filter((s) => s.group === 'bac').every((s) => s.bac));
});

test('leaderboardStatsFor — pas de stat « par jour » sur Jour, /sem. sur longues périodes', () => {
  const today = leaderboardStatsFor('today').map((s) => s.id);
  assert.ok(!today.includes('perDay') && !today.includes('drinkDays') && !today.includes('soberDays'));
  assert.ok(!today.includes('perWeek'));
  assert.ok(today.includes('grams') && today.includes('peakBac'));
  assert.ok(!leaderboardStatsFor('week').some((s) => s.id === 'perWeek'));
  assert.ok(leaderboardStatsFor('month').some((s) => s.id === 'perWeek'));
});

test('resolveLeaderboardStat — repli dans la famille, puis 1re dispo', () => {
  assert.equal(resolveLeaderboardStat('soberDays', 'month').id, 'soberDays');
  // Fréquence n'a AUCUNE stat sur « Jour » → 1re stat disponible.
  assert.equal(resolveLeaderboardStat('soberDays', 'today').id, 'grams');
  // « Boissons par jour » absente sur Jour → reste dans Volume.
  assert.equal(resolveLeaderboardStat('perDay', 'today').group, 'volume');
  assert.equal(resolveLeaderboardStat('inconnu', 'month').id, 'grams');
});

test('rankLeaderboard — tri décroissant, ex æquo (1, 1, 3), départage alphabétique', () => {
  const entries = [
    { id: 'z', name: 'Zoé', profile: { grams: 20 } },
    { id: 'a', name: 'Anna', profile: { grams: 50 } },
    { id: 'b', name: 'Bob', profile: { grams: 50 } },
    { id: 'm', name: 'Moi', isMe: true, profile: { grams: 10 } },
  ];
  const r = rankLeaderboard(entries, stat('grams'));
  assert.deepEqual(r.ranked.map((e) => [e.name, e.rank]), [['Anna', 1], ['Bob', 1], ['Zoé', 3], ['Moi', 4]]);
  assert.equal(r.max, 50);
  assert.equal(r.ranked[0].display, '50g');
  assert.equal(r.unranked.length, 0);
});

test('rankLeaderboard — égalité sur la valeur AFFICHÉE (pas d’écart invisible)', () => {
  const r = rankLeaderboard([
    { id: 'a', name: 'A', profile: { volumeCl: 121 } },
    { id: 'b', name: 'B', profile: { volumeCl: 119 } },
  ], stat('volume'));
  assert.equal(r.ranked[0].display, r.ranked[1].display);   // « 1.2L » des deux côtés
  assert.deepEqual(r.ranked.map((e) => e.rank), [1, 1]);
});

test('rankLeaderboard — BAC non partagé et « aucune session » : non classés, en bas', () => {
  const withBac = prof([beer('2026-09-10', '20:00'), beer('2026-09-10', '21:00')]);
  const noSession = prof([]);
  const entries = [
    { id: 'me', name: 'Toi', isMe: true, bacAvailable: true, profile: withBac },
    { id: 'tom', name: 'Tom', bacAvailable: false, profile: prof([beer('2026-09-11', '20:00')], false) },
    { id: 'lea', name: 'Léa', bacAvailable: true, profile: noSession },
  ];
  const peak = rankLeaderboard(entries, stat('peakBac'));
  assert.deepEqual(peak.ranked.map((e) => e.name), ['Toi']);
  assert.deepEqual(peak.unranked.map((e) => [e.name, e.reason]),
    [['Léa', 'Aucune session'], ['Tom', 'BAC non partagé']]);
  // Stat de volume : Tom EST classé (le partage du BAC n'y joue pas).
  const grams = rankLeaderboard(entries, stat('grams'));
  assert.ok(grams.ranked.some((e) => e.name === 'Tom'));
  assert.equal(grams.ranked.find((e) => e.name === 'Léa').value, 0, '0 est une vraie valeur');
});

test('rankLeaderboard — sans aucune entrée / tout à zéro', () => {
  assert.deepEqual(rankLeaderboard([], stat('grams')), { ranked: [], unranked: [], max: 0 });
  const z = rankLeaderboard([{ id: 'a', name: 'A', profile: { grams: 0 } }], stat('grams'));
  assert.equal(z.max, 0);
});

test('leaderboardAllNote — seulement sur « Tout », pour un cumul, historiques inégaux', () => {
  const e = [{ profile: { days: 30 } }, { profile: { days: 400 } }];
  assert.ok(leaderboardAllNote('all', stat('grams'), e));
  assert.equal(leaderboardAllNote('month', stat('grams'), e), null);
  assert.equal(leaderboardAllNote('all', stat('perDay'), e), null, 'une moyenne /jour est équitable');
  assert.equal(leaderboardAllNote('all', stat('grams'), [{ profile: { days: 30 } }, { profile: { days: 31 } }]), null);
});

test('medalColors / fmtRank — or, argent, bronze via tokens ; ordinaux français', () => {
  assert.equal(medalColors(1).fg, T.medalGold);
  assert.equal(medalColors(2).fg, T.medalSilver);
  assert.equal(medalColors(3).soft, T.medalBronzeSoft);
  assert.equal(medalColors(4), null);
  assert.equal(fmtRank(1), '1er');
  assert.equal(fmtRank(2), '2e');
});

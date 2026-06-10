// Logique stats/BAC de proto/stats.jsx : périodes, agrégats, moteur Widmark
// (sessions + courbe temps réel), streaks, formatage de durées.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared', 'data', 'stats');

const {
  getPeriodRange, shiftAnchor, periodLabel, filterDrinksInRange,
  aggregateGeneral, computeBACSessions, computeBacOverTime,
  computeBourreTime, computeStreak, computeStreakRecord, fmtBourreTime,
  BAC_ELIM_RATE, BAC_ABSORPTION_H, DEFAULT_WEIGHT_KG, widmarkR,
  localDate, localTime, drinkAlcoholGrams,
} = global;

const HOUR = 3600_000;
const ymd = (d) => [d.getFullYear(), d.getMonth(), d.getDate()];

// ── Périodes ───────────────────────────────────────────────────────

test('getPeriodRange — today / week (lundi) / month / year / school / all', () => {
  // today : start = end = minuit de l'ancre.
  const t = getPeriodRange('today', new Date(2026, 5, 9, 15, 30));
  assert.deepEqual(ymd(t.start), [2026, 5, 9]);
  assert.deepEqual(ymd(t.end), [2026, 5, 9]);
  assert.equal(t.start.getHours(), 0);

  // week : commence le lundi — y compris quand l'ancre est un dimanche.
  const wSun = getPeriodRange('week', new Date(2026, 5, 7)); // dimanche 7 juin
  assert.deepEqual(ymd(wSun.start), [2026, 5, 1], 'dimanche → lundi précédent');
  assert.deepEqual(ymd(wSun.end), [2026, 5, 7]);
  const wTue = getPeriodRange('week', new Date(2026, 5, 9)); // mardi 9 juin
  assert.deepEqual(ymd(wTue.start), [2026, 5, 8]);
  assert.deepEqual(ymd(wTue.end), [2026, 5, 14]);

  // month : 1er → dernier jour.
  const m = getPeriodRange('month', new Date(2026, 5, 9));
  assert.deepEqual(ymd(m.start), [2026, 5, 1]);
  assert.deepEqual(ymd(m.end), [2026, 5, 30]);

  // year.
  const y = getPeriodRange('year', new Date(2026, 5, 9));
  assert.deepEqual(ymd(y.start), [2026, 0, 1]);
  assert.deepEqual(ymd(y.end), [2026, 11, 31]);

  // school : des deux côtés du pivot septembre.
  const sJune = getPeriodRange('school', new Date(2026, 5, 9)); // juin → année 2025-2026
  assert.deepEqual(ymd(sJune.start), [2025, 8, 1]);
  assert.deepEqual(ymd(sJune.end), [2026, 7, 31]);
  const sOct = getPeriodRange('school', new Date(2026, 9, 1)); // octobre → année 2026-2027
  assert.deepEqual(ymd(sOct.start), [2026, 8, 1]);
  assert.deepEqual(ymd(sOct.end), [2027, 7, 31]);

  // all : démarre en 2000.
  const all = getPeriodRange('all', new Date(2026, 5, 9));
  assert.deepEqual(ymd(all.start), [2000, 0, 1]);
});

test('shiftAnchor — ±1 par période, sans débordement de jour (régression)', () => {
  assert.deepEqual(ymd(shiftAnchor('today', new Date(2026, 5, 9), 1)), [2026, 5, 10]);
  assert.deepEqual(ymd(shiftAnchor('week', new Date(2026, 5, 9), -1)), [2026, 5, 2]);
  assert.deepEqual(ymd(shiftAnchor('month', new Date(2026, 5, 9), 1)), [2026, 6, 9]);
  assert.deepEqual(ymd(shiftAnchor('year', new Date(2026, 5, 9), 1)), [2027, 5, 9]);
  assert.deepEqual(ymd(shiftAnchor('school', new Date(2026, 5, 9), 1)), [2027, 5, 9]);
  assert.deepEqual(ymd(shiftAnchor('all', new Date(2026, 5, 9), 1)), [2026, 5, 9]);
  // RÉGRESSION : 31 janvier +1 mois doit donner février (jour clampé),
  // pas le 3 mars (sinon « mois suivant » saute février).
  assert.deepEqual(ymd(shiftAnchor('month', new Date(2026, 0, 31), 1)), [2026, 1, 28]);
  assert.deepEqual(ymd(shiftAnchor('month', new Date(2026, 2, 31), -1)), [2026, 1, 28]);
  // 29 février + 1 an → 28 février (pas le 1er mars).
  assert.deepEqual(ymd(shiftAnchor('year', new Date(2024, 1, 29), 1)), [2025, 1, 28]);
});

test('periodLabel — libellés français', () => {
  assert.equal(periodLabel('today', new Date(2026, 5, 9)), 'Mardi 9 juin');
  assert.equal(periodLabel('week', new Date(2026, 5, 9)), '8 – 14 juin 2026');
  assert.equal(periodLabel('month', new Date(2026, 5, 9)), 'Juin 2026');
  assert.equal(periodLabel('year', new Date(2026, 5, 9)), '2026');
  assert.equal(periodLabel('school', new Date(2026, 5, 9)), 'Année 2025-2026');
  assert.equal(periodLabel('all', new Date(2026, 5, 9)), 'Depuis le début');
});

test('filterDrinksInRange — bornes ISO inclusives', () => {
  const drinks = [
    { date: '2026-06-01' }, { date: '2026-06-09' }, { date: '2026-06-15' },
  ];
  const r = filterDrinksInRange(drinks, new Date(2026, 5, 1), new Date(2026, 5, 9));
  assert.deepEqual(r.map((d) => d.date), ['2026-06-01', '2026-06-09']);
});

// ── Agrégats généraux ──────────────────────────────────────────────

test('aggregateGeneral — totaux + histogrammes, catégories canonicalisées', () => {
  const drinks = [
    { name: 'Chouffe', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 8, date: '2026-06-08', time: '20:30' },
    // RÉGRESSION : « Bière » avec espace final doit replier dans la même clé.
    { name: 'chouffe', category: 'Bière ', quantity: 0.5, unit: 'L', alcoholContent: 8, date: '2026-06-09', time: '21:15' },
    { name: 'Spritz', category: undefined, quantity: 1, unit: 'EcoCup', alcoholContent: 11, date: 'invalid', time: 'xx:yy' },
  ];
  const s = aggregateGeneral(drinks);
  assert.equal(s.count, 3);
  assert.equal(s.volumeCl, 33 + 50 + 25);
  assert.equal(s.uniqueCount, 2, 'noms insensibles à la casse');
  assert.deepEqual(Object.keys(s.byCategory).sort(), ['Autre', 'Bière']);
  assert.equal(s.byCategory['Bière'], 2, 'graphies repliées (canonicalCat)');
  assert.equal(s.byCategory['Autre'], 1, 'catégorie absente → Autre');
  assert.equal(s.byHour[20], 1);
  assert.equal(s.byHour[21], 1);
  assert.equal(s.byHour.reduce((a, b) => a + b, 0), 2, 'heure malformée ignorée');
  assert.equal(s.byDow.reduce((a, b) => a + b, 0), 2, 'date invalide ignorée');
  assert.equal(s.byDow[1], 1, 'lundi 8 juin');
  assert.equal(s.byDow[2], 1, 'mardi 9 juin');
  const empty = aggregateGeneral([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.volumeCl, 0);
});

// ── Moteur Widmark : sessions ──────────────────────────────────────

// 1 bière 50 cL à 5 % pour 70 kg homme : 19,725 g d'alcool pur,
// pic théorique P = 19725 / (70 × 0,68) ≈ 414,39 mg/L.
const beer = (date, time) => ({
  name: 'Pils', category: 'Bière', quantity: 50, unit: 'cL', alcoholContent: 5, date, time,
});
const P = (19.725 * 1000) / (70 * 0.68);

test('computeBACSessions — pic, fin de session et bornes exactes', () => {
  const sessions = computeBACSessions([beer('2026-06-01', '20:00')], 70, 'male');
  assert.equal(sessions.length, 1);
  const s = sessions[0];
  const t0 = new Date('2026-06-01T20:00').getTime();
  assert.equal(s.startTs, t0);
  // L'élimination court PENDANT l'absorption : pic réel = P − elim×T_abs
  // atteint exactement à t0 + 30 min.
  const expectedPeak = P - BAC_ELIM_RATE * BAC_ABSORPTION_H;
  assert.ok(Math.abs(s.peakBac - expectedPeak) < 1e-6, `peakBac ${s.peakBac} ≈ ${expectedPeak}`);
  assert.equal(s.peakTs, t0 + BAC_ABSORPTION_H * HOUR);
  // Fin de session : tout l'alcool éliminé à taux constant → t0 + P/elim heures.
  const expectedEnd = t0 + (P / BAC_ELIM_RATE) * HOUR;
  assert.ok(Math.abs(s.endTs - expectedEnd) < 1000, `endTs ${s.endTs} ≈ ${expectedEnd}`);
  assert.ok(s.avgBac > 0 && s.avgBac < s.peakBac, 'moyenne entre 0 et le pic');
  assert.ok(Math.abs(s.grams - 19.725) < 1e-9);
  assert.equal(s.drinks.length, 1);
  assert.match(s.id, /^sess::/);
});

test('computeBACSessions — 2 boissons espacées de 12 h → 2 sessions', () => {
  const sessions = computeBACSessions(
    [beer('2026-06-01', '20:00'), beer('2026-06-02', '08:00')], 70, 'male'
  );
  assert.equal(sessions.length, 2);
  assert.ok(sessions[0].endTs < sessions[1].startTs, 'la 1re session se clôt avant la 2e');
});

test('computeBACSessions — femme (r=0.55) > homme, entrées invalides exclues', () => {
  const m = computeBACSessions([beer('2026-06-01', '20:00')], 70, 'male')[0];
  const f = computeBACSessions([beer('2026-06-01', '20:00')], 70, 'female')[0];
  assert.ok(f.peakBac > m.peakBac, 'facteur de distribution plus faible → pic plus haut');
  assert.equal(widmarkR('female'), 0.55);
  assert.equal(widmarkR('male'), 0.68);
  assert.deepEqual(computeBACSessions([], 70, 'male'), []);
  assert.deepEqual(computeBACSessions([{ name: 'X', quantity: 33 }], 70, 'male'), [],
    'sans date/heure → exclu');
});

// ── Moteur Widmark : courbe temps réel ─────────────────────────────

test('computeBacOverTime — pas d’élimination avant la 1re boisson, courbe bornée', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
  const d = beer(localDate(twoHoursAgo), localTime(twoHoursAgo));
  const out = computeBacOverTime([d], 70, 'male');

  assert.equal(out.points[0].bac, 0, 'la courbe démarre à 0 à la 1re boisson');
  assert.ok(Math.abs(out.points[0].t - out.firstT) < 1e-3);
  // Pic au point firstT + 0,5 h ≈ P − 75.
  const peakPt = out.points.reduce((a, b) => (b.bac > a.bac ? b : a));
  assert.ok(Math.abs(peakPt.bac - (P - 75)) < 2, `pic ${peakPt.bac} ≈ ${P - 75}`);
  assert.ok(Math.abs(peakPt.t - (out.firstT + BAC_ABSORPTION_H)) < 0.02);
  // current = P − élimination depuis la 1re boisson (timestamp à la minute →
  // petite tolérance sur l'horloge).
  const ts = new Date(`${d.date}T${d.time}`).getTime();
  const elapsedH = (Date.now() - ts) / HOUR;
  const expected = Math.round(Math.max(0, P - elapsedH * BAC_ELIM_RATE));
  assert.ok(Math.abs(out.current - expected) <= 1, `current ${out.current} ≈ ${expected}`);
  // La courbe s'étend au moins 30 min après maintenant.
  assert.ok(out.points[out.points.length - 1].t >= 0.5 - 1e-6);
  assert.ok(Math.abs(out.sobrietyT - (out.firstT + P / BAC_ELIM_RATE)) < 1e-6);
});

test('computeBacOverTime — lookback 24 h et boissons futures exclues', () => {
  const past = new Date(Date.now() - 25 * HOUR);
  const future = new Date(Date.now() + 2 * HOUR);
  const out = computeBacOverTime(
    [beer(localDate(past), localTime(past)), beer(localDate(future), localTime(future))],
    70, 'male'
  );
  assert.equal(out.drinks.length, 0);
  assert.equal(out.current, 0);
  assert.deepEqual(out.points, []);
  const empty = computeBacOverTime([], 70, 'male');
  assert.equal(empty.current, 0);
  assert.deepEqual(empty.points, []);
});

test('computeBacOverTime — poids/genre par défaut', () => {
  const oneHourAgo = new Date(Date.now() - 1 * HOUR);
  const d = beer(localDate(oneHourAgo), localTime(oneHourAgo));
  const def = computeBacOverTime([d], null, undefined); // → 70 kg homme
  const heavy = computeBacOverTime([d], 100, 'male');
  assert.ok(def.current > heavy.current, 'poids plus élevé → BAC plus bas');
  assert.equal(DEFAULT_WEIGHT_KG, 70);
});

// ── Temps bourré / streaks / formats ───────────────────────────────

test('computeBourreTime — clamp aux bornes de la période', () => {
  const sessions = [{ startTs: new Date(2026, 5, 8, 22).getTime(), endTs: new Date(2026, 5, 9, 2).getTime() }];
  // Période = le 8 juin uniquement (end à minuit, étendu à fin de journée).
  const range = { start: new Date(2026, 5, 8), end: new Date(2026, 5, 8) };
  assert.equal(computeBourreTime(sessions, range), 2 * HOUR, 'clampé à minuit (fin de journée du 8)');
  // Période couvrant tout → durée complète.
  const wide = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 30) };
  assert.equal(computeBourreTime(sessions, wide), 4 * HOUR);
  assert.equal(computeBourreTime([], wide), 0);
  assert.equal(computeBourreTime(sessions, null), 0);
});

test('computeStreak — jours consécutifs, tolérance « hier »', () => {
  const today = new Date();
  const day = (n) => localDate(new Date(today.getTime() - n * 24 * HOUR));
  assert.equal(computeStreak([{ date: day(0) }, { date: day(1) }, { date: day(2) }]), 3);
  assert.equal(computeStreak([{ date: day(1) }]), 1, 'hier sans aujourd’hui → streak vivant');
  assert.equal(computeStreak([{ date: day(2) }]), 0, 'avant-hier seulement → cassé');
  assert.equal(computeStreak([]), 0);
});

test('computeStreakRecord — plus longue série all-time, doublons dédupliqués', () => {
  const drinks = ['2026-01-01', '2026-01-02', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07']
    .map((date) => ({ date }));
  assert.equal(computeStreakRecord(drinks), 3);
  assert.equal(computeStreakRecord([{ date: '2026-01-01' }]), 1);
  assert.equal(computeStreakRecord([]), 0);
});

test('fmtBourreTime — unités lisibles et retenue des heures', () => {
  assert.equal(fmtBourreTime(0), '—');
  assert.equal(fmtBourreTime(-5), '—');
  assert.equal(fmtBourreTime(45 * 60_000), '45m');
  assert.equal(fmtBourreTime(125 * 60_000), '2h05');
  assert.equal(fmtBourreTime(2 * HOUR), '2h');
  assert.equal(fmtBourreTime(24 * HOUR), '1j');
  assert.equal(fmtBourreTime(25 * HOUR), '1j 1h');
  // 1j 23h45 : l'heure arrondie atteint 24 → retenue sur le jour.
  assert.equal(fmtBourreTime((47 * 60 + 45) * 60_000), '2j');
});

test('drinkAlcoholGrams — cohérence avec le moteur BAC', () => {
  assert.ok(Math.abs(drinkAlcoholGrams(beer('2026-06-01', '20:00')) - 19.725) < 1e-9);
});

// ── Ordre des sections (registry + réorganisation) ─────────────────

test('normalizeSectionOrder — défaut, ids inconnus ignorés, nouveaux appendés', () => {
  const { normalizeSectionOrder, DEFAULT_SECTION_ORDER } = global;
  // null / non-array → ordre par défaut complet.
  assert.deepEqual(normalizeSectionOrder(null), DEFAULT_SECTION_ORDER);
  assert.deepEqual(normalizeSectionOrder('garbage'), DEFAULT_SECTION_ORDER);

  // Permutation complète conservée telle quelle.
  const reversed = [...DEFAULT_SECTION_ORDER].reverse();
  assert.deepEqual(normalizeSectionOrder(reversed), reversed);

  // Id inconnu (section supprimée d'une vieille version) → ignoré ;
  // ids manquants (nouvelles sections) → appendés dans l'ordre par défaut.
  const partial = ['bac', 'ghost-section', 'general'];
  const norm = normalizeSectionOrder(partial);
  assert.deepEqual(norm.slice(0, 2), ['bac', 'general']);
  assert.equal(norm.length, DEFAULT_SECTION_ORDER.length, 'rien de perdu, rien de doublé');
  for (const id of DEFAULT_SECTION_ORDER) assert.ok(norm.includes(id), `id ${id} présent`);
});

test('moveInArray — déplacement immuable + bornes', () => {
  const { moveInArray } = global;
  const a = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveInArray(a, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveInArray(a, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(a, ['a', 'b', 'c', 'd'], 'source intacte');
  assert.equal(moveInArray(a, 1, 1), a, 'no-op → même référence');
  assert.equal(moveInArray(a, -1, 2), a, 'from hors bornes → no-op');
  assert.equal(moveInArray(a, 0, 9), a, 'to hors bornes → no-op');
});

test('dragTargetIndex — arrondi à la ligne la plus proche, clamp', () => {
  const { dragTargetIndex } = global;
  const STEP = 56, N = 9;
  assert.equal(dragTargetIndex(3, 0, STEP, N), 3, 'dy nul → même index');
  assert.equal(dragTargetIndex(3, STEP * 0.6, STEP, N), 4, '+0.6 ligne → suivante');
  assert.equal(dragTargetIndex(3, -STEP * 1.4, STEP, N), 2, '−1.4 ligne → arrondi −1');
  assert.equal(dragTargetIndex(0, -500, STEP, N), 0, 'clamp haut');
  assert.equal(dragTargetIndex(8, 500, STEP, N), 8, 'clamp bas');
});

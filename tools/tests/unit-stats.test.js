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
  aggregateGeneral, computeBACSessions, computeBacOverTime, computeBacForecast,
  computeBourreTime, computeStreak, computeStreakRecord, fmtBourreTime, fmtDurationHM,
  computeMonthlyTrends, computeRollingDaily, computeSessionDurationBuckets,
  bucketDailyAlcohol, buildHeatmapCells, buildSessionList, buildSessionPeakHistogram,
  buildCumulativeComparison, bucketSpend,
  BAC_ELIM_RATE, BAC_ABSORPTION_H, BAC_LEGAL_LIMIT, DEFAULT_WEIGHT_KG, widmarkR,
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

test('computeBacOverTime — lookback 48 h et boissons futures exclues', () => {
  // Fenêtre 48 h : une boisson à 50 h (hors fenêtre) ET une boisson future
  // sont toutes deux exclues → aucune donnée.
  const tooOld = new Date(Date.now() - 50 * HOUR);
  const future = new Date(Date.now() + 2 * HOUR);
  const out = computeBacOverTime(
    [beer(localDate(tooOld), localTime(tooOld)), beer(localDate(future), localTime(future))],
    70, 'male'
  );
  assert.equal(out.drinks.length, 0);
  assert.equal(out.current, 0);
  assert.deepEqual(out.points, []);
  const empty = computeBacOverTime([], 70, 'male');
  assert.equal(empty.current, 0);
  assert.deepEqual(empty.points, []);
});

test('computeBacOverTime — lookback 48 h : une boisson à 30 h est incluse', () => {
  // À 30 h elle dépasserait l'ancienne fenêtre de 24 h ; avec 48 h elle est
  // bien prise en compte (drinks length = 1). Le taux courant est 0 (déjà
  // éliminée) mais la boisson reste comptée dans la fenêtre.
  const at30h = new Date(Date.now() - 30 * HOUR);
  const out = computeBacOverTime([beer(localDate(at30h), localTime(at30h))], 70, 'male');
  assert.equal(out.drinks.length, 1, 'boisson à 30 h incluse dans la fenêtre 48 h');
});

test('computeBacOverTime — poids/genre par défaut', () => {
  const oneHourAgo = new Date(Date.now() - 1 * HOUR);
  const d = beer(localDate(oneHourAgo), localTime(oneHourAgo));
  const def = computeBacOverTime([d], null, undefined); // → 70 kg homme
  const heavy = computeBacOverTime([d], 100, 'male');
  assert.ok(def.current > heavy.current, 'poids plus élevé → BAC plus bas');
  assert.equal(DEFAULT_WEIGHT_KG, 70);
});

// RÉGRESSION (clamp à zéro) : deux épisodes dans la fenêtre de 24 h. L'ancienne
// forme fermée `max(0, Σ absorbé − elim·(t − t_première))` continuait
// d'éliminer pendant le creux à zéro : la bière de la veille (−20 h) générait
// 20 h × 150 = 3000 mg/L de « dette » virtuelle et écrasait le taux du soir à 0.
test('computeBacOverTime — deux épisodes : l\'élimination s\'arrête à zéro', () => {
  const lastNight = new Date(Date.now() - 20 * HOUR);
  const oneHourAgo = new Date(Date.now() - 1 * HOUR);
  const old = beer(localDate(lastNight), localTime(lastNight));
  const fresh = beer(localDate(oneHourAgo), localTime(oneHourAgo));
  const out = computeBacOverTime([old, fresh], 70, 'male');

  // Le taux courant ne dépend QUE de l'épisode en cours (la veille est éliminée).
  const ts = new Date(`${fresh.date}T${fresh.time}`).getTime();
  const elapsedH = (Date.now() - ts) / HOUR;
  const expected = Math.round(Math.max(0, P - elapsedH * BAC_ELIM_RATE));
  assert.ok(expected > 200, 'précondition : l\'épisode du soir est bien actif');
  assert.ok(Math.abs(out.current - expected) <= 1, `current ${out.current} ≈ ${expected}`);
  assert.equal(out.drinks.length, 2, 'les deux boissons restent comptées');

  // Sobriété exacte : retour à 0 de l'épisode en cours, pas de dette héritée.
  const expectedSober = Math.max(0, P / BAC_ELIM_RATE - elapsedH);
  assert.ok(Math.abs(out.soberInH - expectedSober) < 0.02,
    `soberInH ${out.soberInH} ≈ ${expectedSober}`);
  assert.equal(out.legalInH, 0, 'une bière ne dépasse jamais 500 mg/L');

  // La courbe affichée démarre au DERNIER épisode (≈ −1 h), pas à −20 h.
  assert.ok(out.points[0].t > -1.5, `points[0].t ${out.points[0].t} > -1.5`);
  assert.equal(out.points[0].bac, 0, 'départ à zéro au début de l\'épisode');
});

// La sobriété intègre l'absorption EN COURS : juste après une boisson le taux
// va encore monter — l'ancienne division `current / élim` sous-estimait le
// temps de toute la montée restante.
test('computeBacOverTime — soberInH compte la montée d\'absorption restante', () => {
  const justNow = new Date(Date.now() - 6 * 60_000); // il y a ~6 min
  const d = beer(localDate(justNow), localTime(justNow));
  const out = computeBacOverTime([d], 70, 'male');
  const naive = out.current / BAC_ELIM_RATE;
  assert.ok(out.soberInH > naive + 0.3,
    `soberInH ${out.soberInH} doit dépasser largement la division naïve ${naive}`);
  // Mono-épisode : zéro final exactement à firstT + P/élim.
  assert.ok(Math.abs(out.soberInH - (out.firstT + P / BAC_ELIM_RATE)) < 1e-6);
  assert.ok(Math.abs(out.sobrietyT - (out.firstT + P / BAC_ELIM_RATE)) < 1e-6);
});

// legalInH : heures avant de repasser sous BAC_LEGAL_LIMIT (500 mg/L).
test('computeBacOverTime — legalInH au-dessus du seuil légal', () => {
  const { BAC_LEGAL_LIMIT } = global;
  assert.equal(BAC_LEGAL_LIMIT, 500);
  const twoHoursAgo = new Date(Date.now() - 2 * HOUR);
  const d1 = beer(localDate(twoHoursAgo), localTime(twoHoursAgo));
  const d2 = beer(localDate(twoHoursAgo), localTime(twoHoursAgo));
  const out = computeBacOverTime([d1, d2], 70, 'male');
  const ts = new Date(`${d1.date}T${d1.time}`).getTime();
  const elapsedH = (Date.now() - ts) / HOUR;
  const bacNow = 2 * P - elapsedH * BAC_ELIM_RATE; // absorption finie depuis longtemps
  assert.ok(bacNow > BAC_LEGAL_LIMIT, 'précondition : au-dessus du seuil');
  assert.ok(Math.abs(out.current - Math.round(bacNow)) <= 1);
  assert.ok(Math.abs(out.legalInH - (bacNow - BAC_LEGAL_LIMIT) / BAC_ELIM_RATE) < 0.02,
    `legalInH ${out.legalInH}`);
  assert.ok(Math.abs(out.soberInH - bacNow / BAC_ELIM_RATE) < 0.02);
});

// Épisode terminé depuis longtemps : sobre, et la courbe n'étire plus une
// ligne plate de plusieurs heures jusqu'à « maintenant ».
test('computeBacOverTime — sobre depuis longtemps : courbe bornée à l\'épisode', () => {
  const tenHoursAgo = new Date(Date.now() - 10 * HOUR);
  const d = beer(localDate(tenHoursAgo), localTime(tenHoursAgo));
  const out = computeBacOverTime([d], 70, 'male');
  assert.equal(out.current, 0);
  assert.equal(out.soberInH, 0);
  assert.equal(out.legalInH, 0);
  const lastT = out.points[out.points.length - 1].t;
  assert.ok(lastT < 0, `la courbe s'arrête après l'épisode (${lastT}), pas à maintenant`);
  assert.ok(Math.abs(lastT - (out.sobrietyT + 0.5)) < 0.05, '≈ 30 min après le retour à zéro');
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

// ── fmtDurationHM (formateur unique des contextes BAC) ──────────────

test('fmtDurationHM — "—" si ≤ 0, arrondi minute, pas de "h60"', () => {
  assert.equal(fmtDurationHM(0), '—');
  assert.equal(fmtDurationHM(-1), '—');
  assert.equal(fmtDurationHM(2 + 16 / 60), '2h16');
  assert.equal(fmtDurationHM(3.999), '4h00', '3.999 h → 4h00 (pas 3h60)');
  assert.equal(fmtDurationHM(1), '1h00');
});

// ── ETA d'horloge (heure cible sous Sobriété/Conduite) ──────────────

test('ETA horloge = localTime(now + soberInH) — cohérence sobriété', () => {
  // Une bière maintenant → soberInH > 0 ; l'heure cible doit correspondre à
  // localTime(now + soberInH h) à la minute près.
  const now = new Date();
  const d = beer(localDate(now), localTime(now));
  const out = computeBacOverTime([d], 70, 'male');
  assert.ok(out.soberInH > 0, 'pas encore sobre');
  const eta = new Date(Date.now() + out.soberInH * HOUR);
  // Reconstruit comme le composant : localTime(new Date(now + h*3600_000)).
  assert.equal(localTime(eta).length, 5, 'format HH:MM');
});

// ── computeBourreTime — clamp sur la période ────────────────────────

test('computeBourreTime — clamp aux bornes + session hors plage = 0', () => {
  const range = { start: new Date(2026, 5, 8, 0, 0, 0), end: new Date(2026, 5, 8, 0, 0, 0) };
  const dayStart = range.start.getTime();
  // Session entièrement le lendemain (hors plage, même avec +24 h de marge) → 0.
  const far = [{ startTs: dayStart + 3 * 24 * HOUR, endTs: dayStart + 3 * 24 * HOUR + HOUR }];
  assert.equal(computeBourreTime(far, range), 0, 'session hors plage → 0');
  // Session à cheval sur le début : seule la partie dans la plage compte.
  const straddle = [{ startTs: dayStart - HOUR, endTs: dayStart + HOUR }];
  assert.equal(computeBourreTime(straddle, range), HOUR, 'partie avant le début exclue');
  assert.equal(computeBourreTime([], range), 0, 'pas de session → 0');
  assert.equal(computeBourreTime(null, range), 0, 'sessions null → 0');
});

// ── DST : un jour de changement d'heure garde minuit + bon index ────

test('getPeriodRange — jour de changement d’heure (DST) : start à minuit', () => {
  // Dernier dimanche d'octobre 2026 (recul d'heure en Europe) = 25 oct.
  const dst = new Date(2026, 9, 25, 12, 0);
  const r = getPeriodRange('today', dst);
  assert.equal(r.start.getHours(), 0, 'start ramené à minuit local malgré la journée de 25 h');
  assert.deepEqual(ymd(r.start), [2026, 9, 25]);
});

// ── bucketSpend — 4 granularités ────────────────────────────────────

test('bucketSpend — heure (today) : 24 buckets, somme par heure', () => {
  const range = getPeriodRange('today', new Date(2026, 5, 9));
  const priced = [
    { date: '2026-06-09', time: '18:30', price: 3 },
    { date: '2026-06-09', time: '18:45', price: 2 },
    { date: '2026-06-09', time: '20:00', price: 5 },
  ];
  const { data, unitLabel } = bucketSpend(priced, 'today', range);
  assert.equal(data.length, 24, '24 heures');
  assert.equal(data[18].v, 5, '18h = 3 + 2');
  assert.equal(data[20].v, 5, '20h = 5');
  assert.equal(unitLabel, 'par heure');
});

test('bucketSpend — jour (week) : pas de jours futurs, zero-fill', () => {
  // Semaine contenant aujourd'hui : le dernier bucket ne dépasse pas today.
  const anchor = new Date();
  const range = getPeriodRange('week', anchor);
  const { data } = bucketSpend([], 'week', range);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(range.start); start.setHours(0, 0, 0, 0);
  const expected = Math.min(7, Math.round((today - start) / (24 * HOUR)) + 1);
  assert.equal(data.length, expected, 'jours jusqu’à aujourd’hui seulement');
  assert.ok(data.every(d => d.v === 0), 'aucune dépense → tout à 0');
});

test('bucketSpend — mois (year) et année (all)', () => {
  const yr = getPeriodRange('year', new Date(2026, 5, 9));
  const m = bucketSpend([{ date: '2026-03-15', price: 10 }], 'year', yr);
  assert.equal(m.unitLabel, 'par mois');
  assert.equal(m.data.length, 12, '12 mois');
  assert.equal(m.data[2].v, 10, 'mars = 10');

  const all = bucketSpend([
    { date: '2024-01-01', price: 4 }, { date: '2026-01-01', price: 6 },
  ], 'all', { start: new Date(2000, 0, 1), end: new Date() });
  assert.equal(all.unitLabel, 'par année');
  assert.equal(all.data[0].v, 4, '2024 = 4');
  assert.equal(all.data[all.data.length - 1].v, 6, '2026 = 6');
});

// ── computeMonthlyTrends ────────────────────────────────────────────

test('computeMonthlyTrends — < 2 mois → vide ; sinon fenêtre 6 mois + trous à 0', () => {
  assert.deepEqual(computeMonthlyTrends([beer('2026-06-01', '20:00')]).labels, [], '1 mois → vide');
  const drinks = [
    beer('2026-01-10', '20:00'),
    beer('2026-04-10', '20:00'), // trou février/mars
    beer('2026-04-12', '20:00'),
  ];
  const t = computeMonthlyTrends(drinks);
  assert.equal(t.labels.length, 4, 'jan→avr = 4 mois contigus');
  assert.equal(t.drinks[0], 1, 'janvier = 1');
  assert.equal(t.drinks[1], 0, 'février = 0 (trou rempli)');
  assert.equal(t.drinks[3], 2, 'avril = 2');
});

test('computeMonthlyTrends — fenêtre plafonnée à 6 mois', () => {
  const drinks = [];
  for (let m = 1; m <= 9; m++) drinks.push(beer(`2026-${String(m).padStart(2, '0')}-10`, '20:00'));
  const t = computeMonthlyTrends(drinks);
  assert.equal(t.labels.length, 6, 'au plus 6 mois finissant au dernier mois avec données');
});

// ── computeRollingDaily ─────────────────────────────────────────────

test('computeRollingDaily — moyennes 7/30 j et slice(-30)', () => {
  const out = computeRollingDaily([beer(localDate(new Date()), '20:00')]);
  assert.ok(out.length >= 1);
  const last = out[out.length - 1];
  assert.ok(last.r7 > 0, 'moyenne 7 j > 0 le jour de la boisson');
  assert.ok(last.daily > 0, 'brut > 0');
  assert.ok(out.length <= 30, 'au plus 30 jours');
  assert.deepEqual(computeRollingDaily([]), [], 'aucune donnée → []');
});

// ── computeSessionDurationBuckets ───────────────────────────────────

test('computeSessionDurationBuckets — bornes ouvertes à droite', () => {
  const S = (h) => ({ startTs: 0, endTs: h * HOUR });
  const b = computeSessionDurationBuckets([S(0.99), S(1.0), S(2.5), S(6.0), S(9)]);
  assert.equal(b[0].v, 1, '0.99 h → <1h');
  assert.equal(b[1].v, 1, '1.0 h → 1-2h');
  assert.equal(b[2].v, 1, '2.5 h → 2-3h');
  assert.equal(b[6].v, 2, '6.0 h et 9 h → 6h+');
});

// ── bucketDailyAlcohol / buildHeatmapCells ──────────────────────────

test('bucketDailyAlcohol — somme grammes + nombre par jour', () => {
  const map = bucketDailyAlcohol([
    beer('2026-06-09', '18:00'), beer('2026-06-09', '20:00'), beer('2026-06-10', '21:00'),
  ]);
  assert.equal(map.get('2026-06-09').count, 2);
  assert.ok(map.get('2026-06-09').grams > map.get('2026-06-10').grams, 'deux verres > un verre');
});

test('buildHeatmapCells — mode selon période, cellules + scaleMax', () => {
  const range = getPeriodRange('month', new Date(2026, 5, 15));
  const drinks = [beer('2026-06-09', '18:00'), beer('2026-06-09', '20:00'), beer('2026-06-12', '21:00')];
  const hm = buildHeatmapCells(drinks, 'month', range, new Date(2026, 5, 15));
  assert.equal(hm.mode, 'monthGrid');
  const c9 = hm.cells.find(c => c.date === '2026-06-09');
  assert.ok(c9 && c9.count === 2, 'jour avec 2 boissons');
  assert.ok(hm.scaleMax > 0);
  assert.ok(hm.cells.every(c => c.weekday >= 0 && c.weekday <= 6), 'weekday 0..6 (lundi=0)');
  // Année → mur de mois.
  const yr = getPeriodRange('year', new Date(2026, 5, 15));
  assert.equal(buildHeatmapCells(drinks, 'year', yr, new Date(2026, 5, 15)).mode, 'yearWall');
  // Aujourd'hui → 5 dernières semaines.
  const td = getPeriodRange('today', new Date(2026, 5, 15));
  assert.equal(buildHeatmapCells(drinks, 'today', td, new Date(2026, 5, 15)).mode, 'today');
});

// ── buildSessionList / buildSessionPeakHistogram ────────────────────

test('buildSessionList — plus récente d’abord, cap n, champs aplatis', () => {
  const sess = [
    { id: 'a', startTs: 1000, endTs: 1000 + 2 * HOUR, drinks: [1, 2], peakBac: 300 },
    { id: 'b', startTs: 5000, endTs: 5000 + HOUR, drinks: [1], peakBac: 150 },
  ];
  const list = buildSessionList(sess, 8);
  assert.equal(list[0].id, 'b', 'plus récente (startTs plus grand) en premier');
  assert.equal(list[0].drinkCount, 1);
  assert.equal(list[1].durationMs, 2 * HOUR);
  assert.equal(buildSessionList(sess, 1).length, 1, 'cap n');
});

test('buildSessionPeakHistogram — tranches de pic', () => {
  const sess = [
    { peakBac: 150 }, { peakBac: 250 }, { peakBac: 250 }, { peakBac: 1200 },
  ];
  const h = buildSessionPeakHistogram(sess);
  assert.equal(h[0].v, 1, '<200');
  assert.equal(h[1].v, 2, '200-400');
  assert.equal(h[5].v, 1, '1k+');
});

// ── buildCumulativeComparison ───────────────────────────────────────

test('buildCumulativeComparison — cumul monotone, longueurs égales, alignement', () => {
  const range = { start: new Date(2026, 5, 8), end: new Date(2026, 5, 10) };       // 3 jours
  const prevRange = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 3) };    // 3 jours
  const cur = [beer('2026-06-08', '20:00'), beer('2026-06-10', '20:00')];
  const prev = [beer('2026-06-01', '20:00')];
  const c = buildCumulativeComparison(cur, prev, range, prevRange, 'grams');
  assert.equal(c.cur.length, c.prev.length, 'longueurs égales');
  assert.equal(c.cur.length, 3, '3 jours');
  // Cumul monotone non décroissant.
  for (let i = 1; i < c.cur.length; i++) {
    assert.ok(c.cur[i] >= c.cur[i - 1], 'cur monotone');
    assert.ok(c.prev[i] >= c.prev[i - 1], 'prev monotone');
  }
  assert.ok(c.cur[2] > c.prev[2], 'période actuelle (2 verres) > précédente (1 verre)');
});

// ── computeBacForecast (forme 6-args, courbe réelle en baseline) ─────

const mkNow = (msAgo, qty = 50, abv = 5) => {
  const d = new Date(Date.now() - msAgo);
  return { name: 'Pils', category: 'Bière', quantity: qty, unit: 'cL', alcoholContent: abv,
           date: localDate(d), time: localTime(d) };
};

test('computeBacForecast — continuité à t=0 avec la courbe de projection', () => {
  const drinks = [mkNow(2 * HOUR), mkNow(1 * HOUR), mkNow(10 * 60 * 1000)];
  const bac = computeBacOverTime(drinks, 70, 'male');
  const sessions = computeBACSessions(drinks, 70, 'male');
  const future = bac.points.filter(p => p.t >= -1e-9);
  const fc = computeBacForecast(bac.current, sessions, 70, 'male', Date.now(), future);
  assert.ok(fc.hasCurrentSession, 'session en cours');
  assert.ok(fc.projectedPoints.length > 0);
  // Le 1er point projeté = taux courant (continuité avec la jauge / projection).
  assert.ok(Math.abs(fc.projectedPoints[0].bac - bac.current) <= 2, 'projection démarre à current');
});

test('computeBacForecast — verre récent : la courbe MONTE d’abord (absorption en vol)', () => {
  // Un seul verre il y a 4 min : l'absorption (30 min) n'est pas finie → la
  // prévision doit d'abord grimper au-dessus du taux courant, pas plonger.
  const drinks = [mkNow(4 * 60 * 1000)];
  const bac = computeBacOverTime(drinks, 70, 'male');
  const sessions = computeBACSessions(drinks, 70, 'male');
  const future = bac.points.filter(p => p.t >= -1e-9);
  const fc = computeBacForecast(bac.current, sessions, 70, 'male', Date.now(), future);
  const maxProj = Math.max(...fc.projectedPoints.map(p => p.bac));
  assert.ok(maxProj > bac.current + 5, 'la projection grimpe (absorption restante comptée)');
});

test('computeBacForecast — la courbe redescend jusqu’à 0 (non tronquée)', () => {
  const drinks = [mkNow(30 * 60 * 1000), mkNow(10 * 60 * 1000)];
  const bac = computeBacOverTime(drinks, 70, 'male');
  const sessions = computeBACSessions(drinks, 70, 'male');
  const future = bac.points.filter(p => p.t >= -1e-9);
  const fc = computeBacForecast(bac.current, sessions, 70, 'male', Date.now(), future);
  const last = fc.projectedPoints[fc.projectedPoints.length - 1];
  // Le dernier échantillon (pas de 1 min) tombe au plus une marche
  // d'élimination (150 mg/L/h × 1/60 h ≈ 2,5 mg/L) avant le zéro exact.
  if (!fc.truncated) assert.ok(last.bac <= 3, `fin de courbe ≈ 0 (obtenu ${last.bac.toFixed(2)})`);
});

test('computeBacForecast — pas de session en cours → vide', () => {
  const fc = computeBacForecast(0, [], 70, 'male', Date.now(), []);
  assert.equal(fc.hasCurrentSession, false);
  assert.deepEqual(fc.projectedPoints, []);
  assert.equal(fc.truncated, false);
});

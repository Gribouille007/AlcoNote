// ── VERROU DES FORMULES ────────────────────────────────────────────
// Ce fichier GÈLE les méthodes de calcul de l'onglet Stats : constantes
// physiologiques, formule d'éthanol, moteur Widmark (sessions + prévision)
// et helpers de sections, via des valeurs en or capturées sur des scénarios
// fixes. Si un test échoue ici, une formule a changé : c'est soit un bug à
// corriger, soit un changement VOULU — auquel cas mettre à jour ce fichier
// ET le gel textuel de static-checks.test.js dans le même commit
// (cf. CLAUDE.md § « Formules gelées »).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared', 'data', 'stats');

const {
  // shared
  toCl, ethanolGrams, drinkAlcoholGrams, ETHANOL_DENSITY_G_PER_ML,
  localDate, localTime,
  // stats — moteur BAC
  computeBACSessions, computeBacForecast, widmarkR,
  BAC_ELIM_RATE, BAC_ABSORPTION_H, BAC_LEGAL_LIMIT, BAC_RECORD_MIN,
  DEFAULT_WEIGHT_KG, bacLevel, BAC_LEVELS,
  // stats — helpers de sections
  peakIndex, drinkNameKey, meanSessionBac, sessionGapStats,
  soberDaysInRange, pctBourreAllTime, isPricedDrink, computeSpendingSummary,
  inPeriods,
} = global;

const FROZEN = 'FORMULE GELÉE (CLAUDE.md § Formules gelées) — changement interdit sans mise à jour délibérée des deux verrous';
const closeTo = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b} (±${eps}) — ${FROZEN}`);

const mk = (d, qty, unit, abv, extra = {}) => ({
  name: 'Test', quantity: qty, unit, alcoholContent: abv,
  date: localDate(d), time: localTime(d), ...extra,
});

// ── Constantes physiologiques ──────────────────────────────────────

test('gel — constantes du modèle (Widmark, éthanol, seuils)', () => {
  assert.equal(BAC_ELIM_RATE, 150, FROZEN);          // β = 0,15 g/L/h
  assert.equal(BAC_ABSORPTION_H, 0.5, FROZEN);       // absorption linéaire 30 min
  assert.equal(BAC_LEGAL_LIMIT, 500, FROZEN);        // 0,5 g/L en mg/L
  assert.equal(BAC_RECORD_MIN, 200, FROZEN);
  assert.equal(DEFAULT_WEIGHT_KG, 70, FROZEN);
  assert.equal(ETHANOL_DENSITY_G_PER_ML, 0.789, FROZEN);
  assert.equal(widmarkR('male'), 0.68, FROZEN);
  assert.equal(widmarkR('female'), 0.55, FROZEN);
  assert.equal(widmarkR(undefined), 0.68, `genre inconnu → homme — ${FROZEN}`);
});

test('gel — conversions de volume (toCl)', () => {
  assert.equal(toCl(1, 'EcoCup'), 25, FROZEN);
  assert.equal(toCl(2, 'ecocup'), 50, `insensible à la casse — ${FROZEN}`);
  assert.equal(toCl(0.5, 'L'), 50, FROZEN);
  assert.equal(toCl(330, 'mL'), 33, FROZEN);
  assert.equal(toCl(25, 'cL'), 25, FROZEN);
  assert.equal(toCl(25, undefined), 25, `défaut = cL — ${FROZEN}`);
});

test('gel — grammes d\'alcool pur (volCl ×10 ×°/100 ×0,789)', () => {
  assert.equal(ethanolGrams(50, 5), 19.725, FROZEN);
  closeTo(ethanolGrams(33, 5), 13.0185);
  assert.equal(ethanolGrams(50, 0), 0, FROZEN);
  assert.equal(ethanolGrams(50, null), 0, `degré absent → 0 g — ${FROZEN}`);
  closeTo(drinkAlcoholGrams({ quantity: 1, unit: 'EcoCup', alcoholContent: 5 }),
    ethanolGrams(25, 5));
});

// ── Moteur Widmark : pic mono-verre ────────────────────────────────

test('gel — pic Widmark d\'un verre unique = g·1000/(poids·r) − élimination pendant l\'absorption', () => {
  const d = new Date(2026, 0, 10, 20, 0);
  const sessions = computeBACSessions([mk(d, 50, 'cL', 5)], 70, 'male');
  assert.equal(sessions.length, 1);
  const theoreticalPeak = (19.725 * 1000) / (70 * 0.68);
  closeTo(sessions[0].peakBac, theoreticalPeak - BAC_ELIM_RATE * BAC_ABSORPTION_H);
});

// ── Moteur Widmark : session scriptée à 3 verres (valeurs en or) ───
// Scénario fixe : 10 janv. 2026, femme 60 kg — bière 50 cL 5 % à 20:00,
// négroni 10 cL 24 % à 21:00, IPA 33 cL 8,5 % à 22:30. Les valeurs ci-dessous
// ont été capturées sur l'implémentation de référence : elles verrouillent la
// marche exacte des points de rupture (absorption linéaire + clamp à zéro).

test('gel — session 3 verres : grammes, pic, durée, taux moyen', () => {
  const drinks = [
    mk(new Date(2026, 0, 10, 20, 0), 50, 'cL', 5),
    mk(new Date(2026, 0, 10, 21, 0), 10, 'cL', 24),
    mk(new Date(2026, 0, 10, 22, 30), 33, 'cL', 8.5),
  ];
  const sessions = computeBACSessions(drinks, 60, 'female');
  assert.equal(sessions.length, 1, `un seul épisode — ${FROZEN}`);
  const s = sessions[0];
  closeTo(s.grams, 60.79245, 1e-6);
  closeTo(s.peakBac, 1392.1954545454546, 1e-6);
  // Pic au moment où le dernier verre finit de s'absorber (22:30 + 30 min).
  closeTo((s.peakTs - s.startTs) / 3600_000, 3, 1e-9);
  closeTo((s.endTs - s.startTs) / 3600_000, 12.281303030327692, 1e-6);
  closeTo(s.avgBac, 700.3563255841049, 1e-6);
  assert.equal(s.startTs, new Date(2026, 0, 10, 20, 0).getTime());
});

// ── Prévision de session (valeurs en or) ───────────────────────────
// Scénario fixe : session passée (2 bières le 3 janv.) + session en cours
// (2 bières 20:00 / 20:30), taux courant 250 mg/L, maintenant = 20:40.

test('gel — computeBacForecast : peak moyen, ETA, montée puis retour à 0', () => {
  const past = [
    mk(new Date(2026, 0, 3, 20, 0), 50, 'cL', 5),
    mk(new Date(2026, 0, 3, 21, 0), 50, 'cL', 5),
  ];
  const ongoing = [
    mk(new Date(2026, 0, 10, 20, 0), 50, 'cL', 5),
    mk(new Date(2026, 0, 10, 20, 30), 50, 'cL', 5),
  ];
  const all = computeBACSessions([...past, ...ongoing], 70, 'male');
  assert.equal(all.length, 2);
  const nowMs = new Date(2026, 0, 10, 20, 40).getTime();
  const fc = computeBacForecast(250, all, 70, 'male', nowMs, []);
  closeTo(fc.meanPeakBac, 603.7815126050419, 1e-6);
  closeTo(fc.etaPeakHours, 0.2, 1e-9);
  assert.equal(fc.truncated, false);
  assert.equal(fc.projectedPoints[0].t, 0);
  assert.equal(fc.projectedPoints[0].bac, 250, `continuité à t=0 — ${FROZEN}`);
  const maxBac = Math.max(...fc.projectedPoints.map(p => p.bac));
  closeTo(maxBac, 890.6512605042017, 1e-6);
  const last = fc.projectedPoints[fc.projectedPoints.length - 1];
  assert.ok(last.bac < 1, `la courbe redescend à ~0 (${last.bac}) — ${FROZEN}`);
});

// ── Niveaux BAC (messages « never change ») ────────────────────────

test('gel — bacLevel : bornes et messages verbatim', () => {
  assert.equal(bacLevel(0).cls, 'caution');
  assert.equal(bacLevel(500).cls, 'caution');
  assert.equal(bacLevel(501).cls, 'warning');
  assert.equal(bacLevel(1000).cls, 'warning');
  assert.equal(bacLevel(1999).cls, 'warning');
  assert.equal(bacLevel(2000).cls, 'danger');
  assert.equal(bacLevel(2999).cls, 'danger');
  assert.equal(bacLevel(3000).cls, 'danger');
  assert.equal(bacLevel(99999).cls, 'danger');
  assert.deepEqual(BAC_LEVELS.map(l => l.text), [
    'OK GARMIN, trouve mes clés de voiture',
    'On nage dans le lac du BDC ?',
    '1 millions de bières svp',
    'Brieuc t\'abuses',
    'Y a qu\'une personne pour arriver ici',
  ], `messages BAC_LEVELS verbatim — ${FROZEN}`);
});

// ── Helpers de sections (extraits pour être testables) ─────────────

test('peakIndex — null quand tout est à zéro, sinon index du max', () => {
  assert.equal(peakIndex([0, 0, 0]), null);
  assert.equal(peakIndex([]), null);
  assert.equal(peakIndex(null), null);
  assert.equal(peakIndex([1, 3, 2]), 1);
  assert.equal(peakIndex([5]), 0);
  assert.equal(peakIndex([2, 2, 1]), 0, 'premier max en cas d\'égalité');
});

test('drinkNameKey — trim + lowercase (aligné familyKey/ratingKey)', () => {
  assert.equal(drinkNameKey('  PilsNer '), 'pilsner');
  assert.equal(drinkNameKey(null), '');
  assert.equal(drinkNameKey(''), '');
});

test('meanSessionBac — moyenne des taux intra-session, null si vide', () => {
  assert.equal(meanSessionBac([{ avgBac: 100 }, { avgBac: 200 }, { avgBac: 0 }]), 150);
  assert.equal(meanSessionBac([]), null);
  assert.equal(meanSessionBac(null), null);
  assert.equal(meanSessionBac([{ avgBac: 0 }]), null);
});

test('sessionGapStats — durée moyenne (h) et écart moyen par paire (jours)', () => {
  const H = 3600_000;
  const empty = sessionGapStats([]);
  assert.equal(empty.avgDurationH, 0);
  assert.equal(empty.meanGapDays, 0);
  const one = sessionGapStats([{ startTs: 0, endTs: 2 * H }]);
  assert.equal(one.avgDurationH, 2);
  assert.equal(one.meanGapDays, 0);
  const three = sessionGapStats([
    { startTs: 0, endTs: 2 * H },
    { startTs: 26 * H, endTs: 27 * H },
    { startTs: 50 * H, endTs: 54 * H },
  ]);
  closeTo(three.avgDurationH, 7 / 3);
  closeTo(three.meanGapDays, 23.5 / 24); // (24 h + 23 h) / 2
});

test('soberDaysInRange — jours sans boisson, clamp au présent', () => {
  const range = { start: new Date(2026, 0, 5), end: new Date(2026, 0, 11) };
  const drinks = [{ date: '2026-01-06' }, { date: '2026-01-09' }];
  assert.equal(soberDaysInRange(drinks, range), 5);
  assert.equal(soberDaysInRange(drinks, range, new Date(2026, 0, 8)), 3); // 5,7,8
  assert.equal(soberDaysInRange(drinks, range, new Date(2026, 0, 1)), 0); // clamp avant le début
  assert.equal(soberDaysInRange([], range), 7);
});

test('pctBourreAllTime — part de temps bourré depuis la première boisson', () => {
  const H = 3600_000;
  assert.equal(pctBourreAllTime([{ startTs: 0, endTs: H }], 0, 4 * H), 25);
  // La session en cours est tronquée à « maintenant ».
  assert.equal(pctBourreAllTime([{ startTs: 0, endTs: 10 * H }], 0, 2 * H), 100);
  assert.equal(pctBourreAllTime([], 0, 4 * H), 0);
  assert.equal(pctBourreAllTime([{ startTs: 0, endTs: H }], null, 4 * H), 0);
});

test('computeSpendingSummary — total / moyenne / par catégorie (prix saisis seulement)', () => {
  const drinks = [
    { price: 3.5, category: 'Bière' },
    { price: 12, category: 'Cocktail' },
    { price: 4.5, category: 'Bière' },
    { price: null, category: 'Bière' },
    { price: 'abc', category: 'Vin' },
    { category: 'Vin' },
  ];
  const s = computeSpendingSummary(drinks);
  assert.equal(s.total, 20);
  assert.equal(s.count, 3);
  closeTo(s.avg, 20 / 3);
  assert.deepEqual(s.byCat, [
    { name: 'Cocktail', total: 12, count: 1 },
    { name: 'Bière', total: 8, count: 2 },
  ]);
  const empty = computeSpendingSummary([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.avg, null);
  assert.deepEqual(empty.byCat, []);
  assert.equal(isPricedDrink({ price: 0 }), true, 'un prix de 0 € est un prix saisi');
  assert.equal(isPricedDrink({ price: null }), false);
});

test('inPeriods — gate de pertinence par période', () => {
  assert.equal(inPeriods('week', ['week', 'month']), true);
  assert.equal(inPeriods('today', ['week', 'month']), false);
});

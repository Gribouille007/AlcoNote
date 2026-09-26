// Mode « Comparer » (proto/compare.jsx) : helpers PURS — écart relatif au
// plus petit, profils par période, sections, verdict — et helpers du cache
// du pool partagé (proto/share.jsx).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
// dbManager minimal AVANT share.js (initShare() top-level lit les settings).
global.dbManager = { getSetting: async () => null, getAllSettings: async () => ({}) };
global.SHARE_CONFIG = { TRANSPORT: 'mock', PULL_INTERVAL_MS: 600000 };
loadDist('shared', 'data', 'stats', 'share', 'compare');

const {
  COMPARE_ME, compareDiff, fmtComparePct, compareDiffText, buildCompareProfile,
  buildCompareSections, buildCategoryDuel, compareVerdict, compareAllPeriodNote,
  defaultCompareTarget, resolveComparePerson, compareRangeFor,
  groupSharedPool, sharedRatingsMap, friendsBacMap, sortGroupMembers, ethanolGrams,
} = global;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const beer = (date, time, extra = {}) => ({
  name: 'Jupiler', category: 'Bière', quantity: 50, unit: 'cL', alcoholContent: 5, date, time, ...extra,
});
const wine = (date, time) => ({
  name: 'Bordeaux', category: 'Vin', quantity: 12, unit: 'cL', alcoholContent: 13, date, time,
});
const ME = [beer('2026-09-10', '20:00'), beer('2026-09-10', '21:00'), beer('2026-09-10', '22:00'), wine('2026-09-12', '20:00')];
const LEA = [beer('2026-09-11', '19:00')];
const NOW = new Date('2026-09-30T12:00:00');
const ANCHOR = new Date('2026-09-15T12:00:00');
const G_BEER = ethanolGrams(50, 5);
const G_WINE = ethanolGrams(12, 13);

// ── compareDiff : écart relatif au PLUS PETIT ─────────────────────
test('compareDiff — relatif au plus petit, côté du plus grand', () => {
  const d = compareDiff(100, 135);
  assert.equal(d.leader, 'b');
  near(d.pct, 35);
  near(d.abs, 35);
  // Symétrie : inverser les côtés change le leader, pas le pourcentage.
  const r = compareDiff(135, 100);
  assert.equal(r.leader, 'a');
  near(r.pct, 35);
  // Relatif au plus petit (≠ relatif à A) : 50 vs 100 → +100 %, pas −50 %.
  near(compareDiff(100, 50).pct, 100);
});

test('compareDiff — plus petit à 0 : pas de % (division par zéro), écart absolu', () => {
  const d = compareDiff(0, 3);
  assert.equal(d.leader, 'b');
  assert.equal(d.pct, null);
  assert.equal(d.abs, 3);
  assert.equal(compareDiffText(d, { fmt: String }), '+3');
});

test('compareDiff — égalité exacte, égalité à l’affichage, valeurs manquantes', () => {
  assert.deepEqual(compareDiff(4, 4), { leader: null, pct: 0, abs: 0, equal: true });
  // 1.24 L vs 1.21 L s'affichent « 1.2L » : jamais « +2% » entre deux valeurs identiques à l'écran.
  const fmtL = (v) => `${(v / 100).toFixed(1)}L`;
  assert.equal(compareDiff(124, 121, fmtL).equal, true);
  assert.equal(compareDiff(null, 3), null);
  assert.equal(compareDiff(3, undefined), null);
  assert.equal(compareDiff(NaN, 3), null);
  assert.equal(compareDiff(0, 0).equal, true);
});

test('fmtComparePct / compareDiffText — formats et modes', () => {
  assert.equal(fmtComparePct(35.4), '35');
  assert.equal(fmtComparePct(4.44), '4.4');
  assert.equal(fmtComparePct(0.04), '<0.1');
  assert.equal(compareDiffText(compareDiff(100, 135), { fmt: String }), '+35%');
  // Mode 'abs' (degrés, notes) : écart en points, jamais en % de %.
  const row = { fmt: (v) => `${v}%`, mode: 'abs', fmtAbs: (v) => `${v.toFixed(1)} pt` };
  assert.equal(compareDiffText(compareDiff(5, 8), row), '+3.0 pt');
  assert.equal(compareDiffText(compareDiff(5, 5), row), '=');
  assert.equal(compareDiffText(null, row), null);
});

// ── Profils ───────────────────────────────────────────────────────
test('buildCompareProfile — totaux, moyennes, degré pondéré, jours', () => {
  const p = buildCompareProfile(ME, { bacAvailable: false }, 'month', ANCHOR, NOW);
  assert.equal(p.count, 4);
  near(p.grams, 3 * G_BEER + G_WINE);
  near(p.volumeCl, 162);
  assert.equal(p.unique, 2);
  near(p.gramsPerDrink, p.grams / 4);
  // Septembre, « maintenant » = le 30 → 30 jours écoulés.
  assert.equal(p.days, 30);
  near(p.perDay, 4 / 30);
  near(p.perWeek, 4 / (30 / 7));
  assert.equal(p.drinkDays, 2);
  assert.equal(p.soberDays, 28);
  // Σ cl·deg / Σ cl = (150·5 + 12·13) / 162.
  near(p.avgAbv, (150 * 5 + 12 * 13) / 162);
  assert.equal(p.topCat.name, 'Bière');
  near(p.topCat.share, 0.75);
  assert.equal(p.topDrink.name, 'Jupiler');
  assert.equal(p.topDrink.count, 3);
  assert.equal(p.peakHour, 20);
  assert.equal(p.bac, null, 'pas de BAC sans partage (jamais de chiffre inventé)');
  assert.equal(p.empty, false);
});

test('buildCompareProfile — « Jour » : pas de moyennes/jour ni jours sobres', () => {
  const p = buildCompareProfile(ME, {}, 'today', new Date('2026-09-10T12:00'), NOW);
  assert.equal(p.count, 3);
  assert.equal(p.perDay, null);
  assert.equal(p.soberDays, null);
  assert.equal(p.peakDow, null);
});

test('buildCompareProfile — « Tout » démarre à la 1re boisson DE CHACUN', () => {
  const a = buildCompareProfile(ME, {}, 'all', NOW, NOW);
  const b = buildCompareProfile(LEA, {}, 'all', NOW, NOW);
  assert.equal(a.days, 21, '10 → 30 septembre');
  assert.equal(b.days, 20, '11 → 30 septembre');
  assert.equal(compareRangeFor([], 'all', NOW), null, 'aucune boisson → pas de plage');
  const empty = buildCompareProfile([], {}, 'all', NOW, NOW);
  assert.equal(empty.empty, true);
  assert.equal(empty.perDay, null, 'jamais de moyenne sur une plage inexistante');
});

test('buildCompareProfile — BAC partagé : sessions de la période, pic, temps bourré', () => {
  const p = buildCompareProfile(ME, { weight: 70, gender: 'male' }, 'month', ANCHOR, NOW);
  assert.equal(p.bac.sessions, 2, '10 sept. (3 bières) + 12 sept. (vin)');
  assert.ok(p.bac.peakBac > 0);
  assert.ok(p.bac.bourreMs > 0);
  assert.ok(p.bac.meanBac > 0 && p.bac.meanBac <= p.bac.peakBac);
  // Réutilise les sessions fournies (aucun recalcul par période).
  const fake = [{ startTs: +new Date('2026-09-10T20:00'), endTs: +new Date('2026-09-10T23:00'),
    peakBac: 999, avgBac: 500, drinks: [{ date: '2026-09-10' }] }];
  const q = buildCompareProfile(ME, { allSessions: fake }, 'month', ANCHOR, NOW);
  assert.equal(q.bac.peakBac, 999);
});

test('buildCompareProfile — note moyenne des boissons DIFFÉRENTES notées', () => {
  const p = buildCompareProfile(ME, { bacAvailable: false, ratings: { jupiler: 4, bordeaux: 2 } }, 'month', ANCHOR, NOW);
  near(p.avgRating, 3, 1e-9);
  const q = buildCompareProfile(ME, { bacAvailable: false, ratings: {} }, 'month', ANCHOR, NOW);
  assert.equal(q.avgRating, null);
});

// ── Sections ──────────────────────────────────────────────────────
test('buildCompareSections — lignes selon la période, BAC seulement si les DEUX partagent', () => {
  const a = buildCompareProfile(ME, {}, 'month', ANCHOR, NOW);
  const b = buildCompareProfile(LEA, {}, 'month', ANCHOR, NOW);
  const s = buildCompareSections(a, b, 'month', { a: 120, b: 0 });
  const ids = s.volume.map((r) => r.id);
  // L'alcool pur total est le héros de la vue : pas de ligne en double.
  assert.deepEqual(ids, ['count', 'volume', 'unique', 'gramsPerDrink',
    'perDay', 'gramsPerDay', 'perWeek', 'drinkDays', 'soberDays']);
  assert.ok(s.bac.some((r) => r.id === 'current' && r.chip === 'En direct'), 'taux en direct étiqueté');
  const noBac = buildCompareProfile(LEA, { bacAvailable: false }, 'month', ANCHOR, NOW);
  assert.equal(buildCompareSections(a, noBac, 'month').bac, null);
  const today = buildCompareSections(a, b, 'today');
  assert.ok(!today.volume.some((r) => ['perDay', 'perWeek', 'soberDays'].includes(r.id)));
  assert.ok(!today.habits.text.some((r) => r.id === 'peakDow'));
  const week = buildCompareSections(a, b, 'week');
  assert.ok(!week.volume.some((r) => r.id === 'perWeek'), '« /sem. » réservé aux longues périodes');
  // Degré et note : écart en points.
  assert.ok(s.habits.numeric.every((r) => r.mode === 'abs'));
});

test('buildCategoryDuel — union des catégories, parts, tri par part max', () => {
  const a = buildCompareProfile(ME, {}, 'month', ANCHOR, NOW);
  const b = buildCompareProfile(LEA, {}, 'month', ANCHOR, NOW);
  const rows = buildCategoryDuel(a, b);
  assert.deepEqual(rows.map((r) => r.name), ['Bière', 'Vin']);
  near(rows[0].a, 0.75); near(rows[0].b, 1);
  near(rows[1].a, 0.25); near(rows[1].b, 0);
  assert.equal(buildCategoryDuel({ cats: [] }, { cats: [] }).length, 0);
});

// ── Verdict ───────────────────────────────────────────────────────
test('compareVerdict — tutoiement, rapport au-delà du double, cas limites', () => {
  const A = { name: 'Toi', isMe: true }, L = { name: 'Léa', isMe: false }, T2 = { name: 'Tom', isMe: false };
  const a = buildCompareProfile(ME, {}, 'month', ANCHOR, NOW);
  const b = buildCompareProfile(LEA, {}, 'month', ANCHOR, NOW);
  const pct = Math.round(((a.grams - b.grams) / b.grams) * 100);
  const ratio = (Math.round((a.grams / b.grams) * 10) / 10).toFixed(1);
  assert.equal(compareVerdict(a, b, A, L), `Tu as bu ${pct}% d'alcool pur de plus que Léa (×${ratio}).`);
  assert.equal(compareVerdict(b, a, L, A), `Tu as bu ${pct}% d'alcool pur de plus que Léa (×${ratio}).`);
  assert.equal(compareVerdict(a, b, L, T2), `Léa a bu ${pct}% d'alcool pur de plus que Tom (×${ratio}).`);
  const none = buildCompareProfile([], {}, 'month', ANCHOR, NOW);
  assert.equal(compareVerdict(a, none, A, L), 'Tu es la seule personne à avoir bu sur cette période.');
  assert.equal(compareVerdict(none, b, A, L), 'Léa est la seule personne à avoir bu sur cette période.');
  assert.equal(compareVerdict(none, none, A, L), "Aucune boisson de part et d'autre sur cette période.");
  assert.equal(compareVerdict(b, b, A, L), "Autant d'alcool pur de part et d'autre.");
  // Sous le double : pas de rapport « ×… ».
  const two = buildCompareProfile([beer('2026-09-11', '19:00'), beer('2026-09-11', '20:00')], {}, 'month', ANCHOR, NOW);
  const three = buildCompareProfile([beer('2026-09-11', '19:00'), beer('2026-09-11', '20:00'), beer('2026-09-11', '21:00')], {}, 'month', ANCHOR, NOW);
  assert.equal(compareVerdict(three, two, A, L), "Tu as bu 50% d'alcool pur de plus que Léa.");
});

test('compareAllPeriodNote — seulement sur « Tout » avec des historiques inégaux', () => {
  const A = { name: 'Toi' }, B = { name: 'Léa' };
  assert.equal(compareAllPeriodNote({ days: 100 }, { days: 30 }, A, B, 'month'), null);
  assert.equal(compareAllPeriodNote({ days: 100 }, { days: 95 }, A, B, 'all'), null);
  assert.match(compareAllPeriodNote({ days: 100 }, { days: 30 }, A, B, 'all'), /Toi 100 j, Léa 30 j/);
});

test('defaultCompareTarget / resolveComparePerson', () => {
  const members = [
    { userId: 'u1', displayName: 'Léa', shareBac: true, bacWeight: 62, bacGender: 'female' },
    { userId: 'u2', displayName: '', shareBac: false },
  ];
  assert.equal(defaultCompareTarget(members, 'u2'), 'u2', 'favori d’abord');
  assert.equal(defaultCompareTarget(members, 'ghost'), 'u1', 'favori absent → premier');
  assert.equal(defaultCompareTarget([], null), null);
  const me = resolveComparePerson(COMPARE_ME, members, { userWeight: '80', userGender: 'female' });
  assert.deepEqual([me.name, me.isMe, me.weight, me.gender, me.bacAvailable], ['Toi', true, 80, 'female', true]);
  const lea = resolveComparePerson('u1', members);
  assert.deepEqual([lea.weight, lea.gender, lea.bacAvailable], [62, 'female', true]);
  assert.equal(resolveComparePerson('u2', members).name, 'Anonyme');
  assert.equal(resolveComparePerson('u2', members).bacAvailable, false);
  assert.equal(resolveComparePerson('gone', members), null);
});

// ── Cache du pool partagé (share.jsx) ─────────────────────────────
test('groupSharedPool — groupe par auteur, ignore les supprimés, tableaux stables', () => {
  const rows = [
    { uid: 'b', authorId: 'lea', updatedAt: 2, deleted: false, name: 'x' },
    { uid: 'a', authorId: 'lea', updatedAt: 1, deleted: false, name: 'y' },
    { uid: 'c', authorId: 'tom', updatedAt: 1, deleted: true },
  ];
  const m1 = groupSharedPool(rows);
  assert.deepEqual(m1.get('lea').map((d) => d.id), ['a', 'b'], 'id = uid, ordre stable');
  assert.equal(m1.has('tom'), false, 'boissons supprimées ignorées');
  // Même contenu → MÊME tableau (les useMemo en aval ne recalculent rien).
  const m2 = groupSharedPool([...rows].reverse(), m1);
  assert.equal(m2.get('lea'), m1.get('lea'));
  // Une édition (updatedAt) → nouveau tableau.
  const m3 = groupSharedPool([{ ...rows[0], updatedAt: 9 }, rows[1]], m2);
  assert.notEqual(m3.get('lea'), m2.get('lea'));
});

test('sharedRatingsMap — note de l’entrée la plus récemment publiée', () => {
  const map = sharedRatingsMap([
    { name: 'Chouffe', rating: 3, updatedAt: 1 },
    { name: 'chouffe ', rating: 5, updatedAt: 5 },
    { name: 'Chouffe', rating: 4, updatedAt: 2 },
    { name: 'Sans note', rating: 0, updatedAt: 9 },
  ]);
  assert.deepEqual(map, { chouffe: 5 });
});

test('friendsBacMap — null sans partage, 0 sans boisson', () => {
  const byAuthor = new Map();
  const out = friendsBacMap([
    { userId: 'a', shareBac: false },
    { userId: 'b', shareBac: true },
  ], byAuthor);
  assert.deepEqual(out, { a: null, b: 0 });
});

test('sortGroupMembers — favori d’abord puis ordre alphabétique fr stable', () => {
  const ms = [
    { userId: '3', displayName: 'zoé' }, { userId: '1', displayName: 'Émile' },
    { userId: '2', displayName: 'adam' }, { userId: '4', displayName: '' },
  ];
  assert.deepEqual(sortGroupMembers(ms).map((m) => m.userId), ['2', '4', '1', '3']);
  assert.deepEqual(sortGroupMembers(ms, '3').map((m) => m.userId), ['3', '2', '4', '1']);
  assert.notEqual(sortGroupMembers(ms), ms, 'ne mute pas l’entrée');
});

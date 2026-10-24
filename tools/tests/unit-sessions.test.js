// Sessions nommées (proto/sessions.jsx + § Noms de session de data.jsx) :
// stockage du nom accroché aux boissons (fusion / scission / boisson ajoutée
// avant), libellés, métriques et « session moyenne », courbe exacte,
// regroupement de l'Historique « Par session », recherche par nom, registre
// des sections de la page d'une session.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
global.dbManager = { getSetting: async () => null, getAllSettings: async () => ({}) };
global.SHARE_CONFIG = { TRANSPORT: 'mock', PULL_INTERVAL_MS: 600000 };
loadDist('shared', 'data', 'stats-charts', 'stats', 'share', 'compare', 'sessions');

const {
  computeBACSessions, buildFamilies, flattenEntries, filterHistoryEntries, searchTokens,
  SESSION_NAMES_KEY, SESSION_NAME_MAX, normalizeSessionName, parseSessionNames,
  resolveSessionName, applySessionName, sessionDrinkKey,
  isSessionOngoing, sessionDateLabel, sessionShortDate, sessionTimeRange, sessionTitle,
  sessionSubtitle, curveTimeAbove, curveLastDropBelow, sessionMetrics, sessionBaseline,
  pctVsBaseline, sessionCurvePoints, sessionHourlyBuckets, sessionIndexByDrinkId,
  groupEntriesBySession, stabilizeSessionGroups, findSessionForView,
  SESSION_PAGE_SECTIONS, SESSION_EXCLUDED_SECTIONS, sessionPageSectionOrder, STATS_SECTIONS,
  BAC_LEGAL_LIMIT, widmarkParams,
} = global;

const HOUR = 3600_000;
let nextId = 1;
const beer = (date, time, extra = {}) => ({
  id: nextId++, uid: 'u' + nextId, name: 'Pils', category: 'Bière', quantity: 50, unit: 'cL',
  alcoholContent: 5, date, time, ...extra,
});
const sessionsOf = (drinks) => computeBACSessions(drinks, 70, 'male');
const namesFrom = (obj) => parseSessionNames({ [SESSION_NAMES_KEY]: JSON.stringify(obj) });

// ── Stockage du nom ─────────────────────────────────────────────────

test('normalizeSessionName / parseSessionNames — tolérants, bornés, mémoïsés', () => {
  assert.equal(normalizeSessionName("  Anniv'   de  Lucas "), "Anniv' de Lucas");
  assert.equal(normalizeSessionName(null), '');
  assert.equal(normalizeSessionName('x'.repeat(200)).length, SESSION_NAME_MAX);
  assert.equal(parseSessionNames({}).size, 0);
  assert.equal(parseSessionNames({ [SESSION_NAMES_KEY]: '{oops' }).size, 0, 'JSON invalide → vide');
  assert.equal(parseSessionNames({ [SESSION_NAMES_KEY]: '[1,2]' }).size, 0, 'tableau → vide');
  const raw = JSON.stringify({ a: 'Soirée', b: '   ' });
  const m1 = parseSessionNames({ [SESSION_NAMES_KEY]: raw });
  assert.equal(m1.get('a'), 'Soirée');
  assert.ok(!m1.has('b'), 'nom vide ignoré');
  assert.equal(parseSessionNames({ [SESSION_NAMES_KEY]: raw }), m1, 'même chaîne → même Map');
  assert.equal(sessionDrinkKey({ uid: 'x', id: 3 }), 'x');
  assert.equal(sessionDrinkKey({ id: 3 }), 'id:3', 'repli sur l’id local');
});

test('applySessionName — pose le nom sur TOUTES les boissons, \'\' le retire', () => {
  const s = sessionsOf([beer('2026-06-01', '20:00'), beer('2026-06-01', '21:00')])[0];
  const keys = s.drinks.map(sessionDrinkKey);
  const named = applySessionName({ other: 'Autre' }, s, '  Anniv  ');
  for (const k of keys) assert.equal(named[k], 'Anniv');
  assert.equal(named.other, 'Autre', 'les autres sessions ne bougent pas');
  const cleared = applySessionName(named, s, '');
  for (const k of keys) assert.ok(!(k in cleared));
  assert.deepEqual(cleared, { other: 'Autre' });
});

test('le nom SUIT les boissons : ajout avant, suppression, fusion, scission', () => {
  const a1 = beer('2026-06-01', '20:00'), a2 = beer('2026-06-01', '21:00');
  const b1 = beer('2026-06-02', '20:00');
  let sess = sessionsOf([a1, a2, b1]);
  assert.equal(sess.length, 2);
  let obj = applySessionName({}, sess[0], 'Vendredi');
  obj = applySessionName(obj, sess[1], 'Samedi');
  let names = namesFrom(obj);
  assert.equal(resolveSessionName(sess[0], names), 'Vendredi');
  assert.equal(resolveSessionName(sess[1], names), 'Samedi');

  // Boisson ajoutée AVANT la 1re : l'id de session change, le nom reste.
  const a0 = beer('2026-06-01', '19:30');
  sess = sessionsOf([a0, a1, a2, b1]);
  assert.notEqual(sess[0].id, 'sess::' + new Date('2026-06-01T20:00').getTime());
  assert.equal(resolveSessionName(sess[0], names), 'Vendredi', 'hérité par la nouvelle boisson');

  // 1re boisson supprimée : les autres portent toujours le nom.
  sess = sessionsOf([a2, b1]);
  assert.equal(resolveSessionName(sess[0], names), 'Vendredi');

  // Fusion : une boisson comble le creux → UNE session, le plus ancien gagne.
  const bridge = [];
  for (let h = 22; h <= 23; h++) bridge.push(beer('2026-06-01', `${h}:30`));
  for (let h = 0; h <= 19; h++) bridge.push(beer('2026-06-02', `${String(h).padStart(2, '0')}:30`));
  sess = sessionsOf([a1, a2, ...bridge, b1]);
  assert.equal(sess.length, 1, 'fusionnées');
  assert.equal(resolveSessionName(sess[0], names), 'Vendredi', 'nom de la plus ancienne');
  // Renommer la session fusionnée écrase les deux anciens noms.
  names = namesFrom(applySessionName(obj, sess[0], 'Marathon'));
  assert.equal(resolveSessionName(sess[0], names), 'Marathon');

  // Scission : les deux morceaux gardent le nom.
  sess = sessionsOf([a1, b1]);
  assert.equal(sess.length, 2);
  assert.equal(resolveSessionName(sess[0], names), 'Marathon');
  assert.equal(resolveSessionName(sess[1], names), 'Marathon');
});

// ── Libellés ────────────────────────────────────────────────────────

test('libellés — date longue/courte (année hors année courante), plage horaire', () => {
  const now = new Date(2026, 9, 24);
  const ts = new Date(2026, 9, 10, 21, 30).getTime(); // samedi 10 octobre 2026
  assert.equal(sessionDateLabel(ts, now), 'Samedi 10 octobre');
  assert.equal(sessionShortDate(ts, now), 'Sam. 10 oct.');
  assert.equal(sessionDateLabel(new Date(2025, 9, 11, 21).getTime(), now), 'Samedi 11 octobre 2025');
  const s = { startTs: ts, endTs: ts + 5 * HOUR + 40 * 60_000, peakBac: 819.6, drinks: [1, 2, 3] };
  assert.equal(sessionTimeRange(s), '21:30 → 03:10');
  assert.equal(sessionTimeRange(s, { ongoing: true }), '21:30 → en cours');
  assert.equal(sessionTimeRange({ startTs: ts, endTs: ts + 26 * HOUR }), '21:30 → 23:30 (+1 j)');
  assert.equal(sessionTitle(s, null, now), 'Samedi 10 octobre');
  assert.equal(sessionTitle(s, 'Anniv', now), 'Anniv');
  assert.equal(sessionSubtitle(s, null, { now }), '21:30 → 03:10 · 3 consos · pic 820 mg/L');
  assert.equal(sessionSubtitle(s, 'Anniv', { now }), 'Sam. 10 oct. · 21:30 → 03:10 · 3 consos · pic 820 mg/L');
  assert.ok(isSessionOngoing(s, ts + HOUR));
  assert.ok(!isSessionOngoing(s, s.endTs + 1));
  assert.ok(!isSessionOngoing(s, ts - 1), 'pas encore commencée');
});

// ── Courbe ──────────────────────────────────────────────────────────

test('curveTimeAbove / curveLastDropBelow — croisements exacts', () => {
  // 0 → 1000 en 1 h, puis 1000 → 0 en 2 h : au-dessus de 500 de 0,5 h à 2 h.
  const c = [{ ts: 0, bac: 0 }, { ts: HOUR, bac: 1000 }, { ts: 3 * HOUR, bac: 0 }];
  assert.ok(Math.abs(curveTimeAbove(c, 500) - 1.5 * HOUR) < 1e-6);
  assert.ok(Math.abs(curveLastDropBelow(c, 500) - 2 * HOUR) < 1e-6);
  assert.equal(curveTimeAbove(c, 2000), 0);
  assert.equal(curveLastDropBelow(c, 2000), null, 'jamais au-dessus');
  assert.equal(curveTimeAbove([], 500), 0);
  assert.ok(Math.abs(curveLastDropBelow(c, 0) - 3 * HOUR) < 1e-6, 'retour à 0 = fin');
  // Points relatifs pour le chart.
  const pts = sessionCurvePoints({ curve: c }, 3 * HOUR);
  assert.deepEqual(pts.map(p => p.t), [-3, -2, 0]);
});

test('sessionMetrics — mêmes chiffres que Stats, temps au-delà de 0,5 g/L du moteur', () => {
  const drinks = [beer('2026-06-01', '20:00', { price: 5 }), beer('2026-06-01', '20:30'),
    beer('2026-06-01', '21:00', { name: 'IPA', price: 6.5 })];
  const s = sessionsOf(drinks)[0];
  const m = sessionMetrics(s, Date.now());
  assert.equal(m.count, 3);
  assert.equal(m.volumeCl, 150);
  assert.ok(Math.abs(m.grams - 3 * 19.725) < 1e-9);
  assert.equal(m.uniqueCount, 2);
  assert.equal(m.spend, 11.5);
  assert.equal(m.peakBac, s.peakBac);
  assert.equal(m.durationMs, s.endTs - s.startTs);
  assert.equal(m.drinkingMs, HOUR);
  assert.ok(m.aboveLegalMs > 0 && m.aboveLegalMs < m.durationMs);
  assert.equal(m.ongoing, false);
  assert.equal(sessionMetrics(sessionsOf([beer('2026-06-03', '20:00')])[0]).spend, null, 'aucun prix');
});

test('sessionBaseline — moyenne des AUTRES sessions terminées ; écarts relatifs', () => {
  const sess = sessionsOf([
    beer('2026-06-01', '20:00'),                                  // 1 conso
    beer('2026-06-03', '20:00'), beer('2026-06-03', '20:30'),       // 2 consos
    beer('2026-06-05', '20:00'), beer('2026-06-05', '20:20'), beer('2026-06-05', '20:40', { price: 4 }),
  ]);
  assert.equal(sess.length, 3);
  const base = sessionBaseline(sess, sess[2].id);
  assert.equal(base.n, 2, 'la session affichée est exclue');
  assert.equal(base.count, 1.5);
  assert.equal(base.spend, null, 'aucune autre session tarifée');
  assert.equal(pctVsBaseline(3, base.count), 100);
  assert.equal(pctVsBaseline(3, 0), null);
  assert.equal(pctVsBaseline(3, null), null);
  assert.equal(sessionBaseline([sess[0]], sess[0].id), null, 'aucune autre session');
  // Une session EN COURS ne fait pas partie de la référence.
  const ongoing = { ...sess[1], id: 'live', startTs: Date.now() - HOUR, endTs: Date.now() + HOUR };
  const b2 = sessionBaseline([sess[0], ongoing], 'x');
  assert.equal(b2.n, 1);
});

test('sessionHourlyBuckets — heures DE la session dans l’ordre, minuit continu', () => {
  const s = sessionsOf([beer('2026-06-01', '22:10'), beer('2026-06-01', '22:50'),
    beer('2026-06-02', '00:15'), beer('2026-06-02', '01:59')])[0];
  const b = sessionHourlyBuckets(s);
  assert.deepEqual(b.map(x => x.label), ['22h', '23h', '0h', '1h']);
  assert.deepEqual(b.map(x => x.v), [2, 0, 1, 1]);
  assert.equal(b.reduce((a, x) => a + x.v, 0), s.drinks.length);
  assert.deepEqual(sessionHourlyBuckets({ drinks: [] }), []);
});

// ── Historique « Par session » ──────────────────────────────────────

function entriesOf(drinks) {
  return flattenEntries(buildFamilies(drinks, {}, {}));
}

test('groupEntriesBySession — une carte par session, hors-session consécutifs', () => {
  const zeroBefore = beer('2026-06-01', '18:00', { name: 'Sans alcool', alcoholContent: 0 });
  const s1a = beer('2026-06-01', '20:00'), s1b = beer('2026-06-01', '21:00');
  const zeroAfter = beer('2026-06-02', '09:00', { name: 'Sans alcool', alcoholContent: 0 });
  const s2 = beer('2026-06-02', '20:00');
  const drinks = [zeroBefore, s1a, s1b, zeroAfter, s2];
  const sessions = sessionsOf(drinks);
  assert.equal(sessions.length, 2);
  const groups = groupEntriesBySession(entriesOf(drinks), sessions);
  assert.deepEqual(groups.map(g => (g.session ? g.session.id : 'hors')),
    [sessions[1].id, 'hors', sessions[0].id, 'hors'], 'ordre chronologique inverse conservé');
  assert.equal(groups[2].entries.length, 2);
  assert.equal(groups[2].totalCl, 100);
  assert.equal(groups[1].entries[0].id, zeroAfter.id);
  assert.equal(groups[3].entries[0].id, zeroBefore.id);
  assert.notEqual(groups[1].key, groups[3].key, 'clés uniques');
  assert.equal(sessionIndexByDrinkId(sessions).get(s1b.id), sessions[0]);
});

test('stabilizeSessionGroups — références réutilisées tant que rien ne change', () => {
  const drinks = [beer('2026-06-01', '20:00'), beer('2026-06-02', '20:00')];
  const entries = entriesOf(drinks);
  const mk = (sessions, name) => groupEntriesBySession(entries, sessions)
    .map(g => ({ ...g, name, ongoing: false }));
  const r1 = stabilizeSessionGroups(mk(sessionsOf(drinks), null), null);
  // Sessions RECALCULÉES (nouveaux objets, mêmes valeurs) → mêmes groupes.
  const r2 = stabilizeSessionGroups(mk(sessionsOf(drinks), null), r1.byKey);
  assert.equal(r2.groups[0], r1.groups[0]);
  assert.equal(r2.groups[1], r1.groups[1]);
  // Nom changé → nouveau groupe.
  const r3 = stabilizeSessionGroups(mk(sessionsOf(drinks), 'Fête'), r2.byKey);
  assert.notEqual(r3.groups[0], r2.groups[0]);
});

test('findSessionForView — par id, sinon par une boisson connue', () => {
  const a1 = beer('2026-06-01', '20:00'), a2 = beer('2026-06-01', '21:00');
  const before = sessionsOf([a1, a2]);
  const id = before[0].id;
  const known = before[0].drinks.map(sessionDrinkKey);
  assert.equal(findSessionForView(before, id, known), before[0]);
  // Une boisson ajoutée avant : nouvel id, retrouvée par ses boissons.
  const after = sessionsOf([beer('2026-06-01', '19:30'), a1, a2]);
  const found = findSessionForView(after, id, known);
  assert.ok(found);
  assert.notEqual(found.id, id);
  assert.equal(findSessionForView(sessionsOf([beer('2026-07-01', '20:00')]), id, known), null);
});

test('recherche « Par session » — le nom de la session trouve toutes ses boissons', () => {
  const a = beer('2026-06-01', '20:00', { name: 'Jupiler' });
  const b = beer('2026-06-01', '21:00', { name: 'Chimay' });
  const c = beer('2026-06-03', '20:00', { name: 'Jupiler' });
  const drinks = [a, b, c];
  const sessions = sessionsOf(drinks);
  const names = namesFrom(applySessionName({}, sessions[0], "Anniv' de Lucas"));
  const index = sessionIndexByDrinkId(sessions);
  const extraWords = (e) => {
    const s = index.get(e.id);
    const n = s && resolveSessionName(s, names);
    return n ? searchTokens(n) : null;
  };
  const entries = entriesOf(drinks);
  const r = filterHistoryEntries(entries, { query: 'anniv', extraWords });
  assert.deepEqual(r.entries.map(e => e.id).sort(), [a.id, b.id].sort(), 'toute la session');
  assert.equal(r.approx, false);
  const r2 = filterHistoryEntries(entries, { query: 'lucas jupiler', extraWords });
  assert.deepEqual(r2.entries.map(e => e.id), [a.id], 'nom + boisson combinés');
  const r3 = filterHistoryEntries(entries, { query: 'aniv', extraWords });
  assert.equal(r3.approx, true, 'faute tolérée → résultats approchants');
  // Sans extraWords (mode jour) : le nom n'est pas cherché.
  assert.equal(filterHistoryEntries(entries, { query: 'anniv' }).entries.length, 0);
});

// ── Page d'une session ─────────────────────────────────────────────

test('registre de la page session — chaque section de Stats est décidée', () => {
  const inPage = new Set(SESSION_PAGE_SECTIONS.map(s => s.id));
  const excluded = new Set(Object.keys(SESSION_EXCLUDED_SECTIONS));
  for (const s of STATS_SECTIONS) {
    assert.ok(inPage.has(s.id) !== excluded.has(s.id),
      `section « ${s.id} » : à déclarer dans SESSION_PAGE_SECTIONS XOR SESSION_EXCLUDED_SECTIONS`);
  }
  for (const id of excluded) assert.ok(STATS_SECTIONS.some(s => s.id === id), `exclusion inconnue ${id}`);
  // Têtes fixes puis l'ordre de Stats ; masquages vue ami.
  const order = sessionPageSectionOrder(['map', 'top', 'general', 'temporal', 'category', 'spending', 'bac']);
  assert.deepEqual(order.map(s => s.id),
    ['general', 'bac', 'session-drinks', 'map', 'top', 'temporal', 'category', 'spending']);
  const friend = sessionPageSectionOrder([], { hideMap: true, hidePrice: true });
  assert.ok(!friend.some(s => s.id === 'map' || s.id === 'spending'));
  assert.ok(Math.abs(BAC_LEGAL_LIMIT - 500) < 1e-9);
  assert.deepEqual(widmarkParams({}), { weight: 70, gender: 'male' });
  assert.deepEqual(widmarkParams({ userWeight: '82', userGender: 'female' }), { weight: 82, gender: 'female' });
});

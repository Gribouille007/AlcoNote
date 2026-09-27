// Recherche tolérante (Catégories + Historique) et helpers de rendu de
// l'Historique (groupement par jour, stabilité des références) — data.jsx.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared', 'data');

const {
  foldSearchText, searchTokens, boundedEditDistance, searchTokenScore, searchSpecScore,
  createSearcher, familySearchWords, searchFamilies, filterHistoryEntries,
  groupEntriesByDay, stabilizeEntries, stabilizeDayGroups,
  buildFamilies, flattenEntries,
} = global;

const fam = (name, category, quantity = 33, unit = 'cL', alcohol = 5, n = 1) => ({
  id: `fam::${name}::${quantity}`, name, category, quantity, unit, alcohol,
  entries: Array.from({ length: n }, (_, i) => ({ id: `${name}-${quantity}-${i}`, ts: `2026-01-0${1 + (i % 9)}T20:00` })),
});
const names = (list) => list.map((f) => `${f.name} ${f.quantity}`);

test('foldSearchText — casse, accents, ligatures, virgule décimale', () => {
  assert.equal(foldSearchText('BIÈRE'), 'biere');
  assert.equal(foldSearchText('Côtes du Rhône'), 'cotes du rhone');
  assert.equal(foldSearchText('Cœur de Bœuf'), 'coeur de boeuf');
  assert.equal(foldSearchText('Ænigma Straße'), 'aenigma strasse');
  assert.equal(foldSearchText('5,2°'), '5.2°');
  assert.equal(foldSearchText('Bière'), foldSearchText('Bière'), 'NFD = NFC');
  assert.equal(foldSearchText(null), '');
});

test('searchTokens — mots repliés, dédoublonnés, nombres décimaux conservés', () => {
  assert.deepEqual(searchTokens("  Leffe  Blonde, l'Abbaye "), ['leffe', 'blonde', 'l', 'abbaye']);
  assert.deepEqual(searchTokens('Jupiler 5,2° 25cl'), ['jupiler', '5.2', '25cl']);
  assert.deepEqual(searchTokens('bière BIERE'), ['biere'], 'doublon replié');
  assert.deepEqual(searchTokens('...'), []);
  assert.deepEqual(searchTokens(''), []);
});

test('boundedEditDistance — OSA exacte sous la borne, borne+1 au-delà', () => {
  assert.equal(boundedEditDistance('jupiler', 'jupiler', 2), 0);
  assert.equal(boundedEditDistance('jupliler', 'jupiler', 2), 1, 'insertion');
  assert.equal(boundedEditDistance('jupilre', 'jupiler', 2), 1, 'transposition = 1');
  assert.equal(boundedEditDistance('chardonay', 'chardonnay', 2), 1);
  assert.equal(boundedEditDistance('abc', 'xyz', 1), 2, 'au-delà → borne + 1');
  assert.equal(boundedEditDistance('a', 'abcdef', 2), 3, 'écart de longueur > borne');
  assert.equal(boundedEditDistance('', 'ab', 5), 2);
});

test('searchTokenScore — exact < préfixe < contenu < approché ; bornes de tolérance', () => {
  assert.equal(searchTokenScore('leffe', 'leffe'), 0);
  assert.equal(searchTokenScore('lef', 'leffe'), 1);
  assert.equal(searchTokenScore('ffe', 'leffe'), 2);
  assert.equal(searchTokenScore('e', 'leffe'), Infinity, '1 lettre : préfixe uniquement');
  assert.equal(searchTokenScore('l', 'leffe'), 1);
  // Fautes : 1 dès 4 lettres, 2 dès 8.
  assert.equal(searchTokenScore('lefe', 'leffe'), 4);
  assert.equal(searchTokenScore('vim', 'vin'), Infinity, '3 lettres : jamais d’approché');
  assert.equal(searchTokenScore('chardonay', 'chardonnay'), 4);
  assert.equal(searchTokenScore('chrdonay', 'chardonnay'), 5, '8 lettres → 2 fautes tolérées');
  assert.equal(searchTokenScore('heinkn', 'heineken'), Infinity, '6 lettres → 1 seule faute');
  // Début de mot approché (frappe en cours avec une faute).
  assert.equal(searchTokenScore('jupli', 'jupiler'), 4);
  // Nombres : exact ou préfixe, jamais contenu ni approché.
  assert.equal(searchTokenScore('5', '5.2'), 1);
  assert.equal(searchTokenScore('5', '25'), Infinity);
  assert.equal(searchTokenScore('2500', '3500'), Infinity);
});

test('searchSpecScore — caractéristiques : exact, ou préfixe dès 2 caractères / numérique', () => {
  assert.equal(searchSpecScore('cl', 'cl'), 0);
  assert.equal(searchSpecScore('c', 'cl'), Infinity, 'le « c » de « Histo C » ne trouve pas les cL');
  assert.equal(searchSpecScore('eco', 'ecocup'), 1);
  assert.equal(searchSpecScore('5', '50'), 1);
  assert.equal(searchSpecScore('ecocop', 'ecocup'), Infinity, 'jamais d’approché');
});

test('createSearcher — multi-mots dans n’importe quel ordre, requête vide → null', () => {
  assert.equal(createSearcher(''), null);
  assert.equal(createSearcher('   '), null);
  const w = familySearchWords(fam('Jupiler', 'Bière', 50, 'cL', 5.2));
  const m = createSearcher('50 jup');
  assert.deepEqual(m([w.text], w.spec), { score: 1, fuzzy: false }, '50 exact + jup préfixe');
  assert.equal(createSearcher('jup 33')([w.text], w.spec), null, 'chaque mot doit correspondre');
  assert.deepEqual(createSearcher('biere 5,2')([w.text], w.spec), { score: 0, fuzzy: false });
  assert.deepEqual(createSearcher('50cl')([w.text], w.spec), { score: 0, fuzzy: false });
  assert.equal(createSearcher('jupliler')([w.text], w.spec).fuzzy, true);
});

test('searchFamilies — exacts triés par pertinence puis ordre reçu ; approchés séparés', () => {
  const fams = [
    fam('Leffe Blonde', 'Bière', 33, 'cL', 6.6, 9),
    fam('Jupiler', 'Bière', 25, 'cL', 5.2, 5),
    fam('Blonde de Garde', 'Bière', 33, 'cL', 7, 3),
    fam('Jupiler', 'Bière', 50, 'cL', 5.2, 2),
    fam('Chardonnay', 'Vin', 12, 'cL', 13, 4),
  ];
  // Pertinence : « blonde » est un mot exact des deux → ordre reçu (le plus bu).
  assert.deepEqual(names(searchFamilies(fams, 'blonde').exact), ['Leffe Blonde 33', 'Blonde de Garde 33']);
  // Préfixe (1) devant contenu (2) : « jup » vs rien d'autre.
  assert.deepEqual(names(searchFamilies(fams, 'JUP').exact), ['Jupiler 25', 'Jupiler 50']);
  assert.deepEqual(names(searchFamilies(fams, 'jupiler 50').exact), ['Jupiler 50']);
  // Catégorie : « bière » (sans accent) trouve toutes les bières.
  assert.equal(searchFamilies(fams, 'biere').exact.length, 4);
  // Faute de frappe → section approchée, pas exacte.
  const r = searchFamilies(fams, 'chardonay');
  assert.deepEqual(r.exact, []);
  assert.deepEqual(names(r.approx), ['Chardonnay 12']);
  // Filtre catégorie canonique + requête vide = toute la catégorie.
  const v = searchFamilies(fams, '', { category: ' Vin' });
  assert.equal(v.active, false);
  assert.deepEqual(names(v.exact), ['Chardonnay 12']);
  assert.deepEqual(searchFamilies(fams, 'zzzz'), { exact: [], approx: [], active: true });
});

test('searchFamilies — pas de faux positif de tolérance sur les mots courts', () => {
  const fams = [fam('Gin Tonic', 'Cocktail'), fam('Vin chaud', 'Vin')];
  assert.deepEqual(names(searchFamilies(fams, 'vin').exact), ['Vin chaud 33']);
  assert.deepEqual(searchFamilies(fams, 'vin').approx, [], '« vin » ≠ « gin » (3 lettres)');
});

// Historique : vraies familles/entrées via buildFamilies + flattenEntries.
const drinks = [
  { id: 1, name: 'Jupiler', category: 'Bière', quantity: 25, unit: 'cL', alcoholContent: 5.2, date: '2026-03-01', time: '20:00', location: { address: 'Café Belga, Bruxelles' } },
  { id: 2, name: 'Jupiler', category: 'Bière ', quantity: 25, unit: 'cL', alcoholContent: 5.2, date: '2026-03-02', time: '21:00' },
  { id: 3, name: 'Chardonnay', category: 'Vin', quantity: 12, unit: 'cL', alcoholContent: 13, date: '2026-03-02', time: '22:00', location: { address: 'Le Délirium' } },
  { id: 4, name: 'Histo C', category: 'Vin', quantity: 12, unit: 'cL', alcoholContent: 13, date: '2026-03-03', time: '19:00' },
];
const entries = () => flattenEntries(buildFamilies(drinks));
const ids = (list) => list.map((e) => e.id).sort();

test('filterHistoryEntries — lieu, catégorie canonique, politique « exact d’abord »', () => {
  assert.deepEqual(ids(filterHistoryEntries(entries(), { query: 'belga' }).entries), [1], 'lieu cherché');
  assert.deepEqual(ids(filterHistoryEntries(entries(), { query: 'delirium' }).entries), [3], 'accents du lieu ignorés');
  assert.deepEqual(ids(filterHistoryEntries(entries(), { category: 'Bière' }).entries), [1, 2], 'espace legacy');
  assert.deepEqual(ids(filterHistoryEntries(entries(), { query: 'histo c' }).entries), [4],
    'le « c » ne correspond pas à l’unité cL des autres');
  const exact = filterHistoryEntries(entries(), { query: 'jupiler' });
  assert.equal(exact.approx, false);
  assert.deepEqual(ids(exact.entries), [1, 2]);
  const approx = filterHistoryEntries(entries(), { query: 'chardonay' });
  assert.equal(approx.approx, true, 'aucun exact → approchés signalés');
  assert.deepEqual(ids(approx.entries), [3]);
  const none = filterHistoryEntries(entries(), { query: 'xyz' });
  assert.deepEqual(none, { entries: [], approx: false });
  // Ordre chronologique conservé (plus récent d'abord).
  assert.deepEqual(filterHistoryEntries(entries(), {}).entries.map((e) => e.id), [4, 3, 2, 1]);
});

test('groupEntriesByDay — jours décroissants, total cL par jour', () => {
  const g = groupEntriesByDay(entries());
  assert.deepEqual(g.map((x) => x.day), ['2026-03-03', '2026-03-02', '2026-03-01']);
  assert.equal(g[1].entries.length, 2);
  assert.equal(g[1].totalCl, 37);
  assert.deepEqual(groupEntriesByDay([]), []);
});

test('stabilizeEntries / stabilizeDayGroups — références réutilisées sauf changement réel', () => {
  const a = stabilizeEntries(entries(), null);
  // Reconstruction complète, rien n'a changé → mêmes objets.
  const b = stabilizeEntries(entries(), a.cache);
  assert.ok(b.entries.every((e, i) => e === a.entries[i]), 'objets identiques réutilisés');
  const ga = stabilizeDayGroups(groupEntriesByDay(a.entries), null);
  const gb = stabilizeDayGroups(groupEntriesByDay(b.entries), ga.byDay);
  assert.ok(gb.groups.every((g, i) => g === ga.groups[i]), 'groupes de jour réutilisés');
  // Un drink modifié (prix) → SEULE son entrée et son jour changent.
  const edited = drinks.map((d) => (d.id === 3 ? { ...d, price: 4.5 } : d));
  const c = stabilizeEntries(flattenEntries(buildFamilies(edited)), b.cache);
  const e3 = c.entries.find((e) => e.id === 3);
  assert.notEqual(e3, b.entries.find((e) => e.id === 3), 'entrée modifiée = nouvel objet');
  assert.equal(e3.raw.price, 4.5, 'jamais de données périmées');
  assert.equal(c.entries.find((e) => e.id === 1), b.entries.find((e) => e.id === 1));
  const gc = stabilizeDayGroups(groupEntriesByDay(c.entries), gb.byDay);
  assert.notEqual(gc.groups[1], gb.groups[1], 'jour du 2 mars renouvelé');
  assert.equal(gc.groups[0], gb.groups[0], 'autres jours intacts');
  // Changement de prix de référence de famille → entrées de la famille renouvelées.
  const withRef = stabilizeEntries(flattenEntries(buildFamilies(drinks, {}, {
    'jupiler::25::cl::5.2': 2.5,
  })), b.cache);
  const e1 = withRef.entries.find((e) => e.id === 1);
  assert.notEqual(e1, b.entries.find((e) => e.id === 1));
  assert.equal(e1.family.referencePrice, 2.5);
});

test('performance — recherche approchée sur 3 000 entrées sous 150 ms (Node, sans throttling)', () => {
  const many = [];
  for (let i = 0; i < 3000; i++) {
    many.push({ id: i + 1, name: `Bière artisanale ${i % 90}`, category: i % 3 ? 'Bière' : 'Vin',
      quantity: 33, unit: 'cL', alcoholContent: 5 + (i % 5), date: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      time: '20:00', location: { address: `Bar ${i % 40}, Bruxelles` } });
  }
  const list = flattenEntries(buildFamilies(many));
  const t0 = process.hrtime.bigint();
  for (const q of ['artisanal', 'artisnale bruxelle', 'bar 12', 'chardonay']) filterHistoryEntries(list, { query: q });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 150, `4 requêtes en ${ms.toFixed(1)} ms`);
});

// Helpers purs de proto/data.jsx : familles, stats de catégories, prix de
// référence, coordonnées. Reprend 100 % des assertions de l'ancien
// tools/test-icons.js (computeCategoryStats / sameFamily) et les complète.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared', 'data');

const {
  canonicalCat, computeCategoryStats, sameFamily, familyKey, buildFamilies,
  flattenEntries, ratingKey, priceRefsFromSettings, familyPriceKey,
  getDrinkCoords, drinkPlaceLabel,
} = global;

test('computeCategoryStats — dédoublonne les graphies d’une même catégorie', () => {
  const categories = [{ id: 1, name: 'Bière' }, { id: 2, name: 'Vin' }];
  const families = [
    { category: 'Bière ', entries: [{}, {}] }, // espace final → doit replier dans id 1
    { category: 'Bière', entries: [{}] },
    { category: 'Rhum', entries: [{}] },        // inconnue → carte synthétique
  ];
  const res = computeCategoryStats(categories, families);
  const biere = res.find((r) => canonicalCat(r.name) === 'Bière');
  const rhum = res.find((r) => r.name === 'Rhum');
  assert.equal(res.filter((r) => canonicalCat(r.name) === 'Bière').length, 1, 'pas de doublon Bière');
  assert.equal(biere && biere.id, 1, 'Bière garde son vrai id');
  assert.equal(biere && biere.entries, 3, 'entrées repliées (2 + 1)');
  assert.equal(biere && biere.families, 2, 'familles repliées entre graphies');
  assert.equal(!!rhum && String(rhum.id).startsWith('cat-'), true, 'inconnue reste synthétique');
});

test('sameFamily — prédicat d’identité (alcoholContent ↔ alcohol)', () => {
  const fam = { name: 'Heineken', quantity: 50, unit: 'cL', alcohol: 5 };
  assert.equal(sameFamily({ name: 'Heineken', quantity: 50, unit: 'cL', alcoholContent: 5 }, fam), true);
  assert.equal(sameFamily({ name: '  heineken ', quantity: 50, unit: 'cl', alcoholContent: 5 }, fam), true,
    'nom + unité trimés / insensibles à la casse');
  assert.equal(sameFamily({ name: 'Heineken', quantity: 33, unit: 'cL', alcoholContent: 5 }, fam), false);
  assert.equal(sameFamily({ name: 'Heineken', quantity: 50, unit: 'cL', alcoholContent: 8 }, fam), false);
  assert.equal(sameFamily({ name: 'Affligem', quantity: 50, unit: 'cL', alcoholContent: 5 }, fam), false);
  assert.equal(sameFamily({ name: 'X', quantity: 50, unit: 'cL' }, { name: 'X', quantity: 50, unit: 'cL' }), true,
    'abv absent des deux côtés → 0 === 0');
});

test('familyKey — catégorie EXCLUE de la clé, normalisations', () => {
  assert.equal(familyKey('Chouffe', 33, 'cL', 8), familyKey(' chouffe ', 33, 'CL', 8));
  assert.equal(familyKey('X', 33, 'cL', null), familyKey('X', 33, 'cL', 0), 'abv null → 0');
  assert.notEqual(familyKey('X', 33, 'cL', 5), familyKey('X', 50, 'cL', 5));
  // Deux drinks de catégories différentes mais même tuple → même clé.
  assert.equal(familyKey('X', 33, 'cL', 5), familyKey('X', 33, 'cL', 5));
});

test('ratingKey — clé canonique trim + lowercase', () => {
  assert.equal(ratingKey(' Pilsner '), 'pilsner');
  assert.equal(ratingKey('PILSNER'), 'pilsner');
  assert.equal(ratingKey(null), '');
});

test('buildFamilies — regroupement, tri, ratings et prix de référence', () => {
  const drinks = [
    { id: 1, name: 'Chouffe', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 8, date: '2026-06-01', time: '20:00', price: 4.5, priceIsCustom: false },
    { id: 2, name: 'chouffe ', category: 'Bière', quantity: 33, unit: 'cL', alcoholContent: 8, date: '2026-06-02', time: '21:00', price: 9, priceIsCustom: true },
    { id: 3, name: 'Spritz', category: 'Cocktail', quantity: 1, unit: 'EcoCup', alcoholContent: 11, date: '2026-06-03', time: '19:00' },
  ];
  const fams = buildFamilies(drinks, { chouffe: 4 }, {});
  assert.equal(fams.length, 2, 'graphies de Chouffe repliées en une famille');
  const chouffe = fams[0];
  assert.equal(chouffe.entries.length, 2, 'tri par nb d’entrées desc');
  assert.equal(chouffe.rating, 4, 'rating lu via ratingKey');
  assert.equal(chouffe.entries[0].id, 2, 'entrées triées ts desc (la plus récente d’abord)');
  // Le prix custom (id 2, le plus récent) ne doit PAS devenir la référence :
  // fallback sur la dernière entrée NON custom qui porte un prix (id 1).
  assert.equal(chouffe.referencePrice, 4.5);
  // priceRefs explicite prioritaire sur le fallback.
  const key = familyKey('Chouffe', 33, 'cL', 8);
  const fams2 = buildFamilies(drinks, {}, { [key]: 3.9 });
  assert.equal(fams2[0].referencePrice, 3.9);
});

test('flattenEntries — aplati global trié ts desc avec back-pointer', () => {
  const fams = buildFamilies([
    { id: 1, name: 'A', quantity: 33, unit: 'cL', alcoholContent: 5, date: '2026-06-01', time: '10:00' },
    { id: 2, name: 'B', quantity: 33, unit: 'cL', alcoholContent: 5, date: '2026-06-02', time: '10:00' },
  ], {}, {});
  const flat = flattenEntries(fams);
  assert.equal(flat.length, 2);
  assert.equal(flat[0].id, 2, 'la plus récente d’abord');
  assert.equal(flat[0].family.name, 'B', 'back-pointer famille');
});

test('priceRefsFromSettings — filtre price.ref.*, ignore les non-finis', () => {
  const settings = {
    'price.ref.chouffe::33::cl::8': '4.5',
    'price.ref.broken::1::cl::0': 'abc',
    'theme': 'dark',
  };
  const refs = priceRefsFromSettings(settings);
  assert.deepEqual(refs, { 'chouffe::33::cl::8': 4.5 });
  assert.deepEqual(priceRefsFromSettings(null), {});
  // familyPriceKey reconstruit la même clé depuis une famille.
  assert.equal(
    familyPriceKey({ name: 'Chouffe', quantity: 33, unit: 'cL', alcohol: 8 }),
    'price.ref.chouffe::33::cl::8'
  );
});

test('getDrinkCoords — conversion STRICTE (régression parseFloat laxiste)', () => {
  // Format imbriqué.
  assert.deepEqual(
    getDrinkCoords({ location: { latitude: 48.85, longitude: 2.35 } }),
    { lat: 48.85, lng: 2.35 }
  );
  // Ancien format à plat, prioritaire sur location.
  assert.deepEqual(
    getDrinkCoords({ latitude: 50.6, longitude: 3.06, location: { latitude: 0, longitude: 0 } }),
    { lat: 50.6, lng: 3.06 }
  );
  // Strings numériques valides OK.
  assert.deepEqual(
    getDrinkCoords({ location: { latitude: '48.85', longitude: '2.35' } }),
    { lat: 48.85, lng: 2.35 }
  );
  // parseFloat acceptait "48.8abc" → désormais rejeté.
  assert.equal(getDrinkCoords({ location: { latitude: '48.8abc', longitude: 2.35 } }), null);
  // null/'' ne doivent JAMAIS devenir (0,0).
  assert.equal(getDrinkCoords({ location: { latitude: null, longitude: 2.35 } }), null);
  assert.equal(getDrinkCoords({ location: { latitude: '', longitude: '  ' } }), null);
  assert.equal(getDrinkCoords({}), null);
  assert.equal(getDrinkCoords(null), null);
});

test('drinkPlaceLabel — priorité label > name > address', () => {
  assert.equal(drinkPlaceLabel({ location: { label: 'Chez Mo', name: 'Bar', address: '1 rue X' } }), 'Chez Mo');
  assert.equal(drinkPlaceLabel({ location: { name: 'Bar', address: '1 rue X' } }), 'Bar');
  assert.equal(drinkPlaceLabel({ location: { address: '1 rue X' } }), '1 rue X');
  assert.equal(drinkPlaceLabel({ location: {} }), null);
  assert.equal(drinkPlaceLabel({}), null);
});

// ── Prix intelligent (suggestPriceForVolume) ───────────────────────

test('suggestPriceForVolume — €/L hérité de la famille homonyme, prorata arrondi au centime', () => {
  const { suggestPriceForVolume } = global;
  // Jupiler 25 cL à 2 € → 8 €/L. entries triées récent → ancien.
  const fams = [{
    name: 'Jupiler', quantity: 25, unit: 'cL', alcohol: 5.2, referencePrice: 2,
    entries: [{ ts: '2026-06-02T20:00' }, { ts: '2026-06-01T20:00' }],
  }];
  // 50 cL → 4 € ; 33 cL → 2.64 € (8 €/L × 0,33 L) ; unités converties.
  assert.deepEqual(
    suggestPriceForVolume(fams, 'Jupiler', 50, 5.2),
    { price: 4, perLiter: 8, exact: false,
      source: { name: 'Jupiler', quantity: 25, unit: 'cL', referencePrice: 2 } }
  );
  assert.equal(suggestPriceForVolume(fams, 'jupiler ', 33, 5.2).price, 2.64,
    'nom trimé/insensible à la casse, arrondi 2 décimales');
  // Volume exact → prix de référence TEL QUEL (pas de re-arrondi).
  assert.equal(suggestPriceForVolume(fams, 'Jupiler', 25, 5.2).exact, true);
  assert.equal(suggestPriceForVolume(fams, 'Jupiler', 25, 5.2).price, 2);
  // Aucun homonyme tarifé / volume nul → null.
  assert.equal(suggestPriceForVolume(fams, 'Chouffe', 33, 8), null);
  assert.equal(suggestPriceForVolume(fams, 'Jupiler', 0, 5.2), null);
  assert.equal(suggestPriceForVolume([], 'Jupiler', 33, 5.2), null);
  assert.equal(suggestPriceForVolume(fams, '', 33, 5.2), null);
});

test('suggestPriceForVolume — priorités : contenant exact > degré > première famille tarifée', () => {
  const { suggestPriceForVolume } = global;
  const fams = [
    // Tarifée APRÈS la 25 cL mais €/L différent (pinte happy hour 9 €/L).
    { name: 'Jupiler', quantity: 50, unit: 'cL', alcohol: 5.2, referencePrice: 4.5,
      entries: [{ ts: '2026-06-03T20:00' }] },
    // Première boisson tarifée (8 €/L) → impose le €/L pour les autres volumes.
    { name: 'Jupiler', quantity: 25, unit: 'cL', alcohol: 5.2, referencePrice: 2,
      entries: [{ ts: '2026-06-01T20:00' }] },
    // Homonyme sans prix de référence → jamais source.
    { name: 'Jupiler', quantity: 75, unit: 'cL', alcohol: 5.2, referencePrice: null,
      entries: [{ ts: '2026-05-01T20:00' }] },
  ];
  // Le contenant exact (50 cL) garde SON prix de référence, pas le prorata 25 cL.
  assert.equal(suggestPriceForVolume(fams, 'Jupiler', 50, 5.2).price, 4.5);
  // Autre volume → la PREMIÈRE famille tarifée (25 cL, plus ancienne) impose le €/L.
  assert.equal(suggestPriceForVolume(fams, 'Jupiler', 33, 5.2).price, 2.64);
  // Conversion d'unités : 0,5 L = le contenant 50 cL → sa référence exacte.
  assert.equal(suggestPriceForVolume(fams, 'Jupiler', global.toCl(0.5, 'L'), 5.2).price, 4.5);
  // Même degré préféré quand aucun contenant exact : 8° matche la seule 8°.
  const mix = [
    { name: 'Brune', quantity: 25, unit: 'cL', alcohol: 5, referencePrice: 2,
      entries: [{ ts: '2026-06-01T20:00' }] },
    { name: 'Brune', quantity: 33, unit: 'cL', alcohol: 8, referencePrice: 4,
      entries: [{ ts: '2026-06-02T20:00' }] },
  ];
  // 50 cL à 8° → source 33 cL 8° (12,12 €/L) malgré la 25 cL plus ancienne.
  assert.equal(suggestPriceForVolume(mix, 'Brune', 50, 8).price, 6.06);
});

test('suggestPriceForVolume — cas limites : EcoCup, prix négatif/invalide ignorés', () => {
  const { suggestPriceForVolume, toCl } = global;
  // Source en EcoCup (1 EcoCup = 25 cL) à 3 € → 12 €/L.
  const fams = [
    { name: 'Kro', quantity: 1, unit: 'EcoCup', alcohol: 5, referencePrice: 3,
      entries: [{ ts: '2026-06-01T20:00' }] },
    // Références invalides : jamais sources.
    { name: 'Kro', quantity: 50, unit: 'cL', alcohol: 5, referencePrice: -2,
      entries: [{ ts: '2026-06-02T20:00' }] },
    { name: 'Kro', quantity: 33, unit: 'cL', alcohol: 5, referencePrice: 'abc',
      entries: [{ ts: '2026-06-03T20:00' }] },
  ];
  assert.equal(suggestPriceForVolume(fams, 'Kro', 50, 5).price, 6, '12 €/L × 0,5 L');
  assert.equal(suggestPriceForVolume(fams, 'Kro', toCl(1, 'EcoCup'), 5).price, 3,
    'contenant exact EcoCup → référence telle quelle');
  // Volume énorme : prorata linéaire, fini.
  assert.equal(suggestPriceForVolume(fams, 'Kro', 1000, 5).price, 120);
});

// Helpers purs de proto/shared.jsx (chargés depuis le bundle compilé).
// Reprend 100 % des assertions de l'ancien tools/test-icons.js (sections
// canonicalCat / parseDecimal / ethanolGrams) et les complète.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared');

const {
  canonicalCat, parseDecimal, toCl,
  ethanolGrams, drinkAlcoholGrams, ETHANOL_DENSITY_G_PER_ML,
  fmtPrice, localDate, localTime, fmtDateMedium, fmtDayHeader,
  catColor, catBg, withAlpha,
  applyCatHueOverrides, defaultCatHue, wheelIndexForOffset, wheelOffsetForIndex,
} = global;

test('canonicalCat — trim + normalisation NFC', () => {
  assert.equal(typeof canonicalCat, 'function');
  assert.equal(canonicalCat('  Bière  '), 'Bière');
  // NFD (e + combining grave) et NFC (è précomposé) doivent converger.
  const nfd = 'Bière';
  assert.equal(canonicalCat(nfd), canonicalCat('Bière'));
  assert.equal(canonicalCat(null), '');
  assert.equal(canonicalCat(undefined), '');
  assert.equal(canonicalCat(''), '');
});

test('parseDecimal — virgule ou point, NaN si invalide', () => {
  assert.equal(typeof parseDecimal, 'function');
  assert.equal(parseDecimal('5.5'), 5.5);
  assert.equal(parseDecimal('5,5'), 5.5);
  assert.equal(parseDecimal('0,789'), 0.789);
  assert.equal(parseDecimal(' 33 '), 33);
  assert.ok(Number.isNaN(parseDecimal('')));
  assert.ok(Number.isNaN(parseDecimal(null)));
  assert.ok(Number.isNaN(parseDecimal('abc')));
});

test('toCl — conversions d’unités', () => {
  assert.equal(toCl(33, 'cL'), 33);
  assert.equal(toCl(0.5, 'L'), 50);
  assert.equal(toCl(0.5, 'l'), 50);
  assert.equal(toCl(2, 'EcoCup'), 50);
  assert.equal(toCl(2, 'ecocup'), 50);
  assert.equal(toCl(330, 'mL'), 33);
  assert.equal(toCl(25, null), 25, 'unité absente → passthrough');
});

test('ethanolGrams / drinkAlcoholGrams — masse d’alcool pur', () => {
  assert.equal(ETHANOL_DENSITY_G_PER_ML, 0.789);
  assert.equal(Math.round(ethanolGrams(50, 5) * 10) / 10, 19.7, '50cL @ 5% ≈ 19.7 g');
  assert.equal(ethanolGrams(50, 0), 0);
  assert.equal(ethanolGrams(50, null), 0, 'abv null gardé → 0 g');
  assert.equal(ethanolGrams(0, 5), 0);
  assert.equal(
    drinkAlcoholGrams({ quantity: 50, unit: 'cl', alcoholContent: 5 }),
    ethanolGrams(50, 5)
  );
  assert.equal(
    drinkAlcoholGrams({ quantity: 0.5, unit: 'L', alcoholContent: 5 }),
    ethanolGrams(50, 5),
    '0,5 L = 50 cL via toCl'
  );
});

test('fmtPrice — € français, 2 décimales max, tirets sur invalide', () => {
  assert.equal(fmtPrice(4.5), '4,5 €');
  assert.equal(fmtPrice(4), '4 €');
  assert.equal(fmtPrice(4.567), '4,57 €', 'arrondi à 2 décimales');
  assert.equal(fmtPrice('3.2'), '3,2 €', 'string numérique acceptée');
  assert.equal(fmtPrice(null), '—');
  assert.equal(fmtPrice(''), '—');
  assert.equal(fmtPrice('abc'), '—');
});

test('localDate / localTime — composantes locales paddées', () => {
  const d = new Date(2026, 5, 9, 7, 5); // 9 juin 2026 07:05 locale
  assert.equal(localDate(d), '2026-06-09');
  assert.equal(localTime(d), '07:05');
  const j = new Date(2026, 0, 1, 0, 0);
  assert.equal(localDate(j), '2026-01-01');
  assert.equal(localTime(j), '00:00');
});

test('fmtDateMedium / fmtDayHeader — formats français', () => {
  assert.equal(fmtDateMedium('2026-02-03'), '3 févr.');
  assert.equal(fmtDateMedium(null), '—');
  assert.equal(fmtDateMedium('not-a-date'), '—');
  // 9 juin 2026 = mardi.
  assert.equal(fmtDayHeader(new Date(2026, 5, 9)), 'mar. 9 juin.');
});

test('catColor / catBg — oklch déterministe, teinte stable par nom', () => {
  const a = catColor('Hydromel', 70);
  const b = catColor('Hydromel', 70);
  assert.equal(a, b, 'même nom inconnu → même couleur (hash déterministe)');
  assert.match(a, /^oklch\(/);
  assert.match(catColor('Bière', 70), /^oklch\(/);
  assert.match(catBg('Bière'), /^oklch\(/);
});

test('withAlpha — ajoute l’alpha aux couleurs oklch, passthrough sinon', () => {
  assert.equal(withAlpha('oklch(70% 0.1 65)', 0.4), 'oklch(70% 0.1 65 / 0.4)');
  assert.equal(withAlpha('#fff', 0.4), '#fff', 'non-oklch renvoyé tel quel');
  assert.equal(withAlpha(null, 0.4), null);
});

// ── applyCatHueOverrides (couleur de catégorie) ─────────────────────

test('applyCatHueOverrides — surcharge la teinte, conserve chroma/clarté', () => {
  // Teinte par défaut de "Bière" (depuis CAT_DEFAULT).
  const before = catColor('Bière', 60);
  applyCatHueOverrides({ 'Bière': 200 });
  const after = catColor('Bière', 60);
  assert.notEqual(after, before, 'la couleur change');
  assert.ok(after.includes('200'), 'la teinte 200 est appliquée');
  // Le chroma (2e composante OKLCH) reste celui du défaut (0.16 pour Bière).
  assert.ok(after.includes('0.16'), 'chroma par défaut conservé');
  // Reset → retour au défaut.
  applyCatHueOverrides({});
  assert.equal(catColor('Bière', 60), before, 'sans surcharge → teinte par défaut');
});

test('applyCatHueOverrides — idempotent, indépendant de l’ordre, normalise', () => {
  applyCatHueOverrides({ 'Vin': 400 });           // 400 → 40 (mod 360)
  assert.ok(catColor('Vin', 60).includes('40'), '400 normalisé en 40');
  applyCatHueOverrides({ 'Vin': 400 });           // idempotent
  assert.ok(catColor('Vin', 60).includes('40'));
  // Retrait de la surcharge → repli sur le défaut nommé.
  applyCatHueOverrides({});
  assert.equal(catColor('Vin', 60), `oklch(60% 0.18 15)`, 'défaut Vin (hue 15) restauré');
});

test('applyCatHueOverrides — catégorie inconnue prend la teinte donnée', () => {
  applyCatHueOverrides({ 'Kombucha': 123 });
  assert.ok(catColor('Kombucha', 60).includes('123'), 'teinte custom sur nom inconnu');
  applyCatHueOverrides({});
  // Après reset, repli sur le hash déterministe (= defaultCatHue).
  assert.ok(catColor('Kombucha', 60).includes(String(defaultCatHue('Kombucha'))));
});

// ── Maths de la roue horaire ────────────────────────────────────────

test('wheelOffsetForIndex / wheelIndexForOffset — aller-retour + clamp', () => {
  assert.equal(wheelOffsetForIndex(5, 36), 180);
  assert.equal(wheelIndexForOffset(180, 36, 24), 5, 'offset exact → index');
  assert.equal(wheelIndexForOffset(180 + 17, 36, 24), 5, 'arrondi vers le plus proche (bas)');
  assert.equal(wheelIndexForOffset(180 + 19, 36, 24), 6, 'arrondi vers le plus proche (haut)');
  assert.equal(wheelIndexForOffset(-100, 36, 24), 0, 'clamp bas');
  assert.equal(wheelIndexForOffset(99999, 36, 24), 23, 'clamp haut (count-1)');
});

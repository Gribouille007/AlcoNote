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
  applyCatHueOverrides, defaultCatHue,
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
  // Indépendant du fuseau : un ISO nu ne recule JAMAIS d'un jour (l'ancien
  // `new Date(iso)` parsait en UTC minuit → « 31 déc. » en fuseau UTC−x).
  assert.equal(fmtDateMedium('2026-01-01'), '1 janv.');
  assert.equal(fmtDateMedium('2026-12-31'), '31 déc.');
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

test('RÉGRESSION : palette CANONIQUE — NFD/espaces résolvent la même couleur', () => {
  // « Bière » en NFD (e + accent grave combinant U+0300) : même catégorie que
  // la forme NFC — la palette (défaut, hash ET surcharge) doit être identique
  // quelle que soit la forme brute rencontrée (import, vieux clavier…).
  const nfd = 'Bière';
  assert.notEqual(nfd, 'Bière', 'les deux chaînes diffèrent bien au sens strict');
  assert.equal(catColor(nfd, 60), catColor('Bière', 60), 'NFD = NFC (défaut)');
  assert.equal(catColor(' Bière ', 60), catColor('Bière', 60), 'espaces ignorés');
  assert.equal(defaultCatHue(nfd), defaultCatHue('Bière'), 'defaultCatHue canonique');
  assert.equal(defaultCatHue(' Soft '), defaultCatHue('Soft'), 'hash canonique (nom inconnu)');

  // Surcharge posée sous le nom canonique (comme CategoryIconsProvider) →
  // résolue depuis TOUTE variante brute. C'était le bug « la couleur ne
  // change que pour certaines catégories ».
  applyCatHueOverrides({ 'Bière': 211, 'Soft': 97 });
  assert.ok(catColor(nfd, 60).includes('211'), 'surcharge résolue via NFD');
  assert.ok(catBg(' Bière ').includes('211'), 'catBg surchargé avec espaces');
  assert.ok(catColor('Soft ', 60).includes('97'), 'surcharge custom résolue via variante');
  applyCatHueOverrides({});
  assert.equal(catColor(nfd, 60), catColor('Bière', 60), 'reset symétrique');
});


test('keyboardViewportBox — overlay épinglé au viewport visible quand le clavier est ouvert', () => {
  const { keyboardViewportBox, KEYBOARD_MIN_PX } = global;
  // Pas de visualViewport (vieux moteur, jsdom) → comportement normal.
  assert.equal(keyboardViewportBox({ innerHeight: 800 }), null);
  assert.equal(keyboardViewportBox(null), null);
  // Clavier fermé, ou simple barre d'URL qui bouge → rien.
  assert.equal(keyboardViewportBox({ innerHeight: 800, visualViewport: { height: 800, offsetTop: 0 } }), null);
  assert.equal(keyboardViewportBox({ innerHeight: 800, visualViewport: { height: 800 - KEYBOARD_MIN_PX + 1, offsetTop: 0 } }), null);
  // Clavier ouvert (iOS / Chrome resizes-visual) : boîte visible.
  assert.deepEqual(keyboardViewportBox({ innerHeight: 800, visualViewport: { height: 460, offsetTop: 0 } }),
    { top: 0, height: 460 });
  // iOS a fait défiler le viewport visuel : la boîte suit son décalage.
  assert.deepEqual(keyboardViewportBox({ innerHeight: 800, visualViewport: { height: 460.4, offsetTop: 120.6 } }),
    { top: 121, height: 460 });
  // Valeurs aberrantes → null.
  assert.equal(keyboardViewportBox({ innerHeight: 0, visualViewport: { height: 400 } }), null);
});

// ── Motion : physique des gestes (sheets, balayage) ───────────────
const { MOTION, SHEET_DRAG, projectMomentum, rubberBand, shouldDismissSheet,
        SWIPE, swipeShouldCommit, pageAnimation, staggerStyle, usePressScale } = global;

test('MOTION — les trajets longs durent plus que les micro-transitions, les sorties sont les plus brèves', () => {
  assert.ok(Object.isFrozen(MOTION));
  assert.ok(MOTION.fast < MOTION.base && MOTION.base < MOTION.page && MOTION.page <= MOTION.sheet);
  assert.ok(MOTION.pressIn < MOTION.pressOut, 'enfoncement plus vif que le relâchement');
  for (const k of ['ease', 'easeOut', 'easeIn']) assert.match(MOTION[k], /^cubic-bezier\(/);
});

test('projectMomentum — atterrissage projeté proportionnel à l\'élan, signé, borné sur entrée invalide', () => {
  assert.equal(projectMomentum(0), 0);
  assert.ok(Math.abs(projectMomentum(1000) - 499) < 1e-6);   // 1000 px/s → ~499 px
  assert.equal(projectMomentum(-1000), -projectMomentum(1000));
  assert.equal(projectMomentum(NaN), 0);
  assert.equal(projectMomentum(Infinity), 0);
});

test('rubberBand — résistance progressive : suit de moins en moins, ne dépasse jamais la dimension', () => {
  assert.equal(rubberBand(0, 600), 0);
  const a = rubberBand(50, 600), b = rubberBand(100, 600), c = rubberBand(1e6, 600);
  assert.ok(a > 0 && a < 50, 'toujours en retrait du doigt');
  assert.ok(b > a && (b - a) < a, 'rendement décroissant');
  assert.ok(c < 600, 'asymptote = dimension');
  assert.equal(rubberBand(-80, 600), -rubberBand(80, 600));
  assert.equal(rubberBand(80, 0), 0);
  assert.equal(rubberBand(NaN, 600), 0);
});

test('shouldDismissSheet — la décision se prend sur le point d\'atterrissage projeté', () => {
  const size = 600;
  // Long glisser lent au-delà de la moitié : ferme.
  assert.equal(shouldDismissSheet({ offset: 320, velocity: 0, size }), true);
  // Petit glisser lent : reste ouverte.
  assert.equal(shouldDismissSheet({ offset: 80, velocity: 0, size }), false);
  // Petit coup sec vers le bas : l'élan suffit.
  assert.equal(shouldDismissSheet({ offset: 40, velocity: 900, size }), true);
  // Tirée loin puis RAMENÉE : jamais de fermeture, même au-delà de la moitié.
  assert.equal(shouldDismissSheet({ offset: 400, velocity: SHEET_DRAG.backVelocity - 1, size }), false);
  // Entrées dégénérées.
  assert.equal(shouldDismissSheet({ offset: 0, velocity: 5000, size }), false);
  assert.equal(shouldDismissSheet({ offset: -20, velocity: 5000, size }), false);
  assert.equal(shouldDismissSheet({ offset: 300, velocity: 0, size: 0 }), false);
  assert.equal(shouldDismissSheet({ offset: 320, velocity: NaN, size }), true);
});

test('swipeShouldCommit — seuil franchi OU coup sec, jamais un geste qui revient', () => {
  const threshold = 64;
  assert.equal(swipeShouldCommit({ offset: -70, velocity: 0, threshold }), true);
  assert.equal(swipeShouldCommit({ offset: -40, velocity: 0, threshold }), false);
  assert.equal(swipeShouldCommit({ offset: -SWIPE.flickMin, velocity: -SWIPE.flickVelocity, threshold }), true);
  assert.equal(swipeShouldCommit({ offset: -10, velocity: -3000, threshold }), false, 'course trop courte');
  assert.equal(swipeShouldCommit({ offset: -90, velocity: SWIPE.flickVelocity + 1, threshold }), false, 'le doigt revenait');
  assert.equal(swipeShouldCommit({ offset: 0, velocity: -3000, threshold }), false);
  assert.equal(swipeShouldCommit({ offset: 30, velocity: -3000, threshold }), false, 'balayage vers la droite');
});

test('pageAnimation — entrée décélérée, sortie accélérée plus brève, rien en reduced-motion', () => {
  assert.equal(pageAnimation(false, true), undefined);
  assert.equal(pageAnimation(true, true), undefined);
  assert.equal(pageAnimation(false, false), `pageIn ${MOTION.page}ms ${MOTION.easeOut}`);
  assert.equal(pageAnimation(true, false), `pageOut ${MOTION.fast}ms ${MOTION.easeIn} forwards`);
});

test('usePressScale — retour tactile par attribut, sans state React', () => {
  const press = usePressScale();
  assert.equal(press, usePressScale(), 'objet constant : aucun re-rendu induit');
  assert.equal(press.style, null);
  assert.equal(press.handlers['data-press'], '');
  const attrs = new Set();
  const el = {
    setAttribute: (k) => attrs.add(k), removeAttribute: (k) => attrs.delete(k),
    contains: (n) => n === inner,
  };
  const inner = { closest: () => inner };
  // Tap direct sur l'élément : enfoncé, puis relâché.
  press.handlers.onPointerDown({ currentTarget: el, target: { closest: () => el } });
  assert.ok(attrs.has('data-pressed'));
  press.handlers.onPointerUp({ currentTarget: el });
  assert.ok(!attrs.has('data-pressed'));
  // Tap sur un contrôle IMBRIQUÉ : le conteneur ne s'enfonce pas.
  press.handlers.onPointerDown({ currentTarget: el, target: inner });
  assert.ok(!attrs.has('data-pressed'));
});

test('staggerStyle — seuls les premiers items s\'animent', () => {
  assert.equal(staggerStyle(0, { reduced: true }), null);
  assert.equal(staggerStyle(13), null);
  assert.equal(staggerStyle(2).animationDelay, `${2 * MOTION.stagger}ms`);
});

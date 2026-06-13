// Primitives de proto/stats-charts.jsx : échelles d'axes (chartNiceMax /
// chartTicks / fmtTick), framing BAC (bacChartRange) et layout de la
// tooltip (chartTooltipLayout). Tout est pur — pas de rendu SVG ici.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { installStubs, loadDist } = require('./helpers/stub-globals');

installStubs();
loadDist('shared', 'stats-charts');

const { chartNiceMax, chartTicks, fmtTick, chartTooltipLayout, bacChartRange } = global;

// ── chartNiceMax ───────────────────────────────────────────────────

test('chartNiceMax — toujours ≥ v, mantisses 1/2/5/10', () => {
  assert.equal(chartNiceMax(0), 1, 'v falsy → 1');
  assert.equal(chartNiceMax(1, 2), 1);
  assert.equal(chartNiceMax(3, 2), 4);     // step 2
  assert.equal(chartNiceMax(40, 3), 60);   // step 20 (l'ancien arrondi « au plus proche » rendait 30 < v)
  assert.equal(chartNiceMax(99, 2), 100);  // step 50
  assert.equal(chartNiceMax(99, 4), 200);  // raw 24.75 → step 50 (échelle 1/2/5)
  for (const v of [0.4, 1, 2.5, 7, 19, 42, 130, 999]) {
    for (const t of [2, 3, 4]) {
      assert.ok(chartNiceMax(v, t) >= v, `max(${v},${t}) ≥ v`);
    }
  }
});

// ── chartTicks ─────────────────────────────────────────────────────

test('chartTicks — gridlines aux valeurs EXACTES (régression label médian)', () => {
  // Bug historique : max=3 sur 3 gridlines → médiane à 1.5 étiquetée « 2 »
  // (Math.round(max*0.5)). chartTicks(3, 2) donne max=4 et des valeurs
  // exactes 0/2/4 — plus de demi-step menteur.
  const t3 = chartTicks(3, 2);
  assert.equal(t3.max, 4);
  assert.deepEqual(t3.values, [0, 2, 4]);

  // Données ≤ 1 : le step descend à 0.5 — les valeurs restent exactes.
  const t1 = chartTicks(1, 2);
  assert.equal(t1.max, 1);
  assert.deepEqual(t1.values, [0, 0.5, 1]);

  // La médiane est toujours littéralement max/2 (jamais re-arrondie).
  for (const v of [1, 2, 3, 7, 12, 45, 80, 333]) {
    const { max, values } = chartTicks(v, 2);
    assert.equal(values.length, 3);
    assert.equal(values[0], 0);
    assert.equal(values[1], max / 2);
    assert.equal(values[2], max);
    assert.ok(max >= v);
  }
});

// ── fmtTick ────────────────────────────────────────────────────────

test('fmtTick — entiers nus, décimales à virgule française', () => {
  assert.equal(fmtTick(0), '0');
  assert.equal(fmtTick(2), '2');
  assert.equal(fmtTick(150), '150');
  assert.equal(fmtTick(0.5), '0,5');
  assert.equal(fmtTick(1.25), '1,3', 'arrondi à 1 décimale');
});

// ── chartTooltipLayout ─────────────────────────────────────────────

test('chartTooltipLayout — largeur proportionnelle à la ligne la plus longue', () => {
  const short = chartTooltipLayout({ x: 100, y: 80, lines: ['7h', '3'], width: 320, height: 140 });
  const long = chartTooltipLayout({
    x: 100, y: 80, lines: ['Mercredi 24 décembre', '1234,5 g · 30j'], width: 320, height: 140,
  });
  assert.ok(short.w >= 72, 'largeur plancher 72');
  assert.ok(long.w > short.w, 'une ligne longue élargit la box');
  assert.ok(long.w <= 320 - 16, 'jamais plus large que width − 2·pad');
});

test('chartTooltipLayout — clamp horizontal aux deux bords', () => {
  const W = 320, PAD = 8;
  const right = chartTooltipLayout({ x: 315, y: 80, lines: ['abc'], width: W, height: 140 });
  assert.ok(right.tx + right.w <= W - PAD, 'ne déborde pas à droite');
  const left = chartTooltipLayout({ x: 2, y: 80, lines: ['abc'], width: W, height: 140 });
  assert.ok(left.tx >= PAD, 'ne déborde pas à gauche');
});

test('chartTooltipLayout — flip sous le point près du haut, clamp bas', () => {
  // Point en haut du graphe : la position « au-dessus » cliperait le bord
  // supérieur → la box bascule SOUS le point.
  const top = chartTooltipLayout({ x: 100, y: 10, lines: ['a', 'b'], width: 320, height: 140 });
  assert.ok(top.ty >= 10, 'tooltip rendue sous le point');
  // Point tout en bas + flip : la box est re-clampée dans la hauteur.
  const bottom = chartTooltipLayout({ x: 100, y: 6, lines: ['a', 'b', 'c', 'd'], width: 320, height: 90 });
  assert.ok(bottom.ty + bottom.h <= 90 - 8, 'jamais sous le bord inférieur');
  assert.ok(bottom.ty >= 8, 'jamais au-dessus du bord supérieur');
});

test('chartTooltipLayout — sans height, comportement historique conservé (pas de clamp bas)', () => {
  const r = chartTooltipLayout({ x: 100, y: 500, lines: ['a'], width: 320 });
  assert.ok(r.ty > 320, 'libre verticalement quand height est inconnu');
});

// ── bacChartRange ──────────────────────────────────────────────────

test('bacChartRange — headroom 15 %, plancher 80, extras toujours visibles', () => {
  const flat = bacChartRange([{ t: 0, bac: 10 }, { t: 1, bac: 20 }]);
  assert.ok(flat.maxB >= 80, 'plancher 80 mg/L pour une courbe minuscule');

  const tall = bacChartRange([{ t: 0, bac: 0 }, { t: 1, bac: 700 }]);
  assert.ok(tall.maxB >= 700 * 1.15, 'le pic des données tient TOUJOURS sur le graphe');

  const withExtra = bacChartRange([{ t: 0, bac: 100 }], { extras: [900] });
  assert.ok(withExtra.maxB >= 900, 'une ligne de référence (peak moyen) reste visible');

  const empty = bacChartRange([]);
  assert.ok(empty.maxB >= 80 && empty.maxT > empty.minT, 'cas vide sain');
});

test('bacChartRange — capRunaway plafonne un pic pathologique sans écraser les extras', () => {
  const runaway = bacChartRange(
    [{ t: 0, bac: 0 }, { t: 2, bac: 9000 }],
    { capRunaway: true, extras: [300] }
  );
  // peak clampé à 1500 → ×1.15 → arrondi « nice » (2000), loin des 9000 bruts.
  assert.ok(runaway.maxB <= 2000, 'pic projeté clampé (~1500 → nice 2000)');
  const keepExtras = bacChartRange(
    [{ t: 0, bac: 9000 }],
    { capRunaway: true, extras: [2000] }
  );
  assert.ok(keepExtras.maxB >= 2000, 'le cap ne descend jamais sous un extra');
});

// keepRiseFocus reste supporté (utilisé ailleurs), mais SvgBACForecast ne le
// passe PLUS : la fenêtre X doit aller jusqu'à la FIN de la courbe (dernier
// point) pour que toute la projection rentre dans le graphe.
test('bacChartRange — sans keepRiseFocus : maxT = dernier point (courbe entière)', () => {
  const pts = [{ t: 0, bac: 100 }, { t: 1, bac: 600 }, { t: 6, bac: 0 }];
  const full = bacChartRange(pts);                       // défaut : pas de focus
  assert.equal(full.maxT, 6, 'fenêtre jusqu’au retour à 0');
  const focused = bacChartRange(pts, { keepRiseFocus: true });
  assert.ok(focused.maxT < 6, 'keepRiseFocus tronque encore (option conservée)');
});

// ── heatmapBand (intensité de cellule du calendrier) ────────────────

test('heatmapBand — 0 vide, bandes 1..4 par quartile du ratio', () => {
  const { heatmapBand } = global;
  assert.equal(heatmapBand(0, 100), 0, 'aucun gramme → bande 0 (vide)');
  assert.equal(heatmapBand(10, 100), 1, '10 % → bande 1');
  assert.equal(heatmapBand(40, 100), 2, '40 % → bande 2');
  assert.equal(heatmapBand(70, 100), 3, '70 % → bande 3');
  assert.equal(heatmapBand(100, 100), 4, '100 % → bande 4');
  assert.equal(heatmapBand(500, 100), 4, 'au-delà de l’échelle → bande max');
});

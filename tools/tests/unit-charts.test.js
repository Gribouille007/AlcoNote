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

// ── Système CHART + anti-collision (refonte des figures) ─────────────
const {
  CHART, BAC_CHART_CAP, BAC_ZONE_LIGHT, BAC_ZONE_LEGAL,
  thinnedAxisLabels, resolveLaneLabels, radarLabelLayout, fitLabel,
  donutSegments,
} = global;

test('CHART — spec gelée, valeurs numériques saines', () => {
  assert.ok(Object.isFrozen(CHART), 'CHART est frozen');
  assert.ok(Object.isFrozen(CHART.font) && Object.isFrozen(CHART.bar), 'sous-objets frozen');
  assert.ok(CHART.font.tick > 0 && CHART.font.charW > 0);
  assert.ok(CHART.label.minGapX > 0 && CHART.label.minGapY > 0);
  assert.equal(CHART.heatmap.bandAlpha.length, 5);
  // Seuils d'affichage BAC alignés sur les constantes du moteur (gel croisé
  // avec unit-formulas : BAC_LEGAL_LIMIT = 500, BAC_RECORD_MIN = 200).
  assert.equal(BAC_ZONE_LEGAL, 500);
  assert.equal(BAC_ZONE_LIGHT, 200);
  assert.equal(BAC_CHART_CAP, 1500);
});

// Extents réels d'un label rendu selon son ancre — l'invariant se vérifie
// sur les extents, pas sur les centres.
function labelExtent(item, labels, charW) {
  const w = String(labels[item.i]).length * charW;
  if (item.anchor === 'start') return [item.x, item.x + w];
  if (item.anchor === 'end') return [item.x - w, item.x];
  return [item.x - w / 2, item.x + w / 2];
}

test('thinnedAxisLabels — property : jamais deux labels qui se chevauchent, jamais de débord', () => {
  const charW = CHART.font.charW, minGap = CHART.label.minGapX;
  let rngState = 42;
  const rng = () => (rngState = (rngState * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let trial = 0; trial < 200; trial++) {
    const n = 2 + Math.floor(rng() * 58);            // 2..60 labels
    const plotW = 240 + rng() * 180;                  // 240..420 px
    const lo = 28, hi = lo + plotW;
    const labels = Array.from({ length: n }, (_, i) =>
      rng() < 0.15 ? '' : `${i}${rng() < 0.5 ? 'h' : '/12'}`);
    const xs = labels.map((_, i) => lo + (i / Math.max(1, n - 1)) * plotW);
    const out = thinnedAxisLabels(labels, xs, { lo, hi });
    // 1. Tous les labels rendus étaient candidats (non vides).
    for (const it of out) assert.ok(labels[it.i] !== '', 'jamais un label vide');
    // 2. Aucun débord des bornes.
    for (const it of out) {
      const [a, b] = labelExtent(it, labels, charW);
      assert.ok(a >= lo - 1e-9 && b <= hi + 1e-9,
        `débord [${a},${b}] hors [${lo},${hi}] (essai ${trial})`);
    }
    // 3. Invariant central : extents consécutifs espacés ≥ minGap.
    for (let k = 1; k < out.length; k++) {
      const [, prevEnd] = labelExtent(out[k - 1], labels, charW);
      const [curStart] = labelExtent(out[k], labels, charW);
      assert.ok(curStart >= prevEnd + minGap - 1e-9,
        `chevauchement au trial ${trial} : ${prevEnd} → ${curStart}`);
    }
    // 4. Le dernier candidat non vide est toujours rendu (ancre de lecture).
    const lastCand = labels.map((l, i) => l ? i : -1).filter(i => i >= 0).pop();
    if (lastCand != null && out.length) {
      assert.equal(out[out.length - 1].i, lastCand, 'dernier label rendu');
    }
  }
});

test('thinnedAxisLabels — cas limites', () => {
  assert.deepEqual(thinnedAxisLabels([], [], {}), []);
  assert.deepEqual(thinnedAxisLabels(['', '', ''], [0, 10, 20], {}), []);
  const one = thinnedAxisLabels(['9h'], [50], { lo: 0, hi: 100 });
  assert.equal(one.length, 1);
  assert.equal(one[0].anchor, 'middle');
});

test('resolveLaneLabels — priorité, décalage minimal, rejet, invariant de gap', () => {
  const minGap = 4;
  // Deux items en collision : le prioritaire garde sa place, l'autre se décale.
  const out = resolveLaneLabels([
    { id: 'a', pos: 50, size: 8, priority: 1 },
    { id: 'b', pos: 52, size: 8, priority: 3 },
  ], { minGap, lo: 0, hi: 100 });
  assert.equal(out.length, 2);
  const b = out.find(o => o.id === 'b'), a = out.find(o => o.id === 'a');
  assert.equal(b.pos, 52, 'le prioritaire ne bouge pas');
  assert.ok(Math.abs(a.pos - b.pos) >= 8 + minGap - 1e-9, 'gap respecté');
  // Espace trop étroit : l'item le moins prioritaire est ABANDONNÉ.
  const tight = resolveLaneLabels([
    { id: 'a', pos: 5, size: 8, priority: 1 },
    { id: 'b', pos: 5, size: 8, priority: 3 },
  ], { minGap, lo: 0, hi: 12 });
  assert.equal(tight.length, 1);
  assert.equal(tight[0].id, 'b');
  // Invariant pairwise sur un lot serré.
  const many = resolveLaneLabels(
    [0, 1, 2, 3, 4].map(i => ({ pos: 40 + i, size: 9, priority: 5 - i })),
    { minGap, lo: 0, hi: 200 });
  for (let i = 0; i < many.length; i++) {
    for (let j = i + 1; j < many.length; j++) {
      assert.ok(Math.abs(many[i].pos - many[j].pos) >= (many[i].size + many[j].size) / 2 + minGap - 1e-9);
    }
  }
});

test('radarLabelLayout — ancre selon le quadrant', () => {
  assert.equal(radarLabelLayout(0).anchor, 'start');            // droite
  assert.equal(radarLabelLayout(Math.PI).anchor, 'end');        // gauche
  assert.equal(radarLabelLayout(-Math.PI / 2).anchor, 'middle'); // haut
  assert.ok(radarLabelLayout(-Math.PI / 2).dy < 0, 'haut → texte au-dessus');
  assert.equal(radarLabelLayout(Math.PI / 2).anchor, 'middle');  // bas
  assert.ok(radarLabelLayout(Math.PI / 2).dy > 0, 'bas → texte en dessous');
});

test('fitLabel — troncature ellipsis dans un espace borné', () => {
  assert.equal(fitLabel('Bière', 1000), 'Bière');
  const cut = fitLabel('Une catégorie interminable', 60);
  assert.ok(cut.endsWith('…'), 'ellipsis');
  assert.ok(cut.length * CHART.font.charW <= 60 + CHART.font.charW, 'tient dans la borne');
  assert.equal(fitLabel('abc', 2), '…');
  assert.equal(fitLabel(null, 50), '');
});

test('donutSegments — vide → total 0 (plus de faux « 1 »), plein → angles cohérents', () => {
  const empty = donutSegments([], 50, 50, 40);
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.segments, []);
  const zero = donutSegments([{ name: 'Bière', v: 0 }], 50, 50, 40);
  assert.equal(zero.total, 0, 'tout-zéro = vide');
  const two = donutSegments([{ name: 'A', v: 3 }, { name: 'B', v: 1 }], 50, 50, 40);
  assert.equal(two.total, 4);
  assert.equal(two.segments.length, 2);
  // Les angles se suivent sans trou : fin du 1er = début du 2e.
  assert.ok(Math.abs(two.segments[0].a1 - two.segments[1].a0) < 1e-9);
});

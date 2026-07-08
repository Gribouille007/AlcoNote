// Checks statiques sur les SOURCES : lint de direction artistique (couleurs
// en dur, <input type="number">, <svg> inline, window.confirm) et cohérence
// du service worker (triple version, STATIC_FILES ⊇ scripts d'index.html).
// Opérationnalise les règles du CLAUDE.md — un nouvel écart casse le build.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./helpers/stub-globals');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const jsxFiles = fs.readdirSync(path.join(ROOT, 'proto'))
  .filter((f) => f.endsWith('.jsx'))
  .sort();

// Plages de lignes appartenant à un bloc système nommé (THEMES, BAC_LEVELS,
// CSS Leaflet…) où les littéraux de couleur sont la SOURCE des tokens.
function blockRanges(lines, startRe, endRe) {
  const ranges = [];
  let open = null;
  lines.forEach((l, i) => {
    if (open == null && startRe.test(l)) open = i;
    else if (open != null && endRe.test(l)) { ranges.push([open, i]); open = null; }
  });
  if (open != null) ranges.push([open, lines.length - 1]);
  return ranges;
}
const inRanges = (ranges, i) => ranges.some(([a, b]) => i >= a && i <= b);

test('DA : aucune couleur en dur hors tokens/constantes nommées', () => {
  // Littéraux uniquement : #hex, rgb(a)( ou oklch( suivi d'un chiffre —
  // les templates `oklch(${…}` construits depuis les tokens ne matchent pas.
  const colorRe = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[\d.]|oklch\(\s*[\d.]/;
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    const lines = src.split('\n');
    // Blocs système où les littéraux sont légitimes (définition des tokens).
    const allowed = [];
    if (f === 'shared.jsx') {
      allowed.push(...blockRanges(lines, /^const THEMES = \{/, /^\};/));
      // CSS Leaflet injecté : fallbacks var(--alco-…, #hex).
      allowed.push(...blockRanges(lines, /MAP_CSS|leaflet|\.alco-map/i, /^\s*`;\s*$/));
    }
    if (f === 'stats.jsx') {
      allowed.push(...blockRanges(lines, /^const BAC_LEVELS = \[/, /^\];/));
    }
    lines.forEach((line, i) => {
      if (!colorRe.test(line)) return;
      if (inRanges(allowed, i)) return;
      // Commentaires (ex. « React error #310 » matcherait le motif #hex).
      if (/^\s*(\/\/|\*)/.test(line)) return;
      // oklch dynamique construit depuis les tokens (catColor/catBg : `${…}`).
      if (/oklch\([^)]*\$\{/.test(line)) return;
      // Constante système nommée top-level (TOAST_SHADOW, VIEWFINDER_*, …).
      if (/^\s*const [A-Z][A-Z0-9_]* = /.test(line)) return;
      // CSS Leaflet ligne à ligne (var(--alco-…)) si hors bloc détecté.
      if (f === 'shared.jsx' && line.includes('var(--alco-')) return;
      offenders.push(`proto/${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(offenders, [], `Couleurs en dur hors système :\n${offenders.join('\n')}`);
});

test('DA : aucun <input type="number"> (rejette la virgule) — NumberField partout', () => {
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    src.split('\n').forEach((line, i) => {
      if (/<input[^>]*type="number"/.test(line)) offenders.push(`proto/${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('DA : window.confirm/alert interdits (Confirm.ask / Toast.show)', () => {
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    src.split('\n').forEach((line, i) => {
      if (!/window\.(confirm|alert)\(/.test(line)) return;
      // Unique exception : le fallback de Confirm quand aucun host n'est monté.
      if (f === 'shared.jsx' && line.includes('resolve(window.confirm(')) return;
      offenders.push(`proto/${f}:${i + 1}  ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('DA : pas de <svg> inline hors fichiers système (Ic/SvgIcon, charts, map)', () => {
  // shared.jsx (banque d'icônes Ic), stats-charts.jsx (primitives SVG) et
  // stats.jsx (jauge BAC, carte) SONT le système — les autres consomment.
  const consumers = jsxFiles.filter((f) => !['shared.jsx', 'stats-charts.jsx', 'stats.jsx'].includes(f));
  const offenders = [];
  for (const f of consumers) {
    const src = read(path.join('proto', f));
    src.split('\n').forEach((line, i) => {
      if (/<svg[\s>]/.test(line)) offenders.push(`proto/${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});

test('DA : composant React.memo qui peint catColor/catBg → useCatPalette() obligatoire', () => {
  // La palette de catégories vit dans le registre module `CAT`, muté par
  // applyCatHueOverrides — une mutation y est INVISIBLE pour React. Un
  // composant React.memo dont les props n'ont pas bougé ne se re-rend pas et
  // garde l'ancienne couleur (bug historique « je change la couleur, rien ne
  // se passe »). Le hook useCatPalette() (contexte → traverse React.memo)
  // garantit le repaint : tout composant memoïsé qui appelle catColor()/
  // catBg() doit l'appeler aussi.
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    const re = /React\.memo\(function\s+(\w+)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      // Corps de la fonction par équilibrage d'accolades depuis la première
      // `{` qui suit la liste de paramètres.
      const open = src.indexOf('{', src.indexOf(')', m.index));
      if (open === -1) continue;
      let depth = 0, end = open;
      for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      const body = src.slice(open, end + 1);
      if (/\bcatColor\(|\bcatBg\(/.test(body) && !body.includes('useCatPalette()')) {
        offenders.push(`proto/${f} › ${m[1]}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'composants memoïsés peignant une couleur de catégorie sans abonnement palette');
});

test('conventions : chaque proto/*.jsx expose ses symboles via Object.assign(window', () => {
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    assert.ok(src.includes('Object.assign(window'), `proto/${f} n'expose rien sur window`);
  }
});

test('build : chaque proto/X.jsx a son proto/dist/X.js', () => {
  for (const f of jsxFiles) {
    const dist = path.join(ROOT, 'proto', 'dist', f.replace(/\.jsx$/, '.js'));
    assert.ok(fs.existsSync(dist), `dist manquant pour proto/${f} — lancer npm run build`);
  }
});

// ── Service worker ─────────────────────────────────────────────────

const sw = read('sw.js');

test('sw.js : CACHE_NAME / STATIC_CACHE / DYNAMIC_CACHE sur la MÊME version', () => {
  const v = (name) => {
    const m = sw.match(new RegExp(`const ${name} = '[a-z-]+-(v[\\d.]+)'`));
    assert.ok(m, `${name} introuvable dans sw.js`);
    return m[1];
  };
  const cache = v('CACHE_NAME');
  assert.equal(v('STATIC_CACHE'), cache, 'STATIC_CACHE désynchronisé');
  assert.equal(v('DYNAMIC_CACHE'), cache, 'DYNAMIC_CACHE désynchronisé');
});

function staticFiles() {
  const m = sw.match(/const STATIC_FILES = \[([\s\S]*?)\];/);
  assert.ok(m, 'STATIC_FILES introuvable');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

test('sw.js : STATIC_FILES couvre tous les <script src> locaux d’index.html', () => {
  const html = read('index.html');
  const files = staticFiles();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => !/^https?:/.test(s));
  for (const s of scripts) {
    const norm = '/' + s.replace(/^\.?\//, '');
    assert.ok(files.includes(norm), `script ${s} absent de STATIC_FILES (cache SW cassé)`);
  }
});

test('sw.js : toutes les entrées locales de STATIC_FILES existent sur disque', () => {
  for (const f of staticFiles()) {
    if (/^https?:/.test(f)) continue;
    const p = path.join(ROOT, f.replace(/^\//, ''));
    assert.ok(fs.existsSync(p), `${f} listé dans STATIC_FILES mais absent du disque`);
  }
});

test('sw.js : tous les bundles proto/dist/*.js sont précachés', () => {
  const files = staticFiles();
  const dist = fs.readdirSync(path.join(ROOT, 'proto', 'dist')).filter((f) => f.endsWith('.js'));
  for (const d of dist) {
    assert.ok(files.includes(`/proto/dist/${d}`), `/proto/dist/${d} manque dans STATIC_FILES`);
  }
});

test('zoom verrouillé : meta viewport + touch-action + guards gesture*', () => {
  const html = read('index.html');
  const viewport = (html.match(/<meta name="viewport" content="([^"]+)"/) || [])[1] || '';
  assert.ok(viewport.includes('maximum-scale=1.0'), 'meta viewport : maximum-scale=1.0');
  assert.ok(viewport.includes('user-scalable=no'), 'meta viewport : user-scalable=no');
  assert.match(html, /touch-action:\s*pan-x pan-y/, 'CSS html/body : touch-action pan-x pan-y');
  const shared = read('proto/shared.jsx');
  assert.ok(shared.includes("'gesturestart'"), 'guard gesturestart (pinch Safari iOS)');
  assert.ok(shared.includes('installZoomGuards'), 'installZoomGuards présent dans shared.jsx');
});

// ── Gel textuel des formules (cf. CLAUDE.md § « Formules gelées ») ──
// Deuxième verrou (avec unit-formulas.test.js) : les déclarations littérales
// des constantes du modèle doivent exister VERBATIM dans les sources. Toute
// modification échoue ici — si le changement est voulu, mettre à jour les
// deux verrous dans le même commit.
test('gel — déclarations littérales des constantes de formules', () => {
  const statsSrc = read('proto/stats.jsx');
  const sharedSrc = read('proto/shared.jsx');
  const frozen = [
    [statsSrc, 'proto/stats.jsx', /const BAC_ELIM_RATE = 150;/],
    [statsSrc, 'proto/stats.jsx', /const BAC_ABSORPTION_H = 0\.5;/],
    [statsSrc, 'proto/stats.jsx', /const DEFAULT_WEIGHT_KG = 70;/],
    [statsSrc, 'proto/stats.jsx', /const WIDMARK_R_MALE = 0\.68;/],
    [statsSrc, 'proto/stats.jsx', /const WIDMARK_R_FEMALE = 0\.55;/],
    [statsSrc, 'proto/stats.jsx', /const BAC_LEGAL_LIMIT = 500;/],
    [statsSrc, 'proto/stats.jsx', /const BAC_RECORD_MIN = 200;/],
    [statsSrc, 'proto/stats.jsx', /const FORECAST_MAX_RATE_GPH = 60;/],
    [statsSrc, 'proto/stats.jsx', /const FORECAST_HORIZON_H = 12;/],
    [sharedSrc, 'proto/shared.jsx', /const ETHANOL_DENSITY_G_PER_ML = 0\.789;/],
  ];
  for (const [src, file, re] of frozen) {
    assert.match(src, re,
      `${file} : ${re} introuvable — FORMULE GELÉE (CLAUDE.md § Formules gelées). ` +
      'Changement voulu ? Mettre à jour CE test ET unit-formulas.test.js dans le même commit.');
  }
});

// ── Tokens de figures : géométrie/typo des charts via CHART uniquement ──
// (cf. CLAUDE.md § « Construire une figure ») : dans stats-charts.jsx, les
// tailles de police et les pointillés sont des tokens `CHART.*` — un
// littéral `fontSize={9}` ou `strokeDasharray="2 3"` hors du bloc CHART est
// une régression du système de figures.
test('figures : aucune taille/dash en dur dans stats-charts.jsx (tokens CHART)', () => {
  const src = read('proto/stats-charts.jsx');
  const lines = src.split('\n');
  const chartBlock = blockRanges(lines, /^const CHART = Object\.freeze\(\{/, /^\}\);/);
  const offenders = [];
  lines.forEach((line, i) => {
    if (inRanges(chartBlock, i)) return;
    if (/^\s*(\/\/|\*)/.test(line)) return;
    if (/fontSize=\{[0-9]/.test(line)) offenders.push(`fontSize littéral — proto/stats-charts.jsx:${i + 1}`);
    if (/strokeDasharray="[0-9]/.test(line)) offenders.push(`dash littéral — proto/stats-charts.jsx:${i + 1}`);
  });
  assert.deepEqual(offenders, [], `Littéraux hors CHART :\n${offenders.join('\n')}`);
});

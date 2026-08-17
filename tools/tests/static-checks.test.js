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

// ── Typographie : l'approche suit la TAILLE, jamais une valeur en dur ──
test('DA : aucune taille/approche en dur — remSize()/tracking()/type() partout', () => {
  // Une seule valeur d'approche pour toutes les tailles est forcément fausse
  // quelque part (cf. CLAUDE.md › DA § Typographie). Et une taille en px
  // ignore le réglage « taille du texte » du système : tout passe par la
  // grille (remSize/tracking/type/TYPE).
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    const lines = src.split('\n');
    // Le bloc TYPE de shared.jsx EST le système : c'est là que vivent les
    // constantes de la courbe et la définition des rôles.
    const allowed = f === 'shared.jsx'
      ? blockRanges(lines, /^const TRACKING_A = /, /^const TYPE = Object\.freeze\(\{[\s\S]*/)
        .concat(blockRanges(lines, /^const TYPE = Object\.freeze\(\{/, /^\}\);/))
      : [];
    lines.forEach((line, i) => {
      if (inRanges(allowed, i)) return;
      if (/^\s*(\/\/|\*)/.test(line)) return;
      if (/\bfontSize:\s*-?\d/.test(line)) offenders.push(`fontSize en dur — proto/${f}:${i + 1}`);
      if (/\bletterSpacing:\s*-?\d/.test(line)) offenders.push(`letterSpacing en dur — proto/${f}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [],
    `Taille/approche hors grille typographique :\n${offenders.join('\n')}`);
});

// ── Mouvement : le moteur est bien celui qui pilote les gestes ─────
test('gel — constantes de mouvement (ressorts, décélération, élastique)', () => {
  // Même logique que le gel des formules : le « toucher » de l'app ne doit
  // pas dériver en silence. Changement voulu ? Mettre à jour CE test ET
  // unit-motion.test.js dans le même commit.
  const src = read('proto/shared.jsx');
  const frozen = [
    /ui:\s+Object\.freeze\(\{ damping: 1,\s+response: 0\.35 \}\)/,
    /move:\s+Object\.freeze\(\{ damping: 1,\s+response: 0\.4 \}\)/,
    /sheet:\s+Object\.freeze\(\{ damping: 0\.8, response: 0\.3 \}\)/,
    /flick:\s+Object\.freeze\(\{ damping: 0\.8, response: 0\.4 \}\)/,
    /decel: 0\.998,/,
    /rubber: 0\.55,/,
    /const TRACKING_A = 0\.49;/,
    /const TRACKING_B = -0\.035;/,
    /lockPx: 6,/,
    /axisBias: 1\.4,/,
  ];
  for (const re of frozen) {
    assert.match(src, re,
      `${re} introuvable — CONSTANTE DE MOUVEMENT GELÉE (CLAUDE.md § Mouvement). ` +
      'Changement voulu ? Mettre à jour CE test ET unit-motion.test.js dans le même commit.');
  }
});

test('gestes : feuilles, balayage et retour de page passent par useAxisDrag', () => {
  // Le suivi 1:1, la capture du pointeur, l'élastique, la projection d'élan
  // et la reprise en vol vivent DANS useAxisDrag. Réécrire un geste à la main
  // à côté, c'est réintroduire les bugs qu'il corrige.
  const wired = [
    ['proto/shared.jsx', 'SheetOverlay (feuilles / tiroirs)'],
    ['proto/history.jsx', 'balayage pour supprimer'],
    ['proto/friends.jsx', 'retour de page au doigt'],
  ];
  for (const [file, what] of wired) {
    assert.ok(read(file).includes('useAxisDrag({'), `${what} : useAxisDrag attendu dans ${file}`);
  }
});

test('perf : `will-change` n’est jamais posé en style PERMANENT', () => {
  // `will-change: transform` ne rend rien plus fluide : il demande la
  // PROMOTION de l'élément en couche composée, avec son backing store en
  // mémoire graphique. Sur un item de liste, c'est une couche PAR LIGNE —
  // quelques centaines d'entrées suffisent à faire tuer le process web par
  // iOS (« l'app redémarre toute seule »). Et un ancêtre ainsi promu coupe le
  // backdrop d'une matière descendante, qui s'éteint.
  // La seule écriture autorisée passe par setLayerHint/useLayerHint, qui
  // arment au geste et RENDENT la couche au repos.
  const allowed = new Set([
    // Indicateur d'onglet : UN élément de 3px qui bouge à chaque bascule.
    'proto/app.jsx',
    // Définition du helper lui-même.
    'proto/shared.jsx',
  ]);
  const offenders = [];
  for (const f of jsxFiles) {
    const file = path.join('proto', f);
    if (allowed.has(file)) continue;
    read(file).split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\{?\/\*)/.test(line)) return;   // commentaires
      if (/\bwillChange\s*:/.test(line)) offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [],
    `will-change permanent (utiliser useLayerHint) :\n${offenders.join('\n')}`);
  // Et le helper existe bien, avec sa remise à zéro.
  const shared = read('proto/shared.jsx');
  assert.match(shared, /function setLayerHint\(/, 'setLayerHint absent');
  assert.match(shared, /function useLayerHint\(/, 'useLayerHint absent');
});

test('perf : pas de `text-rendering: optimizeLegibility` global', () => {
  // Il force le crénage et les ligatures sur TOUT le texte de l'app : un coût
  // de mise en page sur chaque ligne de chaque liste, pour un gain nul avec
  // les fontes du projet.
  // Commentaires retirés : la règle est justifiée EN COMMENTAIRE sur place,
  // et cette explication cite forcément le nom de la propriété bannie.
  const html = read('index.html').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/text-rendering:\s*optimizeLegibility/.test(html),
    'optimizeLegibility ralentit toute la mise en page du texte');
});

test('matières : une matière TRANSLUCIDE vit sur l’élément qui bouge', () => {
  // Sous un ancêtre transformé/promu, WebKit n'a plus de fond à échantillonner
  // et le flou s'éteint — sur iOS, pile à la fin de l'animation d'entrée
  // (« le translucide se retire après une seconde »). SheetOverlay expose donc
  // `sheetClassName`, posé sur l'élément qu'il transforme lui-même.
  const shared = read('proto/shared.jsx');
  assert.match(shared, /sheetClassName/, 'SheetOverlay doit exposer sheetClassName');
  assert.match(shared, /className=\{sheetClassName\}/,
    'sheetClassName doit être posé sur l’élément transformé (ref={sheetRef})');
  const offenders = [];
  for (const f of jsxFiles) {
    read(path.join('proto', f)).split('\n').forEach((line, i) => {
      // Les matières OPAQUES (alco-material-sheet) ne sont pas concernées :
      // sans backdrop-filter, aucun backdrop à perdre.
      if (/className="[^"]*alco-material-panel/.test(line) &&
          !/sheetClassName=/.test(line)) {
        offenders.push(`proto/${f}:${i + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [],
    `matière translucide posée sur un enfant (passer par sheetClassName) :\n${offenders.join('\n')}`);
});

test('gestes : le geste ne dispute jamais sa zone au défilement', () => {
  // Un `touch-action` posé sur une racine s'intersecte avec celui de TOUS ses
  // descendants : la fiche ami perdait le défilement horizontal de son
  // sélecteur de période. Le geste vit donc dans une bande à lui.
  const friends = read('proto/friends.jsx');
  assert.match(friends, /width: PAGE_EDGE_PX/,
    'le retour de page doit avoir sa bande de saisie dédiée');
  assert.ok(!/pointerEvents: closing \? 'none' : undefined,\n\s+touchAction: 'pan-y' \}\}>/.test(friends),
    'plus de touch-action sur la racine de la fiche ami');
  // Un tiroir latéral, lui, se traîne partout : le vertical doit alors rester
  // au navigateur, sinon le doigt bouge le tiroir ET défile la liste.
  assert.match(read('proto/shared.jsx'), /touchAction: isSide && dismissible && !reduced \? 'pan-y'/,
    'les tiroirs latéraux doivent laisser le pan vertical au navigateur');
});

test('CSS injecté : aucun backtick non échappé (casserait tout le module)', () => {
  // Le CSS de base vit dans un template literal. Un backtick oublié dans un
  // commentaire le FERME : l'IIFE jette, l'évaluation de shared.js s'arrête
  // net et l'app entière ne démarre plus (aucun token, aucun composant).
  const src = read('proto/shared.jsx');
  const start = src.indexOf('s.textContent = `');
  assert.ok(start > 0, 'bloc CSS injecté introuvable');
  const body = src.slice(start + 's.textContent = `'.length);
  const end = body.indexOf('\n  `;');
  assert.ok(end > 0, 'fin du bloc CSS introuvable');
  const inner = body.slice(0, end);
  const bad = [];
  inner.split('\n').forEach((line, i) => {
    for (let c = 0; c < line.length; c++) {
      if (line[c] === '`' && line[c - 1] !== '\\') bad.push(`ligne ${i + 1} : ${line.trim().slice(0, 70)}`);
    }
  });
  assert.deepEqual(bad, [], `Backtick non échappé dans le CSS injecté :\n${bad.join('\n')}`);
});

test('accessibilité : les trois préférences système sont honorées', () => {
  // « Moins d'animation » ≠ « moins de transparence » ≠ « plus de contraste » :
  // trois réglages indépendants, trois réponses distinctes.
  const shared = read('proto/shared.jsx');
  for (const q of ['prefers-reduced-motion: reduce',
                   'prefers-reduced-transparency: reduce',
                   'prefers-contrast: more']) {
    assert.ok(shared.includes(q), `média-requête ${q} absente de shared.jsx`);
  }
  for (const hook of ['useReducedMotion', 'useReducedTransparency', 'useHighContrast']) {
    assert.ok(shared.includes(`function ${hook}(`), `hook ${hook} absent`);
  }
  // Sans backdrop-filter (Firefox par défaut), une matière « translucide »
  // deviendrait une vitre sale : il FAUT un repli opaque.
  assert.match(shared, /@supports not \(\(backdrop-filter/,
    'repli @supports pour les navigateurs sans backdrop-filter');
});

test('matières : la barre d’onglets flotte (pas de filet 1px de séparation)', () => {
  const app = read('proto/app.jsx');
  assert.match(app, /className="alco-material alco-material-edge"/,
    'la barre d’onglets doit porter la matière + son arête');
  assert.match(app, /position: 'absolute', left: 0, right: 0, bottom: 0/,
    'la barre d’onglets doit être une couche flottante (contenu défilant dessous)');
  assert.ok(!/borderTop: `1px solid \$\{T\.rule\}`,\n\s+flexShrink/.test(app),
    'plus de filet 1px sous le chrome : la séparation vient de la matière');
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

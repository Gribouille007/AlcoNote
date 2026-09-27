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
  // Les DEUX formes de memo (inline et `X = React.memo(X);` en fin de
  // fichier) : le donut, memoïsé à l'export, gardait l'ancienne teinte.
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    for (const name of memoComponentNames(src)) {
      const body = functionBody(src, name);
      if (/\bcatColor\(|\bcatBg\(/.test(body) && !body.includes('useCatPalette()')) {
        offenders.push(`proto/${f} › ${name}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'composants memoïsés peignant une couleur de catégorie sans abonnement palette');
});

// Corps d'une fonction nommée (équilibrage d'accolades depuis la `{` qui
// suit la liste de paramètres). Retourne '' si la fonction est absente.
function functionBody(src, name) {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
  if (!m) return '';
  const open = src.indexOf('{', src.indexOf(')', m.index));
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return src.slice(open);
}

// Noms des composants memoïsés, DEUX formes : `React.memo(function X` (inline)
// et `X = React.memo(X);` (memoïsation en fin de fichier, cf. stats-charts).
function memoComponentNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/React\.memo\(function\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*(\w+)\s*=\s*React\.memo\(\1\)\s*;/gm)) names.add(m[1]);
  return [...names];
}

test('DA : composant React.memo qui lit un token T → useTheme() obligatoire', () => {
  // Même piège que la palette de catégories : `T` est un objet MUTÉ en place
  // par setTheme() — une bascule de thème est invisible pour React. Un
  // composant React.memo dont les props n'ont pas bougé ne se re-rend pas et
  // garde les couleurs de l'ANCIEN thème (bug historique « le mode sombre
  // laisse des éléments clairs »). useTheme() abonne le composant au bus de
  // thème, ce qui force son repaint quoi qu'en dise le memo.
  const offenders = [];
  for (const f of jsxFiles) {
    const src = read(path.join('proto', f));
    for (const name of memoComponentNames(src)) {
      const body = functionBody(src, name);
      if (/\bT\.\w+/.test(body) && !body.includes('useTheme()')) {
        offenders.push(`proto/${f} › ${name}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'composants memoïsés peignant des tokens de thème sans abonnement useTheme()');
});

test('portrait verrouillé : manifest + verrou écran + repli CSS paysage', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.match(String(manifest.orientation || ''), /^portrait/,
    'manifest.json : orientation portrait (PWA installée)');
  const shared = read('proto/shared.jsx');
  assert.ok(shared.includes('installOrientationLock'), 'installOrientationLock présent dans shared.jsx');
  assert.match(shared, /orientation\.lock\('portrait'\)|so\.lock\('portrait'\)/,
    "verrou screen.orientation.lock('portrait')");
  const html = read('index.html');
  assert.match(html, /id="alco-rotate"/, 'voile de repli #alco-rotate dans index.html');
  assert.match(html, /@media \(orientation: landscape\)[^{]*\{/,
    'media query paysage qui active le voile');
});

test('thème : color-scheme posé sur les DEUX thèmes (widgets natifs)', () => {
  // Sans `color-scheme`, les contrôles natifs (input date/heure, scrollbars,
  // autofill) restent peints par le thème du SYSTÈME : autant d'« éléments
  // clairs » qui survivent au passage en mode sombre, et inversement.
  const html = read('index.html');
  assert.match(html, /html\[data-theme="dark"\][^{]*\{[^}]*color-scheme:\s*dark/,
    'color-scheme: dark sur le thème sombre');
  assert.match(html, /html\[data-theme="light"\][^{]*\{[^}]*color-scheme:\s*light/,
    'color-scheme: light sur le thème clair');
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

// ── Partage : invariants du backend (supabase/schema.sql) ──────────
// Le schéma SQL est appliqué à la main dans le SQL Editor : rien ne le
// compile ni ne l'exécute en CI. Ces checks gèlent les invariants dont
// dépend « rejoindre un groupe », pour qu'une régression se voie ici.

const schemaSql = read('supabase/schema.sql');

test('partage : une invitation ne périme JAMAIS et ne s’épuise pas', () => {
  // Régression majeure : les invitations expiraient à 30 jours et l'app
  // n'offrait aucun moyen d'en régénérer une — passé ce délai, le groupe
  // devenait DÉFINITIVEMENT impossible à rejoindre.
  assert.doesNotMatch(schemaSql, /expires_at\s*\)?\s*\n?\s*values[^;]*interval/i,
    'create_group ne doit plus poser d’expiration');
  assert.doesNotMatch(schemaSql, /now\(\)\s*\+\s*interval\s+'30 days'/,
    "plus d'invitation à 30 jours");
  assert.match(schemaSql, /update public\.invites\s*\n\s*set expires_at = null/,
    'migration : les invitations existantes sont dépérimées');
  assert.match(schemaSql, /max_uses\s*=\s*greatest\(max_uses, 1000000000\)/,
    'migration : le compteur d’usages ne peut plus être épuisé');
});

test('partage : join_group compare des codes NORMALISÉS', () => {
  // Un code se transmet à l'oral / par SMS : tiret, espaces et casse ne
  // doivent jamais valoir « code invalide ». La normalisation existe des DEUX
  // côtés (client : normalizeInviteCode).
  assert.match(schemaSql, /create or replace function public\.normalize_invite_code/,
    'helper de normalisation côté serveur');
  assert.match(schemaSql, /public\.normalize_invite_code\(token\)\s*=\s*v_norm/,
    'join_group matche sur le code normalisé');
  assert.doesNotMatch(schemaSql, /where token = upper\(invite_token\)/,
    'plus de comparaison brute (un tiret oublié suffisait à échouer)');
  const shareSrc = read('proto/share.jsx');
  assert.ok(shareSrc.includes('function normalizeInviteCode('), 'normalizeInviteCode côté client');
  assert.ok(shareSrc.includes('function formatInviteCode('), 'formatInviteCode côté client');
});

test('partage : RPC ensure_invite exposée (un groupe garde toujours un code)', () => {
  assert.match(schemaSql, /create or replace function public\.ensure_invite\(p_group_id uuid\)/,
    'RPC ensure_invite définie');
  assert.match(schemaSql, /grant execute on function public\.ensure_invite\(uuid\)\s+to anon, authenticated;/,
    'ensure_invite exécutable par les clients (sans GRANT : PostgREST 404)');
  assert.ok(read('proto/share.jsx').includes("sb.rpc('ensure_invite'"), 'transport câblé sur ensure_invite');
});

test('partage : toute RPC appelée par le client est définie ET grantée', () => {
  const shareSrc = read('proto/share.jsx');
  const called = [...shareSrc.matchAll(/sb\.rpc\('(\w+)'/g)].map((m) => m[1]);
  assert.ok(called.length >= 4, 'au moins les RPC de cycle de vie du groupe');
  for (const fn of new Set(called)) {
    assert.match(schemaSql, new RegExp(`create or replace function public\\.${fn}\\(`),
      `RPC ${fn} appelée par le client mais absente de schema.sql`);
    assert.match(schemaSql, new RegExp(`grant execute on function public\\.${fn}\\(`),
      `RPC ${fn} sans GRANT (PostgREST répondrait 404 « function not found »)`);
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

test('DA : DeltaBadge reste dans le flux (jamais en surimpression de la valeur)', () => {
  // Bug historique : le badge Δ% en `position: absolute` (coin haut-droit)
  // recouvrait les valeurs larges des cellules (« 12.4L », « 1j 4h »).
  const src = read('proto/stats.jsx');
  const body = functionBody(src, 'DeltaBadge');
  assert.ok(body, 'DeltaBadge présent');
  assert.ok(!/position:\s*'absolute'/.test(body), 'DeltaBadge sans position absolue');
});

test('perf : onglets mémoïsés dans AppShell (un overlay ne re-rend pas StatsTab)', () => {
  // Latence historique du mode Comparer : chaque ouverture d'overlay (et
  // chaque toast) re-rendait TOUS les onglets montés, StatsTab compris.
  const src = read('proto/app.jsx');
  for (const el of ['categoriesEl', 'historyEl', 'statsEl', 'friendsEl']) {
    assert.ok(new RegExp(`const ${el} = React\\.useMemo\\(`).test(src), `${el} mémoïsé`);
    assert.ok(src.includes(`{${el}}`), `${el} rendu tel quel`);
  }
  assert.ok(!/<StatsTab reorderRef=\{statsReorderRef\} focusRequest=\{statsFocus\} \/>\s*\n\s*<\/div>/.test(src),
    'StatsTab jamais instancié directement dans le JSX du shell');
});

test('iOS : barre d’état non translucide (pas de flou Liquid Glass sur l’en-tête)', () => {
  const html = read('index.html');
  assert.ok(/name="apple-mobile-web-app-status-bar-style" content="default"/.test(html),
    'status-bar-style = default');
  assert.ok(!/content="black-translucent"/.test(html), 'jamais black-translucent');
});

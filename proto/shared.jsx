// shared.jsx — tokens, icons, shared primitives
// Two themes: warm dark (espresso/ivory) and warm light (cream/ink).
// T is a mutable global; call setTheme(name) then notify themeListeners to re-render.

const THEMES = {
  dark: {
    bg:       'oklch(16% 0.008 50)',
    surface:  'oklch(20% 0.01 55)',
    surface2: 'oklch(24% 0.012 55)',
    surface3: 'oklch(28% 0.014 55)',
    ink:      'oklch(96% 0.008 85)',
    ink2:     'oklch(78% 0.008 80)',
    muted:    'oklch(55% 0.008 70)',
    rule:     'oklch(30% 0.01 55)',
    accent:   'oklch(72% 0.15 65)',
    accent2:  'oklch(68% 0.14 30)',
    good:     'oklch(72% 0.10 155)',
    shadow:   '0 60px 120px rgba(0,0,0,0.5)',
    accentSoft: 'oklch(30% 0.04 65)',
    accentSoftBorder: 'oklch(38% 0.05 65)',
    // Variante « bonne » (verte, hue 155) du couple accentSoft : mêmes L/C que
    // l'ambre → poids visuel identique. Sert la pastille BAC d'un ami favori.
    goodSoft: 'oklch(30% 0.04 155)',
    goodSoftBorder: 'oklch(38% 0.05 155)',
    accentInk: 'oklch(16% 0.008 50)',
    accentRing: 'oklch(80% 0.12 65)',
    scrim:    'rgba(0,0,0,0.65)',
    dangerBg: 'oklch(45% 0.18 25)',
    dangerBtn: 'oklch(55% 0.20 25)',
    // Encart d'erreur / bouton « soft-danger » (fond + bordure translucides).
    dangerSoftBg:     'oklch(35% 0.10 25 / 0.15)',
    dangerSoftBorder: 'oklch(45% 0.15 25 / 0.4)',
    // Encre blanche fixe sur bouton rouge plein : contraste garanti dans les
    // deux thèmes (accentInk virerait sombre en dark = illisible sur rouge).
    dangerBtnInk:     'oklch(100% 0 0)',
    deltaPos:    'oklch(78% 0.16 155)',
    deltaNeg:    'oklch(74% 0.20 30)',
    deltaPosBg:  'oklch(28% 0.05 155)',
    deltaNegBg:  'oklch(28% 0.06 30)',
    // Zones BAC des charts (léger / au-delà du seuil légal) — consommées via
    // `bacZoneColor` (stats-charts). `T.good` fournit la zone sobre.
    bacWarn:   'oklch(72% 0.16 60)',
    bacDanger: 'oklch(68% 0.20 25)',
    // ── Matières translucides (chrome flottant / feuilles) ──────────
    // Une barre d'onglets n'est pas une bande opaque qui mange l'écran :
    // c'est une couche de matière SOUS laquelle le contenu défile. Les
    // fonds ci-dessous sont volontairement alpha (le flou derrière fait le
    // reste) ; `glassEdge` est l'arête claire du dessus — la lumière
    // accrochée par la matière, qui la détache du contenu sans filet 1px.
    // `glassSolid` est le repli opaque quand l'utilisateur demande moins de
    // transparence ou plus de contraste.
    glassChrome: 'oklch(18% 0.01 55 / 0.72)',
    glassPanel:  'oklch(19% 0.01 55 / 0.86)',
    glassSolid:  'oklch(16% 0.008 50)',
    glassEdge:   'oklch(100% 0 0 / 0.07)',
    shadowChrome: '0 -10px 34px rgba(0,0,0,0.38)',
    shadowSheet:  '0 -24px 70px rgba(0,0,0,0.55)',
    isDark:   true,
  },
  light: {
    bg:       'oklch(98% 0.006 85)',
    surface:  'oklch(100% 0 0)',
    surface2: 'oklch(96% 0.006 85)',
    surface3: 'oklch(93% 0.008 80)',
    ink:      'oklch(22% 0.012 55)',
    ink2:     'oklch(38% 0.01 60)',
    muted:    'oklch(52% 0.008 65)',
    rule:     'oklch(90% 0.008 80)',
    // accent / accent2 / muted assombris (vs leurs équivalents dark) pour
    // garantir un contraste WCAG AA (≥ 4.5:1) sur surfaces claires, qu'ils
    // servent de texte (label d'onglet actif, rouge soft-danger) ou de fond
    // sous l'encre blanche `accentInk`. Valeurs vérifiées sur bg/surface2/accentSoft.
    accent:   'oklch(50% 0.15 50)',
    accent2:  'oklch(48% 0.18 30)',
    good:     'oklch(55% 0.12 155)',
    shadow:   '0 20px 60px rgba(60,40,20,0.12)',
    accentSoft: 'oklch(95% 0.04 65)',
    accentSoftBorder: 'oklch(85% 0.08 65)',
    // Variante « bonne » (verte, hue 155) du couple accentSoft : mêmes L/C que
    // l'ambre → poids visuel identique. Sert la pastille BAC d'un ami favori.
    goodSoft: 'oklch(95% 0.04 155)',
    goodSoftBorder: 'oklch(85% 0.08 155)',
    accentInk: 'oklch(100% 0 0)',
    accentRing: 'oklch(50% 0.15 50)',
    scrim:    'rgba(40,30,20,0.35)',
    dangerBg: 'oklch(45% 0.18 25)',
    dangerBtn: 'oklch(55% 0.20 25)',
    // Encart d'erreur / bouton « soft-danger » (fond + bordure translucides).
    dangerSoftBg:     'oklch(35% 0.10 25 / 0.15)',
    dangerSoftBorder: 'oklch(45% 0.15 25 / 0.4)',
    // Encre blanche fixe sur bouton rouge plein : contraste garanti dans les
    // deux thèmes (accentInk virerait sombre en dark = illisible sur rouge).
    dangerBtnInk:     'oklch(100% 0 0)',
    deltaPos:    'oklch(42% 0.14 155)',
    deltaNeg:    'oklch(48% 0.20 30)',
    deltaPosBg:  'oklch(95% 0.04 155)',
    deltaNegBg:  'oklch(95% 0.04 30)',
    // Zones BAC des charts (léger / au-delà du seuil légal) — consommées via
    // `bacZoneColor` (stats-charts). `T.good` fournit la zone sobre.
    bacWarn:   'oklch(58% 0.16 55)',
    bacDanger: 'oklch(54% 0.20 25)',
    // Matières translucides — cf. le commentaire du thème sombre.
    glassChrome: 'oklch(100% 0 0 / 0.70)',
    glassPanel:  'oklch(100% 0 0 / 0.86)',
    glassSolid:  'oklch(98% 0.006 85)',
    glassEdge:   'oklch(100% 0 0 / 0.75)',
    shadowChrome: '0 -10px 34px rgba(60,40,20,0.10)',
    shadowSheet:  '0 -24px 70px rgba(60,40,20,0.20)',
    isDark:   false,
  },
};

const T = { ...THEMES.dark };
T._name = 'dark';

function setTheme(name) {
  const next = THEMES[name] || THEMES.dark;
  for (const k of Object.keys(T)) delete T[k];
  Object.assign(T, next);
  T._name = name;
}

// ── Pont tokens → variables CSS ───────────────────────────────────
// Les matières translucides et les effets de bord vivent dans une feuille de
// style (seul endroit d'où l'on peut répondre à `prefers-reduced-transparency`
// / `prefers-contrast`, impossible en style inline). Elles lisent donc les
// couleurs via des variables CSS, republiées à chaque changement de thème —
// `T` reste la source unique, le CSS n'en est qu'un miroir.
function applyThemeCssVars() {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const s = document.documentElement.style;
  if (!s || typeof s.setProperty !== 'function') return;
  const vars = {
    '--alco-bg': T.bg, '--alco-surface': T.surface, '--alco-surface2': T.surface2,
    '--alco-ink': T.ink, '--alco-ink2': T.ink2, '--alco-muted': T.muted,
    '--alco-rule': T.rule, '--alco-accent': T.accent, '--alco-accent-ink': T.accentInk,
    '--alco-glass-chrome': T.glassChrome, '--alco-glass-panel': T.glassPanel,
    '--alco-glass-solid': T.glassSolid, '--alco-glass-edge': T.glassEdge,
    '--alco-shadow-chrome': T.shadowChrome, '--alco-shadow-sheet': T.shadowSheet,
  };
  for (const k of Object.keys(vars)) {
    try { s.setProperty(k, vars[k]); } catch {}
  }
}

window.__themeListeners = window.__themeListeners || new Set();

function useTheme() {
  const [, force] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    window.__themeListeners.add(force);
    return () => window.__themeListeners.delete(force);
  }, []);
  return T._name;
}

function applyTheme(name) {
  setTheme(name);
  try { localStorage.setItem('alconote.theme', name); } catch {}
  // Persist to dbManager too so legacy code stays in sync
  try { window.dbManager && window.dbManager.setSetting && window.dbManager.setSetting('theme', name); } catch {}
  document.documentElement.setAttribute('data-theme', name);
  document.body.className = `theme-${name}`;
  applyThemeCssVars();
  window.__themeListeners.forEach(f => f());
}

(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('alconote.theme'); } catch {}
  if (!saved) {
    // auto -> follows system
    saved = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  if (THEMES[saved]) setTheme(saved);
  document.documentElement.setAttribute('data-theme', T._name);
  document.body.className = `theme-${T._name}`;
  applyThemeCssVars();
})();

const fontSans = '"Geist", ui-sans-serif, system-ui, sans-serif';
const fontSerif = '"Instrument Serif", "Times New Roman", serif';
const fontNum = '"Geist Mono", ui-monospace, monospace';

// ── Matières : géométrie des couches translucides ──────────────────
// Les COULEURS des matières vivent dans THEMES (glassChrome/glassPanel/…) ;
// ici, ce qui n'est pas une couleur : rayon de flou et saturation. Règle de
// hiérarchie : une grande surface se lit plus ÉPAISSE qu'une petite — plus
// de flou, ombre plus profonde. Une barre d'onglets n'a donc pas le même
// flou qu'une feuille plein écran.
const MATERIAL = Object.freeze({
  blur: Object.freeze({ chrome: 20, sheet: 30 }),
  saturate: 180,
  // Hauteur du dégradé de bord (là où le contenu passe SOUS le chrome
  // flottant) : un fondu court, jamais un filet de 1px.
  edgeFade: 28,
});

// ── Typographie : l'approche et l'interlignage suivent la taille ───
// Une seule valeur d'approche (letter-spacing) pour toutes les tailles est
// forcément fausse quelque part : en grandissant, les lettres paraissent
// trop espacées (il faut RESSERRER) ; en rapetissant, elles se collent (il
// faut OUVRIR). On dérive donc l'approche de la taille, une bonne fois, au
// lieu de la deviner ligne à ligne.
//
// Courbe : `a/px + b` (hyperbole, la forme des vraies tables optiques), calée
// sur trois points : ~+0.02em à 9px, 0 à 14px (corps de texte), et une
// asymptote à −0.035em pour les grandes tailles. Les capitales demandent en
// plus une ouverture fixe (`caps`) : sans elle, un micro-label en majuscules
// est illisible.
const TRACKING_A = 0.49;
const TRACKING_B = -0.035;
// Ouverture supplémentaire des capitales. Volontairement SOBRE : les
// micro-labels en majuscules vivent dans des grilles étroites (trois stats par
// ligne), et une approche trop généreuse les fait passer à la ligne — un
// libellé cassé en deux coûte plus de lisibilité qu'il n'en gagne.
const TRACKING_CAPS = 0.03;

function tracking(px, opts) {
  const size = Number.isFinite(px) && px > 0 ? px : 14;
  const caps = !!(opts && opts.caps);
  const em = Math.max(-0.03, Math.min(0.05, TRACKING_A / size + TRACKING_B));
  return `${((caps ? em + TRACKING_CAPS : em)).toFixed(4)}em`;
}

// L'interlignage suit la taille en sens INVERSE : serré sur un grand titre
// (les lignes se cherchent), aéré sur du texte courant (les lignes se
// suivent). Bornes : jamais sous 1.05 (les jambages se toucheraient), jamais
// au-delà de 1.6 (le paragraphe se déliterait).
function leading(px) {
  const size = Number.isFinite(px) && px > 0 ? px : 14;
  return Math.round(Math.max(1.05, Math.min(1.6, 1.9 - 0.032 * size)) * 1000) / 1000;
}

// Tailles en `rem` : le réglage « taille du texte » du navigateur/de l'OS
// agit alors sur toute la typographie du système (racine à 100%, cf.
// index.html) au lieu d'être ignoré.
const TYPE_ROOT_PX = 16;
function remSize(px) {
  const size = Number.isFinite(px) ? px : 14;
  return `${Math.round((size / TYPE_ROOT_PX) * 10000) / 10000}rem`;
}

// Style typographique complet pour une taille donnée. La hiérarchie se
// construit en JEU (taille + graisse + interlignage + approche), jamais par
// la taille seule : la graisse donne de la présence sans prendre de place.
function type(px, opts) {
  const o = opts || {};
  const st = {
    fontSize: remSize(px),
    letterSpacing: tracking(px, o),
    lineHeight: o.lineHeight != null ? o.lineHeight : leading(px),
  };
  if (o.family) st.fontFamily = o.family;
  if (o.weight != null) st.fontWeight = o.weight;
  if (o.italic) st.fontStyle = 'italic';
  if (o.caps) st.textTransform = 'uppercase';
  return st;
}

// Rôles nommés — la grille typographique de l'app. Un composant compose un
// rôle plutôt que d'inventer un triplet taille/approche/interlignage.
const TYPE = Object.freeze({
  display: Object.freeze(type(24, { family: fontSerif, italic: true, weight: 400 })),
  title:   Object.freeze(type(20, { family: fontSerif, italic: true, weight: 400 })),
  heading: Object.freeze(type(18, { family: fontSerif, italic: true, weight: 400 })),
  body:    Object.freeze(type(14)),
  bodyStrong: Object.freeze(type(14, { weight: 500 })),
  callout: Object.freeze(type(13)),
  footnote: Object.freeze(type(11.5)),
  // Micro-label en capitales (« EN DIRECT », « PÉRIODE ») : petite taille,
  // graisse moyenne, approche ouverte — les trois vont ensemble.
  label:   Object.freeze(type(10, { caps: true, weight: 500 })),
  labelLg: Object.freeze(type(11, { caps: true, weight: 500 })),
  // Nombres tabulaires : chasse fixe, approche neutre (les chiffres de Geist
  // Mono sont déjà calibrés — y ajouter de l'approche casse l'alignement).
  num:     Object.freeze({ fontFamily: fontNum, fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }),
});

// ── Motion : source unique de vérité (durées, easing, ressorts) ────
// Aucun composant ne code une durée, un easing ni un ressort en dur : tout
// passe par MOTION (cf. CLAUDE.md › DA § Mouvement).
//
// Deux régimes coexistent, et le choix n'est PAS esthétique :
//   • `fast`/`base` + `ease` — transitions NON gestuelles (fondu d'un toast,
//     bascule d'un état, entrée d'une liste). Une durée fixe suffit : rien
//     ne peut être attrapé en vol.
//   • `spring.*` — tout ce que le doigt peut toucher (feuilles, swipe,
//     réordonnancement). Un ressort part TOUJOURS de la valeur affichée et
//     accepte une nouvelle cible en cours de route : c'est ce qui rend le
//     mouvement interruptible et réversible (cf. § Ressorts plus bas).
const MOTION = Object.freeze({
  fast: 180, base: 220,
  // Démontage d'une feuille : le temps qu'il faut au ressort de sortie pour
  // l'emmener hors écran. Ce n'est PAS la durée de l'animation (un ressort
  // n'en a pas) — juste le moment où il n'y a plus rien à voir.
  exit: 300,
  stagger: 38,                          // ms entre deux items d'une liste
  ease: 'cubic-bezier(.2,.6,.2,1)',     // calme, sans overshoot
  // Miroir exact de `ease` (points de contrôle inversés : g(t) = 1 − f(1−t)).
  // Une transition réversible joue `ease` à l'aller et `easeReverse` au
  // retour, sinon le chemin de retour n'a pas le même « poids » que l'aller.
  easeReverse: 'cubic-bezier(.8,0,.8,.4)',
  press: 0.97,                          // scale au tap
  // Ressorts en vocabulaire Apple — `damping` (taux d'amortissement : 1 =
  // critique, aucun dépassement) + `response` (secondes pour rejoindre la
  // cible ; ce n'est PAS une durée, un ressort n'en a pas). Le rebond est
  // réservé aux gestes qui portaient de l'élan (lancer, relâcher) : un menu
  // qui apparaît sans geste ne rebondit jamais.
  spring: Object.freeze({
    ui:    Object.freeze({ damping: 1,   response: 0.35 }), // défaut, sans rebond
    move:  Object.freeze({ damping: 1,   response: 0.4 }),  // repositionnement
    sheet: Object.freeze({ damping: 0.8, response: 0.3 }),  // feuille / tiroir
    flick: Object.freeze({ damping: 0.8, response: 0.4 }),  // objet lancé
  }),
  decel: 0.998,        // taux de décélération (projection d'élan, feel scroll)
  decelSnappy: 0.99,   // variante plus sèche (listes courtes)
  rubber: 0.55,        // constante d'élastique aux bornes
  slop: 10,            // hystérésis avant d'engager une direction (px)
});

// ── Ressorts : intégration exacte, pure et testable ────────────────
// `springStep` avance l'état d'un ressort de `dt` secondes vers `target`. La
// solution est ANALYTIQUE (pas d'Euler) : le résultat ne dépend donc pas de
// la cadence des frames — une frame sautée ne change ni la trajectoire ni le
// point d'arrivée, et un pas de temps énorme (onglet revenu au premier plan)
// ne fait pas exploser l'intégration.
const SPRING_REST_DISTANCE = 0.01;   // « arrivé » sous ce reste de distance
const SPRING_REST_VELOCITY = 0.05;   // vitesse résiduelle négligeable

function springOmega(config) {
  const response = Math.max(0.0001, (config && config.response) || MOTION.spring.ui.response);
  return (2 * Math.PI) / response;
}

function springStep(state, target, config, dt) {
  const x0 = (state && Number.isFinite(state.x)) ? state.x : 0;
  const v0 = (state && Number.isFinite(state.v)) ? state.v : 0;
  const to = Number.isFinite(target) ? target : 0;
  if (!(dt > 0)) return { x: x0, v: v0 };
  const z = Math.max(0, (config && config.damping != null) ? config.damping : MOTION.spring.ui.damping);
  const w = springOmega(config);
  const d0 = x0 - to;                 // on intègre le DÉPLACEMENT vers la cible
  let d, v;
  if (z < 1) {
    // Sous-amorti : dépasse puis oscille (rebond).
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w * dt);
    const c = Math.cos(wd * dt), s = Math.sin(wd * dt);
    const B = (v0 + z * w * d0) / wd;
    d = e * (d0 * c + B * s);
    v = e * ((B * wd - z * w * d0) * c - (z * w * B + d0 * wd) * s);
  } else if (z === 1) {
    // Critique : rejoint la cible au plus vite SANS jamais la dépasser.
    const e = Math.exp(-w * dt);
    const k = v0 + w * d0;
    d = (d0 + k * dt) * e;
    v = (v0 - w * k * dt) * e;
  } else {
    // Sur-amorti : deux exponentielles, approche lente et molle.
    const r = w * Math.sqrt(z * z - 1);
    const r1 = -z * w + r, r2 = -z * w - r;
    const c1 = (v0 - r2 * d0) / (r1 - r2);
    const c2 = d0 - c1;
    const e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
    d = c1 * e1 + c2 * e2;
    v = c1 * r1 * e1 + c2 * r2 * e2;
  }
  if (!Number.isFinite(d) || !Number.isFinite(v)) return { x: to, v: 0 };
  return { x: to + d, v };
}

// Le ressort est-il assez près de la cible ET assez lent pour qu'on l'y
// pose ? Les deux conditions comptent : un ressort qui PASSE sur la cible à
// pleine vitesse n'est pas au repos.
function springAtRest(state, target, opts) {
  const o = opts || {};
  const restD = o.restDistance != null ? o.restDistance : SPRING_REST_DISTANCE;
  const restV = o.restVelocity != null ? o.restVelocity : SPRING_REST_VELOCITY;
  const x = (state && Number.isFinite(state.x)) ? state.x : 0;
  const v = (state && Number.isFinite(state.v)) ? state.v : 0;
  const to = Number.isFinite(target) ? target : 0;
  return Math.abs(x - to) <= restD && Math.abs(v) <= restV;
}

// ── Élan : où le geste VA, pas où il s'arrête ─────────────────────
// Décroissance exponentielle (la formule du sample code Apple), pas le
// `v²/(2a)` des manuels : c'est elle qui donne le « feel » de la
// décélération de scroll. On projette le point d'arrivée du doigt, PUIS on
// choisit la cible la plus proche de ce point — un flick court mais rapide
// doit donc emporter la décision autant qu'un long glissement lent.
function projectMomentum(velocity, decelerationRate = MOTION.decel) {
  const v = Number.isFinite(velocity) ? velocity : 0;
  const d = Math.min(0.99999, Math.max(0, Number.isFinite(decelerationRate) ? decelerationRate : MOTION.decel));
  return (v / 1000) * d / (1 - d);
}

// Bord souple : plus on tire au-delà de la borne, moins l'élément suit.
// Un arrêt net se lit « figé/cassé » ; une résistance progressive se lit
// « ça répond, mais il n'y a rien de plus par là ». L'asymptote vaut
// `dimension`, donc on ne peut jamais tirer indéfiniment.
function rubberband(overshoot, dimension, constant = MOTION.rubber) {
  const o = Number.isFinite(overshoot) ? overshoot : 0;
  const dim = Number.isFinite(dimension) ? dimension : 0;
  const c = Number.isFinite(constant) ? constant : MOTION.rubber;
  if (!(dim > 0) || !(c > 0)) return 0;
  return (o * dim * c) / (dim + c * Math.abs(o));
}

// Applique les bornes en gardant un débordement élastique de part et
// d'autre. `dimension` = amplitude de résistance (typiquement la taille de
// l'élément) ; `null` en borne = côté libre.
function clampRubber(value, min, max, dimension, constant = MOTION.rubber) {
  const v = Number.isFinite(value) ? value : 0;
  if (min != null && v < min) return min + rubberband(v - min, dimension, constant);
  if (max != null && v > max) return max + rubberband(v - max, dimension, constant);
  return v;
}

// Point d'accrochage le plus proche d'une valeur (typiquement le point
// d'arrivée PROJETÉ, pas la position de relâchement).
function nearestSnapPoint(value, points) {
  const list = (points || []).filter(Number.isFinite);
  if (!list.length) return null;
  const v = Number.isFinite(value) ? value : 0;
  let best = list[0];
  for (const p of list) if (Math.abs(p - v) < Math.abs(best - v)) best = p;
  return best;
}

// Historique de position → vitesse de relâchement (px/s). On ne dérive
// JAMAIS la vitesse des deux derniers points : un doigt qui s'immobilise une
// frame avant de lâcher donnerait 0 et tuerait l'élan. On régresse sur une
// petite fenêtre temporelle glissante.
function createVelocityTracker(windowMs = 100, maxSamples = 12) {
  let samples = [];
  return {
    reset() { samples = []; },
    add(value, t) {
      const ts = Number.isFinite(t) ? t : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
      samples.push({ value, t: ts });
      const cutoff = ts - windowMs;
      while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
      if (samples.length > maxSamples) samples = samples.slice(-maxSamples);
    },
    velocity() {
      if (samples.length < 2) return 0;
      const first = samples[0], last = samples[samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (!(dt > 0)) return 0;
      const v = (last.value - first.value) / dt;
      return Number.isFinite(v) ? v : 0;
    },
    samples() { return samples.slice(); },
  };
}

// ── Retour haptique (§ motion + sound + haptics) ───────────────────
// Trois règles, dans cet ordre :
//   1. CAUSALITÉ — déclenché par l'évènement causal lui-même (l'accrochage,
//      la suppression validée), jamais « après coup » ni sur une intention.
//   2. HARMONIE — appelé dans le MÊME handler que le changement visuel, donc
//      sur la même frame. Jamais derrière un setTimeout.
//   3. UTILITÉ — réservé aux moments qui comptent (commit, accrochage,
//      succès, erreur). Sur-vibrer apprend à ignorer la vibration.
// Sans moteur haptique (iOS Safari, desktop), c'est un no-op silencieux.
const HAPTICS = Object.freeze({
  tick: 6,             // franchissement d'un cran (roue, réordonnancement)
  select: 10,          // sélection engagée
  commit: 16,          // action validée (suppression, accrochage d'une feuille)
  warning: [12, 40, 12],
  error: [22, 60, 22],
});

function haptic(kind = 'select') {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    if (!hapticsEnabled()) return false;
    const pattern = HAPTICS[kind] != null ? HAPTICS[kind] : HAPTICS.select;
    navigator.vibrate(pattern);
    return true;
  } catch { return false; }
}

// Préférence utilisateur (Paramètres › Retour haptique). localStorage et non
// Dexie : lue dans des handlers de geste, à chaud, sans await possible.
const HAPTICS_KEY = 'alconote.haptics';
function hapticsEnabled() {
  try { return localStorage.getItem(HAPTICS_KEY) !== 'off'; } catch { return true; }
}
function setHapticsEnabled(on) {
  try { localStorage.setItem(HAPTICS_KEY, on ? 'on' : 'off'); } catch {}
}

// ── Icons ──────────────────────────────────────────────────────────
const Ic = {
  menu:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="13" x2="20" y2="13"/><line x1="4" y1="19" x2="14" y2="19"/></svg>,
  search:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>,
  plus:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  scan:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="17" y1="8" x2="17" y2="16"/></svg>,
  chev:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  chevL: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  chevR: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  back:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  pin:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  star:  <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  starOutline: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  filter:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  cal:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>,
  edit:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  car:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>,
  sun:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  moon:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  auto:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 12a9 9 0 0 0 0-9"/></svg>,
  home:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  map:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 4 15 6 21 4 21 18 15 20 9 18 3 20 3 6"/><line x1="9" y1="4" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="20"/></svg>,
  crosshair: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7"/><line x1="12" y1="1.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22.5" y2="12"/></svg>,
  expand: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  layers: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  flame: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  hourglass: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12v3a6 6 0 0 1-3.5 5.45L13 11l1.5.55A6 6 0 0 1 18 17v3H6v-3a6 6 0 0 1 3.5-5.45L11 11l-1.5-.55A6 6 0 0 1 6 5V2z"/></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 4 3 10 9 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 10"/></svg>,
  grid:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  clockArrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/><polyline points="12 7 12 12 15 14"/></svg>,
  bars:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  trendUp:   <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="10" x2="6" y2="2"/><polyline points="3 5 6 2 9 5"/></svg>,
  trendDown: <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="6" y1="2" x2="6" y2="10"/><polyline points="3 7 6 10 9 7"/></svg>,
  trendFlat: <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="6" x2="10" y2="6"/><polyline points="7 3 10 6 7 9"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  grip:  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>,
  userMinus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="17" y1="11" x2="23" y2="11"/></svg>,
};

function SvgIcon({ icon, size = 18, color, ariaHidden = true }) {
  return (
    <span aria-hidden={ariaHidden ? 'true' : undefined} style={{
      display: 'inline-flex', width: size, height: size,
      color: color || 'currentColor' }}>
      {React.cloneElement(icon, { width: size, height: size })}
    </span>
  );
}
// ── Category palette — change here to reskin the whole app ────────
const CAT_DEFAULT = {
  'Bière':      { hue: 80,  c: 0.16, light_l: 55, dark_l: 72, bg_l: 32 },
  'Vin':        { hue: 15,  c: 0.18, light_l: 52, dark_l: 70, bg_l: 30 },
  'Spiritueux': { hue: 300, c: 0.14, light_l: 55, dark_l: 72, bg_l: 32 },
  'Cocktail':   { hue: 180, c: 0.13, light_l: 48, dark_l: 72, bg_l: 32 },
  'Autre':      { hue: 240, c: 0.10, light_l: 52, dark_l: 70, bg_l: 30 },
};

// CAT is mutable and may be augmented at runtime when users create custom
// categories. We assign deterministic hues to unknown names by hashing.
const CAT = { ...CAT_DEFAULT };

// Deterministic hue per name so a custom category always gets the
// same tint across reloads (no random palette flicker).
function _hashHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function _ensureCat(name) {
  // Clé TOUJOURS canonique (trim + NFC) : les surcharges de teinte sont posées
  // sous canonicalCat(name) par applyCatHueOverrides — un nom brut divergent
  // (« Bière » en NFD, espace parasite venu d'un import) doit résoudre la
  // MÊME palette, sinon la couleur perso « ne marche pas » pour cette
  // catégorie-là (bug historique : couleur/teinte ignorée pour certaines
  // catégories seulement).
  const key = canonicalCat(name);
  if (!CAT[key]) {
    CAT[key] = {
      hue: _hashHue(key), c: 0.12,
      light_l: 52, dark_l: 70, bg_l: 30,
    };
  }
  return CAT[key];
}

function catColor(name, l) {
  const c = _ensureCat(name);
  const L = l !== undefined ? l : (T.isDark ? c.dark_l : c.light_l);
  return `oklch(${L}% ${c.c} ${c.hue})`;
}

// Apply an alpha to any color string. oklch() supports `/ alpha` natively;
// other formats fall back to the input unchanged. Replaces the legacy
// `${color}NN` hex-alpha trick which is invalid CSS for non-hex colors.
function withAlpha(color, a) {
  if (typeof color !== 'string') return color;
  const m = color.match(/^(\s*)oklch\((.*?)\)(\s*)$/i);
  if (m) return `${m[1]}oklch(${m[2].trim()} / ${a})${m[3]}`;
  return color;
}

function catBg(name) {
  const c = _ensureCat(name);
  return T.isDark
    ? `oklch(${c.bg_l}% ${c.c * 0.5} ${c.hue})`
    : `oklch(94% ${c.c * 0.25} ${c.hue})`;
}

// Teinte (hue 0-359) qu'aurait une catégorie SANS surcharge utilisateur :
// défaut nommé si connu, sinon hash déterministe. Sert d'aperçu « Auto » et
// de valeur de repli quand l'utilisateur efface sa couleur perso.
function defaultCatHue(name) {
  // Même canonicalisation que _ensureCat : « Bière  » et « Bière » (NFC/NFD)
  // partagent le même défaut ET le même hash de repli.
  const key = canonicalCat(name);
  const def = CAT_DEFAULT[key];
  return def ? def.hue : _hashHue(key);
}

// Applique des surcharges de teinte par catégorie (couleur perso choisie au
// slider). `byName` = { nomCanonique: hue 0-359 }. On NE touche QUE la teinte
// (`hue`) — chroma/clarté restent ceux du défaut/hash pour préserver
// l'harmonie de la DA. Idempotent et indépendant de l'ordre : on repart
// toujours d'une base propre (purge des entrées runtime non-défaut → repli
// hash/défaut pour toute catégorie dont la surcharge a été retirée), puis on
// pose les teintes. MUTE le registre module `CAT` ; le repaint est piloté par
// le re-render React (bump 'cat-colors'/'categories'), `catColor`/`catBg`
// relisant `CAT` à chaque appel.
function applyCatHueOverrides(byName) {
  // Repart d'une base PROPRE : on vide CAT puis on re-CLONE chaque palette de
  // CAT_DEFAULT. Le clone est crucial — `const CAT = { ...CAT_DEFAULT }` copie
  // les RÉFÉRENCES des objets palette, donc muter `CAT['Bière'].hue` muterait
  // aussi CAT_DEFAULT['Bière'] (défaut corrompu à jamais). Les catégories
  // runtime (teinte hashée) seront recréées paresseusement par _ensureCat.
  for (const k of Object.keys(CAT)) delete CAT[k];
  for (const k of Object.keys(CAT_DEFAULT)) CAT[k] = { ...CAT_DEFAULT[k] };
  const map = byName || {};
  for (const name of Object.keys(map)) {
    const hue = map[name];
    if (hue == null || !Number.isFinite(hue)) continue;
    const c = _ensureCat(name); // clone (défaut) ou nouvelle entrée (hash)
    c.hue = ((Math.round(hue) % 360) + 360) % 360;
  }
}

// ── Toast helper (global so any component can fire one) ───────────
// `show(msg)` prints a transient confirmation. `show(msg, opts)` accepts
// an `undo` callback rendered as an "Annuler" button — used by every
// delete path so the user can revert a destructive action without a
// modal confirmation up front.
//
// Only ONE toast lives at a time: a second `show()` replaces the first
// and its undo callback is dropped on the floor. Mirrors the legacy
// bar-app UX — quick successive deletes commit irreversibly, the user
// keeps the most-recent undo affordance only.
const Toast = {
  show(msg, opts) {
    if (typeof window !== 'undefined' && window.__alcoToastSetter) {
      window.__alcoToastSetter(msg, opts || null);
    }
  },
};

// Build YYYY-MM-DD / HH:MM strings from the LOCAL calendar fields, not
// UTC ones. Pairing a UTC date with a local time previously shifted
// late-night drinks (e.g. 01h in CEST) backward by 24h once
// `computeBacOverTime` re-parsed `${date}T${time}` as local — they fell
// outside the 24h lookback and BAC silently stayed at 0.
function localDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localTime(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Date formatting helpers (French) ──────────────────────────────
const FR_DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const FR_DAYS_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const FR_MONTHS_SHORT = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const FR_MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FR_MONTHS_DOTTED = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function fmtDateMedium(iso) {
  if (!iso) return '—';
  // `new Date('YYYY-MM-DD')` parse en UTC minuit : dans un fuseau négatif la
  // date rendue recule d'un jour. Découper les champs garde le jour calendaire.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return `${Number(m[3])} ${FR_MONTHS_DOTTED[Number(m[2]) - 1]}`;
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${FR_MONTHS_DOTTED[d.getMonth()]}`;
}

function fmtDayHeader(d) {
  return `${FR_DAYS_SHORT[d.getDay()]}. ${d.getDate()} ${FR_MONTHS_SHORT[d.getMonth()]}.`;
}

// ── Quantity helpers (cL conversion mirrors the legacy DB layer) ──
function toCl(qty, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'ecocup') return qty * 25;
  if (u === 'l')      return qty * 100;
  if (u === 'ml')     return qty / 10;
  return qty;
}

// ── Alcool pur (grammes d'éthanol) ────────────────────────────────
// Source unique de la conversion volume → grammes d'alcool pur, partagée par
// l'add-drink (stat « impact ») et toutes les sections stats/BAC. Évite que la
// formule Widmark de base soit recopiée à six endroits.
//   volume(cL) ×10 = mL ; ×(°/100) = mL d'éthanol ; ×densité = grammes.
const ETHANOL_DENSITY_G_PER_ML = 0.789; // densité de l'éthanol (g/mL)

function ethanolGrams(volCl, abvPct) {
  return volCl * 10 * ((abvPct || 0) / 100) * ETHANOL_DENSITY_G_PER_ML;
}

function drinkAlcoholGrams(drink) {
  return ethanolGrams(toCl(drink.quantity, drink.unit), drink.alcoholContent);
}

// Formatage prix (€) — jusqu'à 2 décimales sans zéros inutiles, séparateur
// virgule (FR) ; null/vide/NaN → « — ». Source unique, réutilisée par les
// feuilles (DrinkDetailSheet) et les stats (section Dépenses).
function fmtPrice(v) {
  const n = Number(v);
  if (v == null || v === '' || !Number.isFinite(n)) return '—';
  const s = (Math.round(n * 100) / 100).toString().replace('.', ',');
  return `${s} €`;
}

// ── Search input ──────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.surface2, borderRadius: 14, padding: '12px 14px',
      border: `1px solid ${T.rule}` }}>
      <span style={{ color: T.muted, display: 'flex' }}>
        <SvgIcon icon={Ic.search} size={16} />
      </span>
      <input
        value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder || 'Rechercher'}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: T.ink, fontFamily: fontSans, ...TYPE.body,
          minWidth: 0,
        }}
      />
      {value && (
        // Un vrai <button> : atteignable au clavier, et il répond à l'appui
        // (un <span> cliquable ne fait ni l'un ni l'autre).
        <button type="button" className="alco-press" onClick={() => onChange('')}
          aria-label="Effacer la recherche" style={{
            ...ghostButton, color: T.muted, display: 'flex', cursor: 'pointer',
            padding: 4, margin: -4, touchAction: 'manipulation' }}>
          <SvgIcon icon={Ic.close} size={14} />
        </button>
      )}
    </div>
  );
}

// ── Section head ──────────────────────────────────────────────────
function SectionHead({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: T.muted, ...TYPE.labelLg, padding: '6px 2px' }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────
function Pill({ active, onClick, children, color }) {
  return (
    // Le SURLIGNAGE part à l'appui (classe `alco-press`, donc instantané) ;
    // l'ACTION se valide au relâchement — c'est ce qui laisse annuler un
    // appui en glissant le doigt hors du bouton.
    <button type="button" className="alco-press" aria-pressed={active ? 'true' : 'false'}
      onClick={(e) => { haptic('tick'); onClick && onClick(e); }}
      style={{
        padding: '8px 12px', borderRadius: 99, cursor: 'pointer',
        background: active ? T.ink : 'transparent',
        color: active ? T.bg : T.ink2,
        border: active ? `1px solid ${T.ink}` : `1px solid ${T.rule}`,
        ...type(12, { weight: active ? 500 : 400 }),
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0, fontFamily: 'inherit', touchAction: 'manipulation' }}>
      {color && !active && <span style={{ color, fontSize: remSize(10), letterSpacing: tracking(10) }}>●</span>}
      {children}
    </button>
  );
}

// ── Stars (rating) ────────────────────────────────────────────────
// `value` reads `n` first (explicit prop wins over the named alias `rating`)
// so a 0 is preserved (?? not ||).  Interactive mode: clicking star i always
// sets the rating to i (including 1). Clearing is done via an explicit
// "Effacer" control next to the stars, never by re-tapping star 1 — the old
// toggle made a 1-star rating impossible to set right after clearing it.
function Stars({ rating, n, size = 13, interactive, onChange }) {
  const raw = (typeof n === 'number' ? n : rating);
  const value = (typeof raw === 'number' ? raw : 0);
  const cells = [1, 2, 3, 4, 5];
  const handle = (i) => (e) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    // Noter est de la manipulation directe : l'étoile s'allume sous le doigt,
    // avec sa vibration, dans le même handler (donc la même frame).
    if (i !== value) haptic('select');
    onChange && onChange(i);
  };
  // Pad each cell so the touch target is large enough on small icons
  const pad = Math.max(0, Math.ceil((22 - size) / 2));
  return (
    <div style={{ display: 'flex', gap: 1 }} role={interactive ? 'radiogroup' : undefined}
      aria-label={interactive ? 'Note' : undefined}>
      {cells.map(i => (
        <span key={i}
          role={interactive ? 'radio' : undefined}
          aria-checked={interactive ? (i === value) : undefined}
          aria-label={interactive ? `${i} étoile${i > 1 ? 's' : ''}` : undefined}
          onPointerDown={interactive ? handle(i) : undefined}
          onClick={interactive ? handle(i) : undefined}
          style={{
            color: i <= value ? T.accent : T.rule,
            display: 'flex', cursor: interactive ? 'pointer' : 'default',
            padding: interactive ? `${pad}px ${Math.max(1, pad)}px` : 0,
            margin: interactive ? `-${pad}px 0` : 0,
            touchAction: 'manipulation' }}>
          <SvgIcon icon={Ic.star} size={size} />
        </span>
      ))}
    </div>
  );
}

// ── Category glyphs ───────────────────────────────────────────────
// `glyph` lets a category override its icon by referencing another
// category's name (e.g. an "IPA" category styled like "Bière"). When
// omitted, the lookup falls back to the category name and finally to
// the generic glass icon.
//
// Each entry is a render function returning an SVG with the canonical
// 24x24 viewBox + stroke="currentColor" line style. Keep new icons
// visually consistent (1.5 stroke, no fill) so the picker stays even.
const GLYPHS = {
  'Bière': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 6h8v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z"/><path d="M15 9h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><line x1="9" y1="10" x2="9" y2="18"/><line x1="12" y1="10" x2="12" y2="18"/></svg>,
  'Vin': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="21" x2="16" y2="21"/></svg>,
  'Spiritueux': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="8" width="8" height="13" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="0.5"/><line x1="8" y1="13" x2="16" y2="13"/></svg>,
  'Cocktail': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16l-8 9-8-9z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="21" x2="16" y2="21"/></svg>,
  'Champagne': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 3h5l-0.5 9a2 2 0 0 1-4 0L9.5 3z"/><line x1="12" y1="14" x2="12" y2="20"/><line x1="9" y1="21" x2="15" y2="21"/><circle cx="11" cy="7" r="0.4" fill="currentColor"/><circle cx="13" cy="9" r="0.4" fill="currentColor"/><circle cx="11.5" cy="11" r="0.4" fill="currentColor"/></svg>,
  'Whisky': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"/><rect x="8.5" y="11" width="3.2" height="3.2" rx="0.5"/><rect x="13" y="14.5" width="2.8" height="2.8" rx="0.5"/></svg>,
  'Shot': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 8h6l-0.5 11a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2L9 8z"/><line x1="9" y1="13" x2="15" y2="13"/></svg>,
  'Cidre': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 7c-3-2-7-1-7 4 0 5 3 11 7 11s7-6 7-11c0-5-4-6-7-4z"/><path d="M12 7v-2c0-1 1-2 2-2"/><path d="M14 3.5c0.5-0.3 1-0.3 1.5 0"/></svg>,
  'Saké': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3h4v3c0 1 1 2 2 3 1 1 2 2 2 4v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7c0-2 1-3 2-4 1-1 2-2 2-3V3z"/><line x1="7" y1="13" x2="17" y2="13"/></svg>,
  'Café': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 9h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z"/><path d="M17 11h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2"/><path d="M8 4c0 1 0 2 1 3"/><path d="M11 4c0 1 0 2 1 3"/></svg>,
  'Liqueur': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3h4v4l1.2 2v9a2 2 0 0 1-2 2h-2.4a2 2 0 0 1-2-2v-9L10 7V3z"/><line x1="9" y1="13" x2="15" y2="13"/><rect x="10.5" y="15" width="3" height="2.8" rx="0.3"/></svg>,
  'Pinte': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4h10l-1 17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 4z"/><line x1="8" y1="9" x2="16" y2="9"/></svg>,
  'Punch': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 11h18l-1 8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 11z"/><line x1="2" y1="11" x2="22" y2="11"/><path d="M14 4l-1 7"/><circle cx="15" cy="3.5" r="1.5"/></svg>,
  'Apéritif': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 4c0 6 3 9 5 9s5-3 5-9z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="9" y1="21" x2="15" y2="21"/></svg>,
  'Autre': (s) => <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>,
};

const GLYPH_OPTIONS = Object.keys(GLYPHS);

// Provided at the App root by <CategoryIconsProvider> (proto/data.jsx)
// with the current icon-overrides map. Every <CategoryGlyph> reads
// from this context so a single dataBus subscription (provider-level)
// re-renders every glyph on the screen instead of N per-instance
// subscriptions.
const CategoryIconsContext = React.createContext({});

// Surcharges de teinte par catégorie : { nomCanonique: hue 0-359 }. Fournie
// par CategoryIconsProvider (même provider que les icônes) ; lue par
// EditCategorySheet pour préremplir le slider « Couleur ». Le repaint des
// cards passe par `CAT` (muté par applyCatHueOverrides), pas par ce context.
const CategoryColorsContext = React.createContext({});

// Canonical category key: trim + NFC-normalize so icon overrides survive
// stray whitespace and accent-normalization differences (a drink saved as
// "Bière " resolves to the same key as the "Bière" category row).
function canonicalCat(name) {
  return String(name == null ? '' : name).trim().normalize('NFC');
}

// Abonnement à la palette de catégories. La palette vit dans le registre
// module `CAT` (muté par applyCatHueOverrides) — une mutation y est INVISIBLE
// pour React : un composant `React.memo` dont les props n'ont pas bougé ne se
// re-rend pas, et sa carte garde l'ancienne couleur jusqu'à un bump étranger
// (bug historique : « je change la couleur, rien ne se passe »). Ce hook lit
// CategoryColorsContext (nouvelle référence à chaque changement de couleur),
// ce qui traverse React.memo et force le repaint.
// RÈGLE : tout composant qui appelle catColor()/catBg() appelle AUSSI
// useCatPalette() — vérifié par static-checks pour les composants React.memo.
function useCatPalette() {
  return React.useContext(CategoryColorsContext);
}

function CategoryGlyph({ name, glyph, size = 22 }) {
  const customIcons = React.useContext(CategoryIconsContext);
  // Fall back to the canonical name (not the raw one) so a default glyph
  // still resolves for a drink stored as e.g. "Bière " with no override.
  const key = glyph || customIcons[canonicalCat(name)] || canonicalCat(name);
  const s = { width: size, height: size };
  const draw = GLYPHS[key] || GLYPHS['Autre'];
  return draw(s);
}

// ── Clickable card props (for divs that contain inner buttons) ────
// Rendering a real <button> around a card with sub-buttons is invalid
// HTML, so cards stay as <div> but get role/tabIndex/keyboard handling.
function clickable(onClick, label) {
  return {
    onClick,
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick && onClick(e);
      }
    },
  };
}

// Reusable "ghost" button reset for clickable surfaces that want a
// transparent background and inherit fonts.
const ghostButton = {
  background: 'transparent', border: 'none', padding: 0,
  fontFamily: 'inherit', color: 'inherit', cursor: 'pointer',
  textAlign: 'inherit',
};

// ── Quick-add ("+") button ────────────────────────────────────────
// Re-adds a family in one tap from the Catégories / Historique lists.
// It fires on `pointerup`, NOT `click`: when the soft keyboard is open
// (the user just typed in a search field), the first tap blurs the
// input, the keyboard collapses and the list reflows — the trailing
// synthetic `click` then misses this small target and the add never
// happens. A touch pointer is *implicitly captured* by its pointerdown
// target, so `pointerup` always lands here regardless of any layout
// shift. `click` stays wired purely as the keyboard-activation path
// (Enter/Space on a focused button emits a click but no pointer events);
// the ghost click that browsers synthesize right after a pointer gesture
// is swallowed by the recency check so the add never double-fires.
// A few px of finger travel is treated as a scroll, not a tap.
function QuickAddButton({ onAdd, label, size = 32 }) {
  const start = React.useRef(null);
  const lastPointerTs = React.useRef(0);
  // Feedback tactile composé avec les handlers pointer existants (on
  // appelle press/release, on n'écrase rien — la logique d'ajout reste).
  const press = usePressScale();
  return (
    <button type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
        start.current = { x: e.clientX, y: e.clientY, moved: false };
        press.press();
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (s && (Math.abs(e.clientX - s.x) > 10 || Math.abs(e.clientY - s.y) > 10)) {
          s.moved = true;
          press.release();
        }
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        const s = start.current; start.current = null;
        lastPointerTs.current = e.timeStamp;
        press.release();
        if (s && !s.moved) { haptic('commit'); onAdd && onAdd(); }
      }}
      onPointerCancel={() => { start.current = null; press.release(); }}
      onKeyDown={(e) => {
        // Keep Enter/Space from bubbling to a parent `clickable` row
        // (FamilyRow), whose onKeyDown would otherwise open the detail
        // sheet — and preventDefault the button's own activation. The
        // button still fires its native click → onClick → onAdd.
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Swallow the ghost click that follows a real pointer gesture
        // (already handled in pointerup); only a keyboard-driven click,
        // which has no recent pointer, falls through to fire the add.
        if (e.timeStamp - lastPointerTs.current < 700) return;
        onAdd && onAdd();
      }}
      style={{
        width: size, height: size, borderRadius: 10,
        background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
        display: 'grid', placeItems: 'center', color: T.accent,
        cursor: 'pointer', flexShrink: 0,
        padding: 0, fontFamily: 'inherit', touchAction: 'manipulation',
        ...press.style,
      }}
      title="Ajouter à nouveau"
      aria-label={label}
    >
      <SvgIcon icon={Ic.plus} size={14} />
    </button>
  );
}

// ── Back button / overlay back-stack ─────────────────────────────
// Au chargement : si l'entrée d'historique COURANTE est un piège `__alcoBack`
// hérité d'une session précédente (app tuée/rechargée avec une feuille ou une
// vue ouverte), on le consomme immédiatement. Sans cette purge, le premier
// geste « retour » du système navigue vers l'entrée morte de la même URL —
// la page se recharge — puis l'historique est vide et le geste ne fait plus
// rien (symptôme : « ça me remet sur la page et je ne peux plus glisser »).
(function dropStaleBackTrap() {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  try {
    if (history.state && history.state.__alcoBack) history.back();
  } catch {}
})();

// Makes the Android system Back button (and browser back) close the
// top-most open overlay instead of leaving the app. Each open layer
// pushes one synthetic history entry; a Back press pops it and closes
// that layer. When nothing is registered, Back falls through to the
// default (exit the PWA / TWA), which is the expected root behaviour.
//
// The `closedByPop` flag — set *synchronously* in the popstate handler,
// read later in the React effect cleanup — is what keeps the history
// depth correct whether a layer is dismissed by Back or by a button /
// backdrop / Escape, including nested layers.
const BackStack = (() => {
  const stack = [];
  let installed = false;
  // Count (not bool) of programmatic history.back() calls awaiting their
  // popstate, so N layers closing in the same tick each get their own
  // entry consumed instead of one resetting the flag for all the others.
  let suppress = 0;
  const install = () => {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    window.addEventListener('popstate', () => {
      if (suppress > 0) { suppress--; return; }
      const top = stack[stack.length - 1];
      if (!top) return; // nothing open → let the browser do the default
      top.closedByPop = true;
      try { top.close(); } catch {}
    });
  };
  return {
    push(close) {
      install();
      const entry = { close, pushed: false };
      stack.push(entry);
      // `pushed` records whether we actually added a history entry, so a
      // swallowed pushState (e.g. sandboxed iframe) doesn't make remove()
      // fire an unmatched history.back() and desync the counter.
      try { history.pushState({ __alcoBack: true }, ''); entry.pushed = true; } catch {}
      return entry;
    },
    remove(entry) {
      const i = stack.lastIndexOf(entry);
      if (i < 0) return;
      stack.splice(i, 1);
      if (entry.closedByPop) return; // Back already consumed the trap entry
      if (!entry.pushed) return;     // never added an entry → nothing to undo
      suppress++;
      try { history.back(); } catch { suppress--; }
    },
  };
})();

// Register `onClose` as the back-button handler while `active` is true.
// `onClose` is read through a ref so a changing handler identity doesn't
// re-push history entries.
function useBackButton(active, onClose) {
  const ref = React.useRef(onClose);
  ref.current = onClose;
  React.useEffect(() => {
    if (!active) return;
    const entry = BackStack.push(() => { if (ref.current) ref.current(); });
    return () => BackStack.remove(entry);
  }, [active]);
}

// ── Sheet overlay (bottom sheet / left or right drawer) ──────────
// Une feuille n'est pas une boîte qui apparaît : c'est un objet PHYSIQUE
// qu'on pousse, qu'on rattrape et qu'on renvoie. Tout passe donc par un
// ressort unique, partagé par le geste et l'animation :
//   • ENTRÉE — depuis le bord, ressort sans rebond (aucun geste ne l'a
//     lancée : un rebond « gratuit » sonnerait faux) ;
//   • GESTE — suivi 1:1 du doigt, résistance élastique si on tire dans le
//     mauvais sens, le voile s'éclaircit EN CONTINU avec la traînée (même
//     ressort → même frame, jamais de décalage entre les deux) ;
//   • RELÂCHE — le point d'arrivée est projeté depuis la vitesse ; un petit
//     coup sec renvoie donc la feuille aussi sûrement qu'un long glissement.
//     La vitesse du doigt est passée au ressort : aucune couture ;
//   • SORTIE — même chemin qu'à l'entrée (ce qui est parti par le bas
//     revient par le bas) ;
//   • INTERRUPTION — une feuille qui se referme peut être RATTRAPÉE : la
//     saisir annule la fermeture et elle repart du doigt, sans saut.
// Reduced-motion : aucune translation, simple fondu, geste désactivé.
const SHEET_FALLBACK_DIST = 420;   // repli si la mesure échoue (1er paint)
const SHEET_FLING_V = 250;         // px/s : au-delà, le SIGNE de la vitesse décide
const SHEET_DISMISS_FRACTION = 0.4;

// Poignée de saisie d'une feuille : partagée par SheetOverlay (qui fournit
// les handlers) et <SheetGrabber> (qui les pose). Une feuille du BAS ne peut
// pas être traînable partout — le geste vertical appartient à son contenu
// défilant ; seule la zone d'en-tête la saisit.
const SheetDragContext = React.createContext(null);

// En-tête saisissable d'une feuille : la barrette + tout ce qu'on lui donne
// (titre, bouton fermer). Reste utilisable pendant la fermeture (c'est par
// elle qu'on rattrape une feuille qui part).
function SheetGrabber({ children, style }) {
  const drag = React.useContext(SheetDragContext);
  return (
    <div {...(drag ? drag.handlers : null)} style={{
      flexShrink: 0, cursor: drag ? 'grab' : 'default',
      touchAction: drag ? 'none' : undefined,
      pointerEvents: 'auto',
      ...style }}>
      <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
        {/* La barrette n'est plus un ornement : c'est la PRISE de la feuille.
            Elle se lit donc comme une commande (encre atténuée), pas comme un
            filet de séparation. */}
        <div aria-hidden="true" style={{
          width: 42, height: 4, borderRadius: 99,
          background: withAlpha(T.muted, 0.45),
        }} />
      </div>
      {children}
    </div>
  );
}

function SheetOverlay({ children, onClose, side = 'bottom', label, closing = false,
                       onCancelClose, dismissible = true }) {
  const reduced = useReducedMotion();
  const scrimRef = React.useRef(null);
  const sheetRef = React.useRef(null);
  const distRef = React.useRef(SHEET_FALLBACK_DIST);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const cancelRef = React.useRef(onCancelClose);
  cancelRef.current = onCancelClose;
  const closingRef = React.useRef(closing);
  closingRef.current = closing;

  const isSide = side === 'left' || side === 'right';
  const axis = isSide ? 'x' : 'y';
  const sign = side === 'left' ? -1 : 1;     // sens de la sortie sur l'axe

  const measure = React.useCallback(() => {
    const el = sheetRef.current;
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      const d = axis === 'y' ? r.height : r.width;
      if (d > 0) distRef.current = d;
    }
    return distRef.current;
  }, [axis]);

  // SEUL point d'écriture du DOM : le geste et le ressort passent tous les
  // deux par ici, ils ne peuvent donc pas se désynchroniser. Le voile suit
  // la traînée en continu — il ne « saute » pas à la fin du geste.
  const apply = React.useCallback((x) => {
    const dist = distRef.current || SHEET_FALLBACK_DIST;
    const el = sheetRef.current;
    if (el) {
      el.style.transform = axis === 'y'
        ? `translate3d(0, ${x}px, 0)` : `translate3d(${x}px, 0, 0)`;
    }
    const sc = scrimRef.current;
    if (sc) sc.style.opacity = String(Math.max(0, Math.min(1, 1 - Math.abs(x) / dist)));
  }, [axis]);

  const drag = useAxisDrag({
    axis, apply,
    enabled: dismissible && !reduced,
    config: MOTION.spring.sheet,
    onStart: () => {
      measure();
      // Rattrapage : saisir une feuille qui se referme ANNULE la fermeture.
      // Sans ça, elle suivrait le doigt une seconde puis disparaîtrait quand
      // même — le geste aurait été un mensonge.
      if (closingRef.current && cancelRef.current) cancelRef.current();
    },
    bounds: () => {
      const dist = distRef.current || SHEET_FALLBACK_DIST;
      // Libre vers la sortie, élastique dans l'autre sens : on sent le fond.
      return sign > 0
        ? { min: 0, max: null, dimension: dist * 0.5 }
        : { min: null, max: 0, dimension: dist * 0.5 };
    },
    decide: ({ velocity, projected }) => {
      const dist = distRef.current || SHEET_FALLBACK_DIST;
      const away = sign * velocity;          // > 0 : le doigt part vers la sortie
      const dismiss = Math.abs(velocity) > SHEET_FLING_V
        ? away > 0                            // lancé franc : le SIGNE décide
        : sign * projected > dist * SHEET_DISMISS_FRACTION;  // sinon, l'arrivée projetée
      return {
        to: dismiss ? sign * dist : 0,
        commit: dismiss,
        config: MOTION.spring.sheet,
      };
    },
    onCommit: () => {
      haptic('commit');
      if (onCloseRef.current) onCloseRef.current();
    },
  });

  // Pose la feuille hors écran AVANT le premier paint (pas de flash à la
  // position ouverte), en pixels réels pour que geste et ressort partagent
  // la même unité que le `translate…(100%)` du style initial.
  React.useLayoutEffect(() => {
    if (reduced) return;
    drag.spring.snap(sign * measure());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cible du ressort : ouverte, ou sortie. On ne touche à rien pendant un
  // geste — le doigt est prioritaire sur toute animation.
  React.useEffect(() => {
    if (reduced || drag.dragging) return;
    const dist = measure();
    drag.spring.set(closing ? sign * dist : 0, {
      // L'entrée n'a été lancée par aucun geste : pas de rebond. La sortie
      // hérite de l'élan du doigt quand il y en a eu un.
      config: closing ? MOTION.spring.sheet : MOTION.spring.ui,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing, reduced, drag.dragging]);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // A sheet is only mounted while it's open, so register unconditionally:
  // mount = push a back-trap, unmount = remove it. Covers every sheet
  // (Add / Detail / EditEntry / EditFamily / Settings / EditCategory).
  useBackButton(true, onClose);

  const initialTransform = side === 'bottom' ? 'translate3d(0, 100%, 0)'
    : side === 'left' ? 'translate3d(-100%, 0, 0)' : 'translate3d(100%, 0, 0)';

  return (
    <div role="presentation" onClick={closing ? undefined : onClose} style={{
      position: 'fixed', inset: 0, background: T.scrim,
      zIndex: 100, display: 'flex',
      alignItems: side === 'bottom' ? 'flex-end' : 'stretch',
      justifyContent: side === 'right' ? 'flex-end'
                     : side === 'left' ? 'flex-start' : 'stretch',
      // Le voile est piloté par le ressort (`apply`) — il commence donc
      // transparent et s'installe avec la feuille, à la même frame.
      opacity: reduced ? 1 : 0,
      ...(reduced ? { animation: closing ? `fadeOut ${MOTION.fast}ms ${MOTION.ease} forwards` : undefined } : null),
    }} ref={scrimRef}>
      <SheetDragContext.Provider value={drag}>
        <div role="dialog" aria-modal="true" aria-label={label} ref={sheetRef}
          onClick={e => e.stopPropagation()}
          {...(isSide && dismissible && !reduced ? drag.handlers : null)}
          style={{
            width: isSide ? 'auto' : '100%',
            maxWidth: isSide ? '100%' : 'min(560px, 100%)',
            margin: side === 'bottom' ? '0 auto' : 0,
            height: isSide ? '100%' : 'auto',
            display: 'flex', flexDirection: 'column',
            transform: reduced ? undefined : initialTransform,
            // Le compositeur est prévenu : la feuille va bouger.
            willChange: reduced ? undefined : 'transform',
            // Pendant la sortie, le CONTENU devient inerte (plus de double-tap
            // sur une action déjà lancée) mais la poignée reste vivante :
            // c'est ce qui permet de rattraper la feuille au vol.
            pointerEvents: closing ? 'none' : undefined }}>
          {children}
        </div>
      </SheetDragContext.Provider>
    </div>
  );
}

// Fermeture animée d'une sheet / vue : retourne `[closing, close, cancelClose]`.
// `close()` bascule `closing` (SheetOverlay lance alors le ressort de sortie)
// puis démonte après MOTION.exit. Idempotent (un double-tap pendant la sortie
// ne referme pas deux fois) ; reduced-motion → fermeture immédiate.
// `cancelClose()` DÉSARME une fermeture en cours — c'est lui qui rend la
// feuille rattrapable au doigt (cf. SheetOverlay › onStart).
// `open` ré-arme le hook pour les sheets montées en continu (AddDrinkSheet,
// SettingsDrawer) ; les sheets montées conditionnellement laissent `true`.
function useSheetClose(onClose, open = true) {
  const reduced = useReducedMotion();
  const [closing, setClosing] = React.useState(false);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const reducedRef = React.useRef(reduced);
  reducedRef.current = reduced;
  const armedRef = React.useRef(false);
  const timerRef = React.useRef(0);
  React.useEffect(() => {
    if (open) { armedRef.current = false; setClosing(false); }
  }, [open]);
  React.useEffect(() => () => clearTimeout(timerRef.current), []);
  const close = React.useCallback(() => {
    if (armedRef.current) return;
    armedRef.current = true;
    if (reducedRef.current) {
      if (onCloseRef.current) onCloseRef.current();
      return;
    }
    setClosing(true);
    timerRef.current = setTimeout(() => {
      if (onCloseRef.current) onCloseRef.current();
    }, MOTION.exit);
  }, []);
  const cancelClose = React.useCallback(() => {
    if (!armedRef.current) return;
    clearTimeout(timerRef.current);
    armedRef.current = false;
    setClosing(false);
  }, []);
  return [closing, close, cancelClose];
}

// ── Styled confirmation dialog (replaces native confirm()) ────────
// Usage: open with `Confirm.ask({ title, message, confirmText, danger })`
// → returns a Promise<boolean>. The host component must mount <ConfirmHost/>
// once near the top of the tree.
const Confirm = (() => {
  let setter = null;
  // Track the active dialog's resolver so a second `ask()` invocation
  // — which replaces the dialog state — still resolves the first
  // promise (with `false`) instead of leaving it dangling forever.
  let pendingResolve = null;
  return {
    _bind(fn) { setter = fn; },
    ask(opts) {
      return new Promise(resolve => {
        if (!setter) { resolve(window.confirm(opts.message || '')); return; }
        if (pendingResolve) {
          try { pendingResolve(false); } catch {}
        }
        pendingResolve = resolve;
        const wrapped = (ok) => {
          if (pendingResolve === resolve) pendingResolve = null;
          resolve(ok);
        };
        setter({ ...opts, _resolve: wrapped });
      });
    },
  };
})();

// Ombre du dialogue de confirmation — constante nommée (volontairement
// identique en thème clair/sombre, comme les scrims).
const DIALOG_SHADOW = '0 30px 60px rgba(0,0,0,0.5)';

function ConfirmHost() {
  const [state, setState] = React.useState(null);
  React.useEffect(() => { Confirm._bind(setState); return () => Confirm._bind(null); }, []);
  // All hooks must be called unconditionally on every render —
  // putting `useCallback`/`useEffect` after the `if (!state) return null`
  // early-return below changes the hook count when the dialog opens
  // and triggers React error #310 (rendered fewer hooks than expected),
  // which then bubbles up to AppErrorBoundary.
  const onKey = React.useCallback((e) => {
    if (!state) return;
    // The dialog owns the keyboard while open. Stop propagation so a single
    // Escape/Enter doesn't ALSO reach the SheetOverlay sitting underneath
    // (both listen on `document`): cancelling a delete-confirmation used to
    // close the edit sheet behind it too.
    if (e.key === 'Escape') { e.stopPropagation(); state._resolve(false); setState(null); }
    if (e.key === 'Enter')  { e.stopPropagation(); state._resolve(true);  setState(null); }
  }, [state]);
  React.useEffect(() => {
    if (!state) return;
    // Capture phase: `document` is first in the capture path, so this runs
    // before any sheet's bubble-phase Escape handler regardless of mount
    // order, letting stopPropagation above actually pre-empt it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onKey, state]);
  // Android Back cancels the dialog (same as Escape / backdrop).
  useBackButton(!!state, React.useCallback(() => {
    if (state) { state._resolve(false); setState(null); }
  }, [state]));
  if (!state) return null;
  const close = (ok) => { state._resolve(ok); setState(null); };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="alco-confirm-title"
      onClick={() => close(false)} style={{
      position: 'fixed', inset: 0, background: T.scrim,
      display: 'grid', placeItems: 'center', zIndex: 200,
      animation: 'fade 0.18s ease', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, color: T.ink, borderRadius: 18,
        border: `1px solid ${T.rule}`,
        padding: '22px 22px 18px', maxWidth: 360, width: '100%',
        boxShadow: DIALOG_SHADOW,
        animation: 'scaleIn 0.18s ease' }}>
        <div id="alco-confirm-title" style={{
          ...type(22, { family: fontSerif, italic: true }), marginBottom: 10 }}>{state.title || 'Confirmer'}</div>
        <div style={{
          color: T.ink2, ...type(13.5), marginBottom: 22 }}>{state.message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="alco-press" onClick={() => close(false)} style={{
            flex: 1, padding: '12px', borderRadius: 12,
            background: T.surface2, color: T.ink2,
            border: `1px solid ${T.rule}`, ...type(13),
            fontFamily: fontSans, cursor: 'pointer', touchAction: 'manipulation' }}>{state.cancelText || 'Annuler'}</button>
          <button className="alco-press" autoFocus
            onClick={() => { haptic(state.danger ? 'warning' : 'commit'); close(true); }} style={{
              flex: 1.4, padding: '12px', borderRadius: 12,
              background: state.danger ? T.dangerBtn : T.accent,
              color: state.danger ? T.dangerBtnInk : T.accentInk,
              border: 'none', ...type(13, { weight: 600 }),
              fontFamily: fontSans, cursor: 'pointer', touchAction: 'manipulation',
              boxShadow: `0 4px 18px ${withAlpha(state.danger ? T.dangerBtn : T.accent, state.danger ? 0.5 : 0.4)}` }}>{state.confirmText || 'Confirmer'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Service-worker version probe ─────────────────────────────────
// Reads whatever version the actually-running SW has cached. The
// SW echoes back its CACHE_NAME (`alconote-vX.Y.Z`) over a
// MessageChannel — we extract the `vX.Y.Z` suffix for display. The
// hook re-asks on `controllerchange` so a freshly-activated SW
// surfaces its new version without a manual reload.
//
// Returns `null` until the answer arrives, or if no SW is registered
// (file:// preview, browser without SW support, etc.). The caller is
// expected to render a fallback ("—") in that case.
function useSWVersion() {
  const [version, setVersion] = React.useState(null);
  // Mirror of `version` for the retry timeout. The effect closes
  // around the initial `null`, so reading `version` directly in the
  // setTimeout always sees null; a ref gives us the live value so
  // the retry skips when we already have an answer.
  const versionRef = React.useRef(null);
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    const apply = (raw) => {
      if (cancelled) return;
      // CACHE_NAME shape: "alconote-vX.Y.Z" — pluck the version
      // suffix, fall back to the raw value if the SW ever ships a
      // different format.
      const m = String(raw || '').match(/v[\d.]+/);
      const next = m ? m[0] : (raw || null);
      versionRef.current = next;
      setVersion(next);
    };
    const ask = () => {
      const ctrl = navigator.serviceWorker.controller;
      if (!ctrl) return;
      try {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => apply(e && e.data && e.data.version);
        ctrl.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
      } catch {}
    };
    ask();
    const onChange = () => ask();
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    // Some browsers deliver the controller on a microtask after the
    // page loads; retry once after a short delay if we still don't
    // have an answer.
    const retry = setTimeout(() => {
      if (!versionRef.current) ask();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(retry);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    };
  }, []);
  return version;
}

// ── Inject base animations once ────────────────────────────────────
(function injectBaseStyles() {
  if (document.getElementById('alco-base-anim')) return;
  const s = document.createElement('style');
  s.id = 'alco-base-anim';
  s.textContent = `
    @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
    @keyframes scaleIn { from { transform: scale(.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    /* Entrée par défaut listes & onglets : montée courte + fondu, sans rebond. */
    @keyframes alcoRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
    /* Fondu de sortie. Les feuilles et les pages ne se déplacent PLUS par
       keyframes : leur translation est pilotée par un ressort (§ SheetOverlay,
       FriendStatsView), seul moyen d'être attrapées et inversées en vol. Ce
       fondu ne sert donc plus que du chrome non gestuel (voile, toast) et le
       repli « moins de mouvement ». */
    @keyframes fadeOut { from { opacity: 1 } to { opacity: 0 } }
    /* Toast : montée + fondu (le translateX(-50%) du centrage doit vivre DANS
       les keyframes, sinon l'animation de transform écrase le centrage). */
    @keyframes toastIn { from { transform: translate(-50%, 10px); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } }
    @keyframes toastOut { from { transform: translate(-50%, 0); opacity: 1 } to { transform: translate(-50%, 8px); opacity: 0 } }
    /* Balayage du viseur scanner (rapatrié de modals.jsx : plus aucun @keyframes inline). */
    @keyframes scanSweep { 0%{top:0} 100%{top:100%} }

    /* Entrée des figures (stats-charts) : fondu + légère montée, CSS pur —
       rejouée au (re)montage d'un chart (ouverture de section). Pas
       d'animation de tracé : elle brouillerait les pointillés sémantiques
       (futur/seuils). Durée/easing = MOTION. */
    @keyframes alcoChartIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
    .alco-chart-in { animation: alcoChartIn ${MOTION.base}ms ${MOTION.ease}; }
    @media (prefers-reduced-motion: reduce) {
      .alco-chart-in { animation: none; }
    }

    /* Carte (StatsTab › MapSection). Les couleurs sont pilotées par des
       variables CSS posées sur le conteneur, ce qui permet de rethémer la
       carte sans reconstruire le DOM Leaflet. Le halo blanc et les ombres
       sont du chrome de marqueur conventionnel, pas des couleurs de palette. */
    .alco-pin {
      width: 14px; height: 14px; border-radius: 50%; box-sizing: border-box;
      background: var(--alco-accent, #c98a3a);
      border: 2px solid rgba(255,255,255,0.85);
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    /* Le cercle ET le chiffre sont tracés en SVG dans le divIcon : le
       chiffre, centré via text-anchor:middle + dominant-baseline:central,
       tombe pile au milieu du rond quelles que soient les métriques de la
       police (le précédent <span>+line-height laissait un décalage de ligne
       de base visible). Le halo blanc reste du chrome de marqueur. */
    .alco-cluster {
      border-radius: 50%; box-sizing: border-box;
      box-shadow: 0 2px 8px rgba(0,0,0,0.28);
    }
    .alco-cluster svg { display: block; overflow: visible; }
    .alco-cluster circle {
      fill: var(--alco-accent, #c98a3a);
      stroke: rgba(255,255,255,0.85); stroke-width: 2;
    }
    .alco-cluster text {
      fill: var(--alco-accent-ink, #1a1a1a);
      font-family: "Geist Mono", ui-monospace, monospace; font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .alco-map-ctrl {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; padding: 0; cursor: pointer;
      background: var(--alco-surface, #fff);
      color: var(--alco-ink, #222);
      border: 1px solid var(--alco-rule, #ddd);
      border-radius: 9px; margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      font-family: inherit;
    }
    .alco-map-ctrl:hover { background: var(--alco-surface2, #f0f0f0); }
    .alco-map-ctrl[aria-pressed="true"] {
      background: var(--alco-accent, #c98a3a);
      color: var(--alco-accent-ink, #1a1a1a);
      border-color: var(--alco-accent, #c98a3a);
    }
    /* Roue horaire (WheelPicker) : défilement vertical avec accrochage iOS et
       masque de fondu haut/bas. La barre de défilement est masquée ; le geste
       de scroll reste natif (donc fluide sur Android). */
    .alco-wheel {
      overflow-y: auto; scroll-snap-type: y mandatory;
      -webkit-overflow-scrolling: touch; scrollbar-width: none;
      -webkit-mask-image: linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent);
      mask-image: linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent);
      overscroll-behavior: contain;
    }
    .alco-wheel::-webkit-scrollbar { display: none; }
    .alco-wheel-item { scroll-snap-align: center; }
    @media (prefers-reduced-motion: reduce) { .alco-wheel { scroll-behavior: auto; } }

    /* ── Matières translucides ─────────────────────────────────────
       Le chrome flottant (barre d'onglets, feuilles) est une COUCHE DE
       MATIÈRE sous laquelle le contenu défile, pas une bande opaque qui
       mange l'écran. Les couleurs viennent de \`T\` via les variables CSS
       (applyThemeCssVars) : la feuille de style ne connaît aucune couleur en
       propre, elle est le seul endroit d'où l'on peut répondre aux
       préférences système ci-dessous.
       \`--alco-glass-edge\` en ombre INTERNE haute = l'arête claire d'une
       matière réelle, qui la détache du contenu sans filet de 1px. */
    /* Deux poids de matière, et le choix n'est pas décoratif :
       • « .alco-material » — chrome flottant (barre d'onglets). Fin, très
         translucide : le contenu DOIT rester devinable dessous, c'est ce qui
         dit « la liste continue ».
       • « .alco-material-panel » — panneau parallèle (tiroir Paramètres). Plus
         épais : on garde le fil de ce qu'on faisait derrière, sans le lire.
       Une tâche MODALE (ajouter/éditer une boisson), elle, ne prend PAS de
       matière : elle est opaque et s'accompagne d'un voile qui assombrit le
       reste. On ne remplit pas un formulaire au-dessus d'un texte fantôme —
       le but d'un modal est de concentrer, pas d'exhiber la profondeur. */
    .alco-material, .alco-material-panel {
      background: var(--alco-glass-chrome);
      -webkit-backdrop-filter: blur(${MATERIAL.blur.chrome}px) saturate(${MATERIAL.saturate}%);
      backdrop-filter: blur(${MATERIAL.blur.chrome}px) saturate(${MATERIAL.saturate}%);
    }
    /* Grande surface = matière plus ÉPAISSE : flou plus fort qu'une barre. */
    .alco-material-panel {
      background: var(--alco-glass-panel);
      -webkit-backdrop-filter: blur(${MATERIAL.blur.sheet}px) saturate(${MATERIAL.saturate}%);
      backdrop-filter: blur(${MATERIAL.blur.sheet}px) saturate(${MATERIAL.saturate}%);
    }
    /* Surface d'une feuille modale : opaque, posée sur le voile. */
    .alco-material-sheet { background: var(--alco-glass-solid); }
    .alco-material-edge { box-shadow: inset 0 1px 0 var(--alco-glass-edge); }

    /* Fondu de bord d'une bande défilante (rangée de pilules qui déborde) :
       le contenu s'efface au bord au lieu d'être tranché net — on voit qu'il
       y en a plus, sans filet ni ombre portée. Masque en couleurs-mots
       clés uniquement (aucune couleur littérale : cf. CLAUDE.md › DA). */
    .alco-fade-x {
      -webkit-mask-image: linear-gradient(to right, transparent, black ${MATERIAL.edgeFade / 2}px, black calc(100% - ${MATERIAL.edgeFade}px), transparent);
      mask-image: linear-gradient(to right, transparent, black ${MATERIAL.edgeFade / 2}px, black calc(100% - ${MATERIAL.edgeFade}px), transparent);
    }

    /* Vibrance : au-dessus d'une matière, le texte ne peut pas être un gris
       plat — le fond change sous lui. Encre pleine, graisse un cran
       au-dessus, approche très légèrement ouverte. */
    .alco-vibrant { color: var(--alco-ink); font-weight: 500; }

    /* ── Réponse au toucher ────────────────────────────────────────
       Le retour vit sur l'APPUI (\`:active\` = pointerdown), jamais sur le
       relâchement : attendre le clic donne une interface morte. En CSS et
       non en JS, pour que ça marche aussi dans une liste mappée où l'on ne
       peut pas poser de hook par élément.
       Une grande surface bouge MOINS qu'un petit bouton (à déplacement égal,
       elle paraîtrait sauter) : d'où la variante \`-soft\`. */
    /* Socle universel : TOUT ce qui se tape s'assombrit à l'appui, quelle que
       soit sa taille, sans qu'un composant ait à y penser. Pas de géométrie
       ici — une opacité ne peut jamais « mal tomber », d'une pastille de
       12px à une ligne pleine largeur. Le déplacement, lui, est opt-in via
       les classes ci-dessous, là où il flatte la cible. */
    button:not(:disabled):active,
    [role="button"]:not([aria-disabled="true"]):active,
    [role="tab"]:active, [role="radio"]:active,
    [role="switch"]:active, [role="option"]:active,
    [role="slider"]:active {
      opacity: 0.82;
    }
    button, [role="button"], [role="tab"], [role="radio"],
    [role="switch"], [role="option"], [role="slider"] {
      transition: opacity ${MOTION.fast}ms ${MOTION.ease};
    }
    .alco-press { transition: transform ${MOTION.fast}ms ${MOTION.ease}, opacity ${MOTION.fast}ms ${MOTION.ease}; }
    .alco-press:active { transform: scale(${MOTION.press}); opacity: 0.9; }
    .alco-press-soft { transition: transform ${MOTION.fast}ms ${MOTION.ease}, opacity ${MOTION.fast}ms ${MOTION.ease}; }
    .alco-press-soft:active { transform: scale(0.988); opacity: 0.94; }
    /* Moins de mouvement : le retour reste, mais en opacité seule (aucun
       déplacement, donc rien de vestibulaire). */
    @media (prefers-reduced-motion: reduce) {
      .alco-press, .alco-press-soft { transition: opacity ${MOTION.fast}ms ${MOTION.ease}; }
      .alco-press:active, .alco-press-soft:active { transform: none; opacity: 0.82; }
    }

    /* Repli : sans backdrop-filter (Firefox par défaut, vieux WebKit), une
       couche « translucide » deviendrait une vitre sale illisible. */
    @supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
      .alco-material, .alco-material-panel { background: var(--alco-glass-solid); }
    }

    /* Moins de transparence : matière givrée → opaque, flou coupé. */
    @media (prefers-reduced-transparency: reduce) {
      .alco-material, .alco-material-panel {
        background: var(--alco-glass-solid);
        -webkit-backdrop-filter: none; backdrop-filter: none;
      }
    }
    /* Contraste renforcé : fond quasi opaque ET bordure franche — la
       séparation ne repose plus du tout sur la matière. */
    @media (prefers-contrast: more) {
      .alco-material, .alco-material-panel, .alco-material-sheet {
        background: var(--alco-glass-solid);
        -webkit-backdrop-filter: none; backdrop-filter: none;
        border-color: var(--alco-ink2);
      }
      .alco-material-edge { box-shadow: none; }
    }
  `;
  document.head.appendChild(s);
})();

// ── Zoom verrouillé ────────────────────────────────────────────────
// L'app est une UI native, pas un document : le pinch-zoom et le
// double-tap-zoom de PAGE sont désactivés définitivement. Triple
// ceinture, aucun mécanisme ne couvrant seul tous les moteurs :
//   1. meta viewport `maximum-scale=1, user-scalable=no` (index.html)
//      — Chrome/Android ;
//   2. CSS `touch-action: pan-x pan-y` sur html/body (index.html) — le
//      geste de zoom est refusé au niveau viewport, le pan/scroll reste
//      libre (les touchAction inline des charts restent compatibles) ;
//   3. ici : les events propriétaires `gesture*` (pinch Safari iOS, qui
//      ignore user-scalable), une garde anti double-tap-zoom WebKit et
//      le Ctrl/⌘+molette desktop.
// Le zoom INTERNE de la carte Leaflet n'est pas concerné : il vit dans
// `.leaflet-container` (exclu de la garde double-tap) et son pinch est
// géré par Leaflet en touch events sur son propre conteneur.
(function installZoomGuards() {
  if (typeof window === 'undefined' || window.__alcoZoomGuards) return;
  if (typeof window.addEventListener !== 'function') return; // stubs de test Node
  window.__alcoZoomGuards = true;
  const prevent = (e) => { e.preventDefault(); };
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    window.addEventListener(ev, prevent, { passive: false });
  }
  // Double-tap zoom des WebKit historiques : on neutralise le 2e tap
  // rapproché SAUF sur les cibles interactives (un double-clic rapide sur
  // « Période précédente » ou « + » doit rester deux clics) et la carte.
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    const interactive = e.target && e.target.closest && e.target.closest(
      'button, a, input, select, textarea, [role="button"], [role="tab"], [role="radio"], [contenteditable], .leaflet-container'
    );
    if (now - lastTouchEnd <= 320 && !interactive && e.cancelable) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false, capture: true });
  // Pinch trackpad / Ctrl+molette : zoom de page desktop.
  window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });
})();

// ── Motion : hooks & primitives réutilisables ──────────────────────
// Une seule couche d'animation, consommée partout. Tout respecte
// prefers-reduced-motion et MOTION. Aucun keyframe par composant.

// Préférences système partagées via UN seul listener global par requête :
// une liste peut monter des centaines de lignes, un store unique évite
// autant d'abonnements matchMedia.
//
// Les trois préférences sont INDÉPENDANTES et ne veulent pas dire la même
// chose : « moins d'animation » n'est pas « moins de transparence », qui
// n'est pas « plus de contraste ». On répond aux trois séparément.
function createMediaStore(query) {
  const store = {
    mq: (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia(query) : null,
    subs: new Set(),
  };
  if (store.mq) {
    const notify = () => store.subs.forEach(fn => fn());
    if (store.mq.addEventListener) store.mq.addEventListener('change', notify);
    else if (store.mq.addListener) store.mq.addListener(notify);
  }
  return store;
}

function useMediaPref(store) {
  const [on, setOn] = React.useState(() => !!(store.mq && store.mq.matches));
  React.useEffect(() => {
    const mq = store.mq;
    if (!mq) return;
    const fn = () => setOn(mq.matches);
    store.subs.add(fn);
    fn();
    return () => { store.subs.delete(fn); };
  }, [store]);
  return on;
}

const _reducedMotion = createMediaStore('(prefers-reduced-motion: reduce)');
const _reducedTransparency = createMediaStore('(prefers-reduced-transparency: reduce)');
const _moreContrast = createMediaStore('(prefers-contrast: more)');

// Moins de mouvement ≠ aucun retour : les glissements/ressorts deviennent de
// courts fondus, les dépassements disparaissent, mais les changements
// d'opacité et de couleur qui aident à COMPRENDRE restent.
function useReducedMotion() { return useMediaPref(_reducedMotion); }
// Matières translucides → givrées/opaques (fond plus dense, flou coupé).
function useReducedTransparency() { return useMediaPref(_reducedTransparency); }
// Contraste renforcé → fonds quasi opaques et bordure franche.
function useHighContrast() { return useMediaPref(_moreContrast); }
// Une matière n'est « vitrée » que si l'utilisateur veut bien des deux.
function useGlass() {
  return !useReducedTransparency() && !useHighContrast();
}

// ── Pilote de ressort (écrit le DOM, pas l'état React) ─────────────
// Un ressort à 60 fps ne peut pas passer par setState : re-rendre l'arbre
// d'une feuille à chaque frame la ferait saccader. Le pilote appelle
// `apply(x, v)` à chaque frame, et `apply` écrit une `transform` sur un nœud
// via son ref — propriété compositée, aucun layout.
//
// Ce que ce pilote garantit, et qui fait toute la différence à l'usage :
//   • `set()` repart TOUJOURS de la valeur affichée et de la vitesse
//     courante — retargeter en plein vol ne provoque aucun saut ;
//   • la vitesse est CONSERVÉE d'une cible à l'autre (pas de « mur » au
//     moment où un geste s'inverse) ;
//   • `set(to, { velocity })` accepte la vitesse de relâchement du doigt :
//     l'animation continue exactement à la vitesse du geste, sans couture.
function createSpringDriver(apply, opts = {}) {
  const nowMs = () => (typeof performance !== 'undefined' && performance.now)
    ? performance.now() : Date.now();
  const schedule = (fn) => (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame(fn) : setTimeout(() => fn(nowMs()), 16);
  const unschedule = (h) => {
    if (!h) return;
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(h);
    else clearTimeout(h);
  };

  const state = { x: Number.isFinite(opts.from) ? opts.from : 0, v: 0 };
  let target = state.x;
  let config = opts.config || MOTION.spring.ui;
  let reduced = !!opts.reduced;
  const restOpts = { restDistance: opts.restDistance, restVelocity: opts.restVelocity };
  let onRest = opts.onRest || null;
  let handle = 0;
  let last = 0;

  const emit = () => { if (apply) apply(state.x, state.v); };
  const finish = () => {
    handle = 0;
    const cb = onRest;
    if (cb) cb(target);
  };
  const tick = (t) => {
    handle = 0;
    const now = Number.isFinite(t) ? t : nowMs();
    // Pas de temps borné : revenir au premier plan après une minute en
    // arrière-plan ne doit pas intégrer 60 s d'un coup (l'élément
    // téléporterait). 64 ms ≈ 4 frames — au-delà, on repart calmement.
    const dt = Math.min(0.064, Math.max(0, (now - last) / 1000));
    last = now;
    const next = springStep(state, target, config, dt);
    state.x = next.x; state.v = next.v;
    if (springAtRest(state, target, restOpts)) {
      state.x = target; state.v = 0;
      emit();
      finish();
      return;
    }
    emit();
    handle = schedule(tick);
  };
  const start = () => {
    if (handle) return;
    last = nowMs();
    handle = schedule(tick);
  };

  return {
    // Nouvelle cible. `velocity` remplace la vitesse courante (relâchement
    // d'un geste) ; sans elle, la vitesse en cours est CONSERVÉE — c'est ce
    // qui évite la discontinuité quand un geste s'inverse.
    set(to, o) {
      const opt = o || {};
      target = Number.isFinite(to) ? to : 0;
      if (opt.config) config = opt.config;
      if (Number.isFinite(opt.velocity)) state.v = opt.velocity;
      if (reduced || opt.immediate) {
        unschedule(handle); handle = 0;
        state.x = target; state.v = 0;
        emit();
        if (onRest) onRest(target);
        return;
      }
      if (springAtRest(state, target, restOpts)) {
        unschedule(handle); handle = 0;
        state.x = target; state.v = 0;
        emit();
        if (onRest) onRest(target);
        return;
      }
      start();
    },
    // Pose la valeur sans animer : c'est le chemin du suivi 1:1 pendant un
    // geste (le doigt EST l'animation).
    snap(value, velocity) {
      unschedule(handle); handle = 0;
      state.x = Number.isFinite(value) ? value : 0;
      state.v = Number.isFinite(velocity) ? velocity : 0;
      target = state.x;
      emit();
    },
    stop() {
      unschedule(handle); handle = 0;
      state.v = 0;
      target = state.x;
    },
    value() { return state.x; },
    velocity() { return state.v; },
    target() { return target; },
    animating() { return !!handle; },
    setReduced(v) { reduced = !!v; },
    setConfig(c) { if (c) config = c; },
    setOnRest(fn) { onRest = fn || null; },
  };
}

// Pilote de ressort au cycle de vie d'un composant. `apply` est lu via un
// ref : le pilote est créé UNE fois (l'animation survit aux re-renders) et
// appelle toujours la dernière closure.
function useSpringDriver(apply, opts) {
  const reduced = useReducedMotion();
  const applyRef = React.useRef(apply);
  applyRef.current = apply;
  const ref = React.useRef(null);
  if (!ref.current) {
    ref.current = createSpringDriver(
      (x, v) => { if (applyRef.current) applyRef.current(x, v); },
      { ...(opts || {}), reduced }
    );
  }
  React.useEffect(() => { ref.current.setReduced(reduced); }, [reduced]);
  React.useEffect(() => () => ref.current.stop(), []);
  return ref.current;
}

// ── Geste de traînée sur un axe (1:1 → élan → ressort) ─────────────
// Le socle commun de tout ce qui se tire au doigt : feuille qu'on repousse,
// ligne qu'on balaye. Il implémente, une seule fois et correctement, ce qui
// est faux presque partout :
//   • suivi 1:1 en respectant l'endroit où l'utilisateur a saisi l'objet ;
//   • capture du pointeur pour que le suivi survive à la sortie de la zone ;
//   • hystérésis avant d'engager une direction, puis les gestes concurrents
//     (scroll vertical) sont abandonnés sans ambiguïté ;
//   • bords élastiques au lieu d'un arrêt sec ;
//   • à la RELÂCHE : le point d'arrivée est PROJETÉ depuis la vitesse, et
//     c'est ce point projeté qui décide — pas la position du doigt ;
//   • la vitesse du doigt est passée au ressort : aucune couture entre le
//     geste et l'animation ;
//   • une saisie pendant l'animation l'interrompt et repart de la valeur
//     affichée — on peut rattraper une feuille en train de se fermer.
//
// `apply(value)` est le SEUL point d'écriture du DOM (geste comme ressort),
// donc les deux régimes ne peuvent pas se désynchroniser.
function useAxisDrag({
  axis = 'x', apply, bounds, decide, onStart, onMove, onCommit,
  slop = MOTION.slop, config = MOTION.spring.sheet, enabled = true,
  clickGuard = true,
}) {
  // `useSpringDriver` lit déjà `apply` via un ref : le pilote est créé une
  // fois et appelle toujours la dernière closure.
  const spring = useSpringDriver(apply, { config });
  const cb = React.useRef({});
  cb.current = { bounds, decide, onStart, onMove, onCommit };
  const enabledRef = React.useRef(enabled);
  enabledRef.current = enabled;

  const g = React.useRef(null);          // geste en cours
  const tracker = React.useRef(null);
  if (!tracker.current) tracker.current = createVelocityTracker();
  const movedRef = React.useRef(false);  // un vrai glissement (≠ tap) a eu lieu
  const [dragging, setDragging] = React.useState(false);

  const coord = (e) => (axis === 'y' ? e.clientY : e.clientX);
  const cross = (e) => (axis === 'y' ? e.clientX : e.clientY);

  const onPointerDown = (e) => {
    if (!enabledRef.current) return;
    if (g.current) return;                       // un seul doigt pilote
    // Interruption : on saisit la valeur AFFICHÉE (pas la cible logique) et
    // on coupe le ressort — sinon l'objet saute là où il « aurait dû » être.
    const from = spring.value();
    spring.stop();
    g.current = {
      pointerId: e.pointerId,
      start: coord(e), startCross: cross(e),
      from, lock: null, target: e.currentTarget,
    };
    tracker.current.reset();
    tracker.current.add(from, e.timeStamp);
    movedRef.current = false;
    if (cb.current.onStart) cb.current.onStart({ from });
  };

  const onPointerMove = (e) => {
    const st = g.current;
    if (!st || e.pointerId !== st.pointerId) return;
    const d = coord(e) - st.start;
    const dCross = cross(e) - st.startCross;
    if (!st.lock) {
      // Tous les gestes plausibles restent candidats jusqu'à ce que
      // l'intention soit claire ; on tranche alors franchement.
      if (Math.abs(d) < 6 && Math.abs(dCross) < 6) return;
      st.lock = Math.abs(d) > Math.abs(dCross) ? 'axis' : 'cross';
      if (st.lock === 'axis') {
        try { st.target && st.target.setPointerCapture && st.target.setPointerCapture(e.pointerId); } catch {}
        setDragging(true);
      }
    }
    if (st.lock !== 'axis') return;
    if (Math.abs(d) > slop) movedRef.current = true;
    const b = cb.current.bounds ? (cb.current.bounds() || {}) : {};
    const raw = st.from + d;
    const next = clampRubber(raw, b.min, b.max, b.dimension != null ? b.dimension : 120, b.constant);
    tracker.current.add(next, e.timeStamp);
    spring.snap(next);                           // suivi 1:1, aucune animation
    if (cb.current.onMove) cb.current.onMove(next, { raw, delta: d });
  };

  const release = (e) => {
    const st = g.current;
    if (!st || (e && e.pointerId != null && e.pointerId !== st.pointerId)) return;
    g.current = null;
    setDragging(false);
    try {
      if (st.target && st.target.releasePointerCapture) st.target.releasePointerCapture(st.pointerId);
    } catch {}
    if (st.lock !== 'axis') { tracker.current.reset(); return; }
    const from = spring.value();
    const velocity = tracker.current.velocity();
    tracker.current.reset();
    const projected = from + projectMomentum(velocity);
    const verdict = cb.current.decide
      ? cb.current.decide({ from, velocity, projected })
      : null;
    if (!verdict) return;
    const to = Number.isFinite(verdict.to) ? verdict.to : from;
    if (verdict.commit && cb.current.onCommit) {
      // Le ressort et l'effet du commit partent ensemble : l'action n'attend
      // pas la fin de l'animation (et l'animation n'attend pas l'action).
      cb.current.onCommit({ to, velocity, projected });
    }
    spring.set(to, { velocity, config: verdict.config || config });
  };

  // Un vrai glissement ne doit jamais se terminer en clic sur ce qu'il a
  // survolé. On avale le clic fantôme en phase de CAPTURE, avant qu'il
  // n'atteigne le moindre bouton interne.
  const onClickCapture = (e) => {
    if (!clickGuard || !movedRef.current) return;
    movedRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return {
    dragging,
    spring,
    handlers: {
      onPointerDown, onPointerMove,
      onPointerUp: release, onPointerCancel: release,
      ...(clickGuard ? { onClickCapture } : null),
    },
  };
}

// Entrée de liste en cascade. Fonction pure → à *spreader* dans le
// style racine d'un item mappé (aucune prop de layout : ne casse pas
// les bordures/marges de voisinage). Fill `backwards` : masque l'item
// pendant le délai (pas de flash) puis relâche la transform après l'anim
// (laisse un éventuel scale de tap reprendre la main).
function staggerStyle(index = 0, opts = {}) {
  const { name = 'alcoRise', duration = MOTION.base, step = MOTION.stagger,
          base = 0, max = 12, reduced = false } = opts;
  if (reduced) return null;
  const i = Math.min(Math.max(index, 0), max);     // plafonne la cascade
  return {
    animation: `${name} ${duration}ms ${MOTION.ease}`,
    animationDelay: `${base + i * step}ms`,
    animationFillMode: 'backwards',
  };
}

// Feedback tactile réutilisable : léger scale au pointerdown. Contourne
// l'impossibilité d'exprimer :active en style inline. Expose `pressed`
// + press/release pour composer avec des éléments qui gèrent déjà leurs
// propres pointer events (ex. QuickAddButton), sans les écraser.
function usePressScale(opts = {}) {
  const { scale = MOTION.press } = opts;
  const reduced = useReducedMotion();
  const [pressed, setPressed] = React.useState(false);
  const press = React.useCallback(() => setPressed(true), []);
  const release = React.useCallback(() => setPressed(false), []);
  return {
    pressed, press, release,
    style: reduced ? null : {
      transform: pressed ? `scale(${scale})` : 'scale(1)',
      transition: `transform ${MOTION.fast}ms ${MOTION.ease}`,
    },
    handlers: reduced ? {} : {
      onPointerDown: press,
      onPointerUp: release,
      onPointerCancel: release,
      onPointerLeave: release,
    },
  };
}

// Repli/dépli à hauteur animée via l'astuce grid-template-rows 0fr→1fr
// (aucune mesure JS). Le contenu est démonté une fois le repli terminé
// (perf : un jour d'historique replié ne garde pas ses lignes montées).
// `expanded` est décalé de deux frames à l'ouverture pour que la
// transition 0fr→1fr démarre bien avec le contenu déjà peint.
function Collapse({ open, children, duration = MOTION.base, style }) {
  const reduced = useReducedMotion();
  const [render, setRender] = React.useState(open);
  const [expanded, setExpanded] = React.useState(open);
  React.useEffect(() => {
    // Reduced-motion : pas d'anim, on synchronise l'état et on sort
    // (aucun rAF/timeout laissé en suspens).
    if (reduced) { setRender(open); setExpanded(open); return; }
    if (open) {
      // Monte le contenu, puis bascule en 1fr à la frame SUIVANTE : le
      // double rAF garantit que l'état 0fr (avec contenu) est peint avant
      // la transition, sinon le contenu peut « pop » sans animer.
      setRender(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setExpanded(true));
      });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setExpanded(false);
    const t = setTimeout(() => setRender(false), duration);
    return () => clearTimeout(t);
  }, [open, reduced, duration]);
  if (reduced) return open ? <div style={style}>{children}</div> : null;
  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: expanded ? '1fr' : '0fr',
      transition: `grid-template-rows ${duration}ms ${MOTION.ease}`,
      ...style }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        {render ? children : null}
      </div>
    </div>
  );
}

// ── Form primitives (shared by every add/edit sheet) ──────────────
// Centralised so the add-drink / edit-entry / edit-family / settings
// sheets stop duplicating the same input markup. Anything here MUST stay
// token-only (T.*) and reuse the existing fonts — see CLAUDE.md › DA.

// Base style for text inputs. Was duplicated as `inputS()` in modals.jsx.
function inputBaseStyle() {
  return {
    width: '100%', background: T.surface2, border: `1px solid ${T.rule}`,
    borderRadius: 12, padding: '12px 14px', color: T.ink, ...type(14),
    fontFamily: fontSans, outline: 'none',
    boxSizing: 'border-box',
  };
}

// Labelled field wrapper (uppercase micro-label + control).
function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: remSize(10), letterSpacing: tracking(10, { caps: true }), textTransform: 'uppercase',
        color: T.muted, fontWeight: 500, marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

// Parse a user-typed number accepting BOTH '.' and ',' as the decimal
// separator. Returns a Number, or NaN when empty/unparseable. The single
// source of truth for turning a NumberField string into a value.
function parseDecimal(str) {
  if (str == null) return NaN;
  const s = String(str).trim().replace(',', '.');
  if (s === '') return NaN;
  return parseFloat(s);
}

// Numeric text field that always surfaces the numeric keypad on mobile
// (inputMode) and accepts a comma OR a dot as the decimal separator —
// `type="number"` silently rejects commas in many locales, so we use a
// sanitised `type="text"`. State stays a string; callers parse with
// `parseDecimal` at submit time. Pass `suffix` (e.g. "%") to render the
// bordered container with a trailing unit; otherwise a plain input.
function NumberField({
  value, onChange, placeholder = '—', step, allowDecimal = true,
  style, ariaLabel, suffix, onBlur, min, max,
}) {
  const sanitize = (raw) => {
    const s = String(raw == null ? '' : raw);
    if (!allowDecimal) return s.replace(/[^0-9]/g, '');
    let out = '', sepSeen = false;
    for (const ch of s) {
      if (ch >= '0' && ch <= '9') out += ch;
      else if ((ch === '.' || ch === ',') && !sepSeen) { out += ch; sepSeen = true; }
    }
    return out;
  };
  const inputEl = (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      pattern={allowDecimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
      value={value == null ? '' : value}
      onChange={(e) => onChange(sanitize(e.target.value))}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-valuemin={min} aria-valuemax={max}
      autoComplete="off" enterKeyHint="done"
      style={suffix ? {
        flex: 1, background: 'transparent', border: 'none', outline: 'none',
        color: T.ink, ...type(15), fontFamily: fontSans, minWidth: 0,
      } : { ...inputBaseStyle(), ...(style || {}) }}
    />
  );
  if (!suffix) return inputEl;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
      padding: '10px 14px', ...(style || {}) }}>
      {inputEl}
      <span style={{ color: T.muted, fontSize: remSize(13), letterSpacing: tracking(13) }}>{suffix}</span>
    </div>
  );
}

// ── Roue de sélection façon iOS (WheelPicker / TimeWheelSheet / TimeField)
// Maths pures du défilement (testables) : offset ↔ index, accrochage au
// plus proche, clamp aux bornes.
function wheelOffsetForIndex(i, itemH) { return i * itemH; }
function wheelIndexForOffset(scrollTop, itemH, count) {
  const i = Math.round(scrollTop / Math.max(1, itemH));
  return Math.max(0, Math.min(count - 1, i));
}

// Colonne défilante : items centrés sur une bande de sélection, accrochage
// au relâchement (scroll natif → fluide), tap direct sur un item (chemin
// testable sous jsdom où le scroll réel n'existe pas), clavier (listbox +
// flèches). `value` est la valeur sélectionnée (string), `onChange(value)`.
function WheelPicker({ items, value, onChange, itemHeight = 36, visibleCount = 5, ariaLabel }) {
  const scrollerRef = React.useRef(null);
  const reduced = useReducedMotion();
  const selIdx = Math.max(0, items.indexOf(value));
  const settleRef = React.useRef(0);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  // Place la sélection au centre au montage / quand `value` change de
  // l'extérieur (pas suite à notre propre scroll, déjà aligné).
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = wheelOffsetForIndex(selIdx, itemHeight);
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selIdx, itemHeight]);

  React.useEffect(() => () => clearTimeout(settleRef.current), []);

  const settle = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = wheelIndexForOffset(el.scrollTop, itemHeight, items.length);
    const target = wheelOffsetForIndex(idx, itemHeight);
    if (Math.abs(el.scrollTop - target) > 0.5 && el.scrollTo) {
      el.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    }
    // L'accrochage EST l'évènement causal : la vibration part avec lui, pas
    // avant (l'intention) ni après (l'animation).
    if (items[idx] !== value) { haptic('tick'); onChangeRef.current(items[idx]); }
  };
  const onScroll = () => {
    clearTimeout(settleRef.current);
    settleRef.current = setTimeout(settle, 120);
  };

  const pick = (i) => {
    const el = scrollerRef.current;
    if (el && el.scrollTo) el.scrollTo({ top: wheelOffsetForIndex(i, itemHeight), behavior: reduced ? 'auto' : 'smooth' });
    else if (el) el.scrollTop = wheelOffsetForIndex(i, itemHeight);
    if (items[i] !== value) { haptic('tick'); onChange(items[i]); }
  };

  const pad = ((visibleCount - 1) / 2) * itemHeight;
  const containerH = visibleCount * itemHeight;

  return (
    <div style={{ position: 'relative', height: containerH, width: 70, flex: '0 0 auto' }}>
      {/* Bande de sélection centrale */}
      <div aria-hidden="true" style={{
        position: 'absolute', left: 4, right: 4, top: pad, height: itemHeight,
        borderTop: `1px solid ${T.rule}`, borderBottom: `1px solid ${T.rule}`,
        background: T.surface3, borderRadius: 8, pointerEvents: 'none',
      }} />
      <div ref={scrollerRef} className="alco-wheel" role="listbox" aria-label={ariaLabel}
        onScroll={onScroll} style={{ height: containerH, position: 'relative' }}>
        <div style={{ height: pad }} />
        {items.map((it, i) => (
          <button key={it} type="button" role="option" aria-selected={i === selIdx}
            className="alco-wheel-item" onClick={() => pick(i)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); pick(i - 1); }
              else if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); pick(i + 1); }
            }}
            style={{
              ...ghostButton, display: 'block', width: '100%', height: itemHeight,
              fontFamily: fontNum, fontSize: i === selIdx ? 19 : 15,
              color: i === selIdx ? T.ink : T.muted,
              fontWeight: i === selIdx ? 600 : 400,
              opacity: i === selIdx ? 1 : 0.55, cursor: 'pointer',
              transition: reduced ? undefined : 'font-size 0.12s ease, opacity 0.12s ease' }}>{it}</button>
        ))}
        <div style={{ height: pad }} />
      </div>
    </div>
  );
}

// Bottom-sheet de choix de l'heure : deux roues (heures 00-23 / minutes
// 00-59). `value` = 'HH:MM', `onConfirm('HH:MM')` au OK. Fermeture animée
// via useSheetClose, comme toutes les sheets.
function TimeWheelSheet({ value, onConfirm, onClose }) {
  const [closing, close, cancelClose] = useSheetClose(onClose);
  const pad2 = (n) => String(n).padStart(2, '0');
  const parse = (v) => {
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(v || '');
    if (!m) return { h: 0, m: 0 };
    return {
      h: Math.max(0, Math.min(23, parseInt(m[1], 10) || 0)),
      m: Math.max(0, Math.min(59, parseInt(m[2], 10) || 0)),
    };
  };
  const init = parse(value);
  const [h, setH] = React.useState(init.h);
  const [mm, setMm] = React.useState(init.m);
  const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const mins = React.useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), []);
  const confirm = () => { onConfirm(`${pad2(h)}:${pad2(mm)}`); close(); };

  return (
    <SheetOverlay onClose={close} closing={closing} onCancelClose={cancelClose}
      side="bottom" label="Choisir l'heure">
      <div className="alco-material-sheet alco-material-edge" style={{
        borderRadius: '22px 22px 0 0',
        borderTop: `1px solid ${T.rule}`, borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`, overflow: 'hidden',
        padding: '0 0 18px', boxShadow: T.shadowSheet }}>
        <SheetGrabber>
          <div style={{
            textAlign: 'center', padding: '6px 22px 12px',
            ...type(20, { family: fontSerif, italic: true }), color: T.ink }}>Heure</div>
        </SheetGrabber>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '0 22px' }}>
          <WheelPicker items={hours} value={pad2(h)} onChange={(v) => setH(parseInt(v, 10))} ariaLabel="Heures" />
          <div style={{ fontFamily: fontNum, fontSize: remSize(24), letterSpacing: tracking(24), color: T.muted }}>:</div>
          <WheelPicker items={mins} value={pad2(mm)} onChange={(v) => setMm(parseInt(v, 10))} ariaLabel="Minutes" />
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '14px 22px 0' }}>
          <button type="button" className="alco-press" onClick={close} style={{
            flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer',
            background: T.surface2, border: `1px solid ${T.rule}`, color: T.ink,
            fontFamily: 'inherit', ...TYPE.body, touchAction: 'manipulation' }}>Annuler</button>
          <button type="button" className="alco-press"
            onClick={() => { haptic('commit'); confirm(); }} style={{
              flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer',
              background: T.accent, border: 'none', color: T.accentInk,
              fontFamily: 'inherit', ...type(14, { weight: 600 }),
              touchAction: 'manipulation' }}>OK</button>
        </div>
      </div>
    </SheetOverlay>
  );
}

// Champ « Heure » : bouton stylé comme un input (inputBaseStyle) qui ouvre
// la roue. `value` = 'HH:MM', `onChange('HH:MM')`. Remplace l'<input
// type="time"> natif (peu fluide sur Android) tout en gardant le même état.
function TimeField({ value, onChange, ariaLabel = 'Heure' }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" className="alco-press-soft" aria-label={ariaLabel}
        onClick={() => setOpen(true)} style={{
          ...inputBaseStyle(), padding: '10px 12px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          touchAction: 'manipulation' }}>
        <span style={{ ...type(15), ...TYPE.num, color: value ? T.ink : T.muted }}>{value || '--:--'}</span>
        <SvgIcon icon={Ic.clock} size={15} color={T.muted} />
      </button>
      {open && (
        <TimeWheelSheet value={value}
          onConfirm={(v) => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Category picker rendered as a wrap of selectable chips. Replaces the
// markup duplicated across AddDrink / EditEntry / EditFamily / the move
// action. Uses real <button role="radio"> for keyboard accessibility.
function CategoryChips({ categories, value, onChange, ariaLabel = 'Catégorie' }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel}
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {(categories || []).map(c => {
        const on = canonicalCat(value) === canonicalCat(c.name);
        return (
          <button key={c.id || c.name} type="button" role="radio" aria-checked={on}
            className="alco-press"
            onClick={() => { if (!on) haptic('select'); onChange(c.name); }} style={{
              padding: '8px 12px', borderRadius: 10, ...type(12),
              border: `1px solid ${on ? T.accent : T.rule}`,
              background: on ? T.accentSoft : 'transparent',
              color: on ? T.accent : T.ink2,
              cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>{c.name}</button>
        );
      })}
    </div>
  );
}

// Segmented unit toggle (cL / L / EcoCup …).
function UnitToggle({ value, onChange, units = ['cL', 'L', 'EcoCup'] }) {
  return (
    <div role="radiogroup" aria-label="Unité" style={{
      display: 'flex', gap: 4, padding: 3,
      background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}` }}>
      {units.map(u => {
        const on = value === u;
        return (
          <button key={u} type="button" role="radio" aria-checked={on}
            className="alco-press"
            onClick={() => { if (!on) haptic('select'); onChange(u); }} style={{
              flex: 1, padding: '8px 0', borderRadius: 7, textAlign: 'center',
              cursor: 'pointer', ...type(11.5, { weight: on ? 600 : 400 }),
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.ink2,
              minWidth: 0, touchAction: 'manipulation',
              border: 'none', fontFamily: 'inherit' }}>{u}</button>
        );
      })}
    </div>
  );
}

// Rating field: interactive stars + an "Effacer" affordance when set.
function RatingField({ value, onChange, size = 18 }) {
  return (
    <div style={{
      background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
      padding: '10px 14px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between' }}>
      <Stars n={value} interactive size={size} onChange={onChange} />
      {value > 0 && (
        <button type="button" className="alco-press" onClick={() => onChange(0)} style={{
          ...ghostButton, color: T.muted, ...type(11), cursor: 'pointer',
          padding: 4, margin: -4, touchAction: 'manipulation' }}>Effacer</button>
      )}
    </div>
  );
}

// Champ « Lieu » : capture / affiche / retire la position d'une boisson.
// Réutilisé par AddDrinkSheet et EditEntrySheet — c'est ce qui rend la
// géolocalisation éditable depuis l'Historique. La capture vit dans data.jsx
// (`captureLocationForDrink`, global au runtime). `value` = objet location
// | null ; `onChange` reçoit le nouvel objet, ou null si le lieu est retiré.
function LocationField({ value, onChange, ariaLabel = 'Lieu' }) {
  const [busy, setBusy] = React.useState(false);
  const label = value && (value.label || value.name || value.address);
  const acc = value && Number.isFinite(value.accuracy) ? Math.round(value.accuracy) : null;

  const locate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const loc = await captureLocationForDrink();
      if (loc) onChange(loc);
      else Toast.show('Position indisponible');
    } catch {
      Toast.show('Position indisponible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div aria-label={ariaLabel} style={{
      background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: value ? T.accent : T.muted, display: 'flex', flexShrink: 0 }}>
        <SvgIcon icon={Ic.pin} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: remSize(13), letterSpacing: tracking(13), color: value ? T.ink : T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {busy ? 'Localisation…' : (label || (value ? 'Position enregistrée' : 'Non localisé'))}
        </div>
        {acc != null && !busy && (
          <div style={{ fontFamily: fontNum, fontSize: remSize(10.5), letterSpacing: tracking(10.5), color: T.muted, marginTop: 2 }}>
            ±{acc} m
          </div>
        )}
      </div>
      {value && !busy && (
        <button type="button" className="alco-press" onClick={() => onChange(null)}
          aria-label="Retirer le lieu" style={{
            ...ghostButton, color: T.muted, cursor: 'pointer', display: 'flex', padding: 4,
            touchAction: 'manipulation' }}>
          <SvgIcon icon={Ic.close} size={14} />
        </button>
      )}
      <button type="button" className="alco-press" onClick={locate} disabled={busy}
        aria-label={value ? 'Mettre à jour le lieu' : 'Localiser'} style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '8px 12px', borderRadius: 9, cursor: busy ? 'wait' : 'pointer',
          background: T.accentSoft, color: T.accent,
          border: `1px solid ${T.accentSoftBorder}`,
          ...type(12, { weight: 500 }), fontFamily: 'inherit',
          touchAction: 'manipulation',
          animation: busy ? 'pulse 1s ease-in-out infinite' : 'none' }}>
        <SvgIcon icon={Ic.crosshair} size={14} />
        {value ? 'Réessayer' : 'Localiser'}
      </button>
    </div>
  );
}

// Pastille d'alcoolémie réutilisable (header de l'app + lignes de l'onglet
// Amis). `bac` en mg/L ; `null` → non communiqué ("—" grisé). `tone='accent'`
// (ambre, défaut) pour ma pastille / les lignes ; `tone='good'` (vert) pour la
// pastille de l'ami favori. `compact` : variante dense (≈16px de haut, sans
// maxWidth pour permettre le `stretch`) utilisée quand deux pastilles doivent
// tenir dans le slot fixe de 38px du header (cf. HeaderBacStack). Pas de
// seuils colorés ici : la teinte vient uniquement du `tone`.
function BacPill({ bac, ariaLabel, tone = 'accent', compact = false }) {
  const known = bac != null && Number.isFinite(bac);
  const active = known && bac > 0;
  const isGood = tone === 'good';
  const bgSoft = isGood ? T.goodSoft : T.accentSoft;
  const brdSoft = isGood ? T.goodSoftBorder : T.accentSoftBorder;
  const fg = isGood ? T.good : T.accent;
  return (
    <div aria-label={ariaLabel || "Taux d'alcoolémie"}
      title={known ? `${bac} mg/L` : 'Non communiqué'} style={{
        display: 'flex', alignItems: 'center', gap: compact ? 4 : 5,
        padding: compact ? '2px 8px 2px 6px' : '6px 10px 6px 8px',
        borderRadius: compact ? 8 : 12,
        background: bgSoft, border: `1px solid ${brdSoft}`,
        minWidth: 48, maxWidth: compact ? undefined : 86, justifyContent: 'center',
        opacity: known ? (active ? 1 : 0.7) : 0.45,
        transition: 'padding 0.18s ease, border-radius 0.18s ease' }}>
      <div style={{
        width: compact ? 5 : 6, height: compact ? 5 : 6, borderRadius: 99, background: fg,
        boxShadow: active ? `0 0 8px ${fg}` : 'none', flexShrink: 0,
      }} />
      <span style={{
        color: fg, fontSize: compact ? 10 : 11, fontWeight: 600,
        ...(compact ? { lineHeight: 1 } : null),
        ...TYPE.num,
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto' }}>{known ? bac : '—'}</span>
    </div>
  );
}

Object.assign(window, {
  T, THEMES, applyTheme, useTheme, applyThemeCssVars,
  fontSans, fontSerif, fontNum,
  MATERIAL, TYPE, type, tracking, leading, remSize,
  useReducedTransparency, useHighContrast, useGlass,
  springStep, springAtRest, projectMomentum, rubberband, clampRubber,
  nearestSnapPoint, createVelocityTracker,
  createSpringDriver, useSpringDriver, useAxisDrag,
  HAPTICS, haptic, hapticsEnabled, setHapticsEnabled,
  SheetGrabber, SheetDragContext,
  BacPill,
  Ic, SvgIcon, CAT, catColor, catBg, withAlpha, CategoryIconsContext,
  CategoryColorsContext, defaultCatHue, applyCatHueOverrides, useCatPalette,
  Toast,
  FR_DAYS_LONG, FR_DAYS_SHORT, FR_MONTHS_SHORT, FR_MONTHS_LONG, FR_MONTHS_DOTTED,
  fmtDateMedium, fmtDayHeader, localDate, localTime,
  toCl, ETHANOL_DENSITY_G_PER_ML, ethanolGrams, drinkAlcoholGrams, fmtPrice,
  SearchInput, SectionHead, Pill, Stars, CategoryGlyph, GLYPH_OPTIONS, canonicalCat,
  SheetOverlay, useSheetClose,
  useBackButton,
  Confirm, ConfirmHost,
  clickable, ghostButton, QuickAddButton,
  MOTION, useReducedMotion, staggerStyle, usePressScale, Collapse,
  useSWVersion,
  inputBaseStyle, inputS: inputBaseStyle, FieldGroup, parseDecimal,
  NumberField, CategoryChips, UnitToggle, RatingField, LocationField,
  wheelOffsetForIndex, wheelIndexForOffset, WheelPicker, TimeWheelSheet, TimeField,
});

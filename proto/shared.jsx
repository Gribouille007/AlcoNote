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
    isDark:   true,
  },
  light: {
    bg:       'oklch(98% 0.006 85)',
    surface:  'oklch(100% 0 0)',
    surface2: 'oklch(96% 0.006 85)',
    surface3: 'oklch(93% 0.008 80)',
    ink:      'oklch(22% 0.012 55)',
    ink2:     'oklch(38% 0.01 60)',
    muted:    'oklch(55% 0.008 65)',
    rule:     'oklch(90% 0.008 80)',
    accent:   'oklch(60% 0.15 50)',
    accent2:  'oklch(55% 0.18 30)',
    good:     'oklch(55% 0.12 155)',
    shadow:   '0 20px 60px rgba(60,40,20,0.12)',
    accentSoft: 'oklch(95% 0.04 65)',
    accentSoftBorder: 'oklch(85% 0.08 65)',
    accentInk: 'oklch(100% 0 0)',
    accentRing: 'oklch(60% 0.15 50)',
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
})();

const fontSans = '"Geist", ui-sans-serif, system-ui, sans-serif';
const fontSerif = '"Instrument Serif", "Times New Roman", serif';
const fontNum = '"Geist Mono", ui-monospace, monospace';

// ── Motion : source unique de vérité des durées/easing ─────────────
// Aucun composant ne code une durée en dur : tout passe par MOTION
// (cf. CLAUDE.md › DA). Registre sobre, sans rebond.
const MOTION = Object.freeze({
  fast: 180, base: 220,
  stagger: 38,                          // ms entre deux items d'une liste
  ease: 'cubic-bezier(.2,.6,.2,1)',     // calme, sans overshoot
  press: 0.97,                          // scale au tap
});

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
};

function SvgIcon({ icon, size = 18, color, ariaHidden = true }) {
  return (
    <span aria-hidden={ariaHidden ? 'true' : undefined} style={{
      display: 'inline-flex', width: size, height: size,
      color: color || 'currentColor',
    }}>
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
  if (!CAT[name]) {
    CAT[name] = {
      hue: _hashHue(name), c: 0.12,
      light_l: 52, dark_l: 70, bg_l: 30,
    };
  }
  return CAT[name];
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

// ── Search input ──────────────────────────────────────────────────
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.surface2, borderRadius: 14, padding: '12px 14px',
      border: `1px solid ${T.rule}`,
    }}>
      <span style={{ color: T.muted, display: 'flex' }}>
        <SvgIcon icon={Ic.search} size={16} />
      </span>
      <input
        value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: T.ink, fontFamily: fontSans, fontSize: 14, letterSpacing: -0.1,
          minWidth: 0,
        }}
      />
      {value && (
        <span onClick={() => onChange('')} style={{
          color: T.muted, display: 'flex', cursor: 'pointer',
        }}>
          <SvgIcon icon={Ic.close} size={14} />
        </span>
      )}
    </div>
  );
}

// ── Section head ──────────────────────────────────────────────────
function SectionHead({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: T.muted, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
      fontWeight: 500, padding: '6px 2px',
    }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

// ── Pill ──────────────────────────────────────────────────────────
function Pill({ active, onClick, children, color }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active ? 'true' : 'false'}
      style={{
        padding: '8px 12px', borderRadius: 99, cursor: 'pointer',
        background: active ? T.ink : 'transparent',
        color: active ? T.bg : T.ink2,
        border: active ? `1px solid ${T.ink}` : `1px solid ${T.rule}`,
        fontSize: 12, fontWeight: active ? 500 : 400, letterSpacing: -0.1,
        whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
        flexShrink: 0, fontFamily: 'inherit',
      }}>
      {color && !active && <span style={{ color, fontSize: 10 }}>●</span>}
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
            touchAction: 'manipulation',
          }}>
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

// Canonical category key: trim + NFC-normalize so icon overrides survive
// stray whitespace and accent-normalization differences (a drink saved as
// "Bière " resolves to the same key as the "Bière" category row).
function canonicalCat(name) {
  return String(name == null ? '' : name).trim().normalize('NFC');
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
        if (s && !s.moved) onAdd && onAdd();
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
function SheetOverlay({ children, onClose, side = 'bottom' }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // A sheet is only mounted while it's open, so register unconditionally:
  // mount = push a back-trap, unmount = remove it. Covers every sheet
  // (Add / Detail / EditEntry / EditFamily / Settings / EditCategory).
  useBackButton(true, onClose);
  const isSide = side === 'left' || side === 'right';
  return (
    <div role="presentation" onClick={onClose} style={{
      position: 'fixed', inset: 0, background: T.scrim,
      zIndex: 100, display: 'flex',
      alignItems: side === 'bottom' ? 'flex-end' : 'stretch',
      justifyContent: side === 'right' ? 'flex-end'
                     : side === 'left' ? 'flex-start' : 'stretch',
      animation: 'fade 0.2s ease',
    }}>
      <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{
        width: isSide ? 'auto' : '100%',
        maxWidth: isSide ? '100%' : 'min(560px, 100%)',
        margin: side === 'bottom' ? '0 auto' : 0,
        height: isSide ? '100%' : 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  );
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
      animation: 'fade 0.18s ease', padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: T.bg, color: T.ink, borderRadius: 18,
        border: `1px solid ${T.rule}`,
        padding: '22px 22px 18px', maxWidth: 360, width: '100%',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
        animation: 'scaleIn 0.18s ease',
      }}>
        <div id="alco-confirm-title" style={{
          fontFamily: fontSerif, fontSize: 22, fontStyle: 'italic',
          letterSpacing: -0.3, marginBottom: 10,
        }}>{state.title || 'Confirmer'}</div>
        <div style={{
          color: T.ink2, fontSize: 13.5, lineHeight: 1.45,
          letterSpacing: -0.05, marginBottom: 22,
        }}>{state.message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => close(false)} style={{
            flex: 1, padding: '12px', borderRadius: 12,
            background: T.surface2, color: T.ink2,
            border: `1px solid ${T.rule}`, fontSize: 13,
            fontFamily: fontSans, cursor: 'pointer',
          }}>{state.cancelText || 'Annuler'}</button>
          <button onClick={() => close(true)} autoFocus style={{
            flex: 1.4, padding: '12px', borderRadius: 12,
            background: state.danger ? T.dangerBtn : T.accent,
            color: state.danger ? T.dangerBtnInk : T.accentInk,
            border: 'none', fontSize: 13, fontWeight: 600,
            fontFamily: fontSans, cursor: 'pointer', letterSpacing: 0.1,
            boxShadow: `0 4px 18px ${withAlpha(state.danger ? T.dangerBtn : T.accent, state.danger ? 0.5 : 0.4)}`,
          }}>{state.confirmText || 'Confirmer'}</button>
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
    @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    @keyframes slideRight { from { transform: translateX(-16px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
    @keyframes slideLeft { from { transform: translateX(16px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
    @keyframes scaleIn { from { transform: scale(.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    /* Entrée par défaut listes & onglets : montée courte + fondu, sans rebond. */
    @keyframes alcoRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
    /* Balayage du viseur scanner (rapatrié de modals.jsx : plus aucun @keyframes inline). */
    @keyframes scanSweep { 0%{top:0} 100%{top:100%} }

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
  `;
  document.head.appendChild(s);
})();

// ── Motion : hooks & primitives réutilisables ──────────────────────
// Une seule couche d'animation, consommée partout. Tout respecte
// prefers-reduced-motion et MOTION. Aucun keyframe par composant.

// prefers-reduced-motion partagé via UN seul listener global : une
// liste peut monter des centaines de lignes, un store unique évite
// autant d'abonnements matchMedia.
const _reducedMotion = {
  mq: (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null,
  subs: new Set(),
};
if (_reducedMotion.mq) {
  const notify = () => _reducedMotion.subs.forEach(fn => fn());
  if (_reducedMotion.mq.addEventListener) _reducedMotion.mq.addEventListener('change', notify);
  else if (_reducedMotion.mq.addListener) _reducedMotion.mq.addListener(notify);
}
function useReducedMotion() {
  const [reduced, setReduced] = React.useState(() => !!(_reducedMotion.mq && _reducedMotion.mq.matches));
  React.useEffect(() => {
    const mq = _reducedMotion.mq;
    if (!mq) return;
    const fn = () => setReduced(mq.matches);
    _reducedMotion.subs.add(fn);
    fn();
    return () => { _reducedMotion.subs.delete(fn); };
  }, []);
  return reduced;
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
      ...style,
    }}>
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
    borderRadius: 12, padding: '12px 14px', color: T.ink, fontSize: 14,
    fontFamily: fontSans, outline: 'none', letterSpacing: -0.1,
    boxSizing: 'border-box',
  };
}

// Labelled field wrapper (uppercase micro-label + control).
function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
        color: T.muted, fontWeight: 500, marginBottom: 7,
      }}>{label}</div>
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
        color: T.ink, fontSize: 15, fontFamily: fontSans, minWidth: 0,
      } : { ...inputBaseStyle(), ...(style || {}) }}
    />
  );
  if (!suffix) return inputEl;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
      padding: '10px 14px', ...(style || {}),
    }}>
      {inputEl}
      <span style={{ color: T.muted, fontSize: 13 }}>{suffix}</span>
    </div>
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
        const on = value === c.name;
        return (
          <button key={c.id || c.name} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(c.name)} style={{
              padding: '8px 12px', borderRadius: 10, fontSize: 12,
              border: `1px solid ${on ? T.accent : T.rule}`,
              background: on ? T.accentSoft : 'transparent',
              color: on ? T.accent : T.ink2,
              cursor: 'pointer', letterSpacing: -0.1, fontFamily: 'inherit',
            }}>{c.name}</button>
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
      background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}`,
    }}>
      {units.map(u => {
        const on = value === u;
        return (
          <button key={u} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(u)} style={{
              flex: 1, padding: '8px 0', borderRadius: 7, textAlign: 'center',
              fontSize: 11.5, cursor: 'pointer', letterSpacing: -0.1,
              background: on ? T.ink : 'transparent',
              color: on ? T.bg : T.ink2,
              fontWeight: on ? 600 : 400, minWidth: 0,
              border: 'none', fontFamily: 'inherit',
            }}>{u}</button>
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
      justifyContent: 'space-between',
    }}>
      <Stars n={value} interactive size={size} onChange={onChange} />
      {value > 0 && (
        <button type="button" onClick={() => onChange(0)} style={{
          ...ghostButton, color: T.muted, fontSize: 11, cursor: 'pointer',
        }}>Effacer</button>
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
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: value ? T.accent : T.muted, display: 'flex', flexShrink: 0 }}>
        <SvgIcon icon={Ic.pin} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: value ? T.ink : T.muted, letterSpacing: -0.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {busy ? 'Localisation…' : (label || (value ? 'Position enregistrée' : 'Non localisé'))}
        </div>
        {acc != null && !busy && (
          <div style={{ fontFamily: fontNum, fontSize: 10.5, color: T.muted, marginTop: 2 }}>
            ±{acc} m
          </div>
        )}
      </div>
      {value && !busy && (
        <button type="button" onClick={() => onChange(null)} aria-label="Retirer le lieu" style={{
          ...ghostButton, color: T.muted, cursor: 'pointer', display: 'flex', padding: 4,
        }}>
          <SvgIcon icon={Ic.close} size={14} />
        </button>
      )}
      <button type="button" onClick={locate} disabled={busy}
        aria-label={value ? 'Mettre à jour le lieu' : 'Localiser'} style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '8px 12px', borderRadius: 9, cursor: busy ? 'wait' : 'pointer',
          background: T.accentSoft, color: T.accent,
          border: `1px solid ${T.accentSoftBorder}`,
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          animation: busy ? 'pulse 1s ease-in-out infinite' : 'none',
        }}>
        <SvgIcon icon={Ic.crosshair} size={14} />
        {value ? 'Réessayer' : 'Localiser'}
      </button>
    </div>
  );
}

// Pastille d'alcoolémie réutilisable (header de l'app + lignes de l'onglet
// Amis). `bac` en mg/L ; `null` → non communiqué ("—" grisé). Couleur unique
// T.accent (pas de seuils colorés ici, comme le header d'origine).
function BacPill({ bac, ariaLabel }) {
  const known = bac != null && Number.isFinite(bac);
  const active = known && bac > 0;
  return (
    <div aria-label={ariaLabel || "Taux d'alcoolémie"}
      title={known ? `${bac} mg/L` : 'Non communiqué'} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 10px 6px 8px', borderRadius: 12,
        background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
        minWidth: 48, maxWidth: 86, justifyContent: 'center',
        opacity: known ? (active ? 1 : 0.7) : 0.45,
      }}>
      <div style={{
        width: 6, height: 6, borderRadius: 99, background: T.accent,
        boxShadow: active ? `0 0 8px ${T.accent}` : 'none', flexShrink: 0,
      }} />
      <span style={{
        color: T.accent, fontSize: 11, fontWeight: 600,
        fontFamily: fontNum, letterSpacing: 0, fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto',
      }}>{known ? bac : '—'}</span>
    </div>
  );
}

Object.assign(window, {
  T, THEMES, applyTheme, useTheme,
  fontSans, fontSerif, fontNum,
  BacPill,
  Ic, SvgIcon, CAT, catColor, catBg, withAlpha, CategoryIconsContext,
  Toast,
  FR_DAYS_LONG, FR_DAYS_SHORT, FR_MONTHS_SHORT, FR_MONTHS_LONG, FR_MONTHS_DOTTED,
  fmtDateMedium, fmtDayHeader, localDate, localTime,
  toCl, ETHANOL_DENSITY_G_PER_ML, ethanolGrams, drinkAlcoholGrams,
  SearchInput, SectionHead, Pill, Stars, CategoryGlyph, GLYPH_OPTIONS, canonicalCat,
  SheetOverlay,
  useBackButton,
  Confirm, ConfirmHost,
  clickable, ghostButton, QuickAddButton,
  MOTION, useReducedMotion, staggerStyle, usePressScale, Collapse,
  useSWVersion,
  inputBaseStyle, inputS: inputBaseStyle, FieldGroup, parseDecimal,
  NumberField, CategoryChips, UnitToggle, RatingField, LocationField,
});

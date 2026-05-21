/* AUTO-GENERATED from proto/shared.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// shared.jsx — tokens, icons, shared primitives
// Two themes: warm dark (espresso/ivory) and warm light (cream/ink).
// T is a mutable global; call setTheme(name) then notify themeListeners to re-render.

const THEMES = {
  dark: {
    bg: 'oklch(16% 0.008 50)',
    surface: 'oklch(20% 0.01 55)',
    surface2: 'oklch(24% 0.012 55)',
    surface3: 'oklch(28% 0.014 55)',
    ink: 'oklch(96% 0.008 85)',
    ink2: 'oklch(78% 0.008 80)',
    muted: 'oklch(55% 0.008 70)',
    rule: 'oklch(30% 0.01 55)',
    accent: 'oklch(72% 0.15 65)',
    accent2: 'oklch(68% 0.14 30)',
    good: 'oklch(72% 0.10 155)',
    shadow: '0 60px 120px rgba(0,0,0,0.5)',
    accentSoft: 'oklch(30% 0.04 65)',
    accentSoftBorder: 'oklch(38% 0.05 65)',
    accentRing: 'oklch(80% 0.12 65)',
    scrim: 'rgba(0,0,0,0.65)',
    dangerBg: 'oklch(45% 0.18 25)',
    dangerBtn: 'oklch(55% 0.20 25)',
    deltaPos: 'oklch(78% 0.16 155)',
    deltaNeg: 'oklch(74% 0.20 30)',
    deltaPosBg: 'oklch(28% 0.05 155)',
    deltaNegBg: 'oklch(28% 0.06 30)',
    isDark: true
  },
  light: {
    bg: 'oklch(98% 0.006 85)',
    surface: 'oklch(100% 0 0)',
    surface2: 'oklch(96% 0.006 85)',
    surface3: 'oklch(93% 0.008 80)',
    ink: 'oklch(22% 0.012 55)',
    ink2: 'oklch(38% 0.01 60)',
    muted: 'oklch(55% 0.008 65)',
    rule: 'oklch(90% 0.008 80)',
    accent: 'oklch(60% 0.15 50)',
    accent2: 'oklch(55% 0.18 30)',
    good: 'oklch(55% 0.12 155)',
    shadow: '0 20px 60px rgba(60,40,20,0.12)',
    accentSoft: 'oklch(95% 0.04 65)',
    accentSoftBorder: 'oklch(85% 0.08 65)',
    accentRing: 'oklch(60% 0.15 50)',
    scrim: 'rgba(40,30,20,0.35)',
    dangerBg: 'oklch(45% 0.18 25)',
    dangerBtn: 'oklch(55% 0.20 25)',
    deltaPos: 'oklch(42% 0.14 155)',
    deltaNeg: 'oklch(48% 0.20 30)',
    deltaPosBg: 'oklch(95% 0.04 155)',
    deltaNegBg: 'oklch(95% 0.04 30)',
    isDark: false
  }
};
const T = {
  ...THEMES.dark
};
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
  try {
    localStorage.setItem('alconote.theme', name);
  } catch {}
  // Persist to dbManager too so legacy code stays in sync
  try {
    window.dbManager && window.dbManager.setSetting && window.dbManager.setSetting('theme', name);
  } catch {}
  document.documentElement.setAttribute('data-theme', name);
  document.body.className = `theme-${name}`;
  window.__themeListeners.forEach(f => f());
}
(function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem('alconote.theme');
  } catch {}
  if (!saved) {
    // auto -> follows system
    saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  if (THEMES[saved]) setTheme(saved);
  document.documentElement.setAttribute('data-theme', T._name);
  document.body.className = `theme-${T._name}`;
})();
const fontSans = '"Geist", ui-sans-serif, system-ui, sans-serif';
const fontSerif = '"Instrument Serif", "Times New Roman", serif';
const fontNum = '"Geist Mono", ui-monospace, monospace';

// ── Icons ──────────────────────────────────────────────────────────
const Ic = {
  menu: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "7",
    x2: "20",
    y2: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "13",
    x2: "20",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "19",
    x2: "14",
    y2: "19"
  })),
  search: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.5",
    y2: "16.5"
  })),
  close: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  })),
  plus: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })),
  scan: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 8V5a1 1 0 0 1 1-1h3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 4h3a1 1 0 0 1 1 1v3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 16v3a1 1 0 0 1-1 1h-3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 20H5a1 1 0 0 1-1-1v-3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "8",
    x2: "7",
    y2: "16"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "10",
    y1: "8",
    x2: "10",
    y2: "16"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "13",
    y1: "8",
    x2: "13",
    y2: "16"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "17",
    y1: "8",
    x2: "17",
    y2: "16"
  })),
  chev: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })),
  chevL: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  chevR: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })),
  back: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "19",
    y1: "12",
    x2: "5",
    y2: "12"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 19 5 12 12 5"
  })),
  trash: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
  })),
  pin: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "3"
  })),
  star: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
  })),
  filter: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
  })),
  cal: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "2",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "2",
    x2: "8",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "10",
    x2: "21",
    y2: "10"
  })),
  clock: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 7 12 12 15 14"
  })),
  edit: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 20h9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
  })),
  check: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  })),
  download: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 10 12 15 17 10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3"
  })),
  upload: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 8 12 3 7 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "3",
    x2: "12",
    y2: "15"
  })),
  car: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6.5",
    cy: "16.5",
    r: "2.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16.5",
    cy: "16.5",
    r: "2.5"
  })),
  sun: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
  })),
  moon: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })),
  auto: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 12a9 9 0 0 0 0-9"
  })),
  home: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "9 22 9 12 15 12 15 22"
  })),
  map: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polygon", {
    points: "3 6 9 4 15 6 21 4 21 18 15 20 9 18 3 20 3 6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "4",
    x2: "9",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15",
    y1: "6",
    x2: "15",
    y2: "20"
  })),
  flame: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
  })),
  hourglass: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 2h12v3a6 6 0 0 1-3.5 5.45L13 11l1.5.55A6 6 0 0 1 18 17v3H6v-3a6 6 0 0 1 3.5-5.45L11 11l-1.5-.55A6 6 0 0 1 6 5V2z"
  })),
  refresh: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "3 4 3 10 9 10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3.51 15a9 9 0 1 0 2.13-9.36L3 10"
  })),
  grid: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "7",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "7",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "14",
    width: "7",
    height: "7",
    rx: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "14",
    width: "7",
    height: "7",
    rx: "1.5"
  })),
  clockArrow: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 12a9 9 0 1 0 3-6.7"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3 4 3 10 9 10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 7 12 12 15 14"
  })),
  bars: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "20",
    x2: "18",
    y2: "10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "20",
    x2: "12",
    y2: "4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "20",
    x2: "6",
    y2: "14"
  }))
};
function SvgIcon({
  icon,
  size = 18,
  color,
  ariaHidden = true
}) {
  return /*#__PURE__*/React.createElement("span", {
    "aria-hidden": ariaHidden ? 'true' : undefined,
    style: {
      display: 'inline-flex',
      width: size,
      height: size,
      color: color || 'currentColor'
    }
  }, React.cloneElement(icon, {
    width: size,
    height: size
  }));
}
// ── Category palette — change here to reskin the whole app ────────
const CAT_DEFAULT = {
  'Bière': {
    hue: 80,
    c: 0.16,
    light_l: 55,
    dark_l: 72,
    bg_l: 32
  },
  'Vin': {
    hue: 15,
    c: 0.18,
    light_l: 52,
    dark_l: 70,
    bg_l: 30
  },
  'Spiritueux': {
    hue: 300,
    c: 0.14,
    light_l: 55,
    dark_l: 72,
    bg_l: 32
  },
  'Cocktail': {
    hue: 180,
    c: 0.13,
    light_l: 48,
    dark_l: 72,
    bg_l: 32
  },
  'Autre': {
    hue: 240,
    c: 0.10,
    light_l: 52,
    dark_l: 70,
    bg_l: 30
  }
};

// CAT is mutable and may be augmented at runtime when users create custom
// categories. We assign deterministic hues to unknown names by hashing.
const CAT = {
  ...CAT_DEFAULT
};

// Deterministic hue per name so a custom category always gets the
// same tint across reloads (no random palette flicker).
function _hashHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = h * 31 + name.charCodeAt(i) >>> 0;
  return h % 360;
}
function _ensureCat(name) {
  if (!CAT[name]) {
    CAT[name] = {
      hue: _hashHue(name),
      c: 0.12,
      light_l: 52,
      dark_l: 70,
      bg_l: 30
    };
  }
  return CAT[name];
}
function catColor(name, l) {
  const c = _ensureCat(name);
  const L = l !== undefined ? l : T.isDark ? c.dark_l : c.light_l;
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
  return T.isDark ? `oklch(${c.bg_l}% ${c.c * 0.5} ${c.hue})` : `oklch(94% ${c.c * 0.25} ${c.hue})`;
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
  }
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
  if (u === 'l') return qty * 100;
  if (u === 'ml') return qty / 10;
  return qty;
}

// ── Search input ──────────────────────────────────────────────────
function SearchInput({
  value,
  onChange,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: T.surface2,
      borderRadius: 14,
      padding: '11px 14px',
      border: `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.search,
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    value: value || '',
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    style: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: T.ink,
      fontFamily: fontSans,
      fontSize: 14,
      letterSpacing: -0.1,
      minWidth: 0
    }
  }), value && /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange(''),
    style: {
      color: T.muted,
      display: 'flex',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  })));
}

// ── Section head ──────────────────────────────────────────────────
function SectionHead({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: T.muted,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontWeight: 500,
      padding: '6px 2px'
    }
  }, /*#__PURE__*/React.createElement("span", null, children), right);
}

// ── Pill ──────────────────────────────────────────────────────────
function Pill({
  active,
  onClick,
  children,
  color
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-pressed": active ? 'true' : 'false',
    style: {
      padding: '7px 13px',
      borderRadius: 99,
      cursor: 'pointer',
      background: active ? T.ink : 'transparent',
      color: active ? T.bg : T.ink2,
      border: active ? `1px solid ${T.ink}` : `1px solid ${T.rule}`,
      fontSize: 12,
      fontWeight: active ? 500 : 400,
      letterSpacing: -0.1,
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      fontFamily: 'inherit'
    }
  }, color && !active && /*#__PURE__*/React.createElement("span", {
    style: {
      color,
      fontSize: 10
    }
  }, "\u25CF"), children);
}

// ── Stars (rating) ────────────────────────────────────────────────
// `value` reads `n` first (explicit prop wins over the named alias `rating`)
// so a 0 is preserved (?? not ||).  Interactive mode: clicking star i always
// sets the rating to i (including 1). Clearing is done via an explicit
// "Effacer" control next to the stars, never by re-tapping star 1 — the old
// toggle made a 1-star rating impossible to set right after clearing it.
function Stars({
  rating,
  n,
  size = 13,
  interactive,
  onChange
}) {
  const raw = typeof n === 'number' ? n : rating;
  const value = typeof raw === 'number' ? raw : 0;
  const cells = [1, 2, 3, 4, 5];
  const handle = i => e => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    onChange && onChange(i);
  };
  // Pad each cell so the touch target is large enough on small icons
  const pad = Math.max(0, Math.ceil((22 - size) / 2));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 1
    },
    role: interactive ? 'radiogroup' : undefined,
    "aria-label": interactive ? 'Note' : undefined
  }, cells.map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    role: interactive ? 'radio' : undefined,
    "aria-checked": interactive ? i === value : undefined,
    "aria-label": interactive ? `${i} étoile${i > 1 ? 's' : ''}` : undefined,
    onPointerDown: interactive ? handle(i) : undefined,
    onClick: interactive ? handle(i) : undefined,
    style: {
      color: i <= value ? T.accent : T.rule,
      display: 'flex',
      cursor: interactive ? 'pointer' : 'default',
      padding: interactive ? `${pad}px ${Math.max(1, pad)}px` : 0,
      margin: interactive ? `-${pad}px 0` : 0,
      touchAction: 'manipulation'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.star,
    size: size
  }))));
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
  'Bière': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 6h8v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 9h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "10",
    x2: "9",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "10",
    x2: "12",
    y2: "18"
  })),
  'Vin': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "13",
    x2: "12",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "21",
    x2: "16",
    y2: "21"
  })),
  'Spiritueux': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "8",
    width: "8",
    height: "13",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.5",
    y: "3",
    width: "5",
    height: "5",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "13",
    x2: "16",
    y2: "13"
  })),
  'Cocktail': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 4h16l-8 9-8-9z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "13",
    x2: "12",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "21",
    x2: "16",
    y2: "21"
  })),
  'Champagne': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.5 3h5l-0.5 9a2 2 0 0 1-4 0L9.5 3z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "14",
    x2: "12",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "21",
    x2: "15",
    y2: "21"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "7",
    r: "0.4",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "13",
    cy: "9",
    r: "0.4",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11.5",
    cy: "11",
    r: "0.4",
    fill: "currentColor"
  })),
  'Whisky': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8.5",
    y: "11",
    width: "3.2",
    height: "3.2",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "13",
    y: "14.5",
    width: "2.8",
    height: "2.8",
    rx: "0.5"
  })),
  'Shot': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 8h6l-0.5 11a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2L9 8z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "13",
    x2: "15",
    y2: "13"
  })),
  'Cidre': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7c-3-2-7-1-7 4 0 5 3 11 7 11s7-6 7-11c0-5-4-6-7-4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v-2c0-1 1-2 2-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 3.5c0.5-0.3 1-0.3 1.5 0"
  })),
  'Saké': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 3h4v3c0 1 1 2 2 3 1 1 2 2 2 4v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7c0-2 1-3 2-4 1-1 2-2 2-3V3z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "13",
    x2: "17",
    y2: "13"
  })),
  'Café': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 9h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 11h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 4c0 1 0 2 1 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 4c0 1 0 2 1 3"
  })),
  'Liqueur': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 3h4v4l1.2 2v9a2 2 0 0 1-2 2h-2.4a2 2 0 0 1-2-2v-9L10 7V3z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "13",
    x2: "15",
    y2: "13"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10.5",
    y: "15",
    width: "3",
    height: "2.8",
    rx: "0.3"
  })),
  'Pinte': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 4h10l-1 17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 4z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "9",
    x2: "16",
    y2: "9"
  })),
  'Punch': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 11h18l-1 8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 11z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "2",
    y1: "11",
    x2: "22",
    y2: "11"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 4l-1 7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "15",
    cy: "3.5",
    r: "1.5"
  })),
  'Apéritif': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 4c0 6 3 9 5 9s5-3 5-9z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "13",
    x2: "12",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "21",
    x2: "15",
    y2: "21"
  })),
  'Autre': s => /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "16",
    r: "0.5",
    fill: "currentColor"
  }))
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
function CategoryGlyph({
  name,
  glyph,
  size = 22
}) {
  const customIcons = React.useContext(CategoryIconsContext);
  // Fall back to the canonical name (not the raw one) so a default glyph
  // still resolves for a drink stored as e.g. "Bière " with no override.
  const key = glyph || customIcons[canonicalCat(name)] || canonicalCat(name);
  const s = {
    width: size,
    height: size
  };
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
    onKeyDown: e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick && onClick(e);
      }
    }
  };
}

// Reusable "ghost" button reset for clickable surfaces that want a
// transparent background and inherit fonts.
const ghostButton = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'inherit'
};

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
      if (suppress > 0) {
        suppress--;
        return;
      }
      const top = stack[stack.length - 1];
      if (!top) return; // nothing open → let the browser do the default
      top.closedByPop = true;
      try {
        top.close();
      } catch {}
    });
  };
  return {
    push(close) {
      install();
      const entry = {
        close,
        pushed: false
      };
      stack.push(entry);
      // `pushed` records whether we actually added a history entry, so a
      // swallowed pushState (e.g. sandboxed iframe) doesn't make remove()
      // fire an unmatched history.back() and desync the counter.
      try {
        history.pushState({
          __alcoBack: true
        }, '');
        entry.pushed = true;
      } catch {}
      return entry;
    },
    remove(entry) {
      const i = stack.lastIndexOf(entry);
      if (i < 0) return;
      stack.splice(i, 1);
      if (entry.closedByPop) return; // Back already consumed the trap entry
      if (!entry.pushed) return; // never added an entry → nothing to undo
      suppress++;
      try {
        history.back();
      } catch {
        suppress--;
      }
    }
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
    const entry = BackStack.push(() => {
      if (ref.current) ref.current();
    });
    return () => BackStack.remove(entry);
  }, [active]);
}

// ── Sheet overlay (bottom sheet / left or right drawer) ──────────
function SheetOverlay({
  children,
  onClose,
  side = 'bottom'
}) {
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // A sheet is only mounted while it's open, so register unconditionally:
  // mount = push a back-trap, unmount = remove it. Covers every sheet
  // (Add / Detail / EditEntry / EditFamily / Settings / EditCategory).
  useBackButton(true, onClose);
  const isSide = side === 'left' || side === 'right';
  return /*#__PURE__*/React.createElement("div", {
    role: "presentation",
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: T.scrim,
      zIndex: 100,
      display: 'flex',
      alignItems: side === 'bottom' ? 'flex-end' : 'stretch',
      justifyContent: side === 'right' ? 'flex-end' : side === 'left' ? 'flex-start' : 'stretch',
      animation: 'fade 0.2s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    onClick: e => e.stopPropagation(),
    style: {
      width: isSide ? 'auto' : '100%',
      maxWidth: isSide ? '100%' : 'min(560px, 100%)',
      margin: side === 'bottom' ? '0 auto' : 0,
      height: isSide ? '100%' : 'auto',
      display: 'flex',
      flexDirection: 'column'
    }
  }, children));
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
    _bind(fn) {
      setter = fn;
    },
    ask(opts) {
      return new Promise(resolve => {
        if (!setter) {
          resolve(window.confirm(opts.message || ''));
          return;
        }
        if (pendingResolve) {
          try {
            pendingResolve(false);
          } catch {}
        }
        pendingResolve = resolve;
        const wrapped = ok => {
          if (pendingResolve === resolve) pendingResolve = null;
          resolve(ok);
        };
        setter({
          ...opts,
          _resolve: wrapped
        });
      });
    }
  };
})();
function ConfirmHost() {
  const [state, setState] = React.useState(null);
  React.useEffect(() => {
    Confirm._bind(setState);
    return () => Confirm._bind(null);
  }, []);
  // All hooks must be called unconditionally on every render —
  // putting `useCallback`/`useEffect` after the `if (!state) return null`
  // early-return below changes the hook count when the dialog opens
  // and triggers React error #310 (rendered fewer hooks than expected),
  // which then bubbles up to AppErrorBoundary.
  const onKey = React.useCallback(e => {
    if (!state) return;
    if (e.key === 'Escape') {
      state._resolve(false);
      setState(null);
    }
    if (e.key === 'Enter') {
      state._resolve(true);
      setState(null);
    }
  }, [state]);
  React.useEffect(() => {
    if (!state) return;
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey, state]);
  // Android Back cancels the dialog (same as Escape / backdrop).
  useBackButton(!!state, React.useCallback(() => {
    if (state) {
      state._resolve(false);
      setState(null);
    }
  }, [state]));
  if (!state) return null;
  const close = ok => {
    state._resolve(ok);
    setState(null);
  };
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "alco-confirm-title",
    onClick: () => close(false),
    style: {
      position: 'fixed',
      inset: 0,
      background: T.scrim,
      display: 'grid',
      placeItems: 'center',
      zIndex: 200,
      animation: 'fade 0.18s ease',
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: T.bg,
      color: T.ink,
      borderRadius: 18,
      border: `1px solid ${T.rule}`,
      padding: '22px 22px 18px',
      maxWidth: 360,
      width: '100%',
      boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
      animation: 'scaleIn 0.18s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    id: "alco-confirm-title",
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      fontStyle: 'italic',
      letterSpacing: -0.3,
      marginBottom: 10
    }
  }, state.title || 'Confirmer'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink2,
      fontSize: 13.5,
      lineHeight: 1.45,
      letterSpacing: -0.05,
      marginBottom: 22
    }
  }, state.message), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => close(false),
    style: {
      flex: 1,
      padding: '12px',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      border: `1px solid ${T.rule}`,
      fontSize: 13,
      fontFamily: fontSans,
      cursor: 'pointer'
    }
  }, state.cancelText || 'Annuler'), /*#__PURE__*/React.createElement("button", {
    onClick: () => close(true),
    autoFocus: true,
    style: {
      flex: 1.4,
      padding: '12px',
      borderRadius: 12,
      background: state.danger ? T.dangerBtn : T.accent,
      color: state.danger ? '#fff' : T.isDark ? T.bg : '#fff',
      border: 'none',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: fontSans,
      cursor: 'pointer',
      letterSpacing: 0.1,
      boxShadow: `0 4px 18px ${withAlpha(state.danger ? T.dangerBtn : T.accent, state.danger ? 0.5 : 0.4)}`
    }
  }, state.confirmText || 'Confirmer'))));
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
    const apply = raw => {
      if (cancelled) return;
      // CACHE_NAME shape: "alconote-vX.Y.Z" — pluck the version
      // suffix, fall back to the raw value if the SW ever ships a
      // different format.
      const m = String(raw || '').match(/v[\d.]+/);
      const next = m ? m[0] : raw || null;
      versionRef.current = next;
      setVersion(next);
    };
    const ask = () => {
      const ctrl = navigator.serviceWorker.controller;
      if (!ctrl) return;
      try {
        const ch = new MessageChannel();
        ch.port1.onmessage = e => apply(e && e.data && e.data.version);
        ctrl.postMessage({
          type: 'GET_VERSION'
        }, [ch.port2]);
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

// ── niceMax ──────────────────────────────────────────────────────
function niceMax(v, fallback = 1) {
  if (!isFinite(v) || v <= 0) return fallback;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const m = v / base;
  let nice;
  if (m <= 1) nice = 1;else if (m <= 2) nice = 2;else if (m <= 5) nice = 5;else nice = 10;
  return nice * base;
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
  `;
  document.head.appendChild(s);
})();
Object.assign(window, {
  T,
  THEMES,
  applyTheme,
  useTheme,
  fontSans,
  fontSerif,
  fontNum,
  Ic,
  SvgIcon,
  CAT,
  catColor,
  catBg,
  withAlpha,
  CategoryIconsContext,
  Toast,
  FR_DAYS_LONG,
  FR_DAYS_SHORT,
  FR_MONTHS_SHORT,
  FR_MONTHS_LONG,
  FR_MONTHS_DOTTED,
  fmtDateMedium,
  fmtDayHeader,
  localDate,
  localTime,
  toCl,
  SearchInput,
  SectionHead,
  Pill,
  Stars,
  CategoryGlyph,
  GLYPH_OPTIONS,
  canonicalCat,
  SheetOverlay,
  niceMax,
  useBackButton,
  Confirm,
  ConfirmHost,
  clickable,
  ghostButton,
  useSWVersion
});
// shared.jsx — tokens, icons, shared primitives
// Two themes: warm dark (espresso/ivory) and warm light (cream/ink).
// T is a mutable global; call setTheme(name) then bump themeVersion to re-render.

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
    // shadow on surfaces
    shadow: '0 60px 120px rgba(0,0,0,0.5)',
    // accent-on-surface bg (for pills like "3.2u")
    accentSoft: 'oklch(30% 0.04 65)',
    accentSoftBorder: 'oklch(38% 0.05 65)',
    // scrim
    scrim: 'rgba(0,0,0,0.65)',
    isDark: true
  },
  light: {
    bg: 'oklch(98% 0.006 85)',
    // warm cream
    surface: 'oklch(100% 0 0)',
    // pure white card
    surface2: 'oklch(96% 0.006 85)',
    // tinted input
    surface3: 'oklch(93% 0.008 80)',
    // raised chip
    ink: 'oklch(22% 0.012 55)',
    // espresso ink
    ink2: 'oklch(38% 0.01 60)',
    muted: 'oklch(55% 0.008 65)',
    rule: 'oklch(90% 0.008 80)',
    accent: 'oklch(60% 0.15 50)',
    // slightly deeper amber for contrast
    accent2: 'oklch(55% 0.18 30)',
    good: 'oklch(55% 0.12 155)',
    shadow: '0 20px 60px rgba(60,40,20,0.12)',
    accentSoft: 'oklch(95% 0.04 65)',
    accentSoftBorder: 'oklch(85% 0.08 65)',
    scrim: 'rgba(40,30,20,0.35)',
    isDark: false
  }
};

// Mutable global — components read T.bg etc. at render time
const T = {
  ...THEMES.dark
};
function setTheme(name) {
  const next = THEMES[name] || THEMES.dark;
  for (const k of Object.keys(T)) delete T[k];
  Object.assign(T, next);
  T._name = name;
}
T._name = 'dark';

// Bump this ref-like number to trigger re-renders across tree
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
  window.__themeListeners.forEach(f => f());
}
// init from saved
try {
  const saved = localStorage.getItem('alconote.theme');
  if (saved && THEMES[saved]) setTheme(saved);
} catch {}
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
  }))
};
function SvgIcon({
  icon,
  size = 18,
  color
}) {
  return /*#__PURE__*/React.createElement("span", {
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

// ── Category palette — EDIT HERE to reskin the whole app ─────────
// Each category has:
//   hue     — OKLCH hue angle (0–360). Changing this changes every dot,
//             badge, glyph-chip, chart slice and history rail for the category.
//   c       — chroma (0–0.25). Higher = more vivid.
//   light_l — lightness used for the glyph-chip/history/connector color in LIGHT mode
//   dark_l  — lightness used for the glyph-chip/history/connector color in DARK mode
//   bg_l    — lightness used for the pale background wash behind the glyph
// Pick hues at least ~45° apart so categories never get confused.
const CAT = {
  'Bière': {
    hue: 80,
    c: 0.16,
    light_l: 55,
    dark_l: 72,
    bg_l: 32
  },
  // gold
  'Vin': {
    hue: 15,
    c: 0.18,
    light_l: 52,
    dark_l: 70,
    bg_l: 30
  },
  // bordeaux red
  'Spiritueux': {
    hue: 300,
    c: 0.14,
    light_l: 55,
    dark_l: 72,
    bg_l: 32
  },
  // magenta
  'Cocktail': {
    hue: 180,
    c: 0.13,
    light_l: 48,
    dark_l: 72,
    bg_l: 32
  },
  // teal
  'Autre': {
    hue: 240,
    c: 0.10,
    light_l: 52,
    dark_l: 70,
    bg_l: 30
  } // blue
};
function catColor(name, l) {
  const c = CAT[name] || CAT['Autre'];
  const L = l !== undefined ? l : T.isDark ? c.dark_l : c.light_l;
  return `oklch(${L}% ${c.c} ${c.hue})`;
}
function catBg(name) {
  const c = CAT[name] || CAT['Autre'];
  // In light mode we want a pale wash; in dark mode a deeper muted tint.
  return T.isDark ? `oklch(${c.bg_l}% ${c.c * 0.5} ${c.hue})` : `oklch(94% ${c.c * 0.25} ${c.hue})`;
}

// ── Status bar ────────────────────────────────────────────────────
function StatusBar() {
  const [time, setTime] = React.useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  React.useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    const id = setInterval(tick, 30 * 1000);
    return () => clearInterval(id);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 30px 8px',
      fontFamily: fontSans,
      color: T.ink,
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: 0.1
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-label": `Heure ${time}`
  }, time), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "11",
    viewBox: "0 0 16 11",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7",
    width: "3",
    height: "4",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "5",
    width: "3",
    height: "6",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "3",
    width: "3",
    height: "8",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "12",
    y: "0",
    width: "3",
    height: "11",
    rx: "0.5"
  })), /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "11",
    viewBox: "0 0 24 11",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "20",
    height: "10",
    rx: "2.5",
    stroke: "currentColor",
    opacity: "0.4"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "17",
    height: "7",
    rx: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "21",
    y: "4",
    width: "2",
    height: "3",
    rx: "0.5",
    fill: "currentColor",
    opacity: "0.5"
  }))));
}

// ── Home indicator ────────────────────────────────────────────────
function HomeBar() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 24,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 128,
      height: 5,
      borderRadius: 99,
      background: T.ink,
      opacity: 0.35
    }
  }));
}
Object.assign(window, {
  T,
  THEMES,
  setTheme,
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
  StatusBar,
  HomeBar
});
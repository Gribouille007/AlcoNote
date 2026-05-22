/* AUTO-GENERATED from proto/stats.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// stats.jsx — Tab 3: Statistiques
// Sections: Général, Temporel, Catégorie, Top, BAC, Carte, Évolution
// mensuelle, Avancées. All sections are collapsible (state persisted in
// localStorage) and read from the real IndexedDB layer via the
// `useDrinks` hook. BAC records are derived client-side from drinks
// (one peak per Widmark session) — no DB writes — so they always stay
// in sync with the underlying data.
//
// Aggregations and sessions are computed once in StatsTab and passed to
// every section via `sp` to avoid recomputing the same sums in three
// places.

const STATS_COLLAPSED_KEY = 'alconote.stats.collapsed';
function loadCollapsedSections() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STATS_COLLAPSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveCollapsedSections(set) {
  try {
    localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {}
}
const PERIODS = [{
  id: 'today',
  label: 'Jour'
}, {
  id: 'week',
  label: 'Semaine'
}, {
  id: 'month',
  label: 'Mois'
}, {
  id: 'year',
  label: 'Année'
}, {
  id: 'all',
  label: 'Tout'
}, {
  id: 'school',
  label: 'A. scol.'
}];

// BAC level classification — mirrors the legacy app --> never change the messages under no circumstances
const BAC_LEVELS = [{
  max: 500,
  cls: 'caution',
  text: 'OK GARMIN, trouve mes clés de voiture',
  color: 'oklch(75% 0.14 95)'
}, {
  max: 1000,
  cls: 'warning',
  text: 'On nage dans le lac du BDC ?',
  color: 'oklch(68% 0.14 50)'
}, {
  max: 1999,
  cls: 'warning',
  text: '1 millions de bières svp',
  color: 'oklch(65% 0.15 35)'
}, {
  max: 2999,
  cls: 'danger',
  text: 'Brieuc t\'abuses',
  color: 'oklch(60% 0.18 25)'
}, {
  max: Infinity,
  cls: 'danger',
  text: 'Y a qu\'une personne pour arriver ici',
  color: 'oklch(55% 0.20 20)'
}];
function bacLevel(bac) {
  return BAC_LEVELS.find(l => bac <= l.max) || BAC_LEVELS[BAC_LEVELS.length - 1];
}

// ── Period helpers ────────────────────────────────────────────────
function _fmtIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function _addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function getPeriodRange(period, anchor) {
  const a = new Date(anchor);
  a.setHours(0, 0, 0, 0);
  const start = new Date(a),
    end = new Date(a);
  switch (period) {
    case 'today':
      break;
    case 'week':
      {
        const dow = a.getDay();
        const monDiff = dow === 0 ? -6 : 1 - dow;
        start.setDate(start.getDate() + monDiff);
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 6);
        break;
      }
    case 'month':
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      end.setMonth(11, 31);
      break;
    case 'school':
      if (a.getMonth() >= 8) {
        start.setMonth(8, 1);
        end.setFullYear(end.getFullYear() + 1, 7, 31);
      } else {
        start.setFullYear(start.getFullYear() - 1, 8, 1);
        end.setMonth(7, 31);
      }
      break;
    case 'all':
      start.setFullYear(2000, 0, 1);
      break;
  }
  return {
    start,
    end
  };
}
function shiftAnchor(period, anchor, dir) {
  const a = new Date(anchor);
  switch (period) {
    case 'today':
      a.setDate(a.getDate() + dir);
      break;
    case 'week':
      a.setDate(a.getDate() + dir * 7);
      break;
    case 'month':
      a.setMonth(a.getMonth() + dir);
      break;
    case 'year':
      a.setFullYear(a.getFullYear() + dir);
      break;
    case 'school':
      a.setFullYear(a.getFullYear() + dir);
      break;
    case 'all':
      break;
  }
  return a;
}
function periodLabel(period, anchor) {
  const {
    start,
    end
  } = getPeriodRange(period, anchor);
  const sM = FR_MONTHS_LONG[start.getMonth()];
  const eM = FR_MONTHS_LONG[end.getMonth()];
  if (period === 'today') {
    return `${FR_DAYS_LONG[start.getDay()]} ${start.getDate()} ${sM}`;
  }
  if (period === 'week') {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${sM} ${end.getFullYear()}`;
    }
    return `${start.getDate()} ${sM.slice(0, 4)}. – ${end.getDate()} ${eM.slice(0, 4)}. ${end.getFullYear()}`;
  }
  if (period === 'month') {
    return `${sM[0].toUpperCase() + sM.slice(1)} ${start.getFullYear()}`;
  }
  if (period === 'year') {
    return `${start.getFullYear()}`;
  }
  if (period === 'school') {
    return `Année ${start.getFullYear()}-${end.getFullYear()}`;
  }
  return 'Depuis le début';
}

// ── Aggregation helpers (used by sections) ────────────────────────
function filterDrinksInRange(drinks, start, end) {
  const sIso = _fmtIso(start),
    eIso = _fmtIso(end);
  return drinks.filter(d => d.date >= sIso && d.date <= eIso);
}

// Roll up totals (drink count, cL of liquid, grams of pure alcohol,
// unique-name set) plus per-category / per-hour / per-day-of-week
// histograms used by every section above the BAC block.
function aggregateGeneral(drinks) {
  const stats = {
    count: drinks.length,
    volumeCl: 0,
    grams: 0,
    unique: new Set(),
    byCategory: {},
    byHour: Array(24).fill(0),
    byDow: [0, 0, 0, 0, 0, 0, 0]
  };
  for (const d of drinks) {
    const cl = toCl(d.quantity, d.unit);
    stats.volumeCl += cl;
    stats.grams += cl * 10 * ((d.alcoholContent || 0) / 100) * 0.789;
    stats.unique.add((d.name || '').toLowerCase());
    const cat = d.category || 'Autre';
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    const hour = parseInt((d.time || '00:00').split(':')[0], 10);
    if (!isNaN(hour)) stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    const dow = new Date((d.date || '') + 'T00:00:00').getDay();
    if (!isNaN(dow)) stats.byDow[dow] += 1;
  }
  stats.uniqueCount = stats.unique.size;
  return stats;
}

// BAC-driven sessions: a session begins at the first drink that pushes
// BAC from 0 to >0 and ends exactly when BAC returns to 0 (Widmark
// model, instantaneous absorption, linear elimination at `elimRate`).
// Replaces the legacy 4-hour gap heuristic so a "session" reflects a
// real drinking episode (matches the BAC projection curve and the
// "Temps bourré" / records-per-session features).
//
// Each session carries its own deterministic id (`sess::<startTs>`) so
// the user can mask individual records from the BAC list and the
// masking persists across renders without a DB write.
const BAC_ELIM_RATE = 150; // mg/L/h, standard Widmark β

function computeBACSessions(drinks, weight = 70, gender = 'male') {
  const r = gender === 'female' ? 0.55 : 0.68;
  const w = weight || 70;
  const hour = 3600_000;
  const valid = drinks.filter(d => d.date && d.time).map(d => ({
    ...d,
    _ts: new Date(`${d.date}T${d.time}`).getTime()
  })).filter(d => Number.isFinite(d._ts)).sort((a, b) => a._ts - b._ts);
  if (valid.length === 0) return [];
  const sessions = [];
  let cur = null;
  let bac = 0;
  let lastTs = 0;
  for (const d of valid) {
    if (cur) {
      // Eliminate from lastTs to d._ts. If BAC would hit 0 in that
      // interval, close the session at the exact moment it hits 0.
      const dh = (d._ts - lastTs) / hour;
      const drop = BAC_ELIM_RATE * dh;
      if (drop >= bac) {
        cur.endTs = lastTs + bac / BAC_ELIM_RATE * hour;
        cur = null;
        bac = 0;
      } else {
        bac -= drop;
      }
    }
    const grams = toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789;
    const peak = grams * 1000 / (w * r);
    if (!cur) {
      cur = {
        id: 'sess::' + d._ts,
        startTs: d._ts,
        endTs: d._ts,
        // provisional, overwritten when session closes
        drinks: [d],
        grams,
        peakBac: peak,
        peakTs: d._ts
      };
      sessions.push(cur);
      bac = peak;
    } else {
      cur.drinks.push(d);
      cur.grams += grams;
      bac += peak;
      if (bac > cur.peakBac) {
        cur.peakBac = bac;
        cur.peakTs = d._ts;
      }
    }
    lastTs = d._ts;
  }
  if (cur) {
    cur.endTs = lastTs + bac / BAC_ELIM_RATE * hour;
  }
  return sessions;
}

// Total time within `range` where BAC > 0 (= sum of session intervals
// clamped to the period bounds). Returns milliseconds.
function computeBourreTime(sessions, range) {
  if (!sessions || sessions.length === 0 || !range) return 0;
  const startMs = range.start.getTime();
  // `range.end` is set to 00:00 of the last day in the period; expand
  // to "end of that day" so a session that finishes at 23:59 still
  // counts within the period.
  const endMs = range.end.getTime() + 86400_000;
  let total = 0;
  for (const s of sessions) {
    const a = Math.max(s.startTs, startMs);
    const b = Math.min(s.endTs, endMs);
    if (b > a) total += b - a;
  }
  return total;
}

// Consecutive-day drinking streak. Tolerant: streak is still valid if
// the user drank yesterday but not yet today (avoids resetting at
// midnight). Returns 0 when the most recent drink is older than
// yesterday.
function computeStreak(drinks) {
  if (!drinks || drinks.length === 0) return 0;
  const drinkDays = new Set(drinks.map(d => d.date).filter(Boolean));
  if (drinkDays.size === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = _addDays(today, -1);
  let cursor;
  if (drinkDays.has(_fmtIso(today))) cursor = new Date(today);else if (drinkDays.has(_fmtIso(yesterday))) cursor = new Date(yesterday);else return 0;
  let streak = 0;
  while (drinkDays.has(_fmtIso(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// All-time best: the longest run of consecutive calendar days that each
// had at least one drink, anywhere in the history.
function computeStreakRecord(drinks) {
  if (!drinks || drinks.length === 0) return 0;
  const days = [...new Set(drinks.map(d => d.date).filter(Boolean))].sort();
  if (days.length === 0) return 0;
  let best = 1,
    run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T00:00');
    const expected = _fmtIso(_addDays(prev, 1));
    run = days[i] === expected ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

// Render a duration in ms as "Xj Yh", "Xh Ymm", "Xm" — picks the
// largest unit that gives a non-trivial number. Returns "—" for ≤ 0.
function fmtBourreTime(ms) {
  if (!ms || ms <= 0) return '—';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const totalH = totalMin / 60;
  if (totalH < 24) {
    const h = Math.floor(totalH);
    const m = totalMin - h * 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  }
  const days = Math.floor(totalH / 24);
  const h = Math.round(totalH - days * 24);
  return h === 0 ? `${days}j` : `${days}j ${h}h`;
}
// ── Main StatsTab ─────────────────────────────────────────────────
function StatsTab() {
  const {
    drinks
  } = useDrinks();
  const settings = useSettings();
  const [period, setPeriod] = React.useState(() => localStorage.getItem('alconote.stats.period') || 'week');
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [collapsed, setCollapsed] = React.useState(loadCollapsedSections);
  React.useEffect(() => {
    try {
      localStorage.setItem('alconote.stats.period', period);
    } catch {}
  }, [period]);
  const toggleSection = id => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      saveCollapsedSections(next);
      return next;
    });
  };
  const range = React.useMemo(() => getPeriodRange(period, anchor), [period, anchor]);
  const allRange = React.useMemo(() => {
    if (period !== 'all') return range;
    if (drinks.length === 0) return range;
    const sorted = [...drinks].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const start = new Date(sorted[0].date + 'T00:00');
    return {
      start,
      end: range.end
    };
  }, [period, range, drinks]);

  // Previous-period range, used to compute Δ% indicators on the
  // headline cards. For 'all' there's no meaningful previous range.
  const prevRange = React.useMemo(() => {
    if (period === 'all') return null;
    const prevAnchor = shiftAnchor(period, anchor, -1);
    return getPeriodRange(period, prevAnchor);
  }, [period, anchor]);
  const inRange = React.useMemo(() => filterDrinksInRange(drinks, allRange.start, allRange.end), [drinks, allRange]);
  const inPrevRange = React.useMemo(() => prevRange ? filterDrinksInRange(drinks, prevRange.start, prevRange.end) : null, [drinks, prevRange]);

  // Hoisted aggregations: every section reads from the same memo so we
  // never recompute the same sum/session in three places. The Widmark
  // params come from settings and feed `computeBACSessions` so a
  // session reflects the user's real elimination rate.
  const weight = Number(settings.userWeight) || 70;
  const gender = settings.userGender || 'male';
  const agg = React.useMemo(() => aggregateGeneral(inRange), [inRange]);
  const prevAgg = React.useMemo(() => inPrevRange ? aggregateGeneral(inPrevRange) : null, [inPrevRange]);
  const sessions = React.useMemo(() => computeBACSessions(inRange, weight, gender), [inRange, weight, gender]);
  const prevSessions = React.useMemo(() => inPrevRange ? computeBACSessions(inPrevRange, weight, gender) : null, [inPrevRange, weight, gender]);
  // All-time sessions feed BAC records (one per session, ranked by
  // peak) and the streak — those are not constrained to the visible
  // period.
  const allSessions = React.useMemo(() => computeBACSessions(drinks, weight, gender), [drinks, weight, gender]);
  const streak = React.useMemo(() => computeStreak(drinks), [drinks]);
  const streakRecord = React.useMemo(() => computeStreakRecord(drinks), [drinks]);
  const bourreMs = React.useMemo(() => computeBourreTime(sessions, allRange), [sessions, allRange]);
  const prevBourreMs = React.useMemo(() => prevSessions && prevRange ? computeBourreTime(prevSessions, prevRange) : null, [prevSessions, prevRange]);
  const sp = {
    collapsed,
    toggleSection,
    period,
    drinks: inRange,
    allDrinks: drinks,
    prevDrinks: inPrevRange,
    prevRange,
    settings,
    range: allRange,
    anchor,
    agg,
    prevAgg,
    sessions,
    prevSessions,
    allSessions,
    streak,
    streakRecord,
    bourreMs,
    prevBourreMs,
    weight,
    gender
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement(PeriodSwitcher, {
    period: period,
    onChange: p => {
      setPeriod(p);
      setAnchor(new Date());
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 16px 120px'
    }
  }, /*#__PURE__*/React.createElement(PeriodNav, {
    period: period,
    anchor: anchor,
    onShift: d => setAnchor(shiftAnchor(period, anchor, d))
  }), /*#__PURE__*/React.createElement(GeneralSection, sp), /*#__PURE__*/React.createElement(TemporalSection, sp), /*#__PURE__*/React.createElement(CategorySection, sp), /*#__PURE__*/React.createElement(TopDrinksSection, sp), /*#__PURE__*/React.createElement(BACSection, sp), /*#__PURE__*/React.createElement(MapSection, sp), /*#__PURE__*/React.createElement(TrendsSection, sp), /*#__PURE__*/React.createElement(AdvancedSection, sp)));
}
function PeriodSwitcher({
  period,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      padding: '4px 16px 14px',
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    "aria-label": "P\xE9riode",
    style: {
      display: 'flex',
      gap: 2,
      padding: 3,
      background: T.surface2,
      borderRadius: 12,
      border: `1px solid ${T.rule}`,
      flexShrink: 0
    }
  }, PERIODS.map(p => /*#__PURE__*/React.createElement("button", {
    key: p.id,
    type: "button",
    role: "tab",
    "aria-selected": period === p.id,
    onClick: () => onChange(p.id),
    style: {
      padding: '6px 12px',
      borderRadius: 9,
      cursor: 'pointer',
      background: period === p.id ? T.accent : 'transparent',
      color: period === p.id ? T.accentInk : T.ink2,
      fontSize: 12,
      fontWeight: period === p.id ? 600 : 400,
      letterSpacing: -0.1,
      whiteSpace: 'nowrap',
      border: 'none',
      fontFamily: 'inherit'
    }
  }, p.label))));
}
function PeriodNav({
  period,
  anchor,
  onShift
}) {
  const label = periodLabel(period, anchor);
  const arrowBtn = (icon, dir, label) => /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onShift(dir),
    disabled: period === 'all',
    "aria-label": label,
    style: {
      width: 32,
      height: 32,
      borderRadius: 10,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2,
      border: `1px solid ${T.rule}`,
      cursor: period === 'all' ? 'not-allowed' : 'pointer',
      opacity: period === 'all' ? 0.4 : 1,
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: icon,
    size: 14
  }));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 4px 18px',
      gap: 8
    }
  }, arrowBtn(Ic.chevL, -1, 'Période précédente'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 18,
      color: T.ink,
      fontStyle: 'italic',
      letterSpacing: -0.3,
      textAlign: 'center',
      flex: 1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label), arrowBtn(Ic.chevR, 1, 'Période suivante'));
}
function StatSection({
  id,
  title,
  action,
  children,
  sub,
  collapsed,
  toggleSection
}) {
  const isOpen = !collapsed.has(id);
  return /*#__PURE__*/React.createElement("section", {
    style: {
      marginBottom: 14,
      background: T.surface,
      borderRadius: 16,
      border: `1px solid ${T.rule}`,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => toggleSection(id),
    "aria-expanded": isOpen,
    "aria-controls": `alco-section-${id}`,
    style: {
      width: '100%',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      padding: '11px 14px',
      background: 'transparent',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: isOpen ? `1px solid ${T.rule}` : 'none',
      fontFamily: 'inherit',
      color: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      transition: 'transform 0.2s ease',
      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
      display: 'flex',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chev,
    size: 12
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      letterSpacing: 0.2,
      fontWeight: 500
    }
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10.5,
      marginTop: 2,
      letterSpacing: 0.1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, sub)), action), isOpen && /*#__PURE__*/React.createElement("div", {
    id: `alco-section-${id}`,
    style: {
      padding: 12
    }
  }, children));
}
function Card({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: T.surface2,
      borderRadius: 14,
      padding: 14,
      border: `1px solid ${T.rule}`,
      ...style
    }
  }, rest), children);
}
// ── 1. Général ────────────────────────────────────────────────────
function GeneralSection({
  drinks,
  prevDrinks,
  prevRange,
  period,
  range,
  collapsed,
  toggleSection,
  agg,
  prevAgg,
  sessions,
  prevSessions,
  streak,
  streakRecord,
  bourreMs,
  prevBourreMs
}) {
  const hasPrev = prevDrinks != null && prevRange != null;
  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
  const prevDays = hasPrev ? Math.max(1, Math.round((prevRange.end - prevRange.start) / 86400000) + 1) : 0;
  // Sober-day count: only consider days from `range.start` up to `min(today, range.end)`,
  // so future days within the period don't inflate the count.
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const sober = React.useMemo(() => {
    const drinkDays = new Set(drinks.map(d => d.date));
    const lastInclusive = range.end < today ? range.end : today;
    if (lastInclusive < range.start) return 0;
    let count = 0;
    for (let d = new Date(range.start); d <= lastInclusive; d = _addDays(d, 1)) {
      if (!drinkDays.has(_fmtIso(d))) count++;
    }
    return count;
  }, [drinks, range, today]);
  // Same calculation, but the previous period's window is fully past
  // so we always go to its real end.
  const prevSober = React.useMemo(() => {
    if (!hasPrev) return null;
    const drinkDays = new Set(prevDrinks.map(d => d.date));
    let count = 0;
    for (let d = new Date(prevRange.start); d <= prevRange.end; d = _addDays(d, 1)) {
      if (!drinkDays.has(_fmtIso(d))) count++;
    }
    return count;
  }, [prevDrinks, prevRange, hasPrev]);

  // Δ% helper — `null` baseline means we don't show a badge (e.g. no
  // previous period or it had zero of this metric).
  const pctChange = (cur, prev) => {
    if (prev == null || prev === 0) return null;
    return (cur - prev) / prev * 100;
  };
  const cards = React.useMemo(() => {
    const out = [{
      v: agg.count,
      l: 'Boissons',
      delta: pctChange(agg.count, prevAgg ? prevAgg.count : null)
    }, {
      v: sessions.length,
      l: 'Sessions',
      delta: pctChange(sessions.length, prevSessions ? prevSessions.length : null)
    }, {
      v: `${(agg.volumeCl / 100).toFixed(1)}L`,
      l: 'Volume',
      delta: pctChange(agg.volumeCl, prevAgg ? prevAgg.volumeCl : null)
    }, {
      v: `${Math.round(agg.grams)}g`,
      l: 'Alcool pur',
      delta: pctChange(agg.grams, prevAgg ? prevAgg.grams : null)
    }, {
      v: agg.uniqueCount,
      l: 'Boissons diff.',
      delta: pctChange(agg.uniqueCount, prevAgg ? prevAgg.uniqueCount : null)
    }, {
      v: fmtBourreTime(bourreMs),
      l: 'Temps bourré',
      delta: pctChange(bourreMs, prevBourreMs),
      icon: Ic.hourglass
    }];
    // "Tout" only: share of life spent drunk since the very first drink.
    // Counts BAC>0 time strictly up to "now" (not the projected
    // elimination tail) over (now − first drink), so it reads as a true
    // elapsed share. Pushed right after "Temps bourré" to pair the two.
    if (period === 'all') {
      const now = Date.now();
      const firstTs = drinks.reduce((min, d) => {
        const t = new Date(`${d.date}T${d.time || '00:00'}`).getTime();
        if (!Number.isFinite(t)) return min;
        return min == null || t < min ? t : min;
      }, null);
      let bourreToNow = 0;
      if (firstTs != null) {
        for (const s of sessions) {
          const a = Math.max(s.startTs, firstTs);
          const b = Math.min(s.endTs, now);
          if (b > a) bourreToNow += b - a;
        }
      }
      const span = firstTs != null ? now - firstTs : 0;
      const pct = span > 0 ? Math.min(100, bourreToNow / span * 100) : 0;
      out.push({
        v: `${pct.toFixed(1)}%`,
        l: '% bourré',
        icon: Ic.hourglass
      });
    }
    // 'all' joins week/month/year/school: the day/week denominators come
    // from `range` (first drink → today), so these rates are meaningful.
    if (period !== 'today') {
      out.push({
        v: sober,
        l: 'Jours sobres',
        delta: pctChange(sober, prevSober)
      });
      out.push({
        v: (agg.count / days).toFixed(1),
        l: 'Boissons/jour',
        delta: pctChange(agg.count / days, prevDays && prevAgg ? prevAgg.count / prevDays : null)
      });
    }
    if (period === 'month' || period === 'year' || period === 'school' || period === 'all') {
      const weeks = Math.max(1, days / 7);
      const prevWeeks = prevDays ? Math.max(1, prevDays / 7) : 0;
      out.push({
        v: (agg.count / weeks).toFixed(1),
        l: 'Boissons/sem.',
        delta: pctChange(agg.count / weeks, prevWeeks && prevAgg ? prevAgg.count / prevWeeks : null)
      });
    }
    return out;
  }, [agg, prevAgg, sessions, prevSessions, sober, prevSober, bourreMs, prevBourreMs, days, prevDays, period, drinks]);

  // Donut: sort categories by descending count so both the arc order
  // and the legend list match the user's mental "biggest first" model.
  const catDist = React.useMemo(() => Object.entries(agg.byCategory).map(([name, v]) => ({
    name,
    v
  })).sort((a, b) => b.v - a.v), [agg.byCategory]);
  const catTotal = React.useMemo(() => catDist.reduce((s, x) => s + x.v, 0), [catDist]);
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "general",
    title: "Statistiques g\xE9n\xE9rales",
    sub: "Vue d'ensemble de votre consommation",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, streak > 0 && /*#__PURE__*/React.createElement(HeroStatCard, {
    icon: Ic.flame,
    label: "Streak",
    value: streak,
    suffix: `jour${streak > 1 ? 's' : ''} d'affilée`
  }), period === 'all' && streakRecord > 0 && !(streak > 0 && streakRecord === streak) && /*#__PURE__*/React.createElement(HeroStatCard, {
    icon: Ic.flame,
    label: "Record",
    value: streakRecord,
    suffix: `jour${streakRecord > 1 ? 's' : ''} d'affilée`
  }), drinks.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      marginBottom: 12
    }
  }, cards.map((c, i) => /*#__PURE__*/React.createElement(StatCell, {
    key: c.l,
    value: c.v,
    label: c.l,
    icon: c.icon,
    delta: c.delta,
    period: period
  }))), catDist.length > 0 && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 13,
      fontWeight: 500,
      marginBottom: 12,
      letterSpacing: -0.1
    }
  }, "R\xE9partition par cat\xE9gorie"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgDonut, {
    data: catDist,
    size: 130,
    thickness: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, catDist.map(d => {
    const pct = catTotal > 0 ? Math.round(d.v / catTotal * 100) : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: d.name,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 8,
        height: 8,
        borderRadius: 99,
        background: catColor(d.name, 65)
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.ink,
        flex: 1,
        letterSpacing: -0.1
      }
    }, d.name), /*#__PURE__*/React.createElement("span", {
      style: {
        color: T.muted,
        fontFamily: fontNum
      }
    }, pct, "%"));
  })))), drinks.length === 0 && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      padding: '12px 0',
      textAlign: 'center',
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Aucune donn\xE9e pour cette p\xE9riode")));
}

// Stat tile in the headline grid. Optional `icon` prints a small glyph
// to the left of the value (used by "Temps bourré" — others stay
// number-only to preserve the dense 3-column rhythm). Memoized so a
// re-render of the parent doesn't ripple through every tile when only
// one of them actually changed.
const StatCell = React.memo(function StatCell({
  value,
  label,
  icon,
  delta,
  period
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      borderRadius: 12,
      padding: '12px 10px',
      border: `1px solid ${T.rule}`,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      fontFamily: fontSerif,
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.4,
      lineHeight: 1
    }
  }, icon && /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      display: 'flex',
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: icon,
    size: 13
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, value)), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      marginTop: 5,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      lineHeight: 1.2
    }
  }, label), delta != null && period !== 'all' && /*#__PURE__*/React.createElement(DeltaBadge, {
    delta: delta
  }));
});

// Full-width "hero" stat card: large accent-tinted icon badge on the
// left, label + serif value on the right. Used for the streak to give
// it visual weight matching the BAC gauge below; same primitive could
// host future hero metrics (longest sober streak, …) without dupe.
const HeroStatCard = React.memo(function HeroStatCard({
  icon,
  label,
  value,
  suffix
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: T.accentSoft,
      border: `1px solid ${T.accentSoftBorder}`,
      borderRadius: 14,
      padding: '12px 14px',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 12,
      display: 'grid',
      placeItems: 'center',
      background: withAlpha(T.accent, 0.18),
      color: T.accent,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: icon,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 2
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1,
      fontStyle: 'italic'
    }
  }, value, suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'normal',
      fontFamily: fontSans,
      fontSize: 12,
      color: T.ink2,
      marginLeft: 6,
      letterSpacing: 0
    }
  }, suffix))));
});

// Show every 4th hour label on the hourly bar chart, blank for the
// rest — declared at module level so the reference stays stable
// across renders (React.memo on SvgBarChart relies on it).
const hourlyFormatX = (d, i) => i % 4 === 0 ? d.label : '';

// ── 2. Analyse temporelle ─────────────────────────────────────────
function TemporalSection({
  drinks,
  collapsed,
  toggleSection,
  agg,
  sessions
}) {
  const peakHour = agg.byHour.indexOf(Math.max(...agg.byHour));
  const peakDow = agg.byDow.indexOf(Math.max(...agg.byDow));
  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const avgDuration = sessions.length > 0 ? sessions.reduce((s, x) => s + (x.endTs - x.startTs), 0) / sessions.length / 3600_000 : 0;
  // Mean gap between consecutive sessions: Σ (sessions[i+1].start −
  // sessions[i].end) / (N − 1). The previous formula computed
  // (last.start − first.end) / (N−1), which conflates total elapsed
  // time with the per-pair gap and drifts whenever sessions overlap or
  // the spacing varies.
  const between = (() => {
    if (sessions.length < 2) return 0;
    let totalGap = 0;
    for (let i = 1; i < sessions.length; i++) {
      totalGap += sessions[i].startTs - sessions[i - 1].endTs;
    }
    return totalGap / (sessions.length - 1) / 86400_000;
  })();
  const fmtH = h => {
    if (!h) return '—';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}`;
  };
  const dailyData = React.useMemo(() => {
    const todayDow = new Date().getDay();
    return ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, i) => {
      const dow = (i + 1) % 7;
      return {
        label,
        day: dow,
        v: agg.byDow[dow],
        today: dow === todayDow
      };
    });
  }, [agg.byDow]);

  // Pre-shape hourly data so a parent re-render doesn't allocate a
  // fresh array; React.memo on SvgBarChart relies on reference equality.
  const hourlyData = React.useMemo(() => agg.byHour.map((v, h) => ({
    v,
    label: `${h}h`
  })), [agg.byHour]);
  if (drinks.length === 0) {
    return /*#__PURE__*/React.createElement(StatSection, {
      id: "temporal",
      title: "Analyse temporelle",
      collapsed: collapsed,
      toggleSection: toggleSection,
      sub: "R\xE9partition par heures et jours"
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 12,
        padding: '8px 0',
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: fontSerif
      }
    }, "Aucune donn\xE9e pour cette p\xE9riode")));
  }
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "temporal",
    title: "Analyse temporelle",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "R\xE9partition par heures et jours"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(MiniStat, {
    big: drinks.length > 0 ? `${peakHour}h` : '—',
    label: "Heure de pointe"
  }), /*#__PURE__*/React.createElement(MiniStat, {
    big: drinks.length > 0 ? dayNames[peakDow] : '—',
    label: "Jour de pointe"
  }), /*#__PURE__*/React.createElement(MiniStat, {
    big: fmtH(avgDuration),
    label: "Dur\xE9e moy. session"
  }), /*#__PURE__*/React.createElement(MiniStat, {
    big: between > 0 ? `${between.toFixed(1)}j` : '—',
    label: "Entre sessions"
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 10,
      letterSpacing: -0.1
    }
  }, "Par heure"), /*#__PURE__*/React.createElement(SvgBarChart, {
    data: hourlyData,
    width: 320,
    height: 150,
    color: T.accent,
    formatX: hourlyFormatX,
    valueLabel: "boisson(s)"
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 4,
      letterSpacing: -0.1
    }
  }, "Par jour de la semaine"), /*#__PURE__*/React.createElement(SvgRadar, {
    data: dailyData,
    size: 250,
    color: T.good,
    valueLabel: "boisson(s)"
  })));
}

// Pure direction badge: green when the metric rises vs the previous
// period, red when it falls, neutral when essentially flat (< 0.5 %).
function DeltaBadge({
  delta
}) {
  if (delta == null || !isFinite(delta)) return null;
  const rising = delta > 0;
  const flat = Math.abs(delta) < 0.5;
  const positive = flat ? null : rising;
  const fg = positive == null ? T.muted : positive ? T.deltaPos : T.deltaNeg;
  const bg = positive == null ? T.surface2 : positive ? T.deltaPosBg : T.deltaNegBg;
  const value = `${Math.abs(delta).toFixed(0)}%`;
  const arrowIcon = flat ? Ic.trendFlat : rising ? Ic.trendUp : Ic.trendDown;
  const ariaDir = flat ? 'stable' : rising ? 'hausse' : 'baisse';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      color: fg,
      fontSize: 9.5,
      fontFamily: fontNum,
      fontWeight: 600,
      background: bg,
      padding: '2px 6px',
      borderRadius: 99,
      border: `1px solid ${withAlpha(fg, 0.18)}`,
      letterSpacing: 0,
      lineHeight: 1
    },
    "aria-label": `${ariaDir} de ${value} vs période précédente`
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: arrowIcon,
    size: 9
  }), value);
}
function MiniStat({
  big,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      borderRadius: 12,
      padding: '14px 10px',
      border: `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1
    }
  }, big), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginTop: 6,
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    }
  }, label));
}
// ── 3. Analyse par catégorie ─────────────────────────────────────
function CategorySection({
  drinks,
  collapsed,
  toggleSection
}) {
  const byCat = React.useMemo(() => {
    const map = {};
    for (const d of drinks) {
      const cat = d.category || 'Autre';
      if (!map[cat]) map[cat] = {
        name: cat,
        count: 0,
        volumeCl: 0,
        abvSum: 0,
        abvN: 0,
        names: {}
      };
      const e = map[cat];
      e.count++;
      const cl = toCl(d.quantity, d.unit);
      e.volumeCl += cl;
      if (d.alcoholContent) {
        e.abvSum += d.alcoholContent;
        e.abvN++;
      }
      e.names[d.name] = (e.names[d.name] || 0) + 1;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [drinks]);
  if (byCat.length === 0) {
    return /*#__PURE__*/React.createElement(StatSection, {
      id: "category",
      title: "Analyse par cat\xE9gorie",
      collapsed: collapsed,
      toggleSection: toggleSection,
      sub: "Statistiques par type de boisson"
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 12,
        padding: '8px 0',
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: fontSerif
      }
    }, "Aucune donn\xE9e")));
  }
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "category",
    title: "Analyse par cat\xE9gorie",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "Statistiques par type de boisson"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8
    }
  }, byCat.map(c => {
    const fav = Object.entries(c.names).sort((a, b) => b[1] - a[1])[0];
    const avgVol = c.count ? c.volumeCl / c.count / 100 : 0;
    const avgAbv = c.abvN ? c.abvSum / c.abvN : 0;
    return /*#__PURE__*/React.createElement(Card, {
      key: c.name,
      style: {
        padding: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 10,
        height: 10,
        borderRadius: 99,
        background: catColor(c.name, 65)
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        color: T.ink,
        fontSize: 14,
        fontWeight: 500
      }
    }, c.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: fontNum,
        fontSize: 13,
        color: T.accent,
        fontWeight: 500
      }
    }, c.count, "\xD7")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '5px 14px'
      }
    }, /*#__PURE__*/React.createElement(StatRow, {
      label: "Volume",
      value: `${(c.volumeCl / 100).toFixed(1)}L`
    }), /*#__PURE__*/React.createElement(StatRow, {
      label: "Volume moyen",
      value: `${avgVol.toFixed(2)}L`
    }), /*#__PURE__*/React.createElement(StatRow, {
      label: "Degr\xE9 moyen",
      value: `${avgAbv.toFixed(1)}%`
    }), /*#__PURE__*/React.createElement(StatRow, {
      label: "Favorite",
      value: fav ? fav[0] : '—',
      truncate: true
    })));
  })));
}
function StatRow({
  label,
  value,
  truncate
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 8,
      fontSize: 11,
      borderTop: `1px dashed ${T.rule}`,
      paddingTop: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      letterSpacing: 0.1
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink2,
      fontFamily: fontNum,
      ...(truncate ? {
        maxWidth: 120,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      } : {})
    }
  }, value));
}

// ── 4. Top 10 des boissons ────────────────────────────────────────
function TopDrinksSection({
  drinks,
  collapsed,
  toggleSection
}) {
  const ratings = useRatings();
  const top = React.useMemo(() => {
    const map = {};
    for (const d of drinks) {
      const key = d.name;
      if (!map[key]) {
        map[key] = {
          name: d.name,
          count: 0,
          volumeCl: 0,
          lastDate: null
        };
      }
      const e = map[key];
      e.count++;
      e.volumeCl += toCl(d.quantity, d.unit);
      if (!e.lastDate || (d.date || '') > e.lastDate) e.lastDate = d.date;
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [drinks]);
  if (top.length === 0) {
    return /*#__PURE__*/React.createElement(StatSection, {
      id: "top",
      title: "Top 10 des boissons",
      collapsed: collapsed,
      toggleSection: toggleSection,
      sub: "Vos boissons les plus consomm\xE9es"
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 12,
        padding: '8px 0',
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: fontSerif
      }
    }, "Aucune donn\xE9e")));
  }
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "top",
    title: "Top 10 des boissons",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "Vos boissons les plus consomm\xE9es"
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: '4px 4px'
    }
  }, top.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: d.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '11px 12px',
      borderBottom: i === top.length - 1 ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 8,
      background: i < 3 ? T.accent : T.surface3,
      color: i < 3 ? T.accentInk : T.ink2,
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: fontNum
    }
  }, i + 1), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 13,
      letterSpacing: -0.1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flex: 1,
      minWidth: 0
    }
  }, d.name), /*#__PURE__*/React.createElement(Stars, {
    n: ratings[ratingKey(d.name)] || 0,
    size: 10
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10.5,
      letterSpacing: 0.1,
      fontFamily: fontNum
    }
  }, d.count, " fois \xB7 ", (d.volumeCl / 100).toFixed(2), "L \xB7 ", fmtDateMedium(d.lastDate))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontNum,
      color: T.accent,
      fontSize: 13,
      fontWeight: 500
    }
  }, d.count)))));
}
// ── 5. Alcoolémie (BAC + records) ────────────────────────────────
// Widmark BAC computation with instantaneous absorption — each drink jumps
// straight to its peak contribution at consumption time, then the running
// total decays at a constant elimination rate (mg/L/h). This matches the
// legacy bac-chart.js behaviour: at t = first drink, BAC ≠ 0.
//   bac(t) = max(0, Σ_{i:t≥t_i} [10·grams_i / (weight·r)] − elimRate·(t − t_first))
// `r` is Widmark's distribution factor (male 0.68, female 0.55), `0.789`
// is ethanol density g/mL.
function computeBacOverTime(drinks, weight, gender) {
  const r = gender === 'female' ? 0.55 : 0.68;
  const w = weight || 70;
  const elimRate = 150; // mg/L/h elimination, ~ standard Widmark β
  const now = Date.now();
  const lookback = 24 * 3600_000;
  const recent = drinks.filter(d => d.date && d.time).map(d => ({
    ...d,
    _ts: new Date(`${d.date}T${d.time}`).getTime()
  })).filter(d => d._ts <= now && now - d._ts <= lookback).sort((a, b) => a._ts - b._ts);
  if (recent.length === 0) return {
    points: [],
    current: 0,
    drinks: [],
    elimRate,
    nowT: 0
  };

  // Per-drink peak contribution in mg/L. With instantaneous absorption,
  // each drink jumps the BAC by `peak_i` at its consumption time.
  const grams = recent.map(d => toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789);
  const peaks = grams.map(g => g * 1000 / (w * r));
  const tStart = recent.map(d => (d._ts - now) / 3600_000); // negative hours
  const firstT = tStart[0];
  function bacAt(h) {
    let absorbed = 0;
    for (let i = 0; i < recent.length; i++) {
      if (h >= tStart[i]) absorbed += peaks[i];
    }
    if (absorbed <= 0) return 0;
    const eliminated = Math.max(0, h - firstT) * elimRate;
    return Math.max(0, absorbed - eliminated);
  }

  // Bound the curve to the actual session: from the first drink (so the
  // curve starts at the real BAC, not a flat-zero pre-drink region) to
  // a small buffer past sobriety. We always extend at least 30 min past
  // "now" so the user keeps seeing the present.
  const totalPeak = peaks.reduce((s, v) => s + v, 0);
  const sobrietyT = firstT + totalPeak / elimRate;
  const tMin = firstT; // start exactly at first drink (BAC = peak_1)
  const tMax = Math.max(0.5, sobrietyT + 0.5); // 30 min past sobriety, at least 30 min ahead
  const step = 1 / 60; // 1-minute resolution (smooth scrub)
  const pts = [];
  for (let t = tMin; t <= tMax + 1e-6; t += step) {
    pts.push({
      t: +t.toFixed(4),
      bac: bacAt(t)
    });
  }
  return {
    points: pts,
    current: Math.round(bacAt(0)),
    drinks: recent,
    elimRate,
    nowT: 0,
    sobrietyT,
    firstT
  };
}

// Forecast: extrapolate the *current* session forward by assuming the
// user keeps drinking at the same g/h pace until the mean historical
// session duration is reached, then declines at the standard Widmark
// elimination rate down to 0.
//
//   currentRateGph  = grams_so_far / max(5min, elapsed_in_session)
//   estStopMs       = sessionStart + mean(past_session_durations)
//   bac(t≤tStop)    = currentBac + (consumptionSlope − elimRate) · t
//   bac(t>tStop)    = bacAtStop − elimRate · (t − tStop)
//
// The function also returns the mean historical peak BAC and the ETA at
// which the projected curve first reaches that peak — `null` if the
// projection never gets there (which the chart renders as an "∞" marker
// pinned to the right edge).
function computeBacForecast(currentDrinks, currentBac, allSessions, weight, gender, nowMs) {
  const r = gender === 'female' ? 0.55 : 0.68;
  const w = weight || 70;
  const elimRate = 150; // mg/L/h, must match computeBacOverTime

  const valid = (currentDrinks || []).filter(d => d.date && d.time).map(d => ({
    ...d,
    _ts: new Date(`${d.date}T${d.time}`).getTime()
  })).filter(d => Number.isFinite(d._ts) && d._ts <= nowMs).sort((a, b) => a._ts - b._ts);
  const hasCurrentSession = valid.length > 0 && currentBac > 0;
  const past = (allSessions || []).filter(s => s.endTs <= nowMs && s.drinks && s.drinks.length > 0);
  const hasHistory = past.length >= 1;
  const meanPeakBac = hasHistory ? past.reduce((s, x) => s + (x.peakBac || 0), 0) / past.length : null;
  const meanDurationMs = hasHistory ? past.reduce((s, x) => s + Math.max(0, x.endTs - x.startTs), 0) / past.length : null;
  if (!hasCurrentSession) {
    return {
      currentRateGph: 0,
      meanDurationMs,
      estStopMs: null,
      meanPeakBac,
      projectedPoints: [],
      etaPeakHours: null,
      hasHistory,
      hasCurrentSession: false,
      sessionStartMs: nowMs
    };
  }
  const sessionStartMs = valid[0]._ts;
  // Minimum window of 5 min so a single just-poured drink doesn't blow
  // the rate up to several hundred g/h.
  const elapsedH = Math.max(5 / 60, (nowMs - sessionStartMs) / 3600_000);
  const totalGrams = valid.reduce((s, d) => s + toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789, 0);
  const currentRateGph = totalGrams / elapsedH;

  // No history → assume consumption stops now (only the elimination
  // tail is projected). Otherwise project until the historical mean
  // session duration is exhausted.
  const estStopMs = meanDurationMs != null ? Math.max(nowMs, sessionStartMs + meanDurationMs) : nowMs;
  const consumptionSlope = currentRateGph * 1000 / (w * r); // mg/L/h injected by drinking
  const netSlope = consumptionSlope - elimRate;
  const tStopH = (estStopMs - nowMs) / 3600_000;
  const bacAtStop = Math.max(0, currentBac + netSlope * tStopH);
  const tEndH = tStopH + bacAtStop / elimRate;
  const projectedPoints = [];
  const step = 1 / 60; // 1-min resolution, matches SvgBACForecast scrub granularity
  for (let t = 0; t <= tEndH + 1e-6; t += step) {
    let bac;
    if (t <= tStopH) {
      bac = currentBac + netSlope * t;
    } else {
      bac = bacAtStop - elimRate * (t - tStopH);
    }
    projectedPoints.push({
      t: +t.toFixed(4),
      bac: Math.max(0, bac)
    });
  }

  // ETA peak: first time the projection crosses the historical peak.
  // null when the projection never reaches it (peak too high vs. rate).
  let etaPeakHours = null;
  if (meanPeakBac != null && projectedPoints.length > 0) {
    if (currentBac >= meanPeakBac) {
      etaPeakHours = 0;
    } else if (netSlope > 0) {
      for (const p of projectedPoints) {
        if (p.bac >= meanPeakBac) {
          etaPeakHours = p.t;
          break;
        }
      }
    }
  }
  return {
    currentRateGph,
    meanDurationMs,
    estStopMs,
    meanPeakBac,
    projectedPoints,
    etaPeakHours,
    hasHistory,
    hasCurrentSession,
    sessionStartMs
  };
}

// Toggle state for the secondary "Prévision de session" chart. The
// calculations always run (so other panels could re-use them); the
// toggle only governs visibility of the chart + mini-stats.
const FORECAST_ENABLED_KEY = 'alconote.stats.bacForecast.enabled';
function loadForecastEnabled() {
  try {
    const v = localStorage.getItem(FORECAST_ENABLED_KEY);
    return v == null ? true : v === '1';
  } catch {
    return true;
  }
}
function saveForecastEnabled(enabled) {
  try {
    localStorage.setItem(FORECAST_ENABLED_KEY, enabled ? '1' : '0');
  } catch {}
}

// Single source of truth for BAC. Both the header pill and the Stats
// section read from this context so they always show the exact same
// rounded mg/L value, recomputed on the same 60s tick.
const BacContext = React.createContext({
  current: 0,
  points: [],
  drinks: []
});
function useBacInfo() {
  return React.useContext(BacContext);
}

// Wraps SvgBACProjection in a width-measured container so the viewBox
// matches actual pixel dimensions. Eliminates preserveAspectRatio
// whitespace and prevents truncation of axis/threshold labels.
//
// `minHeight` reserves space before the first measurement so the chart
// never collapses to 0 px during the initial frame and the surrounding
// card doesn't reflow when the SVG mounts.
function BACProjectionResponsive({
  points
}) {
  const ref = React.useRef(null);
  const width = useMeasuredWidth(ref, 320);
  // Slightly taller ratio + higher min height: the curve should be
  // legible end-to-end, including thresholds and labels, on the
  // narrowest phone screens we support.
  const height = Math.max(180, Math.min(240, Math.round(width * 0.6)));
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: '100%',
      minHeight: 180
    }
  }, width > 0 && /*#__PURE__*/React.createElement(SvgBACProjection, {
    points: points,
    width: width,
    height: height,
    nowMs: Date.now()
  }));
}
function BACForecastResponsive({
  realPoints,
  projectedPoints,
  meanPeakBac,
  etaPeakHours
}) {
  const ref = React.useRef(null);
  const width = useMeasuredWidth(ref, 320);
  const height = Math.max(180, Math.min(240, Math.round(width * 0.6)));
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: '100%',
      minHeight: 180
    }
  }, width > 0 && /*#__PURE__*/React.createElement(SvgBACForecast, {
    realPoints: realPoints,
    projectedPoints: projectedPoints,
    meanPeakBac: meanPeakBac,
    etaPeakHours: etaPeakHours,
    width: width,
    height: height,
    nowMs: Date.now()
  }));
}

// Records below this BAC aren't surfaced as "records" — a single
// pint shouldn't sit alongside actual milestones. Mirrors the legacy
// `recordBACIfPeak` 200 mg/L threshold.
const BAC_RECORD_MIN = 200;

// Two-segment pill toggle for the "Prévision de session" card. Mirrors
// the visual contract of PeriodSwitcher at a smaller scale so the
// section header stays uncluttered. Uppercase labels match the
// "secondary label" treatment from the design system.
function ForecastToggle({
  enabled,
  onChange
}) {
  const pill = (active, label, onClick) => /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-pressed": active,
    style: {
      ...ghostButton,
      padding: '4px 9px',
      borderRadius: 7,
      background: active ? T.accent : 'transparent',
      color: active ? T.accentInk : T.muted,
      fontSize: 9.5,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontWeight: active ? 600 : 500,
      transition: 'background 0.18s ease, color 0.18s ease'
    }
  }, label);
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": "Affichage de la pr\xE9vision",
    style: {
      display: 'flex',
      gap: 2,
      padding: 2,
      background: T.surface3,
      borderRadius: 9,
      border: `1px solid ${T.rule}`,
      flexShrink: 0
    }
  }, pill(enabled, 'Affichée', () => onChange(true)), pill(!enabled, 'Masquée', () => onChange(false)));
}

// 2×2 grid of small stats summarising the forecast: current g/h rate,
// mean historical session duration, mean historical peak BAC, ETA peak.
// Missing values render as "—" so the grid layout stays stable when
// the user has no past sessions yet.
function ForecastMiniStats({
  forecast,
  fmtTime
}) {
  const rate = forecast.hasCurrentSession ? `${forecast.currentRateGph.toFixed(1)} g/h` : '—';
  const duration = forecast.meanDurationMs != null ? fmtTime(forecast.meanDurationMs / 3600_000) : '—';
  const peak = forecast.meanPeakBac != null ? `${Math.round(forecast.meanPeakBac)}` : '—';
  const eta = forecast.etaPeakHours != null ? fmtTime(forecast.etaPeakHours) : forecast.meanPeakBac != null && forecast.hasCurrentSession ? '∞' : '—';
  const item = (icon, label, value, unit) => /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface3,
      borderRadius: 12,
      padding: '10px 8px',
      border: `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: icon,
    size: 11,
    color: T.muted
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    }
  }, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 18,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1
    }
  }, value), unit && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9,
      marginTop: 3,
      fontFamily: fontNum,
      letterSpacing: 0.2
    }
  }, unit));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 6,
      marginBottom: 10
    }
  }, item(Ic.flame, 'Rythme', rate, null), item(Ic.hourglass, 'Durée moy', duration, null), item(Ic.star, 'Peak moy', peak, 'mg/L'), item(Ic.clock, 'ETA peak', eta, null));
}
function BACSection({
  collapsed,
  toggleSection,
  allSessions,
  weight,
  gender
}) {
  const bacInfo = useBacInfo();
  const currentBAC = bacInfo.current || 0;
  const level = bacLevel(currentBAC);
  const [forecastEnabled, setForecastEnabledState] = React.useState(loadForecastEnabled);
  const setForecastEnabled = v => {
    setForecastEnabledState(v);
    saveForecastEnabled(v);
  };

  // Forecast is always computed (the toggle only governs visibility),
  // so other panels could reuse the same memo without forcing the user
  // to enable display.
  const forecast = React.useMemo(() => computeBacForecast(bacInfo.drinks, currentBAC, allSessions, weight, gender, Date.now()), [bacInfo.drinks, currentBAC, allSessions, weight, gender]);
  const realPastPoints = React.useMemo(() => (bacInfo.points || []).filter(p => p.t <= 0), [bacInfo.points]);
  const hoursToSober = currentBAC / 150;
  const hoursToLegal = Math.max(0, (currentBAC - 500) / 150);
  const fmtTime = h => {
    if (h <= 0) return '—';
    const hh = Math.floor(h),
      mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')}`;
  };
  const relevantDrinks = React.useMemo(() => {
    const now = Date.now();
    return bacInfo.drinks.slice(-3).reverse().map(d => ({
      name: d.name,
      qty: `${d.quantity} ${d.unit}`,
      abv: d.alcoholContent || 0,
      hoursAgo: ((now - new Date(`${d.date}T${d.time}`).getTime()) / 3600_000).toFixed(1)
    }));
  }, [bacInfo.drinks]);

  // One record per drinking session above the 200 mg/L threshold:
  // peak BAC of that session, timestamped at the moment of the peak.
  // Records are derived from drinks (no DB writes) and stay read-only —
  // they update automatically when the underlying drinks change.
  // Cap to the top 3 so the list reads as milestones, not a log.
  const sortedRecords = React.useMemo(() => {
    return (allSessions || []).filter(s => s.peakBac >= BAC_RECORD_MIN).map(s => ({
      id: s.id,
      bacValue: Math.round(s.peakBac),
      timestamp: new Date(s.peakTs),
      date: _fmtIso(new Date(s.peakTs)),
      drinkCount: s.drinks.length
    })).sort((a, b) => b.bacValue - a.bacValue).slice(0, 3);
  }, [allSessions]);
  const totalRecords = React.useMemo(() => (allSessions || []).filter(s => s.peakBac >= BAC_RECORD_MIN).length, [allSessions]);
  const highest = sortedRecords[0];
  const others = sortedRecords.slice(1);
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "bac",
    title: "Alcool\xE9mie",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "Estimation BAC \xB7 Formule de Widmark"
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 16,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(BACGauge, {
    bac: currentBAC,
    level: level
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      color: level.color,
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: 0.1,
      marginBottom: 14
    }
  }, level.text), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface3,
      borderRadius: 12,
      padding: '12px 12px',
      border: `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.clock,
    size: 12,
    color: T.muted
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    }
  }, "Sobri\xE9t\xE9")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 20,
      color: T.ink,
      letterSpacing: -0.3
    }
  }, fmtTime(hoursToSober))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface3,
      borderRadius: 12,
      padding: '12px 12px',
      border: `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.car,
    size: 12,
    color: T.muted
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.5,
      textTransform: 'uppercase'
    }
  }, "Conduite (<500)")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 20,
      color: T.ink,
      letterSpacing: -0.3
    }
  }, fmtTime(hoursToLegal))))), bacInfo.points.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 8,
      letterSpacing: -0.1
    }
  }, "Projection d'alcool\xE9mie"), /*#__PURE__*/React.createElement(BACProjectionResponsive, {
    points: bacInfo.points
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginTop: 6,
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Glissez le doigt sur le graphe pour voir le taux \xE0 un moment pr\xE9cis")), forecast.hasCurrentSession && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: forecastEnabled ? 8 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      letterSpacing: -0.1
    }
  }, "Pr\xE9vision de session"), /*#__PURE__*/React.createElement(ForecastToggle, {
    enabled: forecastEnabled,
    onChange: setForecastEnabled
  })), forecastEnabled && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ForecastMiniStats, {
    forecast: forecast,
    fmtTime: fmtTime
  }), /*#__PURE__*/React.createElement(BACForecastResponsive, {
    realPoints: realPastPoints,
    projectedPoints: forecast.projectedPoints,
    meanPeakBac: forecast.meanPeakBac,
    etaPeakHours: forecast.etaPeakHours
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginTop: 6,
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, forecast.hasHistory ? 'Extrapolation au rythme actuel jusqu\'à la durée moyenne de vos sessions passées' : 'Rythme actuel · pas encore de session passée pour estimer la durée'))), relevantDrinks.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 10,
      letterSpacing: -0.1
    }
  }, "Consommations prises en compte (", relevantDrinks.length, ")"), relevantDrinks.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderTop: i === 0 ? 'none' : `1px dashed ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12,
      flex: 1,
      letterSpacing: -0.1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, d.name), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink2,
      fontSize: 10.5,
      fontFamily: fontNum
    }
  }, d.qty, " \xB7 ", d.abv, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      fontFamily: fontNum,
      minWidth: 52,
      textAlign: 'right'
    }
  }, "il y a ", d.hoursAgo, "h")))), sortedRecords.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      padding: '0 2px 8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 13,
      fontWeight: 500,
      letterSpacing: -0.1
    }
  }, "Records d'alcool\xE9mie"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10.5,
      fontFamily: fontNum,
      background: T.surface2,
      padding: '2px 8px',
      borderRadius: 99,
      border: `1px solid ${T.rule}`
    }
  }, totalRecords)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, highest && /*#__PURE__*/React.createElement(BACRecordRow, {
    record: highest,
    isHighest: true
  }), others.map(r => /*#__PURE__*/React.createElement(BACRecordRow, {
    key: r.id,
    record: r
  })))));
}
function BACGauge({
  bac,
  level
}) {
  const size = 140,
    thickness = 10;
  const cx = size / 2,
    cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const circ = 2 * Math.PI * r;
  const cap = 1500;
  const frac = Math.min(1, bac / cap);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size
  }, /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: "none",
    stroke: T.rule,
    strokeWidth: thickness
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: "none",
    stroke: level.color,
    strokeWidth: thickness,
    strokeLinecap: "round",
    strokeDasharray: `${frac * circ} ${circ}`,
    transform: `rotate(-90 ${cx} ${cy})`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 36,
      color: T.ink,
      letterSpacing: -1,
      lineHeight: 1
    }
  }, bac), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      letterSpacing: 1,
      marginTop: 2
    }
  }, "MG/L")));
}

// Read-only record row. Records are derived automatically from the
// Widmark sessions, so there's no manual delete — to remove a record
// the user deletes the underlying drink in the Historique tab.
function BACRecordRow({
  record,
  isHighest
}) {
  const level = bacLevel(record.bacValue);
  const d = new Date(record.timestamp || record.date);
  const today = new Date();
  const daysAgo = Math.floor((today - d) / 86400_000);
  const dateLabel = daysAgo === 0 ? `Aujourd'hui à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : daysAgo === 1 ? `Hier à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : daysAgo < 7 ? `${daysAgo} jours · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : `${d.getDate()} ${FR_MONTHS_DOTTED[d.getMonth()]} · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      borderRadius: 14,
      border: `1px solid ${isHighest ? level.color : T.rule}`,
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: isHighest ? `0 0 0 1px ${withAlpha(level.color, 0.25)}, 0 4px 12px ${withAlpha(level.color, 0.12)}` : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 99,
      background: level.color,
      flexShrink: 0,
      boxShadow: `0 0 8px ${withAlpha(level.color, 0.5)}`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: fontSerif,
      fontSize: 17,
      color: T.ink,
      letterSpacing: -0.3,
      fontStyle: isHighest ? 'italic' : 'normal'
    }
  }, record.bacValue, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: T.muted,
      fontStyle: 'normal',
      fontFamily: fontSans,
      marginLeft: 2
    }
  }, "mg/L")), isHighest && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      color: T.accent,
      background: T.accentSoft,
      padding: '2px 6px',
      borderRadius: 99,
      border: `1px solid ${T.accentSoftBorder}`,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      fontWeight: 600
    }
  }, "Record")), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10.5,
      letterSpacing: 0.1,
      fontFamily: fontNum
    }
  }, dateLabel, " \xB7 ", record.drinkCount || 0, " conso", (record.drinkCount || 0) > 1 ? 's' : '')));
}
// ── 6. Carte des lieux ────────────────────────────────────────────
// Renders a Leaflet map with one marker per geolocated drink. Markers
// at the same / nearby locations are clustered via leaflet.markercluster
// — each cluster shows the count of drinks it contains. Leaflet and the
// markercluster plugin are lazy-loaded on first open of this section.
function MapSection({
  drinks,
  collapsed,
  toggleSection
}) {
  const isOpen = !collapsed.has('map');
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const [ready, setReady] = React.useState(typeof window !== 'undefined' && !!window.L && !!(window.L && window.L.markerClusterGroup));
  const [error, setError] = React.useState(null);

  // Drinks with valid coordinates (top-level or nested in `location`).
  const geoDrinks = React.useMemo(() => drinks.filter(d => {
    const lat = d.latitude ?? d.location?.latitude;
    const lng = d.longitude ?? d.location?.longitude;
    return Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng));
  }), [drinks]);

  // Lazy-load Leaflet + markercluster plugin on first open.
  React.useEffect(() => {
    if (!isOpen || ready) return;
    let cancelled = false;
    const loadCss = (id, href) => {
      if (document.getElementById(id)) return;
      const css = document.createElement('link');
      css.id = id;
      css.rel = 'stylesheet';
      css.href = href;
      css.crossOrigin = '';
      document.head.appendChild(css);
    };
    const loadScript = (id, src) => new Promise((resolve, reject) => {
      if (document.getElementById(id)) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.crossOrigin = '';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    const load = async () => {
      try {
        loadCss('alco-leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        loadCss('alco-cluster-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
        loadCss('alco-cluster-default-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css');
        if (!window.L) {
          await loadScript('alco-leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        }
        if (!window.L.markerClusterGroup) {
          await loadScript('alco-cluster-js', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError('Carte indisponible (réseau ?)');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ready]);

  // Build / refresh the map whenever data or readiness changes.
  React.useEffect(() => {
    if (!isOpen || !ready || !containerRef.current) return;
    const L = window.L;
    if (!L || typeof L.map !== 'function' || typeof L.markerClusterGroup !== 'function') return;
    // Always reset the container so React re-mounts (e.g. switching
    // tabs) doesn't end up with a "Map container is already
    // initialized" error from Leaflet.
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {}
      mapRef.current = null;
    }
    if (geoDrinks.length === 0) return;
    const points = geoDrinks.map(d => ({
      lat: parseFloat(d.latitude ?? d.location.latitude),
      lng: parseFloat(d.longitude ?? d.location.longitude),
      d
    }));
    const bounds = points.reduce((b, p) => [[Math.min(b[0][0], p.lat), Math.min(b[0][1], p.lng)], [Math.max(b[1][0], p.lat), Math.max(b[1][1], p.lng)]], [[points[0].lat, points[0].lng], [points[0].lat, points[0].lng]]);
    const m = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(m);
    L.control.attribution({
      position: 'bottomright',
      prefix: false
    }).addAttribution('© OSM').addTo(m);
    // Cluster styling: count badge inside an accent circle, sized up
    // with the cluster's drink count for instant readability. Uses the
    // theme accent token (the effect re-runs on theme change via the
    // `T._name` dependency); the white halo/shadow are conventional
    // map-marker chrome, not palette colours.
    const accent = T.accent;
    const clusterIcon = cluster => {
      const n = cluster.getChildCount();
      const size = n < 10 ? 32 : n < 100 ? 38 : 46;
      const html = `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${accent};color:#fff;
          display:flex;align-items:center;justify-content:center;
          font:600 12px/1 'Geist Mono', monospace;
          border:2px solid rgba(255,255,255,0.85);
          box-shadow:0 2px 8px rgba(0,0,0,0.28);
        "><span>${n}</span></div>`;
      return L.divIcon({
        html,
        className: 'alco-cluster',
        iconSize: L.point(size, size)
      });
    };
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 40,
      iconCreateFunction: clusterIcon
    });
    // Build popup content as DOM nodes so user-controlled fields
    // (drink name, location label) cannot inject HTML.
    const popupNode = p => {
      const wrap = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = p.d.name || '';
      wrap.appendChild(title);
      wrap.appendChild(document.createElement('br'));
      const meta = document.createElement('span');
      meta.textContent = `${p.d.date || ''} · ${p.d.time || ''}`;
      wrap.appendChild(meta);
      const where = p.d.location?.name || p.d.location?.address || '';
      if (where) {
        wrap.appendChild(document.createElement('br'));
        const place = document.createElement('span');
        place.textContent = where;
        wrap.appendChild(place);
      }
      return wrap;
    };
    const dotIcon = L.divIcon({
      html: `<div style="
        width:14px;height:14px;border-radius:50%;
        background:${accent};
        border:2px solid rgba(255,255,255,0.85);
        box-shadow:0 2px 6px rgba(0,0,0,0.25);
      "></div>`,
      className: 'alco-pin',
      iconSize: L.point(14, 14),
      iconAnchor: L.point(7, 7)
    });
    for (const p of points) {
      L.marker([p.lat, p.lng], {
        icon: dotIcon
      }).bindPopup(popupNode(p)).addTo(cluster);
    }
    cluster.addTo(m);
    if (points.length === 1) {
      m.setView([points[0].lat, points[0].lng], 14);
    } else {
      m.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 15
      });
    }
    mapRef.current = m;
    // Leaflet sometimes lays out before the container has its final
    // height (when the section was just expanded); kick it once.
    const id = setTimeout(() => {
      try {
        m.invalidateSize();
      } catch {}
    }, 60);
    return () => {
      clearTimeout(id);
      try {
        m.remove();
      } catch {}
      mapRef.current = null;
    };
  }, [isOpen, ready, geoDrinks, T._name]);
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "map",
    title: "Carte des consommations",
    sub: `${geoDrinks.length} consommation${geoDrinks.length !== 1 ? 's' : ''} géolocalisée${geoDrinks.length !== 1 ? 's' : ''}`,
    collapsed: collapsed,
    toggleSection: toggleSection
  }, /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    style: {
      width: '100%',
      height: 260,
      borderRadius: 12,
      overflow: 'hidden',
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      position: 'relative'
    }
  }, !ready && !error && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      color: T.muted,
      fontSize: 11,
      fontFamily: fontSerif,
      fontStyle: 'italic'
    }
  }, "Chargement de la carte\u2026"), error && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      color: T.muted,
      fontSize: 11,
      padding: 16,
      textAlign: 'center'
    }
  }, error), ready && geoDrinks.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      color: T.muted,
      fontSize: 11,
      fontFamily: fontSerif,
      fontStyle: 'italic',
      textAlign: 'center',
      padding: 24
    }
  }, "Aucune consommation g\xE9olocalis\xE9e pour cette p\xE9riode")));
}

// ── 7. Évolution mensuelle ────────────────────────────────────────
function TrendsSection({
  allDrinks,
  collapsed,
  toggleSection
}) {
  const trends = React.useMemo(() => {
    const buckets = {};
    for (const d of allDrinks) {
      if (!d.date) continue;
      const k = d.date.slice(0, 7);
      if (!buckets[k]) buckets[k] = {
        drinks: 0,
        alcohol: 0
      };
      buckets[k].drinks++;
      buckets[k].alcohol += toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789;
    }
    const keys = Object.keys(buckets).sort().slice(-6);
    return {
      labels: keys.map(k => FR_MONTHS_SHORT[parseInt(k.slice(5, 7), 10) - 1].replace(/^[a-zà]/, c => c.toUpperCase())),
      drinks: keys.map(k => buckets[k].drinks),
      alcoholG: keys.map(k => Math.round(buckets[k].alcohol))
    };
  }, [allDrinks]);
  if (trends.labels.length < 2) {
    return /*#__PURE__*/React.createElement(StatSection, {
      id: "trends",
      title: "\xC9volution mensuelle",
      collapsed: collapsed,
      toggleSection: toggleSection,
      sub: "Tendances de consommation mois par mois"
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 12,
        padding: '8px 0',
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: fontSerif
      }
    }, "Pas assez d'historique (au moins 2 mois requis)")));
  }
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "trends",
    title: "\xC9volution mensuelle",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "Tendances de consommation mois par mois"
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SvgLineChart, {
    labels: trends.labels,
    series: [{
      data: trends.drinks
    }, {
      data: trends.alcoholG
    }],
    width: 320,
    height: 170
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      justifyContent: 'center',
      marginTop: 8,
      fontSize: 10.5,
      color: T.ink2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 2,
      background: T.accent
    }
  }), " Verres"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 2,
      background: 'transparent',
      backgroundImage: `repeating-linear-gradient(90deg, ${T.accent2} 0 3px, transparent 3px 5px)`
    }
  }), " Alcool (g)"))));
}

// ── 7. Analyses avancées ─────────────────────────────────────────
function AdvancedSection({
  drinks,
  allDrinks,
  collapsed,
  toggleSection,
  agg,
  sessions
}) {
  const rolling = React.useMemo(() => {
    const byDay = {};
    for (const d of allDrinks) {
      if (!d.date) continue;
      byDay[d.date] = (byDay[d.date] || 0) + toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789;
    }
    const days = Object.keys(byDay).sort();
    if (days.length === 0) return [];
    const start = new Date(days[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const out = [];
    for (let d = new Date(start); d <= end; d = _addDays(d, 1)) {
      const k = _fmtIso(d);
      out.push({
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        daily: byDay[k] || 0
      });
    }
    // Compute moving averages
    for (let i = 0; i < out.length; i++) {
      const slice7 = out.slice(Math.max(0, i - 6), i + 1).map(x => x.daily);
      const slice30 = out.slice(Math.max(0, i - 29), i + 1).map(x => x.daily);
      out[i].r7 = slice7.reduce((s, v) => s + v, 0) / slice7.length;
      out[i].r30 = slice30.reduce((s, v) => s + v, 0) / slice30.length;
    }
    return out.slice(-30);
  }, [allDrinks]);
  const sessionDuration = React.useMemo(() => {
    const buckets = [{
      label: '<1h',
      v: 0
    }, {
      label: '1-2h',
      v: 0
    }, {
      label: '2-3h',
      v: 0
    }, {
      label: '3-4h',
      v: 0
    }, {
      label: '4-5h',
      v: 0
    }, {
      label: '5-6h',
      v: 0
    }, {
      label: '6h+',
      v: 0
    }];
    for (const s of sessions) {
      const h = (s.endTs - s.startTs) / 3600_000;
      const idx = h < 1 ? 0 : h < 2 ? 1 : h < 3 ? 2 : h < 4 ? 3 : h < 5 ? 4 : h < 6 ? 5 : 6;
      buckets[idx].v++;
    }
    return buckets;
  }, [sessions]);
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "advanced",
    title: "Analyses avanc\xE9es",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "Moyennes mobiles \xB7 Horloge \xB7 Distribution des sessions"
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 3,
      letterSpacing: -0.1
    }
  }, "Moyenne mobile"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginBottom: 10,
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Alcool quotidien liss\xE9 sur 7 et 30 jours"), rolling.length > 0 ? /*#__PURE__*/React.createElement(RollingChart, {
    data: rolling
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 11,
      padding: '12px 0',
      textAlign: 'center'
    }
  }, "Aucune donn\xE9e"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      justifyContent: 'center',
      marginTop: 6,
      fontSize: 10.5,
      color: T.ink2
    }
  }, /*#__PURE__*/React.createElement(LegendDot, {
    color: withAlpha(T.accent, 0.25),
    label: "Brut"
  }), /*#__PURE__*/React.createElement(LegendDot, {
    color: T.accent,
    label: "7j"
  }), /*#__PURE__*/React.createElement(LegendDot, {
    color: T.ink2,
    label: "30j",
    dashed: true
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 3,
      letterSpacing: -0.1
    }
  }, "Horloge des consommations"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginBottom: 10,
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "R\xE9partition sur 24 heures"), /*#__PURE__*/React.createElement(SvgPolarClock, {
    hours: agg.byHour,
    size: 260
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 3,
      letterSpacing: -0.1
    }
  }, "Distribution des sessions"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginBottom: 12,
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Dur\xE9e par session"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink2,
      fontSize: 10.5,
      marginBottom: 4,
      textAlign: 'center',
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    }
  }, "Dur\xE9e"), /*#__PURE__*/React.createElement(SvgHistogram, {
    buckets: sessionDuration,
    width: 320,
    height: 150,
    color: T.accent
  }))));
}
function RollingChart({
  data
}) {
  const width = 320,
    height = 160;
  const pad = {
    t: 12,
    r: 10,
    b: 26,
    l: 32
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = chartNiceMax(Math.max(1, ...data.flatMap(r => [r.daily, r.r7, r.r30])), 3);
  const n = data.length;
  const xs = i => pad.l + i / Math.max(1, n - 1) * w;
  const ys = v => pad.t + h * (1 - v / max);
  const bw = w / n;
  const pathR7 = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r7)}`).join(' ');
  const pathR30 = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r30)}`).join(' ');
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setHover(null);
      return;
    }
    const rel = (p.x - pad.l) / w;
    const i = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
    setHover(i);
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block',
      touchAction: 'pan-y'
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: pad.t + h * f,
    y2: pad.t + h * f,
    stroke: T.rule,
    strokeDasharray: "2 3",
    strokeWidth: 0.6
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * f + 3,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, Math.round(max * (1 - f)), "g"))), data.map((r, i) => {
    const bh = r.daily / max * h;
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: xs(i) - bw * 0.35,
      y: pad.t + h - bh,
      width: bw * 0.7,
      height: bh,
      fill: T.accent,
      opacity: hover === i ? 0.55 : 0.25,
      rx: 1
    });
  }), /*#__PURE__*/React.createElement("path", {
    d: pathR7,
    fill: "none",
    stroke: T.accent,
    strokeWidth: 2,
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: pathR30,
    fill: "none",
    stroke: T.ink2,
    strokeWidth: 1.4,
    strokeDasharray: "3 2",
    strokeLinejoin: "round"
  }), [0, Math.floor(n / 2), n - 1].map((i, k) => data[i] && /*#__PURE__*/React.createElement("text", {
    key: k,
    x: xs(i),
    y: height - 8,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, data[i].date)), hover != null && (() => {
    const r = data[hover];
    const tx = xs(hover);
    const cy7 = ys(r.r7);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: tx,
      x2: tx,
      y1: pad.t,
      y2: pad.t + h,
      stroke: T.ink2,
      strokeDasharray: "2 3",
      strokeWidth: 0.8,
      opacity: 0.7
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: ys(r.daily),
      r: 3,
      fill: T.accent
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: cy7,
      r: 3,
      fill: T.accent,
      stroke: T.bg,
      strokeWidth: 1
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: ys(r.r30),
      r: 3,
      fill: T.ink2,
      stroke: T.bg,
      strokeWidth: 1
    }), /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: cy7,
      width: width,
      lines: [`${r.date}`, `${Math.round(r.daily)} g brut`, `${r.r7.toFixed(1)} g · 7j`, `${r.r30.toFixed(1)} g · 30j`]
    }));
  })());
}
function LegendDot({
  color,
  label,
  dashed
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 2,
      background: dashed ? 'transparent' : color,
      ...(dashed ? {
        backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`
      } : {})
    }
  }), " ", label);
}
Object.assign(window, {
  StatsTab,
  PeriodSwitcher,
  PeriodNav,
  GeneralSection,
  TemporalSection,
  CategorySection,
  TopDrinksSection,
  BACSection,
  MapSection,
  TrendsSection,
  AdvancedSection,
  BACGauge,
  BACRecordRow,
  bacLevel,
  BAC_LEVELS,
  RollingChart,
  LegendDot,
  MiniStat,
  StatRow,
  Card,
  StatSection,
  DeltaBadge,
  StatCell,
  HeroStatCard,
  getPeriodRange,
  shiftAnchor,
  periodLabel,
  computeBacOverTime,
  computeBACSessions,
  computeBourreTime,
  computeStreak,
  fmtBourreTime,
  BAC_ELIM_RATE,
  BAC_RECORD_MIN,
  BacContext,
  useBacInfo,
  BACProjectionResponsive,
  computeBacForecast,
  BACForecastResponsive,
  ForecastToggle,
  ForecastMiniStats
});
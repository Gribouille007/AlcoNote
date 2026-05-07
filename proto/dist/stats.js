/* AUTO-GENERATED from proto/stats.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// stats.jsx — Tab 3: Statistiques
// Sections: Général, Temporel, Catégorie, Top, BAC, Évolution mensuelle,
// Avancées. All sections are collapsible (state persisted in localStorage)
// and read from the real IndexedDB layer via the `useDrinks` / `useBacRecords`
// hooks. The legacy stats-calculator helpers in `js/stats-calculators/*` can
// be plugged in here when more advanced metrics are needed; for now the
// proto-aligned aggregations are computed inline so they stay in sync with
// the layout.

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

// Approximate sessions: drinks within 4h of each other
function computeSessions(drinks) {
  const sorted = drinks.filter(d => d.date && d.time).map(d => ({
    ...d,
    _ts: new Date(`${d.date}T${d.time}`).getTime()
  })).sort((a, b) => a._ts - b._ts);
  const sessions = [];
  let cur = null;
  for (const d of sorted) {
    if (!cur || d._ts - cur.endTs > 4 * 3600_000) {
      cur = {
        startTs: d._ts,
        endTs: d._ts,
        drinks: [d],
        grams: 0
      };
      sessions.push(cur);
    } else {
      cur.endTs = d._ts;
      cur.drinks.push(d);
    }
    cur.grams += toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789;
  }
  return sessions;
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
  const inPrevRange = React.useMemo(() => prevRange ? filterDrinksInRange(drinks, prevRange.start, prevRange.end) : [], [drinks, prevRange]);
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
    anchor
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
      color: period === p.id ? T.isDark ? T.bg : '#fff' : T.ink2,
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
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
      background: T.surface,
      borderRadius: 14,
      border: `1px solid ${T.rule}`,
      marginBottom: isOpen ? 10 : 0,
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
    id: `alco-section-${id}`
  }, children));
}
function Card({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: T.surface,
      borderRadius: 18,
      padding: 16,
      border: `1px solid ${T.rule}`,
      ...style
    }
  }, rest), children);
}
// ── 1. Général ────────────────────────────────────────────────────
function GeneralSection({
  drinks,
  prevDrinks,
  period,
  range,
  collapsed,
  toggleSection
}) {
  const agg = React.useMemo(() => aggregateGeneral(drinks), [drinks]);
  const prevAgg = React.useMemo(() => aggregateGeneral(prevDrinks || []), [prevDrinks]);
  const sessions = React.useMemo(() => computeSessions(drinks), [drinks]);
  const prevSessions = React.useMemo(() => computeSessions(prevDrinks || []), [prevDrinks]);
  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
  // Sober-day count: only consider days from `range.start` up to `min(today, range.end)`,
  // so future days within the period don't inflate the count.
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const sober = (() => {
    const drinkDays = new Set(drinks.map(d => d.date));
    const lastInclusive = range.end < today ? range.end : today;
    if (lastInclusive < range.start) return 0;
    let count = 0;
    for (let d = new Date(range.start); d <= lastInclusive; d = _addDays(d, 1)) {
      if (!drinkDays.has(_fmtIso(d))) count++;
    }
    return count;
  })();

  // Δ% helper — null when there is no useful previous baseline.
  const pctChange = (cur, prev) => {
    if (prev == null || prev === 0) {
      if (cur === 0) return null;
      return null; // show no badge when previous period had nothing
    }
    return (cur - prev) / prev * 100;
  };
  const cards = [{
    v: agg.count,
    l: 'Boissons',
    delta: pctChange(agg.count, prevAgg.count),
    better: 'down'
  }, {
    v: sessions.length,
    l: 'Sessions',
    tip: 'Regroupées si < 4h',
    delta: pctChange(sessions.length, prevSessions.length),
    better: 'down'
  }, {
    v: `${(agg.volumeCl / 100).toFixed(1)}L`,
    l: 'Volume',
    delta: pctChange(agg.volumeCl, prevAgg.volumeCl),
    better: 'down'
  }, {
    v: `${Math.round(agg.grams)}g`,
    l: 'Alcool pur',
    delta: pctChange(agg.grams, prevAgg.grams),
    better: 'down'
  }, {
    v: agg.uniqueCount,
    l: 'Boissons diff.',
    delta: pctChange(agg.uniqueCount, prevAgg.uniqueCount),
    better: 'up'
  }];
  if (period === 'week' || period === 'month' || period === 'year' || period === 'school') {
    cards.push({
      v: sober,
      l: 'Jours sobres',
      delta: pctChange(sober, prevDrinks ? Math.max(0, days - new Set(prevDrinks.map(d => d.date)).size) : null),
      better: 'up'
    });
    cards.push({
      v: (agg.count / days).toFixed(1),
      l: 'Boissons/jour',
      delta: pctChange(agg.count / days, prevAgg.count / days),
      better: 'down'
    });
  }
  if (period === 'month' || period === 'year' || period === 'school') {
    const weeks = Math.max(1, days / 7);
    cards.push({
      v: (agg.count / weeks).toFixed(1),
      l: 'Boissons/sem.',
      delta: pctChange(agg.count / weeks, prevAgg.count / weeks),
      better: 'down'
    });
  }
  const catDist = Object.entries(agg.byCategory).map(([name, v]) => ({
    name,
    v
  }));
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "general",
    title: "Statistiques g\xE9n\xE9rales",
    sub: "Vue d'ensemble de votre consommation",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 8,
      marginBottom: 12
    }
  }, cards.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: T.surface,
      borderRadius: 14,
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
      fontFamily: fontSerif,
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.4,
      lineHeight: 1
    }
  }, c.v), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      marginTop: 5,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      lineHeight: 1.2
    }
  }, c.l), c.delta != null && period !== 'all' && /*#__PURE__*/React.createElement(DeltaBadge, {
    delta: c.delta,
    better: c.better
  })))), catDist.length > 0 && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
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
    const total = catDist.reduce((s, x) => s + x.v, 0);
    const pct = Math.round(d.v / total * 100);
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

// ── 2. Analyse temporelle ─────────────────────────────────────────
function TemporalSection({
  drinks,
  collapsed,
  toggleSection
}) {
  const agg = React.useMemo(() => aggregateGeneral(drinks), [drinks]);
  const peakHour = agg.byHour.indexOf(Math.max(...agg.byHour));
  const peakDow = agg.byDow.indexOf(Math.max(...agg.byDow));
  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const sessions = React.useMemo(() => computeSessions(drinks), [drinks]);
  const avgDuration = sessions.length > 0 ? sessions.reduce((s, x) => s + (x.endTs - x.startTs), 0) / sessions.length / 3600_000 : 0;
  const between = sessions.length > 1 ? (sessions[sessions.length - 1].startTs - sessions[0].endTs) / (sessions.length - 1) / 86400_000 : 0;
  const fmtH = h => {
    if (!h) return '—';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}`;
  };
  const dailyData = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, i) => {
    const dow = (i + 1) % 7;
    return {
      label,
      day: dow,
      v: agg.byDow[dow],
      today: dow === new Date().getDay()
    };
  });
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
    data: agg.byHour.map((v, h) => ({
      v,
      label: `${h}h`
    })),
    width: 320,
    height: 150,
    color: T.accent,
    formatX: (d, i) => i % 4 === 0 ? d.label : '',
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

// `better: 'down'` → red on rise / green on fall (e.g. consumption metrics).
// `better: 'up'`   → green on rise / red on fall (e.g. dry-day count).
function DeltaBadge({
  delta,
  better = 'down'
}) {
  if (delta == null || !isFinite(delta)) return null;
  const rising = delta > 0;
  const flat = Math.abs(delta) < 0.5;
  const goodWhenUp = better === 'up';
  const positive = flat ? null : rising ? goodWhenUp : !goodWhenUp;
  const color = positive == null ? T.muted : positive ? T.isDark ? 'oklch(72% 0.14 155)' : 'oklch(45% 0.13 155)' : T.isDark ? 'oklch(70% 0.18 30)' : 'oklch(50% 0.18 30)';
  const arrow = flat ? '→' : rising ? '↑' : '↓';
  const value = `${Math.abs(delta).toFixed(0)}%`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 8,
      right: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      color,
      fontSize: 9,
      fontFamily: fontNum,
      fontWeight: 600,
      background: T.surface2,
      padding: '1px 5px',
      borderRadius: 6,
      border: `1px solid ${T.rule}`,
      letterSpacing: 0
    },
    "aria-label": `${rising ? 'hausse' : 'baisse'} de ${value} vs période précédente`
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10
    }
  }, arrow), value);
}
function MiniStat({
  big,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderRadius: 14,
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
      background: i < 3 ? T.accent : T.surface2,
      color: i < 3 ? T.isDark ? T.bg : '#fff' : T.ink2,
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
    n: ratings[d.name] || 0,
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
// Widmark BAC computation.
//   bac(t) = 10 · (Σ grams_absorbed_by_t) / (weight·r) − elimRate·(t − t_first_drink)
// where 0.789 g/mL is ethanol density and `r` is Widmark's distribution
// factor. Each drink absorbs linearly over `absorpHours` (default 0.5 h)
// then contributes its full mass; elimination is a constant rate, NOT
// dose-dependent.
function computeBacOverTime(drinks, weight, gender) {
  const r = gender === 'female' ? 0.55 : 0.68;
  const w = weight || 70;
  const elimRate = 150; // mg/L/h elimination, ~ standard Widmark β
  const absorpHours = 0.5;
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
    absorpHours
  };

  // Mass absorbed by hour h (relative to "now") for drink i.
  const grams = recent.map(d => toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789);
  const tStart = recent.map(d => (d._ts - now) / 3600_000); // negative hours

  function bacAt(h) {
    // Total absorbed alcohol at time `h` (h=0 is now, positive = future)
    let absorbed = 0;
    let earliest = +Infinity;
    for (let i = 0; i < recent.length; i++) {
      const since = h - tStart[i]; // hours after this drink
      if (since <= 0) continue;
      earliest = Math.min(earliest, tStart[i]);
      const frac = since >= absorpHours ? 1 : since / absorpHours;
      absorbed += grams[i] * frac;
    }
    if (absorbed <= 0) return 0;
    // Bac in mg/L. Widmark output is ‰ (per-mil); ×100 → mg/dL; ×10 → mg/L.
    const peak = absorbed * 1000 / (w * r); // mg/L if no elimination
    // Elimination since first drink, capped at "since first drink" — but
    // we cap further at the time since absorption started so we never
    // subtract for periods where no alcohol was metabolised yet.
    const elimDuration = Math.max(0, h - earliest);
    const eliminated = elimDuration * elimRate;
    return Math.max(0, peak - eliminated);
  }

  // Sample from one hour before the first drink to twelve hours ahead,
  // every 5 minutes, so the scrubber feels smooth.
  const tMin = Math.min(0, tStart[0] - 0.25);
  const tMax = 12;
  const step = 5 / 60;
  const pts = [];
  for (let t = tMin; t <= tMax + 1e-6; t += step) {
    pts.push({
      t: +t.toFixed(3),
      bac: Math.round(bacAt(t))
    });
  }
  return {
    points: pts,
    current: Math.round(bacAt(0)),
    drinks: recent,
    elimRate,
    absorpHours
  };
}
function BACSection({
  drinks,
  allDrinks,
  settings,
  collapsed,
  toggleSection
}) {
  const records = useBacRecords();
  const weight = settings.userWeight ? Number(settings.userWeight) : 70;
  const gender = settings.userGender || 'male';
  const bacInfo = React.useMemo(() => computeBacOverTime(allDrinks, weight, gender), [allDrinks, weight, gender]);
  const currentBAC = bacInfo.current;
  const level = bacLevel(currentBAC);
  const hoursToSober = currentBAC / 150;
  const hoursToLegal = Math.max(0, (currentBAC - 500) / 150);
  const fmtTime = h => {
    if (h <= 0) return '—';
    const hh = Math.floor(h),
      mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')}`;
  };
  const relevantDrinks = bacInfo.drinks.slice(-3).reverse().map(d => ({
    name: d.name,
    qty: `${d.quantity} ${d.unit}`,
    abv: d.alcoholContent || 0,
    hoursAgo: ((Date.now() - new Date(`${d.date}T${d.time}`).getTime()) / 3600_000).toFixed(1)
  }));

  // Cap the displayed records at 3 highest values to keep the section
  // focused on milestones rather than a long history.
  const sortedRecords = [...records].sort((a, b) => b.bacValue - a.bacValue).slice(0, 3);
  const highest = sortedRecords[0];
  const others = sortedRecords.slice(1);
  const onDelete = async record => {
    const ok = await Confirm.ask({
      title: 'Supprimer ce record ?',
      message: `Le pic à ${record.bacValue} mg/L sera retiré.`,
      confirmText: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    try {
      await window.dbManager.deleteBACRecord(record.id);
      window.dataBus && window.dataBus.bump();
    } catch {}
  };
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
      background: T.surface2,
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
      background: T.surface2,
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
  }, "Projection d'alcool\xE9mie"), /*#__PURE__*/React.createElement(SvgBACProjection, {
    points: bacInfo.points,
    width: 320,
    height: 150,
    now: 0
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginTop: 6,
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Glissez le doigt sur le graphe pour voir le taux \xE0 un moment pr\xE9cis")), relevantDrinks.length > 0 && /*#__PURE__*/React.createElement(Card, {
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
  }, "il y a ", d.hoursAgo, "h")))), records.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
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
  }, records.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, highest && /*#__PURE__*/React.createElement(BACRecordRow, {
    record: highest,
    isHighest: true,
    onDelete: onDelete
  }), others.map(r => /*#__PURE__*/React.createElement(BACRecordRow, {
    key: r.id,
    record: r,
    onDelete: onDelete
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
function BACRecordRow({
  record,
  isHighest,
  onDelete
}) {
  const swipe = useSwipeToDelete(() => onDelete && onDelete(record), 96);
  const level = bacLevel(record.bacValue);
  const d = new Date(record.timestamp || record.date);
  const today = new Date();
  const daysAgo = Math.floor((today - d) / 86400_000);
  const dateLabel = daysAgo === 0 ? `Aujourd'hui à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : daysAgo === 1 ? `Hier à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : daysAgo < 7 ? `${daysAgo} jours · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}` : `${d.getDate()} ${FR_MONTHS_DOTTED[d.getMonth()]} · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'oklch(45% 0.18 25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 20,
      color: '#fff',
      fontSize: 12,
      fontWeight: 500,
      gap: 8,
      cursor: 'pointer'
    },
    onClick: () => onDelete && onDelete(record)
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.trash,
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Supprimer")), /*#__PURE__*/React.createElement("div", _extends({}, swipe.handlers, {
    style: {
      position: 'relative',
      background: T.surface,
      borderRadius: 14,
      border: `1px solid ${isHighest ? level.color : T.rule}`,
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      transform: `translateX(${swipe.offset}px)`,
      transition: swipe.dragging ? 'none' : 'transform 0.22s ease',
      touchAction: 'pan-y',
      boxShadow: isHighest ? `0 0 0 1px ${level.color}40, 0 4px 12px ${level.color}20` : 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 99,
      background: level.color,
      flexShrink: 0,
      boxShadow: `0 0 8px ${level.color}80`
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
      background: 'oklch(28% 0.04 65)',
      padding: '1px 6px',
      borderRadius: 99,
      border: `1px solid oklch(38% 0.05 65)`,
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
  }, dateLabel, " \xB7 ", record.drinkCount || 0, " conso", (record.drinkCount || 0) > 1 ? 's' : ''))));
}
// ── 6. Carte des lieux ────────────────────────────────────────────
// Renders a Leaflet map with one marker per geolocated drink in the
// selected period. We dynamically inject the Leaflet CSS+JS once
// (avoiding the cost on devices that never reach the stats tab) and
// rebuild the map whenever the underlying drink list changes.
function MapSection({
  drinks,
  collapsed,
  toggleSection
}) {
  const isOpen = !collapsed.has('map');
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const [ready, setReady] = React.useState(typeof window !== 'undefined' && !!window.L);
  const [error, setError] = React.useState(null);

  // Drinks with valid coordinates (top-level or nested in `location`).
  const geoDrinks = React.useMemo(() => drinks.filter(d => {
    const lat = d.latitude ?? d.location?.latitude;
    const lng = d.longitude ?? d.location?.longitude;
    return Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng));
  }), [drinks]);

  // Lazy-load Leaflet on first open of this section.
  React.useEffect(() => {
    if (!isOpen || ready) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (!document.getElementById('alco-leaflet-css')) {
          const css = document.createElement('link');
          css.id = 'alco-leaflet-css';
          css.rel = 'stylesheet';
          css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          css.crossOrigin = '';
          document.head.appendChild(css);
        }
        if (!window.L) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.id = 'alco-leaflet-js';
            s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            s.crossOrigin = '';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
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
    if (!L || typeof L.map !== 'function') return;
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
      zoomControl: true,
      preferCanvas: true
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(m);
    L.control.attribution({
      position: 'bottomright',
      prefix: false
    }).addAttribution('© OSM').addTo(m);
    for (const p of points) {
      const where = p.d.location?.name || p.d.location?.address || '';
      L.circleMarker([p.lat, p.lng], {
        radius: 7,
        weight: 2,
        color: 'rgba(180,90,40,0.95)',
        fillColor: 'rgba(220,140,70,0.85)',
        fillOpacity: 0.85
      }).bindPopup(`<b>${p.d.name || ''}</b><br>${p.d.date || ''} · ${p.d.time || ''}${where ? '<br>' + where : ''}`).addTo(m);
    }
    if (points.length === 1) {
      m.setView([points[0].lat, points[0].lng], 14);
    } else {
      m.fitBounds(bounds, {
        padding: [16, 16],
        maxZoom: 14
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
  }, [isOpen, ready, geoDrinks]);
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "map",
    title: "Carte des consommations",
    sub: `${geoDrinks.length} consommation${geoDrinks.length !== 1 ? 's' : ''} géolocalisée${geoDrinks.length !== 1 ? 's' : ''}`,
    collapsed: collapsed,
    toggleSection: toggleSection
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    style: {
      width: '100%',
      height: 260,
      borderRadius: 12,
      overflow: 'hidden',
      background: T.surface2,
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
  }, "Aucune consommation g\xE9olocalis\xE9e pour cette p\xE9riode"))));
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
  toggleSection
}) {
  const agg = aggregateGeneral(drinks);
  const sessions = computeSessions(drinks);
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
    color: `${T.accent}40`,
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
  }, scr.handlers), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("g", {
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
  getPeriodRange,
  shiftAnchor,
  periodLabel,
  computeBacOverTime
});
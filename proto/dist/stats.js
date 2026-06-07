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

// `scope` namespaces the persisted key so a friend's StatsTab (storageScope
// 'friend:<id>') keeps its own collapsed/period state without clobbering the
// user's own Stats tab. Empty scope → the original key (unchanged behaviour).
function _statsKey(base, scope) {
  return scope ? `${base}.${scope}` : base;
}
function loadCollapsedSections(scope) {
  try {
    return new Set(JSON.parse(localStorage.getItem(_statsKey(STATS_COLLAPSED_KEY, scope)) || '[]'));
  } catch {
    return new Set();
  }
}
function saveCollapsedSections(set, scope) {
  try {
    localStorage.setItem(_statsKey(STATS_COLLAPSED_KEY, scope), JSON.stringify([...set]));
  } catch {}
}

// One-time cleanup: the BAC-records masking feature was removed (records
// are now read-only), so drop its orphaned localStorage key.
try {
  localStorage.removeItem('alconote.stats.hiddenBacRecords');
} catch {}
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
    stats.grams += ethanolGrams(cl, d.alcoholContent); // réutilise `cl` déjà calculé
    stats.unique.add((d.name || '').toLowerCase());
    const cat = d.category || 'Autre';
    stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    const hour = parseInt((d.time || '00:00').split(':')[0], 10);
    if (!isNaN(hour) && hour >= 0 && hour < 24) stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    const dow = new Date((d.date || '') + 'T00:00:00').getDay();
    if (!isNaN(dow)) stats.byDow[dow] += 1;
  }
  stats.uniqueCount = stats.unique.size;
  return stats;
}

// BAC-driven sessions: a session begins at the first drink that pushes
// BAC from 0 to >0 and ends exactly when BAC returns to 0 (Widmark
// model, linear absorption over BAC_ABSORPTION_H, linear elimination at
// `elimRate`). Replaces the legacy 4-hour gap heuristic so a "session"
// reflects a real drinking episode (matches the BAC projection curve and
// the "Temps bourré" / records-per-session features).
//
// Each session carries its own deterministic id (`sess::<startTs>`) so
// the user can mask individual records from the BAC list and the
// masking persists across renders without a DB write.
const BAC_ELIM_RATE = 150; // mg/L/h, standard Widmark β
const BAC_ABSORPTION_H = 0.5; // h, linear absorption window (alcohol fully absorbed 30 min after a drink)
const FORECAST_MAX_RATE_GPH = 60; // cap on the projected drinking pace (~6 standard drinks/h)
const FORECAST_HORIZON_H = 12; // h, max projected horizon rendered
const DEFAULT_WEIGHT_KG = 70; // poids supposé quand le profil ne renseigne rien
const WIDMARK_R_MALE = 0.68; // facteur de distribution de Widmark (homme)
const WIDMARK_R_FEMALE = 0.55; // facteur de distribution de Widmark (femme)

// Facteur de distribution de Widmark selon le genre. Source unique : la valeur
// vivait en dur dans les trois fonctions BAC.
function widmarkR(gender) {
  return gender === 'female' ? WIDMARK_R_FEMALE : WIDMARK_R_MALE;
}
function computeBACSessions(drinks, weight = DEFAULT_WEIGHT_KG, gender = 'male') {
  const r = widmarkR(gender);
  const w = weight || DEFAULT_WEIGHT_KG;
  const hour = 3600_000;
  const T = BAC_ABSORPTION_H; // absorption window, hours
  const elim = BAC_ELIM_RATE; // mg/L per hour

  const valid = drinks.filter(d => d.date && d.time).map(d => ({
    ...d,
    _ts: new Date(`${d.date}T${d.time}`).getTime()
  })).filter(d => Number.isFinite(d._ts)).sort((a, b) => a._ts - b._ts);
  if (valid.length === 0) return [];

  // Per-drink total contribution (mg/L), absorbed linearly over [_ts, _ts+T·h].
  for (const d of valid) {
    d._grams = drinkAlcoholGrams(d);
    d._peak = d._grams * 1000 / (w * r);
  }

  // With linear absorption the BAC curve is piecewise-linear: its slope only
  // changes when a drink starts absorbing (+peak/T per hour) or finishes one
  // window later (−peak/T). Walk these breakpoints, integrating each segment
  // exactly so a session closes at the precise instant BAC returns to 0, and
  // the peak (always on a breakpoint) is captured exactly.
  const bps = [];
  for (const d of valid) {
    bps.push({
      t: d._ts,
      dr: d._peak / T,
      d
    }); // absorption begins
    bps.push({
      t: d._ts + T * hour,
      dr: -d._peak / T
    }); // absorption ends
  }
  bps.sort((a, b) => a.t - b.t);
  const sessions = [];
  let cur = null;
  let bac = 0; // mg/L
  let rate = 0; // active absorption rate, mg/L per hour
  let t = bps[0].t;
  for (const bp of bps) {
    // Integrate from t up to this breakpoint at the current net slope.
    while (t < bp.t) {
      const net = rate - elim; // mg/L per hour
      const dh = (bp.t - t) / hour;
      if (bac <= 1e-9) {
        // At zero: stays zero unless absorption now outpaces elimination.
        const bacEnd = net > 0 ? net * dh : 0;
        if (cur) cur.area += (bac + bacEnd) / 2 * dh; // aire (trapèze)
        bac = bacEnd;
        t = bp.t;
        break;
      }
      if (net < 0) {
        const hZero = bac / -net; // hours until BAC reaches 0
        if (hZero <= dh) {
          if (cur) {
            cur.area += bac / 2 * hZero; // descente bac → 0 sur hZero
            cur.endTs = t + hZero * hour;
            cur.avgBac = cur.area / Math.max(1e-9, (cur.endTs - cur.startTs) / hour);
            cur = null;
          }
          bac = 0;
          t += hZero * hour;
          continue; // finish the rest of the segment at zero
        }
      }
      const bacEnd = Math.max(0, bac + net * dh);
      if (cur) cur.area += (bac + bacEnd) / 2 * dh; // aire (trapèze)
      bac = bacEnd;
      t = bp.t;
    }

    // Apply this breakpoint's slope change.
    rate += bp.dr;
    if (rate < 1e-9) rate = 0;

    // A drink-start breakpoint opens or extends a session.
    if (bp.d) {
      if (!cur) {
        cur = {
          id: 'sess::' + bp.d._ts,
          startTs: bp.d._ts,
          endTs: bp.d._ts,
          // provisional, set when the session closes
          lastDrinkTs: bp.d._ts,
          drinks: [bp.d],
          grams: bp.d._grams,
          peakBac: bac,
          peakTs: bp.d._ts,
          area: 0,
          // ∫ bac dt sur la session (mg/L·h)
          avgBac: 0 // = area / durée (mg/L), posé à la clôture
        };
        sessions.push(cur);
      } else {
        cur.drinks.push(bp.d);
        cur.lastDrinkTs = bp.d._ts;
        cur.grams += bp.d._grams;
      }
    }

    // The session peak always sits on a breakpoint, so re-check after each.
    if (cur && bac > cur.peakBac) {
      cur.peakBac = bac;
      cur.peakTs = bp.t;
    }
  }

  // Past the final breakpoint no absorption remains: decay straight to 0.
  if (cur) {
    const hZero = bac / elim;
    cur.area += bac / 2 * hZero; // dernière descente bac → 0
    cur.endTs = t + hZero * hour;
    cur.avgBac = cur.area / Math.max(1e-9, (cur.endTs - cur.startTs) / hour);
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
  const days = Math.floor(totalMin / 1440);
  const h = Math.round((totalMin - days * 1440) / 60);
  // The rounded hour can hit 24 (e.g. 1j 23h45 → "1j 24h"); carry it.
  if (h === 24) return `${days + 1}j`;
  return h === 0 ? `${days}j` : `${days}j ${h}h`;
}
// ── Main StatsTab ─────────────────────────────────────────────────
// `storageScope` namespaces the persisted period/collapsed state; `hideMap` /
// `hideBac` drop the sections that have no shared data for a friend's view
// (no GPS shared → no map; BAC only when the friend opted in to share body
// params). Defaults keep the user's own Stats tab identical.
// `bacAvailable` (défaut true = vue perso) : passé à false par FriendStatsView
// pour un ami qui ne partage pas son poids/sexe — on masque alors les cellules
// dérivées du modèle Widmark (Sessions / Temps bourré / % bourré) qui seraient
// sinon calculées avec un poids par défaut (70 kg) donc fausses.
function StatsTab({
  storageScope = '',
  hideMap = false,
  hideBac = false,
  hidePrice = false,
  bacAvailable = true
} = {}) {
  const {
    drinks
  } = useDrinks();
  const settings = useSettings();
  const [period, setPeriod] = React.useState(() => localStorage.getItem(_statsKey('alconote.stats.period', storageScope)) || 'week');
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [collapsed, setCollapsed] = React.useState(() => loadCollapsedSections(storageScope));
  React.useEffect(() => {
    try {
      localStorage.setItem(_statsKey('alconote.stats.period', storageScope), period);
    } catch {}
  }, [period, storageScope]);
  const toggleSection = id => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);else next.add(id);
      saveCollapsedSections(next, storageScope);
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
  const weight = Number(settings.userWeight) || DEFAULT_WEIGHT_KG;
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
    gender,
    bacAvailable
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
  }), /*#__PURE__*/React.createElement(GeneralSection, sp), /*#__PURE__*/React.createElement(TemporalSection, sp), /*#__PURE__*/React.createElement(CategorySection, sp), /*#__PURE__*/React.createElement(TopDrinksSection, sp), !hideBac && /*#__PURE__*/React.createElement(BACSection, sp), !hideMap && /*#__PURE__*/React.createElement(MapSection, sp), /*#__PURE__*/React.createElement(TrendsSection, sp), /*#__PURE__*/React.createElement(AdvancedSection, sp), !hidePrice && /*#__PURE__*/React.createElement(SpendingSection, sp)));
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
      padding: '12px 14px',
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
  }, sub)), action), /*#__PURE__*/React.createElement(Collapse, {
    open: isOpen
  }, /*#__PURE__*/React.createElement("div", {
    id: `alco-section-${id}`,
    style: {
      padding: 12
    }
  }, children)));
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
  prevBourreMs,
  bacAvailable = true
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
  // The current streak is a "right now" metric (consecutive days up to
  // today), so it's only meaningful when the viewed period contains
  // today — hide it when navigating to a past/future period.
  const periodIncludesToday = today >= range.start && today <= range.end;
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
    // « Sessions » et « Temps bourré » dérivent du modèle BAC (poids/sexe) :
    // masquées quand `bacAvailable` est faux (ami qui ne partage pas son BAC),
    // sinon elles seraient calculées avec un poids par défaut donc trompeuses.
    const out = [{
      v: agg.count,
      l: 'Boissons',
      delta: pctChange(agg.count, prevAgg ? prevAgg.count : null)
    }, ...(bacAvailable ? [{
      v: sessions.length,
      l: 'Sessions',
      delta: pctChange(sessions.length, prevSessions ? prevSessions.length : null)
    }] : []), {
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
    }, ...(bacAvailable ? [{
      v: fmtBourreTime(bourreMs),
      l: 'Temps bourré',
      delta: pctChange(bourreMs, prevBourreMs),
      icon: Ic.hourglass
    }] : [])];
    // "Tout" only: share of life spent drunk since the very first drink.
    // Counts BAC>0 time strictly up to "now" (not the projected
    // elimination tail) over (now − first drink), so it reads as a true
    // elapsed share. Pushed right after "Temps bourré" to pair the two.
    // Dérivé du BAC → masqué aussi quand `bacAvailable` est faux.
    if (period === 'all' && bacAvailable) {
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
  }, [agg, prevAgg, sessions, prevSessions, sober, prevSober, bourreMs, prevBourreMs, days, prevDays, period, drinks, bacAvailable]);

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
  }, streak > 0 && periodIncludesToday && /*#__PURE__*/React.createElement(HeroStatCard, {
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
    period: period,
    index: i
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
  period,
  index = 0
}) {
  const reduced = useReducedMotion();
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
      minHeight: 64,
      ...staggerStyle(index, {
        reduced
      })
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
  sessions,
  bacAvailable = true
}) {
  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const {
    peakHour,
    peakDow
  } = React.useMemo(() => ({
    peakHour: agg.byHour.indexOf(Math.max(...agg.byHour)),
    peakDow: agg.byDow.indexOf(Math.max(...agg.byDow))
  }), [agg]);
  const avgDuration = React.useMemo(() => sessions.length > 0 ? sessions.reduce((s, x) => s + (x.endTs - x.startTs), 0) / sessions.length / 3600_000 : 0, [sessions]);
  // Mean gap between consecutive sessions: Σ (sessions[i+1].start −
  // sessions[i].end) / (N − 1). The previous formula computed
  // (last.start − first.end) / (N−1), which conflates total elapsed
  // time with the per-pair gap and drifts whenever sessions overlap or
  // the spacing varies.
  const between = React.useMemo(() => {
    if (sessions.length < 2) return 0;
    let totalGap = 0;
    for (let i = 1; i < sessions.length; i++) {
      totalGap += sessions[i].startTs - sessions[i - 1].endTs;
    }
    return totalGap / (sessions.length - 1) / 86400_000;
  }, [sessions]);
  const fmtH = h => {
    if (!h) return '—';
    // Round to whole minutes first so e.g. 0.999h → "1h", not "0h 60".
    const totalMin = Math.round(h * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
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
  }), bacAvailable && /*#__PURE__*/React.createElement(MiniStat, {
    big: fmtH(avgDuration),
    label: "Dur\xE9e moy. session"
  }), bacAvailable && /*#__PURE__*/React.createElement(MiniStat, {
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
    // Precompute each category's most-logged drink here (once per data
    // change) instead of re-sorting `names` inside the render loop below.
    const out = Object.values(map);
    for (const e of out) {
      e.fav = Object.entries(e.names).sort((a, b) => b[1] - a[1])[0];
    }
    return out.sort((a, b) => b.count - a.count);
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
    const fav = c.fav;
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
      padding: '12px 12px',
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
// Widmark BAC computation with linear absorption over BAC_ABSORPTION_H (30 min):
// each drink ramps from 0 up to its full peak contribution across the
// absorption window after consumption, then the running total decays at a
// constant elimination rate (mg/L/h). At t = first drink, BAC = 0 and rises.
//   contrib_i(t) = peak_i · clamp((t − t_i) / T_abs, 0, 1)
//   bac(t)       = max(0, Σ_i contrib_i(t) − elimRate·(t − t_first))
// `r` is Widmark's distribution factor (see `widmarkR`); the per-drink alcohol
// mass in grams comes from the shared `drinkAlcoholGrams` helper.
function computeBacOverTime(drinks, weight, gender) {
  const r = widmarkR(gender);
  const w = weight || DEFAULT_WEIGHT_KG;
  const elimRate = BAC_ELIM_RATE; // mg/L/h elimination (constante partagée du moteur BAC)
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

  // Per-drink peak contribution in mg/L — the full BAC each drink adds once
  // absorbed; bacAt() ramps it in linearly over BAC_ABSORPTION_H.
  const grams = recent.map(drinkAlcoholGrams);
  const peaks = grams.map(g => g * 1000 / (w * r));
  const tStart = recent.map(d => (d._ts - now) / 3600_000); // negative hours
  const firstT = tStart[0];
  function bacAt(h) {
    let absorbed = 0;
    for (let i = 0; i < recent.length; i++) {
      const dt = h - tStart[i];
      if (dt <= 0) continue;
      absorbed += peaks[i] * Math.min(1, dt / BAC_ABSORPTION_H);
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
// user keeps drinking at the same g/h pace until their mean historical
// drinking span (first → last drink) is reached, then declines at the
// standard Widmark elimination rate down to 0.
//
//   currentRateGph  = grams_so_far / max(5min, elapsed_in_session)
//   estStopMs       = sessionStart + mean(past drinking spans)
//   bac(t≤tStop)    = currentBac + (consumptionSlope − elimRate) · t
//   bac(t>tStop)    = bacAtStop − elimRate · (t − tStop)
//
// The function also returns the mean historical peak BAC and the ETA at
// which the projected curve first reaches that peak — `null` if the
// projection never gets there (which the chart renders as an "∞" marker
// pinned to the right edge).
function computeBacForecast(currentBac, allSessions, weight, gender, nowMs) {
  const r = widmarkR(gender);
  const w = weight || DEFAULT_WEIGHT_KG;
  const elimRate = BAC_ELIM_RATE; // mg/L/h, shared with the rest of the BAC engine

  const sessions = (allSessions || []).filter(s => s && s.drinks && s.drinks.length > 0);
  // The ongoing session is the one whose BAC window contains "now"
  // (first drink ≤ now ≤ sober-up end). Sessions are chronological and
  // never overlap, so there is at most one. Deriving it from the same
  // gap-based model as the records keeps the forecast consistent with
  // the rest of the BAC tab: a stray drink earlier in the 24 h window no
  // longer drags the session start hours into the past and tanks the rate.
  const ongoing = sessions.find(s => s.startTs <= nowMs && s.endTs >= nowMs) || null;
  const past = sessions.filter(s => s !== ongoing && s.endTs <= nowMs);
  const hasHistory = past.length >= 1;
  const hasCurrentSession = !!ongoing && currentBac > 0;
  const meanPeakBac = hasHistory ? past.reduce((s, x) => s + (x.peakBac || 0), 0) / past.length : null;
  // "Drinking span" = first drink → last drink, WITHOUT the sober-up
  // tail. Averaging `endTs − startTs` would bake the elimination tail
  // (peak / elimRate hours) into the duration and make the projection
  // assume the user keeps drinking long after they normally stop —
  // inflating the projected peak by hundreds of mg/L.
  const meanDrinkingMs = hasHistory ? past.reduce((s, x) => s + Math.max(0, (x.lastDrinkTs || x.startTs) - x.startTs), 0) / past.length : null;
  if (!hasCurrentSession) {
    return {
      currentRateGph: 0,
      meanDrinkingMs,
      estStopMs: null,
      meanPeakBac,
      projectedPoints: [],
      etaPeakHours: null,
      hasHistory,
      hasCurrentSession: false,
      sessionStartMs: nowMs
    };
  }
  const sessionStartMs = ongoing.startTs;
  // Pace = pure alcohol consumed so far / time since the session's first
  // drink. Reuse the grams computeBACSessions already attached (`_grams`)
  // so the unit formula lives in one place; only count drinks already
  // poured (≤ now) so a future-dated entry can't inflate the rate. Elapsed
  // is floored at the absorption window so a single just-logged drink
  // (≈0 elapsed) doesn't blow the rate up. Using "since the first drink"
  // (not the first→last span) lets the displayed pace taper naturally once
  // the user stops drinking instead of staying pinned at their peak cadence.
  // Capped at FORECAST_MAX_RATE_GPH as a physical backstop.
  const poured = ongoing.drinks.filter(d => d._ts <= nowMs);
  const totalGrams = poured.reduce((s, d) => s + (d._grams || 0), 0);
  const elapsedH = Math.max(BAC_ABSORPTION_H, (nowMs - sessionStartMs) / 3600_000);
  const currentRateGph = Math.min(totalGrams / elapsedH, FORECAST_MAX_RATE_GPH);

  // Project drinking at the current pace until the user would normally
  // stop (current session start + mean historical drinking span). No
  // history → assume they stop now and only the elimination tail shows.
  const estStopMs = meanDrinkingMs != null ? Math.max(nowMs, sessionStartMs + meanDrinkingMs) : nowMs;
  const consumptionSlope = currentRateGph * 1000 / (w * r); // mg/L/h injected by drinking
  const netSlope = consumptionSlope - elimRate;
  const tStopH = Math.max(0, (estStopMs - nowMs) / 3600_000);
  const bacAtStop = Math.max(0, currentBac + netSlope * tStopH);
  const tEndH = tStopH + bacAtStop / elimRate; // projected curve reaches 0 here
  // Cap the rendered horizon so a tall projected peak can't trail a
  // multi-hour flat tail that compresses the interesting part of the curve.
  const tLastH = Math.min(tEndH, FORECAST_HORIZON_H);
  const projectedPoints = [];
  const step = 1 / 60; // 1-min resolution, matches SvgBACForecast scrub granularity
  for (let t = 0; t <= tLastH + 1e-6; t += step) {
    const bac = t <= tStopH ? currentBac + netSlope * t // phase 1: drinking at current pace
    : bacAtStop - elimRate * (t - tStopH); // phase 2: elimination only
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
    meanDrinkingMs,
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

// Owns the single BAC computation and the 60s decay tick. Kept in its own
// provider (instead of inline in AppShell) so the tick re-renders ONLY the
// BacContext consumers — the header pill and the BAC stat section. <App/>
// passes a stable `children` element, so React bails out of re-rendering
// the rest of the shell (the three tabs) on every tick.
function BacProvider({
  children
}) {
  const {
    drinks
  } = useDrinks();
  const settings = useSettings();
  const [bacTick, setBacTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setBacTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const bacInfo = React.useMemo(() => {
    const w = Number(settings.userWeight) || DEFAULT_WEIGHT_KG;
    const g = settings.userGender || 'male';
    if (typeof computeBacOverTime !== 'function') return {
      current: 0,
      points: [],
      drinks: []
    };
    return computeBacOverTime(drinks, w, g);
    // bacTick is an intentional dep: it keeps the value decaying live even
    // when neither the drinks nor the Widmark settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinks, settings.userWeight, settings.userGender, bacTick]);
  return /*#__PURE__*/React.createElement(BacContext.Provider, {
    value: bacInfo
  }, children);
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
  const duration = forecast.meanDrinkingMs != null ? fmtTime(forecast.meanDrinkingMs / 3600_000) : '—';
  const peak = forecast.meanPeakBac != null ? `${Math.round(forecast.meanPeakBac)}` : '—';
  const eta = forecast.etaPeakHours === 0 ? 'maintenant' : forecast.etaPeakHours != null ? fmtTime(forecast.etaPeakHours) : forecast.meanPeakBac != null && forecast.hasCurrentSession ? '∞' : '—';
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
  sessions,
  prevSessions,
  period,
  weight,
  gender
}) {
  const bacInfo = useBacInfo();
  const currentBAC = bacInfo.current || 0;
  const level = bacLevel(currentBAC);

  // Taux moyen PAR SESSION sur la période : moyenne du taux intra-session
  // (∫ bac dt / durée, calculé dans computeBACSessions), puis moyenne de ces
  // moyennes sur les sessions de la période. En mg/L (comme le reste du BAC).
  const meanSessionBac = arr => {
    const xs = (arr || []).filter(s => s.avgBac > 0);
    return xs.length ? xs.reduce((s, x) => s + x.avgBac, 0) / xs.length : null;
  };
  const periodAvgSession = React.useMemo(() => meanSessionBac(sessions), [sessions]);
  const periodAvgDelta = React.useMemo(() => {
    const cur = meanSessionBac(sessions),
      prev = meanSessionBac(prevSessions);
    if (cur == null || prev == null || prev === 0) return null;
    return (cur - prev) / prev * 100;
  }, [sessions, prevSessions]);
  const [forecastEnabled, setForecastEnabledState] = React.useState(loadForecastEnabled);
  const setForecastEnabled = v => {
    setForecastEnabledState(v);
    saveForecastEnabled(v);
  };

  // Forecast is always computed (the toggle only governs visibility),
  // so other panels could reuse the same memo without forcing the user
  // to enable display.
  const forecast = React.useMemo(() => computeBacForecast(currentBAC, allSessions, weight, gender, Date.now()), [currentBAC, allSessions, weight, gender]);
  // Clip the realized curve to the ongoing session so "Prévision de
  // session" shows only the current episode + its projection, not the
  // last 24 h of unrelated (already-sober) sessions.
  const realPastPoints = React.useMemo(() => {
    const startRelH = (forecast.sessionStartMs - Date.now()) / 3600_000;
    return (bacInfo.points || []).filter(p => p.t <= 0 && p.t >= startRelH - 1e-6);
  }, [bacInfo.points, forecast.sessionStartMs]);
  const hoursToSober = currentBAC / 150;
  const hoursToLegal = Math.max(0, (currentBAC - 500) / 150);
  const fmtTime = h => {
    if (h <= 0) return '—';
    // Round to whole minutes first so e.g. 3.999h → "4h00", not "3h60".
    const totalMin = Math.round(h * 60);
    const hh = Math.floor(totalMin / 60),
      mm = totalMin % 60;
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
  }, fmtTime(hoursToLegal))))), periodAvgSession != null && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      marginBottom: 10,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 4
    }
  }, "Taux moyen par session"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink2,
      fontSize: 11,
      lineHeight: 1.4
    }
  }, "Moyenne intra-session, puis moyenne sur la p\xE9riode")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 24,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flexShrink: 0
    }
  }, Math.round(periodAvgSession), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: fontSans,
      fontSize: 12,
      color: T.ink2,
      marginLeft: 5
    }
  }, "mg/L"))), periodAvgDelta != null && period !== 'all' && /*#__PURE__*/React.createElement(DeltaBadge, {
    delta: periodAvgDelta
  })), bacInfo.points.length > 0 && /*#__PURE__*/React.createElement(Card, {
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
  }, "Consommations prises en compte (", bacInfo.drinks.length, ")", bacInfo.drinks.length > relevantDrinks.length ? ` · ${relevantDrinks.length} plus récentes` : ''), relevantDrinks.map((d, i) => /*#__PURE__*/React.createElement("div", {
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
  // Fixed full-scale: a level-relative cap makes the ring shrink when BAC
  // crosses a band boundary upward (e.g. 480→96 %, 520→52 %), which reads
  // as "drinking more empties the gauge". 1500 keeps the arc monotonic.
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
  // Compare calendar days (midnight to midnight) so a peak logged late
  // last night isn't labelled "Aujourd'hui" just after midnight.
  const dMid = new Date(d);
  dMid.setHours(0, 0, 0, 0);
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((todayMid - dMid) / 86400_000);
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
// Carte Leaflet des consommations géolocalisées (free : OSM via CARTO).
// Refonte : la carte est construite UNE fois à l'ouverture de la section
// puis mise à jour en place (clearLayers), ses couleurs étant pilotées par
// des variables CSS — aucune reconstruction au changement de données ni de
// thème. Tuiles claires/sombres suivant le thème, recentrage sur les
// données ou sur la position GPS (sans marqueur), taper un rond (point ou
// cluster) ouvre la liste regroupée de ses boissons, bascule points/heatmap
// et bascule Période/Tout. Leaflet, markercluster et leaflet.heat sont
// chargés à la demande au premier affichage.
const CARTO_TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
};
const CARTO_ATTR = '© OpenStreetMap, © CARTO';
const tileUrlForTheme = () => T.isDark ? CARTO_TILES.dark : CARTO_TILES.light;

// Pose les variables CSS de thème sur le conteneur de carte. Lues par les
// règles .alco-* (shared.jsx), elles rethèment marqueurs, clusters et
// contrôles sans toucher au DOM Leaflet.
function applyMapThemeVars(el) {
  if (!el) return;
  const set = (k, v) => el.style.setProperty(k, v);
  set('--alco-accent', T.accent);
  set('--alco-accent-ink', T.accentInk);
  set('--alco-surface', T.surface);
  set('--alco-surface2', T.surface2);
  set('--alco-ink', T.ink);
  set('--alco-rule', T.rule);
  set('--alco-muted', T.muted);
}

// SVG bruts (chaîne) pour les boutons de contrôle Leaflet, qui sont des
// nœuds DOM et non du JSX — mêmes tracés que Ic.expand / Ic.crosshair.
const _mapSvg = inner => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const MAP_ICON_RECENTER = _mapSvg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>');
const MAP_ICON_LOCATE = _mapSvg('<circle cx="12" cy="12" r="7"/><line x1="12" y1="1.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22.5" y2="12"/>');

// Regroupe une liste de boissons (les feuilles d'un cluster, ou un point
// isolé) par famille — même clé que buildFamilies, catégorie exclue — et
// compte les occurrences. Trié par fréquence décroissante puis par nom.
function groupDrinksForMap(drinks) {
  const map = new Map();
  for (const d of drinks || []) {
    const key = `${(d.name || '').trim().toLowerCase()}::${d.quantity}::${(d.unit || '').toLowerCase()}::${d.alcoholContent || 0}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: d.name || 'Boisson',
        category: d.category || 'Autre',
        quantity: d.quantity,
        unit: d.unit,
        alcohol: d.alcoholContent || 0,
        count: 0
      });
    }
    map.get(key).count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
}

// Liste déroulante (bottom sheet) des boissons d'un rond de la carte,
// regroupées par famille avec leur nombre. Remplace les anciennes popups
// Leaflet : un même geste — taper un rond — ouvre toujours cette liste,
// qu'il y ait une ou cinquante boissons dessous.
function MapDrinksSheet({
  drinks,
  onClose
}) {
  const groups = React.useMemo(() => groupDrinksForMap(drinks), [drinks]);
  const total = drinks ? drinks.length : 0;
  // Si toutes les boissons partagent un même libellé de lieu, on le met en
  // titre ; sinon un titre générique (le rond couvre plusieurs endroits).
  const sharedPlace = React.useMemo(() => {
    const places = new Set((drinks || []).map(d => drinkPlaceLabel(d)).filter(Boolean));
    return places.size === 1 ? Array.from(places)[0] : null;
  }, [drinks]);
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      maxHeight: '85dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      overflow: 'hidden',
      animation: 'slideUp 0.25s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: '10px 0 4px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 4,
      borderRadius: 99,
      background: T.rule
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 22px 16px',
      borderBottom: `1px solid ${T.rule}`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.4,
      lineHeight: 1.15,
      wordBreak: 'break-word'
    }
  }, sharedPlace || 'Consommations ici'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      marginTop: 6
    }
  }, total, " boisson", total !== 1 ? 's' : '', " \xB7 ", groups.length, " type", groups.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 32,
      height: 32,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      padding: 0,
      fontFamily: 'inherit',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'auto',
      padding: '14px 22px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderRadius: 14,
      border: `1px solid ${T.rule}`,
      overflow: 'hidden'
    }
  }, groups.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: g.key,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: i === groups.length - 1 ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      flexShrink: 0,
      background: catBg(g.category),
      color: catColor(g.category, 70),
      display: 'grid',
      placeItems: 'center',
      border: `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement(CategoryGlyph, {
    name: g.category,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSans,
      fontSize: 14,
      color: T.ink,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, g.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontNum,
      fontSize: 11,
      color: T.muted,
      marginTop: 2
    }
  }, g.quantity, " ", g.unit, " \xB7 ", g.alcohol, "\xB0")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 2,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontFamily: fontNum,
      fontSize: 12
    }
  }, "\xD7"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink,
      fontFamily: fontNum,
      fontSize: 17,
      letterSpacing: -0.3
    }
  }, g.count))))))));
}
function MapSection({
  drinks,
  allDrinks,
  collapsed,
  toggleSection
}) {
  const isOpen = !collapsed.has('map');
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const clusterRef = React.useRef(null);
  const heatRef = React.useRef(null);
  const tileRef = React.useRef(null);
  const boundsRef = React.useRef(null); // bounds du jeu courant (recentrage)
  const [ready, setReady] = React.useState(typeof window !== 'undefined' && !!window.L && !!(window.L && window.L.markerClusterGroup));
  const [error, setError] = React.useState(null);
  const [scope, setScope] = React.useState('period'); // 'period' | 'all'
  const [mode, setMode] = React.useState('points'); // 'points' | 'heat'
  // Boissons du rond tapé (cluster ou point isolé) → liste déroulante.
  const [listDrinks, setListDrinks] = React.useState(null);
  const source = scope === 'all' ? allDrinks || drinks : drinks;
  const heatReady = ready && typeof window !== 'undefined' && !!window.L && typeof window.L.heatLayer === 'function';

  // Boissons géolocalisées (coordonnées normalisées via getDrinkCoords).
  const geoPoints = React.useMemo(() => {
    const out = [];
    for (const d of source || []) {
      const c = getDrinkCoords(d);
      if (c) out.push({
        lat: c.lat,
        lng: c.lng,
        d
      });
    }
    return out;
  }, [source]);

  // ── Lazy-load Leaflet + markercluster (+ leaflet.heat, optionnel) ──
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
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded) resolve();else {
          existing.addEventListener('load', resolve);
          existing.addEventListener('error', reject);
        }
        return;
      }
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.crossOrigin = '';
      s.onload = () => {
        s.dataset.loaded = '1';
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    const load = async () => {
      try {
        loadCss('alco-leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        loadCss('alco-cluster-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
        if (!window.L) {
          await loadScript('alco-leaflet-js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        }
        if (!window.L.markerClusterGroup) {
          await loadScript('alco-cluster-js', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
        }
        if (!window.L.heatLayer) {
          // Heatmap optionnelle : un échec ne doit pas casser la carte.
          try {
            await loadScript('alco-heat-js', 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js');
          } catch {}
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

  // ── Construction de la carte (une fois par ouverture de section) ──
  // StatSection démonte ses enfants quand replié, donc on (re)construit à
  // l'ouverture et on détruit proprement au repli ; pendant qu'elle reste
  // ouverte, les données/le thème ne reconstruisent JAMAIS la carte.
  React.useEffect(() => {
    if (!isOpen || !ready || !containerRef.current || mapRef.current) return;
    const L = window.L;
    if (!L || typeof L.map !== 'function' || typeof L.markerClusterGroup !== 'function') return;
    applyMapThemeVars(containerRef.current);
    const m = L.map(containerRef.current, {
      attributionControl: true,
      zoomControl: true
    });
    m.setView([46.6, 2.4], 5); // vue par défaut (France) avant le 1er cadrage
    tileRef.current = L.tileLayer(tileUrlForTheme(), {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: CARTO_ATTR
    }).addTo(m);
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
      // taper un rond ouvre la liste, pas d'éclatement
      zoomToBoundsOnClick: false,
      // … et ne zoome pas non plus dessus
      maxClusterRadius: 44,
      iconCreateFunction: c => {
        const n = c.getChildCount();
        // Cercle dimensionné par paliers, chiffre dimensionné en conséquence ;
        // l'ancre explicite (size/2) garantit le centrage sur la coordonnée.
        const size = n < 10 ? 34 : n < 100 ? 40 : 48;
        const fs = n >= 100 ? 14 : 15;
        const r = size / 2 - 1.5; // place pour le halo (stroke 2px, centré)
        // Cercle + chiffre entièrement en SVG : le chiffre est centré par
        // text-anchor:middle + dominant-baseline:central, donc parfaitement
        // au milieu du rond, sans dépendre de la ligne de base de la police.
        const cx = size / 2;
        return L.divIcon({
          html: `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` + `<circle cx="${cx}" cy="${cx}" r="${r}"/>` + `<text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central" font-size="${fs}">${n}</text>` + `</svg>`,
          className: 'alco-cluster',
          iconSize: L.point(size, size),
          iconAnchor: L.point(cx, cx)
        });
      }
    });
    cluster.addTo(m);
    clusterRef.current = cluster;
    // Taper un cluster : ouvrir la liste regroupée de ses boissons.
    cluster.on('clusterclick', e => {
      const ds = e.layer.getAllChildMarkers().map(mk => mk.options.drink).filter(Boolean);
      setListDrinks(ds);
    });

    // Actions des contrôles : lisent les refs → toujours à jour.
    const recenter = () => {
      const b = boundsRef.current;
      if (b && b.isValid && b.isValid()) m.fitBounds(b, {
        padding: [28, 28],
        maxZoom: 15
      });
    };
    // Recentre la vue sur la position GPS de l'utilisateur, sans la
    // matérialiser : aucun marqueur n'est posé (recadrage seul, à la
    // demande explicite via le bouton).
    const locateMe = async btn => {
      btn && btn.setAttribute('aria-pressed', 'true');
      try {
        const pos = await getPosition(8000);
        const {
          latitude,
          longitude
        } = pos.coords;
        m.setView([latitude, longitude], 15);
      } catch (e) {
        Toast.show('Position indisponible');
      } finally {
        btn && btn.setAttribute('aria-pressed', 'false');
      }
    };
    const mkBtn = (svg, title, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'alco-map-ctrl';
      b.title = title;
      b.setAttribute('aria-label', title);
      b.innerHTML = svg;
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, 'click', e => {
        L.DomEvent.stop(e);
        onClick(b);
      });
      return b;
    };
    const Ctrls = L.Control.extend({
      options: {
        position: 'topright'
      },
      onAdd() {
        const wrap = L.DomUtil.create('div', 'alco-map-ctrls');
        wrap.appendChild(mkBtn(MAP_ICON_RECENTER, 'Recentrer', () => recenter()));
        wrap.appendChild(mkBtn(MAP_ICON_LOCATE, 'Ma position', b => locateMe(b)));
        return wrap;
      }
    });
    m.addControl(new Ctrls());
    mapRef.current = m;

    // Leaflet calcule parfois sa taille avant que le conteneur ait sa
    // hauteur finale (section juste dépliée) : on le relance, puis on
    // recadre avec les bounds posés par l'effet « marqueurs ».
    const kick = setTimeout(() => {
      try {
        m.invalidateSize();
        if (boundsRef.current) recenter();
      } catch {}
    }, 80);
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        try {
          m.invalidateSize();
        } catch {}
      });
      ro.observe(containerRef.current);
    }
    return () => {
      clearTimeout(kick);
      if (ro) {
        try {
          ro.disconnect();
        } catch {}
      }
      try {
        m.remove();
      } catch {}
      mapRef.current = null;
      clusterRef.current = null;
      heatRef.current = null;
      tileRef.current = null;
      boundsRef.current = null;
    };
  }, [isOpen, ready]);

  // ── Thème : variables CSS + URL des tuiles, sans reconstruction ──
  React.useEffect(() => {
    if (!mapRef.current) return;
    applyMapThemeVars(containerRef.current);
    if (tileRef.current) {
      try {
        tileRef.current.setUrl(tileUrlForTheme());
      } catch {}
    }
  }, [T._name]);

  // ── Marqueurs / heatmap : mise à jour EN PLACE (pas de rebuild) ──
  React.useEffect(() => {
    const m = mapRef.current,
      L = window.L;
    if (!m || !L || !clusterRef.current) return;
    clusterRef.current.clearLayers();
    if (heatRef.current) {
      try {
        m.removeLayer(heatRef.current);
      } catch {}
      heatRef.current = null;
    }
    if (geoPoints.length === 0) {
      boundsRef.current = null;
      return;
    }
    const latlngs = geoPoints.map(p => [p.lat, p.lng]);
    boundsRef.current = L.latLngBounds(latlngs);
    if (mode === 'heat' && typeof L.heatLayer === 'function') {
      heatRef.current = L.heatLayer(geoPoints.map(p => [p.lat, p.lng, 0.6]), {
        radius: 25,
        blur: 18,
        maxZoom: 16,
        minOpacity: 0.35
      }).addTo(m);
    } else {
      const dotIcon = L.divIcon({
        className: 'alco-pin',
        iconSize: L.point(14, 14),
        iconAnchor: L.point(7, 7)
      });
      for (const p of geoPoints) {
        // `drink` est relu via marker.options.drink à l'agrégation d'un cluster ;
        // taper un point isolé ouvre la même liste avec une seule boisson.
        const mk = L.marker([p.lat, p.lng], {
          icon: dotIcon,
          drink: p.d
        });
        mk.on('click', () => setListDrinks([p.d]));
        mk.addTo(clusterRef.current);
      }
    }
    if (geoPoints.length === 1) m.setView([geoPoints[0].lat, geoPoints[0].lng], 14);else m.fitBounds(boundsRef.current, {
      padding: [28, 28],
      maxZoom: 15
    });
  }, [geoPoints, mode, ready, isOpen]);
  const overlay = (txt, serif) => /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      background: T.surface2,
      color: T.muted,
      fontSize: 11,
      padding: 24,
      textAlign: 'center',
      zIndex: 1200,
      fontFamily: serif ? fontSerif : fontSans,
      fontStyle: serif ? 'italic' : 'normal'
    }
  }, txt);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatSection, {
    id: "map",
    title: "Carte des consommations",
    sub: `${geoPoints.length} consommation${geoPoints.length !== 1 ? 's' : ''} géolocalisée${geoPoints.length !== 1 ? 's' : ''}${scope === 'all' ? ' · tout l’historique' : ''}`,
    collapsed: collapsed,
    toggleSection: toggleSection
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: scope === 'period',
    onClick: () => setScope('period')
  }, "P\xE9riode"), /*#__PURE__*/React.createElement(Pill, {
    active: scope === 'all',
    onClick: () => setScope('all')
  }, "Tout")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), heatReady && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: mode === 'points',
    onClick: () => setMode('points')
  }, "Points"), /*#__PURE__*/React.createElement(Pill, {
    active: mode === 'heat',
    onClick: () => setMode('heat')
  }, "Chaleur"))), /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    style: {
      width: '100%',
      height: 'min(60vh, 440px)',
      borderRadius: 12,
      overflow: 'hidden',
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      position: 'relative',
      // Confine la pile z-index de Leaflet (contrôles jusqu'à z-index 1000)
      // pour que la liste déroulante (SheetOverlay, z-index 100) passe bien
      // au-dessus de la carte au lieu d'être masquée par ses contrôles.
      isolation: 'isolate'
    }
  }, !ready && !error && overlay('Chargement de la carte…', true), error && overlay(error, false), ready && geoPoints.length === 0 && overlay(scope === 'all' ? 'Aucune consommation géolocalisée' : 'Aucune consommation géolocalisée sur cette période — essayez « Tout »', true))), listDrinks && /*#__PURE__*/React.createElement(MapDrinksSheet, {
    drinks: listDrinks,
    onClose: () => setListDrinks(null)
  }));
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
      buckets[k].alcohol += drinkAlcoholGrams(d);
    }
    const dataMonths = Object.keys(buckets).sort();
    if (dataMonths.length < 2) return {
      labels: [],
      drinks: [],
      alcoholG: []
    };
    // Contiguous window of up to 6 calendar months ending at the most
    // recent month with data; empty months are filled with 0 so the line
    // reflects real month-to-month evolution instead of connecting
    // non-adjacent months as if they were consecutive.
    const parse = k => {
      const [y, m] = k.split('-').map(Number);
      return new Date(y, m - 1, 1);
    };
    const endD = parse(dataMonths[dataMonths.length - 1]);
    const firstD = parse(dataMonths[0]);
    const startD = new Date(endD);
    startD.setMonth(startD.getMonth() - 5);
    if (startD < firstD) startD.setTime(firstD.getTime());
    const keys = [];
    for (let d = new Date(startD); d <= endD; d.setMonth(d.getMonth() + 1)) {
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    // Append a 2-digit year only when the window straddles two calendar
    // years, so "Déc 24" / "Janv 25" don't read as the same month.
    const multiYear = new Set(keys.map(k => k.slice(0, 4))).size > 1;
    const label = k => {
      const [y, m] = k.split('-').map(Number);
      const base = FR_MONTHS_SHORT[m - 1].replace(/^[a-zà]/, c => c.toUpperCase());
      return multiYear ? `${base} ${String(y).slice(2)}` : base;
    };
    return {
      labels: keys.map(label),
      drinks: keys.map(k => buckets[k] ? buckets[k].drinks : 0),
      alcoholG: keys.map(k => buckets[k] ? Math.round(buckets[k].alcohol) : 0)
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
  sessions,
  bacAvailable = true
}) {
  const rolling = React.useMemo(() => {
    const byDay = {};
    for (const d of allDrinks) {
      if (!d.date) continue;
      byDay[d.date] = (byDay[d.date] || 0) + drinkAlcoholGrams(d);
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
    // Moving averages via a sliding-window accumulator: each running sum
    // gains the current day and drops the day that just left its 7-/30-day
    // window, so this is O(days) instead of O(days × 30) of re-summing a
    // fresh slice per day. Same windowed means as before.
    let sum7 = 0,
      sum30 = 0;
    for (let i = 0; i < out.length; i++) {
      sum7 += out[i].daily;
      sum30 += out[i].daily;
      if (i >= 7) sum7 -= out[i - 7].daily;
      if (i >= 30) sum30 -= out[i - 30].daily;
      out[i].r7 = sum7 / Math.min(i + 1, 7);
      out[i].r30 = sum30 / Math.min(i + 1, 30);
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
    sub: bacAvailable ? 'Moyennes mobiles · Horloge · Distribution des sessions' : 'Moyennes mobiles · Horloge'
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
  })), bacAvailable && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
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

// ── 8. Dépenses ───────────────────────────────────────────────────
// Regroupe les prix réellement saisis par entrée (drink.price) en buckets
// temporels adaptés à la période : heure (Aujourd'hui), jour (Semaine/Mois),
// mois (Année/Année scolaire) ou année (Tout). Renvoie un tableau prêt pour
// SvgBarChart + un libellé d'unité + un éventuel formatX.
function bucketSpend(priced, period, range) {
  const round2 = x => Math.round(x * 100) / 100;
  const sum = {};
  const add = (k, v) => {
    sum[k] = (sum[k] || 0) + v;
  };
  if (period === 'today') {
    for (const d of priced) {
      const h = parseInt((d.time || '00:00').split(':')[0], 10);
      if (h >= 0 && h < 24) add(String(h), Number(d.price));
    }
    const data = [];
    for (let h = 0; h < 24; h++) data.push({
      label: `${h}h`,
      fullLabel: `${h}h`,
      v: round2(sum[String(h)] || 0)
    });
    return {
      data,
      unitLabel: 'par heure',
      formatX: (d, i) => i % 3 === 0 ? d.label : ''
    };
  }
  const granularity = period === 'year' || period === 'school' ? 'month' : period === 'all' ? 'year' : 'day';
  if (granularity === 'day') {
    for (const d of priced) {
      if (d.date) add(d.date, Number(d.price));
    }
    const start = new Date(range.start);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.end);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last = end < today ? end : today; // pas de jours futurs vides
    const data = [];
    for (let dt = new Date(start); dt <= last; dt = _addDays(dt, 1)) {
      const k = _fmtIso(dt);
      data.push({
        label: `${dt.getDate()}/${dt.getMonth() + 1}`,
        fullLabel: `${dt.getDate()} ${FR_MONTHS_SHORT[dt.getMonth()]}`,
        v: round2(sum[k] || 0)
      });
    }
    return {
      data,
      unitLabel: 'par jour',
      formatX: null
    };
  }
  if (granularity === 'month') {
    for (const d of priced) {
      if (d.date) add(d.date.slice(0, 7), Number(d.price));
    }
    const start = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    const end = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    const multiYear = start.getFullYear() !== end.getFullYear();
    const data = [];
    for (let dt = new Date(start); dt <= end; dt.setMonth(dt.getMonth() + 1)) {
      const y = dt.getFullYear(),
        m = dt.getMonth();
      const k = `${y}-${String(m + 1).padStart(2, '0')}`;
      const base = FR_MONTHS_SHORT[m].replace(/^[a-zà]/, c => c.toUpperCase());
      data.push({
        label: multiYear ? `${base} ${String(y).slice(2)}` : base,
        fullLabel: `${base} ${y}`,
        v: round2(sum[k] || 0)
      });
    }
    return {
      data,
      unitLabel: 'par mois',
      formatX: (d, i) => i % 2 === 0 ? d.label : ''
    };
  }

  // année (Tout)
  for (const d of priced) {
    if (d.date) add(d.date.slice(0, 4), Number(d.price));
  }
  const years = Object.keys(sum).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const data = [];
  for (let y = years.length ? years[0] : 0; years.length && y <= years[years.length - 1]; y++) {
    data.push({
      label: `'${String(y).slice(2)}`,
      fullLabel: String(y),
      v: round2(sum[String(y)] || 0)
    });
  }
  return {
    data,
    unitLabel: 'par année',
    formatX: null
  };
}

// Section Dépenses. N'agrège QUE les entrées portant un prix saisi
// (drink.price != null). Le prix de référence vit en settings ; il n'est
// jamais partagé → la section est masquée en vue ami (StatsTab hidePrice).
function SpendingSection({
  drinks,
  prevDrinks,
  period,
  range,
  collapsed,
  toggleSection
}) {
  const isPriced = d => d && d.price != null && Number.isFinite(Number(d.price));
  const priced = React.useMemo(() => drinks.filter(isPriced), [drinks]);
  const total = React.useMemo(() => priced.reduce((s, d) => s + Number(d.price), 0), [priced]);
  const avg = priced.length ? total / priced.length : null;
  const prev = React.useMemo(() => {
    if (!prevDrinks) return {
      total: null,
      count: 0
    };
    let t = 0,
      n = 0;
    for (const d of prevDrinks) {
      if (isPriced(d)) {
        t += Number(d.price);
        n++;
      }
    }
    return {
      total: t,
      count: n
    };
  }, [prevDrinks]);
  const prevAvg = prev.count ? prev.total / prev.count : null;
  const pctChange = (cur, p) => p == null || p === 0 ? null : (cur - p) / p * 100;
  const byCat = React.useMemo(() => {
    const map = {};
    for (const d of priced) {
      const cat = d.category || 'Autre';
      if (!map[cat]) map[cat] = {
        name: cat,
        total: 0,
        count: 0
      };
      map[cat].total += Number(d.price);
      map[cat].count++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [priced]);
  const catDonut = React.useMemo(() => byCat.map(c => ({
    name: c.name,
    v: Math.round(c.total * 100) / 100
  })), [byCat]);
  const spend = React.useMemo(() => bucketSpend(priced, period, range), [priced, period, range]);
  if (priced.length === 0) {
    return /*#__PURE__*/React.createElement(StatSection, {
      id: "spending",
      title: "D\xE9penses",
      collapsed: collapsed,
      toggleSection: toggleSection,
      sub: "Co\xFBt de la consommation (prix saisis)"
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 12,
        padding: '8px 0',
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: fontSerif
      }
    }, "Aucun prix saisi sur cette p\xE9riode")));
  }
  return /*#__PURE__*/React.createElement(StatSection, {
    id: "spending",
    title: "D\xE9penses",
    collapsed: collapsed,
    toggleSection: toggleSection,
    sub: "Co\xFBt de la consommation (prix saisis)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(StatCell, {
    value: fmtPrice(total),
    label: "Total d\xE9pens\xE9",
    delta: pctChange(total, prev.total),
    period: period,
    index: 0
  }), /*#__PURE__*/React.createElement(StatCell, {
    value: fmtPrice(avg),
    label: "Prix moyen / boisson",
    delta: avg != null ? pctChange(avg, prevAvg) : null,
    period: period,
    index: 1
  })), byCat.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 12,
      letterSpacing: -0.1
    }
  }, "Par cat\xE9gorie"), /*#__PURE__*/React.createElement("div", {
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
    data: catDonut,
    size: 120,
    thickness: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, byCat.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.name,
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
      background: catColor(c.name, 65)
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink,
      flex: 1,
      letterSpacing: -0.1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontFamily: fontNum
    }
  }, fmtPrice(c.total))))))), spend.data.length > 0 && /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 12.5,
      fontWeight: 500,
      marginBottom: 10,
      letterSpacing: -0.1
    }
  }, "D\xE9penses ", spend.unitLabel), /*#__PURE__*/React.createElement(SvgBarChart, {
    data: spend.data,
    width: 320,
    height: 160,
    color: T.accent,
    formatX: spend.formatX,
    formatTooltip: d => [d.fullLabel || d.label, fmtPrice(d.v)]
  })));
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
  SpendingSection,
  bucketSpend,
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
  BacProvider,
  BACProjectionResponsive,
  computeBacForecast,
  BACForecastResponsive,
  ForecastToggle,
  ForecastMiniStats
});
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
  try { return new Set(JSON.parse(localStorage.getItem(STATS_COLLAPSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveCollapsedSections(set) {
  try { localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify([...set])); } catch {}
}

const PERIODS = [
  { id: 'today', label: 'Jour'    },
  { id: 'week',  label: 'Semaine' },
  { id: 'month', label: 'Mois'    },
  { id: 'year',  label: 'Année'   },
  { id: 'all',   label: 'Tout'    },
  { id: 'school', label: 'A. scol.' },
];

// BAC level classification — mirrors the legacy app --> never change the messages under no circumstances
const BAC_LEVELS = [
  { max: 500,      cls: 'caution', text: 'OK GARMIN, trouve mes clés de voiture',   color: 'oklch(75% 0.14 95)' },
  { max: 1000,     cls: 'warning', text: 'On nage dans le lac du BDC ?',            color: 'oklch(68% 0.14 50)' },
  { max: 1999,     cls: 'warning', text: '1 millions de bières svp',                color: 'oklch(65% 0.15 35)' },
  { max: 2999,     cls: 'danger',  text: 'Brieuc t\'abuses',                        color: 'oklch(60% 0.18 25)' },
  { max: Infinity, cls: 'danger',  text: 'Y a qu\'une personne pour arriver ici',   color: 'oklch(55% 0.20 20)' },
];

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
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function getPeriodRange(period, anchor) {
  const a = new Date(anchor);
  a.setHours(0, 0, 0, 0);
  const start = new Date(a), end = new Date(a);
  switch (period) {
    case 'today': break;
    case 'week': {
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
  return { start, end };
}

function shiftAnchor(period, anchor, dir) {
  const a = new Date(anchor);
  switch (period) {
    case 'today': a.setDate(a.getDate() + dir); break;
    case 'week':  a.setDate(a.getDate() + dir * 7); break;
    case 'month': a.setMonth(a.getMonth() + dir); break;
    case 'year':  a.setFullYear(a.getFullYear() + dir); break;
    case 'school': a.setFullYear(a.getFullYear() + dir); break;
    case 'all':   break;
  }
  return a;
}

function periodLabel(period, anchor) {
  const { start, end } = getPeriodRange(period, anchor);
  const sM = FR_MONTHS_LONG[start.getMonth()];
  const eM = FR_MONTHS_LONG[end.getMonth()];
  if (period === 'today') {
    return `${FR_DAYS_LONG[start.getDay()]} ${start.getDate()} ${sM}`;
  }
  if (period === 'week') {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} – ${end.getDate()} ${sM} ${end.getFullYear()}`;
    }
    return `${start.getDate()} ${sM.slice(0,4)}. – ${end.getDate()} ${eM.slice(0,4)}. ${end.getFullYear()}`;
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
  const sIso = _fmtIso(start), eIso = _fmtIso(end);
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
    byDow: [0, 0, 0, 0, 0, 0, 0],
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
  const sorted = drinks
    .filter(d => d.date && d.time)
    .map(d => ({ ...d, _ts: new Date(`${d.date}T${d.time}`).getTime() }))
    .sort((a, b) => a._ts - b._ts);
  const sessions = [];
  let cur = null;
  for (const d of sorted) {
    if (!cur || (d._ts - cur.endTs) > 4 * 3600_000) {
      cur = { startTs: d._ts, endTs: d._ts, drinks: [d], grams: 0 };
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
  const { drinks } = useDrinks();
  const settings = useSettings();
  const [period, setPeriod] = React.useState(() => localStorage.getItem('alconote.stats.period') || 'week');
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [collapsed, setCollapsed] = React.useState(loadCollapsedSections);

  React.useEffect(() => {
    try { localStorage.setItem('alconote.stats.period', period); } catch {}
  }, [period]);

  const toggleSection = (id) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    return { start, end: range.end };
  }, [period, range, drinks]);

  // Previous-period range, used to compute Δ% indicators on the
  // headline cards. For 'all' there's no meaningful previous range.
  const prevRange = React.useMemo(() => {
    if (period === 'all') return null;
    const prevAnchor = shiftAnchor(period, anchor, -1);
    return getPeriodRange(period, prevAnchor);
  }, [period, anchor]);

  const inRange = React.useMemo(() => filterDrinksInRange(drinks, allRange.start, allRange.end), [drinks, allRange]);
  const inPrevRange = React.useMemo(
    () => prevRange ? filterDrinksInRange(drinks, prevRange.start, prevRange.end) : null,
    [drinks, prevRange]
  );
  const sp = {
    collapsed, toggleSection, period, drinks: inRange, allDrinks: drinks,
    prevDrinks: inPrevRange, prevRange,
    settings, range: allRange, anchor,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PeriodSwitcher period={period} onChange={(p) => { setPeriod(p); setAnchor(new Date()); }} />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 120px' }}>
        <PeriodNav period={period} anchor={anchor} onShift={(d) => setAnchor(shiftAnchor(period, anchor, d))} />
        <GeneralSection {...sp} />
        <TemporalSection {...sp} />
        <CategorySection {...sp} />
        <TopDrinksSection {...sp} />
        <BACSection {...sp} />
        <MapSection {...sp} />
        <TrendsSection {...sp} />
        <AdvancedSection {...sp} />
      </div>
    </div>
  );
}

function PeriodSwitcher({ period, onChange }) {
  return (
    <div style={{
      display: 'flex', padding: '4px 16px 14px',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      <div role="tablist" aria-label="Période" style={{
        display: 'flex', gap: 2, padding: 3, background: T.surface2,
        borderRadius: 12, border: `1px solid ${T.rule}`, flexShrink: 0,
      }}>
        {PERIODS.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={period === p.id}
            onClick={() => onChange(p.id)} style={{
              padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
              background: period === p.id ? T.accent : 'transparent',
              color: period === p.id ? (T.isDark ? T.bg : '#fff') : T.ink2,
              fontSize: 12, fontWeight: period === p.id ? 600 : 400,
              letterSpacing: -0.1, whiteSpace: 'nowrap',
              border: 'none', fontFamily: 'inherit',
            }}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function PeriodNav({ period, anchor, onShift }) {
  const label = periodLabel(period, anchor);
  const arrowBtn = (icon, dir, label) => (
    <button type="button" onClick={() => onShift(dir)}
      disabled={period === 'all'} aria-label={label}
      style={{
        width: 32, height: 32, borderRadius: 10, background: T.surface2,
        display: 'grid', placeItems: 'center', color: T.ink2,
        border: `1px solid ${T.rule}`, cursor: period === 'all' ? 'not-allowed' : 'pointer',
        opacity: period === 'all' ? 0.4 : 1, padding: 0, fontFamily: 'inherit',
      }}>
      <SvgIcon icon={icon} size={14} />
    </button>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 4px 18px', gap: 8,
    }}>
      {arrowBtn(Ic.chevL, -1, 'Période précédente')}
      <div style={{
        fontFamily: fontSerif, fontSize: 18, color: T.ink,
        fontStyle: 'italic', letterSpacing: -0.3, textAlign: 'center', flex: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      {arrowBtn(Ic.chevR, 1, 'Période suivante')}
    </div>
  );
}

function StatSection({ id, title, action, children, sub, collapsed, toggleSection }) {
  const isOpen = !collapsed.has(id);
  return (
    <section style={{
      marginBottom: 14,
      background: T.surface,
      borderRadius: 16,
      border: `1px solid ${T.rule}`,
      overflow: 'hidden',
    }}>
      <button type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={isOpen}
        aria-controls={`alco-section-${id}`}
        style={{
          width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '11px 14px', background: 'transparent',
          borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          borderBottom: isOpen ? `1px solid ${T.rule}` : 'none',
          fontFamily: 'inherit', color: 'inherit',
        }}>
        <span style={{
          color: T.muted, transition: 'transform 0.2s ease',
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          display: 'flex', flexShrink: 0,
        }}>
          <SvgIcon icon={Ic.chev} size={12} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: T.ink, fontSize: 12.5, letterSpacing: 0.2, fontWeight: 500,
          }}>{title}</div>
          {sub && (
            <div style={{
              color: T.muted, fontSize: 10.5, marginTop: 2, letterSpacing: 0.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{sub}</div>
          )}
        </div>
        {action}
      </button>
      {isOpen && <div id={`alco-section-${id}`} style={{ padding: 12 }}>{children}</div>}
    </section>
  );
}

function Card({ children, style, ...rest }) {
  return (
    <div style={{
      background: T.surface2, borderRadius: 14, padding: 14,
      border: `1px solid ${T.rule}`, ...style,
    }} {...rest}>
      {children}
    </div>
  );
}
// ── 1. Général ────────────────────────────────────────────────────
function GeneralSection({ drinks, prevDrinks, prevRange, period, range, collapsed, toggleSection }) {
  const agg = React.useMemo(() => aggregateGeneral(drinks), [drinks]);
  const hasPrev = prevDrinks != null && prevRange != null;
  const prevAgg = React.useMemo(() => aggregateGeneral(hasPrev ? prevDrinks : []), [prevDrinks, hasPrev]);
  const sessions = React.useMemo(() => computeSessions(drinks), [drinks]);
  const prevSessions = React.useMemo(() => computeSessions(hasPrev ? prevDrinks : []), [prevDrinks, hasPrev]);
  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
  const prevDays = hasPrev
    ? Math.max(1, Math.round((prevRange.end - prevRange.start) / 86400000) + 1)
    : 0;
  // Sober-day count: only consider days from `range.start` up to `min(today, range.end)`,
  // so future days within the period don't inflate the count.
  const today = React.useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
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
  // Same calculation, but the previous period's window is fully past
  // so we always go to its real end.
  const prevSober = hasPrev ? (() => {
    const drinkDays = new Set(prevDrinks.map(d => d.date));
    let count = 0;
    for (let d = new Date(prevRange.start); d <= prevRange.end; d = _addDays(d, 1)) {
      if (!drinkDays.has(_fmtIso(d))) count++;
    }
    return count;
  })() : null;

  // Δ% helper — `null` baseline means we don't show a badge (e.g. no
  // previous period or it had zero of this metric).
  const pctChange = (cur, prev) => {
    if (prev == null || prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  };

  const cards = [
    { v: agg.count, l: 'Boissons',
      delta: pctChange(agg.count, prevAgg.count), better: 'down' },
    { v: sessions.length, l: 'Sessions', tip: 'Regroupées si < 4h',
      delta: pctChange(sessions.length, prevSessions.length), better: 'down' },
    { v: `${(agg.volumeCl / 100).toFixed(1)}L`, l: 'Volume',
      delta: pctChange(agg.volumeCl, prevAgg.volumeCl), better: 'down' },
    { v: `${Math.round(agg.grams)}g`, l: 'Alcool pur',
      delta: pctChange(agg.grams, prevAgg.grams), better: 'down' },
    { v: agg.uniqueCount, l: 'Boissons diff.',
      delta: pctChange(agg.uniqueCount, prevAgg.uniqueCount), better: 'up' },
  ];
  if (period === 'week' || period === 'month' || period === 'year' || period === 'school') {
    cards.push({ v: sober, l: 'Jours sobres',
      delta: pctChange(sober, prevSober),
      better: 'up' });
    cards.push({ v: (agg.count / days).toFixed(1), l: 'Boissons/jour',
      delta: pctChange(agg.count / days, prevDays ? prevAgg.count / prevDays : null),
      better: 'down' });
  }
  if (period === 'month' || period === 'year' || period === 'school') {
    const weeks = Math.max(1, days / 7);
    const prevWeeks = prevDays ? Math.max(1, prevDays / 7) : 0;
    cards.push({ v: (agg.count / weeks).toFixed(1), l: 'Boissons/sem.',
      delta: pctChange(agg.count / weeks, prevWeeks ? prevAgg.count / prevWeeks : null),
      better: 'down' });
  }

  const catDist = Object.entries(agg.byCategory).map(([name, v]) => ({ name, v }));

  return (
    <StatSection id="general" title="Statistiques générales" sub="Vue d'ensemble de votre consommation" collapsed={collapsed} toggleSection={toggleSection}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12,
      }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            background: T.surface2, borderRadius: 12, padding: '12px 10px',
            border: `1px solid ${T.rule}`, position: 'relative',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: 64,
          }}>
            <div style={{
              fontFamily: fontSerif, fontSize: 22, color: T.ink,
              letterSpacing: -0.4, lineHeight: 1,
            }}>{c.v}</div>
            <div style={{
              color: T.muted, fontSize: 9.5, marginTop: 5, letterSpacing: 0.3,
              textTransform: 'uppercase', lineHeight: 1.2,
            }}>{c.l}</div>
            {c.delta != null && period !== 'all' && (
              <DeltaBadge delta={c.delta} better={c.better} />
            )}
          </div>
        ))}
      </div>

      {catDist.length > 0 && (
        <Card>
          <div style={{
            color: T.ink, fontSize: 13, fontWeight: 500, marginBottom: 12, letterSpacing: -0.1,
          }}>Répartition par catégorie</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ flexShrink: 0 }}>
              <SvgDonut data={catDist} size={130} thickness={20} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {catDist.map(d => {
                const total = catDist.reduce((s, x) => s + x.v, 0);
                const pct = Math.round((d.v / total) * 100);
                return (
                  <div key={d.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 99, background: catColor(d.name, 65),
                    }}/>
                    <span style={{ color: T.ink, flex: 1, letterSpacing: -0.1 }}>{d.name}</span>
                    <span style={{ color: T.muted, fontFamily: fontNum }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {drinks.length === 0 && (
        <Card>
          <div style={{
            color: T.muted, fontSize: 12, padding: '12px 0', textAlign: 'center',
            fontStyle: 'italic', fontFamily: fontSerif,
          }}>Aucune donnée pour cette période</div>
        </Card>
      )}
    </StatSection>
  );
}

// ── 2. Analyse temporelle ─────────────────────────────────────────
function TemporalSection({ drinks, collapsed, toggleSection }) {
  const agg = React.useMemo(() => aggregateGeneral(drinks), [drinks]);
  const peakHour = agg.byHour.indexOf(Math.max(...agg.byHour));
  const peakDow = agg.byDow.indexOf(Math.max(...agg.byDow));
  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const sessions = React.useMemo(() => computeSessions(drinks), [drinks]);
  const avgDuration = sessions.length > 0
    ? sessions.reduce((s, x) => s + (x.endTs - x.startTs), 0) / sessions.length / 3600_000
    : 0;
  const between = sessions.length > 1
    ? (sessions[sessions.length - 1].startTs - sessions[0].endTs) / (sessions.length - 1) / 86400_000
    : 0;

  const fmtH = (h) => {
    if (!h) return '—';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return mm === 0 ? `${hh}h` : `${hh}h ${String(mm).padStart(2, '0')}`;
  };

  const dailyData = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, i) => {
    const dow = (i + 1) % 7;
    return { label, day: dow, v: agg.byDow[dow], today: dow === new Date().getDay() };
  });

  return (
    <StatSection id="temporal" title="Analyse temporelle" collapsed={collapsed} toggleSection={toggleSection} sub="Répartition par heures et jours">
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10,
      }}>
        <MiniStat big={drinks.length > 0 ? `${peakHour}h` : '—'} label="Heure de pointe" />
        <MiniStat big={drinks.length > 0 ? dayNames[peakDow] : '—'} label="Jour de pointe" />
        <MiniStat big={fmtH(avgDuration)} label="Durée moy. session" />
        <MiniStat big={between > 0 ? `${between.toFixed(1)}j` : '—'} label="Entre sessions" />
      </div>

      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 10, letterSpacing: -0.1,
        }}>Par heure</div>
        <SvgBarChart
          data={agg.byHour.map((v, h) => ({ v, label: `${h}h` }))}
          width={320} height={150} color={T.accent}
          formatX={(d, i) => i % 4 === 0 ? d.label : ''}
          valueLabel="boisson(s)"
        />
      </Card>

      <Card>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 4, letterSpacing: -0.1,
        }}>Par jour de la semaine</div>
        <SvgRadar data={dailyData} size={250} color={T.good} valueLabel="boisson(s)" />
      </Card>
    </StatSection>
  );
}

// `better: 'down'` → red on rise / green on fall (e.g. consumption metrics).
// `better: 'up'`   → green on rise / red on fall (e.g. dry-day count).
function DeltaBadge({ delta, better = 'down' }) {
  if (delta == null || !isFinite(delta)) return null;
  const rising = delta > 0;
  const flat = Math.abs(delta) < 0.5;
  const goodWhenUp = better === 'up';
  const positive = flat ? null : (rising ? goodWhenUp : !goodWhenUp);
  const fg = positive == null ? T.muted
           : positive ? (T.isDark ? 'oklch(78% 0.16 155)' : 'oklch(42% 0.14 155)')
                      : (T.isDark ? 'oklch(74% 0.20 30)'  : 'oklch(48% 0.20 30)');
  const bg = positive == null ? T.surface2
           : positive ? (T.isDark ? 'oklch(28% 0.05 155)' : 'oklch(95% 0.04 155)')
                      : (T.isDark ? 'oklch(28% 0.06 30)'  : 'oklch(95% 0.04 30)');
  const value = `${Math.abs(delta).toFixed(0)}%`;
  // Inline SVG arrows render identically across platforms (no font fallback).
  const arrow = flat ? (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="6" x2="10" y2="6"/><polyline points="7 3 10 6 7 9"/>
    </svg>
  ) : rising ? (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="10" x2="6" y2="2"/><polyline points="3 5 6 2 9 5"/>
    </svg>
  ) : (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="6" y1="2" x2="6" y2="10"/><polyline points="3 7 6 10 9 7"/>
    </svg>
  );
  const ariaDir = flat ? 'stable' : (rising ? 'hausse' : 'baisse');
  return (
    <div style={{
      position: 'absolute', top: 8, right: 8,
      display: 'inline-flex', alignItems: 'center', gap: 3,
      color: fg, fontSize: 9.5, fontFamily: fontNum, fontWeight: 600,
      background: bg, padding: '2px 6px', borderRadius: 99,
      border: `1px solid ${withAlpha(fg, 0.18)}`,
      letterSpacing: 0, lineHeight: 1,
    }} aria-label={`${ariaDir} de ${value} vs période précédente`}>
      {arrow}{value}
    </div>
  );
}

function MiniStat({ big, label }) {
  return (
    <div style={{
      background: T.surface2, borderRadius: 12, padding: '14px 10px',
      border: `1px solid ${T.rule}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: fontSerif, fontSize: 22, color: T.ink,
        letterSpacing: -0.3, lineHeight: 1,
      }}>{big}</div>
      <div style={{
        color: T.muted, fontSize: 10, marginTop: 6, letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}>{label}</div>
    </div>
  );
}
// ── 3. Analyse par catégorie ─────────────────────────────────────
function CategorySection({ drinks, collapsed, toggleSection }) {
  const byCat = React.useMemo(() => {
    const map = {};
    for (const d of drinks) {
      const cat = d.category || 'Autre';
      if (!map[cat]) map[cat] = { name: cat, count: 0, volumeCl: 0, abvSum: 0, abvN: 0, names: {} };
      const e = map[cat];
      e.count++;
      const cl = toCl(d.quantity, d.unit);
      e.volumeCl += cl;
      if (d.alcoholContent) { e.abvSum += d.alcoholContent; e.abvN++; }
      e.names[d.name] = (e.names[d.name] || 0) + 1;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [drinks]);

  if (byCat.length === 0) {
    return (
      <StatSection id="category" title="Analyse par catégorie" collapsed={collapsed} toggleSection={toggleSection} sub="Statistiques par type de boisson">
        <Card><div style={{
          color: T.muted, fontSize: 12, padding: '8px 0', textAlign: 'center',
          fontStyle: 'italic', fontFamily: fontSerif,
        }}>Aucune donnée</div></Card>
      </StatSection>
    );
  }

  return (
    <StatSection id="category" title="Analyse par catégorie" collapsed={collapsed} toggleSection={toggleSection} sub="Statistiques par type de boisson">
      <div style={{ display: 'grid', gap: 8 }}>
        {byCat.map(c => {
          const fav = Object.entries(c.names).sort((a, b) => b[1] - a[1])[0];
          const avgVol = c.count ? (c.volumeCl / c.count / 100) : 0;
          const avgAbv = c.abvN ? (c.abvSum / c.abvN) : 0;
          return (
            <Card key={c.name} style={{ padding: 14 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 99, background: catColor(c.name, 65),
                }}/>
                <div style={{ flex: 1, color: T.ink, fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                <div style={{
                  fontFamily: fontNum, fontSize: 13, color: T.accent, fontWeight: 500,
                }}>{c.count}×</div>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px 14px',
              }}>
                <StatRow label="Volume" value={`${(c.volumeCl / 100).toFixed(1)}L`} />
                <StatRow label="Volume moyen" value={`${avgVol.toFixed(2)}L`} />
                <StatRow label="Degré moyen" value={`${avgAbv.toFixed(1)}%`} />
                <StatRow label="Favorite" value={fav ? fav[0] : '—'} truncate />
              </div>
            </Card>
          );
        })}
      </div>
    </StatSection>
  );
}

function StatRow({ label, value, truncate }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 8,
      fontSize: 11, borderTop: `1px dashed ${T.rule}`, paddingTop: 5,
    }}>
      <span style={{ color: T.muted, letterSpacing: 0.1 }}>{label}</span>
      <span style={{
        color: T.ink2, fontFamily: fontNum,
        ...(truncate ? {
          maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        } : {}),
      }}>{value}</span>
    </div>
  );
}

// ── 4. Top 10 des boissons ────────────────────────────────────────
function TopDrinksSection({ drinks, collapsed, toggleSection }) {
  const ratings = useRatings();
  const top = React.useMemo(() => {
    const map = {};
    for (const d of drinks) {
      const key = d.name;
      if (!map[key]) {
        map[key] = { name: d.name, count: 0, volumeCl: 0, lastDate: null };
      }
      const e = map[key];
      e.count++;
      e.volumeCl += toCl(d.quantity, d.unit);
      if (!e.lastDate || (d.date || '') > e.lastDate) e.lastDate = d.date;
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [drinks]);

  if (top.length === 0) {
    return (
      <StatSection id="top" title="Top 10 des boissons" collapsed={collapsed} toggleSection={toggleSection} sub="Vos boissons les plus consommées">
        <Card><div style={{
          color: T.muted, fontSize: 12, padding: '8px 0', textAlign: 'center',
          fontStyle: 'italic', fontFamily: fontSerif,
        }}>Aucune donnée</div></Card>
      </StatSection>
    );
  }

  return (
    <StatSection id="top" title="Top 10 des boissons" collapsed={collapsed} toggleSection={toggleSection} sub="Vos boissons les plus consommées">
      <Card style={{ padding: '4px 4px' }}>
        {top.map((d, i) => (
          <div key={d.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 12px',
            borderBottom: i === top.length - 1 ? 'none' : `1px solid ${T.rule}`,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 8,
              background: i < 3 ? T.accent : T.surface3,
              color: i < 3 ? (T.isDark ? T.bg : '#fff') : T.ink2,
              display: 'grid', placeItems: 'center', flexShrink: 0,
              fontSize: 11, fontWeight: 600, fontFamily: fontNum,
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2,
              }}>
                <div style={{
                  color: T.ink, fontSize: 13, letterSpacing: -0.1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }}>{d.name}</div>
                <Stars n={ratings[d.name] || 0} size={10} />
              </div>
              <div style={{
                color: T.muted, fontSize: 10.5, letterSpacing: 0.1, fontFamily: fontNum,
              }}>
                {d.count} fois · {(d.volumeCl / 100).toFixed(2)}L · {fmtDateMedium(d.lastDate)}
              </div>
            </div>
            <div style={{
              fontFamily: fontNum, color: T.accent, fontSize: 13, fontWeight: 500,
            }}>{d.count}</div>
          </div>
        ))}
      </Card>
    </StatSection>
  );
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
  const recent = drinks
    .filter(d => d.date && d.time)
    .map(d => ({ ...d, _ts: new Date(`${d.date}T${d.time}`).getTime() }))
    .filter(d => d._ts <= now && (now - d._ts) <= lookback)
    .sort((a, b) => a._ts - b._ts);

  if (recent.length === 0) return { points: [], current: 0, drinks: [], elimRate, nowT: 0 };

  // Per-drink peak contribution in mg/L. With instantaneous absorption,
  // each drink jumps the BAC by `peak_i` at its consumption time.
  const grams = recent.map(d => toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789);
  const peaks = grams.map(g => (g * 1000) / (w * r));
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
  const sobrietyT = firstT + (totalPeak / elimRate);
  const tMin = firstT;                            // start exactly at first drink (BAC = peak_1)
  const tMax = Math.max(0.5, sobrietyT + 0.5);    // 30 min past sobriety, at least 30 min ahead
  const step = 1 / 60;                            // 1-minute resolution (smooth scrub)
  const pts = [];
  for (let t = tMin; t <= tMax + 1e-6; t += step) {
    pts.push({ t: +t.toFixed(4), bac: bacAt(t) });
  }
  return {
    points: pts,
    current: Math.round(bacAt(0)),
    drinks: recent,
    elimRate, nowT: 0,
    sobrietyT, firstT,
  };
}

function BACSection({ drinks, allDrinks, settings, collapsed, toggleSection }) {
  const records = useBacRecords();
  const weight = settings.userWeight ? Number(settings.userWeight) : 70;
  const gender = settings.userGender || 'male';

  const bacInfo = React.useMemo(
    () => computeBacOverTime(allDrinks, weight, gender),
    [allDrinks, weight, gender]
  );
  const currentBAC = bacInfo.current;
  const level = bacLevel(currentBAC);

  const hoursToSober = currentBAC / 150;
  const hoursToLegal = Math.max(0, (currentBAC - 500) / 150);

  const fmtTime = (h) => {
    if (h <= 0) return '—';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')}`;
  };

  const relevantDrinks = bacInfo.drinks.slice(-3).reverse().map(d => ({
    name: d.name,
    qty: `${d.quantity} ${d.unit}`,
    abv: d.alcoholContent || 0,
    hoursAgo: ((Date.now() - new Date(`${d.date}T${d.time}`).getTime()) / 3600_000).toFixed(1),
  }));

  // Cap the displayed records at 3 highest values to keep the section
  // focused on milestones rather than a long history.
  const sortedRecords = [...records].sort((a, b) => b.bacValue - a.bacValue).slice(0, 3);
  const highest = sortedRecords[0];
  const others = sortedRecords.slice(1);

  const onDelete = async (record) => {
    const ok = await Confirm.ask({
      title: 'Supprimer ce record ?',
      message: `Le pic à ${record.bacValue} mg/L sera retiré.`,
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try { await window.dbManager.deleteBACRecord(record.id); window.dataBus && window.dataBus.bump(); } catch {}
  };

  return (
    <StatSection id="bac" title="Alcoolémie" collapsed={collapsed} toggleSection={toggleSection} sub="Estimation BAC · Formule de Widmark">
      <Card style={{ padding: 16, marginBottom: 10 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 18, marginBottom: 14,
        }}>
          <BACGauge bac={currentBAC} level={level} />
        </div>
        <div style={{
          textAlign: 'center', color: level.color, fontSize: 13,
          fontWeight: 500, letterSpacing: 0.1, marginBottom: 14,
        }}>{level.text}</div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          <div style={{
            background: T.surface3, borderRadius: 12, padding: '12px 12px',
            border: `1px solid ${T.rule}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, justifyContent: 'center' }}>
              <SvgIcon icon={Ic.clock} size={12} color={T.muted}/>
              <div style={{ color: T.muted, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase' }}>Sobriété</div>
            </div>
            <div style={{
              fontFamily: fontSerif, fontSize: 20, color: T.ink, letterSpacing: -0.3,
            }}>{fmtTime(hoursToSober)}</div>
          </div>
          <div style={{
            background: T.surface3, borderRadius: 12, padding: '12px 12px',
            border: `1px solid ${T.rule}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, justifyContent: 'center' }}>
              <SvgIcon icon={Ic.car} size={12} color={T.muted}/>
              <div style={{ color: T.muted, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase' }}>Conduite (&lt;500)</div>
            </div>
            <div style={{
              fontFamily: fontSerif, fontSize: 20, color: T.ink, letterSpacing: -0.3,
            }}>{fmtTime(hoursToLegal)}</div>
          </div>
        </div>
      </Card>

      {bacInfo.points.length > 0 && (
        <Card style={{ marginBottom: 10 }}>
          <div style={{
            color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 8, letterSpacing: -0.1,
          }}>Projection d'alcoolémie</div>
          <SvgBACProjection
            points={bacInfo.points} width={320} height={170}
            nowMs={Date.now()}
          />
          <div style={{
            color: T.muted, fontSize: 10, marginTop: 6, fontStyle: 'italic', fontFamily: fontSerif,
          }}>Glissez le doigt sur le graphe pour voir le taux à un moment précis</div>
        </Card>
      )}

      {relevantDrinks.length > 0 && (
        <Card style={{ marginBottom: 10 }}>
          <div style={{
            color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 10, letterSpacing: -0.1,
          }}>Consommations prises en compte ({relevantDrinks.length})</div>
          {relevantDrinks.map((d, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderTop: i === 0 ? 'none' : `1px dashed ${T.rule}`,
            }}>
              <div style={{
                color: T.ink, fontSize: 12, flex: 1, letterSpacing: -0.1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{d.name}</div>
              <div style={{
                color: T.ink2, fontSize: 10.5, fontFamily: fontNum,
              }}>{d.qty} · {d.abv}%</div>
              <div style={{
                color: T.muted, fontSize: 10, fontFamily: fontNum, minWidth: 52, textAlign: 'right',
              }}>il y a {d.hoursAgo}h</div>
            </div>
          ))}
        </Card>
      )}

      {records.length > 0 && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            padding: '0 2px 8px',
          }}>
            <div style={{
              color: T.ink, fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
            }}>Records d'alcoolémie</div>
            <div style={{
              color: T.muted, fontSize: 10.5, fontFamily: fontNum,
              background: T.surface2, padding: '2px 8px', borderRadius: 99,
              border: `1px solid ${T.rule}`,
            }}>{records.length}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {highest && <BACRecordRow record={highest} isHighest onDelete={onDelete} />}
            {others.map(r => <BACRecordRow key={r.id} record={r} onDelete={onDelete} />)}
          </div>
        </div>
      )}
    </StatSection>
  );
}

function BACGauge({ bac, level }) {
  const size = 140, thickness = 10;
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const circ = 2 * Math.PI * r;
  const cap = 1500;
  const frac = Math.min(1, bac / cap);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.rule} strokeWidth={thickness} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={level.color}
          strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${frac * circ} ${circ}`}
          transform={`rotate(-90 ${cx} ${cy})`} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          fontFamily: fontSerif, fontSize: 36, color: T.ink,
          letterSpacing: -1, lineHeight: 1,
        }}>{bac}</div>
        <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1, marginTop: 2 }}>MG/L</div>
      </div>
    </div>
  );
}

function BACRecordRow({ record, isHighest, onDelete }) {
  const swipe = useSwipeToDelete(() => onDelete && onDelete(record), 96);
  const level = bacLevel(record.bacValue);
  const d = new Date(record.timestamp || record.date);
  const today = new Date();
  const daysAgo = Math.floor((today - d) / 86400_000);
  const dateLabel = daysAgo === 0 ? `Aujourd'hui à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
                  : daysAgo === 1 ? `Hier à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
                  : daysAgo < 7   ? `${daysAgo} jours · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
                                  : `${d.getDate()} ${FR_MONTHS_DOTTED[d.getMonth()]} · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
      <div style={{
        position: 'absolute', inset: 0, background: 'oklch(45% 0.18 25)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 20, color: '#fff', fontSize: 12, fontWeight: 500, gap: 8,
        cursor: 'pointer',
      }}
        onClick={() => onDelete && onDelete(record)}>
        <SvgIcon icon={Ic.trash} size={16} />
        <span>Supprimer</span>
      </div>
      <div
        {...swipe.handlers}
        style={{
          position: 'relative', background: T.surface2, borderRadius: 14,
          border: `1px solid ${isHighest ? level.color : T.rule}`,
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 12,
          transform: `translateX(${swipe.offset}px)`,
          transition: swipe.dragging ? 'none' : 'transform 0.22s ease',
          touchAction: 'pan-y',
          boxShadow: isHighest ? `0 0 0 1px ${withAlpha(level.color, 0.25)}, 0 4px 12px ${withAlpha(level.color, 0.12)}` : 'none',
        }}>
        <div style={{
          width: 10, height: 10, borderRadius: 99, background: level.color, flexShrink: 0,
          boxShadow: `0 0 8px ${withAlpha(level.color, 0.5)}`,
        }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2,
          }}>
            <span style={{
              fontFamily: fontSerif, fontSize: 17, color: T.ink,
              letterSpacing: -0.3, fontStyle: isHighest ? 'italic' : 'normal',
            }}>{record.bacValue}<span style={{ fontSize: 10, color: T.muted, fontStyle: 'normal', fontFamily: fontSans, marginLeft: 2 }}>mg/L</span></span>
            {isHighest && (
              <span style={{
                fontSize: 8.5, color: T.accent, background: 'oklch(28% 0.04 65)',
                padding: '1px 6px', borderRadius: 99, border: `1px solid oklch(38% 0.05 65)`,
                letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600,
              }}>Record</span>
            )}
          </div>
          <div style={{
            color: T.muted, fontSize: 10.5, letterSpacing: 0.1, fontFamily: fontNum,
          }}>{dateLabel} · {record.drinkCount || 0} conso{(record.drinkCount || 0) > 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  );
}
// ── 6. Carte des lieux ────────────────────────────────────────────
// Renders a Leaflet map with one marker per geolocated drink. Markers
// at the same / nearby locations are clustered via leaflet.markercluster
// — each cluster shows the count of drinks it contains. Leaflet and the
// markercluster plugin are lazy-loaded on first open of this section.
function MapSection({ drinks, collapsed, toggleSection }) {
  const isOpen = !collapsed.has('map');
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const [ready, setReady] = React.useState(
    typeof window !== 'undefined' && !!window.L && !!(window.L && window.L.markerClusterGroup)
  );
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
      css.id = id; css.rel = 'stylesheet'; css.href = href; css.crossOrigin = '';
      document.head.appendChild(css);
    };
    const loadScript = (id, src) => new Promise((resolve, reject) => {
      if (document.getElementById(id)) { resolve(); return; }
      const s = document.createElement('script');
      s.id = id; s.src = src; s.crossOrigin = '';
      s.onload = resolve; s.onerror = reject;
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
    return () => { cancelled = true; };
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
      try { mapRef.current.remove(); } catch {}
      mapRef.current = null;
    }
    if (geoDrinks.length === 0) return;
    const points = geoDrinks.map(d => ({
      lat: parseFloat(d.latitude ?? d.location.latitude),
      lng: parseFloat(d.longitude ?? d.location.longitude),
      d,
    }));
    const bounds = points.reduce(
      (b, p) => [
        [Math.min(b[0][0], p.lat), Math.min(b[0][1], p.lng)],
        [Math.max(b[1][0], p.lat), Math.max(b[1][1], p.lng)],
      ],
      [[points[0].lat, points[0].lng], [points[0].lat, points[0].lng]]
    );
    const m = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(m);
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© OSM').addTo(m);
    // Cluster styling: count badge inside a warm-toned circle, sized
    // up with the cluster's drink count for instant readability.
    const accent = T._name === 'light' ? 'rgba(180,90,40,0.92)' : 'rgba(220,140,70,0.92)';
    const clusterIcon = (cluster) => {
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
      return L.divIcon({ html, className: 'alco-cluster', iconSize: L.point(size, size) });
    };
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 40,
      iconCreateFunction: clusterIcon,
    });
    // Build popup content as DOM nodes so user-controlled fields
    // (drink name, location label) cannot inject HTML.
    const popupNode = (p) => {
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
      iconAnchor: L.point(7, 7),
    });
    for (const p of points) {
      L.marker([p.lat, p.lng], { icon: dotIcon })
        .bindPopup(popupNode(p))
        .addTo(cluster);
    }
    cluster.addTo(m);
    if (points.length === 1) {
      m.setView([points[0].lat, points[0].lng], 14);
    } else {
      m.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
    }
    mapRef.current = m;
    // Leaflet sometimes lays out before the container has its final
    // height (when the section was just expanded); kick it once.
    const id = setTimeout(() => { try { m.invalidateSize(); } catch {} }, 60);
    return () => {
      clearTimeout(id);
      try { m.remove(); } catch {}
      mapRef.current = null;
    };
  }, [isOpen, ready, geoDrinks, T._name]);

  return (
    <StatSection id="map" title="Carte des consommations"
      sub={`${geoDrinks.length} consommation${geoDrinks.length !== 1 ? 's' : ''} géolocalisée${geoDrinks.length !== 1 ? 's' : ''}`}
      collapsed={collapsed} toggleSection={toggleSection}>
      <div ref={containerRef} style={{
          width: '100%', height: 260, borderRadius: 12, overflow: 'hidden',
          background: T.surface2, border: `1px solid ${T.rule}`, position: 'relative',
        }}>
          {!ready && !error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              color: T.muted, fontSize: 11, fontFamily: fontSerif, fontStyle: 'italic',
            }}>Chargement de la carte…</div>
          )}
          {error && (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              color: T.muted, fontSize: 11, padding: 16, textAlign: 'center',
            }}>{error}</div>
          )}
          {ready && geoDrinks.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
              color: T.muted, fontSize: 11, fontFamily: fontSerif, fontStyle: 'italic',
              textAlign: 'center', padding: 24,
            }}>Aucune consommation géolocalisée pour cette période</div>
          )}
        </div>
    </StatSection>
  );
}

// ── 7. Évolution mensuelle ────────────────────────────────────────
function TrendsSection({ allDrinks, collapsed, toggleSection }) {
  const trends = React.useMemo(() => {
    const buckets = {};
    for (const d of allDrinks) {
      if (!d.date) continue;
      const k = d.date.slice(0, 7);
      if (!buckets[k]) buckets[k] = { drinks: 0, alcohol: 0 };
      buckets[k].drinks++;
      buckets[k].alcohol += toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789;
    }
    const keys = Object.keys(buckets).sort().slice(-6);
    return {
      labels: keys.map(k => FR_MONTHS_SHORT[parseInt(k.slice(5, 7), 10) - 1].replace(/^[a-zà]/, c => c.toUpperCase())),
      drinks: keys.map(k => buckets[k].drinks),
      alcoholG: keys.map(k => Math.round(buckets[k].alcohol)),
    };
  }, [allDrinks]);

  if (trends.labels.length < 2) {
    return (
      <StatSection id="trends" title="Évolution mensuelle" collapsed={collapsed} toggleSection={toggleSection} sub="Tendances de consommation mois par mois">
        <Card><div style={{
          color: T.muted, fontSize: 12, padding: '8px 0', textAlign: 'center',
          fontStyle: 'italic', fontFamily: fontSerif,
        }}>Pas assez d'historique (au moins 2 mois requis)</div></Card>
      </StatSection>
    );
  }

  return (
    <StatSection id="trends" title="Évolution mensuelle" collapsed={collapsed} toggleSection={toggleSection} sub="Tendances de consommation mois par mois">
      <Card>
        <SvgLineChart
          labels={trends.labels}
          series={[
            { data: trends.drinks },
            { data: trends.alcoholG },
          ]}
          width={320} height={170}
        />
        <div style={{
          display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8,
          fontSize: 10.5, color: T.ink2,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 2, background: T.accent }}/> Verres
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 14, height: 2, background: 'transparent',
              backgroundImage: `repeating-linear-gradient(90deg, ${T.accent2} 0 3px, transparent 3px 5px)`,
            }}/> Alcool (g)
          </span>
        </div>
      </Card>
    </StatSection>
  );
}

// ── 7. Analyses avancées ─────────────────────────────────────────
function AdvancedSection({ drinks, allDrinks, collapsed, toggleSection }) {
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
    const start = new Date(days[0]); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(0,0,0,0);
    const out = [];
    for (let d = new Date(start); d <= end; d = _addDays(d, 1)) {
      const k = _fmtIso(d);
      out.push({ date: `${d.getDate()}/${d.getMonth() + 1}`, daily: byDay[k] || 0 });
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
    const buckets = [
      { label: '<1h', v: 0 }, { label: '1-2h', v: 0 }, { label: '2-3h', v: 0 },
      { label: '3-4h', v: 0 }, { label: '4-5h', v: 0 }, { label: '5-6h', v: 0 }, { label: '6h+', v: 0 },
    ];
    for (const s of sessions) {
      const h = (s.endTs - s.startTs) / 3600_000;
      const idx = h < 1 ? 0 : h < 2 ? 1 : h < 3 ? 2 : h < 4 ? 3 : h < 5 ? 4 : h < 6 ? 5 : 6;
      buckets[idx].v++;
    }
    return buckets;
  }, [sessions]);

  return (
    <StatSection id="advanced" title="Analyses avancées" collapsed={collapsed} toggleSection={toggleSection} sub="Moyennes mobiles · Horloge · Distribution des sessions">
      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 3, letterSpacing: -0.1,
        }}>Moyenne mobile</div>
        <div style={{
          color: T.muted, fontSize: 10, marginBottom: 10, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Alcool quotidien lissé sur 7 et 30 jours</div>
        {rolling.length > 0 ? <RollingChart data={rolling} /> : (
          <div style={{ color: T.muted, fontSize: 11, padding: '12px 0', textAlign: 'center' }}>Aucune donnée</div>
        )}
        <div style={{
          display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6,
          fontSize: 10.5, color: T.ink2,
        }}>
          <LegendDot color={withAlpha(T.accent, 0.25)} label="Brut" />
          <LegendDot color={T.accent} label="7j" />
          <LegendDot color={T.ink2} label="30j" dashed />
        </div>
      </Card>

      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 3, letterSpacing: -0.1,
        }}>Horloge des consommations</div>
        <div style={{
          color: T.muted, fontSize: 10, marginBottom: 10, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Répartition sur 24 heures</div>
        <SvgPolarClock hours={agg.byHour} size={260} />
      </Card>

      <Card>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 3, letterSpacing: -0.1,
        }}>Distribution des sessions</div>
        <div style={{
          color: T.muted, fontSize: 10, marginBottom: 12, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Durée par session</div>

        <div>
          <div style={{
            color: T.ink2, fontSize: 10.5, marginBottom: 4, textAlign: 'center',
            letterSpacing: 0.3, textTransform: 'uppercase',
          }}>Durée</div>
          <SvgHistogram buckets={sessionDuration} width={320} height={150} color={T.accent} />
        </div>
      </Card>
    </StatSection>
  );
}

function RollingChart({ data }) {
  const width = 320, height = 160;
  const pad = { t: 12, r: 10, b: 26, l: 32 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = chartNiceMax(Math.max(1, ...data.flatMap(r => [r.daily, r.r7, r.r30])), 3);
  const n = data.length;
  const xs = i => pad.l + (i / Math.max(1, (n - 1))) * w;
  const ys = v => pad.t + h * (1 - v / max);
  const bw = w / n;

  const pathR7 = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r7)}`).join(' ');
  const pathR30 = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r30)}`).join(' ');

  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const rel = (p.x - pad.l) / w;
    const i = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
    setHover(i);
  });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      {[0, 0.5, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.l} x2={pad.l + w}
            y1={pad.t + h * f} y2={pad.t + h * f}
            stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
          <text x={pad.l - 4} y={pad.t + h * f + 3}
            fontSize={9} fill={T.muted} textAnchor="end" fontFamily={fontNum}>
            {Math.round(max * (1 - f))}g
          </text>
        </g>
      ))}
      {data.map((r, i) => {
        const bh = (r.daily / max) * h;
        return <rect key={i} x={xs(i) - bw * 0.35} y={pad.t + h - bh}
          width={bw * 0.7} height={bh} fill={T.accent}
          opacity={hover === i ? 0.55 : 0.25} rx={1} />;
      })}
      <path d={pathR7} fill="none" stroke={T.accent} strokeWidth={2} strokeLinejoin="round" />
      <path d={pathR30} fill="none" stroke={T.ink2} strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />
      {[0, Math.floor(n / 2), n - 1].map((i, k) => (
        data[i] && (
          <text key={k} x={xs(i)} y={height - 8}
            fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>{data[i].date}</text>
        )
      ))}
      {hover != null && (() => {
        const r = data[hover];
        const tx = xs(hover);
        const cy7 = ys(r.r7);
        return (
          <>
            <line x1={tx} x2={tx} y1={pad.t} y2={pad.t + h}
              stroke={T.ink2} strokeDasharray="2 3" strokeWidth={0.8} opacity={0.7} />
            <circle cx={tx} cy={ys(r.daily)} r={3} fill={T.accent} />
            <circle cx={tx} cy={cy7} r={3} fill={T.accent} stroke={T.bg} strokeWidth={1} />
            <circle cx={tx} cy={ys(r.r30)} r={3} fill={T.ink2} stroke={T.bg} strokeWidth={1} />
            <ChartTooltip x={tx} y={cy7} width={width}
              lines={[`${r.date}`, `${Math.round(r.daily)} g brut`,
                      `${r.r7.toFixed(1)} g · 7j`, `${r.r30.toFixed(1)} g · 30j`]} />
          </>
        );
      })()}
    </svg>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 14, height: 2, background: dashed ? 'transparent' : color,
        ...(dashed ? {
          backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`,
        } : {}),
      }}/> {label}
    </span>
  );
}
Object.assign(window, {
  StatsTab, PeriodSwitcher, PeriodNav,
  GeneralSection, TemporalSection, CategorySection,
  TopDrinksSection, BACSection, MapSection, TrendsSection, AdvancedSection,
  BACGauge, BACRecordRow, bacLevel, BAC_LEVELS,
  RollingChart, LegendDot, MiniStat, StatRow, Card, StatSection,
  DeltaBadge,
  getPeriodRange, shiftAnchor, periodLabel, computeBacOverTime,
});

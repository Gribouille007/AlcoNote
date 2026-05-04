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

// BAC level classification — mirrors the legacy app
const BAC_LEVELS = [
  { max: 200,      cls: 'safe',    text: 'Sobre',                color: 'oklch(72% 0.10 155)' },
  { max: 500,      cls: 'caution', text: 'Légèrement alcoolisé', color: 'oklch(75% 0.14 95)' },
  { max: 800,      cls: 'warning', text: 'Dépass. limite légale', color: 'oklch(68% 0.14 50)' },
  { max: 1999,     cls: 'warning', text: 'Ivresse',              color: 'oklch(65% 0.15 35)' },
  { max: 2999,     cls: 'danger',  text: 'Ivresse sévère',       color: 'oklch(60% 0.18 25)' },
  { max: Infinity, cls: 'danger',  text: 'Danger vital',         color: 'oklch(55% 0.20 20)' },
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

  const inRange = React.useMemo(() => filterDrinksInRange(drinks, allRange.start, allRange.end), [drinks, allRange]);
  const sp = { collapsed, toggleSection, period, drinks: inRange, allDrinks: drinks, settings, range: allRange };

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
      {arrowBtn(Ic.chev, 1, 'Période suivante')}
    </div>
  );
}

function StatSection({ id, title, action, children, sub, collapsed, toggleSection }) {
  const isOpen = !collapsed.has(id);
  return (
    <div style={{ marginBottom: 14 }}>
      <button type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={isOpen}
        aria-controls={`alco-section-${id}`}
        style={{
          width: '100%', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '11px 14px', background: T.surface, borderRadius: 14,
          border: `1px solid ${T.rule}`,
          marginBottom: isOpen ? 10 : 0,
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
      {isOpen && <div id={`alco-section-${id}`}>{children}</div>}
    </div>
  );
}

function Card({ children, style, ...rest }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 18, padding: 16,
      border: `1px solid ${T.rule}`, ...style,
    }} {...rest}>
      {children}
    </div>
  );
}
// ── 1. Général ────────────────────────────────────────────────────
function GeneralSection({ drinks, period, range, collapsed, toggleSection }) {
  const agg = React.useMemo(() => aggregateGeneral(drinks), [drinks]);
  const sessions = React.useMemo(() => computeSessions(drinks), [drinks]);
  const days = Math.max(1, Math.round((range.end - range.start) / 86400000) + 1);
  const sober = (() => {
    const drinkDays = new Set(drinks.map(d => d.date));
    let count = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(range.start); d.setDate(d.getDate() + i);
      if (!drinkDays.has(_fmtIso(d))) count++;
    }
    return count;
  })();

  const cards = [
    { v: agg.count, l: 'Boissons' },
    { v: sessions.length, l: 'Sessions', tip: 'Regroupées si < 4h' },
    { v: `${(agg.volumeCl / 100).toFixed(1)}L`, l: 'Volume' },
    { v: `${Math.round(agg.grams)}g`, l: 'Alcool pur' },
    { v: agg.uniqueCount, l: 'Boissons diff.' },
  ];
  if (period === 'week' || period === 'month' || period === 'year' || period === 'school') {
    cards.push({ v: sober, l: 'Jours sobres' });
    cards.push({ v: (agg.count / days).toFixed(1), l: 'Boissons/jour' });
  }
  if (period === 'month' || period === 'year' || period === 'school') {
    const weeks = Math.max(1, days / 7);
    cards.push({ v: (agg.count / weeks).toFixed(1), l: 'Boissons/sem.' });
  }

  const catDist = Object.entries(agg.byCategory).map(([name, v]) => ({ name, v }));

  return (
    <StatSection id="general" title="Statistiques générales" sub="Vue d'ensemble de votre consommation" collapsed={collapsed} toggleSection={toggleSection}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12,
      }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            background: T.surface, borderRadius: 14, padding: '12px 10px',
            border: `1px solid ${T.rule}`, position: 'relative',
          }}>
            <div style={{
              fontFamily: fontSerif, fontSize: 22, color: T.ink,
              letterSpacing: -0.4, lineHeight: 1,
            }}>{c.v}</div>
            <div style={{
              color: T.muted, fontSize: 9.5, marginTop: 5, letterSpacing: 0.3,
              textTransform: 'uppercase', lineHeight: 1.2,
            }}>{c.l}</div>
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
          width={320} height={130} color={T.accent}
          formatX={(d, i) => i % 4 === 0 ? d.label : ''}
        />
      </Card>

      <Card>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 4, letterSpacing: -0.1,
        }}>Par jour de la semaine</div>
        <SvgRadar data={dailyData} size={230} color={T.good} />
      </Card>
    </StatSection>
  );
}

function MiniStat({ big, label }) {
  return (
    <div style={{
      background: T.surface, borderRadius: 14, padding: '14px 10px',
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
              background: i < 3 ? T.accent : T.surface2,
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
// Widmark BAC computation. weight in kg, gender 'male'|'female'.
function computeBacOverTime(drinks, weight, gender) {
  // Returns array of { t: hours-from-now, bac: mg/L }
  const r = gender === 'female' ? 0.55 : 0.68;
  const w = weight || 70; // fallback
  const elimRate = 150; // mg/L/h elimination
  const absorpHours = 0.5; // half-hour to reach peak
  const now = Date.now();
  const recent = drinks
    .filter(d => d.date && d.time)
    .map(d => ({ ...d, _ts: new Date(`${d.date}T${d.time}`).getTime() }))
    .filter(d => (now - d._ts) <= 12 * 3600_000 && d._ts <= now)
    .sort((a, b) => a._ts - b._ts);

  if (recent.length === 0) return { points: [], current: 0, drinks: [] };

  const grams = recent.map(d => toCl(d.quantity, d.unit) * 10 * ((d.alcoholContent || 0) / 100) * 0.789);
  const startHours = recent.map(d => (now - d._ts) / 3600_000); // hours ago

  function bacAt(hoursFromNow) {
    let total = 0;
    for (let i = 0; i < recent.length; i++) {
      const tSinceDrink = startHours[i] + hoursFromNow; // hours since the drink at t=hoursFromNow
      if (tSinceDrink < 0) continue;
      const fullBac = (grams[i] * 1000) / (w * r * 10); // mg/L (=mg/dL*10)
      let factor;
      if (tSinceDrink < absorpHours) factor = tSinceDrink / absorpHours;
      else factor = Math.max(0, 1 - elimRate * (tSinceDrink - absorpHours) / Math.max(1, fullBac));
      total += Math.max(0, fullBac * factor);
    }
    return Math.max(0, total);
  }

  const pts = [];
  for (let t = -1; t <= 8; t += 0.25) pts.push({ t, bac: Math.round(bacAt(t)) });
  return { points: pts, current: Math.round(bacAt(0)), drinks: recent };
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

  const sortedRecords = [...records].sort((a, b) => b.bacValue - a.bacValue);
  const highest = sortedRecords[0];
  const others = sortedRecords.slice(1);

  const onDelete = async (id) => {
    try { await window.dbManager.deleteBACRecord(id); window.dataBus && window.dataBus.bump(); } catch {}
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
            background: T.surface2, borderRadius: 12, padding: '12px 12px',
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
            background: T.surface2, borderRadius: 12, padding: '12px 12px',
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
          <SvgBACProjection points={bacInfo.points} width={320} height={130} now={0} />
          <div style={{
            color: T.muted, fontSize: 10, marginTop: 6, fontStyle: 'italic', fontFamily: fontSerif,
          }}>Glissez pour voir le taux à un moment précis</div>
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
  const [swiped, setSwiped] = React.useState(false);
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
      }}
        onClick={() => onDelete(record.id)}>
        <SvgIcon icon={Ic.trash} size={16} />
        <span>Supprimer</span>
      </div>
      <div
        onClick={() => setSwiped(s => !s)}
        style={{
          position: 'relative', background: T.surface, borderRadius: 14,
          border: `1px solid ${isHighest ? level.color : T.rule}`,
          padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', transition: 'transform 0.2s ease',
          transform: swiped ? 'translateX(-96px)' : 'translateX(0)',
          boxShadow: isHighest ? `0 0 0 1px ${level.color}40, 0 4px 12px ${level.color}20` : 'none',
        }}>
        <div style={{
          width: 10, height: 10, borderRadius: 99, background: level.color, flexShrink: 0,
          boxShadow: `0 0 8px ${level.color}80`,
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
// ── 6. Évolution mensuelle ────────────────────────────────────────
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
          <LegendDot color={`${T.accent}40`} label="Brut" />
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
        <SvgPolarClock hours={agg.byHour} size={240} />
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
          <SvgHistogram buckets={sessionDuration} width={300} height={140} color={T.accent} />
        </div>
      </Card>
    </StatSection>
  );
}

function RollingChart({ data }) {
  const width = 320, height = 140;
  const pad = { t: 8, r: 6, b: 24, l: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = chartNiceMax(Math.max(1, ...data.flatMap(r => [r.daily, r.r7, r.r30])), 3);
  const n = data.length;
  const xs = i => pad.l + (i / Math.max(1, (n - 1))) * w;
  const ys = v => pad.t + h * (1 - v / max);
  const bw = w / n;

  const pathR7 = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r7)}`).join(' ');
  const pathR30 = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r30)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={pad.l + w}
          y1={pad.t + h * f} y2={pad.t + h * f}
          stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
      ))}
      <text x={pad.l - 4} y={pad.t + 4} fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>{max}g</text>
      <text x={pad.l - 4} y={pad.t + h + 3} fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>0</text>
      {data.map((r, i) => {
        const bh = (r.daily / max) * h;
        return <rect key={i} x={xs(i) - bw * 0.35} y={pad.t + h - bh}
          width={bw * 0.7} height={bh} fill={T.accent} opacity={0.25} rx={1} />;
      })}
      <path d={pathR7} fill="none" stroke={T.accent} strokeWidth={2} strokeLinejoin="round" />
      <path d={pathR30} fill="none" stroke={T.ink2} strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />
      {[0, Math.floor(n / 2), n - 1].map((i, k) => (
        data[i] && (
          <text key={k} x={xs(i)} y={height - 8}
            fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>{data[i].date}</text>
        )
      ))}
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
  TopDrinksSection, BACSection, TrendsSection, AdvancedSection,
  BACGauge, BACRecordRow, bacLevel, BAC_LEVELS,
  RollingChart, LegendDot, MiniStat, StatRow, Card, StatSection,
  getPeriodRange, shiftAnchor, periodLabel, computeBacOverTime,
});

// stats.jsx — Tab 3: Statistiques
// Mirrors the AlcoNote real-app sections: Général, Temporel, Catégories,
// Top boissons, Alcoolémie (BAC + records), Évolution mensuelle, Avancées.
// Sections are collapsible and persisted per-section in localStorage.

const STATS_COLLAPSED_KEY = 'alconote.stats.collapsed';
function loadCollapsedSections() {
  try { return new Set(JSON.parse(localStorage.getItem(STATS_COLLAPSED_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveCollapsedSections(set) {
  try { localStorage.setItem(STATS_COLLAPSED_KEY, JSON.stringify([...set])); } catch {}
}

const PERIODS = [
  { id: 'day',   label: 'Jour'    },
  { id: 'week',  label: 'Semaine' },
  { id: 'month', label: 'Mois'    },
  { id: 'year',  label: 'Année'   },
  { id: 'all',   label: 'Tout'    },
];

// ── Real-data derivations ─────────────────────────────────────────
// All helpers below take the live `window.DRINK_FAMILIES` (hydrated from
// IDB by db.jsx) and return the same shape the UI sections used to expect
// from hardcoded mock constants. Empty inputs return zero/empty shapes
// rather than crashing — the design preview remains coherent.

function _flatEntries(families) {
  const out = [];
  for (const f of families) for (const e of f.entries || []) out.push({ ...e, family: f });
  return out;
}

function _entryGrams(e) {
  const f = e.family;
  const volCl = f.unit === 'EcoCup' ? f.quantity * 25
              : f.unit === 'L' ? f.quantity * 100
              : f.quantity;
  return volCl * 10 * (f.alcohol / 100) * 0.789;
}

function _entryVolumeCl(e) {
  const f = e.family;
  return f.unit === 'EcoCup' ? f.quantity * 25
       : f.unit === 'L' ? f.quantity * 100
       : f.quantity;
}

function _periodRange(period, anchor = new Date()) {
  const d = new Date(anchor);
  d.setHours(0, 0, 0, 0);
  if (period === 'day') {
    return { from: d, to: new Date(d.getTime() + 86400000) };
  }
  if (period === 'week') {
    const dow = (d.getDay() + 6) % 7; // Monday-based
    const from = new Date(d.getTime() - dow * 86400000);
    return { from, to: new Date(from.getTime() + 7 * 86400000) };
  }
  if (period === 'month') {
    const from = new Date(d.getFullYear(), d.getMonth(), 1);
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { from, to };
  }
  if (period === 'year') {
    return { from: new Date(d.getFullYear(), 0, 1), to: new Date(d.getFullYear() + 1, 0, 1) };
  }
  return { from: new Date(0), to: new Date(8.64e15) };
}

function _filterByPeriod(entries, period) {
  const { from, to } = _periodRange(period);
  return entries.filter(e => {
    const ts = Date.parse(e.ts);
    return !Number.isNaN(ts) && ts >= +from && ts < +to;
  });
}

// Variant that keeps the family shape but trims each family's entries to
// the selected period. Families with no remaining entries are dropped so
// downstream rollups (top-drinks, category cards) don't show empty rows.
function _familiesInPeriod(families, period) {
  if (!period || period === 'all') return families;
  const { from, to } = _periodRange(period);
  const out = [];
  for (const f of families) {
    const trimmed = f.entries.filter(e => {
      const ts = Date.parse(e.ts);
      return !Number.isNaN(ts) && ts >= +from && ts < +to;
    });
    if (trimmed.length) out.push({ ...f, entries: trimmed });
  }
  return out;
}

// Sessions: any run of entries within 4h of each other counts as one session.
function _sessions(entries) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const out = [];
  let cur = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = Date.parse(sorted[i].ts) - Date.parse(sorted[i - 1].ts);
    if (gap > 4 * 3600 * 1000) {
      out.push(cur);
      cur = [];
    }
    cur.push(sorted[i]);
  }
  out.push(cur);
  return out;
}

function deriveHourly(families) {
  const bins = Array(24).fill(0);
  for (const e of _flatEntries(families)) {
    const h = +e.ts.slice(11, 13);
    if (Number.isFinite(h)) bins[h] += 1;
  }
  return bins;
}

function deriveDaily(families) {
  const labels = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // Sun..Sat
  const counts = Array(7).fill(0);
  for (const e of _flatEntries(families)) {
    const ts = Date.parse(e.ts);
    if (Number.isNaN(ts)) continue;
    counts[new Date(ts).getDay()] += 1;
  }
  const todayIdx = new Date().getDay();
  // UI expects Mon-first ordering with `today` flagged.
  return [1, 2, 3, 4, 5, 6, 0].map(day => ({
    label: labels[day], day, v: counts[day], today: day === todayIdx,
  }));
}

function deriveTrends(families) {
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const now = new Date();
  const labels = [];
  const drinks = [];
  const alcoholG = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    labels.push(months[d.getMonth()]);
    let count = 0, grams = 0;
    for (const e of _flatEntries(families)) {
      const ts = Date.parse(e.ts);
      if (ts >= +d && ts < +next) {
        count += 1;
        grams += _entryGrams(e);
      }
    }
    drinks.push(count);
    alcoholG.push(Math.round(grams));
  }
  return { labels, drinks, alcoholG };
}

function deriveRolling(families) {
  const out = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = 30;
  // Daily grams of pure alcohol, last `days` days oldest-first.
  const daily = Array(days).fill(0);
  for (const e of _flatEntries(families)) {
    const ts = Date.parse(e.ts);
    if (Number.isNaN(ts)) continue;
    const offset = Math.floor((+now - ts) / 86400000);
    if (offset < 0 || offset >= days) continue;
    daily[days - 1 - offset] += _entryGrams(e);
  }
  for (let i = 0; i < days; i++) {
    const d = new Date(+now - (days - 1 - i) * 86400000);
    const slice7 = daily.slice(Math.max(0, i - 6), i + 1);
    const slice30 = daily.slice(0, i + 1);
    out.push({
      date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      daily: daily[i],
      r7: slice7.reduce((s, v) => s + v, 0) / slice7.length,
      r30: slice30.reduce((s, v) => s + v, 0) / slice30.length,
    });
  }
  return out;
}

function deriveSessionDurationBuckets(families) {
  const labels = ['<1h', '1-2h', '2-3h', '3-4h', '4-5h', '5-6h', '6h+'];
  const buckets = labels.map(label => ({ label, v: 0 }));
  for (const sess of _sessions(_flatEntries(families))) {
    if (sess.length < 2) { buckets[0].v += 1; continue; }
    const span = (Date.parse(sess[sess.length - 1].ts) - Date.parse(sess[0].ts)) / 3600000;
    const idx = span < 1 ? 0 : span < 2 ? 1 : span < 3 ? 2 : span < 4 ? 3
              : span < 5 ? 4 : span < 6 ? 5 : 6;
    buckets[idx].v += 1;
  }
  return buckets;
}

function deriveSessionBacBuckets(families) {
  const labels = ['<0.2', '0.2-0.5', '0.5-0.8', '0.8-1.2', '1.2+'];
  const buckets = labels.map(label => ({ label, v: 0 }));
  const settings = window.__alcoUserSettings || {};
  const weight = +settings.userWeight || 70;
  const r = settings.userGender === 'Femme' ? 0.55 : 0.7;
  for (const sess of _sessions(_flatEntries(families))) {
    const grams = sess.reduce((s, e) => s + _entryGrams(e), 0);
    const peakGperL = grams / (weight * r);
    const idx = peakGperL < 0.2 ? 0 : peakGperL < 0.5 ? 1 : peakGperL < 0.8 ? 2
              : peakGperL < 1.2 ? 3 : 4;
    buckets[idx].v += 1;
  }
  return buckets;
}

function deriveBacProjection(families) {
  // Step the next 10h in 15-min increments using Widmark, summing residual
  // alcohol across recent entries. Mirrors computeCurrentBacMgPerL but as a
  // time series.
  const settings = window.__alcoUserSettings || {};
  const weight = +settings.userWeight || 70;
  const r = settings.userGender === 'Femme' ? 0.55 : 0.7;
  const elimGperLPerH = 0.15;
  const horizonH = 12;
  const now = Date.now();
  const entries = _flatEntries(families)
    .filter(e => {
      const ts = Date.parse(e.ts);
      return !Number.isNaN(ts) && (now - ts) / 3600000 < horizonH;
    });
  const pts = [];
  for (let t = -2; t <= 8; t += 0.25) {
    let total = 0;
    const at = now + t * 3600000;
    for (const e of entries) {
      const ts = Date.parse(e.ts);
      const hoursAgo = (at - ts) / 3600000;
      if (hoursAgo < 0) continue;
      const peak = _entryGrams(e) / (weight * r);
      const residual = Math.max(0, peak - elimGperLPerH * hoursAgo);
      total += residual;
    }
    pts.push({ t, bac: Math.round(total * 1000) });
  }
  return pts;
}

// ── Main StatsTab ─────────────────────────────────────────────────
function StatsTab() {
  useDb(); // re-render when IDB hydrates
  const families = window.DRINK_FAMILIES || [];
  const [period, setPeriod] = React.useState('week');
  const [collapsed, setCollapsed] = React.useState(loadCollapsedSections);
  const toggleSection = (id) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      saveCollapsedSections(next);
      return next;
    });
  };
  const sp = { collapsed, toggleSection, period, families };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PeriodSwitcher period={period} onChange={setPeriod} />
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 100px' }}>
        <PeriodNav period={period} />
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

// ── Period switcher & nav ─────────────────────────────────────────
function PeriodSwitcher({ period, onChange }) {
  return (
    <div style={{
      display: 'flex', padding: '4px 16px 14px',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      <div style={{
        display: 'flex', gap: 2, padding: 3, background: T.surface2,
        borderRadius: 12, border: `1px solid ${T.rule}`, flexShrink: 0,
      }}>
        {PERIODS.map(p => (
          <div key={p.id} onClick={() => onChange(p.id)} style={{
            padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
            background: period === p.id ? T.accent : 'transparent',
            color: period === p.id ? T.bg : T.ink2,
            fontSize: 12, fontWeight: period === p.id ? 600 : 400,
            letterSpacing: -0.1, whiteSpace: 'nowrap',
          }}>{p.label}</div>
        ))}
      </div>
    </div>
  );
}

function PeriodNav({ period }) {
  const label = period === 'week' ? '13 – 19 avril 2026'
              : period === 'day' ? "Samedi 18 avril"
              : period === 'month' ? 'Avril 2026'
              : period === 'year' ? '2026'
              : 'Depuis le début';
  const arrowBtn = (icon) => (
    <div style={{
      width: 32, height: 32, borderRadius: 10, background: T.surface2,
      display: 'grid', placeItems: 'center', color: T.ink2,
      border: `1px solid ${T.rule}`, cursor: 'pointer',
    }}>
      <SvgIcon icon={icon} size={14} />
    </div>
  );
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 4px 18px',
    }}>
      {arrowBtn(Ic.chevL)}
      <div style={{
        fontFamily: fontSerif, fontSize: 18, color: T.ink,
        fontStyle: 'italic', letterSpacing: -0.3,
      }}>{label}</div>
      {arrowBtn(Ic.chev)}
    </div>
  );
}

// ── Section wrapper (collapsible) ───────────────────────────────
function StatSection({ id, title, action, children, sub, collapsed, toggleSection }) {
  const isOpen = !collapsed.has(id);
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        onClick={() => toggleSection(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          padding: '11px 14px', background: T.surface, borderRadius: 14,
          border: `1px solid ${T.rule}`,
          marginBottom: isOpen ? 10 : 0,
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
      </div>
      {isOpen && children}
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
function GeneralSection({ period, collapsed, toggleSection, families = [] }) {
  const hidePct = period === 'all';
  const allEntries = _flatEntries(families);
  const entries = _filterByPeriod(allEntries, period);

  const totalDrinks = entries.length;
  const sessions = _sessions(entries);
  const totalVolumeCl = entries.reduce((s, e) => s + _entryVolumeCl(e), 0);
  const totalGrams = entries.reduce((s, e) => s + _entryGrams(e), 0);
  const uniqueDrinks = new Set(entries.map(e => e.family.name)).size;

  const fmtL = (cl) => cl >= 100 ? `${(cl / 100).toFixed(1)}L` : `${Math.round(cl)}cL`;

  const cards = [
    { v: totalDrinks, l: 'Boissons', tip: 'Total consommations' },
    { v: sessions.length, l: 'Sessions', tip: 'Regroupées si < 4h' },
    { v: fmtL(totalVolumeCl), l: 'Volume' },
    { v: `${Math.round(totalGrams)}g`, l: 'Alcool pur', tip: 'Éthanol' },
    { v: uniqueDrinks, l: 'Boissons diff.' },
  ];

  // Period-aware denominator. For "all" we use (today − earliest entry)
  // rather than the synthetic 1970→year-275760 range from _periodRange,
  // which would otherwise blow the average out by a factor of 10⁹.
  let days;
  if (period === 'all') {
    const oldest = allEntries.reduce((m, e) => {
      const ts = Date.parse(e.ts);
      return !Number.isNaN(ts) && ts < m ? ts : m;
    }, Date.now());
    days = Math.max(1, Math.round((Date.now() - oldest) / 86400000) + 1);
  } else {
    const { from, to } = _periodRange(period);
    days = Math.max(1, Math.round((+to - +from) / 86400000));
  }

  if (period === 'week' || period === 'month' || period === 'year' || period === 'all') {
    const drinkDays = new Set(entries.map(e => e.ts.slice(0, 10))).size;
    cards.push({ v: Math.max(0, days - drinkDays), l: 'Jours sobres' });
    cards.push({ v: (totalDrinks / days).toFixed(1), l: 'Boissons/jour' });
  }
  if (period === 'month' || period === 'year' || period === 'all') {
    cards.push({ v: (totalDrinks / Math.max(1, days / 7)).toFixed(0), l: 'Boissons/sem.' });
  }

  const catDistMap = new Map();
  for (const e of entries) {
    const k = e.family.category || 'Autre';
    catDistMap.set(k, (catDistMap.get(k) || 0) + 1);
  }
  const catDist = [...catDistMap.entries()]
    .map(([name, v]) => ({ name, v }))
    .sort((a, b) => b.v - a.v);
  // Hoisted out of the inner .map — was O(n²) when it should be O(n).
  const catDistTotal = catDist.reduce((s, x) => s + x.v, 0) || 1;

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
            {!hidePct && c.comp !== undefined && c.comp !== 0 && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                fontSize: 9, color: c.comp > 0 ? T.accent2 : T.good,
                fontFamily: fontNum, fontWeight: 500,
              }}>{c.comp > 0 ? '↑' : '↓'} {Math.abs(c.comp)}%</div>
            )}
          </div>
        ))}
      </div>

      {/* Catégorie distribution donut */}
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
              const pct = Math.round((d.v / catDistTotal) * 100);
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
    </StatSection>
  );
}

// ── 2. Analyse temporelle ─────────────────────────────────────────
function TemporalSection({ collapsed, toggleSection, families = [], period }) {
  // Period filter applied to the entry stream so every sub-stat below
  // (peak hour, radar, session stats) reflects the selected window.
  const periodFamilies = _familiesInPeriod(families, period);
  const hourly = deriveHourly(periodFamilies);
  const daily = deriveDaily(periodFamilies);
  const peakHour = hourly.indexOf(Math.max(...hourly));
  const peakDay = daily.reduce((a, b) => a.v > b.v ? a : b, daily[0] || { day: 0, v: 0 });
  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

  // Avg session duration + avg gap between sessions, period-scoped.
  const allEntries = _flatEntries(periodFamilies);
  const sessions = _sessions(allEntries);
  const sessionMs = sessions
    .filter(s => s.length > 1)
    .map(s => Date.parse(s[s.length - 1].ts) - Date.parse(s[0].ts));
  const avgSessionH = sessionMs.length
    ? sessionMs.reduce((a, b) => a + b, 0) / sessionMs.length / 3600000
    : 0;
  const avgSessionLabel = avgSessionH > 0
    ? `${Math.floor(avgSessionH)}h ${String(Math.round((avgSessionH % 1) * 60)).padStart(2, '0')}`
    : '—';
  const sessionStarts = sessions.map(s => Date.parse(s[0].ts)).sort((a, b) => a - b);
  const gaps = sessionStarts.slice(1).map((t, i) => (t - sessionStarts[i]) / 86400000);
  const avgGapDays = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const avgGapLabel = avgGapDays > 0 ? `${avgGapDays.toFixed(1)}j` : '—';

  return (
    <StatSection id="temporal" title="Analyse temporelle" collapsed={collapsed} toggleSection={toggleSection} sub="Répartition par heures et jours">
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10,
      }}>
        <MiniStat big={hourly.some(v => v) ? `${peakHour}h` : '—'} label="Heure de pointe" />
        <MiniStat big={peakDay.v ? dayNames[peakDay.day] : '—'} label="Jour de pointe" />
        <MiniStat big={avgSessionLabel} label="Durée moy. session" />
        <MiniStat big={avgGapLabel} label="Entre sessions" />
      </div>

      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 10, letterSpacing: -0.1,
        }}>Par heure</div>
        <SvgBarChart
          data={hourly.map((v, h) => ({ v, label: `${h}h` }))}
          width={320} height={130} color={T.accent}
          formatX={(d, i) => i % 4 === 0 ? d.label : ''}
        />
      </Card>

      <Card>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 4, letterSpacing: -0.1,
        }}>Par jour de la semaine</div>
        <SvgRadar data={daily} size={230} color={T.good} />
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
function CategorySection({ collapsed, toggleSection, families = [], period }) {
  const scoped = _familiesInPeriod(families, period);
  // Aggregate per category from real entries.
  const byCat = new Map();
  for (const e of _flatEntries(scoped)) {
    const k = e.family.category || 'Autre';
    if (!byCat.has(k)) byCat.set(k, { count: 0, volumeCl: 0, abvSum: 0, names: new Map() });
    const agg = byCat.get(k);
    agg.count += 1;
    agg.volumeCl += _entryVolumeCl(e);
    agg.abvSum += +e.family.alcohol || 0;
    agg.names.set(e.family.name, (agg.names.get(e.family.name) || 0) + 1);
  }
  const cats = [...byCat.entries()]
    .map(([name, a]) => {
      const favorite = [...a.names.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] || '—';
      return {
        name,
        count: a.count,
        volume: a.volumeCl / 100,             // L
        avgVol: (a.volumeCl / a.count) / 100, // L
        avgAbv: a.count ? +(a.abvSum / a.count).toFixed(1) : 0,
        favorite,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <StatSection id="category" title="Analyse par catégorie" collapsed={collapsed} toggleSection={toggleSection} sub="Statistiques par type de boisson">
      <div style={{ display: 'grid', gap: 8 }}>
        {cats.map(c => (
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
              <StatRow label="Volume" value={`${c.volume.toFixed(1)}L`} />
              <StatRow label="Volume moyen" value={`${c.avgVol.toFixed(2)}L`} />
              <StatRow label="Degré moyen" value={`${c.avgAbv}%`} />
              <StatRow label="Favorite" value={c.favorite} truncate />
            </div>
          </Card>
        ))}
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
          maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        } : {}),
      }}>{value}</span>
    </div>
  );
}

// ── 4. Top 10 des boissons ────────────────────────────────────────
function TopDrinksSection({ collapsed, toggleSection, families = [], period }) {
  const scoped = _familiesInPeriod(families, period);
  const top = scoped
    .map(f => {
      const count = f.entries.length;
      const volumeCl = (f.unit === 'EcoCup' ? f.quantity * 25
                      : f.unit === 'L' ? f.quantity * 100
                      : f.quantity) * count;
      const last = f.entries[0]?.ts.slice(0, 10) || '';
      return { name: f.name, count, volume: volumeCl / 100, last, rating: f.rating || 0 };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

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
              color: i < 3 ? T.bg : T.ink2,
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
                }}>{d.name}</div>
                <Stars n={d.rating} />
              </div>
              <div style={{
                color: T.muted, fontSize: 10.5, letterSpacing: 0.1, fontFamily: fontNum,
              }}>
                {d.count} fois · {d.volume.toFixed(2)}L · {fmtDate(d.last)}
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

function Stars({ n }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{
          color: i <= n ? T.accent : T.rule, fontSize: 9, lineHeight: 1,
        }}>★</span>
      ))}
    </span>
  );
}

// ── 5. Alcoolémie (BAC + records) ────────────────────────────────
// BAC level classification — mirrors real app
const BAC_LEVELS = [
  { max: 200,      cls: 'safe',    text: 'Sobre',               color: 'oklch(72% 0.10 155)' },
  { max: 500,      cls: 'caution', text: 'Légèrement alcoolisé', color: 'oklch(75% 0.14 95)' },
  { max: 800,      cls: 'warning', text: 'Dépass. limite légale', color: 'oklch(68% 0.14 50)' },
  { max: 1999,     cls: 'warning', text: 'Ivresse',              color: 'oklch(65% 0.15 35)' },
  { max: 2999,     cls: 'danger',  text: 'Ivresse sévère',       color: 'oklch(60% 0.18 25)' },
  { max: Infinity, cls: 'danger',  text: 'Danger vital',         color: 'oklch(55% 0.20 20)' },
];
function bacLevel(bac) {
  return BAC_LEVELS.find(l => bac <= l.max) || BAC_LEVELS[BAC_LEVELS.length - 1];
}

function BACSection({ collapsed, toggleSection, families = [] }) {
  // BAC records loaded from IDB (legacy `bacRecords` store). Each row keeps
  // a `__rawId` numeric key alongside the stringified `id` so swipe-delete
  // can call deleteOne('bacRecords', rawId).
  const [records, setRecords] = React.useState([]);
  React.useEffect(() => {
    let cancelled = false;
    readAll('bacRecords').then(rs => {
      if (cancelled) return;
      const sorted = (rs || [])
        .map(r => ({
          id: String(r.id),
          __rawId: r.id,
          bac: r.bacValue,
          drinks: r.drinkCount,
          ts: typeof r.timestamp === 'string' ? r.timestamp : new Date(r.timestamp).toISOString(),
        }))
        .sort((a, b) => b.bac - a.bac);
      if (sorted.length) sorted[0].highest = true;
      setRecords(sorted);
    });
    return () => { cancelled = true; };
  }, []);

  const currentBAC = computeCurrentBacMgPerL(families);
  const level = bacLevel(currentBAC);
  // time to sobriety @ 150mg/L/h elim
  const hoursToSober = currentBAC / 150;
  const hoursToLegal = Math.max(0, (currentBAC - 500) / 150);
  const fmtTime = (h) => {
    if (h <= 0) return '—';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')}`;
  };

  // "Drinks taken into account" — recent entries within the 12h Widmark
  // horizon, newest first.
  const now = Date.now();
  const fmtQty = (f) => `${f.quantity} ${f.unit}`;
  const relevantDrinks = _flatEntries(families)
    .filter(e => {
      const ts = Date.parse(e.ts);
      return !Number.isNaN(ts) && (now - ts) >= 0 && (now - ts) / 3600000 < 12;
    })
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))
    .slice(0, 6)
    .map(e => ({
      name: e.family.name,
      qty: fmtQty(e.family),
      abv: e.family.alcohol,
      hoursAgo: +(((now - Date.parse(e.ts)) / 3600000).toFixed(1)),
    }));

  const highest = records.find(r => r.highest);
  const others = records.filter(r => !r.highest);

  const deleteRecord = (id) => {
    setRecords(rs => {
      const target = rs.find(r => r.id === id);
      if (target && target.__rawId !== undefined) {
        deleteOne('bacRecords', target.__rawId).catch(e =>
          console.warn('[AlcoNote] bacRecord IDB delete failed', e));
      }
      return rs.filter(r => r.id !== id);
    });
  };

  return (
    <StatSection id="bac" title="Alcoolémie" collapsed={collapsed} toggleSection={toggleSection} sub="Estimation BAC · Formule de Widmark">
      {/* Gauge */}
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 00-.84-.99L16 11l-2.7-3.6a1 1 0 00-.8-.4H5.24a2 2 0 00-1.8 1.1l-.8 1.63A6 6 0 002 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>
              <div style={{ color: T.muted, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase' }}>Conduite (&lt;500)</div>
            </div>
            <div style={{
              fontFamily: fontSerif, fontSize: 20, color: T.ink, letterSpacing: -0.3,
            }}>{fmtTime(hoursToLegal)}</div>
          </div>
        </div>
      </Card>

      {/* Projection chart */}
      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 8, letterSpacing: -0.1,
        }}>Projection d'alcoolémie</div>
        <SvgBACProjection points={deriveBacProjection(families)} width={320} height={130} now={0} />
        <div style={{
          color: T.muted, fontSize: 10, marginTop: 6, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Glissez pour voir le taux à un moment précis</div>
      </Card>

      {/* Relevant drinks */}
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

      {/* BAC Records */}
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
            {highest && <BACRecordRow record={highest} isHighest onDelete={deleteRecord} />}
            {others.map(r => <BACRecordRow key={r.id} record={r} onDelete={deleteRecord} />)}
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
  // cap at 1500 for display
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
  const level = bacLevel(record.bac);
  const d = new Date(record.ts);
  const daysAgo = Math.floor((new Date('2026-04-19') - d) / (1000 * 60 * 60 * 24));
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateLabel = daysAgo === 0 ? `Aujourd'hui à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
                  : daysAgo === 1 ? `Hier à ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
                  : daysAgo < 7   ? `${daysAgo} jours · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`
                                  : `${d.getDate()} ${months[d.getMonth()]} · ${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}>
      {/* delete background */}
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
            }}>{record.bac}<span style={{ fontSize: 10, color: T.muted, fontStyle: 'normal', fontFamily: fontSans, marginLeft: 2 }}>mg/L</span></span>
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
          }}>{dateLabel} · {record.drinks} conso{record.drinks > 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  );
}

// ── 6. Évolution mensuelle ────────────────────────────────────────
function TrendsSection({ collapsed, toggleSection, families = [] }) {
  const trends = deriveTrends(families);
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
              width: 14, height: 2, background: T.accent2,
              backgroundImage: `repeating-linear-gradient(90deg, ${T.accent2} 0 3px, transparent 3px 5px)`,
            }}/> Alcool (g)
          </span>
        </div>
      </Card>
    </StatSection>
  );
}

// ── 7. Analyses avancées ─────────────────────────────────────────
function AdvancedSection({ collapsed, toggleSection, families = [], period }) {
  // Polar clock + session histograms honor the period selector. The rolling
  // average chart is intentionally always 30 days regardless of the picker.
  const scoped = _familiesInPeriod(families, period);
  return (
    <StatSection id="advanced" title="Analyses avancées" collapsed={collapsed} toggleSection={toggleSection} sub="Moyennes mobiles · Horloge · Distribution des sessions">
      {/* Rolling average */}
      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 3, letterSpacing: -0.1,
        }}>Moyenne mobile</div>
        <div style={{
          color: T.muted, fontSize: 10, marginBottom: 10, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Alcool quotidien lissé sur 7 et 30 jours</div>
        <RollingChart families={families} />
        <div style={{
          display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6,
          fontSize: 10.5, color: T.ink2,
        }}>
          <LegendDot color={`${T.accent}40`} label="Brut" />
          <LegendDot color={T.accent} label="7j" />
          <LegendDot color={T.ink2} label="30j" dashed />
        </div>
      </Card>

      {/* Polar clock */}
      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 3, letterSpacing: -0.1,
        }}>Horloge des consommations</div>
        <div style={{
          color: T.muted, fontSize: 10, marginBottom: 10, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Répartition sur 24 heures</div>
        <SvgPolarClock hours={deriveHourly(scoped)} size={240} />
      </Card>

      {/* Sessions distribution: duration + BAC */}
      <Card>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 3, letterSpacing: -0.1,
        }}>Distribution des sessions</div>
        <div style={{
          color: T.muted, fontSize: 10, marginBottom: 12, fontStyle: 'italic', fontFamily: fontSerif,
        }}>Durée et alcoolémie moyenne par session</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{
              color: T.ink2, fontSize: 10.5, marginBottom: 4, textAlign: 'center',
              letterSpacing: 0.3, textTransform: 'uppercase',
            }}>Durée</div>
            <SvgHistogram buckets={deriveSessionDurationBuckets(scoped)} width={150} height={120} color={T.accent} />
          </div>
          <div>
            <div style={{
              color: T.ink2, fontSize: 10.5, marginBottom: 4, textAlign: 'center',
              letterSpacing: 0.3, textTransform: 'uppercase',
            }}>BAC (g/L)</div>
            <SvgHistogram buckets={deriveSessionBacBuckets(scoped)} width={150} height={120} color={T.accent2} />
          </div>
        </div>
      </Card>
    </StatSection>
  );
}

function RollingChart({ families = [] }) {
  const rolling = deriveRolling(families);
  const width = 320, height = 140;
  const pad = { t: 8, r: 6, b: 24, l: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...rolling.map(r => Math.max(r.daily, r.r7, r.r30))), 3);
  const n = rolling.length;
  const xs = i => pad.l + (i / Math.max(1, n - 1)) * w;
  const ys = v => pad.t + h * (1 - v / max);
  const bw = w / Math.max(1, n);

  const pathR7 = rolling.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r7)}`).join(' ');
  const pathR30 = rolling.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r30)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={pad.l + w}
          y1={pad.t + h * f} y2={pad.t + h * f}
          stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
      ))}
      <text x={pad.l - 4} y={pad.t + 4} fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>{max}g</text>
      <text x={pad.l - 4} y={pad.t + h + 3} fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>0</text>
      {rolling.map((r, i) => {
        const bh = (r.daily / max) * h;
        return <rect key={i} x={xs(i) - bw * 0.35} y={pad.t + h - bh}
          width={bw * 0.7} height={bh} fill={T.accent} opacity={0.25} rx={1} />;
      })}
      <path d={pathR7} fill="none" stroke={T.accent} strokeWidth={2} strokeLinejoin="round" />
      <path d={pathR30} fill="none" stroke={T.ink2} strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />
      {n > 0 && [0, Math.floor(n / 2), n - 1].map((i, k) => (
        <text key={k} x={xs(i)} y={height - 8}
          fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>{rolling[i].date}</text>
      ))}
    </svg>
  );
}

function LegendDot({ color, label, dashed }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 14, height: 2, background: color,
        ...(dashed ? {
          backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 5px)`,
          background: 'transparent',
        } : {}),
      }}/> {label}
    </span>
  );
}

Object.assign(window, {
  StatsTab, PeriodSwitcher, PeriodNav,
  GeneralSection, TemporalSection, CategorySection,
  TopDrinksSection, BACSection, TrendsSection, AdvancedSection,
  BACRecordRow, BACGauge, bacLevel, BAC_LEVELS,
});

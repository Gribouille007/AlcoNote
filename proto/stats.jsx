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

// ── Mock data for stats views (derived from DRINK_FAMILIES or realistic) ──
const PERIODS = [
  { id: 'day',   label: 'Jour'    },
  { id: 'week',  label: 'Semaine' },
  { id: 'month', label: 'Mois'    },
  { id: 'year',  label: 'Année'   },
  { id: 'all',   label: 'Tout'    },
];

// Hourly distribution (24 bins) — evenings-heavy profile
const HOURLY = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,   // 00-09
  0, 0, 1, 1, 0, 1, 0, 2, 3, 4,   // 10-19
  6, 8, 5, 2,                     // 20-23
];

// Daily: 0=Sun..6=Sat — peak Friday/Saturday
const DAILY = [
  { label: 'L', day: 1, v: 2, today: false },
  { label: 'M', day: 2, v: 1, today: false },
  { label: 'M', day: 3, v: 3, today: false },
  { label: 'J', day: 4, v: 0, today: false },
  { label: 'V', day: 5, v: 6, today: false },
  { label: 'S', day: 6, v: 4, today: true  },
  { label: 'D', day: 0, v: 2, today: false },
];

// Monthly trend (last 6 months)
const TRENDS = {
  labels: ['Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr'],
  drinks: [14, 22, 9, 11, 16, 12],
  alcoholG: [98, 168, 62, 84, 120, 90],
};

// Rolling 7d/30d for recent 30 days
const ROLLING = (() => {
  const out = [];
  const base = [2, 0, 0, 4, 3, 0, 5, 1, 0, 2, 0, 0, 3, 6, 2, 0, 0, 1, 3, 0, 0, 4, 5, 0, 2, 0, 1, 3, 0, 4];
  for (let i = 0; i < base.length; i++) {
    const slice7 = base.slice(Math.max(0, i - 6), i + 1);
    const slice30 = base.slice(0, i + 1);
    out.push({
      date: `${20 + Math.floor(i / 7)}/03`,
      daily: base[i] * 8,
      r7: slice7.reduce((s, v) => s + v, 0) / slice7.length * 8,
      r30: slice30.reduce((s, v) => s + v, 0) / slice30.length * 8,
    });
  }
  return out;
})();

const SESSION_DURATION = [
  { label: '<1h', v: 1 },
  { label: '1-2h', v: 5 },
  { label: '2-3h', v: 3 },
  { label: '3-4h', v: 2 },
  { label: '4-5h', v: 1 },
  { label: '5-6h', v: 0 },
  { label: '6h+', v: 0 },
];

const SESSION_BAC = [
  { label: '<0.2', v: 3 },
  { label: '0.2-0.5', v: 4 },
  { label: '0.5-0.8', v: 3 },
  { label: '0.8-1.2', v: 1 },
  { label: '1.2+', v: 1 },
];

// BAC records (persisted in component state for swipe-to-delete)
const INITIAL_BAC_RECORDS = [
  { id: 'b1', bac: 820, drinks: 5, ts: '2026-04-18T23:10', highest: false },
  { id: 'b2', bac: 740, drinks: 4, ts: '2026-04-11T23:45' },
  { id: 'b3', bac: 920, drinks: 6, ts: '2026-03-21T02:15', highest: true },
  { id: 'b4', bac: 510, drinks: 3, ts: '2026-04-04T22:30' },
  { id: 'b5', bac: 390, drinks: 2, ts: '2026-03-14T21:00' },
];

// BAC projection: 4h decay from current 620 mg/L
const BAC_PROJECTION = (() => {
  const peak = 620, start = -2;
  const pts = [];
  for (let t = start; t <= 8; t += 0.25) {
    // absorption rise then Widmark decay
    let bac;
    if (t < 0) bac = peak * Math.max(0, 1 - Math.abs(t) / 2);
    else bac = Math.max(0, peak - 150 * t); // ~150 mg/L/h elim
    pts.push({ t, bac });
  }
  return pts;
})();

// ── Main StatsTab ─────────────────────────────────────────────────
function StatsTab() {
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
  const sp = { collapsed, toggleSection, period };
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
function GeneralSection({ period, collapsed, toggleSection }) {
  const hidePct = period === 'all';
  const cards = [
    { v: 17, l: 'Boissons', comp: -12, tip: 'Total consommations' },
    { v: 3, l: 'Sessions', comp: -25, tip: 'Regroupées si < 4h' },
    { v: '2.4L', l: 'Volume', comp: -8 },
    { v: '90g', l: 'Alcool pur', comp: -15, tip: 'Éthanol' },
    { v: 6, l: 'Boissons diff.' },
  ];
  if (period === 'week' || period === 'month' || period === 'year') {
    cards.push({ v: 2, l: 'Jours sobres', comp: +50 });
    cards.push({ v: '2.4', l: 'Boissons/jour', comp: -12 });
  }
  if (period === 'month' || period === 'year') {
    cards.push({ v: '17', l: 'Boissons/sem.', comp: -12 });
  }

  const catDist = [
    { name: 'Bière', v: 8 },
    { name: 'Vin', v: 3 },
    { name: 'Cocktail', v: 4 },
    { name: 'Spiritueux', v: 2 },
  ];

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
    </StatSection>
  );
}

// ── 2. Analyse temporelle ─────────────────────────────────────────
function TemporalSection({ collapsed, toggleSection }) {
  const peakHour = HOURLY.indexOf(Math.max(...HOURLY));
  const peakDay = DAILY.reduce((a, b) => a.v > b.v ? a : b);
  const dayNames = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

  return (
    <StatSection id="temporal" title="Analyse temporelle" collapsed={collapsed} toggleSection={toggleSection} sub="Répartition par heures et jours">
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 10,
      }}>
        <MiniStat big={`${peakHour}h`} label="Heure de pointe" />
        <MiniStat big={dayNames[peakDay.day]} label="Jour de pointe" />
        <MiniStat big="2h 10" label="Durée moy. session" />
        <MiniStat big="2.3j" label="Entre sessions" />
      </div>

      <Card style={{ marginBottom: 10 }}>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 10, letterSpacing: -0.1,
        }}>Par heure</div>
        <SvgBarChart
          data={HOURLY.map((v, h) => ({ v, label: `${h}h` }))}
          width={320} height={130} color={T.accent}
          formatX={(d, i) => i % 4 === 0 ? d.label : ''}
        />
      </Card>

      <Card>
        <div style={{
          color: T.ink, fontSize: 12.5, fontWeight: 500, marginBottom: 4, letterSpacing: -0.1,
        }}>Par jour de la semaine</div>
        <SvgRadar data={DAILY} size={230} color={T.good} />
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
function CategorySection({ collapsed, toggleSection }) {
  const cats = [
    { name: 'Bière', count: 8, volume: 2.4, avgVol: 0.3, avgAbv: 4.7, favorite: 'Guinness Draught' },
    { name: 'Cocktail', count: 4, volume: 0.5, avgVol: 0.12, avgAbv: 24, favorite: 'Jack & Coke' },
    { name: 'Vin', count: 3, volume: 0.4, avgVol: 0.13, avgAbv: 12.8, favorite: 'Chardonnay Bourgogne' },
    { name: 'Spiritueux', count: 2, volume: 0.08, avgVol: 0.04, avgAbv: 40, favorite: 'Whisky Glenlivet' },
  ];

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
function TopDrinksSection({ collapsed, toggleSection }) {
  const top = [
    { name: 'Guinness Draught', count: 4, volume: 1.0, last: '2026-04-18', rating: 4 },
    { name: 'IPA Brewdog Punk', count: 2, volume: 0.66, last: '2026-04-17', rating: 5 },
    { name: 'Jack & Coke', count: 2, volume: 0.16, last: '2026-04-18', rating: 3 },
    { name: 'Pilsner Urquell', count: 2, volume: 0.66, last: '2026-04-12', rating: 4 },
    { name: 'Chardonnay Bourgogne', count: 2, volume: 0.24, last: '2026-04-18', rating: 3 },
    { name: 'Côtes du Rhône', count: 1, volume: 0.15, last: '2026-04-09', rating: 4 },
    { name: 'Mojito', count: 1, volume: 0.15, last: '2026-04-05', rating: 4 },
    { name: 'Whisky Glenlivet', count: 1, volume: 0.04, last: '2026-04-16', rating: 5 },
  ];
  const fmtDate = (iso) => {
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

function BACSection({ collapsed, toggleSection }) {
  const [records, setRecords] = React.useState(INITIAL_BAC_RECORDS);
  const currentBAC = 620; // mg/L
  const level = bacLevel(currentBAC);
  // time to sobriety @ 150mg/L/h elim
  const hoursToSober = currentBAC / 150;
  const hoursToLegal = Math.max(0, (currentBAC - 500) / 150);
  const fmtTime = (h) => {
    if (h <= 0) return '—';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')}`;
  };

  const relevantDrinks = [
    { name: 'Guinness Draught', qty: '1 EcoCup', abv: 4.2, hoursAgo: 1.5 },
    { name: 'Jack & Coke',      qty: '8cL',      abv: 35,  hoursAgo: 0.3 },
    { name: 'Chardonnay',       qty: '12cL',     abv: 12.5, hoursAgo: 2.8 },
  ];

  const highest = records.find(r => r.highest);
  const others = records.filter(r => !r.highest);

  const deleteRecord = (id) => setRecords(rs => rs.filter(r => r.id !== id));

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
        <SvgBACProjection points={BAC_PROJECTION} width={320} height={130} now={0} />
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
function TrendsSection({ collapsed, toggleSection }) {
  return (
    <StatSection id="trends" title="Évolution mensuelle" collapsed={collapsed} toggleSection={toggleSection} sub="Tendances de consommation mois par mois">
      <Card>
        <SvgLineChart
          labels={TRENDS.labels}
          series={[
            { data: TRENDS.drinks },
            { data: TRENDS.alcoholG },
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
function AdvancedSection({ collapsed, toggleSection }) {
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
        <RollingChart />
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
        <SvgPolarClock hours={HOURLY} size={240} />
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
            <SvgHistogram buckets={SESSION_DURATION} width={150} height={120} color={T.accent} />
          </div>
          <div>
            <div style={{
              color: T.ink2, fontSize: 10.5, marginBottom: 4, textAlign: 'center',
              letterSpacing: 0.3, textTransform: 'uppercase',
            }}>BAC (g/L)</div>
            <SvgHistogram buckets={SESSION_BAC} width={150} height={120} color={T.accent2} />
          </div>
        </div>
      </Card>
    </StatSection>
  );
}

function RollingChart() {
  const width = 320, height = 140;
  const pad = { t: 8, r: 6, b: 24, l: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(...ROLLING.map(r => Math.max(r.daily, r.r7, r.r30))), 3);
  const n = ROLLING.length;
  const xs = i => pad.l + (i / (n - 1)) * w;
  const ys = v => pad.t + h * (1 - v / max);
  const bw = w / n;

  const pathR7 = ROLLING.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r7)}`).join(' ');
  const pathR30 = ROLLING.map((r, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${ys(r.r30)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={pad.l + w}
          y1={pad.t + h * f} y2={pad.t + h * f}
          stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
      ))}
      <text x={pad.l - 4} y={pad.t + 4} fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>{max}g</text>
      <text x={pad.l - 4} y={pad.t + h + 3} fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>0</text>
      {ROLLING.map((r, i) => {
        const bh = (r.daily / max) * h;
        return <rect key={i} x={xs(i) - bw * 0.35} y={pad.t + h - bh}
          width={bw * 0.7} height={bh} fill={T.accent} opacity={0.25} rx={1} />;
      })}
      <path d={pathR7} fill="none" stroke={T.accent} strokeWidth={2} strokeLinejoin="round" />
      <path d={pathR30} fill="none" stroke={T.ink2} strokeWidth={1.4} strokeDasharray="3 2" strokeLinejoin="round" />
      {[0, Math.floor(n / 2), n - 1].map((i, k) => (
        <text key={k} x={xs(i)} y={height - 8}
          fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>{ROLLING[i].date}</text>
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

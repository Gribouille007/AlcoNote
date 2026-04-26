// app.jsx — top-level shell: App, PhoneFrame, AppHeader, BottomNav, Fab, Hint.
// Extracted from index.html so the entry HTML stays minimal. All clickable
// chrome is rendered as <button> elements with aria-labels for keyboard /
// screen-reader access; the existing visual styling is preserved verbatim.

function App() {
  useTheme();
  const { hydrated, hasRealData } = useDb();

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', T._name);
    document.body.className = `theme-${T._name}`;
  });

  React.useEffect(() => {
    hydrateFamilies();
  }, []);

  const [tab, setTab] = React.useState(() => localStorage.getItem('alconote.tab') || 'categories');
  const [adding, setAdding] = React.useState(false);
  const [settings, setSettings] = React.useState(false);
  const [openFamily, setOpenFamily] = React.useState(null);
  const [openEntry, setOpenEntry] = React.useState(null);
  const [prefill, setPrefill] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  const directAdd = React.useCallback(async (family) => {
    try {
      await addDrinkToDb({
        name: family.name,
        category: family.category,
        quantity: family.quantity,
        unit: family.unit,
        alcoholContent: family.alcohol,
      });
    } catch (e) {
      console.warn('[AlcoNote] direct add failed; showing toast only', e);
    }
    setToast(`« ${family.name} » ajoutée`);
    clearTimeout(window.__aToast);
    window.__aToast = setTimeout(() => setToast(null), 1800);
  }, []);

  React.useEffect(() => { localStorage.setItem('alconote.tab', tab); }, [tab]);

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      padding: '30px 10px 50px',
    }}>
      <PhoneFrame>
        <StatusBar />
        <AppHeader tab={tab} onMenu={() => setSettings(true)} />
        <div data-screen-label={tabLabel(tab)} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {tab === 'categories' && (
            <CategoriesTab onOpenFamily={setOpenFamily} onAdd={() => setAdding(true)} onDirectAdd={directAdd} />
          )}
          {tab === 'history' && (
            <HistoryTab onOpenEntry={setOpenEntry} onDirectAdd={directAdd} />
          )}
          {tab === 'stats' && <StatsTab />}
        </div>

        <Fab onClick={() => setAdding(true)} />
        <BottomNav tab={tab} onChange={setTab} />
        <HomeBar />

        <AddDrinkSheet open={adding} prefill={prefill} onClose={() => { setAdding(false); setPrefill(null); }} />
        <SettingsDrawer open={settings} onClose={() => setSettings(false)} />
        {openFamily && (
          <DrinkDetailSheet family={openFamily}
            onClose={() => setOpenFamily(null)} onDirectAdd={directAdd} />
        )}
        {openEntry && (
          <DrinkDetailSheet entry={openEntry}
            onClose={() => setOpenEntry(null)} onDirectAdd={directAdd} />
        )}
      </PhoneFrame>
      <Hint />
      {toast && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: T.ink, color: T.bg, padding: '10px 18px', borderRadius: 99,
          fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
          zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fade 0.2s ease',
        }}>
          <span style={{ display: 'flex', color: T.accent }}><SvgIcon icon={Ic.check} size={14} /></span>
          {toast}
        </div>
      )}
    </div>
  );
}

function tabLabel(t) {
  return t === 'categories' ? '01 Catégories' : t === 'history' ? '02 Historique' : '03 Statistiques';
}

function PhoneFrame({ children }) {
  return (
    <div style={{
      width: 390, height: 844, borderRadius: 52, overflow: 'hidden',
      position: 'relative', background: T.bg,
      boxShadow: T.isDark
        ? `0 60px 120px rgba(0,0,0,0.5), 0 0 0 10px oklch(14% 0.008 50), 0 0 0 11px oklch(30% 0.01 55)`
        : `0 40px 90px rgba(60,40,20,0.22), 0 0 0 10px oklch(88% 0.01 75), 0 0 0 11px oklch(70% 0.02 70)`,
      display: 'flex', flexDirection: 'column',
    }} className="phone-body">
      <div aria-hidden="true" style={{
        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 34, borderRadius: 22, background: '#000', zIndex: 50,
      }} />
      {children}
    </div>
  );
}

function AppHeader({ tab, onMenu }) {
  const titles = {
    categories: 'Catégories',
    history: 'Historique',
    stats: 'Statistiques',
  };
  const today = new Date();
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dateStr = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`;

  // Live BAC pill — recomputed when families hydrate. Display widens once
  // we hit 4+ digits so the pill stays readable.
  useDb();
  const bac = computeCurrentBacMgPerL(window.DRINK_FAMILIES || []);
  const bacLabel = bac > 0 ? String(bac) : '0';

  return (
    <div style={{
      padding: '8px 18px 14px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
    }}>
      <button type="button" className="bare" onClick={onMenu} aria-label="Ouvrir les paramètres" style={{
        width: 38, height: 38, borderRadius: 12, background: T.surface2,
        display: 'grid', placeItems: 'center', color: T.ink,
        border: `1px solid ${T.rule}`,
      }}>
        <SvgIcon icon={Ic.menu} size={18} />
      </button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{
          fontFamily: fontSerif, fontSize: 20, color: T.ink,
          letterSpacing: -0.3, lineHeight: 1, fontStyle: 'italic',
        }}>{titles[tab]}</div>
        <div style={{
          fontSize: 10, color: T.muted, letterSpacing: 1, marginTop: 3,
          textTransform: 'uppercase', fontWeight: 500,
        }}>{dateStr}</div>
      </div>
      <div role="status" aria-label={`Alcoolémie estimée ${bacLabel} milligrammes par litre`} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 10px 6px 8px', borderRadius: 12,
        background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
        minWidth: 56, justifyContent: 'center',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: 99, background: T.accent,
          boxShadow: `0 0 8px ${T.accent}`,
        }}/>
        <span style={{
          color: T.accent, fontSize: 11, fontWeight: 600,
          fontFamily: fontNum, letterSpacing: 0.2, fontVariantNumeric: 'tabular-nums',
        }}>{bacLabel}</span>
      </div>
    </div>
  );
}

function BottomNav({ tab, onChange }) {
  const items = [
    { id: 'categories', label: 'Catégories', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    )},
    { id: 'history', label: 'Historique', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/>
        <polyline points="12 7 12 12 15 14"/>
      </svg>
    )},
    { id: 'stats', label: 'Stats', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )},
  ];
  return (
    <nav aria-label="Navigation principale" style={{
      position: 'relative', padding: '8px 16px 4px',
      background: T.bg, borderTop: `1px solid ${T.rule}`,
    }}>
      <div role="tablist" style={{ display: 'flex', justifyContent: 'space-around', paddingBottom: 2 }}>
        {items.map(it => {
          const on = tab === it.id;
          return (
            <button key={it.id} type="button" role="tab" aria-selected={on}
              aria-label={it.label}
              onClick={() => onChange(it.id)}
              className="bare"
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '10px 8px', position: 'relative',
                color: on ? T.accent : T.muted,
              }}>
              <div style={{ width: 22, height: 22, display: 'flex' }}>
                {React.cloneElement(it.icon, { width: 22, height: 22 })}
              </div>
              <div style={{
                fontSize: 10, letterSpacing: 0.2, fontWeight: on ? 600 : 400,
              }}>{it.label}</div>
              {on && (
                <div aria-hidden="true" style={{
                  position: 'absolute', top: 2, width: 20, height: 3,
                  borderRadius: 99, background: T.accent,
                  boxShadow: `0 0 8px ${T.accent}`,
                }}/>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Fab({ onClick }) {
  return (
    <button type="button" className="bare" onClick={onClick}
      aria-label="Ajouter une boisson"
      style={{
        position: 'absolute', bottom: 100, right: 20, zIndex: 30,
        width: 58, height: 58, borderRadius: 20, background: T.accent,
        display: 'grid', placeItems: 'center', color: T.isDark ? T.bg : '#fff',
        boxShadow: T.isDark
          ? `0 10px 26px oklch(72% 0.15 65 / 0.5), 0 0 0 1px oklch(80% 0.12 65 / 0.3)`
          : `0 10px 26px oklch(60% 0.15 50 / 0.45), 0 0 0 1px oklch(60% 0.15 50 / 0.6)`,
      }}>
      <SvgIcon icon={Ic.plus} size={26} />
    </button>
  );
}

function Hint() {
  // Hidden via the .desktop-hint CSS rule when running as installed PWA.
  return (
    <div className="desktop-hint" style={{
      color: T.muted, fontSize: 12, marginTop: 22,
      letterSpacing: 0.2, textAlign: 'center', maxWidth: 360,
      fontFamily: fontSans,
    }}>
      Naviguez entre <span style={{ color: T.accent }}>Catégories</span>, <span style={{ color: T.accent }}>Historique</span> et <span style={{ color: T.accent }}>Stats</span>.
      <br/>Le bouton <span style={{ color: T.accent }}>+</span> ouvre l'ajout · menu ≡ = paramètres.
    </div>
  );
}

Object.assign(window, { App, tabLabel, PhoneFrame, AppHeader, BottomNav, Fab, Hint });

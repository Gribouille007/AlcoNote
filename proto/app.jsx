// app.jsx — Top-level App: header, bottom nav, FAB, tab routing.

function App() {
  useTheme();
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', T._name);
    document.body.className = `theme-${T._name}`;
  });

  const [tab, setTab] = React.useState(() => localStorage.getItem('alconote.tab') || 'categories');
  const [adding, setAdding] = React.useState(false);
  const [prefill, setPrefill] = React.useState(null);
  const [settings, setSettings] = React.useState(false);
  const [openFamily, setOpenFamily] = React.useState(null);
  const [openEntry, setOpenEntry] = React.useState(null);
  const [editFamily, setEditFamily] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [catQuery, setCatQuery] = React.useState('');
  const [catOpen, setCatOpen] = React.useState(null);

  React.useEffect(() => {
    window.__alcoToastSetter = (msg) => {
      setToast(msg);
      clearTimeout(window.__aToast);
      window.__aToast = setTimeout(() => setToast(null), 1800);
    };
  }, []);

  React.useEffect(() => { localStorage.setItem('alconote.tab', tab); }, [tab]);

  const directAdd = React.useCallback(async (family) => {
    try {
      const n = new Date();
      await addDrink({
        name: family.name,
        category: family.category,
        quantity: family.quantity,
        unit: family.unit,
        alcoholContent: family.alcohol || family.alcoholContent || 0,
        date: n.toISOString().slice(0, 10),
        time: n.toTimeString().slice(0, 5),
      });
      Toast.show(`« ${family.name} » ajoutée`);
    } catch (e) {
      Toast.show('Erreur lors de l\'ajout');
    }
  }, []);

  const onAddAgain = React.useCallback((f) => {
    setPrefill(f);
    setAdding(true);
    setOpenFamily(null);
    setOpenEntry(null);
  }, []);

  const onEdit = React.useCallback((f) => {
    setEditFamily(f);
    setOpenFamily(null);
    setOpenEntry(null);
  }, []);

  return (
    <div className="alco-shell" style={{
      minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column',
      background: T.bg, color: T.ink, position: 'relative',
      overflow: 'hidden',
    }}>
      <AppHeader tab={tab} onMenu={() => setSettings(true)} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'categories' && (
          <CategoriesTab
            onOpenFamily={setOpenFamily}
            onAdd={() => setAdding(true)}
            onDirectAdd={directAdd}
            onEditFamily={onEdit}
            query={catQuery} setQuery={setCatQuery}
            openCat={catOpen} setOpenCat={setCatOpen}
          />
        )}
        {tab === 'history' && (
          <HistoryTab onOpenEntry={setOpenEntry} onDirectAdd={directAdd} />
        )}
        {tab === 'stats' && <StatsTab />}
      </div>

      <Fab onClick={() => { setPrefill(null); setAdding(true); }} />
      <BottomNav tab={tab} onChange={setTab} />

      <AddDrinkSheet open={adding} prefill={prefill}
        onClose={() => { setAdding(false); setPrefill(null); }} />
      <SettingsDrawer open={settings} onClose={() => setSettings(false)} />
      {openFamily && (
        <DrinkDetailSheet family={openFamily}
          onClose={() => setOpenFamily(null)}
          onAddAgain={onAddAgain}
          onEdit={onEdit}
        />
      )}
      {openEntry && (
        <DrinkDetailSheet entry={openEntry}
          onClose={() => setOpenEntry(null)}
          onAddAgain={onAddAgain}
          onEdit={onEdit}
        />
      )}
      {editFamily && (
        <EditFamilySheet family={editFamily} onClose={() => setEditFamily(null)} />
      )}

      <ConfirmHost />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(96px + env(safe-area-inset-bottom))',
          left: '50%', transform: 'translateX(-50%)',
          background: T.ink, color: T.bg, padding: '10px 18px', borderRadius: 99,
          fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
          zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fade 0.2s ease',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <span style={{ display: 'flex', color: T.accent }}><SvgIcon icon={Ic.check} size={14} /></span>
          {toast}
        </div>
      )}
    </div>
  );
}

function AppHeader({ tab, onMenu }) {
  const settings = useSettings();
  const titles = {
    categories: 'Catégories',
    history: 'Historique',
    stats: 'Statistiques',
  };
  const today = new Date();
  const dateStr = `${FR_DAYS_LONG[today.getDay()]} ${today.getDate()} ${FR_MONTHS_LONG[today.getMonth()]}`;

  // Live BAC pill: re-tick every 60s so the value decays even when the
  // user stays on the same tab without adding a drink.
  const { drinks } = useDrinks();
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const bacInfo = React.useMemo(() => {
    const w = settings.userWeight ? Number(settings.userWeight) : 70;
    const g = settings.userGender || 'male';
    return computeBacOverTime ? computeBacOverTime(drinks, w, g) : { current: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drinks, settings, tick]);
  const bac = bacInfo.current || 0;

  return (
    <div style={{
      padding: 'calc(env(safe-area-inset-top) + 14px) 18px 14px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 12,
      flexShrink: 0,
    }}>
      <button type="button" onClick={onMenu} aria-label="Ouvrir les paramètres" style={{
        width: 38, height: 38, borderRadius: 12, background: T.surface2,
        display: 'grid', placeItems: 'center', color: T.ink, cursor: 'pointer',
        border: `1px solid ${T.rule}`, padding: 0, fontFamily: 'inherit',
      }}>
        <SvgIcon icon={Ic.menu} size={18} />
      </button>
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        <div style={{
          fontFamily: fontSerif, fontSize: 20, color: T.ink,
          letterSpacing: -0.3, lineHeight: 1, fontStyle: 'italic',
        }}>{titles[tab]}</div>
        <div style={{
          fontSize: 10, color: T.muted, letterSpacing: 1, marginTop: 3,
          textTransform: 'uppercase', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{dateStr}</div>
      </div>
      <div aria-label="Taux d'alcoolémie" title={`${bac} mg/L`} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 10px 6px 8px', borderRadius: 12,
        background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
        minWidth: 48, maxWidth: 86, justifyContent: 'center',
        opacity: bac > 0 ? 1 : 0.7,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: 99, background: T.accent,
          boxShadow: bac > 0 ? `0 0 8px ${T.accent}` : 'none',
          flexShrink: 0,
        }}/>
        <span style={{
          color: T.accent, fontSize: 11, fontWeight: 600,
          fontFamily: fontNum, letterSpacing: 0,
          fontVariantNumeric: 'tabular-nums',
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto',
        }}>{bac}</span>
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
    <div style={{
      position: 'relative',
      padding: '8px 16px calc(4px + env(safe-area-inset-bottom))',
      background: T.bg, borderTop: `1px solid ${T.rule}`,
      flexShrink: 0,
    }}>
      <div role="tablist" aria-label="Navigation principale"
        style={{ display: 'flex', justifyContent: 'space-around', paddingBottom: 2 }}>
        {items.map(it => {
          const on = tab === it.id;
          return (
            <button key={it.id} type="button" role="tab" aria-selected={on}
              aria-label={it.label}
              onClick={() => onChange(it.id)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '10px 8px', cursor: 'pointer', position: 'relative',
                color: on ? T.accent : T.muted,
                background: 'transparent', border: 'none', fontFamily: 'inherit',
              }}>
              <span style={{ width: 22, height: 22, display: 'flex' }} aria-hidden="true">
                {React.cloneElement(it.icon, { width: 22, height: 22 })}
              </span>
              <span style={{
                fontSize: 10, letterSpacing: 0.2, fontWeight: on ? 600 : 400,
              }}>{it.label}</span>
              {on && (
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 2, width: 20, height: 3,
                  borderRadius: 99, background: T.accent,
                  boxShadow: `0 0 8px ${T.accent}`,
                }}/>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function Fab({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="Ajouter une boisson" style={{
      position: 'absolute',
      bottom: 'calc(78px + env(safe-area-inset-bottom))',
      right: 14, zIndex: 30,
      width: 58, height: 58, borderRadius: 20, background: T.accent,
      display: 'grid', placeItems: 'center',
      color: T.isDark ? T.bg : '#fff', cursor: 'pointer',
      border: 'none', padding: 0, fontFamily: 'inherit',
      boxShadow: T.isDark
        ? `0 10px 26px oklch(72% 0.15 65 / 0.5), 0 0 0 1px oklch(80% 0.12 65 / 0.3)`
        : `0 10px 26px oklch(60% 0.15 50 / 0.45), 0 0 0 1px oklch(60% 0.15 50 / 0.6)`,
    }}>
      <SvgIcon icon={Ic.plus} size={26} />
    </button>
  );
}

// Mount the React app once the DOM is ready and the database has been opened.
async function mountAlcoNote() {
  // Wait for dbManager
  await waitForDb();

  // Apply persisted theme from DB if no localStorage override
  try {
    const stored = await window.dbManager.getSetting('theme');
    if (stored && THEMES[stored] && !localStorage.getItem('alconote.theme')) {
      applyTheme(stored);
    }
  } catch {}

  // Preload custom category icon overrides so the first render uses them
  try { await loadCategoryIcons(); } catch {}

  const root = document.getElementById('root');
  if (!root) {
    console.error('AlcoNote: #root not found');
    return;
  }
  ReactDOM.createRoot(root).render(<App/>);
}

// Kick off mount after Babel finishes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAlcoNote);
} else {
  mountAlcoNote();
}

Object.assign(window, { App, AppHeader, BottomNav, Fab, mountAlcoNote });

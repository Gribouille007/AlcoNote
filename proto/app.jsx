// app.jsx — Top-level App: header, bottom nav, FAB, tab routing.

// Catches render-time errors anywhere below it. Without this, a thrown
// error during a delete-driven re-render would unmount the whole tree
// and expose the splash again. We render a minimal recovery panel and
// keep the React subtree alive.
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    try { console.error('AlcoNote runtime error:', error); } catch {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
        padding: 24, background: 'oklch(14% 0.008 50)', color: 'oklch(96% 0.008 85)',
        zIndex: 9999, fontFamily: 'Geist, system-ui, sans-serif',
      }}>
        <div style={{ maxWidth: 360, textAlign: 'center' }}>
          <div style={{
            fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
            fontSize: 28, marginBottom: 12,
          }}>Une erreur est survenue</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 18, lineHeight: 1.5 }}>
            L'application a rencontré un problème. Vos données restent intactes.
          </div>
          <button type="button" onClick={() => location.reload()} style={{
            padding: '12px 22px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: 'oklch(72% 0.15 65)', color: 'oklch(14% 0.008 50)',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>Recharger</button>
        </div>
      </div>
    );
  }
}

// Inner shell — wrapped by the data providers in <App/> so every
// `useDrinks/useRatings/useCategories/useSettings` call inside reads
// from a single shared subscription instead of each spawning its own
// IndexedDB round-trip on every dataBus.bump.
function AppShell() {
  const themeName = useTheme();
  // Sync the <html>/<body> theme hooks only when the theme actually
  // changes — without a dep array this fired on every AppShell render
  // (60s BAC tick, every sheet open/close, toasts…) re-writing the same
  // attributes redundantly.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', T._name);
    document.body.className = `theme-${T._name}`;
  }, [themeName]);

  // Once React has rendered for the first time, drop the splash element
  // entirely so a future render error or transient empty-root state can
  // never expose the "AlcoNote" splash on top of the UI.
  React.useEffect(() => {
    const splash = document.getElementById('alco-splash');
    if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
  }, []);

  const [tab, setTab] = React.useState(() => localStorage.getItem('alconote.tab') || 'categories');
  // Lazy-sticky mount: only the active tab is rendered on launch, then
  // every tab the user visits stays mounted (display:none when hidden)
  // so subsequent switches don't pay the StatsTab remount cost.
  const [activated, setActivated] = React.useState(() => new Set([tab]));
  React.useEffect(() => {
    setActivated(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev); next.add(tab); return next;
    });
  }, [tab]);

  const [adding, setAdding] = React.useState(false);
  const [prefill, setPrefill] = React.useState(null);
  const [settings, setSettings] = React.useState(false);
  const [openFamily, setOpenFamily] = React.useState(null);
  const [openEntry, setOpenEntry] = React.useState(null);
  const [editFamily, setEditFamily] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [catQuery, setCatQuery] = React.useState('');
  const [catOpen, setCatOpen] = React.useState(null);

  const { drinks } = useDrinks();
  const ratings = useRatings();
  // BAC (header pill + Stats gauge) is owned by <BacProvider> above, so its
  // 60s decay tick no longer re-renders this shell or the tabs.
  // Category-icon overrides are owned by <CategoryIconsProvider> which
  // wraps <AppShell/> (see <App/> below) — every <CategoryGlyph>
  // re-renders from the context when a single mutation bumps
  // 'cat-icons'. AppShell no longer needs to subscribe directly.
  // Families: hoisted from the legacy "build per-tab" pattern to a
  // single memo here. HistoryTab / CategoriesTab / DrinkDetailSheet
  // all consume the same array, so a drinks bump rebuilds the grouping
  // exactly once instead of once per visible tab.
  const families = React.useMemo(
    () => buildFamilies(drinks, ratings),
    [drinks, ratings]
  );

  React.useEffect(() => {
    window.__alcoToastSetter = (msg, opts) => {
      setToast({ msg, opts: opts || null });
      clearTimeout(window.__aToast);
      // Undo toasts stay visible longer so the user has time to react.
      const ttl = opts && typeof opts.undo === 'function' ? 5000 : 1800;
      window.__aToast = setTimeout(() => setToast(null), ttl);
    };
  }, []);

  React.useEffect(() => { localStorage.setItem('alconote.tab', tab); }, [tab]);

  // Android Back exits the category drill-down (FamilyList) back to the
  // category grid instead of leaving the app. Sheets/dialogs register
  // their own back handlers via SheetOverlay / ConfirmHost.
  useBackButton(!!catOpen, React.useCallback(() => setCatOpen(null), []));

  const directAdd = React.useCallback(async (family) => {
    try {
      const n = new Date();
      const created = await addDrink({
        name: family.name,
        category: family.category,
        quantity: family.quantity,
        unit: family.unit,
        alcoholContent: family.alcohol || family.alcoholContent || 0,
        // Local date/time pair so BAC's 24h window stays consistent
        // (UTC date + local time used to drop drinks added late at
        // night in positive-UTC zones).
        date: localDate(n),
        time: localTime(n),
      });
      Toast.show(`« ${family.name} » ajoutée`);
      // Même capture de lieu non bloquante que l'ajout via la feuille,
      // pour que les ajouts rapides apparaissent aussi sur la carte.
      if (created && created.id != null) {
        captureLocationForDrink().then(loc => {
          if (loc) updateDrink(created.id, { location: loc });
        });
      }
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

  // Inactive tabs render with display:none so React keeps their subtree
  // alive but the browser skips layout / paint. Combined with the
  // shared data context above, switching tabs becomes a CSS toggle
  // instead of a full unmount + remount + refetch.
  const tabContainer = (id) => ({
    flex: 1, minHeight: 0,
    display: tab === id ? 'flex' : 'none',
    flexDirection: 'column',
  });

  return (
    <FamiliesContext.Provider value={families}>
    <div className="alco-shell" style={{
      minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column',
      background: T.bg, color: T.ink, position: 'relative',
      overflow: 'hidden',
    }}>
      <AppHeader tab={tab} onMenu={() => setSettings(true)} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activated.has('categories') && (
          <div style={tabContainer('categories')}>
            <CategoriesTab
              onOpenFamily={setOpenFamily}
              onDirectAdd={directAdd}
              onEditFamily={onEdit}
              query={catQuery} setQuery={setCatQuery}
              openCat={catOpen} setOpenCat={setCatOpen}
            />
          </div>
        )}
        {activated.has('history') && (
          <div style={tabContainer('history')}>
            <HistoryTab onOpenEntry={setOpenEntry} onDirectAdd={directAdd} />
          </div>
        )}
        {activated.has('stats') && (
          <div style={tabContainer('stats')}>
            <StatsTab />
          </div>
        )}
      </div>

      <Fab onClick={() => { setPrefill(null); setAdding(true); }} />
      <BottomNav tab={tab} onChange={setTab} />

      <AddDrinkSheet open={adding} prefill={prefill}
        onClose={() => { setAdding(false); setPrefill(null); }} />
      <SettingsDrawer open={settings} onClose={() => setSettings(false)} />
      {openFamily && (
        <DrinkDetailSheet key={openFamily.id} family={openFamily}
          onClose={() => setOpenFamily(null)}
          onAddAgain={onAddAgain}
          onEdit={onEdit}
        />
      )}
      {openEntry && (
        <DrinkDetailSheet key={openEntry.id || (openEntry.family && openEntry.family.id)} entry={openEntry}
          onClose={() => setOpenEntry(null)}
          onAddAgain={onAddAgain}
          onEdit={onEdit}
        />
      )}
      {editFamily && (
        <EditFamilySheet key={editFamily.id} family={editFamily} onClose={() => setEditFamily(null)} />
      )}

      <ConfirmHost />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(96px + env(safe-area-inset-bottom))',
          left: '50%', transform: 'translateX(-50%)',
          background: T.ink, color: T.bg, padding: '10px 14px 10px 18px', borderRadius: 99,
          fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
          zIndex: 9999, boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'fade 0.2s ease',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <span style={{ display: 'flex', color: T.accent }}><SvgIcon icon={Ic.check} size={14} /></span>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {toast.msg}
          </span>
          {toast.opts && typeof toast.opts.undo === 'function' && (
            <button type="button"
              onClick={() => {
                const fn = toast.opts.undo;
                clearTimeout(window.__aToast);
                setToast(null);
                // Surface synchronous undo failures rather than swallow
                // them silently — async errors are reported by the
                // callback via a follow-up Toast.show.
                try { fn(); }
                catch (err) { console.warn('AlcoNote: undo failed', err); }
              }}
              style={{
                marginLeft: 4, padding: '5px 12px', borderRadius: 99,
                background: T.accent, color: T.isDark ? T.bg : '#fff',
                border: 'none', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                letterSpacing: 0.1,
              }}>Annuler</button>
          )}
        </div>
      )}
    </div>
    </FamiliesContext.Provider>
  );
}

// Outer App: hosts the data providers so AppShell's hooks read from
// a single subscription rather than N parallel ones.
function App() {
  return (
    <SettingsProvider>
      <CategoriesProvider>
        <RatingsProvider>
          <DrinksProvider>
            <CategoryIconsProvider>
              <BacProvider>
                <AppShell />
              </BacProvider>
            </CategoryIconsProvider>
          </DrinksProvider>
        </RatingsProvider>
      </CategoriesProvider>
    </SettingsProvider>
  );
}

function AppHeader({ tab, onMenu }) {
  const titles = {
    categories: 'Catégories',
    history: 'Historique',
    stats: 'Statistiques',
  };
  const today = new Date();
  const dateStr = `${FR_DAYS_LONG[today.getDay()]} ${today.getDate()} ${FR_MONTHS_LONG[today.getMonth()]}`;

  // Read from the App-level BacContext: same object reference as the
  // Stats-tab gauge, so the pill always shows exactly the same mg/L.
  const bacInfo = useBacInfo();
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
    { id: 'categories', label: 'Catégories', icon: Ic.grid },
    { id: 'history',    label: 'Historique', icon: Ic.clockArrow },
    { id: 'stats',      label: 'Stats',      icon: Ic.bars },
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
              <SvgIcon icon={it.icon} size={22} />
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
      boxShadow: `0 10px 26px ${withAlpha(T.accent, T.isDark ? 0.5 : 0.45)}, 0 0 0 1px ${withAlpha(T.accentRing, T.isDark ? 0.3 : 0.6)}`,
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

  // Migrate any legacy name-keyed icon overrides to the id-keyed format
  // BEFORE seeding, so the preload below already reflects migrated glyphs
  // (no flash). Idempotent — a cheap no-op once done.
  try { await migrateCategoryIconsToId(); } catch {}

  // Preload custom category icon overrides so the first paint already
  // shows them. The Provider reads this one-shot seed in its useState
  // initializer (single read — not a long-lived global mutable), then
  // refreshes from the DB on every dataBus.bump('cat-icons').
  try { window.__alcoCatIconsInitial = await loadCategoryIcons(); } catch {}

  const root = document.getElementById('root');
  if (!root) {
    console.error('AlcoNote: #root not found');
    return;
  }
  ReactDOM.createRoot(root).render(
    <AppErrorBoundary><App/></AppErrorBoundary>
  );
}

// Kick off mount after Babel finishes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAlcoNote);
} else {
  mountAlcoNote();
}

Object.assign(window, { App, AppShell, AppErrorBoundary, AppHeader, BottomNav, Fab, mountAlcoNote });

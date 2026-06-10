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
        padding: 24, background: T.bg, color: T.ink,
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
            background: T.accent, color: T.accentInk,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>Recharger</button>
        </div>
      </div>
    );
  }
}

// Ombre du toast — constante nommée (identique en thème clair/sombre).
const TOAST_SHADOW = '0 10px 30px rgba(0,0,0,0.3)';

// Inner shell — wrapped by the data providers in <App/> so every
// `useDrinks/useRatings/useCategories/useSettings` call inside reads
// from a single shared subscription instead of each spawning its own
// IndexedDB round-trip on every dataBus.bump.
function AppShell() {
  const themeName = useTheme();
  const reducedMotion = useReducedMotion();
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

  // Pré-monte l'onglet Historique en idle après le 1er rendu : il reste en
  // display:none, donc le premier tap devient un simple toggle CSS — ouverture
  // instantanée au lieu de payer le mount synchrone à ce moment-là.
  React.useEffect(() => {
    let cancelled = false;
    const warm = () => { if (!cancelled) setActivated(prev => (prev.has('history') ? prev : new Set(prev).add('history'))); };
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback : null;
    const handle = ric ? ric(warm, { timeout: 2500 }) : setTimeout(warm, 1500);
    return () => {
      cancelled = true;
      if (ric && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, []);

  // Filet « plus jamais d'adresse manquante » : en idle, complète les adresses
  // des boissons qui ont des coordonnées mais pas de libellé (cf. data.jsx ›
  // backfillMissingAddresses — sans nouvelle acquisition GPS).
  React.useEffect(() => {
    const run = () => { try { backfillMissingAddresses(); } catch (e) {} };
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback : null;
    const handle = ric ? ric(run, { timeout: 6000 }) : setTimeout(run, 4000);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
  }, []);

  const [adding, setAdding] = React.useState(false);
  const [prefill, setPrefill] = React.useState(null);
  const [settings, setSettings] = React.useState(false);
  const [openFamily, setOpenFamily] = React.useState(null);
  const [openEntry, setOpenEntry] = React.useState(null);
  const [editFamily, setEditFamily] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [catQuery, setCatQuery] = React.useState('');
  const [catOpen, setCatOpen] = React.useState(null);
  const [openFriend, setOpenFriend] = React.useState(null);
  const statsReorderRef = React.useRef();

  const { drinks } = useDrinks();
  const ratings = useRatings();
  // NB: `settings` (boolean) est déjà l'état d'ouverture du tiroir Paramètres
  // plus haut — d'où `userSettings` pour la map de réglages (prix de réf.).
  const userSettings = useSettings();
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
  // Prix de référence par famille, dérivés des settings (price.ref.*) puis
  // passés à buildFamilies pour peupler `family.referencePrice` (repris par
  // le « + » et « Ajouter à nouveau »).
  const priceRefs = React.useMemo(() => priceRefsFromSettings(userSettings), [userSettings]);
  const families = React.useMemo(
    () => buildFamilies(drinks, ratings, priceRefs),
    [drinks, ratings, priceRefs]
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
  // Android Back closes an open friend's stats view before leaving the app.
  useBackButton(!!openFriend, React.useCallback(() => setOpenFriend(null), []));

  const directAdd = React.useCallback(async (family) => {
    try {
      const n = new Date();
      const created = await addDrink({
        name: family.name,
        category: family.category,
        quantity: family.quantity,
        unit: family.unit,
        alcoholContent: family.alcohol || 0,
        // Reprend le prix de référence de la famille (modifiable ensuite par
        // entrée via « Modifier l'entrée »). N'altère jamais la référence.
        price: family.referencePrice != null ? family.referencePrice : null,
        // Ajout « + » = au prix de référence (suit les futures cascades de réf.).
        priceIsCustom: false,
        // Local date/time pair so BAC's 24h window stays consistent
        // (UTC date + local time used to drop drinks added late at
        // night in positive-UTC zones).
        date: localDate(n),
        time: localTime(n),
      });
      Toast.show(`« ${family.name} » ajoutée`);
      // Capture de lieu fiable et non bloquante (centralisée dans data.jsx :
      // survit à la fermeture, reverse-geocode borné + retry).
      if (created && created.id != null) attachLocationToDrink(created.id);
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
  // Inactive tabs keep `animation` set but `display:none` suspends it ;
  // when a tab becomes visible (display:none → flex) the spec restarts
  // its animation, so `alcoRise` rejoue à chaque activation sans démonter
  // le sous-arbre (on garde la persistance/perf du StatsTab).
  const tabContainer = (id) => ({
    flex: 1, minHeight: 0,
    display: tab === id ? 'flex' : 'none',
    flexDirection: 'column',
    animation: reducedMotion ? undefined : `alcoRise ${MOTION.base}ms ${MOTION.ease}`,
  });

  return (
    <FamiliesContext.Provider value={families}>
    <div className="alco-shell" style={{
      minHeight: '100dvh', height: '100dvh', display: 'flex', flexDirection: 'column',
      background: T.bg, color: T.ink, position: 'relative',
      overflow: 'hidden',
    }}>
      <AppHeader tab={tab} onMenu={() => setSettings(true)} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
            <StatsTab reorderRef={statsReorderRef} />
          </div>
        )}
        {activated.has('friends') && (
          <div style={tabContainer('friends')}>
            <FriendsTab onOpenFriend={setOpenFriend} />
          </div>
        )}
      </main>

      <Fab onClick={() => { setPrefill(null); setAdding(true); }} />
      <BottomNav tab={tab} onChange={setTab}
        onReorder={() => statsReorderRef.current && statsReorderRef.current()} />

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
      {openFriend && (
        <FriendStatsView key={openFriend.userId} friend={openFriend} onClose={() => setOpenFriend(null)} />
      )}

      <ConfirmHost />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(96px + env(safe-area-inset-bottom))',
          left: '50%', transform: 'translateX(-50%)',
          background: T.ink, color: T.bg, padding: '10px 14px 10px 18px', borderRadius: 99,
          fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
          zIndex: 9999, boxShadow: TOAST_SHADOW,
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
                marginLeft: 4, padding: '6px 12px', borderRadius: 99,
                background: T.accent, color: T.accentInk,
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
    friends: 'Amis',
  };
  const today = new Date();
  const dateStr = `${FR_DAYS_LONG[today.getDay()]} ${today.getDate()} ${FR_MONTHS_LONG[today.getMonth()]}`;

  return (
    <header style={{
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
        <h1 style={{
          fontFamily: fontSerif, fontSize: 20, color: T.ink,
          letterSpacing: -0.3, lineHeight: 1, fontStyle: 'italic',
          margin: 0, fontWeight: 400,
        }}>{titles[tab]}</h1>
        <div style={{
          fontSize: 10, color: T.muted, letterSpacing: 1, marginTop: 3,
          textTransform: 'uppercase', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{dateStr}</div>
      </div>
      {/* Pile des pastilles BAC (la mienne + ami favori) dans un slot à
          hauteur FIXE de 38px, calé sur le bouton menu : le header garde
          exactement la même hauteur avec ou sans favori (cf. HeaderBacStack
          dans friends.jsx, qui confine aussi les abonnements BAC/share). */}
      <HeaderBacStack />
    </header>
  );
}

// Un seul bouton de nav (hook usePressScale → impossible dans un .map).
function NavButton({ item, active, onChange }) {
  const reduced = useReducedMotion();
  const press = usePressScale();
  return (
    <button type="button" role="tab" aria-selected={active}
      aria-label={item.label}
      {...press.handlers}
      onClick={() => onChange(item.id)} style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '10px 8px', cursor: 'pointer', position: 'relative',
        color: active ? T.accent : T.muted,
        background: 'transparent', border: 'none', fontFamily: 'inherit',
        ...press.style,
        ...(reduced ? null : { transition: `transform ${MOTION.fast}ms ${MOTION.ease}, color ${MOTION.fast}ms ${MOTION.ease}` }),
      }}>
      <SvgIcon icon={item.icon} size={22} />
      <span style={{
        fontSize: 10, letterSpacing: 0.2, fontWeight: active ? 600 : 400,
      }}>{item.label}</span>
    </button>
  );
}

function BottomNav({ tab, onChange, onReorder }) {
  const reduced = useReducedMotion();
  const items = [
    { id: 'categories', label: 'Catégories', icon: Ic.grid },
    { id: 'history',    label: 'Historique', icon: Ic.clockArrow },
    { id: 'stats',      label: 'Stats',      icon: Ic.bars },
    { id: 'friends',    label: 'Amis',       icon: Ic.users },
  ];
  const activeIdx = Math.max(0, items.findIndex(it => it.id === tab));
  return (
    <nav style={{
      position: 'relative',
      padding: '6px 16px calc(4px + env(safe-area-inset-bottom))',
      background: T.bg, borderTop: `1px solid ${T.rule}`,
      flexShrink: 0,
    }}>
      {tab === 'stats' && onReorder && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
          <button type="button" onClick={onReorder}
            aria-label="Réorganiser les sections"
            style={{
              ...ghostButton, display: 'flex', alignItems: 'center', gap: 5,
              color: T.muted, fontSize: 10, letterSpacing: 0.3,
              textTransform: 'uppercase', fontWeight: 500, padding: '2px 8px',
            }}>
            <SvgIcon icon={Ic.grip} size={12} /> Réorganiser
          </button>
        </div>
      )}
      <div role="tablist" aria-label="Navigation principale"
        style={{ display: 'flex', justifyContent: 'space-around', paddingBottom: 2, position: 'relative' }}>
        {/* Indicateur actif unique : glisse d'un onglet à l'autre au lieu
            d'apparaître. Hors flux (absolute) pour ne pas pousser les boutons. */}
        <div aria-hidden="true" style={{
          position: 'absolute', top: 2, left: 0, height: 3,
          width: `${100 / items.length}%`,
          display: 'flex', justifyContent: 'center',
          transform: `translateX(${activeIdx * 100}%)`,
          transition: reduced ? undefined : `transform ${MOTION.base}ms ${MOTION.ease}`,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 20, height: 3, borderRadius: 99,
            background: T.accent, boxShadow: `0 0 8px ${T.accent}`,
          }}/>
        </div>
        {items.map(it => (
          <NavButton key={it.id} item={it} active={tab === it.id} onChange={onChange} />
        ))}
      </div>
    </nav>
  );
}
function Fab({ onClick }) {
  const reduced = useReducedMotion();
  const press = usePressScale();
  return (
    <button type="button" onClick={onClick} aria-label="Ajouter une boisson"
      {...press.handlers} style={{
      position: 'absolute',
      bottom: 'calc(78px + env(safe-area-inset-bottom))',
      right: 14, zIndex: 30,
      width: 58, height: 58, borderRadius: 20, background: T.accent,
      display: 'grid', placeItems: 'center',
      color: T.accentInk, cursor: 'pointer',
      border: 'none', padding: 0, fontFamily: 'inherit',
      boxShadow: `0 10px 26px ${withAlpha(T.accent, T.isDark ? 0.5 : 0.45)}, 0 0 0 1px ${withAlpha(T.accentRing, T.isDark ? 0.3 : 0.6)}`,
      ...press.style,
      ...(reduced ? null : { animation: `scaleIn ${MOTION.base}ms ${MOTION.ease}` }),
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

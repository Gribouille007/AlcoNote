// history.jsx — Tab 2: Historique (chronological list grouped by day, or by
// drinking session — cf. sessions.jsx)

const HIST_COLLAPSED_KEY = 'alconote.hist.collapsed';
// Mode d'affichage mémorisé : 'day' (par jour, défaut) | 'session'.
const HIST_MODE_KEY = 'alconote.hist.mode';
const HIST_MODES = [
  { id: 'day', label: 'Par jour', icon: 'cal' },
  { id: 'session', label: 'Par session', icon: 'hourglass' },
];

function loadHistMode() {
  try { return localStorage.getItem(HIST_MODE_KEY) === 'session' ? 'session' : 'day'; }
  catch { return 'day'; }
}

function loadCollapsedDays() {
  try { return new Set(JSON.parse(localStorage.getItem(HIST_COLLAPSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveCollapsedDays(set) {
  try { localStorage.setItem(HIST_COLLAPSED_KEY, JSON.stringify([...set])); } catch {}
}

// Rendu au défilement : on ne monte que les jours proches de l'écran. Les
// suivants arrivent par paquets quand la sentinelle de fin de liste approche
// du bas de la zone visible (IntersectionObserver, marge d'avance). Monter
// TOUT l'historique (ancien comportement : extension en idle jusqu'au bout)
// laissait des dizaines de milliers de nœuds dans le DOM → chaque retour sur
// l'onglet (display:none → flex) re-layoutait tout : plusieurs secondes sur
// téléphone.
const HIST_INITIAL_DAYS = 8;
const HIST_PAGE_DAYS = 12;
const HIST_PREFETCH_PX = 1200;

function HistoryTab({ onOpenEntry, onDirectAdd }) {
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [collapsed, setCollapsed] = React.useState(loadCollapsedDays);
  const [editEntry, setEditEntry] = React.useState(null);
  const [visibleCount, setVisibleCount] = React.useState(HIST_INITIAL_DAYS);
  const [mode, setModeState] = React.useState(loadHistMode);
  const bySession = mode === 'session';
  const setMode = React.useCallback((m) => {
    setModeState(m);
    try { localStorage.setItem(HIST_MODE_KEY, m); } catch {}
  }, []);
  // Page de stats d'une session / sheet de renommage (mode « Par session »).
  const [openSessionId, setOpenSessionId] = React.useState(null);
  const [renameTarget, setRenameTarget] = React.useState(null);
  const openSession = React.useCallback((sess) => setOpenSessionId(sess.id), []);
  const renameSession = React.useCallback((sess, name) => setRenameTarget({ session: sess, name }), []);
  const scrollRef = React.useRef(null);
  const sentinelRef = React.useRef(null);
  // Frappe fluide : le champ se met à jour tout de suite, le filtrage de la
  // liste suit en priorité basse (interruptible par la frappe suivante).
  const deferredQuery = React.useDeferredValue(query);

  const { categories } = useCategories();
  // Pilules de filtre teintées par catégorie → abonnement palette
  // (repaint sur changement de couleur, cf. useCatPalette dans shared.jsx).
  useCatPalette();
  // Single shared families memo from the App-level FamiliesContext —
  // avoids re-building (drinks × ratings) per tab on every bump.
  const families = useFamilies();
  // Références stables d'un rendu à l'autre (cf. stabilizeEntries) : après
  // un ajout, seules les lignes réellement changées se re-rendent.
  const entryCacheRef = React.useRef(null);
  const dayCacheRef = React.useRef(null);
  const sessCacheRef = React.useRef(null);
  const allEntries = React.useMemo(() => {
    const r = stabilizeEntries(flattenEntries(families), entryCacheRef.current);
    entryCacheRef.current = r.cache;
    return r.entries;
  }, [families]);

  // Un filtre pointant une catégorie renommée/supprimée devient orphelin :
  // plus aucune pilule active et « Aucune entrée trouvée » sans explication.
  // On retombe sur « Tous » dès que la catégorie filtrée n'existe plus
  // (guard sur la liste chargée pour ne pas reset pendant le boot).
  React.useEffect(() => {
    if (filter !== 'all' && categories.length > 0 &&
        !categories.some(c => canonicalCat(c.name) === canonicalCat(filter))) {
      setFilter('all');
    }
  }, [filter, categories]);

  // Delete immediately, no modal — surface an "Annuler" toast for 5s
  // so a mistaken swipe is reversible. Mirrors the legacy bar-app UX
  // and avoids a confirmation dialog stalling the swipe gesture.
  const onDeleteEntry = React.useCallback(async (entry) => {
    try {
      const row = await deleteDrinkWithSnapshot(entry.id);
      Toast.show('Boisson supprimée', {
        undo: async () => {
          try {
            await restoreDrinks([row]);
            Toast.show('Suppression annulée');
          } catch (err) {
            console.warn('AlcoNote: restoreDrinks failed', err);
            Toast.show('Erreur lors de l\'annulation');
          }
        },
      });
    } catch (err) {
      console.warn('AlcoNote: deleteDrinkWithSnapshot failed', err);
      Toast.show('Erreur lors de la suppression');
    }
  }, []);

  const toggleDay = React.useCallback((day) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      saveCollapsedDays(next);
      return next;
    });
  }, []);

  // Sessions (mode « Par session » uniquement) : moteur Widmark UNIQUE via le
  // cache partagé avec Stats et la page d'une session (même tableau de
  // boissons → mêmes objets, aucun recalcul). Rien n'est calculé en mode jour.
  const { drinks } = useDrinks();
  const settings = useSettings();
  const { weight, gender } = widmarkParams(settings);
  const sessions = React.useMemo(
    () => (bySession ? cachedBACSessions(drinks, weight, gender) : null),
    [bySession, drinks, weight, gender]
  );
  const sessionIndex = React.useMemo(() => (sessions ? sessionIndexByDrinkId(sessions) : null), [sessions]);
  const names = useSessionNames();
  // Re-rendu pile au retour à 0 de la session en cours (badge « En cours »).
  const tickNow = useSessionEndTick(sessions);
  const ongoingKey = sessions ? sessions.filter(x => isSessionOngoing(x, tickNow)).map(x => x.id).join('|') : '';
  // Recherche « Par session » : les mots du NOM de la session s'ajoutent aux
  // mots cherchables de chaque boisson (« anniv » → toute la session).
  const extraWords = React.useMemo(() => {
    if (!sessionIndex || names.size === 0) return null;
    const cache = new Map();
    return (e) => {
      const sess = sessionIndex.get(e.id);
      if (!sess) return null;
      let w = cache.get(sess.id);
      if (w === undefined) {
        const n = resolveSessionName(sess, names);
        w = n ? searchTokens(n) : null;
        cache.set(sess.id, w);
      }
      return w;
    };
  }, [sessionIndex, names]);

  // Filtre (catégorie canonique) + recherche tolérante (casse, accents,
  // fautes, multi-mots, lieu — cf. filterHistoryEntries, data.jsx) puis
  // groupement par jour OU par session, mémoïsés : chaque groupe garde sa
  // référence tant que données/filtre ne bougent pas → les DayGroup /
  // SessionGroup (React.memo) sautent leur rendu.
  const filtered = React.useMemo(
    () => filterHistoryEntries(allEntries, { query: deferredQuery, category: filter,
      extraWords: bySession ? extraWords : null }),
    [allEntries, filter, deferredQuery, bySession, extraWords]
  );
  const approx = filtered.approx;
  const dayGroups = React.useMemo(() => {
    if (bySession) return [];
    const g = stabilizeDayGroups(groupEntriesByDay(filtered.entries), dayCacheRef.current);
    dayCacheRef.current = g.byDay;
    return g.groups;
  }, [filtered, bySession]);
  const sessionGroups = React.useMemo(() => {
    if (!bySession) return [];
    const nowMs = Date.now();
    const raw = groupEntriesBySession(filtered.entries, sessions, sessionIndex).map(g => (g.session
      ? { ...g, name: resolveSessionName(g.session, names), ongoing: isSessionOngoing(g.session, nowMs) }
      : { ...g, name: null, ongoing: false }));
    const r = stabilizeSessionGroups(raw, sessCacheRef.current);
    sessCacheRef.current = r.byKey;
    return r.groups;
  }, [filtered, bySession, sessions, sessionIndex, names, ongoingKey]);
  const groupCount = bySession ? sessionGroups.length : dayGroups.length;

  // Recherche/filtre changé → on repart des premiers jours, en haut de liste
  // (sinon on garderait une grande fenêtre déjà étendue sur un nouveau
  // résultat, ou une position de défilement au milieu de nulle part).
  React.useEffect(() => {
    setVisibleCount(HIST_INITIAL_DAYS);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filter, deferredQuery, mode]);

  // Extension au défilement. L'observer est recréé à chaque extension :
  // observe() livre toujours un premier état, donc si la sentinelle est
  // ENCORE dans la marge (écran haut, jours repliés), on enchaîne un paquet
  // de plus sans attendre un nouveau défilement.
  const hasMore = visibleCount < groupCount;
  React.useEffect(() => {
    if (!hasMore) return;
    const root = scrollRef.current, target = sentinelRef.current;
    if (typeof window.IntersectionObserver === 'function' && root && target) {
      const io = new window.IntersectionObserver((items) => {
        // Transition : le rendu du paquet est découpé et interruptible —
        // le défilement en cours ne saccade pas pendant le montage.
        if (items.some(it => it.isIntersecting)) {
          React.startTransition(() => setVisibleCount(c => Math.min(groupCount, c + HIST_PAGE_DAYS)));
        }
      }, { root, rootMargin: `0px 0px ${HIST_PREFETCH_PX}px 0px` });
      io.observe(target);
      return () => io.disconnect();
    }
    // Repli sans IntersectionObserver : extension progressive en idle.
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback : null;
    const grow = () => setVisibleCount(c => Math.min(groupCount, c + HIST_PAGE_DAYS));
    const h = ric ? ric(grow, { timeout: 500 }) : setTimeout(grow, 80);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(h);
      else clearTimeout(h);
    };
  }, [hasMore, visibleCount, groupCount]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px 18px 10px' }}>
        <SearchInput value={query} onChange={setQuery}
          placeholder={bySession ? 'Boisson, lieu ou nom de session…' : "Rechercher dans l'historique…"} />
      </div>

      <div style={{ padding: '0 18px 10px' }}>
        <div role="tablist" aria-label="Affichage de l'historique" style={{
          display: 'flex', gap: 2, padding: 3, background: T.surface2,
          borderRadius: 12, border: `1px solid ${T.rule}`,
        }}>
          {HIST_MODES.map(m => {
            const on = mode === m.id;
            return (
              <button key={m.id} type="button" role="tab" aria-selected={on}
                onClick={() => setMode(m.id)} style={{
                  flex: 1, padding: '6px 10px', borderRadius: 9, cursor: 'pointer',
                  background: on ? T.accent : 'transparent',
                  color: on ? T.accentInk : T.ink2,
                  fontSize: 12, fontWeight: on ? 600 : 400, letterSpacing: -0.1,
                  whiteSpace: 'nowrap', border: 'none', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.18s ease, color 0.18s ease',
                }}>
                <SvgIcon icon={Ic[m.icon]} size={13} />{m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, padding: '2px 18px 14px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        <Pill active={filter === 'all'} onClick={() => setFilter('all')}>Tous</Pill>
        {categories.map(c => (
          <Pill key={c.id} active={filter === c.name} onClick={() => setFilter(c.name)}
                color={catColor(c.name, 70)}>{c.name}</Pill>
        ))}
      </div>

      <div ref={scrollRef} data-tab-scroll style={{ flex: 1, overflow: 'auto', padding: '0 18px 120px' }}>
        {approx && groupCount > 0 && (
          <div role="status" style={{
            color: T.muted, fontSize: 12, fontFamily: fontSerif, fontStyle: 'italic',
            padding: '0 2px 6px',
          }}>
            Aucune correspondance exacte — résultats approchants pour « {deferredQuery.trim()} »
          </div>
        )}
        {groupCount === 0 && (
          <div style={{ color: T.muted, fontSize: 13, padding: '60px 0', textAlign: 'center' }}>
            {deferredQuery.trim() ? `Aucun résultat pour « ${deferredQuery.trim()} »` : 'Aucune entrée trouvée'}
          </div>
        )}
        {bySession ? sessionGroups.slice(0, visibleCount).map((g, i) => (
          <SessionGroup key={g.key} group={g} name={g.name} ongoing={g.ongoing}
            onOpenSession={openSession} onRenameSession={renameSession}
            onOpenEntry={setEditEntry}
            onDirectAdd={onDirectAdd}
            onDelete={onDeleteEntry}
            index={i} first={i === 0} />
        )) : dayGroups.slice(0, visibleCount).map((g, i) => (
          <DayGroup key={g.day} day={g.day} entries={g.entries} totalCl={g.totalCl}
            isCollapsed={collapsed.has(g.day)} onToggle={toggleDay}
            onOpenEntry={setEditEntry}
            onDirectAdd={onDirectAdd}
            onDelete={onDeleteEntry}
            index={i} first={i === 0} />
        ))}
        {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
      </div>

      {editEntry && (
        <EditEntrySheet key={editEntry.id} entry={editEntry} onClose={() => setEditEntry(null)} />
      )}
      {renameTarget && (
        <RenameSessionSheet key={renameTarget.session.id} session={renameTarget.session}
          name={renameTarget.name} onClose={() => setRenameTarget(null)} />
      )}
      {openSessionId && (
        <SessionStatsPortal key={openSessionId} sessionId={openSessionId} canEdit
          onClose={() => setOpenSessionId(null)} />
      )}
    </div>
  );
}

const DayGroup = React.memo(function DayGroup({ day, entries, totalCl = 0, isCollapsed, onToggle, onOpenEntry, onDirectAdd, onDelete, first, index = 0 }) {
  useTheme();   // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  const reduced = useReducedMotion();
  const d = new Date(day + 'T00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  let rel = null;
  if (diff === 0) rel = "Aujourd'hui";
  else if (diff === 1) rel = 'Hier';
  else if (diff >= 2 && diff < 7) rel = `il y a ${diff} jours`;

  return (
    <div style={{ marginTop: first ? 4 : 14, marginBottom: 4, position: 'relative',
      // Jours hors écran : le navigateur saute leur layout/paint (y compris
      // au retour sur l'onglet) ; `auto` mémorise la hauteur réelle une fois
      // rendue → pas de saut de défilement.
      contentVisibility: 'auto', containIntrinsicSize: 'auto 180px',
      ...staggerStyle(index, { reduced }) }}>
      <button type="button" onClick={() => onToggle(day)}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? 'Déplier' : 'Replier'} ${fmtDayHeader(d)} — ${entries.length} boisson${entries.length > 1 ? 's' : ''}, ${totalCl.toFixed(0)} cL${rel ? `, ${rel}` : ''}`}
        style={{
        width: '100%', textAlign: 'left',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: T.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12,
        borderBottomLeftRadius: isCollapsed ? 12 : 0,
        borderBottomRightRadius: isCollapsed ? 12 : 0,
        borderTop: `1px solid ${T.rule}`,
        borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`,
        borderBottom: isCollapsed ? `1px solid ${T.rule}` : 'none',
        cursor: 'pointer', position: 'relative', zIndex: 2,
        fontFamily: 'inherit', color: 'inherit',
      }}>
        <span style={{
          color: T.muted, transition: 'transform 0.2s ease',
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          display: 'flex',
        }}>
          <SvgIcon icon={Ic.chev} size={12} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: fontSerif, fontSize: 18, color: T.ink,
            letterSpacing: -0.2, lineHeight: 1.05,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{fmtDayHeader(d)}</div>
          <div style={{
            fontSize: 10, color: T.muted, letterSpacing: 0.6, marginTop: 3, fontFamily: fontNum,
          }}>
            {entries.length} boisson{entries.length > 1 ? 's' : ''} · {totalCl.toFixed(0)} cL
            {rel && <span> · {rel}</span>}
          </div>
        </div>
      </button>

      <Collapse open={!isCollapsed}>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{
            position: 'absolute', left: 22, top: 0, bottom: 14,
            width: 2, background: T.rule,
          }}/>
          <div style={{
            background: T.surface, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
            borderLeft: `1px solid ${T.rule}`,
            borderRight: `1px solid ${T.rule}`,
            borderBottom: `1px solid ${T.rule}`,
            marginLeft: -24,
            // Les fonds (carrés) des lignes ne débordent plus des coins
            // arrondis du bas de la carte.
            overflow: 'hidden',
          }}>
            {entries.map((e, i) => (
              <EntryRow key={e.id || i} entry={e} onOpenEntry={onOpenEntry}
                onDirectAdd={onDirectAdd}
                onDelete={onDelete}
                first={i === 0}
                last={i === entries.length - 1} />
            ))}
          </div>
        </div>
      </Collapse>
    </div>
  );
});
const EntryRow = React.memo(function EntryRow({ entry: e, onOpenEntry, onDirectAdd, onDelete, first, last }) {
  useTheme();   // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  // Abonnement palette : repaint sur changement de teinte de catégorie
  // malgré React.memo (cf. useCatPalette dans shared.jsx).
  useCatPalette();
  const color = catColor(e.family.category, 70);
  const t = e.ts.slice(11, 16);
  const swipe = useSwipeToDelete(() => onDelete && onDelete(e));
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0, background: T.dangerBg,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 18, color: T.dangerBtnInk, fontSize: 12, fontWeight: 500, gap: 8,
        cursor: 'pointer',
      }}
        onClick={() => onDelete && onDelete(e)}>
        <SvgIcon icon={Ic.trash} size={15} />
        <span>Supprimer</span>
      </div>
      <div {...swipe.handlers} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 10px 12px 18px',
        position: 'relative', background: T.surface,
        touchAction: 'pan-y',
      }}>
        <div style={{
          position: 'absolute', left: -2, top: 0, bottom: 0,
          width: 20,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: '50%',
            width: 14, height: 2, background: T.rule,
          }}/>
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: 99, background: color,
          flexShrink: 0, boxShadow: `0 0 0 3px ${T.surface}`,
          zIndex: 1,
        }}/>
        <button type="button" onClick={() => onOpenEntry && onOpenEntry(e)} aria-label={`Modifier ${e.family.name}, ${e.family.quantity} ${e.family.unit}, ${e.family.alcohol}°${e.place ? `, ${e.place}` : ''}`}
          style={{
            ...ghostButton,
            flex: 1, minWidth: 0, cursor: 'pointer',
            display: 'block', textAlign: 'left',
          }}>
          <div style={{
            fontSize: 14, color: T.ink, fontWeight: 500, letterSpacing: -0.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{e.family.name}</div>
          <div style={{
            color: T.muted, fontSize: 11.5, marginTop: 2, letterSpacing: 0.1,
          }}>
            {e.family.quantity} {e.family.unit} · {e.family.alcohol}°
            {e.place && <span> · {e.place}</span>}
          </div>
        </button>
        <div style={{
          fontFamily: fontNum, fontSize: 11, color: T.ink2,
        }}>{t}</div>
        <QuickAddButton
          size={30}
          onAdd={() => onDirectAdd && onDirectAdd(e.family)}
          label={`Ajouter ${e.family.name} à nouveau`}
        />
      </div>
    </div>
  );
});

// Balayage vers la gauche = suppression. Contrôleur 100 % IMPÉRATIF : la
// ligne suit le doigt en écrivant son transform directement dans le style —
// aucun state React, donc aucun re-rendu de la ligne par pointermove (avant :
// un rendu par événement, plus un à CHAQUE pointerdown, même pour un simple
// tap ou un défilement).
//   • suivi 1:1 vers la gauche, résistance élastique vers la droite ;
//   • décision au LÂCHER sur la position OU l'élan (`swipeShouldCommit`) :
//     un petit coup sec supprime, comme dans une liste native ;
//   • un tick haptique quand le doigt franchit le seuil (Android) ;
//   • suppression : la ligne FINIT sa course hors écran puis se replie en
//     hauteur — elle ne revient plus en place avant de disparaître.
// `onClickCapture` avale le clic fantôme qui suit un vrai balayage, pour ne
// jamais ouvrir la fiche d'édition sous le doigt.
// SWIPE / swipeShouldCommit : helpers purs dans shared.jsx (testés).
function useSwipeToDelete(onAction, actionThreshold = 64, tapSlop = 10) {
  const g = React.useRef(null);          // geste en cours
  const swipedRef = React.useRef(false); // vrai balayage (≠ tap) → avale le clic
  const actionRef = React.useRef(onAction);
  actionRef.current = onAction;

  const handlers = React.useMemo(() => {
    const noMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const restore = (el) => {
      el.style.transition = ''; el.style.transform = '';
      const row = el.parentElement;
      if (row) { row.style.transition = ''; row.style.height = ''; row.style.opacity = ''; }
    };
    const snapBack = (el) => {
      if (noMotion()) { restore(el); return; }
      el.style.transition = `transform ${MOTION.base}ms ${MOTION.easeOut}`;
      el.style.transform = 'translate3d(0, 0, 0)';
    };
    const commit = async (el) => {
      const run = async () => {
        try { await (actionRef.current && actionRef.current()); } catch (err) { /* signalé par l'appelant */ }
        // Succès : la ligne est démontée par le re-rendu de la liste. Si elle
        // est toujours là (suppression échouée), on la remet en place.
        setTimeout(() => { if (el.isConnected) restore(el); }, 500);
      };
      if (noMotion()) { run(); return; }
      el.style.transition = `transform ${MOTION.fast}ms ${MOTION.easeIn}`;
      el.style.transform = 'translate3d(-100%, 0, 0)';
      const row = el.parentElement;
      setTimeout(() => {
        if (row && el.isConnected) {
          row.style.height = `${row.getBoundingClientRect().height}px`;
          void row.offsetHeight;   // fige la hauteur de départ avant la transition
          row.style.transition = `height ${MOTION.fast}ms ${MOTION.ease}, opacity ${MOTION.fast}ms ${MOTION.ease}`;
          row.style.height = '0px';
          row.style.opacity = '0';
        }
        setTimeout(run, MOTION.fast);
      }, MOTION.fast);
    };
    const end = (e, cancelled) => {
      const cur = g.current; g.current = null;
      if (!cur || cur.lock !== 'h') return;
      const el = cur.el;
      try { el.releasePointerCapture && el.releasePointerCapture(e.pointerId); } catch {}
      const a = cur.samples[0], b = cur.samples[cur.samples.length - 1];
      const dt = a && b ? b.t - a.t : 0;
      const velocity = dt > 0 ? ((b.x - a.x) / dt) * 1000 : 0;
      if (!cancelled && swipeShouldCommit({ offset: cur.offset, velocity, threshold: actionThreshold })) commit(el);
      else snapBack(el);
    };
    return {
      onPointerDown: (e) => {
        // La capture du pointeur est différée jusqu'au verrou horizontal :
        // un simple tap (« + », édition) ne capture jamais, son clic passe.
        g.current = { x: e.clientX, y: e.clientY, lock: null, offset: 0, armed: false, samples: [], el: e.currentTarget };
        swipedRef.current = false;
      },
      onPointerMove: (e) => {
        const cur = g.current;
        if (!cur) return;
        const dx = e.clientX - cur.x, dy = e.clientY - cur.y;
        if (!cur.lock) {
          if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return;
          cur.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
          if (cur.lock === 'h') {
            try { cur.el.setPointerCapture && cur.el.setPointerCapture(e.pointerId); } catch {}
            cur.el.style.transition = 'none';
            cur.width = cur.el.getBoundingClientRect().width || 1;
          }
        }
        if (cur.lock !== 'h') return;
        if (Math.abs(dx) > tapSlop) swipedRef.current = true;
        // Gauche : 1:1. Droite : rien à révéler → résistance élastique.
        cur.offset = dx <= 0 ? Math.max(dx, -cur.width) : rubberBand(dx, cur.width, 0.25);
        const now = e.timeStamp || Date.now();
        cur.samples.push({ t: now, x: dx });
        while (cur.samples.length > 2 && now - cur.samples[0].t > 100) cur.samples.shift();
        cur.el.style.transform = `translate3d(${cur.offset}px, 0, 0)`;
        const armed = cur.offset <= -actionThreshold;
        if (armed !== cur.armed) { cur.armed = armed; if (armed) haptic(); }
      },
      onPointerUp: (e) => end(e, false),
      onPointerCancel: (e) => end(e, true),
      onClickCapture: (e) => {
        if (swipedRef.current) {
          e.preventDefault();
          e.stopPropagation();
          swipedRef.current = false;
        }
      },
    };
  }, [actionThreshold, tapSlop]);
  return { handlers };
}

Object.assign(window, { HistoryTab, DayGroup, EntryRow, useSwipeToDelete });

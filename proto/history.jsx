// history.jsx — Tab 2: Historique (chronological list grouped by day)

const HIST_COLLAPSED_KEY = 'alconote.hist.collapsed';

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

  // Filtre (catégorie canonique) + recherche tolérante (casse, accents,
  // fautes, multi-mots, lieu — cf. filterHistoryEntries, data.jsx) puis
  // groupement par jour, mémoïsés : chaque `g.entries` garde sa référence
  // tant que données/filtre ne bougent pas → les DayGroup (React.memo)
  // sautent leur rendu.
  const { dayGroups, approx } = React.useMemo(() => {
    const r = filterHistoryEntries(allEntries, { query: deferredQuery, category: filter });
    const g = stabilizeDayGroups(groupEntriesByDay(r.entries), dayCacheRef.current);
    dayCacheRef.current = g.byDay;
    return { dayGroups: g.groups, approx: r.approx };
  }, [allEntries, filter, deferredQuery]);

  // Recherche/filtre changé → on repart des premiers jours, en haut de liste
  // (sinon on garderait une grande fenêtre déjà étendue sur un nouveau
  // résultat, ou une position de défilement au milieu de nulle part).
  React.useEffect(() => {
    setVisibleCount(HIST_INITIAL_DAYS);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [filter, deferredQuery]);

  // Extension au défilement. L'observer est recréé à chaque extension :
  // observe() livre toujours un premier état, donc si la sentinelle est
  // ENCORE dans la marge (écran haut, jours repliés), on enchaîne un paquet
  // de plus sans attendre un nouveau défilement.
  const hasMore = visibleCount < dayGroups.length;
  React.useEffect(() => {
    if (!hasMore) return;
    const root = scrollRef.current, target = sentinelRef.current;
    if (typeof window.IntersectionObserver === 'function' && root && target) {
      const io = new window.IntersectionObserver((items) => {
        // Transition : le rendu du paquet est découpé et interruptible —
        // le défilement en cours ne saccade pas pendant le montage.
        if (items.some(it => it.isIntersecting)) {
          React.startTransition(() => setVisibleCount(c => Math.min(dayGroups.length, c + HIST_PAGE_DAYS)));
        }
      }, { root, rootMargin: `0px 0px ${HIST_PREFETCH_PX}px 0px` });
      io.observe(target);
      return () => io.disconnect();
    }
    // Repli sans IntersectionObserver : extension progressive en idle.
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback : null;
    const grow = () => setVisibleCount(c => Math.min(dayGroups.length, c + HIST_PAGE_DAYS));
    const h = ric ? ric(grow, { timeout: 500 }) : setTimeout(grow, 80);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(h);
      else clearTimeout(h);
    };
  }, [hasMore, visibleCount, dayGroups.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px 18px 10px' }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Rechercher dans l'historique…" />
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
        {approx && dayGroups.length > 0 && (
          <div role="status" style={{
            color: T.muted, fontSize: 12, fontFamily: fontSerif, fontStyle: 'italic',
            padding: '0 2px 6px',
          }}>
            Aucune correspondance exacte — résultats approchants pour « {deferredQuery.trim()} »
          </div>
        )}
        {dayGroups.length === 0 && (
          <div style={{ color: T.muted, fontSize: 13, padding: '60px 0', textAlign: 'center' }}>
            {deferredQuery.trim() ? `Aucun résultat pour « ${deferredQuery.trim()} »` : 'Aucune entrée trouvée'}
          </div>
        )}
        {dayGroups.slice(0, visibleCount).map((g, i) => (
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
        transform: `translateX(${swipe.offset}px)`,
        transition: swipe.dragging ? 'none' : 'transform 0.22s ease',
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

// Tiny pointer-driven swipe controller. Returns translate offset, a
// drag flag (so the consumer can disable transitions during dragging),
// and the handlers to spread on the swipeable element. Calls `onAction`
// when the user releases past `actionThreshold` pixels of drag.
//
// `offsetRef` mirrors the React state so `onPointerUp` always sees the
// latest drag distance, even when several `pointermove` events fire
// faster than React can commit a re-render. Reading `offset` from
// closure was unreliable: the captured value lagged the real position
// and the swipe action almost never triggered.
//
// `onClickCapture` swallows the synthetic click that some browsers
// generate after a meaningful pointer drag, so swiping never
// accidentally opens the edit sheet sitting underneath the row.
function useSwipeToDelete(onAction, actionThreshold = 64, tapSlop = 10) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const offsetRef = React.useRef(0);
  const startRef = React.useRef(null);
  const lockRef = React.useRef(null); // 'h' | 'v' once direction decided
  const swipedRef = React.useRef(false); // true once the finger travels past tapSlop (a real swipe, not a tap)

  const setOff = (v) => { offsetRef.current = v; setOffset(v); };

  const onPointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    lockRef.current = null;
    swipedRef.current = false;
    setDragging(true);
    // Pointer capture is deferred until a horizontal swipe is actually
    // committed (see onPointerMove). Capturing eagerly here would make
    // every tap — including taps on the inner "+"/edit buttons — capture
    // the pointer, which on touch can interfere with the trailing click.
  };
  const onPointerMove = (e) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!lockRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      // Capture only once we've committed to a horizontal swipe so move/up
      // keep coming even if the finger leaves the row. A plain tap never
      // locks horizontal, so it never captures and its click flows through.
      if (lockRef.current === 'h') {
        try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      }
    }
    if (lockRef.current !== 'h') return;
    // Only mark this as a real swipe (and thus swallow the trailing click
    // in onClickCapture) once the finger has travelled past the tap slop.
    // Below it the gesture stays a tap, so the row's "+" / edit button
    // fire reliably despite a few px of finger jitter.
    if (Math.abs(dx) > tapSlop) swipedRef.current = true;
    const next = Math.max(-actionThreshold * 1.6, Math.min(0, dx));
    setOff(next);
  };
  const onPointerUp = (e) => {
    if (lockRef.current === 'h' && offsetRef.current <= -actionThreshold) {
      onAction && onAction();
    }
    setOff(0);
    setDragging(false);
    startRef.current = null;
    lockRef.current = null;
    try {
      if (e && e.currentTarget && e.currentTarget.releasePointerCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };
  // Called in the capture phase BEFORE the click reaches any inner
  // button. Suppresses ghost clicks that follow a real swipe.
  const onClickCapture = (e) => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
    }
  };
  return {
    offset, dragging,
    handlers: {
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}

Object.assign(window, { HistoryTab, DayGroup, EntryRow, useSwipeToDelete });

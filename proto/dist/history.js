/* AUTO-GENERATED from proto/history.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// history.jsx — Tab 2: Historique (chronological list grouped by day)

const HIST_COLLAPSED_KEY = 'alconote.hist.collapsed';
function loadCollapsedDays() {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIST_COLLAPSED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveCollapsedDays(set) {
  try {
    localStorage.setItem(HIST_COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {}
}
function HistoryTab({
  onOpenEntry,
  onDirectAdd
}) {
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [collapsed, setCollapsed] = React.useState(loadCollapsedDays);
  const [editEntry, setEditEntry] = React.useState(null);
  // Rendu incrémental : on peint d'abord les premiers jours (ouverture
  // instantanée même sur un gros historique), puis on étend la liste en idle.
  const [visibleCount, setVisibleCount] = React.useState(8);
  const {
    categories
  } = useCategories();
  // Single shared families memo from the App-level FamiliesContext —
  // avoids re-building (drinks × ratings) per tab on every bump.
  const families = useFamilies();
  const allEntries = React.useMemo(() => flattenEntries(families), [families]);

  // Delete immediately, no modal — surface an "Annuler" toast for 5s
  // so a mistaken swipe is reversible. Mirrors the legacy bar-app UX
  // and avoids a confirmation dialog stalling the swipe gesture.
  const onDeleteEntry = React.useCallback(async entry => {
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
        }
      });
    } catch (err) {
      console.warn('AlcoNote: deleteDrinkWithSnapshot failed', err);
      Toast.show('Erreur lors de la suppression');
    }
  }, []);
  const toggleDay = React.useCallback(day => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);else next.add(day);
      saveCollapsedDays(next);
      return next;
    });
  }, []);

  // Memoize the filter + day-grouping so each `groups[day]` array keeps a
  // stable reference across renders that don't touch the data/filter —
  // which is what lets the React.memo'd DayGroup rows skip re-rendering.
  const {
    groups,
    days
  } = React.useMemo(() => {
    const entries = allEntries.filter(e => {
      // Compare category names canonically (trim + NFC), never raw === — a
      // drink stored as "Bière " or an NFD spelling must still match the
      // "Bière" pill, matching how CategoriesTab folds them.
      if (filter !== 'all' && canonicalCat(e.family.category) !== canonicalCat(filter)) return false;
      if (query) {
        const q = canonicalCat(query).toLowerCase();
        if (!canonicalCat(e.family.name).toLowerCase().includes(q) && !canonicalCat(e.family.category).toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const groups = {};
    for (const e of entries) {
      const day = e.ts.slice(0, 10);
      (groups[day] = groups[day] || []).push(e);
    }
    const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return {
      groups,
      days
    };
  }, [allEntries, filter, query]);

  // Recherche/filtre changé → on repart des premiers jours (sinon on garderait
  // une grande fenêtre déjà étendue sur un nouveau résultat plus court).
  React.useEffect(() => {
    setVisibleCount(8);
  }, [filter, query]);

  // Étend la fenêtre par paquets en idle jusqu'à tout afficher, sans bloquer
  // le thread principal (le 1er paint reste instantané).
  React.useEffect(() => {
    if (visibleCount >= days.length) return;
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback : null;
    const grow = () => setVisibleCount(c => Math.min(days.length, c + 10));
    const h = ric ? ric(grow, {
      timeout: 500
    }) : setTimeout(grow, 80);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(h);else clearTimeout(h);
    };
  }, [visibleCount, days.length]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 18px 10px'
    }
  }, /*#__PURE__*/React.createElement(SearchInput, {
    value: query,
    onChange: setQuery,
    placeholder: "Rechercher dans l'historique\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '2px 18px 14px',
      overflowX: 'auto',
      scrollbarWidth: 'none'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: filter === 'all',
    onClick: () => setFilter('all')
  }, "Tous"), categories.map(c => /*#__PURE__*/React.createElement(Pill, {
    key: c.id,
    active: filter === c.name,
    onClick: () => setFilter(c.name),
    color: catColor(c.name, 70)
  }, c.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 18px 120px'
    }
  }, days.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 13,
      padding: '60px 0',
      textAlign: 'center'
    }
  }, "Aucune entr\xE9e trouv\xE9e"), days.slice(0, visibleCount).map((day, i) => /*#__PURE__*/React.createElement(DayGroup, {
    key: day,
    day: day,
    entries: groups[day],
    isCollapsed: collapsed.has(day),
    onToggle: toggleDay,
    onOpenEntry: setEditEntry,
    onDirectAdd: onDirectAdd,
    onDelete: onDeleteEntry,
    index: i,
    first: i === 0
  }))), editEntry && /*#__PURE__*/React.createElement(EditEntrySheet, {
    key: editEntry.id,
    entry: editEntry,
    onClose: () => setEditEntry(null)
  }));
}
const DayGroup = React.memo(function DayGroup({
  day,
  entries,
  isCollapsed,
  onToggle,
  onOpenEntry,
  onDirectAdd,
  onDelete,
  first,
  index = 0
}) {
  const reduced = useReducedMotion();
  const d = new Date(day + 'T00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  let rel = null;
  if (diff === 0) rel = "Aujourd'hui";else if (diff === 1) rel = 'Hier';else if (diff >= 2 && diff < 7) rel = `il y a ${diff} jours`;

  // Total cL (mirror the real-app summary)
  const totalCl = entries.reduce((s, e) => s + toCl(e.family.quantity, e.family.unit), 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: first ? 4 : 14,
      marginBottom: 4,
      position: 'relative',
      ...staggerStyle(index, {
        reduced
      })
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onToggle(day),
    "aria-expanded": !isCollapsed,
    "aria-label": `${isCollapsed ? 'Déplier' : 'Replier'} ${fmtDayHeader(d)} — ${entries.length} boisson${entries.length > 1 ? 's' : ''}, ${totalCl.toFixed(0)} cL${rel ? `, ${rel}` : ''}`,
    style: {
      width: '100%',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      background: T.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: isCollapsed ? 12 : 0,
      borderBottomRightRadius: isCollapsed ? 12 : 0,
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      borderBottom: isCollapsed ? `1px solid ${T.rule}` : 'none',
      cursor: 'pointer',
      position: 'relative',
      zIndex: 2,
      fontFamily: 'inherit',
      color: 'inherit'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      transition: 'transform 0.2s ease',
      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chev,
    size: 12
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 18,
      color: T.ink,
      letterSpacing: -0.2,
      lineHeight: 1.05,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, fmtDayHeader(d)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted,
      letterSpacing: 0.6,
      marginTop: 3,
      fontFamily: fontNum
    }
  }, entries.length, " boisson", entries.length > 1 ? 's' : '', " \xB7 ", totalCl.toFixed(0), " cL", rel && /*#__PURE__*/React.createElement("span", null, " \xB7 ", rel)))), /*#__PURE__*/React.createElement(Collapse, {
    open: !isCollapsed
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      paddingLeft: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 22,
      top: 0,
      bottom: 14,
      width: 2,
      background: T.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      borderBottom: `1px solid ${T.rule}`,
      marginLeft: -24
    }
  }, entries.map((e, i) => /*#__PURE__*/React.createElement(EntryRow, {
    key: e.id || i,
    entry: e,
    onOpenEntry: onOpenEntry,
    onDirectAdd: onDirectAdd,
    onDelete: onDelete,
    first: i === 0,
    last: i === entries.length - 1
  }))))));
});
const EntryRow = React.memo(function EntryRow({
  entry: e,
  onOpenEntry,
  onDirectAdd,
  onDelete,
  first,
  last
}) {
  const color = catColor(e.family.category, 70);
  const t = e.ts.slice(11, 16);
  const swipe = useSwipeToDelete(() => onDelete && onDelete(e));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: T.dangerBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 18,
      color: T.dangerBtnInk,
      fontSize: 12,
      fontWeight: 500,
      gap: 8,
      cursor: 'pointer'
    },
    onClick: () => onDelete && onDelete(e)
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.trash,
    size: 15
  }), /*#__PURE__*/React.createElement("span", null, "Supprimer")), /*#__PURE__*/React.createElement("div", _extends({}, swipe.handlers, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 10px 12px 18px',
      position: 'relative',
      background: T.surface,
      transform: `translateX(${swipe.offset}px)`,
      transition: swipe.dragging ? 'none' : 'transform 0.22s ease',
      touchAction: 'pan-y'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: -2,
      top: 0,
      bottom: 0,
      width: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      top: '50%',
      width: 14,
      height: 2,
      background: T.rule
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      background: color,
      flexShrink: 0,
      boxShadow: `0 0 0 3px ${T.surface}`,
      zIndex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onOpenEntry && onOpenEntry(e),
    "aria-label": `Modifier ${e.family.name}, ${e.family.quantity} ${e.family.unit}, ${e.family.alcohol}°${e.place ? `, ${e.place}` : ''}`,
    style: {
      ...ghostButton,
      flex: 1,
      minWidth: 0,
      cursor: 'pointer',
      display: 'block',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: T.ink,
      fontWeight: 500,
      letterSpacing: -0.1,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.family.name), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 11.5,
      marginTop: 2,
      letterSpacing: 0.1
    }
  }, e.family.quantity, " ", e.family.unit, " \xB7 ", e.family.alcohol, "\xB0", e.place && /*#__PURE__*/React.createElement("span", null, " \xB7 ", e.place))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontNum,
      fontSize: 11,
      color: T.ink2
    }
  }, t), /*#__PURE__*/React.createElement(QuickAddButton, {
    size: 30,
    onAdd: () => onDirectAdd && onDirectAdd(e.family),
    label: `Ajouter ${e.family.name} à nouveau`
  })));
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

  const setOff = v => {
    offsetRef.current = v;
    setOffset(v);
  };
  const onPointerDown = e => {
    startRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    lockRef.current = null;
    swipedRef.current = false;
    setDragging(true);
    // Pointer capture is deferred until a horizontal swipe is actually
    // committed (see onPointerMove). Capturing eagerly here would make
    // every tap — including taps on the inner "+"/edit buttons — capture
    // the pointer, which on touch can interfere with the trailing click.
  };
  const onPointerMove = e => {
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
        try {
          e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
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
  const onPointerUp = e => {
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
  const onClickCapture = e => {
    if (swipedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipedRef.current = false;
    }
  };
  return {
    offset,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture
    }
  };
}
Object.assign(window, {
  HistoryTab,
  DayGroup,
  EntryRow,
  useSwipeToDelete
});
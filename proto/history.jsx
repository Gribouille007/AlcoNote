// history.jsx — Tab 2: Historique (chronological list grouped by day)

const HIST_COLLAPSED_KEY = 'alconote.hist.collapsed';

function loadCollapsedDays() {
  try { return new Set(JSON.parse(localStorage.getItem(HIST_COLLAPSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveCollapsedDays(set) {
  try { localStorage.setItem(HIST_COLLAPSED_KEY, JSON.stringify([...set])); } catch {}
}

function HistoryTab({ onOpenEntry, onDirectAdd }) {
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [collapsed, setCollapsed] = React.useState(loadCollapsedDays);
  const [editEntry, setEditEntry] = React.useState(null);

  const { categories } = useCategories();
  const { drinks } = useDrinks();
  const ratings = useRatings();
  const families = React.useMemo(() => buildFamilies(drinks, ratings), [drinks, ratings]);
  const allEntries = React.useMemo(() => flattenEntries(families), [families]);

  const onDeleteEntry = React.useCallback(async (entry) => {
    const ok = await Confirm.ask({
      title: 'Supprimer cette entrée ?',
      message: 'Cette consommation sera retirée de votre historique.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try { await deleteDrink(entry.id); Toast.show('Entrée supprimée'); }
    catch { Toast.show('Erreur'); }
  }, []);

  const toggleDay = (day) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      saveCollapsedDays(next);
      return next;
    });
  };

  const entries = allEntries.filter(e => {
    if (filter !== 'all' && e.family.category !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!e.family.name.toLowerCase().includes(q) &&
          !e.family.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const groups = {};
  for (const e of entries) {
    const day = e.ts.slice(0, 10);
    (groups[day] = groups[day] || []).push(e);
  }
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

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

      <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 120px' }}>
        {days.length === 0 && (
          <div style={{ color: T.muted, fontSize: 13, padding: '60px 0', textAlign: 'center' }}>
            Aucune entrée trouvée
          </div>
        )}
        {days.map((day, i) => (
          <DayGroup key={day} day={day} entries={groups[day]}
            isCollapsed={collapsed.has(day)} onToggle={() => toggleDay(day)}
            onOpenEntry={(e) => setEditEntry(e)}
            onDirectAdd={onDirectAdd}
            onDelete={onDeleteEntry}
            first={i === 0} />
        ))}
      </div>

      {editEntry && (
        <EditEntrySheet entry={editEntry} onClose={() => setEditEntry(null)} />
      )}
    </div>
  );
}

function DayGroup({ day, entries, isCollapsed, onToggle, onOpenEntry, onDirectAdd, onDelete, first }) {
  const d = new Date(day + 'T00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  let rel = null;
  if (diff === 0) rel = "Aujourd'hui";
  else if (diff === 1) rel = 'Hier';
  else if (diff < 7) rel = `il y a ${diff} jours`;

  // Total cL (mirror the real-app summary)
  const totalCl = entries.reduce((s, e) => s + toCl(e.family.quantity, e.family.unit), 0);

  return (
    <div style={{ marginTop: first ? 4 : 14, marginBottom: 4, position: 'relative' }}>
      <button type="button" onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? 'Déplier' : 'Replier'} ${fmtDayHeader(d)}`}
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
            {rel && <span style={{ opacity: 0.6 }}> · {rel}</span>}
          </div>
        </div>
      </button>

      {!isCollapsed && (
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
          }}>
            {entries.map((e, i) => (
              <EntryRow key={e.id || i} entry={e} onClick={() => onOpenEntry(e)}
                onDirectAdd={onDirectAdd}
                onDelete={onDelete}
                first={i === 0}
                last={i === entries.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function EntryRow({ entry: e, onClick, onDirectAdd, onDelete, first, last }) {
  const color = catColor(e.family.category, 70);
  const t = e.ts.slice(11, 16);
  const swipe = useSwipeToDelete(() => onDelete && onDelete(e), 96);
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0, background: 'oklch(45% 0.18 25)',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 18, color: '#fff', fontSize: 12, fontWeight: 500, gap: 8,
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
        <button type="button" onClick={onClick} aria-label={`Modifier ${e.family.name}`}
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
        <button type="button"
          onClick={(ev) => { ev.stopPropagation(); onDirectAdd && onDirectAdd(e.family); }}
          style={{
            width: 30, height: 30, borderRadius: 10,
            background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
            display: 'grid', placeItems: 'center', color: T.accent,
            cursor: 'pointer', flexShrink: 0,
            padding: 0, fontFamily: 'inherit',
          }}
          title="Ajouter à nouveau"
          aria-label={`Ajouter ${e.family.name} à nouveau`}
        >
          <SvgIcon icon={Ic.plus} size={14} />
        </button>
      </div>
    </div>
  );
}

// Tiny pointer-driven swipe controller. Returns translate offset, a
// drag flag (so the consumer can disable transitions during dragging),
// and the handlers to spread on the swipeable element. Calls `onAction`
// when the user releases past `actionThreshold` pixels of drag.
function useSwipeToDelete(onAction, actionThreshold = 96) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startRef = React.useRef(null);
  const lockRef = React.useRef(null); // 'h' | 'v' once direction decided

  const onPointerDown = (e) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    lockRef.current = null;
    setDragging(true);
  };
  const onPointerMove = (e) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!lockRef.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (lockRef.current !== 'h') return;
    const next = Math.max(-actionThreshold * 1.6, Math.min(0, dx));
    setOffset(next);
  };
  const onPointerUp = () => {
    if (lockRef.current === 'h' && offset <= -actionThreshold) {
      onAction && onAction();
    }
    setOffset(0);
    setDragging(false);
    startRef.current = null;
    lockRef.current = null;
  };
  return {
    offset, dragging,
    handlers: {
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
    },
  };
}

Object.assign(window, { HistoryTab, DayGroup, EntryRow, useSwipeToDelete });

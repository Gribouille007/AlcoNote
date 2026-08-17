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
  // Rendu incrémental : on peint d'abord les premiers jours (ouverture
  // instantanée même sur un gros historique), puis on étend la liste en idle.
  const [visibleCount, setVisibleCount] = React.useState(8);

  const { categories } = useCategories();
  // Pilules de filtre teintées par catégorie → abonnement palette
  // (repaint sur changement de couleur, cf. useCatPalette dans shared.jsx).
  useCatPalette();
  // Single shared families memo from the App-level FamiliesContext —
  // avoids re-building (drinks × ratings) per tab on every bump.
  const families = useFamilies();
  const allEntries = React.useMemo(() => flattenEntries(families), [families]);

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

  // Memoize the filter + day-grouping so each `groups[day]` array keeps a
  // stable reference across renders that don't touch the data/filter —
  // which is what lets the React.memo'd DayGroup rows skip re-rendering.
  const { groups, days } = React.useMemo(() => {
    const entries = allEntries.filter(e => {
      // Compare category names canonically (trim + NFC), never raw === — a
      // drink stored as "Bière " or an NFD spelling must still match the
      // "Bière" pill, matching how CategoriesTab folds them.
      if (filter !== 'all' && canonicalCat(e.family.category) !== canonicalCat(filter)) return false;
      if (query) {
        const q = canonicalCat(query).toLowerCase();
        if (!canonicalCat(e.family.name).toLowerCase().includes(q) &&
            !canonicalCat(e.family.category).toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const groups = {};
    for (const e of entries) {
      const day = e.ts.slice(0, 10);
      (groups[day] = groups[day] || []).push(e);
    }
    const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    return { groups, days };
  }, [allEntries, filter, query]);

  // Recherche/filtre changé → on repart des premiers jours (sinon on garderait
  // une grande fenêtre déjà étendue sur un nouveau résultat plus court).
  React.useEffect(() => { setVisibleCount(8); }, [filter, query]);

  // Étend la fenêtre par paquets en idle jusqu'à tout afficher, sans bloquer
  // le thread principal (le 1er paint reste instantané).
  React.useEffect(() => {
    if (visibleCount >= days.length) return;
    const ric = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback : null;
    const grow = () => setVisibleCount(c => Math.min(days.length, c + 10));
    const h = ric ? ric(grow, { timeout: 500 }) : setTimeout(grow, 80);
    return () => {
      if (ric && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(h);
      else clearTimeout(h);
    };
  }, [visibleCount, days.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px 18px 10px' }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Rechercher dans l'historique…" />
      </div>

      {/* Rangée de filtres qui déborde : le contenu s'efface aux bords au
          lieu d'être tranché net — on VOIT qu'il y en a plus de chaque côté
          (cf. `.alco-fade-x`, shared.jsx). */}
      <div className="alco-fade-x" style={{
        display: 'flex', gap: 8, padding: '2px 18px 14px',
        overflowX: 'auto', scrollbarWidth: 'none' }}>
        <Pill active={filter === 'all'} onClick={() => setFilter('all')}>Tous</Pill>
        {categories.map(c => (
          <Pill key={c.id} active={filter === c.name} onClick={() => setFilter(c.name)}
                color={catColor(c.name, 70)}>{c.name}</Pill>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 120px' }}>
        {days.length === 0 && (
          <div style={{ color: T.muted, fontSize: remSize(13), letterSpacing: tracking(13), padding: '60px 0', textAlign: 'center' }}>
            Aucune entrée trouvée
          </div>
        )}
        {days.slice(0, visibleCount).map((day, i) => (
          <DayGroup key={day} day={day} entries={groups[day]}
            isCollapsed={collapsed.has(day)} onToggle={toggleDay}
            onOpenEntry={setEditEntry}
            onDirectAdd={onDirectAdd}
            onDelete={onDeleteEntry}
            index={i} first={i === 0} />
        ))}
      </div>

      {editEntry && (
        <EditEntrySheet key={editEntry.id} entry={editEntry} onClose={() => setEditEntry(null)} />
      )}
    </div>
  );
}

const DayGroup = React.memo(function DayGroup({ day, entries, isCollapsed, onToggle, onOpenEntry, onDirectAdd, onDelete, first, index = 0 }) {
  const reduced = useReducedMotion();
  const d = new Date(day + 'T00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  let rel = null;
  if (diff === 0) rel = "Aujourd'hui";
  else if (diff === 1) rel = 'Hier';
  else if (diff >= 2 && diff < 7) rel = `il y a ${diff} jours`;

  // Total cL (mirror the real-app summary)
  const totalCl = entries.reduce((s, e) => s + toCl(e.family.quantity, e.family.unit), 0);

  return (
    <div style={{ marginTop: first ? 4 : 14, marginBottom: 4, position: 'relative',
      ...staggerStyle(index, { reduced }) }}>
      <button type="button" className="alco-press-soft"
        onClick={() => { haptic('tick'); onToggle(day); }}
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
        fontFamily: 'inherit', color: 'inherit' }}>
        <span style={{
          color: T.muted,
          transition: reduced ? undefined : `transform ${MOTION.base}ms ${MOTION.ease}`,
          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          display: 'flex' }}>
          <SvgIcon icon={Ic.chev} size={12} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...TYPE.heading, color: T.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtDayHeader(d)}</div>
          <div style={{
            ...type(10), ...TYPE.num, color: T.muted, marginTop: 3 }}>
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
            marginLeft: -24 }}>
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
  // Abonnement palette : repaint sur changement de teinte de catégorie
  // malgré React.memo (cf. useCatPalette dans shared.jsx).
  useCatPalette();
  const color = catColor(e.family.category, 70);
  const t = e.ts.slice(11, 16);
  const swipe = useSwipeToDelete(() => onDelete && onDelete(e));
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderBottom: last ? 'none' : `1px solid ${T.rule}` }}>
      {/* Couche d'action révélée par le geste : elle apparaît et grandit
          VERS le doigt (opacité + échelle pilotées par `apply`), au lieu
          d'être déjà là, entière, derrière la ligne. */}
      <div ref={swipe.actionRef} style={{
        position: 'absolute', inset: 0, background: T.dangerBg,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 18, color: T.dangerBtnInk, ...type(12, { weight: 500 }), gap: 8,
        cursor: 'pointer', opacity: 0, transformOrigin: 'right center',
      }}
        onClick={() => onDelete && onDelete(e)}>
        <SvgIcon icon={Ic.trash} size={15} />
        <span>Supprimer</span>
      </div>
      <div ref={swipe.rowRef} {...swipe.handlers} style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 10px 12px 18px',
        position: 'relative', background: T.surface,
        willChange: 'transform',
        touchAction: 'pan-y' }}>
        <div style={{
          position: 'absolute', left: -2, top: 0, bottom: 0,
          width: 20 }}>
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
        <button type="button" className="alco-press-soft"
          onClick={() => onOpenEntry && onOpenEntry(e)} aria-label={`Modifier ${e.family.name}, ${e.family.quantity} ${e.family.unit}, ${e.family.alcohol}°${e.place ? `, ${e.place}` : ''}`}
          style={{
            ...ghostButton,
            flex: 1, minWidth: 0, cursor: 'pointer',
            display: 'block', textAlign: 'left' }}>
          <div style={{
            ...TYPE.bodyStrong, color: T.ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.family.name}</div>
          <div style={{
            color: T.muted, ...TYPE.footnote, marginTop: 2 }}>
            {e.family.quantity} {e.family.unit} · {e.family.alcohol}°
            {e.place && <span> · {e.place}</span>}
          </div>
        </button>
        <div style={{
          // `TYPE.num` en DERNIER : la chasse fixe et l'approche neutre des
          // chiffres doivent l'emporter sur l'approche optique du texte.
          ...type(11), ...TYPE.num, color: T.ink2 }}>{t}</div>
        <QuickAddButton
          size={30}
          onAdd={() => onDirectAdd && onDirectAdd(e.family)}
          label={`Ajouter ${e.family.name} à nouveau`}
        />
      </div>
    </div>
  );
});

// Balayage pour supprimer — geste physique complet, bâti sur `useAxisDrag`
// (cf. shared.jsx) et non sur un compteur de pixels :
//   • la ligne colle au doigt, et RÉSISTE élastiquement si on la pousse à
//     droite (il n'y a rien de ce côté-là : elle le dit au lieu de bloquer) ;
//   • franchir le seuil se SENT (petite vibration) — on sait avant de lâcher
//     que ça supprimera ;
//   • la couche rouge se révèle progressivement et grandit VERS le doigt :
//     les frames intermédiaires annoncent le résultat au lieu d'interpoler
//     bêtement ;
//   • à la relâche, c'est le point d'arrivée PROJETÉ depuis la vitesse qui
//     tranche : un petit coup sec suffit, sans traverser tout l'écran ;
//   • la vitesse du doigt est passée au ressort — la ligne continue sur son
//     élan, sans couture entre le geste et l'animation ;
//   • retour au repos en amorti CRITIQUE : un dépassement ferait
//     réapparaître le rouge du mauvais côté.
// Retourne les refs à poser (la ligne, la couche d'action) : le mouvement
// s'écrit dans le DOM, jamais via un état React re-rendu à chaque frame.
const SWIPE_COMMIT_PX = 72;   // engagement de la suppression
const SWIPE_FLING_V = 300;    // px/s : au-delà, le signe de la vitesse décide
const SWIPE_RUBBER_DIM = 90;  // amplitude de résistance du mauvais côté

function useSwipeToDelete(onAction) {
  const rowRef = React.useRef(null);
  const actionRef = React.useRef(null);
  const widthRef = React.useRef(0);
  const armedRef = React.useRef(false);

  const apply = React.useCallback((x) => {
    const row = rowRef.current;
    if (row) row.style.transform = `translate3d(${x}px, 0, 0)`;
    const act = actionRef.current;
    if (act) {
      const p = Math.max(0, Math.min(1, -x / SWIPE_COMMIT_PX));
      act.style.opacity = String(p);
      act.style.transform = `scale(${(0.92 + 0.08 * p).toFixed(3)})`;
    }
  }, []);

  const drag = useAxisDrag({
    axis: 'x', apply,
    config: MOTION.spring.ui,
    onStart: () => {
      armedRef.current = false;
      const row = rowRef.current;
      if (row && row.getBoundingClientRect) {
        const w = row.getBoundingClientRect().width;
        if (w > 0) widthRef.current = w;
      }
    },
    bounds: () => ({ min: null, max: 0, dimension: SWIPE_RUBBER_DIM }),
    onMove: (x) => {
      const past = x <= -SWIPE_COMMIT_PX;
      if (past !== armedRef.current) { armedRef.current = past; haptic('tick'); }
    },
    decide: ({ velocity, projected }) => {
      const commit = Math.abs(velocity) > SWIPE_FLING_V
        ? velocity < 0
        : projected < -SWIPE_COMMIT_PX;
      return {
        to: commit ? -(widthRef.current || 420) : 0,
        commit,
        config: commit ? MOTION.spring.flick : MOTION.spring.ui,
      };
    },
    onCommit: () => { haptic('commit'); onAction && onAction(); },
  });

  return { rowRef, actionRef, dragging: drag.dragging, handlers: drag.handlers };
}

Object.assign(window, { HistoryTab, DayGroup, EntryRow, useSwipeToDelete });

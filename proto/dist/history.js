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
  // Pilules de filtre teintées par catégorie → abonnement palette
  // (repaint sur changement de couleur, cf. useCatPalette dans shared.jsx).
  useCatPalette();
  // La cascade d'entrée ne se joue qu'au premier montage de l'onglet. Sans
  // cette garde elle REJOUE à chaque retour sur l'Historique (display:none →
  // flex redémarre les animations CSS) : des dizaines de groupes qui
  // re-cascadent, c'est la saccade la plus visible de l'app.
  const entering = useEnterOnce();
  // Single shared families memo from the App-level FamiliesContext —
  // avoids re-building (drinks × ratings) per tab on every bump.
  const families = useFamilies();
  const allEntries = React.useMemo(() => flattenEntries(families), [families]);

  // Un filtre pointant une catégorie renommée/supprimée devient orphelin :
  // plus aucune pilule active et « Aucune entrée trouvée » sans explication.
  // On retombe sur « Tous » dès que la catégorie filtrée n'existe plus
  // (guard sur la liste chargée pour ne pas reset pendant le boot).
  React.useEffect(() => {
    if (filter !== 'all' && categories.length > 0 && !categories.some(c => canonicalCat(c.name) === canonicalCat(filter))) {
      setFilter('all');
    }
  }, [filter, categories]);

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
    className: "alco-fade-x",
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
      fontSize: remSize(13),
      letterSpacing: tracking(13),
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
    first: i === 0,
    stagger: entering
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
  index = 0,
  stagger = false
}) {
  // Abonnement thème : `T` est un objet MUTÉ sur place, donc invisible pour
  // React — un composant memoïsé dont les props n'ont pas bougé garderait les
  // couleurs de l'ancien thème (bug « la liste reste sombre en clair »).
  useTheme();
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
        reduced: reduced || !stagger
      })
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "alco-press-soft",
    onClick: () => {
      haptic('tick');
      onToggle(day);
    },
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
      transition: reduced ? undefined : `transform ${MOTION.base}ms ${MOTION.ease}`,
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
      ...TYPE.heading,
      color: T.ink,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, fmtDayHeader(d)), /*#__PURE__*/React.createElement("div", {
    style: {
      ...type(10),
      ...TYPE.num,
      color: T.muted,
      marginTop: 3
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
  // Abonnement palette : repaint sur changement de teinte de catégorie
  // malgré React.memo (cf. useCatPalette dans shared.jsx). Et abonnement
  // thème pour la même raison : `T` est muté sur place, un memo l'ignore.
  useCatPalette();
  useTheme();
  const color = catColor(e.family.category, 70);
  const t = e.ts.slice(11, 16);
  const swipe = useSwipeToDelete(() => onDelete && onDelete(e));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      overflow: 'hidden',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    ref: swipe.actionRef,
    onClick: () => onDelete && onDelete(e),
    tabIndex: swipe.open ? 0 : -1
    // Fermé, le plateau est invisible ET recouvert : l'annoncer ferait un
    // « Supprimer … » fantôme par ligne dans un lecteur d'écran.
    ,
    "aria-hidden": swipe.open ? undefined : 'true',
    "aria-label": `Supprimer ${e.family.name}`,
    style: {
      position: 'absolute',
      inset: 0,
      background: T.dangerBtn,
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'flex-end',
      border: 'none',
      padding: 0,
      margin: 0,
      fontFamily: 'inherit',
      color: T.dangerBtnInk,
      cursor: 'pointer',
      opacity: 0,
      // Fermé, le plateau est intégralement recouvert par la ligne : on le
      // met hors d'atteinte du pointeur pour qu'aucun tap ne puisse le
      // trouver « à travers » un arrondi ou un pixel de débord.
      pointerEvents: swipe.open ? 'auto' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: SWIPE_ACTION_W,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.trash,
    size: 17
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      ...type(10.5, {
        weight: 500
      })
    }
  }, "Supprimer"))), /*#__PURE__*/React.createElement("div", _extends({
    ref: swipe.rowRef
  }, swipe.handlers, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 10px 12px 18px',
      position: 'relative',
      background: T.surface,
      touchAction: 'pan-y'
    }
  }), swipe.open && /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 3,
      cursor: 'pointer'
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
    className: "alco-press-soft",
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
      ...TYPE.bodyStrong,
      color: T.ink,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, e.family.name), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      ...TYPE.footnote,
      marginTop: 2
    }
  }, e.family.quantity, " ", e.family.unit, " \xB7 ", e.family.alcohol, "\xB0", e.place && /*#__PURE__*/React.createElement("span", null, " \xB7 ", e.place))), /*#__PURE__*/React.createElement("div", {
    style: {
      // `TYPE.num` en DERNIER : la chasse fixe et l'approche neutre des
      // chiffres doivent l'emporter sur l'approche optique du texte.
      ...type(11),
      ...TYPE.num,
      color: T.ink2
    }
  }, t), /*#__PURE__*/React.createElement(QuickAddButton, {
    size: 30,
    onAdd: () => onDirectAdd && onDirectAdd(e.family),
    label: `Ajouter ${e.family.name} à nouveau`
  })));
});

// Balayage pour supprimer — geste physique complet, bâti sur `useAxisDrag`
// (cf. shared.jsx) et non sur un compteur de pixels.
//
// Le geste a TROIS positions de repos, et c'est ce qui le rend facile :
//   • fermé (0) ;
//   • OUVERT (-SWIPE_ACTION_W) — la ligne s'accroche là et découvre un vrai
//     bouton « Supprimer » que l'on tape tranquillement. C'est le cran qui
//     manquait : sans lui le geste était tout-ou-rien, il fallait franchir un
//     seuil du premier coup, sinon la ligne se rétractait et tout était à
//     refaire (« difficile ») ;
//   • supprimé (hors écran) — pour qui balaye franchement, ou relance la
//     ligne d'un coup sec depuis le cran ouvert : l'action part sans repasser
//     par la case bouton.
//
// Qui tranche entre les trois :
//   • la DISTANCE réellement parcourue décide de la suppression — au-delà de
//     la moitié de la ligne, l'intention ne fait plus de doute. La projection
//     d'élan ne peut donc pas supprimer toute seule sur un petit geste vif ;
//   • entre « fermé » et « ouvert », c'est le point d'arrivée PROJETÉ depuis
//     la vitesse qui choisit le cran le plus proche : un flick court suffit à
//     ouvrir, sans traverser l'écran.
//
// Le reste du contrat vient de `useAxisDrag` : suivi 1:1, résistance
// élastique du côté où il n'y a rien, reprise en vol, avalement du clic
// fantôme, vitesse du doigt passée au ressort (aucune couture entre le geste
// et l'animation).
//
// Retourne les refs à poser (la ligne, le plateau d'action) : le mouvement
// s'écrit dans le DOM, jamais via un état React re-rendu à chaque frame.
const SWIPE_ACTION_W = 88; // largeur du plateau d'action (= cran ouvert)
const SWIPE_COMMIT_RATIO = 0.5; // fraction de la ligne au-delà de laquelle c'est supprimé
const SWIPE_COMMIT_MIN = 150; // …avec un plancher, pour les lignes étroites
const SWIPE_FLING_V = 320; // px/s : au-delà, c'est un lancer, pas un glissement
const SWIPE_RUBBER_DIM = 90; // amplitude de résistance du mauvais côté

// Point de non-retour, en fonction de la largeur RÉELLE de la ligne : le même
// geste doit vouloir dire la même chose sur un petit téléphone et sur la
// maquette large du desktop.
function swipeCommitThreshold(width) {
  const w = Number.isFinite(width) && width > 0 ? width : 420;
  return -Math.max(SWIPE_COMMIT_MIN, w * SWIPE_COMMIT_RATIO);
}

// Verdict du balayage — fonction PURE (donc testable) : depuis l'état du
// relâchement, elle dit sur lequel des trois crans la ligne se pose. Aucune
// décision de geste ne vit dans le JSX ni dans un handler (cf. CLAUDE.md :
// les calculs sont des helpers purs exportés).
function swipeVerdict({
  from,
  velocity,
  projected,
  width,
  fromOpen = false
}) {
  const w = Number.isFinite(width) && width > 0 ? width : 420;
  const x = Number.isFinite(from) ? from : 0;
  const v = Number.isFinite(velocity) ? velocity : 0;
  const p = Number.isFinite(projected) ? projected : x;
  // Suppression, cas général : le doigt est allé au-delà du point de
  // non-retour. C'est la DISTANCE parcourue qui commande — jamais la seule
  // projection d'élan, sinon un geste court mais vif supprimerait par surprise
  // et le cran ouvert deviendrait inatteignable.
  if (x <= swipeCommitThreshold(w)) return {
    to: -w,
    commit: true,
    open: false
  };
  // Raccourci : la ligne était DÉJÀ ouverte au repos et on la relance d'un
  // coup sec. L'intention ne fait pas de doute, inutile de traverser l'écran.
  // Réservé à ce cas précis : au milieu d'un premier balayage, la vitesse ne
  // doit rien pouvoir supprimer.
  if (fromOpen && v < -SWIPE_FLING_V && x <= -SWIPE_ACTION_W) {
    return {
      to: -w,
      commit: true,
      open: false
    };
  }
  // Sinon, le cran le plus proche du point d'arrivée PROJETÉ : un flick court
  // suffit à ouvrir. Un lancer vers la droite referme, quelle que soit la
  // projection.
  const to = nearestSnapPoint(v > SWIPE_FLING_V ? 0 : p, [0, -SWIPE_ACTION_W]);
  return {
    to,
    commit: false,
    open: to === -SWIPE_ACTION_W
  };
}

// Une seule ligne ouverte à la fois dans toute la liste. Deux plateaux rouges
// ouverts en même temps, ce sont deux suppressions à un tap et plus aucune
// idée de laquelle est armée : saisir une ligne referme l'autre. Registre au
// niveau MODULE (et non un contexte React) : la fermeture part d'un handler
// de geste, à chaud, sans re-render intermédiaire.
let openSwipeRow = null;
function closeOpenSwipeRow(except) {
  if (!openSwipeRow || openSwipeRow === except) return;
  const closer = openSwipeRow.close;
  openSwipeRow = null;
  if (closer) closer();
}
function useSwipeToDelete(onAction) {
  const rowRef = React.useRef(null);
  const actionRef = React.useRef(null);
  const widthRef = React.useRef(0);
  const armedRef = React.useRef(false);
  // Position de repos courante, lue à chaud par les handlers. Le state React
  // qui la double ne sert qu'à l'accessibilité du bouton (cf. plus bas) : il
  // ne change qu'aux crans, jamais pendant le mouvement.
  const openRef = React.useRef(false);
  // État de repos AU DÉBUT du geste : c'est lui qui autorise le raccourci
  // « relance sèche depuis le cran ouvert » (cf. swipeVerdict).
  const wasOpenRef = React.useRef(false);
  // Un vrai glissement vient-il d'avoir lieu ? Le clic FANTÔME qui suit un
  // glissement ne doit pas refermer la ligne que ce glissement vient d'ouvrir.
  const draggedRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const selfRef = React.useRef({
    close: null
  });
  // La couche composée n'existe que le temps du geste : armée quand l'axe est
  // engagé (onMove), rendue au repos du ressort (onRest). Une liste de plusieurs
  // centaines de lignes ne peut pas garder autant de calques en mémoire.
  const hint = useLayerHint(rowRef);
  const apply = React.useCallback(x => {
    const row = rowRef.current;
    if (row) row.style.transform = `translate3d(${x}px, 0, 0)`;
    const act = actionRef.current;
    if (act) {
      // Le plateau est full-bleed : il s'élargit tout seul à mesure que la
      // ligne le découvre, sans rien à animer. Seul son CONTENU (icône + mot)
      // se révèle — il reste collé au bord droit, comme sur iOS, et
      // n'apparaît qu'une fois qu'il a la place d'être lu.
      const p = Math.max(0, Math.min(1, -x / SWIPE_ACTION_W));
      act.style.opacity = String(p);
    }
  }, []);
  const drag = useAxisDrag({
    axis: 'x',
    apply,
    config: MOTION.spring.ui,
    onStart: () => {
      armedRef.current = false;
      draggedRef.current = false;
      wasOpenRef.current = openRef.current;
      closeOpenSwipeRow(selfRef.current);
      const row = rowRef.current;
      if (row && row.getBoundingClientRect) {
        const w = row.getBoundingClientRect().width;
        if (w > 0) widthRef.current = w;
      }
    },
    // Vers la gauche rien ne borne (on peut aller jusqu'à la suppression) ;
    // vers la droite il n'y a RIEN — la ligne le dit en résistant plutôt
    // qu'en bloquant net.
    bounds: () => ({
      min: null,
      max: 0,
      dimension: SWIPE_RUBBER_DIM
    }),
    onMove: x => {
      // `onMove` n'est appelé qu'une fois l'axe engagé : un simple tap (ou un
      // défilement vertical) ne promeut donc jamais la ligne.
      hint(true);
      draggedRef.current = true;
      // Franchir le point de non-retour se SENT : on sait avant de lâcher que
      // ça supprimera au lieu de s'arrêter au cran ouvert.
      const past = x <= swipeCommitThreshold(widthRef.current);
      if (past !== armedRef.current) {
        armedRef.current = past;
        haptic('tick');
      }
    },
    onRest: () => hint(false),
    decide: ({
      from,
      velocity,
      projected
    }) => {
      const v = swipeVerdict({
        from,
        velocity,
        projected,
        width: widthRef.current,
        fromOpen: wasOpenRef.current
      });
      setOpenState(v.open);
      return {
        to: v.to,
        commit: v.commit,
        config: v.commit ? MOTION.spring.flick : MOTION.spring.ui
      };
    },
    onCommit: () => {
      haptic('commit');
      onAction && onAction();
    }
  });

  // Le SEUL setState du geste : il se produit au verdict, pas une frame
  // d'animation ne re-rend l'arbre.
  function setOpenState(next) {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpen(next);
    if (next) {
      openSwipeRow = selfRef.current;
      haptic('select');
    } else if (openSwipeRow === selfRef.current) openSwipeRow = null;
  }
  const close = React.useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    if (openSwipeRow === selfRef.current) openSwipeRow = null;
    // Le ressort repart de la valeur AFFICHÉE : refermer pendant que la ligne
    // bouge encore ne provoque aucun saut (et `apply` remet le plateau au clair).
    drag.spring.set(0, {
      config: MOTION.spring.ui
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  selfRef.current.close = close;

  // Démontage (suppression, filtre, changement de jour) : la ligne ne doit pas
  // rester inscrite comme « celle qui est ouverte », sinon la suivante attend
  // une fermeture qui ne viendra jamais.
  React.useEffect(() => {
    const self = selfRef.current;
    return () => {
      if (openSwipeRow === self) openSwipeRow = null;
    };
  }, []);
  const handlers = {
    ...drag.handlers,
    // Ouverte, la ligne n'est plus une ligne : le premier tap la referme, il
    // n'ouvre pas la fiche derrière. En phase de CAPTURE, avant tout bouton
    // interne — et sauf sur le plateau lui-même, dont c'est le rôle d'agir.
    onClickCapture: e => {
      // Le garde anti-clic fantôme de `useAxisDrag` passe D'ABORD : le clic
      // qui n'est que la queue d'un glissement ne doit rien déclencher — et
      // surtout pas refermer la ligne que ce glissement vient d'ouvrir.
      if (drag.handlers.onClickCapture) drag.handlers.onClickCapture(e);
      if (draggedRef.current) {
        draggedRef.current = false;
        return;
      }
      if (openRef.current && !(actionRef.current && actionRef.current.contains(e.target))) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }
  };
  return {
    rowRef,
    actionRef,
    dragging: drag.dragging,
    open,
    close,
    handlers
  };
}
Object.assign(window, {
  HistoryTab,
  DayGroup,
  EntryRow,
  useSwipeToDelete,
  closeOpenSwipeRow,
  swipeVerdict,
  swipeCommitThreshold,
  SWIPE_ACTION_W,
  SWIPE_COMMIT_RATIO,
  SWIPE_COMMIT_MIN,
  SWIPE_FLING_V
});
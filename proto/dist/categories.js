/* AUTO-GENERATED from proto/categories.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// categories.jsx — Tab 1: Catégories (grid + drill-down to family detail)

function CategoriesTab({
  onOpenFamily,
  onDirectAdd,
  onEditFamily,
  query,
  setQuery,
  openCat,
  setOpenCat
}) {
  const [editCat, setEditCat] = React.useState(null);
  const [creatingCat, setCreatingCat] = React.useState(false);
  const {
    categories
  } = useCategories();
  // Families are built once at App root and broadcast via FamiliesContext
  // — no per-tab rebuild on every dataBus bump.
  const families = useFamilies();
  // Icon overrides re-render <CategoryGlyph> via CategoryIconsContext
  // (provided at App root) — no need for this tab to subscribe.

  // If the open category was just deleted, drop back to the grid so the
  // user isn't stranded inside an empty FamilyList for a missing cat.
  // IMPORTANT : la vérification ne court QUE quand une NOUVELLE liste de
  // catégories arrive (deps [categories] ; openCat/editCat lus via ref),
  // jamais quand openCat/editCat changent. Sinon, re-pointer le drill-down
  // vers le nouveau nom pendant un rename (cf. onCatRenamed) éjecterait
  // aussitôt : le nouveau nom n'est pas encore dans la liste pas encore
  // rafraîchie.
  const openCatRef = React.useRef(openCat);
  openCatRef.current = openCat;
  const editCatRef = React.useRef(editCat);
  editCatRef.current = editCat;
  React.useEffect(() => {
    const o = openCatRef.current;
    if (o && categories.length > 0 && !categories.some(c => canonicalCat(c.name) === canonicalCat(o))) {
      setOpenCat(null);
    }
  }, [categories, setOpenCat]);

  // A rename is NOT a delete: re-point the drill-down (and the edit sheet)
  // at the new name so the user stays inside the renamed category instead
  // of being kicked back to the grid by the watcher effects above/below.
  // Called synchronously by EditCategorySheet right after renameCategory
  // succeeds — before the refreshed categories list lands.
  const onCatRenamed = React.useCallback((oldName, newName) => {
    setOpenCat(o => o && canonicalCat(o) === canonicalCat(oldName) ? newName : o);
    setEditCat(e => e && canonicalCat(e) === canonicalCat(oldName) ? newName : e);
  }, [setOpenCat]);

  // Same idea for the edit sheet — close it if the underlying category
  // vanished (deleted from elsewhere) so it doesn't operate on stale data.
  React.useEffect(() => {
    const e = editCatRef.current;
    if (e && categories.length > 0 && !categories.some(c => canonicalCat(c.name) === canonicalCat(e))) {
      setEditCat(null);
    }
  }, [categories]);
  const cats = React.useMemo(() => computeCategoryStats(categories, families), [categories, families]);
  const filtered = React.useMemo(() => {
    if (!openCat) return [];
    const q = (query || '').toLowerCase();
    const openKey = canonicalCat(openCat);
    return families.filter(f => canonicalCat(f.category) === openKey && (!q || f.name.toLowerCase().includes(q)));
  }, [openCat, families, query]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 18px 14px'
    }
  }, /*#__PURE__*/React.createElement(SearchInput, {
    value: query || '',
    onChange: setQuery,
    placeholder: openCat ? `Rechercher dans ${openCat}…` : 'Rechercher boisson ou catégorie…'
  })), !openCat ? /*#__PURE__*/React.createElement(CategoryGrid, {
    cats: cats,
    families: families,
    query: query,
    onOpen: setOpenCat,
    onOpenFamily: onOpenFamily,
    onEditCat: setEditCat,
    onDirectAdd: onDirectAdd,
    onAddCategory: () => setCreatingCat(true)
  }) : /*#__PURE__*/React.createElement(FamilyList, {
    category: openCat,
    families: filtered,
    onBack: () => setOpenCat(null),
    onOpen: onOpenFamily,
    onDirectAdd: onDirectAdd,
    onEditCat: () => setEditCat(openCat),
    onEditFamily: onEditFamily
  }), editCat && /*#__PURE__*/React.createElement(EditCategorySheet, {
    category: editCat,
    onClose: () => setEditCat(null),
    onRenamed: onCatRenamed
  }), creatingCat && /*#__PURE__*/React.createElement(EditCategorySheet, {
    mode: "create",
    onClose: () => setCreatingCat(false)
  }));
}
function CategoryGrid({
  cats,
  families,
  query,
  onOpen,
  onOpenFamily,
  onEditCat,
  onDirectAdd,
  onAddCategory
}) {
  const q = (query || '').toLowerCase();
  const matchedFams = React.useMemo(() => {
    if (!q) return [];
    return families.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  }, [families, q]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 18px 120px'
    }
  }, !q && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, null, "Vos cat\xE9gories"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginTop: 10
    }
  }, cats.map((c, i) => /*#__PURE__*/React.createElement(CategoryCard, {
    key: c.id || c.name,
    cat: c,
    index: i,
    onOpen: onOpen,
    onEdit: onEditCat
  }))), cats.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 13,
      padding: '40px 0 16px',
      textAlign: 'center'
    }
  }, "Aucune cat\xE9gorie pour le moment."), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAddCategory,
    "aria-label": "Cr\xE9er une nouvelle cat\xE9gorie",
    style: {
      width: '100%',
      marginTop: 12,
      padding: '12px',
      borderRadius: 14,
      background: T.surface,
      border: `1px dashed ${T.rule}`,
      color: T.ink2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 13,
      letterSpacing: -0.1
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.plus,
    size: 15
  }), " Nouvelle cat\xE9gorie")), q && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, null, matchedFams.length, " r\xE9sultat", matchedFams.length > 1 ? 's' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, matchedFams.map((f, i) => /*#__PURE__*/React.createElement(FamilyRow, {
    key: f.id,
    family: f,
    index: i,
    onOpen: onOpenFamily,
    onDirectAdd: onDirectAdd
  })), matchedFams.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 13,
      padding: '40px 0',
      textAlign: 'center'
    }
  }, "Aucun r\xE9sultat pour \xAB ", query, " \xBB"))));
}
const CategoryCard = React.memo(function CategoryCard({
  cat,
  onOpen,
  onEdit,
  index = 0
}) {
  const color = catColor(cat.name, 70);
  const bg = catBg(cat.name);
  const reduced = useReducedMotion();
  const press = usePressScale();
  return /*#__PURE__*/React.createElement("div", _extends({}, clickable(() => onOpen && onOpen(cat.name), `Ouvrir la catégorie ${cat.name} — ${cat.entries} entrée${cat.entries !== 1 ? 's' : ''}, ${cat.families} type${cat.families !== 1 ? 's' : ''}`), press.handlers, {
    style: {
      background: T.surface,
      borderRadius: 18,
      padding: 14,
      border: `1px solid ${T.rule}`,
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
      aspectRatio: '1 / 1.05',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      ...press.style,
      ...staggerStyle(index, {
        reduced
      })
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: e => {
      e.stopPropagation();
      onEdit && onEdit(cat.name);
    },
    "aria-label": `Modifier ${cat.name}`,
    style: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 26,
      height: 26,
      borderRadius: 8,
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      display: 'grid',
      placeItems: 'center',
      color: T.muted,
      cursor: 'pointer',
      zIndex: 2,
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.edit,
    size: 11
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 14,
      background: bg,
      display: 'grid',
      placeItems: 'center',
      color,
      boxShadow: `inset 0 0 20px ${bg}`
    }
  }, /*#__PURE__*/React.createElement(CategoryGlyph, {
    name: cat.name
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSans,
      fontWeight: 500,
      fontSize: 15,
      color: T.ink,
      letterSpacing: -0.2,
      marginBottom: 3,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, cat.name), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 11,
      letterSpacing: 0.1,
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color
    }
  }, "\u25CF"), cat.entries, " entr\xE9e", cat.entries !== 1 ? 's' : '', /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\xB7"), cat.families, " type", cat.families !== 1 ? 's' : '')));
});
function FamilyList({
  category,
  families,
  onBack,
  onOpen,
  onDirectAdd,
  onEditCat,
  onEditFamily
}) {
  // Sort families: identical-name groups stay contiguous, ordered by
  // total entries inside the group, then by quantity asc inside each
  // group. We keep one line per (name, qty, unit, abv) variant so the
  // user can add each individually. Variants share a `groupKey` so
  // FamilyRow can render the stacked-card visual cue. Memoized so a
  // search keystroke or unrelated dataBus bump doesn't recompute the
  // whole grouping when the filtered `families` array reference is
  // unchanged.
  const {
    rows,
    sortedLen,
    entriesTotal
  } = React.useMemo(() => {
    const groupEntries = new Map(); // name → total entries (for sort)
    const variantCounts = new Map(); // name → number of variant rows
    for (const f of families) {
      const k = (f.name || '').trim().toLowerCase();
      groupEntries.set(k, (groupEntries.get(k) || 0) + f.entries.length);
      variantCounts.set(k, (variantCounts.get(k) || 0) + 1);
    }
    const sorted = [...families].sort((a, b) => {
      const ka = (a.name || '').trim().toLowerCase();
      const kb = (b.name || '').trim().toLowerCase();
      const ga = groupEntries.get(ka) || 0;
      const gb = groupEntries.get(kb) || 0;
      if (gb !== ga) return gb - ga;
      if (ka !== kb) return ka.localeCompare(kb);
      if ((a.alcohol || 0) !== (b.alcohol || 0)) return (a.alcohol || 0) - (b.alcohol || 0);
      return (a.quantity || 0) - (b.quantity || 0);
    });
    const out = [];
    let prevKey = null,
      idx = 0;
    for (const f of sorted) {
      const key = (f.name || '').trim().toLowerCase();
      if (key !== prevKey) idx = 0;
      out.push({
        f,
        key,
        idx: idx++,
        total: variantCounts.get(key) || 1
      });
      prevKey = key;
    }
    let entries = 0;
    for (const f of families) entries += f.entries.length;
    return {
      rows: out,
      sortedLen: sorted.length,
      entriesTotal: entries
    };
  }, [families]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 18px 120px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    "aria-label": "Retour aux cat\xE9gories",
    style: {
      ...ghostButton,
      color: T.ink2,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chevL,
    size: 16
  }), /*#__PURE__*/React.createElement("span", null, "Cat\xE9gories")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onEditCat,
    "aria-label": `Modifier la catégorie ${category}`,
    style: {
      ...ghostButton,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      padding: '6px 10px',
      borderRadius: 10,
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      color: T.ink2,
      fontSize: 11
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.edit,
    size: 11
  }), /*#__PURE__*/React.createElement("span", null, "Modifier"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 36,
      color: T.ink,
      letterSpacing: -0.8,
      lineHeight: 1,
      marginBottom: 4
    }
  }, category), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      marginBottom: 18,
      letterSpacing: 0.1
    }
  }, sortedLen, " variante", sortedLen !== 1 ? 's' : '', " \xB7", ' ', entriesTotal, " entr\xE9es au total"), rows.map(({
    f,
    idx,
    total
  }, i) => /*#__PURE__*/React.createElement(FamilyRow, {
    key: f.id,
    family: f,
    index: i,
    variantIndex: idx,
    variantCount: total,
    onOpen: onOpen,
    onDirectAdd: onDirectAdd
  })), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 13,
      padding: '40px 0',
      textAlign: 'center'
    }
  }, "Aucun r\xE9sultat"));
}
const FamilyRow = React.memo(function FamilyRow({
  family: f,
  variantIndex = 0,
  variantCount = 1,
  onOpen,
  onDirectAdd,
  index = 0
}) {
  const color = catColor(f.category, 70);
  const totalEntries = f.entries.length;
  const isFirstOfGroup = variantIndex === 0;
  const isLastOfGroup = variantIndex === variantCount - 1;
  const topMargin = isFirstOfGroup ? 8 : 0;
  const reduced = useReducedMotion();
  const press = usePressScale();
  return /*#__PURE__*/React.createElement("div", _extends({}, clickable(() => onOpen && onOpen(f), `Voir les détails de ${f.name}`), press.handlers, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 14px',
      background: T.surface,
      borderRadius: variantCount > 1 ? `${isFirstOfGroup ? 14 : 0}px ${isFirstOfGroup ? 14 : 0}px ${isLastOfGroup ? 14 : 0}px ${isLastOfGroup ? 14 : 0}px` : 14,
      border: `1px solid ${T.rule}`,
      borderTop: !isFirstOfGroup ? `1px dashed ${T.rule}` : `1px solid ${T.rule}`,
      borderBottom: !isLastOfGroup ? 'none' : `1px solid ${T.rule}`,
      marginTop: topMargin,
      marginBottom: isLastOfGroup ? 8 : 0,
      cursor: 'pointer',
      position: 'relative',
      ...press.style,
      ...staggerStyle(index, {
        reduced
      })
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 12,
      background: catBg(f.category),
      display: 'grid',
      placeItems: 'center',
      color,
      flexShrink: 0,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement(CategoryGlyph, {
    name: f.category
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      color: T.ink,
      fontWeight: 500,
      letterSpacing: -0.2,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, f.name, variantCount > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 8,
      fontSize: 10,
      color: T.muted,
      fontFamily: fontNum,
      letterSpacing: 0.4,
      fontWeight: 400
    }
  }, variantIndex + 1, "/", variantCount)), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 11.5,
      marginTop: 3,
      letterSpacing: 0.1,
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", null, f.quantity, " ", f.unit), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, f.alcohol, "\xB0"))), /*#__PURE__*/React.createElement("div", {
    title: `${totalEntries} entrée${totalEntries > 1 ? 's' : ''}`,
    style: {
      fontFamily: fontNum,
      fontSize: 14,
      fontWeight: 600,
      color: T.ink2,
      letterSpacing: 0.2,
      lineHeight: 1,
      fontVariantNumeric: 'tabular-nums',
      marginRight: 6,
      flexShrink: 0
    }
  }, "\xD7", totalEntries), /*#__PURE__*/React.createElement(QuickAddButton, {
    onAdd: () => onDirectAdd && onDirectAdd(f),
    label: `Ajouter ${f.name} (${f.quantity} ${f.unit}, ${f.alcohol}°) à nouveau`
  }));
});
function EditCategorySheet({
  category,
  onClose,
  mode = 'edit',
  onRenamed
}) {
  const isCreate = mode === 'create';
  const {
    categories
  } = useCategories();
  // Read overrides from the App-level CategoryIconsContext rather than
  // re-subscribing locally — keeps the sheet in sync with whatever the
  // grid is painting without a second DB round-trip on every bump.
  const icons = React.useContext(CategoryIconsContext);
  const colors = React.useContext(CategoryColorsContext);
  const [name, setName] = React.useState(isCreate ? '' : category);
  // `glyph` holds the user's *explicit* choice in this sheet. `null`
  // means "no explicit pick yet" (use whatever's currently persisted)
  // and a string means the user actively selected that tile — including
  // the `'__reset__'` sentinel which means "drop the override".
  const [glyph, setGlyphState] = React.useState(() => isCreate ? null : icons[canonicalCat(category)] || null);
  const userTouchedRef = React.useRef(false);
  const setGlyph = g => {
    userTouchedRef.current = true;
    setGlyphState(g);
  };
  // `hue` : choix explicite de teinte (0-359) dans ce sheet ; `null` = pas de
  // choix → couleur persistée / défaut (« Auto »). Même schéma touched que
  // l'icône : une saisie utilisateur n'est jamais écrasée par un refresh.
  const [hue, setHueState] = React.useState(() => {
    if (isCreate) return null;
    const h = colors[canonicalCat(category)];
    return h == null ? null : h;
  });
  const userTouchedColorRef = React.useRef(false);
  const setHue = h => {
    userTouchedColorRef.current = true;
    setHueState(h);
  };
  const trackRef = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Re-entry guards — protect against double-tap on Save/Supprimer
  // before React has flipped `busy` and disabled the buttons.
  const savingRef = React.useRef(false);
  const removingRef = React.useRef(false);
  // Fermeture animée (sortie de sheet).
  const [closing, close] = useSheetClose(onClose);

  // What the picker should highlight. After "Réinitialiser" we fall
  // back to the same logic <CategoryGlyph> uses when there's no
  // override, so the highlighted tile matches the card.
  const displayedGlyph = glyph && glyph !== '__reset__' ? glyph : GLYPH_OPTIONS.includes(category) ? category : 'Autre';

  // Keep the form in sync if the sheet is reused for a different
  // category (rare in current routing, but cheap to guard against).
  // Skipped in create mode — there is no source category to mirror.
  React.useEffect(() => {
    if (!isCreate) setName(category);
  }, [category, isCreate]);

  // Adopt the persisted override once it loads (or is updated elsewhere)
  // — but never overwrite a pick the user has already made in this sheet.
  React.useEffect(() => {
    if (isCreate) return;
    if (!userTouchedRef.current) setGlyphState(icons[canonicalCat(category)] || null);
  }, [icons, category, isCreate]);

  // Adopte la couleur persistée au chargement / si modifiée ailleurs — sans
  // jamais écraser un choix déjà fait dans ce sheet.
  React.useEffect(() => {
    if (isCreate) return;
    if (!userTouchedColorRef.current) {
      const h = colors[canonicalCat(category)];
      setHueState(h == null ? null : h);
    }
  }, [colors, category, isCreate]);

  // Use the category row's maintained `drinkCount` instead of fetching
  // every drink and filtering — `useDrinks()` would re-run on every
  // dataBus bump and is overkill when all we need is one tally.
  const catObj = React.useMemo(() => categories.find(c => canonicalCat(c.name) === canonicalCat(category)), [categories, category]);
  const drinksInCat = catObj?.drinkCount || 0;
  const save = async () => {
    if (savingRef.current) return;
    setErr('');
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setErr('Le nom ne peut pas être vide');
      return;
    }

    // ── Create mode: add a brand-new category (+ optional icon) ──────
    if (isCreate) {
      const dup = categories.some(c => canonicalCat(c.name).toLowerCase() === canonicalCat(trimmed).toLowerCase());
      if (dup) {
        setErr('Une catégorie avec ce nom existe déjà');
        return;
      }
      savingRef.current = true;
      setBusy(true);
      try {
        const row = await addCategory(trimmed);
        const pick = glyph && glyph !== '__reset__' ? glyph : null;
        if (row && row.id != null && pick) await setCategoryIcon(row.id, pick);
        // Persiste la teinte choisie (le cas « Auto »/null = pas d'écriture).
        if (row && row.id != null && userTouchedColorRef.current && hue != null) {
          await setCategoryColor(row.id, hue);
        }
        Toast.show(`Catégorie « ${trimmed} » créée`);
        onClose && onClose();
      } catch (e) {
        setErr(e && e.message ? e.message : 'Erreur lors de la création');
      } finally {
        setBusy(false);
        savingRef.current = false;
      }
      return;
    }

    // ── Edit mode ────────────────────────────────────────────────────
    // Capture override existence BEFORE any mutation: a rename below bumps
    // the bus and the refreshed `icons` map gets re-keyed by the new name.
    const hadOverride = !!icons[canonicalCat(category)];
    const hadColorOverride = colors[canonicalCat(category)] != null;
    const userTouched = userTouchedRef.current;
    const userTouchedColor = userTouchedColorRef.current;
    const nameChanged = trimmed !== category;
    // If neither the name, the icon nor the color was touched, this is a
    // no-op save. Surfacing a toast in that case used to mislead users into
    // thinking something changed when nothing did.
    if (!nameChanged && !userTouched && !userTouchedColor) {
      onClose && onClose();
      return;
    }
    // Pre-validate a rename against existing names (NFC + case-insensitive)
    // BEFORE mutating, so a collision surfaces a clean message instead of a
    // raw DB throw mid-flight.
    if (nameChanged) {
      const dup = categories.some(c => canonicalCat(c.name).toLowerCase() === canonicalCat(trimmed).toLowerCase() && canonicalCat(c.name) !== canonicalCat(category));
      if (dup) {
        setErr('Une catégorie avec ce nom existe déjà');
        return;
      }
    }
    savingRef.current = true;
    setBusy(true);
    try {
      // Ensure a real DB row backs this category before mutating. A
      // "synthetic" card (a drink referencing a category with no row) is
      // materialized under its CURRENT name so a rename can cascade to its
      // drinks and the icon has a stable id to hang on. Reached only when
      // something actually changed (guarded by the early-return above), so
      // we never create spurious empty categories.
      let row = catObj || null;
      if (!row) {
        try {
          row = await addCategory(category);
        } catch {}
        if (!row) {
          const db = await waitForDb();
          row = db ? await db.getCategoryByName((category || '').trim()) : null;
        }
      }
      let finalName = category;
      if (nameChanged) {
        // renameCategory cascades to drinks. If it throws we abort before
        // touching the icon; the sheet stays open with the error.
        if (row) await renameCategory(row.name, trimmed);
        finalName = trimmed;
        // Let the parent re-point its name-keyed state (open drill-down,
        // this sheet's own key) at the new name BEFORE the refreshed
        // categories list lands — otherwise its watcher effects treat the
        // rename as a delete and kick the user back to the grid.
        if (onRenamed) {
          try {
            onRenamed(category, trimmed);
          } catch {}
        }
      }
      if (userTouched) {
        // '__reset__' wipes the override so the category falls back to its
        // default glyph; otherwise persist the picked glyph by stable id.
        const next = glyph === '__reset__' ? null : glyph;
        // Skip the write when the user picked Reset on a category that had
        // no override to begin with — nothing to delete.
        if (next || glyph === '__reset__' && hadOverride) {
          if (!row) throw new Error('Catégorie introuvable pour enregistrer l\'icône');
          await setCategoryIcon(row.id, next);
        }
      }
      if (userTouchedColor) {
        // `hue === null` = « Auto » → supprime la surcharge (repli défaut).
        // Skip si Auto sur une catégorie sans surcharge (rien à supprimer).
        if (hue != null || hadColorOverride) {
          if (!row) throw new Error('Catégorie introuvable pour enregistrer la couleur');
          await setCategoryColor(row.id, hue);
        }
      }
      Toast.show(`Catégorie « ${finalName} » mise à jour`);
      close();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setBusy(false);
      savingRef.current = false;
    }
  };
  const remove = async () => {
    if (removingRef.current) return;
    setErr('');
    // Resolve fresh from the current categories array on click instead
    // of caching at render — if the list re-fetched (e.g. concurrent
    // delete elsewhere), the row id we'd otherwise hand to the DB might
    // already be stale. If the cat really is gone, bail visibly instead
    // of silently no-op'ing.
    const fresh = categories.find(c => canonicalCat(c.name) === canonicalCat(category));
    if (!fresh) {
      setErr('Catégorie introuvable — elle a peut-être déjà été supprimée.');
      return;
    }
    // `catObj.drinkCount` is a cached counter on the row and can drift
    // (e.g. drinks added through a legacy code path that didn't call
    // updateCategoryDrinkCount). Querying the drinks table directly
    // gives the authoritative count and prevents the "deleteCategory
    // refuses non-empty" error that used to surface when the cache
    // said 0 but real drinks existed.
    let realCount = 0;
    try {
      const db = await waitForDb();
      if (!db) throw new Error('Base de données indisponible');
      const drinksOfCat = await db.getDrinksByCategory(category);
      realCount = drinksOfCat.length;
    } catch (e) {
      setErr(e && e.message ? e.message : 'Impossible de lire les boissons.');
      return;
    }
    let reassignTo = null;
    if (realCount > 0) {
      const others = categories.filter(c => canonicalCat(c.name) !== canonicalCat(category));
      const fallback = others.find(c => canonicalCat(c.name) === canonicalCat('Autre')) || others[0];
      if (!fallback) {
        setErr('Impossible : créez d\'abord une autre catégorie pour y déplacer les boissons.');
        return;
      }
      const ok = await Confirm.ask({
        title: `Supprimer « ${category} » ?`,
        message: `${realCount} boisson${realCount > 1 ? 's' : ''} sera${realCount > 1 ? 'ont' : ''} déplacée${realCount > 1 ? 's' : ''} dans « ${fallback.name} ». Cette action est irréversible.`,
        confirmText: 'Supprimer',
        danger: true
      });
      if (!ok) return;
      reassignTo = fallback.name;
    } else {
      const ok = await Confirm.ask({
        title: `Supprimer « ${category} » ?`,
        message: 'Cette action est irréversible.',
        confirmText: 'Supprimer',
        danger: true
      });
      if (!ok) return;
    }
    removingRef.current = true;
    setBusy(true);
    try {
      await deleteCategory(fresh.id, {
        reassignTo,
        name: category
      });
      Toast.show(`Catégorie supprimée`);
      close();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de la suppression');
    } finally {
      setBusy(false);
      removingRef.current = false;
    }
  };
  const hasOverride = !!icons[canonicalCat(category)];
  const showResetTile = hasOverride || glyph === '__reset__';

  // ── Couleur (slider de teinte) ──────────────────────────────────
  const clampHue = h => Math.max(0, Math.min(359, Math.round(h)));
  // Nom servant à dériver la teinte par défaut + l'aperçu (le nom tapé en
  // création, la catégorie en édition).
  const colorName = ((isCreate ? name : category) || '').trim() || 'Autre';
  const defHue = defaultCatHue(colorName);
  const effHue = hue != null ? hue : defHue; // teinte affichée
  const isAuto = hue == null;
  // L/C représentatifs de la palette (catColor utilisera les vrais c/l du
  // défaut après save ; ici on n'a besoin que d'un aperçu fidèle).
  const pL = T.isDark ? 72 : 52;
  const pC = 0.14;
  const previewColor = `oklch(${pL}% ${pC} ${effHue})`;
  const previewBg = T.isDark ? `oklch(32% ${pC * 0.5} ${effHue})` : `oklch(94% ${pC * 0.25} ${effHue})`;
  // Piste dégradée : stops aux teintes 0,30,…,330 (interpolation en TÊTE →
  // lint couleur OK ; aucune valeur oklch en dur).
  const hueTrack = `linear-gradient(90deg, ${Array.from({
    length: 13
  }, (_, i) => `oklch(${pL}% ${pC} ${i * 30}) ${(i / 12 * 100).toFixed(1)}%`).join(', ')})`;
  const hueFromClientX = clientX => {
    const el = trackRef.current;
    if (!el || !el.getBoundingClientRect) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return null;
    return clampHue((clientX - rect.left) / rect.width * 359);
  };
  const onTrackKey = e => {
    let h = effHue;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h = effHue - 1;else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h = effHue + 1;else if (e.key === 'Home') h = 0;else if (e.key === 'End') h = 359;else if (e.key === 'PageUp') h = effHue + 15;else if (e.key === 'PageDown') h = effHue - 15;else return;
    e.preventDefault();
    setHue(clampHue(h));
  };
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: close,
    closing: closing,
    label: isCreate ? 'Nouvelle catégorie' : 'Modifier la catégorie'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      padding: '18px 20px 28px',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      overflowX: 'hidden',
      overflowY: 'auto',
      maxHeight: '92dvh'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      paddingBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 4,
      borderRadius: 99,
      background: T.rule
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.3,
      fontStyle: 'italic',
      marginBottom: 18,
      textAlign: 'center'
    }
  }, isCreate ? 'Nouvelle catégorie' : 'Modifier la catégorie'), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 8
    }
  }, "Nom"), /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    "aria-label": "Nom de la cat\xE9gorie",
    style: {
      width: '100%',
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      borderRadius: 12,
      padding: '12px 14px',
      color: T.ink,
      fontFamily: fontSans,
      fontSize: 14,
      outline: 'none',
      marginBottom: 18,
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 8
    }
  }, "Ic\xF4ne"), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Ic\xF4ne de cat\xE9gorie",
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 22,
      flexWrap: 'wrap'
    }
  }, GLYPH_OPTIONS.map(g => {
    const selected = displayedGlyph === g && glyph !== '__reset__';
    return /*#__PURE__*/React.createElement("button", {
      key: g,
      type: "button",
      role: "radio",
      "aria-checked": selected,
      "aria-label": `Icône ${g}`,
      onClick: () => setGlyph(g),
      style: {
        width: 52,
        height: 52,
        borderRadius: 12,
        background: selected ? catBg(g) : T.surface2,
        border: `2px solid ${selected ? catColor(g, T.isDark ? 75 : 55) : T.rule}`,
        display: 'grid',
        placeItems: 'center',
        color: selected ? catColor(g, T.isDark ? 80 : 50) : T.ink2,
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'inherit',
        transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: selected ? `0 0 0 3px ${withAlpha(catColor(g, T.isDark ? 75 : 55), 0.18)}` : 'none'
      }
    }, /*#__PURE__*/React.createElement(CategoryGlyph, {
      glyph: g,
      size: 26
    }));
  }), showResetTile && /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "radio",
    "aria-checked": glyph === '__reset__',
    "aria-label": "R\xE9initialiser l'ic\xF4ne",
    onClick: () => setGlyph('__reset__'),
    title: "Revenir \xE0 l'ic\xF4ne par d\xE9faut",
    style: {
      width: 52,
      height: 52,
      borderRadius: 12,
      background: glyph === '__reset__' ? T.surface3 : T.surface2,
      border: `2px dashed ${glyph === '__reset__' ? T.ink2 : T.rule}`,
      display: 'grid',
      placeItems: 'center',
      color: glyph === '__reset__' ? T.ink : T.muted,
      cursor: 'pointer',
      padding: 0,
      fontFamily: 'inherit',
      transition: 'background 0.15s ease, border-color 0.15s ease'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.refresh,
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      letterSpacing: 1.2,
      textTransform: 'uppercase'
    }
  }, "Couleur"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setHue(null),
    "aria-label": "Couleur automatique",
    "aria-pressed": isAuto,
    title: "Revenir \xE0 la couleur par d\xE9faut",
    style: {
      ...ghostButton,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: 99,
      cursor: 'pointer',
      border: `1px solid ${isAuto ? T.accent : T.rule}`,
      background: isAuto ? T.accentSoft : 'transparent',
      color: isAuto ? T.accent : T.muted,
      fontSize: 10,
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.refresh,
    size: 11
  }), " Auto")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 12,
      flexShrink: 0,
      background: previewBg,
      border: `1px solid ${T.rule}`,
      display: 'grid',
      placeItems: 'center',
      color: previewColor
    }
  }, /*#__PURE__*/React.createElement(CategoryGlyph, {
    glyph: displayedGlyph,
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "slider",
    tabIndex: 0,
    "aria-label": "Teinte de la cat\xE9gorie",
    "aria-valuemin": 0,
    "aria-valuemax": 359,
    "aria-valuenow": effHue,
    "aria-valuetext": isAuto ? `Auto (${effHue})` : String(effHue),
    onKeyDown: onTrackKey,
    onPointerDown: e => {
      if (e.currentTarget.setPointerCapture) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }
      const h = hueFromClientX(e.clientX);
      if (h != null) setHue(h);
    },
    onPointerMove: e => {
      if (e.buttons !== 1) return;
      const h = hueFromClientX(e.clientX);
      if (h != null) setHue(h);
    },
    style: {
      position: 'relative',
      height: 22,
      borderRadius: 99,
      background: hueTrack,
      border: `1px solid ${T.rule}`,
      cursor: 'pointer',
      touchAction: 'none',
      outline: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: '50%',
      left: `${effHue / 359 * 100}%`,
      width: 18,
      height: 18,
      borderRadius: 99,
      transform: 'translate(-50%, -50%)',
      background: previewColor,
      border: `2px solid ${T.bg}`,
      boxShadow: `0 0 0 1px ${T.rule}, 0 1px 4px ${T.scrim}`,
      opacity: isAuto ? 0.7 : 1
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      marginTop: 6,
      fontFamily: fontNum,
      letterSpacing: 0.2
    }
  }, isAuto ? `Auto · teinte ${effHue}°` : `Teinte ${effHue}°`))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.accent2,
      background: T.dangerSoftBg,
      border: `1px solid ${T.dangerSoftBorder}`,
      padding: '8px 12px',
      borderRadius: 10,
      fontSize: 12,
      marginBottom: 14
    }
  }, err), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : save,
    disabled: busy,
    style: {
      width: '100%',
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.accent,
      color: T.accentInk,
      fontSize: 13,
      fontWeight: 600,
      cursor: busy ? 'wait' : 'pointer',
      opacity: busy ? 0.5 : 1,
      border: 'none',
      fontFamily: 'inherit',
      boxShadow: `0 4px 18px ${withAlpha(T.accent, 0.4)}`
    }
  }, busy ? isCreate ? 'Création…' : 'Enregistrement…' : isCreate ? 'Créer la catégorie' : 'Enregistrer'), !isCreate && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : remove,
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 12,
      padding: '12px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.dangerSoftBg,
      color: T.accent2,
      border: `1px solid ${T.dangerSoftBorder}`,
      fontSize: 12.5,
      fontWeight: 500,
      cursor: busy ? 'wait' : 'pointer',
      opacity: busy ? 0.5 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.trash,
    size: 13
  }), "Supprimer la cat\xE9gorie")));
}
Object.assign(window, {
  CategoriesTab,
  CategoryGrid,
  CategoryCard,
  FamilyList,
  FamilyRow,
  EditCategorySheet
});
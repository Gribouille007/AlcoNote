/* AUTO-GENERATED from proto/categories.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// categories.jsx — Tab 1: Catégories (grid + drill-down to family detail)

function CategoriesTab({
  onAdd,
  onOpenFamily,
  onDirectAdd,
  onEditFamily,
  query,
  setQuery,
  openCat,
  setOpenCat
}) {
  const [editCat, setEditCat] = React.useState(null);
  const {
    categories
  } = useCategories();
  const {
    drinks
  } = useDrinks();
  const ratings = useRatings();
  // Icon overrides re-render <CategoryGlyph> via CategoryIconsContext
  // (provided at App root) — no need for this tab to subscribe.

  // If the open category was just deleted, drop back to the grid so the
  // user isn't stranded inside an empty FamilyList for a missing cat.
  React.useEffect(() => {
    if (openCat && categories.length > 0 && !categories.some(c => c.name === openCat)) {
      setOpenCat(null);
    }
  }, [openCat, categories, setOpenCat]);

  // Same idea for the edit sheet — close it if the underlying category
  // vanished (deleted from elsewhere) so it doesn't operate on stale data.
  React.useEffect(() => {
    if (editCat && categories.length > 0 && !categories.some(c => c.name === editCat)) {
      setEditCat(null);
    }
  }, [editCat, categories]);
  const families = React.useMemo(() => buildFamilies(drinks, ratings), [drinks, ratings]);
  const cats = React.useMemo(() => computeCategoryStats(categories, families), [categories, families]);
  const filtered = React.useMemo(() => {
    if (!openCat) return [];
    const q = (query || '').toLowerCase();
    return families.filter(f => f.category === openCat && (!q || f.name.toLowerCase().includes(q)));
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
    onAdd: onAdd
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
    onClose: () => setEditCat(null)
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
  onAdd
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
  }, cats.map(c => /*#__PURE__*/React.createElement(CategoryCard, {
    key: c.id || c.name,
    cat: c,
    onClick: () => onOpen(c.name),
    onEdit: () => onEditCat(c.name)
  }))), cats.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 13,
      padding: '60px 0',
      textAlign: 'center'
    }
  }, "Aucune cat\xE9gorie pour le moment.")), q && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, null, matchedFams.length, " r\xE9sultat", matchedFams.length > 1 ? 's' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, matchedFams.map(f => /*#__PURE__*/React.createElement(FamilyRow, {
    key: f.id,
    family: f,
    onClick: () => onOpenFamily(f)
  })), matchedFams.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 13,
      padding: '40px 0',
      textAlign: 'center'
    }
  }, "Aucun r\xE9sultat pour \xAB ", query, " \xBB"))));
}
function CategoryCard({
  cat,
  onClick,
  onEdit
}) {
  const color = catColor(cat.name, 70);
  const bg = catBg(cat.name);
  return /*#__PURE__*/React.createElement("div", _extends({}, clickable(onClick, `Ouvrir la catégorie ${cat.name}`), {
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
      justifyContent: 'space-between'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: e => {
      e.stopPropagation();
      onEdit && onEdit();
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
}
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
  }) => /*#__PURE__*/React.createElement(FamilyRow, {
    key: f.id,
    family: f,
    variantIndex: idx,
    variantCount: total,
    onClick: () => onOpen(f),
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
function FamilyRow({
  family: f,
  variantIndex = 0,
  variantCount = 1,
  onClick,
  onDirectAdd
}) {
  const color = catColor(f.category, 70);
  const totalEntries = f.entries.length;
  const isFirstOfGroup = variantIndex === 0;
  const isLastOfGroup = variantIndex === variantCount - 1;
  const topMargin = isFirstOfGroup ? 8 : 0;
  return /*#__PURE__*/React.createElement("div", _extends({}, clickable(onClick, `Voir les détails de ${f.name}`), {
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
      position: 'relative'
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
  }, "\xD7", totalEntries), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: ev => {
      ev.stopPropagation();
      onDirectAdd && onDirectAdd(f);
    },
    style: {
      width: 32,
      height: 32,
      borderRadius: 10,
      background: T.accentSoft,
      border: `1px solid ${T.accentSoftBorder}`,
      display: 'grid',
      placeItems: 'center',
      color: T.accent,
      cursor: 'pointer',
      flexShrink: 0,
      padding: 0,
      fontFamily: 'inherit'
    },
    title: "Ajouter \xE0 nouveau",
    "aria-label": `Ajouter ${f.name} (${f.quantity} ${f.unit}, ${f.alcohol}°) à nouveau`
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.plus,
    size: 14
  })));
}
function EditCategorySheet({
  category,
  onClose
}) {
  const {
    categories
  } = useCategories();
  // Read overrides from the App-level CategoryIconsContext rather than
  // re-subscribing locally — keeps the sheet in sync with whatever the
  // grid is painting without a second DB round-trip on every bump.
  const icons = React.useContext(CategoryIconsContext);
  const [name, setName] = React.useState(category);
  // `glyph` holds the user's *explicit* choice in this sheet. `null`
  // means "no explicit pick yet" (use whatever's currently persisted)
  // and a string means the user actively selected that tile — including
  // the `'__reset__'` sentinel which means "drop the override".
  const [glyph, setGlyphState] = React.useState(() => icons[category] || null);
  const userTouchedRef = React.useRef(false);
  const setGlyph = g => {
    userTouchedRef.current = true;
    setGlyphState(g);
  };
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Re-entry guards — protect against double-tap on Save/Supprimer
  // before React has flipped `busy` and disabled the buttons.
  const savingRef = React.useRef(false);
  const removingRef = React.useRef(false);

  // What the picker should highlight. After "Réinitialiser" we fall
  // back to the same logic <CategoryGlyph> uses when there's no
  // override, so the highlighted tile matches the card.
  const displayedGlyph = glyph && glyph !== '__reset__' ? glyph : GLYPH_OPTIONS.includes(category) ? category : 'Autre';

  // Keep the form in sync if the sheet is reused for a different
  // category (rare in current routing, but cheap to guard against).
  React.useEffect(() => {
    setName(category);
  }, [category]);

  // Adopt the persisted override once it loads (or is updated elsewhere)
  // — but never overwrite a pick the user has already made in this sheet.
  React.useEffect(() => {
    if (!userTouchedRef.current) setGlyphState(icons[category] || null);
  }, [icons, category]);

  // Use the category row's maintained `drinkCount` instead of fetching
  // every drink and filtering — `useDrinks()` would re-run on every
  // dataBus bump and is overkill when all we need is one tally.
  const catObj = React.useMemo(() => categories.find(c => c.name === category), [categories, category]);
  const drinksInCat = catObj?.drinkCount || 0;
  const save = async () => {
    if (savingRef.current) return;
    setErr('');
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setErr('Le nom ne peut pas être vide');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      let finalName = category;
      if (trimmed !== category) {
        // renameCategory migrates any existing icon override to the new
        // name, so we only need to persist when the user explicitly
        // picked a different glyph in this sheet.
        await renameCategory(category, trimmed);
        finalName = trimmed;
      }
      if (userTouchedRef.current) {
        // '__reset__' wipes the persisted override entirely so the
        // category falls back to its name-based default glyph.
        const next = glyph === '__reset__' ? null : glyph;
        // Skip the write when the user picked Reset on a category that
        // had no override to begin with — nothing to delete.
        const hadOverride = !!icons[category];
        if (next || glyph === '__reset__' && hadOverride) {
          await setCategoryIcon(finalName, next);
        }
      }
      Toast.show(`Catégorie « ${finalName} » mise à jour`);
      onClose && onClose();
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
    const fresh = categories.find(c => c.name === category);
    if (!fresh) {
      setErr('Catégorie introuvable — elle a peut-être déjà été supprimée.');
      return;
    }
    let reassignTo = null;
    if (drinksInCat > 0) {
      const others = categories.filter(c => c.name !== category);
      const fallback = others.find(c => c.name === 'Autre') || others[0];
      if (!fallback) {
        setErr('Impossible : créez d\'abord une autre catégorie pour y déplacer les boissons.');
        return;
      }
      const ok = await Confirm.ask({
        title: `Supprimer « ${category} » ?`,
        message: `${drinksInCat} boisson${drinksInCat > 1 ? 's' : ''} sera${drinksInCat > 1 ? 'ont' : ''} déplacée${drinksInCat > 1 ? 's' : ''} dans « ${fallback.name} ». Cette action est irréversible.`,
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
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de la suppression');
    } finally {
      setBusy(false);
      removingRef.current = false;
    }
  };
  const hasOverride = !!icons[category];
  const showResetTile = hasOverride || glyph === '__reset__';
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      padding: '18px 20px 28px',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      animation: 'slideUp 0.25s ease',
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
  }, "Modifier la cat\xE9gorie"), /*#__PURE__*/React.createElement("div", {
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
  }))), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.accent2,
      background: 'oklch(35% 0.10 25 / 0.15)',
      border: '1px solid oklch(45% 0.15 25 / 0.4)',
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
      color: T.isDark ? T.bg : '#fff',
      fontSize: 13,
      fontWeight: 600,
      cursor: busy ? 'wait' : 'pointer',
      opacity: busy ? 0.5 : 1,
      border: 'none',
      fontFamily: 'inherit',
      boxShadow: `0 4px 18px ${withAlpha(T.accent, 0.4)}`
    }
  }, busy ? 'Enregistrement…' : 'Enregistrer'), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : remove,
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 12,
      padding: '12px',
      textAlign: 'center',
      borderRadius: 12,
      background: 'oklch(35% 0.10 25 / 0.15)',
      color: T.accent2,
      border: '1px solid oklch(45% 0.15 25 / 0.4)',
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
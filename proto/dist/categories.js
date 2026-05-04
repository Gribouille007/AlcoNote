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
  const families = React.useMemo(() => buildFamilies(drinks, ratings), [drinks, ratings]);
  const cats = React.useMemo(() => computeCategoryStats(categories, families), [categories, families]);
  const filtered = openCat ? families.filter(f => f.category === openCat && (query === '' || f.name.toLowerCase().includes((query || '').toLowerCase()))) : [];
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
  onEditCat
}) {
  const q = (query || '').toLowerCase();
  const matchedFams = q ? families.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)) : [];
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
  onEditCat
}) {
  // Group families by (name + alcohol) so identical drinks collapse into one row
  const grouped = [];
  const seen = new Map();
  for (const f of families) {
    const key = `${f.name.trim().toLowerCase()}::${f.alcohol}`;
    if (seen.has(key)) {
      const idx = seen.get(key);
      grouped[idx].dupes.push(f);
      grouped[idx].totalEntries += f.entries.length;
    } else {
      seen.set(key, grouped.length);
      grouped.push({
        ...f,
        dupes: [],
        totalEntries: f.entries.length
      });
    }
  }
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
  }, grouped.length, " type", grouped.length !== 1 ? 's' : '', " \xB7", ' ', families.reduce((s, f) => s + f.entries.length, 0), " entr\xE9es au total"), grouped.map(f => /*#__PURE__*/React.createElement(FamilyRow, {
    key: f.id,
    family: f,
    onClick: () => onOpen(f),
    onDirectAdd: onDirectAdd
  })), grouped.length === 0 && /*#__PURE__*/React.createElement("div", {
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
  onClick,
  onDirectAdd
}) {
  const color = catColor(f.category, 70);
  const totalEntries = f.totalEntries !== undefined ? f.totalEntries : f.entries.length;
  const dupeCount = (f.dupes ? f.dupes.length : 0) + 1;
  const lastTs = f.entries[0]?.ts;
  const lastStr = lastTs ? fmtDateShort(lastTs) : '—';
  return /*#__PURE__*/React.createElement("div", _extends({}, clickable(onClick, `Voir les détails de ${f.name}`), {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '14px 14px',
      background: T.surface,
      borderRadius: 14,
      border: `1px solid ${T.rule}`,
      marginBottom: 8,
      cursor: 'pointer',
      position: 'relative'
    }
  }), dupeCount > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '-3px 8px auto 8px',
      height: 6,
      background: T.surface,
      borderRadius: '14px 14px 0 0',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      zIndex: -1,
      opacity: 0.6
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '-6px 16px auto 16px',
      height: 6,
      background: T.surface,
      borderRadius: '14px 14px 0 0',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      zIndex: -2,
      opacity: 0.3
    }
  })), /*#__PURE__*/React.createElement("div", {
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
  }), dupeCount > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -6,
      right: -6,
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      borderRadius: 9,
      background: T.accent,
      color: T.isDark ? T.bg : '#fff',
      fontSize: 10,
      fontWeight: 600,
      fontFamily: fontNum,
      display: 'grid',
      placeItems: 'center',
      border: `2px solid ${T.surface}`
    }
  }, "\xD7", dupeCount)), /*#__PURE__*/React.createElement("div", {
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
  }, f.name), /*#__PURE__*/React.createElement("div", {
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
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, f.alcohol, "\xB0"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, totalEntries, "\xD7"))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginRight: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 13,
      color: T.ink2
    }
  }, lastStr), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.3,
      marginTop: 2
    }
  }, "derni\xE8re")), /*#__PURE__*/React.createElement("button", {
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
    "aria-label": `Ajouter ${f.name} à nouveau`
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.plus,
    size: 14
  })));
}
function EditCategorySheet({
  category,
  onClose
}) {
  const [name, setName] = React.useState(category);
  const [glyph, setGlyph] = React.useState(category);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const glyphOptions = ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre'];
  const save = async () => {
    setErr('');
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setErr('Le nom ne peut pas être vide');
      return;
    }
    setBusy(true);
    try {
      if (trimmed !== category) {
        await renameCategory(category, trimmed);
        Toast.show(`Catégorie « ${trimmed} » mise à jour`);
      }
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setBusy(false);
    }
  };
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
      animation: 'slideUp 0.25s ease'
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
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 22,
      flexWrap: 'wrap'
    }
  }, glyphOptions.map(g => /*#__PURE__*/React.createElement("div", {
    key: g,
    onClick: () => setGlyph(g),
    style: {
      width: 48,
      height: 48,
      borderRadius: 12,
      background: glyph === g ? catBg(g) : T.surface2,
      border: `1px solid ${glyph === g ? catColor(g, 60) : T.rule}`,
      display: 'grid',
      placeItems: 'center',
      color: glyph === g ? catColor(g, 75) : T.ink2,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(CategoryGlyph, {
    name: g
  })))), err && /*#__PURE__*/React.createElement("div", {
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
      boxShadow: `0 4px 18px ${T.accent}60`
    }
  }, busy ? 'Enregistrement…' : 'Enregistrer')));
}
Object.assign(window, {
  CategoriesTab,
  CategoryGrid,
  CategoryCard,
  FamilyList,
  FamilyRow,
  EditCategorySheet
});
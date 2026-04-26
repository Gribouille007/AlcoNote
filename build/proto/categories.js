function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// categories.jsx — Tab 1: Catégories (list + drill-down to family detail)

function CategoriesTab({
  onAdd,
  onOpenFamily,
  onDirectAdd
}) {
  const [query, setQuery] = React.useState('');
  const [openCat, setOpenCat] = React.useState(null); // category name or null
  const [editCat, setEditCat] = React.useState(null); // category being edited

  const cats = categoryStats();
  const filtered = openCat ? DRINK_FAMILIES.filter(f => f.category === openCat && (query === '' || f.name.toLowerCase().includes(query.toLowerCase()))) : [];
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
    value: query,
    onChange: setQuery,
    placeholder: openCat ? `Rechercher dans ${openCat}…` : 'Rechercher boisson ou catégorie…'
  })), !openCat ? /*#__PURE__*/React.createElement(CategoryGrid, {
    cats: cats,
    query: query,
    onOpen: setOpenCat,
    onOpenFamily: onOpenFamily,
    onEditCat: setEditCat
  }) : /*#__PURE__*/React.createElement(FamilyList, {
    category: openCat,
    families: filtered,
    onBack: () => setOpenCat(null),
    onOpen: onOpenFamily,
    onDirectAdd: onDirectAdd,
    onEditCat: () => setEditCat(openCat)
  }), editCat && /*#__PURE__*/React.createElement(EditCategorySheet, {
    category: editCat,
    onClose: () => setEditCat(null)
  }));
}
function SearchInput({
  value,
  onChange,
  placeholder
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: T.surface2,
      borderRadius: 14,
      padding: '11px 14px',
      border: `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.search,
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    style: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: T.ink,
      fontFamily: fontSans,
      fontSize: 14,
      letterSpacing: -0.1
    }
  }), value && /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange(''),
    style: {
      color: T.muted,
      display: 'flex',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  })));
}
function CategoryGrid({
  cats,
  query,
  onOpen,
  onOpenFamily,
  onEditCat
}) {
  // If searching, show matching families across all categories
  const q = query.toLowerCase();
  const matchedFams = q ? DRINK_FAMILIES.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)) : [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 18px 100px'
    }
  }, !q && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, null, "Vos cat\xE9gories"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      marginTop: 10
    }
  }, cats.map(c => /*#__PURE__*/React.createElement(CategoryCard, {
    key: c.id,
    cat: c,
    onClick: () => onOpen(c.name),
    onEdit: () => onEditCat(c.name)
  })))), q && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, null, matchedFams.length, " r\xE9sultat", matchedFams.length > 1 ? 's' : ''), /*#__PURE__*/React.createElement("div", {
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
function SectionHead({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: T.muted,
      fontSize: 11,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontWeight: 500,
      padding: '6px 2px'
    }
  }, /*#__PURE__*/React.createElement("span", null, children), right);
}
function CategoryCard({
  cat,
  onClick,
  onEdit
}) {
  const color = catColor(cat.name, 70);
  const bg = catBg(cat.name);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
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
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      e.stopPropagation();
      onEdit && onEdit();
    },
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
      zIndex: 2
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
      marginBottom: 3
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
function CategoryGlyph({
  name
}) {
  // Simple shape glyphs per category — no emoji
  const s = {
    width: 22,
    height: 22
  };
  if (name === 'Bière') return /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 6h8v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M15 9h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "9",
    y1: "10",
    x2: "9",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "10",
    x2: "12",
    y2: "18"
  }));
  if (name === 'Vin') return /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "13",
    x2: "12",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "21",
    x2: "16",
    y2: "21"
  }));
  if (name === 'Spiritueux') return /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8",
    y: "8",
    width: "8",
    height: "13",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.5",
    y: "3",
    width: "5",
    height: "5",
    rx: "0.5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "13",
    x2: "16",
    y2: "13"
  }));
  if (name === 'Cocktail') return /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 4h16l-8 9-8-9z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "13",
    x2: "12",
    y2: "20"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "21",
    x2: "16",
    y2: "21"
  }));
  return /*#__PURE__*/React.createElement("svg", _extends({}, s, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "8",
    x2: "12",
    y2: "12"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "16",
    r: "0.5",
    fill: "currentColor"
  }));
}

// ── Family list within a category ─────────────────────────────────
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
      padding: '0 18px 100px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onBack,
    style: {
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
  }), /*#__PURE__*/React.createElement("span", null, "Cat\xE9gories")), /*#__PURE__*/React.createElement("div", {
    onClick: onEditCat,
    style: {
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
  const lastStr = lastTs ? formatDateShort(lastTs) : '—';
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
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
  }, dupeCount > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: '-3px 8px auto 8px',
      height: 6,
      background: T.surface,
      borderRadius: '14px 14px 0 0',
      border: `1px solid ${T.rule}`,
      borderBottom: 'none',
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
      border: `1px solid ${T.rule}`,
      borderBottom: 'none',
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
  }, "derni\xE8re")), /*#__PURE__*/React.createElement("div", {
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
      flexShrink: 0
    },
    title: "Ajouter \xE0 nouveau"
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
  const glyphOptions = ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre'];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: T.scrim,
      zIndex: 150,
      display: 'flex',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      padding: '18px 20px 28px',
      border: `1px solid ${T.rule}`
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
  })))), /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.accent,
      color: T.isDark ? T.bg : '#fff',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      boxShadow: `0 4px 18px ${T.accent}60`
    }
  }, "Enregistrer")));
}
function formatDateShort(iso) {
  const d = new Date(iso);
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
Object.assign(window, {
  CategoriesTab,
  SearchInput,
  SectionHead,
  CategoryCard,
  CategoryGlyph,
  FamilyList,
  FamilyRow,
  formatDateShort,
  EditCategorySheet
});
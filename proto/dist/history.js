/* AUTO-GENERATED from proto/history.jsx — do not edit by hand. */
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
  const {
    categories
  } = useCategories();
  const {
    drinks
  } = useDrinks();
  const ratings = useRatings();
  const families = React.useMemo(() => buildFamilies(drinks, ratings), [drinks, ratings]);
  const allEntries = React.useMemo(() => flattenEntries(families), [families]);
  const toggleDay = day => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);else next.add(day);
      saveCollapsedDays(next);
      return next;
    });
  };
  const entries = allEntries.filter(e => {
    if (filter !== 'all' && e.family.category !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!e.family.name.toLowerCase().includes(q) && !e.family.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const groups = {};
  for (const e of entries) {
    const day = e.ts.slice(0, 10);
    (groups[day] = groups[day] || []).push(e);
  }
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));
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
  }, "Aucune entr\xE9e trouv\xE9e"), days.map((day, i) => /*#__PURE__*/React.createElement(DayGroup, {
    key: day,
    day: day,
    entries: groups[day],
    isCollapsed: collapsed.has(day),
    onToggle: () => toggleDay(day),
    onOpenEntry: onOpenEntry,
    onDirectAdd: onDirectAdd,
    first: i === 0
  }))));
}
function DayGroup({
  day,
  entries,
  isCollapsed,
  onToggle,
  onOpenEntry,
  onDirectAdd,
  first
}) {
  const d = new Date(day + 'T00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  let rel = null;
  if (diff === 0) rel = "Aujourd'hui";else if (diff === 1) rel = 'Hier';else if (diff < 7) rel = `il y a ${diff} jours`;

  // Total cL (mirror the real-app summary)
  const totalCl = entries.reduce((s, e) => s + toCl(e.family.quantity, e.family.unit), 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: first ? 4 : 14,
      marginBottom: 4,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onToggle,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      background: T.surface,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: isCollapsed ? 12 : 0,
      borderBottomRightRadius: isCollapsed ? 12 : 0,
      border: `1px solid ${T.rule}`,
      borderBottom: isCollapsed ? `1px solid ${T.rule}` : 'none',
      cursor: 'pointer',
      position: 'relative',
      zIndex: 2
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
  }, entries.length, " boisson", entries.length > 1 ? 's' : '', " \xB7 ", totalCl.toFixed(0), " cL", rel && /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.6
    }
  }, " \xB7 ", rel)))), !isCollapsed && /*#__PURE__*/React.createElement("div", {
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
      border: `1px solid ${T.rule}`,
      borderTop: 'none',
      marginLeft: -24
    }
  }, entries.map((e, i) => /*#__PURE__*/React.createElement(EntryRow, {
    key: e.id || i,
    entry: e,
    onClick: () => onOpenEntry(e),
    onDirectAdd: onDirectAdd,
    first: i === 0,
    last: i === entries.length - 1
  })))));
}
function EntryRow({
  entry: e,
  onClick,
  onDirectAdd,
  first,
  last
}) {
  const color = catColor(e.family.category, 70);
  const t = e.ts.slice(11, 16);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 10px 12px 18px',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
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
  }), /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      flex: 1,
      minWidth: 0,
      cursor: 'pointer'
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
  }, t), /*#__PURE__*/React.createElement("div", {
    onClick: ev => {
      ev.stopPropagation();
      onDirectAdd && onDirectAdd(e.family);
    },
    style: {
      width: 30,
      height: 30,
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
Object.assign(window, {
  HistoryTab,
  DayGroup,
  EntryRow
});
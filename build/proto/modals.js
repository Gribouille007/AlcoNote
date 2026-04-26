// modals.jsx — Add drink modal + drink detail sheet + settings drawer + scanner

function AddDrinkSheet({
  open,
  prefill,
  onClose
}) {
  const [scan, setScan] = React.useState(false);
  const [name, setName] = React.useState('Pilsner Urquell');
  const [cat, setCat] = React.useState('Bière');
  const [qty, setQty] = React.useState(33);
  const [unit, setUnit] = React.useState('cL');
  const [alc, setAlc] = React.useState(4.4);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (prefill) {
      setName(prefill.name);
      setCat(prefill.category);
      setQty(prefill.quantity);
      setUnit(prefill.unit);
      setAlc(prefill.alcohol);
    }
  }, [prefill]);
  if (!open) return null;
  const volCl = unit === 'EcoCup' ? qty * 25 : unit === 'L' ? qty * 100 : qty;
  const g = +(volCl * 10 * (alc / 100) * 0.789).toFixed(1);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await addDrinkToDb({
        name,
        category: cat,
        quantity: qty,
        unit,
        alcoholContent: alc
      });
    } catch (e) {
      console.warn('[AlcoNote] save drink failed', e);
    } finally {
      setSaving(false);
      onClose();
    }
  };
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      padding: '10px 0 0',
      maxHeight: '92%',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${T.rule}`,
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: '6px 0 4px'
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 18px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      color: T.ink,
      letterSpacing: -0.3,
      fontStyle: 'italic'
    }
  }, "Nouvelle boisson"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 30,
      height: 30,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'auto',
      padding: '0 18px 20px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: () => setScan(true),
    "aria-label": "Scanner un code-barres",
    style: {
      background: T.isDark ? `linear-gradient(135deg, oklch(30% 0.03 65), ${T.surface})` : `linear-gradient(135deg, ${T.accentSoft}, ${T.surface})`,
      border: `1px solid ${T.rule}`,
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      width: '100%',
      textAlign: 'left',
      marginBottom: 18,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: T.accent,
      display: 'grid',
      placeItems: 'center',
      color: T.isDark ? T.bg : '#fff',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.scan,
    size: 22
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      color: T.ink,
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: -0.1
    }
  }, "Scanner un code-barres"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      color: T.muted,
      fontSize: 11.5,
      marginTop: 3,
      letterSpacing: 0.1
    }
  }, "Remplissage auto depuis OpenFoodFacts")), /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chev,
    size: 14,
    color: T.muted
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Boisson"
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    style: inputS()
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Cat\xE9gorie"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.id,
    onClick: () => setCat(c.name),
    style: {
      padding: '7px 12px',
      borderRadius: 10,
      fontSize: 12,
      border: `1px solid ${cat === c.name ? T.accent : T.rule}`,
      background: cat === c.name ? T.accentSoft : 'transparent',
      color: cat === c.name ? T.accent : T.ink2,
      cursor: 'pointer',
      letterSpacing: -0.1
    }
  }, c.name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Quantit\xE9"
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: qty,
    onChange: e => setQty(+e.target.value || 0),
    style: inputS()
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Unit\xE9"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      padding: 3,
      background: T.surface2,
      borderRadius: 10,
      border: `1px solid ${T.rule}`
    }
  }, ['cL', 'L', 'EcoCup'].map(u2 => /*#__PURE__*/React.createElement("div", {
    key: u2,
    onClick: () => setUnit(u2),
    style: {
      flex: 1,
      padding: '8px 0',
      borderRadius: 7,
      textAlign: 'center',
      fontSize: 11.5,
      cursor: 'pointer',
      letterSpacing: -0.1,
      background: unit === u2 ? T.ink : 'transparent',
      color: unit === u2 ? T.bg : T.ink2,
      fontWeight: unit === u2 ? 600 : 400
    }
  }, u2))))), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Degr\xE9 d'alcool"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      borderRadius: 12,
      padding: '10px 14px'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: alc,
    step: "0.1",
    onChange: e => setAlc(+e.target.value || 0),
    style: {
      flex: 1,
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: T.ink,
      fontSize: 15,
      fontFamily: fontSans
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontSize: 13
    }
  }, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Date"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...inputS(),
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: T.ink
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.cal,
    size: 14,
    color: T.muted
  }), "Aujourd'hui")), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Heure"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...inputS(),
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      color: T.ink
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.clock,
    size: 14,
    color: T.muted
  }), "22:04"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: 14,
      background: T.surface,
      borderRadius: 14,
      border: `1px solid ${T.rule}`,
      display: 'flex',
      justifyContent: 'space-around'
    }
  }, /*#__PURE__*/React.createElement(ImpactStat, {
    big: `${volCl} cL`,
    unit: "volume"
  }), /*#__PURE__*/React.createElement(ImpactStat, {
    big: g + 'g',
    unit: "alcool pur",
    accent: true
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px 22px',
      borderTop: `1px solid ${T.rule}`,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: onClose,
    style: {
      flex: 1,
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      fontSize: 13,
      border: `1px solid ${T.rule}`
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: save,
    disabled: saving,
    "aria-label": saving ? 'Enregistrement en cours' : 'Enregistrer la boisson',
    style: {
      flex: 2,
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.accent,
      color: T.isDark ? T.bg : '#fff',
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: 0.1,
      boxShadow: `0 4px 18px ${T.accent}60`,
      opacity: saving ? 0.7 : 1
    }
  }, saving ? 'Enregistrement…' : 'Enregistrer'))), scan && /*#__PURE__*/React.createElement(ScannerSheet, {
    onClose: () => setScan(false),
    onScanned: () => {
      setScan(false);
    }
  }));
}
function inputS() {
  return {
    width: '100%',
    background: T.surface2,
    border: `1px solid ${T.rule}`,
    borderRadius: 12,
    padding: '11px 14px',
    color: T.ink,
    fontSize: 14,
    fontFamily: fontSans,
    outline: 'none',
    letterSpacing: -0.1
  };
}
function FieldGroup({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: T.muted,
      fontWeight: 500,
      marginBottom: 7
    }
  }, label), children);
}
function ImpactStat({
  big,
  unit,
  accent
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      color: accent ? T.accent : T.ink,
      letterSpacing: -0.3,
      lineHeight: 1
    }
  }, big), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: T.muted,
      marginTop: 4,
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    }
  }, unit));
}

// ── Scanner overlay ────────────────────────────────────────────────
function ScannerSheet({
  onClose,
  onScanned
}) {
  const [status, setStatus] = React.useState('scanning');
  React.useEffect(() => {
    const t = setTimeout(() => setStatus('found'), 2400);
    return () => clearTimeout(t);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: '#000',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse at center, oklch(25% 0.01 50) 0%, oklch(10% 0.005 50) 80%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: '50px 22px 18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontFamily: fontSerif,
      fontSize: 20,
      fontStyle: 'italic',
      letterSpacing: -0.2
    }
  }, "Scanner"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: onClose,
    "aria-label": "Fermer le scanner",
    style: {
      width: 36,
      height: 36,
      borderRadius: 99,
      background: 'rgba(255,255,255,0.12)',
      display: 'grid',
      placeItems: 'center',
      color: T.ink
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240,
      height: 150,
      position: 'relative',
      border: `1.5px solid ${status === 'found' ? T.good : T.accent}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderColor: status === 'found' ? T.good : T.accent,
      borderStyle: 'solid',
      borderWidth: 0,
      top: i < 2 ? -1 : 'auto',
      bottom: i >= 2 ? -1 : 'auto',
      left: i % 2 === 0 ? -1 : 'auto',
      right: i % 2 === 1 ? -1 : 'auto',
      borderTopWidth: i < 2 ? 3 : 0,
      borderBottomWidth: i >= 2 ? 3 : 0,
      borderLeftWidth: i % 2 === 0 ? 3 : 0,
      borderRightWidth: i % 2 === 1 ? 3 : 0
    }
  })), status === 'scanning' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, `@keyframes sl { 0%{top:0} 100%{top:100%} }`), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`,
      animation: 'sl 1.8s ease-in-out infinite alternate',
      boxShadow: `0 0 14px ${T.accent}`
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: T.ink,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      borderRadius: 99,
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(8px)',
      border: `1px solid rgba(255,255,255,0.1)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      background: status === 'found' ? T.good : T.accent,
      boxShadow: `0 0 8px ${status === 'found' ? T.good : T.accent}`
    }
  }), status === 'found' ? 'Guinness Draught détectée' : 'Positionnez le code-barres'))), status === 'found' && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 22px 40px',
      position: 'relative',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: onScanned,
    style: {
      background: T.accent,
      color: T.bg,
      padding: '15px',
      borderRadius: 14,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: 600,
      width: '100%'
    }
  }, "Utiliser ce produit")));
}

// ── Drink detail sheet (family) ───────────────────────────────────
function DrinkDetailSheet({
  family,
  entry,
  onClose,
  onDirectAdd
}) {
  if (!family && !entry) return null;
  const f = family || entry.family;
  const color = catColor(f.category, 70);
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      maxHeight: '90%',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${T.rule}`,
      borderBottom: 'none',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      padding: '10px 0 4px'
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
      padding: '20px 22px 22px',
      background: `linear-gradient(160deg, ${catBg(f.category)}, transparent 90%)`,
      borderBottom: `1px solid ${T.rule}`,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: 16,
      background: 'rgba(0,0,0,0.22)',
      display: 'grid',
      placeItems: 'center',
      color,
      flexShrink: 0,
      border: `1px solid ${T.rule}`
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
      fontSize: 10.5,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color,
      fontWeight: 500,
      marginBottom: 4
    }
  }, f.category), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 24,
      color: T.ink,
      letterSpacing: -0.4,
      lineHeight: 1.1
    }
  }, f.name)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 32,
      height: 32,
      borderRadius: 99,
      background: 'rgba(0,0,0,0.3)',
      display: 'grid',
      placeItems: 'center',
      color: T.ink,
      alignSelf: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement(FactCell, {
    label: "Quantit\xE9",
    value: `${f.quantity} ${f.unit}`
  }), /*#__PURE__*/React.createElement(FactCell, {
    label: "Alcool",
    value: `${f.alcohol}°`
  }), /*#__PURE__*/React.createElement(FactCell, {
    label: "cL",
    value: formatCl(f)
  }), /*#__PURE__*/React.createElement(FactCell, {
    label: "Note",
    value: /*#__PURE__*/React.createElement(Stars, {
      rating: f.rating
    }),
    last: true
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'auto',
      padding: '16px 22px 20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10.5,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontWeight: 500,
      marginBottom: 10
    }
  }, "Historique \xB7 ", f.entries.length, " entr\xE9e", f.entries.length !== 1 ? 's' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      borderRadius: 14,
      border: `1px solid ${T.rule}`,
      overflow: 'hidden'
    }
  }, f.entries.map((e, i) => {
    const d = new Date(e.ts);
    const months = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    return /*#__PURE__*/React.createElement("div", {
      key: e.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderBottom: i === f.entries.length - 1 ? 'none' : `1px solid ${T.rule}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: fontSerif,
        fontSize: 14,
        color: T.ink2,
        fontStyle: 'italic',
        width: 60,
        flexShrink: 0
      }
    }, d.getDate(), " ", months[d.getMonth()]), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: fontNum,
        fontSize: 13,
        color: T.ink,
        fontWeight: 500
      }
    }, e.ts.slice(11, 16)), e.place && /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 11,
        marginTop: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }
    }, /*#__PURE__*/React.createElement(SvgIcon, {
      icon: Ic.pin,
      size: 10
    }), " ", e.place)), /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(SvgIcon, {
      icon: Ic.chev,
      size: 14
    })));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 22px 22px',
      borderTop: `1px solid ${T.rule}`,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    "aria-label": "Modifier la boisson",
    style: {
      flex: 1,
      padding: '13px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      fontSize: 13,
      border: `1px solid ${T.rule}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.edit,
    size: 14
  }), " Modifier"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: () => {
      if (onDirectAdd) {
        onDirectAdd(f);
        onClose();
      }
    },
    "aria-label": "Ajouter cette boisson \xE0 nouveau",
    style: {
      flex: 2,
      padding: '13px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.accent,
      color: T.isDark ? T.bg : '#fff',
      fontSize: 13,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      boxShadow: `0 4px 18px ${T.accent}60`
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.plus,
    size: 14
  }), " Ajouter \xE0 nouveau"))));
}
function FactCell({
  label,
  value,
  last
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '0 6px',
      borderRight: last ? 'none' : `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: T.muted,
      fontWeight: 500,
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 17,
      color: T.ink,
      letterSpacing: -0.2,
      display: 'flex',
      justifyContent: 'center'
    }
  }, value));
}
function formatCl(f) {
  const q = f.quantity;
  const u = (f.unit || '').toLowerCase();
  if (u === 'ecocup') return `${q * 25}`;
  if (u === 'l') return `${q * 100}`;
  if (u === 'ml') return `${(q / 10).toFixed(1)}`;
  return `${q}`;
}
function Stars({
  rating
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 1
    }
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      color: i <= rating ? T.accent : T.rule,
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.star,
    size: 13
  }))));
}

// ── Settings drawer ────────────────────────────────────────────────
function SettingsDrawer({
  open,
  onClose
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose,
    side: "right"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      width: 320,
      height: '100%',
      borderLeft: `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '52px 20px 18px',
      borderBottom: `1px solid ${T.rule}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 24,
      color: T.ink,
      letterSpacing: -0.4,
      fontStyle: 'italic'
    }
  }, "Param\xE8tres"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "bare",
    onClick: onClose,
    "aria-label": "Fermer les param\xE8tres",
    style: {
      width: 32,
      height: 32,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '14px 20px'
    }
  }, /*#__PURE__*/React.createElement(SettingsGroup, {
    label: "Apparence"
  }, /*#__PURE__*/React.createElement(ThemePicker, null)), /*#__PURE__*/React.createElement(SettingsGroup, {
    label: "Profil"
  }, /*#__PURE__*/React.createElement(SettingRow, {
    label: "Poids",
    value: "74 kg"
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Sexe",
    value: "Homme",
    last: true
  })), /*#__PURE__*/React.createElement(SettingsGroup, {
    label: "Donn\xE9es"
  }, /*#__PURE__*/React.createElement(SettingRow, {
    label: "Exporter",
    action: true,
    onClick: () => downloadBackup()
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Importer",
    action: true,
    onClick: async () => {
      const file = await pickBackupFile();
      if (!file) return;
      try {
        await importBackup(file);
      } catch (e) {
        console.warn('[AlcoNote] import failed', e);
        alert('Import échoué : ' + (e.message || 'fichier invalide'));
      }
    }
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Tout effacer",
    action: true,
    danger: true,
    last: true,
    onClick: () => {
      if (!confirm("Supprimer toutes les données locales ? Cette action est irréversible.")) return;
      indexedDB.deleteDatabase('AlcoNoteDB');
      location.reload();
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      textAlign: 'center',
      padding: '24px 0',
      letterSpacing: 0.3
    }
  }, "AlcoNote \xB7 v3.0"))));
}
function ThemePicker() {
  useTheme();
  const current = T._name;
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Apparence",
    style: {
      display: 'flex',
      gap: 0
    }
  }, [['light', 'Clair'], ['dark', 'Sombre']].map(([id, label], i) => /*#__PURE__*/React.createElement("button", {
    key: id,
    type: "button",
    className: "bare",
    role: "radio",
    "aria-checked": current === id,
    "aria-label": `Thème ${label.toLowerCase()}`,
    onClick: () => applyTheme(id),
    style: {
      flex: 1,
      padding: '14px 0',
      textAlign: 'center',
      fontSize: 13,
      background: current === id ? T.accentSoft : 'transparent',
      color: current === id ? T.accent : T.ink2,
      fontWeight: current === id ? 600 : 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRight: i === 0 ? `1px solid ${T.rule}` : 'none',
      letterSpacing: -0.1
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: id === 'light' ? /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
    })) : /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    })),
    size: 15
  }), label)));
}
function SettingsGroup({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: T.muted,
      fontWeight: 500,
      marginBottom: 8,
      padding: '0 4px'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface,
      border: `1px solid ${T.rule}`,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, children));
}
function SettingRow({
  label,
  value,
  action,
  danger,
  last,
  onClick
}) {
  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    padding: '13px 14px',
    borderBottom: last ? 'none' : `1px solid ${T.rule}`
  };
  const inner = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: danger ? T.accent2 : T.ink,
      fontSize: 13.5,
      letterSpacing: -0.1
    }
  }, label), value && /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontSize: 12.5
    }
  }, value), action && !danger && /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chev,
    size: 14,
    color: T.muted
  }));
  if (action) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bare",
      onClick: onClick,
      "aria-label": label,
      style: baseStyle
    }, inner);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: baseStyle
  }, inner);
}
function SheetOverlay({
  children,
  onClose,
  side = 'bottom'
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: T.scrim,
      zIndex: 100,
      display: 'flex',
      alignItems: side === 'bottom' ? 'flex-end' : 'stretch',
      justifyContent: side === 'right' ? 'flex-end' : 'stretch',
      animation: 'fade 0.2s ease'
    }
  }, /*#__PURE__*/React.createElement("style", null, `@keyframes fade { from { opacity: 0 } to { opacity: 1 } }`), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, children));
}
Object.assign(window, {
  AddDrinkSheet,
  ScannerSheet,
  DrinkDetailSheet,
  SettingsDrawer,
  SheetOverlay,
  FieldGroup,
  ImpactStat,
  FactCell,
  Stars
});
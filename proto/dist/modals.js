/* AUTO-GENERATED from proto/modals.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// modals.jsx — Add drink, drink detail, settings drawer, scanner overlay

function _now() {
  const d = new Date();
  return {
    date: localDate(d),
    time: localTime(d)
  };
}

// `inputS` (input base style), `FieldGroup`, `NumberField`, `CategoryChips`,
// `UnitToggle` and `RatingField` now live in shared.jsx (loaded first) and are
// available as globals here — see CLAUDE.md › Form primitives.

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
function AddDrinkSheet({
  open,
  prefill,
  onClose
}) {
  const {
    categories
  } = useCategories();
  const [scan, setScan] = React.useState(false);
  const [name, setName] = React.useState('');
  const [cat, setCat] = React.useState('');
  const [qty, setQty] = React.useState('');
  const [unit, setUnit] = React.useState('cL');
  const [alc, setAlc] = React.useState('');
  const [date, setDate] = React.useState(() => _now().date);
  const [time, setTime] = React.useState(() => _now().time);
  const [rating, setRating] = React.useState(0);
  // Prix de CETTE entrée (string, parsé au submit). `priceIsReference` coché ⇒
  // ce prix devient/maj le prix de référence de la famille (repris par le
  // « + »). Décoché ⇒ prix exceptionnel, la référence ne bouge pas.
  const [price, setPrice] = React.useState('');
  const [priceIsReference, setPriceIsReference] = React.useState(true);
  // `loc` = position attachée à la boisson (objet location | null). `locTouched`
  // distingue « non touché » (→ auto-capture non bloquante à l'ajout, comme
  // avant) de « choisi/retiré explicitement via le champ Lieu » (→ on respecte
  // ce choix et on saute l'auto-capture).
  const [loc, setLoc] = React.useState(null);
  const [locTouched, setLocTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Synchronous re-entry guard: `busy` is applied a render later, so a fast
  // double-tap on Enregistrer would fire `submit` twice and create the same
  // drink twice before the button disables. Mirrors EditCategorySheet.
  const submittingRef = React.useRef(false);

  // Reset on open / prefill changes.
  React.useEffect(() => {
    if (!open) return;
    const n = _now();
    setDate(n.date);
    setTime(n.time);
    setErr('');
    setBusy(false);
    submittingRef.current = false;
    setLoc(null);
    setLocTouched(false);
    if (prefill) {
      // NumberField state stays a string — coerce prefilled numbers so the
      // controlled input never flips number↔string mid-edit.
      setName(prefill.name || '');
      setCat(prefill.category || '');
      setQty(prefill.quantity != null ? String(prefill.quantity) : '');
      setUnit(prefill.unit || 'cL');
      setAlc(prefill.alcohol != null ? String(prefill.alcohol) : prefill.alcoholContent != null ? String(prefill.alcoholContent) : '');
      setRating(prefill.rating || 0);
      setPrice(prefill.referencePrice != null ? String(prefill.referencePrice) : '');
      setPriceIsReference(true);
    } else {
      setName('');
      setQty('');
      setUnit('cL');
      setAlc('');
      setRating(0);
      setCat('');
      setPrice('');
      setPriceIsReference(true);
    }
  }, [open, prefill]);

  // Backfill the category from the loaded categories list as soon as it
  // becomes available (handles the case where the sheet opens before the
  // first useCategories() resolution). Only applied when the user has not
  // chosen one yet.
  React.useEffect(() => {
    if (!open || prefill) return;
    if (!cat && categories.length > 0) setCat(categories[0].name);
  }, [open, prefill, categories, cat]);
  if (!open) return null;

  // parseDecimal accepts a comma OR a dot (see shared.jsx) — `Number()`
  // returned NaN on "5,5" typed with a French keypad.
  const qtyNum = parseDecimal(qty) || 0;
  const alcNum = parseDecimal(alc) || 0;
  // Use the shared toCl so non-canonical units (e.g. "ml" coming from
  // a scanner result) are converted correctly instead of being treated
  // as cL by a local case-sensitive ternary.
  const volCl = toCl(qtyNum, unit);
  const g = +ethanolGrams(volCl, alcNum).toFixed(1);
  const submit = async () => {
    if (submittingRef.current) return;
    setErr('');
    if (!name.trim()) {
      setErr('Le nom de la boisson est requis');
      return;
    }
    if (!cat) {
      setErr('Choisissez une catégorie');
      return;
    }
    if (!qtyNum || qtyNum <= 0) {
      setErr('Quantité invalide');
      return;
    }
    if (alcNum > 100) {
      setErr('Degré d\'alcool invalide (0–100 %)');
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      const drinkName = name.trim();
      const priceNum = parseDecimal(price); // NaN si vide
      const hasPrice = Number.isFinite(priceNum);
      const created = await addDrink({
        name: drinkName,
        category: cat,
        quantity: qtyNum,
        unit,
        alcoholContent: alcNum,
        date,
        time,
        location: locTouched ? loc : null,
        price: hasPrice ? priceNum : null,
        // « Prix habituel » coché ⇒ au prix de référence (suit les cascades) ;
        // décoché ⇒ prix personnalisé (jamais écrasé par un changement de réf.).
        priceIsCustom: hasPrice && !priceIsReference
      });
      if (rating > 0) await saveRating(drinkName, rating);
      // « Prix habituel » coché + valide ⇒ (re)définit la référence de la
      // famille (reprise par le « + »). Décoché ⇒ entrée seule, réf. inchangée.
      if (priceIsReference && hasPrice) {
        await setReferencePrice({
          name: drinkName,
          quantity: qtyNum,
          unit,
          alcohol: alcNum
        }, priceNum);
      }
      Toast.show(`« ${drinkName} » ajoutée`);
      onClose && onClose();
      // Géolocalisation fiable et non bloquante (centralisée dans data.jsx :
      // survit à la fermeture, reverse-geocode borné + retry). Un lieu
      // choisi/retiré explicitement (`locTouched`) est respecté.
      if (!locTouched && created && created.id != null) attachLocationToDrink(created.id);
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de l\'ajout');
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose,
    label: "Nouvelle boisson"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      padding: '10px 0 0',
      maxHeight: '92dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      animation: 'slideUp 0.25s ease',
      overflowX: 'hidden'
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
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 30,
      height: 30,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '0 18px 20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setScan(true),
    "aria-label": "Scanner un code-barres",
    style: {
      ...ghostButton,
      width: '100%',
      textAlign: 'left',
      background: T.isDark ? `linear-gradient(135deg, oklch(30% 0.03 65), ${T.surface})` : `linear-gradient(135deg, ${T.accentSoft}, ${T.surface})`,
      border: `1px solid ${T.rule}`,
      borderRadius: 16,
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      cursor: 'pointer',
      marginBottom: 18,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: 14,
      background: T.accent,
      display: 'grid',
      placeItems: 'center',
      color: T.accentInk,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.scan,
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 14,
      fontWeight: 500,
      letterSpacing: -0.1
    }
  }, "Scanner un code-barres"), /*#__PURE__*/React.createElement("div", {
    style: {
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
    placeholder: "Ex. Pilsner Urquell",
    "aria-label": "Boisson",
    style: inputS()
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Cat\xE9gorie"
  }, /*#__PURE__*/React.createElement(CategoryChips, {
    categories: categories,
    value: cat,
    onChange: setCat
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Quantit\xE9"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: qty,
    onChange: setQty,
    ariaLabel: "Quantit\xE9"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Unit\xE9"
  }, /*#__PURE__*/React.createElement(UnitToggle, {
    value: unit,
    onChange: setUnit
  })))), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Degr\xE9 d'alcool"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: alc,
    onChange: setAlc,
    step: "0.1",
    suffix: "%",
    ariaLabel: "Degr\xE9 d'alcool"
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Prix (optionnel)"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: price,
    onChange: setPrice,
    step: "0.1",
    suffix: "\u20AC",
    ariaLabel: "Prix"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      background: T.surface,
      border: `1px solid ${T.rule}`,
      borderRadius: 12,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(ToggleRow, {
    label: "Prix habituel pour cette boisson",
    sub: "Le \xAB + \xBB et \xAB Ajouter \xE0 nouveau \xBB reprendront ce prix",
    on: priceIsReference,
    onToggle: () => setPriceIsReference(v => !v),
    last: true
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: 10,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Date"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    "aria-label": "Date",
    style: {
      ...inputS(),
      padding: '10px 12px',
      minWidth: 0,
      maxWidth: '100%',
      width: '100%',
      WebkitAppearance: 'none',
      appearance: 'none'
    }
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Heure"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    value: time,
    onChange: e => setTime(e.target.value),
    "aria-label": "Heure",
    style: {
      ...inputS(),
      padding: '10px 12px',
      minWidth: 0,
      maxWidth: '100%',
      width: '100%',
      WebkitAppearance: 'none',
      appearance: 'none'
    }
  }))), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Note (optionnelle)"
  }, /*#__PURE__*/React.createElement(RatingField, {
    value: rating,
    onChange: setRating
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Lieu (optionnel)"
  }, /*#__PURE__*/React.createElement(LocationField, {
    value: loc,
    onChange: v => {
      setLoc(v);
      setLocTouched(true);
    }
  })), /*#__PURE__*/React.createElement("div", {
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
  })), err && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      color: T.accent2,
      background: T.dangerSoftBg,
      border: `1px solid ${T.dangerSoftBorder}`,
      padding: '8px 12px',
      borderRadius: 10,
      fontSize: 12
    }
  }, err)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
      borderTop: `1px solid ${T.rule}`,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      flex: 1,
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      fontSize: 13,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      fontFamily: 'inherit'
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : submit,
    disabled: busy,
    style: {
      flex: 2,
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.accent,
      color: T.accentInk,
      fontSize: 13,
      fontWeight: 600,
      cursor: busy ? 'wait' : 'pointer',
      letterSpacing: 0.1,
      opacity: busy ? 0.5 : 1,
      border: 'none',
      fontFamily: 'inherit',
      boxShadow: `0 4px 18px ${withAlpha(T.accent, 0.4)}`
    }
  }, busy ? 'Enregistrement…' : 'Enregistrer'))), scan && /*#__PURE__*/React.createElement(ScannerSheet, {
    onClose: () => setScan(false),
    onScanned: p => {
      setScan(false);
      if (p) {
        if (p.name) setName(p.name);
        if (p.category) setCat(p.category);
        if (p.alcoholContent !== undefined) setAlc(String(p.alcoholContent));
        if (p.quantity) setQty(String(p.quantity));
        if (p.unit) setUnit(p.unit);
        Toast.show(`« ${p.name || 'Produit'} » détecté`);
      }
    }
  }));
}
// ── Scanner overlay (wraps QuaggaJS via window.cameraScanner) ─────
// Chrome du viseur scanner — délibérément hors thème. Ces couleurs sont posées
// par-dessus le flux vidéo de la caméra (toujours sombre) ; les passer en `T.*`
// rendrait le chrome illisible en mode clair (fond clair sur vidéo). On les
// nomme ici plutôt que de les laisser en littéraux dispersés.
const VIEWFINDER_BG = '#000';
const VIEWFINDER_INK = '#fff';
const VIEWFINDER_HEADER_SCRIM = 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)';
const VIEWFINDER_CLOSE_BG = 'rgba(255,255,255,0.18)';
const VIEWFINDER_MASK = 'rgba(0,0,0,0.45)';
const VIEWFINDER_CHIP_BG = 'rgba(0,0,0,0.5)';
const VIEWFINDER_CHIP_BORDER = 'rgba(255,255,255,0.1)';
function ScannerSheet({
  onClose,
  onScanned
}) {
  const [status, setStatus] = React.useState('scanning');
  const [statusText, setStatusText] = React.useState('Positionnez le code-barres');
  const [foundProduct, setFoundProduct] = React.useState(null);
  const viewportRef = React.useRef(null);
  const startedRef = React.useRef(false);
  // Scanner doesn't use SheetOverlay, so register its own back handler
  // (it layers on top of AddDrinkSheet → Back closes the scanner first).
  useBackButton(true, onClose);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cam = window.cameraScanner;
        if (!cam) {
          setStatusText('Scanner indisponible');
          return;
        }
        cam.onBarcodeConfirmed = async code => {
          if (cancelled) return;
          setStatusText('Recherche du produit…');
          try {
            const lookup = window.productLookup;
            // `lookup` is the public method on ProductLookup; the legacy
            // name `lookupProduct` doesn't exist and used to throw on
            // every scan, surfacing only "Erreur de recherche".
            const product = lookup ? await lookup.lookup(code) : null;
            if (cancelled) return;
            if (product) {
              setStatus('found');
              setStatusText(`${product.name || 'Produit'} détecté`);
              // ProductLookup returns servingQuantity / servingUnit
              // (computed defaults per category) — the legacy form used
              // `quantity`/`unit` which never existed on the result and
              // silently fell back to 33 cL for every scan.
              const norm = {
                name: product.name || '',
                category: product.category || 'Bière',
                alcoholContent: product.alcoholContent || 0,
                quantity: product.servingQuantity || 33,
                unit: product.servingUnit || 'cL',
                barcode: code
              };
              setFoundProduct(norm);
            } else {
              setStatus('found');
              setFoundProduct({
                barcode: code
              });
              setStatusText(`Code ${code} reconnu (sans correspondance)`);
            }
          } catch (e) {
            console.warn('AlcoNote: product lookup failed', e);
            setStatusText('Erreur de recherche');
          }
        };
        cam.onError = () => setStatusText('Caméra indisponible');
        cam.onInactivity = () => setStatusText('Scanner arrêté (inactivité)');
        await cam.start();
        startedRef.current = true;
      } catch (e) {
        setStatusText('Erreur démarrage scanner');
      }
    })();
    return () => {
      cancelled = true;
      try {
        if (window.cameraScanner && startedRef.current) window.cameraScanner.stop();
      } catch {}
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: VIEWFINDER_BG,
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    id: "scanner-viewport",
    ref: viewportRef,
    style: {
      position: 'absolute',
      inset: 0,
      overflow: 'hidden'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: 'calc(50px + env(safe-area-inset-top)) 22px 18px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 2,
      background: VIEWFINDER_HEADER_SCRIM
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: VIEWFINDER_INK,
      fontFamily: fontSerif,
      fontSize: 20,
      fontStyle: 'italic',
      letterSpacing: -0.2
    }
  }, "Scanner"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Fermer le scanner",
    style: {
      width: 36,
      height: 36,
      borderRadius: 99,
      background: VIEWFINDER_CLOSE_BG,
      display: 'grid',
      placeItems: 'center',
      color: VIEWFINDER_INK,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 16
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative',
      display: 'grid',
      placeItems: 'center',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240,
      height: 150,
      position: 'relative',
      border: `1.5px solid ${status === 'found' ? T.good : T.accent}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: `0 0 0 9999px ${VIEWFINDER_MASK}`
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
  })), status === 'scanning' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`,
      animation: 'scanSweep 1.8s ease-in-out infinite alternate',
      boxShadow: `0 0 14px ${T.accent}`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 50,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: VIEWFINDER_INK,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 14px',
      borderRadius: 99,
      background: VIEWFINDER_CHIP_BG,
      backdropFilter: 'blur(8px)',
      border: `1px solid ${VIEWFINDER_CHIP_BORDER}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      background: status === 'found' ? T.good : T.accent,
      boxShadow: `0 0 8px ${status === 'found' ? T.good : T.accent}`
    }
  }), statusText))), status === 'found' && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 22px calc(40px + env(safe-area-inset-bottom))',
      position: 'relative',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onScanned(foundProduct),
    style: {
      width: '100%',
      background: T.accent,
      color: T.accentInk,
      padding: '14px',
      borderRadius: 14,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      border: 'none',
      fontFamily: 'inherit',
      boxShadow: `0 8px 30px ${withAlpha(T.accent, 0.32)}`
    }
  }, "Utiliser ce produit")));
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

// Drink detail sheet - shows family info and entries timeline
// Pastilles posées sur l'en-tête coloré (dégradé `catBg`) de la fiche détail :
// assombrissement volontairement hors thème — un `T.surface` casserait l'effet
// de teinte catégorie. Nommées pour documenter l'intention.
const DETAIL_HEADER_TILE_BG = 'rgba(0,0,0,0.18)';
const DETAIL_HEADER_CLOSE_BG = 'rgba(0,0,0,0.25)';
function DrinkDetailSheet({
  family,
  entry,
  onClose,
  onAddAgain,
  onEdit
}) {
  const ratings = useRatings();
  const {
    categories
  } = useCategories();
  const {
    loading
  } = useDrinks();
  // Inline "move to another category" affordance (applies to the whole
  // family via updateFamily).
  const [moving, setMoving] = React.useState(false);
  // Guards the per-entry trash buttons against a double-tap deleting the
  // same row twice (the second call would throw "Boisson introuvable").
  const deletingRef = React.useRef(false);
  // Read the shared families memo from FamiliesContext instead of
  // rebuilding the grouping locally — `buildFamilies(drinks, ratings)`
  // ran on every bump and produced a brand-new array each time, which
  // forced this sheet through the same recompute that HistoryTab and
  // CategoriesTab were already doing.
  const families = useFamilies();
  // Pin the drink-family identity from props once: we want to keep
  // showing the same family even after a single entry inside it gets
  // deleted (so the timeline updates instead of the sheet closing).
  const seedRef = React.useRef(family || entry && entry.family);
  React.useEffect(() => {
    seedRef.current = family || entry && entry.family || seedRef.current;
  }, [family, entry]);
  // Re-derive the live family from the current drinks list, so deletes
  // and edits propagate without keeping a stale entries[] reference.
  // Fall back to the seed's own entries on initial mount (before the DB
  // load finishes) so the sheet renders the timeline immediately instead
  // of an empty shell.
  const liveFamily = React.useMemo(() => {
    const seed = seedRef.current;
    if (!seed) return null;
    const match = families.find(x => x.id === seed.id) || families.find(x => x.name === seed.name && x.quantity === seed.quantity && (x.unit || '').toLowerCase() === (seed.unit || '').toLowerCase() && (x.alcohol || 0) === (seed.alcohol || 0));
    if (match) return match;
    // No match yet: while drinks are still loading, reuse the seed's
    // entries (they came from the caller's already-loaded list) instead
    // of returning an empty array — otherwise the auto-close below would
    // fire on mount and the sheet would disappear instantly.
    return {
      ...seed,
      entries: seed.entries || []
    };
  }, [families]);
  // Close automatically when the family no longer has any entries — but
  // only once drinks have loaded, so we don't close before the data
  // arrives.
  React.useEffect(() => {
    if (loading) return;
    if (liveFamily && liveFamily.entries && liveFamily.entries.length === 0) {
      onClose && onClose();
    }
  }, [liveFamily, loading, onClose]);
  const f = liveFamily || family || entry && entry.family;
  if (!f) return null;
  const color = catColor(f.category, 70);
  const myRating = ratings[ratingKey(f.name)] ?? f.rating ?? 0;
  const rate = async n => {
    try {
      await saveRating(f.name, n);
      Toast.show('Note enregistrée');
    } catch {}
  };
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose,
    label: "D\xE9tail de la boisson"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      maxHeight: '90dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      overflow: 'hidden',
      animation: 'slideUp 0.25s ease'
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
      background: DETAIL_HEADER_TILE_BG,
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
      lineHeight: 1.1,
      wordBreak: 'break-word'
    }
  }, f.name)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 32,
      height: 32,
      borderRadius: 99,
      background: DETAIL_HEADER_CLOSE_BG,
      display: 'grid',
      placeItems: 'center',
      color: T.ink,
      cursor: 'pointer',
      alignSelf: 'flex-start',
      border: 'none',
      padding: 0,
      fontFamily: 'inherit'
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
    value: toCl(f.quantity, f.unit).toFixed(0)
  }), f.referencePrice != null && /*#__PURE__*/React.createElement(FactCell, {
    label: "Prix",
    value: fmtPrice(f.referencePrice)
  }), /*#__PURE__*/React.createElement(FactCell, {
    label: "Note",
    value: /*#__PURE__*/React.createElement(Stars, {
      n: myRating,
      size: 11,
      interactive: true,
      onChange: rate
    }),
    last: true
  })), myRating > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => rate(0),
    style: {
      ...ghostButton,
      color: T.muted,
      fontSize: 11,
      cursor: 'pointer'
    }
  }, "Effacer la note"))), /*#__PURE__*/React.createElement("div", {
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
    return /*#__PURE__*/React.createElement("div", {
      key: e.id || i,
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
    }, d.getDate(), " ", FR_MONTHS_SHORT[d.getMonth()]), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
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
        gap: 4,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, /*#__PURE__*/React.createElement(SvgIcon, {
      icon: Ic.pin,
      size: 10
    }), " ", e.place)), e.raw && e.raw.price != null && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        fontFamily: fontNum,
        fontSize: 12,
        color: T.ink2
      }
    }, e.raw.priceIsCustom && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: fontSans,
        fontSize: 8.5,
        color: T.muted,
        letterSpacing: 0.3,
        textTransform: 'uppercase'
      }
    }, "perso"), fmtPrice(e.raw.price)), /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": "Supprimer cette entr\xE9e",
      onClick: async () => {
        if (deletingRef.current) return;
        deletingRef.current = true;
        try {
          const row = await deleteDrinkWithSnapshot(e.id);
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
        } finally {
          deletingRef.current = false;
        }
      },
      style: {
        color: T.muted,
        display: 'flex',
        cursor: 'pointer',
        padding: 4,
        background: 'transparent',
        border: 'none'
      }
    }, /*#__PURE__*/React.createElement(SvgIcon, {
      icon: Ic.trash,
      size: 14
    })));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMoving(v => !v),
    "aria-expanded": moving,
    style: {
      ...ghostButton,
      width: '100%',
      padding: '10px 0',
      cursor: 'pointer',
      color: T.ink2,
      fontSize: 12.5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.grid,
    size: 13
  }), " D\xE9placer vers une autre cat\xE9gorie"), moving && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: 12,
      background: T.surface,
      border: `1px solid ${T.rule}`,
      borderRadius: 14
    }
  }, /*#__PURE__*/React.createElement(CategoryChips, {
    categories: categories,
    value: f.category,
    ariaLabel: "D\xE9placer vers la cat\xE9gorie",
    onChange: async nextCat => {
      if (!nextCat || nextCat === f.category) {
        setMoving(false);
        return;
      }
      try {
        await updateFamily(f, {
          category: nextCat
        });
        Toast.show(`Déplacé vers « ${nextCat} »`);
        setMoving(false);
      } catch (err) {
        console.warn('AlcoNote: move family failed', err);
        Toast.show('Erreur lors du déplacement');
      }
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 22px calc(22px + env(safe-area-inset-bottom))',
      borderTop: `1px solid ${T.rule}`,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onEdit && onEdit(f),
    style: {
      flex: 1,
      padding: '12px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      fontSize: 13,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.edit,
    size: 14
  }), " Modifier"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onAddAgain && onAddAgain(f),
    style: {
      flex: 2,
      padding: '12px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.accent,
      color: T.accentInk,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      border: 'none',
      fontFamily: 'inherit',
      boxShadow: `0 4px 18px ${withAlpha(T.accent, 0.4)}`
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.plus,
    size: 14
  }), " Ajouter \xE0 nouveau"))));
}

// Edit a single drink entry — touches `db.drinks[id]` only and does
// NOT cascade to its sibling entries. After save, IndexedDB rebucketing
// happens naturally because `buildFamilies` keys on (name+qty+unit+abv).
function EditEntrySheet({
  entry,
  onClose
}) {
  const {
    categories
  } = useCategories();
  const ratings = useRatings();
  const raw = entry.raw || entry;
  const [name, setName] = React.useState(raw.name || '');
  const [qty, setQty] = React.useState(raw.quantity != null ? String(raw.quantity) : '');
  const [unit, setUnit] = React.useState(raw.unit || 'cL');
  const [alc, setAlc] = React.useState(raw.alcoholContent != null ? String(raw.alcoholContent) : '');
  const [cat, setCat] = React.useState(raw.category || '');
  const [date, setDate] = React.useState(raw.date || _now().date);
  const [time, setTime] = React.useState(raw.time || _now().time);
  // Ratings are keyed by the canonical drink name; editing an entry's
  // rating moves the value to whatever name the user saves under.
  const [rating, setRating] = React.useState(ratings[ratingKey(raw.name)] != null ? ratings[ratingKey(raw.name)] : 0);
  // Lieu de CETTE entrée (par entrée, pas par famille). Rend la position
  // éditable depuis l'Historique : définir / re-localiser / retirer.
  const [loc, setLoc] = React.useState(raw.location || null);
  // Prix de CETTE entrée uniquement (ne touche jamais la référence de famille
  // ni les autres entrées).
  const [price, setPrice] = React.useState(raw.price != null ? String(raw.price) : '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Synchronous re-entry guards (save / delete) — `busy` disables the
  // buttons only a render later, so a fast double-tap would otherwise run
  // the mutation twice (e.g. delete → second call throws "introuvable").
  const savingRef = React.useRef(false);
  const removingRef = React.useRef(false);
  const save = async () => {
    if (savingRef.current || removingRef.current) return;
    setErr('');
    if (!name.trim()) {
      setErr('Le nom est requis');
      return;
    }
    const qtyNum = parseDecimal(qty) || 0;
    if (qtyNum <= 0) {
      setErr('Quantité invalide');
      return;
    }
    if (!cat) {
      setErr('Choisissez une catégorie');
      return;
    }
    if ((parseDecimal(alc) || 0) > 100) {
      setErr('Degré d\'alcool invalide (0–100 %)');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      const finalName = name.trim();
      const priceNum = parseDecimal(price);
      const hasPrice = Number.isFinite(priceNum);
      await updateDrink(raw.id, {
        name: finalName,
        category: cat,
        quantity: qtyNum,
        unit,
        alcoholContent: parseDecimal(alc) || 0,
        date,
        time,
        location: loc,
        price: hasPrice ? priceNum : null,
        // Saisir un prix sur UNE entrée la rend personnalisée (protégée des
        // cascades de prix de référence). Vider le champ la remet « au prix
        // de référence » (price:null, suivra de nouveau la réf.).
        priceIsCustom: hasPrice
      });
      // Renaming the entry only changes this row's name; siblings in
      // the family keep theirs. The old-name rating stays valid as
      // long as ANY drink keeps that name, so we never wipe it here.
      if (rating !== (ratings[ratingKey(finalName)] || 0)) {
        await saveRating(finalName, rating);
      }
      Toast.show('Boisson modifiée');
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur');
    } finally {
      setBusy(false);
      savingRef.current = false;
    }
  };

  // Immediate delete + undo toast. Closing the sheet right away keeps
  // the user on the page they came from instead of navigating elsewhere.
  const remove = async () => {
    if (removingRef.current || savingRef.current) return;
    removingRef.current = true;
    setBusy(true);
    try {
      const row = await deleteDrinkWithSnapshot(raw.id);
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
      onClose && onClose();
    } catch (e) {
      console.warn('AlcoNote: deleteDrinkWithSnapshot failed', e);
      setErr(e && e.message ? e.message : 'Erreur');
    } finally {
      setBusy(false);
      removingRef.current = false;
    }
  };
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose,
    label: "Modifier l'entr\xE9e"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      maxHeight: '92dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      animation: 'slideUp 0.25s ease',
      overflowX: 'hidden'
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
  }, "Modifier l'entr\xE9e"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 30,
      height: 30,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '0 18px 20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Nom"
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    "aria-label": "Nom",
    style: inputS()
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Cat\xE9gorie"
  }, /*#__PURE__*/React.createElement(CategoryChips, {
    categories: categories,
    value: cat,
    onChange: setCat
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Quantit\xE9"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: qty,
    onChange: setQty,
    ariaLabel: "Quantit\xE9"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Unit\xE9"
  }, /*#__PURE__*/React.createElement(UnitToggle, {
    value: unit,
    onChange: setUnit
  })))), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Degr\xE9 d'alcool (%)"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: alc,
    onChange: setAlc,
    step: "0.1",
    ariaLabel: "Degr\xE9 d'alcool"
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Prix de cette entr\xE9e (optionnel)"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: price,
    onChange: setPrice,
    step: "0.1",
    suffix: "\u20AC",
    ariaLabel: "Prix de l'entr\xE9e"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      gap: 10,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Date"
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: date,
    onChange: e => setDate(e.target.value),
    "aria-label": "Date",
    style: {
      ...inputS(),
      padding: '10px 12px',
      minWidth: 0,
      maxWidth: '100%',
      width: '100%',
      WebkitAppearance: 'none',
      appearance: 'none'
    }
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Heure"
  }, /*#__PURE__*/React.createElement("input", {
    type: "time",
    value: time,
    onChange: e => setTime(e.target.value),
    "aria-label": "Heure",
    style: {
      ...inputS(),
      padding: '10px 12px',
      minWidth: 0,
      maxWidth: '100%',
      width: '100%',
      WebkitAppearance: 'none',
      appearance: 'none'
    }
  }))), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Note"
  }, /*#__PURE__*/React.createElement(RatingField, {
    value: rating,
    onChange: setRating
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Lieu"
  }, /*#__PURE__*/React.createElement(LocationField, {
    value: loc,
    onChange: setLoc
  })), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.accent2,
      background: T.dangerSoftBg,
      border: `1px solid ${T.dangerSoftBorder}`,
      padding: '8px 12px',
      borderRadius: 10,
      fontSize: 12,
      marginBottom: 10
    }
  }, err), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : remove,
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 18,
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
  }), "Supprimer cette entr\xE9e")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
      borderTop: `1px solid ${T.rule}`,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      flex: 1,
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      fontSize: 13,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      fontFamily: 'inherit'
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : save,
    disabled: busy,
    style: {
      flex: 2,
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
  }, busy ? 'Enregistrement…' : 'Enregistrer'))));
}

// Edit drink family sheet (rename, change qty/unit/abv across all entries,
// change category, delete all entries). NOTE: no location field here — a
// location is per ENTRY (a family groups entries logged at different places),
// so the place is edited from EditEntrySheet, not at the family level.
function EditFamilySheet({
  family,
  onClose
}) {
  const {
    categories
  } = useCategories();
  const ratings = useRatings();
  const [name, setName] = React.useState(family.name);
  const [qty, setQty] = React.useState(family.quantity != null ? String(family.quantity) : '');
  const [unit, setUnit] = React.useState(family.unit);
  const [alc, setAlc] = React.useState(family.alcohol != null ? String(family.alcohol) : '');
  const [cat, setCat] = React.useState(family.category);
  // Ratings are keyed by the canonical drink name (not per family / per
  // entry), so we seed from the current name's value and persist under
  // whatever name the user ends up saving. Renaming the family migrates
  // the rating to the new key.
  const [rating, setRating] = React.useState(ratings[ratingKey(family.name)] != null ? ratings[ratingKey(family.name)] : family.rating || 0);
  // Prix de référence de la famille (repris par le « + »). `applyToExisting` ⇒
  // au changement, applique aussi le nouveau prix aux boissons EXISTANTES qui
  // sont au prix de référence (les prix personnalisés sont toujours préservés).
  const [refPrice, setRefPrice] = React.useState(family.referencePrice != null ? String(family.referencePrice) : '');
  const [applyToExisting, setApplyToExisting] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  // Synchronous re-entry guards — a fast double-tap would otherwise run
  // updateFamily / deleteFamily twice before `busy` disables the buttons
  // (the second deleteFamily matches nothing → a misleading empty undo).
  const savingRef = React.useRef(false);
  const removingRef = React.useRef(false);
  const save = async () => {
    if (savingRef.current || removingRef.current) return;
    setErr('');
    if (!name.trim()) {
      setErr('Le nom est requis');
      return;
    }
    const qtyNum = parseDecimal(qty) || 0;
    if (qtyNum <= 0) {
      setErr('Quantité invalide');
      return;
    }
    if (!cat) {
      setErr('Choisissez une catégorie');
      return;
    }
    if ((parseDecimal(alc) || 0) > 100) {
      setErr('Degré d\'alcool invalide (0–100 %)');
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      const finalName = name.trim();
      const renamed = finalName !== family.name;
      const abvNum = parseDecimal(alc) || 0;
      const refNum = parseDecimal(refPrice);
      const hasRef = Number.isFinite(refNum);
      // Le prix de référence a-t-il changé ? (null = pas de référence)
      const oldRefVal = family.referencePrice != null ? family.referencePrice : null;
      const newRefVal = hasRef ? refNum : null;
      const refChanged = newRefVal !== oldRefVal;
      // Toggle « Mettre à jour les boissons existantes » activé + prix changé ⇒
      // cascade sur les entrées AU PRIX DE RÉFÉRENCE uniquement (les prix
      // personnalisés sont préservés par `applyReferenceToFamily`). À faire AVANT
      // la cascade d'identité car l'appariement (`sameFamily`) se fait sur
      // l'identité d'origine.
      if (refChanged && applyToExisting) await applyReferenceToFamily(family, newRefVal);
      await updateFamily(family, {
        name: finalName,
        quantity: qtyNum,
        unit,
        alcoholContent: abvNum,
        category: cat
      });
      // La référence vit en settings : (ré)écrite sous la nouvelle identité de
      // famille ; l'ancienne clé est supprimée si l'identité (nom/qté/unité/
      // degré) a changé, pour ne pas l'orpheliner.
      const oldKey = familyPriceKey(family);
      const newLike = {
        name: finalName,
        quantity: qtyNum,
        unit,
        alcohol: abvNum
      };
      await setReferencePrice(newLike, hasRef ? refNum : null);
      if (familyPriceKey(newLike) !== oldKey) await saveSetting(oldKey, null);
      // Migrate the rating to the new key when the family is renamed.
      // We previously zeroed `ratings[family.name]` unconditionally to
      // avoid resurrecting the old rating on a future re-add — but that
      // also clobbered the rating for any *other* family still sharing
      // the old name (e.g. "Pilsner" 25 cL vs "Pilsner" 50 cL). Now we
      // re-fetch the drinks list and only drop the orphan when no
      // sibling family keeps the old name.
      if (rating !== (ratings[ratingKey(finalName)] || 0)) {
        await saveRating(finalName, rating);
      }
      if (renamed && ratings[ratingKey(family.name)] != null) {
        // Default to "still used" so a transient DB error doesn't
        // clobber the rating that a sibling family may still own. We
        // only wipe when we've positively confirmed no drink keeps
        // the old (canonical) name.
        let stillUsed = true;
        try {
          const all = await window.dbManager.getAllDrinks();
          stillUsed = all.some(d => ratingKey(d.name) === ratingKey(family.name));
        } catch (e) {
          console.warn('AlcoNote: orphan-rating check failed, keeping rating', e);
        }
        if (!stillUsed) await saveRating(family.name, 0);
      }
      Toast.show('Boisson mise à jour');
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur');
    } finally {
      setBusy(false);
      savingRef.current = false;
    }
  };

  // Wipe every entry of this family, surface an undo toast that can
  // re-add them all in one batch. Snapshot is captured before deletion
  // by `deleteFamily`, so the undo is fully reversible.
  const delAll = async () => {
    if (removingRef.current || savingRef.current) return;
    removingRef.current = true;
    setBusy(true);
    try {
      const {
        count,
        snapshot
      } = await deleteFamily(family);
      const label = count > 1 ? `${count} entrées supprimées` : 'Boisson supprimée';
      Toast.show(label, {
        undo: async () => {
          try {
            await restoreDrinks(snapshot);
            Toast.show('Suppression annulée');
          } catch (err) {
            console.warn('AlcoNote: restoreDrinks (family) failed', err);
            Toast.show('Erreur lors de l\'annulation');
          }
        }
      });
      onClose && onClose();
    } catch (e) {
      console.warn('AlcoNote: deleteFamily failed', e);
      setErr(e && e.message ? e.message : 'Erreur');
    } finally {
      setBusy(false);
      removingRef.current = false;
    }
  };

  // Impact live du prix de référence, affiché dans le toggle pour expliciter ce
  // qui sera modifié : entrées AU PRIX DE RÉFÉRENCE (mises à jour si le toggle
  // est actif) vs PERSONNALISÉES (toujours préservées). Le « dirty » compare la
  // saisie courante au prix de référence enregistré (même calcul qu'au submit).
  const plur = n => n > 1 ? 's' : '';
  const refPricedCount = family.entries.filter(e => !(e.raw && e.raw.priceIsCustom)).length;
  const customCount = family.entries.length - refPricedCount;
  const liveRefNum = parseDecimal(refPrice);
  const liveNewVal = Number.isFinite(liveRefNum) ? liveRefNum : null;
  const liveOldVal = family.referencePrice != null ? family.referencePrice : null;
  const refDirty = liveNewVal !== liveOldVal;
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose,
    label: "Modifier la boisson"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      maxHeight: '92dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
      animation: 'slideUp 0.25s ease'
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
  }, "Modifier la boisson"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    "aria-label": "Fermer",
    style: {
      width: 30,
      height: 30,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.close,
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'auto',
      padding: '0 18px 20px',
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Nom"
  }, /*#__PURE__*/React.createElement("input", {
    value: name,
    onChange: e => setName(e.target.value),
    "aria-label": "Nom",
    style: inputS()
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Cat\xE9gorie"
  }, /*#__PURE__*/React.createElement(CategoryChips, {
    categories: categories,
    value: cat,
    onChange: setCat
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 1fr',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Quantit\xE9"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: qty,
    onChange: setQty,
    ariaLabel: "Quantit\xE9"
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Unit\xE9"
  }, /*#__PURE__*/React.createElement(UnitToggle, {
    value: unit,
    onChange: setUnit
  }))), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Degr\xE9 d'alcool (%)"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: alc,
    onChange: setAlc,
    step: "0.1",
    ariaLabel: "Degr\xE9 d'alcool"
  })), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Prix de r\xE9f\xE9rence (optionnel)"
  }, /*#__PURE__*/React.createElement(NumberField, {
    value: refPrice,
    onChange: setRefPrice,
    step: "0.1",
    suffix: "\u20AC",
    ariaLabel: "Prix de r\xE9f\xE9rence"
  }), refPricedCount > 0 ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      background: T.surface,
      border: `1px solid ${T.rule}`,
      borderRadius: 12,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(ToggleRow, {
    label: "Mettre \xE0 jour les boissons existantes",
    sub: `${refPricedCount} au prix de référence${customCount > 0 ? ` · ${customCount} personnalisée${plur(customCount)} préservée${plur(customCount)}` : ''}`,
    on: applyToExisting,
    onToggle: () => setApplyToExisting(v => !v),
    last: true
  })), refDirty && applyToExisting && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      color: T.accent,
      fontSize: 11,
      letterSpacing: 0.2
    }
  }, refPricedCount, " boisson", plur(refPricedCount), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: fontNum
    }
  }, "\u2192 ", liveNewVal != null ? fmtPrice(liveNewVal) : 'sans prix'))) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      color: T.muted,
      fontSize: 11,
      lineHeight: 1.4
    }
  }, "Toutes les entr\xE9es ont un prix personnalis\xE9 \u2014 ce prix ne sera repris que par les nouveaux ajouts.")), /*#__PURE__*/React.createElement(FieldGroup, {
    label: "Note"
  }, /*#__PURE__*/React.createElement(RatingField, {
    value: rating,
    onChange: setRating
  })), err && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.accent2,
      background: T.dangerSoftBg,
      border: `1px solid ${T.dangerSoftBorder}`,
      padding: '8px 12px',
      borderRadius: 10,
      fontSize: 12,
      marginBottom: 10
    }
  }, err), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : delAll,
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 18,
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
  }), "Supprimer toutes les entr\xE9es")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
      borderTop: `1px solid ${T.rule}`,
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      flex: 1,
      padding: '14px',
      textAlign: 'center',
      borderRadius: 12,
      background: T.surface2,
      color: T.ink2,
      fontSize: 13,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      fontFamily: 'inherit'
    }
  }, "Annuler"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: busy ? undefined : save,
    disabled: busy,
    style: {
      flex: 2,
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
  }, busy ? 'Enregistrement…' : 'Enregistrer'))));
}
// ── Settings drawer ────────────────────────────────────────────────
function SettingsDrawer({
  open,
  onClose
}) {
  const settings = useSettings();
  const fileInputRef = React.useRef(null);
  // Read the running SW's reported version so the footer always
  // matches the cache actually shipping. Falls back to "—" when no
  // SW is registered (browser preview, file://).
  const swVersion = useSWVersion();
  if (!open) return null;
  const onExport = async () => {
    try {
      const json = await window.dbManager.exportData();
      const blob = new Blob([json], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alconote-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Toast.show('Données exportées');
    } catch (e) {
      Toast.show('Erreur d\'export');
    }
  };
  const onImport = () => fileInputRef.current && fileInputRef.current.click();
  const onFile = async ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      await window.dbManager.importData(text);
      window.dataBus && window.dataBus.bump();
      Toast.show('Données importées');
    } catch (e) {
      Toast.show('Erreur d\'import');
    }
    ev.target.value = '';
  };
  const onClear = async () => {
    const ok = await Confirm.ask({
      title: 'Effacer toutes les données ?',
      message: 'Boissons, catégories, paramètres et records seront définitivement supprimés. Cette action est irréversible.',
      confirmText: 'Tout effacer',
      danger: true
    });
    if (!ok) return;
    try {
      await clearAllData();
      Toast.show('Données effacées');
      onClose && onClose();
    } catch (e) {
      Toast.show('Erreur lors de l\'effacement');
    }
  };
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: onClose,
    side: "left",
    label: "Param\xE8tres"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      width: 'min(360px, 100vw)',
      height: '100%',
      borderRight: `1px solid ${T.rule}`,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideRight 0.22s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'calc(36px + env(safe-area-inset-top)) 20px 18px',
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
    onClick: onClose,
    "aria-label": "Fermer les param\xE8tres",
    style: {
      width: 32,
      height: 32,
      borderRadius: 99,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      fontFamily: 'inherit'
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
  }, /*#__PURE__*/React.createElement(ProfileRow, {
    label: "Poids (kg)",
    numeric: true,
    min: 30,
    max: 200,
    step: 0.5,
    value: settings.userWeight != null ? String(settings.userWeight) : '',
    onSave: v => {
      const n = parseDecimal(v);
      saveSetting('userWeight', v && !isNaN(n) ? n : null);
    }
  }), /*#__PURE__*/React.createElement(GenderPicker, {
    value: settings.userGender || '',
    onChange: v => saveSetting('userGender', v || null),
    last: true
  })), /*#__PURE__*/React.createElement(SettingsGroup, {
    label: "Donn\xE9es"
  }, /*#__PURE__*/React.createElement(SettingRow, {
    label: "Exporter",
    icon: Ic.download,
    onClick: onExport
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Importer",
    icon: Ic.upload,
    onClick: onImport
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Tout effacer",
    danger: true,
    onClick: onClear,
    last: true
  })), /*#__PURE__*/React.createElement(SharingSection, null), /*#__PURE__*/React.createElement("input", {
    ref: fileInputRef,
    type: "file",
    accept: ".json,application/json",
    style: {
      display: 'none'
    },
    onChange: onFile
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 10,
      textAlign: 'center',
      padding: '24px 0',
      letterSpacing: 0.3
    }
  }, "AlcoNote \xB7 ", swVersion || '—'))));
}
function ThemePicker() {
  useTheme();
  const current = T._name;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0
    },
    role: "radiogroup",
    "aria-label": "Th\xE8me"
  }, [['light', 'Clair', Ic.sun], ['dark', 'Sombre', Ic.moon]].map(([id, label, icon], i) => /*#__PURE__*/React.createElement("button", {
    key: id,
    type: "button",
    role: "radio",
    "aria-checked": current === id,
    onClick: () => applyTheme(id),
    style: {
      flex: 1,
      padding: '14px 0',
      textAlign: 'center',
      fontSize: 13,
      cursor: 'pointer',
      background: current === id ? T.accentSoft : 'transparent',
      color: current === id ? T.accent : T.ink2,
      fontWeight: current === id ? 600 : 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderTop: 'none',
      borderLeft: 'none',
      borderBottom: 'none',
      borderRight: i === 0 ? `1px solid ${T.rule}` : 'none',
      letterSpacing: -0.1,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: icon,
    size: 15
  }), label)));
}
function ProfileRow({
  label,
  value,
  onSave,
  last,
  numeric,
  step,
  min,
  max,
  ...inputProps
}) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink,
      fontSize: 13.5,
      letterSpacing: -0.1
    }
  }, label), numeric ?
  /*#__PURE__*/
  // Numeric profile fields (e.g. weight) get the decimal keypad and
  // accept a comma or a dot. Save on blur (the input's blur bubbles).
  React.createElement(NumberField, {
    value: v,
    onChange: setV,
    onBlur: () => onSave(v),
    ariaLabel: label,
    step: step,
    min: min,
    max: max,
    placeholder: "",
    style: {
      width: 80,
      padding: '6px 10px',
      fontSize: 13,
      textAlign: 'right',
      borderRadius: 8
    }
  }) : /*#__PURE__*/React.createElement("input", _extends({
    value: v,
    onChange: e => setV(e.target.value),
    onBlur: () => onSave(v),
    "aria-label": label
  }, inputProps, {
    style: {
      width: 80,
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      borderRadius: 8,
      padding: '6px 10px',
      color: T.ink,
      fontSize: 13,
      fontFamily: fontSans,
      outline: 'none',
      textAlign: 'right'
    }
  })));
}
function GenderPicker({
  value,
  onChange,
  last
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink,
      fontSize: 13.5,
      letterSpacing: -0.1
    }
  }, "Sexe"), /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Sexe",
    style: {
      display: 'flex',
      gap: 4,
      padding: 3,
      background: T.surface2,
      borderRadius: 10,
      border: `1px solid ${T.rule}`
    }
  }, [['', '—'], ['male', 'Homme'], ['female', 'Femme']].map(([k, label]) => /*#__PURE__*/React.createElement("button", {
    key: k || 'none',
    type: "button",
    role: "radio",
    "aria-checked": value === k,
    onClick: () => onChange(k),
    style: {
      padding: '6px 10px',
      borderRadius: 7,
      textAlign: 'center',
      fontSize: 11,
      cursor: 'pointer',
      letterSpacing: -0.1,
      background: value === k ? T.ink : 'transparent',
      color: value === k ? T.bg : T.ink2,
      fontWeight: value === k ? 600 : 400,
      minWidth: 38,
      border: 'none',
      fontFamily: 'inherit'
    }
  }, label))));
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
  icon,
  danger,
  last,
  onClick
}) {
  const Tag = onClick ? 'button' : 'div';
  const extra = onClick ? {
    type: 'button'
  } : {};
  return /*#__PURE__*/React.createElement(Tag, _extends({}, extra, {
    onClick: onClick,
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderTop: 'none',
      borderLeft: 'none',
      borderRight: 'none',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      cursor: onClick ? 'pointer' : 'default',
      gap: 10,
      background: 'transparent',
      fontFamily: 'inherit',
      color: 'inherit',
      textAlign: 'left'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: danger ? T.accent2 : T.ink,
      fontSize: 13.5,
      letterSpacing: -0.1,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, icon && /*#__PURE__*/React.createElement(SvgIcon, {
    icon: icon,
    size: 14,
    color: T.muted
  }), label), value !== undefined ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.muted,
      fontSize: 12.5
    }
  }, value) : !danger && onClick && /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chev,
    size: 14,
    color: T.muted
  }));
}
// Interrupteur (switch) DA pour les options de partage.
function ToggleRow({
  label,
  sub,
  on,
  onToggle,
  last
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.ink,
      fontSize: 13.5,
      letterSpacing: -0.1
    }
  }, label), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 11,
      marginTop: 2,
      lineHeight: 1.4
    }
  }, sub)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "switch",
    "aria-checked": on,
    "aria-label": label,
    onClick: onToggle,
    style: {
      width: 42,
      height: 25,
      borderRadius: 99,
      flexShrink: 0,
      position: 'relative',
      cursor: 'pointer',
      padding: 0,
      fontFamily: 'inherit',
      background: on ? T.accent : T.surface3,
      border: `1px solid ${on ? T.accent : T.rule}`,
      transition: 'background 0.18s ease'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: on ? 19 : 2,
      width: 19,
      height: 19,
      borderRadius: 99,
      background: on ? T.accentInk : T.muted,
      transition: 'left 0.18s ease'
    }
  })));
}

// Section « Partage entre amis » du tiroir Paramètres.
function SharingSection() {
  const s = useShare();
  const recoveryRef = React.useRef(null);
  if (!s.available) return null;
  const onToggleEnabled = async () => {
    if (!s.enabled) {
      const ok = await Confirm.ask({
        title: 'Activer le partage entre amis ?',
        message: "Tes boissons (sans localisation) et tes notes seront partagées avec les membres de ton groupe, qui pourront voir tes statistiques. Désactivable à tout moment.",
        confirmText: 'Activer'
      });
      if (!ok) return;
    }
    await shareEngine.setEnabled(!s.enabled);
  };
  const onToggleBac = async () => {
    if (!s.shareBac) {
      const ok = await Confirm.ask({
        title: 'Partager ton alcoolémie ?',
        message: "Pour estimer ton taux d'alcoolémie en direct chez tes amis, ton poids et ton sexe seront partagés avec ton groupe.",
        confirmText: 'Partager'
      });
      if (!ok) return;
    }
    await shareEngine.setShareBac(!s.shareBac);
  };
  const onCreate = async () => {
    try {
      await shareEngine.createGroup();
      Toast.show('Groupe créé');
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    }
  };
  const onLeave = async () => {
    const ok = await Confirm.ask({
      title: 'Quitter le groupe ?',
      message: 'Tes données partagées seront retirées et tu ne verras plus celles des autres membres.',
      confirmText: 'Quitter',
      danger: true
    });
    if (!ok) return;
    try {
      await shareEngine.leaveGroup();
      Toast.show('Groupe quitté');
    } catch (e) {
      Toast.show(shareErrorMessage(e));
    }
  };
  const onCopyCode = async () => {
    if (!s.inviteCode) return;
    try {
      await navigator.clipboard.writeText(s.inviteCode);
      Toast.show('Code copié');
    } catch (e) {
      Toast.show(s.inviteCode);
    }
  };
  const onExportKey = async () => {
    try {
      const blob = await shareEngine.exportRecovery();
      const b = new Blob([JSON.stringify(blob)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'alconote-cle-recup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Toast.show('Clé de récupération exportée');
    } catch (e) {
      Toast.show('Erreur');
    }
  };
  const onImportKey = () => recoveryRef.current && recoveryRef.current.click();
  const onKeyFile = async ev => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      await shareEngine.importRecovery(JSON.parse(await f.text()));
      Toast.show('Identité restaurée');
    } catch (e) {
      Toast.show('Clé invalide');
    }
    ev.target.value = '';
  };
  const memberCount = (s.members || []).filter(m => m.userId !== s.userId).length;
  return /*#__PURE__*/React.createElement(SettingsGroup, {
    label: "Partage entre amis"
  }, /*#__PURE__*/React.createElement(ToggleRow, {
    label: "Activer le partage",
    sub: "Boissons (sans lieu) + notes",
    on: s.enabled,
    onToggle: onToggleEnabled,
    last: !s.enabled
  }), s.enabled && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ProfileRow, {
    label: "Pseudo",
    value: s.displayName || '',
    onSave: v => shareEngine.setDisplayName(v)
  }), /*#__PURE__*/React.createElement(ToggleRow, {
    label: "Partager mon alcool\xE9mie",
    sub: "Partage poids + sexe (mod\xE8le Widmark)",
    on: s.shareBac,
    onToggle: onToggleBac
  }), !s.groupId ? /*#__PURE__*/React.createElement(SettingRow, {
    label: "Cr\xE9er un groupe",
    icon: Ic.users,
    onClick: onCreate,
    last: true
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SettingRow, {
    label: "Code d'invitation",
    value: s.inviteCode || '—',
    onClick: onCopyCode
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Membres",
    value: String(memberCount)
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Exporter la cl\xE9 de r\xE9cup.",
    icon: Ic.download,
    onClick: onExportKey
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Restaurer une identit\xE9",
    icon: Ic.upload,
    onClick: onImportKey
  }), /*#__PURE__*/React.createElement(SettingRow, {
    label: "Quitter le groupe",
    danger: true,
    onClick: onLeave,
    last: true
  }))), /*#__PURE__*/React.createElement("input", {
    ref: recoveryRef,
    type: "file",
    accept: ".json,application/json",
    style: {
      display: 'none'
    },
    onChange: onKeyFile
  }));
}
Object.assign(window, {
  AddDrinkSheet,
  ScannerSheet,
  DrinkDetailSheet,
  EditFamilySheet,
  EditEntrySheet,
  SettingsDrawer,
  ImpactStat,
  FactCell,
  ThemePicker,
  ProfileRow,
  GenderPicker,
  SettingsGroup,
  SettingRow,
  ToggleRow,
  SharingSection
});
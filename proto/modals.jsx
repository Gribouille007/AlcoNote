// modals.jsx — Add drink, drink detail, settings drawer, scanner overlay

function _now() {
  const d = new Date();
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toTimeString().slice(0, 5),
  };
}

function inputS() {
  return {
    width: '100%', background: T.surface2, border: `1px solid ${T.rule}`,
    borderRadius: 12, padding: '11px 14px', color: T.ink, fontSize: 14,
    fontFamily: fontSans, outline: 'none', letterSpacing: -0.1,
    boxSizing: 'border-box',
  };
}

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
        color: T.muted, fontWeight: 500, marginBottom: 7,
      }}>{label}</div>
      {children}
    </div>
  );
}

function ImpactStat({ big, unit, accent }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: fontSerif, fontSize: 22, color: accent ? T.accent : T.ink,
        letterSpacing: -0.3, lineHeight: 1,
      }}>{big}</div>
      <div style={{
        fontSize: 10, color: T.muted, marginTop: 4, letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}>{unit}</div>
    </div>
  );
}

function AddDrinkSheet({ open, prefill, onClose }) {
  const { categories } = useCategories();
  const [scan, setScan] = React.useState(false);
  const [name, setName] = React.useState('');
  const [cat, setCat] = React.useState('');
  const [qty, setQty] = React.useState('');
  const [unit, setUnit] = React.useState('cL');
  const [alc, setAlc] = React.useState('');
  const [date, setDate] = React.useState(() => _now().date);
  const [time, setTime] = React.useState(() => _now().time);
  const [rating, setRating] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  // Reset on open / prefill changes.
  React.useEffect(() => {
    if (!open) return;
    const n = _now();
    setDate(n.date); setTime(n.time); setErr(''); setBusy(false);
    if (prefill) {
      setName(prefill.name || '');
      setCat(prefill.category || '');
      setQty(prefill.quantity != null ? prefill.quantity : '');
      setUnit(prefill.unit || 'cL');
      setAlc(prefill.alcohol != null ? prefill.alcohol
            : prefill.alcoholContent != null ? prefill.alcoholContent : '');
      setRating(prefill.rating || 0);
    } else {
      setName(''); setQty(''); setUnit('cL'); setAlc(''); setRating(0); setCat('');
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

  const qtyNum = Number(qty) || 0;
  const alcNum = Number(alc) || 0;
  const volCl = unit === 'EcoCup' ? qtyNum * 25 : unit === 'L' ? qtyNum * 100 : qtyNum;
  const g = +(volCl * 10 * (alcNum / 100) * 0.789).toFixed(1);

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Le nom de la boisson est requis'); return; }
    if (!cat) { setErr('Choisissez une catégorie'); return; }
    if (!qtyNum || qtyNum <= 0) { setErr('Quantité invalide'); return; }
    setBusy(true);
    try {
      await addDrink({
        name: name.trim(), category: cat, quantity: qtyNum,
        unit, alcoholContent: alcNum, date, time,
      });
      if (rating > 0) await saveRating(name.trim(), rating);
      Toast.show(`« ${name.trim()} » ajoutée`);
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de l\'ajout');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0', padding: '10px 0 0',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        borderTop: `1px solid ${T.rule}`,
        borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`,
        animation: 'slideUp 0.25s ease',
        overflowX: 'hidden',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 14px',
        }}>
          <div style={{ width: 30 }}/>
          <div style={{
            fontFamily: fontSerif, fontSize: 22, color: T.ink,
            letterSpacing: -0.3, fontStyle: 'italic',
          }}>Nouvelle boisson</div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{
            width: 30, height: 30, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
            border: 'none', padding: 0, fontFamily: 'inherit',
          }}>
            <SvgIcon icon={Ic.close} size={14} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '0 18px 20px', flex: 1 }}>
          <button type="button" onClick={() => setScan(true)} aria-label="Scanner un code-barres" style={{
            ...ghostButton, width: '100%', textAlign: 'left',
            background: T.isDark
              ? `linear-gradient(135deg, oklch(30% 0.03 65), ${T.surface})`
              : `linear-gradient(135deg, ${T.accentSoft}, ${T.surface})`,
            border: `1px solid ${T.rule}`, borderRadius: 16, padding: 16,
            display: 'flex', alignItems: 'center', gap: 14,
            cursor: 'pointer', marginBottom: 18, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: T.accent,
              display: 'grid', placeItems: 'center', color: T.isDark ? T.bg : '#fff', flexShrink: 0,
            }}>
              <SvgIcon icon={Ic.scan} size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: T.ink, fontSize: 14, fontWeight: 500, letterSpacing: -0.1 }}>
                Scanner un code-barres
              </div>
              <div style={{ color: T.muted, fontSize: 11.5, marginTop: 3, letterSpacing: 0.1 }}>
                Remplissage auto depuis OpenFoodFacts
              </div>
            </div>
            <SvgIcon icon={Ic.chev} size={14} color={T.muted} />
          </button>

          <FieldGroup label="Boisson">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Pilsner Urquell" style={inputS()} />
          </FieldGroup>

          <FieldGroup label="Catégorie">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <div key={c.id} onClick={() => setCat(c.name)} style={{
                  padding: '7px 12px', borderRadius: 10, fontSize: 12,
                  border: `1px solid ${cat === c.name ? T.accent : T.rule}`,
                  background: cat === c.name ? T.accentSoft : 'transparent',
                  color: cat === c.name ? T.accent : T.ink2,
                  cursor: 'pointer', letterSpacing: -0.1,
                }}>{c.name}</div>
              ))}
            </div>
          </FieldGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Quantité">
                <input type="number" value={qty}
                  onChange={e => setQty(e.target.value)}
                  inputMode="decimal" placeholder="—" style={inputS()} />
              </FieldGroup>
            </div>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Unité">
                <div style={{
                  display: 'flex', gap: 4, padding: 3,
                  background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}`,
                }}>
                  {['cL', 'L', 'EcoCup'].map(u2 => (
                    <div key={u2} onClick={() => setUnit(u2)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 7, textAlign: 'center',
                      fontSize: 11.5, cursor: 'pointer', letterSpacing: -0.1,
                      background: unit === u2 ? T.ink : 'transparent',
                      color: unit === u2 ? T.bg : T.ink2,
                      fontWeight: unit === u2 ? 600 : 400,
                      minWidth: 0,
                    }}>{u2}</div>
                  ))}
                </div>
              </FieldGroup>
            </div>
          </div>

          <FieldGroup label="Degré d'alcool">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
              padding: '10px 14px',
            }}>
              <input type="number" value={alc} step="0.1" inputMode="decimal"
                placeholder="—"
                onChange={e => setAlc(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: T.ink, fontSize: 15, fontFamily: fontSans, minWidth: 0,
                }}/>
              <span style={{ color: T.muted, fontSize: 13 }}>%</span>
            </div>
          </FieldGroup>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Date">
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputS(), padding: '10px 12px', minWidth: 0, width: '100%' }}/>
              </FieldGroup>
            </div>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Heure">
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  style={{ ...inputS(), padding: '10px 12px', minWidth: 0, width: '100%' }}/>
              </FieldGroup>
            </div>
          </div>

          <FieldGroup label="Note (optionnelle)">
            <div style={{
              background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
              padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <Stars n={rating} interactive size={18} onChange={setRating}/>
              {rating > 0 && (
                <button type="button" onClick={() => setRating(0)} style={{
                  ...ghostButton,
                  color: T.muted, fontSize: 11, cursor: 'pointer',
                }}>Effacer</button>
              )}
            </div>
          </FieldGroup>

          <div style={{
            marginTop: 8, padding: 14, background: T.surface, borderRadius: 14,
            border: `1px solid ${T.rule}`, display: 'flex', justifyContent: 'space-around',
          }}>
            <ImpactStat big={`${volCl} cL`} unit="volume" />
            <ImpactStat big={g + 'g'} unit="alcool pur" accent />
          </div>

          {err && (
            <div style={{
              marginTop: 14,
              color: T.accent2, background: 'oklch(35% 0.10 25 / 0.15)',
              border: '1px solid oklch(45% 0.15 25 / 0.4)',
              padding: '8px 12px', borderRadius: 10, fontSize: 12,
            }}>{err}</div>
          )}
        </div>

        <div style={{
          padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`, fontFamily: 'inherit',
          }}>Annuler</button>
          <button type="button" onClick={busy ? undefined : submit} disabled={busy} style={{
            flex: 2, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.isDark ? T.bg : '#fff', fontSize: 13, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer', letterSpacing: 0.1, opacity: busy ? 0.5 : 1,
            border: 'none', fontFamily: 'inherit',
            boxShadow: `0 4px 18px ${T.accent}60`,
          }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>

      {scan && <ScannerSheet onClose={() => setScan(false)} onScanned={(p) => {
        setScan(false);
        if (p) {
          if (p.name) setName(p.name);
          if (p.category) setCat(p.category);
          if (p.alcoholContent !== undefined) setAlc(p.alcoholContent);
          if (p.quantity) setQty(p.quantity);
          if (p.unit) setUnit(p.unit);
          Toast.show(`« ${p.name || 'Produit'} » détecté`);
        }
      }} />}
    </SheetOverlay>
  );
}
// ── Scanner overlay (wraps QuaggaJS via window.cameraScanner) ─────
function ScannerSheet({ onClose, onScanned }) {
  const [status, setStatus] = React.useState('scanning');
  const [statusText, setStatusText] = React.useState('Positionnez le code-barres');
  const [foundProduct, setFoundProduct] = React.useState(null);
  const viewportRef = React.useRef(null);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cam = window.cameraScanner;
        if (!cam) {
          setStatusText('Scanner indisponible');
          return;
        }
        cam.onBarcodeConfirmed = async (code) => {
          if (cancelled) return;
          setStatusText('Recherche du produit…');
          try {
            const lookup = window.productLookup;
            const product = lookup ? await lookup.lookupProduct(code) : null;
            if (cancelled) return;
            if (product) {
              setStatus('found');
              setStatusText(`${product.name || product.product_name || 'Produit'} détectée`);
              const norm = {
                name: product.name || product.product_name || '',
                category: product.category || 'Bière',
                alcoholContent: product.alcoholContent || product.alcohol || 0,
                quantity: product.quantity || 33,
                unit: product.unit || 'cL',
                barcode: code,
              };
              setFoundProduct(norm);
            } else {
              setStatus('found');
              setFoundProduct({ barcode: code });
              setStatusText(`Code ${code} reconnu (sans correspondance)`);
            }
          } catch (e) {
            setStatusText('Erreur de recherche');
          }
        };
        cam.onError = () => setStatusText('Caméra indisponible');
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      <div id="scanner-viewport" ref={viewportRef} style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
      }}/>

      <div style={{
        position: 'relative', padding: 'calc(50px + env(safe-area-inset-top)) 22px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
      }}>
        <div style={{
          color: '#fff', fontFamily: fontSerif, fontSize: 20, fontStyle: 'italic',
          letterSpacing: -0.2,
        }}>Scanner</div>
        <button type="button" onClick={onClose} aria-label="Fermer le scanner" style={{
          width: 36, height: 36, borderRadius: 99,
          background: 'rgba(255,255,255,0.18)', display: 'grid', placeItems: 'center',
          color: '#fff', cursor: 'pointer',
          border: 'none', padding: 0, fontFamily: 'inherit',
        }}><SvgIcon icon={Ic.close} size={16} /></button>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center', zIndex: 2 }}>
        <div style={{
          width: 240, height: 150, position: 'relative',
          border: `1.5px solid ${status === 'found' ? T.good : T.accent}`,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)`,
        }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              position: 'absolute', width: 22, height: 22,
              borderColor: status === 'found' ? T.good : T.accent,
              borderStyle: 'solid', borderWidth: 0,
              top: i < 2 ? -1 : 'auto', bottom: i >= 2 ? -1 : 'auto',
              left: i % 2 === 0 ? -1 : 'auto', right: i % 2 === 1 ? -1 : 'auto',
              borderTopWidth: i < 2 ? 3 : 0,
              borderBottomWidth: i >= 2 ? 3 : 0,
              borderLeftWidth: i % 2 === 0 ? 3 : 0,
              borderRightWidth: i % 2 === 1 ? 3 : 0,
            }}/>
          ))}
          {status === 'scanning' && (
            <>
              <style>{`@keyframes sl { 0%{top:0} 100%{top:100%} }`}</style>
              <div style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`,
                animation: 'sl 1.8s ease-in-out infinite alternate',
                boxShadow: `0 0 14px ${T.accent}`,
              }}/>
            </>
          )}
        </div>

        <div style={{
          position: 'absolute', bottom: 50, left: 0, right: 0, textAlign: 'center',
          color: '#fff', fontSize: 13,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 99,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            border: `1px solid rgba(255,255,255,0.1)`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: 99,
              background: status === 'found' ? T.good : T.accent,
              boxShadow: `0 0 8px ${status === 'found' ? T.good : T.accent}`,
            }}/>
            {statusText}
          </div>
        </div>
      </div>

      {status === 'found' && (
        <div style={{
          padding: '0 22px calc(40px + env(safe-area-inset-bottom))',
          position: 'relative', zIndex: 2,
        }}>
          <button type="button" onClick={() => onScanned(foundProduct)} style={{
            width: '100%',
            background: T.accent, color: T.isDark ? T.bg : '#fff',
            padding: '15px', borderRadius: 14,
            textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            border: 'none', fontFamily: 'inherit',
            boxShadow: `0 8px 30px ${T.accent}50`,
          }}>Utiliser ce produit</button>
        </div>
      )}
    </div>
  );
}
function FactCell({ label, value, last }) {
  return (
    <div style={{
      flex: 1, padding: '0 6px', borderRight: last ? 'none' : `1px solid ${T.rule}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
        color: T.muted, fontWeight: 500, marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: fontSerif, fontSize: 17, color: T.ink, letterSpacing: -0.2,
        display: 'flex', justifyContent: 'center',
      }}>{value}</div>
    </div>
  );
}

// Drink detail sheet - shows family info and entries timeline
function DrinkDetailSheet({ family, entry, onClose, onAddAgain, onEdit }) {
  const ratings = useRatings();
  const { drinks } = useDrinks();
  // Pin the drink-family identity from props once: we want to keep
  // showing the same family even after a single entry inside it gets
  // deleted (so the timeline updates instead of the sheet closing).
  const seedRef = React.useRef(family || (entry && entry.family));
  React.useEffect(() => {
    seedRef.current = family || (entry && entry.family) || seedRef.current;
  }, [family, entry]);
  // Re-derive the live family from the current drinks list, so deletes
  // and edits propagate without keeping a stale entries[] reference.
  const liveFamily = React.useMemo(() => {
    const seed = seedRef.current;
    if (!seed) return null;
    const fams = buildFamilies(drinks, ratings);
    const match = fams.find(x => x.id === seed.id) ||
                  fams.find(x =>
                    x.name === seed.name &&
                    x.quantity === seed.quantity &&
                    (x.unit || '').toLowerCase() === (seed.unit || '').toLowerCase() &&
                    (x.alcohol || 0) === (seed.alcohol || 0));
    return match || { ...seed, entries: [] };
  }, [drinks, ratings]);
  // Close automatically when the family no longer has any entries.
  React.useEffect(() => {
    if (liveFamily && liveFamily.entries && liveFamily.entries.length === 0) {
      onClose && onClose();
    }
  }, [liveFamily, onClose]);
  const f = liveFamily || family || (entry && entry.family);
  if (!f) return null;
  const color = catColor(f.category, 70);
  const myRating = ratings[f.name] ?? f.rating ?? 0;

  const rate = async (n) => {
    try { await saveRating(f.name, n); Toast.show('Note enregistrée'); } catch {}
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0',
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
        borderTop: `1px solid ${T.rule}`,
        borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`,
        overflow: 'hidden',
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>

        <div style={{
          padding: '20px 22px 22px',
          background: `linear-gradient(160deg, ${catBg(f.category)}, transparent 90%)`,
          borderBottom: `1px solid ${T.rule}`, position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 16, background: 'rgba(0,0,0,0.18)',
              display: 'grid', placeItems: 'center', color, flexShrink: 0,
              border: `1px solid ${T.rule}`,
            }}>
              <CategoryGlyph name={f.category} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase',
                color, fontWeight: 500, marginBottom: 4,
              }}>{f.category}</div>
              <div style={{
                fontFamily: fontSerif, fontSize: 24, color: T.ink,
                letterSpacing: -0.4, lineHeight: 1.1,
                wordBreak: 'break-word',
              }}>{f.name}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer" style={{
              width: 32, height: 32, borderRadius: 99, background: 'rgba(0,0,0,0.25)',
              display: 'grid', placeItems: 'center', color: T.ink, cursor: 'pointer',
              alignSelf: 'flex-start',
              border: 'none', padding: 0, fontFamily: 'inherit',
            }}><SvgIcon icon={Ic.close} size={14} /></button>
          </div>

          <div style={{ display: 'flex', gap: 0, marginTop: 18 }}>
            <FactCell label="Quantité" value={`${f.quantity} ${f.unit}`} />
            <FactCell label="Alcool" value={`${f.alcohol}°`} />
            <FactCell label="cL" value={toCl(f.quantity, f.unit).toFixed(0)} />
            <FactCell label="Note" value={<Stars n={myRating} size={11} interactive onChange={rate}/>} last />
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: '16px 22px 20px', flex: 1 }}>
          <div style={{
            color: T.muted, fontSize: 10.5, letterSpacing: 1.4,
            textTransform: 'uppercase', fontWeight: 500, marginBottom: 10,
          }}>Historique · {f.entries.length} entrée{f.entries.length !== 1 ? 's' : ''}</div>

          <div style={{
            background: T.surface, borderRadius: 14, border: `1px solid ${T.rule}`, overflow: 'hidden',
          }}>
            {f.entries.map((e, i) => {
              const d = new Date(e.ts);
              return (
                <div key={e.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderBottom: i === f.entries.length - 1 ? 'none' : `1px solid ${T.rule}`,
                }}>
                  <div style={{
                    fontFamily: fontSerif, fontSize: 14, color: T.ink2,
                    fontStyle: 'italic', width: 60, flexShrink: 0,
                  }}>{d.getDate()} {FR_MONTHS_SHORT[d.getMonth()]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: fontNum, fontSize: 13, color: T.ink, fontWeight: 500,
                    }}>{e.ts.slice(11, 16)}</div>
                    {e.place && (
                      <div style={{
                        color: T.muted, fontSize: 11, marginTop: 2,
                        display: 'flex', alignItems: 'center', gap: 4,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        <SvgIcon icon={Ic.pin} size={10} /> {e.place}
                      </div>
                    )}
                  </div>
                  <button type="button" aria-label="Supprimer cette entrée"
                    onClick={async () => {
                      const ok = await Confirm.ask({
                        title: 'Supprimer cette entrée ?',
                        message: `Cette consommation du ${d.getDate()} ${FR_MONTHS_SHORT[d.getMonth()]} sera retirée de votre historique.`,
                        confirmText: 'Supprimer',
                        danger: true,
                      });
                      if (!ok) return;
                      try { await deleteDrink(e.id); Toast.show('Entrée supprimée'); }
                      catch (err) { Toast.show('Erreur'); }
                    }} style={{
                      color: T.muted, display: 'flex', cursor: 'pointer',
                      padding: 4, background: 'transparent', border: 'none',
                    }}>
                    <SvgIcon icon={Ic.trash} size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          padding: '12px 22px calc(22px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${T.rule}`,
          display: 'flex', gap: 10,
        }}>
          <button type="button" onClick={() => onEdit && onEdit(f)} style={{
            flex: 1, padding: '13px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6, fontFamily: 'inherit',
          }}>
            <SvgIcon icon={Ic.edit} size={14} /> Modifier
          </button>
          <button type="button" onClick={() => onAddAgain && onAddAgain(f)} style={{
            flex: 2, padding: '13px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.isDark ? T.bg : '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
            border: 'none', fontFamily: 'inherit',
            boxShadow: `0 4px 18px ${T.accent}60`,
          }}>
            <SvgIcon icon={Ic.plus} size={14} /> Ajouter à nouveau
          </button>
        </div>
      </div>
    </SheetOverlay>
  );
}

// Edit a single drink entry — touches `db.drinks[id]` only and does
// NOT cascade to its sibling entries. After save, IndexedDB rebucketing
// happens naturally because `buildFamilies` keys on (name+qty+unit+abv).
function EditEntrySheet({ entry, onClose }) {
  const { categories } = useCategories();
  const raw = entry.raw || entry;
  const [name, setName] = React.useState(raw.name || '');
  const [qty, setQty] = React.useState(raw.quantity != null ? raw.quantity : '');
  const [unit, setUnit] = React.useState(raw.unit || 'cL');
  const [alc, setAlc] = React.useState(raw.alcoholContent != null ? raw.alcoholContent : '');
  const [cat, setCat] = React.useState(raw.category || '');
  const [date, setDate] = React.useState(raw.date || _now().date);
  const [time, setTime] = React.useState(raw.time || _now().time);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const save = async () => {
    setErr('');
    if (!name.trim()) { setErr('Le nom est requis'); return; }
    const qtyNum = Number(qty) || 0;
    if (qtyNum <= 0) { setErr('Quantité invalide'); return; }
    setBusy(true);
    try {
      await updateDrink(raw.id, {
        name: name.trim(),
        category: cat,
        quantity: qtyNum,
        unit,
        alcoholContent: Number(alc) || 0,
        date,
        time,
      });
      Toast.show('Boisson modifiée');
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    const ok = await Confirm.ask({
      title: 'Supprimer cette entrée ?',
      message: 'Cette consommation sera retirée de votre historique.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteDrink(raw.id);
      Toast.show('Entrée supprimée');
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur');
    } finally { setBusy(false); }
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        borderTop: `1px solid ${T.rule}`,
        borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`,
        animation: 'slideUp 0.25s ease',
        overflowX: 'hidden',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 14px',
        }}>
          <div style={{ width: 30 }}/>
          <div style={{
            fontFamily: fontSerif, fontSize: 22, color: T.ink,
            letterSpacing: -0.3, fontStyle: 'italic',
          }}>Modifier l'entrée</div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{
            width: 30, height: 30, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
            border: 'none', padding: 0, fontFamily: 'inherit',
          }}><SvgIcon icon={Ic.close} size={14} /></button>
        </div>
        <div style={{ overflowY: 'auto', overflowX: 'hidden', padding: '0 18px 20px', flex: 1 }}>
          <FieldGroup label="Nom"><input value={name} onChange={e => setName(e.target.value)} style={inputS()} /></FieldGroup>
          <FieldGroup label="Catégorie">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <div key={c.id} onClick={() => setCat(c.name)} style={{
                  padding: '7px 12px', borderRadius: 10, fontSize: 12,
                  border: `1px solid ${cat === c.name ? T.accent : T.rule}`,
                  background: cat === c.name ? T.accentSoft : 'transparent',
                  color: cat === c.name ? T.accent : T.ink2,
                  cursor: 'pointer', letterSpacing: -0.1,
                }}>{c.name}</div>
              ))}
            </div>
          </FieldGroup>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Quantité">
                <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                  inputMode="decimal" placeholder="—" style={inputS()} />
              </FieldGroup>
            </div>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Unité">
                <div style={{
                  display: 'flex', gap: 4, padding: 3,
                  background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}`,
                }}>
                  {['cL', 'L', 'EcoCup'].map(u2 => (
                    <div key={u2} onClick={() => setUnit(u2)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 7, textAlign: 'center',
                      fontSize: 11.5, cursor: 'pointer', letterSpacing: -0.1,
                      background: unit === u2 ? T.ink : 'transparent',
                      color: unit === u2 ? T.bg : T.ink2,
                      fontWeight: unit === u2 ? 600 : 400, minWidth: 0,
                    }}>{u2}</div>
                  ))}
                </div>
              </FieldGroup>
            </div>
          </div>
          <FieldGroup label="Degré d'alcool (%)">
            <input type="number" value={alc} step="0.1" inputMode="decimal"
              placeholder="—"
              onChange={e => setAlc(e.target.value)} style={inputS()} />
          </FieldGroup>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Date">
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputS(), padding: '10px 12px', minWidth: 0, width: '100%' }}/>
              </FieldGroup>
            </div>
            <div style={{ minWidth: 0 }}>
              <FieldGroup label="Heure">
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  style={{ ...inputS(), padding: '10px 12px', minWidth: 0, width: '100%' }}/>
              </FieldGroup>
            </div>
          </div>

          {err && (
            <div style={{
              color: T.accent2, background: 'oklch(35% 0.10 25 / 0.15)',
              border: '1px solid oklch(45% 0.15 25 / 0.4)',
              padding: '8px 12px', borderRadius: 10, fontSize: 12, marginBottom: 10,
            }}>{err}</div>
          )}

          <button type="button" onClick={remove} style={{
            width: '100%',
            marginTop: 18, padding: '12px', textAlign: 'center', borderRadius: 12,
            background: 'oklch(35% 0.10 25 / 0.15)',
            color: T.accent2,
            border: '1px solid oklch(45% 0.15 25 / 0.4)',
            fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'inherit',
          }}>
            <SvgIcon icon={Ic.trash} size={13} />
            Supprimer cette entrée
          </button>
        </div>
        <div style={{
          padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`, fontFamily: 'inherit',
          }}>Annuler</button>
          <button type="button" onClick={busy ? undefined : save} disabled={busy} style={{
            flex: 2, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.isDark ? T.bg : '#fff', fontSize: 13, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
            border: 'none', fontFamily: 'inherit',
            boxShadow: `0 4px 18px ${T.accent}60`,
          }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </SheetOverlay>
  );
}

// Edit drink family sheet (rename, change qty/unit/abv across all entries,
// change category, delete all entries)
function EditFamilySheet({ family, onClose }) {
  const { categories } = useCategories();
  const [name, setName] = React.useState(family.name);
  const [qty, setQty] = React.useState(family.quantity);
  const [unit, setUnit] = React.useState(family.unit);
  const [alc, setAlc] = React.useState(family.alcohol);
  const [cat, setCat] = React.useState(family.category);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  const save = async () => {
    if (!name.trim()) { setErr('Le nom est requis'); return; }
    setBusy(true);
    try {
      await updateFamily(family, {
        name: name.trim(),
        quantity: Number(qty) || 0,
        unit,
        alcoholContent: Number(alc) || 0,
        category: cat,
      });
      Toast.show('Boisson mise à jour');
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur');
    } finally { setBusy(false); }
  };

  const delAll = async () => {
    const ok = await Confirm.ask({
      title: 'Supprimer toutes les entrées ?',
      message: `Toutes les consommations de « ${family.name} » seront effacées de votre historique. Cette action est irréversible.`,
      confirmText: 'Tout supprimer',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteFamily(family);
      Toast.show('Boisson supprimée');
      onClose && onClose();
    } catch (e) { setErr(e && e.message ? e.message : 'Erreur'); }
    finally { setBusy(false); }
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0',
        maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
        borderTop: `1px solid ${T.rule}`,
        borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`,
        animation: 'slideUp 0.25s ease',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 14px',
        }}>
          <div style={{ width: 30 }}/>
          <div style={{
            fontFamily: fontSerif, fontSize: 22, color: T.ink,
            letterSpacing: -0.3, fontStyle: 'italic',
          }}>Modifier la boisson</div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{
            width: 30, height: 30, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
            border: 'none', padding: 0, fontFamily: 'inherit',
          }}><SvgIcon icon={Ic.close} size={14} /></button>
        </div>
        <div style={{ overflow: 'auto', padding: '0 18px 20px', flex: 1 }}>
          <FieldGroup label="Nom"><input value={name} onChange={e => setName(e.target.value)} style={inputS()} /></FieldGroup>
          <FieldGroup label="Catégorie">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <div key={c.id} onClick={() => setCat(c.name)} style={{
                  padding: '7px 12px', borderRadius: 10, fontSize: 12,
                  border: `1px solid ${cat === c.name ? T.accent : T.rule}`,
                  background: cat === c.name ? T.accentSoft : 'transparent',
                  color: cat === c.name ? T.accent : T.ink2,
                  cursor: 'pointer', letterSpacing: -0.1,
                }}>{c.name}</div>
              ))}
            </div>
          </FieldGroup>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
            <FieldGroup label="Quantité">
              <input type="number" value={qty} onChange={e => setQty(+e.target.value || 0)} style={inputS()} />
            </FieldGroup>
            <FieldGroup label="Unité">
              <div style={{
                display: 'flex', gap: 4, padding: 3,
                background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}`,
              }}>
                {['cL', 'L', 'EcoCup'].map(u2 => (
                  <div key={u2} onClick={() => setUnit(u2)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 7, textAlign: 'center',
                    fontSize: 11.5, cursor: 'pointer', letterSpacing: -0.1,
                    background: unit === u2 ? T.ink : 'transparent',
                    color: unit === u2 ? T.bg : T.ink2,
                    fontWeight: unit === u2 ? 600 : 400,
                  }}>{u2}</div>
                ))}
              </div>
            </FieldGroup>
          </div>
          <FieldGroup label="Degré d'alcool (%)">
            <input type="number" value={alc} step="0.1" onChange={e => setAlc(+e.target.value || 0)} style={inputS()} />
          </FieldGroup>

          {err && (
            <div style={{
              color: T.accent2, background: 'oklch(35% 0.10 25 / 0.15)',
              border: '1px solid oklch(45% 0.15 25 / 0.4)',
              padding: '8px 12px', borderRadius: 10, fontSize: 12, marginBottom: 10,
            }}>{err}</div>
          )}

          <button type="button" onClick={delAll} style={{
            width: '100%',
            marginTop: 18, padding: '12px', textAlign: 'center', borderRadius: 12,
            background: 'oklch(35% 0.10 25 / 0.15)',
            color: T.accent2,
            border: '1px solid oklch(45% 0.15 25 / 0.4)',
            fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'inherit',
          }}>
            <SvgIcon icon={Ic.trash} size={13} />
            Supprimer toutes les entrées
          </button>
        </div>
        <div style={{
          padding: '12px 18px calc(22px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${T.rule}`, display: 'flex', gap: 10,
        }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`, fontFamily: 'inherit',
          }}>Annuler</button>
          <button type="button" onClick={busy ? undefined : save} disabled={busy} style={{
            flex: 2, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.isDark ? T.bg : '#fff', fontSize: 13, fontWeight: 600,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.5 : 1,
            border: 'none', fontFamily: 'inherit',
            boxShadow: `0 4px 18px ${T.accent}60`,
          }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </SheetOverlay>
  );
}
// ── Settings drawer ────────────────────────────────────────────────
function SettingsDrawer({ open, onClose }) {
  const settings = useSettings();
  const fileInputRef = React.useRef(null);

  if (!open) return null;

  const onExport = async () => {
    try {
      const json = await window.dbManager.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alconote-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      Toast.show('Données exportées');
    } catch (e) { Toast.show('Erreur d\'export'); }
  };

  const onImport = () => fileInputRef.current && fileInputRef.current.click();
  const onFile = async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      await window.dbManager.importData(text);
      window.dataBus && window.dataBus.bump();
      Toast.show('Données importées');
    } catch (e) { Toast.show('Erreur d\'import'); }
    ev.target.value = '';
  };

  const onClear = async () => {
    const ok = await Confirm.ask({
      title: 'Effacer toutes les données ?',
      message: 'Boissons, catégories, paramètres et records seront définitivement supprimés. Cette action est irréversible.',
      confirmText: 'Tout effacer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.dbManager.clearAllData();
      window.dataBus && window.dataBus.bump();
      Toast.show('Données effacées');
      onClose && onClose();
    } catch (e) { Toast.show('Erreur'); }
  };

  return (
    <SheetOverlay onClose={onClose} side="left">
      <div style={{
        background: T.bg, width: 'min(360px, 100vw)', height: '100%',
        borderRight: `1px solid ${T.rule}`,
        display: 'flex', flexDirection: 'column',
        animation: 'slideRight 0.22s ease',
      }}>
        <div style={{
          padding: 'calc(36px + env(safe-area-inset-top)) 20px 18px',
          borderBottom: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: fontSerif, fontSize: 24, color: T.ink,
            letterSpacing: -0.4, fontStyle: 'italic',
          }}>Paramètres</div>
          <button type="button" onClick={onClose} aria-label="Fermer les paramètres" style={{
            width: 32, height: 32, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
            border: 'none', padding: 0, fontFamily: 'inherit',
          }}><SvgIcon icon={Ic.close} size={14} /></button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px' }}>
          <SettingsGroup label="Apparence">
            <ThemePicker />
          </SettingsGroup>

          <SettingsGroup label="Profil">
            <ProfileRow label="Poids (kg)" type="number" min={30} max={200} step={0.5}
              value={settings.userWeight || ''} onSave={(v) => saveSetting('userWeight', v ? Number(v) : null)} />
            <GenderPicker value={settings.userGender || ''} onChange={(v) => saveSetting('userGender', v || null)} last />
          </SettingsGroup>

          <SettingsGroup label="Données">
            <SettingRow label="Exporter" icon={Ic.download} onClick={onExport} />
            <SettingRow label="Importer" icon={Ic.upload} onClick={onImport} />
            <SettingRow label="Tout effacer" danger onClick={onClear} last />
          </SettingsGroup>

          <input ref={fileInputRef} type="file" accept=".json,application/json"
            style={{ display: 'none' }} onChange={onFile}/>

          <div style={{
            color: T.muted, fontSize: 10, textAlign: 'center',
            padding: '24px 0', letterSpacing: 0.3,
          }}>AlcoNote · v3.0</div>
        </div>
      </div>
    </SheetOverlay>
  );
}

function ThemePicker() {
  useTheme();
  const current = T._name;
  return (
    <div style={{ display: 'flex', gap: 0 }} role="radiogroup" aria-label="Thème">
      {[['light', 'Clair', Ic.sun], ['dark', 'Sombre', Ic.moon]].map(([id, label, icon], i) => (
        <button key={id} type="button" role="radio" aria-checked={current === id}
          onClick={() => applyTheme(id)} style={{
            flex: 1, padding: '14px 0', textAlign: 'center',
            fontSize: 13, cursor: 'pointer',
            background: current === id ? T.accentSoft : 'transparent',
            color: current === id ? T.accent : T.ink2,
            fontWeight: current === id ? 600 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
            borderRight: i === 0 ? `1px solid ${T.rule}` : 'none',
            letterSpacing: -0.1, fontFamily: 'inherit',
          }}>
          <SvgIcon icon={icon} size={15} />
          {label}
        </button>
      ))}
    </div>
  );
}

function ProfileRow({ label, value, onSave, last, ...inputProps }) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => setV(value), [value]);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      gap: 10,
    }}>
      <span style={{ color: T.ink, fontSize: 13.5, letterSpacing: -0.1 }}>{label}</span>
      <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)}
        {...inputProps}
        style={{
          width: 80, background: T.surface2, border: `1px solid ${T.rule}`,
          borderRadius: 8, padding: '6px 10px', color: T.ink, fontSize: 13,
          fontFamily: fontSans, outline: 'none', textAlign: 'right',
        }}/>
    </div>
  );
}

function GenderPicker({ value, onChange, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      gap: 10,
    }}>
      <span style={{ color: T.ink, fontSize: 13.5, letterSpacing: -0.1 }}>Sexe</span>
      <div role="radiogroup" aria-label="Sexe" style={{
        display: 'flex', gap: 4, padding: 3,
        background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}`,
      }}>
        {[['', '—'], ['male', 'Homme'], ['female', 'Femme']].map(([k, label]) => (
          <button key={k || 'none'} type="button" role="radio" aria-checked={value === k}
            onClick={() => onChange(k)} style={{
              padding: '6px 10px', borderRadius: 7, textAlign: 'center',
              fontSize: 11, cursor: 'pointer', letterSpacing: -0.1,
              background: value === k ? T.ink : 'transparent',
              color: value === k ? T.bg : T.ink2,
              fontWeight: value === k ? 600 : 400, minWidth: 38,
              border: 'none', fontFamily: 'inherit',
            }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function SettingsGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase',
        color: T.muted, fontWeight: 500, marginBottom: 8, padding: '0 4px',
      }}>{label}</div>
      <div style={{
        background: T.surface, border: `1px solid ${T.rule}`, borderRadius: 14,
        overflow: 'hidden',
      }}>{children}</div>
    </div>
  );
}

function SettingRow({ label, value, icon, danger, last, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  const extra = onClick ? { type: 'button' } : {};
  return (
    <Tag {...extra} onClick={onClick} style={{
      width: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 14px',
      borderTop: 'none', borderLeft: 'none', borderRight: 'none',
      borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      cursor: onClick ? 'pointer' : 'default', gap: 10,
      background: 'transparent', fontFamily: 'inherit',
      color: 'inherit', textAlign: 'left',
    }}>
      <span style={{
        color: danger ? T.accent2 : T.ink, fontSize: 13.5, letterSpacing: -0.1,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {icon && <SvgIcon icon={icon} size={14} color={T.muted}/>}
        {label}
      </span>
      {value !== undefined ? <span style={{ color: T.muted, fontSize: 12.5 }}>{value}</span>
        : (!danger && onClick) && <SvgIcon icon={Ic.chev} size={14} color={T.muted} />}
    </Tag>
  );
}
Object.assign(window, {
  AddDrinkSheet, ScannerSheet, DrinkDetailSheet, EditFamilySheet, EditEntrySheet,
  SettingsDrawer, FieldGroup, ImpactStat, FactCell,
  ThemePicker, ProfileRow, GenderPicker, SettingsGroup, SettingRow,
});

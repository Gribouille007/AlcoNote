// modals.jsx — Add drink modal + drink detail sheet + settings drawer + scanner

function AddDrinkSheet({ open, prefill, onClose }) {
  const [scan, setScan] = React.useState(false);
  const [name, setName] = React.useState('Pilsner Urquell');
  const [cat, setCat] = React.useState('Bière');
  const [qty, setQty] = React.useState(33);
  const [unit, setUnit] = React.useState('cL');
  const [alc, setAlc] = React.useState(4.4);

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

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0', padding: '10px 0 0',
        maxHeight: '92%', display: 'flex', flexDirection: 'column',
        border: `1px solid ${T.rule}`, borderBottom: 'none',
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
          <div onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
          }}>
            <SvgIcon icon={Ic.close} size={14} />
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: '0 18px 20px' }}>
          {/* Scanner CTA */}
          <div onClick={() => setScan(true)} style={{
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
          </div>

          {/* Name */}
          <FieldGroup label="Boisson">
            <input value={name} onChange={e => setName(e.target.value)}
              style={inputS()} />
          </FieldGroup>

          {/* Category */}
          <FieldGroup label="Catégorie">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
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

          {/* Quantity + unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10 }}>
            <FieldGroup label="Quantité">
              <input type="number" value={qty} onChange={e => setQty(+e.target.value || 0)} style={inputS()} />
            </FieldGroup>
            <FieldGroup label="Unité">
              <div style={{ display: 'flex', gap: 4, padding: 3,
                background: T.surface2, borderRadius: 10, border: `1px solid ${T.rule}` }}>
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

          {/* Alcohol */}
          <FieldGroup label="Degré d'alcool">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: T.surface2, border: `1px solid ${T.rule}`, borderRadius: 12,
              padding: '10px 14px',
            }}>
              <input type="number" value={alc} step="0.1"
                onChange={e => setAlc(+e.target.value || 0)}
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: T.ink, fontSize: 15, fontFamily: fontSans }}/>
              <span style={{ color: T.muted, fontSize: 13 }}>%</span>
            </div>
          </FieldGroup>

          {/* Date/time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FieldGroup label="Date">
              <div style={{ ...inputS(), display: 'flex', alignItems: 'center', gap: 8, color: T.ink }}>
                <SvgIcon icon={Ic.cal} size={14} color={T.muted} />
                Aujourd'hui
              </div>
            </FieldGroup>
            <FieldGroup label="Heure">
              <div style={{ ...inputS(), display: 'flex', alignItems: 'center', gap: 8, color: T.ink }}>
                <SvgIcon icon={Ic.clock} size={14} color={T.muted} />
                22:04
              </div>
            </FieldGroup>
          </div>

          {/* Impact */}
          <div style={{
            marginTop: 8, padding: 14, background: T.surface, borderRadius: 14,
            border: `1px solid ${T.rule}`, display: 'flex', justifyContent: 'space-around',
          }}>
            <ImpactStat big={`${volCl} cL`} unit="volume" />
            <ImpactStat big={g + 'g'} unit="alcool pur" accent />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px 22px', borderTop: `1px solid ${T.rule}`,
          display: 'flex', gap: 10,
        }}>
          <div onClick={onClose} style={{
            flex: 1, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`,
          }}>Annuler</div>
          <div onClick={onClose} style={{
            flex: 2, padding: '14px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.isDark ? T.bg : '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', letterSpacing: 0.1,
            boxShadow: `0 4px 18px ${T.accent}60`,
          }}>Enregistrer</div>
        </div>
      </div>

      {scan && <ScannerSheet onClose={() => setScan(false)} onScanned={() => { setScan(false); }} />}
    </SheetOverlay>
  );
}

function inputS() {
  return {
    width: '100%', background: T.surface2, border: `1px solid ${T.rule}`,
    borderRadius: 12, padding: '11px 14px', color: T.ink, fontSize: 14,
    fontFamily: fontSans, outline: 'none', letterSpacing: -0.1,
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

// ── Scanner overlay ────────────────────────────────────────────────
function ScannerSheet({ onClose, onScanned }) {
  const [status, setStatus] = React.useState('scanning');
  React.useEffect(() => {
    const t = setTimeout(() => setStatus('found'), 2400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#000', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* fake camera */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, oklch(25% 0.01 50) 0%, oklch(10% 0.005 50) 80%)',
      }}/>

      {/* bar */}
      <div style={{
        position: 'relative', padding: '50px 22px 18px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2,
      }}>
        <div style={{
          color: T.ink, fontFamily: fontSerif, fontSize: 20, fontStyle: 'italic',
          letterSpacing: -0.2,
        }}>Scanner</div>
        <div onClick={onClose} style={{
          width: 36, height: 36, borderRadius: 99,
          background: 'rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center',
          color: T.ink, cursor: 'pointer',
        }}><SvgIcon icon={Ic.close} size={16} /></div>
      </div>

      {/* viewfinder */}
      <div style={{ flex: 1, position: 'relative', display: 'grid', placeItems: 'center' }}>
        <div style={{
          width: 240, height: 150, position: 'relative',
          border: `1.5px solid ${status === 'found' ? T.good : T.accent}`,
          borderRadius: 14, overflow: 'hidden',
          boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
        }}>
          {/* corners */}
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
          {/* scan line */}
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
          color: T.ink, fontSize: 13,
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 99,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            border: `1px solid rgba(255,255,255,0.1)`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: 99,
              background: status === 'found' ? T.good : T.accent,
              boxShadow: `0 0 8px ${status === 'found' ? T.good : T.accent}`,
            }}/>
            {status === 'found' ? 'Guinness Draught détectée' : 'Positionnez le code-barres'}
          </div>
        </div>
      </div>

      {status === 'found' && (
        <div style={{ padding: '0 22px 40px', position: 'relative', zIndex: 2 }}>
          <div onClick={onScanned} style={{
            background: T.accent, color: T.bg, padding: '15px', borderRadius: 14,
            textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>Utiliser ce produit</div>
        </div>
      )}
    </div>
  );
}

// ── Drink detail sheet (family) ───────────────────────────────────
function DrinkDetailSheet({ family, entry, onClose }) {
  if (!family && !entry) return null;
  const f = family || entry.family;
  const color = catColor(f.category, 70);

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0',
        maxHeight: '90%', display: 'flex', flexDirection: 'column',
        border: `1px solid ${T.rule}`, borderBottom: 'none', overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>

        {/* header */}
        <div style={{
          padding: '20px 22px 22px',
          background: `linear-gradient(160deg, ${catBg(f.category)}, transparent 90%)`,
          borderBottom: `1px solid ${T.rule}`, position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 54, height: 54, borderRadius: 16, background: 'rgba(0,0,0,0.22)',
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
              }}>{f.name}</div>
            </div>
            <div onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 99, background: 'rgba(0,0,0,0.3)',
              display: 'grid', placeItems: 'center', color: T.ink, cursor: 'pointer',
              alignSelf: 'flex-start',
            }}><SvgIcon icon={Ic.close} size={14} /></div>
          </div>

          <div style={{ display: 'flex', gap: 0, marginTop: 18 }}>
            <FactCell label="Quantité" value={`${f.quantity} ${f.unit}`} />
            <FactCell label="Alcool" value={`${f.alcohol}°`} />
            <FactCell label="cL" value={formatCl(f)} />
            <FactCell label="Note" value={<Stars rating={f.rating} />} last />
          </div>
        </div>

        <div style={{ overflow: 'auto', padding: '16px 22px 20px', flex: 1 }}>
          <div style={{
            color: T.muted, fontSize: 10.5, letterSpacing: 1.4,
            textTransform: 'uppercase', fontWeight: 500, marginBottom: 10,
          }}>Historique · {f.entries.length} entrée{f.entries.length !== 1 ? 's' : ''}</div>

          <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.rule}`, overflow: 'hidden' }}>
            {f.entries.map((e, i) => {
              const d = new Date(e.ts);
              const months = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderBottom: i === f.entries.length - 1 ? 'none' : `1px solid ${T.rule}`,
                }}>
                  <div style={{
                    fontFamily: fontSerif, fontSize: 14, color: T.ink2,
                    fontStyle: 'italic', width: 60, flexShrink: 0,
                  }}>{d.getDate()} {months[d.getMonth()]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: fontNum, fontSize: 13, color: T.ink, fontWeight: 500,
                    }}>{e.ts.slice(11, 16)}</div>
                    {e.place && (
                      <div style={{ color: T.muted, fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <SvgIcon icon={Ic.pin} size={10} /> {e.place}
                      </div>
                    )}
                  </div>
                  <div style={{ color: T.muted, display: 'flex' }}>
                    <SvgIcon icon={Ic.chev} size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          padding: '12px 22px 22px', borderTop: `1px solid ${T.rule}`,
          display: 'flex', gap: 10,
        }}>
          <div style={{
            flex: 1, padding: '13px', textAlign: 'center', borderRadius: 12,
            background: T.surface2, color: T.ink2, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${T.rule}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}>
            <SvgIcon icon={Ic.edit} size={14} /> Modifier
          </div>
          <div style={{
            flex: 2, padding: '13px', textAlign: 'center', borderRadius: 12,
            background: T.accent, color: T.isDark ? T.bg : '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
            boxShadow: `0 4px 18px ${T.accent}60`,
          }}>
            <SvgIcon icon={Ic.plus} size={14} /> Ajouter à nouveau
          </div>
        </div>
      </div>
    </SheetOverlay>
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

function formatCl(f) {
  const q = f.quantity;
  const u = (f.unit || '').toLowerCase();
  if (u === 'ecocup') return `${q * 25}`;
  if (u === 'l') return `${q * 100}`;
  if (u === 'ml') return `${(q / 10).toFixed(1)}`;
  return `${q}`;
}

function Stars({ rating }) {
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{
          color: i <= rating ? T.accent : T.rule, display: 'flex',
        }}>
          <SvgIcon icon={Ic.star} size={13} />
        </span>
      ))}
    </div>
  );
}

// ── Settings drawer ────────────────────────────────────────────────
function SettingsDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <SheetOverlay onClose={onClose} side="right">
      <div style={{
        background: T.bg, width: 320, height: '100%',
        borderLeft: `1px solid ${T.rule}`,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '52px 20px 18px', borderBottom: `1px solid ${T.rule}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: fontSerif, fontSize: 24, color: T.ink,
            letterSpacing: -0.4, fontStyle: 'italic',
          }}>Paramètres</div>
          <div onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 99, background: T.surface2,
            display: 'grid', placeItems: 'center', color: T.ink2, cursor: 'pointer',
          }}><SvgIcon icon={Ic.close} size={14} /></div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px' }}>
          <SettingsGroup label="Apparence">
            <ThemePicker />
          </SettingsGroup>

          <SettingsGroup label="Profil">
            <SettingRow label="Poids" value="74 kg" />
            <SettingRow label="Sexe" value="Homme" last />
          </SettingsGroup>

          <SettingsGroup label="Données">
            <SettingRow label="Exporter" action />
            <SettingRow label="Importer" action />
            <SettingRow label="Tout effacer" action danger last />
          </SettingsGroup>

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
    <div style={{ display: 'flex', gap: 0 }}>
      {[['light', 'Clair'], ['dark', 'Sombre']].map(([id, label], i) => (
        <div key={id} onClick={() => applyTheme(id)} style={{
          flex: 1, padding: '14px 0', textAlign: 'center',
          fontSize: 13, cursor: 'pointer',
          background: current === id ? T.accentSoft : 'transparent',
          color: current === id ? T.accent : T.ink2,
          fontWeight: current === id ? 600 : 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderRight: i === 0 ? `1px solid ${T.rule}` : 'none',
          letterSpacing: -0.1,
        }}>
          <SvgIcon
            icon={id === 'light'
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
            size={15} />
          {label}
        </div>
      ))}
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

function SettingRow({ label, value, action, danger, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 14px', borderBottom: last ? 'none' : `1px solid ${T.rule}`,
      cursor: action ? 'pointer' : 'default',
    }}>
      <span style={{
        color: danger ? T.accent2 : T.ink, fontSize: 13.5, letterSpacing: -0.1,
      }}>{label}</span>
      {value && <span style={{ color: T.muted, fontSize: 12.5 }}>{value}</span>}
      {action && !danger && <SvgIcon icon={Ic.chev} size={14} color={T.muted} />}
    </div>
  );
}

function SheetOverlay({ children, onClose, side = 'bottom' }) {
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: T.scrim,
      zIndex: 100, display: 'flex',
      alignItems: side === 'bottom' ? 'flex-end' : 'stretch',
      justifyContent: side === 'right' ? 'flex-end' : 'stretch',
      animation: 'fade 0.2s ease',
    }}>
      <style>{`@keyframes fade { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  AddDrinkSheet, ScannerSheet, DrinkDetailSheet, SettingsDrawer, SheetOverlay,
  FieldGroup, ImpactStat, FactCell, Stars,
});

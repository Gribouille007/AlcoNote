// categories.jsx — Tab 1: Catégories (list + drill-down to family detail)

function CategoriesTab({ onAdd, onOpenFamily, onDirectAdd }) {
  const [query, setQuery] = React.useState('');
  const [openCat, setOpenCat] = React.useState(null); // category name or null
  const [editCat, setEditCat] = React.useState(null); // category being edited

  const cats = categoryStats();
  const filtered = openCat
    ? DRINK_FAMILIES.filter(f => f.category === openCat &&
        (query === '' || f.name.toLowerCase().includes(query.toLowerCase())))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '4px 18px 14px' }}>
        <SearchInput value={query} onChange={setQuery}
          placeholder={openCat ? `Rechercher dans ${openCat}…` : 'Rechercher boisson ou catégorie…'} />
      </div>

      {!openCat ? (
        <CategoryGrid cats={cats} query={query} onOpen={setOpenCat}
          onOpenFamily={onOpenFamily} onEditCat={setEditCat} />
      ) : (
        <FamilyList category={openCat} families={filtered}
          onBack={() => setOpenCat(null)} onOpen={onOpenFamily}
          onDirectAdd={onDirectAdd} onEditCat={() => setEditCat(openCat)} />
      )}

      {editCat && (
        <EditCategorySheet category={editCat} onClose={() => setEditCat(null)} />
      )}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.surface2, borderRadius: 14, padding: '11px 14px',
      border: `1px solid ${T.rule}`,
    }}>
      <span style={{ color: T.muted, display: 'flex' }}>
        <SvgIcon icon={Ic.search} size={16} />
      </span>
      <input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: T.ink, fontFamily: fontSans, fontSize: 14, letterSpacing: -0.1,
        }}
      />
      {value && (
        <span onClick={() => onChange('')} style={{ color: T.muted, display: 'flex', cursor: 'pointer' }}>
          <SvgIcon icon={Ic.close} size={14} />
        </span>
      )}
    </div>
  );
}

function CategoryGrid({ cats, query, onOpen, onOpenFamily, onEditCat }) {
  // If searching, show matching families across all categories
  const q = query.toLowerCase();
  const matchedFams = q
    ? DRINK_FAMILIES.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q))
    : [];

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 100px' }}>
      {!q && (
        <>
          <SectionHead>Vos catégories</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            {cats.map(c => <CategoryCard key={c.id} cat={c}
              onClick={() => onOpen(c.name)}
              onEdit={() => onEditCat(c.name)} />)}
          </div>
        </>
      )}

      {q && (
        <>
          <SectionHead>{matchedFams.length} résultat{matchedFams.length > 1 ? 's' : ''}</SectionHead>
          <div style={{ marginTop: 10 }}>
            {matchedFams.map(f => (
              <FamilyRow key={f.id} family={f} onClick={() => onOpenFamily(f)} />
            ))}
            {matchedFams.length === 0 && (
              <div style={{ color: T.muted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
                Aucun résultat pour « {query} »
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SectionHead({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      color: T.muted, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
      fontWeight: 500, padding: '6px 2px',
    }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

function CategoryCard({ cat, onClick, onEdit }) {
  const color = catColor(cat.name, 70);
  const bg = catBg(cat.name);
  return (
    <div onClick={onClick} style={{
      background: T.surface, borderRadius: 18, padding: 14,
      border: `1px solid ${T.rule}`, cursor: 'pointer',
      position: 'relative', overflow: 'hidden',
      aspectRatio: '1 / 1.05',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      {/* edit button */}
      <div onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
        style={{
          position: 'absolute', top: 10, right: 10, width: 26, height: 26,
          borderRadius: 8, background: T.surface2, border: `1px solid ${T.rule}`,
          display: 'grid', placeItems: 'center', color: T.muted, cursor: 'pointer',
          zIndex: 2,
        }}>
        <SvgIcon icon={Ic.edit} size={11} />
      </div>
      {/* glyph blob */}
      <div style={{
        width: 44, height: 44, borderRadius: 14, background: bg,
        display: 'grid', placeItems: 'center', color,
        boxShadow: `inset 0 0 20px ${bg}`,
      }}>
        <CategoryGlyph name={cat.name} />
      </div>

      <div>
        <div style={{
          fontFamily: fontSans, fontWeight: 500, fontSize: 15, color: T.ink,
          letterSpacing: -0.2, marginBottom: 3,
        }}>{cat.name}</div>
        <div style={{
          color: T.muted, fontSize: 11, letterSpacing: 0.1,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color }}>●</span>
          {cat.entries} entrée{cat.entries !== 1 ? 's' : ''}
          <span style={{ opacity: 0.4 }}>·</span>
          {cat.families} type{cat.families !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

function CategoryGlyph({ name }) {
  // Simple shape glyphs per category — no emoji
  const s = { width: 22, height: 22 };
  if (name === 'Bière') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 6h8v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6z"/><path d="M15 9h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><line x1="9" y1="10" x2="9" y2="18"/><line x1="12" y1="10" x2="12" y2="18"/></svg>;
  if (name === 'Vin') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3h8l-1 7a3 3 0 0 1-6 0L8 3z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="21" x2="16" y2="21"/></svg>;
  if (name === 'Spiritueux') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="8" y="8" width="8" height="13" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="0.5"/><line x1="8" y1="13" x2="16" y2="13"/></svg>;
  if (name === 'Cocktail') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16l-8 9-8-9z"/><line x1="12" y1="13" x2="12" y2="20"/><line x1="8" y1="21" x2="16" y2="21"/></svg>;
  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>;
}

// ── Family list within a category ─────────────────────────────────
function FamilyList({ category, families, onBack, onOpen, onDirectAdd, onEditCat }) {
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
      grouped.push({ ...f, dupes: [], totalEntries: f.entries.length });
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 100px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        justifyContent: 'space-between',
      }}>
        <div onClick={onBack} style={{
          color: T.ink2, display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, cursor: 'pointer',
        }}>
          <SvgIcon icon={Ic.chevL} size={16} />
          <span>Catégories</span>
        </div>
        <div onClick={onEditCat} style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '6px 10px', borderRadius: 10, background: T.surface2,
          border: `1px solid ${T.rule}`, color: T.ink2, fontSize: 11,
        }}>
          <SvgIcon icon={Ic.edit} size={11} />
          <span>Modifier</span>
        </div>
      </div>
      <div style={{
        fontFamily: fontSerif, fontSize: 36, color: T.ink,
        letterSpacing: -0.8, lineHeight: 1, marginBottom: 4,
      }}>{category}</div>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 18, letterSpacing: 0.1 }}>
        {grouped.length} type{grouped.length !== 1 ? 's' : ''} ·
        {' '}{families.reduce((s, f) => s + f.entries.length, 0)} entrées au total
      </div>

      {grouped.map(f => <FamilyRow key={f.id} family={f}
        onClick={() => onOpen(f)} onDirectAdd={onDirectAdd} />)}

      {grouped.length === 0 && (
        <div style={{ color: T.muted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Aucun résultat
        </div>
      )}
    </div>
  );
}

function FamilyRow({ family: f, onClick, onDirectAdd }) {
  const color = catColor(f.category, 70);
  const totalEntries = f.totalEntries !== undefined ? f.totalEntries : f.entries.length;
  const dupeCount = (f.dupes ? f.dupes.length : 0) + 1;
  const lastTs = f.entries[0]?.ts;
  const lastStr = lastTs ? formatDateShort(lastTs) : '—';
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 14px', background: T.surface, borderRadius: 14,
      border: `1px solid ${T.rule}`, marginBottom: 8, cursor: 'pointer',
      position: 'relative',
    }}>
      {/* stacked look when dupes > 1 */}
      {dupeCount > 1 && (
        <>
          <div style={{
            position: 'absolute', inset: '-3px 8px auto 8px', height: 6,
            background: T.surface, borderRadius: '14px 14px 0 0',
            border: `1px solid ${T.rule}`, borderBottom: 'none', zIndex: -1,
            opacity: 0.6,
          }}/>
          <div style={{
            position: 'absolute', inset: '-6px 16px auto 16px', height: 6,
            background: T.surface, borderRadius: '14px 14px 0 0',
            border: `1px solid ${T.rule}`, borderBottom: 'none', zIndex: -2,
            opacity: 0.3,
          }}/>
        </>
      )}
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: catBg(f.category),
        display: 'grid', placeItems: 'center', color,
        flexShrink: 0, position: 'relative',
      }}>
        <CategoryGlyph name={f.category} />
        {dupeCount > 1 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9, background: T.accent,
            color: T.isDark ? T.bg : '#fff',
            fontSize: 10, fontWeight: 600, fontFamily: fontNum,
            display: 'grid', placeItems: 'center',
            border: `2px solid ${T.surface}`,
          }}>×{dupeCount}</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14.5, color: T.ink, fontWeight: 500, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{f.name}</div>
        <div style={{
          color: T.muted, fontSize: 11.5, marginTop: 3, letterSpacing: 0.1,
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <span>{f.quantity} {f.unit}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{f.alcohol}°</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{totalEntries}×</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', marginRight: 4 }}>
        <div style={{
          fontFamily: fontSerif, fontStyle: 'italic', fontSize: 13,
          color: T.ink2,
        }}>{lastStr}</div>
        <div style={{ color: T.muted, fontSize: 9.5, letterSpacing: 0.3, marginTop: 2 }}>
          dernière
        </div>
      </div>
      <div
        onClick={(ev) => { ev.stopPropagation(); onDirectAdd && onDirectAdd(f); }}
        style={{
          width: 32, height: 32, borderRadius: 10,
          background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
          display: 'grid', placeItems: 'center', color: T.accent,
          cursor: 'pointer', flexShrink: 0,
        }}
        title="Ajouter à nouveau"
      >
        <SvgIcon icon={Ic.plus} size={14} />
      </div>
    </div>
  );
}

function EditCategorySheet({ category, onClose }) {
  const [name, setName] = React.useState(category);
  const [glyph, setGlyph] = React.useState(category);
  const glyphOptions = ['Bière', 'Vin', 'Spiritueux', 'Cocktail', 'Autre'];
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: T.scrim, zIndex: 150,
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: T.bg, borderRadius: '22px 22px 0 0',
        padding: '18px 20px 28px', border: `1px solid ${T.rule}`,
      }}>
        <div style={{ display: 'grid', placeItems: 'center', paddingBottom: 10 }}>
          <div style={{ width: 42, height: 4, borderRadius: 99, background: T.rule }}/>
        </div>
        <div style={{
          fontFamily: fontSerif, fontSize: 22, color: T.ink,
          letterSpacing: -0.3, fontStyle: 'italic', marginBottom: 18,
          textAlign: 'center',
        }}>Modifier la catégorie</div>

        <div style={{
          color: T.muted, fontSize: 10, letterSpacing: 1.2,
          textTransform: 'uppercase', marginBottom: 8,
        }}>Nom</div>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{
          width: '100%', background: T.surface2, border: `1px solid ${T.rule}`,
          borderRadius: 12, padding: '12px 14px', color: T.ink,
          fontFamily: fontSans, fontSize: 14, outline: 'none',
          marginBottom: 18, boxSizing: 'border-box',
        }}/>

        <div style={{
          color: T.muted, fontSize: 10, letterSpacing: 1.2,
          textTransform: 'uppercase', marginBottom: 8,
        }}>Icône</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
          {glyphOptions.map(g => (
            <div key={g} onClick={() => setGlyph(g)} style={{
              width: 48, height: 48, borderRadius: 12,
              background: glyph === g ? catBg(g) : T.surface2,
              border: `1px solid ${glyph === g ? catColor(g, 60) : T.rule}`,
              display: 'grid', placeItems: 'center',
              color: glyph === g ? catColor(g, 75) : T.ink2,
              cursor: 'pointer',
            }}>
              <CategoryGlyph name={g} />
            </div>
          ))}
        </div>

        <div onClick={onClose} style={{
          padding: '14px', textAlign: 'center', borderRadius: 12,
          background: T.accent, color: T.isDark ? T.bg : '#fff',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: `0 4px 18px ${T.accent}60`,
        }}>Enregistrer</div>
      </div>
    </div>
  );
}

function formatDateShort(iso) {
  const d = new Date(iso);
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

Object.assign(window, {
  CategoriesTab, SearchInput, SectionHead, CategoryCard, CategoryGlyph,
  FamilyList, FamilyRow, formatDateShort, EditCategorySheet,
});

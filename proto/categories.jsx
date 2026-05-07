// categories.jsx — Tab 1: Catégories (grid + drill-down to family detail)

function CategoriesTab({ onAdd, onOpenFamily, onDirectAdd, onEditFamily, query, setQuery, openCat, setOpenCat }) {
  const [editCat, setEditCat] = React.useState(null);
  const { categories } = useCategories();
  const { drinks } = useDrinks();
  const ratings = useRatings();
  useCategoryIcons(); // keep window.__alcoCatIcons up to date

  const families = React.useMemo(() => buildFamilies(drinks, ratings), [drinks, ratings]);
  const cats = React.useMemo(() => computeCategoryStats(categories, families), [categories, families]);

  const filtered = openCat
    ? families.filter(f => f.category === openCat &&
        (query === '' || f.name.toLowerCase().includes((query || '').toLowerCase())))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '4px 18px 14px' }}>
        <SearchInput value={query || ''} onChange={setQuery}
          placeholder={openCat ? `Rechercher dans ${openCat}…` : 'Rechercher boisson ou catégorie…'} />
      </div>

      {!openCat ? (
        <CategoryGrid cats={cats} families={families} query={query} onOpen={setOpenCat}
          onOpenFamily={onOpenFamily} onEditCat={setEditCat} onDirectAdd={onDirectAdd}
          onAdd={onAdd} />
      ) : (
        <FamilyList category={openCat} families={filtered}
          onBack={() => setOpenCat(null)} onOpen={onOpenFamily}
          onDirectAdd={onDirectAdd} onEditCat={() => setEditCat(openCat)}
          onEditFamily={onEditFamily} />
      )}

      {editCat && (
        <EditCategorySheet category={editCat} onClose={() => setEditCat(null)} />
      )}
    </div>
  );
}

function CategoryGrid({ cats, families, query, onOpen, onOpenFamily, onEditCat }) {
  const q = (query || '').toLowerCase();
  const matchedFams = q
    ? families.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q))
    : [];

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 120px' }}>
      {!q && (
        <>
          <SectionHead>Vos catégories</SectionHead>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            {cats.map(c => <CategoryCard key={c.id || c.name} cat={c}
              onClick={() => onOpen(c.name)}
              onEdit={() => onEditCat(c.name)} />)}
          </div>
          {cats.length === 0 && (
            <div style={{
              color: T.muted, fontSize: 13, padding: '60px 0', textAlign: 'center',
            }}>Aucune catégorie pour le moment.</div>
          )}
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
              <div style={{
                color: T.muted, fontSize: 13, padding: '40px 0', textAlign: 'center',
              }}>Aucun résultat pour « {query} »</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryCard({ cat, onClick, onEdit }) {
  const color = catColor(cat.name, 70);
  const bg = catBg(cat.name);
  return (
    <div {...clickable(onClick, `Ouvrir la catégorie ${cat.name}`)} style={{
      background: T.surface, borderRadius: 18, padding: 14,
      border: `1px solid ${T.rule}`, cursor: 'pointer',
      position: 'relative', overflow: 'hidden',
      aspectRatio: '1 / 1.05',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
        aria-label={`Modifier ${cat.name}`}
        style={{
          position: 'absolute', top: 10, right: 10, width: 26, height: 26,
          borderRadius: 8, background: T.surface2, border: `1px solid ${T.rule}`,
          display: 'grid', placeItems: 'center', color: T.muted, cursor: 'pointer',
          zIndex: 2, padding: 0, fontFamily: 'inherit',
        }}>
        <SvgIcon icon={Ic.edit} size={11} />
      </button>
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
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
function FamilyList({ category, families, onBack, onOpen, onDirectAdd, onEditCat }) {
  // Sort families: identical-name groups stay contiguous, ordered by
  // total entries inside the group, then by quantity asc inside each
  // group. We keep one line per (name, qty, unit, abv) variant so the
  // user can add each individually. Variants share a `groupKey` so
  // FamilyRow can render the stacked-card visual cue.
  const groupCounts = new Map();
  for (const f of families) {
    const k = (f.name || '').trim().toLowerCase();
    groupCounts.set(k, (groupCounts.get(k) || 0) + f.entries.length);
  }
  const sorted = [...families].sort((a, b) => {
    const ka = (a.name || '').trim().toLowerCase();
    const kb = (b.name || '').trim().toLowerCase();
    const ga = groupCounts.get(ka) || 0;
    const gb = groupCounts.get(kb) || 0;
    if (gb !== ga) return gb - ga;
    if (ka !== kb) return ka.localeCompare(kb);
    if ((a.alcohol || 0) !== (b.alcohol || 0)) return (a.alcohol || 0) - (b.alcohol || 0);
    return (a.quantity || 0) - (b.quantity || 0);
  });

  // Build per-row metadata: position within the same-name group.
  const rows = [];
  let prevKey = null, idx = 0;
  for (const f of sorted) {
    const key = (f.name || '').trim().toLowerCase();
    if (key !== prevKey) idx = 0;
    const sameNameCount = families.filter(x => (x.name || '').trim().toLowerCase() === key).length;
    rows.push({ f, key, idx: idx++, total: sameNameCount });
    prevKey = key;
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 18px 120px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        justifyContent: 'space-between',
      }}>
        <button type="button" onClick={onBack} aria-label="Retour aux catégories" style={{
          ...ghostButton,
          color: T.ink2, display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 13, cursor: 'pointer',
        }}>
          <SvgIcon icon={Ic.chevL} size={16} />
          <span>Catégories</span>
        </button>
        <button type="button" onClick={onEditCat} aria-label={`Modifier la catégorie ${category}`} style={{
          ...ghostButton,
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          padding: '6px 10px', borderRadius: 10, background: T.surface2,
          border: `1px solid ${T.rule}`, color: T.ink2, fontSize: 11,
        }}>
          <SvgIcon icon={Ic.edit} size={11} />
          <span>Modifier</span>
        </button>
      </div>
      <div style={{
        fontFamily: fontSerif, fontSize: 36, color: T.ink,
        letterSpacing: -0.8, lineHeight: 1, marginBottom: 4,
      }}>{category}</div>
      <div style={{ color: T.muted, fontSize: 12, marginBottom: 18, letterSpacing: 0.1 }}>
        {sorted.length} variante{sorted.length !== 1 ? 's' : ''} ·
        {' '}{families.reduce((s, f) => s + f.entries.length, 0)} entrées au total
      </div>

      {rows.map(({ f, idx, total }) => (
        <FamilyRow key={f.id} family={f}
          variantIndex={idx} variantCount={total}
          onClick={() => onOpen(f)} onDirectAdd={onDirectAdd} />
      ))}

      {rows.length === 0 && (
        <div style={{ color: T.muted, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
          Aucun résultat
        </div>
      )}
    </div>
  );
}

function FamilyRow({ family: f, variantIndex = 0, variantCount = 1, onClick, onDirectAdd }) {
  const color = catColor(f.category, 70);
  const totalEntries = f.entries.length;
  // The number of units (verres standard) per drink — surfaced left of
  // the plus button in saturated orange so it pops out of the row.
  const units = unitsAlcohol(f.quantity, f.unit, f.alcohol);
  const unitsStr = units >= 10 ? units.toFixed(0)
                 : units >= 1  ? units.toFixed(1)
                              : units.toFixed(2);
  const orange = T.isDark ? 'oklch(70% 0.18 55)' : 'oklch(50% 0.18 50)';
  const isFirstOfGroup = variantIndex === 0;
  const isLastOfGroup  = variantIndex === variantCount - 1;
  // Top margin: keep the visible vertical rhythm between groups, but
  // attach variants of the same drink as a stacked card.
  const topMargin = isFirstOfGroup ? 8 : 0;
  return (
    <div {...clickable(onClick, `Voir les détails de ${f.name}`)} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 14px', background: T.surface,
      borderRadius: variantCount > 1
        ? `${isFirstOfGroup ? 14 : 0}px ${isFirstOfGroup ? 14 : 0}px ${isLastOfGroup ? 14 : 0}px ${isLastOfGroup ? 14 : 0}px`
        : 14,
      border: `1px solid ${T.rule}`,
      borderTop: !isFirstOfGroup ? `1px dashed ${T.rule}` : `1px solid ${T.rule}`,
      borderBottom: !isLastOfGroup ? 'none' : `1px solid ${T.rule}`,
      marginTop: topMargin,
      marginBottom: isLastOfGroup ? 8 : 0,
      cursor: 'pointer', position: 'relative',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: catBg(f.category),
        display: 'grid', placeItems: 'center', color,
        flexShrink: 0, position: 'relative',
      }}>
        <CategoryGlyph name={f.category} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14.5, color: T.ink, fontWeight: 500, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{f.name}{variantCount > 1 && (
          <span style={{
            marginLeft: 8, fontSize: 10, color: T.muted, fontFamily: fontNum,
            letterSpacing: 0.4, fontWeight: 400,
          }}>{variantIndex + 1}/{variantCount}</span>
        )}</div>
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
      <div title={`${unitsStr} unité${units > 1 ? 's' : ''} d'alcool par boisson`} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        marginRight: 6,
      }}>
        <div style={{
          fontFamily: fontNum, fontSize: 16, fontWeight: 700,
          color: orange, letterSpacing: -0.2, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>{unitsStr}</div>
        <div style={{
          color: T.muted, fontSize: 9, letterSpacing: 0.4, marginTop: 3,
          textTransform: 'uppercase',
        }}>U.</div>
      </div>
      <button type="button"
        onClick={(ev) => { ev.stopPropagation(); onDirectAdd && onDirectAdd(f); }}
        style={{
          width: 32, height: 32, borderRadius: 10,
          background: T.accentSoft, border: `1px solid ${T.accentSoftBorder}`,
          display: 'grid', placeItems: 'center', color: T.accent,
          cursor: 'pointer', flexShrink: 0,
          padding: 0, fontFamily: 'inherit',
        }}
        title="Ajouter à nouveau"
        aria-label={`Ajouter ${f.name} (${f.quantity} ${f.unit}, ${f.alcohol}°) à nouveau`}
      >
        <SvgIcon icon={Ic.plus} size={14} />
      </button>
    </div>
  );
}
function EditCategorySheet({ category, onClose }) {
  const { categories } = useCategories();
  const { drinks } = useDrinks();
  const icons = useCategoryIcons();
  const [name, setName] = React.useState(category);
  const initialGlyph = icons[category] || category;
  const [glyph, setGlyph] = React.useState(initialGlyph);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  // If the persisted icon loads after this sheet mounts, sync once.
  React.useEffect(() => {
    if (icons[category] && glyph === category) setGlyph(icons[category]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icons, category]);

  const drinksInCat = drinks.filter(d => (d.category || '') === category).length;
  const catObj = categories.find(c => c.name === category);

  const save = async () => {
    setErr('');
    const trimmed = (name || '').trim();
    if (!trimmed) { setErr('Le nom ne peut pas être vide'); return; }
    setBusy(true);
    try {
      let finalName = category;
      if (trimmed !== category) {
        await renameCategory(category, trimmed);
        finalName = trimmed;
      }
      // Persist the icon override, even if it equals the category name
      // (`null` clears the override so future renames just track the name).
      const iconValue = glyph && glyph !== finalName ? glyph : null;
      await setCategoryIcon(finalName, iconValue);
      Toast.show(`Catégorie « ${finalName} » mise à jour`);
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de l\'enregistrement');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!catObj) return;
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
        danger: true,
      });
      if (!ok) return;
      reassignTo = fallback.name;
    } else {
      const ok = await Confirm.ask({
        title: `Supprimer « ${category} » ?`,
        message: 'Cette action est irréversible.',
        confirmText: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await deleteCategory(catObj.id, { reassignTo, name: category });
      Toast.show(`Catégorie supprimée`);
      onClose && onClose();
    } catch (e) {
      setErr(e && e.message ? e.message : 'Erreur lors de la suppression');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetOverlay onClose={onClose}>
      <div style={{
        background: T.bg, borderRadius: '22px 22px 0 0',
        padding: '18px 20px 28px',
        borderTop: `1px solid ${T.rule}`,
        borderLeft: `1px solid ${T.rule}`,
        borderRight: `1px solid ${T.rule}`,
        animation: 'slideUp 0.25s ease',
        overflowX: 'hidden',
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
        <div role="radiogroup" aria-label="Icône de catégorie"
          style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
          {GLYPH_OPTIONS.map(g => {
            const selected = glyph === g;
            return (
              <button key={g} type="button" role="radio" aria-checked={selected}
                aria-label={`Icône ${g}`}
                onClick={() => setGlyph(g)} style={{
                width: 52, height: 52, borderRadius: 12,
                background: selected ? catBg(g) : T.surface2,
                border: `1px solid ${selected ? catColor(g, 60) : T.rule}`,
                display: 'grid', placeItems: 'center',
                color: selected ? catColor(g, 75) : T.ink2,
                cursor: 'pointer', padding: 0, fontFamily: 'inherit',
              }}>
                <CategoryGlyph glyph={g} />
              </button>
            );
          })}
        </div>

        {err && (
          <div style={{
            color: T.accent2, background: 'oklch(35% 0.10 25 / 0.15)',
            border: '1px solid oklch(45% 0.15 25 / 0.4)',
            padding: '8px 12px', borderRadius: 10, fontSize: 12,
            marginBottom: 14,
          }}>{err}</div>
        )}

        <button type="button" onClick={busy ? undefined : save} disabled={busy} style={{
          width: '100%', padding: '14px', textAlign: 'center', borderRadius: 12,
          background: T.accent, color: T.isDark ? T.bg : '#fff',
          fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.5 : 1, border: 'none', fontFamily: 'inherit',
          boxShadow: `0 4px 18px ${T.accent}60`,
        }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>

        <button type="button" onClick={busy ? undefined : remove} disabled={busy} style={{
          width: '100%',
          marginTop: 12, padding: '12px', textAlign: 'center', borderRadius: 12,
          background: 'oklch(35% 0.10 25 / 0.15)',
          color: T.accent2,
          border: '1px solid oklch(45% 0.15 25 / 0.4)',
          fontSize: 12.5, fontWeight: 500, cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.5 : 1, display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 6,
          fontFamily: 'inherit',
        }}>
          <SvgIcon icon={Ic.trash} size={13} />
          Supprimer la catégorie
        </button>
      </div>
    </SheetOverlay>
  );
}
Object.assign(window, {
  CategoriesTab, CategoryGrid, CategoryCard,
  FamilyList, FamilyRow, EditCategorySheet,
});

/* AUTO-GENERATED from proto/compare.jsx — do not edit by hand. */
// compare.jsx — Mode « Comparer » : deux personnes, stat par stat.
//
// Par défaut MOI (à gauche, ambre — la couleur de ma pastille BAC) face à un
// ami (à droite, vert — la couleur de la pastille d'un ami). Les deux côtés
// sont modifiables (moi ou n'importe quel membre du groupe) et inversables.
//
// Lisibilité avant tout : pas de petit graphe. Chaque stat est une ligne
// « duel » — les deux valeurs en grand de part et d'autre, l'écart au centre,
// une barre de parts pleine largeur dessous.
//
// ÉCART : exprimé RELATIVEMENT AU PLUS PETIT des deux (choix produit) et
// affiché du côté du plus grand : « +35% » pointé vers Léa = Léa a 35 % de
// plus que l'autre. Quand le plus petit vaut 0, un pourcentage n'est pas
// défini (division par zéro) : on affiche l'écart ABSOLU (« +3 »). Les
// grandeurs déjà en % (degré, part d'une catégorie) ou bornées (note /5)
// s'écartent en points, jamais en % de % (ambigu).
//
// AUCUN calcul n'est dupliqué : tout passe par les helpers purs des stats
// (aggregateGeneral, computeBACSessions, sessionsForRange, …) — un ami est
// évalué exactement comme dans sa fiche.

const COMPARE_ME = '__me__';
const COMPARE_PERIOD_KEY = 'alconote.compare.period';
const COMPARE_COLLAPSED_KEY = 'alconote.compare.collapsed';
const COMPARE_WEEKLY_PERIODS = ['month', 'year', 'school', 'all'];
const COMPARE_DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ── Helpers purs (testables sous stub-globals) ────────────────────

// Cible par défaut : l'ami favori s'il est membre, sinon le premier membre.
function defaultCompareTarget(members, favoriteId = null) {
  const list = members || [];
  if (favoriteId && list.some(m => m.userId === favoriteId)) return favoriteId;
  return list.length ? list[0].userId : null;
}

// Personne résolue pour la comparaison, ou null si l'id n'est plus membre.
function resolveComparePerson(id, members, mySettings = {}) {
  if (id === COMPARE_ME) {
    return {
      id,
      isMe: true,
      name: 'Toi',
      bacAvailable: true,
      weight: Number(mySettings.userWeight) || DEFAULT_WEIGHT_KG,
      gender: mySettings.userGender || 'male'
    };
  }
  const m = (members || []).find(x => x.userId === id);
  if (!m) return null;
  return {
    id,
    isMe: false,
    name: m.displayName || 'Anonyme',
    // Sans partage du BAC, pas de poids/sexe publiés : les métriques Widmark
    // seraient inventées → masquées (même règle que la fiche ami).
    bacAvailable: !!m.shareBac,
    weight: Number(m.bacWeight) || DEFAULT_WEIGHT_KG,
    gender: m.bacGender || 'male'
  };
}

// Plage d'une personne : la période choisie, sauf « Tout » qui démarre à SA
// première boisson (sinon les moyennes /jour d'un nouvel arrivant seraient
// divisées par des années d'avant son inscription). null = rien à évaluer.
function compareRangeFor(drinks, period, anchor) {
  const base = getPeriodRange(period, anchor);
  if (period !== 'all') return base;
  let first = null;
  for (const d of drinks || []) if (d.date && (first == null || d.date < first)) first = d.date;
  return first ? {
    start: new Date(first + 'T00:00'),
    end: base.end
  } : null;
}

// Profil chiffré d'une personne sur une période. `allSessions` (optionnel)
// évite de recalculer les sessions Widmark à chaque changement de période.
function buildCompareProfile(drinks, opts = {}, period = 'month', anchor = new Date(), now = new Date()) {
  const {
    weight = DEFAULT_WEIGHT_KG,
    gender = 'male',
    bacAvailable = true,
    ratings = null,
    allSessions = null
  } = opts;
  const all = drinks || [];
  const range = compareRangeFor(all, period, anchor);
  const inRange = range ? filterDrinksInRange(all, range.start, range.end) : [];
  const agg = aggregateGeneral(inRange);
  const multiDay = period !== 'today';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = range ? elapsedDays(range, now) : 0;

  // Degré moyen PONDÉRÉ par le volume (Σ cl·deg / Σ cl) : un shot à 40° ne
  // pèse pas autant qu'une pinte à 5°. Équivaut au degré du « mélange » bu.
  let clAbv = 0;
  for (const d of inRange) clAbv += toCl(d.quantity, d.unit) * (Number(d.alcoholContent) || 0);

  // Boisson la plus bue (clé normalisée, 1re casse rencontrée affichée).
  const byName = {};
  for (const d of inRange) {
    const k = drinkNameKey(d.name);
    if (!k) continue;
    const e = byName[k] || (byName[k] = {
      name: (d.name || '').trim(),
      count: 0
    });
    e.count++;
  }
  const topDrink = Object.values(byName).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'fr'))[0] || null;

  // Note moyenne des boissons DIFFÉRENTES bues sur la période et notées.
  let rSum = 0,
    rN = 0;
  if (ratings) {
    for (const k of Object.keys(byName)) {
      const v = Number(ratings[ratingKey(byName[k].name)]) || 0;
      if (v > 0) {
        rSum += v;
        rN++;
      }
    }
  }
  const cats = Object.entries(agg.byCategory).map(([name, count]) => ({
    name,
    count,
    share: agg.count ? count / agg.count : 0
  })).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'fr'));
  let bac = null;
  if (bacAvailable) {
    const sessAll = allSessions || computeBACSessions(all, weight, gender);
    const sessions = range ? sessionsForRange(sessAll, range) : [];
    bac = {
      sessions: sessions.length,
      bourreMs: range ? computeBourreTime(sessAll, range) : 0,
      meanBac: meanSessionBac(sessions),
      peakBac: sessions.length ? Math.max(...sessions.map(s => s.peakBac)) : null,
      avgDurationH: sessions.length ? sessionGapStats(sessions).avgDurationH : null
    };
  }
  return {
    range,
    days,
    empty: inRange.length === 0,
    count: agg.count,
    volumeCl: agg.volumeCl,
    grams: agg.grams,
    unique: agg.uniqueCount,
    gramsPerDrink: agg.count ? agg.grams / agg.count : null,
    perDay: multiDay && days ? agg.count / days : null,
    gramsPerDay: multiDay && days ? agg.grams / days : null,
    perWeek: COMPARE_WEEKLY_PERIODS.includes(period) && days ? agg.count / Math.max(1, days / 7) : null,
    drinkDays: multiDay && range ? new Set(inRange.map(d => d.date).filter(Boolean)).size : null,
    soberDays: multiDay && range ? soberDaysInRange(inRange, range, today) : null,
    avgAbv: agg.volumeCl > 0 ? clAbv / agg.volumeCl : null,
    avgRating: rN ? rSum / rN : null,
    topCat: cats[0] || null,
    topDrink,
    peakHour: peakIndex(agg.byHour),
    peakDow: multiDay ? peakIndex(agg.byDow) : null,
    cats,
    bac
  };
}

// Écart entre deux valeurs, relatif au PLUS PETIT. `fmt` (optionnel) : deux
// valeurs qui s'AFFICHENT identiques sont déclarées égales (jamais « +1% »
// entre deux « 1.2L »). → null (une valeur manque) | { leader: 'a'|'b'|null,
// pct: number|null (null si le plus petit vaut 0), abs, equal }.
function compareDiff(a, b, fmt) {
  if (a == null || b == null) return null;
  const va = Number(a),
    vb = Number(b);
  if (!Number.isFinite(va) || !Number.isFinite(vb)) return null;
  if (Math.abs(va - vb) < 1e-9 || fmt && fmt(va) === fmt(vb)) {
    return {
      leader: null,
      pct: 0,
      abs: 0,
      equal: true
    };
  }
  const hi = Math.max(va, vb),
    lo = Math.min(va, vb);
  return {
    leader: va > vb ? 'a' : 'b',
    pct: lo > 0 ? (hi - lo) / lo * 100 : null,
    abs: hi - lo,
    equal: false
  };
}

// « 35 », « 4.5 », « <0.1 » — pourcentages lisibles (1 décimale sous 10 %).
function fmtComparePct(p) {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.1) return '<0.1';
  if (p < 10) return String(Math.round(p * 10) / 10);
  return String(Math.round(p));
}

// Texte du badge d'écart d'une ligne : '=' | '+35%' | '+3' | null.
function compareDiffText(diff, row) {
  if (!diff) return null;
  if (diff.equal) return '=';
  if (row.mode !== 'abs' && diff.pct != null) return `+${fmtComparePct(diff.pct)}%`;
  return `+${(row.fmtAbs || row.fmt)(diff.abs)}`;
}

// Formateurs (purs) des lignes.
const _fmtInt = v => String(Math.round(v));
const _fmt1 = v => (Math.round(v * 10) / 10).toFixed(1);
const _fmtGrams = v => `${Math.round(v)}g`;
const _fmtLitres = v => `${(v / 100).toFixed(1)}L`; // v en cL
const _fmtMgL = v => `${Math.round(v)} mg/L`;

// Sections de comparaison (pur). `live` = { a, b } taux courants (mg/L) ou
// null. Chaque ligne numérique : { id, label, a, b, fmt, mode?, fmtAbs?, chip? }.
function buildCompareSections(pa, pb, period, live = null) {
  const multiDay = period !== 'today';
  // L'alcool pur total n'y figure pas : c'est le HÉROS de la vue (en très
  // grand, juste au-dessus) — le répéter serait du bruit.
  const volume = [{
    id: 'count',
    label: 'Boissons',
    a: pa.count,
    b: pb.count,
    fmt: _fmtInt
  }, {
    id: 'volume',
    label: 'Volume',
    a: pa.volumeCl,
    b: pb.volumeCl,
    fmt: _fmtLitres
  }, {
    id: 'unique',
    label: 'Boissons différentes',
    a: pa.unique,
    b: pb.unique,
    fmt: _fmtInt
  }, {
    id: 'gramsPerDrink',
    label: 'Alcool pur par verre',
    a: pa.gramsPerDrink,
    b: pb.gramsPerDrink,
    fmt: v => `${_fmt1(v)}g`
  }];
  if (multiDay) {
    volume.push({
      id: 'perDay',
      label: 'Boissons par jour',
      a: pa.perDay,
      b: pb.perDay,
      fmt: _fmt1
    }, {
      id: 'gramsPerDay',
      label: 'Alcool pur par jour',
      a: pa.gramsPerDay,
      b: pb.gramsPerDay,
      fmt: v => `${_fmt1(v)}g`
    });
  }
  if (COMPARE_WEEKLY_PERIODS.includes(period)) {
    volume.push({
      id: 'perWeek',
      label: 'Boissons par semaine',
      a: pa.perWeek,
      b: pb.perWeek,
      fmt: _fmt1
    });
  }
  if (multiDay) {
    volume.push({
      id: 'drinkDays',
      label: 'Jours avec alcool',
      a: pa.drinkDays,
      b: pb.drinkDays,
      fmt: _fmtInt
    }, {
      id: 'soberDays',
      label: 'Jours sobres',
      a: pa.soberDays,
      b: pb.soberDays,
      fmt: _fmtInt
    });
  }
  const bacRows = pa.bac && pb.bac ? [{
    id: 'sessions',
    label: 'Sessions',
    a: pa.bac.sessions,
    b: pb.bac.sessions,
    fmt: _fmtInt
  }, {
    id: 'bourre',
    label: 'Temps bourré',
    a: pa.bac.bourreMs,
    b: pb.bac.bourreMs,
    fmt: fmtBourreTime
  }, {
    id: 'meanBac',
    label: 'Taux moyen par session',
    a: pa.bac.meanBac,
    b: pb.bac.meanBac,
    fmt: _fmtMgL
  }, {
    id: 'peakBac',
    label: 'Pic de la période',
    a: pa.bac.peakBac,
    b: pb.bac.peakBac,
    fmt: _fmtMgL
  }, {
    id: 'duration',
    label: 'Durée moyenne de session',
    a: pa.bac.avgDurationH,
    b: pb.bac.avgDurationH,
    fmt: fmtDurationHM
  }, ...(live ? [{
    id: 'current',
    label: 'Alcoolémie actuelle',
    a: live.a,
    b: live.b,
    fmt: _fmtMgL,
    chip: 'En direct'
  }] : [])] : null;
  const catLabel = c => c ? {
    text: c.name,
    sub: `${Math.round(c.share * 100)}%`,
    cat: c.name
  } : null;
  const habits = {
    text: [{
      id: 'topCat',
      label: 'Catégorie favorite',
      a: catLabel(pa.topCat),
      b: catLabel(pb.topCat)
    }, {
      id: 'topDrink',
      label: 'Boisson favorite',
      a: pa.topDrink ? {
        text: pa.topDrink.name,
        sub: `${pa.topDrink.count}×`
      } : null,
      b: pb.topDrink ? {
        text: pb.topDrink.name,
        sub: `${pb.topDrink.count}×`
      } : null
    }, ...(multiDay ? [{
      id: 'peakDow',
      label: 'Jour de pointe',
      a: pa.peakDow != null ? {
        text: COMPARE_DAY_NAMES[pa.peakDow]
      } : null,
      b: pb.peakDow != null ? {
        text: COMPARE_DAY_NAMES[pb.peakDow]
      } : null
    }] : []), {
      id: 'peakHour',
      label: 'Heure de pointe',
      a: pa.peakHour != null ? {
        text: `${pa.peakHour}h`
      } : null,
      b: pb.peakHour != null ? {
        text: `${pb.peakHour}h`
      } : null
    }],
    numeric: [
    // Déjà des pourcentages / une échelle bornée : écart en POINTS.
    {
      id: 'avgAbv',
      label: 'Degré moyen',
      a: pa.avgAbv,
      b: pb.avgAbv,
      fmt: v => `${_fmt1(v)}%`,
      mode: 'abs',
      fmtAbs: v => `${_fmt1(v)} pt`
    }, {
      id: 'avgRating',
      label: 'Note moyenne',
      a: pa.avgRating,
      b: pb.avgRating,
      fmt: v => `${_fmt1(v)}/5`,
      mode: 'abs',
      fmtAbs: v => `${_fmt1(v)}★`,
      bar: false
    }]
  };
  return {
    volume,
    bac: bacRows,
    habits,
    categories: buildCategoryDuel(pa, pb)
  };
}

// Parts par catégorie (union des deux), triées par part max décroissante.
// Écart en POINTS de pourcentage (une part n'a pas de « % de % » lisible).
function buildCategoryDuel(pa, pb) {
  const map = new Map();
  for (const c of pa.cats || []) map.set(c.name, {
    name: c.name,
    a: c.share,
    b: 0,
    countA: c.count,
    countB: 0
  });
  for (const c of pb.cats || []) {
    const e = map.get(c.name) || {
      name: c.name,
      a: 0,
      b: 0,
      countA: 0,
      countB: 0
    };
    e.b = c.share;
    e.countB = c.count;
    map.set(c.name, e);
  }
  return [...map.values()].sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b) || x.name.localeCompare(y.name, 'fr'));
}

// Phrase-verdict du héros, sur l'alcool pur (repli : nombre de boissons si
// tout est à 0 g). Accord « tu » pour moi, pronom neutre, jamais genré.
function compareVerdict(pa, pb, A, B) {
  const useGrams = pa.grams > 0 || pb.grams > 0;
  const va = useGrams ? pa.grams : pa.count;
  const vb = useGrams ? pb.grams : pb.count;
  if (!(va > 0) && !(vb > 0)) return "Aucune boisson de part et d'autre sur cette période.";
  const d = compareDiff(va, vb, useGrams ? _fmtGrams : _fmtInt);
  const what = useGrams ? "d'alcool pur" : 'de boissons';
  if (d.equal) return `Autant ${what} de part et d'autre.`;
  const L = d.leader === 'a' ? A : B;
  const O = d.leader === 'a' ? B : A;
  if (d.pct == null) {
    return L.isMe ? 'Tu es la seule personne à avoir bu sur cette période.' : `${L.name} est la seule personne à avoir bu sur cette période.`;
  }
  const subj = L.isMe ? 'Tu as bu' : `${L.name} a bu`;
  const obj = O.isMe ? 'toi' : O.name;
  // Au-delà du double, le rapport se lit mieux que « +250% » seul.
  const ratio = d.pct >= 100 ? ` (×${_fmt1(1 + d.pct / 100)})` : '';
  return `${subj} ${fmtComparePct(d.pct)}% ${what} de plus que ${obj}${ratio}.`;
}

// « Tout » : historiques de longueurs différentes → avertissement explicite
// (les totaux avantagent le plus ancien ; les moyennes /jour sont justes).
function compareAllPeriodNote(pa, pb, A, B, period) {
  if (period !== 'all' || !pa.days || !pb.days) return null;
  const lo = Math.min(pa.days, pb.days),
    hi = Math.max(pa.days, pb.days);
  if (hi - lo <= Math.max(1, lo * 0.1)) return null;
  return `Depuis la 1re boisson de chacun : ${A.name} ${pa.days} j, ${B.name} ${pb.days} j. ` + 'Les totaux avantagent l\'historique le plus long — fie-toi aux moyennes par jour.';
}

// ── Composants ────────────────────────────────────────────────────

// Couleurs d'un côté, lues AU RENDU (T suit le thème) : gauche = ambre
// (comme ma pastille BAC), droite = vert (comme la pastille d'un ami).
function compareSide(side) {
  return side === 'a' ? {
    fg: T.accent,
    soft: T.accentSoft,
    border: T.accentSoftBorder
  } : {
    fg: T.good,
    soft: T.goodSoft,
    border: T.goodSoftBorder
  };
}

// Barre de parts pleine largeur : gauche ∝ a, droite ∝ b (échelle honnête,
// somme = 100 %). Décorative (la valeur exacte est écrite au-dessus).
function CompareSplitBar({
  a,
  b,
  height = 6
}) {
  const va = Math.max(0, Number(a) || 0),
    vb = Math.max(0, Number(b) || 0);
  const both = va > 0 && vb > 0;
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      gap: both ? 2 : 0,
      height,
      borderRadius: 99,
      overflow: 'hidden',
      background: va + vb > 0 ? 'transparent' : T.surface3
    }
  }, va > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: `${va} 1 0`,
      minWidth: 4,
      background: T.accent,
      transition: 'flex-grow 0.22s ease'
    }
  }), vb > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: `${vb} 1 0`,
      minWidth: 4,
      background: T.good,
      transition: 'flex-grow 0.22s ease'
    }
  }));
}

// Badge d'écart, pointé vers le côté qui a la plus grande valeur, teinté à
// sa couleur. '=' neutre quand les valeurs affichées sont identiques.
function CompareDiffBadge({
  leader,
  text,
  leaderName
}) {
  if (!text) return /*#__PURE__*/React.createElement("span", null);
  const equal = text === '=';
  const c = equal ? null : compareSide(leader);
  return /*#__PURE__*/React.createElement("span", {
    "aria-label": equal ? 'Égalité' : `${leaderName} : ${text} de plus`,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      justifySelf: 'center',
      padding: '4px 8px',
      borderRadius: 99,
      whiteSpace: 'nowrap',
      fontFamily: fontNum,
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1,
      color: equal ? T.muted : c.fg,
      background: equal ? T.surface3 : c.soft,
      border: `1px solid ${equal ? T.rule : c.border}`
    }
  }, !equal && leader === 'a' && /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chevL,
    size: 12
  }), text, !equal && leader === 'b' && /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chevR,
    size: 12
  }));
}
function CompareRowLabel({
  children,
  chip
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      fontWeight: 500,
      textAlign: 'center'
    }
  }, children, chip && /*#__PURE__*/React.createElement(ScopeChip, {
    label: chip
  }));
}

// Ligne « duel » numérique.
function CompareRow({
  row,
  names,
  first
}) {
  const diff = compareDiff(row.a, row.b, row.fmt);
  const text = compareDiffText(diff, row);
  const va = row.a == null ? '—' : row.fmt(row.a);
  const vb = row.b == null ? '—' : row.fmt(row.b);
  const leaderName = diff && diff.leader ? names[diff.leader] : '';
  const valStyle = side => ({
    fontFamily: fontSerif,
    fontSize: 24,
    letterSpacing: -0.4,
    lineHeight: 1,
    color: diff && !diff.equal && diff.leader !== side ? T.ink2 : T.ink,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: side === 'a' ? 'left' : 'right'
  });
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": `${row.label} : ${names.a} ${va}, ${names.b} ${vb}${text && text !== '=' ? `, ${leaderName} ${text}` : ''}`,
    style: {
      padding: '12px 2px',
      borderTop: first ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement(CompareRowLabel, {
    chip: row.chip
  }, row.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 8,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: valStyle('a')
  }, va), /*#__PURE__*/React.createElement(CompareDiffBadge, {
    leader: diff && diff.leader,
    text: text,
    leaderName: leaderName
  }), /*#__PURE__*/React.createElement("div", {
    style: valStyle('b')
  }, vb)), row.bar !== false && diff && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(CompareSplitBar, {
    a: row.a,
    b: row.b
  })));
}

// Ligne qualitative (catégorie, boisson, jour, heure) : pas de pourcentage,
// juste « = » quand les deux coïncident.
function CompareTextRow({
  row,
  first
}) {
  useCatPalette(); // pastille de catégorie : repaint si une teinte change
  const same = row.a && row.b && drinkNameKey(row.a.text) === drinkNameKey(row.b.text);
  const cell = (v, side) => /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      textAlign: side === 'a' ? 'left' : 'right'
    }
  }, v ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      justifyContent: side === 'a' ? 'flex-start' : 'flex-end',
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 19,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1.1,
      minWidth: 0
    }
  }, v.cat && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      flexShrink: 0,
      background: catColor(v.cat, 65)
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, v.text)), v.sub && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      color: T.muted,
      fontSize: 10.5,
      fontFamily: fontNum
    }
  }, v.sub)) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 19,
      color: T.muted
    }
  }, "\u2014"));
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": `${row.label} : ${row.a ? row.a.text : 'aucune'} contre ${row.b ? row.b.text : 'aucune'}`,
    style: {
      padding: '12px 2px',
      borderTop: first ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement(CompareRowLabel, null, row.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 8,
      marginTop: 8
    }
  }, cell(row.a, 'a'), /*#__PURE__*/React.createElement("span", {
    style: {
      color: same ? T.ink2 : T.muted,
      fontSize: same ? 12 : 10,
      fontFamily: fontNum,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.3
    }
  }, same ? '=' : 'vs'), cell(row.b, 'b')));
}

// Ligne « papillon » d'une catégorie : part de chacun (0–100 %), barres qui
// partent du centre — gauche vers la gauche, droite vers la droite.
function CompareCategoryRow({
  cat,
  names,
  first
}) {
  useCatPalette();
  const pa = Math.round(cat.a * 100),
    pb = Math.round(cat.b * 100);
  const leader = pa === pb ? null : pa > pb ? 'a' : 'b';
  const gap = Math.abs(pa - pb);
  const half = (share, side) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: side === 'a' ? 'flex-end' : 'flex-start',
      height: 8,
      borderRadius: 99,
      background: T.surface3,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.max(0, Math.min(100, share * 100))}%`,
      borderRadius: 99,
      background: side === 'a' ? T.accent : T.good,
      transition: 'width 0.22s ease'
    }
  }));
  return /*#__PURE__*/React.createElement("div", {
    role: "group",
    "aria-label": `${cat.name} : ${names.a} ${pa}%, ${names.b} ${pb}%${leader ? `, ${names[leader]} +${gap} points` : ''}`,
    style: {
      padding: '12px 2px',
      borderTop: first ? 'none' : `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      letterSpacing: -0.4,
      lineHeight: 1,
      color: leader === 'b' ? T.ink2 : T.ink
    }
  }, pa, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      color: T.ink,
      fontSize: 13,
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      flexShrink: 0,
      background: catColor(cat.name, 65)
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      maxWidth: 120,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, cat.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(CompareDiffBadge, {
    leader: leader,
    text: leader ? `+${gap} pts` : '=',
    leaderName: leader ? names[leader] : ''
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontSize: 22,
      letterSpacing: -0.4,
      lineHeight: 1,
      textAlign: 'right',
      color: leader === 'a' ? T.ink2 : T.ink
    }
  }, pb, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 4,
      marginTop: 10
    }
  }, half(cat.a, 'a'), half(cat.b, 'b')));
}

// Héros : l'alcool pur en très grand, la barre de parts épaisse et la
// phrase-verdict — la réponse à « qui a bu le plus ? » en un coup d'œil.
function CompareHero({
  pa,
  pb,
  A,
  B,
  period
}) {
  const useGrams = pa.grams > 0 || pb.grams > 0 || pa.count === 0 && pb.count === 0;
  const va = useGrams ? pa.grams : pa.count,
    vb = useGrams ? pb.grams : pb.count;
  const fmt = useGrams ? _fmtGrams : _fmtInt;
  const diff = compareDiff(va, vb, fmt);
  const text = compareDiffText(diff, {
    fmt
  });
  const note = compareAllPeriodNote(pa, pb, A, B, period);
  const name = (P, side) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      minWidth: 0,
      justifyContent: side === 'a' ? 'flex-start' : 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      flexShrink: 0,
      background: compareSide(side).fg
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: T.ink2,
      fontSize: 12,
      fontWeight: 600,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, P.name));
  const big = (v, side) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 38,
      letterSpacing: -0.8,
      lineHeight: 1,
      color: diff && !diff.equal && diff.leader !== side ? T.ink2 : T.ink,
      textAlign: side === 'a' ? 'left' : 'right',
      whiteSpace: 'nowrap'
    }
  }, fmt(v));
  return /*#__PURE__*/React.createElement("section", {
    "aria-label": "R\xE9sum\xE9 de la comparaison",
    style: {
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      borderRadius: 16,
      padding: '16px 16px 14px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(CompareRowLabel, null, useGrams ? 'Alcool pur' : 'Boissons'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'end',
      gap: 8,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, big(va, 'a'), name(A, 'a')), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement(CompareDiffBadge, {
    leader: diff && diff.leader,
    text: text,
    leaderName: diff && diff.leader ? diff.leader === 'a' ? A.name : B.name : ''
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, big(vb, 'b'), name(B, 'b'))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(CompareSplitBar, {
    a: va,
    b: vb,
    height: 12
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14,
      textAlign: 'center',
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 17,
      color: T.ink,
      lineHeight: 1.3,
      letterSpacing: -0.2
    }
  }, compareVerdict(pa, pb, A, B)), note && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      color: T.muted,
      fontSize: 10.5,
      lineHeight: 1.5,
      textAlign: 'center'
    }
  }, note));
}

// Bouton-personne de la barre du haut (sert aussi de légende gauche/droite).
function ComparePersonChip({
  person,
  side,
  onClick
}) {
  const c = compareSide(side);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-label": `Changer la personne ${side === 'a' ? 'de gauche' : 'de droite'} (${person.name})`,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
      padding: '10px 10px',
      borderRadius: 12,
      cursor: 'pointer',
      background: c.soft,
      border: `1px solid ${c.border}`,
      fontFamily: 'inherit',
      flexDirection: side === 'a' ? 'row' : 'row-reverse'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      flexShrink: 0,
      background: c.fg
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      color: T.ink,
      fontSize: 14,
      fontWeight: 600,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: side === 'a' ? 'left' : 'right'
    }
  }, person.name), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      color: T.muted,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.chev,
    size: 14
  })));
}

// Choix d'une personne (moi + membres). Choisir celle déjà en face = inverser.
function ComparePersonSheet({
  side,
  people,
  pair,
  onPick,
  onClose
}) {
  const [closing, close] = useSheetClose(onClose);
  const other = side === 'a' ? pair.b : pair.a;
  return /*#__PURE__*/React.createElement(SheetOverlay, {
    onClose: close,
    closing: closing,
    label: side === 'a' ? 'Choisir la personne de gauche' : 'Choisir la personne de droite'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.bg,
      borderRadius: '22px 22px 0 0',
      maxHeight: '80dvh',
      display: 'flex',
      flexDirection: 'column',
      borderTop: `1px solid ${T.rule}`,
      borderLeft: `1px solid ${T.rule}`,
      borderRight: `1px solid ${T.rule}`,
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
      padding: '6px 18px 10px',
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 20,
      color: T.ink,
      letterSpacing: -0.3
    }
  }, side === 'a' ? 'À gauche' : 'À droite'), /*#__PURE__*/React.createElement("div", {
    style: {
      overflow: 'auto',
      padding: '0 16px calc(env(safe-area-inset-bottom) + 18px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: T.surface2,
      border: `1px solid ${T.rule}`,
      borderRadius: 14,
      overflow: 'hidden'
    }
  }, people.map((p, i) => {
    const selected = p.id === pair[side];
    const opposite = p.id === other;
    return /*#__PURE__*/React.createElement("button", {
      key: p.id,
      type: "button",
      "aria-pressed": selected,
      onClick: () => {
        onPick(p.id);
        close();
      },
      style: {
        ...ghostButton,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 14px',
        color: T.ink,
        borderBottom: i === people.length - 1 ? 'none' : `1px solid ${T.rule}`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 15,
        fontWeight: 600,
        color: T.ink,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, p.name), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        fontSize: 9.5,
        color: T.muted,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        marginTop: 2,
        fontWeight: 500
      }
    }, opposite ? 'En face — les deux côtés seront inversés' : p.isMe ? 'Mes statistiques' : p.bacAvailable ? 'Alcoolémie partagée' : 'BAC non partagé')), selected && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        color: compareSide(side).fg
      }
    }, /*#__PURE__*/React.createElement(SvgIcon, {
      icon: Ic.check,
      size: 18
    })));
  })))));
}
function _loadCompareCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COMPARE_COLLAPSED_KEY) || '[]'));
  } catch (e) {
    return new Set();
  }
}

// Données d'une personne : mes boissons (contexte perso) ou celles d'un ami
// (cache du sharedPool). Les hooks sont appelés inconditionnellement.
function useComparePersonData(id, myDrinks, myRatings) {
  const isMe = id === COMPARE_ME;
  const pool = useSharedPool(isMe ? null : id);
  const friendRatings = React.useMemo(() => isMe ? null : sharedRatingsMap(pool.drinks), [isMe, pool.drinks]);
  return isMe ? {
    drinks: myDrinks.drinks || [],
    loading: !!myDrinks.loading,
    ratings: myRatings
  } : {
    drinks: pool.drinks,
    loading: pool.loading,
    ratings: friendRatings
  };
}

// Profil mémoïsé : sessions Widmark calculées une fois par (boissons, profil),
// puis re-sélectionnées par période.
function useCompareProfile(person, data, period, anchor) {
  const weight = person ? person.weight : DEFAULT_WEIGHT_KG;
  const gender = person ? person.gender : 'male';
  const bacAvailable = !!(person && person.bacAvailable);
  const allSessions = React.useMemo(() => bacAvailable ? computeBACSessions(data.drinks, weight, gender) : null, [data.drinks, weight, gender, bacAvailable]);
  return React.useMemo(() => buildCompareProfile(data.drinks, {
    weight,
    gender,
    bacAvailable,
    ratings: data.ratings,
    allSessions
  }, period, anchor), [data.drinks, data.ratings, allSessions, weight, gender, bacAvailable, period, anchor]);
}

// Taux courant (mg/L), recalculé chaque minute (le taux décroît avec le temps).
function useCompareLiveBac(person, drinks, minute) {
  const on = !!(person && person.bacAvailable);
  const weight = person ? person.weight : DEFAULT_WEIGHT_KG;
  const gender = person ? person.gender : 'male';
  return React.useMemo(() => on ? computeBacOverTime(drinks, weight, gender).current || 0 : null, [on, drinks, weight, gender, minute]);
}

// Vue plein écran « Comparer » (même transition « page » que la fiche ami).
function CompareView({
  initialA = COMPARE_ME,
  initialB = null,
  onClose
}) {
  useCatPalette();
  const s = useShare();
  const reduced = useReducedMotion();
  const [closing, close] = useSheetClose(onClose);
  useBackButton(true, close);
  const rawMembers = useGroupMembers();
  const members = React.useMemo(() => sortGroupMembers(rawMembers, s.favoriteId), [rawMembers, s.favoriteId]);
  const mySettings = useSettings();
  const myDrinks = useDrinks();
  const myRatings = useRatings();
  const [pair, setPair] = React.useState(() => ({
    a: initialA || COMPARE_ME,
    b: initialB || defaultCompareTarget(members, s.favoriteId)
  }));
  const [picking, setPicking] = React.useState(null);
  const [period, setPeriod] = React.useState(() => {
    try {
      return localStorage.getItem(COMPARE_PERIOD_KEY) || 'month';
    } catch (e) {
      return 'month';
    }
  });
  const [anchor, setAnchor] = React.useState(() => new Date());
  const [collapsed, setCollapsed] = React.useState(_loadCompareCollapsed);
  const [minute, setMinute] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setMinute(m => m + 1), 60000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem(COMPARE_PERIOD_KEY, period);
    } catch (e) {}
  }, [period]);
  const A = resolveComparePerson(pair.a, members, mySettings);
  const B = resolveComparePerson(pair.b, members, mySettings);

  // Une personne a quitté le groupe (ou moi) : repli sur quelqu'un d'autre,
  // sinon fermeture. Une liste vide transitoire est ignorée (le moteur ne la
  // remplace que par une liste SAINE).
  const hasA = !!A,
    hasB = !!B;
  React.useEffect(() => {
    if (!s.groupId) {
      close();
      return;
    }
    if (s.members.length === 0) return;
    if (hasA && hasB && pair.a !== pair.b) return;
    const a = hasA ? pair.a : COMPARE_ME;
    const ids = [COMPARE_ME, ...members.map(m => m.userId)];
    const b = hasB && pair.b !== a ? pair.b : ids.find(x => x !== a);
    if (!b) {
      close();
      return;
    }
    setPair({
      a,
      b
    });
  }, [hasA, hasB, pair.a, pair.b, members, s.groupId, s.members.length, close]);
  const dataA = useComparePersonData(pair.a, myDrinks, myRatings);
  const dataB = useComparePersonData(pair.b, myDrinks, myRatings);
  const profA = useCompareProfile(A, dataA, period, anchor);
  const profB = useCompareProfile(B, dataB, period, anchor);
  const liveA = useCompareLiveBac(A, dataA.drinks, minute);
  const liveB = useCompareLiveBac(B, dataB.drinks, minute);
  const sections = React.useMemo(() => buildCompareSections(profA, profB, period, liveA != null && liveB != null ? {
    a: liveA,
    b: liveB
  } : null), [profA, profB, period, liveA, liveB]);
  const people = React.useMemo(() => [{
    id: COMPARE_ME,
    name: 'Toi',
    isMe: true,
    bacAvailable: true
  }, ...members.map(m => ({
    id: m.userId,
    name: m.displayName || 'Anonyme',
    isMe: false,
    bacAvailable: !!m.shareBac
  }))], [members]);
  const pick = (side, id) => setPair(p => {
    const other = side === 'a' ? 'b' : 'a';
    if (p[other] === id) return {
      a: p.b,
      b: p.a
    }; // choisir l'autre = inverser
    return {
      ...p,
      [side]: id
    };
  });
  const toggleSection = id => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);else next.add(id);
    try {
      localStorage.setItem(COMPARE_COLLAPSED_KEY, JSON.stringify([...next]));
    } catch (e) {}
    return next;
  });
  const loading = dataA.loading || dataB.loading;
  const ready = A && B && !loading;
  const names = {
    a: A ? A.name : '',
    b: B ? B.name : ''
  };
  const bothEmpty = ready && profA.empty && profB.empty;
  const noBac = ready && !sections.bac ? [A, B].filter(p => !p.bacAvailable).map(p => p.name) : [];
  const block = (rows, Row) => rows.map((r, i) => /*#__PURE__*/React.createElement(Row, {
    key: r.id,
    row: r,
    names: names,
    first: i === 0
  }));
  return /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Comparaison des statistiques",
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 62,
      background: T.bg,
      color: T.ink,
      display: 'flex',
      flexDirection: 'column',
      animation: reduced ? undefined : closing ? `pageOut ${MOTION.fast}ms ${MOTION.ease} forwards` : `pageIn ${MOTION.base}ms ${MOTION.ease}`,
      pointerEvents: closing ? 'none' : undefined
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'calc(env(safe-area-inset-top) + 14px) 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
      borderBottom: `1px solid ${T.rule}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: close,
    "aria-label": "Retour",
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      padding: 0,
      fontFamily: 'inherit',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.back,
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: fontSerif,
      fontStyle: 'italic',
      fontSize: 19,
      color: T.ink,
      letterSpacing: -0.3,
      lineHeight: 1.1
    }
  }, "Comparaison"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9.5,
      color: T.muted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 2,
      fontWeight: 500
    }
  }, "Statistiques c\xF4te \xE0 c\xF4te"))), A && B && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: 8,
      padding: '12px 16px 10px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(ComparePersonChip, {
    person: A,
    side: "a",
    onClick: () => setPicking('a')
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Inverser les deux personnes",
    onClick: () => setPair(p => ({
      a: p.b,
      b: p.a
    })),
    style: {
      width: 36,
      height: 36,
      borderRadius: 12,
      background: T.surface2,
      display: 'grid',
      placeItems: 'center',
      color: T.ink2,
      cursor: 'pointer',
      border: `1px solid ${T.rule}`,
      padding: 0,
      fontFamily: 'inherit'
    }
  }, /*#__PURE__*/React.createElement(SvgIcon, {
    icon: Ic.swap,
    size: 16
  })), /*#__PURE__*/React.createElement(ComparePersonChip, {
    person: B,
    side: "b",
    onClick: () => setPicking('b')
  })), /*#__PURE__*/React.createElement(PeriodSwitcher, {
    period: period,
    onChange: p => {
      setPeriod(p);
      setAnchor(new Date());
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto',
      padding: '0 16px 120px'
    }
  }, /*#__PURE__*/React.createElement(PeriodNav, {
    period: period,
    anchor: anchor,
    onShift: d => setAnchor(shiftAnchor(period, anchor, d)),
    onReset: () => setAnchor(new Date())
  }), ready && /*#__PURE__*/React.createElement(CompareHero, {
    pa: profA,
    pb: profB,
    A: A,
    B: B,
    period: period
  }), ready && bothEmpty && /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      padding: '12px 0',
      textAlign: 'center',
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Pas de donn\xE9es disponibles sur cette p\xE9riode"), ready && !bothEmpty && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatSection, {
    id: "cmp-volume",
    title: "Volume & fr\xE9quence",
    sub: "Quantit\xE9s et rythme sur la p\xE9riode",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, block(sections.volume, CompareRow)), /*#__PURE__*/React.createElement(StatSection, {
    id: "cmp-bac",
    title: "Alcool\xE9mie",
    sub: "Sessions et taux (mod\xE8le de Widmark)",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, sections.bac ? block(sections.bac, CompareRow) : /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      padding: '10px 4px',
      textAlign: 'center',
      fontStyle: 'italic',
      fontFamily: fontSerif,
      lineHeight: 1.5
    }
  }, noBac.length > 1 ? `${noBac.join(' et ')} ne partagent pas leur alcoolémie` : `${noBac[0]} ne partage pas son alcoolémie`, " \u2014 sans poids ni sexe, aucun taux ne peut \xEAtre calcul\xE9 honn\xEAtement.")), /*#__PURE__*/React.createElement(StatSection, {
    id: "cmp-habits",
    title: "Habitudes",
    sub: "Ce que chacun boit, et quand",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, block(sections.habits.text, CompareTextRow), sections.habits.numeric.map(r => /*#__PURE__*/React.createElement(CompareRow, {
    key: r.id,
    row: r,
    names: names,
    first: false
  }))), /*#__PURE__*/React.createElement(StatSection, {
    id: "cmp-categories",
    title: "R\xE9partition par cat\xE9gorie",
    sub: "Part de chaque cat\xE9gorie dans les boissons de chacun",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, sections.categories.map((c, i) => /*#__PURE__*/React.createElement(CompareCategoryRow, {
    key: c.name,
    cat: c,
    names: names,
    first: i === 0
  }))))), picking && /*#__PURE__*/React.createElement(ComparePersonSheet, {
    side: picking,
    people: people,
    pair: pair,
    onPick: id => pick(picking, id),
    onClose: () => setPicking(null)
  }));
}
Object.assign(window, {
  COMPARE_ME,
  CompareView,
  ComparePersonSheet,
  CompareRow,
  CompareTextRow,
  CompareCategoryRow,
  CompareHero,
  CompareSplitBar,
  CompareDiffBadge,
  defaultCompareTarget,
  resolveComparePerson,
  compareRangeFor,
  buildCompareProfile,
  compareDiff,
  fmtComparePct,
  compareDiffText,
  buildCompareSections,
  buildCategoryDuel,
  compareVerdict,
  compareAllPeriodNote
});
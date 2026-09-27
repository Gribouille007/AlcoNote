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
// Période du Classement (leaderboard.jsx) — déclarée ici car le préchauffage
// de l'onglet Amis (useFriendsPrewarm) la lit aussi.
const LEADERBOARD_PERIOD_KEY = 'alconote.leaderboard.period';
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
// Exposés au Classement (leaderboard.jsx) : mêmes chiffres, même format.
const COMPARE_FMT = Object.freeze({
  int: _fmtInt,
  one: _fmt1,
  grams: _fmtGrams,
  litres: _fmtLitres,
  mgL: _fmtMgL
});

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

// ── Rapprochement des noms de catégorie ───────────────────────────
// Deux personnes ne nomment pas leurs catégories pareil (« Vin » / « Vins »,
// « Bière » / « Bières » / « Bier »). Clé de rapprochement : forme canonique
// (canonicalCat) en minuscules, SANS accents ni ponctuation, et chaque mot
// débarrassé de son pluriel (s/x final, mots de 4 lettres et plus : « vins »
// → « vin », mais « jus » reste « jus »).
function categoryMatchKey(name) {
  const base = canonicalCat(name).toLowerCase();
  const words = base.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(w => w.length >= 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w);
  // Nom sans lettre ni chiffre (emoji…) : on garde la forme canonique brute.
  return words.length ? words.join(' ') : base;
}

// Distance d'édition « optimal string alignment » (insertion, suppression,
// substitution, transposition de deux lettres voisines). Pur.
function editDistance(a, b) {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev2 = null,
    prev = Array.from({
      length: n + 1
    }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

// Deux noms désignent-ils la même catégorie ? Clés égales, ou UNE faute de
// frappe tolérée quand les deux clés font au moins 4 lettres (« bier » ≈
// « biere »). En dessous, jamais : « Vin » et « Gin » restent distincts.
function categoriesMatch(a, b) {
  const ka = categoryMatchKey(a),
    kb = categoryMatchKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (Math.min(ka.length, kb.length) < 4 || Math.abs(ka.length - kb.length) > 1) return false;
  return editDistance(ka, kb) <= 1;
}

// Parts par catégorie des catégories COMMUNES aux deux personnes, noms
// rapprochés (categoriesMatch), triées par part max décroissante. Une
// catégorie que seule une personne a n'est pas comparée. Les parts restent
// celles du TOTAL de chacun (mêmes chiffres que l'onglet Stats). Écart en
// POINTS de pourcentage (une part n'a pas de « % de % » lisible).
// → [{ name, nameA, nameB, a, b, countA, countB }]
function buildCategoryDuel(pa, pb) {
  const items = [...(pa.cats || []).map(c => ({
    side: 'a',
    ...c
  })), ...(pb.cats || []).map(c => ({
    side: 'b',
    ...c
  }))];
  // Regroupement transitif (union-find) : « Bière », « Bières » et « Bier »
  // finissent dans le même groupe même si une seule paire se ressemble.
  const parent = items.map((_, i) => i);
  const find = i => parent[i] === i ? i : parent[i] = find(parent[i]);
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (find(i) !== find(j) && categoriesMatch(items[i].name, items[j].name)) parent[find(j)] = find(i);
    }
  }
  const groups = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    const g = groups.get(r) || {
      a: 0,
      b: 0,
      countA: 0,
      countB: 0,
      topA: null,
      topB: null
    };
    if (it.side === 'a') {
      g.a += it.share;
      g.countA += it.count;
      if (!g.topA || it.count > g.topA.count) g.topA = it;
    } else {
      g.b += it.share;
      g.countB += it.count;
      if (!g.topB || it.count > g.topB.count) g.topB = it;
    }
    groups.set(r, g);
  });
  const out = [];
  for (const g of groups.values()) {
    if (!(g.countA > 0 && g.countB > 0)) continue;
    const nameA = g.topA.name,
      nameB = g.topB.name;
    out.push({
      name: nameA,
      nameA,
      nameB,
      a: g.a,
      b: g.b,
      countA: g.countA,
      countB: g.countB
    });
  }
  return out.sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b) || x.name.localeCompare(y.name, 'fr'));
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
  const same = !!(row.a && row.b) && (row.a.cat && row.b.cat ? categoriesMatch(row.a.cat, row.b.cat) : drinkNameKey(row.a.text) === drinkNameKey(row.b.text));
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
  const alias = cat.nameB && canonicalCat(cat.nameB) !== canonicalCat(cat.name) ? cat.nameB : null;
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
    "aria-label": `${cat.name}${alias ? ` (${alias})` : ''} : ${names.a} ${pa}%, ${names.b} ${pb}%${leader ? `, ${names[leader]} +${gap} points` : ''}`,
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
  }, cat.name)), alias && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      color: T.muted,
      fontSize: 10.5,
      maxWidth: 140,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "\u2248 ", alias), /*#__PURE__*/React.createElement("div", {
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

// ── Caches de calcul (partagés Comparer ↔ Classement ↔ préchauffage) ─
// Clé = le TABLEAU de boissons lui-même (WeakMap) : mes boissons viennent de
// DrinksContext, celles d'un ami du cache du sharedPool — deux références
// STABLES tant que rien ne change, remplacées à la moindre écriture. Le cache
// meurt donc avec son tableau (aucune invalidation manuelle, aucune fuite),
// et rouvrir Comparer / changer de période déjà vue ne recalcule RIEN.
const CMP_NO_DRINKS = Object.freeze([]);
const _CMP_MAX_PROFILES = 32;
const _cmpCache = new WeakMap();
function _cmpBucket(drinks) {
  const key = drinks || CMP_NO_DRINKS;
  let b = _cmpCache.get(key);
  if (!b) {
    b = {
      sessions: new Map(),
      profiles: new Map(),
      live: new Map(),
      ratings: null
    };
    _cmpCache.set(key, b);
  }
  return b;
}
const _cmpDayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Sessions Widmark d'une personne (tout l'historique), mémoïsées.
function cachedBACSessions(drinks, weight, gender) {
  const b = _cmpBucket(drinks);
  const k = `${weight}|${gender}`;
  let v = b.sessions.get(k);
  if (!v) {
    v = computeBACSessions(drinks || CMP_NO_DRINKS, weight, gender);
    b.sessions.set(k, v);
  }
  return v;
}

// Notes d'un ami (carte nom → note), mémoïsées par tableau.
function cachedSharedRatings(drinks) {
  const b = _cmpBucket(drinks);
  if (!b.ratings) b.ratings = sharedRatingsMap(drinks || CMP_NO_DRINKS);
  return b.ratings;
}
function _cmpProfileKey(opts, period, anchor, now) {
  const r = getPeriodRange(period, anchor);
  return [period, +r.start, +r.end, _cmpDayKey(now), opts.weight, opts.gender, opts.bacAvailable ? 1 : 0, opts.ratings ? 1 : 0].join('|');
}

// Profil déjà calculé ? (lecture seule — sert à décider si la vue peut
// s'afficher d'emblée ou doit différer le calcul d'une image).
function peekCompareProfile(drinks, opts, period, anchor, now = new Date()) {
  const e = _cmpBucket(drinks).profiles.get(_cmpProfileKey(opts, period, anchor, now));
  return e && e.ratings === (opts.ratings || null) ? e.profile : null;
}

// buildCompareProfile mémoïsé. Même résultat, au calcul près : les sessions
// viennent de cachedBACSessions. Taille bornée (FIFO) par tableau.
function cachedCompareProfile(drinks, opts, period, anchor, now = new Date()) {
  const b = _cmpBucket(drinks);
  const key = _cmpProfileKey(opts, period, anchor, now);
  const ratings = opts.ratings || null;
  const hit = b.profiles.get(key);
  if (hit && hit.ratings === ratings) return hit.profile;
  const profile = buildCompareProfile(drinks || CMP_NO_DRINKS, {
    ...opts,
    allSessions: opts.bacAvailable ? cachedBACSessions(drinks, opts.weight, opts.gender) : null
  }, period, anchor, now);
  if (b.profiles.size >= _CMP_MAX_PROFILES) b.profiles.delete(b.profiles.keys().next().value);
  b.profiles.set(key, {
    ratings,
    profile
  });
  return profile;
}

// Taux courant (mg/L) mémoïsé à la MINUTE (le taux décroît avec le temps).
function cachedLiveBac(drinks, weight, gender, nowMs = Date.now()) {
  const b = _cmpBucket(drinks);
  const k = `${weight}|${gender}|${Math.floor(nowMs / 60000)}`;
  if (b.live.has(k)) return b.live.get(k);
  const v = computeBacOverTime(drinks || CMP_NO_DRINKS, weight, gender).current || 0;
  b.live.clear();
  b.live.set(k, v);
  return v;
}

// Options de profil d'une personne résolue (resolveComparePerson).
function compareProfileOpts(person, ratings = null) {
  return {
    weight: person ? person.weight : DEFAULT_WEIGHT_KG,
    gender: person ? person.gender : 'male',
    bacAvailable: !!(person && person.bacAvailable),
    ratings: ratings || null
  };
}

// Données d'une personne : mes boissons (contexte perso) ou celles d'un ami
// (cache du sharedPool). Les hooks sont appelés inconditionnellement.
function useComparePersonData(id, myDrinks, myRatings) {
  const isMe = id === COMPARE_ME;
  const pool = useSharedPool(isMe ? null : id);
  return isMe ? {
    drinks: myDrinks.drinks || CMP_NO_DRINKS,
    loading: !!myDrinks.loading,
    ratings: myRatings
  } : {
    drinks: pool.drinks,
    loading: pool.loading,
    ratings: pool.loading ? null : cachedSharedRatings(pool.drinks)
  };
}

// Profil mémoïsé (cache module) ; null tant que `enabled` est faux.
function useCompareProfile(person, data, period, anchor, enabled = true) {
  const opts = compareProfileOpts(person, data.ratings);
  return React.useMemo(() => enabled ? cachedCompareProfile(data.drinks, opts, period, anchor) : null, [enabled, data.drinks, data.ratings, opts.weight, opts.gender, opts.bacAvailable, period, anchor]);
}

// Taux courant (mg/L), recalculé chaque minute (le taux décroît avec le temps).
function useCompareLiveBac(person, drinks, minute, enabled = true) {
  const on = enabled && !!(person && person.bacAvailable);
  const weight = person ? person.weight : DEFAULT_WEIGHT_KG;
  const gender = person ? person.gender : 'male';
  return React.useMemo(() => on ? cachedLiveBac(drinks, weight, gender) : null, [on, drinks, weight, gender, minute]);
}

// Planifie `fn` APRÈS la prochaine image peinte (rAF puis tâche) : la page
// s'affiche et démarre son animation d'entrée AVANT le calcul lourd — le tap
// répond immédiatement. Renvoie une fonction d'annulation.
function afterNextPaint(fn) {
  const w = typeof window !== 'undefined' ? window : {};
  let t = null,
    cancelled = false;
  const run = () => {
    if (!cancelled) t = setTimeout(() => {
      if (!cancelled) fn();
    }, 0);
  };
  const r = typeof w.requestAnimationFrame === 'function' ? w.requestAnimationFrame(run) : setTimeout(run, 16);
  return () => {
    cancelled = true;
    clearTimeout(t);
    if (typeof w.cancelAnimationFrame === 'function') w.cancelAnimationFrame(r);else clearTimeout(r);
  };
}

// Rendu PROGRESSIF : renvoie l'étape courante (0 → max), avancée d'un cran
// après chaque image peinte. Étape 0 = la page seule (en-tête, personnes,
// période) — le tap répond à l'image suivante et l'animation d'entrée
// (transform, jouée par le compositeur) démarre aussitôt ; les étapes
// suivantes construisent le contenu par morceaux, jamais en un seul long
// bloc. Mesuré : c'est la CONSTRUCTION du DOM (~600 nœuds stylés), pas le
// calcul, qui coûtait le plus au tap.
function useProgressiveStages(max = 1) {
  const [stage, setStage] = React.useState(0);
  React.useEffect(() => stage >= max ? undefined : afterNextPaint(() => setStage(x => Math.min(max, x + 1))), [stage, max]);
  return stage;
}

// Idle « poli » : requestIdleCallback si dispo, sinon petit délai.
function onIdle(fn, timeout = 1500) {
  const w = typeof window !== 'undefined' ? window : {};
  if (typeof w.requestIdleCallback === 'function') {
    const h = w.requestIdleCallback(fn, {
      timeout
    });
    return () => {
      if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(h);
    };
  }
  const h = setTimeout(fn, 300);
  return () => clearTimeout(h);
}

// Préchauffage : pendant que l'onglet Amis est affiché, calcule EN IDLE (une
// personne par tranche, pour ne jamais bloquer un tap) les profils dont
// Comparer et le Classement auront besoin à l'ouverture. `jobs` = liste de
// fonctions sans argument ; chacune remplit le cache module.
function runIdleJobs(jobs) {
  let i = 0,
    cancel = null,
    stopped = false;
  const step = () => {
    if (stopped || i >= jobs.length) return;
    try {
      jobs[i++]();
    } catch (e) {/* un calcul raté ne bloque pas les autres */}
    cancel = onIdle(step);
  };
  cancel = onIdle(step);
  return () => {
    stopped = true;
    if (cancel) cancel();
  };
}
function storedPeriod(key, fallback = 'month') {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

// Monté dans l'onglet Amis : préchauffe Comparer (moi + ami par défaut) et le
// Classement (tout le groupe) sur leurs périodes mémorisées. Aucun rendu.
function useFriendsPrewarm(members, favoriteId) {
  const s = useShare();
  const myDrinks = useDrinks();
  const myRatings = useRatings();
  const mySettings = useSettings();
  const key = (members || []).map(m => `${m.userId}:${m.shareBac ? 1 : 0}:${m.bacWeight || ''}:${m.bacGender || ''}`).join(',');
  const membersRef = React.useRef(members);
  membersRef.current = members;
  React.useEffect(() => {
    const list = membersRef.current || [];
    if (!s.groupId || !list.length || myDrinks.loading) return undefined;
    let stop = null,
      alive = true;
    loadPoolByAuthor().then(byAuthor => {
      if (!alive) return;
      const anchor = new Date();
      const cmpPeriod = storedPeriod(COMPARE_PERIOD_KEY);
      const lbPeriod = storedPeriod(LEADERBOARD_PERIOD_KEY);
      const me = resolveComparePerson(COMPARE_ME, list, mySettings);
      const target = defaultCompareTarget(list, favoriteId);
      const jobs = [() => cachedCompareProfile(myDrinks.drinks, compareProfileOpts(me, myRatings), cmpPeriod, anchor)];
      for (const m of [...list].sort((x, y) => x.userId === target ? -1 : y.userId === target ? 1 : 0)) {
        const P = resolveComparePerson(m.userId, list, mySettings);
        const drinks = byAuthor.get(m.userId) || CMP_NO_DRINKS;
        if (m.userId === target) {
          jobs.push(() => cachedCompareProfile(drinks, compareProfileOpts(P, cachedSharedRatings(drinks)), cmpPeriod, anchor));
        }
        jobs.push(() => cachedCompareProfile(drinks, compareProfileOpts(P), lbPeriod, anchor));
      }
      jobs.push(() => cachedCompareProfile(myDrinks.drinks, compareProfileOpts(me), lbPeriod, anchor));
      stop = runIdleJobs(jobs);
    }).catch(() => {});
    return () => {
      alive = false;
      if (stop) stop();
    };
  }, [s.groupId, key, favoriteId, myDrinks.drinks, myDrinks.loading, myRatings, mySettings.userWeight, mySettings.userGender]);
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
  // Latence au tap : la page est peinte SEULE à la 1re image (stage 0), le
  // héros et la 1re section à la suivante (1), le reste ensuite (2). Les
  // profils sont en général déjà en cache (préchauffés en idle par l'onglet
  // Amis) : chaque étape ne paie que la construction de son DOM.
  const loadingData = dataA.loading || dataB.loading;
  const stage = useProgressiveStages(2);
  const warm = stage >= 1;
  const profA = useCompareProfile(A, dataA, period, anchor, warm);
  const profB = useCompareProfile(B, dataB, period, anchor, warm);
  const liveA = useCompareLiveBac(A, dataA.drinks, minute, warm);
  const liveB = useCompareLiveBac(B, dataB.drinks, minute, warm);
  const sections = React.useMemo(() => profA && profB ? buildCompareSections(profA, profB, period, liveA != null && liveB != null ? {
    a: liveA,
    b: liveB
  } : null) : null, [profA, profB, period, liveA, liveB]);
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
  const ready = !!(A && B && !loadingData && profA && profB);
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
  }), ready ? /*#__PURE__*/React.createElement(CompareHero, {
    pa: profA,
    pb: profB,
    A: A,
    B: B,
    period: period
  }) :
  /*#__PURE__*/
  // Réserve la place du héros le temps d'une image de calcul : pas
  // de saut de mise en page quand le contenu arrive.
  React.createElement("div", {
    "aria-busy": "true",
    "aria-label": "Calcul de la comparaison",
    style: {
      height: 196,
      marginBottom: 14,
      borderRadius: 16,
      background: T.surface2,
      border: `1px solid ${T.rule}`
    }
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
  }, block(sections.volume, CompareRow)), stage >= 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(StatSection, {
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
    sub: "Cat\xE9gories communes, part dans les boissons de chacun",
    collapsed: collapsed,
    toggleSection: toggleSection
  }, sections.categories.length ? sections.categories.map((c, i) => /*#__PURE__*/React.createElement(CompareCategoryRow, {
    key: c.name,
    cat: c,
    names: names,
    first: i === 0
  })) : /*#__PURE__*/React.createElement("div", {
    style: {
      color: T.muted,
      fontSize: 12,
      padding: '10px 4px',
      textAlign: 'center',
      fontStyle: 'italic',
      fontFamily: fontSerif
    }
  }, "Aucune cat\xE9gorie en commun sur cette p\xE9riode"))))), picking && /*#__PURE__*/React.createElement(ComparePersonSheet, {
    side: picking,
    people: people,
    pair: pair,
    onPick: id => pick(picking, id),
    onClose: () => setPicking(null)
  }));
}
Object.assign(window, {
  COMPARE_ME,
  COMPARE_PERIOD_KEY,
  LEADERBOARD_PERIOD_KEY,
  COMPARE_FMT,
  COMPARE_WEEKLY_PERIODS,
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
  compareAllPeriodNote,
  categoryMatchKey,
  editDistance,
  categoriesMatch,
  cachedBACSessions,
  cachedSharedRatings,
  cachedCompareProfile,
  peekCompareProfile,
  cachedLiveBac,
  compareProfileOpts,
  useCompareProfile,
  useComparePersonData,
  CMP_NO_DRINKS,
  storedPeriod,
  afterNextPaint,
  useProgressiveStages,
  onIdle,
  runIdleJobs,
  useFriendsPrewarm
});
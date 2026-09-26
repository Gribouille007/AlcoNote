/* AUTO-GENERATED from proto/stats-charts.jsx — do not edit by hand. */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// stats-charts.jsx — SVG chart primitives for the Statistiques tab.

// Measure a container's content-box width and re-render on resize so a
// chart can size its viewBox to the actual pixel dimensions (no
// preserveAspectRatio whitespace, no truncation).
function useMeasuredWidth(ref, fallback = 320) {
  const [width, setWidth] = React.useState(fallback);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth || el.getBoundingClientRect().width || fallback;
      if (w > 0) setWidth(Math.round(w));
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref, fallback]);
  return width;
}

// Width-measured container for charts: renders `children(width)` once the
// content-box width is known so every chart can draw its viewBox at TRUE
// pixel size (sharp text, no letterbox) instead of a fixed 320 scaled by
// the browser. Generalises the pattern of BACProjectionResponsive.
// `minHeight` reserves the chart's height before the first measurement so
// the surrounding card never reflows; `maxWidth` caps square charts
// that would otherwise swallow the whole card.
function ChartAutoWidth({
  minHeight = 0,
  maxWidth = null,
  children
}) {
  const ref = React.useRef(null);
  let width = useMeasuredWidth(ref, 320);
  if (maxWidth) width = Math.min(width, maxWidth);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    style: {
      width: '100%',
      minHeight,
      display: 'flex',
      justifyContent: 'center'
    }
  }, width > 0 ? children(width) : null);
}

// Rounds an axis maximum up to a "nice" value, given a target tick count.
// The mantissa thresholds round *up* (smallest of 1/2/5/10 ≥ n) so the
// returned max is always ≥ v — otherwise a tall bar/curve overflows the
// top gridline (e.g. the old `n < 1.5 ? 1 …` rounded to nearest and
// returned 30 for v=40, ticks=3).
function chartNiceMax(v, ticks = 4) {
  if (!v) return 1;
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  return step * ticks;
}

// Nice axis maximum + the EXACT value of every gridline. Charts must label
// gridlines from `values` (never `max * fraction` re-rounded): with 3 lines
// and max = 3·step the old `Math.round(max * 0.5)` printed "2" on the 1.5
// gridline. ticks=2 → 3 gridlines (0 / step / 2·step), all exact.
function chartTicks(v, ticks = 2) {
  const max = chartNiceMax(v, ticks);
  const step = max / ticks;
  return {
    max,
    values: Array.from({
      length: ticks + 1
    }, (_, i) => i * step)
  };
}

// Axis-label formatting for tick values: bare integers, one decimal with a
// French comma otherwise (steps like 0.5 happen when the data max is ≤ 1).
function fmtTick(v) {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10).replace('.', ',');
}

// ── CHART : spec unique de la famille de figures ───────────────────
// TOUTE géométrie/typo/trait des primitives SVG vient d'ici — jamais de
// littéral dans un composant (static-checks le vérifie). Les COULEURS ne
// vivent pas ici : elles se lisent `T.*` au render (proxy vivant, suit le
// thème). Modifier une valeur ici repeint toute la famille d'un coup.
const CHART = Object.freeze({
  font: Object.freeze({
    tick: 9,
    // labels d'axe (fontNum)
    ref: 8.5,
    // annotations/références (seuils, ETA, peak moyen, mois)
    tooltip: 10,
    // lignes de ChartTooltip
    center: 11,
    // kicker central du donut
    centerValue: 20,
    // valeur centrale du donut (fontSerif italique)
    centerSub: 9,
    // ligne secondaire sous la valeur centrale
    charW: 5.4 // ≈ px/caractère (Geist Mono à 9 px) — mesure des labels
  }),
  pad: Object.freeze({
    cartesian: Object.freeze({
      t: 16,
      r: 14,
      b: 24,
      l: 36
    }),
    // courbes BAC/lignes
    bar: Object.freeze({
      t: 14,
      r: 6,
      b: 22,
      l: 28
    }) // barres/histogrammes
  }),
  grid: Object.freeze({
    width: 0.6,
    dash: '2 3'
  }),
  dash: Object.freeze({
    future: '5 4',
    // segment projeté d'une courbe
    threshold: '3 3',
    // ligne de seuil (200/500 mg/L)
    reference: '4 4',
    // ligne de référence (peak moyen)
    marker: '1 3',
    // marqueur vertical fin (ETA)
    now: '3 3',
    // marqueur « maintenant »
    truncation: '2 2',
    // bord de troncature
    hair: '2 3',
    // hairline de scrub
    secondary: '3 2' // série secondaire d'un line chart
  }),
  stroke: Object.freeze({
    line: 1.8,
    lineSecondary: 1.5,
    bacPast: 2.4,
    bacFuture: 1.8,
    hair: 0.8,
    threshold: 0.8,
    reference: 1
  }),
  bar: Object.freeze({
    inset: 0.16,
    widthFrac: 0.68,
    rx: 2,
    minH: 2,
    restOpacity: 0.85
  }),
  focus: Object.freeze({
    halo: 11,
    ring: 6,
    dot: 3.5
  }),
  tooltip: Object.freeze({
    minW: 72,
    charW: 5.8,
    lineH: 14,
    headH: 16,
    padX: 8,
    offset: 8,
    edgePad: 8
  }),
  label: Object.freeze({
    minGapX: 8,
    minGapY: 11
  }),
  heatmap: Object.freeze({
    bandAlpha: Object.freeze([0, 0.28, 0.5, 0.72, 1]),
    gapRatio: 0.14,
    // espace inter-cases (fraction du pas) — grilles denses
    gap: 4,
    // espace inter-cases (px) — calendriers 7 colonnes
    headH: 16,
    // bande des libellés de colonnes (L M M J…, 1 5 10…)
    padB: 2,
    rowLabelGap: 6,
    // libellé de ligne ↔ 1ʳᵉ case
    minRowStep: 11,
    // pas vertical mini (lignes « mois » lisibles)
    cellMaxH: Object.freeze({
      month: 38,
      week: 46,
      years: 28
    }),
    dayInsetX: 4,
    dayInsetY: 3,
    // n° du jour dans la case (haut-gauche)
    futureOpacity: 0.45,
    legendSwatch: 10
  }),
  donut: Object.freeze({
    size: 130,
    thickness: 20
  }),
  gauge: Object.freeze({
    size: 140,
    thickness: 10
  }),
  anim: Object.freeze({
    className: 'alco-chart-in'
  }),
  touchAction: 'pan-y'
});

// Plafond d'affichage BAC (mg/L) : cadre des charts (bacChartRange) ET cap
// de la jauge — un pic projeté pathologique ne doit jamais écraser le reste.
const BAC_CHART_CAP = 1500;
// Seuils d'affichage BAC (mg/L) — mêmes valeurs que BAC_RECORD_MIN /
// BAC_LEGAL_LIMIT (stats.jsx, chargé après ce fichier) ; le gel des
// formules verrouille les deux côtés.
const BAC_ZONE_LIGHT = 200;
const BAC_ZONE_LEGAL = 500;

// Couleur de zone BAC (sobre / léger / au-delà) — lit les tokens du thème à
// L'APPEL (T est un proxy vivant). Source unique pour les deux charts BAC,
// leurs dégradés et tout futur indicateur de niveau.
function bacZoneColor(bac) {
  return bac > BAC_ZONE_LEGAL ? T.bacDanger : bac > BAC_ZONE_LIGHT ? T.bacWarn : T.good;
}

// ── Anti-collision : deux textes ne se chevauchent JAMAIS ──────────
// Trois helpers purs (testés) couvrent tous les cas : labels d'axe X
// (thinnedAxisLabels), annotations sur une dimension (resolveLaneLabels),
// texte libre dans un espace borné (fitLabel). Aucun <text> de chart ne se
// positionne « à la main » hors de ces chemins.

// Sélectionne les labels d'axe X à rendre pour qu'AUCUNE paire ne se
// chevauche ni ne déborde de [lo, hi]. `labels[i]` = '' → jamais rendu ;
// `xs[i]` = x du centre du label i. Renvoie [{ i, x, anchor }].
// Invariant (property-testé) : les extents rendus sont espacés ≥ minGap.
// Le DERNIER label de l'axe est prioritaire (il ancre la lecture).
function thinnedAxisLabels(labels, xs, {
  charW = CHART.font.charW,
  minGap = CHART.label.minGapX,
  lo = -Infinity,
  hi = Infinity
} = {}) {
  const cand = [];
  for (let i = 0; i < (labels || []).length; i++) {
    if (labels[i] != null && String(labels[i]) !== '') cand.push(i);
  }
  if (!cand.length) return [];
  const width = i => String(labels[i]).length * charW;
  const maxW = Math.max(...cand.map(width));
  const need = maxW + minGap;
  // Pas uniforme : combien de candidats sauter pour garantir `need` px
  // entre centres (les candidats sont quasi équirépartis sur l'axe).
  let minSlot = Infinity;
  for (let k = 1; k < cand.length; k++) {
    minSlot = Math.min(minSlot, Math.abs(xs[cand[k]] - xs[cand[k - 1]]));
  }
  const step = Number.isFinite(minSlot) && minSlot > 0 ? Math.max(1, Math.ceil(need / minSlot)) : cand.length;
  const picked = [];
  for (let k = 0; k < cand.length; k += step) picked.push(cand[k]);
  const last = cand[cand.length - 1];
  if (picked[picked.length - 1] !== last) picked.push(last);

  // Ancres : centrées par défaut, rabattues au bord si le texte déborde.
  const place = i => {
    const w2 = width(i) / 2;
    let anchor = 'middle';
    if (xs[i] - w2 < lo) anchor = 'start';else if (xs[i] + w2 > hi) anchor = 'end';
    const x0 = anchor === 'start' ? Math.max(lo, xs[i]) : anchor === 'end' ? Math.min(hi, xs[i]) : xs[i];
    const ext = anchor === 'start' ? [x0, x0 + width(i)] : anchor === 'end' ? [x0 - width(i), x0] : [x0 - w2, x0 + w2];
    return {
      i,
      x: x0,
      anchor,
      ext
    };
  };
  // Passe finale de sûreté : l'invariant tient par construction — un label
  // n'est conservé que si son extent ne mord pas le précédent ; le dernier
  // de l'axe évince ses voisins en cas de conflit.
  const out = [];
  for (const k of picked) {
    const it = place(k);
    let ok = true;
    while (out.length) {
      const prev = out[out.length - 1];
      if (it.ext[0] >= prev.ext[1] + minGap) break;
      if (k === last) out.pop();else {
        ok = false;
        break;
      }
    }
    if (ok) out.push(it);
  }
  return out.map(({
    i,
    x,
    anchor
  }) => ({
    i,
    x,
    anchor
  }));
}

// Alloue des annotations sur UNE dimension (« lane ») sans chevauchement.
// items: [{ pos, size, priority, ...libre }] — traités par priorité
// décroissante ; chacun est clampé dans [lo, hi] puis décalé au plus près
// s'il mord un item déjà posé ; ABANDONNÉ si aucun emplacement ne convient
// (mieux vaut un label absent que deux illisibles). Renvoie les items
// acceptés avec leur `pos` finale, dans l'ordre d'entrée.
// Invariant (testé) : |posᵢ − posⱼ| ≥ (sizeᵢ + sizeⱼ)/2 + minGap.
function resolveLaneLabels(items, {
  minGap = CHART.label.minGapY,
  lo = -Infinity,
  hi = Infinity
} = {}) {
  const sorted = (items || []).map((it, idx) => ({
    ...it,
    _idx: idx
  })).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const placed = [];
  for (const it of sorted) {
    const size = it.size || 0;
    const min = lo + size / 2,
      max = hi - size / 2;
    if (min > max) continue;
    const conflict = p => placed.find(o => Math.abs(p - o.pos) < (size + o.size) / 2 + minGap);
    let pos = Math.max(min, Math.min(max, it.pos));
    if (conflict(pos)) {
      // Emplacements candidats : juste au-dessus / en dessous de chaque item
      // posé ; on garde le plus proche de la position souhaitée.
      const options = [];
      for (const o of placed) {
        const before = o.pos - (size + o.size) / 2 - minGap;
        const after = o.pos + (size + o.size) / 2 + minGap;
        if (before >= min && !conflict(before)) options.push(before);
        if (after <= max && !conflict(after)) options.push(after);
      }
      if (!options.length) continue;
      pos = options.reduce((best, p) => Math.abs(p - it.pos) < Math.abs(best - it.pos) ? p : best);
    }
    placed.push({
      ...it,
      pos,
      size
    });
  }
  return placed.sort((a, b) => a._idx - b._idx).map(({
    _idx,
    ...it
  }) => it);
}

// Tronque un texte libre avec « … » pour tenir dans `maxPx` (approximation
// monospace `charW` px/caractère). Tout texte non contraint par l'axe
// (centre du donut, libellés arbitraires) passe par ici.
function fitLabel(text, maxPx, charW = CHART.font.charW) {
  const s = String(text == null ? '' : text);
  const maxChars = Math.floor(maxPx / charW);
  if (s.length <= maxChars) return s;
  if (maxChars <= 1) return '…';
  return s.slice(0, maxChars - 1).trimEnd() + '…';
}

// Légende partagée sous un chart multi-séries (≥ 2 séries — une série
// seule n'a pas de légende, le titre de la card la nomme). Pastille ou
// segment COLORÉ + libellé en encre : le texte ne porte jamais la couleur
// de série (DA). items: [{ label, color, dashed?, dot? }].
function ChartLegend({
  items
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      justifyContent: 'center',
      marginTop: 8,
      fontSize: 10.5,
      color: T.ink2,
      flexWrap: 'wrap'
    }
  }, items.map(it => /*#__PURE__*/React.createElement("span", {
    key: it.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, it.dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 99,
      background: it.color
    }
  }) : it.dashed ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 2,
      backgroundImage: `repeating-linear-gradient(90deg, ${it.color} 0 3px, transparent 3px 5px)`
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 14,
      height: 2,
      background: it.color
    }
  }), it.label)));
}

// Adaptive framing for the two BAC curves so they always fill the view
// ("meilleure vue possible"), shared by SvgBACProjection and SvgBACForecast.
//   points        : [{ t (hours rel. now), bac (mg/L) }]
//   extras        : values that MUST stay on-screen (e.g. the mean peak line)
//   keepRiseFocus : trim the X window to [start .. peak + 1.5 h] so a long
//                   elimination tail can't squeeze the rise into a sliver
//                   (forecast only; the projection chart shows to sobriety)
//   capRunaway    : clamp a pathological projected peak so it can't flatten
//                   the rest of the curve — never below the `extras`
// Returns { minT, maxT, maxB } with a true-zero baseline (BAC is absolute).
function bacChartRange(points, {
  extras = [],
  keepRiseFocus = false,
  capRunaway = false
} = {}) {
  const pts = points && points.length ? points : [];
  const safeExtras = extras.filter(v => v != null && v > 0);

  // Y: peak of the data + any forced extras, with anti-runaway clamp.
  const dataPeak = pts.length ? Math.max(...pts.map(p => p.bac)) : 0;
  let peak = Math.max(0, dataPeak, ...safeExtras);
  if (capRunaway) peak = Math.min(peak, Math.max(BAC_CHART_CAP, ...safeExtras));
  // 15 % headroom; 80 mg/L floor so a tiny curve fills the height instead
  // of sitting as a flat line at the bottom.
  const maxB = chartNiceMax(Math.max(80, peak * 1.15), 4);

  // X: full span, or [start .. peak + 1.5 h] when focusing the rise.
  let minT = pts.length ? pts[0].t : 0;
  let maxT = pts.length ? pts[pts.length - 1].t : 1;
  if (keepRiseFocus && pts.length) {
    let peakT = pts[0].t,
      peakV = -Infinity;
    for (const p of pts) if (p.bac > peakV) {
      peakV = p.bac;
      peakT = p.t;
    }
    maxT = Math.min(maxT, Math.max(peakT + 1.5, 1.5));
  }
  return {
    minT,
    maxT,
    maxB
  };
}

// Shared scrubber for charts. Tracks the pointer, projects it from
// client-coordinates back to the SVG's viewBox, and exposes the closest
// data index along with the active flag (only true while the user is
// actively dragging or hovering).
//
// Robustness vs. the previous version:
//  - We track the active pointer id so a second finger landing on the
//    SVG mid-scrub never replaces the first (multi-touch sanity).
//  - A window-level pointerup/cancel listener guarantees we always
//    release, even when setPointerCapture silently failed (some
//    browsers drop capture across re-mounts) and the up event fires
//    outside the SVG.
//  - We only preventDefault on touch moves while actively dragging —
//    this lets vertical scrolling on the page-as-a-whole stay smooth
//    until the user actually grips the chart.
//  - The scrub jumps to the touch point on pointerdown so the ball is
//    under the finger on the very first frame.
function useChartScrubber(svgRef, _unused, onChange) {
  const [active, setActive] = React.useState(false);
  const draggingRef = React.useRef(false);
  const pointerIdRef = React.useRef(null);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  const project = e => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const vbX = vb[0] || 0,
      vbY = vb[1] || 0;
    const vbW = vb[2] || rect.width;
    const vbH = vb[3] || rect.height;
    // A malformed/zero-sized viewBox would make `scale` 0 or NaN below and
    // poison every projected coordinate — bail out instead.
    if (!(vbW > 0) || !(vbH > 0)) return null;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    // Invert the default preserveAspectRatio="xMidYMid meet": the viewBox is
    // scaled UNIFORMLY to fit the element box and centered, so whenever the
    // rendered box has a different aspect than the viewBox (square radar /
    // polar clock drawn at width:100% height:size, or any fixed-viewBox chart
    // in a container wider than the viewBox) the content is letterboxed. A
    // plain px→viewBox linear map ignores that offset and skews off-center
    // taps — e.g. the radar/clock pick the wrong weekday/hour. Charts whose
    // box already matches the viewBox aspect (the width-measured BAC charts)
    // get scale≈1 and zero offset, so this reduces to the old behaviour.
    const scale = Math.min(rect.width / vbW, rect.height / vbH);
    const offX = (rect.width - vbW * scale) / 2;
    const offY = (rect.height - vbH * scale) / 2;
    return {
      x: vbX + (px - offX) / scale,
      y: vbY + (py - offY) / scale,
      pxRect: rect
    };
  };

  // Window-level safety net: if the OS swallows pointerup (capture
  // dropped, page scrolled the SVG out, …) we still want to release.
  React.useEffect(() => {
    const release = e => {
      if (!draggingRef.current) return;
      if (pointerIdRef.current != null && e && e.pointerId !== pointerIdRef.current) return;
      draggingRef.current = false;
      pointerIdRef.current = null;
      setActive(false);
      onChangeRef.current && onChangeRef.current(null);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);
  const onPointerDown = e => {
    // Ignore additional pointers while one is already scrubbing; the
    // first finger keeps control until it releases.
    if (draggingRef.current && pointerIdRef.current !== e.pointerId) return;
    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    setActive(true);
    try {
      if (e.currentTarget && e.currentTarget.setPointerCapture) {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    } catch {}
    const p0 = project(e);
    if (p0) onChangeRef.current && onChangeRef.current(p0);
  };
  const onPointerMove = e => {
    if (draggingRef.current) {
      if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
      const p = project(e);
      if (!p) return;
      // Only block default behavior while actively dragging on touch —
      // this prevents the page scroll from fighting with the scrub but
      // still lets a passive vertical swipe scroll the page when the
      // finger is just hovering over the chart.
      if (e.pointerType === 'touch' && e.cancelable) e.preventDefault();
      onChangeRef.current && onChangeRef.current(p);
      return;
    }
    // Hover (mouse only): touch devices don't fire hover so we ignore
    // them here and let pointerdown drive the scrub.
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
    const p = project(e);
    if (!p) return;
    onChangeRef.current && onChangeRef.current(p);
  };
  const onPointerUp = e => {
    if (pointerIdRef.current != null && e.pointerId !== pointerIdRef.current) return;
    draggingRef.current = false;
    pointerIdRef.current = null;
    setActive(false);
    onChangeRef.current && onChangeRef.current(null);
    try {
      if (e.currentTarget && e.currentTarget.releasePointerCapture) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  // pointerleave: clear hover (mouse). While dragging on touch, pointer
  // capture keeps events flowing even when the finger drifts off — so
  // we explicitly do nothing.
  const onPointerLeave = e => {
    if (draggingRef.current) return;
    setActive(false);
    onChangeRef.current && onChangeRef.current(null);
  };
  return {
    active,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onPointerCancel: onPointerUp
    }
  };
}

// Pure tooltip layout, separated from the component so it can be unit-tested
// without a renderer. Sizes the box to the longest line (Geist Mono at
// fontSize 10 ≈ 5.8 viewBox units per char) instead of a fixed 110 that long
// labels used to overflow, prefers sitting above the focus point, flips BELOW
// it when that would clip the top edge, and clamps inside
// [pad .. width/height − pad] on both axes.
function chartTooltipLayout({
  x,
  y,
  lines,
  width,
  height = null,
  pad = CHART.tooltip.edgePad
}) {
  const {
    minW,
    charW,
    lineH,
    headH,
    offset
  } = CHART.tooltip;
  const maxChars = Math.max(0, ...lines.map(l => String(l).length));
  const w = Math.max(minW, Math.min(width - 2 * pad, headH + maxChars * charW));
  const h = headH + lines.length * lineH;
  let tx = x + offset;
  if (tx + w > width - pad) tx = x - w - offset;
  // Flipping left near the left edge can push tx negative (tooltip clips
  // the SVG edge); clamp it back inside the viewBox.
  tx = Math.max(pad, Math.min(tx, width - w - pad));
  let ty = y - h - 6;
  if (ty < pad) ty = y + lineH;
  if (height != null) ty = Math.max(pad, Math.min(ty, height - h - pad));
  return {
    tx,
    ty,
    w,
    h
  };
}

// Floating chart tooltip rendered as native SVG (rect + text) so it
// renders identically across browsers (no foreignObject quirks).
function ChartTooltip({
  x,
  y,
  lines,
  width = 320,
  height = null,
  pad = CHART.tooltip.edgePad
}) {
  const {
    tx,
    ty,
    w,
    h
  } = chartTooltipLayout({
    x,
    y,
    lines,
    width,
    height,
    pad
  });
  const {
    lineH,
    padX
  } = CHART.tooltip;
  return /*#__PURE__*/React.createElement("g", {
    pointerEvents: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    x: tx,
    y: ty,
    width: w,
    height: h,
    rx: 6,
    fill: T.surface3 || T.surface2,
    stroke: T.rule,
    strokeWidth: CHART.grid.width,
    opacity: 0.95
  }), lines.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: tx + padX,
    y: ty + lineH + i * lineH,
    fontSize: CHART.font.tooltip,
    fill: i === 0 ? T.ink : T.ink2,
    fontFamily: fontNum
  }, l)));
}

// ── Bar chart (hourly distribution) ───────────────────────────────
function SvgBarChart({
  data,
  width = 320,
  height = 140,
  color,
  formatX,
  formatTooltip,
  valueLabel,
  ariaLabel = 'Diagramme en barres'
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  const pad = CHART.pad.bar;
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const yT = chartTicks(Math.max(1, ...data.map(d => d.v)), 2);
  const max = yT.max;
  const bw = w / Math.max(1, data.length);
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p || !data.length) {
      setHover(null);
      return;
    }
    const i = Math.max(0, Math.min(data.length - 1, Math.floor((p.x - pad.l) / bw)));
    setHover(i);
  });
  // After the hooks so a later render with data keeps the hook order.
  if (!data.length) return null;
  // Labels X : `formatX` choisit le TEXTE ('' pour proposer de cacher),
  // puis thinnedAxisLabels garantit zéro chevauchement quoi qu'il arrive.
  const xLabels = data.map((d, i) => String((formatX ? formatX(d, i) : d.label) || ''));
  const xCenters = data.map((_, i) => pad.l + i * bw + bw / 2);
  const shownLabels = thinnedAxisLabels(xLabels, xCenters, {
    lo: pad.l,
    hi: width - pad.r
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": ariaLabel,
    className: CHART.anim.className,
    style: {
      display: 'block',
      touchAction: CHART.touchAction
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), yT.values.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: width - pad.r,
    y1: pad.t + h * (1 - v / max),
    y2: pad.t + h * (1 - v / max),
    stroke: T.rule,
    strokeDasharray: CHART.grid.dash,
    strokeWidth: CHART.grid.width
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - v / max) + 3,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, fmtTick(v)))), data.map((d, i) => {
    const bh = d.v > 0 ? Math.max(CHART.bar.minH, d.v / max * h) : 0;
    if (bh <= 0) return null;
    const x = pad.l + i * bw + bw * CHART.bar.inset;
    const y = pad.t + h - bh;
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: x,
      y: y,
      width: bw * CHART.bar.widthFrac,
      height: bh,
      fill: color || T.accent,
      rx: CHART.bar.rx,
      opacity: hover === i ? 1 : CHART.bar.restOpacity
    });
  }), shownLabels.map(({
    i,
    x,
    anchor
  }) => /*#__PURE__*/React.createElement("text", {
    key: `xl-${i}`,
    x: x,
    y: height - 8,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: anchor,
    fontFamily: fontNum
  }, xLabels[i])), hover != null && (() => {
    const d = data[hover];
    const tx = pad.l + hover * bw + bw / 2;
    const ty = pad.t + h - d.v / max * h;
    const lines = formatTooltip ? formatTooltip(d, hover) : [`${d.label}`, `${d.v}${valueLabel ? ' ' + valueLabel : ''}`];
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: tx,
      x2: tx,
      y1: pad.t,
      y2: pad.t + h,
      stroke: T.accent,
      strokeDasharray: CHART.dash.hair,
      strokeWidth: CHART.stroke.hair,
      opacity: 0.6
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: ty,
      r: CHART.focus.dot,
      fill: T.accent
    }), /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: ty,
      lines: lines,
      width: width,
      height: height
    }));
  })());
}

// ── Donut chart (category distribution) ───────────────────────────
// Géométrie des segments extraite (pure, testable) : angles + chemins SVG.
// `total` = 0 → aucun segment (l'ancien `|| 1` affichait un faux « 1 » au
// centre d'un donut vide).
function donutSegments(data, cx, cy, r) {
  const total = (data || []).reduce((s, d) => s + d.v, 0);
  const segments = [];
  if (!(total > 0)) return {
    total: 0,
    segments
  };
  let acc = 0;
  for (const d of data) {
    const a0 = acc / total * Math.PI * 2 - Math.PI / 2;
    const a1 = (acc + d.v) / total * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + Math.cos(a0) * r,
      y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r,
      y1 = cy + Math.sin(a1) * r;
    const large = d.v / total > 0.5 ? 1 : 0;
    segments.push({
      d,
      a0,
      a1,
      path: `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`
    });
    acc += d.v;
  }
  return {
    total,
    segments
  };
}
function SvgDonut({
  data,
  size = CHART.donut.size,
  thickness = CHART.donut.thickness,
  ariaLabel = 'Répartition par catégorie'
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  useCatPalette(); // idem sur changement de teinte de catégorie (registre CAT)
  const cx = size / 2,
    cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const {
    total,
    segments
  } = donutSegments(data, cx, cy, r);
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p || !segments.length) {
      setHover(null);
      return;
    }
    const dx = p.x - cx,
      dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Generous hit band (entire ring + a comfortable inner/outer
    // tolerance) so a tap close to the donut still selects the
    // segment instead of clearing the focus.
    if (dist < r - thickness * 1.1 || dist > r + thickness * 1.1) {
      setHover(null);
      return;
    }
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += 2 * Math.PI;
    const idx = segments.findIndex(s => a >= s.a0 && a <= s.a1);
    setHover(idx >= 0 ? idx : null);
  });

  // Après les hooks : un donut sans donnée affiche un état vide honnête.
  if (!segments.length) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 11,
        padding: '20px 0',
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: fontSerif
      }
    }, "Aucune donn\xE9e");
  }
  const focused = hover != null ? segments[hover] : null;
  const focusedPct = focused ? Math.round(focused.d.v / total * 100) : null;
  // Le label central vit dans le TROU du donut : tronqué à son diamètre
  // utile pour ne jamais passer sous l'anneau (fitLabel, anti-collision).
  const centerMaxPx = 2 * (r - thickness / 2) - 6;
  const centerLabel = fitLabel((focused ? focused.d.name : 'Total').toUpperCase(), centerMaxPx);
  return (
    /*#__PURE__*/
    // Seul chart à taille FIXE assumée : c'est un glyphe carré posé à côté
    // de sa légende (flexShrink:0), pas un chart pleine largeur — un width
    // 100% s'effondrerait dans ce conteneur sans largeur propre.
    React.createElement("svg", _extends({
      ref: svgRef,
      viewBox: `0 0 ${size} ${size}`,
      width: size,
      height: size,
      role: "img",
      "aria-label": ariaLabel,
      className: CHART.anim.className,
      style: {
        display: 'block',
        touchAction: CHART.touchAction
      }
    }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
      x: "0",
      y: "0",
      width: size,
      height: size,
      fill: "transparent"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: cx,
      cy: cy,
      r: r,
      fill: "none",
      stroke: T.rule,
      strokeWidth: thickness
    }), segments.map((s, i) => {
      // A lone segment spans the whole circle: its arc start/end points
      // coincide and render as nothing, so draw a full ring instead.
      // (A 99.9% slice alongside others still draws fine as an arc.)
      const common = {
        stroke: catColor(s.d.name, 65),
        strokeWidth: thickness * (hover === i ? 1.12 : 1),
        opacity: hover != null && hover !== i ? 0.45 : 1
      };
      return segments.length === 1 ? /*#__PURE__*/React.createElement("circle", _extends({
        key: i,
        cx: cx,
        cy: cy,
        r: r,
        fill: "none"
      }, common)) : /*#__PURE__*/React.createElement("path", _extends({
        key: i,
        d: s.path,
        fill: "none",
        strokeLinecap: "butt"
      }, common));
    }), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: cy - 4,
      fontSize: CHART.font.center,
      fill: T.muted,
      textAnchor: "middle",
      letterSpacing: "1",
      fontFamily: fontSans
    }, centerLabel), /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: cy + 14,
      fontSize: CHART.font.centerValue,
      fill: T.ink,
      textAnchor: "middle",
      fontFamily: fontSerif,
      fontStyle: "italic"
    }, focused ? `${focused.d.v}` : Math.round(total)), focused && /*#__PURE__*/React.createElement("text", {
      x: cx,
      y: cy + 28,
      fontSize: CHART.font.centerSub,
      fill: T.muted,
      textAnchor: "middle",
      fontFamily: fontNum
    }, focusedPct, "%"))
  );
}

// ── Line chart (une échelle commune, 1 ou 2 séries) ───────────────
// UN SEUL axe Y, toujours : deux mesures d'échelles différentes ne
// partagent jamais un chart (règle dataviz — l'ancien mode double axe a
// été retiré). Série 0 : trait plein + aire dégradée (T.accent) ; série 1
// (optionnelle) : pointillée (T.accent2), sur la MÊME échelle. La légende
// vit HORS du SVG (ChartLegend, ≥ 2 séries seulement). `extraLines(i)`
// ajoute des lignes de contexte à la tooltip (ex. « N verres »).
function SvgLineChart({
  series,
  labels,
  width = 320,
  height = 170,
  tooltipUnits = [],
  extraLines = null,
  ariaLabel = 'Courbe d\'évolution'
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  // Traits de série teintés via catColor → abonnement palette (React.memo
  // bloquerait sinon le repaint sur changement de teinte, cf. useCatPalette).
  useCatPalette();
  const idSuffix = React.useId().replace(/:/g, '');
  const pad = CHART.pad.cartesian;
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const allSeries = (series || []).filter(s => s && Array.isArray(s.data));
  const yT = chartTicks(Math.max(1, ...allSeries.flatMap(s => s.data)), 2);
  const max = yT.max;
  const n = (labels || []).length;
  const xs = i => pad.l + i / Math.max(1, n - 1) * w;
  const pathFor = data => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${pad.t + h * (1 - v / max)}`).join(' ');
  const areaFor = data => pathFor(data) + ` L${xs(n - 1)},${pad.t + h} L${xs(0)},${pad.t + h} Z`;
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setHover(null);
      return;
    }
    const rel = (p.x - pad.l) / w;
    const i = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
    setHover(i);
  });

  // A single point can't form a line — render nothing (after the hooks).
  if (n < 2 || !allSeries.length) return null;
  const s0 = allSeries[0];
  const s1 = allSeries[1] || null;
  // Labels X : sélection anti-collision (l'ancien code rendait TOUS les
  // labels — 30 jours de cumul = bouillie illisible garantie).
  const xLabels = labels.map(l => String(l == null ? '' : l));
  const xCenters = labels.map((_, i) => xs(i));
  const shownLabels = thinnedAxisLabels(xLabels, xCenters, {
    lo: pad.l,
    hi: width - pad.r
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": ariaLabel,
    className: CHART.anim.className,
    style: {
      display: 'block',
      touchAction: CHART.touchAction
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: `lg-a-${idSuffix}`,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: T.accent,
    stopOpacity: 0.35
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: T.accent,
    stopOpacity: 0
  }))), yT.values.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: pad.t + h * (1 - v / max),
    y2: pad.t + h * (1 - v / max),
    stroke: T.rule,
    strokeDasharray: CHART.grid.dash,
    strokeWidth: CHART.grid.width
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - v / max) + 3,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, fmtTick(v)))), /*#__PURE__*/React.createElement("path", {
    d: areaFor(s0.data),
    fill: `url(#lg-a-${idSuffix})`
  }), /*#__PURE__*/React.createElement("path", {
    d: pathFor(s0.data),
    fill: "none",
    stroke: T.accent,
    strokeWidth: CHART.stroke.line,
    strokeLinejoin: "round"
  }), s1 && /*#__PURE__*/React.createElement("path", {
    d: pathFor(s1.data),
    fill: "none",
    stroke: T.accent2,
    strokeWidth: CHART.stroke.lineSecondary,
    strokeDasharray: CHART.dash.secondary,
    strokeLinejoin: "round"
  }), shownLabels.map(({
    i,
    x,
    anchor
  }) => /*#__PURE__*/React.createElement("text", {
    key: `xl-${i}`,
    x: x,
    y: height - 8,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: anchor,
    fontFamily: fontNum
  }, xLabels[i])), hover != null && (() => {
    const tx = xs(hover);
    const v0 = s0.data[hover];
    const cy0 = pad.t + h * (1 - v0 / max);
    const v1 = s1 ? s1.data[hover] : null;
    const cy1 = s1 ? pad.t + h * (1 - v1 / max) : null;
    const lines = [`${labels[hover]}`, `${v0}${tooltipUnits[0] ? ' ' + tooltipUnits[0] : ''}`, ...(s1 ? [`${v1}${tooltipUnits[1] ? ' ' + tooltipUnits[1] : ''}`] : []), ...(extraLines ? extraLines(hover) : [])];
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: tx,
      x2: tx,
      y1: pad.t,
      y2: pad.t + h,
      stroke: T.ink2,
      strokeDasharray: CHART.dash.hair,
      strokeWidth: CHART.stroke.hair,
      opacity: 0.7
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: cy0,
      r: CHART.focus.dot,
      fill: T.accent,
      stroke: T.surface,
      strokeWidth: 1.2
    }), s1 && /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: cy1,
      r: CHART.focus.dot,
      fill: T.accent2,
      stroke: T.surface,
      strokeWidth: 1.2
    }), /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: s1 ? Math.min(cy0, cy1) : cy0,
      width: width,
      height: height,
      lines: lines
    }));
  })());
}
// ── BAC projection curve ──────────────────────────────────────────
// Scrubbable: dragging the finger across the curve reveals the BAC at
// any moment. The ball position and tooltip BAC are linearly
// interpolated between samples so the dot follows the finger smoothly.
// Past = solid stroke with vertical gradient; future = dashed stroke;
// the gradient runs green → orange → red so the curve is coloured by
// its BAC level at every point without splitting into segments.
function SvgBACProjection({
  points,
  width = 320,
  height = 200,
  nowMs = Date.now()
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  // Hooks always run first and unconditionally so React's hook order
  // stays stable even when the component is rendered with empty input.
  const idSuffix = React.useId().replace(/:/g, '');
  const svgRef = React.useRef(null);
  const [scrubT, setScrubT] = React.useState(null);
  const safePoints = points && points.length > 0 ? points : null;
  const pad = CHART.pad.cartesian;
  const w = width - pad.l - pad.r;
  // Adaptive framing — full span to sobriety; a small curve still fills the
  // height ; un pic pathologique est plafonné (BAC_CHART_CAP) comme sur la
  // prévision. Computed before the scrubber, which closes over minT/maxT.
  const {
    minT,
    maxT,
    maxB
  } = bacChartRange(safePoints, {
    capRunaway: true
  });

  // The scrubber is a hook (uses useState internally), so it must be
  // called every render — even when `safePoints` is null. We close over
  // `minT`/`maxT` which are safe defaults in the empty case.
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setScrubT(null);
      return;
    }
    // Clamp the projected x to the plot area so the focus ball never
    // ends up off the curve when the finger overshoots the SVG bounds.
    const clampedX = Math.max(pad.l, Math.min(pad.l + w, p.x));
    const t = minT + (clampedX - pad.l) / Math.max(1, w) * (maxT - minT);
    setScrubT(Math.max(minT, Math.min(maxT, t)));
  });

  // Bail out cleanly when there's nothing to draw. All hooks above have
  // already run, so subsequent renders with non-empty input keep their
  // hook order intact.
  if (!safePoints) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 11,
        padding: '20px 0',
        textAlign: 'center'
      }
    }, "Aucune donn\xE9e d'alcool\xE9mie");
  }
  const h = height - pad.t - pad.b;
  const xs = t => pad.l + (t - minT) / Math.max(0.001, maxT - minT) * w;
  const ys = b => pad.t + h * (1 - b / maxB);
  // Clamp rendu : un pic au-delà du cadre (capRunaway) longe le bord haut
  // au lieu de sortir du viewBox (la tooltip garde la vraie valeur).
  const yc = b => ys(Math.min(b, maxB));
  const baseY = pad.t + h;

  // Couleurs de zone : tokens du thème (T.bacWarn / T.bacDanger), source
  // unique via bacZoneColor — plus AUCUN littéral oklch ici.
  const safe = T.good;
  const warn = T.bacWarn;
  const danger = T.bacDanger;
  const gradStrokeId = `bac-stroke-${idSuffix}`;
  const gradAreaId = `bac-area-${idSuffix}`;

  // Build a vertical gradient that matches the threshold colors. Stops
  // are placed exactly at the zone thresholds so the colour transitions
  // line up with the threshold lines. y goes 0 (top, max BAC) → 1 (bottom, 0).
  const stopLegal = 1 - Math.min(1, BAC_ZONE_LEGAL / maxB);
  const stopLight = 1 - Math.min(1, BAC_ZONE_LIGHT / maxB);
  const gradStops = (alpha = 1) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLegal * 100).toFixed(2)}%`,
    stopColor: danger,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLegal * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLight * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLight * 100).toFixed(2)}%`,
    stopColor: safe,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: safe,
    stopOpacity: alpha
  }));

  // Split into past (t ≤ 0) and future (t > 0). Include t=0 in both so
  // the visual transition between solid and dashed has no gap.
  const nowIdx = (() => {
    for (let i = 0; i < safePoints.length; i++) if (safePoints[i].t >= 0) return i;
    return safePoints.length - 1;
  })();
  const past = safePoints.slice(0, Math.max(1, nowIdx + 1));
  const future = safePoints.slice(nowIdx);
  const pathOf = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t)},${yc(p.bac)}`).join(' ');
  const areaOf = pts => pathOf(pts) + ` L${xs(pts[pts.length - 1].t)},${baseY} L${xs(pts[0].t)},${baseY} Z`;

  // Labels de seuil : posés dans une « lane » verticale au bord droit via
  // resolveLaneLabels — deux seuils proches (petit cadre) ne se chevauchent
  // jamais, le moins prioritaire saute (sa ligne reste).
  const thresh = [{
    y: BAC_ZONE_LIGHT,
    label: `${BAC_ZONE_LIGHT} mg/L`,
    color: warn,
    priority: 1
  }, {
    y: BAC_ZONE_LEGAL,
    label: `${BAC_ZONE_LEGAL} légal`,
    color: danger,
    priority: 2
  }].filter(l => l.y <= maxB);
  const threshLabels = resolveLaneLabels(thresh.map(l => ({
    ...l,
    pos: ys(l.y) - 3,
    size: CHART.font.ref
  })), {
    lo: pad.t,
    hi: baseY
  });

  // Linear interpolation between adjacent samples → smooth ball motion.
  const interpAt = t => {
    if (t <= safePoints[0].t) return {
      t,
      bac: safePoints[0].bac
    };
    if (t >= safePoints[safePoints.length - 1].t) return {
      t,
      bac: safePoints[safePoints.length - 1].bac
    };
    let lo = 0,
      hi = safePoints.length - 1;
    while (hi - lo > 1) {
      const mid = lo + hi >> 1;
      if (safePoints[mid].t <= t) lo = mid;else hi = mid;
    }
    const a = safePoints[lo],
      b = safePoints[hi];
    const frac = (t - a.t) / Math.max(1e-9, b.t - a.t);
    return {
      t,
      bac: a.bac + (b.bac - a.bac) * frac
    };
  };
  const focusT = scrubT != null ? scrubT : 0;
  const focus = interpAt(focusT);
  const focusColor = bacZoneColor(focus.bac);
  const fmtClock = t => {
    const d = new Date(nowMs + t * 3600_000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  const ticksX = (() => {
    const out = [];
    for (let i = 0; i < 4; i++) out.push(minT + (maxT - minT) * (i / 3));
    return out;
  })();
  const fmtRel = t => {
    const minutes = Math.round(Math.abs(t) * 60);
    if (minutes < 1) return 'maintenant';
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    const phrase = hh === 0 ? `${mm}min` : mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
    return t < 0 ? `il y a ${phrase}` : `dans ${phrase}`;
  };
  const fmtStatus = b => b > BAC_ZONE_LEGAL ? 'Au-delà' : b > BAC_ZONE_LIGHT ? 'Léger' : 'Sobre';
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": "Projection d'alcool\xE9mie dans le temps",
    className: CHART.anim.className,
    style: {
      display: 'block',
      touchAction: CHART.touchAction
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gradStrokeId,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, gradStops(1)), /*#__PURE__*/React.createElement("linearGradient", {
    id: gradAreaId,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, gradStops(0.28), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: safe,
    stopOpacity: 0
  }))), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: pad.t + h * (1 - f),
    y2: pad.t + h * (1 - f),
    stroke: T.rule,
    strokeDasharray: CHART.grid.dash,
    strokeWidth: CHART.grid.width,
    opacity: 0.6
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - f) + 3,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, fmtTick(Math.round(maxB * f))))), thresh.map((l, i) => /*#__PURE__*/React.createElement("line", {
    key: `th-${i}`,
    x1: pad.l,
    x2: pad.l + w,
    y1: ys(l.y),
    y2: ys(l.y),
    stroke: l.color,
    strokeDasharray: CHART.dash.threshold,
    strokeWidth: CHART.stroke.threshold,
    opacity: 0.55
  })), threshLabels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: `thl-${i}`,
    x: pad.l + w - 2,
    y: l.pos,
    fontSize: CHART.font.ref,
    fill: l.color,
    textAnchor: "end",
    fontFamily: fontNum
  }, l.label)), past.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: areaOf(past),
    fill: `url(#${gradAreaId})`
  }), past.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(past),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: CHART.stroke.bacPast,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), future.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(future),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: CHART.stroke.bacFuture,
    strokeOpacity: 0.75,
    strokeDasharray: CHART.dash.future,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("line", {
    x1: xs(0),
    x2: xs(0),
    y1: pad.t,
    y2: baseY,
    stroke: T.ink2,
    strokeWidth: CHART.stroke.reference,
    strokeDasharray: CHART.dash.now,
    opacity: 0.5
  }), ticksX.map((t, i) => {
    const last = ticksX.length - 1;
    const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
    const dx = i === 0 ? 1 : i === last ? -1 : 0;
    return /*#__PURE__*/React.createElement("text", {
      key: i,
      x: xs(t) + dx,
      y: height - 10,
      fontSize: CHART.font.tick,
      fill: T.muted,
      textAnchor: anchor,
      fontFamily: fontNum
    }, fmtClock(t));
  }), scrubT == null && 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("text", {
    x: xs(0),
    y: pad.t - 6,
    fontSize: CHART.font.tick,
    fill: T.ink2,
    textAnchor: "middle",
    fontFamily: fontNum
  }, "maintenant"), focus && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: xs(focus.t),
    x2: xs(focus.t),
    y1: yc(focus.bac),
    y2: baseY,
    stroke: focusColor,
    strokeWidth: 1,
    opacity: 0.35
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: CHART.focus.halo,
    fill: focusColor,
    fillOpacity: 0.2
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: CHART.focus.ring,
    fill: T.bg,
    stroke: focusColor,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: CHART.focus.dot,
    fill: focusColor
  }), /*#__PURE__*/React.createElement(ChartTooltip, {
    x: xs(focus.t),
    y: yc(focus.bac),
    width: width,
    height: height,
    lines: [`${Math.round(focus.bac)} mg/L`, fmtStatus(focus.bac), fmtRel(focus.t)]
  })));
}
// ── BAC forecast (current session projection vs. historical baseline) ──
// Plots two segments on the same axes:
//   • realPoints (t ≤ 0)        : the BAC actually realized so far in
//     the current session (solid stroke, gradient by level).
//   • projectedPoints (t ≥ 0)   : the BAC if the user keeps drinking
//     at `currentRateGph` until the estimated session end, then linear
//     elimination at 150 mg/L/h (dashed stroke, same gradient).
// On top of that:
//   • A horizontal reference line at `meanPeakBac` (mean of past peaks).
//   • A vertical marker at `etaPeakHours` (when the projection crosses
//     the historical peak). When the projection never reaches the peak,
//     the marker is anchored at the right edge with an "∞" label so the
//     "always shown" contract is honored.
// The scrubber sweeps across the merged real+projected series so the
// tooltip follows the finger smoothly from past to future.
function SvgBACForecast({
  realPoints,
  projectedPoints,
  meanPeakBac,
  etaPeakHours,
  truncated = false,
  width = 320,
  height = 200,
  nowMs = Date.now()
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  const idSuffix = React.useId().replace(/:/g, '');
  const svgRef = React.useRef(null);
  const [scrubT, setScrubT] = React.useState(null);
  const safeReal = realPoints && realPoints.length > 0 ? realPoints : null;
  const safeProj = projectedPoints && projectedPoints.length > 0 ? projectedPoints : null;
  const hasAnyCurve = !!(safeReal || safeProj);
  const merged = React.useMemo(() => {
    const a = safeReal || [];
    const b = safeProj || [];
    // Drop the duplicate t=0 sample if both series carry one.
    if (a.length && b.length && Math.abs(a[a.length - 1].t - b[0].t) < 1e-6) {
      return a.concat(b.slice(1));
    }
    return a.concat(b);
  }, [safeReal, safeProj]);
  const pad = CHART.pad.cartesian;
  const w = width - pad.l - pad.r;
  // Adaptive framing — show the WHOLE curve down to its return to 0 (no
  // keepRiseFocus trim: the projected tail must fit, not end mid-air at the
  // right edge), keep the mean-peak line on-screen, and clamp a runaway
  // projected peak on Y. Computed before the scrubber, which closes over
  // minT/maxT. `computeBacForecast` already bounds the curve length (and
  // sets `truncated` when its safety horizon clipped the tail).
  const {
    minT,
    maxT,
    maxB
  } = bacChartRange(merged, {
    extras: [meanPeakBac],
    capRunaway: true
  });
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setScrubT(null);
      return;
    }
    const clampedX = Math.max(pad.l, Math.min(pad.l + w, p.x));
    const t = minT + (clampedX - pad.l) / Math.max(1, w) * (maxT - minT);
    setScrubT(Math.max(minT, Math.min(maxT, t)));
  });
  if (!hasAnyCurve) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        color: T.muted,
        fontSize: 11,
        padding: '20px 0',
        textAlign: 'center'
      }
    }, "Aucune donn\xE9e pour la pr\xE9vision");
  }
  const h = height - pad.t - pad.b;
  const xs = t => pad.l + (t - minT) / Math.max(0.001, maxT - minT) * w;
  const ys = b => pad.t + h * (1 - b / maxB);
  const baseY = pad.t + h;

  // Couleurs de zone : tokens du thème — plus AUCUN littéral oklch ici.
  const safe = T.good;
  const warn = T.bacWarn;
  const danger = T.bacDanger;
  const gradStrokeId = `bacf-stroke-${idSuffix}`;
  const gradAreaId = `bacf-area-${idSuffix}`;
  const stopLegal = 1 - Math.min(1, BAC_ZONE_LEGAL / maxB);
  const stopLight = 1 - Math.min(1, BAC_ZONE_LIGHT / maxB);
  const gradStops = (alpha = 1) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLegal * 100).toFixed(2)}%`,
    stopColor: danger,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLegal * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLight * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stopLight * 100).toFixed(2)}%`,
    stopColor: safe,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: safe,
    stopOpacity: alpha
  }));

  // Clamp rendered Y to maxB so a runaway projected peak rides the top edge
  // instead of shooting past the title (the tooltip still shows the true
  // value). The X window now spans the whole curve (maxT = last point), so
  // no per-series X trimming is needed — the dashed projection runs to its
  // own end (its return to 0, or the truncation marker).
  const yc = b => ys(Math.min(b, maxB));
  const realR = safeReal;
  const projR = safeProj;
  const pathOf = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t)},${yc(p.bac)}`).join(' ');
  const areaOf = pts => pathOf(pts) + ` L${xs(pts[pts.length - 1].t)},${baseY} L${xs(pts[0].t)},${baseY} Z`;

  // Lane Y (bord droit) : seuils + « peak moyen » — résolue d'un bloc pour
  // que trois références proches ne s'écrivent jamais l'une sur l'autre
  // (priorités : 500 légal > peak moyen > 200).
  const thresh = [{
    y: BAC_ZONE_LIGHT,
    label: `${BAC_ZONE_LIGHT} mg/L`,
    color: warn,
    priority: 1
  }, {
    y: BAC_ZONE_LEGAL,
    label: `${BAC_ZONE_LEGAL} légal`,
    color: danger,
    priority: 3
  }].filter(l => l.y <= maxB);
  const interpAt = t => {
    if (merged.length === 0) return {
      t,
      bac: 0
    };
    if (t <= merged[0].t) return {
      t,
      bac: merged[0].bac
    };
    if (t >= merged[merged.length - 1].t) return {
      t,
      bac: merged[merged.length - 1].bac
    };
    let lo = 0,
      hi = merged.length - 1;
    while (hi - lo > 1) {
      const mid = lo + hi >> 1;
      if (merged[mid].t <= t) lo = mid;else hi = mid;
    }
    const a = merged[lo],
      b = merged[hi];
    const frac = (t - a.t) / Math.max(1e-9, b.t - a.t);
    return {
      t,
      bac: a.bac + (b.bac - a.bac) * frac
    };
  };
  const focusT = scrubT != null ? scrubT : 0;
  const focus = interpAt(focusT);
  const focusColor = bacZoneColor(focus.bac);
  const fmtClock = t => {
    const d = new Date(nowMs + t * 3600_000);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  const ticksX = (() => {
    const out = [];
    for (let i = 0; i < 4; i++) out.push(minT + (maxT - minT) * (i / 3));
    return out;
  })();
  const fmtRel = t => {
    const minutes = Math.round(Math.abs(t) * 60);
    if (minutes < 1) return 'maintenant';
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    const phrase = hh === 0 ? `${mm}min` : mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
    return t < 0 ? `il y a ${phrase}` : `dans ${phrase}`;
  };
  const fmtStatus = b => b > BAC_ZONE_LEGAL ? 'Au-delà' : b > BAC_ZONE_LIGHT ? 'Léger' : 'Sobre';

  // ETA marker, three states (contract: shown even if never reached):
  //   • etaKnown=false (eta == null) → peak never reached → "∞", pinned right.
  //   • reached within the framed window → marker at its true x.
  //   • reached but past the trimmed window → pinned right, but keep the real
  //     time label (don't lie with "∞").
  const etaKnown = etaPeakHours != null;
  const etaWithin = etaKnown && etaPeakHours >= minT && etaPeakHours <= maxT;
  const etaX = etaWithin ? xs(etaPeakHours) : xs(maxT);
  // Round to whole minutes FIRST so values like 1.999h don't render as
  // "1h60" (floor=1, frac×60≈60 → "1h60"). Carry overflow into hours.
  const etaLabelText = !etaKnown ? 'peak · ∞' : Math.abs(etaPeakHours) < 1e-3 ? 'peak · maintenant' : (() => {
    const totalMin = Math.round(etaPeakHours * 60);
    if (totalMin < 60) return `peak · ${totalMin}min`;
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin - hh * 60;
    return `peak · ${hh}h${String(mm).padStart(2, '0')}`;
  })();
  // ── Lanes anti-collision ─────────────────────────────────────────
  // Lane Y droite : labels de seuils (le « peak moyen » vit à GAUCHE, ses
  // extents ne croisent jamais ceux des seuils).
  const threshLabels = resolveLaneLabels(thresh.map(l => ({
    ...l,
    pos: ys(l.y) - 3,
    size: CHART.font.ref
  })), {
    lo: pad.t,
    hi: baseY
  });
  // Lane haute (y = pad.t + 9) : label ETA + « … » de troncature — les deux
  // vivaient au même endroit quand l'ETA était épinglé à droite. Résolus en
  // X (centres) ; l'ETA est prioritaire, le « … » se décale ou saute.
  const labelW = s => String(s).length * CHART.font.charW;
  const topLaneItems = [];
  if (meanPeakBac != null && meanPeakBac > 0) {
    // Centre souhaité : côté du marqueur qui a de la place.
    const side = etaX > pad.l + w * 0.62 ? -1 : 1;
    topLaneItems.push({
      id: 'eta',
      pos: etaX + side * (4 + labelW(etaLabelText) / 2),
      size: labelW(etaLabelText),
      priority: 3
    });
  }
  if (truncated) {
    topLaneItems.push({
      id: 'trunc',
      pos: pad.l + w - 3 - labelW('…') / 2,
      size: labelW('…'),
      priority: 1
    });
  }
  const topLane = resolveLaneLabels(topLaneItems, {
    minGap: CHART.label.minGapX,
    lo: pad.l,
    hi: pad.l + w
  });
  const etaLane = topLane.find(l => l.id === 'eta');
  const truncLane = topLane.find(l => l.id === 'trunc');
  const meanPeakY = meanPeakBac != null ? ys(Math.min(meanPeakBac, maxB)) : null;
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": "Pr\xE9vision d'alcool\xE9mie de la session en cours",
    className: CHART.anim.className,
    style: {
      display: 'block',
      touchAction: CHART.touchAction
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gradStrokeId,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, gradStops(1)), /*#__PURE__*/React.createElement("linearGradient", {
    id: gradAreaId,
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, gradStops(0.28), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: safe,
    stopOpacity: 0
  }))), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: pad.t + h * (1 - f),
    y2: pad.t + h * (1 - f),
    stroke: T.rule,
    strokeDasharray: CHART.grid.dash,
    strokeWidth: CHART.grid.width,
    opacity: 0.6
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - f) + 3,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, fmtTick(Math.round(maxB * f))))), thresh.map((l, i) => /*#__PURE__*/React.createElement("line", {
    key: `th-${i}`,
    x1: pad.l,
    x2: pad.l + w,
    y1: ys(l.y),
    y2: ys(l.y),
    stroke: l.color,
    strokeDasharray: CHART.dash.threshold,
    strokeWidth: CHART.stroke.threshold,
    opacity: 0.55
  })), threshLabels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: `thl-${i}`,
    x: pad.l + w - 2,
    y: l.pos,
    fontSize: CHART.font.ref,
    fill: l.color,
    textAnchor: "end",
    fontFamily: fontNum
  }, l.label)), meanPeakBac != null && meanPeakBac > 0 && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: meanPeakY,
    y2: meanPeakY,
    stroke: T.ink2,
    strokeDasharray: CHART.dash.reference,
    strokeWidth: CHART.stroke.reference,
    opacity: 0.65
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l + 4,
    y: meanPeakY - 3,
    fontSize: CHART.font.ref,
    fill: T.ink2,
    textAnchor: "start",
    fontFamily: fontNum
  }, "peak moyen \xB7 ", Math.round(meanPeakBac))), realR && realR.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: areaOf(realR),
    fill: `url(#${gradAreaId})`
  }), realR && realR.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(realR),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: CHART.stroke.bacPast,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), projR && projR.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(projR),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: CHART.stroke.bacFuture,
    strokeOpacity: 0.75,
    strokeDasharray: CHART.dash.future,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("line", {
    x1: xs(0),
    x2: xs(0),
    y1: pad.t,
    y2: baseY,
    stroke: T.ink2,
    strokeWidth: CHART.stroke.reference,
    strokeDasharray: CHART.dash.now,
    opacity: 0.5
  }), truncated && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: pad.l + w,
    x2: pad.l + w,
    y1: pad.t,
    y2: baseY,
    stroke: T.muted,
    strokeWidth: CHART.stroke.reference,
    strokeDasharray: CHART.dash.truncation,
    opacity: 0.5
  }), truncLane && /*#__PURE__*/React.createElement("text", {
    x: truncLane.pos,
    y: pad.t + 9,
    fontSize: CHART.font.ref,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, "\u2026")), meanPeakBac != null && meanPeakBac > 0 && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: etaX,
    x2: etaX,
    y1: pad.t,
    y2: baseY,
    stroke: T.ink,
    strokeWidth: CHART.stroke.reference,
    strokeDasharray: CHART.dash.marker,
    opacity: etaWithin ? 0.55 : 0.3
  }), etaLane && /*#__PURE__*/React.createElement("text", {
    x: etaLane.pos,
    y: pad.t + 9,
    fontSize: CHART.font.ref,
    fill: etaKnown ? T.ink2 : T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, etaLabelText)), ticksX.map((t, i) => {
    const last = ticksX.length - 1;
    const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
    const dx = i === 0 ? 1 : i === last ? -1 : 0;
    return /*#__PURE__*/React.createElement("text", {
      key: i,
      x: xs(t) + dx,
      y: height - 10,
      fontSize: CHART.font.tick,
      fill: T.muted,
      textAnchor: anchor,
      fontFamily: fontNum
    }, fmtClock(t));
  }), scrubT == null && 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("text", {
    x: xs(0),
    y: pad.t - 6,
    fontSize: CHART.font.tick,
    fill: T.ink2,
    textAnchor: "middle",
    fontFamily: fontNum
  }, "maintenant"), focus && merged.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: xs(focus.t),
    x2: xs(focus.t),
    y1: yc(focus.bac),
    y2: baseY,
    stroke: focusColor,
    strokeWidth: 1,
    opacity: 0.35
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: CHART.focus.halo,
    fill: focusColor,
    fillOpacity: 0.2
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: CHART.focus.ring,
    fill: T.bg,
    stroke: focusColor,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: CHART.focus.dot,
    fill: focusColor
  }), /*#__PURE__*/React.createElement(ChartTooltip, {
    x: xs(focus.t),
    y: yc(focus.bac),
    width: width,
    height: height,
    lines: [`${Math.round(focus.bac)} mg/L`, fmtStatus(focus.bac), fmtRel(focus.t)]
  })));
}
// ── Histogram (session duration / session BAC) ───────────────────
// Même anatomie que SvgBarChart (axe Y gradué via chartTicks, géométrie de
// barres CHART.bar) : l'ancienne variante sans axe posait la valeur sur
// CHAQUE barre — un nombre par point est un anti-pattern dataviz, et deux
// rangées de textes se chevauchaient dès que les buckets se resserraient.
// Les valeurs exactes vivent dans la tooltip.
function SvgHistogram({
  buckets,
  width = 320,
  height = 150,
  color,
  valueLabel,
  ariaLabel = 'Histogramme de distribution'
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  const pad = CHART.pad.bar;
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const yT = chartTicks(Math.max(1, ...buckets.map(b => b.v)), 2);
  const max = yT.max;
  const bw = w / Math.max(1, buckets.length);
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p || !buckets.length) {
      setHover(null);
      return;
    }
    const i = Math.max(0, Math.min(buckets.length - 1, Math.floor((p.x - pad.l) / bw)));
    setHover(i);
  });
  // After the hooks so a later render with data keeps the hook order.
  if (!buckets.length) return null;
  const xLabels = buckets.map(b => String(b.label || ''));
  const xCenters = buckets.map((_, i) => pad.l + i * bw + bw / 2);
  const shownLabels = thinnedAxisLabels(xLabels, xCenters, {
    lo: pad.l,
    hi: width - pad.r
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": ariaLabel,
    className: CHART.anim.className,
    style: {
      display: 'block',
      touchAction: CHART.touchAction
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), yT.values.map((v, i) => /*#__PURE__*/React.createElement("g", {
    key: `y-${i}`
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: width - pad.r,
    y1: pad.t + h * (1 - v / max),
    y2: pad.t + h * (1 - v / max),
    stroke: T.rule,
    strokeDasharray: CHART.grid.dash,
    strokeWidth: CHART.grid.width
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - v / max) + 3,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, fmtTick(v)))), buckets.map((b, i) => {
    const bh = b.v > 0 ? Math.max(CHART.bar.minH, b.v / max * h) : 0;
    if (bh <= 0) return null;
    const x = pad.l + i * bw + bw * CHART.bar.inset;
    const y = pad.t + h - bh;
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: x,
      y: y,
      width: bw * CHART.bar.widthFrac,
      height: bh,
      fill: color || T.accent,
      rx: CHART.bar.rx,
      opacity: hover === i ? 1 : CHART.bar.restOpacity
    });
  }), shownLabels.map(({
    i,
    x,
    anchor
  }) => /*#__PURE__*/React.createElement("text", {
    key: `xl-${i}`,
    x: x,
    y: height - 8,
    fontSize: CHART.font.tick,
    fill: T.muted,
    textAnchor: anchor,
    fontFamily: fontNum
  }, xLabels[i])), hover != null && (() => {
    const b = buckets[hover];
    const tx = pad.l + hover * bw + bw / 2;
    const ty = pad.t + h - b.v / max * h;
    return /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: ty,
      width: width,
      height: height,
      lines: [`${b.label}`, `${b.v}${valueLabel ? ' ' + valueLabel : ' session' + (b.v > 1 ? 's' : '')}`]
    });
  })());
}

// Intensité (0 vide, 1..4) d'une cellule de heatmap selon le ratio
// grammes / échelle. Bandes discrètes (style GitHub) plutôt qu'un dégradé
// continu : plus lisibles d'un coup d'œil. Exporté pour les tests.
function heatmapBand(grams, scaleMax) {
  if (!grams || grams <= 0) return 0;
  const ratio = Math.min(1, grams / Math.max(1, scaleMax));
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// Alias vers le token CHART (source unique) — conservé pour compat tests.
const HEATMAP_BAND_ALPHA = CHART.heatmap.bandAlpha;

// ── Calendrier (heatmap des grammes d'alcool) ────────────────────
// Rend un modèle `buildCalendarModel` (stats.jsx) EN PLEINE LARGEUR :
//  - 'month' / 'week' : 7 colonnes (lun→dim) qui remplissent la card, n° du
//    jour dans chaque case, hauteur plafonnée (CHART.heatmap.cellMaxH) ;
//  - 'year'  : 12 lignes (mois) × 31 colonnes (jour du mois) ;
//  - 'years' : une ligne par année × 12 mois.
// Intensité = bande de `withAlpha(T.accent, …)`, case vide en T.surface3,
// jours futurs en contour estompé, `blank` non rendus. Libellés de colonnes
// via thinnedAxisLabels, libellés de lignes via resolveLaneLabels.
// Interaction : le scrub (useChartScrubber) suit le doigt ; au relâchement
// la case reste ACTIVE (infobulle collante, `onActiveChange`) ; un second
// tap sur la case active appelle `onPick(cell)` (ouvrir ce jour / ce mois).
// Un geste annulé (le navigateur a pris la main pour défiler) ne choisit rien.
function calendarGeometry(model, width) {
  const H = CHART.heatmap;
  const {
    layout,
    rows,
    cols,
    rowLabels
  } = model;
  const dense = layout === 'year' || layout === 'years';
  const labelW = dense ? Math.max(0, ...rowLabels.map(l => String(l).length)) * CHART.font.charW + H.rowLabelGap : 0;
  const padL = labelW;
  const avail = Math.max(1, width - padL);
  let stepX, cellW;
  if (dense) {
    stepX = avail / (cols - H.gapRatio);
    cellW = stepX * (1 - H.gapRatio);
  } else {
    cellW = (avail - (cols - 1) * H.gap) / cols;
    stepX = cellW + H.gap;
  }
  let cellH, stepY;
  if (layout === 'year') {
    stepY = Math.max(stepX, H.minRowStep);
    cellH = stepY - stepX * H.gapRatio;
  } else {
    cellH = Math.min(cellW, H.cellMaxH[layout] || cellW);
    stepY = cellH + (dense ? stepX * H.gapRatio : H.gap);
  }
  const padT = H.headH;
  const height = padT + rows * stepY - (stepY - cellH) + H.padB;
  return {
    padL,
    padT,
    cellW,
    cellH,
    stepX,
    stepY,
    height,
    dense
  };
}
function SvgCalendarHeatmap({
  model,
  width = 320,
  activeKey = null,
  onActiveChange,
  onPick,
  ariaLabel = 'Calendrier de consommation'
}) {
  useTheme(); // repaint sur bascule de thème malgré React.memo (cf. shared.jsx)
  const svgRef = React.useRef(null);
  const [scrubKey, setScrubKey] = React.useState(null);
  const g = calendarGeometry(model, width);
  const {
    padL,
    padT,
    cellW,
    cellH,
    stepX,
    stepY,
    height
  } = g;
  const byPos = React.useMemo(() => {
    const m = new Map();
    for (const c of model.cells) m.set(`${c.row},${c.col}`, c);
    return m;
  }, [model]);
  const byKey = React.useMemo(() => {
    const m = new Map();
    for (const c of model.cells) m.set(c.key, c);
    return m;
  }, [model]);
  const cellAt = p => {
    const col = Math.floor((p.x - padL) / stepX);
    const row = Math.floor((p.y - padT) / stepY);
    const c = byPos.get(`${row},${col}`);
    return c && !c.blank && !c.future ? c : null;
  };

  // État du geste en cours : case active au pointerdown (second tap = choix),
  // dernière case survolée, point de départ (un glissé n'est pas un tap).
  const gesture = React.useRef({
    downKey: null,
    last: null,
    x: 0,
    y: 0,
    cancelled: false
  });
  const scr = useChartScrubber(svgRef, null, p => {
    if (p) {
      const c = cellAt(p);
      gesture.current.last = c;
      setScrubKey(c ? c.key : null);
      return;
    }
    setScrubKey(null);
  });
  const handlers = {
    ...scr.handlers,
    onPointerDown: e => {
      gesture.current = {
        downKey: activeKey,
        last: null,
        x: e.clientX,
        y: e.clientY,
        cancelled: false
      };
      scr.handlers.onPointerDown(e);
    },
    onPointerUp: e => {
      const gs = gesture.current;
      const moved = Math.hypot((e.clientX || 0) - gs.x, (e.clientY || 0) - gs.y) > 10;
      scr.handlers.onPointerUp(e);
      if (gs.cancelled) return;
      const c = gs.last;
      if (c && !moved && c.key === gs.downKey && onPick) {
        onPick(c);
        return;
      }
      if (onActiveChange) onActiveChange(c || null);
    },
    onPointerCancel: e => {
      gesture.current.cancelled = true;
      scr.handlers.onPointerCancel(e);
    },
    // Souris : le survol montre l'infobulle, quitter la grille rend la main
    // à la case active (collante).
    onPointerLeave: e => {
      scr.handlers.onPointerLeave(e);
    }
  };
  if (!model.cells.length) return null;
  const colCenters = model.colLabels.map((_, i) => padL + i * stepX + cellW / 2);
  const shownCols = thinnedAxisLabels(model.colLabels, colCenters, {
    lo: padL,
    hi: width
  });
  const rowItems = resolveLaneLabels(model.rowLabels.map((l, i) => ({
    pos: padT + i * stepY + cellH / 2,
    size: CHART.font.ref,
    priority: -i,
    i,
    label: l
  })), {
    minGap: 1,
    lo: padT,
    hi: height
  });
  const shownKey = scrubKey || activeKey;
  const shown = shownKey ? byKey.get(shownKey) : null;
  const withDay = model.layout === 'month' || model.layout === 'week';
  const fmtTipDate = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    if (d == null) return `${FR_MONTHS_LONG[m - 1]} ${y}`;
    const wd = FR_DAYS_SHORT[new Date(y, m - 1, d).getDay()];
    return `${wd}. ${d} ${FR_MONTHS_SHORT[m - 1]} ${y}`;
  };
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    role: "img",
    "aria-label": ariaLabel,
    className: CHART.anim.className,
    style: {
      display: 'block',
      touchAction: CHART.touchAction
    }
  }, handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), shownCols.map(({
    i,
    x,
    anchor
  }) => /*#__PURE__*/React.createElement("text", {
    key: `c-${i}`,
    x: x,
    y: padT - 5,
    fontSize: CHART.font.ref,
    fill: T.muted,
    textAnchor: anchor,
    fontFamily: fontNum
  }, model.colLabels[i])), rowItems.map(it => /*#__PURE__*/React.createElement("text", {
    key: `r-${it.i}`,
    x: padL - CHART.heatmap.rowLabelGap,
    y: it.pos + CHART.font.ref * 0.35,
    fontSize: CHART.font.ref,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, it.label)), model.cells.map(c => {
    if (c.blank) return null;
    const x = padL + c.col * stepX,
      y = padT + c.row * stepY;
    const band = heatmapBand(c.grams, model.scaleMax);
    const isActive = shownKey === c.key;
    const r = Math.max(1.5, Math.min(cellW, cellH) * 0.18);
    if (c.future) {
      return /*#__PURE__*/React.createElement("g", {
        key: c.key,
        opacity: CHART.heatmap.futureOpacity
      }, /*#__PURE__*/React.createElement("rect", {
        x: x,
        y: y,
        width: cellW,
        height: cellH,
        rx: r,
        fill: "transparent",
        stroke: T.rule,
        strokeWidth: CHART.grid.width
      }), withDay && /*#__PURE__*/React.createElement("text", {
        x: x + CHART.heatmap.dayInsetX,
        y: y + CHART.heatmap.dayInsetY + CHART.font.tick,
        fontSize: CHART.font.tick,
        fill: T.muted,
        fontFamily: fontNum
      }, c.label));
    }
    const fill = band === 0 ? T.surface3 : withAlpha(T.accent, HEATMAP_BAND_ALPHA[band]);
    return /*#__PURE__*/React.createElement("g", {
      key: c.key
    }, /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: cellW,
      height: cellH,
      rx: r,
      fill: fill,
      stroke: isActive ? T.accent : c.selected ? T.ink2 : T.rule,
      strokeWidth: isActive ? CHART.stroke.line : c.selected ? CHART.stroke.reference : CHART.grid.width
    }), withDay && /*#__PURE__*/React.createElement("text", {
      x: x + CHART.heatmap.dayInsetX,
      y: y + CHART.heatmap.dayInsetY + CHART.font.tick,
      fontSize: CHART.font.tick,
      fontFamily: fontNum,
      fill: band >= 3 ? T.accentInk : c.selected ? T.ink : T.ink2,
      fontWeight: c.selected ? 600 : 400
    }, c.label));
  }), shown && !shown.blank && (() => {
    const tx = padL + shown.col * stepX + cellW / 2;
    const ty = padT + shown.row * stepY;
    return /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: ty,
      width: width,
      height: height,
      lines: [fmtTipDate(shown.date), `${shown.count} boisson${shown.count > 1 ? 's' : ''}`, `${Math.round(shown.grams)} g d'alcool`]
    });
  })());
}

// Échelle du calendrier (« Moins ▢▢▢▢▢ Plus ») : mêmes bandes que les
// cases, tokens uniquement.
function HeatmapLegend() {
  useTheme();
  const s = CHART.heatmap.legendSwatch;
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      flexShrink: 0,
      color: T.muted,
      fontSize: 9.5,
      letterSpacing: 0.3,
      textTransform: 'uppercase'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      marginRight: 3
    }
  }, "Moins"), HEATMAP_BAND_ALPHA.map((a, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: s,
      height: s,
      borderRadius: 3,
      border: `1px solid ${T.rule}`,
      background: i === 0 ? T.surface3 : withAlpha(T.accent, a)
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 3
    }
  }, "Plus"));
}

// Memoize every chart at the export boundary: their data props come
// from useMemo'd parents, so reference equality holds and a parent
// re-render (e.g. a different stats section toggling open/closed)
// doesn't force the chart's heavy SVG paths to recompute. Their own
// internal state (scrub hover) still triggers re-renders normally.
SvgBarChart = React.memo(SvgBarChart);
SvgDonut = React.memo(SvgDonut);
SvgLineChart = React.memo(SvgLineChart);
SvgBACProjection = React.memo(SvgBACProjection);
SvgBACForecast = React.memo(SvgBACForecast);
SvgHistogram = React.memo(SvgHistogram);
SvgCalendarHeatmap = React.memo(SvgCalendarHeatmap);
Object.assign(window, {
  chartNiceMax,
  chartTicks,
  fmtTick,
  chartTooltipLayout,
  bacChartRange,
  CHART,
  BAC_CHART_CAP,
  BAC_ZONE_LIGHT,
  BAC_ZONE_LEGAL,
  bacZoneColor,
  thinnedAxisLabels,
  resolveLaneLabels,
  fitLabel,
  donutSegments,
  ChartLegend,
  SvgBarChart,
  SvgDonut,
  SvgLineChart,
  SvgBACProjection,
  SvgBACForecast,
  SvgHistogram,
  SvgCalendarHeatmap,
  calendarGeometry,
  HeatmapLegend,
  heatmapBand,
  HEATMAP_BAND_ALPHA,
  useChartScrubber,
  ChartTooltip,
  useMeasuredWidth,
  ChartAutoWidth
});
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

// Rounds an axis maximum up to a "nice" value, given a target tick count.
function chartNiceMax(v, ticks = 4) {
  if (!v) return 1;
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  return step * ticks;
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
  const RUNAWAY_CAP = 1500; // mg/L — ceiling for a pathological projected peak

  // Y: peak of the data + any forced extras, with anti-runaway clamp.
  const dataPeak = pts.length ? Math.max(...pts.map(p => p.bac)) : 0;
  let peak = Math.max(0, dataPeak, ...safeExtras);
  if (capRunaway) peak = Math.min(peak, Math.max(RUNAWAY_CAP, ...safeExtras));
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
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      x: vbX + px / rect.width * vbW,
      y: vbY + py / rect.height * vbH,
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

// Floating chart tooltip rendered as native SVG (rect + text) so it
// renders identically across browsers (no foreignObject quirks). It
// auto-flips horizontally when it would clip the right edge.
function ChartTooltip({
  x,
  y,
  lines,
  width = 320,
  pad = 8
}) {
  const w = 110;
  const h = 16 + lines.length * 14;
  let tx = x + 8;
  let ty = Math.max(0, y - h - 6);
  if (tx + w > width - pad) tx = x - w - 8;
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
    strokeWidth: 0.6,
    opacity: 0.95
  }), lines.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: tx + 8,
    y: ty + 14 + i * 14,
    fontSize: 10,
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
  valueLabel
}) {
  const pad = {
    t: 14,
    r: 6,
    b: 22,
    l: 28
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = chartNiceMax(Math.max(1, ...data.map(d => d.v)), 3);
  const bw = w / data.length;
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setHover(null);
      return;
    }
    const i = Math.max(0, Math.min(data.length - 1, Math.floor((p.x - pad.l) / bw)));
    setHover(i);
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block',
      touchAction: 'pan-y'
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: pad.l,
    x2: width - pad.r,
    y1: pad.t + h * (1 - f),
    y2: pad.t + h * (1 - f),
    stroke: T.rule,
    strokeDasharray: "2 3",
    strokeWidth: 0.6
  })), [0, max].map((t, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: pad.l - 4,
    y: pad.t + h * (1 - t / max) + 3,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, t)), data.map((d, i) => {
    const bh = d.v > 0 ? Math.max(2, d.v / max * h) : 0;
    const x = pad.l + i * bw + bw * 0.18;
    const y = pad.t + h - bh;
    const lbl = formatX ? formatX(d, i) : d.label;
    // When a custom formatX is supplied it already decides which
    // labels to show (returns '' to hide); don't double-thin it.
    const showLbl = formatX ? !!lbl : lbl && i % Math.ceil(data.length / 8) === 0;
    const isHover = hover === i;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, bh > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: bw * 0.64,
      height: bh,
      fill: color || T.accent,
      rx: 1.5,
      opacity: isHover ? 1 : 0.85
    }), showLbl && /*#__PURE__*/React.createElement("text", {
      x: x + bw * 0.32,
      y: height - 8,
      fontSize: 9,
      fill: T.muted,
      textAnchor: "middle",
      fontFamily: fontNum
    }, lbl));
  }), hover != null && (() => {
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
      strokeDasharray: "2 3",
      strokeWidth: 0.8,
      opacity: 0.6
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: ty,
      r: 3,
      fill: T.accent
    }), /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: ty,
      lines: lines,
      width: width
    }));
  })());
}

// ── Radar (weekday distribution) ──────────────────────────────────
function SvgRadar({
  data,
  size = 220,
  color,
  valueLabel
}) {
  const cx = size / 2,
    cy = size / 2;
  const r = size / 2 - 32;
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d.v));
  const angle = i => i / n * Math.PI * 2 - Math.PI / 2;
  const pt = (i, v) => {
    const a = angle(i);
    const rad = v / max * r;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  };
  const rings = [0.33, 0.66, 1];
  const gridPath = frac => data.map((_, i) => {
    const a = angle(i);
    return `${i === 0 ? 'M' : 'L'}${cx + Math.cos(a) * r * frac},${cy + Math.sin(a) * r * frac}`;
  }).join(' ') + 'Z';
  const dataPath = data.map((d, i) => {
    const [x, y] = pt(i, d.v);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + 'Z';
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setHover(null);
      return;
    }
    const dx = p.x - cx,
      dy = p.y - cy;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += 2 * Math.PI;
    const idx = Math.round(a / (2 * Math.PI) * n) % n;
    setHover(idx);
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${size} ${size}`,
    width: "100%",
    height: size,
    style: {
      display: 'block',
      touchAction: 'pan-y'
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: size,
    height: size,
    fill: "transparent"
  }), rings.map((f, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: gridPath(f),
    fill: "none",
    stroke: T.rule,
    strokeWidth: 0.6,
    strokeDasharray: i === rings.length - 1 ? 'none' : '2 3'
  })), data.map((_, i) => {
    const a = angle(i);
    return /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: cx,
      y1: cy,
      x2: cx + Math.cos(a) * r,
      y2: cy + Math.sin(a) * r,
      stroke: T.rule,
      strokeWidth: 0.5
    });
  }), /*#__PURE__*/React.createElement("path", {
    d: dataPath,
    fill: color || T.accent,
    fillOpacity: 0.2,
    stroke: color || T.accent,
    strokeWidth: 1.5,
    strokeLinejoin: "round"
  }), data.map((d, i) => {
    const [x, y] = pt(i, d.v);
    const isHover = hover === i;
    return /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: x,
      cy: y,
      r: isHover ? 4.5 : 2.5,
      fill: color || T.accent,
      stroke: isHover ? T.surface : 'none',
      strokeWidth: 1.5
    });
  }), data.map((d, i) => {
    const a = angle(i);
    const lx = cx + Math.cos(a) * (r + 14);
    const ly = cy + Math.sin(a) * (r + 14) + 3;
    const today = d.today;
    return /*#__PURE__*/React.createElement("text", {
      key: i,
      x: lx,
      y: ly,
      fontSize: 11,
      fill: today ? T.accent : T.ink2,
      fontWeight: today ? 600 : 400,
      textAnchor: "middle"
    }, d.label);
  }), hover != null && (() => {
    const d = data[hover];
    const [x, y] = pt(hover, d.v);
    return /*#__PURE__*/React.createElement(ChartTooltip, {
      x: x,
      y: y,
      width: size,
      lines: [`${d.label}`, `${d.v}${valueLabel ? ' ' + valueLabel : ''}`]
    });
  })());
}
// ── Donut chart (category distribution) ───────────────────────────
function SvgDonut({
  data,
  size = 140,
  thickness = 22
}) {
  const cx = size / 2,
    cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  // Pre-compute arc segments and angle ranges so the scrubber can
  // figure out which segment the pointer hits.
  const segments = [];
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
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
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
  const focused = hover != null ? segments[hover] : null;
  const focusedPct = focused ? Math.round(focused.d.v / total * 100) : null;
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    style: {
      display: 'block',
      touchAction: 'pan-y'
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
    fontSize: 11,
    fill: T.muted,
    textAnchor: "middle",
    letterSpacing: "1"
  }, focused ? focused.d.name.toUpperCase() : 'TOTAL'), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + 14,
    fontSize: 20,
    fill: T.ink,
    textAnchor: "middle",
    fontFamily: fontSerif,
    fontStyle: "italic"
  }, focused ? `${focused.d.v}` : Math.round(total)), focused && /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + 28,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, focusedPct, "%"));
}

// ── Line chart (monthly trend, dual axis) ─────────────────────────
function SvgLineChart({
  series,
  labels,
  width = 320,
  height = 170
}) {
  const pad = {
    t: 16,
    r: 38,
    b: 26,
    l: 36
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxL = chartNiceMax(Math.max(1, ...series[0].data), 3);
  const maxR = chartNiceMax(Math.max(1, ...series[1].data), 3);
  const n = labels.length;
  const xs = i => pad.l + i / Math.max(1, n - 1) * w;
  const pathFor = (data, max) => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${pad.t + h * (1 - v / max)}`).join(' ');
  const areaFor = (data, max) => pathFor(data, max) + ` L${xs(n - 1)},${pad.t + h} L${xs(0)},${pad.t + h} Z`;
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
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block',
      touchAction: 'pan-y'
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "lg-a",
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
  })), /*#__PURE__*/React.createElement("linearGradient", {
    id: "lg-b",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: T.accent2,
    stopOpacity: 0.3
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: T.accent2,
    stopOpacity: 0
  }))), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: pad.l,
    x2: pad.l + w,
    y1: pad.t + h * f,
    y2: pad.t + h * f,
    stroke: T.rule,
    strokeDasharray: "2 3",
    strokeWidth: 0.6
  })), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("text", {
    key: `yl-${i}`,
    x: pad.l - 4,
    y: pad.t + h * (1 - f) + 3,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, Math.round(maxL * f))), [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("text", {
    key: `yr-${i}`,
    x: width - pad.r + 4,
    y: pad.t + h * (1 - f) + 3,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "start",
    fontFamily: fontNum
  }, Math.round(maxR * f))), /*#__PURE__*/React.createElement("path", {
    d: areaFor(series[0].data, maxL),
    fill: "url(#lg-a)"
  }), /*#__PURE__*/React.createElement("path", {
    d: pathFor(series[0].data, maxL),
    fill: "none",
    stroke: T.accent,
    strokeWidth: 1.8,
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: pathFor(series[1].data, maxR),
    fill: "none",
    stroke: T.accent2,
    strokeWidth: 1.5,
    strokeDasharray: "3 2",
    strokeLinejoin: "round"
  }), labels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: xs(i),
    y: height - 8,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, l)), /*#__PURE__*/React.createElement("text", {
    x: 4,
    y: pad.t + 4,
    fontSize: 8,
    fill: T.accent,
    fontFamily: fontNum
  }, "verres"), /*#__PURE__*/React.createElement("text", {
    x: width - 4,
    y: pad.t + 4,
    fontSize: 8,
    fill: T.accent2,
    fontFamily: fontNum,
    textAnchor: "end"
  }, "g/mois"), hover != null && (() => {
    const tx = xs(hover);
    const v0 = series[0].data[hover];
    const v1 = series[1].data[hover];
    const cy0 = pad.t + h * (1 - v0 / maxL);
    const cy1 = pad.t + h * (1 - v1 / maxR);
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: tx,
      x2: tx,
      y1: pad.t,
      y2: pad.t + h,
      stroke: T.ink2,
      strokeDasharray: "2 3",
      strokeWidth: 0.8,
      opacity: 0.7
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: cy0,
      r: 3.5,
      fill: T.accent,
      stroke: T.surface,
      strokeWidth: 1.2
    }), /*#__PURE__*/React.createElement("circle", {
      cx: tx,
      cy: cy1,
      r: 3.5,
      fill: T.accent2,
      stroke: T.surface,
      strokeWidth: 1.2
    }), /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: Math.min(cy0, cy1),
      width: width,
      lines: [`${labels[hover]}`, `${v0} verres`, `${v1} g`]
    }));
  })());
}
// ── Polar clock (24h consumption distribution) ───────────────────
function SvgPolarClock({
  hours,
  size = 260
}) {
  const cx = size / 2,
    cy = size / 2;
  const rOuter = size / 2 - 22;
  const rInner = size / 2 * 0.38;
  const max = Math.max(1, ...hours);
  const wedge = i => {
    const a0 = i / 24 * Math.PI * 2 - Math.PI / 2;
    const a1 = (i + 1) / 24 * Math.PI * 2 - Math.PI / 2;
    const v = hours[i];
    const r = rInner + v / max * (rOuter - rInner);
    return {
      a0,
      a1,
      r,
      v
    };
  };
  const arcs = [];
  for (let i = 0; i < 24; i++) {
    const {
      a0,
      a1,
      r,
      v
    } = wedge(i);
    if (r - rInner < 0.5) continue;
    const x0 = cx + Math.cos(a0) * rInner,
      y0 = cy + Math.sin(a0) * rInner;
    const x1 = cx + Math.cos(a1) * rInner,
      y1 = cy + Math.sin(a1) * rInner;
    const x2 = cx + Math.cos(a1) * r,
      y2 = cy + Math.sin(a1) * r;
    const x3 = cx + Math.cos(a0) * r,
      y3 = cy + Math.sin(a0) * r;
    arcs.push(/*#__PURE__*/React.createElement("path", {
      key: i,
      d: `M${x0},${y0} L${x3},${y3} A${r},${r} 0 0 1 ${x2},${y2} L${x1},${y1} A${rInner},${rInner} 0 0 0 ${x0},${y0} Z`,
      fill: T.accent,
      fillOpacity: 0.3 + v / max * 0.55
    }));
  }
  const labels = [{
    h: 0,
    txt: '0h'
  }, {
    h: 6,
    txt: '6h'
  }, {
    h: 12,
    txt: '12h'
  }, {
    h: 18,
    txt: '18h'
  }];
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setHover(null);
      return;
    }
    const dx = p.x - cx,
      dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > rOuter + 8 || dist < rInner - 4) {
      setHover(null);
      return;
    }
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += 2 * Math.PI;
    const idx = Math.floor(a / (Math.PI * 2) * 24) % 24;
    setHover(idx);
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${size} ${size}`,
    width: "100%",
    height: size,
    style: {
      display: 'block',
      touchAction: 'pan-y'
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
    r: rOuter,
    fill: "none",
    stroke: T.rule,
    strokeWidth: 0.5,
    strokeDasharray: "2 3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: rInner,
    fill: "none",
    stroke: T.rule,
    strokeWidth: 0.5
  }), [0.33, 0.66].map((f, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: cx,
    cy: cy,
    r: rInner + (rOuter - rInner) * f,
    fill: "none",
    stroke: T.rule,
    strokeWidth: 0.4,
    strokeDasharray: "1 2"
  })), arcs, labels.map(({
    h,
    txt
  }) => {
    const a = h / 24 * Math.PI * 2 - Math.PI / 2;
    const lx = cx + Math.cos(a) * (rOuter + 12);
    const ly = cy + Math.sin(a) * (rOuter + 12) + 3;
    return /*#__PURE__*/React.createElement("text", {
      key: h,
      x: lx,
      y: ly,
      fontSize: 11,
      fill: T.ink2,
      textAnchor: "middle",
      fontFamily: fontNum
    }, txt);
  }), hover != null && (() => {
    const {
      a0,
      a1,
      r,
      v
    } = wedge(hover);
    const aMid = (a0 + a1) / 2;
    const tx = cx + Math.cos(aMid) * Math.max(rInner + 4, r);
    const ty = cy + Math.sin(aMid) * Math.max(rInner + 4, r);
    return /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: ty,
      width: size,
      lines: [`${hover}h – ${(hover + 1) % 24}h`, `${v} boisson${v > 1 ? 's' : ''}`]
    });
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
  // Hooks always run first and unconditionally so React's hook order
  // stays stable even when the component is rendered with empty input.
  const idSuffix = React.useId().replace(/:/g, '');
  const svgRef = React.useRef(null);
  const [scrubT, setScrubT] = React.useState(null);
  const safePoints = points && points.length > 0 ? points : null;
  // Tightened paddings give the curve more vertical room on small
  // screens while still fitting 4-digit y-axis labels (worst case
  // ~"1500" at fontSize 9 ≈ 22 px wide; 36 px keeps a ~12 px breathing
  // gap from the plot area).
  const pad = {
    t: 16,
    r: 14,
    b: 22,
    l: 36
  };
  const w = width - pad.l - pad.r;
  // Adaptive framing — full span to sobriety; a small curve still fills the
  // height. Computed before the scrubber, which closes over minT/maxT.
  const {
    minT,
    maxT,
    maxB
  } = bacChartRange(safePoints);

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
  const baseY = pad.t + h;
  const safe = T.good;
  const warn = T.isDark ? 'oklch(72% 0.16 60)' : 'oklch(58% 0.16 55)';
  const danger = T.isDark ? 'oklch(68% 0.20 25)' : 'oklch(54% 0.20 25)';
  const bacColor = b => b > 500 ? danger : b > 200 ? warn : safe;
  const gradStrokeId = `bac-stroke-${idSuffix}`;
  const gradAreaId = `bac-area-${idSuffix}`;

  // Build a vertical gradient that matches the threshold colors. Stops
  // are placed exactly at 200 and 500 mg/L so the colour transitions
  // line up with the threshold lines. y goes 0 (top, max BAC) → 1 (bottom, 0).
  const stop500 = 1 - Math.min(1, 500 / maxB);
  const stop200 = 1 - Math.min(1, 200 / maxB);
  const gradStops = (alpha = 1) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop500 * 100).toFixed(2)}%`,
    stopColor: danger,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop500 * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop200 * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop200 * 100).toFixed(2)}%`,
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
  const pathOf = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t)},${ys(p.bac)}`).join(' ');
  const areaOf = pts => pathOf(pts) + ` L${xs(pts[pts.length - 1].t)},${baseY} L${xs(pts[0].t)},${baseY} Z`;
  const thresh = [{
    y: 200,
    label: '200 mg/L',
    color: warn
  }, {
    y: 500,
    label: '500 légal',
    color: danger
  }].filter(l => l.y <= maxB);

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
  const focusColor = bacColor(focus.bac);
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
  const fmtStatus = b => b > 500 ? 'Au-delà' : b > 200 ? 'Léger' : 'Sobre';
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block',
      touchAction: 'none'
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
    strokeDasharray: "2 3",
    strokeWidth: 0.5,
    opacity: 0.6
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - f) + 3,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, Math.round(maxB * f)))), thresh.map((l, i) => /*#__PURE__*/React.createElement("g", {
    key: `th-${i}`
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: ys(l.y),
    y2: ys(l.y),
    stroke: l.color,
    strokeDasharray: "3 3",
    strokeWidth: 0.8,
    opacity: 0.55
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l + w - 2,
    y: ys(l.y) - 3,
    fontSize: 8,
    fill: l.color,
    textAnchor: "end",
    fontFamily: fontNum
  }, l.label))), past.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: areaOf(past),
    fill: `url(#${gradAreaId})`
  }), past.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(past),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: 2.4,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), future.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(future),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: 1.8,
    strokeOpacity: 0.75,
    strokeDasharray: "5 4",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("line", {
    x1: xs(0),
    x2: xs(0),
    y1: pad.t,
    y2: baseY,
    stroke: T.ink2,
    strokeWidth: 1,
    strokeDasharray: "3 3",
    opacity: 0.5
  }), ticksX.map((t, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: xs(t),
    y: height - 10,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, fmtClock(t))), scrubT == null && 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("text", {
    x: xs(0),
    y: pad.t - 6,
    fontSize: 9,
    fill: T.ink2,
    textAnchor: "middle",
    fontFamily: fontNum
  }, "maintenant"), focus && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: xs(focus.t),
    x2: xs(focus.t),
    y1: ys(focus.bac),
    y2: baseY,
    stroke: focusColor,
    strokeWidth: 1,
    opacity: 0.35
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: ys(focus.bac),
    r: 11,
    fill: focusColor,
    fillOpacity: 0.2
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: ys(focus.bac),
    r: 6,
    fill: T.bg,
    stroke: focusColor,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: ys(focus.bac),
    r: 3.5,
    fill: focusColor
  }), /*#__PURE__*/React.createElement(ChartTooltip, {
    x: xs(focus.t),
    y: ys(focus.bac),
    width: width,
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
  width = 320,
  height = 200,
  nowMs = Date.now()
}) {
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
  const pad = {
    t: 16,
    r: 14,
    b: 22,
    l: 36
  };
  const w = width - pad.l - pad.r;
  // Adaptive framing — focus the rise + peak (trim the long decay tail),
  // keep the mean-peak line on-screen, and clamp a runaway projected peak.
  // Computed before the scrubber, which closes over minT/maxT.
  const {
    minT,
    maxT,
    maxB
  } = bacChartRange(merged, {
    extras: [meanPeakBac],
    keepRiseFocus: true,
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
  const safe = T.good;
  const warn = T.isDark ? 'oklch(72% 0.16 60)' : 'oklch(58% 0.16 55)';
  const danger = T.isDark ? 'oklch(68% 0.20 25)' : 'oklch(54% 0.20 25)';
  const bacColor = b => b > 500 ? danger : b > 200 ? warn : safe;
  const gradStrokeId = `bacf-stroke-${idSuffix}`;
  const gradAreaId = `bacf-area-${idSuffix}`;
  const stop500 = 1 - Math.min(1, 500 / maxB);
  const stop200 = 1 - Math.min(1, 200 / maxB);
  const gradStops = (alpha = 1) => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop500 * 100).toFixed(2)}%`,
    stopColor: danger,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop500 * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop200 * 100).toFixed(2)}%`,
    stopColor: warn,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: `${(stop200 * 100).toFixed(2)}%`,
    stopColor: safe,
    stopOpacity: alpha
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: safe,
    stopOpacity: alpha
  }));

  // Clamp rendered Y to maxB so a runaway projected peak rides the top edge
  // instead of shooting past the title (the tooltip still shows the true
  // value). clipT trims each series to the framed window so the dashed
  // projection ends cleanly at the right edge with no overflow tail.
  const yc = b => ys(Math.min(b, maxB));
  const clipT = pts => pts ? pts.filter(p => p.t >= minT - 1e-6 && p.t <= maxT + 1e-6) : pts;
  const realR = clipT(safeReal);
  const projR = clipT(safeProj);
  const pathOf = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t)},${yc(p.bac)}`).join(' ');
  const areaOf = pts => pathOf(pts) + ` L${xs(pts[pts.length - 1].t)},${baseY} L${xs(pts[0].t)},${baseY} Z`;
  const thresh = [{
    y: 200,
    label: '200 mg/L',
    color: warn
  }, {
    y: 500,
    label: '500 légal',
    color: danger
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
  const focusColor = bacColor(focus.bac);
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
  const fmtStatus = b => b > 500 ? 'Au-delà' : b > 200 ? 'Léger' : 'Sobre';

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
  // Anchor the label on the side of the marker that has room — flips
  // to "end" once the marker enters the right half of the plot area so
  // the text never clips the SVG edge.
  const etaAnchor = etaX > pad.l + w * 0.62 ? 'end' : 'start';
  const etaTextX = etaX + (etaAnchor === 'end' ? -4 : 4);
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block',
      touchAction: 'none'
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
    strokeDasharray: "2 3",
    strokeWidth: 0.5,
    opacity: 0.6
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l - 4,
    y: pad.t + h * (1 - f) + 3,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, Math.round(maxB * f)))), thresh.map((l, i) => /*#__PURE__*/React.createElement("g", {
    key: `th-${i}`
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: ys(l.y),
    y2: ys(l.y),
    stroke: l.color,
    strokeDasharray: "3 3",
    strokeWidth: 0.8,
    opacity: 0.55
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l + w - 2,
    y: ys(l.y) - 3,
    fontSize: 8,
    fill: l.color,
    textAnchor: "end",
    fontFamily: fontNum
  }, l.label))), meanPeakBac != null && meanPeakBac > 0 && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: ys(Math.min(meanPeakBac, maxB)),
    y2: ys(Math.min(meanPeakBac, maxB)),
    stroke: T.ink2,
    strokeDasharray: "4 4",
    strokeWidth: 1,
    opacity: 0.65
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l + 4,
    y: ys(Math.min(meanPeakBac, maxB)) - 3,
    fontSize: 8.5,
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
    strokeWidth: 2.4,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), projR && projR.length > 1 && /*#__PURE__*/React.createElement("path", {
    d: pathOf(projR),
    fill: "none",
    stroke: `url(#${gradStrokeId})`,
    strokeWidth: 1.8,
    strokeOpacity: 0.75,
    strokeDasharray: "5 4",
    strokeLinejoin: "round",
    strokeLinecap: "round"
  }), 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("line", {
    x1: xs(0),
    x2: xs(0),
    y1: pad.t,
    y2: baseY,
    stroke: T.ink2,
    strokeWidth: 1,
    strokeDasharray: "3 3",
    opacity: 0.5
  }), meanPeakBac != null && meanPeakBac > 0 && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
    x1: etaX,
    x2: etaX,
    y1: pad.t,
    y2: baseY,
    stroke: T.ink,
    strokeWidth: 1,
    strokeDasharray: "1 3",
    opacity: etaWithin ? 0.55 : 0.3
  }), /*#__PURE__*/React.createElement("text", {
    x: etaTextX,
    y: pad.t + 9,
    fontSize: 8.5,
    fill: etaKnown ? T.ink2 : T.muted,
    textAnchor: etaAnchor,
    fontFamily: fontNum
  }, etaLabelText)), ticksX.map((t, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: xs(t),
    y: height - 10,
    fontSize: 9,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, fmtClock(t))), scrubT == null && 0 >= minT && 0 <= maxT && /*#__PURE__*/React.createElement("text", {
    x: xs(0),
    y: pad.t - 6,
    fontSize: 9,
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
    r: 11,
    fill: focusColor,
    fillOpacity: 0.2
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: 6,
    fill: T.bg,
    stroke: focusColor,
    strokeWidth: 1.5
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(focus.t),
    cy: yc(focus.bac),
    r: 3.5,
    fill: focusColor
  }), /*#__PURE__*/React.createElement(ChartTooltip, {
    x: xs(focus.t),
    y: yc(focus.bac),
    width: width,
    lines: [`${Math.round(focus.bac)} mg/L`, fmtStatus(focus.bac), fmtRel(focus.t)]
  })));
}
// ── Histogram (session duration / session BAC) ───────────────────
function SvgHistogram({
  buckets,
  width = 320,
  height = 150,
  color,
  valueLabel
}) {
  const pad = {
    t: 14,
    r: 8,
    b: 24,
    l: 8
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...buckets.map(b => b.v));
  const bw = w / buckets.length;
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, p => {
    if (!p) {
      setHover(null);
      return;
    }
    const i = Math.max(0, Math.min(buckets.length - 1, Math.floor((p.x - pad.l) / bw)));
    setHover(i);
  });
  return /*#__PURE__*/React.createElement("svg", _extends({
    ref: svgRef,
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block',
      touchAction: 'pan-y'
    }
  }, scr.handlers), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "0",
    width: width,
    height: height,
    fill: "transparent"
  }), buckets.map((b, i) => {
    const bh = b.v > 0 ? Math.max(2, b.v / max * h) : 0;
    const x = pad.l + i * bw + bw * 0.12;
    const y = pad.t + h - bh;
    const isHover = hover === i;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, bh > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: bw * 0.76,
      height: bh,
      fill: color || T.accent,
      rx: 2,
      opacity: isHover ? 1 : 0.85
    }), /*#__PURE__*/React.createElement("text", {
      x: x + bw * 0.5,
      y: height - 8,
      fontSize: 9.5,
      fill: T.muted,
      textAnchor: "middle",
      fontFamily: fontNum
    }, b.label), b.v > 0 && /*#__PURE__*/React.createElement("text", {
      x: x + bw * 0.5,
      y: y - 4,
      fontSize: 9,
      fill: T.ink2,
      textAnchor: "middle",
      fontFamily: fontNum
    }, b.v));
  }), hover != null && (() => {
    const b = buckets[hover];
    const tx = pad.l + hover * bw + bw / 2;
    const ty = pad.t + h - b.v / max * h;
    return /*#__PURE__*/React.createElement(ChartTooltip, {
      x: tx,
      y: ty,
      width: width,
      lines: [`${b.label}`, `${b.v}${valueLabel ? ' ' + valueLabel : ' session' + (b.v > 1 ? 's' : '')}`]
    });
  })());
}

// Memoize every chart at the export boundary: their data props come
// from useMemo'd parents, so reference equality holds and a parent
// re-render (e.g. a different stats section toggling open/closed)
// doesn't force the chart's heavy SVG paths to recompute. Their own
// internal state (scrub hover) still triggers re-renders normally.
SvgBarChart = React.memo(SvgBarChart);
SvgRadar = React.memo(SvgRadar);
SvgDonut = React.memo(SvgDonut);
SvgLineChart = React.memo(SvgLineChart);
SvgPolarClock = React.memo(SvgPolarClock);
SvgBACProjection = React.memo(SvgBACProjection);
SvgBACForecast = React.memo(SvgBACForecast);
SvgHistogram = React.memo(SvgHistogram);
Object.assign(window, {
  chartNiceMax,
  SvgBarChart,
  SvgRadar,
  SvgDonut,
  SvgLineChart,
  SvgPolarClock,
  SvgBACProjection,
  SvgBACForecast,
  SvgHistogram,
  useChartScrubber,
  ChartTooltip,
  useMeasuredWidth
});
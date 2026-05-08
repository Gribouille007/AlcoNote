// stats-charts.jsx — SVG chart primitives for the Statistiques tab.

// Local niceMax (different signature from shared.jsx -- ticks-based)
function chartNiceMax(v, ticks = 4) {
  if (!v) return 1;
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  return step * ticks;
}

// Shared scrubber for charts. Tracks the pointer, projects it from
// client-coordinates back to the SVG's viewBox, and exposes the closest
// data index along with the active flag (only true while the user is
// actively dragging or hovering).
function useChartScrubber(svgRef, getRect, onChange) {
  const [active, setActive] = React.useState(false);
  const draggingRef = React.useRef(false);

  const project = (e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const vbX = vb[0] || 0, vbY = vb[1] || 0;
    const vbW = vb[2] || rect.width;
    const vbH = vb[3] || rect.height;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      x: vbX + (px / rect.width) * vbW,
      y: vbY + (py / rect.height) * vbH,
      pxRect: rect,
    };
  };

  const handler = (kind) => (e) => {
    if (kind === 'down') {
      draggingRef.current = true;
      setActive(true);
      // Capture on the SVG itself, not whatever sub-element the user
      // happened to press — sub-elements can be re-rendered/removed
      // during scrubbing (e.g. the hover circle).
      try {
        if (e.currentTarget && e.currentTarget.setPointerCapture) {
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } catch {}
    }
    if (kind === 'up' || kind === 'leave') {
      draggingRef.current = false;
      setActive(false);
      onChange && onChange(null);
      try {
        if (kind === 'up' && e.currentTarget && e.currentTarget.releasePointerCapture) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {}
      return;
    }
    if (kind === 'move' && !draggingRef.current && e.pointerType === 'touch') return;
    const p = project(e);
    if (!p) return;
    if (e.cancelable) e.preventDefault();
    onChange && onChange(p);
  };

  return {
    active,
    handlers: {
      onPointerDown: handler('down'),
      onPointerMove: handler('move'),
      onPointerUp: handler('up'),
      onPointerLeave: handler('leave'),
      onPointerCancel: handler('up'),
    },
  };
}

// Floating chart tooltip rendered as native SVG (rect + text) so it
// renders identically across browsers (no foreignObject quirks). It
// auto-flips horizontally when it would clip the right edge.
function ChartTooltip({ x, y, lines, width = 320, pad = 8 }) {
  const w = 110;
  const h = 16 + lines.length * 14;
  let tx = x + 8;
  let ty = Math.max(0, y - h - 6);
  if (tx + w > width - pad) tx = x - w - 8;
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={w} height={h} rx={6}
        fill={T.surface3 || T.surface2} stroke={T.rule} strokeWidth={0.6}
        opacity={0.95} />
      {lines.map((l, i) => (
        <text key={i} x={tx + 8} y={ty + 14 + i * 14}
          fontSize={10} fill={i === 0 ? T.ink : T.ink2} fontFamily={fontNum}>
          {l}
        </text>
      ))}
    </g>
  );
}

// ── Bar chart (hourly distribution) ───────────────────────────────
function SvgBarChart({ data, width = 320, height = 140, color, formatX, formatTooltip, valueLabel }) {
  const pad = { t: 14, r: 6, b: 22, l: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = chartNiceMax(Math.max(1, ...data.map(d => d.v)), 3);
  const bw = w / data.length;
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const i = Math.max(0, Math.min(data.length - 1, Math.floor((p.x - pad.l) / bw)));
    setHover(i);
  });
  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={width - pad.r}
          y1={pad.t + h * (1 - f)} y2={pad.t + h * (1 - f)}
          stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
      ))}
      {[0, max].map((t, i) => (
        <text key={i} x={pad.l - 4} y={pad.t + h * (1 - t / max) + 3}
          fontSize={9} fill={T.muted} textAnchor="end" fontFamily={fontNum}>
          {t}
        </text>
      ))}
      {data.map((d, i) => {
        const bh = d.v > 0 ? Math.max(2, (d.v / max) * h) : 0;
        const x = pad.l + i * bw + bw * 0.18;
        const y = pad.t + h - bh;
        const lbl = formatX ? formatX(d, i) : d.label;
        const showLbl = lbl && (i % Math.ceil(data.length / 8) === 0);
        const isHover = hover === i;
        return (
          <g key={i}>
            {bh > 0 && (
              <rect x={x} y={y} width={bw * 0.64} height={bh}
                fill={color || T.accent} rx={1.5}
                opacity={isHover ? 1 : 0.85} />
            )}
            {showLbl && (
              <text x={x + bw * 0.32} y={height - 8}
                fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>
                {lbl}
              </text>
            )}
          </g>
        );
      })}
      {hover != null && (() => {
        const d = data[hover];
        const tx = pad.l + hover * bw + bw / 2;
        const ty = pad.t + h - (d.v / max) * h;
        const lines = formatTooltip
          ? formatTooltip(d, hover)
          : [`${d.label}`, `${d.v}${valueLabel ? ' ' + valueLabel : ''}`];
        return (
          <>
            <line x1={tx} x2={tx} y1={pad.t} y2={pad.t + h}
              stroke={T.accent} strokeDasharray="2 3" strokeWidth={0.8} opacity={0.6} />
            <circle cx={tx} cy={ty} r={3} fill={T.accent} />
            <ChartTooltip x={tx} y={ty} lines={lines} width={width} />
          </>
        );
      })()}
    </svg>
  );
}

// ── Radar (weekday distribution) ──────────────────────────────────
function SvgRadar({ data, size = 220, color, valueLabel }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 32;
  const n = data.length;
  const max = Math.max(1, ...data.map(d => d.v));
  const angle = i => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (i, v) => {
    const a = angle(i);
    const rad = (v / max) * r;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  };

  const rings = [0.33, 0.66, 1];
  const gridPath = (frac) => data.map((_, i) => {
    const a = angle(i);
    return `${i === 0 ? 'M' : 'L'}${cx + Math.cos(a) * r * frac},${cy + Math.sin(a) * r * frac}`;
  }).join(' ') + 'Z';

  const dataPath = data.map((d, i) => {
    const [x, y] = pt(i, d.v);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + 'Z';

  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const dx = p.x - cx, dy = p.y - cy;
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += 2 * Math.PI;
    const idx = Math.round((a / (2 * Math.PI)) * n) % n;
    setHover(idx);
  });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} width="100%" height={size}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      {rings.map((f, i) => (
        <path key={i} d={gridPath(f)} fill="none" stroke={T.rule} strokeWidth={0.6}
          strokeDasharray={i === rings.length - 1 ? 'none' : '2 3'} />
      ))}
      {data.map((_, i) => {
        const a = angle(i);
        return (
          <line key={i} x1={cx} y1={cy}
            x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r}
            stroke={T.rule} strokeWidth={0.5} />
        );
      })}
      <path d={dataPath} fill={color || T.accent} fillOpacity={0.2}
        stroke={color || T.accent} strokeWidth={1.5} strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.v);
        const isHover = hover === i;
        return <circle key={i} cx={x} cy={y} r={isHover ? 4.5 : 2.5}
          fill={color || T.accent} stroke={isHover ? T.surface : 'none'} strokeWidth={1.5} />;
      })}
      {data.map((d, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 14);
        const ly = cy + Math.sin(a) * (r + 14) + 3;
        const today = d.today;
        return (
          <text key={i} x={lx} y={ly}
            fontSize={11} fill={today ? T.accent : T.ink2}
            fontWeight={today ? 600 : 400}
            textAnchor="middle">
            {d.label}
          </text>
        );
      })}
      {hover != null && (() => {
        const d = data[hover];
        const [x, y] = pt(hover, d.v);
        return (
          <ChartTooltip x={x} y={y} width={size}
            lines={[`${d.label}`, `${d.v}${valueLabel ? ' ' + valueLabel : ''}`]} />
        );
      })()}
    </svg>
  );
}
// ── Donut chart (category distribution) ───────────────────────────
function SvgDonut({ data, size = 140, thickness = 22 }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  // Pre-compute arc segments and angle ranges so the scrubber can
  // figure out which segment the pointer hits.
  const segments = [];
  let acc = 0;
  for (const d of data) {
    const a0 = acc / total * Math.PI * 2 - Math.PI / 2;
    const a1 = (acc + d.v) / total * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const large = d.v / total > 0.5 ? 1 : 0;
    segments.push({
      d, a0, a1, path: `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`,
    });
    acc += d.v;
  }
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const dx = p.x - cx, dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < r - thickness * 0.6 || dist > r + thickness * 0.6) { setHover(null); return; }
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += 2 * Math.PI;
    const idx = segments.findIndex(s => a >= s.a0 && a <= s.a1);
    setHover(idx >= 0 ? idx : null);
  });

  const focused = hover != null ? segments[hover] : null;
  const focusedPct = focused ? Math.round((focused.d.v / total) * 100) : null;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} width={size} height={size}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.rule} strokeWidth={thickness} />
      {segments.map((s, i) => (
        <path key={i} d={s.path} fill="none"
          stroke={catColor(s.d.name, 65)}
          strokeWidth={thickness * (hover === i ? 1.12 : 1)}
          strokeLinecap="butt"
          opacity={hover != null && hover !== i ? 0.45 : 1}
        />
      ))}
      <text x={cx} y={cy - 4} fontSize={11} fill={T.muted}
        textAnchor="middle" letterSpacing="1">{focused ? focused.d.name.toUpperCase() : 'TOTAL'}</text>
      <text x={cx} y={cy + 14} fontSize={20} fill={T.ink}
        textAnchor="middle" fontFamily={fontSerif} fontStyle="italic">
        {focused ? `${focused.d.v}` : Math.round(total)}
      </text>
      {focused && (
        <text x={cx} y={cy + 28} fontSize={9} fill={T.muted}
          textAnchor="middle" fontFamily={fontNum}>
          {focusedPct}%
        </text>
      )}
    </svg>
  );
}

// ── Line chart (monthly trend, dual axis) ─────────────────────────
function SvgLineChart({ series, labels, width = 320, height = 170 }) {
  const pad = { t: 16, r: 38, b: 26, l: 36 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxL = chartNiceMax(Math.max(1, ...series[0].data), 3);
  const maxR = chartNiceMax(Math.max(1, ...series[1].data), 3);
  const n = labels.length;
  const xs = i => pad.l + (i / Math.max(1, (n - 1))) * w;
  const pathFor = (data, max) => data.map((v, i) =>
    `${i === 0 ? 'M' : 'L'}${xs(i)},${pad.t + h * (1 - v / max)}`
  ).join(' ');
  const areaFor = (data, max) =>
    pathFor(data, max) + ` L${xs(n - 1)},${pad.t + h} L${xs(0)},${pad.t + h} Z`;

  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const rel = (p.x - pad.l) / w;
    const i = Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
    setHover(i);
  });

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      <defs>
        <linearGradient id="lg-a" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={T.accent} stopOpacity={0.35} />
          <stop offset="1" stopColor={T.accent} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="lg-b" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={T.accent2} stopOpacity={0.3} />
          <stop offset="1" stopColor={T.accent2} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={pad.l + w}
          y1={pad.t + h * f} y2={pad.t + h * f}
          stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
      ))}
      {[0, 0.5, 1].map((f, i) => (
        <text key={`yl-${i}`} x={pad.l - 4} y={pad.t + h * (1 - f) + 3}
          fontSize={9} fill={T.muted} textAnchor="end" fontFamily={fontNum}>
          {Math.round(maxL * f)}
        </text>
      ))}
      {[0, 0.5, 1].map((f, i) => (
        <text key={`yr-${i}`} x={width - pad.r + 4} y={pad.t + h * (1 - f) + 3}
          fontSize={9} fill={T.muted} textAnchor="start" fontFamily={fontNum}>
          {Math.round(maxR * f)}
        </text>
      ))}
      <path d={areaFor(series[0].data, maxL)} fill="url(#lg-a)" />
      <path d={pathFor(series[0].data, maxL)} fill="none"
        stroke={T.accent} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={pathFor(series[1].data, maxR)} fill="none"
        stroke={T.accent2} strokeWidth={1.5} strokeDasharray="3 2" strokeLinejoin="round" />
      {labels.map((l, i) => (
        <text key={i} x={xs(i)} y={height - 8}
          fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>{l}</text>
      ))}
      <text x={4} y={pad.t + 4} fontSize={8} fill={T.accent} fontFamily={fontNum}>verres</text>
      <text x={width - 4} y={pad.t + 4} fontSize={8} fill={T.accent2} fontFamily={fontNum} textAnchor="end">g/mois</text>
      {hover != null && (() => {
        const tx = xs(hover);
        const v0 = series[0].data[hover];
        const v1 = series[1].data[hover];
        const cy0 = pad.t + h * (1 - v0 / maxL);
        const cy1 = pad.t + h * (1 - v1 / maxR);
        return (
          <>
            <line x1={tx} x2={tx} y1={pad.t} y2={pad.t + h}
              stroke={T.ink2} strokeDasharray="2 3" strokeWidth={0.8} opacity={0.7} />
            <circle cx={tx} cy={cy0} r={3.5} fill={T.accent} stroke={T.surface} strokeWidth={1.2} />
            <circle cx={tx} cy={cy1} r={3.5} fill={T.accent2} stroke={T.surface} strokeWidth={1.2} />
            <ChartTooltip x={tx} y={Math.min(cy0, cy1)} width={width}
              lines={[`${labels[hover]}`, `${v0} verres`, `${v1} g`]} />
          </>
        );
      })()}
    </svg>
  );
}
// ── Polar clock (24h consumption distribution) ───────────────────
function SvgPolarClock({ hours, size = 260 }) {
  const cx = size / 2, cy = size / 2;
  const rOuter = size / 2 - 22;
  const rInner = size / 2 * 0.38;
  const max = Math.max(1, ...hours);
  const wedge = (i) => {
    const a0 = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2 - Math.PI / 2;
    const v = hours[i];
    const r = rInner + (v / max) * (rOuter - rInner);
    return { a0, a1, r, v };
  };
  const arcs = [];
  for (let i = 0; i < 24; i++) {
    const { a0, a1, r, v } = wedge(i);
    if (r - rInner < 0.5) continue;
    const x0 = cx + Math.cos(a0) * rInner, y0 = cy + Math.sin(a0) * rInner;
    const x1 = cx + Math.cos(a1) * rInner, y1 = cy + Math.sin(a1) * rInner;
    const x2 = cx + Math.cos(a1) * r, y2 = cy + Math.sin(a1) * r;
    const x3 = cx + Math.cos(a0) * r, y3 = cy + Math.sin(a0) * r;
    arcs.push(
      <path key={i} d={`M${x0},${y0} L${x3},${y3} A${r},${r} 0 0 1 ${x2},${y2} L${x1},${y1} A${rInner},${rInner} 0 0 0 ${x0},${y0} Z`}
        fill={T.accent} fillOpacity={0.3 + (v / max) * 0.55} />
    );
  }
  const labels = [
    { h: 0, txt: '0h' }, { h: 6, txt: '6h' },
    { h: 12, txt: '12h' }, { h: 18, txt: '18h' },
  ];
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const dx = p.x - cx, dy = p.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > rOuter + 8 || dist < rInner - 4) { setHover(null); return; }
    let a = Math.atan2(dy, dx) + Math.PI / 2;
    if (a < 0) a += 2 * Math.PI;
    const idx = Math.floor((a / (Math.PI * 2)) * 24) % 24;
    setHover(idx);
  });
  return (
    <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} width="100%" height={size}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={T.rule} strokeWidth={0.5} strokeDasharray="2 3" />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={T.rule} strokeWidth={0.5} />
      {[0.33, 0.66].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={rInner + (rOuter - rInner) * f}
          fill="none" stroke={T.rule} strokeWidth={0.4} strokeDasharray="1 2" />
      ))}
      {arcs}
      {labels.map(({ h, txt }) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + Math.cos(a) * (rOuter + 12);
        const ly = cy + Math.sin(a) * (rOuter + 12) + 3;
        return (
          <text key={h} x={lx} y={ly} fontSize={11} fill={T.ink2}
            textAnchor="middle" fontFamily={fontNum}>{txt}</text>
        );
      })}
      {hover != null && (() => {
        const { a0, a1, r, v } = wedge(hover);
        const aMid = (a0 + a1) / 2;
        const tx = cx + Math.cos(aMid) * Math.max(rInner + 4, r);
        const ty = cy + Math.sin(aMid) * Math.max(rInner + 4, r);
        return (
          <ChartTooltip x={tx} y={ty} width={size}
            lines={[`${hover}h – ${(hover + 1) % 24}h`,
              `${v} boisson${v > 1 ? 's' : ''}`]} />
        );
      })()}
    </svg>
  );
}

// ── BAC projection curve ──────────────────────────────────────────
// Scrubbable like the Revolut spending chart: pressing & dragging the
// finger across the curve reveals the BAC at that exact moment, with
// the elapsed/remaining time relative to "now" (t = 0).
function SvgBACProjection({ points, width = 320, height = 150, now = 0 }) {
  if (!points || points.length === 0) {
    return <div style={{
      color: T.muted, fontSize: 11, padding: '20px 0', textAlign: 'center',
    }}>Aucune donnée d'alcoolémie</div>;
  }
  const pad = { t: 18, r: 10, b: 22, l: 36 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxT = Math.max(...points.map(p => p.t));
  const minT = Math.min(...points.map(p => p.t));
  const maxB = chartNiceMax(Math.max(500, ...points.map(p => p.bac)), 4);
  const xs = t => pad.l + ((t - minT) / Math.max(0.001, (maxT - minT))) * w;
  const ys = b => pad.t + h * (1 - b / maxB);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t)},${ys(p.bac)}`).join(' ');
  const area = path + ` L${xs(maxT)},${pad.t + h} L${xs(minT)},${pad.t + h} Z`;

  const thresh = [
    { y: 200, label: '200 mg/L', color: T.good },
    { y: 500, label: '500 légal', color: T.accent2 },
  ].filter(l => l.y <= maxB);

  const svgRef = React.useRef(null);
  const [scrubT, setScrubT] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setScrubT(null); return; }
    const t = minT + ((p.x - pad.l) / Math.max(1, w)) * (maxT - minT);
    setScrubT(Math.max(minT, Math.min(maxT, t)));
  });

  // Pick the displayed point: scrubber wins, otherwise default to "now".
  const focusT = scrubT != null ? scrubT : now;
  const focusPoint = (() => {
    if (focusT == null) return null;
    let best = points[0], bestDiff = Math.abs(points[0].t - focusT);
    for (let i = 1; i < points.length; i++) {
      const diff = Math.abs(points[i].t - focusT);
      if (diff < bestDiff) { best = points[i]; bestDiff = diff; }
    }
    return best;
  })();

  const fmtRel = (t) => {
    if (Math.abs(t) < 0.05) return 'maintenant';
    const sign = t < 0 ? 'il y a ' : 'dans ';
    const abs = Math.abs(t);
    const hh = Math.floor(abs);
    const mm = Math.round((abs - hh) * 60);
    if (hh === 0) return `${sign}${mm}min`;
    if (mm === 0) return `${sign}${hh}h`;
    return `${sign}${hh}h${String(mm).padStart(2, '0')}`;
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      <defs>
        <linearGradient id="bac-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={T.accent2} stopOpacity={0.35} />
          <stop offset="1" stopColor={T.accent2} stopOpacity={0} />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.l} x2={pad.l + w} y1={pad.t + h * (1 - f)} y2={pad.t + h * (1 - f)}
            stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.5} opacity={0.6} />
          <text x={pad.l - 4} y={pad.t + h * (1 - f) + 3} fontSize={9} fill={T.muted}
            textAnchor="end" fontFamily={fontNum}>{Math.round(maxB * f)}</text>
        </g>
      ))}
      {thresh.map((l, i) => (
        <g key={`th-${i}`}>
          <line x1={pad.l} x2={pad.l + w} y1={ys(l.y)} y2={ys(l.y)}
            stroke={l.color} strokeDasharray="3 3" strokeWidth={0.8} opacity={0.7} />
          <text x={pad.l + w - 2} y={ys(l.y) - 3} fontSize={8} fill={l.color}
            textAnchor="end" fontFamily={fontNum}>{l.label}</text>
        </g>
      ))}
      <path d={area} fill="url(#bac-grad)" />
      <path d={path} fill="none" stroke={T.accent2} strokeWidth={1.8} strokeLinejoin="round" />
      {/* "Now" marker is always visible */}
      {now >= minT && now <= maxT && (
        <line x1={xs(now)} x2={xs(now)} y1={pad.t} y2={pad.t + h}
          stroke={T.accent} strokeWidth={1} strokeDasharray="2 2" opacity={0.55} />
      )}
      {[0, 2, 4, 6, 8, 10, 12].filter(t => t >= minT && t <= maxT).map((t, i) => (
        <text key={i} x={xs(t)} y={height - 6}
          fontSize={9} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>
          {t === 0 ? '0h' : `+${t}h`}
        </text>
      ))}
      {focusPoint && (
        <>
          <line x1={xs(focusPoint.t)} x2={xs(focusPoint.t)} y1={pad.t} y2={pad.t + h}
            stroke={scrubT != null ? T.ink : T.accent} strokeWidth={1.2}
            strokeDasharray={scrubT != null ? '0' : '2 2'} opacity={scrubT != null ? 0.85 : 0.55} />
          <circle cx={xs(focusPoint.t)} cy={ys(focusPoint.bac)}
            r={4.2} fill={scrubT != null ? T.ink : T.accent}
            stroke={T.bg} strokeWidth={1.5} />
          <ChartTooltip x={xs(focusPoint.t)} y={ys(focusPoint.bac)} width={width}
            lines={[`${focusPoint.bac} mg/L`, fmtRel(focusPoint.t)]} />
        </>
      )}
    </svg>
  );
}
// ── Histogram (session duration / session BAC) ───────────────────
function SvgHistogram({ buckets, width = 320, height = 150, color, valueLabel }) {
  const pad = { t: 14, r: 8, b: 24, l: 8 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...buckets.map(b => b.v));
  const bw = w / buckets.length;
  const svgRef = React.useRef(null);
  const [hover, setHover] = React.useState(null);
  const scr = useChartScrubber(svgRef, null, (p) => {
    if (!p) { setHover(null); return; }
    const i = Math.max(0, Math.min(buckets.length - 1, Math.floor((p.x - pad.l) / bw)));
    setHover(i);
  });
  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
      style={{ display: 'block', touchAction: 'pan-y' }} {...scr.handlers}>
      {buckets.map((b, i) => {
        const bh = b.v > 0 ? Math.max(2, (b.v / max) * h) : 0;
        const x = pad.l + i * bw + bw * 0.12;
        const y = pad.t + h - bh;
        const isHover = hover === i;
        return (
          <g key={i}>
            {bh > 0 && <rect x={x} y={y} width={bw * 0.76} height={bh}
              fill={color || T.accent} rx={2}
              opacity={isHover ? 1 : 0.85} />}
            <text x={x + bw * 0.5} y={height - 8}
              fontSize={9.5} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>
              {b.label}
            </text>
            {b.v > 0 && (
              <text x={x + bw * 0.5} y={y - 4}
                fontSize={9} fill={T.ink2} textAnchor="middle" fontFamily={fontNum}>{b.v}</text>
            )}
          </g>
        );
      })}
      {hover != null && (() => {
        const b = buckets[hover];
        const tx = pad.l + hover * bw + bw / 2;
        const ty = pad.t + h - (b.v / max) * h;
        return (
          <ChartTooltip x={tx} y={ty} width={width}
            lines={[`${b.label}`, `${b.v}${valueLabel ? ' ' + valueLabel : ' session' + (b.v > 1 ? 's' : '')}`]} />
        );
      })()}
    </svg>
  );
}

Object.assign(window, {
  chartNiceMax, SvgBarChart, SvgRadar, SvgDonut, SvgLineChart,
  SvgPolarClock, SvgBACProjection, SvgHistogram,
  useChartScrubber, ChartTooltip,
});

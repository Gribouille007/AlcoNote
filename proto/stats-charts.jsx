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

// ── Bar chart (hourly distribution) ───────────────────────────────
function SvgBarChart({ data, width = 320, height = 140, color, formatX }) {
  const pad = { t: 14, r: 6, b: 22, l: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = chartNiceMax(Math.max(1, ...data.map(d => d.v)), 3);
  const bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {[0, 0.5, 1].map((f, i) => (
        <line key={i} x1={pad.l} x2={width - pad.r}
          y1={pad.t + h * (1 - f)} y2={pad.t + h * (1 - f)}
          stroke={T.rule} strokeDasharray="2 3" strokeWidth={0.6} />
      ))}
      {[0, max].map((t, i) => (
        <text key={i} x={pad.l - 4} y={pad.t + h * (1 - t / max) + 3}
          fontSize={8} fill={T.muted} textAnchor="end" fontFamily={fontNum}>
          {t}
        </text>
      ))}
      {data.map((d, i) => {
        const bh = d.v > 0 ? Math.max(2, (d.v / max) * h) : 0;
        const x = pad.l + i * bw + bw * 0.18;
        const y = pad.t + h - bh;
        return (
          <g key={i}>
            {bh > 0 && (
              <rect x={x} y={y} width={bw * 0.64} height={bh}
                fill={color || T.accent} rx={1.5} opacity={0.85} />
            )}
            {(formatX ? formatX(d, i) : d.label) && (i % Math.ceil(data.length / 8) === 0) && (
              <text x={x + bw * 0.32} y={height - 8}
                fontSize={8} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>
                {formatX ? formatX(d, i) : d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Radar (weekday distribution) ──────────────────────────────────
function SvgRadar({ data, size = 220, color }) {
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

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ display: 'block' }}>
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
        return <circle key={i} cx={x} cy={y} r={2.5} fill={color || T.accent} />;
      })}
      {data.map((d, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 14);
        const ly = cy + Math.sin(a) * (r + 14) + 3;
        const today = d.today;
        return (
          <text key={i} x={lx} y={ly}
            fontSize={10} fill={today ? T.accent : T.ink2}
            fontWeight={today ? 600 : 400}
            textAnchor="middle">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
// ── Donut chart (category distribution) ───────────────────────────
function SvgDonut({ data, size = 140, thickness = 22 }) {
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const total = data.reduce((s, d) => s + d.v, 0) || 1;
  let acc = 0;
  const arc = (frac) => {
    const a0 = acc / total * Math.PI * 2 - Math.PI / 2;
    const a1 = (acc + frac) / total * Math.PI * 2 - Math.PI / 2;
    acc += frac;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const large = frac / total > 0.5 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.rule} strokeWidth={thickness} />
      {data.map((d, i) => (
        <path key={i} d={arc(d.v)} fill="none"
          stroke={catColor(d.name, 65)}
          strokeWidth={thickness} strokeLinecap="butt" />
      ))}
      <text x={cx} y={cy - 2} fontSize={11} fill={T.muted}
        textAnchor="middle" letterSpacing="1">TOTAL</text>
      <text x={cx} y={cy + 16} fontSize={20} fill={T.ink}
        textAnchor="middle" fontFamily={fontSerif} fontStyle="italic">
        {Math.round(total)}
      </text>
    </svg>
  );
}

// ── Line chart (monthly trend, dual axis) ─────────────────────────
function SvgLineChart({ series, labels, width = 320, height = 160 }) {
  const pad = { t: 14, r: 34, b: 24, l: 30 };
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
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
      <text x={width - 4} y={pad.t + 4} fontSize={8} fill={T.accent2} fontFamily={fontNum} textAnchor="end">g/sem</text>
    </svg>
  );
}
// ── Polar clock (24h consumption distribution) ───────────────────
function SvgPolarClock({ hours, size = 240 }) {
  const cx = size / 2, cy = size / 2;
  const rOuter = size / 2 - 18;
  const rInner = size / 2 * 0.38;
  const max = Math.max(1, ...hours);
  const arcs = [];
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 24) * Math.PI * 2 - Math.PI / 2;
    const v = hours[i];
    const r = rInner + (v / max) * (rOuter - rInner);
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
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke={T.rule} strokeWidth={0.5} strokeDasharray="2 3" />
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke={T.rule} strokeWidth={0.5} />
      {[0.33, 0.66].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={rInner + (rOuter - rInner) * f}
          fill="none" stroke={T.rule} strokeWidth={0.4} strokeDasharray="1 2" />
      ))}
      {arcs}
      {labels.map(({ h, txt }) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + Math.cos(a) * (rOuter + 10);
        const ly = cy + Math.sin(a) * (rOuter + 10) + 3;
        return (
          <text key={h} x={lx} y={ly} fontSize={10} fill={T.ink2}
            textAnchor="middle" fontFamily={fontNum}>{txt}</text>
        );
      })}
    </svg>
  );
}

// ── BAC projection curve ──────────────────────────────────────────
function SvgBACProjection({ points, width = 320, height = 120, now = 0 }) {
  if (!points || points.length === 0) {
    return <div style={{
      color: T.muted, fontSize: 11, padding: '20px 0', textAlign: 'center',
    }}>Aucune donnée d'alcoolémie</div>;
  }
  const pad = { t: 10, r: 8, b: 20, l: 30 };
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
    { y: 200, label: '200', color: T.good },
    { y: 500, label: '500 légal', color: T.accent2 },
  ].filter(l => l.y <= maxB);

  const nowPoint = points.find(p => Math.abs(p.t - now) < 0.05) || points[0];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="bac-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={T.accent2} stopOpacity={0.35} />
          <stop offset="1" stopColor={T.accent2} stopOpacity={0} />
        </linearGradient>
      </defs>
      {thresh.map((l, i) => (
        <g key={i}>
          <line x1={pad.l} x2={pad.l + w} y1={ys(l.y)} y2={ys(l.y)}
            stroke={l.color} strokeDasharray="3 3" strokeWidth={0.8} opacity={0.6} />
          <text x={pad.l + w - 2} y={ys(l.y) - 2} fontSize={8} fill={l.color}
            textAnchor="end" fontFamily={fontNum}>{l.label}</text>
        </g>
      ))}
      <path d={area} fill="url(#bac-grad)" />
      <path d={path} fill="none" stroke={T.accent2} strokeWidth={1.8} strokeLinejoin="round" />
      {now >= minT && now <= maxT && (
        <>
          <line x1={xs(now)} x2={xs(now)} y1={pad.t} y2={pad.t + h}
            stroke={T.accent} strokeWidth={1} strokeDasharray="2 2" opacity={0.7} />
          <circle cx={xs(now)} cy={ys(nowPoint.bac)}
            r={3.5} fill={T.accent} />
          <text x={xs(now)} y={pad.t + 8} fontSize={8} fill={T.accent}
            textAnchor="middle" fontFamily={fontNum}>MAINTENANT</text>
        </>
      )}
      {[0, 2, 4, 6, 8, 10].filter(t => t >= minT && t <= maxT).map((t, i) => (
        <text key={i} x={xs(t)} y={height - 6}
          fontSize={8} fill={T.muted} textAnchor="middle" fontFamily={fontNum}>
          {t === 0 ? '0h' : `+${t}h`}
        </text>
      ))}
    </svg>
  );
}
// ── Histogram (session duration / session BAC) ───────────────────
function SvgHistogram({ buckets, width = 150, height = 120, color }) {
  const pad = { t: 6, r: 4, b: 26, l: 4 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...buckets.map(b => b.v));
  const bw = w / buckets.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {buckets.map((b, i) => {
        const bh = b.v > 0 ? Math.max(2, (b.v / max) * h) : 0;
        const x = pad.l + i * bw + bw * 0.12;
        const y = pad.t + h - bh;
        return (
          <g key={i}>
            {bh > 0 && <rect x={x} y={y} width={bw * 0.76} height={bh}
              fill={color || T.accent} rx={2} opacity={0.85} />}
            <text x={x + bw * 0.38} y={height - 14}
              fontSize={7.5} fill={T.muted} textAnchor="middle" fontFamily={fontNum}
              transform={`rotate(-30 ${x + bw * 0.38} ${height - 14})`}>
              {b.label}
            </text>
            {b.v > 0 && (
              <text x={x + bw * 0.38} y={y - 3}
                fontSize={8} fill={T.ink2} textAnchor="middle" fontFamily={fontNum}>{b.v}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

Object.assign(window, {
  chartNiceMax, SvgBarChart, SvgRadar, SvgDonut, SvgLineChart,
  SvgPolarClock, SvgBACProjection, SvgHistogram,
});

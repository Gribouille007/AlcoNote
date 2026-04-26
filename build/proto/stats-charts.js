// stats-charts.jsx — SVG chart primitives for the Statistiques tab.

// ── Shared helpers ────────────────────────────────────────────────
function niceMax(v, ticks = 4) {
  if (!v) return 1;
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  return step * ticks;
}

// ── Bar chart (hourly distribution) ───────────────────────────────
function SvgBarChart({
  data,
  width = 320,
  height = 140,
  color,
  formatX
}) {
  const pad = {
    t: 14,
    r: 6,
    b: 22,
    l: 22
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.map(d => d.v)), 3);
  const bw = w / data.length;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block'
    }
  }, [0, 0.5, 1].map((f, i) => /*#__PURE__*/React.createElement("line", {
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
    fontSize: 8,
    fill: T.muted,
    textAnchor: "end",
    fontFamily: fontNum
  }, t)), data.map((d, i) => {
    const bh = d.v > 0 ? Math.max(2, d.v / max * h) : 0;
    const x = pad.l + i * bw + bw * 0.18;
    const y = pad.t + h - bh;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, bh > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: bw * 0.64,
      height: bh,
      fill: color || T.accent,
      rx: 1.5,
      opacity: 0.85
    }), (formatX ? formatX(d, i) : d.label) && i % Math.ceil(data.length / 8) === 0 && /*#__PURE__*/React.createElement("text", {
      x: x + bw * 0.32,
      y: height - 8,
      fontSize: 8,
      fill: T.muted,
      textAnchor: "middle",
      fontFamily: fontNum
    }, formatX ? formatX(d, i) : d.label));
  }));
}

// ── Radar (weekday distribution) ──────────────────────────────────
function SvgRadar({
  data,
  size = 220,
  color
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

  // grid rings
  const rings = [0.33, 0.66, 1];
  const gridPath = frac => data.map((_, i) => {
    const a = angle(i);
    return `${i === 0 ? 'M' : 'L'}${cx + Math.cos(a) * r * frac},${cy + Math.sin(a) * r * frac}`;
  }).join(' ') + 'Z';
  const dataPath = data.map((d, i) => {
    const [x, y] = pt(i, d.v);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + 'Z';
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: "100%",
    height: size,
    style: {
      display: 'block'
    }
  }, rings.map((f, i) => /*#__PURE__*/React.createElement("path", {
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
    return /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: x,
      cy: y,
      r: 2.5,
      fill: color || T.accent
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
      fontSize: 10,
      fill: today ? T.accent : T.ink2,
      fontWeight: today ? 600 : 400,
      textAnchor: "middle"
    }, d.label);
  }));
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
  let acc = 0;
  const arc = frac => {
    const a0 = acc / total * Math.PI * 2 - Math.PI / 2;
    const a1 = (acc + frac) / total * Math.PI * 2 - Math.PI / 2;
    acc += frac;
    const x0 = cx + Math.cos(a0) * r,
      y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r,
      y1 = cy + Math.sin(a1) * r;
    const large = frac / total > 0.5 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  };
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: r,
    fill: "none",
    stroke: T.rule,
    strokeWidth: thickness
  }), data.map((d, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: arc(d.v),
    fill: "none",
    stroke: catColor(d.name, 65),
    strokeWidth: thickness,
    strokeLinecap: "butt"
  })), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy - 2,
    fontSize: 11,
    fill: T.muted,
    textAnchor: "middle",
    letterSpacing: "1"
  }, "TOTAL"), /*#__PURE__*/React.createElement("text", {
    x: cx,
    y: cy + 16,
    fontSize: 20,
    fill: T.ink,
    textAnchor: "middle",
    fontFamily: fontSerif,
    fontStyle: "italic"
  }, Math.round(total)));
}

// ── Line chart (monthly trend, dual axis) ─────────────────────────
function SvgLineChart({
  series,
  labels,
  width = 320,
  height = 160
}) {
  const pad = {
    t: 14,
    r: 34,
    b: 24,
    l: 30
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxL = niceMax(Math.max(...series[0].data), 3);
  const maxR = niceMax(Math.max(...series[1].data), 3);
  const n = labels.length;
  const xs = i => pad.l + i / (n - 1) * w;
  const pathFor = (data, max) => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i)},${pad.t + h * (1 - v / max)}`).join(' ');
  const areaFor = (data, max) => pathFor(data, max) + ` L${xs(n - 1)},${pad.t + h} L${xs(0)},${pad.t + h} Z`;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
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
  })), /*#__PURE__*/React.createElement("path", {
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
  }, "g/sem"));
}

// ── Polar clock (24h consumption distribution) ───────────────────
function SvgPolarClock({
  hours,
  size = 240
}) {
  const cx = size / 2,
    cy = size / 2;
  const rOuter = size / 2 - 18;
  const rInner = size / 2 * 0.38;
  const max = Math.max(1, ...hours);
  const arcs = [];
  for (let i = 0; i < 24; i++) {
    const a0 = i / 24 * Math.PI * 2 - Math.PI / 2;
    const a1 = (i + 1) / 24 * Math.PI * 2 - Math.PI / 2;
    const v = hours[i];
    const r = rInner + v / max * (rOuter - rInner);
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
  // hour labels at cardinal points
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
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${size} ${size}`,
    width: "100%",
    height: size,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("circle", {
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
    const lx = cx + Math.cos(a) * (rOuter + 10);
    const ly = cy + Math.sin(a) * (rOuter + 10) + 3;
    return /*#__PURE__*/React.createElement("text", {
      key: h,
      x: lx,
      y: ly,
      fontSize: 10,
      fill: T.ink2,
      textAnchor: "middle",
      fontFamily: fontNum
    }, txt);
  }));
}

// ── BAC projection curve ──────────────────────────────────────────
function SvgBACProjection({
  points,
  width = 320,
  height = 120,
  now = 0.3
}) {
  // points: [{t: hours-from-now, bac: mg/L}]
  const pad = {
    t: 10,
    r: 8,
    b: 20,
    l: 30
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const maxT = Math.max(...points.map(p => p.t));
  const minT = Math.min(...points.map(p => p.t));
  const maxB = niceMax(Math.max(500, ...points.map(p => p.bac)), 4);
  const xs = t => pad.l + (t - minT) / (maxT - minT) * w;
  const ys = b => pad.t + h * (1 - b / maxB);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(p.t)},${ys(p.bac)}`).join(' ');
  const area = path + ` L${xs(maxT)},${pad.t + h} L${xs(minT)},${pad.t + h} Z`;

  // threshold lines
  const thresh = [{
    y: 200,
    label: '200',
    color: T.good
  }, {
    y: 500,
    label: '500 légal',
    color: T.accent2
  }].filter(l => l.y <= maxB);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "bac-grad",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: T.accent2,
    stopOpacity: 0.35
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: T.accent2,
    stopOpacity: 0
  }))), thresh.map((l, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    x1: pad.l,
    x2: pad.l + w,
    y1: ys(l.y),
    y2: ys(l.y),
    stroke: l.color,
    strokeDasharray: "3 3",
    strokeWidth: 0.8,
    opacity: 0.6
  }), /*#__PURE__*/React.createElement("text", {
    x: pad.l + w - 2,
    y: ys(l.y) - 2,
    fontSize: 8,
    fill: l.color,
    textAnchor: "end",
    fontFamily: fontNum
  }, l.label))), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: "url(#bac-grad)"
  }), /*#__PURE__*/React.createElement("path", {
    d: path,
    fill: "none",
    stroke: T.accent2,
    strokeWidth: 1.8,
    strokeLinejoin: "round"
  }), /*#__PURE__*/React.createElement("line", {
    x1: xs(now),
    x2: xs(now),
    y1: pad.t,
    y2: pad.t + h,
    stroke: T.accent,
    strokeWidth: 1,
    strokeDasharray: "2 2",
    opacity: 0.7
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xs(now),
    cy: ys(points.find(p => Math.abs(p.t - now) < 0.01)?.bac || points[0].bac),
    r: 3.5,
    fill: T.accent
  }), /*#__PURE__*/React.createElement("text", {
    x: xs(now),
    y: pad.t + 8,
    fontSize: 8,
    fill: T.accent,
    textAnchor: "middle",
    fontFamily: fontNum
  }, "MAINTENANT"), [0, 2, 4, 6, 8, 10].filter(t => t >= minT && t <= maxT).map((t, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: xs(t),
    y: height - 6,
    fontSize: 8,
    fill: T.muted,
    textAnchor: "middle",
    fontFamily: fontNum
  }, t === 0 ? '0h' : `+${t}h`)));
}

// ── Histogram (session duration / session BAC) ───────────────────
function SvgHistogram({
  buckets,
  width = 150,
  height = 120,
  color
}) {
  const pad = {
    t: 6,
    r: 4,
    b: 26,
    l: 4
  };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const max = Math.max(1, ...buckets.map(b => b.v));
  const bw = w / buckets.length;
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width: "100%",
    height: height,
    style: {
      display: 'block'
    }
  }, buckets.map((b, i) => {
    const bh = b.v > 0 ? Math.max(2, b.v / max * h) : 0;
    const x = pad.l + i * bw + bw * 0.12;
    const y = pad.t + h - bh;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, bh > 0 && /*#__PURE__*/React.createElement("rect", {
      x: x,
      y: y,
      width: bw * 0.76,
      height: bh,
      fill: color || T.accent,
      rx: 2,
      opacity: 0.85
    }), /*#__PURE__*/React.createElement("text", {
      x: x + bw * 0.38,
      y: height - 14,
      fontSize: 7.5,
      fill: T.muted,
      textAnchor: "middle",
      fontFamily: fontNum,
      transform: `rotate(-30 ${x + bw * 0.38} ${height - 14})`
    }, b.label), b.v > 0 && /*#__PURE__*/React.createElement("text", {
      x: x + bw * 0.38,
      y: y - 3,
      fontSize: 8,
      fill: T.ink2,
      textAnchor: "middle",
      fontFamily: fontNum
    }, b.v));
  }));
}
Object.assign(window, {
  niceMax,
  SvgBarChart,
  SvgRadar,
  SvgDonut,
  SvgLineChart,
  SvgPolarClock,
  SvgBACProjection,
  SvgHistogram
});
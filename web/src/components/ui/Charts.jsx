import { useState, useEffect, useRef, useId } from "react";
import { formatINRk } from "@/utils/format";

// Smooth catmull-rom → bezier path through points [[x,y],...]
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * LineChart — billed vs collected over time
 * data: [{ m: "Jan", billed: 500000, collected: 420000 }, ...]
 */
export function LineChart({ data, accent = "#E11D2C", height = 240 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(620);
  const [hover, setHover] = useState(null);
  const [anim, setAnim] = useState(true);
  const uid = useId().replace(/:/g, "");
  const gradId = `lc-area-${uid}`;

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div ref={wrapRef} style={{ width: "100%", height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>No data yet</p>
      </div>
    );
  }

  const padL = 46, padR = 14, padT = 16, padB = 28;
  const innerW = Math.max(10, w - padL - padR);
  const innerH = height - padT - padB;
  const all = data.flatMap((d) => [d.billed, d.collected]);
  const max = Math.max(...all, 1) * 1.12;
  const min = 0;
  const xOf = (i) => padL + (innerW * i) / Math.max(data.length - 1, 1);
  const yOf = (v) => padT + innerH - (innerH * (v - min)) / (max - min);

  const billedPts = data.map((d, i) => [xOf(i), yOf(d.billed)]);
  const collPts = data.map((d, i) => [xOf(i), yOf(d.collected)]);
  const billedD = smoothPath(billedPts);
  const collD = smoothPath(collPts);
  const areaD = billedD ? billedD + ` L ${xOf(data.length - 1)},${padT + innerH} L ${padL},${padT + innerH} Z` : "";
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);

  return (
    <div ref={wrapRef} style={{ width: "100%", position: "relative" }}>
      <svg width={w} height={height} style={{ display: "block", overflow: "visible" }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grid lines + y-axis labels */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={yOf(gv)} x2={w - padR} y2={yOf(gv)} stroke="#EFEFF1" strokeWidth="1" />
            <text x={padL - 10} y={yOf(gv) + 3} textAnchor="end" fontSize="10" fill="#A9ACB3" fontFamily="inherit">
              {formatINRk(Math.round(gv)).replace("₹", "")}
            </text>
          </g>
        ))}
        {/* x-axis labels */}
        {data.map((d, i) => (
          <text key={i} x={xOf(i)} y={height - 8} textAnchor="middle" fontSize="10.5" fill="#A9ACB3" fontFamily="inherit">
            {d.m}
          </text>
        ))}
        {/* area fill */}
        <path d={areaD} fill={`url(#${gradId})`} style={{ opacity: anim ? 1 : 0, transition: "opacity .6s ease" }} />
        {/* collected line — dashed-draw animation */}
        <path d={collD} fill="none" stroke="#C9CCD4" strokeWidth="2.4" strokeLinecap="round"
          strokeDasharray="2200" strokeDashoffset={anim ? 0 : 2200}
          style={{ transition: "stroke-dashoffset 1.1s ease" }} />
        {/* billed line — dashed-draw animation */}
        <path d={billedD} fill="none" stroke={accent} strokeWidth="2.8" strokeLinecap="round"
          strokeDasharray="2200" strokeDashoffset={anim ? 0 : 2200}
          style={{ transition: "stroke-dashoffset 1.1s ease .1s" }} />
        {/* invisible hover hit areas */}
        {data.map((d, i) => (
          <rect key={i}
            x={xOf(i) - innerW / (data.length * 2)}
            y={padT} width={innerW / data.length} height={innerH}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {/* hover indicators */}
        {hover != null && (
          <g>
            <line x1={xOf(hover)} y1={padT} x2={xOf(hover)} y2={padT + innerH}
              stroke={accent} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx={xOf(hover)} cy={yOf(data[hover].billed)} r="4.5" fill="#fff" stroke={accent} strokeWidth="2.5" />
            <circle cx={xOf(hover)} cy={yOf(data[hover].collected)} r="4" fill="#fff" stroke="#C9CCD4" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {/* tooltip */}
      {hover != null && (
        <div style={{
          position: "absolute",
          left: Math.min(Math.max(xOf(hover) - 70, 4), w - 144),
          top: 6,
          background: "#0A0A0A", color: "#fff", borderRadius: 10,
          padding: "9px 12px", fontSize: 11, pointerEvents: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,.25)", width: 130,
          fontFamily: "inherit",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 5, fontSize: 11.5 }}>{data[hover].m}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ color: "rgba(255,255,255,.6)" }}>
              <span style={{ color: accent }}>●</span> Billed
            </span>
            <span style={{ fontWeight: 600 }}>{formatINRk(data[hover].billed)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,.6)" }}>
              <span style={{ color: "#C9CCD4" }}>●</span> Collected
            </span>
            <span style={{ fontWeight: 600 }}>{formatINRk(data[hover].collected)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DonutChart — status breakdown
 * data: [{ label: "Paid", value: 42, color: "#10B981" }, ...]
 * value is treated as a percentage; centerLabel / centerSub: text in the donut hole
 */
export function DonutChart({ data, size = 168, thickness = 22, centerLabel, centerSub }) {
  const [anim] = useState(true);
  const [active, setActive] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: size }}>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>No data yet</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: size }}>
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>No data yet</p>
      </div>
    );
  }

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segs = data.map((d) => {
    const frac = d.value / total;
    const seg = {
      ...d,
      frac,
      dash: c * frac,
      gap: c * (1 - frac),
      rot: (offset / total) * 360,
    };
    offset += d.value;
    return seg;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F1F3" strokeWidth={thickness} />
          {segs.map((s, i) => (
            <circle key={i}
              cx={size / 2} cy={size / 2} r={r}
              fill="none" stroke={s.color}
              strokeWidth={active === i ? thickness + 4 : thickness}
              strokeLinecap="butt"
              strokeDasharray={`${anim ? s.dash : 0} ${c}`}
              transform={`rotate(${s.rot} ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dasharray 1s ease, stroke-width .15s", cursor: "pointer" }}
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
          ))}
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: "#0A0A0A", letterSpacing: "-0.02em" }}>
            {active != null ? segs[active].value + "%" : (centerLabel ?? total + "%")}
          </span>
          <span style={{ fontSize: 11, color: "#A9ACB3", fontWeight: 500 }}>
            {active != null ? segs[active].label : (centerSub ?? "of total")}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 120 }}>
        {segs.map((s, i) => (
          <div key={i}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: active == null || active === i ? 1 : 0.45, transition: "opacity .15s" }}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "#4B5563", fontWeight: 500, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 12.5, color: "#0A0A0A", fontWeight: 700 }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * MiniBars — sparkline bar chart for stat cards
 * values: number[] (last N data points, rightmost = latest)
 * color: accent color for the last bar
 *
 * Returns null when there are fewer than 2 entries, or all values are equal/zero
 * (prevents the ugly solid-block sparkline with only one month of data).
 */
export function MiniBars({ values = [], color = "#E11D2C", height = 38 }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === 0 || min === max) return null;

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }}>
      {values.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${(v / max) * 100}%`,
          minHeight: 3,
          background: i === values.length - 1 ? color : color + "33",
          borderRadius: 3,
          transition: "height .5s ease",
        }} />
      ))}
    </div>
  );
}

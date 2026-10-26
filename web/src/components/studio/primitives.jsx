import { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "./icons.jsx";

// ── Status map ────────────────────────────────────────────────────────────────
const STATUS = {
  draft: { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Draft" },
  saved: { bg: "#EFF6FF", color: "#1D4ED8", dot: "#3B82F6", label: "Saved" },
  sent: { bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B", label: "Sent" },
  partially_paid: { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", label: "Partial" },
  paid: { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Paid" },
  overdue: { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444", label: "Overdue" },
  credited: { bg: "#F5F3FF", color: "#6D28D9", dot: "#8B5CF6", label: "Credited" },
  accepted: { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Accepted" },
  rejected: { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444", label: "Rejected" },
  expired: { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Expired" },
  cancelled: { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Cancelled" },
};

// ── Style helpers ─────────────────────────────────────────────────────────────
export const ghostBtn = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "5px 9px", borderRadius: 8, border: "1px solid #ECECEE",
  background: "#fff", color: "#4B5563", fontSize: 11, fontWeight: 600,
  font: "inherit", cursor: "pointer", whiteSpace: "nowrap",
};

export const rowIcon = {
  width: 22, height: 22, borderRadius: 6, border: "1px solid transparent",
  background: "transparent", color: "#A9ACB3", cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};

export const thStyle = { padding: "12px 24px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", borderBottom: "1px solid #F3F4F6", background: "#F9FAFB" };
export const tdStyle = { padding: "16px 24px", fontSize: 13, color: "#0A0A0A", borderBottom: "1px solid #F3F4F6", verticalAlign: "middle" };

export function linkBtn(accent) {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    background: "transparent", border: "none", cursor: "pointer",
    color: accent, fontSize: 11, fontWeight: 650, font: "inherit",
  };
}

// ── Local helper ──────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(" ");
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

// ── Components ────────────────────────────────────────────────────────────────

export function Card({ children, style, pad = 16, hover, onClick }) {
  return (
    <motion.div
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(e); } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={hover ? { y: -2, boxShadow: "0 12px 30px rgba(0,0,0,.07)" } : undefined}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: "#fff", border: "1px solid #EEEEF0",
        borderRadius: 14, padding: pad,
        boxShadow: "0 1px 2px rgba(0,0,0,.035)",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}>
      {children}
    </motion.div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 6px 2px 5px", background: s.bg, borderRadius: 100,
      fontSize: 10, fontWeight: 650, color: s.color, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

export function Chip({ children, tone = "#6B7280", bg = "#F3F4F6" }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 5px",
      borderRadius: 6, fontSize: 9.5, fontWeight: 650, color: tone,
      background: bg, whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export function Pagination({ page, pages, onChange, accent = "#E11D2C" }) {
  const nums = [];
  for (let i = 1; i <= pages; i++) nums.push(i);
  const btn = (content, onClickFn, opts = {}) => (
    <button
      type="button"
      onClick={onClickFn}
      disabled={opts.disabled}
      style={{
        minWidth: 24, height: 24, padding: "0 4px", borderRadius: 6,
        cursor: opts.disabled ? "default" : "pointer",
        border: "1px solid " + (opts.active ? accent : "#ECECEE"),
        background: opts.active ? accent : "#fff",
        color: opts.active ? "#fff" : (opts.disabled ? "#C9CCD4" : "#4B5563"),
        fontSize: 11, fontWeight: 600, font: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .12s",
      }}>
      {content}
    </button>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {btn(<Icon name="chevronLeft" size={11} />, () => onChange(Math.max(1, page - 1)), { disabled: page === 1 })}
      {nums.map((n) => <span key={n}>{btn(n, () => onChange(n), { active: n === page })}</span>)}
      {btn(<Icon name="chevronRight" size={11} />, () => onChange(Math.min(pages, page + 1)), { disabled: page === pages })}
    </div>
  );
}

export function Avatar({ name, tone = "#E11D2C", size = 28, radius, src }) {
  const br = radius ?? size * 0.3;
  if (src) {
    return (
      <img src={src} alt={name || ""} style={{
        width: size, height: size, borderRadius: br, flexShrink: 0,
        objectFit: "cover", display: "block", background: "#F3F4F6",
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: br, flexShrink: 0,
      background: tone + "1A", color: tone,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 700,
    }}>
      {initials(name)}
    </div>
  );
}

export function EmptyState({ icon = "file", title, sub }) {
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const item = { hidden: { opacity: 0, y: 15, filter: "blur(4px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } };
  return (
    <motion.div variants={container} initial="hidden" animate="show" style={{ padding: "56px 24px", textAlign: "center" }}>
      <motion.div variants={item} style={{
        width: 56, height: 56, borderRadius: 16, background: "#F3F4F6",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <Icon name={icon} size={26} color="#C9CCD4" />
      </motion.div>
      <motion.p variants={item} style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{title}</motion.p>
      <motion.p variants={item} style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>{sub}</motion.p>
    </motion.div>
  );
}

export function NumberPopIn({ value }) {
  const str = String(value);
  const chars = str.split("");
  return (
    <span key={str} style={{ display: "inline-flex", alignItems: "baseline" }}>
      {chars.map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: [0.34, 1.45, 0.64, 1], delay: i * 0.04 }}
          style={{ display: "inline-block" }}
        >
          {ch === " " ? "\u00A0" : ch}
        </motion.span>
      ))}
    </span>
  );
}

export function MiniStat({ label, value, icon, tint, sub }) {
  return (
    <Card pad={14} style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0, position: "relative", overflow: "hidden",
        background: `linear-gradient(150deg, ${tint}30 0%, ${tint}17 52%, ${tint}0A 100%)`,
        boxShadow: `inset 0 0 0 1px ${tint}2E, 0 6px 14px -5px ${tint}4D`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* soft top-light highlight for a premium duotone feel */}
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "55%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0))",
          pointerEvents: "none",
        }} />
        <Icon name={icon} size={21} color={tint} strokeWidth={2.2} style={{ position: "relative" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11.5, color: "#8A8D94", margin: "0 0 2px", fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: 19, fontWeight: 800, color: "#0A0A0A", margin: 0, letterSpacing: "-0.03em" }}>
          <NumberPopIn value={value} />
        </p>
        {sub && <p style={{ fontSize: 10.5, color: "#A9ACB3", margin: "2px 0 0", fontWeight: 500 }}>{sub}</p>}
      </div>
    </Card>
  );
}

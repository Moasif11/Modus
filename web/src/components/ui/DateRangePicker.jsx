// web/src/components/ui/DateRangePicker.jsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  addDays, addMonths, endOfDay, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, isValid,
  parse, parseISO, startOfDay, startOfMonth, startOfWeek,
  subDays, subMonths,
} from "date-fns";
import { useClickOutside } from "./use-click-outside"; // kept for potential external use


function toISO(date) {
  return format(date, "yyyy-MM-dd");
}

function buildPresets() {
  const now = new Date();
  return [
    { key: "today",       label: "Today",        from: startOfDay(now),                                      to: endOfDay(now) },
    { key: "yesterday",   label: "Yesterday",    from: startOfDay(subDays(now, 1)),                          to: endOfDay(subDays(now, 1)) },
    { key: "last-7",      label: "Last 7 Days",  from: startOfDay(subDays(now, 7)),                          to: endOfDay(now) },
    { key: "last-30",     label: "Last 30 Days", from: startOfDay(subDays(now, 30)),                         to: endOfDay(now) },
    { key: "this-month",  label: "This Month",   from: startOfMonth(now),                                    to: endOfDay(now) },
    { key: "last-month",  label: "Last Month",   from: startOfMonth(subMonths(now, 1)),                      to: endOfDay(endOfMonth(subMonths(now, 1))) },
    { key: "this-year",   label: "This Year",    from: startOfDay(new Date(now.getFullYear(), 0, 1)),         to: endOfDay(now) },
  ];
}

function displayRange(from, to) {
  if (!from || !to) return null;
  const s = typeof from === "string" ? parseISO(from) : from;
  const e = typeof to === "string" ? parseISO(to) : to;
  if (isSameDay(s, e)) return format(s, "d MMM yyyy");
  if (s.getFullYear() === e.getFullYear()) return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
  return `${format(s, "d MMM yyyy")} – ${format(e, "d MMM yyyy")}`;
}

  export function DateRangePicker({ value, onChange, placeholder = "Select Date Range", listenGlobalToggle = true, asIconBtn = false }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value?.from ? parseISO(value.from) : new Date()));
  const [hoverDate, setHoverDate] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, right: "auto" });
  const triggerRef = useRef(null); // the button wrapper
  const popoverRef = useRef(null); // the portal popover div

  // Close when clicking outside both trigger and popover
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (popoverRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  // Compute portal position whenever open changes
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 460;
    const spaceRight = window.innerWidth - rect.left;
    if (spaceRight < popoverWidth + 16) {
      setPopoverPos({ top: rect.bottom + 8, left: "auto", right: window.innerWidth - rect.right });
    } else {
      setPopoverPos({ top: rect.bottom + 8, left: rect.left, right: "auto" });
    }
  }, [open]);

  // Recompute on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    function recompute() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 460;
      const spaceRight = window.innerWidth - rect.left;
      if (spaceRight < popoverWidth + 16) {
        setPopoverPos({ top: rect.bottom + 8, left: "auto", right: window.innerWidth - rect.right });
      } else {
        setPopoverPos({ top: rect.bottom + 8, left: rect.left, right: "auto" });
      }
    }
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
  }, [open]);

  // ── Global TopBar calendar button integration ──────────────────────────────
  // 'modus-toggle-date-filter' toggles this picker (Receivables, Reports).
  //   Disabled when listenGlobalToggle=false (Payables panel handles this itself).
  // 'modus-open-datepicker'   forces open — always listened to.
  useEffect(() => {
    function onToggle() { setOpen(o => !o); }
    function onOpen()   { setOpen(true); }
    if (listenGlobalToggle) {
      window.addEventListener("modus-toggle-date-filter", onToggle);
    }
    window.addEventListener("modus-open-datepicker", onOpen);
    return () => {
      if (listenGlobalToggle) {
        window.removeEventListener("modus-toggle-date-filter", onToggle);
      }
      window.removeEventListener("modus-open-datepicker", onOpen);
    };
  }, [listenGlobalToggle]);

  function handleToggle() {
    setOpen(o => !o);
  }

  const rangeFrom = value?.from ? parseISO(value.from) : null;
  const rangeTo = value?.to ? parseISO(value.to) : null;

  useEffect(() => {
    if (!open) return;
    setStartText(value?.from ? format(parseISO(value.from), "dd MMM yyyy") : "");
    setEndText(value?.to ? format(parseISO(value.to), "dd MMM yyyy") : "");
    if (value?.from) setMonth(parseISO(value.from));
  }, [open, value?.from, value?.to]);

  const days = [];
  let cur = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  while (cur <= endOfWeek(endOfMonth(month), { weekStartsOn: 1 })) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }

  function clickDay(day) {
    if (!rangeFrom || (rangeFrom && rangeTo)) {
      onChange({ from: toISO(day), to: null });
      setSelecting(true);
    } else if (selecting) {
      const [a, b] = day >= rangeFrom ? [rangeFrom, day] : [day, rangeFrom];
      onChange({ from: toISO(a), to: toISO(b) });
      setSelecting(false);
      setHoverDate(null);
      setOpen(false);
    } else {
      onChange({ from: toISO(day), to: null });
      setSelecting(true);
    }
  }

  function hoverDay(day) {
    if (rangeFrom && !rangeTo && selecting) setHoverDate(day);
  }

  function applyText() {
    const s = parse(startText, "dd MMM yyyy", new Date());
    const e = parse(endText, "dd MMM yyyy", new Date());
    if (isValid(s) && isValid(e)) {
      onChange({ from: toISO(s), to: toISO(e) });
      setOpen(false);
    }
  }

  const label = value?.from && value?.to ? displayRange(value.from, value.to) : placeholder;
  const hoverMin = hoverDate && rangeFrom && selecting
    ? (hoverDate < rangeFrom ? hoverDate : rangeFrom) : null;
  const hoverMax = hoverDate && rangeFrom && selecting
    ? (hoverDate > rangeFrom ? hoverDate : rangeFrom) : null;

  return (
    <div ref={triggerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {asIconBtn ? (
          <button
            type="button"
            onClick={handleToggle}
            style={{
              position: "relative", width: 32, height: 32, borderRadius: 10,
              border: "1px solid #ECECEE",
              background: open || value?.from ? "#F7F7F8" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: value?.from ? "#0A0A0A" : "#4B5563",
              transition: "background .15s",
              boxShadow: "0 2px 4px rgba(0,0,0,.02)",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            {(value?.from || value?.to) && (
              <span style={{
                position: "absolute", top: -2, right: -2,
                width: 6, height: 6, borderRadius: "50%",
                background: "#E11D2C", border: "1px solid #fff",
              }} />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggle}
            style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "4px 7px", border: "1.5px solid #E5E7EB",
              borderRadius: 8, background: "#FFF", fontSize: 11,
              fontWeight: 600, color: value?.from ? "#374151" : "#9CA3AF",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M5.5 0.5V1.25V2H10.5V1.25V0.5H12V1.25V2H14H15.5V3.5V13.5C15.5 14.8807 14.3807 16 13 16H3C1.61929 16 0.5 14.8807 0.5 13.5V3.5V2H2H4V1.25V0.5H5.5ZM2 3.5H14V6H2V3.5ZM2 7.5V13.5C2 14.0523 2.44772 14.5 3 14.5H13C13.5523 14.5 14 14.0523 14 13.5V7.5H2Z" fill="#9CA3AF"/>
            </svg>
            {label}
            <svg width="8" height="8" viewBox="0 0 16 16" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M14.0607 5.49999L13.5303 6.03032L8.7071 10.8535C8.31658 11.2441 7.68341 11.2441 7.29289 10.8535L2.46966 6.03032L1.93933 5.49999L2.99999 4.43933L3.53032 4.96966L7.99999 9.43933L12.4697 4.96966L13 4.43933L14.0607 5.49999Z" fill="#9CA3AF"/>
            </svg>
          </button>
        )}
        {!asIconBtn && (value?.from || value?.to) && (
          <button
            type="button"
            onClick={() => { onChange({ from: null, to: null }); setSelecting(false); }}
            style={{
              width: 22, height: 22, border: "none", background: "transparent",
              cursor: "pointer", color: "#9CA3AF", fontSize: 18, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4,
            }}
          >×</button>
        )}
      </div>

      {/* Popover — rendered via portal into document.body to escape any overflow/stacking context */}
      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            right: popoverPos.right,
            zIndex: 9999,
            background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 14,
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)", display: "flex",
            minWidth: 460,
          }}>
          {/* Preset list */}
          <div style={{ width: 148, borderRight: "1px solid #F3F4F6", padding: "8px 0", flexShrink: 0 }}>
            {buildPresets().map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  onChange({ from: toISO(p.from), to: toISO(p.to) });
                  setSelecting(false);
                  setOpen(false);
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                style={{
                  display: "block", width: "100%", padding: "7px 14px",
                  border: "none", background: "transparent", textAlign: "left",
                  fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500,
                }}
              >{p.label}</button>
            ))}
          </div>

          {/* Calendar + inputs */}
          <div style={{ padding: 16, flexGrow: 1, minWidth: 284 }}>
            {/* Month nav */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                {format(month, "MMMM yyyy")}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {["‹", "›"].map((arrow, i) => (
                  <button
                    key={arrow}
                    type="button"
                    onClick={() => setMonth(m => i === 0 ? subMonths(m, 1) : addMonths(m, 1))}
                    style={{
                      width: 26, height: 26, border: "1.5px solid #E5E7EB", borderRadius: 6,
                      background: "#FFF", cursor: "pointer", fontSize: 15, color: "#374151",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >{arrow}</button>
                ))}
              </div>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", padding: "3px 0" }}>{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {days.map((day, i) => {
                const isStart = rangeFrom && isSameDay(day, rangeFrom);
                const isEnd = rangeTo && isSameDay(day, rangeTo);
                const isHover = hoverDate && selecting && isSameDay(day, hoverDate);
                const inRange = rangeFrom && (
                  (rangeTo && day > rangeFrom && day < rangeTo) ||
                  (hoverMin && hoverMax && day > hoverMin && day < hoverMax)
                );
                const inMonth = isSameMonth(day, month);
                const todayDay = isToday(day);
                const selected = isStart || isEnd || isHover;

                return (
                  <div
                    key={i}
                    role="button"
                    tabIndex={inMonth ? 0 : -1}
                    aria-label={day.toDateString()}
                    onClick={() => clickDay(day)}
                    onKeyDown={(e) => e.key === "Enter" && clickDay(day)}
                    onMouseEnter={() => hoverDay(day)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      height: 32, cursor: "pointer",
                      background: inRange ? "#F3F4F6" : "transparent",
                      borderRadius: inRange ? 0 : undefined,
                    }}
                  >
                    <div style={{
                      width: 28, height: 28,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "50%", fontSize: 12,
                      fontWeight: selected ? 700 : 400,
                      background: selected ? "#0A0A0A" : todayDay ? "#DBEAFE" : "transparent",
                      color: selected ? "#FFF" : todayDay ? "#1D4ED8" : inMonth ? "#0A0A0A" : "#D1D5DB",
                    }}>
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual date input */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                {[["Start", startText, setStartText], ["End", endText, setEndText]].map(([lbl, val, set]) => (
                  <div key={lbl}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{lbl}</label>
                    <input
                      value={val}
                      onChange={e => set(e.target.value)}
                      placeholder="01 May 2026"
                      style={{
                        display: "block", width: "100%", padding: "6px 8px",
                        border: "1.5px solid #E5E7EB", borderRadius: 7,
                        fontSize: 12, color: "#374151", marginTop: 4, boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={applyText}
                style={{
                  padding: "7px 14px", background: "#0A0A0A", color: "#FFF",
                  border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >Apply ↵</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

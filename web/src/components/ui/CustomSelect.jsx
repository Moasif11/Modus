import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function CustomSelect({ value, onChange, options, placeholder = "Select...", searchable = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!open) { setQuery(""); return; }
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));
  const filtered = searchable && query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "9px 12px",
          border: `1.5px solid ${open ? "#E11D2C" : "#E5E7EB"}`,
          borderRadius: 12,
          fontSize: 13,
          color: selected ? "#0A0A0A" : "#9CA3AF",
          background: open ? "#FFF" : "#FAFAFA",
          cursor: "pointer",
          boxSizing: "border-box",
          textAlign: "left",
          boxShadow: open ? "0 0 0 3px rgba(225,29,44,0.1)" : "none",
          transition: "all 0.15s",
          gap: 8,
          outline: "none",
        }}
      >
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            color: open ? "#E11D2C" : "#9CA3AF",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease, color 0.15s",
          }}
        />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          background: "#FFF",
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          zIndex: 200,
          overflow: "hidden",
          animation: "dropIn 0.12s ease",
        }}>
          {searchable && (
            <div style={{ padding: "8px", borderBottom: "1px solid #F3F4F6" }}>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 7,
                  fontSize: 12,
                  background: "#FAFAFA",
                  color: "#0A0A0A",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", padding: "14px 0", margin: 0 }}>
                No results
              </p>
            ) : filtered.map(opt => {
              const isSel = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "9px 12px",
                    background: isSel ? "#FFF5F5" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    color: isSel ? "#E11D2C" : "#0A0A0A",
                    textAlign: "left",
                    fontWeight: isSel ? 600 : 400,
                    transition: "background 0.08s",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                >
                  <span>{opt.label}</span>
                  {isSel && <Check size={13} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

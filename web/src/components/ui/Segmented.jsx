import { useState } from "react";

/**
 * Segmented — pill-style segmented control
 * options: [{ value: string|number, label: string }]
 * value: currently selected value
 * onChange: (value) => void
 */
export default function Segmented({ value, onChange, options }) {
  const [hov, setHov] = useState(null);
  return (
    <div style={{ display: "inline-flex", background: "#F1F1F3", borderRadius: 11, padding: 3, gap: 2 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            onMouseEnter={() => setHov(o.value)}
            onMouseLeave={() => setHov(null)}
            style={{
              padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer",
              background: active ? "#fff" : hov === o.value ? "rgba(0,0,0,.04)" : "transparent",
              color: active ? "#0A0A0A" : "#6B7280",
              fontSize: 12.5, fontWeight: active ? 650 : 500, fontFamily: "inherit",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,.1)" : "none",
              transition: "all .12s",
              whiteSpace: "nowrap",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

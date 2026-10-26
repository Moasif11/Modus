import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { formatDate } from "@/utils/format";

const ACTION_STYLE = {
  update: { bg: "#EFF6FF", color: "#2563EB" },
  delete: { bg: "#FEF2F2", color: "#DC2626" },
  create: { bg: "#ECFDF5", color: "#059669" },
  cancel: { bg: "#F3F4F6", color: "#6B7280" },
};

const th = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", background: "#FAFAFA", borderBottom: "1px solid #EEEEF0" };
const td = { padding: "11px 14px", fontSize: 12.5, color: "#374151", borderBottom: "1px solid #F3F4F6", verticalAlign: "top" };

function fmtTime(t) {
  try { return new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); } catch { return t; }
}

function renderChanges(action, changes) {
  if (!changes) return "—";
  if (action !== "update") return <span style={{ color: "#6B7280" }}>{typeof changes === "object" ? JSON.stringify(changes) : String(changes)}</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {Object.entries(changes).map(([field, pair]) => (
        <div key={field} style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: "#0A0A0A" }}>{field}</span>:{" "}
          <span style={{ color: "#DC2626", textDecoration: "line-through" }}>{String(pair?.[0] ?? "∅")}</span>{" → "}
          <span style={{ color: "#059669" }}>{String(pair?.[1] ?? "∅")}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const q = filter ? `?entityType=${filter}` : "";
    setLoading(true);
    api.get(`/api/audit-log${q}`)
      .then((d) => setEntries(d.entries || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <AppShell>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p style={{ fontSize: 12.5, color: "#6B7280", margin: 0 }}>Immutable edit log — every change to invoices, bills and payments (Companies Act Rule 11(g)).</p>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[["", "All"], ["invoice", "Invoices"], ["bill", "Bills"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFilter(v)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: filter === v ? "#0A0A0A" : "#FFF", color: filter === v ? "#FFF" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
        {loading ? (
          <p style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</p>
        ) : entries.length === 0 ? (
          <p style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No changes logged yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["When", "Who", "Entity", "Action", "Changes"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {entries.map((e) => {
                  const st = ACTION_STYLE[e.action] || ACTION_STYLE.update;
                  return (
                    <tr key={e.id}>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtTime(e.changedAt)}</td>
                      <td style={td}>{e.changedByName}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{e.entityType} #{e.entityId}</td>
                      <td style={td}><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{e.action}</span></td>
                      <td style={td}>{renderChanges(e.action, e.changes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

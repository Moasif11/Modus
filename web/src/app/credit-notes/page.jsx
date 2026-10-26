import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { formatMoney, formatDate } from "@/utils/format";

const STATUS_STYLE = {
  issued: { bg: "#F5F3FF", color: "#6D28D9", label: "Issued" },
  cancelled: { bg: "#F3F4F6", color: "#6B7280", label: "Cancelled" },
};

const REASON_LABEL = {
  "01": "Sales Return", "02": "Post-Sale Discount", "03": "Deficiency in Service",
  "04": "Correction in Invoice", "05": "Change in POS", "06": "Provisional Assessment", "07": "Others",
};

const th = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", background: "#FAFAFA", borderBottom: "1px solid #EEEEF0" };
const td = { padding: "11px 14px", fontSize: 12.5, color: "#374151", borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap" };

export default function CreditNotesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/api/credit-notes")
      .then((d) => setRows(d.creditNotes || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [r.creditNoteNumber, r.invoiceNumber, r.customerName].some((v) => (v || "").toLowerCase().includes(q));
  });

  const totalIssued = rows.filter((r) => r.status === "issued").reduce((s, r) => s + (r.totalAmount || 0), 0);

  return (
    <AppShell>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: 12, padding: "10px 16px" }}>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 2px" }}>Credit notes issued</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#6D28D9", margin: 0 }}>{formatMoney(totalIssued)}</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search number, invoice, customer…"
          style={{ marginLeft: "auto", padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, minWidth: 260, fontFamily: "inherit" }}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
        {loading ? (
          <p style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
            No credit notes yet. Issue one from any invoice's detail page.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Credit Note", "Date", "Against Invoice", "Customer", "Reason", "Amount", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((r) => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.issued;
                  return (
                    <tr key={r.id} onClick={() => r.invoiceId && navigate(`/invoices/${r.invoiceId}`)} style={{ cursor: r.invoiceId ? "pointer" : "default" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#FAFAFB"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <td style={{ ...td, fontWeight: 700, color: "#6D28D9" }}>{r.creditNoteNumber}</td>
                      <td style={td}>{formatDate(r.creditNoteDate)}</td>
                      <td style={td}>{r.invoiceNumber || "—"}</td>
                      <td style={td}>{r.customerName}</td>
                      <td style={td}>{REASON_LABEL[r.reasonCode] || r.reasonCode || "—"}</td>
                      <td style={{ ...td, fontWeight: 700, color: "#0A0A0A", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatMoney(r.totalAmount)}</td>
                      <td style={td}><span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span></td>
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

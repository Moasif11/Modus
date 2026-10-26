import { useState } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { formatMoney } from "@/utils/format";
import { toast } from "sonner";

const th = { padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", background: "#FAFAFA", borderBottom: "1px solid #EEEEF0" };
const td = { padding: "9px 12px", fontSize: 12.5, color: "#374151", borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap" };
const num = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Stat({ label, value, tint }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: 12, padding: "12px 16px", minWidth: 150 }}>
      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 3px" }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, color: tint || "#0A0A0A", margin: 0 }}>{value}</p>
    </div>
  );
}

function Section({ title, tint, note, children }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 700, color: tint || "#0A0A0A", margin: 0 }}>{title}</h3>
        {note && <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0" }}>{note}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Gstr2bReconPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [twob, setTwob] = useState(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => { try { setTwob(JSON.parse(reader.result)); } catch { toast.error("Not a valid JSON file"); setTwob(null); } };
    reader.readAsText(file);
  }

  async function reconcile() {
    if (!twob) { toast.error("Upload your GSTR-2B JSON first"); return; }
    setLoading(true);
    try {
      const r = await api.post("/api/reports/gstr2b-recon", { from, to, twob });
      setResult(r);
      toast.success(`Reconciled: ${r.summary.matchedCount} matched`);
    } catch (err) { toast.error(err.message || "Reconciliation failed"); }
    finally { setLoading(false); }
  }

  const s = result?.summary;
  return (
    <AppShell>
      <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 18, marginBottom: 16 }}>
        <p style={{ fontSize: 12.5, color: "#6B7280", margin: "0 0 12px" }}>
          Download your <strong>GSTR-2B JSON</strong> from the GST portal (Returns → GSTR-2B → Download), then upload it here to match against your recorded ITC bills (Sec 16(2)(aa) / Rule 36(4)).
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13 }} /></div>
          <div><label style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", display: "block", marginBottom: 4 }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 13 }} /></div>
          <label style={{ padding: "8px 14px", border: "1.5px dashed #6D28D9", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "#6D28D9", cursor: "pointer", background: "#F5F3FF" }}>
            {fileName || "Upload GSTR-2B JSON"}
            <input type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
          </label>
          <button type="button" onClick={reconcile} disabled={loading || !twob}
            style={{ padding: "9px 18px", border: "none", borderRadius: 9, background: (loading || !twob) ? "#C7C7CC" : "#0A0A0A", color: "#fff", fontSize: 13, fontWeight: 700, cursor: (loading || !twob) ? "not-allowed" : "pointer" }}>
            {loading ? "Reconciling…" : "Reconcile"}
          </button>
        </div>
      </div>

      {s && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Stat label="Matched" value={s.matchedCount} tint="#059669" />
            <Stat label="Tax mismatch" value={s.mismatchedCount} tint="#D97706" />
            <Stat label="In books, not in 2B" value={s.missingIn2bCount} tint="#DC2626" />
            <Stat label="In 2B, not in books" value={s.missingInBooksCount} tint="#2563EB" />
            <Stat label="ITC at risk" value={formatMoney(s.atRiskTax)} tint="#DC2626" />
          </div>

          <Section title={`⚠ Claimed in books but NOT in GSTR-2B (${s.missingIn2bCount}) — ITC at risk`} tint="#DC2626" note="Follow up with these vendors to file — else this ITC is not admissible.">
            <RowsBills rows={result.missingIn2b} />
          </Section>

          <Section title={`Tax mismatch (${s.mismatchedCount})`} tint="#D97706">
            {(result.mismatched || []).length === 0 ? <Empty /> : (
              <TableWrap headers={["Bill", "Vendor", "Supplier Inv", "Book Tax", "2B Tax", "Diff"]}>
                {result.mismatched.map((m, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 700 }}>{m.bill.billNumber}</td>
                    <td style={td}>{m.bill.vendorName}</td>
                    <td style={td}>{m.bill.supplierInvNo}</td>
                    <td style={num}>{formatMoney(m.bill.tax)}</td>
                    <td style={num}>{formatMoney(m.portal.tax)}</td>
                    <td style={{ ...num, color: "#DC2626", fontWeight: 700 }}>{formatMoney(m.taxDiff)}</td>
                  </tr>
                ))}
              </TableWrap>
            )}
          </Section>

          <Section title={`In GSTR-2B but not in your books (${s.missingInBooksCount}) — unclaimed ITC`} tint="#2563EB" note="Purchases your vendors reported that you haven't recorded — add them to claim the credit.">
            {(result.missingInBooks || []).length === 0 ? <Empty /> : (
              <TableWrap headers={["Supplier GSTIN", "Invoice", "Taxable", "Tax"]}>
                {result.missingInBooks.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{p.supplierGstin}</td>
                    <td style={td}>{p.invoiceNumber}</td>
                    <td style={num}>{formatMoney(p.taxable)}</td>
                    <td style={num}>{formatMoney(p.tax)}</td>
                  </tr>
                ))}
              </TableWrap>
            )}
          </Section>

          <Section title={`Matched (${s.matchedCount})`} tint="#059669">
            <RowsBills rows={(result.matched || []).map(m => m.bill)} />
          </Section>
        </>
      )}
    </AppShell>
  );
}

function TableWrap({ headers, children }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{headers.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function RowsBills({ rows }) {
  if (!rows || rows.length === 0) return <Empty />;
  return (
    <TableWrap headers={["Bill", "Vendor", "GSTIN", "Supplier Inv", "Tax"]}>
      {rows.map((b, i) => (
        <tr key={i}>
          <td style={{ ...td, fontWeight: 700 }}>{b.billNumber}</td>
          <td style={td}>{b.vendorName}</td>
          <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{b.vendorGstin || "—"}</td>
          <td style={td}>{b.supplierInvNo || "—"}</td>
          <td style={num}>{formatMoney(b.tax)}</td>
        </tr>
      ))}
    </TableWrap>
  );
}
function Empty() {
  return <p style={{ padding: "22px", textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>None</p>;
}

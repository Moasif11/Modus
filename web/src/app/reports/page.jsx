import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { formatMoney, formatDate } from "@/utils/format";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useClickOutside } from "@/components/ui/use-click-outside";
import { Card, MiniStat, Chip, ghostBtn, tdStyle } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import {
  FileSpreadsheet,
  FileText,
  Download,
  TrendingUp,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

// ── Report definitions ────────────────────────────────────────────────────────
const REPORT_DEFS = [
  {
    key: "summary",
    name: "GST / Invoice Summary",
    icon: "receiptText",
    tint: "#E11D2C",
    desc: (s) => s ? `${s.count} invoice${s.count !== 1 ? "s" : ""} · ₹${(s.total || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} total` : "Loading...",
  },
  {
    key: "gstr1",
    name: "GSTR-1 — Outward supplies",
    icon: "receipt",
    tint: "#E11D2C",
    desc: (s, gstr1) => gstr1 ? `${(gstr1.b2b?.length || 0) + (gstr1.b2cl?.length || 0) + (gstr1.b2cs?.length || 0)} invoices · B2B / B2CL / B2CS` : "Outward supply details",
  },
  {
    key: "gstr3b",
    name: "GSTR-3B — Summary return",
    icon: "shieldCheck",
    tint: "#2563EB",
    desc: (s, gstr1, gstr3b) => gstr3b ? `${gstr3b.summary?.invoiceCount || 0} invoices · auto-computed` : "Summary return with ITC",
  },
  {
    key: "hsn",
    name: "HSN-wise Summary",
    icon: "chart",
    tint: "#059669",
    desc: (s, gstr1, gstr3b, hsnData) => hsnData ? `${hsnData.length} HSN/SAC code${hsnData.length !== 1 ? "s" : ""}` : "HSN/SAC code breakdown",
  },
  {
    key: "pnl",
    name: "Profit & Loss",
    icon: "trendingUp",
    tint: "#7C3AED",
    desc: (s, gstr1, gstr3b, hsnData, pnl) => pnl ? `Net ₹${(pnl.netProfit || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })} · ${pnl.margin.toFixed(0)}% margin` : "Revenue minus expenses",
  },
  {
    key: "tds",
    name: "TDS — 26Q & 26AS",
    icon: "receiptText",
    tint: "#0EA5E9",
    desc: () => "TDS deducted (payable) + TDS on your invoices (receivable)",
  },
];

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Which report is open in detail view (null = landing grid)
  const [activeReport, setActiveReport] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [stats, setStats]       = useState(null);
  const [gstr1, setGstr1]       = useState(null);
  const [hsnData, setHsnData]   = useState(null);
  const [gstr3b, setGstr3b]     = useState(null);
  const [pnl, setPnl]           = useState(null);
  const [tds, setTds]           = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false));

  // Load summary on date change
  useEffect(() => { loadReport(); }, [fromDate, toDate]);

  // Listen to global date filter
  useEffect(() => {
    function handleDate(e) {
      if (e.detail.from) setFromDate(e.detail.from);
      if (e.detail.to) setToDate(e.detail.to);
    }
    window.addEventListener("modus-global-date", handleDate);
    return () => window.removeEventListener("modus-global-date", handleDate);
  }, []);

  // Clear cached sub-reports on date change
  useEffect(() => {
    setGstr1(null); setHsnData(null); setGstr3b(null); setPnl(null); setTds(null);
  }, [fromDate, toDate]);

  // Load sub-report when entering detail view
  useEffect(() => {
    if (activeReport === "gstr1"  && !gstr1)   loadGstr1();
    if (activeReport === "hsn"    && !hsnData)  loadHsn();
    if (activeReport === "gstr3b" && !gstr3b)   loadGstr3b();
    if (activeReport === "pnl"    && !pnl)      loadPnl();
    if (activeReport === "tds"    && !tds)      loadTds();
  }, [activeReport]);

  async function loadReport() {
    setLoading(true);
    try {
      const data = await api.get(`/api/invoices?from=${fromDate}&to=${toDate}&limit=200`);
      const invs = data.invoices || [];
      setInvoices(invs);
      const totals = invs.reduce((acc, inv) => ({
        count:   acc.count + 1,
        taxable: acc.taxable + (inv.taxableAmount ?? inv.grandTotal - inv.totalTax),
        cgst:    acc.cgst   + (inv.cgstAmount ?? 0),
        sgst:    acc.sgst   + (inv.sgstAmount ?? 0),
        igst:    acc.igst   + (inv.igstAmount ?? 0),
        gst:     acc.gst    + inv.totalTax,
        total:   acc.total  + inv.grandTotal,
      }), { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, total: 0 });
      setStats(totals);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadGstr1() {
    setLoading(true);
    try {
      const data = await api.get(`/api/reports?type=gstr1&from=${fromDate}&to=${toDate}`);
      setGstr1(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadGstr3b() {
    setLoading(true);
    try {
      const data = await api.get(`/api/reports?type=gstr3b&from=${fromDate}&to=${toDate}`);
      setGstr3b(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadHsn() {
    setLoading(true);
    try {
      const data = await api.get(`/api/reports?type=hsn&from=${fromDate}&to=${toDate}`);
      setHsnData(data.hsn || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadPnl() {
    setLoading(true);
    try {
      const data = await api.get(`/api/reports?type=pnl&from=${fromDate}&to=${toDate}`);
      setPnl(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function loadTds() {
    setLoading(true);
    try {
      const data = await api.get(`/api/reports?type=tds&from=${fromDate}&to=${toDate}`);
      setTds(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function exportPDF(report) {
    // Called both directly (with a report key) and as an onClick handler (event arg) — normalise.
    if (typeof report !== "string") report = activeReport || "summary";
    setExportOpen(false);
    const token = localStorage.getItem("modus_auth_token");
    try {
      const res = await fetch(`/api/reports/export?report=${report}&from=${fromDate}&to=${toDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `MODUS-${report}-${fromDate}-to-${toDate}.pdf`;
      a.click();
    } catch (err) { console.error("PDF export failed:", err); }
  }

  async function downloadPortalJson() {
    setExportOpen(false);
    const type = activeReport === "gstr3b" ? "gstr3b" : "gstr1";
    if (activeReport !== "gstr1" && activeReport !== "gstr3b") {
      toast.error("Government JSON is available for GSTR-1 and GSTR-3B. Open one of those first.");
      return;
    }
    const token = localStorage.getItem("modus_auth_token");
    try {
      const res = await fetch(`/api/reports/gst-json?type=${type}&from=${fromDate}&to=${toDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Export failed"); }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${type.toUpperCase()}-${fromDate}-to-${toDate}.json`;
      a.click();
      toast.success(`${type.toUpperCase()} portal JSON downloaded`);
    } catch (err) { toast.error(err.message || "JSON export failed"); }
  }

  function exportExcel() {
    setExportOpen(false);
    const headers = ["Invoice #","Date","Client","Taxable (₹)","CGST (₹)","SGST (₹)","IGST (₹)","Total GST (₹)","Grand Total (₹)","Status"];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber, inv.invoiceDate, inv.customerName || "",
      Number((inv.taxableAmount ?? inv.grandTotal - inv.totalTax).toFixed(2)),
      Number((inv.cgstAmount ?? 0).toFixed(2)),
      Number((inv.sgstAmount ?? 0).toFixed(2)),
      Number((inv.igstAmount ?? 0).toFixed(2)),
      Number(inv.totalTax.toFixed(2)),
      Number(inv.grandTotal.toFixed(2)),
      inv.status,
    ]);
    const totalsRow = [
      "TOTALS","","",
      Number((stats?.taxable || 0).toFixed(2)),
      Number((stats?.cgst || 0).toFixed(2)),
      Number((stats?.sgst || 0).toFixed(2)),
      Number((stats?.igst || 0).toFixed(2)),
      Number((stats?.gst  || 0).toFixed(2)),
      Number((stats?.total|| 0).toFixed(2)),
      "",
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, totalsRow]);
    ws["!cols"] = [
      { wch: 14 },{ wch: 13 },{ wch: 28 },{ wch: 14 },
      { wch: 12 },{ wch: 12 },{ wch: 12 },{ wch: 13 },{ wch: 15 },{ wch: 13 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "GST Summary");
    XLSX.writeFile(wb, `MODUS-GST-Report-${fromDate}-to-${toDate}.xlsx`);
  }

  function exportCSV() {
    setExportOpen(false);
    const headers = ["Invoice #","Date","Client","Taxable","CGST","SGST","IGST","Total GST","Grand Total","Status"];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber, inv.invoiceDate, inv.customerName || "",
      (inv.taxableAmount ?? inv.grandTotal - inv.totalTax).toFixed(2),
      (inv.cgstAmount ?? 0).toFixed(2),
      (inv.sgstAmount ?? 0).toFixed(2),
      (inv.igstAmount ?? 0).toFixed(2),
      inv.totalTax.toFixed(2),
      inv.grandTotal.toFixed(2),
      inv.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `MODUS-GST-Report-${fromDate}-to-${toDate}.csv`;
    a.click();
  }

  // ── Download dispatcher per card ──────────────────────────────────────────
  function downloadReport(key, e) {
    e.stopPropagation();
    // Each card exports its own report PDF (summary | gstr1 | gstr3b | hsn).
    exportPDF(key);
  }

  // ── Derived mini-stats ────────────────────────────────────────────────────
  const gstPayable = gstr3b?.summary?.totalOutwardTax ?? stats?.gst ?? 0;
  const itcCredit  = gstr3b?.summary?.totalITC        ?? 0;
  const netGST     = gstr3b?.summary?.netTaxPayable   ?? Math.max(0, gstPayable - itcCredit);

  return (
    <AppShell>
      <style>{`
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media print { .no-print { display: none !important; } }
        .g3b-tbl { width: 100%; border-collapse: collapse; }
        .g3b-tbl th { background: #F9FAFB; font-size: 11px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 16px; text-align: left; border-bottom: 2px solid #E5E7EB; }
        .g3b-tbl td { padding: 11px 16px; font-size: 13px; color: #374151; border-bottom: 1px solid #F3F4F6; }
        .g3b-tbl tr:last-child td { border-bottom: none; }
        .g3b-num { text-align: right; font-variant-numeric: tabular-nums; }
        .g3b-tbl .g3b-total-row td { font-weight: 700; color: #0A0A0A; background: #F9FAFB; border-top: 2px solid #E5E7EB; }
      `}</style>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Toolbar: export ────────────────────────────────── */}
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minHeight: 32 }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 16, border: "2px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>Loading…</span>
            </div>
          )}

          <div ref={exportRef} style={{ position: "relative", marginLeft: "auto" }}>
            <button type="button" onClick={() => setExportOpen((o) => !o)} style={{ ...ghostBtn, gap: 7 }}>
              <Download size={14} />
              Export
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ marginLeft: 2 }}>
                <path d="M1 1L5 5L9 1" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {exportOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 178 }}>
                {[
                  { label: "Export as PDF",   icon: FileText,        color: "#E11D2C", bg: "#FEF2F2", action: exportPDF },
                  { label: "Export as Excel", icon: FileSpreadsheet, color: "#059669", bg: "#F0FDF4", action: exportExcel },
                  { label: "Export as CSV",   icon: Download,        color: "#374151", bg: "#F3F4F6", action: exportCSV },
                  { label: "Govt JSON (GSTR-1/3B)", icon: FileText,   color: "#2563EB", bg: "#EFF6FF", action: downloadPortalJson },
                ].map(({ label, icon: Ic, color, bg, action }) => (
                  <button
                    key={label} type="button" onClick={action}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F9FAFB"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ width: 28, height: 28, background: bg, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Ic size={14} color={color} />
                    </div>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 3-up MiniStat header ─────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, animation: "fadeUp 0.3s ease" }}>
          <MiniStat label="GST Payable"       value={formatMoney(gstPayable)} icon="receiptRupee" tint="#E11D2C" sub="Outward tax liability" />
          <MiniStat label="Input Tax Credit"  value={formatMoney(itcCredit)}  icon="shieldCheck"  tint="#059669" sub="ITC from expense bills" />
          <MiniStat label="Net GST Liability" value={formatMoney(Math.max(0, netGST))} icon="trendingUp" tint="#2563EB" sub="Payable after ITC offset" />
        </div>

        {/* ── Landing grid or detail view ───────────────────────────────────── */}
        {!activeReport ? (
          /* Card grid */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, animation: "fadeUp 0.3s ease" }}>
            {REPORT_DEFS.map((r) => (
              <Card key={r.key} pad={20} hover>
                {/* Top row: icon tile + status chip */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: r.tint + "1A", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={r.icon} size={20} color={r.tint} strokeWidth={2} />
                  </div>
                  <Chip tone="#15803D" bg="#DCFCE7">Ready</Chip>
                </div>
                {/* Name + desc */}
                <p style={{ fontSize: 14.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 3px" }}>{r.name}</p>
                <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "0 0 16px" }}>
                  {r.desc(stats, gstr1, gstr3b, hsnData, pnl)}
                </p>
                {/* Footer */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}
                    onClick={() => setActiveReport(r.key)}
                  >
                    <Icon name="eye" size={15} /> View
                  </button>
                  <button
                    type="button"
                    style={{ ...ghostBtn, justifyContent: "center", color: r.tint, borderColor: r.tint + "40" }}
                    onClick={(e) => downloadReport(r.key, e)}
                    title="Download PDF"
                  >
                    <Icon name="download" size={15} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* Detail view */
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.25s ease" }}>
            {/* Back link */}
            <button
              type="button"
              onClick={() => setActiveReport(null)}
              style={{ ...ghostBtn, alignSelf: "flex-start" }}
              className="no-print"
            >
              <Icon name="arrowLeft" size={14} /> Back to Reports
            </button>

            {activeReport === "summary" && (
              <SummaryTab invoices={invoices} stats={stats} fromDate={fromDate} toDate={toDate} formatMoney={formatMoney} formatDate={formatDate} />
            )}
            {activeReport === "gstr1" && (
              <Gstr1Tab gstr1={gstr1} loading={loading} fromDate={fromDate} toDate={toDate} formatMoney={formatMoney} formatDate={formatDate} />
            )}
            {activeReport === "hsn" && (
              <HsnTab hsnData={hsnData} loading={loading} fromDate={fromDate} toDate={toDate} formatMoney={formatMoney} />
            )}
            {activeReport === "gstr3b" && (
              <Gstr3bTab gstr3b={gstr3b} loading={loading} fromDate={fromDate} toDate={toDate} />
            )}
            {activeReport === "pnl" && (
              <PnlTab pnl={pnl} loading={loading} formatMoney={formatMoney} />
            )}
            {activeReport === "tds" && (
              <TdsTab tds={tds} loading={loading} fromDate={fromDate} toDate={toDate} formatMoney={formatMoney} formatDate={formatDate} />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TdsTab({ tds, loading, fromDate, toDate, formatMoney, formatDate }) {
  if (loading || !tds) return <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>;
  const th2 = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.05em", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", background: "#FAFAFA", borderBottom: "1px solid #EEEEF0" };
  const td2 = { padding: "10px 14px", fontSize: 12.5, color: "#374151", borderBottom: "1px solid #F3F4F6", whiteSpace: "nowrap" };
  const num = { ...td2, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  return (
    <>
      <p style={{ fontSize: 12, color: "#9CA3AF" }}>Period: {fromDate} → {toDate}</p>

      {/* TDS payable — 26Q */}
      <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>TDS Deducted — payable (Form 26Q)</h3>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#0EA5E9" }}>{formatMoney(tds.payableTotal || 0)}</span>
        </div>
        {(tds.payable || []).length === 0 ? (
          <p style={{ padding: "28px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>No TDS deducted on bills this period.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Bill", "Date", "Deductee", "PAN", "Section", "Rate", "Base", "TDS", "Deposited"].map(h => <th key={h} style={th2}>{h}</th>)}</tr></thead>
              <tbody>
                {tds.payable.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td2, fontWeight: 700, color: "#0A0A0A" }}>{r.billNumber}</td>
                    <td style={td2}>{formatDate(r.billDate)}</td>
                    <td style={td2}>{r.deductee}</td>
                    <td style={{ ...td2, fontFamily: "monospace", fontSize: 11 }}>{r.pan}</td>
                    <td style={td2}>{r.section}</td>
                    <td style={num}>{r.rate}%</td>
                    <td style={num}>₹{r.base.toFixed(2)}</td>
                    <td style={{ ...num, fontWeight: 700, color: "#0A0A0A" }}>₹{r.tdsAmount.toFixed(2)}</td>
                    <td style={td2}>{r.deposited ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TDS receivable — 26AS */}
      <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>TDS on Your Invoices — receivable (reconcile 26AS/AIS)</h3>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#059669" }}>{formatMoney(tds.receivableTotal || 0)}</span>
        </div>
        {(tds.receivable || []).length === 0 ? (
          <p style={{ padding: "28px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>No TDS recorded on your invoices this period.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Invoice", "Date", "Customer", "Section", "Rate", "TDS"].map(h => <th key={h} style={th2}>{h}</th>)}</tr></thead>
              <tbody>
                {tds.receivable.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...td2, fontWeight: 700, color: "#0A0A0A" }}>{r.invoiceNumber}</td>
                    <td style={td2}>{formatDate(r.invoiceDate)}</td>
                    <td style={td2}>{r.customer}</td>
                    <td style={td2}>{r.section}</td>
                    <td style={num}>{r.rate}%</td>
                    <td style={{ ...num, fontWeight: 700, color: "#0A0A0A" }}>₹{r.tdsAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Summary tab ───────────────────────────────────────────────────────────────
function SummaryTab({ invoices, stats, fromDate, toDate, formatMoney, formatDate }) {
  return (
    <>
      {stats && (
        <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[
            ["Invoices in Period", stats.count,                     "file",        "#E11D2C"],
            ["Taxable Amount",     formatMoney(stats.taxable),      "trendingUp",  "#2563EB"],
            ["Total GST",          formatMoney(stats.gst),          "receiptText", "#D97706"],
            ["Total Revenue",      formatMoney(stats.total),        "check",       "#059669"],
          ].map(([label, value, icon, tint]) => (
            <MiniStat key={label} label={label} value={value} icon={icon} tint={tint} />
          ))}
        </div>
      )}

      <Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Invoice Breakdown</h2>
          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{fromDate} → {toDate}</p>
        </div>
        {invoices.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <FileSpreadsheet size={26} color="#D1D5DB" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#0A0A0A", marginBottom: 6 }}>No invoices in this period</p>
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>Select a different date range</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                  {[["Invoice #","left"],["Date","left"],["Client","left"],["Taxable","right"],["CGST","right"],["SGST","right"],["IGST","right"],["Total GST","right"],["Grand Total","right"],["Status","center"]].map(([h,a]) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: a, fontSize: 11, fontWeight: 600, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr key={inv.id} style={{ borderBottom: i < invoices.length - 1 ? "1px solid #F9FAFB" : "none" }}>
                    <td style={{ padding: "11px 16px" }}>
                      <a href={`/invoices/${inv.id}`} style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", textDecoration: "none" }}>{inv.invoiceNumber}</a>
                    </td>
                    <td style={{ padding: "11px 16px" }}><span style={{ fontSize: 12, color: "#9CA3AF" }}>{formatDate(inv.invoiceDate)}</span></td>
                    <td style={{ padding: "11px 16px" }}><span style={{ fontSize: 13, color: "#374151" }}>{inv.customerName || "—"}</span></td>
                    {[
                      inv.taxableAmount ?? inv.grandTotal - inv.totalTax,
                      inv.cgstAmount ?? 0,
                      inv.sgstAmount ?? 0,
                      inv.igstAmount ?? 0,
                      inv.totalTax,
                      inv.grandTotal,
                    ].map((v, vi) => (
                      <td key={vi} style={{ padding: "11px 16px", textAlign: "right" }}>
                        <span style={{ fontSize: 12, color: vi >= 4 ? "#0A0A0A" : "#6B7280", fontWeight: vi >= 4 ? 600 : 400 }}>
                          ₹{Math.abs(v).toFixed(2)}
                        </span>
                      </td>
                    ))}
                    <td style={{ padding: "11px 16px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: inv.status === "paid" ? "#D1FAE5" : "#F3F4F6", color: inv.status === "paid" ? "#059669" : "#6B7280" }}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
                  <td colSpan={3} style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>Totals</td>
                  {[
                    { v: stats?.taxable || 0, highlight: false },
                    { v: stats?.cgst || 0,    highlight: false },
                    { v: stats?.sgst || 0,    highlight: false },
                    { v: stats?.igst || 0,    highlight: false },
                    { v: stats?.gst  || 0,    highlight: false },
                    { v: stats?.total|| 0,    highlight: true  },
                  ].map(({ v, highlight }, i) => (
                    <td key={i} style={{ padding: "12px 16px", textAlign: "right", fontSize: 13, fontWeight: 700, color: highlight ? "#E11D2C" : "#0A0A0A" }}>
                      {formatMoney(v)}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ── GSTR-1 tab ────────────────────────────────────────────────────────────────
const gstrTh  = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", background: "#FAFAFA" };
const gstrTd  = { padding: "10px 14px", fontSize: 12, color: "#374151", borderBottom: "1px solid #F3F4F6" };
const gstrNum = { ...gstrTd, textAlign: "right", fontVariantNumeric: "tabular-nums" };

function GstrTable({ title, rows, tag, formatDate }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: tag === "B2B" ? "#EFF6FF" : tag === "B2CL" ? "#FEF3C7" : "#F3F4F6", color: tag === "B2B" ? "#2563EB" : tag === "B2CL" ? "#D97706" : "#374151" }}>{tag}</span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h3>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF" }}>{rows.length} invoice{rows.length !== 1 ? "s" : ""}</span>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: "32px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>No invoices in this category</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Invoice #","Date","Recipient","GSTIN","Place of Supply","Taxable","CGST","SGST","IGST","Total","RC"].map(h => <th key={h} style={gstrTh}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...gstrTd, fontWeight: 700, color: "#0A0A0A" }}><a href={`/invoices/${r.id}`} style={{ color: "#0A0A0A", textDecoration: "none" }}>{r.invoiceNumber}</a></td>
                  <td style={gstrTd}>{formatDate(r.invoiceDate)}</td>
                  <td style={gstrTd}>{r.customerName}</td>
                  <td style={{ ...gstrTd, fontSize: 11 }}>{r.customerGstin || "—"}</td>
                  <td style={gstrTd}>{r.placeOfSupply}</td>
                  <td style={gstrNum}>₹{r.taxableAmount.toFixed(2)}</td>
                  <td style={gstrNum}>{r.cgst > 0 ? `₹${r.cgst.toFixed(2)}` : "—"}</td>
                  <td style={gstrNum}>{r.sgst > 0 ? `₹${r.sgst.toFixed(2)}` : "—"}</td>
                  <td style={gstrNum}>{r.igst > 0 ? `₹${r.igst.toFixed(2)}` : "—"}</td>
                  <td style={{ ...gstrNum, fontWeight: 700, color: "#0A0A0A" }}>₹{r.grandTotal.toFixed(2)}</td>
                  <td style={{ ...gstrTd, textAlign: "center" }}>{r.reverseCharge}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ExportsTable({ rows, formatDate }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#ECFDF5", color: "#059669" }}>6A/6B</span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Exports &amp; SEZ (zero-rated)</h3>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF" }}>{rows.length} invoice{rows.length !== 1 ? "s" : ""}</span>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: "32px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>No export / SEZ invoices in this period</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              {["Invoice #","Date","Recipient","Table","Type","Currency","Taxable (₹)","IGST (₹)","Total (₹)"].map(h => <th key={h} style={gstrTh}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.invoiceNumber || i}>
                  <td style={{ ...gstrTd, fontWeight: 700, color: "#0A0A0A" }}>{r.invoiceNumber}</td>
                  <td style={gstrTd}>{formatDate(r.invoiceDate)}</td>
                  <td style={gstrTd}>{r.customerName}</td>
                  <td style={gstrTd}>{r.table}</td>
                  <td style={gstrTd}>{r.paymentType}</td>
                  <td style={gstrTd}>{r.currency}{r.currency !== "INR" ? ` @ ${r.exchangeRate}` : ""}</td>
                  <td style={gstrNum}>₹{r.taxableAmount.toFixed(2)}</td>
                  <td style={gstrNum}>{r.igst > 0 ? `₹${r.igst.toFixed(2)}` : "—"}</td>
                  <td style={{ ...gstrNum, fontWeight: 700, color: "#0A0A0A" }}>₹{r.grandTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function Gstr1Tab({ gstr1, loading, fromDate, toDate, formatMoney, formatDate }) {
  return (
    <>
      <p style={{ fontSize: 12, color: "#9CA3AF" }}>Period: {fromDate} → {toDate}</p>
      {gstr1 && <>
        <GstrTable title="Supplies to Registered Businesses"          tag="B2B"  rows={gstr1.b2b}  formatDate={formatDate} />
        <GstrTable title="Large Supplies to Unregistered (> ₹2.5L)"  tag="B2CL" rows={gstr1.b2cl} formatDate={formatDate} />
        <GstrTable title="Small Supplies to Unregistered (≤ ₹2.5L)"  tag="B2CS" rows={gstr1.b2cs} formatDate={formatDate} />
        <ExportsTable rows={gstr1.exports || []} formatDate={formatDate} />
        <CreditNoteTable title="Credit Notes — Registered (9B / CDNR)" rows={gstr1.cdnr || []} formatMoney={formatMoney} formatDate={formatDate} />
        <CreditNoteTable title="Credit Notes — Unregistered (9B / CDNUR)" rows={gstr1.cdnur || []} formatMoney={formatMoney} formatDate={formatDate} />
      </>}
    </>
  );
}

function CreditNoteTable({ title, rows, formatMoney, formatDate }) {
  return (
    <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "#F5F3FF", color: "#6D28D9" }}>CN</span>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h3>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF" }}>{rows.length} note{rows.length !== 1 ? "s" : ""}</span>
      </div>
      {rows.length === 0 ? (
        <p style={{ padding: "28px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 13, margin: 0 }}>No credit notes in this period</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Note #", "Date", "Orig. Invoice", "Recipient", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"].map(h => <th key={h} style={gstrTh}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...gstrTd, fontWeight: 700, color: "#6D28D9" }}>{r.noteNumber}</td>
                  <td style={gstrTd}>{formatDate(r.noteDate)}</td>
                  <td style={gstrTd}>{r.originalInvoice}</td>
                  <td style={gstrTd}>{r.customerName}</td>
                  <td style={{ ...gstrTd, fontSize: 11 }}>{r.customerGstin || "—"}</td>
                  <td style={gstrNum}>₹{r.taxableAmount.toFixed(2)}</td>
                  <td style={gstrNum}>{r.cgst > 0 ? `₹${r.cgst.toFixed(2)}` : "—"}</td>
                  <td style={gstrNum}>{r.sgst > 0 ? `₹${r.sgst.toFixed(2)}` : "—"}</td>
                  <td style={gstrNum}>{r.igst > 0 ? `₹${r.igst.toFixed(2)}` : "—"}</td>
                  <td style={{ ...gstrNum, fontWeight: 700, color: "#0A0A0A" }}>₹{r.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Profit & Loss tab ──────────────────────────────────────────────────────────
const PNL_CAT_LABEL = { expense: "General Expense", salary: "Salaries & Wages", utility: "Utilities", rent: "Rent", software: "Software & Subscriptions", travel: "Travel", marketing: "Marketing", equipment: "Equipment", professional: "Professional Fees", import: "Imports", other: "Other" };
function PnlTab({ pnl, loading, formatMoney }) {
  if (loading || !pnl) {
    return <p style={{ fontSize: 13, color: "#9CA3AF", padding: "20px 0" }}>Loading…</p>;
  }
  const positive = pnl.netProfit >= 0;
  const kpi = (label, value, color) => (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #EEEEF0", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 800, color: color || "#0A0A0A", margin: 0, letterSpacing: "-.02em" }}>{value}</p>
    </div>
  );
  const row = (label, value, opts = {}) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 16px", borderBottom: "1px solid #F3F4F6", background: opts.head ? "#0A0A0A" : "transparent", color: opts.head ? "#fff" : "#374151", fontWeight: opts.head ? 700 : 500, borderRadius: opts.head ? 10 : 0 }}>
      <span style={{ fontSize: opts.head ? 13 : 12.5 }}>{label}</span>
      <span style={{ fontSize: opts.head ? 14 : 12.5, fontWeight: opts.head ? 800 : 650, color: opts.head ? (positive ? "#4ADE80" : "#F87171") : "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
        {kpi("Revenue (net)", formatMoney(pnl.revenue.net))}
        {kpi("Expenses", formatMoney(pnl.totalExpenses))}
        {kpi("Net Profit", formatMoney(pnl.netProfit), positive ? "#059669" : "#E11D2C")}
        {kpi("Margin", `${pnl.margin.toFixed(1)}%`, positive ? "#059669" : "#E11D2C")}
      </div>
      <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0, padding: "14px 16px 6px" }}>Income</p>
        {row(`Invoiced revenue (excl. GST) · ${pnl.revenue.invoiceCount} invoices`, formatMoney(pnl.revenue.net))}
      </Card>
      <Card pad={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0, padding: "14px 16px 6px" }}>Expenses by category</p>
        <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, padding: "0 16px 8px" }}>Approved &amp; paid only (pending/rejected excluded), net of input tax.</p>
        {pnl.expenseCategories.length === 0
          ? <p style={{ fontSize: 12.5, color: "#9CA3AF", padding: "16px", textAlign: "center" }}>No expenses in this period</p>
          : pnl.expenseCategories.map((c) => row(`${PNL_CAT_LABEL[c.category] || c.category} · ${c.billCount} bill${c.billCount !== 1 ? "s" : ""}`, formatMoney(c.netAmount)))}
      </Card>
      <div style={{ padding: "0 0 8px" }}>
        {row("NET PROFIT / (LOSS)", formatMoney(pnl.netProfit), { head: true })}
      </div>
    </>
  );
}

// ── HSN tab ───────────────────────────────────────────────────────────────────
function HsnTab({ hsnData, loading, fromDate, toDate }) {
  const s   = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap", background: "#FAFAFA" };
  const td  = { padding: "10px 14px", fontSize: 12, color: "#374151", borderBottom: "1px solid #F3F4F6" };
  const num = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  const totals = hsnData?.reduce((a, r) => ({
    qty: a.qty + Number(r.total_qty), taxable: a.taxable + Number(r.taxable_value),
    cgst: a.cgst + Number(r.cgst), sgst: a.sgst + Number(r.sgst),
    igst: a.igst + Number(r.igst), total: a.total + Number(r.total_value),
  }), { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  return (
    <>
      <p style={{ fontSize: 12, color: "#9CA3AF" }}>Period: {fromDate} → {toDate} · HSN/SAC codes grouped from all non-draft invoices</p>
      {hsnData && (
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["HSN/SAC","Description","UQC","Total Qty","Taxable Value","CGST","SGST","IGST","Total Value","GST %"].map(h => <th key={h} style={s}>{h}</th>)}
              </tr></thead>
              <tbody>
                {hsnData.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: "40px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No HSN/SAC data for this period</td></tr>
                ) : hsnData.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#0A0A0A" }}>{r.hsn_sac_code || "—"}</td>
                    <td style={tdStyle}>{r.item_name}</td>
                    <td style={{ ...tdStyle }}>{r.unit}</td>
                    <td style={num}>{Number(r.total_qty).toFixed(2)}</td>
                    <td style={num}>₹{Number(r.taxable_value).toFixed(2)}</td>
                    <td style={num}>{Number(r.cgst) > 0 ? `₹${Number(r.cgst).toFixed(2)}` : "—"}</td>
                    <td style={num}>{Number(r.sgst) > 0 ? `₹${Number(r.sgst).toFixed(2)}` : "—"}</td>
                    <td style={num}>{Number(r.igst) > 0 ? `₹${Number(r.igst).toFixed(2)}` : "—"}</td>
                    <td style={{ ...num, fontWeight: 700, color: "#0A0A0A" }}>₹{Number(r.total_value).toFixed(2)}</td>
                    <td style={num}>{Number(r.gst_rate).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
              {totals && hsnData.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#F9FAFB", borderTop: "2px solid #E5E7EB" }}>
                    <td colSpan={4} style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>Totals</td>
                    <td style={{ ...num, fontWeight: 700, color: "#0A0A0A" }}>₹{totals.taxable.toFixed(2)}</td>
                    <td style={{ ...num, fontWeight: 700 }}>₹{totals.cgst.toFixed(2)}</td>
                    <td style={{ ...num, fontWeight: 700 }}>₹{totals.sgst.toFixed(2)}</td>
                    <td style={{ ...num, fontWeight: 700 }}>₹{totals.igst.toFixed(2)}</td>
                    <td style={{ ...num, fontWeight: 700, color: "#E11D2C" }}>₹{totals.total.toFixed(2)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

// ── GSTR-3B tab ───────────────────────────────────────────────────────────────
function Gstr3bTab({ gstr3b, loading, fromDate, toDate }) {
  return (
    <>
      {/* Period / print row */}
      <div className="no-print" style={{ background: "#FFF", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: "12px 16px", display: "flex", gap: 16, alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,.035)", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {loading && <div style={{ width: 20, height: 20, border: "2px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Period: {fromDate} → {toDate}</span>
        </div>
        <button type="button" onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", border: "1.5px solid #E5E7EB", borderRadius: 9, background: "#FFF", fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
          <Download size={13} /> Print / Export
        </button>
      </div>

      {!gstr3b && !loading && (
        <Card pad={0}>
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <ShieldCheck size={36} style={{ margin: "0 auto 12px", display: "block", color: "#D1D5DB" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF" }}>Select a period above to generate GSTR-3B</p>
          </div>
        </Card>
      )}

      {gstr3b && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px", letterSpacing: "-0.02em" }}>GSTR-3B Summary Return</h2>
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                Period: {fromDate} to {toDate} · {gstr3b.summary.invoiceCount} invoices · {gstr3b.summary.billCount} expense bills with GST
              </p>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "#D1FAE5", padding: "4px 10px", borderRadius: 100 }}>
              Auto-computed from your data
            </span>
          </div>

          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[
              { label: "Outward Tax Liability", value: gstr3b.summary.totalOutwardTax,      color: "#0A0A0A", bg: "#F9FAFB",  border: "#E5E7EB" },
              { label: "ITC Available",          value: gstr3b.summary.totalITC,             color: "#059669", bg: "#F0FDF4",  border: "#BBF7D0" },
              { label: "Net Tax Payable",         value: gstr3b.summary.netTaxPayable,       color: "#E11D2C", bg: "#FEF2F2",  border: "#FCA5A5" },
              { label: "Taxable Turnover",        value: gstr3b.summary.totalOutwardTaxable, color: "#1D4ED8", bg: "#EFF6FF",  border: "#BFDBFE" },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: "16px 18px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em", textTransform: "uppercase", margin: "0 0 6px" }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color, margin: 0, letterSpacing: "-0.02em" }}>
                  ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>

          {/* Table 3.1 */}
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, background: "#FEE2E2", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={14} color="#E11D2C" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Table 3.1 — Nature of Outward Supplies</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>Summary of outward supplies made during the period</p>
              </div>
            </div>
            <table className="g3b-tbl">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Nature of Supplies</th>
                  <th className="g3b-num" style={{ textAlign: "right" }}>Taxable Value (₹)</th>
                  <th className="g3b-num" style={{ textAlign: "right" }}>IGST (₹)</th>
                  <th className="g3b-num" style={{ textAlign: "right" }}>CGST (₹)</th>
                  <th className="g3b-num" style={{ textAlign: "right" }}>SGST/UTGST (₹)</th>
                  <th className="g3b-num" style={{ textAlign: "right" }}>Cess (₹)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: "3.1(a)", desc: "Outward taxable supplies (other than zero rated, nil rated, exempted)", d: gstr3b.table31.a },
                  { id: "3.1(b)", desc: "Outward taxable supplies — zero rated",                                  d: gstr3b.table31.b },
                  { id: "3.1(c)", desc: "Other outward supplies (nil rated, exempted)",                          d: gstr3b.table31.c },
                  { id: "3.1(d)", desc: "Inward supplies (liable to reverse charge)",                           d: gstr3b.table31.d },
                ].map(({ id, desc, d }) => {
                  const f = (n) => n > 0 ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
                  return (
                    <tr key={id}>
                      <td style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>{id}</td>
                      <td>{desc}</td>
                      <td style={{ textAlign: "right", fontWeight: d.taxableValue > 0 ? 600 : 400, color: d.taxableValue > 0 ? "#0A0A0A" : "#D1D5DB" }}>{f(d.taxableValue)}</td>
                      <td style={{ textAlign: "right", color: d.igst > 0 ? "#374151" : "#D1D5DB" }}>{f(d.igst)}</td>
                      <td style={{ textAlign: "right", color: d.cgst > 0 ? "#374151" : "#D1D5DB" }}>{f(d.cgst)}</td>
                      <td style={{ textAlign: "right", color: d.sgst > 0 ? "#374151" : "#D1D5DB" }}>{f(d.sgst)}</td>
                      <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                    </tr>
                  );
                })}
                <tr className="g3b-total-row">
                  <td /><td>Total</td>
                  <td style={{ textAlign: "right" }}>₹{(gstr3b.table31.a.taxableValue + gstr3b.table31.d.taxableValue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right" }}>₹{(gstr3b.table31.a.igst + gstr3b.table31.d.igst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right" }}>₹{(gstr3b.table31.a.cgst + gstr3b.table31.d.cgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right" }}>₹{(gstr3b.table31.a.sgst + gstr3b.table31.d.sgst).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right" }}>₹0.00</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Table 3.2 */}
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, background: "#EFF6FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ReceiptText size={14} color="#2563EB" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Table 3.2 — Inter-state Supplies to Unregistered Persons</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>State-wise breakup of inter-state B2C supplies</p>
              </div>
            </div>
            {gstr3b.table32.unregistered.length === 0 ? (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No inter-state supplies to unregistered persons in this period</p>
              </div>
            ) : (
              <table className="g3b-tbl">
                <thead><tr>
                  <th>Place of Supply (State)</th>
                  <th style={{ textAlign: "right" }}>Taxable Value (₹)</th>
                  <th style={{ textAlign: "right" }}>IGST (₹)</th>
                </tr></thead>
                <tbody>
                  {gstr3b.table32.unregistered.map((row) => (
                    <tr key={row.pos}>
                      <td style={{ fontWeight: 500 }}>{row.pos}</td>
                      <td style={{ textAlign: "right" }}>₹{row.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: "right" }}>₹{row.igst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Table 4 — ITC */}
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, background: "#F0FDF4", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={14} color="#059669" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Table 4 — Eligible ITC</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>Input Tax Credit from expense bills with GST</p>
              </div>
            </div>
            <table className="g3b-tbl">
              <thead><tr>
                <th style={{ width: 56 }}>#</th>
                <th>Details</th>
                <th style={{ textAlign: "right" }}>IGST (₹)</th>
                <th style={{ textAlign: "right" }}>CGST (₹)</th>
                <th style={{ textAlign: "right" }}>SGST/UTGST (₹)</th>
                <th style={{ textAlign: "right" }}>Total (₹)</th>
              </tr></thead>
              <tbody>
                <tr>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>4(A)</td>
                  <td>ITC Available (imports, RC, ISD, all other)</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>₹{gstr3b.table4.A.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style={{ fontSize: 11, fontWeight: 700, color: "#6B7280" }}>4(B)</td>
                  <td>ITC Reversed (Rule 42 / 43 / others)</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>—</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>₹0.00</td>
                </tr>
                <tr className="g3b-total-row">
                  <td /><td>4(C) Net ITC Available (A − B)</td>
                  <td /><td /><td />
                  <td style={{ textAlign: "right", color: "#059669" }}>₹{gstr3b.table4.C.net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Table 6 — Tax Payable */}
          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, background: "#FEF3C7", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FileSpreadsheet size={14} color="#D97706" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Table 6 — Payment of Tax</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>Net tax payable after offsetting available ITC</p>
              </div>
            </div>
            <table className="g3b-tbl">
              <thead><tr>
                <th>Tax Type</th>
                <th style={{ textAlign: "right" }}>Tax Payable (₹)</th>
                <th style={{ textAlign: "right" }}>Paid via ITC (₹)</th>
                <th style={{ textAlign: "right" }}>Paid via Cash (₹)</th>
                <th style={{ textAlign: "right" }}>Interest (₹)</th>
                <th style={{ textAlign: "right" }}>Late Fee (₹)</th>
              </tr></thead>
              <tbody>
                {[
                  { label: "IGST",       row: gstr3b.table6.igst },
                  { label: "CGST",       row: gstr3b.table6.cgst },
                  { label: "SGST/UTGST", row: gstr3b.table6.sgst },
                  { label: "Cess",       row: gstr3b.table6.cess },
                ].map(({ label, row }) => (
                  <tr key={label}>
                    <td style={{ fontWeight: 600 }}>{label}</td>
                    <td style={{ textAlign: "right" }}>₹{row.liability.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right", color: "#059669" }}>₹{row.itcPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right", color: row.cashPaid > 0 ? "#E11D2C" : "#9CA3AF", fontWeight: row.cashPaid > 0 ? 700 : 400 }}>₹{row.cashPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: "right", color: "#D1D5DB" }}>₹0.00</td>
                    <td style={{ textAlign: "right", color: "#D1D5DB" }}>₹0.00</td>
                  </tr>
                ))}
                <tr className="g3b-total-row">
                  <td>Total</td>
                  <td style={{ textAlign: "right" }}>₹{(gstr3b.table6.igst.liability + gstr3b.table6.cgst.liability + gstr3b.table6.sgst.liability).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right", color: "#059669" }}>₹{(gstr3b.table6.igst.itcPaid + gstr3b.table6.cgst.itcPaid + gstr3b.table6.sgst.itcPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right", color: "#E11D2C" }}>₹{(gstr3b.table6.igst.cashPaid + gstr3b.table6.cgst.cashPaid + gstr3b.table6.sgst.cashPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>₹0.00</td>
                  <td style={{ textAlign: "right", color: "#D1D5DB" }}>₹0.00</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Disclaimer */}
          <div style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: 12, padding: "12px 18px" }}>
            <p style={{ fontSize: 12, color: "#92400E", margin: 0, lineHeight: 1.6 }}>
              ⚠️ <strong>Advisory:</strong> This is a data-driven summary auto-generated from your invoices and expense bills. ITC IGST/CGST/SGST split may need verification by your CA before filing. Zero-rated, nil-rated, and composition supplies are not auto-detected — fill them manually on the GST portal if applicable.
            </p>
          </div>
        </>
      )}
    </>
  );
}

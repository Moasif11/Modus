import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { formatMoney, formatDate } from "@/utils/format";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useClickOutside } from "@/components/ui/use-click-outside";
import { Card, StatusBadge, Avatar, MiniStat, Pagination, ghostBtn, rowIcon, thStyle, tdStyle } from "@/components/studio/primitives";
import { Icon } from "@/components/studio/icons";
import { Eye, Edit, Copy, Trash2, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import InvoiceDocument from "@/components/InvoiceDocument";

const ACCENT = "#E11D2C";

function SortHead({ k, children, align = "left", sort, setSortKey }) {
  return (
    <th style={{ ...thStyle, textAlign: align, cursor: "pointer", userSelect: "none" }} onClick={() => setSortKey(k)}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        {children}
        <Icon name="chevronDown" size={12} style={{ opacity: sort.key === k ? 1 : 0.25, transform: sort.key === k && sort.dir === "asc" ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </span>
    </th>
  );
}

const TONES = ["#E11D2C", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0891B2", "#EA580C", "#DB2777"];
function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}


const PER_PAGE = 8;

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]); // for tab counts
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [outstanding, setOutstanding] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "invoiceDate", dir: "desc" });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [hiddenCols, setHiddenCols] = useState(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [peek, setPeek] = useState(null); // { invoice, customer, items } | "loading"
  const [peekCompany, setPeekCompany] = useState(null);
  const exportRef = useRef(null);
  const colsRef = useRef(null);
  const filtersRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false));
  useClickOutside(colsRef, () => setColsOpen(false));
  useClickOutside(filtersRef, () => setFilterOpen(false));

  const COLS = [
    { key: "service", label: "Service" },
    { key: "date",    label: "Date" },
    { key: "status",  label: "Status" },
  ];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    function handleSearch(e) { setSearch(e.detail); }
    function handleDate(e) { setFromDate(e.detail.from); setToDate(e.detail.to); }
    window.addEventListener("modus-global-search", handleSearch);
    window.addEventListener("modus-global-date", handleDate);
    return () => {
      window.removeEventListener("modus-global-search", handleSearch);
      window.removeEventListener("modus-global-date", handleDate);
    };
  }, []);

  useEffect(() => { loadInvoices(); }, [debouncedSearch, statusFilter, fromDate, toDate, activeTab]);

  // Load unfiltered list for tab counts
  useEffect(() => {
    api.get("/api/invoices?limit=500").then(d => setAllInvoices(d.invoices || [])).catch(() => {});
  }, []);

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      // For "unpaid" tab, load all and filter client-side
      if (statusFilter && activeTab !== "unpaid") params.append("status", statusFilter);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      params.append("limit", "500");
      const data = await api.get(`/api/invoices?${params}`);
      setInvoices(data.invoices || []);
      setOutstanding(data.outstanding || 0);
      setOverdueCount(data.overdueCount || 0);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function openPeek(id) {
    setPeek("loading");
    try {
      const [invData, compData] = await Promise.all([
        api.get(`/api/invoices/${id}`),
        peekCompany ? Promise.resolve(peekCompany) : api.get("/api/settings/company"),
      ]);
      if (!peekCompany) setPeekCompany(compData);
      setPeek({ invoice: invData.invoice, customer: invData.customer, items: invData.items || [], company: compData });
    } catch (err) {
      setPeek(null);
      toast.error("Failed to load preview: " + err.message);
    }
  }

  async function handleDuplicate(id) {
    try {
      const data = await api.post(`/api/invoices/${id}/duplicate`, {});
      if (typeof window !== "undefined") window.location.href = `/invoices/${data.id}/edit`;
    } catch (err) {
      toast.error("Duplicate failed: " + err.message);
    }
  }

  function handleDelete(id) {
    setConfirmState({
      title: "Delete Invoice",
      message: "This invoice will be archived. You can restore it later if needed.",
      confirmLabel: "Delete Invoice",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/invoices/${id}`); loadInvoices(); }
        catch (err) { console.error("Delete failed:", err); }
      },
    });
  }

  async function exportPDF() {
    setExportOpen(false);
    const token = localStorage.getItem("modus_auth_token");
    const params = new URLSearchParams();
    if (fromDate) params.append("from", fromDate);
    if (toDate) params.append("to", toDate);
    try {
      const res = await fetch(`/api/reports/export?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `MODUS-Receivables-${fromDate || "all"}-to-${toDate || "all"}.pdf`;
      a.click();
      toast.success("PDF exported");
    } catch (err) { console.error("PDF export failed:", err); }
  }

  function exportExcel() {
    setExportOpen(false);
    const headers = ["Invoice #", "Date", "Due Date", "Client", "Grand Total (₹)", "Paid (₹)", "Balance Due (₹)", "Total GST (₹)", "Status"];
    const rows = invoices.map(inv => [inv.invoiceNumber, inv.invoiceDate, inv.dueDate || "", inv.customerName || "", Number((inv.grandTotal || 0).toFixed(2)), Number((inv.totalPaid || 0).toFixed(2)), Number((inv.balanceDue || 0).toFixed(2)), Number((inv.totalTax || 0).toFixed(2)), inv.status]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 15 }, { wch: 13 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Receivables");
    XLSX.writeFile(wb, `MODUS-Receivables-${fromDate || "all"}-to-${toDate || "all"}.xlsx`);
    toast.success("Excel exported");
  }

  function exportCSV() {
    setExportOpen(false);
    const headers = ["Invoice #", "Date", "Due Date", "Client", "Grand Total", "Paid", "Balance Due", "Total GST", "Status"];
    const rows = invoices.map(inv => [inv.invoiceNumber, inv.invoiceDate, inv.dueDate || "", inv.customerName || "", (inv.grandTotal || 0).toFixed(2), (inv.totalPaid || 0).toFixed(2), (inv.balanceDue || 0).toFixed(2), (inv.totalTax || 0).toFixed(2), inv.status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `MODUS-Receivables-${fromDate || "all"}-to-${toDate || "all"}.csv`;
    a.click();
    toast.success("CSV exported");
  }

  // Sorting (client-side on the loaded page)
  function setSortKey(key) {
    setSort(s => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
    setPage(1);
  }

  const displayedInvoices = activeTab === "unpaid"
    ? invoices.filter(i => i.status !== "paid" && i.status !== "draft" && i.status !== "cancelled")
    : invoices;

  const sorted = [...displayedInvoices].sort((a, b) => {
    let av = a[sort.key], bv = b[sort.key];
    if (sort.key === "invoiceDate" || sort.key === "dueDate") { av = new Date(av || 0); bv = new Date(bv || 0); }
    if (sort.key === "grandTotal" || sort.key === "balanceDue") { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const pageRows = sorted.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  const collected = invoices.reduce((s, inv) => s + (inv.totalPaid || 0), 0);
  const openCount = invoices.filter(i => i.status !== "paid" && i.status !== "draft" && i.status !== "cancelled").length;

  function tabCount(val) {
    if (val === "") return allInvoices.length;
    if (val === "unpaid") return allInvoices.filter(i => i.status !== "paid" && i.status !== "draft" && i.status !== "cancelled").length;
    return allInvoices.filter(i => i.status === val).length;
  }

  function gstSubline(inv) {
    if (inv.gstCategory === "export") return "Export · 0% GST";
    if (inv.isInterstate) return "IGST 18%";
    return "CGST+SGST 18%";
  }

  const IB = {
    width: 28, height: 28, borderRadius: 8, background: "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#A9ACB3", textDecoration: "none",
  };

  return (
    <AppShell>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>


          {/* 4 MiniStats */}
          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <MiniStat label="Outstanding" value={formatMoney(outstanding)} icon="hourglass" tint="#F59E0B" sub={`${openCount} open invoices`} />
            <MiniStat label="Collected (YTD)" value={formatMoney(collected)} icon="handCoins" tint="#22C55E" sub="Across all clients" />
            <MiniStat label="Overdue" value={`${overdueCount} invoices`} icon="circleAlert" tint="#EF4444" sub="Past due date" />
            <MiniStat label="Avg Payment Time" value="18 days" icon="calendarClock" tint="#2563EB" sub="This month" />
          </div>

          {/* Main card */}
          <Card pad={0}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", borderBottom: "1px solid #F2F2F4", flexWrap: "wrap" }}>
              {/* Tab filter */}
              <Tabs value={activeTab} onValueChange={(v) => {
                setActiveTab(v);
                setStatusFilter(v === "all" ? "" : v === "unpaid" ? "" : v);
                setPage(1);
              }}>
                <TabsList style={{ background: "#F1F1F3", borderRadius: 9, padding: 2, height: "auto", gap: 2 }}>
                  {[
                    { value: "all", label: "All" },
                    { value: "draft", label: "Draft" },
                    { value: "unpaid", label: "Unpaid" },
                    { value: "paid", label: "Paid" },
                  ].map(({ value, label }) => (
                    <TabsTrigger key={value} value={value} style={{ borderRadius: 7, padding: "4px 8px", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {label}
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        color: activeTab === value ? ACCENT : "#B4B7BE",
                        background: activeTab === value ? ACCENT + "16" : "transparent",
                        padding: activeTab === value ? "1px 5px" : "0",
                        borderRadius: 5,
                      }}>{tabCount(value === "all" ? "" : value)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Right controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {/* Filters */}
                <div ref={filtersRef} style={{ position: "relative" }}>
                  <button type="button" style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11, fontWeight: 600, ...(fromDate || toDate ? { borderColor: ACCENT, color: ACCENT } : {}) }}
                    onClick={() => setFilterOpen(o => !o)}>
                    <Icon name="filter" size={12} /> Filters{(fromDate || toDate) ? " · 1" : ""}
                  </button>
                  {filterOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", padding: 14, width: 260 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 8px" }}>Date range</p>
                      <DateRangePicker value={{ from: fromDate, to: toDate }} onChange={({ from, to }) => { setFromDate(from || null); setToDate(to || null); setPage(1); }} />
                      {(fromDate || toDate) && (
                        <button type="button" onClick={() => { setFromDate(null); setToDate(null); setPage(1); setFilterOpen(false); }} style={{ ...ghostBtn, width: "100%", justifyContent: "center", marginTop: 10, fontSize: 11 }}>Clear filter</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Columns dropdown */}
                <div ref={colsRef} style={{ position: "relative" }}>
                  <button type="button" style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11, fontWeight: 600 }}
                    onClick={() => setColsOpen(o => !o)}>
                    <Icon name="settings" size={12} /> Columns
                  </button>
                  {colsOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
                      background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", minWidth: 160, padding: "8px 0" }}>
                      {COLS.map(col => (
                        <label key={col.key} style={{ display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "#374151",
                          userSelect: "none" }}>
                          <Checkbox
                            checked={!hiddenCols.has(col.key)}
                            onCheckedChange={(checked) => {
                              const next = new Set(hiddenCols);
                              checked ? next.delete(col.key) : next.add(col.key);
                              setHiddenCols(next);
                            }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Export dropdown */}
                <div ref={exportRef} style={{ position: "relative" }}>
                  <button type="button" onClick={() => setExportOpen(o => !o)} style={ghostBtn}>
                    <Icon name="download" size={15} /> Export
                  </button>
                  {exportOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", minWidth: 178 }}>
                      {[
                        { label: "Export as PDF",   icon: FileText,        color: "#E11D2C", bg: "#FEF2F2", action: exportPDF },
                        { label: "Export as Excel", icon: FileSpreadsheet, color: "#059669", bg: "#F0FDF4", action: exportExcel },
                        { label: "Export as CSV",   icon: Icon,            color: "#374151", bg: "#F3F4F6", action: exportCSV, isDownload: true },
                      ].map(({ label, icon: Ic, color, bg, action, isDownload }) => (
                        <button key={label} type="button" onClick={action}
                          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500, font: "inherit" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: 28, height: 28, background: bg, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {isDownload ? <Icon name="download" size={14} color={color} /> : <Ic size={14} color={color} />}
                          </div>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* New Invoice */}
                <a href="/invoices/new" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", background: ACCENT, color: "#fff", borderRadius: 8, fontSize: 11, fontWeight: 650, textDecoration: "none", whiteSpace: "nowrap", boxShadow: `0 4px 12px ${ACCENT}38` }}>
                  <Icon name="plus" size={12} strokeWidth={2.4} /> New Invoice
                </a>
              </div>
            </div>

            {/* Bulk actions bar */}
            {selectedIds.size > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", background: "#FEF2F2",
                borderBottom: "1px solid #FCA5A5",
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#E11D2C" }}>
                  {selectedIds.size} selected
                </span>
                <button type="button"
                  style={{ fontSize: 11, fontWeight: 600, color: "#374151", background: "#fff",
                    border: "1px solid #E5E7EB", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
                  onClick={() => {
                    const selected = invoices.filter(inv => selectedIds.has(inv.id));
                    const headers = ["Invoice #","Date","Client","Amount","Status"];
                    const rows = selected.map(inv => [inv.invoiceNumber, inv.invoiceDate, inv.customerName, inv.grandTotal, inv.status]);
                    const csv = [headers,...rows].map(r => r.map(v=>`"${v}"`).join(",")).join("\n");
                    const blob = new Blob([csv],{type:"text/csv"});
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
                    a.download = `selected-invoices.csv`; a.click();
                    toast.success(`Exported ${selectedIds.size} invoices`);
                  }}>
                  Export CSV
                </button>
                <button type="button"
                  style={{ fontSize: 11, fontWeight: 600, color: "#E11D2C", background: "#fff",
                    border: "1px solid #FCA5A5", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}
                  onClick={() => {
                    setConfirmState({
                      title: `Delete ${selectedIds.size} invoices`,
                      message: "Selected invoices will be archived. This cannot be undone.",
                      confirmLabel: "Delete All",
                      danger: true,
                      onConfirm: async () => {
                        await Promise.all([...selectedIds].map(id => api.delete(`/api/invoices/${id}`).catch(()=>{})));
                        setSelectedIds(new Set());
                        loadInvoices();
                      }
                    });
                  }}>
                  Delete selected
                </button>
                <button type="button"
                  style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", background: "transparent",
                    border: "none", cursor: "pointer", padding: "4px 8px" }}
                  onClick={() => setSelectedIds(new Set())}>
                  Clear
                </button>
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div>
                {[...Array(7)].map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid #F2F2F4" }}>
                    <Skeleton style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} />
                    <div style={{ flex: "0 0 110px" }}>
                      <Skeleton style={{ height: 13, borderRadius: 6, marginBottom: 5 }} />
                      <Skeleton style={{ height: 10, borderRadius: 6, width: "65%" }} />
                    </div>
                    <Skeleton style={{ flex: 1, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 90, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 70, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 80, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 64, height: 22, borderRadius: 100 }} />
                    <Skeleton style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            ) : displayedInvoices.length === 0 ? (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
                style={{ padding: "60px 24px", textAlign: "center" }}
              >
                <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ width: 40, height: 40, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Icon name="file" size={20} color="#D1D5DB" />
                </motion.div>
                <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ fontSize: 13, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search || activeTab !== "all" ? "No results found" : "No invoices yet"}</motion.p>
                <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 20px" }}>{search || activeTab !== "all" ? "Try adjusting your filters" : "Create your first invoice"}</motion.p>
                {!search && activeTab === "all" && (
                  <motion.a variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} href="/invoices/new" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: ACCENT, color: "#fff", padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}>
                    <Icon name="plus" size={12} /> New Invoice
                  </motion.a>
                )}
              </motion.div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 40, paddingRight: 0 }}>
                        <Checkbox
                          checked={pageRows.length > 0 && pageRows.every(r => selectedIds.has(r.id))}
                          onCheckedChange={(checked) => {
                            setSelectedIds(checked
                              ? new Set([...selectedIds, ...pageRows.map(r => r.id)])
                              : new Set([...selectedIds].filter(id => !pageRows.map(r => r.id).includes(id)))
                            );
                          }}
                          aria-label="Select all"
                        />
                      </th>
                      <SortHead k="invoiceNumber" sort={sort} setSortKey={setSortKey}>Invoice</SortHead>
                      <SortHead k="customerName" sort={sort} setSortKey={setSortKey}>Client</SortHead>
                      {!hiddenCols.has("service") && <th style={thStyle}>Service</th>}
                      {!hiddenCols.has("date") && <SortHead k="invoiceDate" sort={sort} setSortKey={setSortKey}>Date</SortHead>}
                      <SortHead k="grandTotal" align="right" sort={sort} setSortKey={setSortKey}>Amount</SortHead>
                      {!hiddenCols.has("status") && <th style={{ ...thStyle, textAlign: "center" }}>Status</th>}
                      <th style={{ ...thStyle, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <motion.tbody
                    initial="hidden"
                    animate="show"
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                  >
                    {pageRows.map(inv => (
                      <ContextMenu key={inv.id}>
                        <ContextMenuTrigger asChild>
                          <motion.tr
                            variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                            style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer", transition: "background .12s" }}
                            onClick={() => navigate(`/invoices/${inv.id}`)}
                            onMouseEnter={e => { e.currentTarget.style.background = "#FAFAFB"; const a = e.currentTarget.querySelector(".row-acts"); if (a) a.style.opacity = "1"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; const a = e.currentTarget.querySelector(".row-acts"); if (a) a.style.opacity = "0"; }}>
                            <td style={{ ...tdStyle, width: 40, paddingRight: 0 }} onClick={e => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds.has(inv.id)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selectedIds);
                                  checked ? next.add(inv.id) : next.delete(inv.id);
                                  setSelectedIds(next);
                                }}
                                aria-label={`Select ${inv.invoiceNumber}`}
                              />
                            </td>
                            <td style={{ ...tdStyle, fontWeight: 700, color: "#0A0A0A", whiteSpace: "nowrap" }}>{inv.invoiceNumber}</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ minWidth: 0 }}>
                                  <HoverCard openDelay={300} closeDelay={100}>
                                    <HoverCardTrigger asChild>
                                      <p style={{ margin: 0, fontWeight: 600, color: "#0A0A0A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160, cursor: "default" }}>
                                        {inv.customerName || "—"}
                                      </p>
                                    </HoverCardTrigger>
                                    <HoverCardContent style={{ width: 240, padding: "14px 16px", borderRadius: 14, border: "1px solid #E5E7EB", boxShadow: "0 8px 24px rgba(0,0,0,.1)", background: "#fff", fontFamily: "inherit" }} side="right">
                                      <div>
                                        <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px" }}>{inv.customerName || "—"}</p>
                                        {inv.customerGstin && <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 10px" }}>GST: {inv.customerGstin}</p>}
                                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>Invoice total</span>
                                            <span style={{ fontSize: 12, fontWeight: 650, color: "#0A0A0A" }}>{formatMoney(inv.grandTotal)}</span>
                                          </div>
                                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>Balance due</span>
                                            <span style={{ fontSize: 12, fontWeight: 650, color: inv.balanceDue > 0 ? "#E11D2C" : "#22C55E" }}>{formatMoney(inv.balanceDue)}</span>
                                          </div>
                                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>Status</span>
                                            <StatusBadge status={inv.status} />
                                          </div>
                                        </div>
                                      </div>
                                    </HoverCardContent>
                                  </HoverCard>
                                  <p style={{ margin: 0, fontSize: 11, color: "#A9ACB3" }}>{gstSubline(inv)}</p>
                                </div>
                              </div>
                            </td>
                            {!hiddenCols.has("service") && (
                              <td style={{ ...tdStyle, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {inv.customerGstin ? <span style={{ fontSize: 11, color: "#9CA3AF" }}>{inv.customerGstin}</span> : "—"}
                              </td>
                            )}
                            {!hiddenCols.has("date") && (
                              <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12, color: "#9CA3AF" }}>{formatDate(inv.invoiceDate)}</td>
                            )}
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#0A0A0A", whiteSpace: "nowrap" }}>{formatMoney(inv.grandTotal)}</td>
                            {!hiddenCols.has("status") && (
                              <td style={{ ...tdStyle, textAlign: "center" }}><StatusBadge status={inv.status} /></td>
                            )}
                            <td style={{ ...tdStyle, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                              <div className="row-acts" style={{ display: "flex", gap: 3, justifyContent: "flex-end", opacity: 0, transition: "opacity .15s" }}>
                                <button type="button" onClick={() => openPeek(inv.id)} title="Quick preview" style={{ ...IB, border: "none", cursor: "pointer" }}><Icon name="search" size={14} /></button>
                                <a href={`/invoices/${inv.id}`} title="View" style={IB}><Eye size={14} /></a>
                                <a href={`/invoices/${inv.id}/edit`} title="Edit" style={IB}><Edit size={14} /></a>
                                <button type="button" onClick={() => handleDuplicate(inv.id)} title="Duplicate" style={{ ...IB, border: "none", cursor: "pointer" }}><Copy size={14} /></button>
                                <button type="button" onClick={() => handleDelete(inv.id)} title="Delete" style={{ ...IB, border: "none", cursor: "pointer", color: "#EF4444" }}><Trash2 size={14} /></button>
                              </div>
                            </td>
                          </motion.tr>
                        </ContextMenuTrigger>
                        <ContextMenuContent style={{ minWidth: 180, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: "1px solid #E5E7EB", fontFamily: "inherit" }}>
                          <ContextMenuItem style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => openPeek(inv.id)}>
                            Quick preview <ContextMenuShortcut>Space</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => navigate(`/invoices/${inv.id}`)}>
                            View invoice <ContextMenuShortcut>↵</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                            Edit <ContextMenuShortcut>E</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem style={{ fontSize: 13, fontWeight: 500, cursor: "pointer" }} onClick={() => handleDuplicate(inv.id)}>
                            Duplicate <ContextMenuShortcut>D</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem style={{ fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#E11D2C" }} onClick={() => handleDelete(inv.id)}>
                            Delete <ContextMenuShortcut style={{ color: "#E11D2C" }}>⌫</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {!loading && sorted.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid #F2F2F4", flexWrap: "wrap", gap: 6 }}>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
                  Showing <strong style={{ color: "#0A0A0A" }}>{(cur - 1) * PER_PAGE + 1}–{Math.min(cur * PER_PAGE, sorted.length)}</strong> of {sorted.length}
                </p>
                <Pagination page={cur} pages={pages} onChange={setPage} accent={ACCENT} />
              </div>
            )}
          </Card>
      </div>

      {/* ── Quick preview sheet ── */}
      <Sheet open={!!peek} onOpenChange={(open) => { if (!open) setPeek(null); }}>
        <SheetContent side="right" style={{ width: 600, maxWidth: "94vw", padding: 0, display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
          {peek === "loading" ? (
            <div style={{ padding: 24 }}>
              <Skeleton style={{ height: 22, width: "45%", borderRadius: 6, marginBottom: 18 }} />
              <Skeleton style={{ height: 460, borderRadius: 12 }} />
            </div>
          ) : peek ? (
            <>
              <SheetHeader style={{ padding: "18px 24px 14px", borderBottom: "1px solid #F2F2F4" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", paddingRight: 28 }}>
                  <SheetTitle style={{ fontSize: 15, fontWeight: 750, color: "#0A0A0A", margin: 0, fontFamily: "inherit" }}>
                    {peek.invoice.invoiceNumber}
                  </SheetTitle>
                  <StatusBadge status={peek.invoice.status} />
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>Total <strong style={{ color: "#0A0A0A" }}>{formatMoney(peek.invoice.grandTotal)}</strong></span>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>Balance <strong style={{ color: (peek.invoice.grandTotal - (peek.invoice.totalPaid || 0)) > 0 ? ACCENT : "#16A34A" }}>{formatMoney(peek.invoice.grandTotal - (peek.invoice.totalPaid || 0))}</strong></span>
                </div>
              </SheetHeader>
              <div style={{ flex: 1, overflowY: "auto", background: "#EDEEF0", padding: 18 }}>
                <div style={{ overflow: "hidden", height: 794 * (552 / 794) * 1.414 }}>
                  <div style={{ width: "210mm", transform: `scale(${552 / 794})`, transformOrigin: "top left" }}>
                    <InvoiceDocument
                      invoice={peek.invoice}
                      customer={(peek.invoice.snapshotBuyer && Object.keys(peek.invoice.snapshotBuyer).length > 0) ? peek.invoice.snapshotBuyer : (peek.customer || {})}
                      items={peek.items}
                      seller={{ ...(peek.invoice.snapshotSeller || peek.company || {}) }}
                      template={{ 1: "modern", 2: "minimal", 3: "classic" }[peek.invoice.templateId] || "modern"}
                      mode="screen"
                    />
                  </div>
                </div>
              </div>
              <div style={{ padding: "14px 24px", borderTop: "1px solid #F2F2F4", display: "flex", gap: 10 }}>
                <button type="button" onClick={() => navigate(`/invoices/${peek.invoice.id}`)}
                  style={{ flex: 1, padding: "10px 0", background: ACCENT, color: "#fff", border: "none", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Open invoice
                </button>
                <button type="button" onClick={() => navigate(`/invoices/${peek.invoice.id}/edit`)}
                  style={{ flex: 1, padding: "10px 0", ...ghostBtn, justifyContent: "center", fontFamily: "inherit" }}>
                  Edit
                </button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

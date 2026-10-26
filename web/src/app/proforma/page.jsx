import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { formatMoney, formatDate } from "@/utils/format";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Card, StatusBadge, Pagination, thStyle, tdStyle, MiniStat } from "@/components/studio/primitives";
import { Icon } from "@/components/studio/icons";
import { Eye, Edit, Trash2 } from "lucide-react";

const ACCENT = "#E11D2C";

const FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

const PER_PAGE = 8;

export default function ProformaPage() {
  const navigate = useNavigate();
  const [proformas, setProformas] = useState([]);
  const [allProformas, setAllProformas] = useState([]); // for tab counts
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [page, setPage] = useState(1);

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

  useEffect(() => { loadProformas(); }, [debouncedSearch, statusFilter, fromDate, toDate]);

  // Load unfiltered list for tab counts
  useEffect(() => {
    api.get("/api/proforma?limit=500").then(d => setAllProformas(d.proformas || [])).catch(() => {});
  }, []);

  async function loadProformas() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter) params.append("status", statusFilter);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      params.append("limit", "500");
      const data = await api.get(`/api/proforma?${params}`);
      setProformas(data.proformas || []);
      setPage(1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id) {
    setConfirmState({
      title: "Delete Proforma",
      message: "This proforma invoice will be archived. You can restore it later if needed.",
      confirmLabel: "Delete Proforma",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/proforma/${id}`); loadProformas(); }
        catch (err) { console.error("Delete failed:", err); }
      },
    });
  }

  const pages = Math.max(1, Math.ceil(proformas.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const pageRows = proformas.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  function tabCount(val) {
    if (val === "") return allProformas.length;
    return allProformas.filter(p => p.status === val).length;
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
            <MiniStat label="Total Proforma" value={allProformas.length} icon="layers" tint="#16A34A" sub="All time" />
            <MiniStat label="Converted (YTD)" value={allProformas.filter(p => p.status === 'accepted').length} icon="circleCheck" tint="#2563EB" sub="Turned into invoices" />
            <MiniStat label="Pending" value={allProformas.filter(p => p.status === 'sent').length} icon="hourglass" tint="#F59E0B" sub="Awaiting payment" />
            <MiniStat label="Conversion Rate" value={`${allProformas.length ? Math.round((allProformas.filter(p => p.status === 'accepted').length / allProformas.length) * 100) : 0}%`} icon="trending-up" tint="#7C3AED" sub="Converted" />
          </div>

        <Card pad={0}>
          {/* Toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", borderBottom: "1px solid #F2F2F4", flexWrap: "wrap" }}>
            {/* Pill filter tabs */}
            <div style={{ display: "flex", gap: 2, background: "#F1F1F3", borderRadius: 9, padding: 2, flexWrap: "wrap" }}>
              {FILTERS.map(f => {
                const active = statusFilter === f.value;
                const ct = tabCount(f.value);
                return (
                  <button key={f.value} type="button" onClick={() => { setStatusFilter(f.value); setPage(1); }} style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: active ? "#fff" : "transparent", color: active ? "#0A0A0A" : "#8A8D94",
                    fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,.1)" : "none", transition: "all .15s",
                  }}>
                    {f.label}
                    <span style={{ fontSize: 9, fontWeight: 700, color: active ? ACCENT : "#B4B7BE", background: active ? ACCENT + "16" : "transparent", padding: active ? "1px 5px" : "0", borderRadius: 5 }}>{ct}</span>
                  </button>
                );
              })}
            </div>

                {/* New Proforma */}
                <a href="/proforma/new" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", background: ACCENT, color: "#fff", borderRadius: 10, fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", boxShadow: `0 1px 3px ${ACCENT}4D` }}>
                  <Icon name="plus" size={13} strokeWidth={2.4} /> New Proforma
                </a>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: "64px 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 34, height: 34, border: `3px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : proformas.length === 0 ? (
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
              style={{ padding: "60px 24px", textAlign: "center" }}
            >
              <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ width: 40, height: 40, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="file" size={20} color="#D1D5DB" />
              </motion.div>
              <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ fontSize: 13, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search || statusFilter ? "No results found" : "No proforma invoices yet"}</motion.p>
              <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 20px" }}>{search || statusFilter ? "Try adjusting your filters" : "Create your first proforma invoice"}</motion.p>
              {!search && !statusFilter && (
                <motion.a variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} href="/proforma/new" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: ACCENT, color: "#fff", padding: "5px 10px", borderRadius: 8, fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}>
                  <Icon name="plus" size={12} /> New Proforma
                </motion.a>
              )}
            </motion.div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Proforma</th>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Valid Until</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <motion.tbody
                  initial="hidden"
                  animate="show"
                  variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                >
                  {pageRows.map(p => (
                    <motion.tr key={p.id}
                      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                      style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer", transition: "background .12s" }}
                      onClick={() => navigate(`/proforma/${p.id}`)}
                      onMouseEnter={e => { e.currentTarget.style.background = "#FAFAFB"; const a = e.currentTarget.querySelector(".row-acts"); if (a) a.style.opacity = "1"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; const a = e.currentTarget.querySelector(".row-acts"); if (a) a.style.opacity = "0"; }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#0A0A0A", whiteSpace: "nowrap" }}>{p.proformaNumber}</td>
                      <td style={{ ...tdStyle, maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.customerName || "—"}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12, color: "#9CA3AF" }}>{formatDate(p.proformaDate)}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: 12, color: "#9CA3AF" }}>{p.validUntil ? formatDate(p.validUntil) : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#0A0A0A", whiteSpace: "nowrap" }}>{formatMoney(p.grandTotal)}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}><StatusBadge status={p.status} /></td>
                      <td style={{ ...tdStyle, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <div className="row-acts" style={{ display: "flex", gap: 3, justifyContent: "flex-end", opacity: 0, transition: "opacity .15s" }}>
                          <a href={`/proforma/${p.id}`} title="View" style={IB}><Eye size={14} /></a>
                          <a href={`/proforma/${p.id}/edit`} title="Edit" style={IB}><Edit size={14} /></a>
                          <button type="button" onClick={() => handleDelete(p.id)} title="Delete" style={{ ...IB, border: "none", cursor: "pointer", color: "#EF4444" }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {!loading && proformas.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid #F2F2F4", flexWrap: "wrap", gap: 6 }}>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
                Showing <strong style={{ color: "#0A0A0A" }}>{(cur - 1) * PER_PAGE + 1}–{Math.min(cur * PER_PAGE, proformas.length)}</strong> of {proformas.length}
              </p>
              <Pagination page={cur} pages={pages} onChange={setPage} accent={ACCENT} />
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

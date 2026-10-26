import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { api } from "@/utils/api";
import { formatDate, formatINRk } from "@/utils/format";
import { Card, MiniStat, Avatar } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { Plus } from "lucide-react";

// ── Project status config ─────────────────────────────────────────────────────
const PROJ_STATUS = {
  active:    { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Active" },
  on_hold:   { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444", label: "On Hold" },
  completed: { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", label: "Completed" },
  cancelled: { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Cancelled" },
};

// Map API status keys → PROJ_STATUS keys (on_hold is stored as on_hold)
function ProjBadge({ status }) {
  const s = PROJ_STATUS[status] || PROJ_STATUS.active;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px 4px 8px", background: s.bg,
      borderRadius: 100, fontSize: 11.5, fontWeight: 650,
      color: s.color, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

// Deterministic tone from project/client name
const TONES = ["#7C3AED", "#EA580C", "#16A34A", "#2563EB", "#DB2777", "#0F766E", "#E11D2C", "#B45309"];
function toneFor(str) {
  if (!str) return TONES[0];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return TONES[Math.abs(h) % TONES.length];
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active",    label: "Active"    },
  { value: "on_hold",   label: "On Hold"   },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_FORM = {
  name: "", clientId: "", status: "active",
  startDate: "", endDate: "", budget: "", notes: "",
};

const INP = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB",
  borderRadius: 9, fontSize: 13, color: "#0A0A0A",
  background: "#FAFAFA", boxSizing: "border-box", outline: "none",
};
const LBL = {
  display: "block", fontSize: 11, fontWeight: 600,
  color: "#374151", marginBottom: 5,
};

export default function ProjectsPage() {
  const [projects, setProjects]     = useState([]);
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showModal, setShowModal]   = useState(false);
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadProjects(); }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    api.get("/api/customers").then((d) => setCustomers(d.customers || [])).catch(() => {});
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter) params.append("status", statusFilter);
      const data = await api.get(`/api/projects?${params}`);
      setProjects(data.projects || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function openCreate() { setForm(EMPTY_FORM); setEditingId(null); setShowModal(true); }
  function openEdit(p, e) {
    e.stopPropagation();
    setForm({
      name:      p.name || "",
      clientId:  p.clientId || "",
      status:    p.status || "active",
      startDate: p.startDate ? p.startDate.split("T")[0] : "",
      endDate:   p.endDate   ? p.endDate.split("T")[0]   : "",
      budget:    p.budget || "",
      notes:     p.notes || "",
    });
    setEditingId(p.id);
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name:      form.name.trim(),
        clientId:  form.clientId || null,
        status:    form.status,
        startDate: form.startDate || null,
        endDate:   form.endDate   || null,
        budget:    form.budget ? parseFloat(form.budget) : 0,
        notes:     form.notes || null,
      };
      if (editingId) {
        await api.put(`/api/projects/${editingId}`, body);
      } else {
        await api.post("/api/projects", body);
      }
      setShowModal(false);
      loadProjects();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function handleDelete(p, e) {
    e.stopPropagation();
    setConfirmState({
      title: "Delete Project",
      message: `Delete "${p.name}"? This won't delete linked invoices or bills — they'll just become unlinked.`,
      confirmLabel: "Delete Project",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/api/projects/${p.id}`);
        loadProjects();
      },
    });
  }

  // ── Aggregates from real data ─────────────────────────────────────────────
  const activeCount  = projects.filter((p) => p.status === "active").length;
  const totalBudget  = projects.reduce((s, p) => s + (p.budget || 0), 0);
  // totalReceived = billed/revenue; totalExpenses = expenses paid out
  const totalBilled  = projects.reduce((s, p) => s + (p.totalReceived || 0), 0);
  const unbilled     = Math.max(0, totalBudget - totalBilled);

  // Filtered list
  const filtered = projects.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      return (p.name || "").toLowerCase().includes(q) || (p.clientName || "").toLowerCase().includes(q);
    }
    return true;
  });

  const accent = "#E11D2C";

  return (
    <AppShell>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <style>{`
        @keyframes spin    { from { transform: rotate(0deg);   } to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .tab-pill:hover { background: #fff !important; color: #0A0A0A !important; }
        .srch-proj:focus { border-color: #E11D2C !important; box-shadow: 0 0 0 3px rgba(225,29,44,0.08) !important; outline: none !important; }
        .inp-f:focus     { border-color: #E11D2C !important; box-shadow: 0 0 0 3px rgba(225,29,44,0.08) !important; }
        .proj-card-act   { opacity: 0; transition: opacity 0.15s; }
        .proj-card:hover .proj-card-act { opacity: 1; }
      `}</style>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", background: "#F7F7F7" }}>
        {/* 4-up MiniStat row */}
        <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18, animation: "fadeUp 0.3s ease" }}>
          <MiniStat label="Active projects"   value={activeCount}          icon="folder"    tint={accent}    sub={`${projects.length} total`} />
          <MiniStat label="Contracted value"  value={formatINRk(totalBudget)} icon="briefcase" tint="#2563EB" sub="Across all projects" />
          <MiniStat label="Billed to date"    value={formatINRk(totalBilled)} icon="check"     tint="#22C55E" sub={totalBudget > 0 ? `${Math.round(totalBilled / totalBudget * 100)}% of contracted` : "—"} />
          <MiniStat label="Yet to bill"       value={formatINRk(unbilled)}    icon="clock"     tint="#F59E0B" sub="Work in progress" />
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {/* Pill filter tabs */}
          <div style={{ display: "flex", gap: 3, background: "#EEEEF0", borderRadius: 11, padding: 3, flexWrap: "wrap" }}>
            {STATUS_TABS.map((t) => {
              const isActive = statusFilter === t.value;
              const ct = t.value === "" ? projects.length : projects.filter((p) => p.status === t.value).length;
              return (
                <button
                  type="button"
                  key={t.value}
                  className="tab-pill"
                  onClick={() => setStatusFilter(t.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: isActive ? "#fff" : "transparent",
                    color: isActive ? "#0A0A0A" : "#8A8D94",
                    fontSize: 12.5, fontWeight: 600, font: "inherit",
                    boxShadow: isActive ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                    transition: "all .15s",
                  }}
                >
                  {t.label}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700,
                    color: isActive ? accent : "#B4B7BE",
                    background: isActive ? accent + "16" : "transparent",
                    padding: isActive ? "1px 6px" : "0", borderRadius: 6,
                  }}>{ct}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Icon name="search" size={14} color="#9CA3AF" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="srch-proj"
                style={{
                  paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                  border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 12.5,
                  color: "#0A0A0A", background: "#fff", boxSizing: "border-box",
                  transition: "all 0.15s", width: 200,
                }}
              />
            </div>
            {/* New project button */}
            <button
              type="button"
              onClick={openCreate}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: accent, color: "#fff", border: "none",
                padding: "9px 16px", borderRadius: 10, fontSize: 13,
                fontWeight: 600, cursor: "pointer",
                boxShadow: "0 1px 3px rgba(225,29,44,0.25)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#C41828")}
              onMouseLeave={(e) => (e.currentTarget.style.background = accent)}
            >
              <Plus size={15} /> New Project
            </button>
          </div>
        </div>

        {/* Project grid */}
        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div style={{ width: 34, height: 34, border: "3px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 14px", animation: "spin 0.7s linear infinite" }} />
            <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading projects…</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card pad={0}>
            <div style={{ padding: "72px 0", textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                <Icon name="folder" size={28} color="#D1D5DB" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#0A0A0A", margin: "0 0 6px" }}>
                {search || statusFilter ? "No projects found" : "No projects yet"}
              </p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 24px" }}>
                {search || statusFilter ? "Try adjusting your filters" : "Create your first project to start tracking profitability"}
              </p>
              {!search && !statusFilter && (
                <button type="button" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: accent, color: "white", border: "none", padding: "10px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <Plus size={15} /> New Project
                </button>
              )}
            </div>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px,1fr))", gap: 16, animation: "fadeUp 0.3s ease" }}>
            {filtered.map((p) => {
              const tone = toneFor(p.clientName || p.name);
              // Progress: use budget/billed ratio if no task data
              const budget  = p.budget || 0;
              const billed  = p.totalReceived || 0;
              const progress = budget > 0 ? Math.min(100, Math.round(billed / budget * 100)) : 0;
              const progressColor = p.status === "completed" ? "#22C55E"
                                  : p.status === "on_hold"   ? "#EF4444"
                                  : accent;
              const endDate = p.endDate ? p.endDate.split("T")[0] : null;

              return (
                <div
                  key={p.id}
                  className="proj-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open project ${p.name}`}
                  style={{ position: "relative", cursor: "pointer" }}
                  onClick={() => { window.location.href = `/projects/${p.id}`; }}
                  onKeyDown={(e) => { if (e.key === "Enter") window.location.href = `/projects/${p.id}`; }}
                >
                  <Card pad={20} hover>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        <Avatar name={p.clientName || p.name} tone={tone} size={44} radius={13} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 14.5, fontWeight: 700, color: "#0A0A0A", margin: "0 0 2px", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</p>
                          <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
                            {p.clientName || "No client"}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <ProjBadge status={p.status} />
                        {/* Edit/Delete actions */}
                        <div className="proj-card-act" style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => openEdit(p, e)}
                            title="Edit"
                            style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(p, e)}
                            title="Delete"
                            style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <span style={{ fontSize: 11.5, color: "#9CA3AF", fontWeight: 500 }}>
                          {budget > 0 ? `${formatINRk(billed)} billed` : "No budget set"}
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#0A0A0A" }}>{progress}%</span>
                      </div>
                      <div style={{ height: 6, background: "#F1F1F3", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: progressColor, borderRadius: 3, transition: "width .6s ease" }} />
                      </div>
                    </div>

                    {/* Footer: billed/budget + due date */}
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #F2F2F4" }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px" }}>Billed / Budget</p>
                        <p style={{ fontSize: 15, fontWeight: 750, color: "#0A0A0A", margin: 0 }}>
                          {formatINRk(billed)}{" "}
                          <span style={{ color: "#C9CCD4", fontWeight: 600 }}>/ {budget > 0 ? formatINRk(budget) : "–"}</span>
                        </p>
                      </div>
                      {endDate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Icon name="calendar" size={13} color="#B4B7BE" />
                          <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{formatDate(endDate)}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && createPortal(
        <div
          role="button" tabIndex={-1} aria-label="Close modal"
          onClick={() => setShowModal(false)}
          onKeyDown={(e) => e.key === "Enter" && setShowModal(false)}
          className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} className="sheet-card" style={{ background: "#FFF", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", animation: "slideUp 0.2s ease" }}>
            <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>
                {editingId ? "Edit Project" : "New Project"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={LBL}>Project Name *</label>
                  <input className="inp-f" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Website Redesign for Acme Corp" style={INP} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={LBL}>Client</label>
                    <CustomSelect value={form.clientId} onChange={v => setForm({ ...form, clientId: v })} placeholder="No client" options={[{ value: "", label: "No client" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} />
                  </div>
                  <div>
                    <label style={LBL}>Status</label>
                    <CustomSelect value={form.status} onChange={v => setForm({ ...form, status: v })} options={[{ value: "active", label: "Active" }, { value: "on_hold", label: "On Hold" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={LBL}>Start Date</label>
                    <DatePickerInput value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v || "" })} placeholder="Pick start date" />
                  </div>
                  <div>
                    <label style={LBL}>End Date</label>
                    <DatePickerInput value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v || "" })} placeholder="Pick end date" />
                  </div>
                </div>
                <div>
                  <label style={LBL}>Budget (₹)</label>
                  <input className="inp-f" type="number" step="1" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0" style={INP} />
                </div>
                <div>
                  <label style={LBL}>Notes</label>
                  <textarea className="inp-f" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Project description, scope, or any notes…" rows={3} style={{ ...INP, resize: "vertical", lineHeight: 1.5 }} />
                </div>
              </div>
              <div style={{ padding: "0 28px 24px", display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: saving ? "#E5E7EB" : accent, fontSize: 13, fontWeight: 700, color: saving ? "#9CA3AF" : "#FFF", cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}

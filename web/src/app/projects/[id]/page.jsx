import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { api } from "@/utils/api";
import { formatMoney, formatDate } from "@/utils/format";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DatePickerInput from "@/components/ui/DatePickerInput";
import Segmented from "@/components/ui/Segmented";
import { Card, MiniStat, Chip, StatusBadge, ghostBtn, thStyle, tdStyle } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import { Trash2, ChevronRight, Target, Activity, Upload, FileText, Plus, X, Download, Eye } from "lucide-react";
import useUpload from "@/utils/useUpload";
import { Progress } from "@/components/ui/progress";

const STATUS_CONFIG = {
  active:    { label: "Active",    color: "#059669", bg: "#D1FAE5", dot: "#10B981" },
  on_hold:   { label: "On Hold",   color: "#D97706", bg: "#FEF3C7", dot: "#F59E0B" },
  completed: { label: "Completed", color: "#2563EB", bg: "#EFF6FF", dot: "#3B82F6" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6", dot: "#9CA3AF" },
};

const INV_STATUS = {
  draft:          { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Draft" },
  saved:          { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Saved" },
  sent:           { bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B", label: "Sent" },
  partially_paid: { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", label: "Partial" },
  paid:           { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Paid" },
  overdue:        { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444", label: "Overdue" },
  cancelled:      { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Cancelled" },
};

const BILL_STATUS = {
  draft:          { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Draft" },
  approved:       { bg: "#F3F4F6", color: "#374151", dot: "#6B7280", label: "Approved" },
  partially_paid: { bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B", label: "Partial" },
  paid:           { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Paid" },
  cancelled:      { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Cancelled" },
};

function SmallBadge({ status, map }) {
  const s = (map[status] || { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: status });
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px 3px 7px", background: s.bg, borderRadius: 100,
      fontSize: 11, fontWeight: 650, color: s.color, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

function ProjBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px 4px 8px", background: s.bg, borderRadius: 100,
      fontSize: 11.5, fontWeight: 650, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

const INP = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB",
  borderRadius: 9, fontSize: 13, color: "#0A0A0A",
  background: "#FAFAFA", boxSizing: "border-box", outline: "none",
};
const LBL = { display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 5 };

const TABS = [
  { value: "overview",  label: "Overview"  },
  { value: "invoices",  label: "Invoices"  },
  { value: "expenses",  label: "Expenses"  },
  { value: "documents", label: "Documents & Contracts" },
  { value: "activity",  label: "Activity"  },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({});
  const [customers, setCustomers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  // Document states
  const [docs, setDocs] = useState([]);
  const [docForm, setDocForm] = useState({ documentName: "", documentType: "contract", documentUrl: "", objectKey: "" });
  const [docSaving, setDocSaving] = useState(false);
  const [upload, { loading: uploading }] = useUpload();

  useEffect(() => { loadProject(); }, [id]);
  useEffect(() => {
    api.get("/api/customers").then((d) => setCustomers(d.customers || [])).catch(() => {});
  }, []);

  async function loadProject() {
    setLoading(true);
    try {
      const d = await api.get(`/api/projects/${id}`);
      setData(d);
      setForm({
        name:      d.project.name,
        clientId:  d.project.clientId || "",
        status:    d.project.status,
        startDate: d.project.startDate ? d.project.startDate.split("T")[0] : "",
        endDate:   d.project.endDate   ? d.project.endDate.split("T")[0]   : "",
        budget:    d.project.budget || "",
        notes:     d.project.notes || "",
      });

      // Load linked documents
      const docsRes = await api.get(`/api/documents?entityType=project&entityId=${id}`);
      setDocs(docsRes.documents || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleUploadDoc(e) {
    if (e) e.preventDefault();
    if (!docForm.documentName.trim() || !docForm.documentUrl) return;
    setDocSaving(true);
    try {
      await api.post("/api/documents", {
        entityType: "project",
        entityId: parseInt(id),
        documentType: docForm.documentType,
        documentName: docForm.documentName.trim(),
        documentUrl: docForm.documentUrl,
        objectKey: docForm.objectKey,
      });
      // Reset form and re-fetch documents
      setDocForm({ documentName: "", documentType: "contract", documentUrl: "", objectKey: "" });
      const docsRes = await api.get(`/api/documents?entityType=project&entityId=${id}`);
      setDocs(docsRes.documents || []);
    } catch (err) {
      toast.error("Failed to save document: " + err.message);
    } finally {
      setDocSaving(false);
    }
  }

  function handleDeleteDoc(doc) {
    setConfirmState({
      title: "Delete Document",
      message: `Are you sure you want to delete "${doc.documentName}"? This will permanently remove the file from Cloudflare R2 storage.`,
      confirmLabel: "Delete Document",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/api/documents/${doc.id}`);
          const docsRes = await api.get(`/api/documents?entityType=project&entityId=${id}`);
          setDocs(docsRes.documents || []);
        } catch (err) {
          toast.error("Failed to delete document: " + err.message);
        }
      },
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/projects/${id}`, {
        name:      form.name,
        clientId:  form.clientId || null,
        status:    form.status,
        startDate: form.startDate || null,
        endDate:   form.endDate   || null,
        budget:    parseFloat(form.budget) || 0,
        notes:     form.notes || null,
      });
      setEditOpen(false);
      loadProject();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function handleDelete() {
    setConfirmState({
      title: "Delete Project",
      message: `Delete "${data.project.name}"? Linked invoices and bills won't be deleted — they'll just become unlinked.`,
      confirmLabel: "Delete Project",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/api/projects/${id}`);
        navigate("/projects");
      },
    });
  }

  if (loading) return (
    <AppShell>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    </AppShell>
  );

  if (!data) return (
    <AppShell>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#9CA3AF" }}>Project not found.</p>
      </div>
    </AppShell>
  );

  const { project, financials, invoices, bills, activity } = data;
  const budgetOver = financials.budgetUsed > 100;
  const margin = financials.totalInvoiced > 0
    ? Math.round((financials.netProfit / financials.totalInvoiced) * 100)
    : 0;

  const tabOptions = [
    { value: "overview", label: "Overview" },
    { value: "invoices", label: `Invoices (${invoices.length})` },
    { value: "expenses", label: `Expenses (${bills.length})` },
    { value: "documents", label: `Documents (${docs.length})` },
    { value: "activity", label: "Activity" },
  ];

  return (
    <AppShell>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <style>{`
        @keyframes spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .inp-f:focus { border-color: #E11D2C !important; box-shadow: 0 0 0 3px rgba(225,29,44,0.08) !important; }
        .tbl-row:hover { background: #FAFAFA !important; }
        .act-row:hover { background: #FAFAFA !important; }
      `}</style>

      {/* ── Breadcrumb + actions bar ── */}
      <div style={{ background: "#FFF", borderBottom: "1px solid #EEEEF0", padding: "0 28px", flexShrink: 0 }}>
        {/* Top row: breadcrumb + client */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0 11px", borderBottom: "1px solid #F2F2F4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => navigate("/projects")} style={{ ...ghostBtn, gap: 5, color: "#9CA3AF" }}>
              <Icon name="arrowLeft" size={14} /> Projects
            </button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: 0, letterSpacing: "-0.01em" }}>{project.name}</h1>
              <ProjBadge status={project.status} />
            </div>
          </div>
          {project.clientName && (
            <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
              <span style={{ color: "#9CA3AF" }}>Client: </span>
              <span style={{ fontWeight: 600, color: "#374151" }}>{project.clientName}</span>
            </p>
          )}
        </div>

        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 0" }}>
          {/* Mini financial summary */}
          <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
            {financials.totalInvoiced > 0 && (
              <div>
                <p style={{ fontSize: 10, color: "#A9ACB3", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 1px" }}>Revenue</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#059669", margin: 0 }}>{formatMoney(financials.totalReceived)}</p>
              </div>
            )}
            {financials.totalExpenses > 0 && (
              <div>
                <p style={{ fontSize: 10, color: "#A9ACB3", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 1px" }}>Expenses</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#E11D2C", margin: 0 }}>{formatMoney(financials.totalExpenses)}</p>
              </div>
            )}
            {(financials.totalInvoiced > 0 || financials.totalExpenses > 0) && (
              <div>
                <p style={{ fontSize: 10, color: "#A9ACB3", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", margin: "0 0 1px" }}>Net Profit</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: financials.netProfit >= 0 ? "#059669" : "#E11D2C", margin: 0 }}>{formatMoney(financials.netProfit)}</p>
              </div>
            )}
          </div>
          {/* Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setEditOpen(true)} style={{ ...ghostBtn }}>
              <Icon name="edit" size={13} /> Edit
            </button>
            <button type="button" onClick={handleDelete}
              style={{ ...ghostBtn, color: "#9CA3AF" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.color = "#E11D2C"; e.currentTarget.style.borderColor = "#FECACA"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#FFF"; e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.borderColor = "#ECECEE"; }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Segmented tab bar */}
        <div style={{ paddingBottom: 0, paddingTop: 10, display: "flex" }}>
          <div style={{ display: "flex", gap: 2 }}>
            {tabOptions.map((t) => (
              <button key={t.value} type="button" onClick={() => setActiveTab(t.value)} style={{
                padding: "9px 16px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: 13, fontWeight: 600, font: "inherit",
                borderBottom: activeTab === t.value ? "2px solid #E11D2C" : "2px solid transparent",
                color: activeTab === t.value ? "#E11D2C" : "#6B7280",
                transition: "color 0.12s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px" }}>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div style={{ animation: "fadeUp 0.3s ease", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Financial MiniStat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              <MiniStat
                label="Total Invoiced"
                value={formatMoney(financials.totalInvoiced)}
                icon="trendUp"
                tint="#059669"
                sub={`${formatMoney(financials.totalReceived)} collected`}
              />
              <MiniStat
                label="Total Expenses"
                value={formatMoney(financials.totalExpenses)}
                icon="trendDown"
                tint="#E11D2C"
                sub={`${formatMoney(financials.totalPaidOut)} paid out`}
              />
              <MiniStat
                label="Net Profit"
                value={formatMoney(financials.netProfit)}
                icon="dollar"
                tint={financials.netProfit >= 0 ? "#059669" : "#E11D2C"}
                sub={financials.totalInvoiced > 0 ? `${margin}% margin` : "No revenue yet"}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <MiniStat
                label="Outstanding Receivables"
                value={formatMoney(financials.outstandingAR)}
                icon="alert"
                tint={financials.outstandingAR > 0 ? "#D97706" : "#059669"}
                sub={financials.outstandingAR > 0 ? "Pending from client" : "All collected ✓"}
              />
              <MiniStat
                label="Outstanding Payables"
                value={formatMoney(financials.outstandingAP)}
                icon="alert"
                tint={financials.outstandingAP > 0 ? "#D97706" : "#059669"}
                sub={financials.outstandingAP > 0 ? "Pending to vendors" : "All paid ✓"}
              />
            </div>

            {/* Budget tracker */}
            {financials.budget > 0 && (
              <Card pad={20}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Target size={16} color="#6B7280" />
                    <p style={{ fontSize: 13, fontWeight: 650, color: "#374151", margin: 0 }}>Budget Tracker</p>
                  </div>
                  <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                    <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Budget: <strong style={{ color: "#0A0A0A" }}>{formatMoney(financials.budget)}</strong></p>
                    <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>Used: <strong style={{ color: budgetOver ? "#E11D2C" : "#0A0A0A" }}>{formatMoney(financials.totalExpenses)}</strong></p>
                    <Chip tone={budgetOver ? "#E11D2C" : "#059669"} bg={budgetOver ? "#FEE2E2" : "#DCFCE7"}>{financials.budgetUsed}%</Chip>
                  </div>
                </div>
                <Progress
                  value={Math.min(financials.budgetUsed, 100)}
                  style={{ height: 8, background: "#F2F2F4", borderRadius: 999 }}
                  indicatorStyle={{ background: budgetOver ? "#E11D2C" : financials.budgetUsed > 80 ? "#F59E0B" : "#059669", borderRadius: 999 }}
                />
                {budgetOver && (
                  <p style={{ fontSize: 12, color: "#E11D2C", marginTop: 8, fontWeight: 500 }}>Budget exceeded by {formatMoney(financials.totalExpenses - financials.budget)}</p>
                )}
              </Card>
            )}

            {/* Project details */}
            <Card pad={20}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#A9ACB3", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 16px" }}>Project Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {project.clientName && (
                  <div>
                    <p style={{ fontSize: 11, color: "#A9ACB3", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Client</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>{project.clientName}</p>
                    {project.clientEmail && <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>{project.clientEmail}</p>}
                  </div>
                )}
                {project.startDate && (
                  <div>
                    <p style={{ fontSize: 11, color: "#A9ACB3", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Timeline</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>
                      {formatDate(project.startDate)} → {project.endDate ? formatDate(project.endDate) : "Ongoing"}
                    </p>
                  </div>
                )}
                <div>
                  <p style={{ fontSize: 11, color: "#A9ACB3", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Linked Records</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>
                    {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} · {bills.length} expense{bills.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              {project.notes && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #F2F2F4" }}>
                  <p style={{ fontSize: 11, color: "#A9ACB3", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>Notes</p>
                  <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.6 }}>{project.notes}</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* INVOICES */}
        {activeTab === "invoices" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <Card pad={0} style={{ overflow: "hidden" }}>
              {invoices.length === 0 ? (
                <div style={{ padding: "64px 0", textAlign: "center" }}>
                  <Icon name="file" size={32} color="#D1D5DB" />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF", margin: "12px 0 4px" }}>No invoices linked</p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: 0 }}>Link invoices from the invoice editor</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F2F2F4", background: "#FAFAFA" }}>
                      {[["Invoice #","left"],["Date","left"],["Amount","right"],["Paid","right"],["Balance","right"],["Status","center"],["","right"]].map(([h, a]) => (
                        <th key={h} style={{ ...thStyle, textAlign: a }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv.id} className="tbl-row"
                        style={{ borderBottom: i < invoices.length - 1 ? "1px solid #F2F2F4" : "none", transition: "background 0.1s" }}>
                        <td style={tdStyle}>
                          <a href={`/invoices/${inv.id}`} style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", textDecoration: "none" }}>{inv.invoiceNumber}</a>
                          {inv.customerName && <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>{inv.customerName}</p>}
                        </td>
                        <td style={tdStyle}><span style={{ fontSize: 12.5, color: "#9CA3AF" }}>{formatDate(inv.invoiceDate)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}><span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{formatMoney(inv.grandTotal)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}><span style={{ fontSize: 12.5, color: inv.totalPaid > 0 ? "#059669" : "#9CA3AF", fontWeight: inv.totalPaid > 0 ? 600 : 400 }}>{formatMoney(inv.totalPaid)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}><span style={{ fontSize: 12.5, color: inv.balanceDue > 0 ? "#E11D2C" : "#9CA3AF", fontWeight: inv.balanceDue > 0 ? 600 : 400 }}>{formatMoney(inv.balanceDue)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "center" }}><SmallBadge status={inv.status} map={INV_STATUS} /></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <a href={`/invoices/${inv.id}`} style={{ width: 28, height: 28, borderRadius: 7, background: "#F9FAFB", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textDecoration: "none" }}>
                            <ChevronRight size={14} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #F2F2F4", background: "#FAFAFA" }}>
                      <td colSpan={2} style={{ ...tdStyle, fontWeight: 700, color: "#374151" }}>Total</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#0A0A0A" }}>{formatMoney(financials.totalInvoiced)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#059669" }}>{formatMoney(financials.totalReceived)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: financials.outstandingAR > 0 ? "#E11D2C" : "#9CA3AF" }}>{formatMoney(financials.outstandingAR)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </Card>
          </div>
        )}

        {/* EXPENSES */}
        {activeTab === "expenses" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <Card pad={0} style={{ overflow: "hidden" }}>
              {bills.length === 0 ? (
                <div style={{ padding: "64px 0", textAlign: "center" }}>
                  <Icon name="receipt" size={32} color="#D1D5DB" />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF", margin: "12px 0 4px" }}>No expenses linked</p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: 0 }}>Link expenses from the Payables section</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F2F2F4", background: "#FAFAFA" }}>
                      {[["Expense","left"],["Category","left"],["Date","left"],["Amount","right"],["Paid","right"],["Unpaid","right"],["Status","center"],["","right"]].map(([h, a]) => (
                        <th key={h} style={{ ...thStyle, textAlign: a }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b, i) => (
                      <tr key={b.id} className="tbl-row"
                        style={{ borderBottom: i < bills.length - 1 ? "1px solid #F2F2F4" : "none", transition: "background 0.1s" }}>
                        <td style={tdStyle}>
                          <a href={`/payables/${b.id}`} style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", textDecoration: "none" }}>{b.title}</a>
                          {(b.vendorName || b.employeeName) && <p style={{ fontSize: 11, color: "#9CA3AF", margin: "1px 0 0" }}>{b.vendorName || b.employeeName}</p>}
                        </td>
                        <td style={tdStyle}><span style={{ fontSize: 12.5, color: "#6B7280", textTransform: "capitalize" }}>{b.category || "—"}</span></td>
                        <td style={tdStyle}><span style={{ fontSize: 12.5, color: "#9CA3AF" }}>{formatDate(b.billDate)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}><span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{formatMoney(b.amount)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}><span style={{ fontSize: 12.5, color: b.amountPaid > 0 ? "#059669" : "#9CA3AF" }}>{formatMoney(b.amountPaid)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}><span style={{ fontSize: 12.5, color: b.balanceDue > 0 ? "#E11D2C" : "#9CA3AF" }}>{formatMoney(b.balanceDue)}</span></td>
                        <td style={{ ...tdStyle, textAlign: "center" }}><SmallBadge status={b.status} map={BILL_STATUS} /></td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <a href={`/payables/${b.id}`} style={{ width: 28, height: 28, borderRadius: 7, background: "#F9FAFB", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", textDecoration: "none" }}>
                            <ChevronRight size={14} />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: "2px solid #F2F2F4", background: "#FAFAFA" }}>
                      <td colSpan={3} style={{ ...tdStyle, fontWeight: 700, color: "#374151" }}>Total</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#0A0A0A" }}>{formatMoney(financials.totalExpenses)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: "#059669" }}>{formatMoney(financials.totalPaidOut)}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: financials.outstandingAP > 0 ? "#E11D2C" : "#9CA3AF" }}>{formatMoney(financials.outstandingAP)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </Card>
          </div>
        )}

        {/* DOCUMENTS & CONTRACTS */}
        {activeTab === "documents" && (
          <div style={{ animation: "fadeUp 0.3s ease", display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
            
            {/* Documents List */}
            <Card pad={0} style={{ overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F2F2F4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Documents & Contracts</h3>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{docs.length} uploaded</span>
              </div>
              
              {docs.length === 0 ? (
                <div style={{ padding: "64px 0", textAlign: "center" }}>
                  <FileText size={36} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF", margin: "0 0 4px" }}>No documents found</p>
                  <p style={{ fontSize: 12, color: "#D1D5DB", margin: 0 }}>Upload contracts, quotations, or POs for this project</p>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #F2F2F4", background: "#FAFAFA" }}>
                      {[["Name","left"],["Type","left"],["Uploaded On","left"],["","right"]].map(([h, a]) => (
                        <th key={h} style={{ ...thStyle, textAlign: a }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc, i) => {
                      const typeColors = {
                        contract: { color: "#E11D2C", bg: "#FEE2E2", label: "Contract" },
                        quotation: { color: "#059669", bg: "#DCFCE7", label: "Quotation" },
                        purchase_order: { color: "#2563EB", bg: "#EFF6FF", label: "PO" },
                        attachment: { color: "#4B5563", bg: "#F3F4F6", label: "Attachment" }
                      };
                      const s = typeColors[doc.documentType] || typeColors.attachment;

                      return (
                        <tr key={doc.id} className="tbl-row" style={{ borderBottom: i < docs.length - 1 ? "1px solid #F2F2F4" : "none" }}>
                          <td style={tdStyle}>
                            <a href={doc.documentUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", textDecoration: "none" }}>
                              {doc.documentName}
                            </a>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", background: s.bg, color: s.color, borderRadius: 100, fontSize: 11, fontWeight: 650 }}>
                              {s.label}
                            </span>
                          </td>
                          <td style={tdStyle}><span style={{ fontSize: 12.5, color: "#9CA3AF" }}>{formatDate(doc.createdAt)}</span></td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6 }}>
                              <a href={doc.documentUrl} target="_blank" rel="noreferrer" style={{ ...ghostBtn, padding: "5px 8px" }} title="Preview">
                                <Eye size={12} />
                              </a>
                              <a href={doc.documentUrl} download style={{ ...ghostBtn, padding: "5px 8px" }} title="Download">
                                <Download size={12} />
                              </a>
                              <button type="button" onClick={() => handleDeleteDoc(doc)} style={{ ...ghostBtn, padding: "5px 8px", color: "#EF4444" }} title="Delete">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Document Uploader Panel */}
            <Card pad={20}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 16px" }}>Upload Document</h3>
              <form onSubmit={handleUploadDoc} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={LBL}>Document Type *</label>
                  <CustomSelect value={docForm.documentType} onChange={v => setDocForm(f => ({ ...f, documentType: v }))} options={[{ value: "contract", label: "Contract / Agreement" }, { value: "quotation", label: "Quotation / Proposal" }, { value: "purchase_order", label: "Purchase Order (PO)" }, { value: "attachment", label: "Other Attachment" }]} />
                </div>
                <div>
                  <label style={LBL}>Document Name *</label>
                  <input className="inp-f" type="text" required placeholder="e.g. Service Agreement V1" value={docForm.documentName} onChange={e => setDocForm(f => ({ ...f, documentName: e.target.value }))} style={INP} />
                </div>
                <div>
                  <label style={LBL}>File (PDF or Image) *</label>
                  {docForm.documentUrl ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: 10 }}>
                      <span style={{ fontSize: 12, color: "#E11D2C", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>✓ File Selected</span>
                      <button type="button" onClick={() => setDocForm(f => ({ ...f, documentUrl: "", objectKey: "" }))} style={{ background: "transparent", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Remove</button>
                    </div>
                  ) : (
                    <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", border: "2px dashed #D1D5DB", borderRadius: 10, cursor: uploading ? "not-allowed" : "pointer", background: "#FAFAFA" }}>
                      <input type="file" accept="application/pdf,image/*"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            if (!docForm.documentName) {
                              // Auto-fill document name with file name (without extension)
                              const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf("."));
                              setDocForm(f => ({ ...f, documentName: nameWithoutExt }));
                            }
                            const res = await upload({ file });
                            if (res.error) {
                              toast.error(res.error);
                            } else if (res.url) {
                              setDocForm(f => ({ ...f, documentUrl: res.url, objectKey: res.objectKey || "" }));
                            }
                          } catch (err) { toast.error("Upload failed: " + err.message); }
                        }}
                        disabled={uploading} style={{ display: "none" }} />
                      <Upload size={15} color="#9CA3AF" />
                      <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 500 }}>{uploading ? "Uploading..." : "Select File"}</span>
                    </label>
                  )}
                </div>
                <button type="submit" disabled={uploading || docSaving || !docForm.documentUrl}
                  style={{ width: "100%", padding: 11, background: "#0A0A0A", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 650, cursor: (uploading || docSaving || !docForm.documentUrl) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 8 }}>
                  <Plus size={14} /> Add to Project
                </button>
              </form>
            </Card>

          </div>
        )}

        {/* ACTIVITY */}
        {activeTab === "activity" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {activity.length === 0 ? (
              <Card pad={48} style={{ textAlign: "center" }}>
                <Activity size={32} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#9CA3AF" }}>No activity yet</p>
              </Card>
            ) : (
              <Card pad={0} style={{ overflow: "hidden" }}>
                {activity.map((item, i) => {
                  const isInvoice = item.type === "invoice";
                  return (
                    <div key={`${item.type}-${item.id}`} className="act-row"
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: i < activity.length - 1 ? "1px solid #F2F2F4" : "none", transition: "background 0.1s" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: isInvoice ? "#EFF6FF" : "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={isInvoice ? "file" : "receipt"} size={16} color={isInvoice ? "#2563EB" : "#E11D2C"} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <a href={`/${isInvoice ? "invoices" : "payables"}/${item.id}`} style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", textDecoration: "none" }}>{item.label}</a>
                          <SmallBadge status={item.status} map={isInvoice ? INV_STATUS : BILL_STATUS} />
                        </div>
                        <p style={{ fontSize: 12, color: "#9CA3AF", margin: "2px 0 0" }}>
                          {item.entity} · {isInvoice ? "Invoice" : (item.category || "Expense")}
                        </p>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: isInvoice ? "#059669" : "#E11D2C", margin: 0 }}>
                          {isInvoice ? "+" : "-"}{formatMoney(item.amount)}
                        </p>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0" }}>{formatDate(item.date)}</p>
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editOpen && createPortal(
        <div
          role="button" tabIndex={-1} aria-label="Close modal"
          onClick={() => setEditOpen(false)}
          onKeyDown={(e) => e.key === "Enter" && setEditOpen(false)}
          className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()}
            className="sheet-card" style={{ background: "#FFF", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", animation: "slideUp 0.2s ease" }}>
            <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #F2F2F4", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Edit Project</h2>
              <button type="button" onClick={() => setEditOpen(false)} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", fontSize: 20 }}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={LBL}>Project Name *</label>
                  <input className="inp-f" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={INP} />
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
                  <input className="inp-f" type="number" step="1" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} style={INP} />
                </div>
                <div>
                  <label style={LBL}>Notes</label>
                  <textarea className="inp-f" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} style={{ ...INP, resize: "vertical", lineHeight: 1.5 }} />
                </div>
              </div>
              <div style={{ padding: "0 28px 24px", display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setEditOpen(false)} style={{ ...ghostBtn, flex: 1, justifyContent: "center" }}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: saving ? "#E5E7EB" : "#E11D2C", fontSize: 13, fontWeight: 700, color: saving ? "#9CA3AF" : "#FFF", cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving…" : "Save Changes"}
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


"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import { useAuth } from "@/utils/auth";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DatePickerInput from "@/components/ui/DatePickerInput";

import { Card, Chip, ghostBtn, thStyle, tdStyle } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import { formatMoney, formatDate, CURRENCY_SYMBOLS } from "@/utils/format.js";
import { ArrowLeft, Edit, MoreHorizontal, FileText, Upload, Plus, FileImage, Eye, Download, X, Trash2 } from "lucide-react";
import useUpload from "@/utils/useUpload";

const CAT_LABELS = {
  travel: "Travel", petrol: "Petrol", marketing: "Marketing",
  software: "Software", salary: "Salary", freelancer: "Freelancer",
  freelancer_payout: "Freelancer Payout", subscription: "Subscription",
  utility: "Utility", equipment: "Equipment", internet: "Internet",
  food: "Food", other: "Other",
};

const CAT_TONES = {
  marketing: "#E11D2C", salary: "#E11D2C", freelancer: "#E11D2C",
  freelancer_payout: "#2563EB", subscription: "#D97706",
};

const BILL_STATUS = {
  draft:          { bg: "#F3F4F6", color: "#374151", label: "Draft" },
  pending:        { bg: "#FEF3C7", color: "#B45309", label: "Pending Approval" },
  rejected:       { bg: "#FEE2E2", color: "#B91C1C", label: "Rejected" },
  approved:       { bg: "#EFF6FF", color: "#1D4ED8", label: "Approved · Due" },
  partially_paid: { bg: "#FEF3C7", color: "#B45309", label: "Partial" },
  paid:           { bg: "#DCFCE7", color: "#15803D", label: "Paid" },
  cancelled:      { bg: "#F3F4F6", color: "#6B7280", label: "Cancelled" },
};

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi",           label: "UPI" },
  { value: "cash",          label: "Cash" },
  { value: "cheque",        label: "Cheque" },
  { value: "card",          label: "Card" },
];

const EMPTY_PAY = {
  amount: "", paymentDate: new Date().toISOString().split("T")[0],
  paymentMethod: "bank_transfer", referenceNumber: "", notes: "", receiptUrl: "",
};

const inp = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB",
  borderRadius: 9, fontSize: 13, color: "#0A0A0A", background: "#FAFAFA",
  boxSizing: "border-box", outline: "none",
};

function StatusBadge({ status }) {
  const s = BILL_STATUS[status] || BILL_STATUS.draft;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 10px", background: s.bg, borderRadius: 100,
      fontSize: 11, fontWeight: 700, color: s.color, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

function getDaysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = now - due;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}


// ── Modal Shell ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, width = 560 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open || typeof window === "undefined") return null;
  return createPortal(
    <div
      role="button" tabIndex={-1} aria-label="Close modal"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Enter" && onClose()}
      className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()}
        className="sheet-card" style={{ background: "#FFF", borderRadius: 20, width: "100%", maxWidth: width, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", animation: "slideUp 0.2s ease", overflow: "hidden" }}>
        <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FFF", zIndex: 10, flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function BillDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [upload, { loading: uploading }] = useUpload();
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachViewer, setAttachViewer] = useState(false);
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState(EMPTY_PAY);
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payReceiptUploading, setPayReceiptUploading] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  useEffect(() => { loadBill(); }, [id]);

  async function reviewBill(action) {
    if (action === "reject") {
      setConfirmState({
        title: "Reject expense",
        message: "This expense will be marked rejected and the submitter notified. Optionally add a reason.",
        confirmLabel: "Reject expense",
        danger: true,
        withInput: true,
        inputPlaceholder: "Reason (optional)",
        onConfirm: async (reason) => {
          await api.post(`/api/bills/${id}/review`, { action: "reject", reason: reason || null });
          loadBill();
        },
      });
      return;
    }
    setReviewing(true);
    try {
      await api.post(`/api/bills/${id}/review`, { action: "approve" });
      loadBill();
    } catch (err) {
      toast.error("Approval failed: " + err.message);
    } finally { setReviewing(false); }
  }

  
  function openEdit() {
    setEditForm({
      title: bill.title || "",
      amount: bill.amount || 0,
      description: bill.description || "",
      dueDate: bill.dueDate ? bill.dueDate.split("T")[0] : "",
    });
    setEditModal(true);
  }

  async function handleEditSave() {
    if (!editForm.title || !editForm.amount) return toast.error("Title and Amount are required.");
    setSaving(true);
    try {
      const res = await api.put(`/api/bills/${id}`, editForm);
      if (res.error) throw new Error(res.error);
      setBill(res.bill);
      setEditModal(false);
    } catch (err) {
      toast.error("Failed to update: " + err.message);
    } finally {
      setSaving(false);
    }
  }
  async function loadBill() {
    setLoading(true);
    try {
      const data = await api.get(`/api/bills/${id}`);
      setBill(data);
      setPayForm((p) => ({ ...p, amount: String(data.amountDue || "") }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handlePayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error("Valid amount required"); return; }
    setPaying(true);
    try {
      const payload = {
        amount: parseFloat(payForm.amount),
        paymentDate: payForm.paymentDate,
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber || null,
        notes: payForm.notes || null,
        receiptUrl: payForm.receiptUrl || null,
      };
      if (editPaymentId) await api.put(`/api/bills/${id}/payments/${editPaymentId}`, payload);
      else await api.post(`/api/bills/${id}/payments`, payload);
      setPayModal(false);
      setPayForm(EMPTY_PAY);
      setEditPaymentId(null);
      loadBill();
    } catch (err) { toast.error(err.message); }
    finally { setPaying(false); }
  }

  function handleEditPayment(p) {
    setEditPaymentId(p.id);
    setPayForm({
      amount: String(p.amount || ""),
      paymentDate: p.paymentDate ? p.paymentDate.split("T")[0] : new Date().toISOString().split("T")[0],
      paymentMethod: p.paymentMethod || "bank_transfer",
      referenceNumber: p.referenceNumber || "",
      notes: p.notes || "",
      receiptUrl: p.receiptUrl || "",
    });
    setPayModal(true);
  }

  function handleDeletePayment(p) {
    setConfirmState({
      title: "Delete Payment",
      message: `Remove ${formatMoney(p.amount, bill.currency)} payment from ${formatDate(p.paymentDate)}? Bill status will be recalculated.`,
      confirmLabel: "Delete Payment",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/bills/${id}/payments/${p.id}`); loadBill(); }
        catch (err) { toast.error(err.message); }
      },
    });
  }

  if (loading) {
    return (
      <AppShell>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      </AppShell>
    );
  }

  if (!bill) {
    return (
      <AppShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
          <Icon name="receipt" size={48} color="#E5E7EB" />
          <p style={{ fontSize: 16, color: "#9CA3AF" }}>Bill not found</p>
          <button type="button" onClick={() => navigate("/payables")} style={{ padding: "10px 20px", background: "#E11D2C", border: "none", borderRadius: 10, color: "#FFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Back to Payables
          </button>
        </div>
      </AppShell>
    );
  }

  const catLabel = CAT_LABELS[bill.category] || bill.category || "Other";
  const catTone  = CAT_TONES[bill.category]  || "#6B7280";
  const pct = bill.netPayable > 0 ? Math.min(100, (bill.amountPaid / bill.netPayable) * 100) : 0;
  
  const daysOverdue = getDaysOverdue(bill.dueDate);
  const isOverdue = bill.status !== "paid" && bill.status !== "cancelled" && daysOverdue > 0;
  const canPay = !["paid", "cancelled", "pending", "rejected", "draft"].includes(bill.status);
  const isPending = bill.status === "pending";

  return (
    <AppShell>
      <style>{`
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .pay-inp:focus { border-color: #E11D2C !important; background: #FFF !important; box-shadow: 0 0 0 3px rgba(225,29,44,0.08) !important; outline: none !important; }
        .pm-row:hover { background: #FAFAFA !important; }
        .pay-pill.active { background: #FEF2F2 !important; border-color: #E11D2C !important; color: #E11D2C !important; font-weight: 650 !important; }
      `}</style>

      {/* Main Container */}
      <div style={{ flex: 1, overflowY: "auto", padding: "30px 40px", animation: "fadeUp 0.25s ease" }}>
        
        {/* ── Top Action Bar ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => navigate("/payables")}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", padding: 0, fontSize: 13, fontWeight: 500, color: "#6B7280", cursor: "pointer" }}
          >
            <ArrowLeft size={16} /> Back to expenses
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isPending && isSuperAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => reviewBill("reject")}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF", color: "#B91C1C", border: "1px solid #FCA5A5", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => reviewBill("approve")}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#16A34A", color: "#FFF", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: reviewing ? "not-allowed" : "pointer", opacity: reviewing ? 0.7 : 1 }}
                >
                  {reviewing ? "Approving…" : "Approve expense"}
                </button>
              </>
            )}
            {isPending && !isSuperAdmin && (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#B45309", background: "#FEF3C7", padding: "8px 14px", borderRadius: 8 }}>
                Awaiting superadmin approval
              </span>
            )}
            {canPay && (
              <button
                type="button"
                onClick={() => { setEditPaymentId(null); setPayForm({ ...EMPTY_PAY, amount: String(bill.amountDue || ""), paymentDate: new Date().toISOString().split("T")[0] }); setPayModal(true); }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#E11D2C", color: "#FFF", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <FileText size={14} /> Record Payment
              </button>
            )}
          </div>
        </div>

        {/* ── Header Title Area ── */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em" }}>{bill.billNumber}</h1>
            <StatusBadge status={bill.status} />
            {isOverdue && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEE2E2", padding: "4px 10px", borderRadius: 100 }}>Overdue</span>
            )}
          </div>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
            Created on {formatDate(bill.billDate)} <span style={{ margin: "0 6px" }}>•</span> Due on {formatDate(bill.dueDate)} 
            {isOverdue && <span style={{ color: "#DC2626", fontWeight: 600 }}> ({daysOverdue} days overdue)</span>}
          </p>
        </div>

        {/* ── Main Two Column Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
          
          {/* LEFT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
            
            {/* Expense Details Card */}
            <Card pad={24} style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="receipt" size={20} color="#E11D2C" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{bill.title}</h2>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", background: "#F3F4F6", padding: "3px 8px", borderRadius: 6 }}>{catLabel}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>{bill.description || "—"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/payables?edit=${bill.id}`)}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF", border: "1px solid #E5E7EB", color: "#374151", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  <Edit size={12} /> Edit Expense
                </button>
              </div>

              {/* Grid 3x3 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px 16px", marginBottom: 24 }}>
                {[
                  ["Vendor",  bill.vendorName || bill.payee || bill.employeeName || "—"],
                  ["Project",         bill.project || "—"],
                  ["Reference #",     bill.referenceNumber || "—"],
                  ["Bill date",       formatDate(bill.billDate)],
                  ["Due date",        formatDate(bill.dueDate)],
                  ["Tax",             bill.tax > 0 ? formatMoney(bill.tax, bill.currency) : "—"],
                  ["Category",        catLabel],
                  ["Payment terms",   "Net 30"], // Example hardcoded or dynamic if available
                  ["Created by",      "System Admin"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 4px" }}>{label}</p>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#0A0A0A", margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {bill.notes && (
                <div style={{ padding: "16px", background: "#F9FAFB", borderRadius: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", margin: "0 0 6px" }}>Notes</p>
                  <p style={{ fontSize: 13, color: "#374151", margin: 0, lineHeight: 1.5 }}>{bill.notes}</p>
                </div>
              )}
            </Card>

            {/* Payment History Card */}
            <Card pad={0} style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #F3F4F6" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Payment History</h3>
                <span style={{ fontSize: 12, color: "#6B7280", background: "#F3F4F6", padding: "4px 10px", borderRadius: 100, fontWeight: 500 }}>{(bill.payments || []).length} payment{(bill.payments || []).length !== 1 ? "s" : ""}</span>
              </div>
              
              {(bill.payments || []).length === 0 ? (
                <div style={{ padding: "40px 24px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No payments recorded yet</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{...thStyle, padding: "12px 24px", background: "#FFF", borderBottom: "1px solid #F3F4F6"}}>Date</th>
                        <th style={{...thStyle, padding: "12px 24px", background: "#FFF", borderBottom: "1px solid #F3F4F6"}}>Method</th>
                        <th style={{...thStyle, padding: "12px 24px", background: "#FFF", borderBottom: "1px solid #F3F4F6"}}>Reference</th>
                        <th style={{...thStyle, padding: "12px 24px", background: "#FFF", borderBottom: "1px solid #F3F4F6"}}>Amount</th>
                        <th style={{...thStyle, padding: "12px 24px", background: "#FFF", borderBottom: "1px solid #F3F4F6"}}>Status</th>
                        <th style={{...thStyle, padding: "12px 24px", background: "#FFF", borderBottom: "1px solid #F3F4F6", width: 40}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(bill.payments || []).map((p, i) => {
                        const method = PAYMENT_METHODS.find((m) => m.value === p.paymentMethod) || PAYMENT_METHODS[0];
                        return (
                          <tr key={p.id} className="pm-row" style={{ borderBottom: i < (bill.payments || []).length - 1 ? "1px solid #F3F4F6" : "none" }}>
                            <td style={{...tdStyle, padding: "16px 24px", color: "#0A0A0A"}}>{formatDate(p.paymentDate)}</td>
                            <td style={{...tdStyle, padding: "16px 24px", color: "#374151"}}>{method.label}</td>
                            <td style={{...tdStyle, padding: "16px 24px", color: "#6B7280"}}>{p.referenceNumber || "—"}</td>
                            <td style={{...tdStyle, padding: "16px 24px", color: "#15803D", fontWeight: 600}}>{formatMoney(p.amount, bill.currency)}</td>
                            <td style={{...tdStyle, padding: "16px 24px"}}><StatusBadge status="paid" /></td>
                            <td style={{...tdStyle, padding: "16px 24px", textAlign: "right"}}>
                              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <button onClick={() => handleEditPayment(p)} title="Edit payment" style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeletePayment(p)} title="Delete payment" style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div style={{ padding: "12px 24px", textAlign: "center", borderTop: "1px solid #F3F4F6" }}>
                    <button style={{ background: "transparent", border: "none", color: "#E11D2C", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      View all payments →
                    </button>
                  </div>
                </div>
              )}

            </Card>

            {/* Attachments */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Attachments ({bill.receiptUrl ? 1 : 0})</h3>
              {!bill.receiptUrl && (
                <label style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#E11D2C", fontSize: 13, fontWeight: 600, cursor: attachUploading ? "not-allowed" : "pointer", opacity: attachUploading ? 0.6 : 1 }}>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.docx,.xlsx"
                    style={{ display: "none" }}
                    disabled={attachUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAttachUploading(true);
                      try {
                        const { url, objectKey } = await upload(file);
                        await api.put(`/api/bills/${id}`, { receiptUrl: url, receiptObjectKey: objectKey });
                        setBill(prev => ({ ...prev, receiptUrl: url, receiptObjectKey: objectKey }));
                        toast.success("Attachment uploaded");
                      } catch (err) {
                        toast.error(err?.message || "Upload failed");
                      } finally {
                        setAttachUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  <Upload size={14} /> {attachUploading ? "Uploading…" : "Upload attachment"}
                </label>
              )}
            </div>

            {bill.receiptUrl && (() => {
              const rawName = bill.receiptUrl.split("/").pop().split("?")[0];
              const ext = rawName.split(".").pop().toLowerCase();
              const isPdf = ext === "pdf";
              const isDoc = ["docx", "xlsx"].includes(ext);
              const isImage = ["jpg", "jpeg", "png", "webp"].includes(ext);
              const viewerKind = isPdf ? "pdf" : isImage ? "image" : "file";
              const iconColor = isPdf ? "#DC2626" : isDoc ? "#2563EB" : "#DC2626";

              const actBtn = {
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: 8, border: "1px solid #ECECEE",
                background: "#fff", cursor: "pointer", padding: 0,
              };

              async function handleDownload() {
                try {
                  const res = await fetch(bill.receiptUrl);
                  if (!res.ok) throw new Error();
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = rawName;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(a.href);
                } catch {
                  window.open(bill.receiptUrl, "_blank", "noopener");
                }
              }

              return (
                <>
                  {/* Row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid #EFEFF1", background: "#fff" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: isPdf ? "#FEE2E2" : isDoc ? "#DBEAFE" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <FileImage size={16} color={iconColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rawName}</p>
                      <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: 0 }}>{ext.toUpperCase()} · uploaded</p>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button type="button" title="View" style={actBtn} onClick={() => setAttachViewer(true)}>
                        <Eye size={14} color="#6B7280" />
                      </button>
                      <button type="button" title="Download" style={actBtn} onClick={handleDownload}>
                        <Download size={14} color="#6B7280" />
                      </button>
                      <button
                        type="button"
                        title="Remove"
                        style={{ ...actBtn, borderColor: "#FCDADA" }}
                        onClick={() => {
                          setConfirmState({
                            title: "Remove Attachment",
                            message: "This will permanently delete the attached file. This cannot be undone.",
                            confirmLabel: "Remove",
                            danger: true,
                            onConfirm: async () => {
                              try {
                                if (bill.receiptObjectKey) {
                                  await api.deleteWithBody(`/api/upload`, { objectKey: bill.receiptObjectKey });
                                }
                                await api.put(`/api/bills/${id}`, { receiptUrl: null, receiptObjectKey: null });
                                setBill(prev => ({ ...prev, receiptUrl: null, receiptObjectKey: null }));
                                toast.success("Attachment removed");
                              } catch (err) {
                                toast.error(err?.message || "Failed to remove attachment");
                              }
                            },
                          });
                        }}
                      >
                        <X size={14} color="#E11D2C" />
                      </button>
                    </div>
                  </div>

                  {/* In-app viewer modal */}
                  {attachViewer && typeof document !== "undefined" && createPortal(
                    <div
                      onClick={() => setAttachViewer(false)}
                      style={{
                        position: "fixed", inset: 0, zIndex: 300,
                        background: "rgba(10,10,10,.55)",
                        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                      }}
                    >
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: "#fff", borderRadius: 20, overflow: "hidden",
                          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
                          width: "min(920px, 96vw)", height: "min(86vh, 900px)",
                          display: "flex", flexDirection: "column",
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid #EFEFF1" }}>
                          <FileText size={16} color="#6B7280" />
                          <p style={{ fontSize: 13.5, fontWeight: 650, color: "#0A0A0A", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {rawName}
                          </p>
                          <button type="button" title="Download" style={actBtn} onClick={handleDownload}>
                            <Download size={14} color="#6B7280" />
                          </button>
                          <button type="button" title="Close" style={actBtn} onClick={() => setAttachViewer(false)}>
                            <X size={14} color="#6B7280" />
                          </button>
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, background: "#F5F5F6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto" }}>
                          {viewerKind === "pdf" ? (
                            <iframe title={rawName} src={bill.receiptUrl} style={{ width: "100%", height: "100%", border: "none" }} />
                          ) : viewerKind === "image" ? (
                            <img src={bill.receiptUrl} alt={rawName} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                          ) : (
                            <div style={{ textAlign: "center", color: "#6B7280", padding: 30 }}>
                              <FileImage size={30} color="#C9CCD4" />
                              <p style={{ fontSize: 13.5, fontWeight: 600, margin: "12px 0 4px" }}>No in-app preview for this file type</p>
                              <p style={{ fontSize: 12.5, margin: "0 0 14px" }}>Download it to view in the right application.</p>
                              <button
                                type="button"
                                onClick={handleDownload}
                                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "#E11D2C", color: "#fff", fontSize: 12.5, fontWeight: 650, cursor: "pointer" }}
                              >
                                Download
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              );
            })()}


          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Summary */}
            <Card pad={24} style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", borderRadius: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: "0 0 20px" }}>Summary</h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Total bill</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A", textAlign: "right" }}>
                    {formatMoney(bill.amount, bill.currency)}
                    {bill.foreignCurrency && (
                      <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}>{formatMoney(bill.foreignAmount, bill.foreignCurrency)} @ ₹{Number(bill.exchangeRate).toFixed(2)}</span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Paid</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#15803D" }}>{formatMoney(bill.amountPaid, bill.currency)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Tax</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{bill.tax > 0 ? formatMoney(bill.tax, bill.currency) : "—"}</span>
                </div>

                {bill.tdsAmount > 0 && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#6B7280" }}>TDS ({bill.tdsSection} @ {bill.tdsRate}%)</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#DC2626" }}>-{formatMoney(bill.tdsAmount, bill.currency)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#6B7280" }}>Net payable</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{formatMoney(bill.netPayable, bill.currency)}</span>
                    </div>
                  </>
                )}

                <div style={{ margin: "4px 0", height: 1, background: "#F3F4F6" }} />
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Balance due</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: bill.amountDue > 0 ? "#E11D2C" : "#15803D", letterSpacing: "-0.02em" }}>{formatMoney(bill.amountDue, bill.currency)}</span>
                </div>

                {bill.status !== "cancelled" && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>Payment progress</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pct >= 100 ? "#15803D" : "#E11D2C" }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: "#F3F4F6", borderRadius: 999 }}>
                      <div style={{ height: "100%", borderRadius: 999, background: pct >= 100 ? "#22C55E" : "#E11D2C", width: `${pct}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Payment Details */}
            <Card pad={24} style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 2px rgba(0,0,0,0.02)", borderRadius: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: "0 0 20px" }}>Payment details</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Currency</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{bill.currency}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Payment terms</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>Net 30</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#6B7280" }}>Due date</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>{formatDate(bill.dueDate)}</span>
                </div>
              </div>
            </Card>

            

          </div>
        </div>
      </div>

      
      
      {/* ── Edit Bill Drawer ── */}
      
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Expense">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Title *</label>
            <input className="pay-inp" value={editForm.title || ""} onChange={e => setEditForm({ ...editForm, title: e.target.value })} style={inp} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Amount ({bill?.currency}) *</label>
            <input className="pay-inp" type="number" value={editForm.amount || ""} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} style={inp} />
          </div>
          <DatePickerInput label="Due Date" value={editForm.dueDate || ""} onChange={v => setEditForm({ ...editForm, dueDate: v })} />
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Description / Notes</label>
            <textarea className="pay-inp" value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ ...inp, minHeight: 80, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setEditModal(false)} style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "12px", fontSize: 13 }}>Cancel</button>
            <button type="button" onClick={handleEditSave} disabled={saving}
              style={{ flex: 2, padding: "12px", background: "#E11D2C", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>



      {/* ── Payment Drawer ── */}
      
      <Modal open={payModal} onClose={() => { setPayModal(false); setEditPaymentId(null); }} title={editPaymentId ? "Edit Payment" : "Record Payment"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "14px 16px" }}>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Balance Due</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: "#E11D2C", margin: 0 }}>{formatMoney(bill.amountDue, bill.currency)}</p>
          </div>
          <div>
            <label htmlFor="pay-amount" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Amount ({CURRENCY_SYMBOLS[bill.currency] || bill.currency}) *</label>
            <input id="pay-amount" className="pay-inp" type="number" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={inp} />
          </div>
          <DatePickerInput label="Payment Date" value={payForm.paymentDate} onChange={(v) => setPayForm((p) => ({ ...p, paymentDate: v }))} placeholder="Select date" />
          <div>
            <label id="pay-method-label" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Payment Method</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {PAYMENT_METHODS.map(({ value, label }) => (
                <button key={value} type="button"
                  className={`pay-pill${payForm.paymentMethod === value ? " active" : ""}`}
                  onClick={() => setPayForm((p) => ({ ...p, paymentMethod: value }))}
                  style={{ padding: "6px 12px", border: "1.5px solid #EEEEF0", borderRadius: 8, background: "#FFF", fontSize: 12, color: "#374151", cursor: "pointer", font: "inherit", fontWeight: 500 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="pay-ref" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Reference / UTR</label>
            <input id="pay-ref" className="pay-inp" value={payForm.referenceNumber} onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))} placeholder="Transaction ID, cheque no..." style={inp} />
          </div>
          <div>
            <label id="pay-receipt-label" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Attach Receipt (PDF or image)</label>
            {payForm.receiptUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 10 }}>
                <Icon name="file" size={14} color="#16A34A" />
                <a href={payForm.receiptUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#15803D", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline" }}>
                  Receipt uploaded — View
                </a>
                <button type="button" onClick={() => setPayForm((p) => ({ ...p, receiptUrl: "" }))}
                  style={{ background: "transparent", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0, flexShrink: 0 }}>
                  Remove
                </button>
              </div>
            ) : (
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", border: "2px dashed #D1D5DB", borderRadius: 10, cursor: payReceiptUploading ? "not-allowed" : "pointer", background: "#FAFAFA", transition: "border 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "#E11D2C"} onMouseLeave={e => e.currentTarget.style.borderColor = "#D1D5DB"}>
                <input type="file" accept="application/pdf,image/*"
                  disabled={payReceiptUploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPayReceiptUploading(true);
                    try {
                      const res = await upload({ file });
                      if (res.error) { toast.error(res.error); }
                      else if (res.url) { setPayForm((p) => ({ ...p, receiptUrl: res.url })); }
                    } catch (err) { toast.error("Upload failed: " + err.message); }
                    finally { setPayReceiptUploading(false); e.target.value = ""; }
                  }}
                  style={{ display: "none" }} />
                <Upload size={16} color="#9CA3AF" />
                <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>
                  {payReceiptUploading ? "Uploading..." : "Upload receipt (PDF or image)"}
                </span>
              </label>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => { setPayModal(false); setEditPaymentId(null); }} style={{ ...ghostBtn, flex: 1, justifyContent: "center", padding: "12px", fontSize: 13 }}>Cancel</button>
            <button type="button" onClick={handlePayment} disabled={paying || payReceiptUploading}
              style={{ flex: 2, padding: "12px", background: "#E11D2C", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: (paying || payReceiptUploading) ? "not-allowed" : "pointer", opacity: (paying || payReceiptUploading) ? 0.7 : 1 }}>
              {paying ? "Saving..." : editPaymentId ? "Save Changes" : "Record Payment"}
            </button>
          </div>
        </div>
      </Modal>


      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </AppShell>
  );
}

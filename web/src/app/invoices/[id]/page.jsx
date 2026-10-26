import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import InvoiceDocument from "@/components/InvoiceDocument";
import Segmented from "@/components/ui/Segmented";
import { api } from "@/utils/api";
import {
  Edit,
  Copy,
  Eye,
  Trash2,
  Download,
  ArrowLeft,
  CheckCircle,
  Send,
  AlertTriangle,
  IndianRupee,
  History,
  Upload,
  Check,
  FileText,
  ChevronDown,
} from "lucide-react";
import { formatMoney, formatDate } from "@/utils/format";
import useUpload from "@/utils/useUpload";
import CustomSelect from "@/components/ui/CustomSelect";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { ButtonGroup } from "@/components/ui/button-group";
import { Spinner } from "@/components/ui/spinner";

const modalLabelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 5,
};
const modalInpStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 9,
  fontSize: 13,
  color: "#0A0A0A",
  background: "#FAFAFA",
  boxSizing: "border-box",
};
const ghostBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 13px",
  borderRadius: 10,
  border: "1px solid #ECECEE",
  background: "#fff",
  color: "#4B5563",
  fontSize: 12.5,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const ddItem = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "9px 14px",
  background: "transparent",
  border: "none",
  fontSize: 13,
  fontWeight: 500,
  color: "#374151",
  textAlign: "left",
  cursor: "pointer",
  fontFamily: "inherit",
};

const STATUS_STYLE = {
  draft:          { color: "#9CA3AF", label: "Draft" },
  saved:          { color: "#3B82F6", label: "Saved" },
  sent:           { color: "#F59E0B", label: "Sent" },
  partially_paid: { color: "#6366F1", label: "Partially Paid" },
  paid:           { color: "#10B981", label: "Paid" },
  overdue:        { color: "#EF4444", label: "Overdue" },
  cancelled:      { color: "#D1D5DB", label: "Cancelled" },
};

const TEMPLATE_OPTIONS = [
  { value: "modern",  label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
];

// Map between templateId integer (stored in DB) and template name string
const ID_TO_TEMPLATE = { 1: "modern", 2: "minimal", 3: "classic" };
const TEMPLATE_TO_ID = { modern: 1, minimal: 2, classic: 3 };

const CN_REASONS = [
  { value: "01", label: "01 — Sales Return" },
  { value: "02", label: "02 — Post-Sale Discount" },
  { value: "03", label: "03 — Deficiency in Service" },
  { value: "04", label: "04 — Correction in Invoice" },
  { value: "05", label: "05 — Change in POS" },
  { value: "06", label: "06 — Finalization of Provisional Assessment" },
  { value: "07", label: "07 — Others" },
];

const INV_TDS_SECTIONS = [
  { value: "194C", label: "194C — Contractor" },
  { value: "194J", label: "194J — Professional fees" },
  { value: "194J-T", label: "194J — Technical (2%)" },
  { value: "194H", label: "194H — Commission" },
  { value: "194I", label: "194I — Rent (land/bldg)" },
  { value: "194Q", label: "194Q — Purchase of goods" },
];

export default function InvoiceViewPage({ params }) {
  const id = params?.id;
  const [invoice, setInvoice] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(null);
  const [templateId, setTemplateId] = useState(null);   // integer persisted to DB
  const [templateName, setTemplateName] = useState("modern"); // string passed to InvoiceDocument
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [modal, setModal] = useState(null); // null | 'send-confirm' | 'send-success' | 'no-email' | 'record-payment'
  const [deleteModal, setDeleteModal] = useState(null); // null | 'invoice' | 'payment'
  const [pendingDeletePaymentId, setPendingDeletePaymentId] = useState(null);

  // Payment form states
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payments, setPayments] = useState([]);
  const [payReceiptUrl, setPayReceiptUrl] = useState("");
  const [payReceiptObjectKey, setPayReceiptObjectKey] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [upload, { loading: uploading }] = useUpload();

  // Credit note + refund states
  const [cnReason, setCnReason] = useState("01");
  const [cnDate, setCnDate] = useState(new Date().toISOString().split("T")[0]);
  const [cnAmount, setCnAmount] = useState("");
  const [refundCnId, setRefundCnId] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDate, setRefundDate] = useState(new Date().toISOString().split("T")[0]);
  const [refundMethod, setRefundMethod] = useState("bank_transfer");
  const [refundRef, setRefundRef] = useState("");
  const [tdsSection, setTdsSection] = useState("194J");
  const [tdsRate, setTdsRate] = useState("10");

  // Invoice attachments states
  const [invoiceDocs, setInvoiceDocs] = useState([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState("attachment");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocKey, setNewDocKey] = useState("");
  const [docSaving, setDocSaving] = useState(false);

  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!actionsOpen) return;
    function onOutside(e) {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [actionsOpen]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/invoices/${id}`),
      api.get("/api/settings/company"),
      api.get(`/api/documents?entityType=invoice&entityId=${id}`),
    ])
      .then(([invData, compData, docsData]) => {
        setInvoice(invData.invoice);
        setCustomer(invData.customer);
        setItems(invData.items || []);
        setCompany(compData);
        setPayments(invData.payments || []);
        setInvoiceDocs(docsData.documents || []);
        setPayAmount((invData.invoice.grandTotal - (invData.invoice.totalPaid || 0)).toString());
        const tid = invData.invoice.templateId || 1;
        setTemplateId(tid);
        setTemplateName(ID_TO_TEMPLATE[tid] || "modern");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddInvoiceDoc(e) {
    if (e) e.preventDefault();
    if (!newDocName.trim() || !newDocUrl) return;
    setDocSaving(true);
    try {
      await api.post("/api/documents", {
        entityType: "invoice",
        entityId: parseInt(id),
        documentType: newDocType,
        documentName: newDocName.trim(),
        documentUrl: newDocUrl,
        objectKey: newDocKey,
      });
      setNewDocName("");
      setNewDocUrl("");
      setNewDocKey("");
      setShowDocUpload(false);
      const docsRes = await api.get(`/api/documents?entityType=invoice&entityId=${id}`);
      setInvoiceDocs(docsRes.documents || []);
    } catch (err) {
      toast.error("Failed to save attachment: " + err.message);
    } finally {
      setDocSaving(false);
    }
  }

  async function handleDeleteInvoiceDoc(docId) {
    if (!confirm("Are you sure you want to delete this attachment? This will permanently delete the file from Cloudflare R2.")) return;
    try {
      await api.delete(`/api/documents/${docId}`);
      const docsRes = await api.get(`/api/documents?entityType=invoice&entityId=${id}`);
      setInvoiceDocs(docsRes.documents || []);
    } catch (err) {
      toast.error("Failed to delete attachment: " + err.message);
    }
  }

  async function handleTemplateChange(name) {
    const numId = TEMPLATE_TO_ID[name] || 1;
    setTemplateName(name);
    setTemplateId(numId);
    try {
      await api.put(`/api/invoices/${id}`, { templateId: numId });
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  }

  async function handleDuplicate() {
    try {
      const data = await api.post(`/api/invoices/${id}/duplicate`, {});
      if (typeof window !== "undefined")
        window.location.href = `/invoices/${data.id}/edit`;
    } catch (err) {
      toast.error("Duplicate failed: " + err.message);
    }
  }

  async function confirmDeleteInvoice() {
    setDeleteModal(null);
    try {
      await api.delete(`/api/invoices/${id}`);
      if (typeof window !== "undefined") window.location.href = "/invoices";
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    }
  }

  async function handleStatusChange(status) {
    setUpdating(true);
    try {
      await api.put(`/api/invoices/${id}`, { status });
      setInvoice((inv) => ({ ...inv, status }));
    } catch (err) {
      toast.error("Failed: " + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function handleRecordPayment(e) {
    if (e) e.preventDefault();
    const amtNum = parseFloat(payAmount);
    if (!payAmount || isNaN(amtNum) || amtNum <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    setUpdating(true);
    try {
      if (editingPaymentId) {
        await api.put(`/api/payments/${editingPaymentId}`, {
          amount: amtNum,
          paymentDate: payDate,
          paymentMethod: payMethod,
          referenceNumber: payRef,
          notes: payNotes,
          receiptUrl: payReceiptUrl,
          receiptObjectKey: payReceiptObjectKey,
        });
      } else {
        await api.post(`/api/invoices/${id}/payments`, {
          amount: amtNum,
          paymentDate: payDate,
          paymentMethod: payMethod,
          referenceNumber: payRef,
          notes: payNotes,
          receiptUrl: payReceiptUrl,
          receiptObjectKey: payReceiptObjectKey,
        });
      }

      // Re-fetch updated details
      const invRes = await api.get(`/api/invoices/${id}`);
      setInvoice(invRes.invoice);
      setPayments(invRes.payments || []);
      setPayAmount((invRes.invoice.grandTotal - (invRes.invoice.totalPaid || 0)).toString());
      setPayRef("");
      setPayNotes("");
      setPayReceiptUrl("");
      setPayReceiptObjectKey("");
      setEditingPaymentId(null);
      setModal(null);
    } catch (err) {
      toast.error("Failed to record payment: " + err.message);
    } finally {
      setUpdating(false);
    }
  }

  async function confirmDeletePayment() {
    if (!pendingDeletePaymentId) return;
    setDeleteModal(null);
    setUpdating(true);
    try {
      await api.delete(`/api/payments/${pendingDeletePaymentId}`);
      const invRes = await api.get(`/api/invoices/${id}`);
      setInvoice(invRes.invoice);
      setPayments(invRes.payments || []);
      setPayAmount((invRes.invoice.grandTotal - (invRes.invoice.totalPaid || 0)).toString());
    } catch (err) {
      toast.error("Failed to delete payment: " + err.message);
    } finally {
      setUpdating(false);
      setPendingDeletePaymentId(null);
    }
  }

  async function reloadInvoice() {
    const d = await api.get(`/api/invoices/${id}`);
    setInvoice(d.invoice);
    setPayments(d.payments || []);
    setItems(d.items || []);
  }

  async function submitCreditNote(e) {
    e.preventDefault();
    const taxable = parseFloat(cnAmount);
    if (!taxable || taxable <= 0) { toast.error("Enter a credit amount (taxable value)"); return; }
    const r2 = (n) => Math.round((n || 0) * 100) / 100;
    const baseTaxable = parseFloat(invoice.taxableAmount) || 0;
    const ratio = baseTaxable > 0 ? taxable / baseTaxable : 0;
    const cg = r2((parseFloat(invoice.cgstAmount) || 0) * ratio);
    const sg = r2((parseFloat(invoice.sgstAmount) || 0) * ratio);
    const ig = r2((parseFloat(invoice.igstAmount) || 0) * ratio);
    const tax = r2(cg + sg + ig);
    setUpdating(true);
    try {
      const res = await api.post("/api/credit-notes", {
        invoiceId: Number(id), creditNoteDate: cnDate, reasonCode: cnReason,
        items: [{ itemName: `Credit against ${invoice.invoiceNumber}`, taxableValue: r2(taxable), cgstAmount: cg, sgstAmount: sg, igstAmount: ig, totalTax: tax, lineTotal: r2(taxable + tax), quantity: 1, rate: r2(taxable), gstRate: 0 }],
        status: "issued",
      });
      toast.success(`Credit note ${res.creditNoteNumber} issued`);
      setModal(null); setCnAmount("");
      await reloadInvoice();
    } catch (err) {
      toast.error(err.message || "Failed to issue credit note");
    } finally { setUpdating(false); }
  }

  async function submitRefund(e) {
    e.preventDefault();
    const amt = parseFloat(refundAmount);
    if (!amt || amt <= 0) { toast.error("Enter a refund amount"); return; }
    setUpdating(true);
    try {
      await api.post(`/api/credit-notes/${refundCnId}/refunds`, { amount: amt, refundDate, method: refundMethod, referenceNumber: refundRef });
      toast.success("Refund recorded");
      setModal(null); setRefundCnId(null); setRefundAmount("");
      await reloadInvoice();
    } catch (err) {
      toast.error(err.message || "Failed to record refund");
    } finally { setUpdating(false); }
  }

  async function cancelCreditNote(cnId) {
    try {
      await api.delete(`/api/credit-notes/${cnId}`);
      toast.success("Credit note cancelled");
      await reloadInvoice();
    } catch (err) { toast.error(err.message || "Failed to cancel credit note"); }
  }

  async function submitInvoiceTds(e) {
    e.preventDefault();
    setUpdating(true);
    try {
      await api.post(`/api/invoices/${id}/tds`, { tdsSection, tdsRate: parseFloat(tdsRate) || 0 });
      toast.success("TDS recorded");
      setModal(null);
      await reloadInvoice();
    } catch (err) {
      toast.error(err.message || "Failed to record TDS");
    } finally { setUpdating(false); }
  }

  function handleSendEmail() {
    if (!customer?.email) { setModal("no-email"); return; }
    setModal("send-confirm");
  }

  async function confirmSend() {
    setModal(null);
    setSending(true);
    try {
      await api.post(`/api/invoices/${id}/send`, {});
      setInvoice((inv) => ({ ...inv, status: "sent" }));
      setModal("send-success");
    } catch (err) {
      toast.error("Send failed: " + err.message);
    } finally {
      setSending(false);
    }
  }

  // Downloads the Puppeteer-rendered A4 PDF — the same document the email attaches.
  // Browser print dialogs can't produce it reliably (mobile Safari clips it to the viewport).
  async function handleDownloadPDF() {
    if (typeof window === "undefined" || downloadingPDF) return;
    setDownloadingPDF(true);
    try {
      const token = localStorage.getItem("modus_auth_token");
      const res = await fetch(`/api/invoices/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

      const clientSlug = (buyer?.companyName || buyer?.name || "Client")
        .trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clientSlug}-${invoice?.invoiceNumber || "Invoice"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      toast.error("PDF download failed: " + err.message);
    } finally {
      setDownloadingPDF(false);
    }
  }

  const seller = { ...(invoice?.snapshotSeller || company || {}), lutNumber: (invoice?.snapshotSeller?.lutNumber ?? company?.lutNumber ?? null) };
  const snapshotBuyer = invoice?.snapshotBuyer;
  const buyer = (snapshotBuyer && Object.keys(snapshotBuyer).length > 0) ? snapshotBuyer : (customer || {});

  // Responsive preview: scale the fixed 210mm document down to fit its column so
  // it never clips at 100% zoom. Print/PDF clones the un-scaled .modus-invoice-doc.
  const previewOuterRef = useRef(null);
  const previewInnerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewBoxH, setPreviewBoxH] = useState("auto");
  useEffect(() => {
    function update() {
      const outer = previewOuterRef.current;
      const inner = previewInnerRef.current;
      if (!outer || !inner) return;
      const docW = inner.offsetWidth || 794; // 210mm @96dpi
      const s = Math.min(1, outer.clientWidth / docW);
      setPreviewScale(s);
      setPreviewBoxH(`${inner.offsetHeight * s}px`);
    }
    update();
    const ro = new ResizeObserver(update);
    if (previewOuterRef.current) ro.observe(previewOuterRef.current);
    if (previewInnerRef.current) ro.observe(previewInnerRef.current);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [invoice, templateName, items]);

  const activityItems = useMemo(() => {
    const items = [];
    if (invoice) {
      items.push({ label: "Invoice created", time: formatDate(invoice.createdAt || invoice.invoiceDate), done: true });
      if (["sent", "partially_paid", "paid", "overdue"].includes(invoice.status)) {
        items.push({ label: `Sent to ${customer?.name || "client"}`, time: invoice.sentAt ? formatDate(invoice.sentAt) : "—", done: true });
      }
      payments.forEach((p) => {
        items.push({ label: `Payment · ${formatMoney(p.amount)}`, time: formatDate(p.paymentDate), done: true });
      });
      items.push({ label: "Payment due", time: formatDate(invoice.dueDate), done: invoice.status === "paid" });
    }
    return items;
  }, [invoice, payments, customer]);

  return (
    <AppShell>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* A4 print setup */
        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          #invoice-printable, #invoice-printable * {
            visibility: visible !important;
          }
          #invoice-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            max-width: none !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          /* Undo the on-screen preview scale-to-fit transform so print/PDF uses full size */
          #invoice-printable > div {
            transform: none !important;
          }
          /* The InvoiceDocument root must not clip or force extra height in print */
          #invoice-printable .modus-invoice-doc {
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            min-height: 0 !important;
          }
          .no-print { display: none !important; }
        }

        @media (max-width: 900px) {
          .modus-doc-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Loading */}
      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, border: "3px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      )}

      {/* Not found */}
      {!loading && !invoice && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#9CA3AF" }}>Invoice not found.</p>
        </div>
      )}

      {/* Main content */}
      {!loading && invoice && (
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 30px 30px" }}>
          {/* ── Action bar ── */}
          <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 0 16px", flexWrap: "wrap" }}>
            <Breadcrumb>
              <BreadcrumbList style={{ flexWrap: "nowrap" }}>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="/invoices"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#9CA3AF", fontWeight: 500, textDecoration: "none" }}
                  >
                    <ArrowLeft size={13} />
                    Receivables
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator style={{ color: "#D1D5DB" }} />
                <BreadcrumbItem>
                  <BreadcrumbPage style={{ fontSize: 13, fontWeight: 650, color: "#0A0A0A" }}>
                    {invoice.invoiceNumber}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <Segmented
                value={templateName}
                onChange={handleTemplateChange}
                options={TEMPLATE_OPTIONS} />
              <ButtonGroup>
                <button type="button" onClick={handleSendEmail} style={{ ...ghostBtn, borderRadius: "10px 0 0 10px" }} disabled={sending}>
                  {sending ? <Spinner style={{ width: 13, height: 13 }} /> : <Send size={13} />} {sending ? "Sending…" : "Send"}
                </button>
                <a href={`/invoices/${id}/edit`} style={{ ...ghostBtn, textDecoration: "none", borderRadius: 0, borderLeft: "none" }}>
                  <Edit size={13} /> Edit
                </a>
                <button type="button" onClick={handleDownloadPDF} disabled={downloadingPDF} style={{ ...ghostBtn, borderRadius: 0, borderLeft: "none" }}>
                  <Download size={13} /> {downloadingPDF ? "Preparing…" : "PDF"}
                </button>
                <div style={{ position: "relative" }} ref={actionsRef}>
                  <button type="button" onClick={() => setActionsOpen((o) => !o)} style={{ ...ghostBtn, borderRadius: "0 10px 10px 0", borderLeft: "none", height: "100%" }}>
                    <ChevronDown size={13} style={{ transform: actionsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /> More
                  </button>
                {actionsOpen && (
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1px solid #EEEEF0", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 175, zIndex: 50, padding: "6px 0", overflow: "hidden", animation: "fadeUp 0.15s ease" }}>
                    <button
                      type="button"
                      onClick={() => { setActionsOpen(false); handleDuplicate(); }}
                      style={ddItem}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <Copy size={14} color="#6B7280" /> Duplicate Invoice
                    </button>
                    <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }} />
                    <button
                      type="button"
                      onClick={() => { setActionsOpen(false); setDeleteModal("invoice"); }}
                      style={{ ...ddItem, color: "#DC2626" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#FEE2E2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <Trash2 size={14} /> Delete Invoice
                    </button>
                  </div>
                )}
                </div>
              </ButtonGroup>
            </div>
          </div>

          {/* ── Main 2-col grid ── */}
          <div className="modus-doc-layout" style={{ display: "grid", gridTemplateColumns: "1fr 296px", gap: 18, alignItems: "start" }}>
            {/* Invoice document */}
            <div id="invoice-printable" ref={previewOuterRef} style={{ overflow: "hidden", height: previewBoxH }}>
              <div ref={previewInnerRef} style={{ width: "210mm", transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                  <InvoiceDocument
                    invoice={invoice}
                    customer={buyer}
                    items={items}
                    seller={seller}
                    template={templateName}
                    mode="screen" />
              </div>
            </div>

            {/* Right rail */}
            <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 8 }}>
              {/* Status + amount card */}
              <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>Status</span>
                  {(() => {
                    const s = STATUS_STYLE[invoice.status] || STATUS_STYLE.draft;
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px 4px 8px", background: s.color + "18", borderRadius: 100, fontSize: 11.5, fontWeight: 650, color: s.color }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                        {s.label}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ background: "#FAFAFB", borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "0 0 4px" }}>Balance due</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px", letterSpacing: "-0.02em" }}>
                    {formatMoney(Math.max(0, invoice.balanceDue ?? (invoice.grandTotal - (invoice.totalPaid || 0))))}
                  </p>
                  {(invoice.creditedTotal || 0) > 0 && (
                    <p style={{ fontSize: 11.5, color: "#6D28D9", margin: "0 0 2px", fontWeight: 600 }}>Credited {formatMoney(invoice.creditedTotal)}</p>
                  )}
                  {(invoice.tdsReceivable || 0) > 0 && (
                    <p style={{ fontSize: 11.5, color: "#0369A1", margin: "0 0 2px", fontWeight: 600 }}>TDS deducted {formatMoney(invoice.tdsReceivable)}</p>
                  )}
                  {invoice.status === "credited" && (
                    <p style={{ fontSize: 11.5, color: "#6D28D9", margin: 0, fontWeight: 600 }}>Fully credited ✓</p>
                  )}
                  {invoice.status === "paid" && (
                    <p style={{ fontSize: 11.5, color: "#10B981", margin: 0, fontWeight: 600 }}>Paid in full ✓</p>
                  )}
                  {invoice.status !== "paid" && invoice.dueDate && (
                    <p style={{ fontSize: 11.5, color: "#E11D2C", margin: 0, fontWeight: 600 }}>Due {formatDate(invoice.dueDate)}</p>
                  )}
                </div>
                {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayAmount(Math.max(0, invoice.grandTotal - (invoice.totalPaid || 0)).toString());
                      setModal("record-payment");
                    }}
                    style={{ width: "100%", padding: 11, background: "#0A0A0A", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 650, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <IndianRupee size={14} /> Record Payment
                  </button>
                )}
                {invoice.status !== "draft" && invoice.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => { setCnAmount(""); setCnReason("01"); setCnDate(new Date().toISOString().split("T")[0]); setModal("issue-cn"); }}
                    style={{ width: "100%", marginTop: 8, padding: 10, background: "#FFF", color: "#6D28D9", border: "1.5px solid #DDD6FE", borderRadius: 10, fontSize: 12.5, fontWeight: 650, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    Issue Credit Note
                  </button>
                )}
                {invoice.status !== "draft" && invoice.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => { setTdsSection(invoice.tdsSection || "194J"); setTdsRate(invoice.tdsRate ? String(invoice.tdsRate) : "10"); setModal("record-tds"); }}
                    style={{ width: "100%", marginTop: 8, padding: 10, background: "#FFF", color: "#0369A1", border: "1.5px solid #BAE6FD", borderRadius: 10, fontSize: 12.5, fontWeight: 650, fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    {(invoice.tdsReceivable || 0) > 0 ? "Edit TDS deducted" : "Record TDS deducted"}
                  </button>
                )}
              </div>

              {/* Credit notes */}
              {(invoice.creditNotes && invoice.creditNotes.length > 0) && (
                <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px" }}>Credit notes</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {invoice.creditNotes.map((cn) => (
                      <div key={cn.id} style={{ padding: "10px 12px", background: "#FAFAFA", border: "1px solid #EBEBEB", borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#6D28D9" }}>{cn.creditNoteNumber}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{formatMoney(cn.totalAmount)}</span>
                        </div>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 8px" }}>{formatDate(cn.creditNoteDate)}{cn.reasonCode ? ` · reason ${cn.reasonCode}` : ""}</p>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => { setRefundCnId(cn.id); setRefundAmount(""); setRefundDate(new Date().toISOString().split("T")[0]); setRefundMethod("bank_transfer"); setRefundRef(""); setModal("record-refund"); }} style={{ flex: 1, padding: "6px 8px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#FFF", fontSize: 11.5, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Record Refund</button>
                          <button type="button" onClick={() => cancelCreditNote(cn.id)} style={{ padding: "6px 8px", border: "1px solid #FECACA", borderRadius: 8, background: "#FFF", fontSize: 11.5, fontWeight: 600, color: "#DC2626", cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity timeline */}
              <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 16px" }}>Activity</p>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {activityItems.map((item, i) => (
                    <div key={item.label} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: i < activityItems.length - 1 ? 18 : 0 }}>
                      {i < activityItems.length - 1 && (
                        <div style={{ position: "absolute", left: 13, top: 28, bottom: 0, width: 2, background: "#F1F1F3" }} />
                      )}
                      <div style={{ width: 27, height: 27, borderRadius: 9, flexShrink: 0, background: item.done ? "#E11D2C16" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, fontSize: 10, color: item.done ? "#E11D2C" : "#9CA3AF" }}>
                        {item.done ? "✓" : "○"}
                      </div>
                      <div style={{ paddingTop: 2, flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: item.done ? "#0A0A0A" : "#9CA3AF", margin: "0 0 1px" }}>{item.label}</p>
                        <p style={{ fontSize: 11, color: "#A9ACB3", margin: 0 }}>{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment history with edit/delete */}
              {payments.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <History size={15} color="#4F46E5" />
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Payment history</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {payments.map((p) => (
                      <div key={p.id} style={{ padding: "10px 12px", background: "#FAFAFA", border: "1px solid #EBEBEB", borderRadius: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>{formatMoney(p.amount)}</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPaymentId(p.id);
                                setPayAmount(p.amount.toString());
                                const fd = p.paymentDate ? p.paymentDate.split("T")[0] : new Date().toISOString().split("T")[0];
                                setPayDate(fd);
                                setPayMethod(p.paymentMethod || "bank_transfer");
                                setPayRef(p.referenceNumber || "");
                                setPayNotes(p.notes || "");
                                setPayReceiptUrl(p.receiptUrl || "");
                                setPayReceiptObjectKey(p.receiptObjectKey || "");
                                setModal("record-payment");
                              }}
                              style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.color = "#2563EB"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
                              title="Edit payment">
                              <Edit size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPendingDeletePaymentId(p.id); setDeleteModal("payment"); }}
                              style={{ width: 26, height: 26, borderRadius: 6, border: "none", background: "transparent", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
                              title="Delete payment">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: 11, color: "#9CA3AF", margin: "3px 0 0" }}>
                          {formatDate(p.paymentDate)} · {p.paymentMethod?.replace(/_/g, " ")}
                          {p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                        </p>
                        {p.receiptUrl && (
                          <a href={p.receiptUrl} target="_blank" rel="noreferrer"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#4F46E5", textDecoration: "none", fontWeight: 600, marginTop: 4 }}>
                            <FileText size={11} /> View Receipt
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {invoice.notes && (
                <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Notes</p>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>{invoice.notes}</p>
                </div>
              )}

              {/* Attachments & Documents Card */}
              <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Attachments ({invoiceDocs.length})</p>
                  <button type="button" onClick={() => setShowDocUpload(!showDocUpload)} style={{ background: "transparent", border: "none", color: "#E11D2C", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    {showDocUpload ? "Cancel" : "+ Add"}
                  </button>
                </div>

                {showDocUpload && (
                  <form onSubmit={handleAddInvoiceDoc} style={{ display: "flex", flexDirection: "column", gap: 10, background: "#FAFAFA", padding: 12, borderRadius: 10, marginBottom: 14, border: "1px dashed #E5E7EB" }}>
                    <div>
                      <label style={modalLabelStyle}>Attachment Type</label>
                      <CustomSelect
                        value={newDocType}
                        onChange={setNewDocType}
                        options={[
                          { value: "attachment", label: "Other Attachment" },
                          { value: "quotation", label: "Quotation / Proposal" },
                          { value: "purchase_order", label: "Purchase Order (PO)" },
                          { value: "contract", label: "Contract / Agreement" },
                        ]}
                      />
                    </div>
                    <div>
                      <label htmlFor="doc-name" style={modalLabelStyle}>Attachment Name *</label>
                      <input
                        id="doc-name"
                        type="text"
                        required
                        placeholder="e.g. Approved Quotation"
                        value={newDocName}
                        onChange={e => setNewDocName(e.target.value)}
                        className="modal-inp"
                        style={modalInpStyle}
                      />
                    </div>
                    <div>
                      <label id="doc-file-label" style={modalLabelStyle}>File (PDF or Image) *</label>
                      {newDocUrl ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#059669", fontWeight: 600 }}>
                          <span>✓ File Selected</span>
                          <button type="button" onClick={() => { setNewDocUrl(""); setNewDocKey(""); }} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>Remove</button>
                        </div>
                      ) : (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: "#EEF2FF", border: "1.5px dashed #4F46E5", borderRadius: 8, fontSize: 11, fontWeight: 650, color: "#4F46E5", cursor: uploading ? "not-allowed" : "pointer" }}>
                          <Upload size={12} />
                          {uploading ? "Uploading..." : "Select File"}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!newDocName) {
                                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf("."));
                                setNewDocName(nameWithoutExt);
                              }
                              const res = await upload({ file });
                              if (res.error) toast.error(res.error);
                              else if (res.url) {
                                setNewDocUrl(res.url);
                                setNewDocKey(res.objectKey || "");
                              }
                            }}
                            style={{ display: "none" }}
                            disabled={uploading}
                          />
                        </label>
                      )}
                    </div>
                    <button type="submit" disabled={uploading || docSaving || !newDocUrl} style={{ width: "100%", padding: 8, background: "#0A0A0A", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 650, cursor: (uploading || docSaving || !newDocUrl) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
                      Save Attachment
                    </button>
                  </form>
                )}

                {invoiceDocs.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0, textAlign: "center", padding: "10px 0" }}>No attachments uploaded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {invoiceDocs.map((doc) => (
                      <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#FAFAFA", border: "1px solid #EBEBEB", borderRadius: 8 }}>
                        <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
                          <a href={doc.documentUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 650, color: "#0A0A0A", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {doc.documentName}
                          </a>
                          <span style={{ fontSize: 10, color: "#9CA3AF", textTransform: "capitalize" }}>{doc.documentType?.replace(/_/g, " ")}</span>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <a href={doc.documentUrl} target="_blank" rel="noreferrer" style={{ width: 22, height: 22, borderRadius: 5, background: "transparent", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }} title="Preview">
                            <Eye size={12} />
                          </a>
                          <button type="button" onClick={() => handleDeleteInvoiceDoc(doc.id)} style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "transparent", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send modals */}
      {modal && createPortal(
        <div className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="sheet-card" style={{ background: "#FFF", borderRadius: 20, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden", animation: "fadeUp 0.2s ease" }}>

            {modal === "send-confirm" && (<>
              <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Send size={22} color="#2563EB" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Send Invoice?</h2>
                <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 4px" }}>This will email the invoice to:</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{customer?.email}</p>
              </div>
              <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setModal(null)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                <button type="button" onClick={confirmSend} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#2563EB", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Send size={14} /> Send Now
                </button>
              </div>
            </>)}

            {modal === "send-success" && (<>
              <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle size={24} color="#059669" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Invoice Sent!</h2>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>Delivered to <strong style={{ color: "#0A0A0A" }}>{customer?.email}</strong></p>
              </div>
              <div style={{ padding: "24px 28px" }}>
                <button type="button" onClick={() => setModal(null)} style={{ width: "100%", padding: "11px", border: "none", borderRadius: 10, background: "#0A0A0A", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer" }}>Close</button>
              </div>
            </>)}

            {modal === "no-email" && (<>
              <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <AlertTriangle size={24} color="#D97706" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>No Email on Record</h2>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>Add an email address to this customer before sending.</p>
              </div>
              <div style={{ padding: "24px 28px" }}>
                <button type="button" onClick={() => setModal(null)} style={{ width: "100%", padding: "11px", border: "none", borderRadius: 10, background: "#0A0A0A", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer" }}>Dismiss</button>
              </div>
            </>)}

            {modal === "record-payment" && (
              <form onSubmit={handleRecordPayment}>
                <div style={{ padding: "24px 28px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <IndianRupee size={24} color="#4F46E5" />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 6px", textAlign: "center" }}>
                    {editingPaymentId ? "Edit Payment Entry" : "Record Payment"}
                  </h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 20px", textAlign: "center" }}>
                    Outstanding: <strong>{formatMoney(Math.max(0, invoice.grandTotal - (invoice.totalPaid || 0)))}</strong>
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label htmlFor="inv-pay-amount" style={modalLabelStyle}>Amount Paid (₹) *</label>
                      <input
                        id="inv-pay-amount"
                        type="number"
                        step="0.01"
                        required
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="0.00"
                        className="modal-inp"
                        style={modalInpStyle}
                      />
                    </div>

                    <div>
                      <DatePickerInput
                        id="payment-date"
                        label="Payment Date"
                        required
                        value={payDate}
                        onChange={setPayDate}
                      />
                    </div>

                    <div>
                      <label id="inv-pay-mode-label" style={modalLabelStyle}>Payment Mode</label>
                      <CustomSelect
                        value={payMethod}
                        onChange={setPayMethod}
                        options={[
                          { value: "bank_transfer", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
                          { value: "upi", label: "UPI" },
                          { value: "cheque", label: "Cheque" },
                          { value: "cash", label: "Cash" },
                          { value: "card", label: "Card" },
                          { value: "wire", label: "International Wire Transfer" },
                          { value: "other", label: "Other" },
                        ]}
                      />
                    </div>

                    <div>
                      <label htmlFor="inv-pay-ref" style={modalLabelStyle}>Reference / Transaction #</label>
                      <input
                        id="inv-pay-ref"
                        type="text"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder="e.g. TXN100238492"
                        className="modal-inp"
                        style={modalInpStyle}
                      />
                    </div>

                    <div>
                      <label htmlFor="inv-pay-notes" style={modalLabelStyle}>Notes / Memo</label>
                      <input
                        id="inv-pay-notes"
                        type="text"
                        value={payNotes}
                        onChange={(e) => setPayNotes(e.target.value)}
                        placeholder="Optional details"
                        className="modal-inp"
                        style={modalInpStyle}
                      />
                    </div>

                    <div>
                      <label id="inv-pay-receipt-label" style={modalLabelStyle}>Payment Receipt (Optional)</label>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          marginTop: 4,
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 14px",
                            background: "#EEF2FF",
                            border: "1.5px dashed #4F46E5",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#4F46E5",
                            cursor: uploading ? "not-allowed" : "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          <Upload size={14} />
                          {uploading ? "Uploading..." : "Upload Receipt"}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const res = await upload({ file });
                              if (res.error) {
                                toast.error(res.error);
                              } else if (res.url) {
                                setPayReceiptUrl(res.url);
                                setPayReceiptObjectKey(res.objectKey || "");
                              }
                            }}
                            style={{ display: "none" }}
                            disabled={uploading}
                          />
                        </label>
                        {payReceiptUrl && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              color: "#059669",
                              fontWeight: 600,
                            }}
                          >
                            <Check size={14} />
                            <span>Uploaded!</span>
                            <button
                              type="button"
                              onClick={() => setPayReceiptUrl("")}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#EF4444",
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: "pointer",
                                padding: 0,
                                marginLeft: 4,
                                textDecoration: "underline",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setPayReceiptUrl(""); setPayReceiptObjectKey(""); setEditingPaymentId(null); setModal(null); }}
                    style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating || uploading}
                    style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#4F46E5", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: (updating || uploading) ? "not-allowed" : "pointer", boxShadow: "0 4px 12px rgba(79,70,229,0.25)" }}
                  >
                    {updating ? (editingPaymentId ? "Saving..." : "Recording...") : (editingPaymentId ? "Save Changes" : "Record Entry")}
                  </button>
                </div>
              </form>
            )}

            {modal === "issue-cn" && (
              <form onSubmit={submitCreditNote}>
                <div style={{ padding: "24px 28px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#F5F3FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <IndianRupee size={24} color="#6D28D9" />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 6px", textAlign: "center" }}>Issue Credit Note</h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 20px", textAlign: "center" }}>
                    Against <strong>{invoice.invoiceNumber}</strong> · taxable {formatMoney(invoice.taxableAmount)}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label htmlFor="cn-amount" style={modalLabelStyle}>Credit amount — taxable value ({invoice.currency || "₹"}) *</label>
                      <input id="cn-amount" type="number" step="0.01" required value={cnAmount} onChange={(e) => setCnAmount(e.target.value)} placeholder="0.00" className="modal-inp" style={modalInpStyle} />
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>GST is added proportionally to the original invoice. Full or partial.</p>
                    </div>
                    <div><DatePickerInput id="cn-date" label="Credit note date" required value={cnDate} onChange={setCnDate} /></div>
                    <div>
                      <label style={modalLabelStyle}>Reason (GST)</label>
                      <CustomSelect value={cnReason} onChange={setCnReason} options={CN_REASONS} />
                    </div>
                  </div>
                </div>
                <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setModal(null)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={updating} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#6D28D9", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: updating ? "not-allowed" : "pointer" }}>{updating ? "Issuing…" : "Issue Credit Note"}</button>
                </div>
              </form>
            )}

            {modal === "record-refund" && (
              <form onSubmit={submitRefund}>
                <div style={{ padding: "24px 28px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <IndianRupee size={24} color="#059669" />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 20px", textAlign: "center" }}>Record Refund</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label htmlFor="refund-amount" style={modalLabelStyle}>Refund amount (₹) *</label>
                      <input id="refund-amount" type="number" step="0.01" required value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="0.00" className="modal-inp" style={modalInpStyle} />
                    </div>
                    <div><DatePickerInput id="refund-date" label="Refund date" required value={refundDate} onChange={setRefundDate} /></div>
                    <div>
                      <label style={modalLabelStyle}>Method</label>
                      <CustomSelect value={refundMethod} onChange={setRefundMethod} options={[
                        { value: "bank_transfer", label: "Bank Transfer" }, { value: "upi", label: "UPI" },
                        { value: "cheque", label: "Cheque" }, { value: "cash", label: "Cash" }, { value: "card", label: "Card" },
                      ]} />
                    </div>
                    <div>
                      <label htmlFor="refund-ref" style={modalLabelStyle}>Reference #</label>
                      <input id="refund-ref" type="text" value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="e.g. TXN…" className="modal-inp" style={modalInpStyle} />
                    </div>
                  </div>
                </div>
                <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => { setModal(null); setRefundCnId(null); }} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={updating} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#059669", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: updating ? "not-allowed" : "pointer" }}>{updating ? "Recording…" : "Record Refund"}</button>
                </div>
              </form>
            )}

            {modal === "record-tds" && (
              <form onSubmit={submitInvoiceTds}>
                <div style={{ padding: "24px 28px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#E0F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <IndianRupee size={24} color="#0369A1" />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 6px", textAlign: "center" }}>TDS Deducted by Client</h2>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 20px", textAlign: "center" }}>
                    On taxable value {formatMoney(invoice.taxableAmount)} · settles part of the invoice
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={modalLabelStyle}>TDS section</label>
                      <CustomSelect value={tdsSection} onChange={setTdsSection} options={INV_TDS_SECTIONS} />
                    </div>
                    <div>
                      <label htmlFor="inv-tds-rate" style={modalLabelStyle}>TDS rate %</label>
                      <input id="inv-tds-rate" type="number" step="0.01" value={tdsRate} onChange={(e) => setTdsRate(e.target.value)} placeholder="10" className="modal-inp" style={modalInpStyle} />
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>TDS ≈ ₹{(((parseFloat(invoice.taxableAmount) || 0) * (parseFloat(tdsRate) || 0)) / 100).toFixed(2)}. Set rate 0 to clear.</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setModal(null)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={updating} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#0369A1", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: updating ? "not-allowed" : "pointer" }}>{updating ? "Saving…" : "Record TDS"}</button>
                </div>
              </form>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation modals */}
      {deleteModal && createPortal(
        <div className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="sheet-card" style={{ background: "#FFF", borderRadius: 20, width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden", animation: "fadeUp 0.2s ease" }}>

            {deleteModal === "invoice" && (<>
              <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Trash2 size={24} color="#DC2626" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Delete Invoice?</h2>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                  <strong style={{ color: "#0A0A0A" }}>{invoice?.invoiceNumber}</strong> and all related data will be permanently removed. This cannot be undone.
                </p>
              </div>
              <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setDeleteModal(null)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                <button type="button" onClick={confirmDeleteInvoice} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#DC2626", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Trash2 size={14} /> Delete Invoice
                </button>
              </div>
            </>)}

            {deleteModal === "payment" && (<>
              <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <AlertTriangle size={24} color="#D97706" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Remove Payment Record?</h2>
                <p style={{ fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                  The balance due and invoice status will be recalculated after removal.
                </p>
              </div>
              <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
                <button type="button" onClick={() => { setDeleteModal(null); setPendingDeletePaymentId(null); }} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
                <button type="button" onClick={confirmDeletePayment} disabled={updating} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#D97706", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: updating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  <Trash2 size={14} /> Remove Record
                </button>
              </div>
            </>)}

          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}

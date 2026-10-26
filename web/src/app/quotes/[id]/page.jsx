import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import InvoiceDocument from "@/components/InvoiceDocument";
import Segmented from "@/components/ui/Segmented";
import { StatusBadge } from "@/components/studio/primitives";
import { api } from "@/utils/api";
import { Edit, Trash2, Download, ArrowLeft, ArrowRightLeft } from "lucide-react";
import { formatMoney, formatDate } from "@/utils/format";

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

const TEMPLATE_OPTIONS = [
  { value: "modern",  label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
];

// Map between templateId integer (stored in DB) and template name string
const ID_TO_TEMPLATE = { 1: "modern", 2: "minimal", 3: "classic" };
const TEMPLATE_TO_ID = { modern: 1, minimal: 2, classic: 3 };

export default function QuoteViewPage({ params }) {
  const id = params?.id;
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [items, setItems] = useState([]);
  const [company, setCompany] = useState(null);
  const [templateId, setTemplateId] = useState(null);
  const [templateName, setTemplateName] = useState("modern");
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/quotes/${id}`),
      api.get("/api/settings/company"),
    ])
      .then(([quoteData, compData]) => {
        setQuote(quoteData.quote);
        setCustomer(quoteData.customer);
        setItems(quoteData.items || []);
        setCompany(compData);
        const tid = quoteData.quote.templateId || 1;
        setTemplateId(tid);
        setTemplateName(ID_TO_TEMPLATE[tid] || "modern");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTemplateChange(name) {
    const numId = TEMPLATE_TO_ID[name] || 1;
    setTemplateName(name);
    setTemplateId(numId);
    try {
      await api.put(`/api/quotes/${id}`, { templateId: numId });
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  }

  async function handleConvert() {
    setConverting(true);
    try {
      const data = await api.post(`/api/quotes/${id}/convert`, {});
      if (typeof window !== "undefined")
        window.location.href = `/invoices/${data.invoiceId}/edit`;
    } catch (err) {
      toast.error("Convert failed: " + err.message);
    } finally {
      setConverting(false);
    }
  }

  async function confirmDeleteQuote() {
    setDeleteModal(false);
    try {
      await api.delete(`/api/quotes/${id}`);
      if (typeof window !== "undefined") window.location.href = "/quotes";
    } catch (err) {
      toast.error("Delete failed: " + err.message);
    }
  }

  // Downloads the Puppeteer-rendered A4 PDF — browser print dialogs add URL/date
  // headers and break pagination, and mobile Safari clips the page to the viewport.
  async function handleDownloadPDF() {
    if (typeof window === "undefined" || downloadingPDF) return;
    setDownloadingPDF(true);
    try {
      const token = localStorage.getItem("modus_auth_token");
      const res = await fetch(`/api/quotes/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

      const clientSlug = (buyer?.companyName || buyer?.name || "Client")
        .trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Client";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clientSlug}-${quote?.quoteNumber || "Quotation"}.pdf`;
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

  const seller = quote?.snapshotSeller || company || {};
  const snapshotBuyer = quote?.snapshotBuyer;
  const buyer = (snapshotBuyer && Object.keys(snapshotBuyer).length > 0) ? snapshotBuyer : (customer || {});

  // Responsive preview: scale the 210mm document to fit its column (no clip at 100%).
  const previewOuterRef = useRef(null);
  const previewInnerRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewBoxH, setPreviewBoxH] = useState("auto");
  useEffect(() => {
    function update() {
      const outer = previewOuterRef.current;
      const inner = previewInnerRef.current;
      if (!outer || !inner) return;
      const docW = inner.offsetWidth || 794;
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
  }, [quote, templateName, items]);

  const docInvoice = quote
    ? {
        ...quote,
        invoiceNumber: quote.quoteNumber,
        invoiceDate: quote.quoteDate,
        dueDate: quote.validUntil,
        poNumber: null,
      }
    : null;

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
          #quote-printable, #quote-printable * {
            visibility: visible !important;
          }
          #quote-printable {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          /* Undo the on-screen preview scale-to-fit transform so print/PDF uses full size */
          #quote-printable > div {
            transform: none !important;
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
      {!loading && !quote && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#9CA3AF" }}>Quote not found.</p>
        </div>
      )}

      {/* Main content */}
      {!loading && quote && (
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 30px 30px" }}>
          {/* ── Action bar ── */}
          <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 0 16px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.location.href = "/quotes"; }}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", cursor: "pointer", color: "#6B7280", fontSize: 13, fontWeight: 500, fontFamily: "inherit", padding: 0 }}>
              <ArrowLeft size={15} />
              <span style={{ color: "#9CA3AF" }}>Quotes</span>
              <span style={{ color: "#D1D5DB", margin: "0 2px" }}>/</span>
              <span style={{ fontWeight: 650, color: "#0A0A0A" }}>{quote.quoteNumber}</span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <Segmented
                value={templateName}
                onChange={handleTemplateChange}
                options={TEMPLATE_OPTIONS} />
              <a href={`/quotes/${id}/edit`} style={{ ...ghostBtn, textDecoration: "none" }}>
                <Edit size={13} /> Edit
              </a>
              <button type="button" onClick={handleDownloadPDF} disabled={downloadingPDF} style={ghostBtn}>
                <Download size={13} /> {downloadingPDF ? "Preparing…" : "PDF"}
              </button>
              <button type="button" onClick={handleConvert} disabled={converting} style={ghostBtn}>
                <ArrowRightLeft size={13} /> {converting ? "Converting…" : "Convert to Invoice"}
              </button>
              <button type="button" onClick={() => setDeleteModal(true)} style={{ ...ghostBtn, color: "#DC2626" }}>
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>

          {/* ── Main 2-col grid ── */}
          <div className="modus-doc-layout" style={{ display: "grid", gridTemplateColumns: "1fr 296px", gap: 18, alignItems: "start" }}>
            {/* Quote document */}
            <div id="quote-printable" ref={previewOuterRef} style={{ overflow: "hidden", height: previewBoxH }}>
              <div ref={previewInnerRef} style={{ width: "210mm", transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                <InvoiceDocument
                  invoice={docInvoice}
                  customer={buyer}
                  items={items}
                  seller={seller}
                  template={templateName}
                  mode="screen"
                  docType="quote" />
              </div>
            </div>

            {/* Right rail */}
            <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 8 }}>
              {/* Status + amount card */}
              <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>Status</span>
                  <StatusBadge status={quote.status} />
                </div>
                <div style={{ background: "#FAFAFB", borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "0 0 4px" }}>Total</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#0A0A0A", margin: "0 0 2px", letterSpacing: "-0.02em" }}>
                    {formatMoney(quote.grandTotal)}
                  </p>
                  {quote.validUntil && (
                    <p style={{ fontSize: 11.5, color: quote.status === "expired" ? "#E11D2C" : "#9CA3AF", margin: 0, fontWeight: 600 }}>
                      Valid until {formatDate(quote.validUntil)}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {quote.notes && (
                <div style={{ background: "#fff", border: "1px solid #EEEEF0", borderRadius: "var(--rcard)", padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.035)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Notes</p>
                  <p style={{ fontSize: 12, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>{quote.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && createPortal(
        <div className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="sheet-card" style={{ background: "#FFF", borderRadius: 20, width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden", animation: "fadeUp 0.2s ease" }}>
            <div style={{ padding: "28px 28px 0", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Trash2 size={24} color="#DC2626" />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0A0A0A", margin: "0 0 8px" }}>Delete Quote?</h2>
              <p style={{ fontSize: 13, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: "#0A0A0A" }}>{quote.quoteNumber}</strong> will be archived. This cannot be undone.
              </p>
            </div>
            <div style={{ padding: "24px 28px", display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setDeleteModal(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={confirmDeleteQuote} style={{ flex: 2, padding: "11px", border: "none", borderRadius: 10, background: "#DC2626", fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Trash2 size={14} /> Delete Quote
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AppShell>
  );
}

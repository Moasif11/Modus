import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, CheckCircle, ArrowLeft, Eye, Send, File } from "lucide-react";
import { api } from "@/utils/api";
import {
  calculateLineItem,
  calculateInvoiceTotals,
  INDIAN_STATES,
} from "@/utils/invoiceCalc";
import { numberToWords } from "@/utils/numberToWords";
import { formatMoney, CURRENCIES, CURRENCY_SYMBOLS } from "@/utils/format";
import InvoiceDocument from "./InvoiceDocument";
import CustomSelect from "./ui/CustomSelect";
import DatePickerInput from "./ui/DatePickerInput";
import { ghostBtn, Chip, Avatar, Card } from "@/components/studio/primitives.jsx";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/studio/Logo.jsx";
import { Icon } from "@/components/studio/icons.jsx";

const GST_RATES = [0, 5, 12, 18, 28];
const GST_CATEGORIES = [
  { value: "B2B", label: "B2B — Registered Business" },
  { value: "B2C", label: "B2C — Unregistered / Consumer" },
  { value: "Export", label: "Export — Outside India" },
  { value: "SEZ", label: "SEZ — Special Economic Zone" },
  { value: "Nil-Rated", label: "Nil-Rated Supply" },
  { value: "Exempt", label: "Exempt Supply" },
];

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "wire", label: "International Wire Transfer" },
  { value: "other", label: "Other" },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: "", label: "—" },
  { value: "Due on Receipt", label: "Due on Receipt" },
  { value: "Net 7", label: "Net 7" },
  { value: "Net 15", label: "Net 15" },
  { value: "Net 30", label: "Net 30" },
  { value: "Net 45", label: "Net 45" },
  { value: "Net 60", label: "Net 60" },
];

const DOC_LABELS = {
  invoice: {
    docName: "invoice",
    numberLabel: "Invoice No.",
    dateLabel: "Issue Date",
    endDateLabel: "Due Date",
    endDatePlaceholder: "No due date",
    numberEndpoint: "/api/invoices/next-number",
    numberField: "invoiceNumber",
    collectionEndpoint: "/api/invoices",
    redirectBase: "/invoices",
    backHref: "/invoices",
    backLabel: "Back to receivables",
  },
  quote: {
    docName: "quote",
    numberLabel: "Quote No.",
    dateLabel: "Quote Date",
    endDateLabel: "Valid Until",
    endDatePlaceholder: "No expiry",
    numberEndpoint: "/api/quotes/next-number",
    numberField: "quoteNumber",
    collectionEndpoint: "/api/quotes",
    redirectBase: "/quotes",
    backHref: "/quotes",
    backLabel: "Back to quotes",
  },
  proforma: {
    docName: "proforma",
    numberLabel: "Proforma No.",
    dateLabel: "Proforma Date",
    endDateLabel: "Valid Until",
    endDatePlaceholder: "No expiry",
    numberEndpoint: "/api/proforma/next-number",
    numberField: "proformaNumber",
    collectionEndpoint: "/api/proforma",
    redirectBase: "/proforma",
    backHref: "/proforma",
    backLabel: "Back to proforma",
  },
};

const inpStyle = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid #ECECEE",
  borderRadius: 12,
  fontSize: 13,
  color: "#0A0A0A",
  background: "#FAFAFA",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.15s",
  fontFamily: "inherit",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#9CA3AF",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 5,
};

function emptyItem() {
  return {
    itemName: "",
    description: "",
    hsnSacCode: "",
    quantity: 1,
    unit: "Hrs",
    unitPrice: 0,
    discountPercent: 0,
    gstRate: 18,
  };
}

// Compute a due date string from invoiceDate + payment terms
function computeDueDate(invoiceDate, paymentTerms) {
  if (!invoiceDate || !paymentTerms) return "";
  if (paymentTerms === "Due on Receipt") return invoiceDate;
  const match = paymentTerms.match(/Net\s+(\d+)/i);
  if (!match) return "";
  const days = parseInt(match[1], 10);
  const base = new Date(invoiceDate);
  if (isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + days);
  return base.toISOString().split("T")[0];
}

export default function InvoiceEditor({
  mode,
  invoiceId,
  initialData,
  backHref,
  docType = "invoice",
}) {
  const isEdit = mode === "edit";
  const L = DOC_LABELS[docType];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState("edit"); // "edit" | "preview"
  const [companySettings, setCompanySettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState(
    initialData?.invoiceNumber || "",
  );

  // Form state
  const [invoiceDate, setInvoiceDate] = useState(() => {
    if (initialData?.invoiceDate) {
      return initialData.invoiceDate.toString().split("T")[0].split(" ")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate?.split("T")[0] || "",
  );
  const [paymentTerms, setPaymentTerms] = useState(
    initialData?.paymentTerms || "Net 30",
  );
  const [placeOfSupply, setPlaceOfSupply] = useState(
    initialData?.placeOfSupply || "",
  );
  const [placeOfSupplyCode, setPlaceOfSupplyCode] = useState(
    initialData?.placeOfSupplyCode || "",
  );
  const [reverseCharge, setReverseCharge] = useState(
    initialData?.reverseCharge || false,
  );
  const [templateId, setTemplateId] = useState(initialData?.templateId || 1);
  const [items, setItems] = useState(initialData?.items || [emptyItem()]);
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [terms, setTerms] = useState(initialData?.terms || "");
  const [declaration, setDeclaration] = useState(
    initialData?.declaration || "",
  );
  const [paymentMethods, setPaymentMethods] = useState(() => {
    const val = initialData?.paymentMethod;
    if (!val) return ["bank_transfer"];
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [p];
    } catch { return [val]; }
  });
  const [servicePeriodFrom, setServicePeriodFrom] = useState(
    initialData?.servicePeriodFrom?.split("T")[0] || "",
  );
  const [servicePeriodTo, setServicePeriodTo] = useState(
    initialData?.servicePeriodTo?.split("T")[0] || "",
  );
  const [gstCategory, setGstCategory] = useState(
    initialData?.gstCategory || "B2B",
  );
  const [projectId, setProjectId] = useState(initialData?.projectId || "");
  const [projects, setProjects] = useState([]);
  const [currency, setCurrency] = useState(initialData?.currency || "INR");
  const [exchangeRate, setExchangeRate] = useState(initialData?.exchangeRate || 1.0);

  // Auto-update due date when paymentTerms or invoiceDate changes
  useEffect(() => {
    if (!isEdit || !initialData?.dueDate) {
      const computed = computeDueDate(invoiceDate, paymentTerms);
      if (computed) setDueDate(computed);
    }
  }, [paymentTerms, invoiceDate]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currency === "INR") {
      setExchangeRate(1.0);
      return;
    }
    fetch(`https://open.er-api.com/v6/latest/${currency}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rates && data.rates.INR) {
          setExchangeRate(parseFloat(data.rates.INR));
        }
      })
      .catch((err) => console.error("Error fetching exchange rate:", err));
  }, [currency]);

  useEffect(() => {
    if (!initialData?.gstCategory) {
      if (selectedCustomer?.gstin) setGstCategory("B2B");
      else if (selectedCustomer) setGstCategory("B2C");
    }
  }, [selectedCustomer]);

  async function loadInitialData() {
    try {
      const [settingsData, customersData, templatesData, servicesData] = await Promise.all([
        api.get("/api/settings/company"),
        api.get("/api/customers"),
        api.get("/api/templates"),
        api.get("/api/services").catch(() => ({ services: [] })),
      ]);
      setCompanySettings(settingsData);
      setCustomers(customersData.customers || []);
      setTemplates(templatesData.templates || []);
      setServices(servicesData.services || []);
      try {
        const projData = await api.get("/api/projects?status=active");
        setProjects(projData.projects || []);
      } catch (_) { /* projects table may not exist yet */ }

      if (!isEdit) {
        const numberData = await api.get(L.numberEndpoint);
        setInvoiceNumber(numberData[L.numberField]);
        if (!notes) setNotes(settingsData.defaultNotes || "");
        if (!terms) setTerms(settingsData.defaultTerms || "");
        if (!declaration) setDeclaration(settingsData.defaultDeclaration || "");
        if (!placeOfSupply) {
          setPlaceOfSupply(settingsData.state || "");
          setPlaceOfSupplyCode(settingsData.stateCode || "");
        }
        if (templatesData.templates?.length) {
          const def =
            templatesData.templates.find((t) => t.isDefault) ||
            templatesData.templates[0];
          setTemplateId(def.id);
        }
      } else if (initialData?.customer) {
        setSelectedCustomer(initialData.customer);
      }
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }

  const calculatedItems = items.map((item) => ({
    ...item,
    ...calculateLineItem({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      gstRate: item.gstRate,
      taxInclusive: false,
      sellerStateCode: companySettings?.stateCode,
      placeOfSupplyCode,
    }),
  }));

  const totals = calculateInvoiceTotals(calculatedItems);
  const amountInWords = numberToWords(totals.grandTotal);
  const isInterstate = calculatedItems[0]?.isInterstate || false;

  function addItem() {
    setItems([...items, emptyItem()]);
  }
  function removeItem(i) {
    if (items.length > 1) setItems(items.filter((_, idx) => idx !== i));
  }
  function updateItem(i, field, val) {
    const next = [...items];
    next[i] = { ...next[i], [field]: val };
    setItems(next);
  }

  async function handleSave(status = "saved") {
    if (!selectedCustomer?.id) {
      toast.error(`Please select a ${docType === "quote" ? "customer for this quote" : "customer"} first.`);
      return;
    }
    const namedItems = items.filter((i) => i.itemName && i.itemName.trim());
    if (namedItems.length === 0) {
      toast.error("Please add at least one line item with a name.");
      return;
    }
    if (!namedItems.some((i) => parseFloat(i.unitPrice) > 0)) {
      toast.error("At least one line item needs a rate greater than 0.");
      return;
    }
    if (!paymentMethods.length) {
      toast.error("Please select at least one payment method.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(docType === "quote"
          ? { quoteNumber: invoiceNumber, quoteDate: invoiceDate, validUntil: dueDate || null }
          : docType === "proforma"
          ? { proformaNumber: invoiceNumber, proformaDate: invoiceDate, validUntil: dueDate || null }
          : { invoiceNumber, invoiceDate, dueDate: dueDate || null, poNumber: null, paymentTerms: paymentTerms || null }),
        customerId: selectedCustomer?.id || null,
        reverseCharge,
        placeOfSupply,
        placeOfSupplyCode,
        currency,
        exchangeRate,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        totalTax: totals.totalTax,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        amountInWords,
        taxInclusive: false,
        isInterstate,
        notes,
        terms,
        declaration,
        paymentMethod: JSON.stringify(paymentMethods),
        servicePeriodFrom: servicePeriodFrom || null,
        servicePeriodTo: servicePeriodTo || null,
        gstCategory,
        projectId: projectId || null,
        templateId,
        status: docType === "invoice" ? status : (status === "draft" ? "draft" : "sent"),
        items: calculatedItems.map((item) => ({
          itemName: item.itemName,
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableValue: item.taxableValue,
          gstRate: item.gstRate,
          cgstRate: item.cgstRate,
          sgstRate: item.sgstRate,
          igstRate: item.igstRate,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
          totalTax: item.totalTax,
          lineTotal: item.lineTotal,
        })),
        snapshotSeller: companySettings,
        snapshotBuyer: selectedCustomer,
      };

      if (isEdit) {
        await api.put(`${L.collectionEndpoint}/${invoiceId}`, payload);
        if (typeof window !== "undefined")
          window.location.href = `${L.redirectBase}/${invoiceId}`;
      } else {
        const data = await api.post(L.collectionEndpoint, payload);
        if (typeof window !== "undefined")
          window.location.href = `${L.redirectBase}/${data.id}`;
      }
    } catch (err) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Build preview invoice object
  const previewInvoice = {
    invoiceNumber,
    customerId: selectedCustomer?.id,
    invoiceDate,
    dueDate,
    poNumber: null,
    paymentTerms,
    placeOfSupply,
    placeOfSupplyCode,
    reverseCharge,
    currency,
    exchangeRate,
    subtotal: totals.subtotal,
    totalDiscount: totals.totalDiscount,
    taxableAmount: totals.taxableAmount,
    cgstAmount: totals.cgstAmount,
    sgstAmount: totals.sgstAmount,
    igstAmount: totals.igstAmount,
    totalTax: totals.totalTax,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    amountInWords,
    isInterstate,
    notes,
    terms,
    declaration,
    paymentMethod: JSON.stringify(paymentMethods),
    servicePeriodFrom,
    servicePeriodTo,
    gstCategory,
    templateId,
  };

  if (loading)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: "3px solid #E11D2C",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
      </div>
    );

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .inv-inp:focus { border-color: #E11D2C !important; background: #FFF !important; box-shadow: 0 0 0 3px rgba(225,29,44,0.1) !important; outline: none !important; }
        .item-row:hover { background: #FBFBFC !important; }
        /* Clean spreadsheet-style line items: borderless inputs until hover/focus */
        .li-table .inv-inp { border-color: transparent !important; background: transparent !important; border-radius: 8px !important; padding: 7px 10px !important; transition: background .12s, border-color .12s !important; }
        .li-table .inv-inp:hover { background: #F4F4F6 !important; }
        .li-table .inv-inp:focus { border-color: #E11D2C !important; background: #FFF !important; }
        .li-table td input[type="number"] { text-align: right; }
        .li-table thead th { font-size: 10px !important; }
        .li-table tbody td { vertical-align: top; }
        .table-select { appearance: none; -webkit-appearance: none; padding-right: 26px !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") !important; background-repeat: no-repeat !important; background-position: right 8px center !important; }
        /* ── Responsive: stack the editor on small screens ── */
        @media (max-width: 1024px) {
          .inv-editor-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .inv-editor-grid > div { min-width: 0; }
          .inv-editor-rail { position: static !important; }
        }
        @media (max-width: 720px) {
          .inv-actionbar { flex-wrap: wrap !important; gap: 10px !important; }
          .inv-actionbar .inv-actions { width: 100%; justify-content: stretch; }
          .inv-actionbar .inv-actions > button { flex: 1; justify-content: center; }
          .inv-meta-grid { grid-template-columns: 1fr 1fr !important; }
          .inv-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ACTION BAR */}
      <div
        className="inv-actionbar"
        style={{
          background: "#FFF",
          border: "1px solid #EEEEF0",
          borderRadius: "var(--rcard)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
          padding: "12px 18px",
          margin: "0 auto 4px",
          maxWidth: 1480,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <a
          href={backHref || L.backHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#6B7280",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} /> {L.backLabel}
        </a>

        <div className="inv-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => handleSave("draft")}
            disabled={saving}
            type="button"
            style={{ ...ghostBtn, gap: 6 }}
          >
            <File size={13} /> Save draft
          </button>
          <button
            onClick={() => setView("preview")}
            type="button"
            style={{ ...ghostBtn, gap: 6 }}
          >
            <Eye size={13} /> Preview
          </button>
          <button
            onClick={() => handleSave("saved")}
            disabled={saving}
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 16px",
              background: "#E11D2C",
              border: "none",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              color: "#FFF",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              fontFamily: "inherit",
              boxShadow: "0 1px 3px rgba(225,29,44,0.3)",
            }}
          >
            {saving ? <><Spinner style={{ width: 13, height: 13 }} /> Saving...</> : <><Send size={13} /> Submit</>}
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          background: view === "preview" ? "#E5E7EB" : "#F7F7F7",
          padding: view === "preview" ? "28px" : "20px 0",
        }}
      >
        {view === "preview" ? (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div
              style={{
                maxWidth: "210mm",
                margin: "0 auto 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 4px",
              }}
            >
              <p style={{ fontSize: 12, color: "#6B7280", margin: 0 }}>
                <strong>Preview Mode</strong> — This is exactly how the PDF will look.
              </p>
              <button
                type="button"
                onClick={() => setView("edit")}
                style={{ ...ghostBtn, fontSize: 12 }}
              >
                ← Back to edit
              </button>
            </div>
            <InvoiceDocument
              invoice={previewInvoice}
              customer={selectedCustomer}
              items={calculatedItems}
              seller={companySettings}
              templateId={templateId}
              templates={templates}
              mode="screen"
              docType={docType}
            />
          </div>
        ) : (
          <EditorLayout
            companySettings={companySettings}
            customers={customers}
            templates={templates}
            services={services}
            selectedCustomer={selectedCustomer}
            setSelectedCustomer={setSelectedCustomer}
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
            setInvoiceDate={setInvoiceDate}
            dueDate={dueDate}
            setDueDate={setDueDate}
            paymentTerms={paymentTerms}
            setPaymentTerms={setPaymentTerms}
            placeOfSupplyCode={placeOfSupplyCode}
            setPlaceOfSupply={setPlaceOfSupply}
            setPlaceOfSupplyCode={setPlaceOfSupplyCode}
            reverseCharge={reverseCharge}
            setReverseCharge={setReverseCharge}
            templateId={templateId}
            setTemplateId={setTemplateId}
            items={items}
            setItems={setItems}
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
            calculatedItems={calculatedItems}
            notes={notes}
            setNotes={setNotes}
            terms={terms}
            setTerms={setTerms}
            declaration={declaration}
            setDeclaration={setDeclaration}
            paymentMethods={paymentMethods}
            setPaymentMethods={setPaymentMethods}
            servicePeriodFrom={servicePeriodFrom}
            setServicePeriodFrom={setServicePeriodFrom}
            servicePeriodTo={servicePeriodTo}
            setServicePeriodTo={setServicePeriodTo}
            gstCategory={gstCategory}
            setGstCategory={setGstCategory}
            totals={totals}
            amountInWords={amountInWords}
            isInterstate={isInterstate}
            onSave={handleSave}
            saving={saving}
            setView={setView}
            projects={projects}
            projectId={projectId}
            setProjectId={setProjectId}
            currency={currency}
            setCurrency={setCurrency}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            isEdit={isEdit}
            L={L}
          />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TWO-COLUMN LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

// Desktop: resizable form/rail split (drag the divider, width persists).
// Below 1024px: falls back to the stacked .inv-editor-grid media-query layout.
function EditorSplit({ children }) {
  const [left, right] = children;
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1025px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!isDesktop) {
    return (
      <div
        className="inv-editor-grid"
        style={{
          maxWidth: 1480,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 24,
          alignItems: "start",
          animation: "fadeUp 0.3s ease",
        }}
      >
        {left}
        {right}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1480, margin: "0 auto", animation: "fadeUp 0.3s ease" }}>
      {/* react-resizable-panels v4: bare numbers are PIXELS — percentages must be strings */}
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize="76%" minSize="45%" className="!overflow-visible">
          <div style={{ paddingRight: 12 }}>{left}</div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="24%" minSize="300px" maxSize="520px" className="!overflow-visible">
          <div style={{ paddingLeft: 12 }}>{right}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function EditorLayout(props) {
  const {
    companySettings,
    customers,
    templates,
    services,
    selectedCustomer,
    setSelectedCustomer,
    invoiceNumber,
    invoiceDate,
    setInvoiceDate,
    dueDate,
    setDueDate,
    paymentTerms,
    setPaymentTerms,
    placeOfSupplyCode,
    setPlaceOfSupply,
    setPlaceOfSupplyCode,
    reverseCharge,
    setReverseCharge,
    templateId,
    setTemplateId,
    items,
    setItems,
    updateItem,
    addItem,
    removeItem,
    calculatedItems,
    notes,
    setNotes,
    terms,
    setTerms,
    declaration,
    setDeclaration,
    paymentMethods,
    setPaymentMethods,
    servicePeriodFrom,
    setServicePeriodFrom,
    servicePeriodTo,
    setServicePeriodTo,
    gstCategory,
    setGstCategory,
    totals,
    amountInWords,
    isInterstate,
    onSave,
    saving,
    setView,
    projects,
    projectId,
    setProjectId,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
    isEdit,
    L,
  } = props;

  // GST treatment label for the Bill To chip
  const gstTreatmentLabel = (() => {
    if (gstCategory === "Export") return "Export · 0%";
    if (isInterstate) return "Inter-state · IGST 18%";
    return "Intra-state · CGST+SGST";
  })();

  return (
    <EditorSplit>
      {/* ── LEFT COLUMN ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* 1. HEADER CARD */}
        <div
          style={{
            background: "#FFF",
            border: "1px solid #EEEEF0",
            borderRadius: "var(--rcard)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
            padding: "18px 22px 20px",
          }}
        >
          {/* Top row: title + Draft chip + Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 16, fontWeight: 750, color: "#0A0A0A", margin: 0 }}>
                {isEdit ? `Edit ${L.docName}` : `New ${L.docName}`}
              </h2>
              <Chip tone="#6B7280" bg="#F3F4F6">Draft</Chip>
            </div>
            <Logo tone="light" height={20} accent="#E11D2C" />
          </div>

          {/* 4-col meta row */}
          <div className="inv-meta-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <div>
              <p style={labelStyle}>{L.numberLabel}</p>
              <input
                type="text"
                value={invoiceNumber}
                readOnly
                className="inv-inp"
                style={{ ...inpStyle, color: "#6B7280", cursor: "default" }}
              />
            </div>
            <DatePickerInput
              id="invoice-date"
              label={L.dateLabel}
              value={invoiceDate}
              onChange={setInvoiceDate}
              placeholder="Select date"
              required
              style={{ width: "100%" }}
            />
            <div>
              <p style={labelStyle}>Payment Terms</p>
              <CustomSelect
                value={paymentTerms}
                onChange={setPaymentTerms}
                placeholder="—"
                options={PAYMENT_TERMS_OPTIONS}
              />
            </div>
            <DatePickerInput
              id="due-date"
              label={L.endDateLabel}
              value={dueDate}
              onChange={setDueDate}
              placeholder={L.endDatePlaceholder}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* 2. BILL TO CARD */}
        <div
          style={{
            background: "#FFF",
            border: "1px solid #EEEEF0",
            borderRadius: "var(--rcard)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
            padding: "18px 22px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Bill to</h3>
            <button
              type="button"
              style={{ ...ghostBtn, gap: 5, fontSize: 12 }}
              onClick={() => {
                // show the customer picker — handled via the select below
                document.getElementById("customer-select-trigger")?.click();
              }}
            >
              <Icon name="users" size={13} /> Change client <Icon name="chevronDown" size={12} />
            </button>
          </div>

          {/* Hidden but functional CustomSelect for customer picking */}
          <div style={{ marginBottom: selectedCustomer ? 12 : 0 }}>
            <CustomSelect
              id="customer-select-trigger"
              searchable
              value={selectedCustomer?.id ? String(selectedCustomer.id) : ""}
              onChange={(v) => {
                const c = customers.find(c => c.id === Number(v));
                setSelectedCustomer(c || null);
              }}
              placeholder="— Select client —"
              options={customers.map(c => ({ value: String(c.id), label: c.companyName || c.name }))}
            />
          </div>

          {selectedCustomer ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "12px 14px",
                background: "#F9FAFB",
                borderRadius: 10,
                border: "1px solid #E5E7EB",
                marginTop: 10,
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Avatar
                  name={selectedCustomer.companyName || selectedCustomer.name}
                  size={38}
                  tone="#E11D2C"
                />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 3px" }}>
                    {selectedCustomer.companyName || selectedCustomer.name}
                  </p>
                  <p style={{ fontSize: 11.5, color: "#6B7280", margin: "0 0 2px" }}>
                    {[selectedCustomer.contactPerson, selectedCustomer.city, selectedCustomer.state]
                      .filter(Boolean).join(" · ")}
                  </p>
                  {selectedCustomer.gstin && (
                    <p style={{ fontSize: 10.5, color: "#9CA3AF", margin: 0 }}>
                      GSTIN: {selectedCustomer.gstin}
                    </p>
                  )}
                </div>
              </div>
              <Chip tone="#4F46E5" bg="#EEF2FF">{gstTreatmentLabel}</Chip>
            </div>
          ) : (
            <div
              style={{
                padding: 16,
                background: "#FAFAFA",
                borderRadius: 10,
                border: "1.5px dashed #E5E7EB",
                textAlign: "center",
                marginTop: 10,
              }}
            >
              <p style={{ fontSize: 12, color: "#9CA3AF", margin: "0 0 6px" }}>No client selected</p>
              <a
                href="/customers"
                style={{ fontSize: 12, color: "#E11D2C", fontWeight: 600, textDecoration: "none" }}
              >
                + Add a new client
              </a>
            </div>
          )}
        </div>

        {/* 3. LINE ITEMS CARD */}
        <div
          style={{
            background: "#FFF",
            border: "1px solid #EEEEF0",
            borderRadius: "var(--rcard)",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
          }}
        >
          <div
            style={{
              padding: "16px 22px 12px",
              borderBottom: "1px solid #F3F4F6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Line items</h3>
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3, marginBottom: 0 }}>
                {isInterstate
                  ? "IGST applicable (inter-state supply)"
                  : placeOfSupplyCode
                    ? "CGST + SGST applicable (intra-state supply)"
                    : "Set Place of Supply in advanced settings to calculate GST split"}
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="li-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #F3F4F6" }}>
                  {["Description", "HSN/SAC", "Qty", "Rate (" + (CURRENCY_SYMBOLS[currency] || currency) + ")", "Disc %", "GST %", "Amount", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "12px 16px",
                        fontSize: 10.5,
                        fontWeight: 650,
                        color: "#6B7280",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        textAlign: i >= 6 ? "right" : "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const calc = calculatedItems[idx];
                  return (
                    <tr
                      key={idx}
                      className="item-row"
                      style={{
                        borderBottom: idx < items.length - 1 ? "1px solid #F9FAFB" : "none",
                      }}
                    >
                      {/* DESCRIPTION — keep service catalog picker */}
                      <td style={{ padding: "12px 16px", minWidth: 200 }}>
                        <input
                          type="text"
                          className="inv-inp"
                          list={`services-list-${idx}`}
                          value={item.itemName}
                          onChange={(e) => {
                            const val = e.target.value || "";
                            const matchedSvc = Array.isArray(services)
                              ? services.find(s => s && s.name && s.name.toLowerCase() === val.toLowerCase())
                              : null;
                            setItems(prevItems => {
                              const next = [...prevItems];
                              if (matchedSvc) {
                                next[idx] = {
                                  ...next[idx],
                                  itemName: val,
                                  description: matchedSvc.description || "",
                                  unitPrice: matchedSvc.defaultPrice || 0,
                                  gstRate: matchedSvc.gstRate || 18,
                                  hsnSacCode: matchedSvc.hsnSacCode || "9983",
                                };
                              } else {
                                next[idx] = { ...next[idx], itemName: val };
                              }
                              return next;
                            });
                          }}
                          placeholder="e.g. Web Development Services"
                          style={{ ...inpStyle, fontWeight: 500 }}
                        />
                        <datalist id={`services-list-${idx}`}>
                          {services.map((s) => (
                            <option key={s.id} value={s.name}>
                              {(CURRENCY_SYMBOLS[currency] || currency)}{s.defaultPrice} - {s.description ? s.description.slice(0, 45) + "..." : ""}
                            </option>
                          ))}
                        </datalist>
                        <input
                          type="text"
                          className="inv-inp"
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          placeholder="Detailed description (optional)"
                          style={{ ...inpStyle, marginTop: 5, fontSize: 11, color: "#6B7280" }}
                        />
                      </td>

                      {/* HSN/SAC */}
                      <td style={{ padding: "12px 16px", minWidth: 96 }}>
                        <input
                          type="text"
                          className="inv-inp"
                          value={item.hsnSacCode}
                          onChange={(e) => updateItem(idx, "hsnSacCode", e.target.value)}
                          placeholder="9983"
                          style={{ ...inpStyle, fontFamily: "monospace" }}
                        />
                      </td>

                      {/* QTY */}
                      <td style={{ padding: "12px 16px", minWidth: 72 }}>
                        <input
                          type="number"
                          className="inv-inp"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          style={inpStyle}
                        />
                      </td>

                      {/* RATE */}
                      <td style={{ padding: "12px 16px", minWidth: 100 }}>
                        <input
                          type="number"
                          className="inv-inp"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          style={inpStyle}
                        />
                      </td>

                      {/* DISC % */}
                      <td style={{ padding: "12px 16px", minWidth: 72 }}>
                        <input
                          type="number"
                          className="inv-inp"
                          value={item.discountPercent}
                          onChange={(e) => updateItem(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          style={inpStyle}
                        />
                      </td>

                      {/* GST % */}
                      <td style={{ padding: "12px 16px", minWidth: 80 }}>
                        <select
                          className="inv-inp table-select"
                          value={item.gstRate}
                          onChange={(e) => updateItem(idx, "gstRate", parseFloat(e.target.value))}
                          style={{ ...inpStyle, cursor: "pointer" }}
                        >
                          {GST_RATES.map((r) => (
                            <option key={r} value={r}>{r}%</option>
                          ))}
                        </select>
                      </td>

                      {/* AMOUNT (computed) */}
                      <td style={{ padding: "12px 16px", textAlign: "right", minWidth: 110 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>
                          {formatMoney(calc?.lineTotal || 0, currency)}
                        </span>
                      </td>

                      {/* REMOVE */}
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{
                              width: 26, height: 26, border: "none",
                              background: "transparent", cursor: "pointer",
                              borderRadius: 6, color: "#9CA3AF",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#FEE2E2";
                              e.currentTarget.style.color = "#DC2626";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "#9CA3AF";
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add line item */}
          <div style={{ padding: "14px 22px 18px" }}>
            <button
              type="button"
              onClick={addItem}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#FAFAFA", border: "1px solid #E5E7EB",
                borderRadius: 10, padding: "8px 16px",
                fontSize: 12.5, fontWeight: 600, color: "#0A0A0A",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#F3F4F6"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#FAFAFA"; }}
            >
              <Plus size={13} /> Add line item
            </button>
          </div>
        </div>

        {/* 4. ADVANCED SETTINGS (collapsed by default — holds GST, place of supply, payment method, etc.) */}
        <AdvancedSettings
          companySettings={companySettings}
          placeOfSupplyCode={placeOfSupplyCode}
          setPlaceOfSupply={setPlaceOfSupply}
          setPlaceOfSupplyCode={setPlaceOfSupplyCode}
          reverseCharge={reverseCharge}
          setReverseCharge={setReverseCharge}
          templateId={templateId}
          setTemplateId={setTemplateId}
          templates={templates}
          gstCategory={gstCategory}
          setGstCategory={setGstCategory}
          paymentMethods={paymentMethods}
          setPaymentMethods={setPaymentMethods}
          servicePeriodFrom={servicePeriodFrom}
          setServicePeriodFrom={setServicePeriodFrom}
          servicePeriodTo={servicePeriodTo}
          setServicePeriodTo={setServicePeriodTo}
          projects={projects}
          projectId={projectId}
          setProjectId={setProjectId}
          currency={currency}
          setCurrency={setCurrency}
          exchangeRate={exchangeRate}
          setExchangeRate={setExchangeRate}
        />

        {/* 5. NOTES & TERMS CARD */}
        <div
          style={{
            background: "#FFF",
            border: "1px solid #EEEEF0",
            borderRadius: "var(--rcard)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
            padding: "18px 22px 20px",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: "0 0 14px" }}>Notes &amp; terms</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={labelStyle}>Notes</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="inv-inp"
                style={{ ...inpStyle, resize: "vertical", lineHeight: 1.5 }}
                placeholder="Thank you for your business..."
              />
            </div>
            <div>
              <p style={labelStyle}>Terms &amp; Conditions</p>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={4}
                className="inv-inp"
                style={{ ...inpStyle, resize: "vertical", lineHeight: 1.5 }}
                placeholder={"One per line, e.g.\nPayment is due within the specified due date on this invoice."}
              />
            </div>
            <div>
              <p style={labelStyle}>Declaration</p>
              <textarea
                value={declaration}
                onChange={(e) => setDeclaration(e.target.value)}
                rows={2}
                className="inv-inp"
                style={{ ...inpStyle, resize: "vertical", lineHeight: 1.5 }}
                placeholder="We declare that this invoice shows..."
              />
            </div>
          </div>
        </div>

      </div>

      {/* ── RIGHT COLUMN — STICKY SUMMARY ── */}
      <div className="inv-editor-rail" style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Summary Card */}
        <div
          style={{
            background: "#FFF",
            border: "1px solid #EEEEF0",
            borderRadius: "var(--rcard)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid #F3F4F6" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Summary</h3>
          </div>
          <div style={{ padding: "14px 18px" }}>
            <SummaryRow label="Taxable value" value={formatMoney(totals.taxableAmount, currency)} />
            {totals.totalDiscount > 0 && (
              <SummaryRow label="Discount" value={"-" + formatMoney(totals.totalDiscount, currency)} valueColor="#059669" />
            )}
            {totals.cgstAmount > 0 && (
              <SummaryRow label={`CGST`} value={formatMoney(totals.cgstAmount, currency)} />
            )}
            {totals.sgstAmount > 0 && (
              <SummaryRow label={`SGST`} value={formatMoney(totals.sgstAmount, currency)} />
            )}
            {totals.igstAmount > 0 && (
              <SummaryRow label={`IGST`} value={formatMoney(totals.igstAmount, currency)} />
            )}

            {/* Total payable — black rounded box */}
            <div
              style={{
                marginTop: 10,
                padding: "12px 14px",
                background: "#0A0A0A",
                borderRadius: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>Total payable</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                {formatMoney(totals.grandTotal)}
              </span>
            </div>

            {/* Amount in words */}
            <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 8, fontStyle: "italic", lineHeight: 1.5 }}>
              {amountInWords}
            </p>
          </div>

          {/* Due info + item count mini card */}
          <div
            style={{
              margin: "0 14px 14px",
              padding: "10px 12px",
              background: "#F9FAFB",
              borderRadius: 9,
              border: "1px solid #F0F0F2",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#6B7280" }}>
              {items.length} line item{items.length !== 1 ? "s" : ""}
            </span>
            {dueDate && (
              <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>
                Due {new Date(dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>

          {/* CTAs */}
          <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={() => onSave("saved")}
              disabled={saving}
              style={{
                width: "100%", padding: "10px 0",
                background: "#E11D2C", border: "none",
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: "#FFF", cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "inherit",
                boxShadow: "0 1px 3px rgba(225,29,44,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <Send size={13} />
              {saving ? "Saving..." : `Send${selectedCustomer ? " to " + (selectedCustomer.companyName || selectedCustomer.name).split(" ")[0] : ""}`}
            </button>
            <button
              type="button"
              onClick={() => setView("preview")}
              style={{
                ...ghostBtn,
                width: "100%", justifyContent: "center", padding: "9px 0",
              }}
            >
              <Eye size={13} /> Preview document
            </button>
          </div>
        </div>

      </div>
    </EditorSplit>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED SETTINGS (collapsible)
// ─────────────────────────────────────────────────────────────────────────────
function AdvancedSettings(props) {
  const [open, setOpen] = useState(true);
  const {
    companySettings,
    placeOfSupplyCode,
    setPlaceOfSupply,
    setPlaceOfSupplyCode,
    reverseCharge,
    setReverseCharge,
    templateId,
    setTemplateId,
    templates,
    gstCategory,
    setGstCategory,
    paymentMethods,
    setPaymentMethods,
    servicePeriodFrom,
    setServicePeriodFrom,
    servicePeriodTo,
    setServicePeriodTo,
    projects,
    projectId,
    setProjectId,
    currency,
    setCurrency,
    exchangeRate,
    setExchangeRate,
  } = props;

  return (
    <div
      style={{
        background: "#FFF",
        border: "1px solid #EEEEF0",
        borderRadius: "var(--rcard)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.035)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "14px 22px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#374151" }}>Advanced settings</span>
        <Icon name={open ? "chevronDown" : "chevronRight"} size={15} color="#9CA3AF" />
      </button>

      {open && (
        <div style={{ padding: "4px 22px 20px", borderTop: "1px solid #F3F4F6" }}>
          <div className="inv-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <div>
              <p style={labelStyle}>Place of Supply</p>
              <CustomSelect
                searchable
                value={placeOfSupplyCode}
                onChange={(v) => {
                  const st = INDIAN_STATES.find(s => s.code === v);
                  setPlaceOfSupplyCode(v);
                  setPlaceOfSupply(st?.name || "");
                }}
                placeholder="Select State"
                options={INDIAN_STATES.map(s => ({ value: s.code, label: `${s.name} (${s.code})` }))}
              />
            </div>
            <div>
              <p style={labelStyle}>GST Category</p>
              <CustomSelect
                value={gstCategory}
                onChange={setGstCategory}
                options={GST_CATEGORIES}
              />
            </div>
            <div>
              <p style={labelStyle}>Template</p>
              <CustomSelect
                value={String(templateId)}
                onChange={(v) => setTemplateId(Number(v))}
                options={templates.map(t => ({ value: String(t.id), label: t.name }))}
              />
            </div>
            <div>
              <p style={labelStyle}>Invoice Currency</p>
              <CustomSelect
                searchable
                value={currency}
                onChange={setCurrency}
                options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol ? c.symbol + " " : ""}${c.name}` }))}
              />
            </div>
            {currency !== "INR" && (
              <div>
                <p style={labelStyle}>Exchange Rate (1 {currency} = ? INR)</p>
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1.0)}
                  className="inv-inp"
                  style={inpStyle}
                  placeholder="e.g. 83.45"
                />
              </div>
            )}

          </div>

          {/* Service period */}
          <div style={{ marginTop: 14, padding: 12, background: "#F9FAFB", borderRadius: 9, border: "1px solid #E5E7EB" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
              Service Period (Optional)
            </p>
            <div className="inv-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <DatePickerInput
                id="service-period-from"
                label="From"
                value={servicePeriodFrom}
                onChange={setServicePeriodFrom}
                placeholder="dd/mm/yyyy"
              />
              <DatePickerInput
                id="service-period-to"
                label="To"
                value={servicePeriodTo}
                onChange={setServicePeriodTo}
                placeholder="dd/mm/yyyy"
              />
            </div>
          </div>

          {/* Payment Methods */}
          <div style={{ marginTop: 14 }}>
            <p style={labelStyle}>Payment Methods</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PAYMENT_METHODS.map(({ value, label }) => {
                const selected = paymentMethods.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setPaymentMethods((prev) =>
                        prev.includes(value)
                          ? prev.filter((v) => v !== value)
                          : [...prev, value],
                      )
                    }
                    style={{
                      padding: "6px 12px", borderRadius: 100,
                      border: selected ? "1.5px solid #E11D2C" : "1.5px solid #E5E7EB",
                      background: selected ? "#FEF2F2" : "#FAFAFA",
                      color: selected ? "#E11D2C" : "#374151",
                      fontSize: 12, fontWeight: selected ? 600 : 400,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {selected ? "✓ " : ""}{label}
                  </button>
                );
              })}
            </div>
            {/* Bank/UPI preview */}
            {companySettings && (paymentMethods.includes("bank_transfer") || paymentMethods.includes("upi")) && (
              <div style={{ marginTop: 10, padding: "10px 12px", background: "#FEF2F2", borderRadius: 9, border: "1px solid #FECACA" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: "#E11D2C", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Auto-filled from your profile
                  </p>
                  <a href="/settings" style={{ fontSize: 11, color: "#E11D2C", fontWeight: 600, textDecoration: "none" }}>Edit →</a>
                </div>
                {paymentMethods.includes("bank_transfer") && companySettings.bankName && (
                  <>
                    <p style={{ fontSize: 11.5, color: "#374151", margin: "0 0 1px" }}>Bank: <strong>{companySettings.bankName}</strong></p>
                    <p style={{ fontSize: 11.5, color: "#374151", margin: "0 0 1px", fontFamily: "monospace" }}>A/C: {companySettings.accountNumber || "Not set"}</p>
                    <p style={{ fontSize: 11.5, color: "#374151", margin: 0, fontFamily: "monospace" }}>IFSC: {companySettings.ifsc || "Not set"}</p>
                  </>
                )}
                {paymentMethods.includes("upi") && companySettings.upiId && (
                  <p style={{ fontSize: 11.5, color: "#374151", margin: paymentMethods.includes("bank_transfer") ? "5px 0 0" : 0 }}>
                    UPI: <strong style={{ fontFamily: "monospace" }}>{companySettings.upiId}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Reverse charge */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5, color: "#374151", fontWeight: 500, marginTop: 14 }}>
            <input
              type="checkbox"
              checked={reverseCharge}
              onChange={(e) => setReverseCharge(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: "#E11D2C" }}
            />
            Reverse Charge Applicable (Recipient pays GST)
          </label>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY ROW helper
// ─────────────────────────────────────────────────────────────────────────────
function SummaryRow({ label, value, valueColor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor || "#0A0A0A", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";
import { api } from "@/utils/api";
import * as XLSX from "xlsx";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DatePickerInput from "@/components/ui/DatePickerInput";
import CustomSelect from "@/components/ui/CustomSelect";
import useUpload from "@/utils/useUpload";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { useClickOutside } from "@/components/ui/use-click-outside";
import { Card, Chip, Avatar, MiniStat, Pagination, ghostBtn, rowIcon, thStyle, tdStyle } from "@/components/studio/primitives";
import { Icon } from "@/components/studio/icons";
import { formatMoney, formatDate, CURRENCIES, CURRENCY_SYMBOLS } from "@/utils/format";
import {
  Upload, FileText, FileSpreadsheet,
  TrendingDown, AlertCircle, CheckCircle2, Clock, Ban,
  Wallet, Building2, User, Monitor, Briefcase, Car, DollarSign,
  Edit, Trash2, Check, X,
} from "lucide-react";
import { useAuth } from "@/utils/auth";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut } from "@/components/ui/context-menu";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction, AttachmentTrigger } from "@/components/ui/attachment";
import { Skeleton } from "@/components/ui/skeleton";


// ── PayBadge (local) ──────────────────────────────────────────────────────────
const PAY_STATUS = {
  paid:           { bg: "#DCFCE7", color: "#15803D", dot: "#22C55E", label: "Paid" },
  due:            { bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B", label: "Due" },
  approved:       { bg: "#FEF3C7", color: "#B45309", dot: "#F59E0B", label: "Due" },
  scheduled:      { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", label: "Scheduled" },
  pending:        { bg: "#FFF7ED", color: "#C2410C", dot: "#F97316", label: "Pending approval" },
  rejected:       { bg: "#FEE2E2", color: "#B91C1C", dot: "#EF4444", label: "Rejected" },
  overdue:        { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444", label: "Overdue" },
  draft:          { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF", label: "Draft" },
  partially_paid: { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", label: "Partial" },
  cancelled:      { bg: "#F3F4F6", color: "#9CA3AF", dot: "#D1D5DB", label: "Cancelled" },
};

function PayBadge({ status, isOverdue }) {
  const key = isOverdue && status !== "paid" && status !== "cancelled" ? "overdue" : status;
  const s = PAY_STATUS[key] || PAY_STATUS.draft;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 8px", background: s.bg, borderRadius: 100, fontSize: 11.5, fontWeight: 650, color: s.color, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {s.label}
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
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

const TONES = ["#E11D2C","#2563EB","#16A34A","#F59E0B","#7C3AED","#0891B2","#EA580C","#DB2777"];
function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const CATEGORIES = [
  { value: "travel",            label: "Travel",             icon: Car },
  { value: "petrol",            label: "Petrol",             icon: Car },
  { value: "marketing",         label: "Marketing",          icon: TrendingDown },
  { value: "software",          label: "Software",           icon: Monitor },
  { value: "salary",            label: "Salary",             icon: DollarSign },
  { value: "freelancer",        label: "Freelancer",         icon: User },
  { value: "freelancer_payout", label: "Freelancer Payout",  icon: User },
  { value: "subscription",      label: "Subscription",       icon: Monitor },
  { value: "utility",           label: "Utility",            icon: Building2 },
  { value: "equipment",         label: "Equipment",          icon: Building2 },
  { value: "internet",          label: "Internet",           icon: Monitor },
  { value: "food",              label: "Food",               icon: Wallet },
  { value: "other",             label: "Other",              icon: Wallet },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c]));


const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi",           label: "UPI" },
  { value: "cash",          label: "Cash" },
  { value: "cheque",        label: "Cheque" },
  { value: "card",          label: "Card" },
];

const EMPTY_FORM = {
  title: "", description: "", category: "other",
  vendorId: "", employeeId: "", payee: "",
  amount: "", tax: "0", receiptUrl: "", receiptObjectKey: "", project: "", projectId: "",
  billDate: new Date().toISOString().split("T")[0],
  dueDate: "", referenceNumber: "", notes: "", quickPay: false,
  currency: "INR",
  exchangeRate: 1.0,
  inrCharged: "", // for foreign currency: actual INR debited (bank/card incl. forex markup)
  isRcm: false, rcmSection: "", rcmRate: "18", itcEligibility: "", // GST buy-side; "" = auto by category
  tdsSection: "", tdsRate: "", // TDS we deduct on this bill (income-tax)
};

// TDS sections (income-tax) with default rates — FY 2026-27.
const TDS_SECTION_OPTS = [
  { value: "", label: "No TDS", rate: 0 },
  { value: "194C", label: "194C — Contractor", rate: 2 },
  { value: "194J", label: "194J — Professional fees", rate: 10 },
  { value: "194J-T", label: "194J — Technical (2%)", rate: 2 },
  { value: "194H", label: "194H — Commission", rate: 2 },
  { value: "194I", label: "194I — Rent (land/bldg)", rate: 10 },
  { value: "194I-P", label: "194I — Rent (plant)", rate: 2 },
  { value: "194Q", label: "194Q — Purchase of goods", rate: 0.1 },
];
const TDS_RATE = Object.fromEntries(TDS_SECTION_OPTS.map((o) => [o.value, o.rate]));

const EMPTY_PAYMENT = {
  amount: "", paymentDate: new Date().toISOString().split("T")[0],
  paymentMethod: "bank_transfer", referenceNumber: "", notes: "", receiptUrl: "",
  currency: "INR",
  exchangeRate: 1.0,
};

const PER_PAGE = 8;

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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PayablesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link: /payables?edit=<id> opens the full edit drawer (used by the bill detail "Edit Expense" button).
  // Ref-guarded (not a cancel flag) so StrictMode's double-mount doesn't cancel the open.
  const handledEditRef = useRef(null);
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || handledEditRef.current === editId) return;
    handledEditRef.current = editId;
    (async () => {
      try {
        const data = await api.get(`/api/bills/${editId}`);
        const full = data.bill || data;
        if (full && full.id) openEdit(full, { stopPropagation: () => {} });
      } catch (err) { console.error("Failed to open edit drawer:", err); }
      finally {
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const [upload, { loading: uploading }] = useUpload();
  const [bills, setBills] = useState([]);
  const [allBills, setAllBills] = useState([]); // for tab counts
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState(() => {
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search).get("vendor_id") || "";
    return "";
  });
  const [activeTab, setActiveTab] = useState(
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "pending"
      ? "pending" : "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);
  useClickOutside(exportRef, () => setExportOpen(false));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);
  useClickOutside(filtersRef, () => setFiltersOpen(false));
  const [rowMenu, setRowMenu] = useState(null); // bill id with open menu
  const rowMenuRef = useRef(null);
  useClickOutside(rowMenuRef, () => setRowMenu(null));
  const [outstanding, setOutstanding] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [fyStats, setFyStats] = useState({ paidFy: 0, tdsFy: 0, fyLabel: "" });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "billDate", dir: "desc" });

  // Vendors + employees + projects for dropdowns
  const [vendors, setVendors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);

  // Modals
  const [billModal, setBillModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [aiDragOver, setAiDragOver] = useState(false);
  const receiptInputRef = useRef(null);

  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState(EMPTY_PAYMENT);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("Done");
  const [shakeError, setShakeError] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payReceiptUploading, setPayReceiptUploading] = useState(false);

  const [confirmState, setConfirmState] = useState(null);

  // AI Receipt Parsing States
  const [parsing, setParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");


  const inp = { width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, color: "#0A0A0A", background: "#FAFAFA", boxSizing: "border-box", outline: "none" };

  async function handleReceiptParse(file) {
    if (!file) return;

    setParsing(true);
    setParsingStatus("Uploading receipt to bucket...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // AI status timeline for dynamic loading micro-animations
      const steps = [
        "Analyzing receipt layout (Unstructured.io)...",
        "Extracting items and taxes (Unstructured.io)...",
        "Structuring bill fields (Nvidia NIM LLM)...",
        "Auto-filling bill form details...",
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep < steps.length - 1) {
          setParsingStatus(steps[currentStep]);
          currentStep++;
        }
      }, 2500);

      // 1. Upload receipt to Cloudflare R2 bucket
      const uploadRes = await upload({ file });
      if (uploadRes.error) {
        throw new Error(uploadRes.error);
      }

      const receiptUrl = uploadRes.url;
      const receiptObjectKey = uploadRes.objectKey || "";

      // 2. Call backend receipt parser
      const token = localStorage.getItem("modus_auth_token");
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/bills/parse-receipt", {
        method: "POST",
        headers,
        body: formData,
      });

      clearInterval(interval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Parsing failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.bill) {
        const b = data.bill;
        let matchV = "";
        let matchPayee = b.title || "";
        let isFreelancer = false;

        if (b.title) {
          const tLower = b.title.toLowerCase();
          const match = vendors.find(v => (v.name && v.name.toLowerCase().includes(tLower)) || tLower.includes(v.name?.toLowerCase() || "") || (v.companyName && (v.companyName.toLowerCase().includes(tLower) || tLower.includes(v.companyName.toLowerCase()))));
          if (match) {
            matchV = String(match.id);
            matchPayee = match.companyName || match.name;
            if (match.category === "freelancer") {
              isFreelancer = true;
            }
          }
        }

        setForm((f) => ({
          ...f,
          title: b.title || f.title,
          category: b.category || f.category,
          amount: b.amount || f.amount,
          tax: b.tax || f.tax || 0,
          billDate: b.billDate || f.billDate,
          dueDate: b.dueDate || f.dueDate,
          referenceNumber: b.referenceNumber || f.referenceNumber,
          notes: b.notes || f.notes,
          receiptUrl: receiptUrl,
          receiptObjectKey: receiptObjectKey,
          vendorId: matchV || f.vendorId,
          payee: matchPayee,
          itcEligibility: isFreelancer ? "ineligible_others" : f.itcEligibility,
          tdsSection: isFreelancer ? "194J" : f.tdsSection,
          tdsRate: isFreelancer ? "10" : f.tdsRate,
        }));
        toast.success(`Receipt parsed successfully by ${data.provider}!`);
      } else {
        throw new Error("No structured bill details were returned by the AI.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Receipt parsing failed: " + err.message);
    } finally {
      setParsing(false);
      setParsingStatus("");
      e.target.value = "";
    }
  }


  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadBills(); }, [debouncedSearch, statusFilter, vendorFilter, categoryFilter, fromDate, toDate, activeTab]);

  useEffect(() => {
    function handleSearch(e) { setSearch(e.detail); setPage(1); }
    function handleDate(e) { 
      setFromDate(e.detail.from); 
      setToDate(e.detail.to); 
      setPage(1);
    }
    window.addEventListener("modus-global-search", handleSearch);
    window.addEventListener("modus-global-date", handleDate);
    return () => {
      window.removeEventListener("modus-global-search", handleSearch);
      window.removeEventListener("modus-global-date", handleDate);
    };
  }, []);

  // Filter bills for tab counts
  useEffect(() => {
    api.get("/api/bills?limit=500").then(d => setAllBills(d.bills || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/api/vendors?limit=500").then(d => setVendors(d.vendors || [])).catch(() => {});
    api.get("/api/employees").then(d => setEmployees(d.employees || [])).catch(() => {});
    api.get("/api/projects").then(d => setProjects(d.projects || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.currency === "INR") {
      setForm(f => ({ ...f, exchangeRate: "1.0" }));
      return;
    }
    // Only fetch if we're not setting the edit bill's initial state
    if (editBill && editBill.currency === form.currency) {
      return;
    }
    fetch(`https://open.er-api.com/v6/latest/${form.currency}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.rates && data.rates.INR) {
          setForm(f => ({ ...f, exchangeRate: String(data.rates.INR) }));
        }
      })
      .catch((err) => console.error("Error fetching exchange rate:", err));
  }, [form.currency, editBill]);

  async function loadBills(silent = false) {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      // For "unpaid" tab, load all and filter client-side
      if (statusFilter && activeTab !== "unpaid") params.append("status", statusFilter);
      if (categoryFilter) params.append("category", categoryFilter);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (vendorFilter) params.append("vendor_id", vendorFilter);
      const data = await api.get(`/api/bills?${params}`);
      setBills(data.bills || []);
      setOutstanding(data.outstanding || 0);
      setOverdueCount(data.overdueCount || 0);
      setFyStats({ paidFy: data.paidFy || 0, tdsFy: data.tdsFy || 0, fyLabel: data.fyLabel || "" });
      setPage(1);
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  }

  function openAdd() {
    setEditBill(null);
    setForm({ ...EMPTY_FORM, billDate: new Date().toISOString().split("T")[0] });
    setBillModal(true);
  }

  function openEdit(bill, e) {
    e.stopPropagation();
    setEditBill(bill);
    setForm({
      title: bill.title || "",
      description: bill.description || "",
      category: bill.category || "other",
      vendorId: bill.vendorId ? String(bill.vendorId) : "",
      employeeId: bill.employeeId ? String(bill.employeeId) : "",
      payee: bill.payee || "",
      // Bills are stored INR-primary; for foreign bills show the original foreign amount + currency,
      // with the stored INR amount as "inrCharged".
      amount: bill.foreignCurrency ? String(bill.foreignAmount ?? "") : String(bill.amount || ""),
      tax: String(bill.tax || "0"),
      receiptUrl: bill.receiptUrl || "",
      receiptObjectKey: bill.receiptObjectKey || "",
      project: bill.project || "",
      projectId: bill.projectId ? String(bill.projectId) : "",
      billDate: bill.billDate ? bill.billDate.split("T")[0] : new Date().toISOString().split("T")[0],
      dueDate: bill.dueDate ? bill.dueDate.split("T")[0] : "",
      referenceNumber: bill.referenceNumber || "",
      notes: bill.notes || "",
      quickPay: false,
      currency: bill.foreignCurrency || "INR",
      exchangeRate: String(bill.exchangeRate || "1.0"),
      inrCharged: bill.foreignCurrency ? String(bill.amount || "") : "",
      isRcm: !!bill.isRcm,
      rcmSection: bill.rcmSection || "",
      rcmRate: String(bill.rcmRate || "18"),
      itcEligibility: bill.itcEligibility || "",
      tdsSection: bill.tdsSection || "",
      tdsRate: bill.tdsRate ? String(bill.tdsRate) : "",
    });
    setBillModal(true);
  }

  function update(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function uploadReceipt(file) {
    if (!file) return;
    try {
      const res = await upload({ file });
      if (res.error) { toast.error(res.error); return; }
      if (res.url) {
        update("receiptUrl", res.url);
        update("receiptObjectKey", res.objectKey || "");
      }
    } catch (err) { toast.error("Upload failed: " + err.message); }
  }

  function triggerError(msg) {
    toast.error(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  }

  async function handleSave() {
    if (!form.vendorId && !form.employeeId && !form.payee?.trim()) { triggerError("Pick a vendor/employee or enter who you paid"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { triggerError("Valid amount required"); return; }
    if (!form.billDate) { triggerError("Bill date is required"); return; }
    if ((form.category === "reimbursement" || form.category === "salary") && !form.employeeId) { triggerError("Select an employee"); return; }
    if (form.currency !== "INR" && (!form.inrCharged || parseFloat(form.inrCharged) <= 0)) {
      triggerError("Enter the INR amount actually charged"); return;
    }
    if (form.itcEligibility === "eligible" && !form.referenceNumber?.trim()) {
      triggerError("Eligible ITC requires the supplier invoice number (reference number)"); return;
    }

    // For foreign currency, derive the exchange rate from the actual INR charged.
    let exchangeRate = 1.0;
    if (form.currency !== "INR") {
      const amt = parseFloat(form.amount) || 0;
      const inr = parseFloat(form.inrCharged) || 0;
      exchangeRate = amt > 0 ? inr / amt : parseFloat(form.exchangeRate || 1.0);
    }

    let generatedTitle = form.title;
    if (!generatedTitle?.trim()) {
      const vName = vendors.find(v => v.id === parseInt(form.vendorId))?.name;
      const eName = employees.find(e => e.id === parseInt(form.employeeId))?.name;
      generatedTitle = vName || eName || form.payee || "Bill";
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        title: generatedTitle,
        amount: parseFloat(form.amount),
        tax: parseFloat(form.tax || 0),
        exchangeRate,
      };
      let createdStatus = null;
      if (editBill) {
        await api.put(`/api/bills/${editBill.id}`, payload);
        toast.success("Expense updated");
      } else {
        const created = await api.post("/api/bills", payload);
        createdStatus = created?.status;
      }
      setBillModal(false);
      // Polished confirmation overlay instead of relying on toast styling.
      if (!editBill) {
        setSuccessMsg(createdStatus === "pending" ? "Sent for approval" : "Expense recorded");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1600);
      }
      // Silent refresh — keeps the list visible (no full-card spinner).
      loadBills(true);
      api.get("/api/bills?limit=500").then(d => setAllBills(d.bills || [])).catch(() => {});
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setSaving(false); }
  }

  function openPay(bill, e) {
    e.stopPropagation();
    setPayModal(bill);
    setPayForm({
      ...EMPTY_PAYMENT,
      paymentDate: new Date().toISOString().split("T")[0],
      amount: String(bill.amountDue || ""),
      currency: bill.currency || "INR",
      exchangeRate: String(bill.exchangeRate || "1.0"),
    });
  }

  async function handlePayment() {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error("Valid amount required"); return; }
    if (!payForm.paymentDate) { toast.error("Payment date required"); return; }
    setPaying(true);
    try {
      await api.post(`/api/bills/${payModal.id}/payments`, {
        amount: parseFloat(payForm.amount),
        paymentDate: payForm.paymentDate,
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber,
        notes: payForm.notes,
        receiptUrl: payForm.receiptUrl || null,
        currency: payForm.currency || payModal.currency || "INR",
        exchangeRate: parseFloat(payForm.exchangeRate || payModal.exchangeRate || 1.0),
      });
      setPayModal(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
      loadBills();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setPaying(false); }
  }

  function handleDelete(bill, e) {
    e.stopPropagation();
    setConfirmState({
      title: "Delete Bill",
      message: `Delete "${bill.title}"? This cannot be undone.`,
      confirmLabel: "Delete Bill",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/bills/${bill.id}`); loadBills(); }
        catch (err) { toast.error(err.message); }
      },
    });
  }

  function handleCancel(bill, e) {
    e.stopPropagation();
    setConfirmState({
      title: "Cancel Bill",
      message: `Mark "${bill.title}" as cancelled?`,
      confirmLabel: "Cancel Bill",
      danger: false,
      onConfirm: async () => {
        try { await api.put(`/api/bills/${bill.id}`, { status: "cancelled" }); loadBills(); }
        catch (err) { toast.error(err.message); }
      },
    });
  }

  async function handleApprove(bill, e) {
    e?.stopPropagation();
    try {
      await api.post(`/api/bills/${bill.id}/review`, { action: "approve" });
      toast.success(`Approved — ${bill.title}`);
      loadBills();
    } catch (err) { toast.error(err.message || "Approve failed"); }
  }

  function handleReject(bill, e) {
    e?.stopPropagation();
    setConfirmState({
      title: "Reject Expense",
      message: `Reject "${bill.title}"? Add an optional reason for the submitter.`,
      confirmLabel: "Reject",
      danger: true,
      withInput: true,
      inputPlaceholder: "Reason (optional)",
      onConfirm: async (reason) => {
        try {
          await api.post(`/api/bills/${bill.id}/review`, { action: "reject", reason: reason || null });
          toast.success(`Rejected — ${bill.title}`);
          loadBills();
        } catch (err) { toast.error(err.message || "Reject failed"); }
      },
    });
  }

  async function exportPDF() {
    setExportOpen(false);
    const token = localStorage.getItem("modus_auth_token");
    const params = new URLSearchParams();
    if (fromDate) params.append("from", fromDate);
    if (toDate) params.append("to", toDate);
    const res = await fetch(`/api/bills/export?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `MODUS-Expenses-${fromDate || "all"}-to-${toDate || "all"}.pdf`; a.click();
    toast.success("PDF exported");
  }

  function exportExcel() {
    setExportOpen(false);
    const headers = ["Bill #", "Date", "Title", "Vendor / Employee", "Category", "Amount", "Paid", "Due", "Currency", "Exchange Rate", "Status"];
    const rows = bills.map(b => [b.billNumber || "", b.billDate || "", b.title || "", b.vendorName || b.payee || b.employeeName || "", b.category || "", Number((b.amount || 0).toFixed(2)), Number((b.amountPaid || 0).toFixed(2)), Number((b.amountDue || 0).toFixed(2)), b.currency || "INR", b.exchangeRate || 1.0, b.status || ""]);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `MODUS-Expenses-${fromDate || "all"}-to-${toDate || "all"}.xlsx`);
    toast.success("Excel exported");
  }

  function exportCSV() {
    setExportOpen(false);
    const headers = ["Bill #", "Date", "Title", "Vendor / Employee", "Category", "Amount", "Paid", "Due", "Currency", "Exchange Rate", "Status"];
    const rows = bills.map(b => [b.billNumber || "", b.billDate || "", b.title || "", b.vendorName || b.payee || b.employeeName || "", b.category || "", (b.amount || 0).toFixed(2), (b.amountPaid || 0).toFixed(2), (b.amountDue || 0).toFixed(2), b.currency || "INR", b.exchangeRate || 1.0, b.status || ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `MODUS-Expenses-${fromDate || "all"}-to-${toDate || "all"}.csv`; a.click();
    toast.success("CSV exported");
  }

  // Sorting
  function setSortKey(key) {
    setSort(s => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));
    setPage(1);
  }

  // An "open" payable = approved/scheduled with balance due. Excludes paid, cancelled,
  // draft, and the approval-workflow states (pending, rejected) which aren't real expenses yet.
  const isOpenBill = (b) => !["paid", "cancelled", "draft", "pending", "rejected"].includes(b.status);

  const displayedBills = activeTab === "unpaid"
    ? bills.filter(isOpenBill)
    : bills;

  const sorted = [...displayedBills].sort((a, b) => {
    let av = a[sort.key], bv = b[sort.key];
    if (sort.key === "billDate" || sort.key === "dueDate") { av = new Date(av || 0); bv = new Date(bv || 0); }
    if (sort.key === "amount" || sort.key === "amountDue") { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    if (av < bv) return sort.dir === "asc" ? -1 : 1;
    if (av > bv) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const pageRows = sorted.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);

  // Amounts are already stored in INR (foreign bills convert on write), so no exchangeRate multiply here.
  const totalDue = allBills.filter(isOpenBill).reduce((s, b) => s + (b.amountDue || 0), 0);
  const paidBills = allBills.filter(b => b.status === "paid");
  // Avg expense stays gross and all-time — it answers "how big is a typical bill",
  // not "what left the bank this year" (that's fyStats, computed server-side).
  const paidGross = paidBills.reduce((s, b) => s + (b.amount || 0), 0);
  // Cash the vendors actually received + TDS withheld for the govt = gross booked.
  const fyGross = fyStats.paidFy + fyStats.tdsFy;
  const overdueBills = allBills.filter(b => b.isOverdue && isOpenBill(b));
  const overdueAmt = overdueBills.reduce((s, b) => s + (b.amountDue || 0), 0);

  function tabCount(val) {
    if (val === "") return allBills.length;
    if (val === "unpaid") return allBills.filter(isOpenBill).length;
    return allBills.filter(b => b.status === val).length;
  }

  return (
    <AppShell>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes filterDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .pay-inp:focus { border-color: ${ACCENT} !important; background: #FFF !important; box-shadow: 0 0 0 3px ${ACCENT}08 !important; outline: none !important; }
        .cat-pill { transition: all 0.12s; cursor: pointer; }
        .cat-pill:hover { border-color: ${ACCENT} !important; color: ${ACCENT} !important; }
        .cat-pill.active { background: ${ACCENT}08 !important; border-color: ${ACCENT} !important; color: ${ACCENT} !important; font-weight: 600 !important; }
        .row-menu-btn:hover { background: #F3F4F6 !important; }
      `}</style>

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      {showSuccess && typeof window !== "undefined" && createPortal(
        <div className="sheet-backdrop" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,10,0.18)", backdropFilter: "blur(2px)", animation: "filterDown .15s ease" }}>
          <div className="sheet-card" style={{ background: "#fff", borderRadius: 20, padding: "30px 40px", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minWidth: 240 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="34" height="34" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <p style={{ fontSize: 15.5, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{successMsg}</p>
          </div>
        </div>,
        document.body
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 4 MiniStats */}
          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <MiniStat label="Total Payable" value={formatMoney(outstanding || totalDue, "INR")} icon="wallet" tint="#F59E0B" sub={`${allBills.filter(isOpenBill).length} open bills`} />
            <MiniStat
              label={fyStats.fyLabel ? `Paid (FY ${fyStats.fyLabel})` : "Paid"}
              value={formatMoney(fyStats.paidFy, "INR")}
              icon="handCoins"
              tint="#22C55E"
              sub={fyStats.tdsFy > 0
                ? `${formatMoney(fyStats.tdsFy, "INR")} TDS · ${formatMoney(fyGross, "INR")} gross`
                : "Across all vendors"}
            />
            <MiniStat label="Overdue" value={`${overdueBills.length} bills`} icon="circleAlert" tint="#EF4444" sub={formatMoney(overdueAmt, "INR") + " past due"} />
            <MiniStat label="Avg Expense" value={formatMoney(paidBills.length ? paidGross / paidBills.length : 0, "INR")} icon="sigma" tint="#0891B2" sub="Average paid" />
          </div>

          {/* Main card */}
          <Card pad={0}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "14px 20px", borderBottom: "1px solid #F2F2F4", flexWrap: "wrap" }}>
              {/* Status tabs */}
              <Tabs value={activeTab} onValueChange={(v) => {
                setActiveTab(v);
                setStatusFilter(v === "all" ? "" : v === "unpaid" ? "" : v);
                setPage(1);
              }}>
                <TabsList style={{ background: "#F1F1F3", borderRadius: 9, padding: 2, height: "auto", gap: 2 }}>
                  {[
                    { value: "all", label: "All" },
                    { value: "pending", label: "Pending" },
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Export */}
                <div ref={exportRef} style={{ position: "relative" }}>
                  <button type="button" onClick={() => setExportOpen(o => !o)} style={ghostBtn}>
                    <Icon name="download" size={15} /> Export
                  </button>
                  {exportOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", minWidth: 178 }}>
                      {[
                        { label: "Export as PDF",   lucide: FileText,        color: "#E11D2C", bg: "#FEF2F2", action: exportPDF },
                        { label: "Export as Excel", lucide: FileSpreadsheet, color: "#059669", bg: "#F0FDF4", action: exportExcel },
                        { label: "Export as CSV",   lucide: null,            color: "#374151", bg: "#F3F4F6", action: exportCSV },
                      ].map(({ label, lucide: Lucide, color, bg, action }) => (
                        <button key={label} type="button" onClick={action}
                          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500, font: "inherit" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <div style={{ width: 28, height: 28, background: bg, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {Lucide ? <Lucide size={14} color={color} /> : <Icon name="download" size={14} color={color} />}
                          </div>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Record bill */}
                <button type="button" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", background: ACCENT, color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 650, border: "none", cursor: "pointer", whiteSpace: "nowrap", boxShadow: `0 4px 12px ${ACCENT}38` }}>
                  <Icon name="plus" size={15} strokeWidth={2.4} /> Record Bill
                </button>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div>
                {[...Array(7)].map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid #F2F2F4" }}>
                    <div style={{ flex: "0 0 100px" }}>
                      <Skeleton style={{ height: 13, borderRadius: 6, marginBottom: 5 }} />
                      <Skeleton style={{ height: 10, borderRadius: 6, width: "65%" }} />
                    </div>
                    <Skeleton style={{ flex: 1, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 90, height: 22, borderRadius: 100 }} />
                    <Skeleton style={{ width: 80, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 76, height: 13, borderRadius: 6 }} />
                    <Skeleton style={{ width: 64, height: 22, borderRadius: 100 }} />
                    <Skeleton style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            ) : displayedBills.length === 0 ? (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
                style={{ padding: "60px 24px", textAlign: "center" }}
              >
                <motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ width: 56, height: 56, borderRadius: 16, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Icon name="receipt" size={26} color="#E11D2C" />
                </motion.div>
                <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>No expenses yet</motion.p>
                <motion.p variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>Create your first bill or expense</motion.p>
                <motion.button variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }} type="button" onClick={openAdd} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff", padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}>
                  <Icon name="plus" size={15} /> New Bill
                </motion.button>
              </motion.div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                  <thead>
                    <tr>
                      <SortHead k="billNumber" sort={sort} setSortKey={setSortKey}>Bill</SortHead>
                      <SortHead k="vendorName" sort={sort} setSortKey={setSortKey}>Vendor</SortHead>
                      <th style={thStyle}>Category</th>
                      <SortHead k="dueDate" sort={sort} setSortKey={setSortKey}>Due date</SortHead>
                      <SortHead k="amount" align="right" sort={sort} setSortKey={setSortKey}>Amount</SortHead>
                      <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                      <th style={{ ...thStyle, textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <motion.tbody
                    initial="hidden"
                    animate="show"
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                  >
                    {pageRows.map(bill => {
                      const cat = CAT_MAP[bill.category] || CAT_MAP.other;
                      const partyName = bill.vendorName || bill.payee || bill.employeeName || "—";
                      const noopEvent = { stopPropagation: () => {} };
                      return (
                        <ContextMenu key={bill.id}>
                          <ContextMenuTrigger asChild>
                            <motion.tr
                              variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                              style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer", transition: "background .12s" }}
                              onClick={() => navigate(`/payables/${bill.id}`)}
                              onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                              {/* Bill number + title */}
                              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                                <div style={{ fontWeight: 700, color: "#0A0A0A", fontSize: 13 }}>{bill.billNumber || bill.title}</div>
                                {bill.billNumber && <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 400, marginTop: 1 }}>{bill.title}</div>}
                              </td>

                              {/* Vendor + subline */}
                              <td style={tdStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ minWidth: 0 }}>
                                    <HoverCard openDelay={300} closeDelay={100}>
                                      <HoverCardTrigger asChild>
                                        <p style={{ margin: 0, fontWeight: 600, color: "#0A0A0A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160, cursor: "default" }}>
                                          {partyName}
                                        </p>
                                      </HoverCardTrigger>
                                      <HoverCardContent style={{ width: 240, padding: "14px 16px", borderRadius: 14, border: "1px solid #E5E7EB", boxShadow: "0 8px 24px rgba(0,0,0,.1)", background: "#fff", fontFamily: "inherit" }} side="right">
                                        <div>
                                          <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 10px" }}>{partyName}</p>
                                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Bill amount</span>
                                              <span style={{ fontSize: 12, fontWeight: 650, color: "#0A0A0A" }}>{formatMoney(bill.amount, bill.currency)}</span>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Category</span>
                                              <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{bill.category || "—"}</span>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Due date</span>
                                              <span style={{ fontSize: 12, fontWeight: 600, color: bill.isOverdue ? "#E11D2C" : "#374151" }}>{bill.dueDate ? formatDate(bill.dueDate) : "—"}</span>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                              <span style={{ fontSize: 11, color: "#9CA3AF" }}>Status</span>
                                              <PayBadge status={bill.status} isOverdue={bill.isOverdue} />
                                            </div>
                                          </div>
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                    <p style={{ margin: 0, fontSize: 11, color: "#A9ACB3" }}>{bill.referenceNumber ? `Ref: ${bill.referenceNumber}` : bill.tax > 0 ? "GST input credit" : ""}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Category chip */}
                              <td style={tdStyle}>
                                <Chip>{cat.label}</Chip>
                              </td>

                              {/* Due date */}
                              <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                                <span style={{ fontSize: 13, color: bill.isOverdue ? "#DC2626" : "#374151", fontWeight: bill.isOverdue ? 600 : 400, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  {bill.isOverdue && <AlertCircle size={12} color="#DC2626" />}
                                  {bill.dueDate ? formatDate(bill.dueDate) : "—"}
                                </span>
                              </td>

                              {/* Amount */}
                              <td style={{ ...tdStyle, fontWeight: 700, color: "#0A0A0A", whiteSpace: "nowrap" }}>
                                {formatMoney(bill.tdsAmount > 0 ? bill.netPayable : bill.amount, bill.currency)}
                                {bill.tdsAmount > 0 && (
                                  <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}>after TDS (bill {formatMoney(bill.amount, bill.currency)})</span>
                                )}
                                {bill.foreignCurrency && (
                                  <span style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}>{formatMoney(bill.foreignAmount, bill.foreignCurrency)}</span>
                                )}
                              </td>

                              {/* PayBadge */}
                              <td style={tdStyle}>
                                <PayBadge status={bill.status} isOverdue={bill.isOverdue} />
                              </td>

                              {/* ··· context menu */}
                              <td style={{ ...tdStyle, textAlign: "right", width: 40 }} onClick={e => e.stopPropagation()}>
                                <div style={{ position: "relative", display: "inline-block" }} ref={rowMenu === bill.id ? rowMenuRef : null}>
                                  <button type="button" className="row-menu-btn"
                                    onClick={e => { e.stopPropagation(); setRowMenu(id => id === bill.id ? null : bill.id); }}
                                    style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 18, letterSpacing: 1 }}>
                                    ···
                                  </button>
                                  {rowMenu === bill.id && (
                                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 300, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.12)", minWidth: 160, overflow: "hidden", animation: "filterDown .12s ease" }}>
                                      {isSuperAdmin && bill.status === "pending" && (
                                        <>
                                          <button type="button" onClick={e => { setRowMenu(null); handleApprove(bill, e); }}
                                            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#059669", cursor: "pointer", fontWeight: 600, font: "inherit" }}
                                            onMouseEnter={e => e.currentTarget.style.background = "#F0FDF4"}
                                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <Check size={14} /> Approve
                                          </button>
                                          <button type="button" onClick={e => { setRowMenu(null); handleReject(bill, e); }}
                                            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#DC2626", cursor: "pointer", fontWeight: 600, font: "inherit" }}
                                            onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <X size={14} /> Reject
                                          </button>
                                          <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }} />
                                        </>
                                      )}
                                      {bill.status !== "paid" && bill.status !== "cancelled" && bill.status !== "pending" && bill.status !== "rejected" && (
                                        <button type="button" onClick={e => { setRowMenu(null); openPay(bill, e); }}
                                          style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#059669", cursor: "pointer", fontWeight: 600, font: "inherit" }}
                                          onMouseEnter={e => e.currentTarget.style.background = "#F0FDF4"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                          <CheckCircle2 size={14} /> Record Payment
                                        </button>
                                      )}
                                      <button type="button" onClick={e => { setRowMenu(null); openEdit(bill, e); }}
                                        style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 500, font: "inherit" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                        <Edit size={14} /> Edit
                                      </button>
                                      {bill.status !== "cancelled" && bill.status !== "paid" && (
                                        <button type="button" onClick={e => { setRowMenu(null); handleCancel(bill, e); }}
                                          style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#6B7280", cursor: "pointer", fontWeight: 500, font: "inherit" }}
                                          onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                          <Ban size={14} /> Cancel
                                        </button>
                                      )}
                                      {(bill.status === "draft" || bill.status === "approved") && (
                                        <>
                                          <div style={{ height: 1, background: "#F3F4F6", margin: "4px 0" }} />
                                          <button type="button" onClick={e => { setRowMenu(null); handleDelete(bill, e); }}
                                            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, color: "#EF4444", cursor: "pointer", fontWeight: 500, font: "inherit" }}
                                            onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <Trash2 size={14} /> Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          </ContextMenuTrigger>
                          <ContextMenuContent style={{ minWidth: 180, borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: "1px solid #E5E7EB", fontFamily: "inherit" }}>
                            <ContextMenuItem style={{ fontSize: 13, fontWeight: 500 }} onClick={() => navigate(`/payables/${bill.id}`)}>
                              View bill <ContextMenuShortcut>↵</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuItem style={{ fontSize: 13, fontWeight: 500 }} onClick={() => openEdit(bill, noopEvent)}>
                              Edit <ContextMenuShortcut>E</ContextMenuShortcut>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem style={{ fontSize: 13, fontWeight: 500, color: "#E11D2C" }} onClick={() => handleDelete(bill, noopEvent)}>
                              Delete <ContextMenuShortcut style={{ color: "#E11D2C" }}>⌫</ContextMenuShortcut>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </motion.tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {!loading && sorted.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderTop: "1px solid #F2F2F4", flexWrap: "wrap", gap: 12 }}>
                <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: 0 }}>
                  Showing <strong style={{ color: "#0A0A0A" }}>{(cur - 1) * PER_PAGE + 1}–{Math.min(cur * PER_PAGE, sorted.length)}</strong> of {sorted.length}
                </p>
                <Pagination page={cur} pages={pages} onChange={setPage} accent={ACCENT} />
              </div>
            )}
          </Card>
      </div>

      {/* ── Add/Edit Bill Modal ── */}
      <Drawer open={billModal} onOpenChange={(open) => { if (!open && !saving) setBillModal(false); }} shouldScaleBackground={false}>
        <DrawerContent style={{ maxHeight: "90vh", borderRadius: "20px 20px 0 0", background: "#FFF", display: "flex", flexDirection: "column", border: "none" }}>
          <div style={{ padding: "16px 28px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{editBill ? "Edit Bill" : "New Bill / Expense"}</h2>
            <DrawerClose asChild>
              <button type="button" style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </DrawerClose>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className={shakeError ? "t-shake is-error" : ""}>

          {/* AI Receipt Upload Box */}
          {!editBill && (
            <div style={{
              border: `2px dashed ${aiDragOver ? ACCENT : "#E5E7EB"}`,
              borderRadius: 14,
              padding: "16px 20px",
              background: aiDragOver ? "#FEF2F2" : "#F9FAFB",
              textAlign: "center",
              cursor: parsing ? "not-allowed" : "pointer",
              transform: aiDragOver ? "scale(1.01)" : "scale(1)",
              boxShadow: aiDragOver ? "0 6px 20px rgba(225,29,44,0.12)" : "none",
              transition: "all 0.18s ease",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={e => { if(!parsing && !aiDragOver) e.currentTarget.style.borderColor = ACCENT; }}
            onMouseLeave={e => { if(!parsing && !aiDragOver) e.currentTarget.style.borderColor = "#E5E7EB"; }}
            onDragOver={e => { e.preventDefault(); if(!parsing) setAiDragOver(true); }}
            onDragEnter={e => { e.preventDefault(); if(!parsing) setAiDragOver(true); }}
            onDragLeave={e => { e.preventDefault(); setAiDragOver(false); }}
            onDrop={e => { e.preventDefault(); setAiDragOver(false); if(!parsing) handleReceiptParse(e.dataTransfer.files?.[0]); }}
            >
              <input
                type="file"
                accept="application/pdf,image/*"
                disabled={parsing}
                onChange={e => { handleReceiptParse(e.target.files?.[0]); e.target.value = ""; }}
                style={{ display: "none" }}
                id="receipt-ai-upload"
              />
              <label htmlFor="receipt-ai-upload" style={{ cursor: parsing ? "not-allowed" : "pointer", display: "block" }}>
                {parsing ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 24, height: 24,
                      border: `2.5px solid ${ACCENT}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>AI Scanning Receipt…</p>
                      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>{parsingStatus}</p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                    <div style={{
                      width: 38, height: 38,
                      borderRadius: 10,
                      background: ACCENT + "12",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      <Icon name="sparkle" size={18} color={ACCENT} />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>Auto-fill with AI Receipt Scanner</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 11, color: "#8A8D94", fontWeight: 500 }}>Powered by</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 6px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                            <img src="https://thesvg.org/icons/nvidia/default.svg" style={{ height: 11, width: "auto", display: "block" }} alt="NVIDIA" />
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>NIM</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 6px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                            <img src="https://thesvg.org/icons/cloudflare/default.svg" style={{ height: 11, width: "auto", display: "block" }} alt="Cloudflare" />
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>R2</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </label>
            </div>
          )}


          {/* Category pills */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Category</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {CATEGORIES.map(({ value, label, icon: CatIcon }) => (
                <button type="button" key={value} className={`cat-pill${form.category === value ? " active" : ""}`}
                  onClick={() => update("category", value)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#FFF", fontSize: 12, color: "#374151" }}>
                  <CatIcon size={12} />{label}
                </button>
              ))}
            </div>
          </div>



          {/* Paid to — saved vendor or free-text payee (available for every category) */}
          {form.category !== "reimbursement" && form.category !== "salary" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Saved vendor / employee</label>
                  <CustomSelect value={form.vendorId ? `v:${form.vendorId}` : form.employeeId ? `e:${form.employeeId}` : ""} searchable placeholder="— Pick a vendor or employee —"
                    onChange={v => {
                      if (!v) { update("vendorId", ""); update("employeeId", ""); return; }
                      const [kind, id] = v.split(":");
                      if (kind === "v") {
                        update("vendorId", id); update("employeeId", "");
                        const sel = vendors.find(x => String(x.id) === id);
                        if (sel) {
                          update("payee", sel.companyName || sel.name);
                          if (sel.category === "freelancer") {
                            update("itcEligibility", "ineligible_others");
                            update("tdsSection", "194J");
                            update("tdsRate", "10");
                          }
                        }
                      } else {
                        update("employeeId", id); update("vendorId", "");
                        const sel = employees.find(x => String(x.id) === id);
                        if (sel) update("payee", sel.name);
                      }
                    }}
                    options={[
                      { value: "", label: "— None —" },
                      ...vendors.map(v => ({ value: `v:${v.id}`, label: v.companyName || v.name })),
                      ...employees.map(emp => ({ value: `e:${emp.id}`, label: `${emp.name} (Employee)` })),
                    ]} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>or Paid to (name)</label>
                  <input className="pay-inp" value={form.payee} onChange={e => { update("payee", e.target.value); if (e.target.value) { if (form.vendorId) update("vendorId", ""); if (form.employeeId) update("employeeId", ""); } }} placeholder="e.g. Reliance Digital, local store…" style={inp} />
                </div>
              </div>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "6px 0 0" }}>Recurring supplier? Pick a saved vendor. One-off purchase? Just type the store/person name — no need to create a vendor.</p>
            </div>
          )}

          {(form.category === "reimbursement" || form.category === "salary") && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Employee</label>
              <CustomSelect value={form.employeeId} onChange={v => update("employeeId", v)} placeholder="— None —" options={[{ value: "", label: "— None —" }, ...employees.map(emp => ({ value: emp.id, label: emp.name }))]} />
            </div>
          )}

          {/* Ref # */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Their Invoice / Ref #</label>
            <input className="pay-inp" value={form.referenceNumber} onChange={e => update("referenceNumber", e.target.value)} placeholder="Their invoice number" style={inp} />
          </div>

          {/* Currency Selection */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Currency</label>
            <CustomSelect value={form.currency} onChange={v => update("currency", v)} options={CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol ? c.symbol + " " : ""}${c.name}` }))} />
          </div>

          {/* Foreign currency: capture the actual INR charged (incl. bank/card forex markup) */}
          {form.currency !== "INR" && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 5 }}>
                Amount charged to your account (₹ INR) *
              </label>
              <input className="pay-inp" type="number" value={form.inrCharged} onChange={e => update("inrCharged", e.target.value)}
                placeholder="e.g. 1750.00" style={inp} />
              <p style={{ fontSize: 11, color: "#92400E", margin: "7px 0 0", lineHeight: 1.5 }}>
                Enter the exact INR your bank/card debited (it includes the forex rate + markup).
                {form.amount && form.inrCharged && parseFloat(form.amount) > 0 && (
                  <> <strong>≈ ₹{(parseFloat(form.inrCharged) / parseFloat(form.amount)).toFixed(2)}</strong> per {form.currency}.</>
                )}
                {form.exchangeRate && parseFloat(form.exchangeRate) > 1 && (
                  <> Live rate today: ₹{parseFloat(form.exchangeRate).toFixed(2)}/{form.currency}.</>
                )}
              </p>
            </div>
          )}

          {/* Amount & Tax */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Amount ({CURRENCY_SYMBOLS[form.currency] || form.currency}) *</label>
              <input className="pay-inp" type="number" value={form.amount} onChange={e => update("amount", e.target.value)} placeholder="0.00" style={inp} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Tax / GST ({CURRENCY_SYMBOLS[form.currency] || form.currency})</label>
              <input className="pay-inp" type="number" value={form.tax} onChange={e => update("tax", e.target.value)} placeholder="0.00" style={inp} />
            </div>
          </div>

          {/* GST input credit & reverse charge */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>ITC eligibility</label>
              <CustomSelect value={form.itcEligibility} onChange={v => update("itcEligibility", v)}
                placeholder="Auto (by category)"
                options={[
                  { value: "", label: "Auto (by category)" },
                  { value: "eligible", label: "Eligible" },
                  { value: "ineligible_section_17_5", label: "Ineligible — Sec 17(5)" },
                  { value: "ineligible_others", label: "Ineligible — Others" },
                ]} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#F9FAFB", borderRadius: 10, cursor: "pointer", border: "1.5px solid #E5E7EB", width: "100%" }}>
                <input type="checkbox" checked={form.isRcm} onChange={e => update("isRcm", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#E11D2C", cursor: "pointer" }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>Reverse charge (RCM)</span>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Imported / notified service — you pay the GST</p>
                </div>
              </label>
            </div>
          </div>
          {form.isRcm && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>RCM section</label>
                <CustomSelect value={form.rcmSection} onChange={v => update("rcmSection", v)}
                  placeholder="— Section —"
                  options={[
                    { value: "5(3)_igst", label: "5(3) IGST — import of service" },
                    { value: "9(3)", label: "9(3) — notified supply" },
                    { value: "9(4)", label: "9(4) — unregistered supplier" },
                  ]} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>RCM GST rate %</label>
                <input className="pay-inp" type="number" value={form.rcmRate} onChange={e => update("rcmRate", e.target.value)} placeholder="18" style={inp} />
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>RCM IGST ≈ ₹{((parseFloat(form.amount) || 0) * (parseFloat(form.rcmRate) || 0) / 100).toFixed(2)}. A self-invoice number is auto-assigned.</p>
              </div>
            </div>
          )}

          {/* TDS (income-tax deducted at source) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>TDS section</label>
              <CustomSelect value={form.tdsSection} onChange={v => { update("tdsSection", v); update("tdsRate", v ? String(TDS_RATE[v] ?? "") : ""); }} options={TDS_SECTION_OPTS.map(o => ({ value: o.value, label: o.label }))} />
            </div>
            {form.tdsSection && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>TDS rate %</label>
                <input className="pay-inp" type="number" value={form.tdsRate} onChange={e => update("tdsRate", e.target.value)} placeholder="0" style={inp} />
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>
                  TDS ≈ ₹{(((parseFloat(form.amount) || 0) - (parseFloat(form.tax) || 0)) * (parseFloat(form.tdsRate) || 0) / 100).toFixed(2)} (on value ex-GST). Net to pay ≈ ₹{((parseFloat(form.amount) || 0) - ((parseFloat(form.amount) || 0) - (parseFloat(form.tax) || 0)) * (parseFloat(form.tdsRate) || 0) / 100).toFixed(2)}.
                </p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <DatePickerInput id="bill-date" label="Bill Date" value={form.billDate} onChange={v => update("billDate", v)} placeholder="Bill date" />
            <DatePickerInput id="due-date" label="Due Date" value={form.dueDate} onChange={v => update("dueDate", v)} placeholder="Due date (optional)" />
          </div>

          {/* Notes */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Notes</label>
            <textarea className="pay-inp" value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Internal notes..." rows={2}
              style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          </div>

          {/* Receipt Upload */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Receipt Upload</label>
            {form.receiptUrl ? (
              <Attachment className="w-full" state="done">
                <AttachmentMedia variant={/\.(png|jpe?g|webp|gif)(\?|$)/i.test(form.receiptUrl) ? "image" : "icon"}>
                  {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(form.receiptUrl)
                    ? <img src={form.receiptUrl} alt="Receipt" />
                    : <FileText />}
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{decodeURIComponent((form.receiptObjectKey || form.receiptUrl).split("/").pop()?.split("?")[0] || "Receipt")}</AttachmentTitle>
                  <AttachmentDescription>Receipt attached — click to view</AttachmentDescription>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction aria-label="Remove receipt" onClick={() => { update("receiptUrl", ""); update("receiptObjectKey", ""); }}>
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
                <AttachmentTrigger aria-label="View receipt" onClick={() => window.open(form.receiptUrl, "_blank", "noopener,noreferrer")} />
              </Attachment>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => { if (!uploading) receiptInputRef.current?.click(); }}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !uploading) { e.preventDefault(); receiptInputRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadReceipt(e.dataTransfer.files?.[0]); }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "26px 16px", borderRadius: 12,
                  border: `2px dashed ${dragOver ? "#E11D2C" : "#D1D5DB"}`,
                  cursor: uploading ? "not-allowed" : "pointer",
                  background: dragOver ? "#FEF2F2" : "#FAFAFA",
                  transform: dragOver ? "scale(1.015)" : "scale(1)",
                  boxShadow: dragOver ? "0 6px 20px rgba(225,29,44,0.12)" : "none",
                  transition: "all .18s ease",
                }}>
                <input type="file" accept="application/pdf,image/*"
                  ref={receiptInputRef}
                  onChange={e => { uploadReceipt(e.target.files?.[0]); e.target.value = ""; }}
                  disabled={uploading} style={{ display: "none" }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  background: dragOver ? "#FEE2E2" : "#F3F4F6",
                  transform: dragOver ? "translateY(-2px)" : "translateY(0)",
                  transition: "all .18s ease",
                }}>
                  <Upload size={18} color={dragOver ? "#E11D2C" : "#9CA3AF"} />
                </div>
                <span style={{ fontSize: 13, color: dragOver ? "#E11D2C" : "#374151", fontWeight: 600 }}>
                  {uploading ? "Uploading…" : dragOver ? "Drop to upload" : "Drag & drop receipt here"}
                </span>
                {!uploading && !dragOver && (
                  <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>or click to browse · PDF or image</span>
                )}
              </div>
            )}
          </div>

          {/* Quick Pay (new only) */}
          {!editBill && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#F9FAFB", borderRadius: 10, cursor: "pointer", border: "1.5px solid #E5E7EB" }}>
              <input type="checkbox" checked={form.quickPay} onChange={e => update("quickPay", e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#E11D2C", cursor: "pointer" }} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0A0A0A" }}>Mark as Paid immediately</span>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>Skip approval flow — log this as already paid</p>
              </div>
            </label>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setBillModal(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", background: "#E11D2C", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : editBill ? "Save Changes" : form.quickPay ? "Add & Mark Paid" : "Add Bill"}
            </button>
          </div>
        </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Record Payment Modal ── */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Record Payment — ${payModal?.title || ""}`} width={480}>
        {payModal && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Outstanding Balance</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#E11D2C", margin: 0 }}>{formatMoney(payModal.amountDue, payModal.currency)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Bill</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#0A0A0A", margin: 0 }}>{formatMoney(payModal.amount, payModal.currency)}</p>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Amount Paying ({CURRENCY_SYMBOLS[payModal.currency] || payModal.currency}) *</label>
              <input className="pay-inp" type="number" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={inp} />
            </div>

            <DatePickerInput label="Payment Date" value={payForm.paymentDate} onChange={v => setPayForm(p => ({ ...p, paymentDate: v }))} placeholder="Select date" />

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Payment Method</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <button key={value} type="button" className={`cat-pill${payForm.paymentMethod === value ? " active" : ""}`}
                    onClick={() => setPayForm(p => ({ ...p, paymentMethod: value }))}
                    style={{ padding: "6px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#FFF", fontSize: 12, color: "#374151" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Reference / UTR</label>
              <input className="pay-inp" value={payForm.referenceNumber} onChange={e => setPayForm(p => ({ ...p, referenceNumber: e.target.value }))} placeholder="Transaction ID, cheque no..." style={inp} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Notes</label>
              <input className="pay-inp" value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" style={inp} />
            </div>

            {/* Receipt upload */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Attach Receipt (PDF or image)</label>
              {payForm.receiptUrl ? (
                <Attachment className="w-full" size="sm" state="done">
                  <AttachmentMedia variant={/\.(png|jpe?g|webp|gif)(\?|$)/i.test(payForm.receiptUrl) ? "image" : "icon"}>
                    {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(payForm.receiptUrl)
                      ? <img src={payForm.receiptUrl} alt="Receipt" />
                      : <FileText />}
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{decodeURIComponent(payForm.receiptUrl.split("/").pop()?.split("?")[0] || "Receipt")}</AttachmentTitle>
                    <AttachmentDescription>Receipt attached — click to view</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction aria-label="Remove receipt" onClick={() => setPayForm(p => ({ ...p, receiptUrl: "" }))}>
                      <X />
                    </AttachmentAction>
                  </AttachmentActions>
                  <AttachmentTrigger aria-label="View receipt" onClick={() => window.open(payForm.receiptUrl, "_blank", "noopener,noreferrer")} />
                </Attachment>
              ) : (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 14px", border: "2px dashed #D1D5DB", borderRadius: 10, cursor: payReceiptUploading ? "not-allowed" : "pointer", background: "#FAFAFA" }}>
                  <input type="file" accept="application/pdf,image/*"
                    disabled={payReceiptUploading}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPayReceiptUploading(true);
                      try {
                        const res = await upload({ file });
                        if (res.error) { toast.error(res.error); }
                        else if (res.url) { setPayForm(p => ({ ...p, receiptUrl: res.url })); }
                      } catch (err) { toast.error("Upload failed: " + err.message); }
                      finally { setPayReceiptUploading(false); e.target.value = ""; }
                    }}
                    style={{ display: "none" }} />
                  <Upload size={14} color="#9CA3AF" />
                  <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>
                    {payReceiptUploading ? "Uploading..." : "Upload receipt (PDF or image)"}
                  </span>
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setPayModal(null)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={handlePayment} disabled={paying || payReceiptUploading} style={{ flex: 2, padding: "11px", background: "#E11D2C", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: (paying || payReceiptUploading) ? "not-allowed" : "pointer", opacity: (paying || payReceiptUploading) ? 0.7 : 1 }}>
                {paying ? "Recording..." : "Record Payment"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

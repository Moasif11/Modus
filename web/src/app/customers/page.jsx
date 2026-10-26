import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { api } from "@/utils/api";
import useUpload from "@/utils/useUpload";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { INDIAN_STATES } from "@/utils/invoiceCalc";
import { Card, Avatar, Chip, ghostBtn, rowIcon, thStyle, tdStyle, MiniStat } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import DetailDrawer from "@/components/studio/DetailDrawer.jsx";
import { formatMoney, formatINRk } from "@/utils/format.js";
import Segmented from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/skeleton";

const ACCENT = "#E11D2C";
const TONES = ["#E11D2C","#2563EB","#16A34A","#F59E0B","#7C3AED","#0891B2","#EA580C","#DB2777"];

function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const GST_TREATMENT_OPTIONS = [
  { value: "registered_regular", label: "Registered — Regular" },
  { value: "registered_composition", label: "Registered — Composition" },
  { value: "unregistered", label: "Unregistered" },
  { value: "sez_with_payment", label: "SEZ — with payment of IGST" },
  { value: "sez_without_payment", label: "SEZ — without payment (LUT)" },
  { value: "overseas", label: "Overseas / Export of service" },
  { value: "deemed_export", label: "Deemed Export" },
  { value: "uin", label: "UIN holder" },
];

const EMPTY = {
  name: "", companyName: "", gstin: "", pan: "", email: "", phone: "",
  website: "", customerType: "business", creditLimit: "",
  billingAddress: "", city: "", state: "", stateCode: "", pincode: "", country: "",
  contactPerson: "", notes: "", gstTreatment: "registered_regular",
  imageUrl: "",
};

function CrudModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <style>{"@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}"}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)", animation: "sheetUp .28s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}><div style={{ width: 40, height: 4, borderRadius: 100, background: "#E5E7EB" }} /></div>
        <div style={{ padding: "12px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: "24px 28px" }}>{children}</div>
      </div>
    </div>
  );
}

function InfoLine({ icon, text }) {
  if (!text) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6B7280" }}>
      <Icon name={icon} size={14} color="#B4B7BE" />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text}</span>
    </div>
  );
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView] = useState("grid");
  const [drawer, setDrawer] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [upload, { loading: uploadingImage }] = useUpload();

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url, error } = await upload({ file });
    if (error) { toast.error("Upload failed: " + error); return; }
    setForm(f => ({ ...f, imageUrl: url }));
  }
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadCustomers(); }, [debouncedSearch, typeFilter]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (typeFilter) params.append("customerType", typeFilter);
      const data = await api.get(`/api/customers?${params}`);
      setCustomers(data.customers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() { setForm(EMPTY); setEditId(null); setModalOpen(true); }
  function openEdit(c) {
    setForm({
      name: c.name || "", companyName: c.companyName || "", gstin: c.gstin || "",
      pan: c.pan || "", email: c.email || "", phone: c.phone || "",
      website: c.website || "", customerType: c.customerType || "business",
      creditLimit: c.creditLimit || "",
      billingAddress: c.billingAddress || "", city: c.city || "",
      state: c.state || "", stateCode: c.stateCode || "", pincode: c.pincode || "", country: c.country || "",
      contactPerson: c.contactPerson || "", notes: c.notes || "",
      gstTreatment: c.gstTreatment || (c.gstin ? "registered_regular" : "unregistered"),
      imageUrl: c.imageUrl || "",
    });
    setEditId(c.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.companyName?.trim()) { toast.error("Company name is required — it's what appears on invoices"); return; }
    setSaving(true);
    try {
      if (editId) await api.put(`/api/customers/${editId}`, form);
      else await api.post("/api/customers", form);
      setModalOpen(false);
      loadCustomers();
    } catch (err) { toast.error("Failed: " + err.message); }
    finally { setSaving(false); }
  }

  function handleDelete(id) {
    setConfirmState({
      title: "Delete Customer",
      message: "This customer will be removed. Any linked invoices will remain intact.",
      confirmLabel: "Delete Customer",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/customers/${id}`); setDrawer(null); loadCustomers(); }
        catch (err) { console.error(err); }
      },
    });
  }

  function update(field, val) { setForm(f => ({ ...f, [field]: val })); }

  const totalOutstanding = customers.reduce((s, c) => s + (c.outstandingBalance || 0), 0);

  const inp = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB", borderRadius: 9,
    fontSize: 13, color: "#0A0A0A", background: "#FAFAFA", boxSizing: "border-box", outline: "none", font: "inherit",
  };

  return (
    <AppShell>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      <DetailDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        kind="customers"
        item={drawer}
        onEdit={c => { setDrawer(null); openEdit(c); }}
        onNewInvoice={() => navigate("/invoices/new")}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
          {/* 4 MiniStats */}
          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <MiniStat label="Total Customers" value={customers.length} icon="users" tint="#16A34A" sub="All time" />
            <MiniStat label="Business" value={customers.filter(c => c.customerType === 'business').length} icon="building" tint="#2563EB" sub="B2B Clients" />
            <MiniStat label="Outstanding" value={formatINRk(totalOutstanding)} icon="coins" tint="#F59E0B" sub="Total owed" />
            <MiniStat label="Avg Invoices" value={customers.length ? Math.round(customers.reduce((s, c) => s + (c.invoiceCount || 0), 0) / customers.length) : 0} icon="sigma" tint="#7C3AED" sub="Per customer" />
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Optional: Add tabs if needed, but removing chips to avoid redundancy */}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search customers..."
                style={{ padding: "8px 12px", border: "1px solid #ECECEE", borderRadius: 10, fontSize: 13, color: "#0A0A0A", width: 190, font: "inherit" }}
              aria-label="Search customers"
              />
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: "grid", label: "Grid" },
                  { value: "list", label: "List" },
                ]}
              />
              <button type="button" style={ghostBtn}>
                <Icon name="filter" size={15} /> Filter
              </button>
              <button
                type="button"
                onClick={openAdd}
                style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: "none", boxShadow: `0 4px 12px ${ACCENT}38`, padding: "8px 16px" }}
              >
                <Icon name="plus" size={15} strokeWidth={2.4} /> Add Customer
              </button>
            </div>
          </div>

          {/* ── Content ─────────────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
              {[...Array(8)].map((_, i) => (
                <Card key={i} pad={20}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                    <Skeleton style={{ width: 48, height: 48, borderRadius: 15 }} />
                  </div>
                  <Skeleton style={{ height: 15, borderRadius: 6, width: "70%", marginBottom: 8 }} />
                  <Skeleton style={{ height: 12, borderRadius: 6, width: "50%", marginBottom: 14 }} />
                  <Skeleton style={{ height: 11, borderRadius: 6, width: "85%" }} />
                </Card>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <Card pad={60} style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="users" size={26} color="#C9CCD4" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search ? "No customers found" : "No customers yet"}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>{search ? "Try a different search" : "Add your first customer to start invoicing"}</p>
              <button type="button" onClick={openAdd} style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }}>
                <Icon name="plus" size={15} /> Add Customer
              </button>
            </Card>
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
              {customers.map(c => {
                const displayName = c.companyName || c.name;
                const tone = avatarTone(displayName);
                return (
                  <Card key={c.id} pad={20} hover onClick={() => setDrawer(c)}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <Avatar name={displayName} tone={tone} size={48} radius={15} src={c.imageUrl} />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDelete(c.id); }}
                        style={rowIcon}
                        onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                      >
                        <Icon name="more" size={16} />
                      </button>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: "0 0 3px", letterSpacing: "-0.01em" }}>{displayName}</p>
                    <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "0 0 14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.gstin ? "GST registered" : (c.customerType === "individual" ? "Individual" : "Business")}
                      {c.city ? ` · ${c.city}` : ""}
                    </p>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #F2F2F4" }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px" }}>Outstanding</p>
                        <p style={{ fontSize: 17, fontWeight: 750, color: c.outstandingBalance > 0 ? "#0A0A0A" : "#15803D", margin: 0 }}>
                          {c.outstandingBalance > 0 ? formatMoney(c.outstandingBalance) : "Settled"}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px" }}>Invoices</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#4B5563", margin: 0 }}>{c.invoiceCount || 0}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card pad={0}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Company</th>
                    <th style={thStyle}>Contact</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>GSTIN</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Outstanding</th>
                    <th style={{ ...thStyle, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => {
                    const displayName = c.companyName || c.name;
                    const tone = avatarTone(displayName);
                    return (
                      <tr
                        key={c.id}
                        style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer" }}
                        onClick={() => setDrawer(c)}
                        onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            <Avatar name={displayName} tone={tone} size={34} radius={11} src={c.imageUrl} />
                            <span style={{ fontWeight: 650, color: "#0A0A0A", whiteSpace: "nowrap" }}>{displayName}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>{c.email || c.phone || "—"}</td>
                        <td style={tdStyle}>{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                        <td style={tdStyle}>
                          {c.gstin
                            ? <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{c.gstin}</span>
                            : <span style={{ color: "#C9CCD4" }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: c.outstandingBalance > 0 ? "#0A0A0A" : "#15803D" }}>
                          {c.outstandingBalance > 0 ? formatMoney(c.outstandingBalance) : "Settled"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); openEdit(c); }}
                            style={rowIcon}
                          >
                            <Icon name="chevronRight" size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
      </div>

      {/* ── Add/Edit Modal ────────────────────────────────────────────────────── */}
      <Drawer open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }} shouldScaleBackground={false}>
        <DrawerContent style={{ maxHeight: "92vh", borderRadius: "20px 20px 0 0", background: "#FFF", display: "flex", flexDirection: "column", border: "none" }}>
          <div style={{ padding: "16px 28px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{editId ? "Edit Customer" : "Add Customer"}</h2>
            <DrawerClose asChild>
              <button type="button" style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </DrawerClose>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Logo / image */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: form.imageUrl ? "transparent" : "#F3F4F6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ECECEE" }}>
              {form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="image" size={20} color="#C9CCD4" />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#FFF", fontSize: 12, fontWeight: 600, color: "#374151", cursor: uploadingImage ? "wait" : "pointer", width: "fit-content" }}>
                {uploadingImage ? "Uploading…" : form.imageUrl ? "Change image" : "Upload logo / image"}
                <input type="file" accept="image/*" onChange={handleImagePick} disabled={uploadingImage} style={{ display: "none" }} />
              </label>
              {form.imageUrl && <button type="button" onClick={() => update("imageUrl", "")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0 }}>Remove</button>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["Company Name *", "companyName", "Shown on invoices"], ["Contact Name", "name", "Full name (optional)"]].map(([label, field, ph]) => (
              <div key={field}>
                <label htmlFor={`cust-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`cust-${field}`} value={form[field]} onChange={e => update(field, e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label htmlFor="cust-customerType" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Type</label>
              <CustomSelect value={form.customerType} onChange={v => update("customerType", v)} options={[{ value: "business", label: "Business" }, { value: "individual", label: "Individual" }]} />
            </div>
            <div>
              <label htmlFor="cust-creditLimit" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Credit Limit (₹)</label>
              <input id="cust-creditLimit" type="number" value={form.creditLimit} onChange={e => update("creditLimit", e.target.value)} placeholder="e.g. 100000" style={inp} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["GSTIN", "gstin", "22AAAAA0000A1Z5"], ["PAN", "pan", "ABCDE1234F"], ["Email", "email", "billing@company.com"], ["Phone", "phone", "+91 98765 43210"], ["Contact Person", "contactPerson", "Name of contact"], ["Website", "website", "https://company.com"]].map(([label, field, ph]) => (
              <div key={field}>
                <label htmlFor={`cust-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`cust-${field}`} value={form[field]} onChange={e => update(field, ["gstin", "pan"].includes(field) ? e.target.value.toUpperCase() : e.target.value)} placeholder={ph}
                  style={{ ...inp, fontFamily: ["gstin", "pan"].includes(field) ? "monospace" : "inherit", textTransform: ["gstin", "pan"].includes(field) ? "uppercase" : "none" }} />
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>GST Treatment</label>
            <CustomSelect value={form.gstTreatment} onChange={v => update("gstTreatment", v)} options={GST_TREATMENT_OPTIONS} />
          </div>

          <div>
            <label htmlFor="cust-billingAddress" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Billing Address</label>
            <textarea id="cust-billingAddress" value={form.billingAddress} onChange={e => update("billingAddress", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Full billing address" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label htmlFor="cust-city" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>City</label>
              <input id="cust-city" value={form.city} onChange={e => update("city", e.target.value)} style={inp} />
            </div>
            <div>
              <label htmlFor="cust-country" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Country</label>
              <input id="cust-country" value={form.country} onChange={e => update("country", e.target.value)} placeholder="e.g. India" style={inp} />
            </div>
            <div>
              <label htmlFor="cust-stateCode" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>State</label>
              <CustomSelect value={form.stateCode} searchable placeholder="Select" onChange={code => { const st = INDIAN_STATES.find(s => s.code === code); update("stateCode", code); update("state", st?.name || ""); }} options={[{ value: "", label: "Select" }, ...INDIAN_STATES.map(s => ({ value: s.code, label: s.name }))]} />
            </div>
            <div>
              <label htmlFor="cust-pincode" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Pincode</label>
              <input id="cust-pincode" value={form.pincode} onChange={e => update("pincode", e.target.value)} style={inp} maxLength={6} />
            </div>
          </div>

          <div>
            <label htmlFor="cust-notes" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Notes</label>
            <textarea id="cust-notes" value={form.notes} onChange={e => update("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} placeholder="Internal notes..." />
          </div>

        </div>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 28px", borderTop: "1px solid #F3F4F6", background: "#fff", flexShrink: 0 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", font: "inherit" }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", background: ACCENT, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", font: "inherit", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : editId ? "Save Changes" : "Add Customer"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}

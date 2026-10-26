import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Layers, Truck, User, Briefcase, Monitor } from "lucide-react";

const ACCENT = "#E11D2C";

const CATEGORIES = [
  { value: "", label: "All", icon: Layers },
  { value: "supplier", label: "Suppliers", icon: Truck },
  { value: "freelancer", label: "Freelancers", icon: User },
  { value: "service_provider", label: "Services", icon: Briefcase },
  { value: "subscription", label: "Subscriptions", icon: Monitor },
];

const CATEGORY_BADGE = {
  supplier:         { label: "Supplier",     color: "#374151", bg: "#F3F4F6" },
  freelancer:       { label: "Freelancer",   color: "#E11D2C", bg: "#FEF2F2" },
  service_provider: { label: "Service",      color: "#E11D2C", bg: "#FEF2F2" },
  subscription:     { label: "Subscription", color: "#6B7280", bg: "#F9FAFB" },
};

const TONES = ["#E11D2C","#2563EB","#16A34A","#F59E0B","#7C3AED","#0891B2","#EA580C","#DB2777"];
function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <style>{"@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}"}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)", animation: "sheetUp .28s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}><div style={{ width: 40, height: 4, borderRadius: 100, background: "#E5E7EB" }} /></div>
        <div style={{ padding: "12px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20, font: "inherit" }}>×</button>
        </div>
        <div style={{ padding: "24px 28px" }}>{children}</div>
      </div>
    </div>
  );
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
  name: "", companyName: "", category: "supplier", gstin: "", pan: "",
  email: "", phone: "", billingAddress: "", city: "", state: "", stateCode: "",
  pincode: "", country: "India", contactPerson: "", website: "",
  bankName: "", bankAccount: "", bankIfsc: "", notes: "", gstTreatment: "registered_regular",
  imageUrl: "",
};

export default function VendorsPage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [view, setView] = useState("grid");
  const [drawer, setDrawer] = useState(null);
  const [allVendors, setAllVendors] = useState([]); // unfiltered, for tab counts
  const [upload, { loading: uploadingImage }] = useUpload();

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { url, error } = await upload({ file });
    if (error) { toast.error("Upload failed: " + error); return; }
    setForm(f => ({ ...f, imageUrl: url }));
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadVendors(); }, [debouncedSearch, categoryFilter]);
  useEffect(() => { api.get("/api/vendors").then(d => setAllVendors(d.vendors || [])).catch(() => {}); }, [modalOpen, confirmState]);

  const vendorTabCount = (val) => val ? allVendors.filter(v => (v.category || "supplier") === val).length : allVendors.length;

  async function loadVendors() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (categoryFilter) params.append("category", categoryFilter);
      const data = await api.get(`/api/vendors?${params}`);
      setVendors(data.vendors || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() { setForm(EMPTY); setEditId(null); setModalOpen(true); }
  function openEdit(v) {
    setForm({
      name: v.name || "", companyName: v.companyName || "", category: v.category || "supplier",
      gstin: v.gstin || "", pan: v.pan || "", email: v.email || "", phone: v.phone || "",
      billingAddress: v.billingAddress || "", city: v.city || "", state: v.state || "",
      stateCode: v.stateCode || "", pincode: v.pincode || "", country: v.country || "India",
      contactPerson: v.contactPerson || "", website: v.website || "",
      bankName: v.bankName || "", bankAccount: v.bankAccount || "", bankIfsc: v.bankIfsc || "",
      notes: v.notes || "",
      gstTreatment: v.gstTreatment || (v.gstin ? "registered_regular" : "unregistered"),
      imageUrl: v.imageUrl || "",
    });
    setEditId(v.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editId) await api.put(`/api/vendors/${editId}`, form);
      else await api.post("/api/vendors", form);
      setModalOpen(false);
      loadVendors();
    } catch (err) { toast.error("Failed: " + err.message); }
    finally { setSaving(false); }
  }

  function handleDelete(id) {
    setConfirmState({
      title: "Delete Vendor",
      message: "This vendor will be permanently removed from your directory.",
      confirmLabel: "Delete Vendor",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/vendors/${id}`); setDrawer(null); loadVendors(); }
        catch (err) { console.error(err); }
      },
    });
  }

  function update(field, val) { setForm(f => ({ ...f, [field]: val })); }

  const totalPayable = vendors.reduce((s, v) => s + (v.totalPayable || 0), 0);

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
        kind="vendors"
        item={drawer}
        onEdit={v => { setDrawer(null); openEdit(v); }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
          {/* 4 MiniStats */}
          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <MiniStat label="Total Vendors" value={vendors.length} icon="truck" tint="#16A34A" sub="Directory size" />
            <MiniStat label="Suppliers" value={vendors.filter(v => v.category === 'supplier').length} icon="box" tint="#2563EB" sub="Goods & materials" />
            <MiniStat label="Total Payable" value={formatINRk(totalPayable)} icon="wallet" tint="#F59E0B" sub="Amount owed" />
            <MiniStat label="Avg Bills" value={vendors.length ? Math.round(vendors.reduce((s, v) => s + (v.billCount || 0), 0) / vendors.length) : 0} icon="sigma" tint="#7C3AED" sub="Per vendor" />
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            {/* Left: count + payable chips + category filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Category pills */}
              <div style={{ display: "inline-flex", background: "#F1F1F3", borderRadius: 9, padding: 2, gap: 2 }}>
                {CATEGORIES.map(({ value, label, icon: CatIcon }) => {
                  const active = categoryFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategoryFilter(value)}
                      style={{
                        display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
                        borderRadius: 7, border: "none", fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit", transition: "all .12s",
                        background: active ? "#fff" : "transparent",
                        color: active ? "#0A0A0A" : "#8A8D94",
                        boxShadow: active ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                      }}
                    >
                      <CatIcon size={12} />{label}
                      <span style={{ fontSize: 9, fontWeight: 700, color: active ? ACCENT : "#B4B7BE", background: active ? ACCENT + "16" : "transparent", padding: active ? "1px 5px" : "0", borderRadius: 5 }}>{vendorTabCount(value)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: search + view toggle + add */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search vendors…"
                style={{ padding: "8px 12px", border: "1px solid #ECECEE", borderRadius: 10, fontSize: 13, color: "#0A0A0A", width: 190, font: "inherit" }}
                aria-label="Search vendors"
              />
              <Segmented
                value={view}
                onChange={setView}
                options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }]}
              />
              <button type="button" style={ghostBtn}>
                <Icon name="filter" size={15} /> Filter
              </button>
              <button
                type="button"
                onClick={openAdd}
                style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: "none", boxShadow: `0 4px 12px ${ACCENT}38`, padding: "8px 16px" }}
              >
                <Icon name="plus" size={15} strokeWidth={2.4} /> Add Vendor
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
                    <Skeleton style={{ width: 62, height: 22, borderRadius: 100 }} />
                  </div>
                  <Skeleton style={{ height: 15, borderRadius: 6, width: "70%", marginBottom: 8 }} />
                  <Skeleton style={{ height: 12, borderRadius: 6, width: "50%", marginBottom: 14 }} />
                  <Skeleton style={{ height: 11, borderRadius: 6, width: "85%" }} />
                </Card>
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <Card pad={60} style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="truck" size={26} color="#C9CCD4" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search ? "No vendors found" : "No vendors yet"}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>{search ? "Try a different search" : "Add your first vendor, supplier, or freelancer"}</p>
              <button type="button" onClick={openAdd} style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }}>
                <Icon name="plus" size={15} /> Add Vendor
              </button>
            </Card>
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
              {vendors.map(v => {
                const displayName = v.companyName || v.name;
                const tone = avatarTone(displayName);
                const payable = v.totalPayable || 0;
                const badge = CATEGORY_BADGE[v.category] || CATEGORY_BADGE.supplier;
                return (
                  <Card key={v.id} pad={20} hover onClick={() => setDrawer(v)}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <Avatar name={displayName} tone={tone} size={48} radius={15} src={v.imageUrl} />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDelete(v.id); }}
                        style={rowIcon}
                        onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                      >
                        <Icon name="more" size={16} />
                      </button>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: "0 0 3px", letterSpacing: "-0.01em" }}>{displayName}</p>
                    <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "0 0 14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.gstin ? "GST registered" : badge.label}
                      {v.city ? ` · ${v.city}` : ""}
                    </p>
                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #F2F2F4" }}>
                      <div>
                        <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px" }}>Payable</p>
                        <p style={{ fontSize: 17, fontWeight: 750, color: payable > 0 ? "#0A0A0A" : "#15803D", margin: 0 }}>
                          {payable > 0 ? formatMoney(payable) : "Settled"}
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px" }}>Bills</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#4B5563", margin: 0 }}>{v.billCount || 0}</p>
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
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>GSTIN</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Payable</th>
                    <th style={{ ...thStyle, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map(v => {
                    const displayName = v.companyName || v.name;
                    const tone = avatarTone(displayName);
                    const payable = v.totalPayable || 0;
                    const badge = CATEGORY_BADGE[v.category] || CATEGORY_BADGE.supplier;
                    return (
                      <tr
                        key={v.id}
                        style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer" }}
                        onClick={() => setDrawer(v)}
                        onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            <Avatar name={displayName} tone={tone} size={34} radius={11} src={v.imageUrl} />
                            <span style={{ fontWeight: 650, color: "#0A0A0A", whiteSpace: "nowrap" }}>{displayName}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={tdStyle}>{[v.city, v.state].filter(Boolean).join(", ") || "—"}</td>
                        <td style={tdStyle}>
                          {v.gstin
                            ? <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{v.gstin}</span>
                            : <span style={{ color: "#C9CCD4" }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700, color: payable > 0 ? "#0A0A0A" : "#15803D" }}>
                          {payable > 0 ? formatMoney(payable) : "Settled"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); openEdit(v); }}
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{editId ? "Edit Vendor" : "Add Vendor"}</h2>
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

          {/* Category */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Category</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORIES.slice(1).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update("category", value)}
                  style={{ padding: "7px 14px", border: `1.5px solid ${form.category === value ? ACCENT : "#E5E7EB"}`, borderRadius: 8, background: form.category === value ? "#FEF2F2" : "#FFF", color: form.category === value ? ACCENT : "#374151", fontSize: 12, fontWeight: form.category === value ? 600 : 400, cursor: "pointer", font: "inherit" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["Name *", "name", "Contact / Vendor name"], ["Company Name", "companyName", "Company or brand"]].map(([label, field, ph]) => (
              <div key={field}>
                <label htmlFor={`vnd-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`vnd-${field}`} value={form[field]} onChange={e => update(field, e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["GSTIN", "gstin", "22AAAAA0000A1Z5"], ["PAN", "pan", "ABCDE1234F"], ["Email", "email", "vendor@company.com"], ["Phone", "phone", "+91 98765 43210"], ["Contact Person", "contactPerson", "Name"], ["Website", "website", "https://..."]].map(([label, field, ph]) => (
              <div key={field}>
                <label htmlFor={`vnd-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`vnd-${field}`} value={form[field]} onChange={e => update(field, field === "gstin" || field === "pan" ? e.target.value.toUpperCase() : e.target.value)} placeholder={ph}
                  style={{ ...inp, fontFamily: field === "gstin" || field === "pan" ? "monospace" : "inherit", textTransform: field === "gstin" || field === "pan" ? "uppercase" : "none" }} />
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>GST Treatment</label>
            <CustomSelect value={form.gstTreatment} onChange={v => update("gstTreatment", v)} options={GST_TREATMENT_OPTIONS} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label htmlFor="vnd-city" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>City</label>
              <input id="vnd-city" value={form.city} onChange={e => update("city", e.target.value)} style={inp} />
            </div>
            <div>
              <label htmlFor="vnd-stateCode" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>State</label>
              <CustomSelect value={form.stateCode} searchable placeholder="Select" onChange={code => { const st = INDIAN_STATES.find(s => s.code === code); update("stateCode", code); update("state", st?.name || ""); }} options={[{ value: "", label: "Select" }, ...INDIAN_STATES.map(s => ({ value: s.code, label: s.name }))]} />
            </div>
            <div>
              <label htmlFor="vnd-pincode" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Pincode</label>
              <input id="vnd-pincode" value={form.pincode} onChange={e => update("pincode", e.target.value)} style={inp} maxLength={6} />
            </div>
          </div>

          {/* Banking */}
          <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Banking Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Bank Name", "bankName", "e.g. HDFC Bank"], ["Account Number", "bankAccount", "Account number"], ["IFSC Code", "bankIfsc", "HDFC0001234"], ["Notes", "notes", "Internal notes"]].map(([label, field, ph]) => (
                <div key={field}>
                  <label htmlFor={`vnd-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                  <input id={`vnd-${field}`} value={form[field]} onChange={e => update(field, e.target.value)} placeholder={ph} style={{ ...inp, fontFamily: field === "bankIfsc" || field === "bankAccount" ? "monospace" : "inherit" }} />
                </div>
              ))}
            </div>
          </div>

        </div>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 28px", borderTop: "1px solid #F3F4F6", background: "#FFF", flexShrink: 0 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", font: "inherit" }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", background: ACCENT, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer", opacity: saving ? 0.7 : 1, font: "inherit" }}>
              {saving ? "Saving..." : editId ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}

import { useState, useEffect } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { api } from "@/utils/api";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Card, Chip, ghostBtn, rowIcon, thStyle, tdStyle, MiniStat } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import { formatMoney } from "@/utils/format";

const ACCENT = "#E11D2C";

const GST_RATES = [0, 5, 12, 18, 28];
const EMPTY_SERVICE = {
  name: "",
  description: "",
  defaultPrice: "",
  gstRate: 18,
  hsnSacCode: "9983",
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

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [editId, setEditId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadServices(); }, [debouncedSearch]);

  async function loadServices() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      const data = await api.get(`/api/services?${params}`);
      setServices(data.services || []);
    } catch (err) {
      console.error("Failed to load services:", err);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() { setForm(EMPTY_SERVICE); setEditId(null); setModalOpen(true); }

  function openEdit(s) {
    setForm({
      name: s.name || "",
      description: s.description || "",
      defaultPrice: s.defaultPrice !== undefined ? s.defaultPrice.toString() : "",
      gstRate: s.gstRate !== undefined ? s.gstRate : 18,
      hsnSacCode: s.hsnSacCode || "9983",
    });
    setEditId(s.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        defaultPrice: parseFloat(form.defaultPrice) || 0,
        gstRate: parseFloat(form.gstRate) || 0,
        hsnSacCode: form.hsnSacCode.trim() || "9983",
      };
      if (editId) await api.put(`/api/services/${editId}`, payload);
      else await api.post("/api/services", payload);
      setModalOpen(false);
      loadServices();
    } catch (err) {
      toast.error("Failed to save service: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id) {
    setConfirmState({
      title: "Delete Service",
      message: "This service will be removed from your directory. Existing invoices won't be affected.",
      confirmLabel: "Delete Service",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/services/${id}`); loadServices(); }
        catch (err) { console.error("Delete failed:", err); }
      },
    });
  }

  function update(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  const inp = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB", borderRadius: 9,
    fontSize: 13, color: "#0A0A0A", background: "#FAFAFA", boxSizing: "border-box", outline: "none", font: "inherit",
  };

  return (
    <AppShell>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
          {/* 4 MiniStats */}
          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <MiniStat label="Total Services" value={services.length} icon="wrench" tint="#16A34A" sub="Active offerings" />
            <MiniStat label="Avg Price" value={formatMoney(services.length ? services.reduce((s, x) => s + (parseFloat(x.defaultPrice) || 0), 0) / services.length : 0)} icon="sigma" tint="#2563EB" sub="Average default" />
            <MiniStat label="Highest Priced" value={formatMoney(services.length ? Math.max(...services.map(s => parseFloat(s.defaultPrice) || 0)) : 0)} icon="crown" tint="#F59E0B" sub="Max rate" />
            <MiniStat label="Configured" value={services.filter(s => s.hsnSacCode).length} icon="circleCheck" tint="#7C3AED" sub="With SAC code" />
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Chip tone={ACCENT} bg={ACCENT + "14"}>{services.length} service{services.length !== 1 ? "s" : ""}</Chip>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search services..."
                style={{ padding: "8px 12px", border: "1px solid #ECECEE", borderRadius: 10, fontSize: 13, color: "#0A0A0A", width: 200, font: "inherit" }}
                aria-label="Search services"
              />
              <button
                type="button"
                onClick={openAdd}
                style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: "none", boxShadow: `0 4px 12px ${ACCENT}38`, padding: "8px 16px" }}
              >
                <Icon name="plus" size={15} strokeWidth={2.4} /> Add Service
              </button>
            </div>
          </div>

          {/* ── Content ─────────────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 34, height: 34, border: `3px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : services.length === 0 ? (
            <Card pad={60} style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="briefcase" size={26} color="#C9CCD4" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search ? "No services found" : "No services yet"}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>{search ? "Try a different search query" : "Configure reusable agency services here"}</p>
              <button type="button" onClick={openAdd} style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }}>
                <Icon name="plus" size={15} /> Add Service
              </button>
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {services.map((s) => (
                <Card key={s.id} pad={20}>
                  {/* Card header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: ACCENT + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name="briefcase" size={18} color={ACCENT} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{s.name}</p>
                        <span style={{ fontSize: 10, fontFamily: "monospace", background: "#F3F4F6", color: "#4B5563", padding: "2px 6px", borderRadius: 4, display: "inline-block", marginTop: 3 }}>
                          SAC: {s.hsnSacCode}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 2 }}>
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        style={rowIcon}
                        onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = ACCENT; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
                        style={rowIcon}
                        onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  </div>

                  {s.description && (
                    <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, margin: "8px 0 0 0", display: "-webkit-box", WebkitLineClamp: "3", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {s.description}
                    </p>
                  )}

                  {/* Card footer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #F2F2F4", marginTop: 14 }}>
                    <div>
                      <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>Default Price</p>
                      <p style={{ fontSize: 17, fontWeight: 750, color: "#0A0A0A", margin: 0 }}>{formatMoney(s.defaultPrice)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 11, color: "#A9ACB3", margin: "0 0 2px", textTransform: "uppercase", fontWeight: 600 }}>GST Rate</p>
                      <Chip tone="#059669" bg="#E6F4EA">{s.gstRate}% GST</Chip>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>

      {/* ── Add/Edit Modal ────────────────────────────────────────────────────── */}
      <Drawer open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }} shouldScaleBackground={false}>
        <DrawerContent style={{ maxHeight: "92vh", borderRadius: "20px 20px 0 0", background: "#FFF", display: "flex", flexDirection: "column", border: "none" }}>
          <div style={{ padding: "16px 28px 14px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{editId ? "Edit Service" : "Add Service"}</h2>
            <DrawerClose asChild>
              <button type="button" style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </DrawerClose>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="svc-name" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Service Name *</label>
            <input id="svc-name" value={form.name} onChange={e => update("name", e.target.value)} placeholder="e.g. Website Development" style={inp} />
          </div>

          <div>
            <label htmlFor="svc-description" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Description</label>
            <textarea id="svc-description" value={form.description} onChange={e => update("description", e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Detailed description of the service deliverables..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label htmlFor="svc-defaultPrice" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Default Price (₹)</label>
              <input id="svc-defaultPrice" type="number" value={form.defaultPrice} onChange={e => update("defaultPrice", e.target.value)} placeholder="50000" style={inp} min="0" step="0.01" />
            </div>
            <div>
              <label htmlFor="svc-gstRate" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>GST Rate (%)</label>
              <CustomSelect value={form.gstRate} onChange={v => update("gstRate", parseInt(v))} options={GST_RATES.map(r => ({ value: r, label: `${r}%` }))} />
            </div>
          </div>

          <div>
            <label htmlFor="svc-hsnSacCode" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>SAC Code (IT/Services Code)</label>
            <input id="svc-hsnSacCode" value={form.hsnSacCode} onChange={e => update("hsnSacCode", e.target.value)} placeholder="9983" style={{ ...inp, fontFamily: "monospace" }} />
            <span style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, display: "block" }}>
              * '9983' is standard SAC for digital agency, website design, and IT services in India.
            </span>
          </div>

        </div>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 28px", borderTop: "1px solid #F3F4F6", background: "#fff", flexShrink: 0 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", font: "inherit" }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", background: ACCENT, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer", font: "inherit", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : editId ? "Save Changes" : "Add Service"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}

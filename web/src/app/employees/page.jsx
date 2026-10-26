import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { Skeleton } from "@/components/ui/skeleton";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";
import { api } from "@/utils/api";
import useUpload from "@/utils/useUpload";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { Card, Avatar, Chip, ghostBtn, rowIcon, thStyle, tdStyle, MiniStat } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";
import DetailDrawer from "@/components/studio/DetailDrawer.jsx";
import { formatDate } from "@/utils/format.js";
import Segmented from "@/components/ui/Segmented";
import { toast } from "sonner";

const ACCENT = "#E11D2C";

const STATUS_CONFIG = {
  active:   { label: "Active",   color: "#15803D", bg: "#DCFCE7" },
  inactive: { label: "Inactive", color: "#6B7280", bg: "#F3F4F6" },
  on_leave: { label: "On Leave", color: "#B45309", bg: "#FEF3C7" },
};

const TONES = ["#E11D2C","#2563EB","#16A34A","#F59E0B","#7C3AED","#0891B2","#EA580C","#DB2777"];
function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

function formatCurrency(n) {
  if (!n) return "—";
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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

const EMPTY = {
  name: "", designation: "", department: "", email: "", phone: "",
  employeeId: "", pan: "", joinDate: "", salaryAmount: "", salaryFrequency: "monthly",
  bankName: "", bankAccount: "", bankIfsc: "", status: "active", notes: "",
  imageUrl: "",
};

const STATUS_PILLS = [["", "All"], ["active", "Active"], ["inactive", "Inactive"], ["on_leave", "On Leave"]];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
  const [view, setView] = useState("grid");
  const [drawer, setDrawer] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]); // unfiltered, for tab counts

  // Resume Parsing States
  const [parsing, setParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { loadEmployees(); }, [debouncedSearch, statusFilter]);
  useEffect(() => { api.get("/api/employees").then(d => setAllEmployees(d.employees || [])).catch(() => {}); }, [modalOpen, confirmState]);

  const empTabCount = (val) => val ? allEmployees.filter(e => (e.status || "active") === val).length : allEmployees.length;

  async function loadEmployees() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter) params.append("status", statusFilter);
      const data = await api.get(`/api/employees?${params}`);
      setEmployees(data.employees || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm(EMPTY); setEditId(null); setModalOpen(true); }
  function openEdit(emp) {
    setForm({
      name: emp.name || "", designation: emp.designation || "", department: emp.department || "",
      email: emp.email || "", phone: emp.phone || "", employeeId: emp.employeeId || "",
      pan: emp.pan || "", joinDate: emp.joinDate ? emp.joinDate.split("T")[0] : "",
      salaryAmount: emp.salaryAmount || "", salaryFrequency: emp.salaryFrequency || "monthly",
      bankName: emp.bankName || "", bankAccount: emp.bankAccount || "", bankIfsc: emp.bankIfsc || "",
      status: emp.status || "active", notes: emp.notes || "",
      imageUrl: emp.imageUrl || "",
    });
    setEditId(emp.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (editId) await api.put(`/api/employees/${editId}`, form);
      else await api.post("/api/employees", form);
      setModalOpen(false);
      loadEmployees();
    } catch (err) { toast.error("Failed: " + err.message); }
    finally { setSaving(false); }
  }

  function handleDelete(id) {
    setConfirmState({
      title: "Delete Employee",
      message: "This employee record will be permanently removed.",
      confirmLabel: "Delete Employee",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/employees/${id}`); setDrawer(null); loadEmployees(); }
        catch (err) { console.error(err); }
      },
    });
  }

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setParsingStatus("Uploading resume to parser...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      // AI states timeline for dynamic loading micro-animations
      const steps = [
        "Extracting layout and text (Unstructured.io)...",
        "Structuring profile fields (Nvidia NIM LLM)...",
        "Finalizing candidate profile...",
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep < steps.length - 1) {
          setParsingStatus(steps[currentStep]);
          currentStep++;
        }
      }, 2500);

      const token = localStorage.getItem("modus_auth_token");
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/employees/parse-resume", {
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
      if (data.employee) {
        const emp = data.employee;
        setForm((f) => ({
          ...f,
          name: emp.name || f.name,
          designation: emp.designation || f.designation,
          department: emp.department || f.department,
          email: emp.email || f.email,
          phone: emp.phone || f.phone,
          pan: emp.pan || f.pan,
          salaryAmount: emp.salaryAmount || f.salaryAmount,
          notes: emp.notes || f.notes,
        }));
        toast.success(`Resume parsed successfully by ${data.provider}!`);
      } else {
        throw new Error("No structured employee profile was returned.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Resume parsing failed: " + err.message);
    } finally {
      setParsing(false);
      setParsingStatus("");
      e.target.value = "";
    }
  }

  function update(field, val) { setForm(f => ({ ...f, [field]: val })); }

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
        kind="employees"
        item={drawer}
        onEdit={emp => { setDrawer(null); openEdit(emp); }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
          {/* 4 MiniStats */}
          <div className="modus-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <MiniStat label="Total Employees" value={employees.length} icon="users" tint="#16A34A" sub="Team size" />
            <MiniStat label="Active" value={employees.filter(e => e.status === 'active').length} icon="circleCheck" tint="#2563EB" sub="Currently active" />
            <MiniStat label="On Leave" value={employees.filter(e => e.status === 'on_leave').length} icon="calendarClock" tint="#F59E0B" sub="Out of office" />
            <MiniStat label="Avg Salary" value={formatCurrency(employees.length ? employees.reduce((s, e) => s + (parseFloat(e.salaryAmount) || 0), 0) / employees.length : 0)} icon="banknote" tint="#7C3AED" sub="Average pay" />
          </div>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            {/* Left: status pills */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", background: "#F1F1F3", borderRadius: 9, padding: 2, gap: 2 }}>
                {STATUS_PILLS.map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatusFilter(val)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "4px 8px", borderRadius: 7, border: "none", fontSize: 11,
                      fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                      background: statusFilter === val ? "#FFF" : "transparent",
                      color: statusFilter === val ? "#0A0A0A" : "#8A8D94",
                      boxShadow: statusFilter === val ? "0 1px 3px rgba(0,0,0,.1)" : "none",
                      transition: "all .12s",
                    }}
                  >
                    {label}
                    <span style={{ fontSize: 9, fontWeight: 700, color: statusFilter === val ? ACCENT : "#B4B7BE", background: statusFilter === val ? ACCENT + "16" : "transparent", padding: statusFilter === val ? "1px 5px" : "0", borderRadius: 5 }}>{empTabCount(val)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: search + view toggle + add */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search employees…"
                style={{ padding: "8px 12px", border: "1px solid #ECECEE", borderRadius: 10, fontSize: 13, color: "#0A0A0A", width: 190, font: "inherit" }}
                aria-label="Search employees"
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
                <Icon name="plus" size={15} strokeWidth={2.4} /> Add Employee
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
          ) : employees.length === 0 ? (
            <Card pad={60} style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="userCheck" size={26} color="#C9CCD4" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search ? "No employees found" : "No employees yet"}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>{search ? "Try a different search" : "Add your first team member"}</p>
              <button type="button" onClick={openAdd} style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }}>
                <Icon name="plus" size={15} /> Add Employee
              </button>
            </Card>
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
              {employees.map(emp => {
                const sc = STATUS_CONFIG[emp.status] || STATUS_CONFIG.active;
                const tone = avatarTone(emp.name);
                return (
                  <Card key={emp.id} pad={20} hover onClick={() => setDrawer(emp)}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                      <Avatar name={emp.name} tone={tone} size={48} radius={15} src={emp.imageUrl} />
                      <Chip tone={sc.color} bg={sc.bg}>{sc.label}</Chip>
                    </div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: "0 0 3px", letterSpacing: "-0.01em" }}>{emp.name}</p>
                    <p style={{ fontSize: 12.5, color: "#9CA3AF", margin: "0 0 14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {emp.designation || "—"}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, paddingTop: 14, borderTop: "1px solid #F2F2F4" }}>
                      {emp.department && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6B7280" }}>
                          <Icon name="briefcase" size={14} color="#B4B7BE" />
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.department}</span>
                        </div>
                      )}
                      {emp.joinDate && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6B7280" }}>
                          <Icon name="calendar" size={14} color="#B4B7BE" />
                          <span>Joined {formatDate(emp.joinDate)}</span>
                        </div>
                      )}
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
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Department</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Joined</th>
                    <th style={{ ...thStyle, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const sc = STATUS_CONFIG[emp.status] || STATUS_CONFIG.active;
                    const tone = avatarTone(emp.name);
                    return (
                      <tr
                        key={emp.id}
                        style={{ borderTop: "1px solid #F2F2F4", cursor: "pointer" }}
                        onClick={() => setDrawer(emp)}
                        onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            <Avatar name={emp.name} tone={tone} size={34} radius={11} src={emp.imageUrl} />
                            <span style={{ fontWeight: 650, color: "#0A0A0A", whiteSpace: "nowrap" }}>{emp.name}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>{emp.designation || "—"}</td>
                        <td style={tdStyle}>{emp.department || "—"}</td>
                        <td style={tdStyle}>
                          <Chip tone={sc.color} bg={sc.bg}>{sc.label}</Chip>
                        </td>
                        <td style={tdStyle}>{formatDate(emp.joinDate) || "—"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                          <button type="button" style={rowIcon} onClick={e => { e.stopPropagation(); setDrawer(emp); }}>
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{editId ? "Edit Employee" : "Add Employee"}</h2>
            <DrawerClose asChild>
              <button type="button" style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </DrawerClose>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: "24px 28px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Photo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: form.imageUrl ? "transparent" : "#F3F4F6", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ECECEE" }}>
              {form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="image" size={20} color="#C9CCD4" />}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1.5px solid #E5E7EB", borderRadius: 8, background: "#FFF", fontSize: 12, fontWeight: 600, color: "#374151", cursor: uploadingImage ? "wait" : "pointer", width: "fit-content" }}>
                {uploadingImage ? "Uploading…" : form.imageUrl ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" onChange={handleImagePick} disabled={uploadingImage} style={{ display: "none" }} />
              </label>
              {form.imageUrl && <button type="button" onClick={() => update("imageUrl", "")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: 0 }}>Remove</button>}
            </div>
          </div>

          {/* AI Resume Upload Box */}
          {!editId && (
            <div style={{
              border: "2px dashed #E5E7EB",
              borderRadius: 14,
              padding: "16px 20px",
              background: "#F9FAFB",
              textAlign: "center",
              cursor: parsing ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={e => { if(!parsing) e.currentTarget.style.borderColor = ACCENT; }}
            onMouseLeave={e => { if(!parsing) e.currentTarget.style.borderColor = "#E5E7EB"; }}
            >
              <input 
                type="file" 
                accept=".pdf,.docx" 
                disabled={parsing}
                onChange={handleResumeUpload} 
                style={{ display: "none" }} 
                id="resume-upload" 
              />
              <label htmlFor="resume-upload" style={{ cursor: parsing ? "not-allowed" : "pointer", display: "block" }}>
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
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>AI Parsing Resume…</p>
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
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A", margin: "0 0 4px" }}>Auto-fill with AI Resume Parser</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "#8A8D94", fontWeight: 500 }}>Powered by</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 6px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                            <img src="https://thesvg.org/icons/unstructured/default.svg" style={{ height: 11, width: "auto", display: "block" }} alt="Unstructured" />
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>Unstructured</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 6px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                            <img src="https://thesvg.org/icons/nvidia/default.svg" style={{ height: 11, width: "auto", display: "block" }} alt="NVIDIA" />
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>Nemotron</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 6, padding: "3px 6px", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                            <img src="https://thesvg.org/icons/openrouter/default.svg" style={{ height: 11, width: "auto", display: "block" }} alt="OpenRouter" />
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#374151", letterSpacing: "0.02em" }}>OpenRouter</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </label>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["Name *", "name", "Full name"], ["Employee ID", "employeeId", "EMP001"], ["Designation", "designation", "e.g. Designer"], ["Department", "department", "e.g. Engineering"]].map(([label, field, ph]) => (
              <div key={field}>
                <label htmlFor={`emp-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`emp-${field}`} value={form[field]} onChange={e => update(field, e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["Email", "email", "employee@company.com"], ["Phone", "phone", "+91 98765 43210"]].map(([label, field, ph]) => (
              <div key={field}>
                <label htmlFor={`emp-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`emp-${field}`} value={form[field]} onChange={e => update(field, e.target.value)} placeholder={ph} style={inp} />
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <DatePickerInput
                label="Join Date"
                value={form.joinDate}
                onChange={val => update("joinDate", val)}
                placeholder="Select join date"
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label htmlFor="emp-status" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Status</label>
              <CustomSelect value={form.status} onChange={v => update("status", v)} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "on_leave", label: "On Leave" }]} />
            </div>
            <div>
              <label htmlFor="emp-pan" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>PAN</label>
              <input id="emp-pan" value={form.pan} onChange={e => update("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" style={{ ...inp, fontFamily: "monospace", textTransform: "uppercase" }} />
            </div>
          </div>

          {/* Salary */}
          <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Salary</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label htmlFor="emp-salaryAmount" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Amount (₹)</label>
                <input id="emp-salaryAmount" type="number" value={form.salaryAmount} onChange={e => update("salaryAmount", e.target.value)} placeholder="e.g. 50000" style={inp} />
              </div>
              <div>
                <label htmlFor="emp-salaryFrequency" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Frequency</label>
                <CustomSelect value={form.salaryFrequency} onChange={v => update("salaryFrequency", v)} options={[{ value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" }, { value: "biweekly", label: "Bi-weekly" }, { value: "annual", label: "Annual" }, { value: "contract", label: "Contract" }]} />
              </div>
            </div>
          </div>

          {/* Banking */}
          <div style={{ background: "#F9FAFB", borderRadius: 12, padding: "16px 18px" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Banking Details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Bank Name", "bankName", "e.g. HDFC"], ["Account", "bankAccount", "Account number"], ["IFSC", "bankIfsc", "HDFC0001234"]].map(([label, field, ph]) => (
                <div key={field}>
                  <label htmlFor={`emp-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                  <input id={`emp-${field}`} value={form[field]} onChange={e => update(field, e.target.value)} placeholder={ph} style={{ ...inp, fontFamily: field !== "bankName" ? "monospace" : "inherit" }} />
                </div>
              ))}
              <div>
                <label htmlFor="emp-notes" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Notes</label>
                <input id="emp-notes" value={form.notes} onChange={e => update("notes", e.target.value)} placeholder="Internal notes" style={inp} />
              </div>
            </div>
          </div>

        </div>
          </div>
          <div style={{ display: "flex", gap: 10, padding: "14px 28px", borderTop: "1px solid #F3F4F6", background: "#FFF", flexShrink: 0 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFF", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", font: "inherit" }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", background: ACCENT, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer", font: "inherit", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : editId ? "Save Changes" : "Add Employee"}
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}

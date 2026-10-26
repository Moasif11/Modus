import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { useAuth } from "@/utils/auth";
import { api } from "@/utils/api";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Switch } from "@/components/ui/switch";
import { Card, Avatar, Chip, ghostBtn, rowIcon, thStyle, tdStyle } from "@/components/studio/primitives.jsx";
import { Icon } from "@/components/studio/icons.jsx";

const ACCENT = "#E11D2C";
const TONES = ["#E11D2C", "#2563EB", "#16A34A", "#F59E0B", "#7C3AED", "#0891B2", "#EA580C", "#DB2777"];

function avatarTone(name) {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const ROLE_LABELS = { superadmin: "Super Admin", admin: "Admin", user: "User" };
const ROLE_CHIPS = {
  superadmin: { tone: ACCENT, bg: ACCENT + "14" },
  admin:      { tone: "#D97706", bg: "#FFF7ED" },
  user:       { tone: "#6B7280", bg: "#F3F4F6" },
};

const EMPTY_FORM = { username: "", fullName: "", email: "", phone: "", designation: "", role: "user" };

function CrudModal({ open, onClose, title, children }) {
  if (!open) return null;
  return createPortal(
    <div className="sheet-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="sheet-card" style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", borderRadius: 7, color: "#9CA3AF", fontSize: 20 }}>×</button>
        </div>
        <div style={{ padding: "24px 28px" }}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  const inp = {
    width: "100%", padding: "9px 12px", border: "1.5px solid #E5E7EB", borderRadius: 9,
    fontSize: 13, color: "#0A0A0A", background: "#FAFAFA", boxSizing: "border-box", outline: "none", font: "inherit",
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== "superadmin" && currentUser.role !== "admin") {
      window.location.href = "/dashboard";
    }
  }, [currentUser]);

  useEffect(() => { loadUsers(); }, [search]);

  async function loadUsers() {
    setLoading(true);
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await api.get(`/api/admin/users${params}`);
      setUsers(data.users);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  function openCreate() { setForm(EMPTY_FORM); setEditUser(null); setModalOpen(true); }
  function openEdit(u) {
    setForm({ username: u.username, fullName: u.fullName || u.name, email: u.email || "", phone: u.phone || "", designation: u.designation || "", role: u.role });
    setEditUser(u);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.fullName) { toast.error("Full name is required"); return; }
    if (!editUser && !form.username) { toast.error("Username is required"); return; }
    setSaving(true);
    try {
      if (editUser) {
        await api.put(`/api/admin/users/${editUser.id}`, { fullName: form.fullName, email: form.email, phone: form.phone, designation: form.designation, role: form.role });
      } else {
        await api.post("/api/admin/users", form);
      }
      setModalOpen(false);
      loadUsers();
    } catch (err) { toast.error("Failed: " + err.message); }
    finally { setSaving(false); }
  }

  function handleResetPassword(u) {
    setConfirmState({
      title: "Reset Password",
      message: `Reset ${u.fullName || u.username}'s password? A temporary password will be generated — they must change it on next login.`,
      confirmLabel: "Reset Password",
      danger: false,
      onConfirm: async () => {
        try {
          const res = await api.post(`/api/admin/users/${u.id}/reset-password`, {});
          if (res.tempPassword) {
            try { await navigator.clipboard.writeText(res.tempPassword); } catch {}
            toast.success(`Temporary password: ${res.tempPassword}`, {
              duration: 60000,
              description: "Copied to clipboard. Share it with the user — they must change it on next login.",
            });
          }
        }
        catch (err) { toast.error("Reset failed: " + err.message); }
      },
    });
  }

  function handleToggleActive(u) {
    const action = u.isActive ? "Deactivate" : "Activate";
    setConfirmState({
      title: `${action} User`,
      message: `${action} ${u.fullName || u.username}'s account?`,
      confirmLabel: action,
      danger: u.isActive,
      onConfirm: async () => {
        try { await api.post(`/api/admin/users/${u.id}/toggle-active`, {}); loadUsers(); }
        catch (err) { console.error("Toggle failed:", err); }
      },
    });
  }

  function handleDelete(u) {
    setConfirmState({
      title: "Delete User",
      message: `Delete ${u.fullName || u.username}? This will permanently deactivate their account.`,
      confirmLabel: "Delete User",
      danger: true,
      onConfirm: async () => {
        try { await api.delete(`/api/admin/users/${u.id}`); loadUsers(); }
        catch (err) { console.error("Delete failed:", err); }
      },
    });
  }

  function isSelf(u) { return currentUser && Number(u.id) === Number(currentUser.id); }
  function canModify(u) {
    if (u.role === "superadmin") return false;
    if (isSelf(u)) return false;
    if (currentUser?.role === "admin" && u.role === "admin") return false;
    return true;
  }

  const activeCount = users.filter(u => u.isActive).length;

  return (
    <AppShell>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 30px 30px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>

          {/* ── Toolbar ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Chip tone={ACCENT} bg={ACCENT + "14"}>{users.length} member{users.length !== 1 ? "s" : ""}</Chip>
              {activeCount > 0 && <Chip tone="#059669" bg="#DCFCE7">{activeCount} active</Chip>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, username, email..."
                style={{ padding: "8px 12px", border: "1px solid #ECECEE", borderRadius: 10, fontSize: 13, color: "#0A0A0A", width: 220, font: "inherit" }}
                aria-label="Search users"
              />
              <button
                type="button"
                onClick={openCreate}
                style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}`, boxShadow: `0 4px 12px ${ACCENT}38` }}
              >
                <Icon name="plus" size={15} strokeWidth={2.4} /> Add User
              </button>
            </div>
          </div>

          {/* ── Table ───────────────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
              <div style={{ width: 34, height: 34, border: `3px solid ${ACCENT}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          ) : users.length === 0 ? (
            <Card pad={60} style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Icon name="users" size={26} color="#C9CCD4" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 650, color: "#0A0A0A", margin: "0 0 4px" }}>{search ? "No users found" : "No team members yet"}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 20px" }}>{search ? "Try a different search" : "Add your first team member"}</p>
              <button type="button" onClick={openCreate} style={{ ...ghostBtn, background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }}>
                <Icon name="plus" size={15} /> Add User
              </button>
            </Card>
          ) : (
            <Card pad={0}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Role</th>
                    <th style={thStyle}>Designation</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const displayName = u.fullName || u.name || u.username || "?";
                    const tone = avatarTone(displayName);
                    const roleChip = ROLE_CHIPS[u.role] || ROLE_CHIPS.user;
                    return (
                      <tr
                        key={u.id}
                        style={{ borderTop: "1px solid #F2F2F4" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#FAFAFB"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} style={{ width: 34, height: 34, borderRadius: 11, objectFit: "cover", flexShrink: 0 }} alt={displayName} />
                            ) : (
                              <Avatar name={displayName} tone={tone} size={34} radius={11} />
                            )}
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 650, color: "#0A0A0A", margin: 0 }}>{displayName}</p>
                              <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <Chip tone={roleChip.tone} bg={roleChip.bg}>{ROLE_LABELS[u.role] || u.role}</Chip>
                        </td>
                        <td style={tdStyle}>{u.designation || <span style={{ color: "#C9CCD4" }}>—</span>}</td>
                        <td style={tdStyle}>{u.email || <span style={{ color: "#C9CCD4" }}>Not set</span>}</td>
                        <td style={tdStyle}>
                          {canModify(u) ? (
                            <Switch
                              checked={u.isActive}
                              onCheckedChange={() => handleToggleActive(u)}
                              disabled={!canModify(u)}
                              aria-label={`Toggle ${u.fullName || u.username} active`}
                            />
                          ) : (
                            <Chip
                              tone={u.isActive ? "#059669" : "#9CA3AF"}
                              bg={u.isActive ? "#DCFCE7" : "#F3F4F6"}
                            >
                              {u.isActive ? "Active" : "Inactive"}
                            </Chip>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {canModify(u) ? (
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                              <button type="button" title="Edit" onClick={() => openEdit(u)} style={rowIcon}
                                onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = ACCENT; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                              ><Icon name="edit" size={14} /></button>
                              <button type="button" title="Reset Password" onClick={() => handleResetPassword(u)} style={rowIcon}
                                onMouseEnter={e => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = ACCENT; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                              ><Icon name="lock" size={14} /></button>
                              <button type="button" title={u.isActive ? "Deactivate" : "Activate"} onClick={() => handleToggleActive(u)} style={rowIcon}
                                onMouseEnter={e => { e.currentTarget.style.background = u.isActive ? "#FEE2E2" : "#DCFCE7"; e.currentTarget.style.color = u.isActive ? "#DC2626" : "#059669"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                              ><Icon name={u.isActive ? "userCheck" : "userCheck"} size={14} /></button>
                              <button type="button" title="Delete" onClick={() => handleDelete(u)} style={rowIcon}
                                onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#DC2626"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A9ACB3"; }}
                              ><Icon name="x" size={14} /></button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: "#D1D5DB" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>

      {/* ── Add/Edit Modal ────────────────────────────────────────────────────── */}
      <CrudModal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? "Edit User" : "Add User"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!editUser && (
            <div>
              <label htmlFor="user-username" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Username *</label>
              <input id="user-username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase() }))} style={inp} placeholder="lowercase, no spaces" />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Full Name *", "fullName", "text"], ["Email", "email", "email"], ["Phone", "phone", "tel"], ["Designation", "designation", "text"]].map(([label, field, type]) => (
              <div key={field}>
                <label htmlFor={`user-${field}`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
                <input id={`user-${field}`} type={type} value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          {currentUser?.role === "superadmin" && (
            <div>
              <label htmlFor="user-role" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>Role</label>
              <CustomSelect value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))} options={[{ value: "user", label: "User" }, { value: "admin", label: "Admin" }]} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: "11px", border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", font: "inherit" }}>Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px", background: ACCENT, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, font: "inherit" }}>
              {saving ? "Saving..." : editUser ? "Save Changes" : "Create User"}
            </button>
          </div>
        </div>
      </CrudModal>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </AppShell>
  );
}

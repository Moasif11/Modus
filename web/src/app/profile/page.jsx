"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import CustomSelect from "@/components/ui/CustomSelect";
import { useAuth } from "@/utils/auth";
import { api } from "@/utils/api";
import { Camera, AlertTriangle, Pencil, Lock, BadgeCheck, User, SlidersHorizontal } from "lucide-react";

const ROLE_LABELS = { superadmin: "Super Admin", admin: "Admin", user: "Member" };
const COUNTRIES = [
  "India", "United States", "United Kingdom", "United Arab Emirates", "Canada", "Australia",
  "Singapore", "Germany", "France", "Netherlands", "Spain", "Italy", "Ireland", "Switzerland",
  "Sweden", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman", "Malaysia", "Indonesia",
  "Philippines", "Thailand", "Vietnam", "Japan", "China", "South Korea", "Hong Kong", "New Zealand",
  "South Africa", "Nigeria", "Kenya", "Egypt", "Brazil", "Mexico", "Argentina", "Bangladesh",
  "Sri Lanka", "Nepal", "Pakistan", "Israel", "Turkey", "Poland", "Portugal", "Belgium",
  "Denmark", "Norway", "Finland", "Austria", "Czech Republic", "Greece", "Mauritius",
];
const PREF_OPTIONS = {
  language: ["English (US)", "English (UK)", "Spanish", "French", "German"],
  currency: ["USD (US Dollar)", "EUR (Euro)", "GBP (British Pound)", "INR (Indian Rupee)"],
  dateFormat: ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
  themePreference: ["Light", "Dark", "System Default"],
};
const toOpts = (arr) => arr.map((o) => ({ value: o, label: o }));

export default function ProfilePage() {
  const { user: authUser, resetPassword } = useAuth();
  const [profile, setProfile] = useState(null);
  const [company, setCompany] = useState(null);

  // Forms
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", designation: "", department: "", country: "" });
  const [preferencesForm, setPreferencesForm] = useState({ language: "English (US)", currency: "USD (US Dollar)", dateFormat: "MM/DD/YYYY", themePreference: "Light" });
  const [pwForm, setPwForm] = useState({ current: "", newPass: "", confirm: "" });

  // Edit toggles
  const [editPersonal, setEditPersonal] = useState(false);
  const [editPrefs, setEditPrefs] = useState(false);

  // State
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaveMsg, setPrefSaveMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwError, setPwError] = useState("");
  const [uploading, setUploading] = useState(false);

  const pwRef = useRef(null);

  useEffect(() => { loadProfile(); loadCompany(); }, []);

  async function loadProfile() {
    try {
      const data = await api.get("/api/profile");
      setProfile(data.user);
      setForm({
        fullName: data.user.fullName || data.user.name || "",
        email: data.user.email || "",
        phone: data.user.phone || "",
        designation: data.user.designation || "",
        department: data.user.department || "",
        country: data.user.country || "",
      });
    } catch (err) { console.error("Failed to load profile:", err); }
  }

  async function loadCompany() {
    try {
      const data = await api.get("/api/settings/company");
      setCompany(data);
    } catch (err) { console.error("Failed to load company:", err); }
  }

  async function handleSaveProfile() {
    setSaving(true); setSaveMsg("");
    try {
      await api.put("/api/profile", form);
      setSaveMsg("Profile updated.");
      setEditPersonal(false);
      loadProfile();
    } catch (err) { setSaveMsg("Error: " + err.message); }
    finally { setSaving(false); }
  }

  function handleSavePreferences() {
    setPrefSaving(true);
    setTimeout(() => {
      setPrefSaveMsg("Preferences updated.");
      setPrefSaving(false);
      setEditPrefs(false);
    }, 400);
  }

  function cancelPersonal() {
    setForm({
      fullName: profile?.fullName || profile?.name || "",
      email: profile?.email || "",
      phone: profile?.phone || "",
      designation: profile?.designation || "",
      department: profile?.department || "",
      country: profile?.country || "",
    });
    setSaveMsg(""); setEditPersonal(false);
  }

  function cancelPrefs() { setPrefSaveMsg(""); setEditPrefs(false); }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB."); return; }
    setUploading(true);
    try {
      const token = localStorage.getItem("modus_auth_token");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      loadProfile();
    } catch (err) { toast.error("Upload failed: " + err.message); }
    finally { setUploading(false); }
  }

  async function handlePasswordChange() {
    setPwError(""); setPwMsg("");
    if (pwForm.newPass !== pwForm.confirm) { setPwError("Passwords don't match."); return; }
    if (pwForm.newPass.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    setPwSaving(true);
    try {
      await resetPassword(pwForm.current, pwForm.newPass);
      setPwMsg("Password changed. Other sessions signed out.");
      setPwForm({ current: "", newPass: "", confirm: "" });
    } catch (err) { setPwError(err.message || "Failed to change password."); }
    finally { setPwSaving(false); }
  }

  const initials = (profile?.fullName || profile?.name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  // Profile completion
  const completionFields = [form.fullName, form.email, form.phone, form.designation, form.department, form.country, profile?.avatarUrl];
  const filled = completionFields.filter(Boolean).length;
  const completion = Math.round((filled / completionFields.length) * 100);

  function lastActive() {
    const t = profile?.lastLoginAt || profile?.last_login_at;
    if (!t) return null;
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Active now";
    if (mins < 60) return `Last active ${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Last active ${hrs}h ago`;
    return `Last active ${Math.floor(hrs / 24)}d ago`;
  }

  // Shared styles
  const inp = { width: "100%", padding: "10px 12px", border: "1.5px solid #E5E7EB", borderRadius: 9, fontSize: 13, color: "#0A0A0A", background: "#FAFAFA", boxSizing: "border-box", outline: "none" };
  const lockedInp = { width: "100%", padding: "10px 12px", border: "1px solid #F1F2F4", borderRadius: 9, fontSize: 13, color: "#6B7280", background: "#F9FAFB", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };
  const editBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 15px", background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "#374151", cursor: "pointer" };
  const saveBtn = (busy) => ({ padding: "9px 22px", background: "#E11D2C", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 700, color: "#FFF", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 });
  const ghostBtn = { padding: "9px 18px", background: "#FFF", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "#374151", cursor: "pointer" };

  function ReadField({ label, value }) {
    return (
      <div>
        <label style={{ ...labelStyle, color: "#9CA3AF" }}>{label}</label>
        <p style={{ ...lockedInp, margin: 0 }}>{value || "—"}</p>
      </div>
    );
  }

  function SectionHead({ icon, title, editing, canEdit, onEdit }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ color: "#6B7280", display: "flex" }}>{icon}</span>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>{title}</h2>
        </div>
        {canEdit && !editing && (
          <button type="button" onClick={onEdit} style={editBtn}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <AppShell>
      <style jsx global>{`
        .pf-inp:focus { border-color: #E11D2C !important; background: #FFF !important; box-shadow: 0 0 0 3px rgba(225,29,44,0.1) !important; outline: none !important; }
        .pf-card { background: #FFF; border: 1px solid #EBEBEB; border-radius: 16px; padding: 28px; }
        @media (max-width: 900px) { .pf-two-col { grid-template-columns: 1fr !important; } .pf-grid-3 { grid-template-columns: 1fr 1fr !important; } }
        @media (max-width: 720px) { .pf-grid-3 { grid-template-columns: 1fr !important; } .pf-hero-top { flex-direction: column !important; align-items: flex-start !important; gap: 18px !important; } }
      `}</style>

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 0 28px" }}>
       <div style={{ width: "100%" }}>

        {/* Email warning */}
        {profile && !profile.email && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: "#92400E", margin: 0 }}>Add your email address to enable password recovery.</p>
          </div>
        )}

        {/* HERO */}
        <div style={{ background: "linear-gradient(110deg, #FFFFFF 0%, #FFF5F5 55%, #FFE9EC 100%)", border: "1px solid #F4DDE0", borderRadius: 18, padding: 28, marginBottom: 24 }}>
          <div className="pf-hero-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 92, height: 92, borderRadius: "50%", background: profile?.avatarUrl ? "transparent" : "linear-gradient(135deg, #E11D2C, #F87171)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "3px solid #FFF", boxShadow: "0 4px 14px rgba(0,0,0,0.1)" }}>
                  {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 28, fontWeight: 700, color: "white" }}>{initials}</span>}
                </div>
                <label style={{ position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: "50%", background: "#E11D2C", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.2)", border: "2px solid #FFF" }}>
                  {uploading ? <div style={{ width: 12, height: 12, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : <Camera size={13} color="white" />}
                  <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                </label>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0A0A0A", margin: 0, letterSpacing: "-0.02em" }}>{profile?.fullName || profile?.name || "—"}</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#E11D2C", background: "#FDECEE", border: "1px solid #F8CDD2", borderRadius: 100, padding: "3px 10px" }}>{ROLE_LABELS[profile?.role] || profile?.role}</span>
                </div>
                {company?.legalName && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{company.legalName}</span>
                    <BadgeCheck size={15} color="#E11D2C" />
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "#9CA3AF" }}>
                  <span>{profile?.email || "No email"}</span>
                  {lastActive() && (<><span>•</span><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />{lastActive()}</span></>)}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
              <button type="button" onClick={() => setEditPersonal(true)} style={editBtn}><Pencil size={13} /> Edit Profile</button>
              <button type="button" onClick={() => pwRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} style={editBtn}><Lock size={13} /> Security Settings</button>
            </div>
          </div>

          {/* Completion — full-width bar */}
          <div style={{ marginTop: 24, paddingTop: 22, borderTop: "1px solid #F4DDE0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>Profile Completion</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#E11D2C" }}>{completion}%</span>
            </div>
            <div style={{ height: 8, background: "#F1E0E2", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ width: `${completion}%`, height: "100%", background: "linear-gradient(90deg, #E11D2C, #F87171)", borderRadius: 100, transition: "width 0.4s" }} />
            </div>
            <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "9px 0 0" }}>{completion < 100 ? "Almost there! Complete your profile to reach 100%." : "Your profile is complete."}</p>
          </div>
        </div>

        {/* Personal Info */}
        <div className="pf-card" style={{ marginBottom: 24 }}>
          <SectionHead icon={<User size={16} />} title="Personal Information" editing={editPersonal} canEdit onEdit={() => setEditPersonal(true)} />

          <div className="pf-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            {[["Full Name", "fullName", "text"], ["Email", "email", "email"], ["Phone", "phone", "tel"], ["Designation", "designation", "text"], ["Department", "department", "text"]].map(([label, field, type]) => (
              <div key={field}>
                <label style={labelStyle}>{label}</label>
                <input type={type} value={form[field]} disabled={!editPersonal} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} className="pf-inp" style={editPersonal ? inp : lockedInp} />
              </div>
            ))}
            <div>
              <label style={labelStyle}>Country</label>
              {editPersonal ? (
                <CustomSelect value={form.country} searchable placeholder="Select country" onChange={(v) => setForm((f) => ({ ...f, country: v }))} options={toOpts(COUNTRIES)} />
              ) : (
                <p style={{ ...lockedInp, margin: 0 }}>{form.country || "—"}</p>
              )}
            </div>
          </div>

          {/* Read-only meta */}
          <div className="pf-grid-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: editPersonal ? 24 : 0 }}>
            <ReadField label="Username" value={profile?.username ? "@" + profile.username : ""} />
            <ReadField label="Role" value={ROLE_LABELS[profile?.role] || ""} />
            <ReadField label="Member Since" value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""} />
          </div>

          {saveMsg && <p style={{ fontSize: 13, color: saveMsg.startsWith("Error") ? "#DC2626" : "#059669", margin: "16px 0 12px" }}>{saveMsg}</p>}
          {editPersonal && (
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={handleSaveProfile} disabled={saving} style={saveBtn(saving)}>{saving ? "Saving..." : "Save Changes"}</button>
              <button type="button" onClick={cancelPersonal} style={ghostBtn}>Cancel</button>
            </div>
          )}
        </div>

        <div className="pf-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "stretch", marginBottom: 24 }}>
          {/* Preferences */}
          <div className="pf-card">
            <SectionHead icon={<SlidersHorizontal size={16} />} title="Preferences" editing={editPrefs} canEdit onEdit={() => setEditPrefs(true)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[["Language", "language"], ["Currency", "currency"], ["Date Format", "dateFormat"], ["Theme Preference", "themePreference"]].map(([label, field]) => (
                <div key={field}>
                  <label style={labelStyle}>{label}</label>
                  {editPrefs ? (
                    <CustomSelect value={preferencesForm[field]} onChange={(v) => setPreferencesForm((f) => ({ ...f, [field]: v }))} options={toOpts(PREF_OPTIONS[field])} />
                  ) : (
                    <p style={{ ...lockedInp, margin: 0 }}>{preferencesForm[field]}</p>
                  )}
                </div>
              ))}
            </div>
            {prefSaveMsg && <p style={{ fontSize: 13, color: "#059669", margin: "16px 0 0" }}>{prefSaveMsg}</p>}
            {editPrefs && (
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button type="button" onClick={handleSavePreferences} disabled={prefSaving} style={saveBtn(prefSaving)}>{prefSaving ? "Saving..." : "Save Changes"}</button>
                <button type="button" onClick={cancelPrefs} style={ghostBtn}>Cancel</button>
              </div>
            )}
          </div>

          {/* Security · Change Password */}
          <div ref={pwRef} className="pf-card">
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
              <Lock size={16} color="#6B7280" />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0A0A0A", margin: 0 }}>Security</h2>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[["Current Password", "current"], ["New Password (min 8 chars)", "newPass"], ["Confirm New Password", "confirm"]].map(([label, field]) => (
                <div key={field}>
                  <label style={labelStyle}>{label}</label>
                  <input type="password" value={pwForm[field]} onChange={(e) => setPwForm((f) => ({ ...f, [field]: e.target.value }))} className="pf-inp" style={inp} />
                </div>
              ))}
              {pwError && <p style={{ fontSize: 13, color: "#DC2626", margin: 0 }}>{pwError}</p>}
              {pwMsg && <p style={{ fontSize: 13, color: "#059669", margin: 0 }}>{pwMsg}</p>}
              <button type="button" onClick={handlePasswordChange} disabled={pwSaving} style={{ padding: "11px 28px", background: "#0A0A0A", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#FFF", cursor: "pointer", alignSelf: "flex-start", marginTop: 2 }}>
                {pwSaving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>

       </div>
      </div>
    </AppShell>
  );
}

import { useState, useEffect } from "react";
import { useAuth } from "@/utils/auth";
import { api } from "@/utils/api";
import { Logo } from "@/components/studio/Logo";
import { Icon } from "@/components/studio/icons";

export default function ResetPasswordPage() {
  const { user, loading, resetPassword } = useAuth();
  const [token, setToken] = useState(null); // email-token flow
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detect which flow: email-token (has ?token=) or first-login (session user)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("token");
      if (t) setToken(t);
    }
  }, []);

  // First-login flow: redirect to login if no session and no token
  useEffect(() => {
    if (!loading && !user && !token && typeof window !== "undefined") {
      // Wait for token detection from URL before redirecting
      const params = new URLSearchParams(window.location.search);
      if (!params.get("token")) {
        window.location.href = "/login";
      }
    }
  }, [user, loading, token]);

  const ACCENT = "#E11D2C";

  const strength = [
    newPass.length >= 8,
    /[A-Z]/.test(newPass),
    /[0-9]/.test(newPass),
    /[^A-Za-z0-9]/.test(newPass),
  ];
  const strengthColors = ["#EF4444", "#F59E0B", "#10B981", "#10B981"];
  const strengthCount = strength.filter(Boolean).length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPass !== confirm) { setError("Passwords don't match."); return; }
    if (newPass.length < 8) { setError("Password must be at least 8 characters."); return; }

    setIsSubmitting(true);
    try {
      if (token) {
        // Email-token flow
        await api.post("/api/auth/reset-password-token", { token, newPassword: newPass });
        setSuccess("Password reset successfully. Please log in.");
      } else {
        // First-login forced reset flow
        if (user?.must_reset_password && !email) { setError("Email is required to enable password recovery."); setIsSubmitting(false); return; }
        if (user?.must_reset_password && !email.includes('@')) { setError("Enter a valid email address."); setIsSubmitting(false); return; }
        await resetPassword(current, newPass, email || undefined);
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isTokenFlow = !!token;
  const title = isTokenFlow ? "Set a new password" : (user?.must_reset_password ? "Set new password" : "Update password");
  const subtitle = isTokenFlow ? "Choose something strong and memorable" : (user?.must_reset_password ? "Set your password and email to continue." : "Update your account password.");

  if (loading && !isTokenFlow) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0A0A0C", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: "3px solid #E11D2C", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0A0A0C", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 100, fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
        <style>{`@keyframes drift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(40px, 30px); } } @keyframes drift2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-30px, -40px); } }`}</style>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}38, transparent 65%)`, filter: "blur(40px)", animation: "drift 18s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-25%", right: "-5%", width: 520, height: 520, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}28, transparent 65%)`, filter: "blur(50px)", animation: "drift2 22s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 380, width: "90vw", background: "rgba(20,20,24,.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 20, border: "1px solid rgba(255,255,255,.08)", padding: "40px 36px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(16,185,129,.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon name="check" size={24} color="#34D399" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 750, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Password updated</h2>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.55)", margin: "0 0 28px", lineHeight: 1.6 }}>{success}</p>
          <a href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px", background: ACCENT, color: "#fff", borderRadius: 13, fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: `0 12px 30px ${ACCENT}40` }}>
            Go to sign in
            <Icon name="arrowRight" size={17} strokeWidth={2.2} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A0A0C", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 100, fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .auth-field-wrap { display:flex; align-items:center; gap:11px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:13px; padding:13px 15px; transition:border .15s; }
        .auth-field-wrap:focus-within { border-color: ${ACCENT}; }
        .auth-field-wrap input { flex:1; border:none; outline:none; background:transparent; color:#fff; font:inherit; font-size:13.5px; }
        .auth-field-wrap input::placeholder { color: rgba(255,255,255,.35); }
        .auth-primary-btn { width:100%; padding:13px; background:${ACCENT}; color:#fff; border:none; border-radius:13px; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 12px 30px ${ACCENT}40; transition:transform .12s; }
        .auth-primary-btn:active:not(:disabled) { transform:scale(.98); }
        .auth-primary-btn:disabled { opacity:.65; cursor:not-allowed; }
      `}</style>

      {/* Background blobs */}
      <div style={{ position: "absolute", top: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}38, transparent 65%)`, filter: "blur(40px)", animation: "drift 18s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-25%", right: "-5%", width: 520, height: 520, borderRadius: "50%", background: `radial-gradient(circle, ${ACCENT}28, transparent 65%)`, filter: "blur(50px)", animation: "drift2 22s ease-in-out infinite" }} />
      {/* Dotted grid */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.4, backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />

      {/* Split panel */}
      <div style={{ position: "relative", width: 880, maxWidth: "94vw", minHeight: 560, maxHeight: "94vh", display: "flex", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)" }}>

        {/* Left brand panel */}
        <div style={{ width: 340, flexShrink: 0, background: `linear-gradient(160deg, ${ACCENT} 0%, #7A0E18 100%)`, padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 220, height: 220, borderRadius: "50%", border: "40px solid rgba(255,255,255,.06)" }} />
          <div style={{ position: "absolute", bottom: 40, left: -60, width: 180, height: 180, borderRadius: "50%", border: "30px solid rgba(255,255,255,.05)" }} />
          <Logo tone="dark" height={26} accent="#fff" />
          <div style={{ position: "relative" }}>
            <p style={{ fontSize: 25, fontWeight: 750, color: "#fff", margin: "0 0 12px", lineHeight: 1.25, letterSpacing: "-0.02em" }}>Invoicing, accounting &amp; GST — all in one calm workspace.</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.75)", margin: 0, lineHeight: 1.6 }}>Trusted by India's sharpest creative studios to bill clients and stay GST-compliant.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex" }}>
              {["#fff", "#FCA5A5", "#FECACA"].map((c, i) => (
                <div key={c} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: "2px solid #B01420", marginLeft: i ? -10 : 0, opacity: .95 }} />
              ))}
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.85)", margin: 0 }}>Modern studios billing on MODUS</p>
          </div>
        </div>

        {/* Right form panel */}
        <div style={{ flex: 1, background: "rgba(20,20,24,.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", padding: "44px 48px", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ maxWidth: 340, width: "100%", margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 750, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{title}</h2>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.5)", margin: "0 0 24px" }}>{subtitle}</p>

            {/* First-login warning */}
            {!isTokenFlow && user?.must_reset_password && (
              <div style={{ background: "rgba(234,179,8,.15)", border: "1px solid rgba(234,179,8,.35)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Icon name="alert" size={15} color="#FDE68A" style={{ marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#FDE68A", margin: 0 }}>First login: you must change the default password.</p>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(220,38,38,.18)", border: "1px solid rgba(220,38,38,.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#FECACA", margin: 0 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>

              {/* Current password — only for first-login flow */}
              {!isTokenFlow && (
                <div className="auth-field-wrap">
                  <Icon name="lock" size={17} color="rgba(255,255,255,.4)" />
                  <input
                    type="password"
                    placeholder="Current password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              )}

              {/* New password */}
              <div className="auth-field-wrap">
                <Icon name="lock" size={17} color="rgba(255,255,255,.4)" />
                <input
                  type={showNew ? "text" : "password"}
                  placeholder="New password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  required
                  autoFocus={isTokenFlow}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNew((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  <Icon name="eye" size={16} color="rgba(255,255,255,.4)" />
                </button>
              </div>

              {/* Strength bar */}
              {newPass.length > 0 && (
                <div style={{ marginTop: -4, marginBottom: 2 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 5 }}>
                    {strength.map((ok, i) => (
                      <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: ok ? strengthColors[strengthCount - 1] : "rgba(255,255,255,.15)", transition: "background .2s" }} />
                    ))}
                  </div>
                  <p style={{ fontSize: 11, color: strengthCount >= 3 ? "#6EE7B7" : "rgba(255,255,255,.4)", margin: 0 }}>
                    {strengthCount < 2 ? "Weak — add uppercase, numbers, symbols" : strengthCount < 4 ? "Good — add more variety" : "Strong password ✓"}
                  </p>
                </div>
              )}

              {/* Confirm password */}
              <div className="auth-field-wrap">
                <Icon name="lock" size={17} color="rgba(255,255,255,.4)" />
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                  <Icon name="eye" size={16} color="rgba(255,255,255,.4)" />
                </button>
              </div>

              {/* Email — first-login only */}
              {!isTokenFlow && user?.must_reset_password && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="auth-field-wrap">
                    <Icon name="mail" size={17} color="rgba(255,255,255,.4)" />
                    <input
                      type="email"
                      placeholder="Email address *"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: 0, paddingLeft: 4 }}>Used for password recovery. Not shared.</p>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="auth-primary-btn" style={{ marginTop: 8 }}>
                {isSubmitting ? (
                  <>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                    Updating…
                  </>
                ) : (
                  <>
                    {isTokenFlow ? "Reset password" : "Set new password"}
                    <Icon name="arrowRight" size={17} strokeWidth={2.2} />
                  </>
                )}
              </button>
            </form>

            {isTokenFlow && (
              <a href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "rgba(255,255,255,.5)", textDecoration: "none", marginTop: 16 }}>
                <Icon name="arrowLeft" size={13} />
                Back to sign in
              </a>
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.3)", margin: "24px 0 0" }}>
              MODUS ERP · Open Source Studio Management
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

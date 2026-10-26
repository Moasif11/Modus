import { useState, useEffect, useRef } from "react";
import { api } from "@/utils/api";
import { Logo } from "@/components/studio/Logo";
import { Icon } from "@/components/studio/icons";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const data = await api.post("/api/auth/forgot-password", { email });
      setMessage(data.message || "Reset request has been registered successfully.");
    } catch (err) {
      setError(err.message || "Unable to request password reset. Contact administrator.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const ACCENT = "#E11D2C";

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
      <div style={{ position: "relative", width: 880, maxWidth: "94vw", height: 560, maxHeight: "94vh", display: "flex", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)" }}>

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
        <div style={{ flex: 1, background: "rgba(20,20,24,.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", padding: "44px 48px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ maxWidth: 340, width: "100%", margin: "0 auto" }}>
            <h2 style={{ fontSize: 24, fontWeight: 750, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              {message ? "Request sent" : "Reset your password"}
            </h2>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.5)", margin: "0 0 28px" }}>
              {message ? "Please check your inbox." : "We'll email you a secure link"}
            </p>

            {error && (
              <div style={{ background: "rgba(220,38,38,.18)", border: "1px solid rgba(220,38,38,.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#FECACA", margin: 0 }}>{error}</p>
              </div>
            )}

            {message ? (
              /* Success view */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", borderRadius: 13, padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="mail" size={18} color="#34D399" />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#34D399", margin: "0 0 4px" }}>Recovery link sent</p>
                    <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.75)", lineHeight: 1.5, margin: 0 }}>{message}</p>
                  </div>
                </div>
                <div style={{ background: "rgba(234,179,8,.1)", border: "1px solid rgba(234,179,8,.2)", borderRadius: 12, padding: "13px 15px" }}>
                  <p style={{ fontSize: 12, color: "#FDE68A", lineHeight: 1.5, margin: 0 }}>
                    If you don't receive the email, contact your workspace administrator for assistance.
                  </p>
                </div>
                <a href="/login" className="auth-primary-btn" style={{ marginTop: 4, textDecoration: "none" }}>
                  Back to sign in
                  <Icon name="arrowRight" size={17} strokeWidth={2.2} />
                </a>
              </div>
            ) : (
              /* Request form */
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                <div className="auth-field-wrap">
                  <Icon name="mail" size={17} color="rgba(255,255,255,.4)" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className="auth-primary-btn" style={{ marginTop: 8 }}>
                  {isSubmitting ? (
                    <>
                      <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send reset link
                      <Icon name="arrowRight" size={17} strokeWidth={2.2} />
                    </>
                  )}
                </button>

                <a href="/login" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, color: "rgba(255,255,255,.5)", textDecoration: "none", marginTop: 4 }}>
                  <Icon name="arrowLeft" size={13} />
                  Back to sign in
                </a>
              </form>
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.3)", margin: "28px 0 0" }}>
              MODUS ERP · Open Source Studio Management
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

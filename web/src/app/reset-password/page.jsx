import { useState, useEffect } from "react";
import { useAuth } from "@/utils/auth";
import { api } from "@/utils/api";
import { Logo } from "@/components/studio/Logo";
import { Icon } from "@/components/studio/icons";
import SmokeyBackground from "@/components/ui/SmokeyBackground";

export default function ResetPasswordPage() {
  const { user, loading, resetPassword } = useAuth();
  const [token, setToken] = useState(null);
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("token");
      if (t) setToken(t);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && !token && typeof window !== "undefined") {
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
    if (newPass !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (newPass.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (token) {
        await api.post("/api/auth/reset-password-token", { token, newPassword: newPass });
        setSuccess("Password updated successfully! Redirecting to login…");
        setTimeout(() => { window.location.href = "/login"; }, 2000);
      } else {
        await resetPassword(current, newPass, email);
        setSuccess("Password updated successfully! Redirecting to workspace…");
        setTimeout(() => { window.location.href = "/"; }, 1500);
      }
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isTokenFlow = Boolean(token);
  const title = isTokenFlow
    ? "Set a new password"
    : user?.must_reset_password
    ? "Welcome to MODUS"
    : "Change password";
  const subtitle = isTokenFlow
    ? "Choose a strong password to secure your account."
    : user?.must_reset_password
    ? "Please set your personal password to activate your account."
    : "Update your current account password.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#050507",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 100,
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}
    >
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        .auth-field-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 12px 16px;
          transition: border-color .15s, background .15s;
        }
        .auth-field-wrap:focus-within {
          border-color: ${ACCENT};
          background: rgba(255,255,255,0.09);
        }
        .auth-field-wrap input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          color: #fff;
          font: inherit;
          font-size: 13.5px;
        }
        .auth-field-wrap input::placeholder {
          color: rgba(255,255,255,0.38);
        }
        .auth-primary-btn {
          width: 100%;
          padding: 13.5px;
          background: ${ACCENT};
          color: #fff;
          border: none;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 12px 30px ${ACCENT}50;
          transition: transform .12s, box-shadow .12s, opacity .12s;
        }
        .auth-primary-btn:hover:not(:disabled) {
          box-shadow: 0 16px 36px ${ACCENT}65;
        }
        .auth-primary-btn:active:not(:disabled) {
          transform: scale(.98);
        }
        .auth-primary-btn:disabled {
          opacity: .65;
          cursor: not-allowed;
        }
        .glow-overlay {
          position: absolute;
          width: 480px;
          height: 480px;
          background: radial-gradient(circle, ${ACCENT}26 0%, transparent 70%);
          pointer-events: none;
          filter: blur(50px);
          animation: floatSlow 8s ease-in-out infinite;
        }
      `}</style>

      {/* WebGL Smokey Background */}
      <SmokeyBackground color={ACCENT} blur="2px" />

      {/* Dynamic Background Glow Overlay */}
      <div className="glow-overlay" style={{ top: "15%", left: "12%" }} />
      <div className="glow-overlay" style={{ bottom: "12%", right: "12%", animationDelay: "-4s" }} />

      {/* Central Card */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: 460,
          maxWidth: "94vw",
          maxHeight: "92vh",
          overflowY: "auto",
          borderRadius: 28,
          boxShadow: "0 28px 72px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          padding: "44px 40px",
        }}
      >
        {/* Organic Grain texture inside panel */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.08,
            pointerEvents: "none",
            zIndex: 0,
          }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="reset-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#reset-grain)" />
        </svg>

        <div
          style={{
            maxWidth: 360,
            width: "100%",
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Brand Logo */}
          <div style={{ marginBottom: 28 }}>
            <Logo tone="dark" height={28} />
          </div>

          <h2 style={{ fontSize: 23, fontWeight: 750, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {title}
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.5 }}>
            {subtitle}
          </p>

          {/* First-login banner */}
          {!isTokenFlow && user?.must_reset_password && (
            <div
              style={{
                background: "rgba(234,179,8,0.12)",
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon name="shieldCheck" size={16} color="#FDE68A" />
              <p style={{ fontSize: 12, color: "#FDE68A", margin: 0, lineHeight: 1.4 }}>
                For security, please change your default password before entering the ERP.
              </p>
            </div>
          )}

          {error && (
            <div
              style={{
                background: "rgba(220,38,38,0.18)",
                border: "1px solid rgba(220,38,38,0.4)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, color: "#FECACA", margin: 0 }}>{error}</p>
            </div>
          )}

          {success && (
            <div
              style={{
                background: "rgba(16,185,129,0.15)",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 18,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Icon name="check" size={16} color="#34D399" />
              <p style={{ fontSize: 12.5, color: "#A7F3D0", margin: 0 }}>{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {!isTokenFlow && (
              <div className="auth-field-wrap">
                <Icon name="lock" size={16} color="rgba(255,255,255,0.4)" />
                <input
                  type="password"
                  placeholder="Current password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {!isTokenFlow && user?.must_reset_password && (
              <div className="auth-field-wrap">
                <Icon name="mail" size={16} color="rgba(255,255,255,0.4)" />
                <input
                  type="email"
                  placeholder="Work email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            <div className="auth-field-wrap">
              <Icon name="lock" size={16} color="rgba(255,255,255,0.4)" />
              <input
                type={showNew ? "text" : "password"}
                placeholder="New password (min. 8 chars)"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
                autoFocus={isTokenFlow}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.45)" }}
              >
                <Icon name={showNew ? "eyeOff" : "eye"} size={15} />
              </button>
            </div>

            {/* Strength meter */}
            {newPass.length > 0 && (
              <div style={{ display: "flex", gap: 4, margin: "2px 0" }}>
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: idx < strengthCount ? strengthColors[strengthCount - 1] : "rgba(255,255,255,0.12)",
                      transition: "background .2s",
                    }}
                  />
                ))}
              </div>
            )}

            <div className="auth-field-wrap">
              <Icon name="lock" size={16} color="rgba(255,255,255,0.4)" />
              <input
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(255,255,255,0.45)" }}
              >
                <Icon name={showConfirm ? "eyeOff" : "eye"} size={15} />
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newPass || (confirm && newPass !== confirm)}
              className="auth-primary-btn"
              style={{ marginTop: 8 }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin .7s linear infinite",
                    }}
                  />
                  Updating password…
                </>
              ) : (
                <>
                  Set password
                  <Icon name="arrowRight" size={16} strokeWidth={2.2} />
                </>
              )}
            </button>

            <div style={{ textAlign: "center", marginTop: 6 }}>
              <a
                href="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  color: "rgba(255,255,255,0.55)",
                  textDecoration: "none",
                }}
              >
                <Icon name="arrowLeft" size={13} />
                Return to sign in
              </a>
            </div>
          </form>

          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "28px 0 0" }}>
            MODUS ERP · Open Source Studio Management
          </p>
        </div>
      </div>
    </div>
  );
}

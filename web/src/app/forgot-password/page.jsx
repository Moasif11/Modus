import { useState, useEffect, useRef } from "react";
import { api } from "@/utils/api";
import { Logo } from "@/components/studio/Logo";
import { Icon } from "@/components/studio/icons";
import SmokeyBackground from "@/components/SmokeyBackground";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const data = await api.post("/api/auth/forgot-password", { email });
      setMessage(data.message || "If that email is registered, a reset link has been sent.");
    } catch (err) {
      setError(err.message || "Unable to request password reset. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const ACCENT = "#E11D2C";

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
          padding: 13px 16px;
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
          width: 440,
          maxWidth: "94vw",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 28px 72px rgba(0,0,0,0.65)",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          padding: "48px 44px",
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
          <filter id="forgot-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#forgot-grain)" />
        </svg>

        <div
          style={{
            maxWidth: 350,
            width: "100%",
            margin: "0 auto",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Brand Logo */}
          <div style={{ marginBottom: 32 }}>
            <Logo tone="dark" height={28} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 750, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {message ? "Check your inbox" : "Reset password"}
          </h2>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: "0 0 28px", lineHeight: 1.5 }}>
            {message
              ? "We've dispatched recovery instructions to your email."
              : "Enter your registered email and we'll send a secure reset link."}
          </p>

          {error && (
            <div
              style={{
                background: "rgba(220,38,38,0.18)",
                border: "1px solid rgba(220,38,38,0.4)",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
              <p style={{ fontSize: 12.5, color: "#FECACA", margin: 0 }}>{error}</p>
            </div>
          )}

          {message ? (
            /* Success confirmation */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "rgba(16,185,129,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="check" size={18} color="#34D399" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#34D399", margin: "0 0 3px" }}>
                    Request received
                  </p>
                  <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, margin: 0 }}>
                    {message}
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, margin: 0 }}>
                  Did not receive an email? Check your spam folder or contact your workspace administrator.
                </p>
              </div>

              <a
                href="/login"
                className="auth-primary-btn"
                style={{ marginTop: 8, textDecoration: "none" }}
              >
                Back to sign in
                <Icon name="arrowRight" size={16} strokeWidth={2.2} />
              </a>
            </div>
          ) : (
            /* Request form */
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="auth-field-wrap">
                <Icon name="mail" size={17} color="rgba(255,255,255,0.45)" />
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>

              <button type="submit" disabled={isSubmitting || !email.trim()} className="auth-primary-btn" style={{ marginTop: 6 }}>
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
                    Sending request…
                  </>
                ) : (
                  <>
                    Send recovery link
                    <Icon name="arrowRight" size={16} strokeWidth={2.2} />
                  </>
                )}
              </button>

              <div style={{ textAlign: "center", marginTop: 8 }}>
                <a
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.6)",
                    textDecoration: "none",
                    transition: "color .12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.6)")}
                >
                  <Icon name="arrowLeft" size={13} />
                  Return to sign in
                </a>
              </div>
            </form>
          )}

          <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "32px 0 0" }}>
            MODUS ERP · Open Source Studio Management
          </p>
        </div>
      </div>
    </div>
  );
}

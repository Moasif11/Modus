import { useState } from "react";
import { useAuth } from "@/utils/auth";
import { Logo } from "@/components/studio/Logo";
import { Icon } from "@/components/studio/icons";
import SmokeyBackground from "@/components/ui/SmokeyBackground";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const user = await login(username, password);
      if (typeof window !== "undefined") {
        window.location.href = user.must_reset_password
          ? "/reset-password"
          : "/dashboard";
      }
    } catch (err) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const ACCENT = "#E11D2C";

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0A0A0C", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", zIndex: 100, fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulseGlow { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } 100% { opacity: 0.3; transform: scale(1); } }
        
        .glow-overlay {
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(225,29,44,0.15) 0%, transparent 70%);
          pointer-events: none;
          z-index: 1;
          filter: blur(40px);
          animation: pulseGlow 8s ease-in-out infinite;
        }

        .auth-field-wrap { display:flex; align-items:center; gap:11px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:13px; padding:13px 15px; transition:border .15s; }
        .auth-field-wrap:focus-within { border-color: ${ACCENT}; }
        .auth-field-wrap input { flex:1; border:none; outline:none; background:transparent; color:#fff; font:inherit; font-size:13.5px; }
        .auth-field-wrap input::placeholder { color: rgba(255,255,255,.35); }
        
        /* Fix Chrome Autocomplete White Background */
        .auth-field-wrap input:-webkit-autofill,
        .auth-field-wrap input:-webkit-autofill:hover, 
        .auth-field-wrap input:-webkit-autofill:focus, 
        .auth-field-wrap input:-webkit-autofill:active {
            -webkit-transition: color 9999s ease-out, background-color 9999s ease-out;
            -webkit-transition-delay: 9999s;
            -webkit-text-fill-color: #fff !important;
        }

        .auth-primary-btn { width:100%; padding:13px; background:${ACCENT}; color:#fff; border:none; border-radius:13px; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 12px 30px ${ACCENT}40; transition:transform .12s; }
        .auth-primary-btn:active:not(:disabled) { transform:scale(.98); }
        .auth-primary-btn:disabled { opacity:.65; cursor:not-allowed; }
      `}</style>

      {/* WebGL Smokey Background */}
      <SmokeyBackground color={ACCENT} blur="2px" />

      {/* Dynamic Background Glow Overlay */}
      <div className="glow-overlay" style={{ top: "15%", left: "10%" }} />
      <div className="glow-overlay" style={{ bottom: "10%", right: "10%" }} />

      {/* Central Login Card */}
      <div style={{ position: "relative", zIndex: 10, width: 440, maxWidth: "94vw", borderRadius: 28, overflow: "hidden", boxShadow: "0 28px 72px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", padding: "48px 44px" }}>
        
        {/* Organic Grain texture inside panel */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.08, pointerEvents: "none", zIndex: 0 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="welcome-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#welcome-grain)" />
        </svg>

        <div style={{ maxWidth: 340, width: "100%", margin: "0 auto", position: "relative", zIndex: 1, display: "flex", flexDirection: "column" }}>
          
          <div style={{ marginBottom: 32 }}>
            <Logo tone="dark" height={26} accent={ACCENT} />
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 750, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.02em" }}>Welcome back</h2>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.5)", margin: "0 0 28px" }}>Sign in to your MODUS workspace</p>

            {error && (
              <div style={{ background: "rgba(220,38,38,.18)", border: "1px solid rgba(220,38,38,.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#FECACA", margin: 0 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {/* Username */}
              <div className="auth-field-wrap">
                <Icon name="users" size={17} color="rgba(255,255,255,.4)" />
                <input
                  type="text"
                  placeholder="Username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div className="auth-field-wrap">
                <Icon name="lock" size={17} color="rgba(255,255,255,.4)" />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
                >
                  <Icon name="eye" size={16} color="rgba(255,255,255,.4)" />
                </button>
              </div>

              {/* Forgot password */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -2 }}>
                <a href="/forgot-password" style={{ background: "none", border: "none", color: ACCENT, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
                  Forgot password?
                </a>
              </div>

              <button type="submit" disabled={isSubmitting} className="auth-primary-btn" style={{ marginTop: 6 }}>
                {isSubmitting ? (
                  <>
                    <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <Icon name="arrowRight" size={17} strokeWidth={2.2} />
                  </>
                )}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.3)", margin: "28px 0 0" }}>
              MODUS ERP · Open Source Studio Management
            </p>
          </div>
      </div>
    </div>
  );
}

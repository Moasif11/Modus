import { useState, useEffect } from "react";
import { useAuth } from "@/utils/auth";
import { ArrowRight, LayoutDashboard, FileText, Activity, LogIn } from "lucide-react";
import SmokeyBackground from "@/components/ui/SmokeyBackground";
import { Logo } from "@/components/studio/Logo.jsx";

export default function Welcome() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine target route for dashboard action
  const getDashboardHref = () => {
    if (!user) return "/login";
    return user.must_reset_password ? "/reset-password" : "/dashboard";
  };

  const getInvoicesHref = () => {
    if (!user) return "/login";
    return "/invoices";
  };

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0A0A0A",
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}
    >
      <style>{`
        /* Plus Jakarta Sans loaded globally via global.css */
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } 100% { opacity: 0.3; transform: scale(1); } }
        @keyframes pulseGreen { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; background: #0A0A0A; }

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

        .primary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px 20px;
          background: #E11D2C;
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          fontSize: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 16px rgba(225,29,44,0.3);
          text-decoration: none;
        }
        .primary-btn:hover {
          background: #C41828;
          box-shadow: 0 8px 24px rgba(225,29,44,0.55);
          transform: translateY(-2px);
        }
        .primary-btn:hover .arrow-icon {
          transform: translateX(4px);
        }
        .primary-btn:active {
          transform: translateY(0);
        }

        .secondary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.85);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          text-align: center;
        }
        .secondary-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #FFFFFF;
          transform: translateY(-2px);
        }
        .secondary-btn:active {
          transform: translateY(0);
        }

        .status-dot-active {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.7);
          display: inline-block;
          animation: pulseGreen 2s infinite ease-in-out;
        }
      `}</style>

      {/* WebGL Smokey Background */}
      <SmokeyBackground color="#E11D2C" blur="2px" />

      {/* Dynamic Background Glow Overlay */}
      <div className="glow-overlay" style={{ top: "15%", left: "10%" }} />
      <div className="glow-overlay" style={{ bottom: "10%", right: "10%" }} />

      {/* Foreground Container */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "48px 40px",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 28px 72px rgba(0,0,0,0.6)",
            animation: mounted ? "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "none",
            opacity: mounted ? 1 : 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Organic Grain texture */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: 0.08,
              borderRadius: 28,
              pointerEvents: "none",
              zIndex: 0,
            }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <filter id="welcome-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#welcome-grain)" />
          </svg>

          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Header Content */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <Logo tone="dark" height={32} accent="#E11D2C" />
              </div>

              {/* BRAND BADGE */}
              <div
                style={{
                  display: "inline-block",
                  padding: "5px 14px",
                  background: "rgba(225,29,44,0.18)",
                  border: "1px solid rgba(225,29,44,0.35)",
                  borderRadius: 100,
                  marginBottom: 20,
                }}
              >
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: "#FCA5A5",
                    letterSpacing: "0.12em",
                  }}
                >
                  INVOICE STUDIO
                </span>
              </div>

              {/* Title & Description */}
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                  marginBottom: 12,
                }}
              >
                {loading ? (
                  "MODUS ERP"
                ) : user ? (
                  <>
                    Welcome Back<span style={{ color: "#E11D2C" }}>.</span>
                  </>
                ) : (
                  <>
                    Invoice Studio<span style={{ color: "#E11D2C" }}>.</span>
                  </>
                )}
              </h1>
              <p
                style={{
                  fontSize: 14.5,
                  color: "rgba(255,255,255,0.65)",
                  lineHeight: 1.5,
                  maxWidth: "90%",
                  margin: "0 auto",
                }}
              >
                Manage invoices, payments, expenses and operations.
              </p>
            </div>

            {/* Auth Loader / CTA State */}
            {loading ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "24px 0",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    border: "2px solid #E11D2C",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                  Checking status…
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* Primary Action Button */}
                {user ? (
                  <a href={getDashboardHref()} className="primary-btn">
                    Go to Dashboard
                    <ArrowRight className="arrow-icon" size={17} style={{ transition: "transform 0.2s ease" }} />
                  </a>
                ) : (
                  <a href="/login" className="primary-btn">
                    <LogIn size={16} />
                    Sign In
                    <ArrowRight className="arrow-icon" size={17} style={{ transition: "transform 0.2s ease" }} />
                  </a>
                )}

                {/* Info divider */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    margin: "4px 0",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
                    QUICK ACCESS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>

                {/* Grid layout for secondary operations */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <a href={getDashboardHref()} className="secondary-btn">
                    <LayoutDashboard size={14} />
                    Dashboard
                  </a>
                  <a href={getInvoicesHref()} className="secondary-btn">
                    <FileText size={14} />
                    Invoices
                  </a>
                </div>

                {/* System Status Display */}
                <div
                  className="secondary-btn"
                  style={{
                    gridColumn: "span 2",
                    cursor: "default",
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "13px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Activity size={14} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
                    <span style={{ fontWeight: 500 }}>System Status</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="status-dot-active" />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#10B981",
                      }}
                    >
                      Operational
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Legal & Security */}
            <div
              style={{
                marginTop: 40,
                paddingTop: 20,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.02em" }}>
                🔒 Secure Portal · MODUS ERP
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

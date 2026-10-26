import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/utils/auth";
import { Logo } from "@/components/studio/Logo.jsx";

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.must_reset_password) {
          navigate("/reset-password");
        } else {
          navigate("/dashboard");
        }
      } else {
        // Auto-seed database if needed, then go to welcome
        fetch("/api/auth/seed", { method: "POST" })
          .then(() => {
            navigate("/welcome");
          })
          .catch(() => {
            navigate("/welcome");
          });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "inherit",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        
        @keyframes logoPulse {
          0%, 100% { opacity: 0.8; transform: scale(1); filter: drop-shadow(0 0 0px rgba(225,29,44,0)); }
          50% { opacity: 1; transform: scale(1.02); filter: drop-shadow(0 0 16px rgba(225,29,44,0.4)); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; background: #0A0A0A; }
      `}</style>

      {/* Modern, high-end radial light leak */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 50% 50%, rgba(225,29,44,0.12) 0%, transparent 55%)",
          animation: "pulseGlow 6s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Clean elegant background grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(circle at 50% 50%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, black, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Minimalist central card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          padding: "48px",
          borderRadius: 32,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 28px 72px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ marginBottom: 32, animation: "logoPulse 2.5s ease-in-out infinite" }}>
          <Logo tone="dark" height={28} accent="#E11D2C" />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "10px 20px",
            borderRadius: "100px",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: "2px solid #E11D2C",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#E5E7EB",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Initializing Studio
          </span>
        </div>
      </div>
    </div>
  );
}

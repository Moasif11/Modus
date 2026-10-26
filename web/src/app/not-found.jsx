import { Logo } from "@/components/studio/Logo.jsx";
import SmokeyBackground from "@/components/ui/SmokeyBackground";
import { ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  const ACCENT = "#E11D2C";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0A0A0C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 100,
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      }}
    >
      <style>{`
        @keyframes pulseGlow { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } 100% { opacity: 0.3; transform: scale(1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

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
          padding: 14px 24px;
          background: #E11D2C;
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 16px rgba(225,29,44,0.3);
          text-decoration: none;
          margin-top: 16px;
        }
        .primary-btn:hover {
          background: #C41828;
          box-shadow: 0 8px 24px rgba(225,29,44,0.55);
          transform: translateY(-2px);
        }
        .primary-btn:hover .arrow-icon {
          transform: translateX(-4px);
        }
        .primary-btn:active {
          transform: translateY(0);
        }
      `}</style>

      {/* WebGL Smokey Background */}
      <SmokeyBackground color={ACCENT} blur="2px" />

      {/* Dynamic Background Glow Overlay */}
      <div className="glow-overlay" style={{ top: "15%", left: "10%" }} />
      <div className="glow-overlay" style={{ bottom: "10%", right: "10%" }} />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 480,
          padding: "48px 40px",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: 28,
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 28px 72px rgba(0,0,0,0.6)",
          animation: "fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <Logo tone="dark" height={32} accent={ACCENT} />
        </div>

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
            404 ERROR
          </span>
        </div>

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
          Page Not Found<span style={{ color: ACCENT }}>.</span>
        </h1>
        <p
          style={{
            fontSize: 14.5,
            color: "rgba(255,255,255,0.65)",
            lineHeight: 1.5,
            maxWidth: "90%",
            margin: "0 auto 24px",
          }}
        >
          The page you're looking for doesn't exist or has been moved. Let's get you back home.
        </p>

        <a href="/" className="primary-btn">
          <ArrowLeft className="arrow-icon" size={17} style={{ transition: "transform 0.2s ease" }} />
          Return Home
        </a>
      </div>
    </div>
  );
}

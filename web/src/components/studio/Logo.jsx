export function Logo({ tone = "light", height = 26, accent = "#E11D2C" }) {
  const ink = tone === "dark" ? "#FFFFFF" : "#0A0A0A";

  return (
    <svg
      viewBox="0 0 160 38"
      height={height}
      style={{ display: "block" }}
      aria-label="MODUS"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Modern geometric M mark */}
      <rect x="0" y="3" width="7" height="32" rx="3.5" fill={ink} />
      <polygon points="7,5 18,22 22,22 11,5" fill={accent} />
      <polygon points="31,5 20,22 16,22 27,5" fill={accent} />
      <rect x="31" y="3" width="7" height="32" rx="3.5" fill={ink} />

      {/* Crisp Typography: MODUS */}
      <text
        x="50"
        y="28"
        fill={ink}
        fontSize="24"
        fontWeight="800"
        letterSpacing="2.5"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
      >
        MODUS
      </text>
      <circle cx="152" cy="26" r="3.5" fill={accent} />
    </svg>
  );
}

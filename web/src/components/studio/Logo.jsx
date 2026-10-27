import React from "react";

/**
 * MODUS Official Brand Logo Component
 *
 * Implements the MODUS Logo Suite with proper tone and variant selection:
 * - tone="dark": White text/elements for dark backgrounds (#1E1F1F, black, overlays)
 * - tone="light": Black text/elements for light backgrounds (white paper, light cards)
 * - variant="primary": Standard horizontal logo (header, sidebar)
 * - variant="stacked": Centered stacked logo (login, forgot-password, welcome)
 * - variant="icon": Minimal geometric icon mark (collapsed sidebar, mobile)
 */
export function Logo({
  tone = "light",
  variant = "primary",
  height = 26,
  customLogoUrl = null,
  alt = "MODUS ERP",
  className = "",
  style = {},
  ...props
}) {
  // If a custom tenant/company logo is provided via white-label settings
  if (customLogoUrl) {
    return (
      <img
        src={customLogoUrl}
        alt={alt}
        height={height}
        className={className}
        style={{
          height: typeof height === "number" ? `${height}px` : height,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
          display: "inline-block",
          verticalAlign: "middle",
          ...style,
        }}
        {...props}
      />
    );
  }

  // Resolve logo file from Modus Logo Suite
  let src = "";
  if (variant === "icon") {
    src =
      tone === "dark"
        ? "/Assets/logos/Modus-white-icon.webp"
        : "/Assets/logos/Modus-black-icon.webp";
  } else if (variant === "stacked") {
    src =
      tone === "dark"
        ? "/Assets/logos/Modus-stacked.webp"
        : "/Assets/logos/Modus-stacked-black.webp";
  } else {
    // Primary horizontal wordmark + icon
    src =
      tone === "dark"
        ? "/Assets/logos/modus-primary-white.webp"
        : "/Assets/logos/modus-primary-black.webp";
  }

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`modus-brand-logo ${className}`.trim()}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      loading="eager"
      onError={(e) => {
        // Fallback to primary black if specific variant fails to load
        if (e.currentTarget.src !== window.location.origin + "/Assets/logos/modus-primary-black.webp") {
          e.currentTarget.src = "/Assets/logos/modus-primary-black.webp";
        }
      }}
      {...props}
    />
  );
}

export default Logo;

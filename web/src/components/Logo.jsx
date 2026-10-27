import React from "react";
import { Logo as StudioLogo } from "./studio/Logo";

export const Logo = StudioLogo;

export function LogoIcon({
  tone = "light",
  height = 24,
  className = "",
  style = {},
  alt = "MODUS",
  ...props
}) {
  const src =
    tone === "dark"
      ? "/Assets/logos/Modus-white-icon.webp"
      : "/Assets/logos/Modus-black-icon.webp";

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`modus-logo-icon ${className}`.trim()}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: "auto",
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      loading="eager"
      {...props}
    />
  );
}

export default Logo;

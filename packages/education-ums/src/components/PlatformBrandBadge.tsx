import React from "react";

export const PLATFORM_BRAND_LOGO_URL = "/brand/bazion-platform-logo.png";
export const PLATFORM_BRAND_MARK_URL = "/brand/bazion-platform-mark.png";

export function PlatformBrandBadge({ compact = false }: { compact?: boolean }) {
  const width = compact ? 36 : 64;
  const height = Math.round(width * (compact ? 1380 / 1680 : 2225 / 2497));
  const logoUrl = compact ? PLATFORM_BRAND_MARK_URL : PLATFORM_BRAND_LOGO_URL;
  const webpSources = compact
    ? "/brand/bazion-platform-mark-320.webp 320w, /brand/bazion-platform-mark-640.webp 640w"
    : "/brand/bazion-platform-logo-320.webp 320w, /brand/bazion-platform-logo-640.webp 640w, /brand/bazion-platform-logo.webp 960w";

  return (
    <div
      aria-label="Powered by Bazion Web"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 4 : 8,
        color: "#0b2f75",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: compact ? 7 : 9,
        fontWeight: 700,
        lineHeight: 1.15,
      }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet={webpSources}
          sizes={`${width}px`}
        />
        <img
          src={logoUrl}
          alt={compact ? "Bazion Web brand mark" : "Bazion Web"}
          width={width}
          height={height}
          decoding="async"
          style={{
            width,
            height,
            objectFit: "contain",
            display: "block",
            background: "#ffffff",
          }}
        />
      </picture>
      <span>Powered by<br />Bazion Web</span>
    </div>
  );
}

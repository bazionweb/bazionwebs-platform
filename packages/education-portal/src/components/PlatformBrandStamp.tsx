import React from 'react';

export function PlatformBrandStamp({ compact = false }: { compact?: boolean }) {
  const width = compact ? 32 : 48;
  const height = Math.round(width * 263 / 320);

  return (
    <div
      aria-label="Powered by Bazion Web"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 7,
        color: '#0B2F75',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: compact ? '0.58rem' : '0.68rem',
        fontWeight: 700,
        lineHeight: 1.15,
      }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet="/brand/bazion-platform-mark-320.webp 320w, /brand/bazion-platform-mark-640.webp 640w"
          sizes={`${width}px`}
        />
        <img
          src="/brand/bazion-platform-mark.png"
          alt="Bazion Web mark"
          width={width}
          height={height}
          decoding="async"
          style={{ width, height, objectFit: 'contain', display: 'block', background: '#ffffff' }}
        />
      </picture>
      <span>Powered by<br />Bazion Web</span>
    </div>
  );
}

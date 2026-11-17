import React from "react";

export function QRCodeSVG({
  value,
  size = 128,
  bgColor = "#ffffff",
  fgColor = "#0f172a",
  className,
}: {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  bgColor?: string;
  fgColor?: string;
  className?: string;
}) {
  const cells = 21;
  const rects: React.ReactElement[] = [];
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const isFinder = (r: number, c: number) =>
    (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);

  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      let on = false;
      if (isFinder(r, c)) {
        const lr = r >= cells - 7 ? r - (cells - 7) : r;
        const lc = c >= cells - 7 ? c - (cells - 7) : c;
        on = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        on = (((hash >>> ((r + c) % 16)) + r * 31 + c * 17) & 1) === 1;
      }
      if (on) {
        rects.push(<rect key={`${r}-${c}`} x={c + 1} y={r + 1} width={1} height={1} fill={fgColor} />);
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cells + 2} ${cells + 2}`}
      className={className}
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      <rect width={cells + 2} height={cells + 2} fill={bgColor} />
      {rects}
    </svg>
  );
}


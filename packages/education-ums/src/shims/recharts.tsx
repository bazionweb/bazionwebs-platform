import React from "react";

export function ResponsiveContainer({
  children,
  width = "100%",
  height = 240,
}: {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  minHeight?: number;
}) {
  return (
    <div style={{ width, height, minHeight: typeof height === "number" ? height : 200 }}>
      {children}
    </div>
  );
}

export function AreaChart({
  data = [],
  children,
}: {
  data?: Array<Record<string, unknown>>;
  children?: React.ReactNode;
  margin?: Record<string, number>;
}) {
  return (
    <div className="w-full h-full flex flex-col justify-end p-2 border border-slate-200/60 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/40">
      <svg viewBox="0 0 400 140" className="w-full h-full overflow-visible">
        <polyline
          fill="none"
          stroke="#4B0082"
          strokeWidth="2.5"
          points={
            data.length > 0
              ? data
                  .map((_, idx) => {
                    const x = data.length === 1 ? 200 : (idx / (data.length - 1)) * 380 + 10;
                    const y = 110 - ((idx * 19) % 70);
                    return `${x},${y}`;
                  })
                  .join(" ")
              : "10,100 390,40"
          }
        />
      </svg>
      <div className="hidden">{children}</div>
    </div>
  );
}

export function BarChart({
  data = [],
  children,
}: {
  data?: Array<Record<string, unknown>>;
  children?: React.ReactNode;
  margin?: Record<string, number>;
  layout?: string;
}) {
  return (
    <div className="w-full h-full flex items-end gap-2 p-3 border border-slate-200/60 dark:border-slate-800 rounded-xl">
      {(data.length > 0 ? data.slice(0, 12) : [{ v: 40 }, { v: 70 }, { v: 55 }]).map((item, idx) => {
        const numeric = Object.values(item).find((v) => typeof v === "number") as number | undefined;
        const pct = Math.max(15, Math.min(100, numeric ? (numeric % 100) || 60 : 50));
        return (
          <div
            key={idx}
            className="flex-1 bg-[#4B0082]/80 rounded-t-md"
            style={{ height: `${pct}%` }}
          />
        );
      })}
      <div className="hidden">{children}</div>
    </div>
  );
}

export function PieChart({ children }: { children?: React.ReactNode; width?: number; height?: number }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      <svg viewBox="0 0 120 120" className="w-32 h-32">
        <circle cx="60" cy="60" r="45" fill="none" stroke="#e2e8f0" strokeWidth="18" />
        <circle cx="60" cy="60" r="45" fill="none" stroke="#4B0082" strokeWidth="18" strokeDasharray="170 283" />
      </svg>
      <div className="hidden">{children}</div>
    </div>
  );
}

export function Area(_props: Record<string, unknown>) { return null; }
export function Bar(_props: Record<string, unknown>) { return null; }
export function Pie(_props: Record<string, unknown>) { return null; }
export function Cell(_props: Record<string, unknown>) { return null; }
export function XAxis(_props: Record<string, unknown>) { return null; }
export function YAxis(_props: Record<string, unknown>) { return null; }
export function CartesianGrid(_props: Record<string, unknown>) { return null; }
export function Tooltip(_props: Record<string, unknown>) { return null; }
export function Legend(_props: Record<string, unknown>) { return null; }


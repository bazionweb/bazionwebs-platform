import type { HTMLAttributes, PropsWithChildren } from "react";

export type StackGap = "sm" | "md" | "lg";
export type GridColumns = "auto" | "two" | "three";

export function Container({ className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`bw-container ${className}`.trim()} {...props}>{children}</div>;
}

export function Section({ className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section className={`bw-section ${className}`.trim()} {...props}>{children}</section>;
}

export function Stack({ gap = "md", className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement> & { gap?: StackGap }>) {
  return <div className={`bw-stack bw-stack--${gap} ${className}`.trim()} {...props}>{children}</div>;
}

export function Cluster({ className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`bw-cluster ${className}`.trim()} {...props}>{children}</div>;
}

export function Grid({ columns = "auto", className = "", children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement> & { columns?: GridColumns }>) {
  return <div className={`bw-grid bw-grid--${columns} ${className}`.trim()} {...props}>{children}</div>;
}

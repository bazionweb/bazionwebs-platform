import { ReactNode } from "react";

// Re-export all types from the types index
export * from "./types/index";

// UI-specific types (Frontend only)
export interface NavItem {
  id: string;
  label: string;
  icon: any;
  children?: NavItem[];
}

export interface StatCardProps {
  title: string;
  value: string;
  subText: string;
  color: "purple" | "amber" | "emerald" | "blue";
  icon: ReactNode;
  onClick?: () => void;
}

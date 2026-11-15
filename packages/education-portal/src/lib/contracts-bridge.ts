export * from "@bazion/education-contracts";

export interface Program {
  id?: string;
  code?: string;
  label: string;
  name?: string;
  level: "undergraduate" | "graduate" | "doctorate" | "certificate" | "diploma";
  description: string;
  icon?: string;
}

export const PORTAL_URL = "/portal";
export const UMS_URL = "/ums";
export const API_WORKER_URL = "";

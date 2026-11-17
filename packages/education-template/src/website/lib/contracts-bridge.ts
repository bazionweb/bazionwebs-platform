export * from "@bazion/education-contracts";

export const PORTAL_URL = "/portal";
export const UMS_URL = "/ums";

const serverApiOrigin =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_INTERNAL_URL ||
  (process.env.API_PORT ? `http://127.0.0.1:${process.env.API_PORT}` : "http://127.0.0.1:4000");

export const API_WORKER_URL = typeof window === "undefined" ? serverApiOrigin : "";


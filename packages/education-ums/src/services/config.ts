import { PORTAL_URL, UMS_URL } from "./contracts-bridge";

const envOverride = typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_API_URL : undefined;

export const API_URL = (envOverride && envOverride.trim() !== "" ? envOverride : "") + "/api/v1";

export const API_TIMEOUT = 30000;
export const MAX_RETRIES = 2;

export { PORTAL_URL, UMS_URL };

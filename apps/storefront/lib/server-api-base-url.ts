if (typeof window !== "undefined") {
  throw new Error("This module cannot be imported on the client.");
}

const developmentApiBaseUrl = "http://localhost:4000";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "::1"
    || normalized === "::"
    || normalized === "0.0.0.0"
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

export function getServerApiBaseUrl(): string {
  const configured = process.env.API_BASE_URL?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("API_BASE_URL must be configured on the storefront runtime.");
    }
    return developmentApiBaseUrl;
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("API_BASE_URL must be an absolute HTTP or HTTPS URL.");
  }
  if (parsed.pathname !== "/") {
    throw new Error("API_BASE_URL must be an origin without a path.");
  }
  if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("API_BASE_URL must be an HTTP or HTTPS origin without credentials, query parameters, or a fragment.");
  }
  if (process.env.NODE_ENV === "production" && isLoopbackHostname(parsed.hostname)) {
    throw new Error("API_BASE_URL cannot target loopback from the production storefront container.");
  }
  return configured.replace(/\/$/, "");
}

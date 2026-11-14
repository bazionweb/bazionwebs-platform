"use client";

import { extractTenantSlugFromHost } from "@bazion/auth/client";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      const raw = trimmed.slice(prefix.length);
      if (!raw) return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function detectClientTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  const fromHost = extractTenantSlugFromHost(
    window.location.hostname,
    process.env.NEXT_PUBLIC_PUBLIC_STOREFRONT_URL,
  );
  if (fromHost) return fromHost;

  const fromQuery = new URLSearchParams(window.location.search).get("tenant")?.trim().toLowerCase();
  if (fromQuery) return fromQuery;

  const fromCookie = readCookie("bazion_tenant")?.trim().toLowerCase();
  return fromCookie || null;
}

export function getClientTenantHeaders(): Record<string, string> {
  const slug = detectClientTenantSlug();
  return slug ? { "x-bazion-tenant": slug } : {};
}


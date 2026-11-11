export interface CookieDescriptor {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: "/";
  domain?: undefined;
  maxAge: number;
}

export interface CsrfOriginGuardInput {
  method: string;
  originHeader?: string | null;
  refererHeader?: string | null;
  secFetchSiteHeader?: string | null;
  cookieHeaderPresent?: boolean;
  trustedOrigins: readonly string[];
  allowSameOriginlessNonBrowser?: boolean;
}

export interface CsrfOriginGuardResult {
  allowed: boolean;
  statusCode?: 403;
  code?: "CSRF_CROSS_SITE_BLOCKED" | "CSRF_UNTRUSTED_ORIGIN" | "CSRF_UNTRUSTED_REFERER" | "CSRF_ORIGIN_REQUIRED";
  message?: string;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Determine whether __Host-Http- cookie prefixes should be enforced.
 * Browsers require Secure + Path=/ + no Domain for __Host- cookies, which is
 * strictly available under HTTPS origins or production deployments.
 */
export function shouldUseStrictHostCookies(options: {
  nodeEnv?: string;
  baseUrl?: string;
  forwardedProto?: string;
}): boolean {
  if (options.nodeEnv === "production") return true;
  if (options.baseUrl?.trim().toLowerCase().startsWith("https://")) return true;
  const proto = options.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}

export function buildBffSessionCookieOptions(options: {
  strictHostCookie: boolean;
  maxAgeSeconds?: number;
}): CookieDescriptor {
  return {
    name: options.strictHostCookie ? "__Host-Http-bazion_bff_session" : "bazion_bff_session",
    httpOnly: true,
    secure: options.strictHostCookie,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeSeconds ?? 43_200,
  };
}

export function buildOidcTransactionCookieOptions(options: {
  strictHostCookie: boolean;
  maxAgeSeconds?: number;
}): CookieDescriptor {
  return {
    name: options.strictHostCookie ? "__Host-Http-bazion_oidc_tx" : "bazion_oidc_tx",
    httpOnly: true,
    secure: options.strictHostCookie,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeSeconds ?? 600,
  };
}

export function assertValidCookieDescriptor(cookie: CookieDescriptor): void {
  if (cookie.path !== "/") {
    throw new Error("Cookie Path must be '/'.");
  }
  if ("domain" in cookie && cookie.domain !== undefined) {
    throw new Error("Host-bound BFF cookies must not set a Domain attribute.");
  }
  if (!cookie.httpOnly) {
    throw new Error("BFF session and OIDC transaction cookies must be HttpOnly.");
  }
  if ((cookie.name.startsWith("__Host-Http-") || cookie.name.startsWith("__Host-")) && !cookie.secure) {
    throw new Error(`Cookie ${cookie.name} requires Secure attribute.`);
  }
}

export function serializeSetCookieHeader(cookie: CookieDescriptor & { value: string }): string {
  assertValidCookieDescriptor(cookie);
  if (/[\r\n;]/.test(cookie.value)) {
    throw new Error("Cookie value contains forbidden characters.");
  }
  const sameSite = cookie.sameSite === "strict" ? "Strict" : "Lax";
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Path=${cookie.path}`,
    `Max-Age=${Math.max(0, Math.floor(cookie.maxAge))}`,
    `SameSite=${sameSite}`,
  ];
  if (cookie.httpOnly) parts.push("HttpOnly");
  if (cookie.secure) parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearCookieHeader(cookie: CookieDescriptor): string {
  assertValidCookieDescriptor(cookie);
  const sameSite = cookie.sameSite === "strict" ? "Strict" : "Lax";
  const parts = [
    `${cookie.name}=`,
    `Path=${cookie.path}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `SameSite=${sameSite}`,
  ];
  if (cookie.httpOnly) parts.push("HttpOnly");
  if (cookie.secure) parts.push("Secure");
  return parts.join("; ");
}

export function parseCookieHeader(cookieHeader: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const segment of raw.split(";")) {
    const separator = segment.indexOf("=");
    if (separator <= 0) continue;
    const name = segment.slice(0, separator).trim();
    const rawValue = segment.slice(separator + 1).trim();
    if (!name) continue;
    try {
      result[name] = decodeURIComponent(rawValue);
    } catch {
      result[name] = rawValue;
    }
  }
  return result;
}

/**
 * Validate redirect targets to block open redirects (external hosts, protocol-relative
 * `//evil.test`, backslash smuggling `/\evil.test`, or `javascript:` URIs).
 */
export function resolveSafeRedirectTarget(
  rawTarget: unknown,
  options: {
    allowedOrigins?: readonly string[];
    fallback?: string;
  } = {},
): string {
  const fallback = options.fallback ?? "/admin";
  if (typeof rawTarget !== "string") return fallback;
  const candidate = rawTarget.trim();
  if (!candidate || candidate.length > 1024) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(candidate)) return fallback;

  if (candidate.startsWith("/")) {
    if (candidate.startsWith("//") || candidate.startsWith("/\\") || candidate.includes("@")) {
      return fallback;
    }
    try {
      const parsed = new URL(candidate, "https://same-origin.invalid");
      if (parsed.origin !== "https://same-origin.invalid") return fallback;
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return fallback;
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return fallback;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return fallback;
  }
  if (parsed.username || parsed.password) {
    return fallback;
  }

  const normalizedAllowed = new Set(
    (options.allowedOrigins ?? [])
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );

  return normalizedAllowed.has(parsed.origin) ? parsed.toString() : fallback;
}

function normalizeOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth browser CSRF guard combining Fetch Metadata (`Sec-Fetch-Site`),
 * `Origin`, and `Referer` checks against trusted origins.
 */
export function evaluateCsrfOriginGuard(input: CsrfOriginGuardInput): CsrfOriginGuardResult {
  const method = input.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return { allowed: true };
  }

  const secFetchSite = input.secFetchSiteHeader?.trim().toLowerCase() ?? "";
  if (secFetchSite === "cross-site") {
    return {
      allowed: false,
      statusCode: 403,
      code: "CSRF_CROSS_SITE_BLOCKED",
      message: "Cross-site state-changing requests are forbidden.",
    };
  }

  const trustedSet = new Set(
    input.trustedOrigins.map((origin) => normalizeOrigin(origin)).filter((v): v is string => Boolean(v)),
  );

  if (input.originHeader) {
    const origin = normalizeOrigin(input.originHeader);
    if (!origin || !trustedSet.has(origin)) {
      return {
        allowed: false,
        statusCode: 403,
        code: "CSRF_UNTRUSTED_ORIGIN",
        message: "Request origin is not trusted for state-changing operations.",
      };
    }
    return { allowed: true };
  }

  if (input.refererHeader) {
    const refererOrigin = normalizeOrigin(input.refererHeader);
    if (!refererOrigin || !trustedSet.has(refererOrigin)) {
      return {
        allowed: false,
        statusCode: 403,
        code: "CSRF_UNTRUSTED_REFERER",
        message: "Request referer origin is not trusted.",
      };
    }
    return { allowed: true };
  }

  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return { allowed: true };
  }

  if (input.cookieHeaderPresent || !input.allowSameOriginlessNonBrowser) {
    return {
      allowed: false,
      statusCode: 403,
      code: "CSRF_ORIGIN_REQUIRED",
      message: "Trusted Origin or same-origin Sec-Fetch-Site header is required.",
    };
  }

  return { allowed: true };
}


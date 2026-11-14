import { canAccessPlatformPermission, canAccessPlatformTenantScope, type PlatformRole } from "./security-policy.js";

export type ScopedDashboardArea =
  | "commercial_billing"
  | "commercial_invoices"
  | "commercial_subscriptions"
  | "commercial_proposals"
  | "commercial_support"
  | "platform_console_tenant"
  | "platform_console_deployments"
  | "platform_console_domains"
  | "tenant_workspace_admin"
  | "tenant_storefront";

export interface ScopedDeepLinkResolutionInput {
  area: ScopedDashboardArea;
  actorUserId: string;
  actorPlatformRole: PlatformRole | null;
  actorTenantId: string | null;
  actorOrgRoles: readonly string[];
  targetTenantId?: string | null;
  targetTenantSlug?: string | null;
  installationId?: string | null;
  externalRef?: string | null;
  origins: {
    commercialPortalUrl?: string | null;
    platformConsoleUrl: string;
    publicStorefrontUrl: string;
  };
}

export interface ScopedDeepLinkResolution {
  allowed: true;
  area: ScopedDashboardArea;
  boundary: "commercial_portal" | "platform_console" | "tenant_workspace";
  targetUrl: string;
  requiredScopes: string[];
  opaqueReferences: Record<string, string>;
}

export class DeepLinkPolicyError extends Error {
  constructor(
    public readonly statusCode: 400 | 403 | 503,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeepLinkPolicyError";
  }
}

function normalizeBaseUrl(rawUrl: string | null | undefined, label: string): URL {
  if (!rawUrl?.trim()) {
    throw new DeepLinkPolicyError(503, "DEEP_LINK_ORIGIN_UNCONFIGURED", `${label} origin is not configured.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new DeepLinkPolicyError(503, "DEEP_LINK_ORIGIN_INVALID", `${label} origin is malformed.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DeepLinkPolicyError(503, "DEEP_LINK_ORIGIN_INVALID", `${label} origin must use HTTP(S).`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new DeepLinkPolicyError(503, "DEEP_LINK_ORIGIN_INVALID", `${label} origin must not contain credentials or query strings.`);
  }
  return new URL(parsed.origin);
}

const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin", "platform", "portal", "auth", "mail"]);
const SINGLE_DNS_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function isLoopbackHostForUrl(hostname: string): boolean {
  const clean = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return clean === "localhost" || clean === "127.0.0.1" || clean === "::1" || clean.endsWith(".localhost");
}

/**
 * Derive the canonical preview subdomain hostname for a tenant from the configured
 * storefront origin (e.g. `grace.localhost` in dev or `grace.sites.bazion.example` in production).
 */
export function buildTenantSubdomainHostname(storefrontOrigin: string, tenantSlug: string): string {
  const cleanSlug = tenantSlug.trim().toLowerCase();
  if (!cleanSlug) {
    throw new DeepLinkPolicyError(400, "DEEP_LINK_TENANT_REQUIRED", "tenantSlug is required to build a subdomain hostname.");
  }
  const base = normalizeBaseUrl(storefrontOrigin, "PUBLIC_STOREFRONT_URL");
  if (isLoopbackHostForUrl(base.hostname)) {
    return `${cleanSlug}.localhost`;
  }
  const rootHost = base.hostname.toLowerCase().replace(/^www\./, "");
  return `${cleanSlug}.${rootHost}`;
}

/**
 * Resolve dashboard base URLs from explicit runtime configuration without
 * hardcoding development hosts inside UI components.
 */
export function resolveConfiguredWorkspaceBaseUrl(storefrontOrigin: string): string {
  return normalizeBaseUrl(storefrontOrigin, "PUBLIC_STOREFRONT_URL").origin;
}

export function buildTenantStorefrontUrl(storefrontOrigin: string, tenantSlug: string): string {
  const base = normalizeBaseUrl(storefrontOrigin, "PUBLIC_STOREFRONT_URL");
  base.hostname = buildTenantSubdomainHostname(storefrontOrigin, tenantSlug);
  base.pathname = "/";
  base.search = "";
  return base.toString();
}

export function extractTenantSlugFromHost(hostname: string, storefrontOrigin?: string | null): string | null {
  const rawHost = (hostname || "").trim().toLowerCase();
  if (!rawHost) return null;
  const hostWithoutPort = rawHost.startsWith("[") && rawHost.includes("]")
    ? rawHost.slice(1, rawHost.indexOf("]"))
    : rawHost.split(":", 1)[0] ?? "";
  const cleanHost = hostWithoutPort.replace(/\.$/, "");
  if (!cleanHost) return null;

  if (cleanHost.endsWith(".localhost")) {
    const label = cleanHost.slice(0, -".localhost".length);
    if (SINGLE_DNS_LABEL_REGEX.test(label) && !RESERVED_SUBDOMAINS.has(label)) {
      return label;
    }
    return null;
  }

  if (storefrontOrigin) {
    try {
      const base = normalizeBaseUrl(storefrontOrigin, "PUBLIC_STOREFRONT_URL");
      const rootHost = base.hostname.toLowerCase().replace(/^www\./, "");
      if (!isLoopbackHostForUrl(rootHost) && cleanHost.endsWith(`.${rootHost}`)) {
        const label = cleanHost.slice(0, -(`.${rootHost}`.length));
        if (SINGLE_DNS_LABEL_REGEX.test(label) && !RESERVED_SUBDOMAINS.has(label)) {
          return label;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function buildTenantDomainVisitUrl(hostname: string, storefrontOrigin: string): string {
  const cleanHost = (hostname || "").trim().toLowerCase().replace(/\.$/, "");
  const base = normalizeBaseUrl(storefrontOrigin, "PUBLIC_STOREFRONT_URL");
  if (!cleanHost) return base.toString();
  if (cleanHost.endsWith(".localhost")) {
    base.hostname = cleanHost;
    base.pathname = "/";
    base.search = "";
    return base.toString();
  }
  return `https://${cleanHost}/`;
}

export function buildTenantWorkspacePickerUrl(
  storefrontOrigin: string,
  input: { organizationId?: string | null; tenantSlug: string; next?: "/admin" | "/workspace" },
): string {
  const base = normalizeBaseUrl(storefrontOrigin, "PUBLIC_STOREFRONT_URL");
  base.pathname = "/workspace";
  if (input.organizationId) {
    base.searchParams.set("select", input.organizationId);
  }
  base.searchParams.set("workspace", input.tenantSlug);
  base.searchParams.set("redirect", input.next ?? "/admin");
  return base.toString();
}

/**
 * Construct a privilege-checked, opaque-ID deep link enforcing strict separation
 * between Bazionweb Commercial Portal, Platform Super-Admin Console, and Tenant Workspace.
 */
export function resolveScopedDeepLink(input: ScopedDeepLinkResolutionInput): ScopedDeepLinkResolution {
  const opaqueReferences: Record<string, string> = {};
  if (input.targetTenantId) opaqueReferences.tenantId = input.targetTenantId;
  if (input.installationId) opaqueReferences.installationId = input.installationId;
  if (input.externalRef) opaqueReferences.externalRef = input.externalRef;

  if (input.area.startsWith("platform_console_")) {
    if (!input.actorPlatformRole) {
      throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "A platform control-plane role is required for this area.");
    }
    if (input.area === "platform_console_deployments" && !canAccessPlatformPermission(input.actorPlatformRole, "platform.overview.read")) {
      throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "Platform deployment visibility is not granted to your role.");
    }
    if (input.area === "platform_console_domains" && !canAccessPlatformPermission(input.actorPlatformRole, "tenant.domain.verify")) {
      throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "Platform domain management is not granted to your role.");
    }
    if (input.area === "platform_console_tenant" && !canAccessPlatformPermission(input.actorPlatformRole, "tenant.read")) {
      throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "Platform tenant inspection is not granted to your role.");
    }
    if (!input.targetTenantId) {
      throw new DeepLinkPolicyError(400, "DEEP_LINK_TENANT_REQUIRED", "targetTenantId is required for platform console deep links.");
    }
    if (!canAccessPlatformTenantScope(input.actorPlatformRole, input.actorTenantId, input.targetTenantId)) {
      throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "Tenant scope is outside your granted platform role.");
    }
    const base = normalizeBaseUrl(input.origins.platformConsoleUrl, "PLATFORM_CONSOLE_URL");
    base.pathname = `/tenants/${encodeURIComponent(input.targetTenantId)}`;
    if (input.area === "platform_console_deployments") base.hash = "hosting";
    if (input.area === "platform_console_domains") base.hash = "domains";
    return {
      allowed: true,
      area: input.area,
      boundary: "platform_console",
      targetUrl: base.toString(),
      requiredScopes: ["platform:control"],
      opaqueReferences,
    };
  }

  if (input.area === "tenant_workspace_admin" || input.area === "tenant_storefront") {
    if (input.area === "tenant_workspace_admin") {
      const isMemberOfTarget =
        Boolean(input.targetTenantId)
        && input.actorTenantId === input.targetTenantId
        && input.actorOrgRoles.some((r) => ["owner", "admin", "catalogManager", "orderManager", "contentEditor", "viewer"].includes(r));
      const isPlatformOperator =
        input.actorPlatformRole !== null
        && canAccessPlatformTenantScope(input.actorPlatformRole, input.actorTenantId, input.targetTenantId ?? "");
      if (!isMemberOfTarget && !isPlatformOperator) {
        throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "You do not have permission to open this tenant workspace.");
      }
    }

    if (!input.targetTenantSlug) {
      throw new DeepLinkPolicyError(400, "DEEP_LINK_TENANT_REQUIRED", "targetTenantSlug is required for tenant workspace deep links.");
    }
    const targetUrl =
      input.area === "tenant_storefront"
        ? buildTenantStorefrontUrl(input.origins.publicStorefrontUrl, input.targetTenantSlug)
        : buildTenantWorkspacePickerUrl(input.origins.publicStorefrontUrl, {
            tenantSlug: input.targetTenantSlug,
            next: "/admin",
          });

    return {
      allowed: true,
      area: input.area,
      boundary: "tenant_workspace",
      targetUrl,
      requiredScopes: input.area === "tenant_workspace_admin" ? ["tenant:admin"] : ["openid"],
      opaqueReferences,
    };
  }

  // Commercial portal areas (billing, invoices, subscriptions, proposals, support)
  if (input.targetTenantId && input.actorPlatformRole) {
    if (!canAccessPlatformTenantScope(input.actorPlatformRole, input.actorTenantId, input.targetTenantId)) {
      throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "Tenant scope is outside your granted assignment.");
    }
  } else if (input.targetTenantId && input.actorTenantId !== input.targetTenantId) {
    throw new DeepLinkPolicyError(403, "DEEP_LINK_FORBIDDEN", "Cross-tenant commercial billing deep link is forbidden.");
  }

  const base = normalizeBaseUrl(input.origins.commercialPortalUrl, "COMMERCIAL_PORTAL_URL");
  const areaPaths: Record<
    "commercial_billing" | "commercial_invoices" | "commercial_subscriptions" | "commercial_proposals" | "commercial_support",
    { path: string; scope: string }
  > = {
    commercial_billing: { path: "/portal/billing", scope: "commercial:billing:read" },
    commercial_invoices: { path: "/portal/invoices", scope: "commercial:invoices:read" },
    commercial_subscriptions: { path: "/portal/subscriptions", scope: "commercial:subscriptions:read" },
    commercial_proposals: { path: "/portal/proposals", scope: "commercial:proposals:read" },
    commercial_support: { path: "/portal/support", scope: "commercial:support:read" },
  };
  const mapping = areaPaths[input.area as keyof typeof areaPaths];
  base.pathname = mapping.path;
  if (input.externalRef) base.searchParams.set("ref", input.externalRef);
  else if (input.installationId) base.searchParams.set("installationId", input.installationId);
  else if (input.targetTenantId) base.searchParams.set("tenantId", input.targetTenantId);

  return {
    allowed: true,
    area: input.area,
    boundary: "commercial_portal",
    targetUrl: base.toString(),
    requiredScopes: [mapping.scope],
    opaqueReferences,
  };
}

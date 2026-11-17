import { headers, cookies } from "next/headers";
import {
  defaultHkmTenantConfig,
  type ChurchManagementTenantConfig,
} from "@bazion/church-management/config";

export const HKM_CHURCH_TENANT_ID = "00000000-0000-4000-8000-000000000077" as const;

export interface ChurchTenantContext {
  host?: string;
  tenantHeader?: string;
  tenantCookie?: string;
  defaultTenantId?: string;
}

export interface ChurchTenantResult {
  isHkm: boolean;
  tenantId: string;
  tenantConfig: ChurchManagementTenantConfig;
}

export function cleanChurchHostname(rawHost: string): string {
  const [hostname = ""] = rawHost.trim().toLowerCase().split(":");
  return hostname;
}

export function isHkmHost(hostname: string): boolean {
  const clean = cleanChurchHostname(hostname);
  return (
    clean === "hkm.localhost" ||
    clean === "hkm-ministries.localhost" ||
    clean === "admin.hkmministries.org" ||
    clean === "hkmministries.org" ||
    clean === "www.hkmministries.org" ||
    clean.startsWith("hkm.") ||
    clean.startsWith("hkm-")
  );
}

export function resolveChurchTenantFromContext(ctx: ChurchTenantContext): ChurchTenantResult {
  const host = cleanChurchHostname(ctx.host ?? "");
  const tenantHeader = (ctx.tenantHeader ?? "").trim().toLowerCase();
  const tenantCookie = (ctx.tenantCookie ?? "").trim().toLowerCase();
  const defaultTenantId = (ctx.defaultTenantId ?? "").trim().toLowerCase();

  const isHkm =
    isHkmHost(host) ||
    tenantHeader === "hkm" ||
    tenantHeader === HKM_CHURCH_TENANT_ID.toLowerCase() ||
    tenantCookie === "hkm" ||
    tenantCookie === HKM_CHURCH_TENANT_ID.toLowerCase() ||
    defaultTenantId === HKM_CHURCH_TENANT_ID.toLowerCase() ||
    defaultTenantId === "hkm";

  return {
    isHkm,
    tenantId: isHkm ? HKM_CHURCH_TENANT_ID : "",
    tenantConfig: defaultHkmTenantConfig,
  };
}

export async function resolveChurchTenant(): Promise<ChurchTenantResult> {
  const headerList = await headers();
  const cookieJar = await cookies();

  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? undefined;
  const tenantHeader = headerList.get("x-bazion-tenant-id") ?? undefined;
  const tenantCookie = cookieJar.get("bazion_tenant_id")?.value;
  const defaultTenantId = process.env.DEFAULT_TENANT_ID ?? process.env.CHURCH_TENANT_ID ?? undefined;

  return resolveChurchTenantFromContext({
    host,
    tenantHeader,
    tenantCookie,
    defaultTenantId,
  });
}


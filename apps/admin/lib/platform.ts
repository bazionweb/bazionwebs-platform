import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const defaultApiBases = [
  process.env.API_BASE_URL,
  "http://localhost:4000",
  "http://localhost:4100",
].filter(Boolean).map((u) => u!.replace(/\/$/, ""));
const uniqueApiBases = Array.from(new Set(defaultApiBases));

type PlatformIdentity = {
  user: { id: string; email: string; name: string; emailVerified: boolean };
  platformRole: "platform_owner" | "platform_admin" | "platform_support" | null;
};

/** The global control plane is reserved for the platform owner. Tenant and
 * tenant-scoped support accounts use their own workspace dashboard. */
export async function requirePlatformOwner(): Promise<PlatformIdentity> {
  const cookie = (await headers()).get("cookie");
  if (!cookie) redirect("/login?callbackURL=%2F");

  let response: Response | null = null;
  for (const base of uniqueApiBases) {
    try {
      const res = await fetch(`${base}/v1/auth/me`, {
        cache: "no-store",
        headers: { cookie },
        signal: AbortSignal.timeout(5_000),
      });
      response = res;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!response) {
    redirect("/login?reason=identity-unavailable");
  }

  if (response.status === 401) redirect("/login?callbackURL=%2F");
  if (!response.ok) redirect("/login?reason=identity-unavailable");

  const identity = await response.json() as PlatformIdentity;
  if (identity.platformRole !== "platform_owner") redirect("/login?reason=platform-owner-required");
  return identity;
}

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  default_currency: string;
  status: "provisioning" | "active" | "suspended" | "closed";
  created_at: string;
  suspended_at?: string | null;
  closed_at?: string | null;
  auth_organization_id?: string | null;
};

export async function platformFetch<T>(path: string): Promise<{ data: T | null; status: number }> {
  const incoming = await headers();
  const cookie = incoming.get("cookie");
  for (const base of uniqueApiBases) {
    try {
      const response = await fetch(`${base}/v1/admin/platform/${path}`, {
        cache: "no-store",
        headers: cookie ? { cookie } : {},
      });
      if (!response.ok) return { data: null, status: response.status };
      return { data: await response.json() as T, status: response.status };
    } catch {
      // Try next candidate
    }
  }
  return { data: null, status: 503 };
}

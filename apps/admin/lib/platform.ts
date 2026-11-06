import { headers } from "next/headers";

const apiBase = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  default_currency: string;
  status: "provisioning" | "active" | "suspended" | "closed";
  created_at: string;
  suspended_at?: string | null;
  closed_at?: string | null;
};

export async function platformFetch<T>(path: string): Promise<{ data: T | null; status: number }> {
  const incoming = await headers();
  const cookie = incoming.get("cookie");
  try {
    const response = await fetch(`${apiBase}/v1/admin/platform/${path}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    });
    if (!response.ok) return { data: null, status: response.status };
    return { data: await response.json() as T, status: response.status };
  } catch {
    return { data: null, status: 503 };
  }
}

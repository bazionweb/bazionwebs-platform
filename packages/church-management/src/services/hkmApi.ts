type HkmApiEnvelope<T> = { success?: boolean; data?: T; error?: string; message?: string };

export async function hkmApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include", cache: "no-store" });
  const body = await response.json().catch(() => ({})) as HkmApiEnvelope<T>;
  if (!response.ok || body.success === false) {
    const details = (body as { details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } }).details;
    const detailMessage = details?.formErrors?.[0] ?? Object.values(details?.fieldErrors ?? {}).flat()[0];
    throw new Error(detailMessage ?? body.message ?? body.error ?? `Request failed (${response.status}).`);
  }
  if ("data" in body) return body.data as T;
  return body as T;
}

export function hkmStatusLabel(value: string | undefined): "Active" | "Inactive" | "Transferred" | "Pending Fee" {
  switch ((value ?? "active").toLowerCase().replaceAll("_", " ")) {
    case "inactive": return "Inactive";
    case "transferred": return "Transferred";
    case "pending fee": return "Pending Fee";
    default: return "Active";
  }
}

/**
 * Bidirectional map between backend UUID strings and numeric IDs expected by legacy UI components.
 */
export class HkmIdMap {
  private readonly toNum = new Map<string, number>();
  private readonly toRaw = new Map<number, string>();
  private nextId = 1_000_000;

  numericId(rawId: string | number): number {
    if (typeof rawId === "number") return rawId;
    const existing = this.toNum.get(rawId);
    if (existing !== undefined) return existing;
    const assigned = this.nextId++;
    this.toNum.set(rawId, assigned);
    this.toRaw.set(assigned, rawId);
    return assigned;
  }

  resolve(id: number): string {
    return this.toRaw.get(id) ?? String(id);
  }
}

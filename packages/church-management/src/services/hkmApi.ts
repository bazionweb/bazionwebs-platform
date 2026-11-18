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

import { and, eq } from "drizzle-orm";
import { ministrySettings } from "@bazion/database";
import { withTenantTransaction } from "./database.js";

export interface TenantMaintenanceStatus {
  enabled: boolean;
  message: string;
}

const defaultNotice = "This ministry website is temporarily unavailable for scheduled maintenance.";

function unavailableError(): Error & { statusCode: number; code: string } {
  return Object.assign(new Error("The site availability status could not be checked."), {
    statusCode: 503,
    code: "MAINTENANCE_STATUS_UNAVAILABLE",
  });
}

/** Reads the tenant-scoped public site maintenance setting using the normal RLS transaction. */
export async function getTenantMaintenanceStatus(tenantId: string): Promise<TenantMaintenanceStatus> {
  let settingValue: string | null;
  try {
    settingValue = await withTenantTransaction(tenantId, async (tx) => {
      const [setting] = await tx.select({ settingValue: ministrySettings.settingValue })
        .from(ministrySettings)
        .where(and(
          eq(ministrySettings.tenantId, tenantId),
          eq(ministrySettings.settingKey, "maintenance_mode"),
        ))
        .limit(1);
      return setting?.settingValue ?? null;
    });
  } catch {
    throw unavailableError();
  }

  if (!settingValue) return { enabled: false, message: "" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(settingValue) as unknown;
  } catch {
    throw unavailableError();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw unavailableError();

  const value = parsed as { enabled?: unknown; message?: unknown };
  if (value.enabled !== true) return { enabled: false, message: "" };
  const message = typeof value.message === "string"
    ? value.message.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
    : "";
  return { enabled: true, message: message || defaultNotice };
}

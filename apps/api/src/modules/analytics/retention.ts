import { and, eq, sql } from "drizzle-orm";
import { analyticsEvents } from "@bazion/database";
import { listTenantIdsForMaintenance, withTenantMaintenanceTransaction } from "../../lib/database.js";

export async function runAnalyticsRetentionCleanup(): Promise<{
  tenantsProcessed: number;
  eventsDeleted: number;
}> {
  const tenantIds = await listTenantIdsForMaintenance();
  let eventsDeleted = 0;

  for (const tenantId of tenantIds) {
    const deleted = await withTenantMaintenanceTransaction(tenantId, async (tx) => {
      const rows = await tx
        .delete(analyticsEvents)
        .where(and(eq(analyticsEvents.tenantId, tenantId), sql`${analyticsEvents.retentionExpiresAt} <= now()`))
        .returning({ id: analyticsEvents.id });
      return rows.length;
    });
    eventsDeleted += deleted;
  }

  return {
    tenantsProcessed: tenantIds.length,
    eventsDeleted,
  };
}

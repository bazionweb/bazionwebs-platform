import { sql } from "drizzle-orm";
import { siteEnquiries } from "@bazion/database";
import { listTenantIdsForMaintenance, withTenantMaintenanceTransaction } from "../../lib/database.js";

export const SITE_ENQUIRY_RETENTION_BATCH_SIZE = 500;

export async function runSiteEnquiryRetentionCleanup(asOf = new Date()): Promise<{
  tenantsProcessed: number;
  enquiriesDeleted: number;
}> {
  const tenantIds = await listTenantIdsForMaintenance();
  let enquiriesDeleted = 0;

  // Process tenants sequentially to bound load on shared and dedicated databases.
  for (const tenantId of tenantIds) {
    let deletedThisBatch: number;
    do {
      deletedThisBatch = await withTenantMaintenanceTransaction(tenantId, async (tx) => {
        const result = await tx.execute(sql`
          WITH expired AS (
            SELECT id
              FROM ${siteEnquiries}
             WHERE tenant_id = ${tenantId}
               AND retention_expires_at <= ${asOf}
             ORDER BY retention_expires_at, id
             LIMIT ${SITE_ENQUIRY_RETENTION_BATCH_SIZE}
             FOR UPDATE SKIP LOCKED
          )
          DELETE FROM ${siteEnquiries} AS enquiry
           WHERE enquiry.tenant_id = ${tenantId}
             AND enquiry.id IN (SELECT id FROM expired)
          RETURNING enquiry.id
        `);
        return result.rows.length;
      });
      enquiriesDeleted += deletedThisBatch;
    } while (deletedThisBatch === SITE_ENQUIRY_RETENTION_BATCH_SIZE);
  }

  return { tenantsProcessed: tenantIds.length, enquiriesDeleted };
}

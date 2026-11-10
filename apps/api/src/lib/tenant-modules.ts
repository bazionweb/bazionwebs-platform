import { pool } from "./database.js";
import { getPlatformModule } from "../modules/admin/module-catalog.js";

/** Check the effective tenant entitlement before entering a module API. */
export async function isTenantModuleEnabled(tenantId: string, moduleId: string): Promise<boolean> {
  const result = await pool.query<{ status: string; enabled: boolean | null }>(
    `SELECT t.status, e.enabled
       FROM public.tenants t
       LEFT JOIN public.tenant_module_entitlements e
         ON e.tenant_id = t.id AND e.module_id = $2
      WHERE t.id = $1
      LIMIT 1`,
    [tenantId, moduleId],
  );
  const row = result.rows[0];
  if (!row || row.status !== "active") return false;
  return row.enabled ?? getPlatformModule(moduleId)?.defaultEnabled ?? false;
}

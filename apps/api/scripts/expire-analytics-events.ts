import { closeTenantDatabaseResources } from "../src/lib/database.js";
import { runAnalyticsRetentionCleanup } from "../src/modules/analytics/retention.js";

try {
  const result = await runAnalyticsRetentionCleanup();
  console.log(`Deleted ${result.eventsDeleted} expired analytics events across ${result.tenantsProcessed} tenants.`);
} finally {
  await closeTenantDatabaseResources();
}

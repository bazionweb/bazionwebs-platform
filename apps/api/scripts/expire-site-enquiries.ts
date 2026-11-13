import { closeTenantDatabaseResources } from "../src/lib/database.js";
import { runSiteEnquiryRetentionCleanup } from "../src/modules/forms-leads/retention.js";

try {
  const result = await runSiteEnquiryRetentionCleanup();
  console.log(`Deleted ${result.enquiriesDeleted} expired site enquiries across ${result.tenantsProcessed} tenants.`);
} finally {
  await closeTenantDatabaseResources();
}

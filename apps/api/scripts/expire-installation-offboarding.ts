import { closeTenantDatabaseResources } from "../src/lib/database.js";
import { loadConfig } from "../src/config.js";
import { createCommercialProvisioningRuntime } from "../src/modules/commercial-provisioning/runtime.js";

const config = loadConfig();
const runtime = createCommercialProvisioningRuntime({
  enabled: true,
  workerEnabled: false,
  databaseUrl: config.commercialProvisioning.databaseUrl,
  tenantProvisionerDatabaseUrl: config.TENANT_PROVISIONER_DATABASE_URL,
  commandSecret: config.commercialProvisioning.commandSecret,
  commandIssuer: config.commercialProvisioning.commandIssuer,
  commandAudience: config.commercialProvisioning.commandAudience,
  privateArchiveDirectory: config.commercialProvisioning.privateArchiveDir,
  privateArchiveEncryptionKey: config.commercialProvisioning.privateArchiveEncryptionKey,
  nodeEnv: config.NODE_ENV,
});

try {
  if (!runtime?.offboardingService) {
    process.stdout.write("[expire-installation-offboarding] Commercial provisioning runtime not configured; skipping.\n");
  } else {
    const summary = await runtime.offboardingService.purgeDueArchivesAcrossTenants();
    process.stdout.write(
      `[expire-installation-offboarding] tenants=${summary.tenantsScanned} scanned=${summary.archivesScanned} deleted=${summary.archivesDeleted} configsRemoved=${summary.configurationsDeleted}\n`,
    );
  }
} finally {
  await runtime?.close().catch(() => undefined);
  await closeTenantDatabaseResources();
}


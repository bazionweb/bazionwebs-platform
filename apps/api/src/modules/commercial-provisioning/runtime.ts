import { Pool } from "pg";
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
} from "./auth.js";
import type { CommercialProvisioningRuntime } from "./routes.js";
import { CommercialProvisioningService } from "./service.js";
import { PlatformStatusOutboxDispatcher } from "./status-outbox-worker.js";

export interface CommercialProvisioningConfig {
  enabled: boolean;
  databaseUrl?: string | undefined;
  commandSecret?: string | undefined;
  commandIssuer: string;
  commandAudience: string;
}

/**
 * Create the runtime backing commercial provisioning intake and outbox dispatch
 * using the narrow `bazion_product_provisioner` PostgreSQL role when configured.
 */
export function createCommercialProvisioningRuntime(
  config: CommercialProvisioningConfig,
): CommercialProvisioningRuntime | null {
  if (!config.enabled || !config.databaseUrl || !config.commandSecret) {
    return null;
  }

  const provisionerPool = new Pool({
    connectionString: config.databaseUrl,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "bazion-product-provisioner-api",
  });

  return {
    commandAuth: {
      secret: config.commandSecret,
      issuer: config.commandIssuer || DEFAULT_COMMAND_ISSUER,
      audience: config.commandAudience || DEFAULT_COMMAND_AUDIENCE,
    },
    service: new CommercialProvisioningService(provisionerPool),
    dispatcher: new PlatformStatusOutboxDispatcher(provisionerPool),
    close: async () => {
      await provisionerPool.end();
    },
  };
}

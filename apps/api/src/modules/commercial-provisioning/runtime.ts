import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import { PostgresAuditEventWriter } from "@bazion/audit";
import type { TenantHostingTemplate } from "@bazion/platform-contracts";
import { LocalPrivateArchiveStorage } from "@bazion/storage";
import type { HostingProvisioningRuntime } from "../hosting/runtime.js";
import { tenantHostingDockerSecretReference } from "../hosting/secrets.js";
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
} from "./auth.js";
import { createDefaultTenantLifecycleAdapter, SubscriptionLifecycleService } from "./lifecycle-service.js";
import { InstallationOffboardingService } from "./offboarding-service.js";
import { platformProvisioningOfferBindings } from "./offer-resolution.js";
import { CommercialProvisioningOperatorService } from "./operator-service.js";
import type { CommercialProvisioningRuntime } from "./routes.js";
import {
  CommercialProvisioningSagaOrchestrator,
  createDefaultProvisioningStepAdapters,
} from "./saga-orchestrator.js";
import { CommercialProvisioningService } from "./service.js";
import {
  PlatformLifecycleOutboxDispatcher,
  PlatformStatusOutboxDispatcher,
} from "./status-outbox-worker.js";

export interface CommercialProvisioningConfig {
  enabled: boolean;
  workerEnabled?: boolean | undefined;
  databaseUrl?: string | undefined;
  tenantProvisionerDatabaseUrl?: string | undefined;
  auditDatabaseUrl?: string | undefined;
  commandSecret?: string | undefined;
  commandIssuer: string;
  commandAudience: string;
  privateArchiveDirectory?: string | undefined;
  hostingRuntime?: HostingProvisioningRuntime | null | undefined;
  workerId?: string | undefined;
}

const SUPPORTED_HOSTING_TEMPLATES = new Set<TenantHostingTemplate>([
  "wordpress",
  "node-nextjs",
  "ecommerce",
]);

type StepHostingAdapter = NonNullable<Parameters<typeof createDefaultProvisioningStepAdapters>[0]["hostingRuntime"]>;

function adaptHostingRuntime(
  hostingRuntime: HostingProvisioningRuntime,
): StepHostingAdapter {
  return {
    providerId: hostingRuntime.providerId,
    async provision(args) {
      const templateId = args.template.id as TenantHostingTemplate;
      if (!SUPPORTED_HOSTING_TEMPLATES.has(templateId)) {
        throw new Error("DEDICATED_HOSTING_TEMPLATE_UNSUPPORTED");
      }
      const loaded = await hostingRuntime.loadTemplate(templateId);
      const provisioned = await hostingRuntime.provision({
        tenantId: args.tenantId,
        template: templateId,
        templateVersion: loaded.templateVersion,
        idempotencyKey: args.idempotencyKey,
        composeFile: loaded.composeFile,
        environmentSecretRef: tenantHostingDockerSecretReference(args.tenantId, templateId),
        actorType: "service",
        actorId: "commercial-provisioning-saga",
      });
      return {
        providerDeploymentId: provisioned.reference.resourceId,
        status: provisioned.state,
      };
    },
    async inspect(ref) {
      const inspected = await hostingRuntime.inspect({
        provider: ref.providerId,
        resourceId: ref.deploymentId,
        tenantId: "" as any,
        createdAt: new Date(0).toISOString(),
      });
      return { status: inspected.state };
    },
  };
}

/**
 * Create the runtime backing commercial provisioning intake, durable saga orchestration,
 * subscription lifecycle handling, 30-day offboarding archives, and outbox dispatch.
 */
export function createCommercialProvisioningRuntime(
  config: CommercialProvisioningConfig,
): CommercialProvisioningRuntime | null {
  if (!config.enabled || !config.databaseUrl || !config.commandSecret) {
    return null;
  }

  const parsedDb = new URL(config.databaseUrl);
  if (!["postgres:", "postgresql:"].includes(parsedDb.protocol)) {
    throw new Error("PRODUCT_PROVISIONER_DATABASE_URL must be a PostgreSQL connection string.");
  }
  if (config.commandSecret.length < 32) {
    throw new Error("COMMERCIAL_PROVISIONING_COMMAND_SECRET must be at least 32 characters.");
  }

  const provisionerPool = new Pool({
    connectionString: config.databaseUrl,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "bazion-product-provisioner-api",
  });

  const platformPool = config.tenantProvisionerDatabaseUrl
    ? new Pool({
        connectionString: config.tenantProvisionerDatabaseUrl,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        application_name: "bazion-commercial-tenant-control",
      })
    : undefined;

  const auditPool = config.auditDatabaseUrl
    ? new Pool({
        connectionString: config.auditDatabaseUrl,
        max: 2,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        application_name: "bazion-commercial-audit",
      })
    : undefined;

  const auditWriter = new PostgresAuditEventWriter(auditPool ?? platformPool ?? provisionerPool);
  const storage = new LocalPrivateArchiveStorage(
    config.privateArchiveDirectory ?? resolve(tmpdir(), "bazion-private-archives"),
  );
  const tenantAdapter = platformPool ? createDefaultTenantLifecycleAdapter(platformPool) : undefined;

  const adapters = createDefaultProvisioningStepAdapters({
    provisionerPool,
    ...(platformPool ? { platformPool } : {}),
    hostingRuntime: config.hostingRuntime ? adaptHostingRuntime(config.hostingRuntime) : null,
  });
  const orchestrator = new CommercialProvisioningSagaOrchestrator(provisionerPool, adapters, {
    ...(config.workerId ? { workerId: config.workerId } : {}),
    offerBindings: platformProvisioningOfferBindings,
  });
  const operatorService = new CommercialProvisioningOperatorService(
    provisionerPool,
    orchestrator,
    auditWriter,
  );
  const lifecycleService = new SubscriptionLifecycleService(
    provisionerPool,
    auditWriter,
    tenantAdapter,
  );
  const offboardingService = new InstallationOffboardingService(
    provisionerPool,
    storage,
    auditWriter,
    tenantAdapter,
  );

  let timer: ReturnType<typeof setInterval> | null = null;
  let polling = false;
  if (config.workerEnabled) {
    timer = setInterval(() => {
      if (polling) return;
      polling = true;
      void orchestrator.processDueOperations(5).catch(() => undefined).finally(() => {
        polling = false;
      });
    }, 5_000);
    timer.unref?.();
  }

  return {
    commandAuth: {
      secret: config.commandSecret,
      issuer: config.commandIssuer || DEFAULT_COMMAND_ISSUER,
      audience: config.commandAudience || DEFAULT_COMMAND_AUDIENCE,
    },
    service: new CommercialProvisioningService(provisionerPool),
    dispatcher: new PlatformStatusOutboxDispatcher(provisionerPool),
    orchestrator,
    operatorService,
    lifecycleService,
    lifecycleDispatcher: new PlatformLifecycleOutboxDispatcher(provisionerPool),
    offboardingService,
    close: async () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      await Promise.all([
        provisionerPool.end(),
        platformPool?.end(),
        auditPool?.end(),
      ]);
    },
  };
}

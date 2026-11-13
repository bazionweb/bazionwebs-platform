import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Pool } from "pg";
import type { PilotMode } from "@bazion/api-contracts";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { TENANT_HOSTING_TEMPLATES, type TenantHostingTemplate, type TenantId } from "@bazion/platform-contracts";
import { EncryptedPrivateArchiveStorage, LocalPrivateArchiveStorage, type PrivateArchiveStorage } from "@bazion/storage";
import type { HostingProvisioningRuntime } from "../hosting/runtime.js";
import { tenantHostingDockerSecretReference } from "../hosting/secrets.js";
import {
  DEFAULT_COMMAND_AUDIENCE,
  DEFAULT_COMMAND_ISSUER,
  InMemoryJtiReplayCache,
} from "./auth.js";
import { createDefaultTenantLifecycleAdapter, SubscriptionLifecycleService } from "./lifecycle-service.js";
import { CommercialProvisioningTelemetry, ProvisioningSloService } from "./observability.js";
import { InstallationOffboardingService } from "./offboarding-service.js";
import {
  defaultSupportedProvisioningDistributionModes,
  platformProvisioningOfferBindings,
  type ProvisioningDistributionMode,
} from "./offer-resolution.js";
import { CommercialProvisioningOperatorService } from "./operator-service.js";
import {
  CutoverReadinessService,
  getEffectiveOfferBindingsForMode,
  resolvePilotCohortPolicy,
} from "./pilot-cutover.js";
import { CrossEntityReconciliationService } from "./reconciliation-service.js";
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
  commandPreviousSecrets?: readonly string[] | undefined;
  commandIssuer: string;
  commandAudience: string;
  privateArchiveDirectory?: string | undefined;
  privateArchiveEncryptionKey?: string | undefined;
  hostingRuntime?: HostingProvisioningRuntime | null | undefined;
  workerId?: string | undefined;
  nodeEnv?: string | undefined;
  pilotMode?: PilotMode | undefined;
  allowedCustomerIds?: readonly string[] | undefined;
  allowedOffers?: readonly string[] | undefined;
  hostingMutationsEnabled?: boolean | undefined;
  legacyFallbackEnabled?: boolean | undefined;
  dualReadReconciliationEnabled?: boolean | undefined;
  supportedDistributionModes?: readonly ProvisioningDistributionMode[] | undefined;
}

const SUPPORTED_HOSTING_TEMPLATES = new Set<TenantHostingTemplate>(TENANT_HOSTING_TEMPLATES);

type StepHostingAdapter = NonNullable<Parameters<typeof createDefaultProvisioningStepAdapters>[0]["hostingRuntime"]>;

export function adaptHostingRuntime(
  hostingRuntime: HostingProvisioningRuntime,
  provisionerPool?: Pool,
  platformPool?: Pool,
): StepHostingAdapter {
  const resolveDeploymentRow = async (tenantId: string, identifier: string) => {
    const queryPool = platformPool ?? provisionerPool;
    if (!queryPool) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
      const byId = await queryPool
        .query<{ id: string; state: string; provider_resource_id?: string | null; created_at?: Date | string }>(
          platformPool
            ? `SELECT id::text, state, provider_resource_id, created_at FROM public.tenant_hosting_deployments WHERE id = $1 AND tenant_id = $2 LIMIT 1`
            : `SELECT id::text, state FROM public.tenant_hosting_deployments WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
          [identifier, tenantId],
        )
        .catch(() => ({ rows: [] }));
      if (byId.rows[0]) return byId.rows[0];
    }
    const byKey = await queryPool
      .query<{ id: string; state: string; provider_resource_id?: string | null; created_at?: Date | string }>(
        platformPool
          ? `SELECT id::text, state, provider_resource_id, created_at FROM public.tenant_hosting_deployments WHERE tenant_id = $1 AND idempotency_key = $2 LIMIT 1`
          : `SELECT id::text, state FROM public.tenant_hosting_deployments WHERE tenant_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [tenantId, identifier],
      )
      .catch(() => ({ rows: [] }));
    return byKey.rows[0] ?? null;
  };

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
      if (!ref.tenantId) {
        return { status: "unknown" };
      }
      const row = await resolveDeploymentRow(ref.tenantId, ref.deploymentId);
      if (row && platformPool && row.provider_resource_id) {
        const inspected = await hostingRuntime.inspect({
          provider: ref.providerId,
          resourceId: row.provider_resource_id,
          tenantId: ref.tenantId as TenantId,
          createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date(0).toISOString(),
        });
        return { status: inspected.state };
      }
      if (row) {
        return { status: row.state };
      }
      const inspected = await hostingRuntime.inspect({
        provider: ref.providerId,
        resourceId: ref.deploymentId,
        tenantId: ref.tenantId as TenantId,
        createdAt: new Date(0).toISOString(),
      });
      return { status: inspected.state };
    },
    async stop(args) {
      if (!args.tenantId) return;
      const row = await resolveDeploymentRow(args.tenantId, args.deploymentId);
      if (!row?.id) return;
      await hostingRuntime.lifecycle({
        tenantId: args.tenantId,
        deploymentId: row.id,
        action: "stop",
        actorId: "commercial-provisioning-saga",
        requestId: args.operationId,
      });
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

  const pilotPolicy = resolvePilotCohortPolicy({
    pilotMode: config.pilotMode ?? "disabled",
    nodeEnv: config.nodeEnv ?? process.env.NODE_ENV ?? "development",
    hostingMutationsEnabled: config.hostingMutationsEnabled ?? Boolean(config.hostingRuntime),
    legacyFallbackEnabled: config.legacyFallbackEnabled ?? true,
    dualReadReconciliationEnabled: config.dualReadReconciliationEnabled ?? true,
    ...(config.allowedCustomerIds ? { allowedCustomerIds: config.allowedCustomerIds } : {}),
    ...(config.allowedOffers ? { allowedOffers: config.allowedOffers } : {}),
  });
  const effectiveOfferBindings =
    pilotPolicy.pilotMode === "disabled"
      ? platformProvisioningOfferBindings
      : getEffectiveOfferBindingsForMode(
          pilotPolicy.pilotMode,
          pilotPolicy.allowedOffers,
          platformProvisioningOfferBindings,
        );
  const supportedDistributionModes =
    config.supportedDistributionModes ?? defaultSupportedProvisioningDistributionModes;

  const auditExecutor = auditPool ?? platformPool ?? provisionerPool;
  const auditWriter = new PostgresAuditEventWriter(auditExecutor);
  const nodeEnv = config.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  if (isProduction && !config.privateArchiveDirectory) {
    throw new Error("PRIVATE_ARCHIVE_DIR must be explicitly configured in production.");
  }
  const baseStorage: PrivateArchiveStorage = new LocalPrivateArchiveStorage(
    config.privateArchiveDirectory ?? resolve(tmpdir(), "bazion-private-archives"),
  );
  if (isProduction && !config.privateArchiveEncryptionKey) {
    throw new Error("PRIVATE_ARCHIVE_ENCRYPTION_KEY must be configured in production.");
  }
  const storage: PrivateArchiveStorage = config.privateArchiveEncryptionKey
    ? new EncryptedPrivateArchiveStorage(baseStorage, config.privateArchiveEncryptionKey)
    : baseStorage;

  const tenantAdapter = platformPool
    ? createDefaultTenantLifecycleAdapter(platformPool, config.hostingRuntime)
    : undefined;
  const telemetry = new CommercialProvisioningTelemetry();
  const reconciliationService = new CrossEntityReconciliationService(
    provisionerPool,
    platformPool ?? null,
    effectiveOfferBindings,
  );
  const sloService = new ProvisioningSloService(provisionerPool, reconciliationService, telemetry);
  const cutoverService = new CutoverReadinessService(
    pilotPolicy,
    sloService,
    reconciliationService,
    auditExecutor,
  );

  const adapters = createDefaultProvisioningStepAdapters({
    provisionerPool,
    ...(platformPool ? { platformPool } : {}),
    hostingRuntime: config.hostingRuntime
      ? adaptHostingRuntime(config.hostingRuntime, provisionerPool, platformPool)
      : null,
    offerBindings: effectiveOfferBindings,
  });
  const orchestrator = new CommercialProvisioningSagaOrchestrator(provisionerPool, adapters, {
    ...(config.workerId ? { workerId: config.workerId } : {}),
    offerBindings: effectiveOfferBindings,
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
  const replayCache = new InMemoryJtiReplayCache();

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
      ...(config.commandPreviousSecrets?.length ? { previousSecrets: config.commandPreviousSecrets } : {}),
      issuer: config.commandIssuer || DEFAULT_COMMAND_ISSUER,
      audience: config.commandAudience || DEFAULT_COMMAND_AUDIENCE,
      replayStore: replayCache,
    },
    service: new CommercialProvisioningService(
      provisionerPool,
      effectiveOfferBindings,
      supportedDistributionModes,
      pilotPolicy,
    ),
    dispatcher: new PlatformStatusOutboxDispatcher(provisionerPool),
    orchestrator,
    operatorService,
    lifecycleService,
    lifecycleDispatcher: new PlatformLifecycleOutboxDispatcher(provisionerPool),
    offboardingService,
    pilotPolicy,
    telemetry,
    reconciliationService,
    sloService,
    cutoverService,
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

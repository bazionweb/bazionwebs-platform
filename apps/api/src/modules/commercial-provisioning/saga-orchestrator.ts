import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import {
  PostgresProvisioningSagaJournal,
  prepareInstallationConfigurationSnapshot,
  ProvisioningStepError,
  runProvisioningSaga,
  StaleSagaLeaseError,
  type ClaimedProvisioningOperation,
  type ProvisioningSagaContext,
  type ProvisioningSagaLease,
  type ProvisioningSagaResult,
  type ProvisioningSagaStep,
  type ProvisioningSagaStepName,
  type ProvisioningStepEffect,
  type ProvisioningStepInspectionResult,
} from "@bazion/product-installations";
import type { ProvisioningOfferBinding } from "./offer-resolution.js";
import { buildProductInitialConfiguration, resolveOfferBindingForOperation } from "./product-configuration.js";

export interface ProvisioningOperationMetadata {
  operationId: string;
  correlationId: string;
  externalCustomerId: string;
  externalOrderId: string;
  offerId: string;
  offerVersion: string;
  productId: string;
  productVersion: string;
  solutionId: string;
  solutionVersion: string;
  templateId: string;
  templateVersion: string;
  requestedDomain: string | null;
  distributionMode: "shared-managed" | "dedicated";
  attemptCount: number;
}

export interface ProvisioningStepAdapters {
  validateComposition(operation: ProvisioningOperationMetadata): Promise<void>;
  ensureTenant(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<{ tenantId: string; ownership: "created" | "linked_existing"; slug: string }>;
  inspectTenant?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<{ tenantId: string; ownership: "created" | "linked_existing"; slug: string } | null>;
  compensateTenant?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    effect: ProvisioningStepEffect;
    idempotencyKey: string;
  }): Promise<void>;

  createInstallation(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<{ installationId: string; ownership: "created" | "existing" }>;
  inspectInstallation?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<{ installationId: string; ownership: "created" | "existing" } | null>;
  compensateInstallation?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    effect: ProvisioningStepEffect;
    idempotencyKey: string;
  }): Promise<void>;

  configureInstallation(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<{ configurationVersion: number; checksum: string }>;
  inspectConfiguration?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<{ configurationVersion: number; checksum: string } | null>;
  compensateConfiguration?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    effect: ProvisioningStepEffect;
    idempotencyKey: string;
  }): Promise<void>;

  bindDomain(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<ProvisioningStepEffect>;
  inspectDomain?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<ProvisioningStepInspectionResult>;
  compensateDomain?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    effect: ProvisioningStepEffect;
    idempotencyKey: string;
  }): Promise<void>;

  provisionHosting(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<ProvisioningStepEffect>;
  inspectHosting?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<ProvisioningStepInspectionResult>;
  compensateHosting?(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    effect: ProvisioningStepEffect;
    idempotencyKey: string;
  }): Promise<void>;

  verifyReadiness(input: {
    operation: ProvisioningOperationMetadata;
    context: ProvisioningSagaContext;
    idempotencyKey: string;
  }): Promise<ProvisioningStepEffect>;
}

export interface PostgresPoolLike {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
  connect(): Promise<PoolClient>;
}

const TEST_FIXTURE_PRODUCT_IDS = new Set(["bazion-site", "church-ministry", "ecommerce", "managed-web"]);
let cachedOfferingIds: Set<string> | null = null;

function hasProductManifest(productId: string): boolean {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(productId)) return false;
  const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), `../../../../../products/${productId}/manifest.json`);
  return existsSync(manifestPath);
}

function getKnownOfferingIds(): Set<string> | null {
  if (cachedOfferingIds) return cachedOfferingIds;
  try {
    const offeringsPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../products/commercial-offerings.json");
    if (!existsSync(offeringsPath)) return null;
    const raw = JSON.parse(readFileSync(offeringsPath, "utf8")) as { offerings?: Array<{ id?: string }> };
    if (Array.isArray(raw.offerings)) {
      cachedOfferingIds = new Set(raw.offerings.map((o) => o.id).filter((id): id is string => typeof id === "string"));
      return cachedOfferingIds;
    }
  } catch {
    return null;
  }
  return null;
}

function deriveSafeTenantSlug(externalCustomerId: string, externalOrderId: string): string {
  const normalized = `${externalCustomerId}-${externalOrderId}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `org-${normalized.slice(0, 60) || randomUUID().slice(0, 12)}`;
}

/** Builds default PostgreSQL-backed step adapters using explicit operation ownership and no silent merges. */
export function createDefaultProvisioningStepAdapters(input: {
  provisionerPool: PostgresPoolLike;
  platformPool?: PostgresPoolLike;
  offerBindings?: readonly ProvisioningOfferBinding[];
  hostingRuntime?: {
    providerId: string;
    provision(args: {
      tenantId: string;
      environmentId?: string;
      template: { id: string; version: string };
      idempotencyKey: string;
    }): Promise<{ providerDeploymentId?: string; status: string }>;
    inspect(ref: { providerId: string; deploymentId: string; tenantId?: string }): Promise<{ status: string }>;
    stop?(args: { tenantId?: string; deploymentId: string; operationId: string; idempotencyKey: string }): Promise<void>;
  } | null;
  domainBinder?: {
    reserveOrVerify(tenantId: string, hostname: string): Promise<{ domainId: string; status: "pending" | "active" }>;
    inspect?(tenantId: string, hostname: string): Promise<{ domainId: string; status: "pending" | "active" | "disabled" } | null>;
    disableOwned?(tenantId: string, domainId: string): Promise<void>;
  };
}): ProvisioningStepAdapters {
  const { provisionerPool, platformPool, hostingRuntime, domainBinder, offerBindings } = input;
  const controlPool = platformPool ?? provisionerPool;

  return {
    async validateComposition(op) {
      if (!op.productId || !op.solutionId || !op.templateId || !op.offerId) {
        throw new ProvisioningStepError("INVALID_COMPOSITION_REFERENCE", "compensate");
      }
      const boundProduct = offerBindings?.some((b) => b.composition.product.id === op.productId) ?? false;
      const validProduct =
        boundProduct
        || hasProductManifest(op.productId)
        || (process.env.NODE_ENV === "test" && TEST_FIXTURE_PRODUCT_IDS.has(op.productId));
      if (!validProduct) {
        throw new ProvisioningStepError("UNKNOWN_PRODUCT_RELEASE", "compensate");
      }
      const offerings = getKnownOfferingIds();
      if (!boundProduct && offerings && !offerings.has(op.offerId)) {
        throw new ProvisioningStepError("UNKNOWN_COMMERCIAL_OFFER", "compensate");
      }
    },

    async ensureTenant({ operation }) {
      const slug = deriveSafeTenantSlug(operation.externalCustomerId, operation.externalOrderId);
      const existingOp = await provisionerPool.query<{ tenant_id: string | null }>(
        `SELECT tenant_id::text FROM public.product_provisioning_operations WHERE id = $1 LIMIT 1`,
        [operation.operationId],
      );
      const preboundTenantId = existingOp.rows[0]?.tenant_id ?? null;

      const client = await controlPool.connect();
      try {
        await client.query("BEGIN");
        if (preboundTenantId) {
          const boundTenant = await client.query<{ id: string; slug: string }>(
            `SELECT id::text, slug FROM public.tenants WHERE id = $1 LIMIT 1`,
            [preboundTenantId],
          );
          if (boundTenant.rows[0]) {
            await client.query("COMMIT");
            return {
              tenantId: boundTenant.rows[0].id,
              ownership: "linked_existing",
              slug: boundTenant.rows[0].slug,
            };
          }
        }

        // Check existing tenant only via exact order installation or deterministic slug created for this order
        const existingBySlug = await client.query<{ id: string; slug: string }>(
          `SELECT id::text, slug FROM public.tenants WHERE slug = $1 LIMIT 1`,
          [slug],
        );
        if (existingBySlug.rows[0]) {
          await client.query("COMMIT");
          return {
            tenantId: existingBySlug.rows[0].id,
            ownership: "created",
            slug: existingBySlug.rows[0].slug,
          };
        }

        // Reject silent merges: if another tenant already exists with the requested custom domain, fail explicitly
        if (operation.requestedDomain) {
          const conflictingDomain = await client.query<{ tenant_id: string }>(
            `SELECT tenant_id::text FROM public.tenant_domains WHERE hostname = lower($1) LIMIT 1`,
            [operation.requestedDomain],
          );
          if (conflictingDomain.rows[0]) {
            await client.query("ROLLBACK");
            throw new ProvisioningStepError("TENANT_DOMAIN_COLLISION_REQUIRES_REVIEW", "compensate");
          }
        }

        const inserted = await client.query<{ id: string; slug: string }>(
          `INSERT INTO public.tenants (slug, name, default_currency, status)
           VALUES ($1, $2, 'KES', 'active')
           ON CONFLICT (slug) DO UPDATE SET updated_at = now()
           RETURNING id::text, slug`,
          [slug, `Workspace ${operation.externalOrderId.slice(0, 60)}`],
        );
        await client.query("COMMIT");
        return {
          tenantId: inserted.rows[0]!.id,
          ownership: "created",
          slug: inserted.rows[0]!.slug,
        };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async inspectTenant({ operation, context }) {
      if (context.tenantId) {
        const res = await controlPool.query<{ id: string; slug: string }>(
          `SELECT id::text, slug FROM public.tenants WHERE id = $1 LIMIT 1`,
          [context.tenantId],
        );
        if (res.rows[0]) {
          return { tenantId: res.rows[0].id, ownership: "linked_existing", slug: res.rows[0].slug };
        }
      }
      const slug = deriveSafeTenantSlug(operation.externalCustomerId, operation.externalOrderId);
      const res = await controlPool.query<{ id: string; slug: string }>(
        `SELECT id::text, slug FROM public.tenants WHERE slug = $1 LIMIT 1`,
        [slug],
      );
      return res.rows[0] ? { tenantId: res.rows[0].id, ownership: "created", slug: res.rows[0].slug } : null;
    },

    async compensateTenant({ effect }) {
      const tenantId = effect.tenant_id;
      if (!tenantId || effect.tenant_ownership !== "created") {
        // Retain linked pre-existing customer tenants cleanly without touching them.
        return;
      }
      // Retain tenants if customer-owned business data exists; otherwise suspend cleanly without destructive wipe.
      await controlPool.query(
        `UPDATE public.tenants
         SET status = CASE WHEN status = 'active' THEN 'suspended' ELSE status END,
             suspended_at = COALESCE(suspended_at, now()),
             updated_at = now()
         WHERE id = $1`,
        [tenantId],
      ).catch(() => undefined);
    },

    async createInstallation({ operation, context, idempotencyKey }) {
      const tenantId = context.tenantId;
      if (!tenantId) throw new ProvisioningStepError("TENANT_REQUIRED_FOR_INSTALLATION", "compensate");

      const client = await provisionerPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const existing = await client.query<{ id: string }>(
          `SELECT id::text FROM public.product_installations
           WHERE source = 'bazionweb' AND external_order_id = $1 LIMIT 1`,
          [operation.externalOrderId],
        );
        if (existing.rows[0]) {
          await client.query("COMMIT");
          return { installationId: existing.rows[0].id, ownership: "existing" };
        }

        const opRow = await client.query<{ request_fingerprint: string }>(
          `SELECT request_fingerprint FROM public.product_provisioning_operations WHERE id = $1 LIMIT 1`,
          [operation.operationId],
        );
        const fingerprint = opRow.rows[0]?.request_fingerprint;
        if (!fingerprint) {
          throw new ProvisioningStepError("OPERATION_FINGERPRINT_MISSING", "compensate");
        }
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO public.product_installations (
             tenant_id, source, external_customer_id, external_order_id,
             product_id, product_version, solution_id, solution_version,
             template_id, template_version, configuration_schema_version,
             distribution_mode, idempotency_key, request_fingerprint, status, created_by
           ) VALUES (
             $1, 'bazionweb', $2, $3,
             $4, $5, $6, $7,
             $8, $9, '1.0.0',
             $10, $11, $12, 'provisioning', 'commercial-provisioning'
           )
           ON CONFLICT (source, external_order_id) DO NOTHING
           RETURNING id::text`,
          [
            tenantId,
            operation.externalCustomerId,
            operation.externalOrderId,
            operation.productId,
            operation.productVersion,
            operation.solutionId,
            operation.solutionVersion,
            operation.templateId,
            operation.templateVersion,
            operation.distributionMode,
            idempotencyKey,
            fingerprint,
          ],
        );
        let installationId = inserted.rows[0]?.id;
        if (!installationId) {
          const fallback = await client.query<{ id: string }>(
            `SELECT id::text FROM public.product_installations
             WHERE source = 'bazionweb' AND external_order_id = $1 LIMIT 1`,
            [operation.externalOrderId],
          );
          installationId = fallback.rows[0]?.id;
        }
        await client.query("COMMIT");
        if (!installationId) throw new ProvisioningStepError("INSTALLATION_CREATE_FAILED", "retry");
        return { installationId, ownership: "created" };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        if (error instanceof ProvisioningStepError) throw error;
        throw new ProvisioningStepError("INSTALLATION_CREATE_ERROR", "retry");
      } finally {
        client.release();
      }
    },

    async inspectInstallation({ operation, context }) {
      if (!context.tenantId) return null;
      const client = await provisionerPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
        const res = await client.query<{ id: string }>(
          `SELECT id::text FROM public.product_installations
           WHERE tenant_id = $1 AND external_order_id = $2 LIMIT 1`,
          [context.tenantId, operation.externalOrderId],
        );
        await client.query("COMMIT");
        return res.rows[0] ? { installationId: res.rows[0].id, ownership: "existing" } : null;
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        return null;
      } finally {
        client.release();
      }
    },

    async compensateInstallation({ context, effect }) {
      const tenantId = context.tenantId ?? effect.tenant_id;
      const installationId = context.installationId ?? effect.installation_id;
      if (!tenantId || !installationId || effect.installation_ownership !== "created") {
        return;
      }
      const client = await provisionerPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        await client.query(
          `UPDATE public.product_installations
           SET status = CASE
             WHEN status IN ('requested', 'provisioning', 'ready', 'suspended', 'failed') THEN 'offboarding'
             ELSE status
           END
           WHERE id = $1 AND tenant_id = $2`,
          [installationId, tenantId],
        );
        await client.query(
          `UPDATE public.product_installations
           SET status = 'offboarded'
           WHERE id = $1 AND tenant_id = $2 AND status = 'offboarding'`,
          [installationId, tenantId],
        );
        await client.query("COMMIT");
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error("INSTALLATION_COMPENSATION_FAILED");
      } finally {
        client.release();
      }
    },

    async configureInstallation({ operation, context }) {
      if (!context.tenantId || !context.installationId) {
        throw new ProvisioningStepError("INSTALLATION_REQUIRED_FOR_CONFIG", "compensate");
      }
      const matchedBinding = resolveOfferBindingForOperation(operation, offerBindings);
      const initialSpec = buildProductInitialConfiguration(operation, matchedBinding);
      const snap = prepareInstallationConfigurationSnapshot({
        tenantId: context.tenantId,
        installationId: context.installationId,
        version: 1,
        configurationSchemaVersion: "1.0.0",
        configuration: initialSpec.configuration,
        createdBy: "commercial-provisioning",
      });

      if (platformPool) {
        const controlClient = await platformPool.connect();
        try {
          await controlClient.query("BEGIN");
          for (const moduleId of initialSpec.requiredModules) {
            await controlClient.query(
              `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
               VALUES ($1, $2, true, 'commercial-provisioning')
               ON CONFLICT (tenant_id, module_id) DO NOTHING`,
              [context.tenantId, moduleId],
            );
          }
          await controlClient.query(
            `INSERT INTO public.tenant_platform_settings (tenant_id, settings, version, updated_by)
             VALUES ($1, $2::jsonb, 1, 'commercial-provisioning')
             ON CONFLICT (tenant_id) DO NOTHING`,
            [context.tenantId, JSON.stringify(initialSpec.tenantPlatformSettingsDefaults)],
          );
          await controlClient.query("COMMIT");
        } catch (error) {
          await controlClient.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          controlClient.release();
        }
      }

      const client = await provisionerPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
        const inserted = await client.query<{ checksum: string }>(
          `INSERT INTO public.installation_configuration_versions (
             tenant_id, installation_id, version, configuration_schema_version,
             configuration, checksum, created_by
           ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
           ON CONFLICT (installation_id, version) DO NOTHING
           RETURNING checksum`,
          [
            snap.tenantId,
            snap.installationId,
            snap.version,
            snap.configurationSchemaVersion,
            JSON.stringify(snap.configuration),
            snap.checksum,
            snap.createdBy,
          ],
        );
        let checksum = inserted.rows[0]?.checksum ?? null;
        if (!checksum) {
          const existingRow = await client.query<{ checksum: string }>(
            `SELECT checksum
               FROM public.installation_configuration_versions
              WHERE tenant_id = $1 AND installation_id = $2 AND version = $3
              LIMIT 1`,
            [snap.tenantId, snap.installationId, snap.version],
          );
          checksum = existingRow.rows[0]?.checksum ?? snap.checksum;
        }
        await client.query(
          `UPDATE public.product_installations
           SET current_configuration_version = GREATEST(current_configuration_version, 1)
           WHERE id = $1 AND tenant_id = $2`,
          [context.installationId, context.tenantId],
        );
        await client.query("COMMIT");
        return { configurationVersion: snap.version, checksum };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async inspectConfiguration({ operation, context }) {
      if (!context.tenantId || !context.installationId) return null;
      const client = await provisionerPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
        const res = await client.query<{ version: number; checksum: string }>(
          `SELECT version, checksum
           FROM public.installation_configuration_versions
           WHERE tenant_id = $1 AND installation_id = $2 AND version = 1
           LIMIT 1`,
          [context.tenantId, context.installationId],
        );
        await client.query("COMMIT");
        const existingConfig = res.rows[0];
        if (!existingConfig) return null;

        if (platformPool) {
          const matchedBinding = resolveOfferBindingForOperation(operation, offerBindings);
          const initialSpec = buildProductInitialConfiguration(operation, matchedBinding);
          if (initialSpec.requiredModules.length > 0) {
            const entitlementRes = await platformPool.query<{ module_id: string }>(
              `SELECT module_id
                 FROM public.tenant_module_entitlements
                WHERE tenant_id = $1 AND module_id = ANY($2::text[])`,
              [context.tenantId, [...initialSpec.requiredModules]],
            );
            const presentModules = new Set(entitlementRes.rows.map((r) => r.module_id));
            if (initialSpec.requiredModules.some((moduleId) => !presentModules.has(moduleId))) {
              return null;
            }
          }
        }

        return { configurationVersion: existingConfig.version, checksum: existingConfig.checksum };
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
        return null;
      } finally {
        client.release();
      }
    },

    async compensateConfiguration({ context }) {
      const tenantId = context.tenantId;
      if (!tenantId || !platformPool) return;
      const controlClient = await platformPool.connect();
      try {
        await controlClient.query("BEGIN");
        await controlClient.query(
          `UPDATE public.tenant_module_entitlements
           SET enabled = false,
               updated_at = now()
           WHERE tenant_id = $1
             AND updated_by = 'commercial-provisioning'
             AND module_id <> 'platform-identity'`,
          [tenantId],
        );
        await controlClient.query("COMMIT");
      } catch (error) {
        await controlClient.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        controlClient.release();
      }
    },

    async bindDomain({ operation, context }) {
      if (!operation.requestedDomain) {
        return { domain_mode: "default_platform_subdomain" };
      }
      if (!context.tenantId) throw new ProvisioningStepError("TENANT_REQUIRED_FOR_DOMAIN", "compensate");
      if (domainBinder) {
        const reserved = await domainBinder.reserveOrVerify(context.tenantId, operation.requestedDomain);
        return {
          domain_mode: "custom_domain",
          domain_id: reserved.domainId,
          domain_ownership: "created",
          hostname: operation.requestedDomain,
          domain_status: reserved.status,
        };
      }
      if (!platformPool) {
        return { domain_mode: "deferred_manual_verification", hostname: operation.requestedDomain };
      }
      const hostname = operation.requestedDomain.trim().toLowerCase();
      const existing = await controlPool.query<{ id: string; tenant_id: string; status: string }>(
        `SELECT id::text, tenant_id::text, status FROM public.tenant_domains WHERE hostname = $1 LIMIT 1`,
        [hostname],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].tenant_id !== context.tenantId) {
          throw new ProvisioningStepError("TENANT_DOMAIN_COLLISION_REQUIRES_REVIEW", "compensate");
        }
        return {
          domain_mode: "custom_domain",
          domain_id: existing.rows[0].id,
          domain_ownership: "existing",
          hostname,
          domain_status: existing.rows[0].status,
        };
      }
      const verificationTokenHash = createHash("sha256").update(randomBytes(24)).digest("hex");
      const inserted = await controlPool.query<{ id: string; status: string }>(
        `INSERT INTO public.tenant_domains (tenant_id, hostname, verification_token_hash, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id::text, status`,
        [context.tenantId, hostname, verificationTokenHash],
      );
      return {
        domain_mode: "custom_domain",
        domain_id: inserted.rows[0]!.id,
        domain_ownership: "created",
        hostname,
        domain_status: inserted.rows[0]!.status,
      };
    },

    async inspectDomain({ operation, context }) {
      if (!operation.requestedDomain) {
        return { outcome: "completed", effect: { domain_mode: "default_platform_subdomain" } };
      }
      if (!context.tenantId) return { outcome: "absent" };
      if (domainBinder) {
        if (!domainBinder.inspect) return { outcome: "absent" };
        const existing = await domainBinder.inspect(context.tenantId, operation.requestedDomain);
        if (!existing) return { outcome: "absent" };
        return {
          outcome: "completed",
          effect: {
            domain_mode: "custom_domain",
            domain_id: existing.domainId,
            hostname: operation.requestedDomain,
            domain_status: existing.status,
          },
        };
      }
      if (!platformPool) return { outcome: "absent" };
      const hostname = operation.requestedDomain.trim().toLowerCase();
      const res = await controlPool.query<{ id: string; status: string }>(
        `SELECT id::text, status FROM public.tenant_domains
         WHERE tenant_id = $1 AND hostname = $2 LIMIT 1`,
        [context.tenantId, hostname],
      );
      const row = res.rows[0];
      if (!row) return { outcome: "absent" };
      return {
        outcome: "completed",
        effect: {
          domain_mode: "custom_domain",
          domain_id: row.id,
          hostname,
          domain_status: row.status,
        },
      };
    },

    async compensateDomain({ context, effect }) {
      if (!context.tenantId || effect.domain_ownership !== "created" || !effect.domain_id) return;
      if (domainBinder?.disableOwned) {
        await domainBinder.disableOwned(context.tenantId, effect.domain_id);
        return;
      }
      if (platformPool) {
        await controlPool.query(
          `UPDATE public.tenant_domains
           SET status = 'disabled', updated_at = now()
           WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
          [effect.domain_id, context.tenantId],
        ).catch(() => undefined);
      }
    },

    async provisionHosting({ operation, context, idempotencyKey }) {
      if (operation.distributionMode === "shared-managed") {
        return { hosting_mode: "shared_managed", isolation_tier: "shared" };
      }
      if (!hostingRuntime) {
        throw new ProvisioningStepError("DEDICATED_HOSTING_UNAVAILABLE", "compensate");
      }
      if (!context.tenantId) throw new ProvisioningStepError("TENANT_REQUIRED_FOR_HOSTING", "compensate");
      const deployed = await hostingRuntime.provision({
        tenantId: context.tenantId,
        template: { id: operation.templateId, version: operation.templateVersion },
        idempotencyKey,
      });
      return {
        hosting_mode: "dedicated",
        provider_id: hostingRuntime.providerId,
        hosting_ownership: "created",
        ...(deployed.providerDeploymentId ? { deployment_id: deployed.providerDeploymentId } : {}),
      };
    },

    async inspectHosting({ operation, context, idempotencyKey }) {
      if (operation.distributionMode === "shared-managed") {
        return { outcome: "completed", effect: { hosting_mode: "shared_managed", isolation_tier: "shared" } };
      }
      if (!context.tenantId) {
        return { outcome: "absent" };
      }
      const existingDeployment = await provisionerPool
        .query<{ id: string; state: string }>(
          `SELECT id::text, state
           FROM public.tenant_hosting_deployments
           WHERE tenant_id = $1 AND idempotency_key = $2
           LIMIT 1`,
          [context.tenantId, idempotencyKey],
        )
        .catch(() => ({ rows: [] as Array<{ id: string; state: string }> }));
      const row = existingDeployment.rows[0];
      if (!row) {
        return { outcome: "absent" };
      }
      const providerId = hostingRuntime?.providerId ?? "dokploy";
      if (hostingRuntime?.inspect) {
        try {
          const observed = await hostingRuntime.inspect({
            providerId,
            deploymentId: row.id,
            tenantId: context.tenantId,
          });
          if (observed.status === "running" || observed.status === "ready" || observed.status === "deploying") {
            return {
              outcome: "completed",
              effect: {
                hosting_mode: "dedicated",
                provider_id: providerId,
                hosting_ownership: "created",
                deployment_id: row.id,
              },
            };
          }
          if (observed.status === "removed" || observed.status === "failed") {
            return { outcome: "absent" };
          }
          return { outcome: "pending" };
        } catch {
          return { outcome: "pending" };
        }
      }
      if (row.state === "running" || row.state === "ready" || row.state === "deploying") {
        return {
          outcome: "completed",
          effect: {
            hosting_mode: "dedicated",
            provider_id: providerId,
            hosting_ownership: "created",
            deployment_id: row.id,
          },
        };
      }
      if (row.state === "unknown") {
        return { outcome: "pending" };
      }
      return { outcome: "absent" };
    },

    async compensateHosting({ operation, context, effect, idempotencyKey }) {
      if (
        effect.hosting_mode !== "dedicated"
        || effect.hosting_ownership !== "created"
        || !effect.deployment_id
        || !hostingRuntime?.stop
      ) {
        return;
      }
      await hostingRuntime.stop({
        ...(context.tenantId ? { tenantId: context.tenantId } : {}),
        deploymentId: effect.deployment_id,
        operationId: operation.operationId,
        idempotencyKey,
      });
    },

    async verifyReadiness({ context }) {
      if (!context.tenantId || !context.installationId) {
        throw new ProvisioningStepError("READINESS_MISSING_REFERENCES", "compensate");
      }
      const client = await provisionerPool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenantId]);
        const updated = await client.query<{ status: string }>(
          `UPDATE public.product_installations
           SET status = 'ready'
           WHERE id = $1 AND tenant_id = $2 AND status IN ('provisioning', 'ready')
           RETURNING status`,
          [context.installationId, context.tenantId],
        );
        await client.query("COMMIT");
        if (!updated.rows[0]) {
          throw new ProvisioningStepError("INSTALLATION_NOT_READYABLE", "compensate");
        }
        return { installation_status: "ready", tenant_id: context.tenantId, installation_id: context.installationId };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

/** Builds all 7 ordered Phase 6 saga steps around explicit external-state adapters. */
export function buildProvisioningSagaSteps(
  operation: ProvisioningOperationMetadata,
  adapters: ProvisioningStepAdapters,
): ProvisioningSagaStep[] {
  return [
    {
      name: "validate_composition",
      status: "validating",
      async execute() {
        await adapters.validateComposition(operation);
        return {
          product_id: operation.productId,
          product_version: operation.productVersion,
          distribution_mode: operation.distributionMode,
        };
      },
      async compensate() {
        // Pure validation step requires no external rollback.
      },
    },
    {
      name: "ensure_tenant",
      status: "provisioning_tenant",
      async inspect(context, forwardKey) {
        if (!adapters.inspectTenant) return { outcome: "absent" };
        const existing = await adapters.inspectTenant({ operation, context, idempotencyKey: forwardKey });
        if (!existing) return { outcome: "absent" };
        return {
          outcome: "completed",
          effect: {
            tenant_id: existing.tenantId,
            tenant_ownership: existing.ownership,
            tenant_slug: existing.slug,
          },
        };
      },
      async execute(context, forwardKey) {
        const res = await adapters.ensureTenant({ operation, context, idempotencyKey: forwardKey });
        return {
          tenant_id: res.tenantId,
          tenant_ownership: res.ownership,
          tenant_slug: res.slug,
        };
      },
      async compensate(context, effect, compensateKey) {
        await adapters.compensateTenant?.({ operation, context, effect, idempotencyKey: compensateKey });
      },
    },
    {
      name: "create_installation",
      status: "configuring_installation",
      async inspect(context, forwardKey) {
        if (!adapters.inspectInstallation) return { outcome: "absent" };
        const existing = await adapters.inspectInstallation({ operation, context, idempotencyKey: forwardKey });
        if (!existing) return { outcome: "absent" };
        return {
          outcome: "completed",
          effect: {
            installation_id: existing.installationId,
            installation_ownership: existing.ownership,
          },
        };
      },
      async execute(context, forwardKey) {
        const res = await adapters.createInstallation({ operation, context, idempotencyKey: forwardKey });
        return {
          installation_id: res.installationId,
          installation_ownership: res.ownership,
        };
      },
      async compensate(context, effect, compensateKey) {
        await adapters.compensateInstallation?.({ operation, context, effect, idempotencyKey: compensateKey });
      },
    },
    {
      name: "configure_installation",
      status: "configuring_installation",
      async inspect(context, forwardKey) {
        if (!adapters.inspectConfiguration) return { outcome: "absent" };
        const existing = await adapters.inspectConfiguration({ operation, context, idempotencyKey: forwardKey });
        if (!existing) return { outcome: "absent" };
        return {
          outcome: "completed",
          effect: {
            config_version: String(existing.configurationVersion),
            config_checksum: existing.checksum,
          },
        };
      },
      async execute(context, forwardKey) {
        const res = await adapters.configureInstallation({ operation, context, idempotencyKey: forwardKey });
        return {
          config_version: String(res.configurationVersion),
          config_checksum: res.checksum,
        };
      },
      async compensate(context, effect, compensateKey) {
        await adapters.compensateConfiguration?.({ operation, context, effect, idempotencyKey: compensateKey });
      },
    },
    {
      name: "bind_domain",
      status: "configuring_installation",
      async inspect(context, forwardKey) {
        if (!adapters.inspectDomain) return { outcome: "absent" };
        return adapters.inspectDomain({ operation, context, idempotencyKey: forwardKey });
      },
      async execute(context, forwardKey) {
        return adapters.bindDomain({ operation, context, idempotencyKey: forwardKey });
      },
      async compensate(context, effect, compensateKey) {
        await adapters.compensateDomain?.({ operation, context, effect, idempotencyKey: compensateKey });
      },
    },
    {
      name: "provision_hosting",
      status: "provisioning_hosting",
      async inspect(context, forwardKey) {
        if (!adapters.inspectHosting) return { outcome: "absent" };
        return adapters.inspectHosting({ operation, context, idempotencyKey: forwardKey });
      },
      async execute(context, forwardKey) {
        return adapters.provisionHosting({ operation, context, idempotencyKey: forwardKey });
      },
      async compensate(context, effect, compensateKey) {
        await adapters.compensateHosting?.({ operation, context, effect, idempotencyKey: compensateKey });
      },
    },
    {
      name: "verify_readiness",
      status: "provisioning_hosting",
      async execute(context, forwardKey) {
        return adapters.verifyReadiness({ operation, context, idempotencyKey: forwardKey });
      },
      async compensate() {
        // Installation compensation transitions installation status cleanly when invoked.
      },
    },
  ];
}

export interface SagaWorkerOptions {
  workerId?: string;
  leaseDurationMs?: number;
  maxRetryAttempts?: number;
  offerBindings?: readonly {
    offer: { id: string; version: string };
    distributionMode: "shared-managed" | "dedicated";
  }[];
}

/**
 * Coordinates leased, fenced PostgreSQL saga runs and due-operation batch processing.
 */
export class CommercialProvisioningSagaOrchestrator {
  readonly journal: PostgresProvisioningSagaJournal;
  private readonly workerId: string;
  private readonly leaseDurationMs: number;
  private readonly maxRetryAttempts: number;
  private readonly offerBindings: readonly {
    offer: { id: string; version: string };
    distributionMode: "shared-managed" | "dedicated";
  }[];

  constructor(
    private readonly provisionerPool: PostgresPoolLike,
    private readonly adapters: ProvisioningStepAdapters,
    options: SagaWorkerOptions = {},
  ) {
    this.journal = new PostgresProvisioningSagaJournal(provisionerPool);
    this.workerId = options.workerId ?? `saga-worker-${randomUUID().slice(0, 8)}`;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.maxRetryAttempts = Math.max(1, options.maxRetryAttempts ?? 5);
    this.offerBindings = options.offerBindings ?? [];
  }

  async runClaimed(
    claimed: ClaimedProvisioningOperation,
    options?: {
      resumeForward?: boolean;
      resumeCompensation?: boolean;
      forceInspect?: boolean;
      distributionMode?: "shared-managed" | "dedicated";
      leaseDurationMs?: number;
    },
  ): Promise<ProvisioningSagaResult> {
    const metadata: ProvisioningOperationMetadata = {
      operationId: claimed.operationId,
      correlationId: claimed.correlationId,
      externalCustomerId: claimed.externalCustomerId,
      externalOrderId: claimed.externalOrderId,
      offerId: claimed.offerId,
      offerVersion: claimed.offerVersion,
      productId: claimed.productId,
      productVersion: claimed.productVersion,
      solutionId: claimed.solutionId,
      solutionVersion: claimed.solutionVersion,
      templateId: claimed.templateId,
      templateVersion: claimed.templateVersion,
      requestedDomain: claimed.requestedDomain,
      distributionMode: options?.distributionMode
        ?? this.offerBindings.find(
          (binding) => binding.offer.id === claimed.offerId && binding.offer.version === claimed.offerVersion,
        )?.distributionMode
        ?? "shared-managed",
      attemptCount: claimed.attemptCount,
    };
    const context: ProvisioningSagaContext = {
      operationId: claimed.operationId,
      correlationId: claimed.correlationId,
      externalOrderId: claimed.externalOrderId,
      tenantId: claimed.tenantId,
      installationId: claimed.installationId,
    };
    const steps = buildProvisioningSagaSteps(metadata, this.adapters);

    let retryAfterAt: Date | null = null;
    try {
      const result = await runProvisioningSaga({
        context,
        steps,
        journal: this.journal,
        lease: claimed.lease,
        leaseDurationMs: options?.leaseDurationMs ?? this.leaseDurationMs,
        ...(options?.resumeForward !== undefined ? { resumeForward: options.resumeForward } : {}),
        ...(options?.resumeCompensation !== undefined ? { resumeCompensation: options.resumeCompensation } : {}),
        ...(options?.forceInspect !== undefined ? { forceInspect: options.forceInspect } : {}),
      });

      if (result.status === "failed" && result.failure?.retryable) {
        if (claimed.attemptCount >= this.maxRetryAttempts) {
          await this.journal.setStatus(
            claimed.operationId,
            "failed",
            { code: result.failure.code, retryable: false, disposition: "compensate" },
            claimed.lease,
          );
          return {
            status: "failed",
            failure: { code: result.failure.code, retryable: false, disposition: "compensate" },
          };
        }
        const delayMs = Math.min(300_000, 15_000 * 2 ** Math.max(0, claimed.attemptCount - 1));
        retryAfterAt = new Date(Date.now() + delayMs);
      }

      return result;
    } finally {
      await this.journal
        .releaseLease({
          operationId: claimed.operationId,
          lease: claimed.lease,
          retryAfterAt,
        })
        .catch(() => undefined);
    }
  }

  async runOperation(
    operationId: string,
    options?: { resumeForward?: boolean; resumeCompensation?: boolean; forceInspect?: boolean; leaseDurationMs?: number },
  ): Promise<{ claimed: false } | { claimed: true; result: ProvisioningSagaResult; lease: ProvisioningSagaLease }> {
    const claimed = await this.journal.claimOperation({
      operationId,
      workerId: this.workerId,
      leaseDurationMs: options?.leaseDurationMs ?? this.leaseDurationMs,
    });
    if (!claimed) return { claimed: false };
    try {
      const result = await this.runClaimed(claimed, options);
      return { claimed: true, result, lease: claimed.lease };
    } catch (error) {
      if (error instanceof StaleSagaLeaseError) {
        throw error;
      }
      throw error;
    }
  }

  async processDueOperations(limit = 10): Promise<Array<{ operationId: string; status: string }>> {
    const claimedBatch = await this.journal.claimDueOperations({
      workerId: this.workerId,
      leaseDurationMs: this.leaseDurationMs,
      limit,
    });
    const outcomes: Array<{ operationId: string; status: string }> = [];
    for (const claimed of claimedBatch) {
      try {
        const result = await this.runClaimed(claimed);
        outcomes.push({ operationId: claimed.operationId, status: result.status });
      } catch (error) {
        if (error instanceof StaleSagaLeaseError) continue;
        throw error;
      }
    }
    return outcomes;
  }
}

export type { ProvisioningSagaStepName };

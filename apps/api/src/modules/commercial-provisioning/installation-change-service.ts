import type { AuditEvent } from "@bazion/audit";
import {
  installationChangeCommandV1Schema,
  installationChangeResultV1Schema,
  type InstallationChangeCommandV1,
  type InstallationChangeResultV1,
} from "@bazion/api-contracts";
import { CommercialProvisioningError, type CommercialSqlPool } from "./service.js";

export interface InstallationChangeContext {
  requestId: string;
  actorClientId: string;
}

export interface InstallationChangeAuditWriter {
  append(event: AuditEvent): Promise<unknown>;
}

export interface InstallationChangeServiceOptions {
  allowedModulesByProduct?: Record<string, readonly string[]>;
  protectedRequiredModulesByProduct?: Record<string, readonly string[]>;
}

export const DEFAULT_ALLOWED_MODULES_BY_PRODUCT: Record<string, readonly string[]> = {
  "church-ministry": [
    "platform-identity",
    "church-ministry",
    "media-storage",
    "notifications",
    "analytics",
    "commerce",
  ],
  "bazion-site": [
    "platform-identity",
    "website-content",
    "media-storage",
    "notifications",
    "analytics",
    "commerce",
    "forms",
  ],
};

export const DEFAULT_REQUIRED_MODULES_BY_PRODUCT: Record<string, readonly string[]> = {
  "church-ministry": ["platform-identity", "church-ministry", "media-storage"],
  "bazion-site": ["website-content"],
};

interface ExistingChangeRow {
  id: string;
  event_id: string;
  installation_id: string;
  change_type: InstallationChangeCommandV1["change"]["changeType"];
  external_order_id: string;
  enable_modules: string[];
  disable_modules: string[];
  rollback_of_event_id: string | null;
  expected_base_composition: InstallationChangeCommandV1["target"]["expectedBaseComposition"];
  previous_modules: string[];
  resulting_modules: string[];
  applied_at: Date | string;
}

interface ProductInstallationRow {
  id: string;
  tenant_id: string;
  external_customer_id: string;
  product_id: string;
  product_version: string;
  solution_id: string;
  solution_version: string;
  template_id: string;
  template_version: string;
  status: string;
}

function sortedUnique(items: readonly string[]): string[] {
  return Array.from(new Set(items)).sort();
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  const a = sortedUnique(left);
  const b = sortedUnique(right);
  return a.length === b.length && a.every((value, idx) => value === b[idx]);
}

function sameComposition(
  row: ProductInstallationRow,
  expected: InstallationChangeCommandV1["target"]["expectedBaseComposition"],
): boolean {
  return (
    row.product_id === expected.product.id
    && row.product_version === expected.product.version
    && row.solution_id === expected.solution.id
    && row.solution_version === expected.solution.version
    && row.template_id === expected.template.id
    && row.template_version === expected.template.version
  );
}

/**
 * Applies signed, idempotent target-installation entitlement/add-on changes and rollbacks
 * while keeping the installation's original pinned base composition immutable.
 */
export class InstallationChangeService {
  private readonly allowedModulesByProduct: Record<string, readonly string[]>;
  private readonly protectedRequiredModulesByProduct: Record<string, readonly string[]>;

  constructor(
    private readonly pool: CommercialSqlPool,
    private readonly auditWriter?: InstallationChangeAuditWriter,
    options?: InstallationChangeServiceOptions,
  ) {
    this.allowedModulesByProduct = options?.allowedModulesByProduct ?? DEFAULT_ALLOWED_MODULES_BY_PRODUCT;
    this.protectedRequiredModulesByProduct =
      options?.protectedRequiredModulesByProduct ?? DEFAULT_REQUIRED_MODULES_BY_PRODUCT;
  }

  async applySignedCommand(
    rawCommand: unknown,
    context: InstallationChangeContext,
  ): Promise<InstallationChangeResultV1> {
    const parsed = installationChangeCommandV1Schema.safeParse(rawCommand);
    if (!parsed.success) {
      throw new CommercialProvisioningError(
        400,
        "INVALID_INSTALLATION_CHANGE_COMMAND",
        "Signed installation change command failed v1 contract validation.",
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          code: issue.code,
        })),
      );
    }

    const command = parsed.data;
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existingRes = await client.query<ExistingChangeRow>(
        `SELECT id::text, event_id::text, installation_id::text, change_type, external_order_id,
                enable_modules, disable_modules, rollback_of_event_id::text,
                expected_base_composition, previous_modules, resulting_modules, applied_at
           FROM public.product_installation_changes
          WHERE source = 'bazionweb' AND (idempotency_key = $1 OR event_id = $2::uuid)
          LIMIT 1`,
        [command.idempotencyKey, command.eventId],
      );

      if (existingRes.rows[0]) {
        const existing = existingRes.rows[0];
        const equivalent =
          existing.installation_id === command.target.installationId
          && existing.change_type === command.change.changeType
          && existing.external_order_id === command.commercial.externalOrderId
          && (existing.rollback_of_event_id ?? null) === command.change.rollbackOfEventId
          && sameStringArray(existing.enable_modules, command.change.enableModules)
          && sameStringArray(existing.disable_modules, command.change.disableModules);

        if (!equivalent) {
          throw new CommercialProvisioningError(
            409,
            "INSTALLATION_CHANGE_IDEMPOTENCY_CONFLICT",
            "Installation change idempotencyKey or eventId was reused with conflicting parameters.",
          );
        }

        await client.query("COMMIT");
        return installationChangeResultV1Schema.parse({
          schemaVersion: "1.0.0",
          changeId: existing.id,
          eventId: existing.event_id,
          installationId: existing.installation_id,
          idempotentReplay: true,
          changeType: existing.change_type,
          preservedBaseComposition: existing.expected_base_composition,
          previousModules: existing.previous_modules,
          resultingModules: existing.resulting_modules,
          appliedAt: new Date(existing.applied_at).toISOString(),
        });
      }

      let tenantId = command.target.tenantId ?? null;
      if (!tenantId) {
        const opRes = await client.query<{ tenant_id: string | null }>(
          `SELECT tenant_id::text
             FROM public.product_provisioning_operations
            WHERE source = 'bazionweb' AND installation_id = $1::uuid
            LIMIT 1`,
          [command.target.installationId],
        );
        tenantId = opRes.rows[0]?.tenant_id ?? null;
      }

      if (!tenantId) {
        throw new CommercialProvisioningError(
          404,
          "INSTALLATION_NOT_FOUND",
          "Target installation was not found for tenant resolution.",
        );
      }

      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

      const instRes = await client.query<ProductInstallationRow>(
        `SELECT id::text, tenant_id::text, external_customer_id,
                product_id, product_version, solution_id, solution_version,
                template_id, template_version, status
           FROM public.product_installations
          WHERE id = $1::uuid AND tenant_id = $2::uuid
          LIMIT 1
          FOR UPDATE`,
        [command.target.installationId, tenantId],
      );

      const installation = instRes.rows[0];
      if (!installation) {
        throw new CommercialProvisioningError(
          404,
          "INSTALLATION_NOT_FOUND",
          "Target installation record does not exist.",
        );
      }

      if (installation.external_customer_id !== command.target.externalCustomerId) {
        throw new CommercialProvisioningError(
          403,
          "INSTALLATION_OWNERSHIP_MISMATCH",
          "Target installation belongs to a different external customer.",
        );
      }

      if (installation.status === "offboarded" || installation.status === "offboarding") {
        throw new CommercialProvisioningError(
          409,
          "INSTALLATION_OFFBOARDED",
          "Offboarding or offboarded installations cannot accept entitlement changes.",
        );
      }

      if (!sameComposition(installation, command.target.expectedBaseComposition)) {
        throw new CommercialProvisioningError(
          409,
          "BASE_COMPOSITION_MISMATCH",
          "Pinned installation base composition does not match expectedBaseComposition.",
        );
      }

      const allowedModules = this.allowedModulesByProduct[installation.product_id];
      if (allowedModules) {
        for (const moduleId of [...command.change.enableModules, ...command.change.disableModules]) {
          if (!allowedModules.includes(moduleId)) {
            throw new CommercialProvisioningError(
              422,
              "UNSUPPORTED_PRODUCT_MODULE",
              `Module "${moduleId}" is not compatible with product "${installation.product_id}".`,
            );
          }
        }
      }

      const protectedModules = this.protectedRequiredModulesByProduct[installation.product_id] ?? [];
      for (const moduleId of command.change.disableModules) {
        if (protectedModules.includes(moduleId)) {
          throw new CommercialProvisioningError(
            422,
            "REQUIRED_MODULE_CANNOT_BE_DISABLED",
            `Required module "${moduleId}" cannot be disabled on product "${installation.product_id}".`,
          );
        }
      }

      const currentModulesRes = await client.query<{ module_id: string }>(
        `SELECT module_id
           FROM public.tenant_module_entitlements
          WHERE tenant_id = $1::uuid AND enabled = true
          ORDER BY module_id ASC`,
        [tenantId],
      );
      const previousModules = sortedUnique(currentModulesRes.rows.map((r) => r.module_id));

      let resultingModules: string[];
      if (command.change.changeType === "rollback") {
        const targetRes = await client.query<{ previous_modules: string[] }>(
          `SELECT previous_modules
             FROM public.product_installation_changes
            WHERE installation_id = $1::uuid AND event_id = $2::uuid
            LIMIT 1`,
          [command.target.installationId, command.change.rollbackOfEventId],
        );
        const rollbackTarget = targetRes.rows[0];
        if (!rollbackTarget) {
          throw new CommercialProvisioningError(
            404,
            "ROLLBACK_TARGET_NOT_FOUND",
            "Rollback target installation change event was not found for this installation.",
          );
        }

        const alreadyRolledBack = await client.query<{ id: string }>(
          `SELECT id::text
             FROM public.product_installation_changes
            WHERE installation_id = $1::uuid AND rollback_of_event_id = $2::uuid
            LIMIT 1`,
          [command.target.installationId, command.change.rollbackOfEventId],
        );
        if (alreadyRolledBack.rows[0]) {
          throw new CommercialProvisioningError(
            409,
            "ROLLBACK_ALREADY_APPLIED",
            "Target installation change event was already rolled back.",
          );
        }

        resultingModules = sortedUnique(rollbackTarget.previous_modules);
      } else {
        const nextSet = new Set(previousModules);
        for (const mod of command.change.enableModules) nextSet.add(mod);
        for (const mod of command.change.disableModules) nextSet.delete(mod);
        resultingModules = sortedUnique([...nextSet]);
      }

      const resultingSet = new Set(resultingModules);
      const toDisable = previousModules.filter((mod) => !resultingSet.has(mod));
      const updatedBy = `installation-change:${context.actorClientId}`;

      for (const moduleId of resultingModules) {
        await client.query(
          `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
           VALUES ($1::uuid, $2, true, $3)
           ON CONFLICT (tenant_id, module_id)
           DO UPDATE SET enabled = true, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [tenantId, moduleId, updatedBy],
        );
      }

      for (const moduleId of toDisable) {
        await client.query(
          `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
           VALUES ($1::uuid, $2, false, $3)
           ON CONFLICT (tenant_id, module_id)
           DO UPDATE SET enabled = false, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [tenantId, moduleId, updatedBy],
        );
      }

      const preservedBaseComposition = {
        product: { id: installation.product_id, version: installation.product_version },
        solution: { id: installation.solution_id, version: installation.solution_version },
        template: { id: installation.template_id, version: installation.template_version },
      };

      const insertedRes = await client.query<{ id: string; applied_at: Date | string }>(
        `INSERT INTO public.product_installation_changes (
           source, event_id, correlation_id, idempotency_key,
           installation_id, tenant_id, external_customer_id,
           external_order_id, order_line_id, invoice_id, subscription_id,
           change_type, preserve_pinned_base_composition, expected_base_composition,
           enable_modules, disable_modules, entitlement_overrides,
           previous_modules, resulting_modules, rollback_of_event_id, actor_client_id
         ) VALUES (
           'bazionweb', $1::uuid, $2::uuid, $3,
           $4::uuid, $5::uuid, $6,
           $7, $8, $9, $10,
           $11, true, $12::jsonb,
           $13::text[], $14::text[], $15::jsonb,
           $16::text[], $17::text[], $18::uuid, $19
         )
         RETURNING id::text, applied_at`,
        [
          command.eventId,
          command.correlationId,
          command.idempotencyKey,
          command.target.installationId,
          tenantId,
          command.target.externalCustomerId,
          command.commercial.externalOrderId,
          command.commercial.orderLineId,
          command.commercial.invoiceId,
          command.commercial.subscriptionId,
          command.change.changeType,
          JSON.stringify(preservedBaseComposition),
          command.change.enableModules,
          command.change.disableModules,
          JSON.stringify(command.change.entitlementOverrides),
          previousModules,
          resultingModules,
          command.change.rollbackOfEventId,
          context.actorClientId,
        ],
      );

      await client.query("COMMIT");

      const inserted = insertedRes.rows[0]!;
      const result = installationChangeResultV1Schema.parse({
        schemaVersion: "1.0.0",
        changeId: inserted.id,
        eventId: command.eventId,
        installationId: command.target.installationId,
        idempotentReplay: false,
        changeType: command.change.changeType,
        preservedBaseComposition,
        previousModules,
        resultingModules,
        appliedAt: new Date(inserted.applied_at).toISOString(),
      });

      if (this.auditWriter) {
        await Promise.resolve(
          this.auditWriter.append({
            actorType: "service",
            actorId: context.actorClientId,
            tenantId,
            action: `commercial.installation.change.${command.change.changeType}`,
            resourceType: "product_installation",
            resourceId: command.target.installationId,
            outcome: "succeeded",
            requestId: context.requestId,
            metadata: {
              changeId: result.changeId,
              eventId: command.eventId,
              externalOrderId: command.commercial.externalOrderId,
              invoiceId: command.commercial.invoiceId,
              previousModules: previousModules.join(","),
              resultingModules: resultingModules.join(","),
              rollbackOfEventId: command.change.rollbackOfEventId,
            },
          }),
        ).catch(() => undefined);
      }

      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

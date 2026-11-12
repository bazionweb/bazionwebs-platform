import { createHash, randomUUID } from "node:crypto";
import {
  subscriptionLifecycleCommandV1Schema,
  subscriptionLifecycleStatusEventV1Schema,
  type SubscriptionLifecycleCommandV1,
  type SubscriptionLifecycleStatusEventV1,
} from "@bazion/api-contracts";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { CommercialProvisioningError, type CommercialSqlPool } from "./service.js";

export interface TenantLifecycleAdapter {
  setTenantStatus(tenantId: string, action: "suspend" | "restore"): Promise<void>;
}

export interface SubscriptionLifecycleApplyResult {
  deduplicated: boolean;
  stale: boolean;
  applied: boolean;
  commandId: string;
  action: SubscriptionLifecycleCommandV1["action"];
  subscriptionId: string;
  tenantId: string | null;
  installationId: string | null;
  installationStatus: string | null;
  callbackEvent: SubscriptionLifecycleStatusEventV1;
}

export function createDefaultTenantLifecycleAdapter(controlPool: CommercialSqlPool): TenantLifecycleAdapter {
  return {
    async setTenantStatus(tenantId, action) {
      const fromStatus = action === "suspend" ? "active" : "suspended";
      const toStatus = action === "suspend" ? "suspended" : "active";
      const suspendedAt = action === "suspend" ? new Date() : null;
      await controlPool.query(
        `UPDATE public.tenants
         SET status = $2,
             suspended_at = $3,
             updated_at = now()
         WHERE id = $1 AND status = $4`,
        [tenantId, toStatus, suspendedAt, fromStatus],
      );
    },
  };
}

/**
 * Processes signed versioned subscription lifecycle commands (`activate`, `grace`,
 * `suspend`, `reactivate`, `cancel`) from Bazionweb idempotently.
 * Suspension/reactivation is reversible; customer data is never implicitly purged on cancel.
 */
export class SubscriptionLifecycleService {
  constructor(
    private readonly provisionerPool: CommercialSqlPool,
    private readonly auditWriter: PostgresAuditEventWriter,
    private readonly tenantAdapter?: TenantLifecycleAdapter,
  ) {}

  async applySignedCommand(
    rawCommand: unknown,
    context: { requestId: string; actorClientId: string },
  ): Promise<SubscriptionLifecycleApplyResult> {
    const parsed = subscriptionLifecycleCommandV1Schema.safeParse(rawCommand);
    if (!parsed.success) {
      throw new CommercialProvisioningError(
        400,
        "INVALID_LIFECYCLE_COMMAND",
        parsed.error.issues[0]?.message ?? "Invalid subscription lifecycle command.",
        parsed.error.issues.map((i) => ({ path: i.path.join(".") || "(root)", code: i.code })),
      );
    }

    const command = parsed.data;
    const effectiveAt = new Date(command.effectiveAt);
    const client = await this.provisionerPool.connect();

    try {
      await client.query("BEGIN");

      // Check idempotency replay by idempotency_key or event_id
      const existing = await client.query<{
        id: string;
        action: string;
        subscription_id: string;
        external_order_id: string;
        tenant_id: string | null;
        installation_id: string | null;
        resulting_installation_status: string | null;
        applied: boolean;
        effective_at: Date | string;
        processed_at: Date | string;
      }>(
        `SELECT id::text, action, subscription_id, external_order_id,
                tenant_id::text, installation_id::text, resulting_installation_status,
                applied, effective_at, processed_at
         FROM public.product_subscription_lifecycle_inbox
         WHERE source = 'bazionweb' AND (idempotency_key = $1 OR event_id = $2)
         LIMIT 1
         FOR UPDATE`,
        [command.idempotencyKey, command.eventId],
      );

      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.action !== command.action || row.subscription_id !== command.subscriptionId) {
          throw new CommercialProvisioningError(
            409,
            "LIFECYCLE_IDEMPOTENCY_CONFLICT",
            "Lifecycle idempotency key or eventId was reused with different parameters.",
          );
        }
        const replayEvent = subscriptionLifecycleStatusEventV1Schema.parse({
          schemaVersion: "1.0.0",
          eventType: "product.subscription.lifecycle.status.v1",
          eventId: command.eventId,
          correlationId: command.correlationId,
          occurredAt: new Date().toISOString(),
          source: "bazion-platform",
          lifecycle: {
            schemaVersion: "1.0.0",
            commandId: row.id,
            action: command.action,
            subscriptionId: command.subscriptionId,
            externalOrderId: command.externalOrderId,
            tenantId: row.tenant_id,
            installationId: row.installation_id,
            installationStatus: row.resulting_installation_status as any,
            applied: row.applied,
            reasonCode: command.reasonCode,
            effectiveAt: command.effectiveAt,
            updatedAt: new Date(row.processed_at).toISOString(),
          },
        });
        await client.query("COMMIT");
        return {
          deduplicated: true,
          stale: !row.applied,
          applied: row.applied,
          commandId: row.id,
          action: command.action,
          subscriptionId: command.subscriptionId,
          tenantId: row.tenant_id,
          installationId: row.installation_id,
          installationStatus: row.resulting_installation_status,
          callbackEvent: replayEvent,
        };
      }

      // Check newest applied command timestamp for out-of-order guard
      const latestApplied = await client.query<{ max_effective_at: Date | string | null }>(
        `SELECT MAX(effective_at) AS max_effective_at
         FROM public.product_subscription_lifecycle_inbox
         WHERE subscription_id = $1 AND applied = true`,
        [command.subscriptionId],
      );
      const maxEffectiveRaw = latestApplied.rows[0]?.max_effective_at;
      const isOutOfOrderStale = Boolean(
        maxEffectiveRaw && new Date(maxEffectiveRaw).getTime() > effectiveAt.getTime(),
      );

      // Locate tenant and installation via order (or explicit installationId)
      const opLookup = await client.query<{ tenant_id: string | null; installation_id: string | null }>(
        `SELECT tenant_id::text, installation_id::text
         FROM public.product_provisioning_operations
         WHERE source = 'bazionweb' AND external_order_id = $1
         LIMIT 1`,
        [command.externalOrderId],
      );
      const tenantId = opLookup.rows[0]?.tenant_id ?? null;
      const installationId = command.installationId ?? opLookup.rows[0]?.installation_id ?? null;

      let installationStatus: string | null = null;
      let applied = false;
      let tenantActionNeeded: "suspend" | "restore" | null = null;

      if (tenantId && installationId && !isOutOfOrderStale) {
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const instRes = await client.query<{ id: string; status: string }>(
          `SELECT id::text, status
           FROM public.product_installations
           WHERE id = $1 AND tenant_id = $2
           LIMIT 1
           FOR UPDATE`,
          [installationId, tenantId],
        );
        const installation = instRes.rows[0];

        if (installation) {
          installationStatus = installation.status;

          if (command.action === "activate" || command.action === "reactivate") {
            if (installation.status === "suspended") {
              const updated = await client.query<{ status: string }>(
                `UPDATE public.product_installations
                 SET status = 'ready'
                 WHERE id = $1 AND tenant_id = $2
                 RETURNING status`,
                [installationId, tenantId],
              );
              installationStatus = updated.rows[0]?.status ?? "ready";
              tenantActionNeeded = "restore";
              applied = true;
            } else if (installation.status === "ready") {
              tenantActionNeeded = "restore";
              applied = true;
            }
          } else if (command.action === "grace") {
            // Grace keeps workspace operational while dunning runs in Bazionweb
            applied = true;
          } else if (command.action === "suspend" || command.action === "cancel") {
            if (installation.status === "ready") {
              const updated = await client.query<{ status: string }>(
                `UPDATE public.product_installations
                 SET status = 'suspended',
                     suspended_reason = $3
                 WHERE id = $1 AND tenant_id = $2
                 RETURNING status`,
                [installationId, tenantId, command.reasonCode],
              );
              installationStatus = updated.rows[0]?.status ?? "suspended";
              // Only suspend tenant if no other active/ready installations exist for this tenant
              const remainingReady = await client.query<{ cnt: number }>(
                `SELECT count(*)::int AS cnt
                 FROM public.product_installations
                 WHERE tenant_id = $1 AND status = 'ready'`,
                [tenantId],
              );
              if ((remainingReady.rows[0]?.cnt ?? 0) === 0) {
                tenantActionNeeded = "suspend";
              }
              applied = true;
            } else if (installation.status === "suspended") {
              applied = true;
            }
          }
        }
      }

      const inboxInserted = await client.query<{ id: string; processed_at: Date | string }>(
        `INSERT INTO public.product_subscription_lifecycle_inbox (
           source, event_id, correlation_id, idempotency_key,
           subscription_id, external_customer_id, external_order_id,
           action, reason_code, effective_at, grace_ends_at,
           tenant_id, installation_id, resulting_installation_status, applied
         ) VALUES (
           'bazionweb', $1, $2, $3,
           $4, $5, $6,
           $7, $8, $9, $10,
           $11, $12, $13, $14
         )
         RETURNING id::text, processed_at`,
        [
          command.eventId,
          command.correlationId,
          command.idempotencyKey,
          command.subscriptionId,
          command.externalCustomerId,
          command.externalOrderId,
          command.action,
          command.reasonCode,
          command.effectiveAt,
          command.graceEndsAt ?? null,
          tenantId,
          installationId,
          installationStatus,
          applied,
        ],
      );
      const inboxRow = inboxInserted.rows[0]!;
      const nowIso = new Date().toISOString();
      const callbackEventId = randomUUID();
      const callbackEvent = subscriptionLifecycleStatusEventV1Schema.parse({
        schemaVersion: "1.0.0",
        eventType: "product.subscription.lifecycle.status.v1",
        eventId: callbackEventId,
        correlationId: command.correlationId,
        occurredAt: nowIso,
        source: "bazion-platform",
        lifecycle: {
          schemaVersion: "1.0.0",
          commandId: inboxRow.id,
          action: command.action,
          subscriptionId: command.subscriptionId,
          externalOrderId: command.externalOrderId,
          tenantId,
          installationId,
          installationStatus: installationStatus as any,
          applied,
          reasonCode: command.reasonCode,
          effectiveAt: command.effectiveAt,
          updatedAt: new Date(inboxRow.processed_at).toISOString(),
        },
      });
      const payloadJson = JSON.stringify(callbackEvent);
      const payloadHash = createHash("sha256").update(payloadJson, "utf8").digest("hex");

      await client.query(
        `INSERT INTO public.product_subscription_lifecycle_outbox (
           lifecycle_inbox_id, idempotency_key, event_id, correlation_id,
           destination, payload, payload_hash
         ) VALUES ($1, $2, $3, $4, 'bazionweb', $5::jsonb, $6)`,
        [
          inboxRow.id,
          `sub-lifecycle-status:${inboxRow.id}:${callbackEventId}`,
          callbackEventId,
          command.correlationId,
          payloadJson,
          payloadHash,
        ],
      );

      await client.query("COMMIT");

      if (tenantId && tenantActionNeeded && this.tenantAdapter) {
        await this.tenantAdapter.setTenantStatus(tenantId, tenantActionNeeded).catch(() => undefined);
      }

      await this.auditWriter
        .append({
          actorType: "service",
          actorId: context.actorClientId,
          tenantId,
          action: `commercial.subscription.${command.action}.processed`,
          resourceType: "product_installation",
          resourceId: installationId ?? command.subscriptionId,
          outcome: "succeeded",
          requestId: context.requestId,
          metadata: {
            subscriptionId: command.subscriptionId,
            reasonCode: command.reasonCode,
            applied,
            stale: isOutOfOrderStale,
            resultingStatus: installationStatus,
          },
        })
        .catch(() => undefined);

      return {
        deduplicated: false,
        stale: isOutOfOrderStale,
        applied,
        commandId: inboxRow.id,
        action: command.action,
        subscriptionId: command.subscriptionId,
        tenantId,
        installationId,
        installationStatus,
        callbackEvent,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

import type {
  CommercialPaidOrderSnapshotV1,
  CrossEntityReconciliationReportV1,
  ReconciliationExceptionV1,
} from "@bazion/api-contracts";
import { crossEntityReconciliationReportV1Schema } from "@bazion/api-contracts";
import type { CommercialSqlPool } from "./service.js";
import type { ProvisioningOfferBinding } from "./offer-resolution.js";
import { resolveCorrelationId } from "./observability.js";

interface OperationReconRow {
  id: string;
  external_customer_id: string;
  external_order_id: string;
  offer_id: string;
  offer_version: string;
  product_id: string;
  product_version: string;
  solution_id: string;
  solution_version: string;
  template_id: string;
  template_version: string;
  status: string;
  failure_code: string | null;
  failure_disposition: string | null;
  tenant_id: string | null;
  installation_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
  accepted_at: Date | string;
  updated_at: Date | string;
}

interface InboxReconRow {
  operation_id: string;
  external_order_id: string;
}

interface DeadOutboxRow {
  id: string;
  operation_id?: string | null;
  dead_lettered_at: Date | string | null;
  updated_at: Date | string;
}

interface InstallationReconRow {
  id: string;
  tenant_id: string;
  external_order_id: string;
  distribution_mode: "shared-managed" | "dedicated";
  status: string;
  updated_at: Date | string;
}

interface ArchiveReconRow {
  installation_id: string;
  tenant_id: string;
  retention_expires_at: Date | string;
  archive_purged_at: Date | string | null;
}

interface TenantReconRow {
  id: string;
  status: string;
  updated_at: Date | string;
}

interface EntitlementReconRow {
  tenant_id: string;
  module_id: string;
  enabled: boolean;
}

interface HostingDeploymentReconRow {
  id: string;
  tenant_id: string;
  state: string;
  error_code: string | null;
  updated_at: Date | string;
}

function secondsSince(dateLike: Date | string | null | undefined, nowMs: number): number {
  if (!dateLike) return 0;
  const ts = dateLike instanceof Date ? dateLike.getTime() : Date.parse(dateLike);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.floor((nowMs - ts) / 1000));
}

function isoString(dateLike: Date | string | null | undefined, fallbackIso: string): string {
  if (!dateLike) return fallbackIso;
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return Number.isNaN(date.getTime()) ? fallbackIso : date.toISOString();
}

function requiredModulesForOperation(
  op: OperationReconRow,
  offerBindings: readonly ProvisioningOfferBinding[],
): readonly string[] {
  const binding = offerBindings.find(
    (b) =>
      b.offer.id === op.offer_id
      && b.offer.version === op.offer_version
      && b.composition.product.id === op.product_id
      && b.composition.product.version === op.product_version
      && b.composition.solution.id === op.solution_id
      && b.composition.solution.version === op.solution_version
      && b.composition.template.id === op.template_id
      && b.composition.template.version === op.template_version,
  );
  return binding ? binding.requiredModules.map((m) => m.id) : [];
}

/**
 * Authoritative cross-entity reconciler checking paid orders <-> provisioning operations <->
 * installations <-> module entitlements <-> hosting deployments with owner and age.
 */
export class CrossEntityReconciliationService {
  constructor(
    private readonly provisionerPool: CommercialSqlPool,
    private readonly tenantControlPlanePool: CommercialSqlPool | null = null,
    private readonly offerBindings: readonly ProvisioningOfferBinding[] = [],
  ) {}

  private async fetchAllOperations(): Promise<OperationReconRow[]> {
    const pageSize = 500;
    const maxPages = 20;
    const rows: OperationReconRow[] = [];
    let cursorAcceptedAt: Date | string | null = null;
    let cursorId: string | null = null;

    for (let page = 0; page < maxPages; page += 1) {
      const res: { rows: OperationReconRow[] } = cursorAcceptedAt && cursorId
        ? await this.provisionerPool.query<OperationReconRow>(
            `SELECT id::text, external_customer_id, external_order_id, offer_id, offer_version,
                    product_id, product_version, solution_id, solution_version, template_id, template_version,
                    status, failure_code, failure_disposition, tenant_id::text, installation_id::text,
                    lease_token::text, lease_expires_at, accepted_at, updated_at
               FROM public.product_provisioning_operations
              WHERE (accepted_at, id) < ($1::timestamptz, $2::uuid)
              ORDER BY accepted_at DESC, id DESC
              LIMIT $3`,
            [cursorAcceptedAt, cursorId, pageSize],
          )
        : await this.provisionerPool.query<OperationReconRow>(
            `SELECT id::text, external_customer_id, external_order_id, offer_id, offer_version,
                    product_id, product_version, solution_id, solution_version, template_id, template_version,
                    status, failure_code, failure_disposition, tenant_id::text, installation_id::text,
                    lease_token::text, lease_expires_at, accepted_at, updated_at
               FROM public.product_provisioning_operations
              ORDER BY accepted_at DESC, id DESC
              LIMIT $1`,
            [pageSize],
          );

      rows.push(...res.rows);
      if (res.rows.length < pageSize) break;
      const last: OperationReconRow = res.rows[res.rows.length - 1]!;
      cursorAcceptedAt = last.accepted_at;
      cursorId = last.id;
    }
    return rows;
  }

  private async fetchDeadOutbox(
    table: "public.product_provisioning_status_outbox" | "public.product_subscription_lifecycle_outbox",
    selectOperationId: boolean,
  ): Promise<DeadOutboxRow[]> {
    const pageSize = 200;
    const maxPages = 10;
    const rows: DeadOutboxRow[] = [];
    let cursorUpdatedAt: Date | string | null = null;
    let cursorId: string | null = null;
    const opColumn = selectOperationId ? "operation_id::text" : "NULL::text AS operation_id";

    for (let page = 0; page < maxPages; page += 1) {
      const res: { rows: DeadOutboxRow[] } = cursorUpdatedAt && cursorId
        ? await this.provisionerPool.query<DeadOutboxRow>(
            `SELECT id::text, ${opColumn}, dead_lettered_at, updated_at
               FROM ${table}
              WHERE status = 'dead'
                AND (updated_at, id) < ($1::timestamptz, $2::uuid)
              ORDER BY updated_at DESC, id DESC
              LIMIT $3`,
            [cursorUpdatedAt, cursorId, pageSize],
          )
        : await this.provisionerPool.query<DeadOutboxRow>(
            `SELECT id::text, ${opColumn}, dead_lettered_at, updated_at
               FROM ${table}
              WHERE status = 'dead'
              ORDER BY updated_at DESC, id DESC
              LIMIT $1`,
            [pageSize],
          );
      rows.push(...res.rows);
      if (res.rows.length < pageSize) break;
      const last: DeadOutboxRow = res.rows[res.rows.length - 1]!;
      cursorUpdatedAt = last.updated_at;
      cursorId = last.id;
    }
    return rows;
  }

  async reconcile(
    paidOrders: readonly CommercialPaidOrderSnapshotV1[] = [],
    correlationId?: string,
  ): Promise<CrossEntityReconciliationReportV1> {
    const now = new Date();
    const nowMs = now.getTime();
    const nowIso = now.toISOString();
    const resolvedCorrelationId = resolveCorrelationId(correlationId);

    const [operations, inboxRes, statusDeadRows, lifecycleDeadRows] = await Promise.all([
      this.fetchAllOperations(),
      this.provisionerPool.query<InboxReconRow>(
        `SELECT operation_id::text, external_order_id
           FROM public.product_provisioning_inbox`,
      ),
      this.fetchDeadOutbox("public.product_provisioning_status_outbox", true),
      this.fetchDeadOutbox("public.product_subscription_lifecycle_outbox", false),
    ]);

    const statusDeadRes = { rows: statusDeadRows };
    const lifecycleDeadRes = { rows: lifecycleDeadRows };
    const inboxByOperationId = new Set(inboxRes.rows.map((r) => r.operation_id));

    // Collect tenant IDs and installations respecting FORCE ROW LEVEL SECURITY on product_installations.
    let tenants: TenantReconRow[] = [];
    let entitlements: EntitlementReconRow[] = [];
    let hostingDeployments: HostingDeploymentReconRow[] = [];
    let hostingAvailable = false;

    if (this.tenantControlPlanePool) {
      const [tenantsRes, entRes, hostRes] = await Promise.all([
        this.tenantControlPlanePool.query<TenantReconRow>(
          `SELECT id::text, status, updated_at FROM public.tenants`,
        ),
        this.tenantControlPlanePool.query<EntitlementReconRow>(
          `SELECT tenant_id::text, module_id, enabled FROM public.tenant_module_entitlements`,
        ),
        this.tenantControlPlanePool.query<HostingDeploymentReconRow>(
          `SELECT id::text, tenant_id::text, state, error_code, updated_at FROM public.tenant_hosting_deployments`,
        ).catch(() => ({ rows: null as HostingDeploymentReconRow[] | null, rowCount: 0 })),
      ]);
      tenants = tenantsRes.rows;
      entitlements = entRes.rows;
      if (hostRes.rows !== null) {
        hostingDeployments = hostRes.rows;
        hostingAvailable = true;
      }
    }
    if (!hostingAvailable) {
      const provisionerHostRes = await this.provisionerPool.query<HostingDeploymentReconRow>(
        `SELECT id::text, tenant_id::text, state, error_code, updated_at FROM public.tenant_hosting_deployments`,
      ).catch(() => ({ rows: null as HostingDeploymentReconRow[] | null, rowCount: 0 }));
      if (provisionerHostRes.rows !== null) {
        hostingDeployments = provisionerHostRes.rows;
        hostingAvailable = true;
      }
    }

    const tenantIds = new Set<string>();
    for (const op of operations) {
      if (op.tenant_id) tenantIds.add(op.tenant_id);
    }
    for (const t of tenants) {
      tenantIds.add(t.id);
    }

    const { installations, archives } = await this.loadTenantScopedRecords(Array.from(tenantIds));
    const archiveByInstallationId = new Map(archives.map((r) => [r.installation_id, r]));
    const installationById = new Map(installations.map((i) => [i.id, i]));
    const installationByOrderId = new Map(installations.map((i) => [i.external_order_id, i]));
    const operationById = new Map(operations.map((o) => [o.id, o]));
    const operationByOrderId = new Map(operations.map((o) => [o.external_order_id, o]));
    const tenantById = new Map(tenants.map((t) => [t.id, t]));

    const entitlementsByTenant = new Map<string, Map<string, boolean>>();
    for (const row of entitlements) {
      let map = entitlementsByTenant.get(row.tenant_id);
      if (!map) {
        map = new Map<string, boolean>();
        entitlementsByTenant.set(row.tenant_id, map);
      }
      map.set(row.module_id, row.enabled);
    }

    const deploymentsByTenant = new Map<string, HostingDeploymentReconRow[]>();
    for (const dep of hostingDeployments) {
      const list = deploymentsByTenant.get(dep.tenant_id) ?? [];
      list.push(dep);
      deploymentsByTenant.set(dep.tenant_id, list);
    }

    const exceptions: ReconciliationExceptionV1[] = [];

    // 1. Operations vs Inbox, Stale Leases, and compensation_required.
    for (const op of operations) {
      if (!inboxByOperationId.has(op.id)) {
        exceptions.push({
          id: `operation_inbox_mismatch:${op.id}`,
          mismatchType: "operation_inbox_mismatch",
          severity: "high",
          owner: "platform_ops",
          ageSeconds: secondsSince(op.accepted_at, nowMs),
          detectedAt: nowIso,
          entityRefs: { externalOrderId: op.external_order_id, operationId: op.id },
          summary: "Provisioning operation is missing a matching durable inbox receipt.",
          recommendedAction: "Inspect provisioning inbox audit records and verify command idempotency.",
        });
      }

      if (op.status === "compensation_required") {
        exceptions.push({
          id: `compensation_required:${op.id}`,
          mismatchType: "compensation_required_pending",
          severity: "critical",
          owner: "platform_ops",
          ageSeconds: secondsSince(op.updated_at, nowMs),
          detectedAt: nowIso,
          entityRefs: {
            externalOrderId: op.external_order_id,
            operationId: op.id,
            tenantId: op.tenant_id,
            installationId: op.installation_id,
          },
          summary: `Operation is halted in compensation_required (${op.failure_code ?? "AMBIGUOUS_FAILURE"}).`,
          recommendedAction: "Inspect step attempts and external state, then run manual-review or compensate.",
        });
      }

      if (op.lease_token && op.lease_expires_at && Date.parse(String(op.lease_expires_at)) <= nowMs) {
        exceptions.push({
          id: `stale_lease:${op.id}`,
          mismatchType: "stale_operation_lease",
          severity: "high",
          owner: "platform_ops",
          ageSeconds: secondsSince(op.lease_expires_at, nowMs),
          detectedAt: nowIso,
          entityRefs: { externalOrderId: op.external_order_id, operationId: op.id, tenantId: op.tenant_id },
          summary: "Operation worker lease expired without releasing cleanly.",
          recommendedAction: "Ensure saga worker is running or invoke audited resume on the stalled operation.",
        });
      }

      if (op.status === "ready") {
        const inst = op.installation_id ? installationById.get(op.installation_id) : installationByOrderId.get(op.external_order_id);
        if (!inst) {
          exceptions.push({
            id: `ready_missing_installation:${op.id}`,
            mismatchType: "ready_operation_missing_installation",
            severity: "critical",
            owner: "platform_ops",
            ageSeconds: secondsSince(op.updated_at, nowMs),
            detectedAt: nowIso,
            entityRefs: { externalOrderId: op.external_order_id, operationId: op.id, tenantId: op.tenant_id },
            summary: "Ready provisioning operation has no visible product_installations record.",
            recommendedAction: "Reconcile operation tenant attachment and installation row before customer onboarding.",
          });
        } else {
          // Verify required module entitlements when tenant control-plane pool is available.
          if (this.tenantControlPlanePool) {
            const tenantEntitlements = entitlementsByTenant.get(inst.tenant_id);
            const requiredMods = requiredModulesForOperation(op, this.offerBindings);
            for (const moduleId of requiredMods) {
              const enabled = tenantEntitlements?.get(moduleId);
              if (inst.status === "ready" && enabled !== true) {
                exceptions.push({
                  id: `missing_entitlement:${inst.id}:${moduleId}`,
                  mismatchType: enabled === false ? "entitlement_mismatch" : "installation_missing_module_entitlements",
                  severity: "high",
                  owner: "platform_ops",
                  ageSeconds: secondsSince(inst.updated_at, nowMs),
                  detectedAt: nowIso,
                  entityRefs: {
                    externalOrderId: op.external_order_id,
                    operationId: op.id,
                    tenantId: inst.tenant_id,
                    installationId: inst.id,
                    moduleId,
                  },
                  summary: `Ready installation is missing enabled module entitlement "${moduleId}".`,
                  recommendedAction: "Re-apply installation configuration or reconcile tenant module entitlements.",
                });
              }
            }
          }
        }
      }
    }

    // 2. Installations <-> Tenants <-> Hosting Deployments <-> Archives.
    for (const inst of installations) {
      const tenant = tenantById.get(inst.tenant_id);
      if (tenant) {
        const tenantSuspended = tenant.status === "suspended";
        const tenantClosed = tenant.status === "closed";
        if ((inst.status === "ready" && (tenantSuspended || tenantClosed))
          || (inst.status === "suspended" && tenant.status === "active")) {
          exceptions.push({
            id: `tenant_installation_drift:${inst.id}`,
            mismatchType: "tenant_status_drift",
            severity: "high",
            owner: "platform_ops",
            ageSeconds: secondsSince(inst.updated_at, nowMs),
            detectedAt: nowIso,
            entityRefs: {
              externalOrderId: inst.external_order_id,
              tenantId: inst.tenant_id,
              installationId: inst.id,
            },
            summary: `Installation status (${inst.status}) diverges from tenant status (${tenant.status}).`,
            recommendedAction: "Reconcile subscription lifecycle state between installation and tenant registry.",
          });
        }
      }

      if (hostingAvailable) {
        const deps = deploymentsByTenant.get(inst.tenant_id) ?? [];
        if (inst.distribution_mode === "shared-managed" && deps.length > 0) {
          for (const dep of deps) {
            exceptions.push({
              id: `shared_managed_unexpected_hosting:${inst.id}:${dep.id}`,
              mismatchType: "shared_managed_unexpected_hosting_deployment",
              severity: "critical",
              owner: "hosting_control",
              ageSeconds: secondsSince(dep.updated_at, nowMs),
              detectedAt: nowIso,
              entityRefs: {
                externalOrderId: inst.external_order_id,
                tenantId: inst.tenant_id,
                installationId: inst.id,
                deploymentId: dep.id,
              },
              summary: "Shared-managed installation unexpectedly owns a tenant_hosting_deployments record.",
              recommendedAction: "Verify pilot/routing isolation; remove stray Dokploy/hosting mutation if erroneous.",
            });
          }
        } else if (inst.distribution_mode === "dedicated" && inst.status === "ready") {
          const activeDep = deps.find((d) => d.state === "ready" || d.state === "running");
          if (deps.length === 0) {
            exceptions.push({
              id: `dedicated_missing_hosting:${inst.id}`,
              mismatchType: "dedicated_installation_missing_hosting_deployment",
              severity: "critical",
              owner: "hosting_control",
              ageSeconds: secondsSince(inst.updated_at, nowMs),
              detectedAt: nowIso,
              entityRefs: {
                externalOrderId: inst.external_order_id,
                tenantId: inst.tenant_id,
                installationId: inst.id,
              },
              summary: "Ready dedicated installation has no tenant_hosting_deployments record.",
              recommendedAction: "Run hosting provisioning reconciliation and attach or recover the provider deployment.",
            });
          } else if (!activeDep) {
            const problematic = deps[0]!;
            exceptions.push({
              id: `dedicated_hosting_drift:${inst.id}:${problematic.id}`,
              mismatchType: "hosting_deployment_state_drift",
              severity: "high",
              owner: "hosting_control",
              ageSeconds: secondsSince(problematic.updated_at, nowMs),
              detectedAt: nowIso,
              entityRefs: {
                externalOrderId: inst.external_order_id,
                tenantId: inst.tenant_id,
                installationId: inst.id,
                deploymentId: problematic.id,
              },
              summary: `Dedicated installation is ready but hosting deployment is in state "${problematic.state}".`,
              recommendedAction: "Inspect Dokploy/hosting reconciler health and run hosting deployment recovery.",
            });
          }
        }
      }

      if (inst.status === "offboarded" && !archiveByInstallationId.has(inst.id)) {
        exceptions.push({
          id: `offboarded_missing_archive:${inst.id}`,
          mismatchType: "offboarded_installation_missing_archive",
          severity: "medium",
          owner: "customer_support",
          ageSeconds: secondsSince(inst.updated_at, nowMs),
          detectedAt: nowIso,
          entityRefs: {
            externalOrderId: inst.external_order_id,
            tenantId: inst.tenant_id,
            installationId: inst.id,
          },
          summary: "Offboarded installation has no archive manifest record.",
          recommendedAction: "Verify offboarding completion and confirm whether retention window already purged.",
        });
      }
    }

    // 3. Dead-letter outbox entries.
    for (const row of statusDeadRes.rows) {
      exceptions.push({
        id: `status_outbox_dead:${row.id}`,
        mismatchType: "outbox_dead_letter",
        severity: "critical",
        owner: "platform_ops",
        ageSeconds: secondsSince(row.dead_lettered_at ?? row.updated_at, nowMs),
        detectedAt: isoString(row.dead_lettered_at ?? row.updated_at, nowIso),
        entityRefs: { operationId: row.operation_id ?? null, outboxId: row.id },
        summary: "Commercial provisioning status outbox entry moved to dead-letter.",
        recommendedAction: "Check Bazionweb callback endpoint health and replay the status outbox item.",
      });
    }

    for (const row of lifecycleDeadRes.rows) {
      exceptions.push({
        id: `lifecycle_outbox_dead:${row.id}`,
        mismatchType: "lifecycle_outbox_dead_letter",
        severity: "critical",
        owner: "platform_ops",
        ageSeconds: secondsSince(row.dead_lettered_at ?? row.updated_at, nowMs),
        detectedAt: isoString(row.dead_lettered_at ?? row.updated_at, nowIso),
        entityRefs: { outboxId: row.id },
        summary: "Subscription lifecycle callback outbox entry moved to dead-letter.",
        recommendedAction: "Inspect lifecycle webhook receiver and replay the lifecycle outbox item.",
      });
    }

    // 4. Paid commercial orders <-> Platform Operations (five-way / dual-read reconciliation).
    for (const order of paidOrders) {
      if (order.paymentStatus !== "paid") continue;
      const op = order.operationId
        ? operationById.get(order.operationId) ?? operationByOrderId.get(order.externalOrderId)
        : operationByOrderId.get(order.externalOrderId);

      if (!op) {
        exceptions.push({
          id: `paid_order_missing_operation:${order.externalOrderId}`,
          mismatchType: "paid_order_missing_operation",
          severity: "critical",
          owner: "commercial_billing",
          ageSeconds: secondsSince(order.paidAt, nowMs),
          detectedAt: nowIso,
          entityRefs: { externalOrderId: order.externalOrderId, operationId: order.operationId ?? null },
          summary: "Paid commercial order has no corresponding platform provisioning operation.",
          recommendedAction: "Trigger provisioning outbox dispatch/replay from Bazionweb commercial billing.",
        });
        continue;
      }

      if (order.provisioningStatus !== op.status) {
        exceptions.push({
          id: `order_op_status_drift:${order.externalOrderId}`,
          mismatchType: "operation_order_status_drift",
          severity: op.status === "compensation_required" || op.status === "failed" ? "critical" : "high",
          owner: "commercial_billing",
          ageSeconds: secondsSince(op.updated_at, nowMs),
          detectedAt: nowIso,
          entityRefs: {
            externalOrderId: order.externalOrderId,
            operationId: op.id,
            tenantId: op.tenant_id,
            installationId: op.installation_id,
          },
          summary: `Commercial projection "${order.provisioningStatus}" lags behind platform operation "${op.status}".`,
          recommendedAction: "Replay pending status callbacks or trigger manual commercial status sync.",
        });
      }

      if (order.legacyFallbackUsed && order.legacyTenantId && op.tenant_id && order.legacyTenantId !== op.tenant_id) {
        exceptions.push({
          id: `dual_read_legacy_mismatch:${order.externalOrderId}`,
          mismatchType: "dual_read_legacy_mismatch",
          severity: "high",
          owner: "platform_ops",
          ageSeconds: secondsSince(op.updated_at, nowMs),
          detectedAt: nowIso,
          entityRefs: {
            externalOrderId: order.externalOrderId,
            operationId: op.id,
            tenantId: op.tenant_id,
          },
          summary: "Dual-read parity check detected divergent legacy vs platform tenant assignment.",
          recommendedAction: "Freeze legacy fallback for this order and reconcile authoritative tenant ownership.",
        });
      }
    }

    if (paidOrders.length > 0) {
      const paidOrderIds = new Set(paidOrders.map((o) => o.externalOrderId));
      for (const op of operations) {
        if (!paidOrderIds.has(op.external_order_id) && op.status !== "compensated") {
          exceptions.push({
            id: `op_missing_paid_order:${op.external_order_id}`,
            mismatchType: "operation_missing_paid_order",
            severity: "high",
            owner: "commercial_billing",
            ageSeconds: secondsSince(op.accepted_at, nowMs),
            detectedAt: nowIso,
            entityRefs: { externalOrderId: op.external_order_id, operationId: op.id, tenantId: op.tenant_id },
            summary: "Platform provisioning operation has no matching paid order in commercial snapshot.",
            recommendedAction: "Confirm commercial order state in Bazionweb billing and compensate if refunded/invalid.",
          });
        }
      }
    }

    const criticalExceptions = exceptions.filter((e) => e.severity === "critical").length;

    return crossEntityReconciliationReportV1Schema.parse({
      schemaVersion: "1.0.0",
      generatedAt: nowIso,
      scope: paidOrders.length > 0 ? "cross_repo_five_way" : "platform_only",
      correlationId: resolvedCorrelationId,
      summary: {
        ordersChecked: paidOrders.length,
        operationsChecked: operations.length,
        installationsChecked: installations.length,
        entitlementsChecked: entitlements.length,
        deploymentsChecked: hostingDeployments.length,
        totalExceptions: exceptions.length,
        criticalExceptions,
        unresolvedDriftCount: exceptions.length,
      },
      exceptions,
    });
  }

  private async loadTenantScopedRecords(tenantIds: readonly string[]): Promise<{
    installations: InstallationReconRow[];
    archives: ArchiveReconRow[];
  }> {
    if (tenantIds.length === 0) return { installations: [], archives: [] };
    const installations: InstallationReconRow[] = [];
    const archives: ArchiveReconRow[] = [];
    const client = await this.provisionerPool.connect();
    try {
      for (const tenantId of tenantIds) {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
        const [instRes, archRes] = await Promise.all([
          client.query<InstallationReconRow>(
            `SELECT id::text, tenant_id::text, external_order_id, distribution_mode, status, updated_at
               FROM public.product_installations
              WHERE tenant_id = $1`,
            [tenantId],
          ),
          client.query<ArchiveReconRow>(
            `SELECT installation_id::text, tenant_id::text, retention_expires_at, archive_purged_at
               FROM public.installation_offboarding_archives
              WHERE tenant_id = $1`,
            [tenantId],
          ),
        ]);
        await client.query("COMMIT");
        installations.push(...instRes.rows);
        archives.push(...archRes.rows);
      }
      return { installations, archives };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

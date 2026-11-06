import type { FastifyInstance, FastifyRequest } from "fastify";
import { isIP } from "node:net";
import { PostgresAuditEventWriter, type AuditEvent } from "@bazion/audit";
import { fromNodeHeaders } from "better-auth/node";
import { count, eq } from "drizzle-orm";
import { requireActiveTenantPermission, requirePlatformRole, requirePlatformPermission, normalizeTenantHostname, type ActiveTenantContext } from "@bazion/auth";
import { auth, reconcileProvisioningTenants, listPlatformTenants, getPlatformTenant, transitionPlatformTenant, transferPlatformTenantOwner, listPlatformTenantOwnerCandidates, getPlatformTenantModuleEntitlements, updatePlatformTenantModuleEntitlement, getPlatformTenantSettings, updatePlatformTenantSettings, countPlatformTenantMembers, listPlatformTenantDomains, createPlatformTenantDomain, getPlatformTenantDomainChallenge, activatePlatformTenantDomain, disablePlatformTenantDomain } from "@bazion/auth/server";
import { orders, products } from "@bazion/database";
import { invitationInputSchema, memberListQuerySchema, memberRoleInputSchema, provisioningReconciliationInputSchema, platformTenantListQuerySchema, platformTenantLifecycleInputSchema, platformTenantOwnerTransferInputSchema, platformTenantOwnerCandidatesQuerySchema, platformTenantModuleInputSchema, platformTenantSettingsInputSchema, platformTenantAuditQuerySchema } from "./policy.js";
import { pool, withTenantTransaction } from "../../lib/database.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { getPlatformModule, platformModuleCatalog } from "./module-catalog.js";
import { platformTenantDomainInputSchema } from "./policy.js";
import { verifyTenantDomainTxt } from "./domain-verification.js";

const auditWriter = new PostgresAuditEventWriter(pool);

async function withAudit<T>(
  request: FastifyRequest,
  event: Omit<AuditEvent, "action" | "outcome"> & { action: string },
  operation: () => Promise<T>,
): Promise<T> {
  // Fail closed before the protected operation if the audit store cannot accept
  // the intent record. Never place contact details, credentials or one-time URLs
  // in audit metadata.
  await auditWriter.append({ ...event, action: `${event.action}.requested`, outcome: "succeeded" });
  try {
    const result = await operation();
    try {
      await auditWriter.append({ ...event, action: `${event.action}.completed`, outcome: "succeeded" });
    } catch (auditError) {
      request.log.error({
        auditAction: event.action,
        errorType: auditError instanceof Error ? auditError.name : "UnknownError",
      }, "Audit completion event could not be persisted");
    }
    return result;
  } catch (error) {
    try {
      await auditWriter.append({ ...event, action: `${event.action}.failed`, outcome: "failed" });
    } catch (auditError) {
      request.log.error({
        auditAction: event.action,
        errorType: auditError instanceof Error ? auditError.name : "UnknownError",
      }, "Audit failure event could not be persisted");
    }
    throw error;
  }
}

function userAuditEvent(
  request: FastifyRequest,
  actor: { userId: string; role: string },
  resourceType: string,
  resourceId?: string | null,
  metadata?: Record<string, string | number | boolean | null>,
) {
  return {
    actorType: "user" as const,
    actorId: actor.userId,
    actorRole: actor.role,
    resourceType,
    ...(resourceId === undefined ? {} : { resourceId }),
    requestId: request.id,
    ...(metadata ? { metadata } : {}),
  };
}

function authHeaders(request: FastifyRequest) {
  return fromNodeHeaders(request.headers);
}

async function requirePermission(
  request: FastifyRequest,
  permissions: Parameters<typeof requireActiveTenantPermission>[1],
): Promise<ActiveTenantContext> {
  const context = await requireActiveTenantPermission(request.headers, permissions);
  if ("analytics" in permissions && !(await isTenantModuleEnabled(context.tenantId, "analytics"))) {
    throw Object.assign(new Error("The analytics module is disabled for this tenant."), {
      statusCode: 404, code: "TENANT_MODULE_DISABLED",
    });
  }
  return context;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Platform-level recovery operation. Client tenant roles cannot invoke it.
  app.post("/admin/platform/tenants/reconcile-provisioning", async (request, reply) => {
    const parsed = provisioningReconciliationInputSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const operator = await requirePlatformRole(request.headers, ["platform_owner", "platform_admin"]);
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "tenant_registry", null, parsed.data),
        action: "tenant.provisioning.reconciliation",
        tenantId: null,
      },
      () => reconcileProvisioningTenants(parsed.data),
    );
    request.log.info({
      actorUserId: operator.userId,
      scanned: result.scanned,
      activated: result.activated,
      unmatched: result.unmatched.length,
      conflicted: result.conflicted.length,
    }, "Tenant provisioning reconciliation completed");
    return reply.send(result);
  });


  // Platform tenant directory. Query filters are validated and tenant IDs are
  // never accepted as authority; every operation is guarded by a platform permission.
  app.get("/admin/platform/tenants", async (request, reply) => {
    const parsed = platformTenantListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    await requirePlatformPermission(request.headers, "tenant.list");
    return reply.send(await listPlatformTenants(parsed.data));
  });


  app.get<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    await requirePlatformPermission(request.headers, "tenant.read");
    const tenant = await getPlatformTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    return reply.send({ tenant });
  });

  app.get<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/domains", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    await requirePlatformPermission(request.headers, "tenant.domain.verify");
    const tenant = await getPlatformTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    return reply.send({ items: await listPlatformTenantDomains(tenantId) });
  });

  app.post<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/domains", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    const parsed = platformTenantDomainInputSchema.safeParse(request.body);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    }
    const hostname = normalizeTenantHostname(parsed.data.hostname);
    if (!hostname || !hostname.includes(".") || isIP(hostname)) {
      return reply.code(400).send({ error: "INVALID_HOSTNAME", message: "Enter a fully qualified DNS hostname, not an IP address or local hostname." });
    }
    const operator = await requirePlatformPermission(request.headers, "tenant.domain.verify");
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "tenant_domain", null, { hostname }),
        action: "tenant.domain.challenge.created",
        tenantId,
      },
      () => createPlatformTenantDomain(tenantId, hostname),
    );
    if (result.kind === "tenant_not_active") {
      return reply.code(409).send({ error: "TENANT_NOT_ACTIVE", message: "Custom domains can only be added to active tenants." });
    }
    if (result.kind === "hostname_conflict") {
      return reply.code(409).send({ error: "DOMAIN_ALREADY_CLAIMED", message: "This hostname is already active or belongs to another tenant." });
    }
    return reply.code(201).send(result.value);
  });

  app.post<{ Params: { tenantId: string; domainId: string } }>(
    "/admin/platform/tenants/:tenantId/domains/:domainId/verify",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      const domainId = request.params.domainId.trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(domainId)) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }
      const operator = await requirePlatformPermission(request.headers, "tenant.domain.verify");
      const challenge = await getPlatformTenantDomainChallenge(tenantId, domainId);
      if (!challenge) return reply.code(404).send({ error: "DOMAIN_CHALLENGE_NOT_FOUND" });
      if (challenge.status !== "pending") {
        return reply.code(409).send({ error: "DOMAIN_NOT_PENDING", message: "Only pending domain challenges can be verified." });
      }
      try {
        const domain = await withAudit(
          request,
          {
            ...userAuditEvent(request, operator, "tenant_domain", domainId, { hostname: challenge.hostname }),
            action: "tenant.domain.verification",
            tenantId,
          },
          async () => {
            const verified = await verifyTenantDomainTxt(challenge.hostname, challenge.verificationTokenHash);
            if (!verified) {
              throw Object.assign(new Error("The expected DNS TXT record was not found."), {
                statusCode: 409, code: "DOMAIN_VERIFICATION_PENDING",
              });
            }
            const activated = await activatePlatformTenantDomain(tenantId, domainId, challenge.verificationTokenHash);
            if (!activated) {
              throw Object.assign(new Error("The challenge changed or the tenant is no longer active."), {
                statusCode: 409, code: "DOMAIN_VERIFICATION_CONFLICT",
              });
            }
            return activated;
          },
        );
        return reply.send({ domain });
      } catch (error) {
        if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
          const code = "code" in error && typeof error.code === "string" ? error.code : "DOMAIN_VERIFICATION_FAILED";
          const message = error instanceof Error ? error.message : "Domain verification failed.";
          return reply.code(error.statusCode).send({ error: code, message });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { tenantId: string; domainId: string } }>(
    "/admin/platform/tenants/:tenantId/domains/:domainId/disable",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      const domainId = request.params.domainId.trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(domainId)) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }
      const operator = await requirePlatformPermission(request.headers, "tenant.domain.verify");
      const existing = (await listPlatformTenantDomains(tenantId)).find((item) => item.id === domainId);
      if (!existing) return reply.code(404).send({ error: "TENANT_DOMAIN_NOT_FOUND" });
      if (existing.status === "disabled") return reply.code(409).send({ error: "TENANT_DOMAIN_ALREADY_DISABLED" });
      const result = await withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_domain", domainId, { hostname: existing.hostname }),
          action: "tenant.domain.disabled",
          tenantId,
        },
        () => disablePlatformTenantDomain(tenantId, domainId),
      );
      if (!result) return reply.code(409).send({ error: "TENANT_DOMAIN_DISABLE_CONFLICT" });
      return reply.send({ domain: result });
    },
  );

  app.post<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/owner", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    const parsed = platformTenantOwnerTransferInputSchema.safeParse(request.body);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    }
    const operator = await requirePlatformPermission(request.headers, "tenant.owner.assign");
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "tenant_owner", tenantId, { targetUserId: parsed.data.targetUserId }),
        action: "tenant.owner.assignment",
        tenantId,
      },
      () => transferPlatformTenantOwner(tenantId, parsed.data.targetUserId),
    );
    if (!result) {
      return reply.code(409).send({
        error: "TENANT_OWNER_TRANSFER_CONFLICT",
        message: "The tenant must have zero or one current owner, and the target must be a different existing tenant member. Closed or unmapped tenants cannot be assigned.",
      });
    }
    return reply.send({ transfer: result });
  });


  app.get<{ Params: { tenantId: string }; Querystring: { limit?: string; offset?: string; q?: string } }>(
    "/admin/platform/tenants/:tenantId/owner-candidates",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      const parsed = platformTenantOwnerCandidatesQuerySchema.safeParse(request.query);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
        return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
      }
      await requirePlatformPermission(request.headers, "tenant.owner.assign");
      const result = await listPlatformTenantOwnerCandidates(tenantId, { limit: parsed.data.limit, offset: parsed.data.offset, ...(parsed.data.q === undefined ? {} : { query: parsed.data.q }) });
      if (!result) return reply.code(404).send({ error: "TENANT_NOT_FOUND_OR_NOT_ASSIGNABLE" });
      return reply.send(result);
    },
  );

  app.get("/admin/platform/modules", async (request, reply) => {
    await requirePlatformPermission(request.headers, "module.catalog.read");
    return reply.send({ modules: platformModuleCatalog });
  });

  app.get<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/modules", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    await requirePlatformPermission(request.headers, "module.catalog.read");
    const tenant = await getPlatformTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    const overrides = await getPlatformTenantModuleEntitlements(tenantId);
    const overrideMap = new Map(overrides.map((item) => [item.module_id, item]));
    return reply.send({
      modules: platformModuleCatalog.map((item) => {
        const override = overrideMap.get(item.id);
        return {
          ...item,
          enabled: override?.enabled ?? item.defaultEnabled,
          isOverride: Boolean(override),
          updatedAt: override?.updated_at ?? null,
          canManage: item.tenantAssignable && !item.required && ["partial", "stable"].includes(item.status),
        };
      }),
    });
  });

  app.put<{ Params: { tenantId: string; moduleId: string } }>(
    "/admin/platform/tenants/:tenantId/modules/:moduleId",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      const moduleId = request.params.moduleId.trim();
      const parsed = platformTenantModuleInputSchema.safeParse(request.body);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)
        || !/^[a-z][a-z0-9-]{1,63}$/.test(moduleId) || !parsed.success) {
        return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
      }
      const operator = await requirePlatformPermission(request.headers, "tenant.modules.update");
      const module = getPlatformModule(moduleId);
      if (!module) return reply.code(404).send({ error: "MODULE_NOT_FOUND" });
      if (!module.tenantAssignable || module.required || !["partial", "stable"].includes(module.status)) {
        return reply.code(409).send({ error: "MODULE_NOT_TENANT_MANAGEABLE", message: "This module is required, platform-owned, or not yet available for activation." });
      }
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      const overrides = await getPlatformTenantModuleEntitlements(tenantId);
      const enabledById = new Map<string, boolean>(platformModuleCatalog.map((item) => [
        item.id,
        overrides.find((override) => override.module_id === item.id)?.enabled ?? item.defaultEnabled,
      ] as const));
      if (parsed.data.enabled) {
        const missing = module.dependencies.filter((dependency) => !enabledById.get(dependency));
        if (missing.length) return reply.code(409).send({ error: "MODULE_DEPENDENCY_DISABLED", dependencies: missing });
      } else {
        const dependents = platformModuleCatalog
          .filter((item) => item.dependencies.includes(moduleId) && (enabledById.get(item.id) ?? item.defaultEnabled))
          .map((item) => item.id);
        if (dependents.length) return reply.code(409).send({ error: "MODULE_HAS_ENABLED_DEPENDENTS", dependents });
      }
      try {
        const result = await withAudit(
          request,
          {
            ...userAuditEvent(request, operator, "tenant_module_entitlement", `${tenantId}:${moduleId}`, {
              moduleId, enabled: parsed.data.enabled,
            }),
            action: "tenant.module.entitlement.updated",
            tenantId,
          },
          async () => {
            const updated = await updatePlatformTenantModuleEntitlement({
              tenantId, moduleId, enabled: parsed.data.enabled, actorUserId: operator.userId,
            });
            if (!updated) throw Object.assign(new Error("Tenant cannot accept module changes."), { code: "MODULE_UPDATE_CONFLICT" });
            return updated;
          },
        );
        return reply.send({ entitlement: result });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "MODULE_UPDATE_CONFLICT") {
          return reply.code(409).send({ error: "MODULE_UPDATE_CONFLICT" });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/settings", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    await requirePlatformPermission(request.headers, "tenant.settings.read");
    const settings = await getPlatformTenantSettings(tenantId);
    if (!settings) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    return reply.send(settings);
  });

  app.patch<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/settings", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    const parsed = platformTenantSettingsInputSchema.safeParse(request.body);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    }
    const operator = await requirePlatformPermission(request.headers, "tenant.settings.update");
    try {
      const updated = await withAudit(
        request,
        {
          ...userAuditEvent(request, operator, "tenant_settings", tenantId, {
            changedKeys: Object.keys(parsed.data.settings).sort().join(","),
            expectedVersion: parsed.data.expectedVersion,
          }),
          action: "tenant.settings.updated",
          tenantId,
        },
        async () => {
          const result = await updatePlatformTenantSettings({
            tenantId,
            expectedVersion: parsed.data.expectedVersion,
            settings: {
              ...(parsed.data.settings.locale === undefined ? {} : { locale: parsed.data.settings.locale }),
              ...(parsed.data.settings.timeZone === undefined ? {} : { timeZone: parsed.data.settings.timeZone }),
              ...(parsed.data.settings.defaultCurrency === undefined ? {} : { defaultCurrency: parsed.data.settings.defaultCurrency }),
              ...(parsed.data.settings.brandName === undefined ? {} : { brandName: parsed.data.settings.brandName }),
              ...(parsed.data.settings.primaryColor === undefined ? {} : { primaryColor: parsed.data.settings.primaryColor }),
              ...(parsed.data.settings.supportEmail === undefined ? {} : { supportEmail: parsed.data.settings.supportEmail }),
            },
            actorUserId: operator.userId,
          });
          if (result.kind !== "updated") {
            throw Object.assign(new Error("Tenant settings could not be updated."), { code: result.kind === "conflict" ? "TENANT_SETTINGS_VERSION_CONFLICT" : "TENANT_NOT_FOUND" });
          }
          return result.value;
        },
      );
      return reply.send(updated);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error) {
        if (error.code === "TENANT_SETTINGS_VERSION_CONFLICT") {
          return reply.code(409).send({ error: "TENANT_SETTINGS_VERSION_CONFLICT", message: "Settings changed elsewhere. Reload and apply your changes again." });
        }
        if (error.code === "TENANT_NOT_FOUND") return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      }
      throw error;
    }
  });

  app.get<{ Params: { tenantId: string }; Querystring: { limit?: string; offset?: string; action?: string } }>(
    "/admin/platform/tenants/:tenantId/audit",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      const parsed = platformTenantAuditQuerySchema.safeParse(request.query);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
        return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
      }
      await requirePlatformPermission(request.headers, "audit.read");
      const values: unknown[] = [tenantId];
      let actionFilter = "";
      if (parsed.data.action) {
        values.push(`${parsed.data.action}%`);
        actionFilter = ` AND action ILIKE ${values.length}`;
      }
      const countResult = await pool.query<{ total: string }>(
        `SELECT count(*)::text AS total FROM public.platform_audit_events WHERE tenant_id = $1${actionFilter}`,
        values,
      );
      const pageValues = [...values, parsed.data.limit, parsed.data.offset];
      const rows = await pool.query(
        `SELECT id, occurred_at, actor_type, actor_id, actor_role, action, resource_type,
                resource_id, outcome, request_id, metadata
           FROM public.platform_audit_events
          WHERE tenant_id = $1${actionFilter}
          ORDER BY occurred_at DESC, id DESC
          LIMIT ${pageValues.length - 1} OFFSET ${pageValues.length}`,
        pageValues,
      );
      return reply.send({ items: rows.rows, total: Number(countResult.rows[0]?.total ?? 0), limit: parsed.data.limit, offset: parsed.data.offset });
    },
  );

  app.get<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/usage", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    await requirePlatformPermission(request.headers, "usage.read");
    const tenant = await getPlatformTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
    const [members, business] = await Promise.all([
      countPlatformTenantMembers(tenantId),
      withTenantTransaction(tenantId, async (tx) => {
        const [productTotal] = await tx.select({ value: count() }).from(products);
        const [activeProductTotal] = await tx.select({ value: count() }).from(products).where(eq(products.active, true));
        const [orderTotal] = await tx.select({ value: count() }).from(orders);
        const [paidOrderTotal] = await tx.select({ value: count() }).from(orders).where(eq(orders.status, "paid"));
        const [pendingOrderTotal] = await tx.select({ value: count() }).from(orders).where(eq(orders.status, "pending_payment"));
        return {
          products: productTotal?.value ?? 0,
          activeProducts: activeProductTotal?.value ?? 0,
          orders: orderTotal?.value ?? 0,
          paidOrders: paidOrderTotal?.value ?? 0,
          pendingOrders: pendingOrderTotal?.value ?? 0,
        };
      }),
    ]);
    return reply.send({ tenantId, asOf: new Date().toISOString(), members, ...business });
  });

  app.patch<{ Params: { tenantId: string } }>("/admin/platform/tenants/:tenantId/lifecycle", async (request, reply) => {
    const tenantId = request.params.tenantId.trim();
    const parsed = platformTenantLifecycleInputSchema.safeParse(request.body);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    }
    const permission = parsed.data.action === "suspend"
      ? "tenant.suspend"
      : parsed.data.action === "restore"
        ? "tenant.restore"
        : "tenant.close";
    const operator = await requirePlatformPermission(request.headers, permission);
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, operator, "tenant", tenantId, { lifecycleAction: parsed.data.action }),
        action: `tenant.${parsed.data.action}`,
        tenantId,
      },
      () => transitionPlatformTenant({ tenantId, action: parsed.data.action }),
    );
    if (!result) return reply.code(409).send({ error: "TENANT_STATE_CONFLICT", message: "The tenant does not exist or is not in a state that permits this transition." });
    return reply.send({ tenant: result });
  });

  // Tenant identity is resolved from the signed-in session and active
  // organization. No request parameter can select another tenant.
  app.get("/admin/overview", async (request) => {
    const context = await requirePermission(request, { analytics: ["read"] });
    const metrics = await withTenantTransaction(context.tenantId, async (tx) => {
      const [productCount] = await tx.select({ value: count() }).from(products);
      const [activeProductCount] = await tx.select({ value: count() }).from(products)
        .where(eq(products.active, true));
      const [orderCount] = await tx.select({ value: count() }).from(orders);
      const [pendingOrderCount] = await tx.select({ value: count() }).from(orders)
        .where(eq(orders.status, "pending_payment"));
      const [paidOrderCount] = await tx.select({ value: count() }).from(orders)
        .where(eq(orders.status, "paid"));
      return {
        products: productCount?.value ?? 0,
        activeProducts: activeProductCount?.value ?? 0,
        orders: orderCount?.value ?? 0,
        pendingOrders: pendingOrderCount?.value ?? 0,
        paidOrders: paidOrderCount?.value ?? 0,
      };
    });

    return {
      tenant: {
        id: context.tenantId,
        slug: context.tenantSlug,
        name: context.tenantName,
        currency: context.currency,
      },
      organization: { id: context.organizationId, roles: context.roles },
      user: { id: context.userId, name: context.name, email: context.email },
      metrics,
    };
  });

  app.get<{ Querystring: { limit?: string; offset?: string } }>("/admin/members", async (request, reply) => {
    const parsed = memberListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const context = await requirePermission(request, { member: ["update"] });
    const result = await auth.api.listMembers({
      query: {
        organizationId: context.organizationId,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        sortBy: "createdAt",
        sortDirection: "desc",
      },
      headers: authHeaders(request),
    });
    return reply.send(result);
  });

  app.get("/admin/invitations", async (request) => {
    const context = await requirePermission(request, { invitation: ["create"] });
    return auth.api.listInvitations({
      query: { organizationId: context.organizationId },
      headers: authHeaders(request),
    });
  });

  app.post("/admin/invitations", async (request, reply) => {
    const parsed = invitationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    }
    const context = await requirePermission(request, { invitation: ["create"] });
    const invitation = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "invitation", null, { role: parsed.data.role }),
        action: "tenant.invitation.created",
        tenantId: context.tenantId,
      },
      () => auth.api.createInvitation({
        body: {
          email: parsed.data.email,
          role: parsed.data.role,
          organizationId: context.organizationId,
        },
        headers: authHeaders(request),
      }),
    );
    return reply.code(201).send(invitation);
  });

  app.delete<{ Params: { invitationId: string } }>("/admin/invitations/:invitationId", async (request, reply) => {
    const invitationId = request.params.invitationId.trim();
    if (!invitationId || invitationId.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const context = await requirePermission(request, { invitation: ["cancel"] });
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "invitation", invitationId),
        action: "tenant.invitation.cancelled",
        tenantId: context.tenantId,
      },
      () => auth.api.cancelInvitation({
        body: { invitationId },
        headers: authHeaders(request),
      }),
    );
    return reply.send(result);
  });

  app.patch<{ Params: { memberId: string } }>("/admin/members/:memberId/role", async (request, reply) => {
    const memberId = request.params.memberId.trim();
    const parsed = memberRoleInputSchema.safeParse(request.body);
    if (!memberId || memberId.length > 128 || !parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        ...(parsed.success ? {} : { details: parsed.error.flatten() }),
      });
    }
    const context = await requirePermission(request, { member: ["update"] });
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "member", memberId, { assignedRole: parsed.data.role }),
        action: "tenant.member.role.updated",
        tenantId: context.tenantId,
      },
      () => auth.api.updateMemberRole({
        body: {
          memberId,
          role: parsed.data.role,
          organizationId: context.organizationId,
        },
        headers: authHeaders(request),
      }),
    );
    return reply.send(result);
  });

  app.delete<{ Params: { userId: string } }>("/admin/members/:userId", async (request, reply) => {
    const userId = request.params.userId.trim();
    if (!userId || userId.length > 128) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }
    const context = await requirePermission(request, { member: ["delete"] });
    const result = await withAudit(
      request,
      {
        ...userAuditEvent(request, { userId: context.userId, role: context.roles.join(",") }, "member", userId),
        action: "tenant.member.removed",
        tenantId: context.tenantId,
      },
      () => auth.api.removeMember({
        body: {
          memberIdOrEmail: userId,
          organizationId: context.organizationId,
        },
        headers: authHeaders(request),
      }),
    );
    return reply.send(result);
  });
}

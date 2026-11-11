import type { FastifyInstance } from "fastify";
import { PostgresAuditEventWriter } from "@bazion/audit";
import {
  confirmEmailChangeInputSchema,
  consumeOrderClaimProofInputSchema,
  requestEmailChangeInputSchema,
  scopedDeepLinkRequestSchema,
} from "@bazion/api-contracts";
import {
  DeepLinkPolicyError,
  buildBffSessionCookieOptions,
  getCurrentIdentity,
  parseOrganizationRoles,
  resolveScopedDeepLink,
  serializeClearCookieHeader,
  shouldUseStrictHostCookies,
} from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { pool } from "../../lib/database.js";

const auditWriter = new PostgresAuditEventWriter(pool);

export interface AuthRoutesOptions {
  config?: AppConfig;
}

export async function authRoutes(app: FastifyInstance, options: AuthRoutesOptions = {}): Promise<void> {
  app.get("/auth/me", async (request, reply) => {
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    return reply.send(identity);
  });

  app.post("/auth/claim-order", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Sign in before claiming an order." });
    }

    const parsed = consumeOrderClaimProofInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid order claim proof token.",
      });
    }

    const { IdentityLifecycleError, claimGuestOrder } = await import("@bazion/auth/server");
    try {
      const claimed = await claimGuestOrder({
        proofToken: parsed.data.proofToken,
        claimantUserId: identity.user.id,
        claimantEmailVerified: Boolean(identity.user.emailVerified),
      });

      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        tenantId: claimed.tenantId,
        action: "identity.order_claim",
        resourceType: "commercial_order_claim_proof",
        resourceId: claimed.claimId,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { externalOrderId: claimed.externalOrderId },
      }).catch(() => undefined);

      return reply.code(200).send({
        claimed: true,
        claimId: claimed.claimId,
        externalOrderId: claimed.externalOrderId,
        tenantId: claimed.tenantId,
        installationId: claimed.installationId,
        membershipRole: claimed.membershipRole,
      });
    } catch (error) {
      if (error instanceof IdentityLifecycleError) {
        await auditWriter.append({
          actorType: "user",
          actorId: identity.user.id,
          actorRole: identity.platformRole ?? null,
          action: "identity.order_claim",
          resourceType: "commercial_order_claim_proof",
          ...(error.collisionId ? { resourceId: error.collisionId } : {}),
          outcome: "denied",
          requestId: request.id,
          metadata: { reason: error.code },
        }).catch(() => undefined);

        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message,
          ...(error.collisionId ? { collisionId: error.collisionId } : {}),
        });
      }
      throw error;
    }
  });

  app.post("/auth/email-change/request", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Sign in to change your email." });
    }

    const parsed = requestEmailChangeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid email address.",
      });
    }

    const { IdentityLifecycleError, requestEmailChange } = await import("@bazion/auth/server");
    try {
      const requested = await requestEmailChange({
        userId: identity.user.id,
        currentEmail: identity.user.email,
        newEmail: parsed.data.newEmail,
      });

      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        tenantId: identity.tenant?.id ?? null,
        action: "identity.email_change.requested",
        resourceType: "account_email_change_request",
        resourceId: requested.requestId,
        outcome: "succeeded",
        requestId: request.id,
      }).catch(() => undefined);

      const nodeEnv = options.config?.NODE_ENV ?? process.env.NODE_ENV ?? "development";
      return reply.code(202).send({
        accepted: true,
        requestId: requested.requestId,
        newEmail: requested.newEmail,
        expiresAt: requested.expiresAt,
        ...(nodeEnv === "test" ? { testVerificationToken: requested.verificationToken } : {}),
      });
    } catch (error) {
      if (error instanceof IdentityLifecycleError) {
        await auditWriter.append({
          actorType: "user",
          actorId: identity.user.id,
          actorRole: identity.platformRole ?? null,
          action: "identity.email_change.requested",
          resourceType: "account_email_change_request",
          ...(error.collisionId ? { resourceId: error.collisionId } : {}),
          outcome: "denied",
          requestId: request.id,
          metadata: { reason: error.code },
        }).catch(() => undefined);

        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message,
          ...(error.collisionId ? { collisionId: error.collisionId } : {}),
        });
      }
      throw error;
    }
  });

  app.post("/auth/email-change/confirm", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Sign in to confirm email change." });
    }

    const parsed = confirmEmailChangeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid confirmation token.",
      });
    }

    const { IdentityLifecycleError, auth, confirmEmailChange } = await import("@bazion/auth/server");
    try {
      const confirmed = await confirmEmailChange({
        actorUserId: identity.user.id,
        token: parsed.data.token,
      });

      await auth.api.signOut({
        headers: new Headers(request.headers as Record<string, string>),
      }).catch(() => undefined);

      const nodeEnv = options.config?.NODE_ENV ?? process.env.NODE_ENV ?? "development";
      const baseUrl = options.config?.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:4000";
      const strictHostCookie = shouldUseStrictHostCookies({ nodeEnv, baseUrl });
      reply.header("set-cookie", serializeClearCookieHeader(buildBffSessionCookieOptions({ strictHostCookie })));

      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        action: "identity.email_change.confirmed",
        resourceType: "account_email_change_request",
        resourceId: confirmed.requestId,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { revokedSessions: confirmed.revokedSessions },
      }).catch(() => undefined);

      return reply.code(200).send({
        updated: true,
        requestId: confirmed.requestId,
        newEmail: confirmed.newEmail,
        revokedSessions: confirmed.revokedSessions,
        reauthenticationRequired: true,
      });
    } catch (error) {
      if (error instanceof IdentityLifecycleError) {
        return reply.code(error.statusCode).send({
          error: error.code,
          message: error.message,
          ...(error.collisionId ? { collisionId: error.collisionId } : {}),
        });
      }
      throw error;
    }
  });

  app.post("/auth/deep-links/resolve", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) {
      return reply.code(401).send({ error: "UNAUTHENTICATED", message: "Sign in to resolve workspace deep links." });
    }

    const parsed = scopedDeepLinkRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid deep-link request.",
      });
    }

    let targetTenantSlug: string | null = null;
    if (parsed.data.tenantId) {
      const tenantRes = await pool.query(
        "SELECT slug FROM public.tenants WHERE id = $1::uuid LIMIT 1",
        [parsed.data.tenantId],
      );
      targetTenantSlug = tenantRes.rows[0]?.slug ? String(tenantRes.rows[0].slug) : null;
    } else if (identity.tenant?.slug) {
      targetTenantSlug = identity.tenant.slug;
    }

    try {
      const resolved = resolveScopedDeepLink({
        area: parsed.data.area,
        actorUserId: identity.user.id,
        actorPlatformRole: identity.platformRole,
        actorTenantId: identity.tenant?.id ?? null,
        actorOrgRoles: identity.organization?.role ? parseOrganizationRoles(identity.organization.role) : [],
        targetTenantId: parsed.data.tenantId ?? identity.tenant?.id ?? null,
        targetTenantSlug,
        installationId: parsed.data.installationId ?? null,
        externalRef: parsed.data.externalRef ?? null,
        origins: {
          commercialPortalUrl: options.config?.commercialPortalUrl ?? process.env.COMMERCIAL_PORTAL_URL ?? null,
          platformConsoleUrl: options.config?.platformConsoleUrl ?? process.env.PLATFORM_CONSOLE_URL ?? "http://localhost:3001",
          publicStorefrontUrl: options.config?.PUBLIC_STOREFRONT_URL ?? process.env.PUBLIC_STOREFRONT_URL ?? "http://localhost:3000",
        },
      });

      await auditWriter.append({
        actorType: "user",
        actorId: identity.user.id,
        actorRole: identity.platformRole ?? null,
        tenantId: parsed.data.tenantId ?? identity.tenant?.id ?? null,
        action: "identity.deep_link.resolve",
        resourceType: "dashboard_area",
        resourceId: parsed.data.area,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { boundary: resolved.boundary },
      }).catch(() => undefined);

      return reply.code(200).send(resolved);
    } catch (error) {
      if (error instanceof DeepLinkPolicyError) {
        await auditWriter.append({
          actorType: "user",
          actorId: identity.user.id,
          actorRole: identity.platformRole ?? null,
          tenantId: parsed.data.tenantId ?? identity.tenant?.id ?? null,
          action: "identity.deep_link.resolve",
          resourceType: "dashboard_area",
          resourceId: parsed.data.area,
          outcome: "denied",
          requestId: request.id,
          metadata: { reason: error.code },
        }).catch(() => undefined);

        return reply.code(error.statusCode).send({ error: error.code, message: error.message });
      }
      throw error;
    }
  });
}

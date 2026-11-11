import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminIdentityRoutes } from "./identity-routes.js";

const mocks = vi.hoisted(() => {
  class MockIdentityLifecycleError extends Error {
    constructor(
      public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 410,
      public readonly code: string,
      message: string,
      public readonly collisionId?: string,
    ) {
      super(message);
    }
  }

  return {
    MockIdentityLifecycleError,
    requirePlatformPermission: vi.fn(),
    requirePlatformRole: vi.fn(),
    listIdentityCollisionsForSupport: vi.fn(),
    resolveIdentityCollisionForSupport: vi.fn(),
    appendAuditEvent: vi.fn(),
  };
});

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) {
      return mocks.appendAuditEvent(event);
    }
  },
}));

vi.mock("@bazion/auth", () => ({
  requirePlatformPermission: mocks.requirePlatformPermission,
  requirePlatformRole: mocks.requirePlatformRole,
}));

vi.mock("@bazion/auth/server", () => ({
  IdentityLifecycleError: mocks.MockIdentityLifecycleError,
  listIdentityCollisionsForSupport: mocks.listIdentityCollisionsForSupport,
  resolveIdentityCollisionForSupport: mocks.resolveIdentityCollisionForSupport,
}));

vi.mock("../../lib/database.js", () => ({
  pool: { query: vi.fn() },
}));

describe("platform identity collision support routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appendAuditEvent.mockResolvedValue(undefined);
    mocks.requirePlatformPermission.mockResolvedValue({
      userId: "support-1",
      email: "support@bazion.test",
      role: "platform_support",
      tenantId: null,
    });
    mocks.requirePlatformRole.mockResolvedValue({
      userId: "admin-1",
      email: "admin@bazion.test",
      role: "platform_admin",
    });
  });

  it("allows platform support with audit.read permission to list open collisions", async () => {
    mocks.listIdentityCollisionsForSupport.mockResolvedValueOnce([
      {
        id: "11111111-1111-4111-8111-111111111111",
        collisionType: "email_exists_unlinked_provider",
        issuer: "https://auth.bazion.test",
        subject: "sub-123",
        normalizedEmail: "owner@example.com",
        existingUserId: "user-1",
        candidateUserId: null,
        status: "open",
        detectedAt: "2026-11-11T00:00:00.000Z",
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
      },
    ]);

    const app = Fastify();
    await app.register(adminIdentityRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/platform/identity/collisions?status=open",
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.requirePlatformRole).toHaveBeenCalledWith(expect.anything(), [
      "platform_owner",
      "platform_admin",
      "platform_support",
    ]);
    expect(mocks.listIdentityCollisionsForSupport).toHaveBeenCalledWith({ status: "open" });
    expect(response.json()).toMatchObject({
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          collisionType: "email_exists_unlinked_provider",
          status: "open",
        },
      ],
    });
  });

  it("denies collision listing when the caller lacks a platform role", async () => {
    mocks.requirePlatformRole.mockRejectedValueOnce(
      Object.assign(new Error("Platform administrator access is required."), {
        statusCode: 403,
        code: "PLATFORM_PERMISSION_DENIED",
      }),
    );

    const app = Fastify();
    await app.register(adminIdentityRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/platform/identity/collisions",
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.listIdentityCollisionsForSupport).not.toHaveBeenCalled();
  });

  it("denies platform_support from mutating or resolving identity collisions", async () => {
    mocks.requirePlatformRole.mockRejectedValueOnce(
      Object.assign(new Error("Owner or admin role required."), {
        statusCode: 403,
        code: "PLATFORM_ROLE_DENIED",
      }),
    );

    const app = Fastify();
    await app.register(adminIdentityRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/platform/identity/collisions/11111111-1111-4111-8111-111111111111/resolve",
      payload: {
        action: "reject",
        note: "Denied because support cannot prove ownership.",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.requirePlatformRole).toHaveBeenCalledWith(expect.anything(), ["platform_owner", "platform_admin"]);
    expect(mocks.resolveIdentityCollisionForSupport).not.toHaveBeenCalled();
  });

  it("validates UUID collision identifiers and resolve_link requirements", async () => {
    const app = Fastify();
    await app.register(adminIdentityRoutes, { prefix: "/v1" });

    const badId = await app.inject({
      method: "POST",
      url: "/v1/admin/platform/identity/collisions/not-a-uuid/resolve",
      payload: {
        action: "reject",
        note: "Invalid id check",
      },
    });
    expect(badId.statusCode).toBe(400);
    expect(badId.json()).toMatchObject({ error: "INVALID_INPUT" });

    const missingTarget = await app.inject({
      method: "POST",
      url: "/v1/admin/platform/identity/collisions/11111111-1111-4111-8111-111111111111/resolve",
      payload: {
        action: "resolve_link",
        note: "Missing target user id should fail validation.",
      },
    });
    expect(missingTarget.statusCode).toBe(400);
    expect(missingTarget.json()).toMatchObject({ error: "INVALID_INPUT" });
    expect(mocks.resolveIdentityCollisionForSupport).not.toHaveBeenCalled();
  });

  it("allows platform_admin to resolve collisions and appends sanitized audit logs", async () => {
    mocks.resolveIdentityCollisionForSupport.mockResolvedValueOnce({
      id: "11111111-1111-4111-8111-111111111111",
      collisionType: "email_exists_unlinked_provider",
      status: "resolved_linked",
      resolvedBy: "admin-1",
    });

    const app = Fastify();
    await app.register(adminIdentityRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/platform/identity/collisions/11111111-1111-4111-8111-111111111111/resolve",
      payload: {
        action: "resolve_link",
        targetUserId: "user-1",
        note: "Verified caller owns both external sub and existing account.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.resolveIdentityCollisionForSupport).toHaveBeenCalledWith({
      collisionId: "11111111-1111-4111-8111-111111111111",
      actorUserId: "admin-1",
      action: "resolve_link",
      targetUserId: "user-1",
      note: "Verified caller owns both external sub and existing account.",
    });
    expect(mocks.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "user",
        actorId: "admin-1",
        action: "platform.identity.collision.resolve",
        resourceId: "11111111-1111-4111-8111-111111111111",
        outcome: "succeeded",
        metadata: { resolutionAction: "resolve_link", nextStatus: "resolved_linked" },
      }),
    );
  });

  it("propagates IdentityLifecycleError status codes cleanly", async () => {
    mocks.resolveIdentityCollisionForSupport.mockRejectedValueOnce(
      new mocks.MockIdentityLifecycleError(409, "IDENTITY_COLLISION_ALREADY_RESOLVED", "Collision was already resolved."),
    );

    const app = Fastify();
    await app.register(adminIdentityRoutes, { prefix: "/v1" });

    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/platform/identity/collisions/11111111-1111-4111-8111-111111111111/resolve",
      payload: {
        action: "reject",
        note: "Re-resolving an already closed collision.",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "IDENTITY_COLLISION_ALREADY_RESOLVED",
      message: "Collision was already resolved.",
    });
  });
});

import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminRoutes } from "./routes.js";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requirePlatformRole: vi.fn(),
  requirePlatformPermission: vi.fn(),
  listPlatformTenants: vi.fn(),
  getPlatformTenant: vi.fn(),
  transitionPlatformTenant: vi.fn(),
  transferPlatformTenantOwner: vi.fn(),
  reconcileProvisioningTenants: vi.fn(),
  listMembers: vi.fn(),
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({ PostgresAuditEventWriter: class { append(event: unknown) { return mocks.appendAuditEvent(event); } } }));
vi.mock("@bazion/auth", () => ({ requireActiveTenantPermission: mocks.requirePermission, requirePlatformRole: mocks.requirePlatformRole, requirePlatformPermission: mocks.requirePlatformPermission }));
vi.mock("@bazion/auth/server", () => ({ reconcileProvisioningTenants: mocks.reconcileProvisioningTenants, listPlatformTenants: mocks.listPlatformTenants, getPlatformTenant: mocks.getPlatformTenant, transitionPlatformTenant: mocks.transitionPlatformTenant, transferPlatformTenantOwner: mocks.transferPlatformTenantOwner, auth: { api: {
  listMembers: mocks.listMembers,
  listInvitations: mocks.listInvitations,
  createInvitation: mocks.createInvitation,
  cancelInvitation: mocks.cancelInvitation,
  updateMemberRole: mocks.updateMemberRole,
  removeMember: mocks.removeMember,
} } }));
vi.mock("../../lib/database.js", () => ({ pool: {}, withTenantTransaction: vi.fn() }));

const context = {
  userId: "user-a",
  email: "owner@alpha.example.test",
  name: "Alpha Owner",
  organizationId: "org-alpha",
  tenantId: "tenant-alpha",
  tenantSlug: "alpha",
  tenantName: "Alpha Store",
  currency: "KES",
  roles: ["owner"],
};

async function makeApp() {
  const app = Fastify();
  await app.register(adminRoutes, { prefix: "/v1" });
  await app.ready();
  return app;
}

describe("client administration API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requirePermission.mockResolvedValue(context);
    mocks.requirePlatformRole.mockResolvedValue({ userId: "platform-admin", email: "admin@bazion.test", role: "platform_admin" });
    mocks.requirePlatformPermission.mockResolvedValue({ userId: "platform-admin", email: "admin@bazion.test", role: "platform_admin" });
    mocks.listPlatformTenants.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    mocks.getPlatformTenant.mockResolvedValue({ id: "tenant-alpha", slug: "alpha", name: "Alpha Store", status: "active" });
    mocks.transitionPlatformTenant.mockResolvedValue({ id: "tenant-alpha", slug: "alpha", status: "suspended" });
    mocks.transferPlatformTenantOwner.mockResolvedValue({ previousOwnerUserId: "old-owner", newOwnerUserId: "new-owner" });
    mocks.reconcileProvisioningTenants.mockResolvedValue({ scanned: 2, activated: 1, unmatched: [{ tenantId: "tenant-stuck", slug: "stuck" }], conflicted: [] });
    mocks.listMembers.mockResolvedValue({ members: [], total: 0 });
    mocks.listInvitations.mockResolvedValue([]);
    mocks.createInvitation.mockResolvedValue({ id: "invite-alpha", email: "staff@example.test" });
    mocks.cancelInvitation.mockResolvedValue({ success: true });
    mocks.updateMemberRole.mockResolvedValue({ success: true });
    mocks.removeMember.mockResolvedValue({ success: true });
    mocks.appendAuditEvent.mockResolvedValue(undefined);
  });

  it("requires analytics permission before loading overview data", async () => {
    const app = await makeApp();
    try {
      mocks.requirePermission.mockRejectedValue(Object.assign(new Error("Forbidden"), { statusCode: 403, code: "PERMISSION_DENIED" }));
      const response = await app.inject({ method: "GET", url: "/v1/admin/overview" });
      expect(response.statusCode).toBe(403);
      expect(mocks.requirePermission).toHaveBeenCalledWith(
        expect.any(Object),
        { analytics: ["read"] },
      );
    } finally {
      await app.close();
    }
  });

  it("lists members only after checking the active workspace's membership permission", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({ method: "GET", url: "/v1/admin/members?organizationId=org-other&limit=10" });
      expect(response.statusCode).toBe(200);
      expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), { member: ["update"] });
      expect(mocks.listMembers).toHaveBeenCalledWith(expect.objectContaining({
        query: expect.objectContaining({ organizationId: "org-alpha", limit: 10, offset: 0 }),
      }));
      expect(response.json()).toEqual({ members: [], total: 0 });
    } finally {
      await app.close();
    }
  });

  it("does not permit client users to invite a platform-controlled owner", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/invitations",
        payload: { email: "new-owner@example.test", role: "owner", organizationId: "org-other" },
      });
      expect(response.statusCode).toBe(400);
      expect(mocks.createInvitation).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("always scopes invitations to the organization resolved from the authenticated session", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/invitations",
        payload: { email: " staff@example.test ", role: "catalogManager", organizationId: "org-other" },
      });
      expect(response.statusCode).toBe(201);
      expect(mocks.requirePermission).toHaveBeenCalledWith(expect.any(Object), { invitation: ["create"] });
      expect(mocks.createInvitation).toHaveBeenCalledWith(expect.objectContaining({
        body: { email: "staff@example.test", role: "catalogManager", organizationId: "org-alpha" },
      }));
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.invitation.created.requested",
        tenantId: "tenant-alpha",
        metadata: { role: "catalogManager" },
      }));
      expect(JSON.stringify(mocks.appendAuditEvent.mock.calls)).not.toContain("staff@example.test");
    } finally {
      await app.close();
    }
  });

  it("scopes role changes and removals to the server-resolved organization", async () => {
    const app = await makeApp();
    try {
      const roleResponse = await app.inject({
        method: "PATCH",
        url: "/v1/admin/members/member-row-alpha/role",
        payload: { role: "viewer", organizationId: "org-other" },
      });
      const removeResponse = await app.inject({
        method: "DELETE",
        url: "/v1/admin/members/user-alpha",
      });
      expect(roleResponse.statusCode).toBe(200);
      expect(removeResponse.statusCode).toBe(200);
      expect(mocks.updateMemberRole).toHaveBeenCalledWith(expect.objectContaining({
        body: { memberId: "member-row-alpha", role: "viewer", organizationId: "org-alpha" },
      }));
      expect(mocks.removeMember).toHaveBeenCalledWith(expect.objectContaining({
        body: { memberIdOrEmail: "user-alpha", organizationId: "org-alpha" },
      }));
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.member.role.updated.completed",
        tenantId: "tenant-alpha",
        resourceId: "member-row-alpha",
      }));
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.member.removed.completed",
        tenantId: "tenant-alpha",
        resourceId: "user-alpha",
      }));
    } finally {
      await app.close();
    }
  });
});


describe("platform tenant provisioning recovery", () => {
  beforeEach(() => {
    mocks.requirePlatformRole.mockReset();
    mocks.reconcileProvisioningTenants.mockReset();
    mocks.requirePlatformRole.mockResolvedValue({ userId: "platform-admin", email: "admin@bazion.test", role: "platform_admin" });
    mocks.reconcileProvisioningTenants.mockResolvedValue({
      scanned: 2,
      activated: 1,
      unmatched: [{ tenantId: "tenant-stuck", slug: "stuck" }],
      conflicted: [],
    });
    mocks.appendAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("allows only a platform owner or administrator to reconcile stale provisioning rows", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/reconcile-provisioning",
        payload: { staleMinutes: 15, limit: 25 },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.requirePlatformRole).toHaveBeenCalledWith(
        expect.any(Object),
        ["platform_owner", "platform_admin"],
      );
      expect(mocks.reconcileProvisioningTenants).toHaveBeenCalledWith({ staleMinutes: 15, limit: 25 });
      expect(response.json()).toEqual({
        scanned: 2,
        activated: 1,
        unmatched: [{ tenantId: "tenant-stuck", slug: "stuck" }],
        conflicted: [],
      });
      expect(mocks.appendAuditEvent).toHaveBeenCalledTimes(2);
      expect(mocks.appendAuditEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
        actorType: "user",
        actorId: "platform-admin",
        actorRole: "platform_admin",
        action: "tenant.provisioning.reconciliation.requested",
        outcome: "succeeded",
        tenantId: null,
        metadata: { staleMinutes: 15, limit: 25 },
      }));
      expect(mocks.appendAuditEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
        action: "tenant.provisioning.reconciliation.completed",
        outcome: "succeeded",
      }));
    } finally {
      await app.close();
    }
  });

  it("records failed reconciliation outcomes without logging the underlying error", async () => {
    const app = await makeApp();
    try {
      mocks.reconcileProvisioningTenants.mockRejectedValue(new Error("database connection detail"));
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/reconcile-provisioning",
        payload: {},
      });
      expect(response.statusCode).toBe(500);
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.provisioning.reconciliation.failed",
        outcome: "failed",
      }));
      expect(JSON.stringify(mocks.appendAuditEvent.mock.calls)).not.toContain("database connection detail");
    } finally {
      await app.close();
    }
  });

  it("rejects client-supplied tenant selectors and malformed reconciliation options", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/reconcile-provisioning",
        payload: { tenantId: "tenant-other", staleMinutes: 1 },
      });
      expect(response.statusCode).toBe(400);
      expect(mocks.requirePlatformRole).not.toHaveBeenCalled();
      expect(mocks.reconcileProvisioningTenants).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("does not run reconciliation when the caller lacks a platform role", async () => {
    const app = await makeApp();
    try {
      mocks.requirePlatformRole.mockRejectedValue(Object.assign(new Error("Forbidden"), {
        statusCode: 403, code: "PLATFORM_PERMISSION_DENIED",
      }));
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/reconcile-provisioning",
        payload: {},
      });
      expect(response.statusCode).toBe(403);
      expect(mocks.reconcileProvisioningTenants).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});


describe("platform tenant lifecycle API", () => {
  beforeEach(() => {
    mocks.requirePlatformPermission.mockReset().mockResolvedValue({
      userId: "platform-admin", email: "admin@bazion.test", role: "platform_admin",
    });
    mocks.listPlatformTenants.mockReset().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    mocks.transitionPlatformTenant.mockReset().mockResolvedValue({
      id: "tenant-alpha", slug: "alpha", status: "suspended",
    });
    mocks.appendAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("lists tenants only after checking the platform tenant.list permission", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({ method: "GET", url: "/v1/admin/platform/tenants?status=active&limit=20" });
      expect(response.statusCode).toBe(200);
      expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Object), "tenant.list");
      expect(mocks.listPlatformTenants).toHaveBeenCalledWith({ status: "active", limit: 20, offset: 0 });
    } finally { await app.close(); }
  });

  it("audits and applies a suspend transition with the matching permission", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/lifecycle",
        payload: { action: "suspend" },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Object), "tenant.suspend");
      expect(mocks.transitionPlatformTenant).toHaveBeenCalledWith({
        tenantId: "11111111-1111-4111-8111-111111111111", action: "suspend",
      });
      expect(mocks.appendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
        action: "tenant.suspend.requested", tenantId: "11111111-1111-4111-8111-111111111111",
      }));
    } finally { await app.close(); }
  });

  it("requires the owner-only close permission and never silently deletes a tenant", async () => {
    const app = await makeApp();
    try {
      mocks.requirePlatformPermission.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), {
        statusCode: 403, code: "PLATFORM_PERMISSION_DENIED",
      }));
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/lifecycle",
        payload: { action: "close" },
      });
      expect(response.statusCode).toBe(403);
      expect(mocks.transitionPlatformTenant).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it("returns a conflict when the requested state transition is not valid", async () => {
    const app = await makeApp();
    try {
      mocks.transitionPlatformTenant.mockResolvedValueOnce(null);
      const response = await app.inject({
        method: "PATCH",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/lifecycle",
        payload: { action: "restore" },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe("TENANT_STATE_CONFLICT");
    } finally { await app.close(); }
  });

  it("rejects malformed tenant identifiers and extra lifecycle fields", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "PATCH", url: "/v1/admin/platform/tenants/not-a-uuid/lifecycle",
        payload: { action: "suspend", force: true },
      });
      expect(response.statusCode).toBe(400);
      expect(mocks.requirePlatformPermission).not.toHaveBeenCalled();
      expect(mocks.transitionPlatformTenant).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});


describe("platform tenant detail API", () => {
  it("checks tenant.read permission before returning a tenant record", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111",
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Object), "tenant.read");
      expect(mocks.getPlatformTenant).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
      expect(response.json().tenant.id).toBe("tenant-alpha");
    } finally {
      await app.close();
    }
  });

  it("does not disclose tenant records when platform permission is denied", async () => {
    const app = await makeApp();
    try {
      mocks.requirePlatformPermission.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), {
        statusCode: 403, code: "PLATFORM_PERMISSION_DENIED",
      }));
      const response = await app.inject({
        method: "GET",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111",
      });
      expect(response.statusCode).toBe(403);
      expect(mocks.getPlatformTenant).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns not found for unknown tenant IDs and rejects malformed identifiers", async () => {
    const app = await makeApp();
    try {
      mocks.getPlatformTenant.mockResolvedValueOnce(null);
      const missing = await app.inject({
        method: "GET", url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111",
      });
      expect(missing.statusCode).toBe(404);
      const invalid = await app.inject({ method: "GET", url: "/v1/admin/platform/tenants/not-a-uuid" });
      expect(invalid.statusCode).toBe(400);
      expect(mocks.getPlatformTenant).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});

describe("platform tenant owner transfer API", () => {
  beforeEach(() => {
    mocks.requirePlatformPermission.mockReset().mockResolvedValue({
      userId: "platform-owner", email: "owner@bazion.test", role: "platform_owner",
    });
    mocks.transferPlatformTenantOwner.mockReset().mockResolvedValue({
      previousOwnerUserId: "old-owner", newOwnerUserId: "new-owner",
    });
    mocks.appendAuditEvent.mockReset().mockResolvedValue(undefined);
  });

  it("requires tenant.owner.assign and records an audited transfer", async () => {
    const app = await makeApp();
    try {
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/owner",
        payload: { targetUserId: "new-owner" },
      });
      expect(response.statusCode).toBe(200);
      expect(mocks.requirePlatformPermission).toHaveBeenCalledWith(expect.any(Object), "tenant.owner.assign");
      expect(mocks.transferPlatformTenantOwner).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111", "new-owner",
      );
      expect(response.json().transfer).toEqual({
        previousOwnerUserId: "old-owner", newOwnerUserId: "new-owner",
      });
      expect(mocks.appendAuditEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
        action: "tenant.owner.assignment.requested",
        tenantId: "11111111-1111-4111-8111-111111111111",
        outcome: "succeeded",
        metadata: { targetUserId: "new-owner" },
      }));
      expect(mocks.appendAuditEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
        action: "tenant.owner.assignment.completed",
        tenantId: "11111111-1111-4111-8111-111111111111",
        outcome: "succeeded",
        metadata: { targetUserId: "new-owner" },
      }));
    } finally {
      await app.close();
    }
  });

  it("does not attempt a transfer when owner-assignment permission is denied", async () => {
    const app = await makeApp();
    try {
      mocks.requirePlatformPermission.mockRejectedValueOnce(Object.assign(new Error("Forbidden"), {
        statusCode: 403, code: "PLATFORM_PERMISSION_DENIED",
      }));
      const response = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/owner",
        payload: { targetUserId: "new-owner" },
      });
      expect(response.statusCode).toBe(403);
      expect(mocks.transferPlatformTenantOwner).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns a conflict when the target is not eligible and rejects malformed input", async () => {
    const app = await makeApp();
    try {
      mocks.transferPlatformTenantOwner.mockResolvedValueOnce(null);
      const conflict = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/11111111-1111-4111-8111-111111111111/owner",
        payload: { targetUserId: "not-a-member" },
      });
      const invalid = await app.inject({
        method: "POST",
        url: "/v1/admin/platform/tenants/not-a-uuid/owner",
        payload: { targetUserId: "new-owner", extra: true },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json().error).toBe("TENANT_OWNER_TRANSFER_CONFLICT");
      expect(invalid.statusCode).toBe(400);
      expect(mocks.transferPlatformTenantOwner).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
    }
  });
});

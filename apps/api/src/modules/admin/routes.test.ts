import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminRoutes } from "./routes.js";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  listMembers: vi.fn(),
  listInvitations: vi.fn(),
  createInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
}));

vi.mock("@bazion/auth", () => ({ requireActiveTenantPermission: mocks.requirePermission }));
vi.mock("@bazion/auth/server", () => ({ auth: { api: {
  listMembers: mocks.listMembers,
  listInvitations: mocks.listInvitations,
  createInvitation: mocks.createInvitation,
  cancelInvitation: mocks.cancelInvitation,
  updateMemberRole: mocks.updateMemberRole,
  removeMember: mocks.removeMember,
} } }));
vi.mock("../../lib/database.js", () => ({ withTenantTransaction: vi.fn() }));

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
    mocks.listMembers.mockResolvedValue({ members: [], total: 0 });
    mocks.listInvitations.mockResolvedValue([]);
    mocks.createInvitation.mockResolvedValue({ id: "invite-alpha", email: "staff@example.test" });
    mocks.cancelInvitation.mockResolvedValue({ success: true });
    mocks.updateMemberRole.mockResolvedValue({ success: true });
    mocks.removeMember.mockResolvedValue({ success: true });
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
    } finally {
      await app.close();
    }
  });
});

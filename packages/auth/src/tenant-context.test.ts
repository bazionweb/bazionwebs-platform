import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getActiveMember: vi.fn(),
  resolvePlatformMemberByUserId: vi.fn(),
  resolveTenantByOrganizationId: vi.fn(),
  platformRole: "platform_admin" as string | null,
  activeOrganizationId: "org-alpha" as string | null,
}));

vi.mock("./server.js", () => ({
  auth: { api: { getSession: mocks.getSession, getActiveMember: mocks.getActiveMember } },
  resolvePlatformMemberByUserId: mocks.resolvePlatformMemberByUserId,
  resolveTenantByOrganizationId: mocks.resolveTenantByOrganizationId,
}));

import { requirePlatformPermission } from "./tenant-context.js";

const requestHeaders = { cookie: "better-auth.session_token=test" };

describe("platform permission tenant scope", () => {
  beforeEach(() => {
    mocks.platformRole = "platform_admin";
    mocks.activeOrganizationId = "org-alpha";
    mocks.getSession.mockReset().mockImplementation(async () => ({
      user: { id: "user-admin", email: "admin@example.test", name: "Tenant Admin", emailVerified: true },
      session: { activeOrganizationId: mocks.activeOrganizationId },
    }));
    mocks.getActiveMember.mockReset().mockResolvedValue({ organizationId: "org-alpha", role: "admin" });
    mocks.resolvePlatformMemberByUserId.mockReset().mockImplementation(async () => mocks.platformRole
      ? { userId: "user-admin", email: "admin@example.test", role: mocks.platformRole, status: "active" }
      : null);
    mocks.resolveTenantByOrganizationId.mockReset().mockImplementation(async (organizationId: string) => ({
      id: organizationId === "org-alpha" ? "tenant-alpha" : "tenant-beta",
      slug: organizationId === "org-alpha" ? "alpha" : "beta",
      name: organizationId === "org-alpha" ? "Alpha" : "Beta",
      default_currency: "KES",
      status: "active",
    }));
  });

  it("allows a platform admin to operate only within their active tenant", async () => {
    await expect(requirePlatformPermission(requestHeaders, "tenant.read", "tenant-alpha"))
      .resolves.toMatchObject({ role: "platform_admin", tenantId: "tenant-alpha" });
  });

  it("denies a platform admin when the requested tenant differs from their active tenant", async () => {
    await expect(requirePlatformPermission(requestHeaders, "tenant.read", "tenant-beta"))
      .rejects.toMatchObject({ code: "PLATFORM_TENANT_SCOPE_DENIED", statusCode: 403 });
  });

  it("scopes a tenant list request to the platform admin's active tenant", async () => {
    await expect(requirePlatformPermission(requestHeaders, "tenant.list"))
      .resolves.toMatchObject({ tenantId: "tenant-alpha" });
  });

  it("allows the platform owner to target a different tenant", async () => {
    mocks.platformRole = "platform_owner";
    await expect(requirePlatformPermission(requestHeaders, "tenant.read", "tenant-beta"))
      .resolves.toMatchObject({ role: "platform_owner", tenantId: "tenant-beta" });
  });
});

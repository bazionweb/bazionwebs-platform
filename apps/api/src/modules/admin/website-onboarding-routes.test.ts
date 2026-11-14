import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { websiteOnboardingRoutes } from "./website-onboarding-routes.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000055";

const mocks = vi.hoisted(() => ({
  requirePlatformRole: vi.fn(),
  getPlatformTenant: vi.fn(),
  updatePlatformTenantModuleEntitlement: vi.fn(),
  withTenantTransaction: vi.fn(),
  appendAuditEvent: vi.fn(),
}));

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: unknown) {
      return mocks.appendAuditEvent(event);
    }
  },
}));

vi.mock("@bazion/auth", () => ({
  requirePlatformRole: mocks.requirePlatformRole,
}));

vi.mock("@bazion/auth/server", () => ({
  getPlatformTenant: mocks.getPlatformTenant,
  updatePlatformTenantModuleEntitlement: mocks.updatePlatformTenantModuleEntitlement,
}));

vi.mock("../../lib/database.js", () => ({
  pool: {},
  withTenantTransaction: mocks.withTenantTransaction,
}));

function buildMockTx() {
  const selectResult: unknown[] = [];
  const selectChain: {
    from: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: (onFulfilled: (value: unknown[]) => unknown) => Promise<unknown>;
  } = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(selectResult),
    then: (onFulfilled) => Promise.resolve(selectResult).then(onFulfilled),
  };
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.orderBy.mockReturnValue(selectChain);

  return {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
}

describe("websiteOnboardingRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlatformRole.mockResolvedValue({ userId: "owner-1", role: "platform_owner" });
    mocks.getPlatformTenant.mockResolvedValue({
      id: TENANT_ID,
      slug: "savanna-enterprise",
      name: "Savanna Enterprise Ltd",
      status: "active",
    });
    mocks.updatePlatformTenantModuleEntitlement.mockResolvedValue(true);
    mocks.appendAuditEvent.mockResolvedValue(undefined);
  });

  it("applies white-labeled templates for non-church commercial packages (SME & E-Commerce)", async () => {
    const tx = buildMockTx();
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    const app = Fastify();
    await app.register(websiteOnboardingRoutes);

    const res = await app.inject({
      method: "POST",
      url: `/admin/platform/tenants/${TENANT_ID}/website-onboarding/apply-template`,
      payload: {
        packageId: "ecommerce",
        templateId: "ecommerce-modern-retail",
        brandName: "Savanna Urban Retail",
        paletteId: "emerald-growth",
        payment: {
          mpesaPaybill: "522533",
          accountNo: "SAVANNA",
          currency: "KES",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.applied).toBe(true);
    expect(body.packageId).toBe("ecommerce");
    expect(body.packageSettings.organization.name).toBe("Savanna Urban Retail");
    expect(body.packageSettings.payment.mpesaPaybill).toBe("522533");
    expect(body.assignableModules).toContain("commerce");
    expect(mocks.updatePlatformTenantModuleEntitlement).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      moduleId: "commerce",
      enabled: true,
      actorUserId: "owner-1",
    });
  });

  it("preserves full church-ministry template application without leaking GMFC source data", async () => {
    const tx = buildMockTx();
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    const app = Fastify();
    await app.register(websiteOnboardingRoutes);

    const res = await app.inject({
      method: "POST",
      url: `/admin/platform/tenants/${TENANT_ID}/website-onboarding/apply-template`,
      payload: {
        packageId: "church-ministry",
        templateId: "gmfc-revival-signature",
        ministryName: "Grace Bible Church",
        giving: { mpesaPaybill: "410410", accountNo: "GRACE01" },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.packageId).toBe("church-ministry");
    expect(body.versionNumber).toBe(1);
    expect(body.config.ministryName).toBe("Grace Bible Church");
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain("global mission");
    expect(serialized).not.toContain("247 247");
  });

  it("auto-infers package from imported GitHub repo and generates multi-package BYOW compose", async () => {
    const tx = buildMockTx();
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, fn: (t: unknown) => Promise<unknown>) =>
      fn(tx),
    );

    const app = Fastify();
    await app.register(websiteOnboardingRoutes);

    const res = await app.inject({
      method: "POST",
      url: `/admin/platform/tenants/${TENANT_ID}/website-onboarding/import-repo`,
      payload: {
        repoUrl: "https://github.com/custom-tenant/clinic-portal",
        branch: "main",
        packageId: "auto",
        mode: "byow-compose",
        framework: "nextjs",
        primaryDomain: "clinic.example.org",
        configTs:
          'export const SITE = { clinicName: "Old MediCare", patientBooking: true, email: "old@med.org", paybill: "999111" };',
        tokensCss: ":root { --color-primary: #115E59; --color-accent: #F59E0B; }",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.packageId).toBe("clinic-management");
    expect(body.detectedSourceBrand.brandName).toBe("Old MediCare");
    expect(body.byowCompose.composePath).toBe("tenants/savanna-enterprise/docker-compose.yml");
    expect(body.byowCompose.composeYaml).toContain("com.bazion.package.id=clinic-management");
    expect(JSON.stringify(body.packageSettings).toLowerCase()).not.toContain("old medicare");
    expect(JSON.stringify(body.packageSettings).toLowerCase()).not.toContain("999111");
  });
});

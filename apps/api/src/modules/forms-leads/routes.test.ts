import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formsLeadsRoutes } from "./routes.js";

const mocks = vi.hoisted(() => ({
  resolveTenantId: vi.fn(),
  isTenantModuleEnabled: vi.fn(),
  requireActiveTenantPermission: vi.fn(),
  withTenantTransaction: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
  policyWrites: [] as Array<Record<string, unknown>>,
  deleted: [] as Array<{ id: string }>,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../lib/tenant-resolution.js", () => ({
  resolveTenantId: mocks.resolveTenantId,
  resolveRequestTenantId: mocks.resolveTenantId,
}));
vi.mock("../../lib/tenant-modules.js", () => ({ isTenantModuleEnabled: mocks.isTenantModuleEnabled }));
vi.mock("../../lib/database.js", () => ({
  withTenantTransaction: mocks.withTenantTransaction,
  withTenantMaintenanceTransaction: vi.fn(),
  listTenantIdsForMaintenance: vi.fn(),
}));
vi.mock("@bazion/auth", () => ({ requireActiveTenantPermission: mocks.requireActiveTenantPermission }));

const tenantId = "11111111-1111-4111-8111-111111111111";
const enquiryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const publishedPolicy = {
  enabled: true,
  privacyNotice: "We use your contact details only to respond to this request and remove them after the stated retention period.",
  privacyNoticeVersion: "1.0.0",
  retentionDays: 90,
  publishedAt: new Date("2026-11-01T10:00:00.000Z"),
  updatedAt: new Date("2026-11-01T10:00:00.000Z"),
};

function configurePolicyTransaction(policy: Record<string, unknown> | undefined) {
  mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, callback: (tx: unknown) => Promise<unknown>) => {
    const selectBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    selectBuilder.from = vi.fn(() => selectBuilder);
    selectBuilder.where = vi.fn(() => selectBuilder);
    selectBuilder.limit = vi.fn(async () => policy ? [policy] : []);
    return callback({
      select: vi.fn(() => selectBuilder),
      insert: vi.fn(() => ({ values: vi.fn((values: Record<string, unknown>) => { mocks.inserted.push(values); return Promise.resolve([]); }) })),
    });
  });
}

async function createApp(enableRateLimit = false) {
  const app = Fastify();
  if (enableRateLimit) await app.register(rateLimit, { global: false });
  await app.register(formsLeadsRoutes, {
    prefix: "/v1",
    config: { NODE_ENV: "test", TENANT_RESOLUTION_MODE: "dynamic" } as never,
  });
  return app;
}

describe("forms and lead capture routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserted = [];
    mocks.policyWrites = [];
    mocks.deleted = [];
    mocks.rows = [];
    mocks.resolveTenantId.mockResolvedValue(tenantId);
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
    mocks.requireActiveTenantPermission.mockResolvedValue({ tenantId });
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, callback: (tx: unknown) => Promise<unknown>) => callback({}));
  });

  it("stores only validated tenant-scoped contact fields and server-owned consent metadata", async () => {
    configurePolicyTransaction(publishedPolicy);
    const app = await createApp();

    const response = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test", "x-forwarded-for": "203.0.113.20" },
      payload: {
        fullName: " Taylor Njeri ",
        email: "Taylor@Example.com",
        telephone: "",
        subject: " Website question ",
        message: "Please tell me about your services.",
        privacyConsent: true,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ success: true });
    expect(mocks.isTenantModuleEnabled).toHaveBeenCalledWith(tenantId, "forms-leads");
    expect(mocks.inserted).toHaveLength(1);
    expect(mocks.inserted[0]).toMatchObject({
      tenantId,
      formId: "contact",
      fullName: "Taylor Njeri",
      email: "taylor@example.com",
      telephone: null,
      subject: "Website question",
      privacyNoticeVersion: "1.0.0",
    });
    expect(mocks.inserted[0]?.privacyConsentAt).toBeInstanceOf(Date);
    expect(mocks.inserted[0]?.retentionExpiresAt).toBeInstanceOf(Date);
    expect((mocks.inserted[0]?.retentionExpiresAt as Date).getTime() - (mocks.inserted[0]?.privacyConsentAt as Date).getTime())
      .toBe(90 * 24 * 60 * 60 * 1000);
    expect(mocks.inserted[0]).not.toHaveProperty("ipAddress");
    expect(mocks.withTenantTransaction).toHaveBeenCalledWith(tenantId, expect.any(Function));
    await app.close();
  });

  it("returns a quiet success for honeypot submissions without writing contact data", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test" },
      payload: {
        fullName: "Automated visitor",
        email: "bot@example.test",
        message: "A bot may send this otherwise valid text.",
        privacyConsent: true,
        companyWebsite: "https://bot.example",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().success).toBe(true);
    expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("does not collect enquiries until a tenant has published an enabled privacy policy", async () => {
    configurePolicyTransaction(undefined);
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test" },
      payload: {
        fullName: "Taylor Njeri", email: "taylor@example.test", message: "Please tell me about this service.", privacyConsent: true,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "ENQUIRY_FORM_UNAVAILABLE" });
    expect(mocks.inserted).toHaveLength(0);
    await app.close();
  });

  it("rejects a form rendered with an outdated privacy notice version", async () => {
    configurePolicyTransaction({ ...publishedPolicy, privacyNoticeVersion: "2.0.0" });
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test" },
      payload: {
        fullName: "Taylor Njeri", email: "taylor@example.test", message: "Please tell me about this service.", privacyConsent: true,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "PRIVACY_NOTICE_VERSION_MISMATCH" });
    expect(mocks.inserted).toHaveLength(0);
    await app.close();
  });

  it("returns the tenant's privacy policy without allowing shared caching", async () => {
    configurePolicyTransaction(publishedPolicy);
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/site/enquiry-policy",
      headers: { host: "api.example.test" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().policy).toMatchObject({
      enabled: true,
      privacyNoticeVersion: "1.0.0",
      retentionDays: 90,
    });
    expect(mocks.requireActiveTenantPermission).toHaveBeenCalledWith(expect.anything(), { enquiryPolicy: ["read"] });
    await app.close();
  });

  it("publishes validated policy updates with a server-owned publication timestamp", async () => {
    const savedPolicy = { ...publishedPolicy, privacyNoticeVersion: "2.0.0", retentionDays: 120 };
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, callback: (tx: unknown) => Promise<unknown>) => callback({
      insert: vi.fn(() => ({
        values: vi.fn((values: Record<string, unknown>) => {
          mocks.policyWrites.push(values);
          return {
            onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [savedPolicy]) })),
          };
        }),
      })),
    }));
    const app = await createApp();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/admin/site/enquiry-policy",
      headers: { host: "api.example.test" },
      payload: {
        enabled: true,
        privacyNotice: publishedPolicy.privacyNotice,
        privacyNoticeVersion: "2.0.0",
        retentionDays: 120,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().policy).toMatchObject({ privacyNoticeVersion: "2.0.0", retentionDays: 120 });
    expect(mocks.policyWrites[0]?.tenantId).toBe(tenantId);
    expect(mocks.policyWrites[0]?.publishedAt).toBeInstanceOf(Date);
    expect(mocks.requireActiveTenantPermission).toHaveBeenCalledWith(expect.anything(), { enquiryPolicy: ["update"] });
    await app.close();
  });

  it("rejects publishing a policy with no meaningful notice before writing", async () => {
    const app = await createApp();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/admin/site/enquiry-policy",
      headers: { host: "api.example.test" },
      payload: { enabled: true, privacyNotice: "Short", privacyNoticeVersion: "1.0.0", retentionDays: 90 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
    expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects missing consent and client-supplied tenant or retention values", async () => {
    const app = await createApp();
    const missingConsent = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test" },
      payload: { fullName: "Taylor Njeri", email: "taylor@example.test", message: "Please call me about this service." },
    });
    const forgedMetadata = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test" },
      payload: {
        fullName: "Taylor Njeri", email: "taylor@example.test", message: "Please call me about this service.",
        privacyConsent: true, tenantId, privacyConsentAt: "2000-01-01T00:00:00.000Z", retentionExpiresAt: "2100-01-01T00:00:00.000Z",
      },
    });

    expect(missingConsent.statusCode).toBe(400);
    expect(forgedMetadata.statusCode).toBe(400);
    expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects public submissions when the forms-leads entitlement is disabled", async () => {
    mocks.isTenantModuleEnabled.mockResolvedValue(false);
    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/public/site/enquiries",
      headers: { host: "harbour.example.test" },
      payload: {
        fullName: "Taylor Njeri", email: "taylor@example.test", message: "Please call me about this service.", privacyConsent: true,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("limits public submissions by client IP even when the Host header changes", async () => {
    configurePolicyTransaction(publishedPolicy);
    const app = await createApp(true);
    const payload = {
      fullName: "Taylor Njeri", email: "taylor@example.test", message: "Please call me about this service.", privacyConsent: true,
    };
    const responses: Array<{ statusCode: number }> = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await app.inject({
        method: "POST",
        url: "/v1/public/site/enquiries",
        headers: { host: `site-${attempt}.example.test` },
        payload,
      }));
    }

    expect(responses.slice(0, 5).every((response) => response.statusCode === 201)).toBe(true);
    expect(responses[5]?.statusCode).toBe(429);
    expect(mocks.withTenantTransaction).toHaveBeenCalledTimes(5);
    await app.close();
  });

  it("requires a separate export permission and returns a bounded, no-store page", async () => {
    mocks.rows = [{
      id: enquiryId,
      formId: "contact",
      fullName: "Taylor Njeri",
      email: "taylor@example.test",
      telephone: null,
      subject: null,
      message: "Please tell me about your services.",
      privacyConsentAt: new Date("2026-11-11T10:00:00.000Z"),
      privacyNoticeVersion: "1.0.0",
      retentionExpiresAt: new Date("2027-05-10T10:00:00.000Z"),
      createdAt: new Date("2026-11-11T10:00:00.000Z"),
      cursorTimestamp: "2026-11-11 10:00:00.000000+00",
    }, {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cursorTimestamp: "2026-11-10 10:00:00.000000+00",
    }];
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, callback: (tx: unknown) => Promise<unknown>) => {
      const builder: Record<string, ReturnType<typeof vi.fn>> = {};
      builder.from = vi.fn(() => builder);
      builder.where = vi.fn(() => builder);
      builder.orderBy = vi.fn(() => builder);
      builder.limit = vi.fn(async (limit: number) => mocks.rows.slice(0, limit));
      return callback({ select: vi.fn(() => builder) });
    });
    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/admin/site/enquiries/export?limit=1",
      headers: { host: "api.example.test" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-disposition"]).toContain("site-enquiries-page.json");
    expect(mocks.requireActiveTenantPermission).toHaveBeenCalledWith(expect.anything(), { enquiry: ["export"] });
    expect(response.json().enquiries).toHaveLength(1);
    expect(response.json().enquiries[0]).not.toHaveProperty("cursorTimestamp");
    expect(response.json().hasMore).toBe(true);
    expect(response.json().nextCursor).toBeTruthy();
    await app.close();
  });

  it("rejects malformed cursors and page sizes before querying private records", async () => {
    const app = await createApp();
    const cursorResponse = await app.inject({ method: "GET", url: "/v1/admin/site/enquiries?cursor=invalid", headers: { host: "api.example.test" } });
    const sizeResponse = await app.inject({ method: "GET", url: "/v1/admin/site/enquiries?limit=501", headers: { host: "api.example.test" } });

    expect(cursorResponse.statusCode).toBe(400);
    expect(sizeResponse.statusCode).toBe(400);
    expect(mocks.withTenantTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("deletes only the selected tenant enquiry and returns not found for invalid IDs", async () => {
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, callback: (tx: unknown) => Promise<unknown>) => callback({
      delete: vi.fn(() => {
        const builder = {
          where: vi.fn(() => builder),
          returning: vi.fn(async () => mocks.deleted),
        };
        return builder;
      }),
    }));
    mocks.deleted = [{ id: enquiryId }];
    const app = await createApp();
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/admin/site/enquiries/${enquiryId}`,
      headers: { host: "api.example.test" },
    });
    const invalidResponse = await app.inject({
      method: "DELETE",
      url: "/v1/admin/site/enquiries/not-a-uuid",
      headers: { host: "api.example.test" },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.requireActiveTenantPermission).toHaveBeenCalledWith(expect.anything(), { enquiry: ["delete"] });
    expect(invalidResponse.statusCode).toBe(404);
    await app.close();
  });
});

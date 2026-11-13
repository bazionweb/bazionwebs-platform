import { describe, expect, it } from "vitest";
import {
  PostgresHostingProvisioningStore,
  type HostingSqlPool,
} from "./provisioning.js";

const tenantId = "11111111-1111-4111-8111-111111111111";

describe("PostgresHostingProvisioningStore", () => {
  it("does not create a second tenant/template resource under a different idempotency key", async () => {
    const statements: string[] = [];
    const client = {
      async query<T = Record<string, unknown>>(statement: string) {
        statements.push(statement);
        let rows: unknown[] = [];
        if (statement.includes("SELECT slug, status FROM public.tenants")) {
          rows = [{ slug: "acme", status: "active" }];
        } else if (statement.includes("SELECT idempotency_key FROM public.tenant_hosting_deployments")) {
          rows = [{ idempotency_key: "first-request-1234" }];
        }
        return { rows: rows as T[], rowCount: rows.length };
      },
      release() {},
    };
    const pool: HostingSqlPool = { connect: async () => client };
    const store = new PostgresHostingProvisioningStore(pool);

    const result = await store.begin({
      tenantId,
      provider: "dokploy",
      template: "node-nextjs",
      templateVersion: "sha256:" + "a".repeat(64),
      idempotencyKey: "second-request-1234",
      actorType: "user",
      actorId: "platform-owner",
    });

    expect(result).toEqual({ kind: "idempotency_conflict" });
    expect(statements.some((statement) => statement.startsWith("INSERT INTO public.tenant_hosting_deployments"))).toBe(false);
    expect(statements.at(-1)).toBe("ROLLBACK");
  });

  it("rejects dedicated hosting provisioning when tenant installations are shared-managed", async () => {
    const statements: string[] = [];
    const client = {
      async query<T = Record<string, unknown>>(statement: string) {
        statements.push(statement);
        let rows: unknown[] = [];
        if (statement.includes("SELECT slug, status FROM public.tenants")) {
          rows = [{ slug: "acme", status: "active" }];
        } else if (statement.includes("FROM public.product_installations")) {
          rows = [{ distribution_mode: "shared-managed", status: "ready" }];
        }
        return { rows: rows as T[], rowCount: rows.length };
      },
      release() {},
    };
    const store = new PostgresHostingProvisioningStore({ connect: async () => client });
    const result = await store.begin({
      tenantId,
      provider: "dokploy",
      template: "node-nextjs",
      templateVersion: "sha256:" + "a".repeat(64),
      idempotencyKey: "req-shared-managed-check",
      actorType: "service",
      actorId: "commercial-provisioning-saga",
    });

    expect(result).toEqual({ kind: "dedicated_installation_required" });
    expect(statements.some((statement) => statement.startsWith("INSERT INTO public.tenant_hosting_deployments"))).toBe(false);
    expect(statements.at(-1)).toBe("ROLLBACK");
  });
});

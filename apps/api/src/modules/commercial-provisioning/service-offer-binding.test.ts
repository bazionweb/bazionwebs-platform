import { describe, expect, it, vi } from "vitest";
import { CommercialProvisioningService } from "./service.js";
import type { CommercialSqlPool, SqlClient, SqlResult } from "./service.js";
import { SubscriptionLifecycleService } from "./lifecycle-service.js";
import type { PostgresAuditEventWriter } from "@bazion/audit";
import { integrationOfferBinding } from "./offer-resolution.test-fixtures.js";

const request = {
  schemaVersion: "1.0.0",
  eventId: "11111111-1111-4111-8111-111111111111",
  correlationId: "22222222-2222-4222-8222-222222222222",
  idempotencyKey: "bazionweb:order:test:line:0:v1",
  occurredAt: "2026-11-12T08:00:00.000Z",
  source: "bazionweb",
  customer: {
    externalCustomerId: "customer-1",
    displayName: "Acacia Ltd",
    primaryContact: { name: "Grace Wanjiku", email: "grace@example.test" },
  },
  order: {
    externalOrderId: "order-unbound-1",
    offerId: "website-business",
    offerVersion: "2026.1.0",
  },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
};

describe("provisioning intake offer gate", () => {
  it("rejects an unbound offer before inserting any provisioning operation", async () => {
    const statements: string[] = [];
    const client: SqlClient = {
      async query<T = Record<string, unknown>>(statement: string): Promise<SqlResult<T>> {
        statements.push(statement);
        return { rows: [], rowCount: 0 };
      },
      release: vi.fn(),
    };
    const pool: CommercialSqlPool = {
      connect: vi.fn(async () => client),
      async query<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
        return { rows: [], rowCount: 0 };
      },
    };
    const service = new CommercialProvisioningService(pool);

    await expect(service.acceptCommand(request)).rejects.toMatchObject({
      statusCode: 422,
      code: "PROVISIONING_OFFER_NOT_BOUND",
    });
    expect(statements.some((statement) => statement.includes("INSERT INTO public.product_provisioning_operations"))).toBe(false);
    expect(statements).toContain("ROLLBACK");
  });

  it("accepts a valid binding supplied to the test runtime", async () => {
    const statements: string[] = [];
    const client: SqlClient = {
      async query<T = Record<string, unknown>>(statement: string): Promise<SqlResult<T>> {
        statements.push(statement);
        const rows = statement.includes("INSERT INTO public.product_provisioning_operations")
          ? [{
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              schema_version: "1.0.0",
              correlation_id: request.correlationId,
              external_order_id: request.order.externalOrderId,
              status: "accepted",
              current_step: "accept_command",
              tenant_id: null,
              installation_id: null,
              failure_code: null,
              failure_retryable: null,
              updated_at: "2026-11-12T08:00:01.000Z",
            }] as T[]
          : [];
        return { rows, rowCount: rows.length };
      },
      release: vi.fn(),
    };
    const pool: CommercialSqlPool = {
      connect: vi.fn(async () => client),
      async query<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
        return { rows: [], rowCount: 0 };
      },
    };
    const service = new CommercialProvisioningService(pool, [integrationOfferBinding]);

    const result = await service.acceptCommand(request);

    expect(result).toMatchObject({ deduplicated: false, operation: { status: "accepted" } });
    expect(statements.some((statement) => statement.includes("INSERT INTO public.product_provisioning_operations"))).toBe(true);
  });

  it("rejects unsupported schemaVersion values before opening a database transaction", async () => {
    const connect = vi.fn();
    const pool: CommercialSqlPool = {
      connect,
      async query<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
        return { rows: [], rowCount: 0 };
      },
    };
    const service = new CommercialProvisioningService(pool, [integrationOfferBinding]);

    for (const unsupportedVersion of ["2.0.0", "0.9.0", "1.1.0"]) {
      await expect(
        service.acceptCommand({ ...request, schemaVersion: unsupportedVersion }),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(connect).not.toHaveBeenCalled();
  });

  it("rejects unsupported lifecycle command schemaVersion values before opening a database transaction", async () => {
    const connect = vi.fn();
    const pool: CommercialSqlPool = {
      connect,
      async query<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
        return { rows: [], rowCount: 0 };
      },
    };
    const auditWriter = {
      append: vi.fn(async () => {}),
    } as unknown as PostgresAuditEventWriter;
    const lifecycleService = new SubscriptionLifecycleService(pool, auditWriter);

    const baseCommand = {
      schemaVersion: "1.0.0",
      eventId: "33333333-3333-4333-8333-333333333333",
      correlationId: "44444444-4444-4444-8444-444444444444",
      idempotencyKey: "bazionweb:sub:sub-100:suspend:v1",
      occurredAt: "2026-11-12T08:00:00.000Z",
      effectiveAt: "2026-11-12T08:00:00.000Z",
      source: "bazionweb",
      action: "suspend",
      subscriptionId: "sub-100",
      externalCustomerId: "customer-1008",
      externalOrderId: "order-2026-0042:line:0",
      installationId: "4954ba5a-6c50-4881-a3bc-c43076c7abc8",
      reasonCode: "DUNNING_EXHAUSTED",
    };

    for (const unsupportedVersion of ["2.0.0", "0.9.0", "1.1.0"]) {
      await expect(
        lifecycleService.applySignedCommand(
          { ...baseCommand, schemaVersion: unsupportedVersion },
          { requestId: "req-version-check", actorClientId: "bazionweb-test" },
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    expect(connect).not.toHaveBeenCalled();
  });
});

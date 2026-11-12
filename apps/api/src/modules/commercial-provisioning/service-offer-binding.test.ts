import { describe, expect, it, vi } from "vitest";
import { CommercialProvisioningService } from "./service.js";
import type { CommercialSqlPool, SqlClient, SqlResult } from "./service.js";
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
});

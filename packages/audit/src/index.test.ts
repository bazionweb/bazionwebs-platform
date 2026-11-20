import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  PostgresAuditEventReader,
  PostgresAuditEventWriter,
  serializeAuditEventsCsv,
  serializeAuditEventsJson,
  type AuditSqlExecutor,
} from "./index.js";

describe("PostgresAuditEventWriter", () => {
  it("inserts safe audit metadata without returning sensitive payloads", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const writer = new PostgresAuditEventWriter({ query } as unknown as AuditSqlExecutor);

    await writer.append({
      actorType: "user",
      actorId: "platform-user-1",
      actorRole: "platform_admin",
      action: "tenant.provisioning.reconciliation.started",
      resourceType: "tenant_registry",
      outcome: "succeeded",
      requestId: "request-1",
      metadata: { staleMinutes: 10, limit: 100 },
    });

    expect(query).toHaveBeenCalledOnce();
    const [statement, values] = query.mock.calls[0] as [string, unknown[]];
    expect(statement).toContain("INSERT INTO public.platform_audit_events");
    expect(values).toEqual([
      null,
      "user",
      "platform-user-1",
      "platform_admin",
      "tenant.provisioning.reconciliation.started",
      "tenant_registry",
      null,
      "succeeded",
      "request-1",
      JSON.stringify({ staleMinutes: 10, limit: 100 }),
    ]);
  });

  it("rejects sensitive metadata keys", async () => {
    const query = vi.fn();
    const writer = new PostgresAuditEventWriter({ query } as unknown as AuditSqlExecutor);
    await expect(writer.append({
      actorType: "user",
      actorId: "u1",
      action: "auth.password.reset",
      resourceType: "user",
      outcome: "succeeded",
      metadata: { resetToken: "must-not-be-written" },
    })).rejects.toThrow(/not permitted/);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects oversized and invalid values", async () => {
    const query = vi.fn();
    const writer = new PostgresAuditEventWriter({ query } as unknown as AuditSqlExecutor);
    await expect(writer.append({
      actorType: "user",
      actorId: "u1",
      action: "bad",
      resourceType: "user",
      outcome: "succeeded",
      metadata: { count: Number.POSITIVE_INFINITY },
    })).rejects.toThrow(/finite/);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("PostgresAuditEventReader and exports", () => {
  it("builds filtered queries and maps database rows", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ total: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "evt-1",
            occurred_at: "2026-11-18T10:00:00.000Z",
            tenant_id: "t-1",
            actor_type: "user",
            actor_id: "u-1",
            actor_role: "owner",
            action: "commerce.order.refunded",
            resource_type: "order",
            resource_id: "ord-1",
            outcome: "succeeded",
            request_id: "req-1",
            metadata: { restocked: true },
          },
        ],
      });

    const reader = new PostgresAuditEventReader({ query } as unknown as AuditSqlExecutor);
    const result = await reader.list({
      tenantId: "t-1",
      outcome: "succeeded",
      search: "refund",
      limit: 25,
      offset: 0,
    });

    expect(DEFAULT_AUDIT_RETENTION_DAYS).toBe(2555);
    expect(result.total).toBe(1);
    expect(result.items[0]?.action).toBe("commerce.order.refunded");
    const csv = serializeAuditEventsCsv(result.items);
    expect(csv).toContain("id,occurredAt,tenantId");
    expect(csv).toContain("commerce.order.refunded");
    const json = serializeAuditEventsJson(result.items);
    expect(JSON.parse(json).count).toBe(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { PostgresAuditEventWriter, type AuditSqlExecutor } from "./index.js";

describe("PostgresAuditEventWriter", () => {
  it("inserts safe audit metadata without returning sensitive payloads", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const writer = new PostgresAuditEventWriter({ query } as AuditSqlExecutor);

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
    const writer = new PostgresAuditEventWriter({ query } as AuditSqlExecutor);
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
    const writer = new PostgresAuditEventWriter({ query } as AuditSqlExecutor);
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

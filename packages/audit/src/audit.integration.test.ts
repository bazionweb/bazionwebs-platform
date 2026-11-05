import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresAuditEventWriter } from "./index.js";

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const enabled = Boolean(runtimeUrl && migrationUrl);

describe.skipIf(!enabled)("platform audit database append-only policy", () => {
  let runtime: Pool | undefined;
  let owner: Pool | undefined;
  let writer: PostgresAuditEventWriter | undefined;

  beforeAll(() => {
    runtime = new Pool({ connectionString: runtimeUrl, max: 1 });
    owner = new Pool({ connectionString: migrationUrl, max: 1 });
    writer = new PostgresAuditEventWriter(runtime);
  });

  afterAll(async () => {
    await Promise.all([runtime?.end(), owner?.end()]);
  });

  it("allows runtime inserts while denying mutation and confirms the database trigger", async () => {
    const requestId = `audit-integration:${randomUUID()}`;
    const privileges = await runtime!.query<{
      can_insert: boolean;
      can_select: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(
      `SELECT
         has_table_privilege(current_user, 'public.platform_audit_events', 'INSERT') AS can_insert,
         has_table_privilege(current_user, 'public.platform_audit_events', 'SELECT') AS can_select,
         has_table_privilege(current_user, 'public.platform_audit_events', 'UPDATE') AS can_update,
         has_table_privilege(current_user, 'public.platform_audit_events', 'DELETE') AS can_delete`,
    );
    expect(privileges.rows[0]).toEqual({
      can_insert: true,
      can_select: false,
      can_update: false,
      can_delete: false,
    });

    await writer!.append({
      actorType: "system",
      actorId: "audit-integration-test",
      action: "audit.integration.appended",
      resourceType: "audit_test",
      outcome: "succeeded",
      requestId,
      metadata: { suite: "database-policy" },
    });

    const stored = await owner!.query<{ id: string }>(
      "SELECT id FROM public.platform_audit_events WHERE request_id = $1",
      [requestId],
    );
    expect(stored.rows).toHaveLength(1);

    const triggers = await owner!.query<{ tgname: string }>(
      `SELECT tgname
         FROM pg_trigger
        WHERE tgrelid = 'public.platform_audit_events'::regclass
          AND NOT tgisinternal
          AND tgname = 'platform_audit_events_append_only'`,
    );
    expect(triggers.rows).toHaveLength(1);
  });
});

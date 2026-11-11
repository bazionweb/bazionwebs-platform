import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

const enabled = Boolean(process.env.MIGRATION_DATABASE_URL && process.env.PRODUCT_PROVISIONER_DATABASE_URL);

async function withTenant<T>(pool: Pool, tenantId: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

describe.skipIf(!enabled)("PostgreSQL product installation registry and saga journal", () => {
  let migrationPool: Pool;
  let provisionerPool: Pool;
  let tenantId: string;

  beforeAll(async () => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 1 });
    provisionerPool = new Pool({ connectionString: process.env.PRODUCT_PROVISIONER_DATABASE_URL, max: 2 });
    const tenant = await migrationPool.query<{ id: string }>(
      "INSERT INTO public.tenants (slug, name, default_currency) VALUES ($1, $2, 'KES') RETURNING id",
      [`provisioning-test-${randomUUID()}`, "Provisioning integration test"],
    );
    tenantId = tenant.rows[0]!.id;
    await provisionerPool.query("SELECT 1");
  });

  afterAll(async () => {
    await provisionerPool?.end();
    await migrationPool?.end();
  });

  it("accepts one immutable command, records attempts and operation history, and scopes installations by tenant", async () => {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const idempotencyKey = `integration-${randomUUID()}`;
    const externalOrderId = `order-${randomUUID()}`;
    const operationResult = await provisionerPool.query<{ id: string }>(
      `INSERT INTO public.product_provisioning_operations (
        schema_version, source, event_id, correlation_id, idempotency_key, request_fingerprint,
        external_customer_id, external_order_id, offer_id, offer_version,
        product_id, product_version, solution_id, solution_version, template_id, template_version
      ) VALUES ('1.0.0', 'bazionweb', $1, $2, $3, repeat('a', 64), 'customer-test', $4,
        'church-site', '1.0.0', 'church-ministry', '1.0.0', 'global-mission', '1.0.0', 'church-template', '1.0.0')
      RETURNING id`,
      [eventId, correlationId, idempotencyKey, externalOrderId],
    );
    const operationId = operationResult.rows[0]!.id;

    await expect(provisionerPool.query(
      `INSERT INTO public.product_provisioning_operations (
        schema_version, source, event_id, correlation_id, idempotency_key, request_fingerprint,
        external_customer_id, external_order_id, offer_id, offer_version,
        product_id, product_version, solution_id, solution_version, template_id, template_version
      ) VALUES ('1.0.0', 'bazionweb', $1, $2, $3, repeat('a', 64), 'customer-test', $4,
        'church-site', '1.0.0', 'church-ministry', '1.0.0', 'global-mission', '1.0.0', 'church-template', '1.0.0')`,
      [randomUUID(), randomUUID(), idempotencyKey, `duplicate-${randomUUID()}`],
    )).rejects.toMatchObject({ code: "23505" });

    const installation = await withTenant(provisionerPool, tenantId, (client) => client.query<{ id: string }>(
      `INSERT INTO public.product_installations (
        tenant_id, external_customer_id, external_order_id,
        product_id, product_version, solution_id, solution_version, template_id, template_version,
        configuration_schema_version, idempotency_key, request_fingerprint
      ) VALUES ($1, 'customer-test', $2, 'church-ministry', '1.0.0', 'global-mission', '1.0.0', 'church-template', '1.0.0',
        '1.0.0', $3, repeat('a', 64))
      RETURNING id`,
      [tenantId, externalOrderId, idempotencyKey],
    ));
    const installationId = installation.rows[0]!.id;

    await withTenant(provisionerPool, tenantId, async (client) => {
      await client.query(
        `INSERT INTO public.product_provisioning_step_attempts
          (operation_id, step_name, direction, attempt_number, status, effect_refs, finished_at)
         VALUES ($1, 'ensure_tenant', 'forward', 1, 'succeeded', '{"tenant_ref":"tenant-a"}'::jsonb, now())`,
        [operationId],
      );
    });
    await expect(withTenant(provisionerPool, tenantId, (client) => client.query(
      `INSERT INTO public.product_provisioning_step_attempts
        (operation_id, step_name, direction, attempt_number, status, effect_refs, finished_at)
       VALUES ($1, 'ensure_tenant', 'forward', 2, 'succeeded', '{"access_token":"must-not-persist"}'::jsonb, now())`,
      [operationId],
    ))).rejects.toMatchObject({ code: "23514" });

    await provisionerPool.query("UPDATE public.product_provisioning_operations SET status = 'validating' WHERE id = $1", [operationId]);
    await provisionerPool.query("UPDATE public.product_provisioning_operations SET status = 'provisioning_tenant' WHERE id = $1", [operationId]);
    await provisionerPool.query("UPDATE public.product_provisioning_operations SET status = 'configuring_installation', tenant_id = $2, installation_id = $3 WHERE id = $1", [operationId, tenantId, installationId]);
    await provisionerPool.query("UPDATE public.product_provisioning_operations SET status = 'ready' WHERE id = $1", [operationId]);

    const hidden = await provisionerPool.query("SELECT id FROM public.product_installations WHERE id = $1", [installationId]);
    expect(hidden.rows).toHaveLength(0);
    const visible = await withTenant(provisionerPool, tenantId, (client) => client.query("SELECT id FROM public.product_installations WHERE id = $1", [installationId]));
    expect(visible.rows).toHaveLength(1);

    const history = await provisionerPool.query<{ event_count: number; step_count: number; status: string; finished_at: Date | null }>(
      `SELECT (SELECT count(*)::int FROM public.product_provisioning_operation_events WHERE operation_id = $1) AS event_count,
              (SELECT count(*)::int FROM public.product_provisioning_step_attempts WHERE operation_id = $1) AS step_count,
              status, finished_at
         FROM public.product_provisioning_operations WHERE id = $1`,
      [operationId],
    );
    expect(history.rows[0]).toMatchObject({ status: "ready", event_count: 5, step_count: 1 });
    expect(history.rows[0]?.finished_at).toBeInstanceOf(Date);
    await expect(provisionerPool.query("SELECT id FROM public.products LIMIT 1"))
      .rejects.toMatchObject({ code: "42501" });
  });
});

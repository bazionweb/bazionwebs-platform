import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

type TenantFixture = {
  tenantId: string;
  productId: string;
  cartId: string;
  orderId: string;
  hostname: string;
  pendingHostname: string;
};

const enabled = Boolean(
  process.env.TENANT_ISOLATION_TEST_DATABASE_URL
  && process.env.MIGRATION_DATABASE_URL
  && process.env.TENANT_RESOLVER_DATABASE_URL
);

async function withTenant<T>(
  pool: Pool,
  tenantId: string,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
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

describe.skipIf(!enabled)("PostgreSQL tenant isolation (real roles and RLS)", () => {
  let migrationPool: Pool;
  let appPool: Pool;
  let resolverPool: Pool;
  let provisionerPool: Pool;
  const fixtures: TenantFixture[] = [];

  async function seedTenant(label: string): Promise<TenantFixture> {
    const unique = randomUUID();
    const tenantResult = await migrationPool.query<{ id: string }>(
      "INSERT INTO public.tenants (slug, name, default_currency) VALUES ($1, $2, 'KES') RETURNING id",
      [`rls-${label}-${unique.slice(0, 8)}`, `RLS test ${label}`],
    );
    const tenantId = tenantResult.rows[0]!.id;
    const fixture: TenantFixture = {
      tenantId,
      productId: "",
      cartId: "",
      orderId: "",
      hostname: `${label}-${unique.slice(0, 8)}.verified.example.test`,
      pendingHostname: `${label}-${unique.slice(0, 8)}.pending.example.test`,
    };
    await withTenant(migrationPool, tenantId, async (client) => {
      await client.query(
        "INSERT INTO public.commerce_store_settings (tenant_id, store_name) VALUES ($1, $2)",
        [tenantId, `Tenant ${label} shop`],
      );
      const product = await client.query<{ id: string }>(
        `INSERT INTO public.products
          (tenant_id, sku, slug, name, currency, price_minor, stock_tracked, stock_on_hand, stock_reserved, active)
         VALUES ($1, $2, $3, $4, 'KES', 125000, true, 12, 0, true)
         RETURNING id`,
        [tenantId, `SKU-${label}-${unique.slice(0, 8)}`, `tenant-${label}-${unique.slice(0, 8)}-product`, `Tenant ${label} product`],
      );
      fixture.productId = product.rows[0]!.id;

      const cart = await client.query<{ id: string }>(
        `INSERT INTO public.carts (tenant_id, currency, guest_token_hash, expires_at)
         VALUES ($1, 'KES', $2, now() + interval '1 day') RETURNING id`,
        [tenantId, unique.padEnd(64, "0").slice(0, 64)],
      );
      fixture.cartId = cart.rows[0]!.id;

      await client.query(
        `INSERT INTO public.cart_items (tenant_id, cart_id, product_id, quantity, unit_price_minor)
         VALUES ($1, $2, $3, 1, 125000)`,
        [tenantId, fixture.cartId, fixture.productId],
      );

      const order = await client.query<{ id: string }>(
        `INSERT INTO public.orders
          (tenant_id, order_number, cart_id, status, currency, subtotal_minor, discount_minor,
           shipping_minor, tax_minor, total_minor, customer_name, customer_email, customer_phone, shipping_address)
         VALUES ($1, $2, $3, 'pending_payment', 'KES', 125000, 0, 0, 0, 125000,
                 'RLS Test', $4, '+254700000000', '{"country":"KE"}'::jsonb)
         RETURNING id`,
        [tenantId, `RLS-${label}-${unique.slice(0, 8)}`, fixture.cartId, `${label}-${unique.slice(0, 8)}@example.test`],
      );
      fixture.orderId = order.rows[0]!.id;

      await client.query(
        `INSERT INTO public.order_items
          (tenant_id, order_id, product_id, sku_snapshot, name_snapshot, quantity,
           reserved_quantity, unit_price_minor, line_total_minor)
         VALUES ($1, $2, $3, $4, $5, 1, 0, 125000, 125000)`,
        [tenantId, fixture.orderId, fixture.productId, `SKU-${label}`, `Tenant ${label} product`],
      );

      await client.query(
        `INSERT INTO public.payment_attempts
          (tenant_id, order_id, provider, status, amount_minor, currency, idempotency_key)
         VALUES ($1, $2, 'mock', 'created', 125000, 'KES', $3)`,
        [tenantId, fixture.orderId, `payment-${unique}`],
      );

      await client.query(
        `INSERT INTO public.webhook_events (tenant_id, provider, provider_event_id, event_type)
         VALUES ($1, 'mock', $2, 'payment.created')`,
        [tenantId, `event-${unique}`],
      );

      await client.query(
        `INSERT INTO public.idempotency_records (tenant_id, key, request_hash, resource_id)
         VALUES ($1, $2, $3, $4)`,
        [tenantId, `key-${unique}`, "a".repeat(64), fixture.orderId],
      );
    });

    await migrationPool.query(
      `INSERT INTO public.tenant_domains (tenant_id, hostname, verification_token_hash, status, verified_at)
       VALUES ($1, $2, $3, 'active', now()), ($1, $4, $5, 'pending', NULL)`,
      [tenantId, fixture.hostname, "b".repeat(64), fixture.pendingHostname, "c".repeat(64)],
    );
    return fixture;
  }

  beforeAll(async () => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 3 });
    appPool = new Pool({ connectionString: process.env.TENANT_ISOLATION_TEST_DATABASE_URL, max: 3 });
    resolverPool = new Pool({ connectionString: process.env.TENANT_RESOLVER_DATABASE_URL, max: 2 });
    if (process.env.TENANT_PROVISIONER_DATABASE_URL) {
      provisionerPool = new Pool({ connectionString: process.env.TENANT_PROVISIONER_DATABASE_URL, max: 1 });
    }
    await migrationPool.query("SELECT 1");
    await appPool.query("SELECT 1");
    await resolverPool.query("SELECT 1");
    fixtures.push(await seedTenant("alpha"));
    fixtures.push(await seedTenant("beta"));
  });

  afterAll(async () => {
    for (const fixture of fixtures) {
      try {
        await withTenant(migrationPool, fixture.tenantId, async (client) => {
          await client.query("DELETE FROM public.idempotency_records WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.webhook_events WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.payment_attempts WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.order_items WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.orders WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.cart_items WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.carts WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.products WHERE tenant_id = $1", [fixture.tenantId]);
        });
        await migrationPool.query("DELETE FROM public.tenant_domains WHERE tenant_id = $1", [fixture.tenantId]);
        await migrationPool.query("DELETE FROM public.tenants WHERE id = $1", [fixture.tenantId]);
      } catch {
        // Preserve the original failing test result; disposable CI databases are reset per run.
      }
    }
    await Promise.all(
      [migrationPool, appPool, resolverPool, provisionerPool]
        .filter((pool): pool is Pool => Boolean(pool))
        .map((pool) => pool.end()),
    );
  });

  it("forces RLS on every tenant-owned table and keeps the runtime role unprivileged", async () => {
    const tables = ["products", "commerce_store_settings", "carts", "cart_items", "orders", "order_items", "payment_attempts", "webhook_events", "idempotency_records"];
    const flags = await migrationPool.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
      [tables],
    );
    expect(new Set(flags.rows.map((row) => row.relname))).toEqual(new Set(tables));
    expect(flags.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true);

    const role = await migrationPool.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'bazion_app'",
    );
    expect(role.rows).toHaveLength(1);
    expect(role.rows[0]).toMatchObject({ rolsuper: false, rolbypassrls: false });

    const owner = await migrationPool.query<{ owner: string }>(
      "SELECT pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid = 'public.products'::regclass",
    );
    expect(owner.rows[0]?.owner).not.toBe("bazion_app");
  });

  it("isolates reads across all tenant-owned business tables", async () => {
    const alpha = fixtures[0]!;
    const beta = fixtures[1]!;
    const tables = ["products", "commerce_store_settings", "carts", "cart_items", "orders", "order_items", "payment_attempts", "webhook_events", "idempotency_records"];
    const result = await withTenant(appPool, alpha.tenantId, async (client) => {
      const counts: Record<string, number> = {};
      for (const table of tables) {
        const rows = await client.query<{ tenant_id: string }>(`SELECT tenant_id FROM public.${table}`);
        counts[table] = rows.rowCount ?? 0;
        expect(rows.rows.every((row) => row.tenant_id === alpha.tenantId)).toBe(true);
        expect(rows.rows.some((row) => row.tenant_id === beta.tenantId)).toBe(false);
      }
      return counts;
    });
    for (const table of tables) expect(result[table]).toBe(1);
  });

  it("returns no tenant rows when the runtime role has no transaction-local tenant context", async () => {
    const result = await appPool.query<{ count: string }>("SELECT count(*)::text AS count FROM public.products");
    expect(result.rows[0]?.count).toBe("0");
  });

  it("prevents tenant-id spoofing on writes and silently scopes updates to the current tenant", async () => {
    const alpha = fixtures[0]!;
    const beta = fixtures[1]!;
    const updated = await withTenant(appPool, alpha.tenantId, (client) =>
      client.query("UPDATE public.products SET name = 'cross-tenant mutation' WHERE id = $1 RETURNING id", [beta.productId]),
    );
    expect(updated.rowCount).toBe(0);
    const settingsUpdated = await withTenant(appPool, alpha.tenantId, (client) =>
      client.query("UPDATE public.commerce_store_settings SET store_name = 'cross-tenant mutation' WHERE tenant_id = $1 RETURNING tenant_id", [beta.tenantId]),
    );
    expect(settingsUpdated.rowCount).toBe(0);

    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [alpha.tenantId]);
      await expect(client.query(
        `INSERT INTO public.carts (tenant_id, currency, guest_token_hash, expires_at)
         VALUES ($1, 'KES', $2, now() + interval '1 day')`,
        [beta.tenantId, "d".repeat(64)],
      )).rejects.toMatchObject({ code: "42501" });
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });

  it("rejects cross-tenant foreign-key references even when the row tenant id is valid", async () => {
    const alpha = fixtures[0]!;
    const beta = fixtures[1]!;
    const client = await appPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [alpha.tenantId]);
      await expect(client.query(
        `INSERT INTO public.cart_items (tenant_id, cart_id, product_id, quantity, unit_price_minor)
         VALUES ($1, $2, $3, 1, 125000)`,
        [alpha.tenantId, alpha.cartId, beta.productId],
      )).rejects.toMatchObject({ code: "23503" });
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });

  it("exposes only active verified hostnames to the resolver role", async () => {
    const alpha = fixtures[0]!;
    const verified = await resolverPool.query(
      "SELECT hostname, tenant_id FROM public.tenant_domain_directory WHERE hostname = $1",
      [alpha.hostname],
    );
    const pending = await resolverPool.query(
      "SELECT hostname FROM public.tenant_domain_directory WHERE hostname = $1",
      [alpha.pendingHostname],
    );
    expect(verified.rows).toHaveLength(1);
    expect(verified.rows[0].tenant_id).toBe(alpha.tenantId);
    expect(pending.rows).toHaveLength(0);

    await expect(resolverPool.query("SELECT verification_token_hash FROM public.tenant_domains LIMIT 1"))
      .rejects.toMatchObject({ code: "42501" });
    await expect(resolverPool.query("SELECT id FROM public.products LIMIT 1"))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("keeps the provisioner away from commerce records", async () => {
    if (!provisionerPool) return;
    await expect(provisionerPool.query("SELECT id FROM public.products LIMIT 1"))
      .rejects.toMatchObject({ code: "42501" });
    const result = await provisionerPool.query("SELECT count(*)::int AS count FROM public.tenants");
    expect(result.rows[0]?.count).toBeGreaterThanOrEqual(2);
  });
});

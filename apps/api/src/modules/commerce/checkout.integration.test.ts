import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { Pool, type PoolClient } from "pg";
import type { AppConfig } from "../../config.js";

const enabled = Boolean(
  process.env.DATABASE_URL
  && process.env.MIGRATION_DATABASE_URL
  && process.env.TENANT_RESOLVER_DATABASE_URL,
);

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

describe.skipIf(!enabled)("commerce checkout PostgreSQL integration", () => {
  let migrationPool: Pool;
  let appPool: Pool;
  let closeTenantDatabaseResources: () => Promise<void>;
  let app: FastifyInstance;
  let tenantId: string | undefined;
  let productId: string | undefined;
  let cartId: string | undefined;
  let orderId: string | undefined;
  let host: string;
  let cartCookie: string;

  beforeAll(async () => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 });
    const database = await import("../../lib/database.js");
    appPool = database.pool;
    closeTenantDatabaseResources = database.closeTenantDatabaseResources;

    const { commerceRoutes } = await import("./routes.js");
    const unique = randomUUID();
    const tenant = await migrationPool.query<{ id: string }>(
      "INSERT INTO public.tenants (slug, name, default_currency) VALUES ($1, $2, 'KES') RETURNING id",
      [`commerce-checkout-${unique.slice(0, 8)}`, `Commerce checkout test ${unique.slice(0, 8)}`],
    );
    tenantId = tenant.rows[0]!.id;
    host = `checkout-${unique.slice(0, 8)}.example.test`;

    await withTenant(migrationPool, tenantId, async (client) => {
      await client.query(
        "INSERT INTO public.commerce_store_settings (tenant_id, supported_currencies, default_currency, shipping_rates, shipping_countries) VALUES ($1, ARRAY['KES'], 'KES', '{\"KES\":250}'::jsonb, ARRAY['KE'])",
        [tenantId],
      );
      const product = await client.query<{ id: string }>(
        `INSERT INTO public.products
          (tenant_id, sku, slug, name, category, currency, price_minor, stock_tracked, stock_on_hand, stock_reserved, active)
         VALUES ($1, $2, $3, 'Integration product', 'Books', 'KES', 125000, true, 10, 0, true)
         RETURNING id`,
        [tenantId, `TEST-${unique.slice(0, 8)}`, `checkout-${unique.slice(0, 8)}`],
      );
      productId = product.rows[0]!.id;
    });

    app = Fastify();
    await app.register(commerceRoutes, {
      prefix: "/v1",
      config: {
        NODE_ENV: "test",
        DEFAULT_TENANT_ID: tenantId,
        TENANT_RESOLUTION_MODE: "static",
        PAYMENT_PROVIDER: "mock",
        PUBLIC_STOREFRONT_URL: "http://localhost:3100",
        DEV_PAYMENT_SECRET: "integration-test-secret",
        mpesa: null,
      } as AppConfig,
    });
    app.setErrorHandler((error, _request, reply) => {
      const candidate = error as { statusCode?: number; code?: string };
      return reply.code(candidate.statusCode ?? 500).send({ error: candidate.code ?? "INTERNAL_ERROR" });
    });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    if (tenantId) {
      await withTenant(migrationPool, tenantId, async (client) => {
        await client.query("DELETE FROM public.idempotency_records WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.webhook_events WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.payment_attempts WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.order_items WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.orders WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.cart_items WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.carts WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.products WHERE tenant_id = $1", [tenantId]);
        await client.query("DELETE FROM public.commerce_store_settings WHERE tenant_id = $1", [tenantId]);
      });
      await migrationPool.query("DELETE FROM public.tenants WHERE id = $1", [tenantId]);
    }
    await Promise.all([
      migrationPool?.end(),
      appPool?.end(),
      closeTenantDatabaseResources?.(),
    ]);
  });

  it("keeps checkout idempotent and consumes only the reserved stock after payment", async () => {
    const createdCart = await app.inject({
      method: "POST",
      url: "/v1/carts",
      headers: { host },
      payload: { currency: "KES" },
    });
    expect(createdCart.statusCode).toBe(201);
    cartId = createdCart.json<{ id: string }>().id;
    const cookieHeader = createdCart.headers["set-cookie"];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    cartCookie = cookie?.split(";", 1)[0] ?? "";
    expect(cartCookie).toMatch(/^bw_cart_[0-9a-f]+=/);

    const addItem = await app.inject({
      method: "POST",
      url: `/v1/carts/${cartId}/items`,
      headers: { host, cookie: cartCookie },
      payload: { productId, quantity: 2 },
    });
    expect(addItem.statusCode).toBe(200);
    expect(addItem.json<{ totals: { totalMinor: number } }>().totals.totalMinor).toBe(250000);

    const checkoutBody = {
      cartId,
      customer: { name: "Commerce Test", email: "commerce-test@example.test", phone: "+254700000000" },
      shippingAddress: { line1: "1 Test Road", city: "Nairobi", countryCode: "KE" },
    };
    const idempotencyKey = `commerce-checkout-${randomUUID()}`;
    const checkoutHeaders = { host, cookie: cartCookie, "idempotency-key": idempotencyKey };
    const firstCheckout = await app.inject({ method: "POST", url: "/v1/checkout", headers: checkoutHeaders, payload: checkoutBody });
    expect(firstCheckout.statusCode).toBe(201);
    const checkout = firstCheckout.json<{ orderId: string; reused: boolean; totalMinor: number }>();
    orderId = checkout.orderId;
    expect(checkout).toMatchObject({ reused: false, totalMinor: 250250 });

    const replay = await app.inject({ method: "POST", url: "/v1/checkout", headers: checkoutHeaders, payload: checkoutBody });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ orderId, reused: true, totalMinor: 250250 });

    const conflictingReplay = await app.inject({
      method: "POST",
      url: "/v1/checkout",
      headers: checkoutHeaders,
      payload: { ...checkoutBody, shippingAddress: { ...checkoutBody.shippingAddress, line1: "2 Other Road" } },
    });
    expect(conflictingReplay.statusCode).toBe(409);

    const pending = await withTenant(migrationPool, tenantId!, async (client) => {
      const product = await client.query<{ stock_on_hand: number; stock_reserved: number }>(
        "SELECT stock_on_hand, stock_reserved FROM public.products WHERE id = $1",
        [productId],
      );
      const order = await client.query<{ status: string; total_minor: string }>(
        "SELECT status, total_minor::text FROM public.orders WHERE id = $1",
        [orderId],
      );
      const count = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.orders WHERE tenant_id = $1",
        [tenantId],
      );
      return { product: product.rows[0], order: order.rows[0], orderCount: count.rows[0]?.count };
    });
    expect(pending).toEqual({
      product: { stock_on_hand: 10, stock_reserved: 2 },
      order: { status: "pending_payment", total_minor: "250250" },
      orderCount: 1,
    });

    const paid = await app.inject({
      method: "POST",
      url: `/v1/_dev/orders/${orderId}/pay`,
      headers: { host, "x-dev-secret": "integration-test-secret" },
    });
    expect(paid.statusCode).toBe(200);

    const completed = await withTenant(migrationPool, tenantId!, async (client) => {
      const product = await client.query<{ stock_on_hand: number; stock_reserved: number }>(
        "SELECT stock_on_hand, stock_reserved FROM public.products WHERE id = $1",
        [productId],
      );
      const order = await client.query<{ status: string }>("SELECT status FROM public.orders WHERE id = $1", [orderId]);
      const attempt = await client.query<{ status: string }>(
        "SELECT status FROM public.payment_attempts WHERE order_id = $1",
        [orderId],
      );
      const event = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.webhook_events WHERE tenant_id = $1 AND provider = 'mock'",
        [tenantId],
      );
      return { product: product.rows[0], order: order.rows[0], attempt: attempt.rows[0], events: event.rows[0]?.count };
    });
    expect(completed).toEqual({
      product: { stock_on_hand: 8, stock_reserved: 0 },
      order: { status: "paid" },
      attempt: { status: "succeeded" },
      events: 1,
    });
  });

  it("rejects disabling inventory tracking while stock is reserved", async () => {
    const client = await migrationPool.connect();
    let rejection: unknown;
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query("UPDATE public.products SET stock_reserved = 1 WHERE id = $1", [productId]);
      await client.query("SAVEPOINT before_disabling_tracking");
      try {
        await client.query("UPDATE public.products SET stock_tracked = false WHERE id = $1", [productId]);
      } catch (error) {
        rejection = error;
      }
      await client.query("ROLLBACK TO SAVEPOINT before_disabling_tracking");
      expect(rejection).toMatchObject({ code: "23514", constraint: "products_untracked_reservation_ck" });
      await client.query("UPDATE public.products SET stock_reserved = 0 WHERE id = $1", [productId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
});

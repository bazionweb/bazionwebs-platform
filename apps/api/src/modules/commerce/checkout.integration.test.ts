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

    await migrationPool.query(
      `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
       VALUES ($1, 'commerce', true, 'integration-test')`,
      [tenantId],
    );

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
      await migrationPool.query("DELETE FROM public.tenant_module_entitlements WHERE tenant_id = $1", [tenantId]);
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

    const paymentReplay = await app.inject({
      method: "POST",
      url: `/v1/_dev/orders/${orderId}/pay`,
      headers: { host, "x-dev-secret": "integration-test-secret" },
    });
    expect(paymentReplay.statusCode).toBe(200);
    expect(paymentReplay.json()).toMatchObject({ success: true, kind: "already_paid" });

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

  it("releases stock once after a failed M-Pesa callback and accepts its replay", async () => {
    await withTenant(migrationPool, tenantId!, async (client) => {
      await client.query(
        "UPDATE public.commerce_store_settings SET shipping_rates = '{\"KES\":0}'::jsonb WHERE tenant_id = $1",
        [tenantId],
      );
    });

    const callbackUrls: string[] = [];
    let callbackSequence = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      if (String(input).includes("/oauth/v1/generate")) {
        return new Response(JSON.stringify({ access_token: "integration-token", expires_in: "3600" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const request = JSON.parse(String(init?.body)) as { CallBackURL?: string };
      const sequence = callbackSequence++;
      if (request.CallBackURL) callbackUrls.push(request.CallBackURL);
      return new Response(JSON.stringify({
        ResponseCode: "0",
        MerchantRequestID: `merchant-callback-test-${sequence}`,
        CheckoutRequestID: `checkout-callback-test-${sequence}`,
        CustomerMessage: "Prompt sent",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    const mpesaApp = Fastify();
    try {
      const { commerceRoutes } = await import("./routes.js");
      await mpesaApp.register(commerceRoutes, {
        prefix: "/v1",
        config: {
          NODE_ENV: "test",
          DEFAULT_TENANT_ID: tenantId,
          TENANT_RESOLUTION_MODE: "static",
          PAYMENT_PROVIDER: "mpesa",
          PUBLIC_STOREFRONT_URL: "http://localhost:3100",
          DEV_PAYMENT_SECRET: "integration-test-secret",
          mpesa: {
            environment: "sandbox",
            consumerKey: "integration-key",
            consumerSecret: "integration-secret",
            businessShortCode: "174379",
            passkey: "integration-passkey",
            callbackUrl: "https://payments.example.test/callback",
          },
        } as AppConfig,
      });
      mpesaApp.setErrorHandler((error, _request, reply) => {
        const candidate = error as { statusCode?: number; code?: string };
        return reply.code(candidate.statusCode ?? 500).send({ error: candidate.code ?? "INTERNAL_ERROR" });
      });
      await mpesaApp.ready();

      const createdCart = await mpesaApp.inject({ method: "POST", url: "/v1/carts", headers: { host }, payload: { currency: "KES" } });
      expect(createdCart.statusCode).toBe(201);
      const newCartId = createdCart.json<{ id: string }>().id;
      const cookieHeader = createdCart.headers["set-cookie"];
      const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
      const cartCookie = cookie?.split(";", 1)[0] ?? "";
      const added = await mpesaApp.inject({
        method: "POST",
        url: `/v1/carts/${newCartId}/items`,
        headers: { host, cookie: cartCookie },
        payload: { productId, quantity: 1 },
      });
      expect(added.statusCode).toBe(200);

      const checkout = await mpesaApp.inject({
        method: "POST",
        url: "/v1/checkout",
        headers: {
          host,
          cookie: cartCookie,
          "idempotency-key": `mpesa-failure-${randomUUID()}`,
          "x-payment-status-token": randomUUID(),
        },
        payload: {
          cartId: newCartId,
          customer: { name: "Commerce Test", email: "commerce-test@example.test", phone: "+254700000000" },
          shippingAddress: { line1: "1 Test Road", city: "Nairobi", countryCode: "KE" },
        },
      });
      expect(checkout.statusCode).toBe(202);
      const orderId = checkout.json<{ orderId: string }>().orderId;
      expect(callbackUrls[0]).toBeTruthy();
      const callback = new URL(callbackUrls[0]!);
      const callbackPath = `${callback.pathname}${callback.search}`;
      const callbackBody = {
        Body: { stkCallback: {
          CheckoutRequestID: "checkout-callback-test-0",
          MerchantRequestID: "merchant-callback-test-0",
          ResultCode: 1032,
        } },
      };

      const failed = await mpesaApp.inject({ method: "POST", url: callbackPath, payload: callbackBody });
      expect(failed.statusCode).toBe(200);
      expect(failed.json()).toMatchObject({ ResultCode: 0, ResultDesc: "Accepted" });
      const replay = await mpesaApp.inject({ method: "POST", url: callbackPath, payload: callbackBody });
      expect(replay.statusCode).toBe(200);
      expect(replay.json()).toMatchObject({ ResultCode: 0, ResultDesc: "Already processed" });

      const state = await withTenant(migrationPool, tenantId!, async (client) => {
        const [product] = (await client.query<{ stock_on_hand: number; stock_reserved: number }>(
          "SELECT stock_on_hand, stock_reserved FROM public.products WHERE id = $1",
          [productId],
        )).rows;
        const [order] = (await client.query<{ status: string }>(
          "SELECT status FROM public.orders WHERE id = $1",
          [orderId],
        )).rows;
        const [attempt] = (await client.query<{ status: string }>(
          "SELECT status FROM public.payment_attempts WHERE order_id = $1",
          [orderId],
        )).rows;
        const [item] = (await client.query<{ reserved_quantity: number }>(
          "SELECT reserved_quantity FROM public.order_items WHERE order_id = $1",
          [orderId],
        )).rows;
        const [event] = (await client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.webhook_events WHERE tenant_id = $1 AND provider = 'mpesa' AND provider_event_id = 'checkout-callback-test-0'",
          [tenantId],
        )).rows;
        return { product, order, attempt, item, eventCount: event?.count };
      });
      expect(state).toEqual({
        product: { stock_on_hand: 8, stock_reserved: 0 },
        order: { status: "cancelled" },
        attempt: { status: "failed" },
        item: { reserved_quantity: 0 },
        eventCount: 1,
      });

      const secondCartResponse = await mpesaApp.inject({ method: "POST", url: "/v1/carts", headers: { host }, payload: { currency: "KES" } });
      expect(secondCartResponse.statusCode).toBe(201);
      const secondCartId = secondCartResponse.json<{ id: string }>().id;
      const secondCookieHeader = secondCartResponse.headers["set-cookie"];
      const secondCookie = Array.isArray(secondCookieHeader) ? secondCookieHeader[0] : secondCookieHeader;
      const secondCartCookie = secondCookie?.split(";", 1)[0] ?? "";
      const secondAdded = await mpesaApp.inject({
        method: "POST",
        url: `/v1/carts/${secondCartId}/items`,
        headers: { host, cookie: secondCartCookie },
        payload: { productId, quantity: 1 },
      });
      expect(secondAdded.statusCode).toBe(200);
      const successfulCheckout = await mpesaApp.inject({
        method: "POST",
        url: "/v1/checkout",
        headers: {
          host,
          cookie: secondCartCookie,
          "idempotency-key": `mpesa-success-${randomUUID()}`,
          "x-payment-status-token": randomUUID(),
        },
        payload: {
          cartId: secondCartId,
          customer: { name: "Commerce Test", email: "commerce-test@example.test", phone: "+254700000000" },
          shippingAddress: { line1: "1 Test Road", city: "Nairobi", countryCode: "KE" },
        },
      });
      expect(successfulCheckout.statusCode).toBe(202);
      const successfulOrderId = successfulCheckout.json<{ orderId: string }>().orderId;
      expect(callbackUrls[1]).toBeTruthy();
      const successCallbackUrl = new URL(callbackUrls[1]!);
      const successCallbackPath = `${successCallbackUrl.pathname}${successCallbackUrl.search}`;
      const successCallback = {
        Body: { stkCallback: {
          CheckoutRequestID: "checkout-callback-test-1",
          MerchantRequestID: "merchant-callback-test-1",
          ResultCode: 0,
          CallbackMetadata: { Item: [
            { Name: "Amount", Value: 1250 },
            { Name: "PhoneNumber", Value: 254700000000 },
            { Name: "MpesaReceiptNumber", Value: "TEST-RECEIPT-123" },
          ] },
        } },
      };
      const invalidSettlement = await mpesaApp.inject({
        method: "POST",
        url: successCallbackPath,
        payload: { Body: { stkCallback: { ...successCallback.Body.stkCallback,
          CallbackMetadata: { Item: [
            { Name: "Amount", Value: 1 },
            { Name: "PhoneNumber", Value: 254700000000 },
            { Name: "MpesaReceiptNumber", Value: "TEST-RECEIPT-123" },
          ] },
        } } },
      });
      expect(invalidSettlement.statusCode).toBe(400);
      const stillPending = await withTenant(migrationPool, tenantId!, async (client) => {
        const [product] = (await client.query<{ stock_on_hand: number; stock_reserved: number }>(
          "SELECT stock_on_hand, stock_reserved FROM public.products WHERE id = $1",
          [productId],
        )).rows;
        const [order] = (await client.query<{ status: string }>(
          "SELECT status FROM public.orders WHERE id = $1",
          [successfulOrderId],
        )).rows;
        return { product, order };
      });
      expect(stillPending).toEqual({ product: { stock_on_hand: 8, stock_reserved: 1 }, order: { status: "pending_payment" } });

      const acceptedSettlement = await mpesaApp.inject({ method: "POST", url: successCallbackPath, payload: successCallback });
      expect(acceptedSettlement.statusCode).toBe(200);
      expect(acceptedSettlement.json()).toMatchObject({ ResultCode: 0, ResultDesc: "Accepted" });
      const successfulReplay = await mpesaApp.inject({ method: "POST", url: successCallbackPath, payload: successCallback });
      expect(successfulReplay.statusCode).toBe(200);
      expect(successfulReplay.json()).toMatchObject({ ResultCode: 0, ResultDesc: "Already processed" });

      const successfulState = await withTenant(migrationPool, tenantId!, async (client) => {
        const [product] = (await client.query<{ stock_on_hand: number; stock_reserved: number }>(
          "SELECT stock_on_hand, stock_reserved FROM public.products WHERE id = $1",
          [productId],
        )).rows;
        const [order] = (await client.query<{ status: string }>("SELECT status FROM public.orders WHERE id = $1", [successfulOrderId])).rows;
        const [attempt] = (await client.query<{ status: string; provider_reference: string }>(
          "SELECT status, provider_reference FROM public.payment_attempts WHERE order_id = $1",
          [successfulOrderId],
        )).rows;
        const [item] = (await client.query<{ reserved_quantity: number }>(
          "SELECT reserved_quantity FROM public.order_items WHERE order_id = $1",
          [successfulOrderId],
        )).rows;
        const [events] = (await client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM public.webhook_events WHERE tenant_id = $1 AND provider = 'mpesa' AND provider_event_id = 'checkout-callback-test-1'",
          [tenantId],
        )).rows;
        return { product, order, attempt, item, eventCount: events?.count };
      });
      expect(successfulState).toEqual({
        product: { stock_on_hand: 7, stock_reserved: 0 },
        order: { status: "paid" },
        attempt: { status: "succeeded", provider_reference: "TEST-RECEIPT-123" },
        item: { reserved_quantity: 0 },
        eventCount: 1,
      });
    } finally {
      await mpesaApp.close();
      globalThis.fetch = originalFetch;
    }
  });
});

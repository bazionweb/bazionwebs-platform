import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import { calculateTotals } from "@bazion/commerce-domain";
import { addCartItemSchema, checkoutSchema, createCartSchema, updateCartItemSchema } from "@bazion/api-contracts";
import { carts, cartItems, idempotencyRecords, orderItems, orders, paymentAttempts, products, webhookEvents } from "@bazion/database";
import { withTenantTransaction, type TenantTransaction } from "../../lib/database.js";
import type { AppConfig } from "../../config.js";
import { resolveTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";

interface RouteOptions { config: AppConfig }

async function assertCommerceEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "commerce"))) {
    throw Object.assign(new Error("The commerce module is disabled for this tenant."), {
      statusCode: 404,
      code: "TENANT_MODULE_DISABLED",
    });
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function secureTextEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function getCartToken(request: FastifyRequest, cartId: string): string {
  const cookieName = `bw_cart_${cartId.replaceAll("-", "")}`;
  const cookieHeader = request.headers.cookie ?? "";
  const cookiePair = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const value = cookiePair?.slice(cookieName.length + 1);
  if (!value || value.length < 40 || value.length > 200) {
    throw Object.assign(new Error("A valid guest cart session cookie is required."), { statusCode: 401, code: "CART_SESSION_REQUIRED" });
  }
  return decodeURIComponent(value);
}

async function authorizeCart(tx: TenantTransaction, tenantId: string, cartId: string, token: string) {
  const [cart] = await tx.select().from(carts).where(and(eq(carts.id, cartId), eq(carts.tenantId, tenantId))).for("update").limit(1);
  if (!cart || !secureEqual(cart.guestTokenHash, tokenHash(token))) {
    throw Object.assign(new Error("Cart not found or access token is invalid."), { statusCode: 404, code: "CART_NOT_FOUND" });
  }
  if (cart.expiresAt <= new Date()) {
    throw Object.assign(new Error("Cart has expired."), { statusCode: 409, code: "CART_EXPIRED" });
  }
  return cart;
}

function toPublicCart(cart: { id: string; currency: string; status: string; expiresAt: Date }, items: Array<{ id: string; productId: string; quantity: number; unitPriceMinor: number; name: string; sku: string }>) {
  const totals = items.length
    ? calculateTotals(items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor })), cart.currency as "KES" | "USD" | "EUR" | "GBP")
    : { currency: cart.currency, subtotalMinor: 0, discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 0 };
  return { id: cart.id, currency: cart.currency, status: cart.status, expiresAt: cart.expiresAt, items, totals };
}

export async function commerceRoutes(app: FastifyInstance, options: RouteOptions) {
  app.get("/products", async (request) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    return withTenantTransaction(tenantId, async (tx) => {
    return tx.select({ id: products.id, sku: products.sku, name: products.name, description: products.description,
      currency: products.currency, priceMinor: products.priceMinor, stockAvailable: sql<number | null>`case when ${products.stockTracked} then ${products.stockOnHand} - ${products.stockReserved} else null end` })
      .from(products).where(and(eq(products.tenantId, tenantId), eq(products.active, true)));
    });
  });

  app.post("/carts", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    const parsed = createCartSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const guestAccessToken = randomBytes(32).toString("base64url");
    const [cart] = await withTenantTransaction(tenantId, async (tx) => tx.insert(carts).values({
      tenantId, currency: parsed.data.currency, guestTokenHash: tokenHash(guestAccessToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning({ id: carts.id, currency: carts.currency, status: carts.status, expiresAt: carts.expiresAt }));
    const cookieName = `bw_cart_${cart!.id.replaceAll("-", "")}`;
    const secure = options.config.NODE_ENV === "production" ? "; Secure" : "";
    reply.header("Set-Cookie", `${cookieName}=${encodeURIComponent(guestAccessToken)}; HttpOnly; SameSite=Lax; Path=/v1; Max-Age=604800${secure}`);
    return reply.code(201).send({ ...cart, note: "Guest cart access is held in an HttpOnly cookie." });
  });

  app.get<{ Params: { cartId: string } }>("/carts/:cartId", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    const token = getCartToken(request, request.params.cartId);
    const result = await withTenantTransaction(tenantId, async (tx) => {
      const cart = await authorizeCart(tx, tenantId, request.params.cartId, token);
      const items = await tx.select({ id: cartItems.id, productId: cartItems.productId, quantity: cartItems.quantity,
        unitPriceMinor: products.priceMinor, name: products.name, sku: products.sku })
        .from(cartItems).innerJoin(products, and(eq(products.id, cartItems.productId), eq(products.tenantId, tenantId)))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)));
      return toPublicCart(cart, items);
    });
    return reply.send(result);
  });

  app.post<{ Params: { cartId: string } }>("/carts/:cartId/items", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    const token = getCartToken(request, request.params.cartId);
    const parsed = addCartItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const result = await withTenantTransaction(tenantId, async (tx) => {
      const cart = await authorizeCart(tx, tenantId, request.params.cartId, token);
      if (cart.status !== "open") throw Object.assign(new Error("Cart is not open."), { statusCode: 409, code: "CART_NOT_OPEN" });
      const [product] = await tx.select().from(products).where(and(eq(products.id, parsed.data.productId), eq(products.tenantId, tenantId), eq(products.active, true))).limit(1);
      if (!product) throw Object.assign(new Error("Product not found."), { statusCode: 404, code: "PRODUCT_NOT_FOUND" });
      if (product.currency !== cart.currency) throw Object.assign(new Error("Product currency does not match cart currency."), { statusCode: 409, code: "CURRENCY_MISMATCH" });
      const [existing] = await tx.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, product.id), eq(cartItems.tenantId, tenantId))).limit(1);
      const nextQuantity = (existing?.quantity ?? 0) + parsed.data.quantity;
      if (nextQuantity > 99) throw Object.assign(new Error("Maximum quantity per product is 99."), { statusCode: 400, code: "QUANTITY_LIMIT" });
      if (product.stockTracked && product.stockOnHand - product.stockReserved < nextQuantity) {
        throw Object.assign(new Error("Insufficient available stock."), { statusCode: 409, code: "OUT_OF_STOCK" });
      }
      if (existing) {
        await tx.update(cartItems).set({ quantity: nextQuantity, unitPriceMinor: product.priceMinor, updatedAt: new Date() }).where(eq(cartItems.id, existing.id));
      } else {
        await tx.insert(cartItems).values({ tenantId, cartId: cart.id, productId: product.id, quantity: parsed.data.quantity, unitPriceMinor: product.priceMinor });
      }
      const items = await tx.select({ id: cartItems.id, productId: cartItems.productId, quantity: cartItems.quantity,
        unitPriceMinor: cartItems.unitPriceMinor, name: products.name, sku: products.sku })
        .from(cartItems).innerJoin(products, and(eq(products.id, cartItems.productId), eq(products.tenantId, tenantId)))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)));
      return toPublicCart(cart, items);
    });
    return reply.code(200).send(result);
  });

  app.patch<{ Params: { cartId: string; itemId: string } }>("/carts/:cartId/items/:itemId", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    const token = getCartToken(request, request.params.cartId);
    const parsed = updateCartItemSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const result = await withTenantTransaction(tenantId, async (tx) => {
      const cart = await authorizeCart(tx, tenantId, request.params.cartId, token);
      if (cart.status !== "open") throw Object.assign(new Error("Cart is not open."), { statusCode: 409, code: "CART_NOT_OPEN" });
      const [item] = await tx.select().from(cartItems).where(and(eq(cartItems.id, request.params.itemId), eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId))).limit(1);
      if (!item) throw Object.assign(new Error("Cart item not found."), { statusCode: 404, code: "ITEM_NOT_FOUND" });
      const [product] = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.tenantId, tenantId))).limit(1);
      if (!product || !product.active) throw Object.assign(new Error("Product is no longer available."), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
      if (product.stockTracked && product.stockOnHand - product.stockReserved < parsed.data.quantity) throw Object.assign(new Error("Insufficient available stock."), { statusCode: 409, code: "OUT_OF_STOCK" });
      await tx.update(cartItems).set({ quantity: parsed.data.quantity, unitPriceMinor: product.priceMinor, updatedAt: new Date() }).where(eq(cartItems.id, item.id));
      const items = await tx.select({ id: cartItems.id, productId: cartItems.productId, quantity: cartItems.quantity,
        unitPriceMinor: cartItems.unitPriceMinor, name: products.name, sku: products.sku })
        .from(cartItems).innerJoin(products, and(eq(products.id, cartItems.productId), eq(products.tenantId, tenantId)))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)));
      return toPublicCart(cart, items);
    });
    return reply.send(result);
  });

  app.delete<{ Params: { cartId: string; itemId: string } }>("/carts/:cartId/items/:itemId", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    const token = getCartToken(request, request.params.cartId);
    const result = await withTenantTransaction(tenantId, async (tx) => {
      const cart = await authorizeCart(tx, tenantId, request.params.cartId, token);
      if (cart.status !== "open") throw Object.assign(new Error("Cart is not open."), { statusCode: 409, code: "CART_NOT_OPEN" });
      await tx.delete(cartItems).where(and(eq(cartItems.id, request.params.itemId), eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)));
      const items = await tx.select({ id: cartItems.id, productId: cartItems.productId, quantity: cartItems.quantity,
        unitPriceMinor: cartItems.unitPriceMinor, name: products.name, sku: products.sku })
        .from(cartItems).innerJoin(products, and(eq(products.id, cartItems.productId), eq(products.tenantId, tenantId)))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)));
      return toPublicCart(cart, items);
    });
    return reply.send(result);
  });

  app.post("/checkout", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
    const keyHeader = request.headers["idempotency-key"];
    if (typeof keyHeader !== "string" || keyHeader.length < 8 || keyHeader.length > 160) {
      return reply.code(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "Provide an Idempotency-Key header between 8 and 160 characters." });
    }
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const token = getCartToken(request, parsed.data.cartId);
    const requestHash = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");

    const checkout = await withTenantTransaction(tenantId, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${keyHeader}`}, 0))`);
      // Prove cart ownership before looking up an idempotency replay. Otherwise
      // possession of a key alone could disclose an existing order response.
      const cart = await authorizeCart(tx, tenantId, parsed.data.cartId, token);
      const [previous] = await tx.select().from(idempotencyRecords)
        .where(and(eq(idempotencyRecords.tenantId, tenantId), eq(idempotencyRecords.key, keyHeader))).limit(1);
      if (previous) {
        if (previous.requestHash !== requestHash) throw Object.assign(new Error("Idempotency key was already used with a different checkout request."), { statusCode: 409, code: "IDEMPOTENCY_CONFLICT" });
        const [order] = await tx.select().from(orders).where(and(eq(orders.id, previous.resourceId), eq(orders.tenantId, tenantId))).limit(1);
        const [payment] = await tx.select().from(paymentAttempts).where(and(eq(paymentAttempts.orderId, previous.resourceId), eq(paymentAttempts.tenantId, tenantId))).limit(1);
        return { order, payment, reused: true };
      }

      if (cart.status !== "open") throw Object.assign(new Error("Cart has already been checked out or is not open."), { statusCode: 409, code: "CART_NOT_OPEN" });
      const rows = await tx.select({ item: cartItems, product: products })
        .from(cartItems).innerJoin(products, eq(products.id, cartItems.productId))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)))
        .orderBy(products.id);
      if (rows.length === 0) throw Object.assign(new Error("Cannot check out an empty cart."), { statusCode: 409, code: "EMPTY_CART" });

      const lockedProducts: typeof rows = [];
      for (const row of rows) {
        const [locked] = await tx.select().from(products)
          .where(and(eq(products.id, row.product.id), eq(products.tenantId, tenantId))).for("update").limit(1);
        if (!locked || !locked.active) throw Object.assign(new Error(`Product ${row.product.sku} is no longer available.`), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
        if (locked.currency !== cart.currency) throw Object.assign(new Error("A product currency no longer matches the cart."), { statusCode: 409, code: "CURRENCY_MISMATCH" });
        if (locked.stockTracked && locked.stockOnHand - locked.stockReserved < row.item.quantity) throw Object.assign(new Error(`Insufficient stock for ${locked.sku}.`), { statusCode: 409, code: "OUT_OF_STOCK" });
        lockedProducts.push({ item: row.item, product: locked });
      }

      const lines = lockedProducts.map(({ item, product }) => ({ productId: product.id, quantity: item.quantity, unitPriceMinor: product.priceMinor }));
      const totals = calculateTotals(lines, cart.currency as "KES" | "USD" | "EUR" | "GBP");
      const orderId = randomUUID();
      const orderNumber = `BW-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
      const [order] = await tx.insert(orders).values({
        id: orderId, tenantId, orderNumber, cartId: cart.id, currency: cart.currency, status: "pending_payment",
        subtotalMinor: totals.subtotalMinor, discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: totals.totalMinor,
        customerName: parsed.data.customer.name, customerEmail: parsed.data.customer.email, customerPhone: parsed.data.customer.phone,
        shippingAddress: parsed.data.shippingAddress,
      }).returning();

      for (const { item, product } of lockedProducts) {
        const reservedQuantity = product.stockTracked ? item.quantity : 0;
        await tx.insert(orderItems).values({
          tenantId, orderId, productId: product.id, skuSnapshot: product.sku, nameSnapshot: product.name,
          quantity: item.quantity, reservedQuantity, unitPriceMinor: product.priceMinor,
          lineTotalMinor: product.priceMinor * item.quantity,
        });
        if (reservedQuantity > 0) {
          await tx.update(products).set({ stockReserved: product.stockReserved + reservedQuantity, updatedAt: new Date() })
            .where(and(eq(products.id, product.id), eq(products.tenantId, tenantId)));
        }
      }

      const paymentIdempotencyKey = `checkout:${createHash("sha256").update(`${tenantId}:${keyHeader}`).digest("hex")}`;
      const [payment] = await tx.insert(paymentAttempts).values({
        tenantId, orderId, provider: "mock", status: "created", amountMinor: totals.totalMinor,
        currency: cart.currency, idempotencyKey: paymentIdempotencyKey,
      }).returning();
      await tx.update(carts).set({ status: "converted", updatedAt: new Date() }).where(eq(carts.id, cart.id));
      await tx.insert(idempotencyRecords).values({ tenantId, key: keyHeader, requestHash, resourceId: orderId });
      return { order, payment, reused: false };
    });

    if (!checkout.order || !checkout.payment) return reply.code(500).send({ error: "CHECKOUT_NOT_CREATED" });
    if (checkout.payment.checkoutUrl) {
      return reply.code(checkout.reused ? 200 : 201).send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
        status: checkout.order.status, currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
        payment: { provider: checkout.payment.provider, status: checkout.payment.status, redirectUrl: checkout.payment.checkoutUrl }, reused: checkout.reused });
    }

    // Development adapter only. A real provider call must be performed outside the DB transaction,
    // use the same provider idempotency reference on retry, and persist/reconcile its response.
    const providerReference = `mock_${checkout.order.id}`;
    const checkoutUrl = `${options.config.PUBLIC_STOREFRONT_URL}/checkout/test-payment?orderId=${checkout.order.id}`;
    const [payment] = await withTenantTransaction(tenantId, async (tx) => tx.update(paymentAttempts)
      .set({ providerReference, checkoutUrl, status: "requires_action", updatedAt: new Date() })
      .where(and(eq(paymentAttempts.id, checkout.payment!.id), eq(paymentAttempts.tenantId, tenantId))).returning());

    return reply.code(checkout.reused ? 200 : 201).send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
      status: checkout.order.status, currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
      payment: { provider: payment?.provider ?? "mock", status: payment?.status ?? "created", redirectUrl: payment?.checkoutUrl ?? null }, reused: checkout.reused });
  });

  if (options.config.NODE_ENV !== "production") {
    app.post<{ Params: { orderId: string } }>("/_dev/orders/:orderId/pay", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, options.config);
    await assertCommerceEnabled(tenantId);
      const secret = request.headers["x-dev-secret"];
      if (typeof secret !== "string" || !secureTextEqual(secret, options.config.DEV_PAYMENT_SECRET)) return reply.code(401).send({ error: "UNAUTHORIZED" });
      const outcome = await withTenantTransaction(tenantId, async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`dev-payment:${tenantId}:${request.params.orderId}`}, 0))`);
        const [order] = await tx.select().from(orders).where(and(eq(orders.id, request.params.orderId), eq(orders.tenantId, tenantId))).for("update").limit(1);
        if (!order) return { kind: "not_found" as const };
        if (order.status === "paid") return { kind: "already_paid" as const, orderNumber: order.orderNumber };
        if (order.status !== "pending_payment") return { kind: "invalid_state" as const };
        const eventId = `mock_success_${order.id}`;
        const [existingEvent] = await tx.select().from(webhookEvents).where(and(eq(webhookEvents.tenantId, tenantId), eq(webhookEvents.provider, "mock"), eq(webhookEvents.providerEventId, eventId))).limit(1);
        if (!existingEvent) await tx.insert(webhookEvents).values({ tenantId, provider: "mock", providerEventId: eventId, eventType: "payment.succeeded" });
        const rows = await tx.select({ item: orderItems, product: products }).from(orderItems).innerJoin(products, eq(products.id, orderItems.productId))
          .where(and(eq(orderItems.orderId, order.id), eq(orderItems.tenantId, tenantId)));
        for (const row of rows) {
          if (row.item.reservedQuantity > 0) {
            const [locked] = await tx.select().from(products).where(and(eq(products.id, row.product.id), eq(products.tenantId, tenantId))).for("update").limit(1);
            if (!locked || locked.stockOnHand < row.item.reservedQuantity || locked.stockReserved < row.item.reservedQuantity) {
              throw new Error("INVENTORY_RESERVATION_INVARIANT_FAILED");
            }
            await tx.update(products).set({ stockOnHand: locked.stockOnHand - row.item.reservedQuantity,
              stockReserved: locked.stockReserved - row.item.reservedQuantity, updatedAt: new Date() }).where(eq(products.id, locked.id));
            await tx.update(orderItems).set({ reservedQuantity: 0 }).where(eq(orderItems.id, row.item.id));
          }
        }
        await tx.update(orders).set({ status: "paid", updatedAt: new Date() }).where(eq(orders.id, order.id));
        await tx.update(paymentAttempts).set({ status: "succeeded", updatedAt: new Date() }).where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.tenantId, tenantId)));
        return { kind: "paid" as const, orderNumber: order.orderNumber };
      });
      if (outcome.kind === "not_found") return reply.code(404).send({ error: "ORDER_NOT_FOUND" });
      if (outcome.kind === "invalid_state") return reply.code(409).send({ error: "ORDER_NOT_PAYABLE" });
      return reply.send({ success: true, ...outcome });
    });
  }
}

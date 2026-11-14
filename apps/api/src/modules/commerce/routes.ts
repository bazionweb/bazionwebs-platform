import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { calculateTotals, canReserveStock, planPaymentSettlement, releaseStockReservation, reserveStock, type CurrencyCode } from "@bazion/commerce-domain";
import { addCartItemSchema, checkoutSchema, createCartSchema, productListQuerySchema, updateCartItemSchema } from "@bazion/api-contracts";
import { carts, cartItems, commerceStoreSettings, idempotencyRecords, orderItems, orders, paymentAttempts, products, webhookEvents } from "@bazion/database";
import { withTenantTransaction, type TenantTransaction } from "../../lib/database.js";
import type { AppConfig } from "../../config.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { assertTenantNotInMaintenance } from "../../lib/tenant-maintenance.js";
import { DarajaClient, DarajaRequestError, normalizeKenyanPhoneNumber } from "@bazion/payments";

interface RouteOptions { config: AppConfig }

async function assertCommerceEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "commerce"))) {
    throw Object.assign(new Error("The commerce module is disabled for this tenant."), {
      statusCode: 404,
      code: "TENANT_MODULE_DISABLED",
    });
  }
  await assertTenantNotInMaintenance(tenantId);
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function releaseOrderReservations(tx: TenantTransaction, tenantId: string, orderId: string, consume: boolean) {
  const rows = await tx.select({ item: orderItems, product: products })
    .from(orderItems)
    .innerJoin(products, and(eq(products.id, orderItems.productId), eq(products.tenantId, tenantId)))
    .where(and(eq(orderItems.tenantId, tenantId), eq(orderItems.orderId, orderId)));
  for (const row of rows) {
    const quantity = row.item.reservedQuantity;
    if (quantity <= 0) continue;
    const [locked] = await tx.select().from(products)
      .where(and(eq(products.id, row.product.id), eq(products.tenantId, tenantId))).for("update").limit(1);
    if (!locked) {
      throw new Error("INVENTORY_RESERVATION_INVARIANT_FAILED");
    }
    const balance = releaseStockReservation(locked, quantity, consume);
    await tx.update(products).set({
      ...balance,
      updatedAt: new Date(),
    }).where(and(eq(products.id, locked.id), eq(products.tenantId, tenantId)));
    await tx.update(orderItems).set({ reservedQuantity: 0 })
      .where(and(eq(orderItems.id, row.item.id), eq(orderItems.tenantId, tenantId)));
  }
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
    ? calculateTotals(items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor })), cart.currency as CurrencyCode)
    : { currency: cart.currency, subtotalMinor: 0, discountMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 0 };
  return { id: cart.id, currency: cart.currency, status: cart.status, expiresAt: cart.expiresAt, items, totals };
}

export async function commerceRoutes(app: FastifyInstance, options: RouteOptions) {
  const daraja = options.config.mpesa ? new DarajaClient(options.config.mpesa) : null;
  const tenantForRequest = (request: FastifyRequest) => {
    return resolveRequestTenantId(request, options.config);
  };
  app.get("/storefront", async (request) => {
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
    return withTenantTransaction(tenantId, async (tx) => {
      const [settings] = await tx.select().from(commerceStoreSettings)
        .where(eq(commerceStoreSettings.tenantId, tenantId)).limit(1);
      return { store: settings ?? {
        tenantId, storeName: "Our Store", tagline: "Thoughtfully selected for you.", supportEmail: "", isHomePage: false, locale: "en-KE",
        timeZone: "Africa/Nairobi", defaultCountryCode: "KE", defaultCurrency: "KES", supportedCurrencies: ["KES"],
        shippingRates: { KES: 0 }, shippingCountries: [], updatedAt: null,
      }, paymentProvider: options.config.PAYMENT_PROVIDER };
    });
  });

  app.get<{ Querystring: { q?: string; category?: string; currency?: string; sort?: string; limit?: string; offset?: string } }>("/products", async (request, reply) => {
    const parsed = productListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
    return withTenantTransaction(tenantId, async (tx) => {
      const [settings] = await tx.select().from(commerceStoreSettings)
        .where(eq(commerceStoreSettings.tenantId, tenantId)).limit(1);
      const supportedCurrencies = settings?.supportedCurrencies ?? ["KES"];
      if (parsed.data.currency && !supportedCurrencies.includes(parsed.data.currency)) {
        return reply.code(400).send({ error: "CURRENCY_NOT_AVAILABLE" });
      }
      const filters = [eq(products.tenantId, tenantId), eq(products.active, true)];
      if (parsed.data.currency) filters.push(eq(products.currency, parsed.data.currency));
      if (parsed.data.category) filters.push(eq(products.category, parsed.data.category));
      if (parsed.data.q) {
        const escaped = `%${parsed.data.q.replace(/[\\%_]/g, "\\$&")}%`;
        filters.push(ilike(products.name, escaped));
      }
      const orderBy = parsed.data.sort === "price_asc" ? asc(products.priceMinor)
        : parsed.data.sort === "price_desc" ? desc(products.priceMinor)
          : parsed.data.sort === "newest" ? desc(products.createdAt)
            : desc(products.featured);
      const [items, categories, [total]] = await Promise.all([
        tx.select({
          id: products.id, sku: products.sku, slug: products.slug, name: products.name,
          description: products.description, category: products.category, imageUrl: products.imageUrl,
          imageAlt: products.imageAlt, featured: products.featured, compareAtPriceMinor: products.compareAtPriceMinor,
          currency: products.currency, priceMinor: products.priceMinor,
          stockAvailable: sql<number | null>`case when ${products.stockTracked} then ${products.stockOnHand} - ${products.stockReserved} else null end`,
        }).from(products).where(and(...filters)).orderBy(orderBy).limit(parsed.data.limit).offset(parsed.data.offset),
        tx.selectDistinct({ category: products.category }).from(products)
          .where(and(eq(products.tenantId, tenantId), eq(products.active, true))).orderBy(asc(products.category)),
        tx.select({ total: sql<number>`count(*)::int` }).from(products).where(and(...filters)),
      ]);
      return { items, categories: categories.map((item) => item.category), total: total?.total ?? 0, limit: parsed.data.limit, offset: parsed.data.offset };
    });
  });

  app.get<{ Params: { slug: string } }>("/products/:slug", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
    const [product] = await withTenantTransaction(tenantId, (tx) => tx.select({
      id: products.id, sku: products.sku, slug: products.slug, name: products.name,
      description: products.description, category: products.category, imageUrl: products.imageUrl,
      imageAlt: products.imageAlt, featured: products.featured, compareAtPriceMinor: products.compareAtPriceMinor,
      currency: products.currency, priceMinor: products.priceMinor,
      stockAvailable: sql<number | null>`case when ${products.stockTracked} then ${products.stockOnHand} - ${products.stockReserved} else null end`,
    }).from(products).where(and(eq(products.tenantId, tenantId), eq(products.slug, request.params.slug), eq(products.active, true))).limit(1));
    if (!product) return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
    return reply.send({ product });
  });

  app.post("/carts", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
    const parsed = createCartSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const supportedCurrencies = await withTenantTransaction(tenantId, async (tx) => {
      const [settings] = await tx.select().from(commerceStoreSettings)
        .where(eq(commerceStoreSettings.tenantId, tenantId)).limit(1);
      return settings?.supportedCurrencies ?? ["KES"];
    });
    if (!supportedCurrencies.includes(parsed.data.currency)) return reply.code(400).send({ error: "CURRENCY_NOT_AVAILABLE" });
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
    const tenantId = await tenantForRequest(request);
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
    const tenantId = await tenantForRequest(request);
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
      if (product.stockTracked && !canReserveStock(product, nextQuantity)) {
        throw Object.assign(new Error("Insufficient available stock."), { statusCode: 409, code: "OUT_OF_STOCK" });
      }
      if (existing) {
        await tx.update(cartItems).set({ quantity: nextQuantity, unitPriceMinor: product.priceMinor, updatedAt: new Date() })
          .where(and(eq(cartItems.id, existing.id), eq(cartItems.tenantId, tenantId)));
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
    const tenantId = await tenantForRequest(request);
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
      if (product.stockTracked && !canReserveStock(product, parsed.data.quantity)) throw Object.assign(new Error("Insufficient available stock."), { statusCode: 409, code: "OUT_OF_STOCK" });
      await tx.update(cartItems).set({ quantity: parsed.data.quantity, unitPriceMinor: product.priceMinor, updatedAt: new Date() })
        .where(and(eq(cartItems.id, item.id), eq(cartItems.tenantId, tenantId)));
      const items = await tx.select({ id: cartItems.id, productId: cartItems.productId, quantity: cartItems.quantity,
        unitPriceMinor: cartItems.unitPriceMinor, name: products.name, sku: products.sku })
        .from(cartItems).innerJoin(products, and(eq(products.id, cartItems.productId), eq(products.tenantId, tenantId)))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)));
      return toPublicCart(cart, items);
    });
    return reply.send(result);
  });

  app.delete<{ Params: { cartId: string; itemId: string } }>("/carts/:cartId/items/:itemId", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
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
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
    const keyHeader = request.headers["idempotency-key"];
    if (typeof keyHeader !== "string" || keyHeader.length < 8 || keyHeader.length > 160) {
      return reply.code(400).send({ error: "IDEMPOTENCY_KEY_REQUIRED", message: "Provide an Idempotency-Key header between 8 and 160 characters." });
    }
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const paymentProvider = options.config.PAYMENT_PROVIDER;
    const statusToken = request.headers["x-payment-status-token"];
    let statusTokenHash: string | null = null;
    let normalizedPhone: string | null = null;
    if (paymentProvider === "mpesa") {
      if (!daraja) return reply.code(503).send({ error: "PAYMENT_PROVIDER_UNAVAILABLE" });
      if (typeof statusToken !== "string" || !/^[A-Za-z0-9_-]{32,160}$/.test(statusToken)) {
        return reply.code(400).send({ error: "PAYMENT_STATUS_TOKEN_REQUIRED" });
      }
      statusTokenHash = tokenHash(statusToken);
      try { normalizedPhone = normalizeKenyanPhoneNumber(parsed.data.customer.phone); }
      catch (error) { return reply.code(400).send({ error: "INVALID_PHONE_NUMBER", message: error instanceof Error ? error.message : "Enter a Kenyan M-Pesa mobile number." }); }
    }
    const token = getCartToken(request, parsed.data.cartId);
    const requestHash = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
    const callbackToken = paymentProvider === "mpesa" ? randomBytes(32).toString("base64url") : null;
    const callbackTokenHash = callbackToken ? tokenHash(callbackToken) : null;

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
        if (!payment || payment.provider !== paymentProvider || payment.statusTokenHash !== statusTokenHash) {
          throw Object.assign(new Error("This checkout key is already bound to a different payment attempt."), { statusCode: 409, code: "IDEMPOTENCY_CONFLICT" });
        }
        return { order, payment, reused: true };
      }

      if (cart.status !== "open") throw Object.assign(new Error("Cart has already been checked out or is not open."), { statusCode: 409, code: "CART_NOT_OPEN" });
      const [storeSettings] = await tx.select().from(commerceStoreSettings)
        .where(eq(commerceStoreSettings.tenantId, tenantId)).limit(1);
      const supportedCurrencies = storeSettings?.supportedCurrencies ?? ["KES"];
      if (!supportedCurrencies.includes(cart.currency)) {
        throw Object.assign(new Error("This currency is not enabled for the store."), { statusCode: 400, code: "CURRENCY_NOT_AVAILABLE" });
      }
      const countryCode = parsed.data.shippingAddress.countryCode;
      const shippingCountries = storeSettings?.shippingCountries ?? [];
      if (shippingCountries.length > 0 && !shippingCountries.includes(countryCode)) {
        throw Object.assign(new Error("This store does not currently ship to the selected country."), { statusCode: 400, code: "SHIPPING_COUNTRY_UNAVAILABLE" });
      }
      const shippingMinor = Number(storeSettings?.shippingRates?.[cart.currency as CurrencyCode] ?? 0);
      if (!Number.isSafeInteger(shippingMinor) || shippingMinor < 0) {
        throw new Error("Invalid shipping configuration for the selected currency.");
      }
      const rows = await tx.select({ item: cartItems, product: products })
        .from(cartItems).innerJoin(products, and(eq(products.id, cartItems.productId), eq(products.tenantId, tenantId)))
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.tenantId, tenantId)))
        .orderBy(products.id);
      if (rows.length === 0) throw Object.assign(new Error("Cannot check out an empty cart."), { statusCode: 409, code: "EMPTY_CART" });
      if (paymentProvider === "mpesa" && cart.currency !== "KES") {
        throw Object.assign(new Error("M-Pesa checkout currently supports KES orders only."), { statusCode: 400, code: "CURRENCY_NOT_SUPPORTED" });
      }

      const lockedProducts: typeof rows = [];
      for (const row of rows) {
        const [locked] = await tx.select().from(products)
          .where(and(eq(products.id, row.product.id), eq(products.tenantId, tenantId))).for("update").limit(1);
        if (!locked || !locked.active) throw Object.assign(new Error(`Product ${row.product.sku} is no longer available.`), { statusCode: 409, code: "PRODUCT_UNAVAILABLE" });
        if (locked.currency !== cart.currency) throw Object.assign(new Error("A product currency no longer matches the cart."), { statusCode: 409, code: "CURRENCY_MISMATCH" });
        if (locked.stockTracked && !canReserveStock(locked, row.item.quantity)) throw Object.assign(new Error(`Insufficient stock for ${locked.sku}.`), { statusCode: 409, code: "OUT_OF_STOCK" });
        lockedProducts.push({ item: row.item, product: locked });
      }

      const lines = lockedProducts.map(({ item, product }) => ({ productId: product.id, quantity: item.quantity, unitPriceMinor: product.priceMinor }));
      const totals = calculateTotals(lines, cart.currency as CurrencyCode, { shippingMinor });
      if (paymentProvider === "mpesa" && (totals.totalMinor < 100 || totals.totalMinor % 100 !== 0)) {
        throw Object.assign(new Error("M-Pesa checkout requires a whole-KES order total of at least KES 1."), { statusCode: 400, code: "INVALID_PAYMENT_AMOUNT" });
      }
      const orderId = randomUUID();
      const orderNumber = `BW-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
      const [order] = await tx.insert(orders).values({
        id: orderId, tenantId, orderNumber, cartId: cart.id, currency: cart.currency, status: "pending_payment",
        subtotalMinor: totals.subtotalMinor, discountMinor: 0, shippingMinor: totals.shippingMinor, taxMinor: 0, totalMinor: totals.totalMinor,
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
          const balance = reserveStock(product, reservedQuantity);
          await tx.update(products).set({ ...balance, updatedAt: new Date() })
            .where(and(eq(products.id, product.id), eq(products.tenantId, tenantId)));
        }
      }

      const paymentIdempotencyKey = `checkout:${createHash("sha256").update(`${tenantId}:${keyHeader}`).digest("hex")}`;
      const [payment] = await tx.insert(paymentAttempts).values({
        tenantId, orderId, provider: paymentProvider, status: "created", amountMinor: totals.totalMinor,
        currency: cart.currency, idempotencyKey: paymentIdempotencyKey,
        callbackTokenHash,
        statusTokenHash,
      }).returning();
      await tx.update(carts).set({ status: "converted", updatedAt: new Date() })
        .where(and(eq(carts.id, cart.id), eq(carts.tenantId, tenantId)));
      await tx.insert(idempotencyRecords).values({ tenantId, key: keyHeader, requestHash, resourceId: orderId });
      return { order, payment, reused: false };
    });

    if (!checkout.order || !checkout.payment) return reply.code(500).send({ error: "CHECKOUT_NOT_CREATED" });

    if (checkout.payment.provider === "mpesa") {
      if (checkout.payment.status === "succeeded" || checkout.payment.status === "failed" || checkout.payment.status === "cancelled") {
        return reply.code(200).send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
          status: checkout.order.status, currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
          payment: { provider: "mpesa", status: checkout.payment.status, redirectUrl: null }, reused: checkout.reused });
      }
      const claimed = await withTenantTransaction(tenantId, async (tx) => {
        const [attempt] = await tx.select().from(paymentAttempts)
          .where(and(eq(paymentAttempts.id, checkout.payment!.id), eq(paymentAttempts.tenantId, tenantId)))
          .for("update").limit(1);
        if (!attempt || attempt.status !== "created") return false;
        await tx.update(paymentAttempts).set({ status: "processing", callbackTokenHash, updatedAt: new Date() })
          .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.tenantId, tenantId), eq(paymentAttempts.status, "created")));
        return true;
      });
      if (claimed) {
        const callbackUrl = new URL(options.config.mpesa!.callbackUrl);
        callbackUrl.pathname = "/v1/public/commerce/payments/mpesa-callback";
        callbackUrl.search = "";
        callbackUrl.searchParams.set("tenantId", tenantId);
        callbackUrl.searchParams.set("token", callbackToken ?? "");
        try {
          const result = await daraja!.initiateStkPush({
            amountKes: checkout.payment.amountMinor / 100,
            phoneNumber: normalizedPhone ?? checkout.order.customerPhone,
            accountReference: checkout.order.orderNumber,
            transactionDescription: `Order ${checkout.order.orderNumber}`,
            callbackUrl: callbackUrl.toString(),
          });
          await withTenantTransaction(tenantId, async (tx) => {
            await tx.update(paymentAttempts).set({
              checkoutRequestId: result.checkoutRequestId,
              merchantRequestId: result.merchantRequestId,
              status: "requires_action",
              updatedAt: new Date(),
            }).where(and(eq(paymentAttempts.id, checkout.payment!.id), eq(paymentAttempts.tenantId, tenantId), eq(paymentAttempts.status, "processing")));
          });
        } catch (error) {
          if (error instanceof DarajaRequestError && error.deliveryState === "not_sent") {
            await withTenantTransaction(tenantId, async (tx) => {
              const [attempt] = await tx.select().from(paymentAttempts)
                .where(and(eq(paymentAttempts.id, checkout.payment!.id), eq(paymentAttempts.tenantId, tenantId)))
                .for("update").limit(1);
              const settlement = attempt ? planPaymentSettlement("pending_payment", attempt.status, false) : null;
              if (attempt && settlement?.kind === "settle") {
                await tx.update(paymentAttempts).set({ status: settlement.paymentStatus, callbackTokenHash: null, updatedAt: new Date() })
                  .where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.tenantId, tenantId)));
                await tx.update(orders).set({ status: settlement.orderStatus, updatedAt: new Date() })
                  .where(and(eq(orders.id, checkout.order!.id), eq(orders.tenantId, tenantId), eq(orders.status, "pending_payment")));
                await releaseOrderReservations(tx, tenantId, checkout.order!.id, settlement.consumeReservedStock);
              }
            });
            return reply.send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
              status: "cancelled", currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
              payment: { provider: "mpesa", status: "failed", redirectUrl: null },
              message: error.message, reused: checkout.reused });
          }
        }
      }
      const [latestAttempt] = await withTenantTransaction(tenantId, (tx) => tx.select({ status: paymentAttempts.status })
        .from(paymentAttempts)
        .where(and(eq(paymentAttempts.id, checkout.payment!.id), eq(paymentAttempts.tenantId, tenantId)))
        .limit(1));
      return reply.code(202).send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
        status: checkout.order.status, currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
        payment: { provider: "mpesa", status: latestAttempt?.status ?? checkout.payment.status, redirectUrl: null },
        message: "Check your phone for the M-Pesa prompt. The order is not paid until Safaricom confirms it.", reused: checkout.reused });
    }

    if (checkout.payment.checkoutUrl) {
      return reply.code(checkout.reused ? 200 : 201).send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
        status: checkout.order.status, currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
        payment: { provider: checkout.payment.provider, status: checkout.payment.status, redirectUrl: checkout.payment.checkoutUrl }, reused: checkout.reused });
    }

    // Local-only mock payment adapter.
    const providerReference = `mock_${checkout.order.id}`;
    const checkoutUrl = `${options.config.PUBLIC_STOREFRONT_URL}/checkout/test-payment?orderId=${checkout.order.id}`;
    const [payment] = await withTenantTransaction(tenantId, async (tx) => tx.update(paymentAttempts)
      .set({ providerReference, checkoutUrl, status: "requires_action", updatedAt: new Date() })
      .where(and(eq(paymentAttempts.id, checkout.payment!.id), eq(paymentAttempts.tenantId, tenantId))).returning());

    return reply.code(checkout.reused ? 200 : 201).send({ orderId: checkout.order.id, orderNumber: checkout.order.orderNumber,
      status: checkout.order.status, currency: checkout.order.currency, totalMinor: checkout.order.totalMinor,
      payment: { provider: payment?.provider ?? "mock", status: payment?.status ?? "created", redirectUrl: payment?.checkoutUrl ?? null }, reused: checkout.reused });
  });

  app.post<{ Querystring: { tenantId?: string; token?: string } }>("/public/commerce/payments/mpesa-callback", async (request, reply) => {
    const tenantId = request.query.tenantId ?? "";
    const callbackToken = request.query.token ?? "";
    if (!daraja || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId) || !/^[A-Za-z0-9_-]{40,64}$/.test(callbackToken)) {
      return reply.code(404).send({ error: "CALLBACK_NOT_FOUND" });
    }
    const body = objectValue(request.body);
    const stkCallback = objectValue(objectValue(body?.Body)?.stkCallback);
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const merchantRequestId = stkCallback?.MerchantRequestID;
    const rawResultCode = stkCallback?.ResultCode;
    const resultCode = typeof rawResultCode === "number" ? rawResultCode
      : typeof rawResultCode === "string" && /^-?\d+$/.test(rawResultCode) ? Number(rawResultCode) : Number.NaN;
    if (typeof checkoutRequestId !== "string" || !checkoutRequestId || typeof merchantRequestId !== "string" || !merchantRequestId || !Number.isInteger(resultCode)) {
      return reply.code(400).send({ error: "INVALID_PAYMENT_CALLBACK" });
    }
    const metadata = new Map<string, unknown>();
    const callbackItems = objectValue(stkCallback?.CallbackMetadata)?.Item;
    if (Array.isArray(callbackItems)) {
      for (const item of callbackItems) {
        const entry = objectValue(item);
        if (typeof entry?.Name === "string") metadata.set(entry.Name, entry.Value);
      }
    }

    return withTenantTransaction(tenantId, async (tx) => {
      const [record] = await tx.select({
        attempt: paymentAttempts,
        orderId: orders.id,
        orderStatus: orders.status,
        customerPhone: orders.customerPhone,
      }).from(paymentAttempts)
        .innerJoin(orders, and(eq(orders.id, paymentAttempts.orderId), eq(orders.tenantId, paymentAttempts.tenantId)))
        .where(and(
          eq(paymentAttempts.tenantId, tenantId),
          eq(paymentAttempts.provider, "mpesa"),
          eq(paymentAttempts.callbackTokenHash, tokenHash(callbackToken)),
        ))
        .for("update")
        .limit(1);
      if (!record) return reply.code(404).send({ error: "CALLBACK_NOT_FOUND" });
      const attempt = record.attempt;
      const settlement = planPaymentSettlement(record.orderStatus, attempt.status, resultCode === 0);
      if (settlement.kind === "duplicate") {
        return reply.send({ ResultCode: 0, ResultDesc: "Already processed" });
      }
      if ((attempt.checkoutRequestId && attempt.checkoutRequestId !== checkoutRequestId) ||
          (attempt.merchantRequestId && attempt.merchantRequestId !== merchantRequestId)) {
        return reply.code(409).send({ error: "CALLBACK_REFERENCE_MISMATCH" });
      }
      if (settlement.kind === "order_not_payable") return reply.code(409).send({ error: "ORDER_NOT_PAYABLE" });

      if (resultCode === 0) {
        const amountMinor = Math.round(Number(metadata.get("Amount")) * 100);
        const receipt = metadata.get("MpesaReceiptNumber");
        let callbackPhone = "";
        let expectedPhone = "";
        try { callbackPhone = normalizeKenyanPhoneNumber(String(metadata.get("PhoneNumber") ?? "")); } catch { /* rejected below */ }
        try { expectedPhone = normalizeKenyanPhoneNumber(record.customerPhone); } catch { /* rejected below */ }
        if (!Number.isSafeInteger(amountMinor) || amountMinor !== attempt.amountMinor || attempt.currency !== "KES" ||
            !callbackPhone || callbackPhone !== expectedPhone || typeof receipt !== "string" || !receipt.trim()) {
          return reply.code(400).send({ error: "PAYMENT_CALLBACK_VALIDATION_FAILED" });
        }

        await releaseOrderReservations(tx, tenantId, record.orderId, settlement.consumeReservedStock);
        await tx.update(orders).set({ status: settlement.orderStatus, updatedAt: new Date() })
          .where(and(eq(orders.id, record.orderId), eq(orders.tenantId, tenantId), eq(orders.status, "pending_payment")));
        await tx.update(paymentAttempts).set({
          status: settlement.paymentStatus,
          providerReference: receipt.trim().slice(0, 160),
          checkoutRequestId,
          merchantRequestId,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        }).where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.tenantId, tenantId)));
      } else {
        await releaseOrderReservations(tx, tenantId, record.orderId, settlement.consumeReservedStock);
        await tx.update(orders).set({ status: settlement.orderStatus, updatedAt: new Date() })
          .where(and(eq(orders.id, record.orderId), eq(orders.tenantId, tenantId), eq(orders.status, "pending_payment")));
        await tx.update(paymentAttempts).set({
          status: settlement.paymentStatus,
          checkoutRequestId,
          merchantRequestId,
          updatedAt: new Date(),
        }).where(and(eq(paymentAttempts.id, attempt.id), eq(paymentAttempts.tenantId, tenantId)));
      }
      await tx.insert(webhookEvents).values({
        tenantId,
        provider: "mpesa",
        providerEventId: checkoutRequestId,
        eventType: settlement.eventType,
      }).onConflictDoNothing();
      return reply.send({ ResultCode: 0, ResultDesc: "Accepted" });
    });
  });

  app.get("/public/commerce/payments/status", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
    const statusToken = request.headers["x-payment-status-token"];
    if (typeof statusToken !== "string" || !/^[A-Za-z0-9_-]{32,160}$/.test(statusToken)) {
      return reply.code(400).send({ error: "INVALID_PAYMENT_STATUS_TOKEN" });
    }
    const [record] = await withTenantTransaction(tenantId, (tx) => tx.select({
      attemptStatus: paymentAttempts.status,
      providerReference: paymentAttempts.providerReference,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
    }).from(paymentAttempts)
      .innerJoin(orders, and(eq(orders.id, paymentAttempts.orderId), eq(orders.tenantId, paymentAttempts.tenantId)))
      .where(and(eq(paymentAttempts.tenantId, tenantId), eq(paymentAttempts.statusTokenHash, tokenHash(statusToken))))
      .limit(1));
    if (!record) return reply.code(404).send({ error: "PAYMENT_STATUS_NOT_FOUND" });
    return reply.send(record);
  });

  if (options.config.NODE_ENV !== "production") {
    app.post<{ Params: { orderId: string } }>("/_dev/orders/:orderId/pay", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertCommerceEnabled(tenantId);
      const secret = request.headers["x-dev-secret"];
      if (typeof secret !== "string" || !secureTextEqual(secret, options.config.DEV_PAYMENT_SECRET)) return reply.code(401).send({ error: "UNAUTHORIZED" });
      const outcome = await withTenantTransaction(tenantId, async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`dev-payment:${tenantId}:${request.params.orderId}`}, 0))`);
        const [order] = await tx.select().from(orders).where(and(eq(orders.id, request.params.orderId), eq(orders.tenantId, tenantId))).for("update").limit(1);
        if (!order) return { kind: "not_found" as const };
        if (order.status === "paid") return { kind: "already_paid" as const, orderNumber: order.orderNumber };
        if (order.status !== "pending_payment") return { kind: "invalid_state" as const };
        const [mockAttempt] = await tx.select().from(paymentAttempts)
          .where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.tenantId, tenantId), eq(paymentAttempts.provider, "mock")))
          .for("update").limit(1);
        if (!mockAttempt) return { kind: "invalid_state" as const };
        const settlement = planPaymentSettlement(order.status, mockAttempt.status, true);
        if (settlement.kind !== "settle") return { kind: "invalid_state" as const };
        const eventId = `mock_success_${order.id}`;
        const [existingEvent] = await tx.select().from(webhookEvents).where(and(eq(webhookEvents.tenantId, tenantId), eq(webhookEvents.provider, "mock"), eq(webhookEvents.providerEventId, eventId))).limit(1);
        if (!existingEvent) await tx.insert(webhookEvents).values({ tenantId, provider: "mock", providerEventId: eventId, eventType: settlement.eventType });
        await releaseOrderReservations(tx, tenantId, order.id, settlement.consumeReservedStock);
        await tx.update(orders).set({ status: settlement.orderStatus, updatedAt: new Date() })
          .where(and(eq(orders.id, order.id), eq(orders.tenantId, tenantId), eq(orders.status, "pending_payment")));
        await tx.update(paymentAttempts).set({ status: settlement.paymentStatus, updatedAt: new Date() }).where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.tenantId, tenantId), eq(paymentAttempts.provider, "mock")));
        return { kind: "paid" as const, orderNumber: order.orderNumber };
      });
      if (outcome.kind === "not_found") return reply.code(404).send({ error: "ORDER_NOT_FOUND" });
      if (outcome.kind === "invalid_state") return reply.code(409).send({ error: "ORDER_NOT_PAYABLE" });
      return reply.send({ success: true, ...outcome });
    });
  }
}

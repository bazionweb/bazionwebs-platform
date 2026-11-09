import type { FastifyInstance } from "fastify";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { requireActiveTenantPermission } from "@bazion/auth";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { commerceStoreSettings, orderItems, orders, products } from "@bazion/database";
import { productSlug } from "@bazion/commerce-domain";
import { pool, withTenantTransaction } from "../../lib/database.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import {
  orderListQuerySchema, orderStatusInputSchema, productInputSchema, productListQuerySchema,
  productPatchSchema, storeSettingsInputSchema,
} from "./admin-policy.js";

const auditWriter = new PostgresAuditEventWriter(pool);
const defaultStoreSettings = {
  storeName: "Our Store",
  tagline: "Thoughtfully selected for you.",
  supportEmail: "",
  isHomePage: false,
  locale: "en-KE",
  timeZone: "Africa/Nairobi",
  defaultCountryCode: "KE",
  defaultCurrency: "KES" as const,
  supportedCurrencies: ["KES"] as string[],
  shippingRates: { KES: 0 } as Record<string, number>,
  shippingCountries: [] as string[],
};

async function requireCommercePermission(
  headers: Parameters<typeof requireActiveTenantPermission>[0],
  permission: Parameters<typeof requireActiveTenantPermission>[1],
) {
  const context = await requireActiveTenantPermission(headers, permission);
  if (!(await isTenantModuleEnabled(context.tenantId, "commerce"))) {
    throw Object.assign(new Error("The commerce module is disabled for this tenant."), { statusCode: 404, code: "TENANT_MODULE_DISABLED" });
  }
  return context;
}

function auditActor(context: { userId: string; roles: string[] }) {
  return { actorType: "user" as const, actorId: context.userId, actorRole: context.roles.join(",") };
}

async function auditMutation<T>(request: { id: string; log: { error: (metadata: Record<string, string>, message: string) => void } }, context: { userId: string; roles: string[]; tenantId: string }, action: string, resourceType: string, resourceId: string | null, operation: () => Promise<T>): Promise<T> {
  const event = {
    ...auditActor(context), tenantId: context.tenantId, resourceType, resourceId,
    requestId: request.id, action,
  };
  await auditWriter.append({ ...event, action: `${action}.requested`, outcome: "succeeded" });
  let value: T;
  try { value = await operation(); }
  catch (error) {
    try { await auditWriter.append({ ...event, action: `${action}.failed`, outcome: "failed" }); }
    catch { request.log.error({ action }, "Commerce failure audit event could not be persisted"); }
    throw error;
  }
  try { await auditWriter.append({ ...event, action: `${action}.completed`, outcome: "succeeded" }); }
  catch { request.log.error({ action }, "Commerce completion audit event could not be persisted"); }
  return value;
}

export async function commerceAdminRoutes(app: FastifyInstance) {
  app.get("/admin/commerce/store", async (request) => {
    const context = await requireCommercePermission(request.headers, { store: ["read"] });
    const [settings] = await withTenantTransaction(context.tenantId, (tx) => tx.select().from(commerceStoreSettings)
      .where(eq(commerceStoreSettings.tenantId, context.tenantId)).limit(1));
    return { store: settings ?? { ...defaultStoreSettings, tenantId: context.tenantId }, canUpdate: context.roles.some((role) => ["owner", "admin", "contentEditor"].includes(role)) };
  });

  app.put("/admin/commerce/store", async (request, reply) => {
    const parsed = storeSettingsInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const context = await requireCommercePermission(request.headers, { store: ["update"] });
    const settings = await auditMutation(request, context, "commerce.store.updated", "commerce_store_settings", context.tenantId, () =>
      withTenantTransaction(context.tenantId, async (tx) => {
        const [saved] = await tx.insert(commerceStoreSettings).values({
          tenantId: context.tenantId,
          ...parsed.data,
          supportedCurrencies: [...new Set(parsed.data.supportedCurrencies)],
          shippingRates: parsed.data.shippingRates,
          shippingCountries: [...new Set(parsed.data.shippingCountries)],
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: commerceStoreSettings.tenantId,
          set: {
            ...parsed.data,
            supportedCurrencies: [...new Set(parsed.data.supportedCurrencies)],
            shippingRates: parsed.data.shippingRates,
            shippingCountries: [...new Set(parsed.data.shippingCountries)],
            updatedAt: new Date(),
          },
        }).returning();
        return saved;
      }));
    return reply.send({ store: settings });
  });

  app.get("/admin/commerce/products", async (request, reply) => {
    const parsed = productListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const context = await requireCommercePermission(request.headers, { product: ["read"] });
    const { limit, offset, q, category } = parsed.data;
    const filters = [eq(products.tenantId, context.tenantId)];
    if (q) {
      const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(or(ilike(products.name, term), ilike(products.sku, term), ilike(products.category, term))!);
    }
    if (category) filters.push(eq(products.category, category));
    const where = and(...filters);
    const orderBy = parsed.data.sort === "price_asc" ? products.priceMinor
      : parsed.data.sort === "price_desc" ? desc(products.priceMinor)
        : parsed.data.sort === "newest" ? desc(products.createdAt)
          : desc(products.featured);
    const [items, [total]] = await withTenantTransaction(context.tenantId, async (tx) => Promise.all([
      tx.select().from(products).where(where).orderBy(orderBy).limit(limit).offset(offset),
      tx.select({ total: count() }).from(products).where(where),
    ]));
    return reply.send({
      items, total: total?.total ?? 0, limit, offset,
      canCreate: context.roles.some((role) => ["owner", "admin", "catalogManager"].includes(role)),
      canUpdate: context.roles.some((role) => ["owner", "admin", "catalogManager"].includes(role)),
    });
  });

  app.post("/admin/commerce/products", async (request, reply) => {
    const parsed = productInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const context = await requireCommercePermission(request.headers, { product: ["create"] });
    try {
      const product = await auditMutation(request, context, "commerce.product.created", "product", null, () =>
        withTenantTransaction(context.tenantId, async (tx) => {
          const [created] = await tx.insert(products).values({
            tenantId: context.tenantId,
            ...parsed.data,
            slug: parsed.data.slug ?? productSlug(parsed.data.name),
            description: parsed.data.description ?? null,
            imageUrl: parsed.data.imageUrl ?? null,
            imageAlt: parsed.data.imageAlt ?? null,
            compareAtPriceMinor: parsed.data.compareAtPriceMinor ?? null,
          }).returning();
          return created;
        }));
      return reply.code(201).send({ product });
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: "PRODUCT_SKU_OR_SLUG_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { productId: string } }>("/admin/commerce/products/:productId", async (request, reply) => {
    const parsed = productPatchSchema.safeParse(request.body);
    if (!parsed.success || !isUuid(request.params.productId)) return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    const context = await requireCommercePermission(request.headers, { product: ["update"] });
    try {
      const product = await auditMutation(request, context, "commerce.product.updated", "product", request.params.productId, () =>
        withTenantTransaction(context.tenantId, async (tx) => {
          const [current] = await tx.select().from(products)
            .where(and(eq(products.id, request.params.productId), eq(products.tenantId, context.tenantId))).for("update").limit(1);
          if (!current) return null;
          const patch = parsed.data;
          const nextPrice = patch.priceMinor ?? current.priceMinor;
          const nextCompareAt = patch.compareAtPriceMinor === undefined ? current.compareAtPriceMinor : patch.compareAtPriceMinor;
          if (nextCompareAt !== null && nextCompareAt < nextPrice) {
            throw Object.assign(new Error("Compare price must be at least the current price."), { statusCode: 400, code: "INVALID_COMPARE_PRICE" });
          }
          const nextStock = patch.stockOnHand ?? current.stockOnHand;
          if (nextStock < current.stockReserved) {
            throw Object.assign(new Error("Stock on hand cannot be lower than stock currently reserved for orders."), { statusCode: 409, code: "STOCK_RESERVED" });
          }
          const [updated] = await tx.update(products).set({
            ...patch,
            ...(patch.description === undefined ? {} : { description: patch.description }),
            ...(patch.imageUrl === undefined ? {} : { imageUrl: patch.imageUrl }),
            ...(patch.imageAlt === undefined ? {} : { imageAlt: patch.imageAlt }),
            updatedAt: new Date(),
          }).where(and(eq(products.id, request.params.productId), eq(products.tenantId, context.tenantId))).returning();
          return updated ?? null;
        }));
      if (!product) return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
      return reply.send({ product });
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: "PRODUCT_SKU_OR_SLUG_EXISTS" });
      throw error;
    }
  });

  app.get("/admin/commerce/orders", async (request, reply) => {
    const parsed = orderListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const context = await requireCommercePermission(request.headers, { order: ["read"] });
    const filters = [eq(orders.tenantId, context.tenantId)];
    if (parsed.data.status) filters.push(eq(orders.status, parsed.data.status));
    const where = and(...filters);
    const [items, [total]] = await withTenantTransaction(context.tenantId, async (tx) => Promise.all([
      tx.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(parsed.data.limit).offset(parsed.data.offset),
      tx.select({ total: count() }).from(orders).where(where),
    ]));
    const lineItems = items.length ? await withTenantTransaction(context.tenantId, async (tx) => {
      return tx.select().from(orderItems)
        .where(and(eq(orderItems.tenantId, context.tenantId), inArray(orderItems.orderId, items.map((item) => item.id))));
    }) : [];
    const grouped = new Map<string, typeof lineItems>();
    for (const item of lineItems) grouped.set(item.orderId, [...(grouped.get(item.orderId) ?? []), item]);
    return reply.send({
      items: items.map((item) => ({ ...item, lines: grouped.get(item.id) ?? [] })), total: total?.total ?? 0, ...parsed.data,
      canUpdate: context.roles.some((role) => ["owner", "admin", "orderManager"].includes(role)),
    });
  });

  app.patch<{ Params: { orderId: string } }>("/admin/commerce/orders/:orderId", async (request, reply) => {
    const parsed = orderStatusInputSchema.safeParse(request.body);
    if (!parsed.success || !isUuid(request.params.orderId)) return reply.code(400).send({ error: "INVALID_INPUT", ...(parsed.success ? {} : { details: parsed.error.flatten() }) });
    const context = await requireCommercePermission(request.headers, { order: ["update"] });
    const result = await auditMutation(request, context, "commerce.order.fulfilled", "order", request.params.orderId, () =>
      withTenantTransaction(context.tenantId, async (tx) => {
        const [order] = await tx.select().from(orders)
          .where(and(eq(orders.id, request.params.orderId), eq(orders.tenantId, context.tenantId))).for("update").limit(1);
        if (!order) return { kind: "missing" as const };
        if (order.status === "fulfilled") return { kind: "updated" as const, order };
        if (order.status !== "paid") return { kind: "invalid_state" as const, order };
        const [updated] = await tx.update(orders).set({ status: parsed.data.status, updatedAt: new Date() })
          .where(and(eq(orders.id, order.id), eq(orders.tenantId, context.tenantId), eq(orders.status, "paid"))).returning();
        return updated ? { kind: "updated" as const, order: updated } : { kind: "invalid_state" as const, order };
      }));
    if (result.kind === "missing") return reply.code(404).send({ error: "ORDER_NOT_FOUND" });
    if (result.kind === "invalid_state") return reply.code(409).send({ error: "ORDER_NOT_READY_FOR_FULFILLMENT", currentStatus: result.order.status });
    return reply.send({ order: result.order });
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

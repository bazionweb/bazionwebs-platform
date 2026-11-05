import { sql } from "drizzle-orm";
import {
  bigint, boolean, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("KES"),
  authOrganizationId: varchar("auth_organization_id", { length: 128 }),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  sku: varchar("sku", { length: 80 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  priceMinor: bigint("price_minor", { mode: "number" }).notNull(),
  stockTracked: boolean("stock_tracked").notNull().default(true),
  stockOnHand: integer("stock_on_hand").notNull().default(0),
  stockReserved: integer("stock_reserved").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("products_currency_ck", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
  check("products_price_minor_safe_ck", sql`${table.priceMinor} between 0 and 9007199254740991`),
  check("products_stock_on_hand_ck", sql`${table.stockOnHand} >= 0`),
  check("products_stock_reserved_nonnegative_ck", sql`${table.stockReserved} >= 0`),
  check("products_stock_reserved_ck", sql`${table.stockReserved} <= ${table.stockOnHand}`),
  uniqueIndex("products_tenant_sku_uq").on(table.tenantId, table.sku),
  uniqueIndex("products_id_tenant_uq").on(table.id, table.tenantId),
  index("products_tenant_active_idx").on(table.tenantId, table.active),
]);

export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("open"),
  guestTokenHash: varchar("guest_token_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("carts_currency_ck", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
  check("carts_status_ck", sql`${table.status} in ('open', 'converted', 'expired')`),
  uniqueIndex("carts_id_tenant_uq").on(table.id, table.tenantId),
  index("carts_tenant_status_idx").on(table.tenantId, table.status),
]);

export const cartItems = pgTable("cart_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  cartId: uuid("cart_id").notNull(),
  productId: uuid("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("cart_items_quantity_ck", sql`${table.quantity} between 1 and 99`),
  check("cart_items_unit_price_safe_ck", sql`${table.unitPriceMinor} between 0 and 9007199254740991`),
  uniqueIndex("cart_items_cart_product_uq").on(table.cartId, table.productId),
  uniqueIndex("cart_items_id_tenant_uq").on(table.id, table.tenantId),
  foreignKey({ columns: [table.cartId, table.tenantId], foreignColumns: [carts.id, carts.tenantId], name: "cart_items_cart_fk" }).onDelete("cascade"),
  foreignKey({ columns: [table.productId, table.tenantId], foreignColumns: [products.id, products.tenantId], name: "cart_items_product_fk" }),
  index("cart_items_tenant_cart_idx").on(table.tenantId, table.cartId),
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  orderNumber: varchar("order_number", { length: 40 }).notNull(),
  cartId: uuid("cart_id").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending_payment"),
  currency: varchar("currency", { length: 3 }).notNull(),
  subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull(),
  discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
  shippingMinor: bigint("shipping_minor", { mode: "number" }).notNull().default(0),
  taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull(),
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  customerEmail: varchar("customer_email", { length: 254 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 24 }).notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("orders_status_ck", sql`${table.status} in ('pending_payment', 'paid', 'cancelled', 'fulfilled', 'refunded')`),
  check("orders_currency_ck", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
  check("orders_money_safe_ck", sql`${table.subtotalMinor} between 0 and 9007199254740991 and ${table.discountMinor} between 0 and 9007199254740991 and ${table.shippingMinor} between 0 and 9007199254740991 and ${table.taxMinor} between 0 and 9007199254740991 and ${table.totalMinor} between 0 and 9007199254740991`),
  check("orders_total_consistency_ck", sql`${table.discountMinor} <= ${table.subtotalMinor} and ${table.totalMinor} = ${table.subtotalMinor} - ${table.discountMinor} + ${table.shippingMinor} + ${table.taxMinor}`),
  uniqueIndex("orders_tenant_number_uq").on(table.tenantId, table.orderNumber),
  uniqueIndex("orders_id_tenant_uq").on(table.id, table.tenantId),
  foreignKey({ columns: [table.cartId, table.tenantId], foreignColumns: [carts.id, carts.tenantId], name: "orders_cart_fk" }),
  index("orders_tenant_created_idx").on(table.tenantId, table.createdAt),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  orderId: uuid("order_id").notNull(),
  productId: uuid("product_id").notNull(),
  skuSnapshot: varchar("sku_snapshot", { length: 80 }).notNull(),
  nameSnapshot: varchar("name_snapshot", { length: 180 }).notNull(),
  quantity: integer("quantity").notNull(),
  reservedQuantity: integer("reserved_quantity").notNull().default(0),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
  lineTotalMinor: bigint("line_total_minor", { mode: "number" }).notNull(),
}, (table) => [
  check("order_items_quantity_ck", sql`${table.quantity} between 1 and 99`),
  check("order_items_reserved_quantity_ck", sql`${table.reservedQuantity} between 0 and ${table.quantity}`),
  check("order_items_line_money_safe_ck", sql`${table.unitPriceMinor} between 0 and 9007199254740991 and ${table.lineTotalMinor} between 0 and 9007199254740991`),
  check("order_items_line_total_ck", sql`${table.lineTotalMinor} = ${table.unitPriceMinor} * ${table.quantity}`),
  uniqueIndex("order_items_id_tenant_uq").on(table.id, table.tenantId),
  foreignKey({ columns: [table.orderId, table.tenantId], foreignColumns: [orders.id, orders.tenantId], name: "order_items_order_fk" }),
  foreignKey({ columns: [table.productId, table.tenantId], foreignColumns: [products.id, products.tenantId], name: "order_items_product_fk" }),
  index("order_items_tenant_order_idx").on(table.tenantId, table.orderId),
]);

export const paymentAttempts = pgTable("payment_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  orderId: uuid("order_id").notNull(),
  provider: varchar("provider", { length: 24 }).notNull(),
  providerReference: varchar("provider_reference", { length: 160 }),
  status: varchar("status", { length: 32 }).notNull().default("created"),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  checkoutUrl: text("checkout_url"),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("payment_attempts_status_ck", sql`${table.status} in ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled')`),
  check("payment_attempts_currency_ck", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
  check("payment_attempts_amount_safe_ck", sql`${table.amountMinor} between 0 and 9007199254740991`),
  uniqueIndex("payment_attempts_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("payment_attempts_tenant_idem_uq").on(table.tenantId, table.idempotencyKey),
  foreignKey({ columns: [table.orderId, table.tenantId], foreignColumns: [orders.id, orders.tenantId], name: "payment_attempts_order_fk" }),
  index("payment_attempts_tenant_order_idx").on(table.tenantId, table.orderId),
]);

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  provider: varchar("provider", { length: 24 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 200 }).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("webhook_events_tenant_provider_event_uq").on(table.tenantId, table.provider, table.providerEventId)]);

export const idempotencyRecords = pgTable("idempotency_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  key: varchar("key", { length: 160 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  resourceId: uuid("resource_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idempotency_tenant_key_uq").on(table.tenantId, table.key),
  foreignKey({ columns: [table.resourceId, table.tenantId], foreignColumns: [orders.id, orders.tenantId], name: "idempotency_resource_fk" }),
]);


export const tenantDomains = pgTable("tenant_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  hostname: varchar("hostname", { length: 253 }).notNull(),
  verificationTokenHash: varchar("verification_token_hash", { length: 64 }),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("tenant_domains_hostname_lower_ck", sql`${table.hostname} = lower(${table.hostname})`),
  check("tenant_domains_status_ck", sql`${table.status} in ('pending', 'active', 'disabled')`),
  uniqueIndex("tenant_domains_hostname_uq").on(table.hostname),
  index("tenant_domains_tenant_idx").on(table.tenantId),
]);

export const platformMembers = pgTable("platform_members", {
  userId: varchar("user_id", { length: 128 }).primaryKey(),
  email: varchar("email", { length: 254 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("platform_members_role_ck", sql`${table.role} in ('platform_owner', 'platform_admin', 'platform_support')`),
  check("platform_members_status_ck", sql`${table.status} in ('active', 'suspended')`),
  uniqueIndex("platform_members_email_uq").on(sql`lower(${table.email})`),
]);

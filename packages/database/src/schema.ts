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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
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
  callbackTokenHash: varchar("callback_token_hash", { length: 64 }),
  statusTokenHash: varchar("status_token_hash", { length: 64 }),
  checkoutRequestId: varchar("checkout_request_id", { length: 160 }),
  merchantRequestId: varchar("merchant_request_id", { length: 160 }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("payment_attempts_status_ck", sql`${table.status} in ('created', 'requires_action', 'processing', 'succeeded', 'failed', 'cancelled')`),
  check("payment_attempts_currency_ck", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
  check("payment_attempts_amount_safe_ck", sql`${table.amountMinor} between 0 and 9007199254740991`),
  uniqueIndex("payment_attempts_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("payment_attempts_tenant_idem_uq").on(table.tenantId, table.idempotencyKey),
  uniqueIndex("payment_attempts_callback_token_uq").on(table.callbackTokenHash).where(sql`${table.callbackTokenHash} is not null`),
  uniqueIndex("payment_attempts_status_token_uq").on(table.statusTokenHash).where(sql`${table.statusTokenHash} is not null`),
  uniqueIndex("payment_attempts_checkout_request_uq").on(table.checkoutRequestId).where(sql`${table.checkoutRequestId} is not null`),
  uniqueIndex("payment_attempts_provider_receipt_uq").on(table.provider, table.providerReference).where(sql`${table.providerReference} is not null`),
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

/**
 * Platform infrastructure queue, not tenant-owned business data.
 * Message contents are encrypted by @bazion/notifications before insertion.
 */
export const notificationOutbox = pgTable("notification_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id"),
  channel: varchar("channel", { length: 8 }).notNull(),
  payloadCiphertext: text("payload_ciphertext").notNull(),
  payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(8),
  availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastErrorCode: varchar("last_error_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("notification_outbox_channel_ck", sql`${table.channel} in ('email', 'sms')`),
  check("notification_outbox_status_ck", sql`${table.status} in ('pending', 'processing', 'sent', 'dead')`),
  check("notification_outbox_attempts_ck", sql`${table.attempts} >= 0 and ${table.maxAttempts} between 1 and 20`),
  uniqueIndex("notification_outbox_idempotency_uq").on(table.idempotencyKey),
  index("notification_outbox_pending_idx").on(table.availableAt, table.createdAt)
    .where(sql`${table.status} = 'pending'`),
  index("notification_outbox_processing_lease_idx").on(table.lockedAt)
    .where(sql`${table.status} = 'processing'`),
]);

// ─── Church & Ministry Domain Entities ─────────────────────────────────────────

export const ministryProfiles = pgTable("ministry_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  ministryName: varchar("ministry_name", { length: 180 }).notNull(),
  logoAssetUrl: text("logo_asset_url"),
  description: text("description"),
  vision: text("vision"),
  mission: text("mission"),
  outreach: text("outreach"),
  foundingDate: varchar("founding_date", { length: 40 }),
  address: text("address"),
  email: varchar("email", { length: 254 }),
  telephoneNumbers: jsonb("telephone_numbers"),
  socialLinks: jsonb("social_links"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ministry_profiles_tenant_uq").on(table.tenantId),
]);

export const ministrySettings = pgTable("ministry_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  settingKey: varchar("setting_key", { length: 80 }).notNull(),
  settingValue: text("setting_value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ministry_settings_tenant_key_uq").on(table.tenantId, table.settingKey),
]);

export const leadershipProfiles = pgTable("leadership_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 160 }).notNull(),
  position: varchar("position", { length: 120 }).notNull(),
  biography: text("biography"),
  photoUrl: text("photo_url"),
  displayOrder: integer("display_order").notNull().default(0),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("leadership_profiles_tenant_order_idx").on(table.tenantId, table.displayOrder),
]);

export const sermonCategories = pgTable("sermon_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
}, (table) => [
  uniqueIndex("sermon_categories_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("sermon_categories_tenant_slug_uq").on(table.tenantId, table.slug),
]);

export const sermons = pgTable("sermons", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  description: text("description"),
  speaker: varchar("speaker", { length: 160 }).notNull(),
  categoryId: uuid("category_id"),
  youtubeVideoId: varchar("youtube_video_id", { length: 64 }),
  thumbnailUrl: text("thumbnail_url"),
  scriptureReference: varchar("scripture_reference", { length: 160 }),
  notesJson: jsonb("notes_json"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  status: varchar("status", { length: 24 }).notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.categoryId, table.tenantId], foreignColumns: [sermonCategories.id, sermonCategories.tenantId], name: "sermons_category_tenant_fk" }),
  uniqueIndex("sermons_tenant_slug_uq").on(table.tenantId, table.slug),
  index("sermons_tenant_status_pub_idx").on(table.tenantId, table.status, table.publishedAt),
]);

export const churchEvents = pgTable("church_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  description: text("description"),
  posterUrl: text("poster_url"),
  venue: varchar("venue", { length: 180 }),
  address: text("address"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
  registrationCapacity: integer("registration_capacity"),
  status: varchar("status", { length: 24 }).notNull().default("upcoming"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_events_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("church_events_tenant_slug_uq").on(table.tenantId, table.slug),
  check("church_events_capacity_positive_ck", sql`${table.registrationCapacity} is null or ${table.registrationCapacity} > 0`),
  check("church_events_time_order_ck", sql`${table.endsAt} is null or ${table.endsAt} >= ${table.startsAt}`),
  index("church_events_tenant_starts_idx").on(table.tenantId, table.startsAt),
]);

export const churchEventRegistrations = pgTable("church_event_registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  eventId: uuid("event_id").notNull(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  telephone: varchar("telephone", { length: 30 }).notNull(),
  registrationReference: varchar("registration_reference", { length: 40 }).notNull(),
  status: varchar("status", { length: 24 }).notNull().default("confirmed"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_event_registrations_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("church_event_reg_tenant_ref_uq").on(table.tenantId, table.registrationReference),
  foreignKey({ columns: [table.eventId, table.tenantId], foreignColumns: [churchEvents.id, churchEvents.tenantId], name: "church_event_registrations_event_tenant_fk" }),
  index("church_event_reg_tenant_event_idx").on(table.tenantId, table.eventId),
]);

export const donationCampaigns = pgTable("donation_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  title: varchar("title", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description"),
  targetAmountMinor: bigint("target_amount_minor", { mode: "number" }).notNull(),
  raisedAmountMinor: bigint("raised_amount_minor", { mode: "number" }).notNull().default(0),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("donation_campaigns_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("donation_campaigns_tenant_slug_uq").on(table.tenantId, table.slug),
  check("donation_campaigns_target_amount_minor_check", sql`${table.targetAmountMinor} >= 0`),
  check("donation_campaigns_raised_amount_minor_check", sql`${table.raisedAmountMinor} >= 0`),
  check("donation_campaigns_currency_check", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
]);

export const churchDonations = pgTable("church_donations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  campaignId: uuid("campaign_id"),
  donorName: varchar("donor_name", { length: 160 }),
  donorEmail: varchar("donor_email", { length: 254 }),
  donorPhone: varchar("donor_phone", { length: 30 }),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  givingCategory: varchar("giving_category", { length: 80 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 40 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 32 }).notNull().default("pending"),
  anonymous: boolean("anonymous").notNull().default(false),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_donations_id_tenant_uq").on(table.id, table.tenantId),
  foreignKey({ columns: [table.campaignId, table.tenantId], foreignColumns: [donationCampaigns.id, donationCampaigns.tenantId], name: "church_donations_campaign_tenant_fk" }),
  check("church_donations_amount_minor_check", sql`${table.amountMinor} > 0`),
  check("church_donations_currency_check", sql`${table.currency} in ('KES', 'USD', 'EUR', 'GBP')`),
  check("church_donations_payment_status_check", sql`${table.paymentStatus} in ('pending', 'verified', 'failed')`),
  index("church_donations_tenant_created_idx").on(table.tenantId, table.createdAt),
]);

export const churchPaymentTransactions = pgTable("church_payment_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  donationId: uuid("donation_id").notNull(),
  provider: varchar("provider", { length: 40 }).notNull(),
  providerReference: varchar("provider_reference", { length: 160 }),
  checkoutRequestId: varchar("checkout_request_id", { length: 160 }),
  merchantRequestId: varchar("merchant_request_id", { length: 160 }),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  transactionStatus: varchar("transaction_status", { length: 32 }).notNull().default("pending"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  callbackTokenHash: varchar("callback_token_hash", { length: 64 }),
  statusTokenHash: varchar("status_token_hash", { length: 64 }),
  idempotencyKey: varchar("idempotency_key", { length: 160 }),
  rawCallbackJson: jsonb("raw_callback_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_payment_transactions_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("church_payment_callback_token_uq").on(table.callbackTokenHash).where(sql`${table.callbackTokenHash} is not null`),
  uniqueIndex("church_payment_status_token_uq").on(table.statusTokenHash).where(sql`${table.statusTokenHash} is not null`),
  uniqueIndex("church_payment_idempotency_uq").on(table.tenantId, table.idempotencyKey).where(sql`${table.idempotencyKey} is not null`),
  foreignKey({ columns: [table.donationId, table.tenantId], foreignColumns: [churchDonations.id, churchDonations.tenantId], name: "church_payment_transactions_donation_tenant_fk" }),
  check("church_payment_transactions_amount_minor_check", sql`${table.amountMinor} > 0`),
  check("church_payment_transactions_status_ck", sql`${table.transactionStatus} in ('pending', 'succeeded', 'failed')`),
  index("church_payment_tx_tenant_donation_idx").on(table.tenantId, table.donationId),
]);

export const churchContactMessages = pgTable("church_contact_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  telephone: varchar("telephone", { length: 30 }),
  subject: varchar("subject", { length: 200 }),
  message: text("message").notNull(),
  category: varchar("category", { length: 60 }).notNull().default("General Enquiry"),
  status: varchar("status", { length: 24 }).notNull().default("new"),
  assignedTo: varchar("assigned_to", { length: 128 }),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("church_contact_msg_tenant_status_idx").on(table.tenantId, table.status),
]);

export const churchPrayerRequests = pgTable("church_prayer_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }),
  telephone: varchar("telephone", { length: 30 }),
  requestText: text("request_text").notNull(),
  privacyPreference: varchar("privacy_preference", { length: 30 }).notNull().default("confidential"),
  status: varchar("status", { length: 24 }).notNull().default("received"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("church_prayer_req_tenant_status_idx").on(table.tenantId, table.status),
]);

export const churchNewsletterSubscribers = pgTable("church_newsletter_subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  email: varchar("email", { length: 254 }).notNull(),
  consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),
  unsubscribeAt: timestamp("unsubscribe_at", { withTimezone: true }),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_newsletter_tenant_email_uq").on(table.tenantId, sql`lower(${table.email})`),
]);


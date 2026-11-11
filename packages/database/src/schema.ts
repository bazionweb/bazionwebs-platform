import { tenants } from "./schema/tenants.js";
import { sql } from "drizzle-orm";
import {
  bigint, boolean, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

export { tenants } from "./schema/tenants.js";
export * from "./schema/commerce.js";

/** Control-plane routing metadata. This table stores secret references, never credentials. */
export const tenantDatabaseBindings = pgTable("tenant_database_bindings", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "restrict" }),
  tier: varchar("tier", { length: 16 }).notNull().default("shared"),
  state: varchar("state", { length: 16 }).notNull().default("shared"),
  runtimeSecretRef: varchar("runtime_secret_ref", { length: 512 }),
  migrationSecretRef: varchar("migration_secret_ref", { length: 512 }),
  schemaVersion: varchar("schema_version", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("tenant_database_bindings_tier_ck", sql`${table.tier} in ('shared', 'dedicated')`),
  check("tenant_database_bindings_state_ck", sql`${table.state} in ('shared', 'provisioning', 'ready', 'failed', 'draining')`),
  check("tenant_database_bindings_shared_ck", sql`${table.tier} <> 'shared' or (${table.state} = 'shared' and ${table.runtimeSecretRef} is null and ${table.migrationSecretRef} is null and ${table.schemaVersion} is null)`),
  check("tenant_database_bindings_ready_ck", sql`${table.state} <> 'ready' or (${table.tier} = 'dedicated' and ${table.runtimeSecretRef} is not null and ${table.migrationSecretRef} is not null and ${table.schemaVersion} is not null)`),
]);export const tenantDomains = pgTable("tenant_domains", {
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

/** Generic website contact submissions, separate from the Church/Ministry inbox. */
export const siteEnquiries = pgTable("site_enquiries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  formId: varchar("form_id", { length: 80 }).notNull().default("contact"),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }),
  telephone: varchar("telephone", { length: 30 }),
  subject: varchar("subject", { length: 200 }),
  message: text("message").notNull(),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }).notNull(),
  privacyNoticeVersion: varchar("privacy_notice_version", { length: 40 }).notNull(),
  retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("site_enquiries_contact_ck", sql`${table.email} is not null or ${table.telephone} is not null`),
  check("site_enquiries_retention_ck", sql`${table.retentionExpiresAt} > ${table.createdAt}`),
  index("site_enquiries_tenant_created_idx").on(table.tenantId, table.createdAt, table.id),
  index("site_enquiries_expiration_idx").on(table.tenantId, table.retentionExpiresAt),
]);

export const siteEnquiryPolicies = pgTable("site_enquiry_policies", {
  tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id),
  enabled: boolean("enabled").notNull().default(false),
  privacyNotice: text("privacy_notice").notNull().default(""),
  privacyNoticeVersion: varchar("privacy_notice_version", { length: 40 }).notNull().default("1.0.0"),
  retentionDays: integer("retention_days").notNull().default(180),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("site_enquiry_policies_retention_ck", sql`${table.retentionDays} between 1 and 3650`),
  check("site_enquiry_policies_version_ck", sql`${table.privacyNoticeVersion} ~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'`),
  check("site_enquiry_policies_publish_ck", sql`not ${table.enabled} or (length(btrim(${table.privacyNotice})) >= 40 and ${table.publishedAt} is not null)`),
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


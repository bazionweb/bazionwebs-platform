import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  productProvisioningOperationEvents,
  productProvisioningOperations,
} from "./product-installations.js";

/** Control-plane intake receipts keyed by commercial idempotency key and request fingerprint. */
export const productProvisioningInbox = pgTable("product_provisioning_inbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: varchar("source", { length: 32 }).notNull(),
  eventId: uuid("event_id").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
  externalOrderId: varchar("external_order_id", { length: 128 }).notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  operationId: uuid("operation_id")
    .notNull()
    .references(() => productProvisioningOperations.id, { onDelete: "restrict" }),
  receivedCount: integer("received_count").notNull().default(1),
  firstReceivedAt: timestamp("first_received_at", { withTimezone: true }).notNull().defaultNow(),
  lastReceivedAt: timestamp("last_received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idempotencyUnique: uniqueIndex("product_provisioning_inbox_idempotency_uq").on(table.source, table.idempotencyKey),
  eventUnique: uniqueIndex("product_provisioning_inbox_event_uq").on(table.source, table.eventId),
  orderUnique: uniqueIndex("product_provisioning_inbox_order_uq").on(table.source, table.externalOrderId),
  operationIdx: index("product_provisioning_inbox_operation_idx").on(table.operationId),
}));

/** Transactional outbox for delivering signed provisioning status callbacks to the commercial system. */
export const productProvisioningStatusOutbox = pgTable("product_provisioning_status_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  operationId: uuid("operation_id")
    .notNull()
    .references(() => productProvisioningOperations.id, { onDelete: "cascade" }),
  operationEventId: uuid("operation_event_id")
    .notNull()
    .references(() => productProvisioningOperationEvents.id, { onDelete: "cascade" }),
  idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull(),
  eventId: uuid("event_id").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  destination: varchar("destination", { length: 32 }).notNull().default("bazionweb"),
  statusSnapshot: varchar("status_snapshot", { length: 32 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(8),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastHttpStatus: integer("last_http_status"),
  lastErrorCode: varchar("last_error_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
}, (table) => ({
  idempotencyUnique: uniqueIndex("product_provisioning_status_outbox_idempotency_uq").on(table.idempotencyKey),
  eventUnique: uniqueIndex("product_provisioning_status_outbox_event_uq").on(table.eventId),
  operationEventUnique: uniqueIndex("product_provisioning_status_outbox_op_event_uq").on(table.operationEventId),
  operationIdx: index("product_provisioning_status_outbox_operation_idx").on(table.operationId, table.createdAt),
}));

/** Deduplicated signed subscription lifecycle commands received from Bazionweb. */
export const productSubscriptionLifecycleInbox = pgTable("product_subscription_lifecycle_inbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  source: varchar("source", { length: 24 }).notNull().default("bazionweb"),
  eventId: uuid("event_id").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
  subscriptionId: varchar("subscription_id", { length: 120 }).notNull(),
  externalCustomerId: varchar("external_customer_id", { length: 120 }).notNull(),
  externalOrderId: varchar("external_order_id", { length: 120 }).notNull(),
  action: varchar("action", { length: 24 }).notNull(),
  reasonCode: varchar("reason_code", { length: 80 }).notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  graceEndsAt: timestamp("grace_ends_at", { withTimezone: true }),
  tenantId: uuid("tenant_id"),
  installationId: uuid("installation_id"),
  resultingInstallationStatus: varchar("resulting_installation_status", { length: 24 }),
  applied: boolean("applied").notNull().default(true),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  idempotencyUnique: uniqueIndex("product_sub_lifecycle_inbox_idempotency_uq").on(table.source, table.idempotencyKey),
  eventUnique: uniqueIndex("product_sub_lifecycle_inbox_event_uq").on(table.source, table.eventId),
  subIdx: index("product_sub_lifecycle_inbox_sub_idx").on(table.subscriptionId, table.effectiveAt),
}));

/** Outbox for signed subscription lifecycle status callbacks back to Bazionweb. */
export const productSubscriptionLifecycleOutbox = pgTable("product_subscription_lifecycle_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  lifecycleInboxId: uuid("lifecycle_inbox_id")
    .notNull()
    .references(() => productSubscriptionLifecycleInbox.id, { onDelete: "restrict" }),
  idempotencyKey: varchar("idempotency_key", { length: 240 }).notNull(),
  eventId: uuid("event_id").notNull(),
  correlationId: uuid("correlation_id").notNull(),
  destination: varchar("destination", { length: 32 }).notNull().default("bazionweb"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  payloadHash: text("payload_hash").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(8),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastHttpStatus: integer("last_http_status"),
  lastErrorCode: varchar("last_error_code", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
}, (table) => ({
  idempotencyUnique: uniqueIndex("product_subscription_lifecycle_outbox_idempotency_key_key").on(table.idempotencyKey),
  eventUnique: uniqueIndex("product_subscription_lifecycle_outbox_event_id_key").on(table.eventId),
}));

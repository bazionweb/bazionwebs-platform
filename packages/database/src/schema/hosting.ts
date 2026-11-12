import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const tenantHostingDeployments = pgTable("tenant_hosting_deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  provider: varchar("provider", { length: 40 }).notNull(),
  template: varchar("template", { length: 32 }).notNull(),
  templateVersion: varchar("template_version", { length: 80 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 200 }).notNull(),
  providerResourceId: varchar("provider_resource_id", { length: 255 }),
  state: varchar("state", { length: 24 }).notNull().default("provisioning"),
  attemptCount: integer("attempt_count").notNull().default(1),
  requestedBy: varchar("requested_by", { length: 128 }).notNull(),
  requestId: varchar("request_id", { length: 128 }),
  errorCode: varchar("error_code", { length: 64 }),
  leaseToken: uuid("lease_token"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  lastDeployedAt: timestamp("last_deployed_at", { withTimezone: true }),
  nextReconcileAt: timestamp("next_reconcile_at", { withTimezone: true }).notNull().defaultNow(),
  lastInspectedAt: timestamp("last_inspected_at", { withTimezone: true }),
  reconcileFailureCount: integer("reconcile_failure_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("tenant_hosting_deployments_template_ck", sql`${table.template} in ('wordpress', 'node-nextjs', 'ecommerce')`),
  check("tenant_hosting_deployments_state_ck", sql`${table.state} in ('provisioning', 'ready', 'deploying', 'running', 'stopped', 'failed', 'unknown', 'removed')`),
  check("tenant_hosting_deployments_attempt_ck", sql`${table.attemptCount} >= 1`),
  check("tenant_hosting_deployments_reconcile_failure_ck", sql`${table.reconcileFailureCount} >= 0`),
  check("tenant_hosting_deployments_lease_ck", sql`(${table.leaseToken} is null) = (${table.leaseExpiresAt} is null)`),
  uniqueIndex("tenant_hosting_deployments_idempotency_uq").on(table.tenantId, table.idempotencyKey),
  uniqueIndex("tenant_hosting_deployments_id_tenant_uq").on(table.id, table.tenantId),
  uniqueIndex("tenant_hosting_provider_resource_uq").on(table.provider, table.providerResourceId)
    .where(sql`${table.providerResourceId} is not null`),
  index("tenant_hosting_deployments_tenant_created_idx").on(table.tenantId, table.createdAt),
  index("tenant_hosting_deployments_recovery_idx").on(table.state, table.leaseExpiresAt)
    .where(sql`${table.state} in ('provisioning', 'deploying', 'unknown')`),
  index("tenant_hosting_deployments_reconcile_due_idx")
    .on(table.provider, table.nextReconcileAt, table.leaseExpiresAt, table.createdAt)
    .where(sql`${table.providerResourceId} is not null`),
]);

export const tenantHostingDeploymentEvents = pgTable("tenant_hosting_deployment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  deploymentId: uuid("deployment_id").notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  fromState: varchar("from_state", { length: 24 }),
  toState: varchar("to_state", { length: 24 }),
  actorType: varchar("actor_type", { length: 16 }).notNull(),
  actorId: varchar("actor_id", { length: 128 }).notNull(),
  requestId: varchar("request_id", { length: 128 }),
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("tenant_hosting_events_actor_type_ck", sql`${table.actorType} in ('user', 'service', 'system')`),
  foreignKey({ columns: [table.deploymentId, table.tenantId], foreignColumns: [tenantHostingDeployments.id, tenantHostingDeployments.tenantId], name: "tenant_hosting_events_deployment_tenant_fk" }),
  check("tenant_hosting_events_metadata_ck", sql`jsonb_typeof(${table.metadata}) = 'object'`),
  index("tenant_hosting_events_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
  index("tenant_hosting_events_deployment_occurred_idx").on(table.deploymentId, table.occurredAt),
]);

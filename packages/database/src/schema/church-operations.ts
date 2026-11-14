import { sql } from "drizzle-orm";
import {
  boolean,
  date,
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
import { tenants } from "../schema.js";

export const churchDepartments = pgTable("church_departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 32 }),
  leaderName: varchar("leader_name", { length: 160 }),
  leaderRole: varchar("leader_role", { length: 120 }),
  meetingSchedule: varchar("meeting_schedule", { length: 200 }),
  contactEmail: varchar("contact_email", { length: 254 }),
  isPublic: boolean("is_public").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_departments_tenant_slug_uq").on(table.tenantId, table.slug),
  index("church_departments_tenant_order_idx").on(table.tenantId, table.displayOrder),
]);

export const churchSmallGroups = pgTable("church_small_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  category: varchar("category", { length: 80 }).notNull().default("Home Fellowship"),
  description: text("description"),
  leaderName: varchar("leader_name", { length: 160 }).notNull(),
  meetingSchedule: varchar("meeting_schedule", { length: 200 }).notNull(),
  publicLocationLabel: varchar("public_location_label", { length: 300 }).notNull(),
  privateAddress: text("private_address"),
  departmentId: uuid("department_id").references(() => churchDepartments.id),
  capacity: integer("capacity"),
  isPublic: boolean("is_public").notNull().default(true),
  acceptingMembers: boolean("accepting_members").notNull().default(true),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_small_groups_tenant_slug_uq").on(table.tenantId, table.slug),
  index("church_small_groups_tenant_status_idx").on(table.tenantId, table.status),
]);

export const churchGroupMemberships = pgTable("church_group_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  groupId: uuid("group_id").notNull().references(() => churchSmallGroups.id),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  telephone: varchar("telephone", { length: 30 }).notNull(),
  role: varchar("role", { length: 24 }).notNull().default("member"),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_group_memberships_tenant_group_email_uq").on(table.tenantId, table.groupId, table.email),
  index("church_group_memberships_tenant_group_idx").on(table.tenantId, table.groupId),
]);

export const churchVolunteerTeams = pgTable("church_volunteer_teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 140 }).notNull(),
  departmentId: uuid("department_id").references(() => churchDepartments.id),
  description: text("description").notNull(),
  requirements: text("requirements"),
  coordinatorName: varchar("coordinator_name", { length: 160 }),
  isPublic: boolean("is_public").notNull().default(true),
  acceptingApplications: boolean("accepting_applications").notNull().default(true),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_volunteer_teams_tenant_slug_uq").on(table.tenantId, table.slug),
  index("church_volunteer_teams_tenant_status_idx").on(table.tenantId, table.status),
]);

export const churchVolunteerApplications = pgTable("church_volunteer_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  teamId: uuid("team_id").notNull().references(() => churchVolunteerTeams.id),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  telephone: varchar("telephone", { length: 30 }).notNull(),
  availability: varchar("availability", { length: 300 }),
  message: text("message"),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  privacyConsentAt: timestamp("privacy_consent_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: varchar("reviewed_by", { length: 160 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("church_volunteer_apps_tenant_team_idx").on(table.tenantId, table.teamId),
]);

export const churchInventoryAssets = pgTable("church_inventory_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: varchar("name", { length: 160 }).notNull(),
  assetTag: varchar("asset_tag", { length: 60 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  location: varchar("location", { length: 180 }).notNull().default("Main Campus"),
  condition: varchar("condition", { length: 24 }).notNull().default("good"),
  status: varchar("status", { length: 24 }).notNull().default("available"),
  assignedTo: varchar("assigned_to", { length: 160 }),
  acquiredOn: date("acquired_on"),
  purchaseValueMinor: integer("purchase_value_minor"),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("church_inventory_assets_tenant_tag_uq").on(table.tenantId, table.assetTag),
  index("church_inventory_assets_tenant_category_idx").on(table.tenantId, table.category),
]);

export const churchInventoryAssetEvents = pgTable("church_inventory_asset_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  assetId: uuid("asset_id").notNull().references(() => churchInventoryAssets.id),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  description: text("description").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  recordedBy: varchar("recorded_by", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("church_asset_events_tenant_asset_idx").on(table.tenantId, table.assetId),
]);

export const ministrySiteSettingsVersions = pgTable("ministry_site_settings_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  versionNumber: integer("version_number").notNull(),
  settings: jsonb("settings").notNull(),
  profile: jsonb("profile").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("published"),
  createdBy: varchar("created_by", { length: 160 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: varchar("published_by", { length: 160 }),
  note: varchar("note", { length: 250 }),
}, (table) => [
  uniqueIndex("ministry_site_settings_versions_tenant_version_uq").on(table.tenantId, table.versionNumber),
  index("ministry_site_settings_versions_tenant_status_idx").on(table.tenantId, table.status),
]);


import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
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

export const hkmBranches = pgTable("hkm_branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 160 }).notNull(),
  location: varchar("location", { length: 240 }).notNull().default(""),
  pastorName: varchar("pastor_name", { length: 160 }).notNull().default(""),
  contactPhone: varchar("contact_phone", { length: 40 }).notNull().default(""),
  contactEmail: varchar("contact_email", { length: 254 }).notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("hkm_branches_id_tenant_uq").on(t.id, t.tenantId),
  uniqueIndex("hkm_branches_tenant_name_uq").on(t.tenantId, t.name),
  index("hkm_branches_tenant_status_idx").on(t.tenantId, t.status),
]);

export const hkmMembers = pgTable("hkm_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").notNull(),
  membershipNumber: varchar("membership_number", { length: 48 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 80 }).notNull().default(""),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull().default(""),
  department: varchar("department", { length: 120 }).notNull().default(""),
  gender: varchar("gender", { length: 24 }).notNull().default("Male"),
  avatarUrl: text("avatar_url"),
  avatarTransform: jsonb("avatar_transform").$type<{ scale: number; positionX: number; positionY: number } | null>(),
  address: text("address"),
  occupation: varchar("occupation", { length: 160 }),
  maritalStatus: varchar("marital_status", { length: 24 }),
  joinedAt: date("joined_at"),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  role: varchar("role", { length: 80 }).notNull().default("Member"),
  dateOfBirth: date("date_of_birth"),
  baptismDate: date("baptism_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("hkm_members_id_tenant_uq").on(t.id, t.tenantId),
  uniqueIndex("hkm_members_tenant_membership_number_uq").on(t.tenantId, t.membershipNumber),
  uniqueIndex("hkm_members_tenant_email_uq").on(t.tenantId, t.email),
  foreignKey({ columns: [t.branchId, t.tenantId], foreignColumns: [hkmBranches.id, hkmBranches.tenantId], name: "hkm_members_branch_tenant_fk" }).onDelete("restrict"),
  index("hkm_members_tenant_status_idx").on(t.tenantId, t.status),
  index("hkm_members_tenant_name_idx").on(t.tenantId, t.lastName, t.firstName),
]);

export const hkmAttendanceRecords = pgTable("hkm_attendance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id").notNull(),
  serviceDate: date("service_date").notNull(),
  serviceType: varchar("service_type", { length: 120 }).notNull(),
  countMen: integer("count_men").notNull().default(0),
  countWomen: integer("count_women").notNull().default(0),
  countChildren: integer("count_children").notNull().default(0),
  recordedBy: varchar("recorded_by", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.branchId, t.tenantId], foreignColumns: [hkmBranches.id, hkmBranches.tenantId], name: "hkm_attendance_branch_tenant_fk" }).onDelete("restrict"),
  index("hkm_attendance_tenant_date_idx").on(t.tenantId, t.serviceDate),
]);

export const hkmMemberAttendanceRecords = pgTable("hkm_member_attendance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  memberId: uuid("member_id").notNull(),
  branchId: uuid("branch_id").notNull(),
  serviceDate: date("service_date").notNull(),
  serviceType: varchar("service_type", { length: 120 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  recordedBy: varchar("recorded_by", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.memberId, t.tenantId], foreignColumns: [hkmMembers.id, hkmMembers.tenantId], name: "hkm_member_attendance_member_tenant_fk" }).onDelete("restrict"),
  foreignKey({ columns: [t.branchId, t.tenantId], foreignColumns: [hkmBranches.id, hkmBranches.tenantId], name: "hkm_member_attendance_branch_tenant_fk" }).onDelete("restrict"),
  uniqueIndex("hkm_member_attendance_identity_uq").on(t.tenantId, t.memberId, t.serviceDate, t.serviceType),
  index("hkm_member_attendance_tenant_service_idx").on(t.tenantId, t.serviceDate, t.serviceType),
]);

export const hkmGivingTransactions = pgTable("hkm_giving_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  memberId: uuid("member_id"),
  branchId: uuid("branch_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("KES"),
  givingType: varchar("giving_type", { length: 48 }).notNull(),
  transactionKind: varchar("transaction_kind", { length: 16 }).notNull().default("income"),
  description: text("description"),
  nonMemberName: varchar("non_member_name", { length: 160 }),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull().defaultNow(),
  paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("manual"),
  receiptNumber: varchar("receipt_number", { length: 80 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 24 }).notNull().default("verified"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.memberId, t.tenantId], foreignColumns: [hkmMembers.id, hkmMembers.tenantId], name: "hkm_giving_member_tenant_fk" }).onDelete("restrict"),
  foreignKey({ columns: [t.branchId, t.tenantId], foreignColumns: [hkmBranches.id, hkmBranches.tenantId], name: "hkm_giving_branch_tenant_fk" }).onDelete("restrict"),
  uniqueIndex("hkm_giving_tenant_receipt_uq").on(t.tenantId, t.receiptNumber),
  index("hkm_giving_tenant_member_date_idx").on(t.tenantId, t.memberId, t.transactionDate),
]);

export const hkmVisitors = pgTable("hkm_visitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 254 }),
  visitDate: date("visit_date").notNull(),
  serviceAttended: varchar("service_attended", { length: 80 }).notNull().default("Sunday Service"),
  howHeard: varchar("how_heard", { length: 80 }),
  invitedBy: varchar("invited_by", { length: 160 }),
  prayerRequest: text("prayer_request"),
  wantsFollowUp: boolean("wants_follow_up").notNull().default(true),
  followUpStatus: varchar("follow_up_status", { length: 32 }).notNull().default("Pending"),
  assignedTo: varchar("assigned_to", { length: 160 }),
  notes: text("notes"),
  convertedToMember: boolean("converted_to_member").notNull().default(false),
  memberId: uuid("member_id"),
  branchId: uuid("branch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("hkm_visitors_tenant_date_idx").on(t.tenantId, t.visitDate),
]);

export const hkmVisitorFollowUps = pgTable("hkm_visitor_follow_ups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  visitorId: uuid("visitor_id").notNull().references(() => hkmVisitors.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  method: varchar("method", { length: 40 }).notNull().default("Phone Call"),
  notes: text("notes").notNull(),
  outcome: varchar("outcome", { length: 80 }).notNull().default("Reached"),
  nextFollowUpDate: date("next_follow_up_date"),
  followedUpBy: varchar("followed_up_by", { length: 160 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("hkm_visitor_follow_ups_tenant_visitor_idx").on(t.tenantId, t.visitorId),
]);

export const hkmSmsLogs = pgTable("hkm_sms_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
  recipientGroup: varchar("recipient_group", { length: 120 }),
  message: text("message").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("Sent"),
  sentBy: varchar("sent_by", { length: 160 }).notNull(),
  recipientCount: integer("recipient_count").notNull().default(1),
  branchId: uuid("branch_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("hkm_sms_logs_tenant_sent_idx").on(t.tenantId, t.sentAt),
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

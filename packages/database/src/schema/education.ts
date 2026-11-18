import { boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const educationInstitutions = pgTable("education_institutions", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  institutionKey: varchar("institution_key", { length: 48 }).notNull(), name: varchar("name", { length: 180 }).notNull(), legalName: varchar("legal_name", { length: 240 }),
  admissionsEmail: varchar("admissions_email", { length: 254 }), registrarEmail: varchar("registrar_email", { length: 254 }),
  financeEmail: varchar("finance_email", { length: 254 }), adminEmail: varchar("admin_email", { length: 254 }),
  phones: jsonb("phones").$type<string[]>().notNull().default([]), address: text("address"), websiteUrl: varchar("website_url", { length: 2048 }),
  status: varchar("status", { length: 24 }).notNull().default("active"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("education_institutions_tenant_key_uq").on(t.tenantId, t.institutionKey), uniqueIndex("education_institutions_id_tenant_uq").on(t.id, t.tenantId), index("education_institutions_tenant_status_idx").on(t.tenantId, t.status)]);

export const educationPrograms = pgTable("education_programs", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }), institutionId: uuid("institution_id").notNull(),
  code: varchar("code", { length: 48 }).notNull(), name: varchar("name", { length: 180 }).notNull(), abbreviation: varchar("abbreviation", { length: 48 }).notNull().default(""),
  degreeType: varchar("degree_type", { length: 64 }).notNull().default("undergraduate"), description: text("description").notNull().default(""),
  level: varchar("level", { length: 32 }).notNull().default("undergraduate"), faculty: varchar("faculty", { length: 180 }), department: varchar("department", { length: 180 }),
  facultyId: varchar("faculty_id", { length: 80 }), departmentId: varchar("department_id", { length: 80 }), durationYears: integer("duration_years").notNull().default(0),
  totalSemesters: integer("total_semesters").notNull().default(0), modeOfStudy: varchar("mode_of_study", { length: 32 }).notNull().default("full_time"),
  accreditationBody: varchar("accreditation_body", { length: 240 }).notNull().default(""), entryRequirements: text("entry_requirements").notNull().default(""),
  creditsRequired: integer("credits_required").notNull().default(0), active: boolean("active").notNull().default(true), publicVisible: boolean("public_visible").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("education_programs_tenant_institution_code_uq").on(t.tenantId, t.institutionId, t.code), uniqueIndex("education_programs_id_tenant_institution_uq").on(t.id, t.tenantId, t.institutionId), foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_programs_institution_tenant_fk" }).onDelete("restrict"), index("education_programs_tenant_institution_active_idx").on(t.tenantId, t.institutionId, t.active)]);

export const educationTerms = pgTable("education_terms", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }), institutionId: uuid("institution_id").notNull(),
  code: varchar("code", { length: 48 }).notNull(), name: varchar("name", { length: 180 }).notNull(), academicYear: varchar("academic_year", { length: 40 }).notNull(),
  semesterNumber: integer("semester_number").notNull(), startDate: date("start_date").notNull(), endDate: date("end_date").notNull(),
  status: varchar("status", { length: 24 }).notNull().default("upcoming"), registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
  registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }), censusDate: date("census_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("education_terms_tenant_institution_code_uq").on(t.tenantId, t.institutionId, t.code), foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_terms_institution_tenant_fk" }).onDelete("restrict"), index("education_terms_tenant_institution_dates_idx").on(t.tenantId, t.institutionId, t.startDate, t.endDate)]);

export const educationStudents = pgTable("education_students", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }), institutionId: uuid("institution_id").notNull(), programId: uuid("program_id"),
  registrationNumber: varchar("registration_number", { length: 80 }).notNull(), firstName: varchar("first_name", { length: 100 }).notNull(), lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(), phone: varchar("phone", { length: 40 }).notNull().default(""), gender: varchar("gender", { length: 32 }),
  dateOfBirth: date("date_of_birth"), nationality: varchar("nationality", { length: 100 }), status: varchar("status", { length: 32 }).notNull().default("active"),
  enrollmentStatus: varchar("enrollment_status", { length: 32 }).notNull().default("ENROLLED"), gpa: numeric("gpa", { precision: 5, scale: 2 }), creditsEarned: integer("credits_earned").notNull().default(0),
  academicYear: varchar("academic_year", { length: 40 }).notNull().default(""), admissionDate: date("admission_date"), faculty: varchar("faculty", { length: 180 }).notNull().default(""),
  department: varchar("department", { length: 180 }).notNull().default(""), campusName: varchar("campus_name", { length: 180 }).notNull().default(""), studyCenterId: varchar("study_center_id", { length: 80 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("education_students_tenant_institution_reg_uq").on(t.tenantId, t.institutionId, t.registrationNumber), uniqueIndex("education_students_id_tenant_institution_uq").on(t.id, t.tenantId, t.institutionId), foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_students_institution_tenant_fk" }).onDelete("restrict"), foreignKey({ columns: [t.programId, t.tenantId, t.institutionId], foreignColumns: [educationPrograms.id, educationPrograms.tenantId, educationPrograms.institutionId], name: "education_students_program_scope_fk" }).onDelete("restrict"), index("education_students_tenant_institution_status_idx").on(t.tenantId, t.institutionId, t.status), index("education_students_tenant_institution_name_idx").on(t.tenantId, t.institutionId, t.lastName, t.firstName)]);

export const educationRegulatoryEvidence = pgTable("education_regulatory_evidence", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }), institutionId: uuid("institution_id").notNull(),
  title: varchar("title", { length: 240 }).notNull(), evidenceType: varchar("evidence_type", { length: 80 }).notNull(), authority: varchar("authority", { length: 240 }).notNull(),
  referenceNumber: varchar("reference_number", { length: 120 }), status: varchar("status", { length: 24 }).notNull().default("received"),
  issuedOn: date("issued_on"), expiresOn: date("expires_on"), evidenceUrl: varchar("evidence_url", { length: 2048 }), notes: text("notes").notNull().default(""),
  recordedBy: varchar("recorded_by", { length: 128 }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_evidence_institution_tenant_fk" }).onDelete("restrict"),
  uniqueIndex("education_regulatory_evidence_id_scope_uq").on(t.id, t.tenantId, t.institutionId),
  index("education_regulatory_evidence_tenant_institution_status_idx").on(t.tenantId, t.institutionId, t.status),
]);

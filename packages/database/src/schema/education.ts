import { bigint, boolean, date, foreignKey, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const educationInstitutions = pgTable("education_institutions", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
  institutionKey: varchar("institution_key", { length: 48 }).notNull(), name: varchar("name", { length: 180 }).notNull(), legalName: varchar("legal_name", { length: 240 }),
  admissionsEmail: varchar("admissions_email", { length: 254 }), registrarEmail: varchar("registrar_email", { length: 254 }),
  financeEmail: varchar("finance_email", { length: 254 }), adminEmail: varchar("admin_email", { length: 254 }),
  phones: jsonb("phones").$type<string[]>().notNull().default([]), address: text("address"), websiteUrl: varchar("website_url", { length: 2048 }),
  websiteTemplateId: varchar("website_template_id", { length: 120 }).notNull().default("school-portal"),
  websiteTemplateVersion: varchar("website_template_version", { length: 64 }).notNull().default("1.0.0"),
  websiteConfigurationSchemaVersion: varchar("website_configuration_schema_version", { length: 64 }).notNull().default("1.0.0"),
  websiteOverrides: jsonb("website_overrides").$type<Record<string, unknown>>().notNull().default({}),
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

export const educationStudyCenters = pgTable("education_study_centers", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  code: varchar("code", { length: 48 }).notNull(), name: varchar("name", { length: 180 }).notNull(), city: varchar("city", { length: 120 }).notNull().default(""),
  country: varchar("country", { length: 120 }).notNull().default(""), address: text("address").notNull().default(""), phone: varchar("phone", { length: 40 }).notNull().default(""),
  email: varchar("email", { length: 254 }).notNull().default(""), directorName: varchar("director_name", { length: 160 }).notNull().default(""),
  capacity: integer("capacity").notNull().default(100), status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_study_centers_institution_tenant_fk" }).onDelete("cascade"),
  uniqueIndex("education_study_centers_tenant_inst_code_uq").on(t.tenantId, t.institutionId, t.code),
]);

export const educationStaff = pgTable("education_staff", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  staffNumber: varchar("staff_number", { length: 48 }).notNull(), firstName: varchar("first_name", { length: 100 }).notNull(), lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(), phone: varchar("phone", { length: 40 }).notNull().default(""), department: varchar("department", { length: 160 }).notNull().default(""),
  role: varchar("role", { length: 80 }).notNull().default("Lecturer"), employmentType: varchar("employment_type", { length: 40 }).notNull().default("full_time"),
  status: varchar("status", { length: 24 }).notNull().default("active"), hireDate: date("hire_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_staff_institution_tenant_fk" }).onDelete("cascade"),
  uniqueIndex("education_staff_tenant_inst_num_uq").on(t.tenantId, t.institutionId, t.staffNumber),
]);

export const educationCourses = pgTable("education_courses", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  programId: uuid("program_id"), code: varchar("code", { length: 48 }).notNull(), title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull().default(""), credits: integer("credits").notNull().default(3), level: varchar("level", { length: 40 }).notNull().default("100"),
  department: varchar("department", { length: 160 }).notNull().default(""), faculty: varchar("faculty", { length: 160 }).notNull().default(""),
  instructorName: varchar("instructor_name", { length: 160 }).notNull().default(""), capacity: integer("capacity").notNull().default(60),
  isMandatory: boolean("is_mandatory").notNull().default(false), syllabusJson: jsonb("syllabus_json").$type<unknown[]>().notNull().default([]),
  status: varchar("status", { length: 24 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_courses_institution_tenant_fk" }).onDelete("cascade"),
  uniqueIndex("education_courses_tenant_inst_code_uq").on(t.tenantId, t.institutionId, t.code),
]);

export const educationCourseSections = pgTable("education_course_sections", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  courseId: uuid("course_id").notNull().references(() => educationCourses.id, { onDelete: "cascade" }), termId: uuid("term_id"),
  sectionCode: varchar("section_code", { length: 40 }).notNull(), instructor: varchar("instructor", { length: 160 }).notNull().default(""),
  schedule: varchar("schedule", { length: 160 }).notNull().default(""), room: varchar("room", { length: 80 }).notNull().default(""),
  capacity: integer("capacity").notNull().default(40), enrolledCount: integer("enrolled_count").notNull().default(0), status: varchar("status", { length: 24 }).notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_course_sections_institution_tenant_fk" }).onDelete("cascade"),
]);

export const educationApplications = pgTable("education_applications", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  applicationNumber: varchar("application_number", { length: 64 }).notNull(), firstName: varchar("first_name", { length: 100 }).notNull(), lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(), phone: varchar("phone", { length: 40 }).notNull().default(""),
  programId: uuid("program_id"), programName: varchar("program_name", { length: 200 }).notNull().default(""), intakeTerm: varchar("intake_term", { length: 80 }).notNull().default(""),
  status: varchar("status", { length: 32 }).notNull().default("submitted"), reviewerNotes: text("reviewer_notes").notNull().default(""),
  decisionConditions: text("decision_conditions").notNull().default(""), depositRequiredMinor: bigint("deposit_required_minor", { mode: "number" }).notNull().default(0),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(), decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_applications_institution_tenant_fk" }).onDelete("cascade"),
  uniqueIndex("education_applications_tenant_inst_num_uq").on(t.tenantId, t.institutionId, t.applicationNumber),
]);

export const educationApplicationLogs = pgTable("education_application_logs", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  applicationId: uuid("application_id").notNull().references(() => educationApplications.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 80 }).notNull(), actor: varchar("actor", { length: 160 }).notNull().default("system"),
  note: text("note").notNull().default(""), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_application_logs_institution_tenant_fk" }).onDelete("cascade"),
]);

export const educationEnrollments = pgTable("education_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  studentId: uuid("student_id").notNull(), courseId: uuid("course_id").notNull().references(() => educationCourses.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id"), programId: uuid("program_id"), termId: uuid("term_id"),
  status: varchar("status", { length: 24 }).notNull().default("enrolled"), agreementSigned: boolean("agreement_signed").notNull().default(false),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_enrollments_institution_tenant_fk" }).onDelete("cascade"),
]);

export const educationGrades = pgTable("education_grades", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  studentId: uuid("student_id").notNull(), courseId: uuid("course_id").notNull().references(() => educationCourses.id, { onDelete: "cascade" }),
  termId: uuid("term_id"), academicYear: varchar("academic_year", { length: 40 }).notNull().default(""), semester: varchar("semester", { length: 40 }).notNull().default(""),
  numericGrade: numeric("numeric_grade", { precision: 5, scale: 2 }).notNull().default("0"), letterGrade: varchar("letter_grade", { length: 8 }).notNull().default("N/A"),
  gpaPoints: numeric("gpa_points", { precision: 4, scale: 2 }).notNull().default("0"), credits: integer("credits").notNull().default(3),
  componentsJson: jsonb("components_json").$type<Record<string, unknown>>().notNull().default({}),
  status: varchar("status", { length: 24 }).notNull().default("Provisional"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_grades_institution_tenant_fk" }).onDelete("cascade"),
]);

export const educationGradeAppeals = pgTable("education_grade_appeals", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  gradeId: uuid("grade_id").notNull().references(() => educationGrades.id, { onDelete: "cascade" }), studentId: uuid("student_id").notNull(),
  reason: varchar("reason", { length: 200 }).notNull(), explanation: text("explanation").notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("pending"), revisedGrade: numeric("revised_grade", { precision: 5, scale: 2 }),
  reviewerNotes: text("reviewer_notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_grade_appeals_institution_tenant_fk" }).onDelete("cascade"),
]);

export const educationFinanceTransactions = pgTable("education_finance_transactions", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  studentId: uuid("student_id"), termId: uuid("term_id"), reference: varchar("reference", { length: 80 }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull().default(0), currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  transactionType: varchar("transaction_type", { length: 40 }).notNull().default("tuition_payment"), description: text("description").notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("Pending"), dueDate: date("due_date"), paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_finance_transactions_institution_tenant_fk" }).onDelete("cascade"),
]);

export const educationLibraryItems = pgTable("education_library_items", {
  id: uuid("id").defaultRandom().primaryKey(), tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }), institutionId: uuid("institution_id").notNull(),
  isbn: varchar("isbn", { length: 48 }).notNull().default(""), title: varchar("title", { length: 240 }).notNull(), author: varchar("author", { length: 180 }).notNull().default(""),
  category: varchar("category", { length: 80 }).notNull().default("General"), copiesTotal: integer("copies_total").notNull().default(1),
  copiesAvailable: integer("copies_available").notNull().default(1), location: varchar("location", { length: 120 }).notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("available"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.institutionId, t.tenantId], foreignColumns: [educationInstitutions.id, educationInstitutions.tenantId], name: "education_library_items_institution_tenant_fk" }).onDelete("cascade"),
]);


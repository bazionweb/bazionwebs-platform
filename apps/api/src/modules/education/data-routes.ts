import { fromNodeHeaders } from "better-auth/node";
import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  BMI_UNIVERSITY_TENANT_ID,
  EDUCATION_CONFIGURATION_VERSION,
  SCHOOL_PORTAL_TEMPLATE_VERSION,
  createEducationInstitutionWebsiteOverlay,
  educationInstitutionWebsiteOverridesSchema,
  isBemiHost,
  isBmiHost,
  resolveEducationInstitutionWebsiteConfig,
} from "@bazion/education-contracts";
import { deepMergeCascade, isTenantTemplateOverlay } from "@bazion/website-contracts";
import { auth, isVerifiedTenantHost } from "@bazion/auth/server";
import {
  educationInstitutions,
  educationPrograms,
  educationRegulatoryEvidence,
  educationStudents,
  educationTerms,
} from "@bazion/database";
import {
  getCurrentIdentity,
  requireActiveTenantPermission,
} from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { pool, withTenantTransaction, type TenantTransaction } from "../../lib/database.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { assertTenantNotInMaintenance } from "../../lib/tenant-maintenance.js";
import { randomUUID } from "node:crypto";

interface RouteOptions { config: AppConfig }
type InstitutionKey = "bmi" | "bemi";

const studentInput = z.object({
  reg_no: z.string().trim().max(80).optional(),
  registrationNumber: z.string().trim().max(80).optional(),
  first_name: z.string().trim().min(1).max(100).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  full_name: z.string().trim().max(201).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().max(40).optional(),
  program_id: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  program_code: z.string().trim().max(48).optional(),
  program: z.string().trim().max(180).optional(),
  status: z.string().trim().max(32).optional(),
  enrollment_status: z.string().trim().max(32).optional(),
  gpa: z.coerce.number().min(0).max(100).nullable().optional(),
  credits_earned: z.coerce.number().int().min(0).optional(),
  academic_year: z.string().trim().max(40).optional(),
  admission_date: z.string().date().nullable().optional(),
  gender: z.string().trim().max(32).nullable().optional(),
  date_of_birth: z.string().date().nullable().optional(),
  nationality: z.string().trim().max(100).nullable().optional(),
  faculty: z.string().trim().max(180).optional(),
  department: z.string().trim().max(180).optional(),
  campus_name: z.string().trim().max(180).optional(),
  study_center_id: z.string().trim().max(80).optional(),
}).passthrough();

const programInput = z.object({
  code: z.string().trim().min(2).max(48).optional(),
  name: z.string().trim().min(2).max(180).optional(),
  abbreviation: z.string().trim().max(48).optional(),
  level: z.string().trim().max(32).optional(),
  degree_type: z.string().trim().max(64).optional(),
  description: z.string().max(8000).optional(),
  faculty: z.string().trim().max(180).nullable().optional(),
  department: z.string().trim().max(180).nullable().optional(),
  faculty_id: z.string().trim().max(80).optional(),
  department_id: z.string().trim().max(80).optional(),
  duration_years: z.coerce.number().int().min(0).max(20).optional(),
  total_credit_hours: z.coerce.number().int().min(0).max(1000).optional(),
  credits_required: z.coerce.number().int().min(0).max(1000).optional(),
  total_semesters: z.coerce.number().int().min(0).max(40).optional(),
  mode_of_study: z.string().trim().max(32).optional(),
  accreditation_body: z.string().trim().max(240).optional(),
  entry_requirements: z.string().max(8000).optional(),
  is_active: z.coerce.boolean().optional(),
  active: z.coerce.boolean().optional(),
  public_visible: z.coerce.boolean().optional(),
}).passthrough();

const termInput = z.object({
  code: z.string().trim().min(1).max(48).optional(), name: z.string().trim().min(1).max(180).optional(),
  academic_year: z.string().trim().min(1).max(40).optional(), semester_number: z.coerce.number().int().positive().max(20).optional(),
  start_date: z.string().date().optional(), end_date: z.string().date().optional(),
  status: z.enum(["upcoming", "registration", "active", "exam", "grading", "closed"]).optional(),
  registration_opens_at: z.coerce.date().nullable().optional(), registration_closes_at: z.coerce.date().nullable().optional(),
  census_date: z.string().date().nullable().optional(),
}).passthrough();

const institutionProfileInput = z.object({
  name: z.string().trim().min(2).max(180).optional(),
  legal_name: z.string().trim().max(240).nullable().optional(),
  admissions_email: z.string().trim().email().max(254).nullable().optional(),
  registrar_email: z.string().trim().email().max(254).nullable().optional(),
  finance_email: z.string().trim().email().max(254).nullable().optional(),
  admin_email: z.string().trim().email().max(254).nullable().optional(),
  phones: z.array(z.string().trim().min(3).max(40)).max(12).optional(),
  address: z.string().trim().max(1000).nullable().optional(),
  website_url: z.string().trim().url().max(2048).nullable().optional(),
  website_overrides: educationInstitutionWebsiteOverridesSchema.optional(),
}).strict();

const regulatoryEvidenceInput = z.object({
  title: z.string().trim().min(2).max(240),
  evidence_type: z.string().trim().min(2).max(80),
  authority: z.string().trim().min(2).max(240),
  reference_number: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["received", "pending_review", "verified", "expired", "superseded", "withdrawn", "rejected"]).optional(),
  issued_on: z.string().date().nullable().optional(),
  expires_on: z.string().date().nullable().optional(),
  evidence_url: z.string().trim().url().max(2048).nullable().optional(),
  notes: z.string().max(8000).optional(),
}).strict();

function routeError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

function institutionKeyForHost(hostname: string): InstitutionKey | null {
  if (isBemiHost(hostname)) return "bemi";
  if (isBmiHost(hostname)) return "bmi";
  return null;
}

async function resolveEducationContext(request: FastifyRequest, config: AppConfig, requireUms = true) {
  const tenantId = await resolveRequestTenantId(request, config);
  if (tenantId !== BMI_UNIVERSITY_TENANT_ID) {
    throw routeError("Education records are not configured for this tenant.", 404, "EDUCATION_TENANT_NOT_FOUND");
  }
  const key = institutionKeyForHost(request.hostname);
  if (!key) throw routeError("This host is not assigned to an education institution.", 404, "EDUCATION_INSTITUTION_NOT_FOUND");
  if (config.NODE_ENV === "production" && !(await isVerifiedTenantHost(request.hostname))) {
    throw routeError("A verified institution domain is required.", 404, "EDUCATION_HOST_NOT_VERIFIED");
  }
  if (requireUms && !(await isTenantModuleEnabled(tenantId, "education-ums"))) {
    throw routeError("The education management module is disabled for this tenant.", 404, "TENANT_MODULE_DISABLED");
  }
  await assertTenantNotInMaintenance(tenantId);
  return { tenantId, key };
}

async function withInstitution<T>(
  tenantId: string,
  key: InstitutionKey,
  callback: (tx: TenantTransaction, institutionId: string) => Promise<T>,
): Promise<T> {
  return withTenantTransaction(tenantId, async (tx) => {
    await tx.execute(sql`select set_config('app.education_institution_key', ${key}, true)`);
    const [institution] = await tx.select().from(educationInstitutions)
      .where(and(eq(educationInstitutions.tenantId, tenantId), eq(educationInstitutions.institutionKey, key)))
      .limit(1);
    if (!institution || institution.status !== "active") {
      throw routeError("The education institution has not been provisioned.", 503, "EDUCATION_INSTITUTION_UNAVAILABLE");
    }
    await tx.execute(sql`select set_config('app.education_institution_id', ${institution.id}, true)`);
    return callback(tx, institution.id);
  });
}

async function requireEducationPermission(request: FastifyRequest, tenantId: string, action: "read" | "create" | "update" | "delete") {
  const context = await requireActiveTenantPermission(request.headers, { education: [action] });
  if (context.tenantId !== tenantId) {
    throw routeError("Your active organization does not match this institution.", 403, "EDUCATION_TENANT_MISMATCH");
  }
  return context;
}

function publicProgram(row: typeof educationPrograms.$inferSelect) {
  const created = row.createdAt.toISOString();
  const updated = row.updatedAt.toISOString();
  return {
    id: row.id, code: row.code, name: row.name, abbreviation: row.abbreviation,
    degree_type: row.degreeType || row.level, level: row.level,
    faculty: row.faculty ?? "", faculty_id: row.facultyId ?? "", department: row.department ?? "", department_id: row.departmentId ?? "",
    duration_years: row.durationYears, total_credit_hours: row.creditsRequired,
    total_semesters: row.totalSemesters, mode_of_study: row.modeOfStudy,
    accreditation_body: row.accreditationBody, entry_requirements: row.entryRequirements,
    description: row.description, is_active: row.active, created, updated,
  };
}

function publicStudent(row: typeof educationStudents.$inferSelect, program?: typeof educationPrograms.$inferSelect) {
  const status = row.status.toLowerCase();
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const created = row.createdAt.toISOString();
  const updated = row.updatedAt.toISOString();
  return {
    id: row.id, student_id: row.id, reg_no: row.registrationNumber,
    first_name: row.firstName, last_name: row.lastName, full_name: `${row.firstName} ${row.lastName}`.trim(),
    gender: row.gender ?? "", date_of_birth: row.dateOfBirth ?? "", nationality: row.nationality ?? "",
    email: row.email, phone: row.phone, program_id: row.programId ?? "", program_code: program?.code ?? "",
    program_name: program?.name ?? "", program: program?.name ?? "", faculty: row.faculty || program?.faculty || "",
    department: row.department || program?.department || "", status: statusLabel,
    enrollment_status: row.enrollmentStatus, gpa: row.gpa === null ? 0 : Number(row.gpa),
    credits_earned: row.creditsEarned, academic_year: row.academicYear,
    admission_date: row.admissionDate ?? "", campus: row.campusName, campus_name: row.campusName,
    study_center_id: row.studyCenterId, avatar_color: "bg-purple-600", photo_zoom: 1,
    created, updated,
  };
}

function publicTerm(row: typeof educationTerms.$inferSelect) {
  return {
    id: row.id, code: row.code, name: row.name, academic_year: row.academicYear,
    semester_number: row.semesterNumber, start_date: row.startDate, end_date: row.endDate,
    status: row.status, is_active: row.status === "active",
    registration_opens_at: row.registrationOpensAt?.toISOString() ?? null,
    registration_closes_at: row.registrationClosesAt?.toISOString() ?? null,
    census_date: row.censusDate,
  };
}

function publicInstitution(row: typeof educationInstitutions.$inferSelect) {
  return {
    id: row.id, key: row.institutionKey, name: row.name, legal_name: row.legalName ?? "",
    admissions_email: row.admissionsEmail ?? "", registrar_email: row.registrarEmail ?? "",
    finance_email: row.financeEmail ?? "", admin_email: row.adminEmail ?? "", phones: row.phones,
    address: row.address ?? "", website_url: row.websiteUrl ?? "", status: row.status,
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
  };
}

function publicEducationWebsiteConfig(row: typeof educationInstitutions.$inferSelect) {
  if (row.websiteTemplateId !== "school-portal"
    || row.websiteConfigurationSchemaVersion !== EDUCATION_CONFIGURATION_VERSION) {
    throw routeError("The institution website configuration needs a schema migration before it can be published.", 503, "EDUCATION_WEBSITE_SCHEMA_UNSUPPORTED");
  }
  if (isTenantTemplateOverlay(row.websiteOverrides)
    && (row.websiteOverrides.packageId !== "school-education"
      || row.websiteOverrides.templateId !== row.websiteTemplateId
      || row.websiteOverrides.configurationSchemaVersion !== row.websiteConfigurationSchemaVersion
      || row.websiteOverrides.updateMode !== "automatic")) {
    throw routeError("The institution website overlay is incompatible with its template.", 503, "EDUCATION_WEBSITE_OVERLAY_INVALID");
  }
  return resolveEducationInstitutionWebsiteConfig(row.institutionKey as InstitutionKey, row.websiteOverrides, {
    name: row.name,
    legalName: row.legalName,
    admissionsEmail: row.admissionsEmail,
    registrarEmail: row.registrarEmail,
    financeEmail: row.financeEmail,
    adminEmail: row.adminEmail,
    phones: row.phones,
    address: row.address,
  }, { tenantId: row.tenantId });
}

function publicEducationTemplateStatus(row: typeof educationInstitutions.$inferSelect) {
  return {
    id: row.websiteTemplateId,
    configuredVersion: row.websiteTemplateVersion,
    currentVersion: SCHOOL_PORTAL_TEMPLATE_VERSION,
    updateMode: "automatic" as const,
  };
}

function publicRegulatoryEvidence(row: typeof educationRegulatoryEvidence.$inferSelect) {
  return {
    id: row.id, title: row.title, evidence_type: row.evidenceType, authority: row.authority,
    reference_number: row.referenceNumber, status: row.status, issued_on: row.issuedOn,
    expires_on: row.expiresOn, evidence_url: row.evidenceUrl, notes: row.notes,
    created_at: row.createdAt.toISOString(), updated_at: row.updatedAt.toISOString(),
  };
}

async function findProgram(tx: TenantTransaction, tenantId: string, institutionId: string, input: z.infer<typeof studentInput>) {
  const id = input.program_id ?? input.programId;
  if (id) {
    const [row] = await tx.select().from(educationPrograms).where(and(
      eq(educationPrograms.id, id), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
    )).limit(1);
    if (!row) throw routeError("The selected program was not found for this institution.", 400, "EDUCATION_PROGRAM_NOT_FOUND");
    return row;
  }
  const codeOrName = input.program_code ?? input.program;
  if (!codeOrName) return null;
  const [row] = await tx.select().from(educationPrograms).where(and(
    eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
    or(eq(educationPrograms.code, codeOrName), eq(educationPrograms.name, codeOrName)),
  )).limit(1);
  if (!row) throw routeError("The selected program was not found for this institution.", 400, "EDUCATION_PROGRAM_NOT_FOUND");
  return row;
}

async function getStudent(tx: TenantTransaction, tenantId: string, institutionId: string, id: string) {
  const [row] = await tx.select().from(educationStudents).where(and(
    eq(educationStudents.id, id), eq(educationStudents.tenantId, tenantId), eq(educationStudents.institutionId, institutionId),
  )).limit(1);
  if (!row) return null;
  let program: typeof educationPrograms.$inferSelect | undefined;
  if (row.programId) {
    [program] = await tx.select().from(educationPrograms).where(and(
      eq(educationPrograms.id, row.programId), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
    )).limit(1);
  }
  return publicStudent(row, program);
}

export async function educationDataRoutes(app: FastifyInstance, options: RouteOptions): Promise<void> {
  app.get("/v1/public/education/institution", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config, false);
    const result = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.select().from(educationInstitutions).where(and(
        eq(educationInstitutions.id, institutionId), eq(educationInstitutions.tenantId, tenantId),
      )).limit(1);
      if (!row) return null;
      return {
        institution: publicInstitution(row),
        websiteConfig: publicEducationWebsiteConfig(row),
        template: {
          id: row.websiteTemplateId,
          configuredVersion: row.websiteTemplateVersion,
          currentVersion: SCHOOL_PORTAL_TEMPLATE_VERSION,
          configurationSchemaVersion: row.websiteConfigurationSchemaVersion,
          currentConfigurationSchemaVersion: EDUCATION_CONFIGURATION_VERSION,
          updateMode: "automatic" as const,
        },
      };
    });
    reply.header("cache-control", "no-store");
    reply.header("vary", "host");
    return result ? reply.send({ success: true, data: result }) : reply.code(404).send({ success: false, error: "EDUCATION_INSTITUTION_NOT_FOUND" });
  });

  app.post("/api/v1/education/session/activate", async (request, reply) => {
    const { tenantId } = await resolveEducationContext(request, options.config);
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) return reply.code(401).send({ success: false, error: "UNAUTHENTICATED" });
    const tenantResult = await pool.query<{ auth_organization_id: string | null }>(
      "SELECT auth_organization_id FROM public.tenants WHERE id = $1 AND status = 'active' LIMIT 1", [tenantId],
    );
    const organizationId = tenantResult.rows[0]?.auth_organization_id;
    if (!organizationId) throw routeError("The institution workspace is not linked to an organization.", 503, "EDUCATION_WORKSPACE_UNAVAILABLE");
    await auth.api.setActiveOrganization({
      headers: fromNodeHeaders(request.headers),
      body: { organizationId },
    });
    const context = await requireEducationPermission(request, tenantId, "read");
    if (!context.roles.some((role) => role === "owner" || role === "admin")) {
      throw routeError("The education management system is restricted to institution administrators.", 403, "EDUCATION_ADMIN_REQUIRED");
    }
    const activeIdentity = await getCurrentIdentity(request.headers);
    return reply.send({ success: true, data: activeIdentity });
  });

  app.get("/api/v1/education/institution", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const profile = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.select().from(educationInstitutions).where(and(
        eq(educationInstitutions.id, institutionId), eq(educationInstitutions.tenantId, tenantId),
      )).limit(1);
      return row ? {
        ...publicInstitution(row),
        website_config: publicEducationWebsiteConfig(row),
        website_template: publicEducationTemplateStatus(row),
      } : null;
    });
    return profile ? reply.send({ success: true, data: profile }) : reply.code(404).send({ success: false, error: "EDUCATION_INSTITUTION_NOT_FOUND" });
  });

  app.patch("/api/v1/education/institution", async (request, reply) => {
    const parsed = institutionProfileInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const profile = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const input = parsed.data;
      const [existing] = await tx.select().from(educationInstitutions).where(and(
        eq(educationInstitutions.id, institutionId), eq(educationInstitutions.tenantId, tenantId),
      )).limit(1).for("update");
      if (!existing) return null;
      const existingWebsiteConfig = resolveEducationInstitutionWebsiteConfig(key, existing.websiteOverrides, undefined, { tenantId });
      const nextWebsiteConfig = input.website_overrides === undefined
        ? undefined
        : deepMergeCascade(existingWebsiteConfig, input.website_overrides);
      const [row] = await tx.update(educationInstitutions).set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.legal_name !== undefined ? { legalName: input.legal_name } : {}),
        ...(input.admissions_email !== undefined ? { admissionsEmail: input.admissions_email } : {}),
        ...(input.registrar_email !== undefined ? { registrarEmail: input.registrar_email } : {}),
        ...(input.finance_email !== undefined ? { financeEmail: input.finance_email } : {}),
        ...(input.admin_email !== undefined ? { adminEmail: input.admin_email } : {}),
        ...(input.phones !== undefined ? { phones: input.phones } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.website_url !== undefined ? { websiteUrl: input.website_url } : {}),
        ...(nextWebsiteConfig ? {
          websiteOverrides: createEducationInstitutionWebsiteOverlay(key, nextWebsiteConfig, { tenantId }) as unknown as Record<string, unknown>,
          websiteTemplateId: "school-portal",
          websiteTemplateVersion: SCHOOL_PORTAL_TEMPLATE_VERSION,
          websiteConfigurationSchemaVersion: EDUCATION_CONFIGURATION_VERSION,
        } : {}),
        updatedAt: new Date(),
      }).where(and(eq(educationInstitutions.id, institutionId), eq(educationInstitutions.tenantId, tenantId))).returning();
      return row ? {
        ...publicInstitution(row),
        website_config: publicEducationWebsiteConfig(row),
        website_template: publicEducationTemplateStatus(row),
      } : null;
    });
    return profile ? reply.send({ success: true, data: profile }) : reply.code(404).send({ success: false, error: "EDUCATION_INSTITUTION_NOT_FOUND" });
  });

  app.get("/api/v1/education/regulatory-evidence", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const records = await withInstitution(tenantId, key, (tx, institutionId) => tx.select().from(educationRegulatoryEvidence).where(and(
      eq(educationRegulatoryEvidence.tenantId, tenantId), eq(educationRegulatoryEvidence.institutionId, institutionId),
    )).orderBy(asc(educationRegulatoryEvidence.createdAt)));
    reply.header("cache-control", "no-store");
    return reply.send({ success: true, data: records.map(publicRegulatoryEvidence) });
  });

  app.post("/api/v1/education/regulatory-evidence", async (request, reply) => {
    const parsed = regulatoryEvidenceInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const context = await requireEducationPermission(request, tenantId, "create");
    const input = parsed.data;
    if (input.issued_on && input.expires_on && input.expires_on < input.issued_on) {
      return reply.code(400).send({ success: false, error: "EVIDENCE_DATE_RANGE_INVALID" });
    }
    const record = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.insert(educationRegulatoryEvidence).values({
        tenantId, institutionId, title: input.title, evidenceType: input.evidence_type, authority: input.authority,
        referenceNumber: input.reference_number ?? null, status: input.status ?? "received", issuedOn: input.issued_on ?? null,
        expiresOn: input.expires_on ?? null, evidenceUrl: input.evidence_url ?? null, notes: input.notes ?? "", recordedBy: context.userId,
      }).returning();
      return row ? publicRegulatoryEvidence(row) : null;
    });
    return record ? reply.code(201).send({ success: true, data: record }) : reply.code(500).send({ success: false, error: "EVIDENCE_RECORD_FAILED" });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/regulatory-evidence/:id", async (request, reply) => {
    const parsed = regulatoryEvidenceInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const input = parsed.data;
    const record = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [existing] = await tx.select().from(educationRegulatoryEvidence).where(and(
        eq(educationRegulatoryEvidence.id, request.params.id), eq(educationRegulatoryEvidence.tenantId, tenantId),
        eq(educationRegulatoryEvidence.institutionId, institutionId),
      )).limit(1);
      if (!existing) return null;
      const issuedOn = input.issued_on !== undefined ? input.issued_on : existing.issuedOn;
      const expiresOn = input.expires_on !== undefined ? input.expires_on : existing.expiresOn;
      if (issuedOn && expiresOn && expiresOn < issuedOn) return "invalid-date-range" as const;
      const [row] = await tx.update(educationRegulatoryEvidence).set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.evidence_type !== undefined ? { evidenceType: input.evidence_type } : {}),
        ...(input.authority !== undefined ? { authority: input.authority } : {}),
        ...(input.reference_number !== undefined ? { referenceNumber: input.reference_number } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.issued_on !== undefined ? { issuedOn: input.issued_on } : {}),
        ...(input.expires_on !== undefined ? { expiresOn: input.expires_on } : {}),
        ...(input.evidence_url !== undefined ? { evidenceUrl: input.evidence_url } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}), updatedAt: new Date(),
      }).where(and(eq(educationRegulatoryEvidence.id, request.params.id), eq(educationRegulatoryEvidence.tenantId, tenantId),
        eq(educationRegulatoryEvidence.institutionId, institutionId))).returning();
      return row ? publicRegulatoryEvidence(row) : null;
    });
    if (record === "invalid-date-range") return reply.code(400).send({ success: false, error: "EVIDENCE_DATE_RANGE_INVALID" });
    return record ? reply.send({ success: true, data: record }) : reply.code(404).send({ success: false, error: "EVIDENCE_RECORD_NOT_FOUND" });
  });

  app.get("/api/v1/education/students", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { page?: string; perPage?: string; status?: string; faculty?: string; search?: string; program?: string; study_center_id?: string };
    const page = Math.max(1, Math.min(10000, Number.parseInt(query.page ?? "1", 10) || 1));
    const perPage = Math.max(1, Math.min(100, Number.parseInt(query.perPage ?? "25", 10) || 25));
    const offset = (page - 1) * perPage;
    return withInstitution(tenantId, key, async (tx, institutionId) => {
      const filters: SQL[] = [eq(educationStudents.tenantId, tenantId), eq(educationStudents.institutionId, institutionId)];
      if (query.status) filters.push(eq(educationStudents.status, query.status.toLowerCase()));
      if (query.faculty) filters.push(ilike(educationStudents.faculty, query.faculty));
      if (query.study_center_id) filters.push(eq(educationStudents.studyCenterId, query.study_center_id));
      if (query.program) filters.push(or(eq(educationPrograms.code, query.program), ilike(educationPrograms.name, `%${query.program}%`))!);
      if (query.search?.trim()) {
        const search = `%${query.search.trim().slice(0, 120)}%`;
        filters.push(or(
          ilike(educationStudents.firstName, search), ilike(educationStudents.lastName, search),
          ilike(educationStudents.email, search), ilike(educationStudents.registrationNumber, search),
        )!);
      }
      const rows = await tx.select({ student: educationStudents, program: educationPrograms })
        .from(educationStudents)
        .leftJoin(educationPrograms, and(eq(educationPrograms.id, educationStudents.programId), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId)))
        .where(and(...filters)).orderBy(asc(educationStudents.lastName), asc(educationStudents.firstName)).limit(perPage).offset(offset);
      const [totalRow] = await tx.select({ total: count() }).from(educationStudents)
        .leftJoin(educationPrograms, and(eq(educationPrograms.id, educationStudents.programId), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId)))
        .where(and(...filters));
      const totalItems = totalRow?.total ?? 0;
      return reply.send({ success: true, data: { items: rows.map(({ student, program }) => publicStudent(student, program ?? undefined)), totalItems, page, perPage, totalPages: Math.ceil(totalItems / perPage) } });
    });
  });

  app.get<{ Params: { id: string } }>("/api/v1/education/students/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const student = await withInstitution(tenantId, key, (tx, institutionId) => getStudent(tx, tenantId, institutionId, request.params.id));
    return student ? reply.send({ success: true, data: student }) : reply.code(404).send({ success: false, error: "STUDENT_NOT_FOUND" });
  });

  app.post("/api/v1/education/students", async (request, reply) => {
    const parsed = studentInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const input = parsed.data;
    const names = input.full_name?.trim().split(/\s+/) ?? [];
    const firstName = input.first_name ?? input.firstName ?? names.shift();
    const lastName = input.last_name ?? input.lastName ?? names.join(" ");
    if (!firstName || !lastName || !input.email) return reply.code(400).send({ success: false, error: "FIRST_NAME_LAST_NAME_AND_EMAIL_REQUIRED" });
    try {
      const student = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const program = await findProgram(tx, tenantId, institutionId, input);
        const registrationNumber = input.reg_no ?? input.registrationNumber ?? `EDU-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const [row] = await tx.insert(educationStudents).values({
          tenantId, institutionId, programId: program?.id ?? null, registrationNumber,
          firstName, lastName, email: input.email!.toLowerCase(), phone: input.phone ?? "",
          status: (input.status ?? "active").toLowerCase(), enrollmentStatus: input.enrollment_status ?? "ENROLLED",
          gpa: input.gpa === undefined || input.gpa === null ? null : String(input.gpa), creditsEarned: input.credits_earned ?? 0,
          academicYear: input.academic_year ?? "", admissionDate: input.admission_date ?? null,
          gender: input.gender ?? null, dateOfBirth: input.date_of_birth ?? null, nationality: input.nationality ?? null,
          faculty: input.faculty ?? program?.faculty ?? "", department: input.department ?? program?.department ?? "",
          campusName: input.campus_name ?? "", studyCenterId: input.study_center_id ?? "",
        }).returning();
        if (!row) throw new Error("EDUCATION_STUDENT_INSERT_FAILED");
        return publicStudent(row, program ?? undefined);
      });
      return reply.code(201).send({ success: true, data: student });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "REGISTRATION_NUMBER_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.post("/api/v1/education/students/batch", async (request, reply) => {
    const parsed = z.object({ items: z.array(studentInput).min(1).max(250) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_BATCH", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    try {
      const created = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const values = [];
        for (const input of parsed.data.items) {
          const names = input.full_name?.trim().split(/\s+/) ?? [];
          const firstName = input.first_name ?? input.firstName ?? names.shift();
          const lastName = input.last_name ?? input.lastName ?? names.join(" ");
          if (!firstName || !lastName || !input.email) throw routeError("Each student needs a first name, last name and valid email.", 400, "INVALID_STUDENT_ROW");
          const program = await findProgram(tx, tenantId, institutionId, input);
          values.push({
            tenantId, institutionId, programId: program?.id ?? null,
            registrationNumber: input.reg_no ?? input.registrationNumber ?? `EDU-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            firstName, lastName, email: input.email.toLowerCase(), phone: input.phone ?? "",
            status: (input.status ?? "active").toLowerCase(), enrollmentStatus: input.enrollment_status ?? "ENROLLED",
            gpa: input.gpa === undefined || input.gpa === null ? null : String(input.gpa), creditsEarned: input.credits_earned ?? 0,
            academicYear: input.academic_year ?? "", admissionDate: input.admission_date ?? null,
            gender: input.gender ?? null, dateOfBirth: input.date_of_birth ?? null, nationality: input.nationality ?? null,
            faculty: input.faculty ?? program?.faculty ?? "", department: input.department ?? program?.department ?? "",
            campusName: input.campus_name ?? "", studyCenterId: input.study_center_id ?? "",
          });
        }
        const registrationNumbers = values.map((row) => row.registrationNumber);
        if (new Set(registrationNumbers).size !== registrationNumbers.length) {
          throw routeError("The batch contains duplicate registration numbers.", 400, "DUPLICATE_REGISTRATION_NUMBER_IN_BATCH");
        }
        return tx.insert(educationStudents).values(values).returning({ id: educationStudents.id });
      });
      return reply.code(201).send({ success: true, data: { createdIds: created.map((row) => row.id), successCount: created.length, failureCount: 0, errors: [] } });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "REGISTRATION_NUMBER_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/students/:id", async (request, reply) => {
    const parsed = studentInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const input = parsed.data;
    try {
      const student = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const existing = await getStudent(tx, tenantId, institutionId, request.params.id);
        if (!existing) return null;
        const program = (input.program_id || input.programId || input.program_code || input.program)
          ? await findProgram(tx, tenantId, institutionId, input as z.infer<typeof studentInput>) : undefined;
        const names = input.full_name?.trim().split(/\s+/);
        const firstName = input.first_name ?? input.firstName ?? names?.shift();
        const lastName = input.last_name ?? input.lastName ?? names?.join(" ");
        await tx.update(educationStudents).set({
          ...(input.reg_no || input.registrationNumber ? { registrationNumber: input.reg_no ?? input.registrationNumber } : {}),
          ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}),
          ...(input.email ? { email: input.email.toLowerCase() } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(program !== undefined ? { programId: program?.id ?? null } : {}),
          ...(input.status ? { status: input.status.toLowerCase() } : {}), ...(input.enrollment_status ? { enrollmentStatus: input.enrollment_status } : {}),
          ...(input.gpa !== undefined ? { gpa: input.gpa === null ? null : String(input.gpa) } : {}),
          ...(input.credits_earned !== undefined ? { creditsEarned: input.credits_earned } : {}),
          ...(input.academic_year !== undefined ? { academicYear: input.academic_year } : {}),
          ...(input.admission_date !== undefined ? { admissionDate: input.admission_date } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}), ...(input.date_of_birth !== undefined ? { dateOfBirth: input.date_of_birth } : {}),
          ...(input.nationality !== undefined ? { nationality: input.nationality } : {}),
          ...(input.faculty !== undefined ? { faculty: input.faculty } : {}), ...(input.department !== undefined ? { department: input.department } : {}),
          ...(input.campus_name !== undefined ? { campusName: input.campus_name } : {}), ...(input.study_center_id !== undefined ? { studyCenterId: input.study_center_id } : {}),
          updatedAt: new Date(),
        }).where(and(eq(educationStudents.id, request.params.id), eq(educationStudents.tenantId, tenantId), eq(educationStudents.institutionId, institutionId)));
        return getStudent(tx, tenantId, institutionId, request.params.id);
      });
      return student ? reply.send({ success: true, data: student }) : reply.code(404).send({ success: false, error: "STUDENT_NOT_FOUND" });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "REGISTRATION_NUMBER_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/students/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const deleted = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const rows = await tx.delete(educationStudents).where(and(
        eq(educationStudents.id, request.params.id), eq(educationStudents.tenantId, tenantId), eq(educationStudents.institutionId, institutionId),
      )).returning({ id: educationStudents.id });
      return rows.length > 0;
    });
    return deleted ? reply.send({ success: true, data: { deleted: true } }) : reply.code(404).send({ success: false, error: "STUDENT_NOT_FOUND" });
  });

  app.get("/api/v1/education/students/stats/overview", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const stats = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const rows = await tx.select({ status: educationStudents.status, total: count() }).from(educationStudents)
        .where(and(eq(educationStudents.tenantId, tenantId), eq(educationStudents.institutionId, institutionId)))
        .groupBy(educationStudents.status);
      const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.total]));
      return { total: rows.reduce((sum, row) => sum + row.total, 0), active: byStatus.active ?? 0, byStatus };
    });
    return reply.send({ success: true, data: stats });
  });

  app.get("/api/v1/education/programs", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { level?: string; department_id?: string; is_active?: string };
    const programs = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const filters: SQL[] = [eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId)];
      if (query.level) filters.push(eq(educationPrograms.level, query.level.toLowerCase()));
      if (query.department_id) filters.push(eq(educationPrograms.departmentId, query.department_id));
      if (query.is_active !== undefined) filters.push(eq(educationPrograms.active, query.is_active === "true"));
      return tx.select().from(educationPrograms).where(and(...filters)).orderBy(asc(educationPrograms.name));
    });
    return reply.send({ success: true, data: programs.map(publicProgram) });
  });

  app.get<{ Params: { id: string } }>("/api/v1/education/programs/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const [program] = await withInstitution(tenantId, key, (tx, institutionId) => tx.select().from(educationPrograms).where(and(
      eq(educationPrograms.id, request.params.id), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
    )).limit(1));
    return program ? reply.send({ success: true, data: { ...publicProgram(program), courses: [] } }) : reply.code(404).send({ success: false, error: "PROGRAM_NOT_FOUND" });
  });

  app.post("/api/v1/education/programs", async (request, reply) => {
    const parsed = programInput.safeParse(request.body);
    if (!parsed.success || !parsed.data.code || !parsed.data.name) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.success ? undefined : parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    try {
      const program = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const input = parsed.data;
        const [row] = await tx.insert(educationPrograms).values({
          tenantId, institutionId, code: input.code!, name: input.name!, abbreviation: input.abbreviation ?? input.code!,
          level: (input.level ?? input.degree_type ?? "undergraduate").toLowerCase(), degreeType: input.degree_type ?? input.level ?? "undergraduate",
          description: input.description ?? "", faculty: input.faculty ?? null, department: input.department ?? null,
          facultyId: input.faculty_id ?? null, departmentId: input.department_id ?? null, durationYears: input.duration_years ?? 0,
          creditsRequired: input.total_credit_hours ?? input.credits_required ?? 0, totalSemesters: input.total_semesters ?? 0,
          modeOfStudy: input.mode_of_study ?? "full_time", accreditationBody: input.accreditation_body ?? "",
          entryRequirements: input.entry_requirements ?? "", active: input.is_active ?? input.active ?? true,
          publicVisible: input.public_visible ?? (input.is_active ?? input.active ?? true),
        }).returning();
        if (!row) throw new Error("EDUCATION_PROGRAM_INSERT_FAILED");
        return publicProgram(row);
      });
      return reply.code(201).send({ success: true, data: program });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "PROGRAM_CODE_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/programs/:id", async (request, reply) => {
    const parsed = programInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    try {
      const program = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const input = parsed.data;
        const [existing] = await tx.select().from(educationPrograms).where(and(
          eq(educationPrograms.id, request.params.id), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
        )).limit(1);
        if (!existing) return null;
        const [row] = await tx.update(educationPrograms).set({
          ...(input.code !== undefined ? { code: input.code } : {}), ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.abbreviation !== undefined ? { abbreviation: input.abbreviation } : {}),
          ...(input.level !== undefined ? { level: input.level.toLowerCase() } : {}), ...(input.degree_type !== undefined ? { degreeType: input.degree_type } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}), ...(input.faculty !== undefined ? { faculty: input.faculty } : {}),
          ...(input.department !== undefined ? { department: input.department } : {}), ...(input.faculty_id !== undefined ? { facultyId: input.faculty_id } : {}),
          ...(input.department_id !== undefined ? { departmentId: input.department_id } : {}), ...(input.duration_years !== undefined ? { durationYears: input.duration_years } : {}),
          ...(input.total_credit_hours !== undefined || input.credits_required !== undefined ? { creditsRequired: input.total_credit_hours ?? input.credits_required } : {}),
          ...(input.total_semesters !== undefined ? { totalSemesters: input.total_semesters } : {}), ...(input.mode_of_study !== undefined ? { modeOfStudy: input.mode_of_study } : {}),
          ...(input.accreditation_body !== undefined ? { accreditationBody: input.accreditation_body } : {}), ...(input.entry_requirements !== undefined ? { entryRequirements: input.entry_requirements } : {}),
          ...(input.is_active !== undefined || input.active !== undefined ? { active: input.is_active ?? input.active } : {}),
          ...(input.public_visible !== undefined ? { publicVisible: input.public_visible } : {}), updatedAt: new Date(),
        }).where(and(eq(educationPrograms.id, request.params.id), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId))).returning();
        return row ? publicProgram(row) : null;
      });
      return program ? reply.send({ success: true, data: program }) : reply.code(404).send({ success: false, error: "PROGRAM_NOT_FOUND" });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "PROGRAM_CODE_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/programs/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const archived = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.update(educationPrograms).set({ active: false, publicVisible: false, updatedAt: new Date() }).where(and(
        eq(educationPrograms.id, request.params.id), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
      )).returning({ id: educationPrograms.id });
      return Boolean(row);
    });
    return archived ? reply.send({ success: true, data: { deleted: true, archived: true } }) : reply.code(404).send({ success: false, error: "PROGRAM_NOT_FOUND" });
  });

  app.get("/api/v1/education/terms", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const terms = await withInstitution(tenantId, key, (tx, institutionId) => tx.select().from(educationTerms).where(and(
      eq(educationTerms.tenantId, tenantId), eq(educationTerms.institutionId, institutionId),
    )).orderBy(asc(educationTerms.startDate)));
    return reply.send({ success: true, data: terms.map(publicTerm) });
  });

  app.post("/api/v1/education/terms", async (request, reply) => {
    const parsed = termInput.safeParse(request.body);
    if (!parsed.success || !parsed.data.code || !parsed.data.name || !parsed.data.academic_year ||
        !parsed.data.semester_number || !parsed.data.start_date || !parsed.data.end_date) {
      return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.success ? undefined : parsed.error.flatten() });
    }
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    try {
      const term = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const input = parsed.data;
        const [row] = await tx.insert(educationTerms).values({
          tenantId, institutionId, code: input.code!, name: input.name!, academicYear: input.academic_year!,
          semesterNumber: input.semester_number!, startDate: input.start_date!, endDate: input.end_date!,
          status: input.status ?? "upcoming", registrationOpensAt: input.registration_opens_at ?? null,
          registrationClosesAt: input.registration_closes_at ?? null, censusDate: input.census_date ?? null,
        }).returning();
        if (!row) throw new Error("EDUCATION_TERM_INSERT_FAILED");
        return publicTerm(row);
      });
      return reply.code(201).send({ success: true, data: term });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "TERM_CODE_ALREADY_EXISTS" });
      if ((error as { code?: string }).code === "23514") return reply.code(400).send({ success: false, error: "TERM_DATES_INVALID" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/terms/:id", async (request, reply) => {
    const parsed = termInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    try {
      const term = await withInstitution(tenantId, key, async (tx, institutionId) => {
        const input = parsed.data;
        const [row] = await tx.update(educationTerms).set({
          ...(input.code !== undefined ? { code: input.code } : {}), ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.academic_year !== undefined ? { academicYear: input.academic_year } : {}),
          ...(input.semester_number !== undefined ? { semesterNumber: input.semester_number } : {}),
          ...(input.start_date !== undefined ? { startDate: input.start_date } : {}), ...(input.end_date !== undefined ? { endDate: input.end_date } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.registration_opens_at !== undefined ? { registrationOpensAt: input.registration_opens_at } : {}),
          ...(input.registration_closes_at !== undefined ? { registrationClosesAt: input.registration_closes_at } : {}),
          ...(input.census_date !== undefined ? { censusDate: input.census_date } : {}), updatedAt: new Date(),
        }).where(and(eq(educationTerms.id, request.params.id), eq(educationTerms.tenantId, tenantId), eq(educationTerms.institutionId, institutionId))).returning();
        return row ? publicTerm(row) : null;
      });
      return term ? reply.send({ success: true, data: term }) : reply.code(404).send({ success: false, error: "TERM_NOT_FOUND" });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "TERM_CODE_ALREADY_EXISTS" });
      if ((error as { code?: string }).code === "23514") return reply.code(400).send({ success: false, error: "TERM_DATES_INVALID" });
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>("/api/v1/education/admin/terms/:id/close", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const [row] = await withInstitution(tenantId, key, (tx, institutionId) => tx.update(educationTerms)
      .set({ status: "closed", updatedAt: new Date() })
      .where(and(eq(educationTerms.id, request.params.id), eq(educationTerms.tenantId, tenantId), eq(educationTerms.institutionId, institutionId)))
      .returning());
    return row ? reply.send({ success: true, data: publicTerm(row) }) : reply.code(404).send({ success: false, error: "TERM_NOT_FOUND" });
  });

  app.get("/api/public/education/programs", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const programs = await withInstitution(tenantId, key, (tx, institutionId) => tx.select().from(educationPrograms).where(and(
      eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId),
      eq(educationPrograms.active, true), eq(educationPrograms.publicVisible, true),
    )).orderBy(asc(educationPrograms.name)));
    reply.header("cache-control", "public, max-age=60, stale-while-revalidate=300");
    return reply.send({ success: true, data: programs.map(publicProgram) });
  });

  app.get("/api/v1/education/catalog/programs", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { deptId?: string; department_id?: string };
    const programs = await withInstitution(tenantId, key, (tx, institutionId) => {
      const filters: SQL[] = [eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId), eq(educationPrograms.active, true)];
      const departmentId = query.deptId ?? query.department_id;
      if (departmentId) filters.push(eq(educationPrograms.departmentId, departmentId));
      return tx.select().from(educationPrograms).where(and(...filters)).orderBy(asc(educationPrograms.name));
    });
    return reply.send({ success: true, data: programs.map((row) => ({
      id: row.id, name: row.name, program_code: row.code, degree_level: row.level,
      faculty_id: row.facultyId ?? "", department_id: row.departmentId ?? "",
    })) });
  });

  app.get("/api/v1/education/catalog/faculties", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const rows = await withInstitution(tenantId, key, (tx, institutionId) => tx.select({
      id: educationPrograms.facultyId, name: educationPrograms.faculty,
    }).from(educationPrograms).where(and(
      eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId), eq(educationPrograms.active, true),
    )).groupBy(educationPrograms.facultyId, educationPrograms.faculty).orderBy(asc(educationPrograms.faculty)));
    const data = rows.filter((row) => row.name).map((row) => ({
      id: row.id ?? row.name!, name: row.name, code: row.name!.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 24),
      faculty_code: row.name!.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12),
    }));
    return reply.send({ success: true, data });
  });

  app.get("/api/v1/education/catalog/departments", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { facultyId?: string; faculty_id?: string };
    const rows = await withInstitution(tenantId, key, (tx, institutionId) => {
      const filters: SQL[] = [eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId), eq(educationPrograms.active, true)];
      const facultyId = query.facultyId ?? query.faculty_id;
      if (facultyId) filters.push(eq(educationPrograms.facultyId, facultyId));
      return tx.select({ id: educationPrograms.departmentId, name: educationPrograms.department, facultyId: educationPrograms.facultyId })
        .from(educationPrograms).where(and(...filters))
        .groupBy(educationPrograms.departmentId, educationPrograms.department, educationPrograms.facultyId)
        .orderBy(asc(educationPrograms.department));
    });
    const data = rows.filter((row) => row.name).map((row) => ({
      id: row.id ?? row.name!, name: row.name, faculty_id: row.facultyId ?? "",
      dept_code: row.name!.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12),
    }));
    return reply.send({ success: true, data });
  });
}

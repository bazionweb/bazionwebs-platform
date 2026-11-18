import { fromNodeHeaders } from "better-auth/node";
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
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
  educationApplicationLogs,
  educationApplications,
  educationCourseSections,
  educationCourses,
  educationEnrollments,
  educationFinanceTransactions,
  educationGradeAppeals,
  educationGrades,
  educationInstitutions,
  educationLibraryItems,
  educationPrograms,
  educationRegulatoryEvidence,
  educationStaff,
  educationStudents,
  educationStudyCenters,
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
type InstitutionResolutionKey = string;

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

function institutionKeyForRequest(request: FastifyRequest): InstitutionResolutionKey {
  if (isBemiHost(request.hostname)) return "bemi";
  if (isBmiHost(request.hostname)) return "bmi";
  const headerKey = request.headers["x-institution-key"];
  if (typeof headerKey === "string" && /^[a-z0-9-]{2,48}$/.test(headerKey.trim())) {
    return headerKey.trim();
  }
  return "default";
}

async function resolveEducationContext(request: FastifyRequest, config: AppConfig, requireUms = true) {
  const tenantId = await resolveRequestTenantId(request, config);
  const key = institutionKeyForRequest(request);
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
  key: InstitutionResolutionKey,
  callback: (tx: TenantTransaction, institutionId: string) => Promise<T>,
): Promise<T> {
  return withTenantTransaction(tenantId, async (tx) => {
    const candidateKeys = key === "default" ? ["default", "bmi", "bemi"] : [key];
    let institution: typeof educationInstitutions.$inferSelect | undefined;
    for (const candidateKey of candidateKeys) {
      await tx.execute(sql`select set_config('app.education_institution_key', ${candidateKey}, true)`);
      const [found] = await tx.select().from(educationInstitutions)
        .where(and(eq(educationInstitutions.tenantId, tenantId), eq(educationInstitutions.institutionKey, candidateKey)))
        .limit(1);
      if (found) {
        institution = found;
        break;
      }
    }
    if (!institution && key === "default") {
      // Fall back for mocked transactions or non-standard keys when RLS isn't blocking
      const [firstActive] = await tx.select().from(educationInstitutions)
        .where(eq(educationInstitutions.tenantId, tenantId))
        .orderBy(asc(educationInstitutions.createdAt))
        .limit(1);
      institution = firstActive;
    }
    if (!institution || institution.status !== "active") {
      throw routeError("The education institution has not been provisioned.", 503, "EDUCATION_INSTITUTION_UNAVAILABLE");
    }
    await tx.execute(sql`select set_config('app.education_institution_key', ${institution.institutionKey}, true)`);
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
  return resolveEducationInstitutionWebsiteConfig(
    (row.institutionKey === "bemi" ? "bemi" : "bmi") as InstitutionKey,
    row.websiteOverrides,
    { name: row.name,
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
      const resolvedTemplateKey: InstitutionKey = existing.institutionKey === "bemi" ? "bemi" : "bmi";
      const existingWebsiteConfig = resolveEducationInstitutionWebsiteConfig(resolvedTemplateKey, existing.websiteOverrides, undefined, { tenantId });
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
          websiteOverrides: createEducationInstitutionWebsiteOverlay(resolvedTemplateKey, nextWebsiteConfig, { tenantId }) as unknown as Record<string, unknown>,
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

  // ── Courses & Sections ───────────────────────────────────────────────────────────────────────────
  const courseInput = z.object({
    code: z.string().trim().min(2).max(48),
    title: z.string().trim().min(2).max(200),
    description: z.string().max(4000).optional(),
    programId: z.string().uuid().optional().nullable(),
    program_id: z.string().uuid().optional().nullable(),
    credits: z.coerce.number().int().min(0).max(60).optional(),
    level: z.string().trim().max(40).optional(),
    department: z.string().trim().max(160).optional(),
    faculty: z.string().trim().max(160).optional(),
    instructorName: z.string().trim().max(160).optional(),
    instructor_name: z.string().trim().max(160).optional(),
    capacity: z.coerce.number().int().positive().max(2000).optional(),
    isMandatory: z.boolean().optional(),
    syllabusJson: z.array(z.unknown()).optional(),
    status: z.enum(["active", "inactive", "archived"]).optional(),
  });

  app.get("/api/v1/education/courses", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { status?: string; department?: string; faculty?: string; program_id?: string; search?: string };
    const items = await withInstitution(tenantId, key, (tx, institutionId) => {
      const filters: SQL[] = [eq(educationCourses.tenantId, tenantId), eq(educationCourses.institutionId, institutionId)];
      if (query.status) filters.push(eq(educationCourses.status, query.status));
      if (query.department) filters.push(ilike(educationCourses.department, query.department));
      if (query.faculty) filters.push(ilike(educationCourses.faculty, query.faculty));
      if (query.program_id) filters.push(eq(educationCourses.programId, query.program_id));
      if (query.search?.trim()) {
        const s = `%${query.search.trim()}%`;
        filters.push(or(ilike(educationCourses.code, s), ilike(educationCourses.title, s))!);
      }
      return tx.select().from(educationCourses).where(and(...filters)).orderBy(asc(educationCourses.code));
    });
    return reply.send({ success: true, data: items });
  });

  app.get("/api/v1/education/courses/stats/overview", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const stats = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const rows = await tx.select({ status: educationCourses.status, total: count() }).from(educationCourses)
        .where(and(eq(educationCourses.tenantId, tenantId), eq(educationCourses.institutionId, institutionId)))
        .groupBy(educationCourses.status);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.total]));
      const total = rows.reduce((s, r) => s + r.total, 0);
      return { total, active: byStatus.active ?? total, byStatus };
    });
    return reply.send({ success: true, data: stats });
  });

  app.post("/api/v1/education/courses/batch", async (request, reply) => {
    const batchSchema = z.object({ items: z.array(courseInput).min(1).max(500) });
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const results = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const createdIds: string[] = [];
      const errors: Array<{ index: number; error: string }> = [];
      for (let i = 0; i < parsed.data.items.length; i++) {
        const d = parsed.data.items[i]!;
        try {
          const [created] = await tx.insert(educationCourses).values({
            tenantId,
            institutionId,
            programId: d.programId ?? d.program_id ?? null,
            code: d.code.toUpperCase(),
            title: d.title,
            description: d.description ?? "",
            credits: d.credits ?? 3,
            level: d.level ?? "100",
            department: d.department ?? "",
            faculty: d.faculty ?? "",
            status: d.status ?? "active",
          }).returning({ id: educationCourses.id });
          if (created) createdIds.push(created.id);
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Insert failed" });
        }
      }
      return { createdIds, successCount: createdIds.length, failureCount: errors.length, errors };
    });
    return reply.send({ success: true, data: results });
  });

  app.post("/api/v1/education/courses", async (request, reply) => {
    const parsed = courseInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    try {
      const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
        tx.insert(educationCourses).values({
          tenantId,
          institutionId,
          programId: d.programId ?? d.program_id ?? null,
          code: d.code.toUpperCase(),
          title: d.title,
          description: d.description ?? "",
          credits: d.credits ?? 3,
          level: d.level ?? "100",
          department: d.department ?? "",
          faculty: d.faculty ?? "",
          instructorName: d.instructorName ?? d.instructor_name ?? "",
          capacity: d.capacity ?? 60,
          isMandatory: d.isMandatory ?? false,
          syllabusJson: d.syllabusJson ?? [],
          status: d.status ?? "active",
        }).returning(),
      );
      return reply.code(201).send({ success: true, data: created });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "COURSE_CODE_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/courses/:id", async (request, reply) => {
    const parsed = courseInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.code !== undefined) patch.code = d.code.toUpperCase();
    if (d.title !== undefined) patch.title = d.title;
    if (d.description !== undefined) patch.description = d.description;
    if (d.programId !== undefined || d.program_id !== undefined) patch.programId = d.programId ?? d.program_id ?? null;
    if (d.credits !== undefined) patch.credits = d.credits;
    if (d.level !== undefined) patch.level = d.level;
    if (d.department !== undefined) patch.department = d.department;
    if (d.faculty !== undefined) patch.faculty = d.faculty;
    if (d.instructorName !== undefined || d.instructor_name !== undefined) patch.instructorName = d.instructorName ?? d.instructor_name ?? "";
    if (d.capacity !== undefined) patch.capacity = d.capacity;
    if (d.isMandatory !== undefined) patch.isMandatory = d.isMandatory;
    if (d.syllabusJson !== undefined) patch.syllabusJson = d.syllabusJson;
    if (d.status !== undefined) patch.status = d.status;

    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationCourses).set(patch).where(and(eq(educationCourses.id, request.params.id), eq(educationCourses.tenantId, tenantId), eq(educationCourses.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "COURSE_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/courses/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const [deleted] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.delete(educationCourses).where(and(eq(educationCourses.id, request.params.id), eq(educationCourses.tenantId, tenantId), eq(educationCourses.institutionId, institutionId))).returning({ id: educationCourses.id }),
    );
    return deleted ? reply.send({ success: true }) : reply.code(404).send({ success: false, error: "COURSE_NOT_FOUND" });
  });

  app.get<{ Params: { courseId: string } }>("/api/v1/education/courses/:courseId/sections", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const sections = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationCourseSections).where(and(
        eq(educationCourseSections.tenantId, tenantId),
        eq(educationCourseSections.institutionId, institutionId),
        eq(educationCourseSections.courseId, request.params.courseId),
      )).orderBy(asc(educationCourseSections.sectionCode)),
    );
    return reply.send({ success: true, data: sections });
  });

  app.post<{ Params: { courseId: string } }>("/api/v1/education/courses/:courseId/sections", async (request, reply) => {
    const sectionSchema = z.object({
      sectionCode: z.string().trim().min(1).max(40),
      termId: z.string().uuid().optional().nullable(),
      instructor: z.string().trim().max(160).optional(),
      schedule: z.string().trim().max(160).optional(),
      room: z.string().trim().max(80).optional(),
      capacity: z.coerce.number().int().positive().max(2000).optional(),
      status: z.enum(["open", "closed", "cancelled"]).optional(),
    });
    const parsed = sectionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    const section = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [course] = await tx.select({ id: educationCourses.id }).from(educationCourses).where(and(
        eq(educationCourses.id, request.params.courseId),
        eq(educationCourses.tenantId, tenantId),
        eq(educationCourses.institutionId, institutionId),
      )).limit(1);
      if (!course) return null;
      const [created] = await tx.insert(educationCourseSections).values({
        tenantId,
        institutionId,
        courseId: course.id,
        termId: d.termId ?? null,
        sectionCode: d.sectionCode,
        instructor: d.instructor ?? "",
        schedule: d.schedule ?? "",
        room: d.room ?? "",
        capacity: d.capacity ?? 40,
        status: d.status ?? "open",
      }).returning();
      return created;
    });
    return section ? reply.code(201).send({ success: true, data: section }) : reply.code(404).send({ success: false, error: "COURSE_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/sections/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const [deleted] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.delete(educationCourseSections).where(and(eq(educationCourseSections.id, request.params.id), eq(educationCourseSections.tenantId, tenantId), eq(educationCourseSections.institutionId, institutionId))).returning({ id: educationCourseSections.id }),
    );
    return deleted ? reply.send({ success: true }) : reply.code(404).send({ success: false, error: "SECTION_NOT_FOUND" });
  });

  // ── Enrollments ──────────────────────────────────────────────────────────────────────────────────
  app.get("/api/v1/education/enrollments", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { student_id?: string; course_id?: string; term_id?: string; status?: string };
    const items = await withInstitution(tenantId, key, (tx, institutionId) => {
      const filters: SQL[] = [eq(educationEnrollments.tenantId, tenantId), eq(educationEnrollments.institutionId, institutionId)];
      if (query.student_id) filters.push(eq(educationEnrollments.studentId, query.student_id));
      if (query.course_id) filters.push(eq(educationEnrollments.courseId, query.course_id));
      if (query.term_id) filters.push(eq(educationEnrollments.termId, query.term_id));
      if (query.status) filters.push(eq(educationEnrollments.status, query.status));
      return tx.select().from(educationEnrollments).where(and(...filters)).orderBy(desc(educationEnrollments.enrolledAt));
    });
    return reply.send({ success: true, data: items });
  });

  app.post("/api/v1/education/enrollments", async (request, reply) => {
    const enrollmentSchema = z.object({
      studentId: z.string().uuid(),
      courseId: z.string().uuid(),
      sectionId: z.string().uuid().optional().nullable(),
      programId: z.string().uuid().optional().nullable(),
      termId: z.string().uuid().optional().nullable(),
      status: z.enum(["enrolled", "dropped", "completed", "waitlisted"]).optional(),
      agreementSigned: z.boolean().optional(),
    });
    const parsed = enrollmentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    const status = d.status ?? "enrolled";
    const created = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.insert(educationEnrollments).values({
        tenantId,
        institutionId,
        studentId: d.studentId,
        courseId: d.courseId,
        sectionId: d.sectionId ?? null,
        programId: d.programId ?? null,
        termId: d.termId ?? null,
        status,
        agreementSigned: d.agreementSigned ?? false,
      }).returning();
      if (d.sectionId && status === "enrolled") {
        await tx.update(educationCourseSections).set({
          enrolledCount: sql`${educationCourseSections.enrolledCount} + 1`,
          updatedAt: new Date(),
        }).where(and(eq(educationCourseSections.id, d.sectionId), eq(educationCourseSections.tenantId, tenantId), eq(educationCourseSections.institutionId, institutionId)));
      }
      return row;
    });
    return reply.code(201).send({ success: true, data: created });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/enrollments/:id", async (request, reply) => {
    const patchSchema = z.object({
      status: z.enum(["enrolled", "dropped", "completed", "waitlisted"]).optional(),
      agreementSigned: z.boolean().optional(),
    });
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.agreementSigned !== undefined) patch.agreementSigned = parsed.data.agreementSigned;
    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationEnrollments).set(patch).where(and(eq(educationEnrollments.id, request.params.id), eq(educationEnrollments.tenantId, tenantId), eq(educationEnrollments.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "ENROLLMENT_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/enrollments/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const [deleted] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.delete(educationEnrollments).where(and(eq(educationEnrollments.id, request.params.id), eq(educationEnrollments.tenantId, tenantId), eq(educationEnrollments.institutionId, institutionId))).returning({ id: educationEnrollments.id }),
    );
    return deleted ? reply.send({ success: true }) : reply.code(404).send({ success: false, error: "ENROLLMENT_NOT_FOUND" });
  });

  // ── Applications & Admissions ────────────────────────────────────────────────────────────────────
  app.post("/api/public/education/applications", async (request, reply) => {
    const applicationInput = z.object({
      first_name: z.string().trim().min(1).max(100).optional(),
      firstName: z.string().trim().min(1).max(100).optional(),
      last_name: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      email: z.string().trim().email().max(254),
      phone: z.string().trim().max(40).optional(),
      program_id: z.string().uuid().optional().nullable(),
      programId: z.string().uuid().optional().nullable(),
      program: z.string().trim().max(200).optional(),
      programName: z.string().trim().max(200).optional(),
      intakeTerm: z.string().trim().max(80).optional(),
      depositRequiredMinor: z.coerce.number().int().min(0).optional(),
    }).passthrough();
    const parsed = applicationInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const d = parsed.data;
    const firstName = d.firstName ?? d.first_name;
    const lastName = d.lastName ?? d.last_name;
    if (!firstName || !lastName) return reply.code(400).send({ success: false, error: "NAME_REQUIRED" });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const applicationNumber = `APP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const application = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [created] = await tx.insert(educationApplications).values({
        tenantId,
        institutionId,
        applicationNumber,
        firstName,
        lastName,
        email: d.email.toLowerCase(),
        phone: d.phone ?? "",
        programId: d.programId ?? d.program_id ?? null,
        programName: d.programName ?? d.program ?? "",
        intakeTerm: d.intakeTerm ?? "",
        status: "submitted",
        depositRequiredMinor: d.depositRequiredMinor ?? 0,
        payloadJson: parsed.data,
      }).returning();
      if (!created) throw new Error("EDUCATION_APPLICATION_INSERT_FAILED");
      await tx.insert(educationApplicationLogs).values({
        tenantId,
        institutionId,
        applicationId: created.id,
        action: "submitted",
        actor: d.email.toLowerCase(),
        note: "Application submitted",
      });
      return created;
    });
    return reply.code(201).send({ success: true, application_id: application.id, applicationNumber: application.applicationNumber, data: application });
  });

  app.get<{ Params: { id: string } }>("/api/public/education/admissions/decision/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const row = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [found] = await tx.select().from(educationApplications).where(and(
        eq(educationApplications.tenantId, tenantId),
        eq(educationApplications.institutionId, institutionId),
        or(eq(educationApplications.id, request.params.id), eq(educationApplications.applicationNumber, request.params.id))!,
      )).limit(1);
      return found ?? null;
    });
    if (!row) return reply.code(404).send({ success: false, error: "APPLICATION_NOT_FOUND" });
    const decision = row.status === "accepted" || row.status === "enrolled"
      ? "admit"
      : row.status === "rejected"
        ? "deny"
        : row.status === "waitlisted"
          ? "waitlist"
          : "pending";
    return reply.send({
      success: true,
      data: {
        id: row.id,
        applicationNumber: row.applicationNumber,
        status: row.status,
        decision,
        programName: row.programName,
        decisionConditions: row.decisionConditions,
        depositRequiredMinor: row.depositRequiredMinor,
        decidedAt: row.decidedAt?.toISOString() ?? null,
      },
    });
  });

  app.post("/api/public/education/admissions/accept", async (request, reply) => {
    const acceptSchema = z.object({
      application_id: z.string().uuid().optional(),
      applicationId: z.string().uuid().optional(),
    });
    const parsed = acceptSchema.safeParse(request.body);
    const applicationId = parsed.success ? (parsed.data.applicationId ?? parsed.data.application_id) : undefined;
    if (!applicationId) return reply.code(400).send({ success: false, error: "APPLICATION_ID_REQUIRED" });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const result = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [appRow] = await tx.select().from(educationApplications).where(and(
        eq(educationApplications.id, applicationId),
        eq(educationApplications.tenantId, tenantId),
        eq(educationApplications.institutionId, institutionId),
      )).for("update").limit(1);
      if (!appRow) return { error: "APPLICATION_NOT_FOUND" as const };
      if (appRow.status !== "accepted" && appRow.status !== "enrolled") {
        return { error: "ADMISSION_NOT_ACCEPTED" as const };
      }

      const [existingStudent] = await tx.select().from(educationStudents).where(and(
        eq(educationStudents.tenantId, tenantId),
        eq(educationStudents.institutionId, institutionId),
        eq(educationStudents.email, appRow.email.toLowerCase()),
      )).limit(1);

      let student = existingStudent;
      if (!student) {
        const regNo = `${institutionId.slice(0, 4).toUpperCase()}-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;
        const [insertedStudent] = await tx.insert(educationStudents).values({
          tenantId,
          institutionId,
          programId: appRow.programId,
          registrationNumber: regNo,
          firstName: appRow.firstName,
          lastName: appRow.lastName,
          email: appRow.email.toLowerCase(),
          phone: appRow.phone,
          status: "active",
          enrollmentStatus: "ENROLLED",
          admissionDate: new Date().toISOString().slice(0, 10),
        }).returning();
        student = insertedStudent;
      }

      if (appRow.status !== "enrolled") {
        await tx.update(educationApplications).set({ status: "enrolled", updatedAt: new Date() })
          .where(and(eq(educationApplications.id, appRow.id), eq(educationApplications.tenantId, tenantId), eq(educationApplications.institutionId, institutionId)));
        await tx.insert(educationApplicationLogs).values({
          tenantId,
          institutionId,
          applicationId: appRow.id,
          action: "offer_accepted",
          actor: appRow.email.toLowerCase(),
          note: `Provisioned student ${student?.registrationNumber ?? ""}`,
        });
        if (appRow.depositRequiredMinor > 0 && student) {
          await tx.insert(educationFinanceTransactions).values({
            tenantId,
            institutionId,
            studentId: student.id,
            reference: `DEP-${appRow.applicationNumber}`,
            amountMinor: appRow.depositRequiredMinor,
            currency: "USD",
            transactionType: "admission_deposit",
            description: `Admission deposit for ${appRow.programName || "Program"}`,
            status: "Pending",
          });
        }
      }
      return { student };
    });

    if ("error" in result) {
      return result.error === "APPLICATION_NOT_FOUND"
        ? reply.code(404).send({ success: false, error: result.error })
        : reply.code(409).send({ success: false, error: result.error });
    }
    return reply.send({
      success: true,
      provisioningResult: {
        studentId: result.student?.id,
        regNo: result.student?.registrationNumber,
      },
    });
  });

  app.get("/api/v1/education/applications", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const items = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationApplications).where(and(eq(educationApplications.tenantId, tenantId), eq(educationApplications.institutionId, institutionId))).orderBy(desc(educationApplications.submittedAt)),
    );
    return reply.send({ success: true, data: items });
  });

  app.get<{ Params: { id: string } }>("/api/v1/education/applications/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const item = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [found] = await tx.select().from(educationApplications).where(and(
        eq(educationApplications.tenantId, tenantId),
        eq(educationApplications.institutionId, institutionId),
        or(eq(educationApplications.id, request.params.id), eq(educationApplications.applicationNumber, request.params.id))!,
      )).limit(1);
      return found ?? null;
    });
    return item ? reply.send({ success: true, data: item }) : reply.code(404).send({ success: false, error: "APPLICATION_NOT_FOUND" });
  });

  app.get<{ Params: { id: string } }>("/api/v1/education/applications/:id/logs", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const logs = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationApplicationLogs).where(and(
        eq(educationApplicationLogs.tenantId, tenantId),
        eq(educationApplicationLogs.institutionId, institutionId),
        eq(educationApplicationLogs.applicationId, request.params.id),
      )).orderBy(desc(educationApplicationLogs.createdAt)),
    );
    return reply.send({ success: true, data: logs });
  });

  app.post("/api/v1/education/admissions/decide", async (request, reply) => {
    const decideSchema = z.object({
      application_id: z.string().trim().min(1).optional(),
      applicationId: z.string().trim().min(1).optional(),
      decision: z.enum(["accepted", "rejected", "waitlisted", "under_review", "admit", "deny", "waitlist"]),
      notes: z.string().max(4000).optional(),
    });
    const parsed = decideSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const appId = parsed.data.applicationId ?? parsed.data.application_id;
    if (!appId) return reply.code(400).send({ success: false, error: "APPLICATION_ID_REQUIRED" });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const context = await requireEducationPermission(request, tenantId, "update");
    const rawDecision = parsed.data.decision;
    const normalizedStatus = rawDecision === "admit" ? "accepted" : rawDecision === "deny" ? "rejected" : rawDecision === "waitlist" ? "waitlisted" : rawDecision;
    const updated = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.update(educationApplications).set({
        status: normalizedStatus,
        reviewerNotes: parsed.data.notes ?? "",
        decidedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(
        or(eq(educationApplications.id, appId), eq(educationApplications.applicationNumber, appId))!,
        eq(educationApplications.tenantId, tenantId),
        eq(educationApplications.institutionId, institutionId),
      )).returning();
      if (!row) return null;
      await tx.insert(educationApplicationLogs).values({
        tenantId,
        institutionId,
        applicationId: row.id,
        action: `decision_${normalizedStatus}`,
        actor: context.email,
        note: parsed.data.notes ?? "",
      });
      return row;
    });
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "APPLICATION_NOT_FOUND" });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/applications/:id/status", async (request, reply) => {
    const statusSchema = z.object({
      status: z.enum(["draft", "submitted", "under_review", "accepted", "rejected", "waitlisted", "enrolled"]),
      reviewerNotes: z.string().max(4000).optional(),
      notes: z.string().max(4000).optional(),
      decisionConditions: z.string().max(4000).optional(),
      depositRequiredMinor: z.coerce.number().int().min(0).optional(),
    });
    const parsed = statusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const context = await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const isDecision = ["accepted", "rejected", "waitlisted"].includes(d.status);
    const updated = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx.update(educationApplications).set({
        status: d.status,
        ...(d.reviewerNotes !== undefined || d.notes !== undefined ? { reviewerNotes: d.reviewerNotes ?? d.notes ?? "" } : {}),
        ...(d.decisionConditions !== undefined ? { decisionConditions: d.decisionConditions } : {}),
        ...(d.depositRequiredMinor !== undefined ? { depositRequiredMinor: d.depositRequiredMinor } : {}),
        ...(isDecision ? { decidedAt: new Date() } : {}),
        updatedAt: new Date(),
      }).where(and(
        eq(educationApplications.id, request.params.id),
        eq(educationApplications.tenantId, tenantId),
        eq(educationApplications.institutionId, institutionId),
      )).returning();
      if (!row) return null;
      await tx.insert(educationApplicationLogs).values({
        tenantId,
        institutionId,
        applicationId: row.id,
        action: `status_${d.status}`,
        actor: context.email,
        note: d.reviewerNotes ?? d.notes ?? "",
      });
      return row;
    });
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "APPLICATION_NOT_FOUND" });
  });

  // ── Grades & Appeals ─────────────────────────────────────────────────────────────────────────────
  function gradeLetterAndPoints(score: number): { letter: string; points: string } {
    if (score >= 90) return { letter: "A", points: "4.00" };
    if (score >= 80) return { letter: "B", points: "3.00" };
    if (score >= 70) return { letter: "C", points: "2.00" };
    if (score >= 60) return { letter: "D", points: "1.00" };
    return { letter: "F", points: "0.00" };
  }

  app.get("/api/v1/education/grades", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { student_id?: string; course_id?: string; term_id?: string; status?: string };
    const items = await withInstitution(tenantId, key, (tx, institutionId) => {
      const filters: SQL[] = [eq(educationGrades.tenantId, tenantId), eq(educationGrades.institutionId, institutionId)];
      if (query.student_id) filters.push(eq(educationGrades.studentId, query.student_id));
      if (query.course_id) filters.push(eq(educationGrades.courseId, query.course_id));
      if (query.term_id) filters.push(eq(educationGrades.termId, query.term_id));
      if (query.status) filters.push(eq(educationGrades.status, query.status));
      return tx.select().from(educationGrades).where(and(...filters)).orderBy(desc(educationGrades.createdAt));
    });
    return reply.send({ success: true, data: items });
  });

  const gradeInput = z.object({
    studentId: z.string().uuid(),
    courseId: z.string().uuid(),
    termId: z.string().uuid().optional().nullable(),
    academicYear: z.string().trim().max(40).optional(),
    semester: z.string().trim().max(40).optional(),
    numericGrade: z.coerce.number().min(0).max(100),
    letterGrade: z.string().trim().max(8).optional(),
    gpaPoints: z.coerce.number().min(0).max(5).optional(),
    credits: z.coerce.number().int().min(0).max(30).optional(),
    componentsJson: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["Provisional", "Verified", "Finalized"]).optional(),
  });

  app.post("/api/v1/education/grades", async (request, reply) => {
    const parsed = gradeInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    const computed = gradeLetterAndPoints(d.numericGrade);
    const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.insert(educationGrades).values({
        tenantId,
        institutionId,
        studentId: d.studentId,
        courseId: d.courseId,
        termId: d.termId ?? null,
        academicYear: d.academicYear ?? "",
        semester: d.semester ?? "",
        numericGrade: d.numericGrade.toFixed(2),
        letterGrade: d.letterGrade ?? computed.letter,
        gpaPoints: d.gpaPoints !== undefined ? d.gpaPoints.toFixed(2) : computed.points,
        credits: d.credits ?? 3,
        componentsJson: d.componentsJson ?? {},
        status: d.status ?? "Provisional",
      }).returning(),
    );
    return reply.code(201).send({ success: true, data: created });
  });

  app.post("/api/v1/education/grades/batch", async (request, reply) => {
    const gradeBatchSchema = z.object({
      items: z.array(gradeInput).min(1).max(500),
    });
    const parsed = gradeBatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const results = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const createdIds: string[] = [];
      const errors: Array<{ index: number; error: string }> = [];
      for (let i = 0; i < parsed.data.items.length; i++) {
        const d = parsed.data.items[i]!;
        try {
          const { letter, points } = gradeLetterAndPoints(d.numericGrade);
          const [created] = await tx.insert(educationGrades).values({
            tenantId,
            institutionId,
            studentId: d.studentId,
            courseId: d.courseId,
            termId: d.termId ?? null,
            academicYear: d.academicYear ?? "",
            semester: d.semester ?? "",
            numericGrade: d.numericGrade.toFixed(2),
            letterGrade: d.letterGrade ?? letter,
            gpaPoints: d.gpaPoints !== undefined ? d.gpaPoints.toFixed(2) : points,
            credits: d.credits ?? 3,
            componentsJson: d.componentsJson ?? {},
            status: d.status ?? "Provisional",
          }).returning({ id: educationGrades.id });
          if (created) createdIds.push(created.id);
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Grade insert failed" });
        }
      }
      return { createdIds, successCount: createdIds.length, failureCount: errors.length, errors };
    });
    return reply.send({ success: true, data: results });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/grades/:id", async (request, reply) => {
    const patchSchema = z.object({
      numericGrade: z.coerce.number().min(0).max(100).optional(),
      letterGrade: z.string().trim().max(8).optional(),
      gpaPoints: z.coerce.number().min(0).max(5).optional(),
      status: z.enum(["Provisional", "Verified", "Finalized"]).optional(),
      componentsJson: z.record(z.string(), z.unknown()).optional(),
    });
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.numericGrade !== undefined) {
      patch.numericGrade = d.numericGrade.toFixed(2);
      const computed = gradeLetterAndPoints(d.numericGrade);
      patch.letterGrade = d.letterGrade ?? computed.letter;
      patch.gpaPoints = d.gpaPoints !== undefined ? d.gpaPoints.toFixed(2) : computed.points;
    } else {
      if (d.letterGrade !== undefined) patch.letterGrade = d.letterGrade;
      if (d.gpaPoints !== undefined) patch.gpaPoints = d.gpaPoints.toFixed(2);
    }
    if (d.status !== undefined) patch.status = d.status;
    if (d.componentsJson !== undefined) patch.componentsJson = d.componentsJson;
    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationGrades).set(patch).where(and(eq(educationGrades.id, request.params.id), eq(educationGrades.tenantId, tenantId), eq(educationGrades.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "GRADE_NOT_FOUND" });
  });

  app.get("/api/v1/education/grade-appeals", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const items = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationGradeAppeals).where(and(eq(educationGradeAppeals.tenantId, tenantId), eq(educationGradeAppeals.institutionId, institutionId))).orderBy(desc(educationGradeAppeals.createdAt)),
    );
    return reply.send({ success: true, data: items });
  });

  app.post("/api/v1/education/grade-appeals", async (request, reply) => {
    const appealSchema = z.object({
      gradeId: z.string().uuid(),
      studentId: z.string().uuid(),
      reason: z.string().trim().min(2).max(200),
      explanation: z.string().max(4000).optional(),
    });
    const parsed = appealSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.insert(educationGradeAppeals).values({
        tenantId,
        institutionId,
        gradeId: parsed.data.gradeId,
        studentId: parsed.data.studentId,
        reason: parsed.data.reason,
        explanation: parsed.data.explanation ?? "",
        status: "pending",
      }).returning(),
    );
    return reply.code(201).send({ success: true, data: created });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/grade-appeals/:id", async (request, reply) => {
    const appealPatchSchema = z.object({
      status: z.enum(["pending", "approved", "denied"]),
      revisedGrade: z.coerce.number().min(0).max(100).optional(),
      reviewerNotes: z.string().max(4000).optional(),
    });
    const parsed = appealPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const updated = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [appeal] = await tx.update(educationGradeAppeals).set({
        status: d.status,
        ...(d.revisedGrade !== undefined ? { revisedGrade: d.revisedGrade.toFixed(2) } : {}),
        ...(d.reviewerNotes !== undefined ? { reviewerNotes: d.reviewerNotes } : {}),
        updatedAt: new Date(),
      }).where(and(eq(educationGradeAppeals.id, request.params.id), eq(educationGradeAppeals.tenantId, tenantId), eq(educationGradeAppeals.institutionId, institutionId))).returning();
      if (!appeal) return null;
      if (d.status === "approved" && d.revisedGrade !== undefined) {
        const computed = gradeLetterAndPoints(d.revisedGrade);
        await tx.update(educationGrades).set({
          numericGrade: d.revisedGrade.toFixed(2),
          letterGrade: computed.letter,
          gpaPoints: computed.points,
          updatedAt: new Date(),
        }).where(and(eq(educationGrades.id, appeal.gradeId), eq(educationGrades.tenantId, tenantId), eq(educationGrades.institutionId, institutionId)));
      }
      return appeal;
    });
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "APPEAL_NOT_FOUND" });
  });

  // ── Education Finance Transactions ───────────────────────────────────────────────────────────────
  app.get("/api/v1/education/finance/transactions", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const query = request.query as { student_id?: string; status?: string; transaction_type?: string };
    const items = await withInstitution(tenantId, key, (tx, institutionId) => {
      const filters: SQL[] = [eq(educationFinanceTransactions.tenantId, tenantId), eq(educationFinanceTransactions.institutionId, institutionId)];
      if (query.student_id) filters.push(eq(educationFinanceTransactions.studentId, query.student_id));
      if (query.status) filters.push(eq(educationFinanceTransactions.status, query.status));
      if (query.transaction_type) filters.push(eq(educationFinanceTransactions.transactionType, query.transaction_type));
      return tx.select().from(educationFinanceTransactions).where(and(...filters)).orderBy(desc(educationFinanceTransactions.createdAt));
    });
    return reply.send({ success: true, data: items });
  });

  app.get("/api/v1/education/finance/stats", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const stats = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [totals] = await tx.select({
        totalCount: count(),
        totalAmountMinor: sql<number>`coalesce(sum(${educationFinanceTransactions.amountMinor}), 0)`,
      }).from(educationFinanceTransactions).where(and(
        eq(educationFinanceTransactions.tenantId, tenantId),
        eq(educationFinanceTransactions.institutionId, institutionId),
      ));
      const [paid] = await tx.select({
        paidCount: count(),
        paidAmountMinor: sql<number>`coalesce(sum(${educationFinanceTransactions.amountMinor}), 0)`,
      }).from(educationFinanceTransactions).where(and(
        eq(educationFinanceTransactions.tenantId, tenantId),
        eq(educationFinanceTransactions.institutionId, institutionId),
        eq(educationFinanceTransactions.status, "Paid"),
      ));
      const [pending] = await tx.select({
        pendingCount: count(),
        pendingAmountMinor: sql<number>`coalesce(sum(${educationFinanceTransactions.amountMinor}), 0)`,
      }).from(educationFinanceTransactions).where(and(
        eq(educationFinanceTransactions.tenantId, tenantId),
        eq(educationFinanceTransactions.institutionId, institutionId),
        eq(educationFinanceTransactions.status, "Pending"),
      ));
      return {
        totalTransactions: totals?.totalCount ?? 0,
        totalAmount: Number((totals?.totalAmountMinor ?? 0) / 100),
        paidCount: paid?.paidCount ?? 0,
        paidAmount: Number((paid?.paidAmountMinor ?? 0) / 100),
        pendingCount: pending?.pendingCount ?? 0,
        pendingAmount: Number((pending?.pendingAmountMinor ?? 0) / 100),
        currency: "USD",
      };
    });
    return reply.send({ success: true, data: stats });
  });

  const txSchema = z.object({
    studentId: z.string().uuid().optional().nullable(),
    termId: z.string().uuid().optional().nullable(),
    reference: z.string().trim().min(2).max(80).optional(),
    amountMinor: z.coerce.number().int(),
    currency: z.string().trim().length(3).optional(),
    transactionType: z.string().trim().min(2).max(40).optional(),
    description: z.string().max(4000).optional(),
    status: z.enum(["Paid", "Pending", "Failed", "Voided"]).optional(),
    dueDate: z.string().date().optional().nullable(),
  });

  app.post("/api/v1/education/finance/transactions", async (request, reply) => {
    const parsed = txSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    const status = d.status ?? "Pending";
    const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.insert(educationFinanceTransactions).values({
        tenantId,
        institutionId,
        studentId: d.studentId ?? null,
        termId: d.termId ?? null,
        reference: d.reference ?? `EDU-TX-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        amountMinor: d.amountMinor,
        currency: (d.currency ?? "USD").toUpperCase(),
        transactionType: d.transactionType ?? "tuition_payment",
        description: d.description ?? "",
        status,
        dueDate: d.dueDate ?? null,
        paidAt: status === "Paid" ? new Date() : null,
      }).returning(),
    );
    return reply.code(201).send({ success: true, data: created });
  });

  app.post("/api/v1/education/finance/transactions/batch", async (request, reply) => {
    const txBatchSchema = z.object({
      items: z.array(txSchema).min(1).max(500),
    });
    const parsed = txBatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const results = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const createdIds: string[] = [];
      const errors: Array<{ index: number; error: string }> = [];
      for (let i = 0; i < parsed.data.items.length; i++) {
        const d = parsed.data.items[i]!;
        const status = d.status ?? "Pending";
        try {
          const [created] = await tx.insert(educationFinanceTransactions).values({
            tenantId,
            institutionId,
            studentId: d.studentId ?? null,
            termId: d.termId ?? null,
            reference: d.reference ?? `EDU-TX-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
            amountMinor: d.amountMinor,
            currency: (d.currency ?? "USD").toUpperCase(),
            transactionType: d.transactionType ?? "tuition_payment",
            description: d.description ?? "",
            status,
            dueDate: d.dueDate ?? null,
            paidAt: status === "Paid" ? new Date() : null,
          }).returning({ id: educationFinanceTransactions.id });
          if (created) createdIds.push(created.id);
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : "Transaction insert failed" });
        }
      }
      return { createdIds, successCount: createdIds.length, failureCount: errors.length, errors };
    });
    return reply.send({ success: true, data: results });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/finance/transactions/:id", async (request, reply) => {
    const patchSchema = z.object({
      status: z.enum(["Paid", "Pending", "Failed", "Voided"]).optional(),
      description: z.string().max(4000).optional(),
      amountMinor: z.coerce.number().int().optional(),
    });
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.status !== undefined) {
      patch.status = parsed.data.status;
      if (parsed.data.status === "Paid") patch.paidAt = new Date();
    }
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.amountMinor !== undefined) patch.amountMinor = parsed.data.amountMinor;
    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationFinanceTransactions).set(patch).where(and(eq(educationFinanceTransactions.id, request.params.id), eq(educationFinanceTransactions.tenantId, tenantId), eq(educationFinanceTransactions.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "TRANSACTION_NOT_FOUND" });
  });

  // ── Staff ────────────────────────────────────────────────────────────────────────────────────────
  const staffInput = z.object({
    staffNumber: z.string().trim().min(2).max(48).optional(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(40).optional(),
    department: z.string().trim().max(160).optional(),
    role: z.string().trim().max(80).optional(),
    employmentType: z.string().trim().max(40).optional(),
    status: z.enum(["active", "inactive", "on_leave"]).optional(),
    hireDate: z.string().date().optional().nullable(),
  });

  app.get("/api/v1/education/staff", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const items = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationStaff).where(and(eq(educationStaff.tenantId, tenantId), eq(educationStaff.institutionId, institutionId))).orderBy(asc(educationStaff.lastName), asc(educationStaff.firstName)),
    );
    return reply.send({ success: true, data: items });
  });

  app.get("/api/v1/education/staff/stats/overview", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const stats = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const rows = await tx.select({ status: educationStaff.status, total: count() }).from(educationStaff)
        .where(and(eq(educationStaff.tenantId, tenantId), eq(educationStaff.institutionId, institutionId)))
        .groupBy(educationStaff.status);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.total]));
      const total = rows.reduce((s, r) => s + r.total, 0);
      return { total, active: byStatus.active ?? total, byStatus };
    });
    return reply.send({ success: true, data: stats });
  });

  app.post("/api/v1/education/staff", async (request, reply) => {
    const parsed = staffInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    try {
      const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
        tx.insert(educationStaff).values({
          tenantId,
          institutionId,
          staffNumber: d.staffNumber ?? `STF-${randomUUID().slice(0, 8).toUpperCase()}`,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email.toLowerCase(),
          phone: d.phone ?? "",
          department: d.department ?? "",
          role: d.role ?? "Lecturer",
          employmentType: d.employmentType ?? "full_time",
          status: d.status ?? "active",
          hireDate: d.hireDate ?? null,
        }).returning(),
      );
      return reply.code(201).send({ success: true, data: created });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "STAFF_NUMBER_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/staff/:id", async (request, reply) => {
    const parsed = staffInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.firstName !== undefined) patch.firstName = d.firstName;
    if (d.lastName !== undefined) patch.lastName = d.lastName;
    if (d.email !== undefined) patch.email = d.email.toLowerCase();
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.department !== undefined) patch.department = d.department;
    if (d.role !== undefined) patch.role = d.role;
    if (d.employmentType !== undefined) patch.employmentType = d.employmentType;
    if (d.status !== undefined) patch.status = d.status;
    if (d.hireDate !== undefined) patch.hireDate = d.hireDate;
    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationStaff).set(patch).where(and(eq(educationStaff.id, request.params.id), eq(educationStaff.tenantId, tenantId), eq(educationStaff.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "STAFF_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/staff/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const [deleted] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.delete(educationStaff).where(and(eq(educationStaff.id, request.params.id), eq(educationStaff.tenantId, tenantId), eq(educationStaff.institutionId, institutionId))).returning({ id: educationStaff.id }),
    );
    return deleted ? reply.send({ success: true }) : reply.code(404).send({ success: false, error: "STAFF_NOT_FOUND" });
  });

  // ── Study Centers ────────────────────────────────────────────────────────────────────────────────
  const studyCenterInput = z.object({
    code: z.string().trim().min(2).max(48),
    name: z.string().trim().min(2).max(180),
    city: z.string().trim().max(120).optional(),
    country: z.string().trim().max(120).optional(),
    address: z.string().max(1000).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    directorName: z.string().trim().max(160).optional(),
    capacity: z.coerce.number().int().positive().optional(),
    status: z.enum(["active", "inactive"]).optional(),
  });

  app.get("/api/v1/education/study-centers", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const items = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationStudyCenters).where(and(eq(educationStudyCenters.tenantId, tenantId), eq(educationStudyCenters.institutionId, institutionId))).orderBy(asc(educationStudyCenters.name)),
    );
    return reply.send({ success: true, data: items });
  });

  app.get("/api/v1/education/study-centers/all", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const items = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationStudyCenters).where(and(eq(educationStudyCenters.tenantId, tenantId), eq(educationStudyCenters.institutionId, institutionId))).orderBy(asc(educationStudyCenters.name)),
    );
    return reply.send({ success: true, data: items });
  });

  app.get<{ Params: { id: string } }>("/api/v1/education/study-centers/:id/stats", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const stats = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [center] = await tx.select().from(educationStudyCenters).where(and(
        eq(educationStudyCenters.id, request.params.id),
        eq(educationStudyCenters.tenantId, tenantId),
        eq(educationStudyCenters.institutionId, institutionId),
      )).limit(1);
      if (!center) return null;
      const [studentCount] = await tx.select({ total: count() }).from(educationStudents).where(and(
        eq(educationStudents.tenantId, tenantId),
        eq(educationStudents.institutionId, institutionId),
        eq(educationStudents.studyCenterId, center.id),
      ));
      return {
        id: center.id,
        name: center.name,
        totalStudents: studentCount?.total ?? 0,
        capacity: center.capacity ?? 100,
        occupancyRate: center.capacity ? Math.round(((studentCount?.total ?? 0) / center.capacity) * 100) : 0,
      };
    });
    return stats ? reply.send({ success: true, data: stats }) : reply.code(404).send({ success: false, error: "STUDY_CENTER_NOT_FOUND" });
  });

  app.post("/api/v1/education/study-centers", async (request, reply) => {
    const parsed = studyCenterInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    try {
      const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
        tx.insert(educationStudyCenters).values({
          tenantId,
          institutionId,
          code: d.code.toUpperCase(),
          name: d.name,
          city: d.city ?? "",
          country: d.country ?? "",
          address: d.address ?? "",
          phone: d.phone ?? "",
          email: d.email ?? "",
          directorName: d.directorName ?? "",
          capacity: d.capacity ?? 100,
          status: d.status ?? "active",
        }).returning(),
      );
      return reply.code(201).send({ success: true, data: created });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "STUDY_CENTER_CODE_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/study-centers/:id", async (request, reply) => {
    const parsed = studyCenterInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.code !== undefined) patch.code = d.code.toUpperCase();
    if (d.name !== undefined) patch.name = d.name;
    if (d.city !== undefined) patch.city = d.city;
    if (d.country !== undefined) patch.country = d.country;
    if (d.address !== undefined) patch.address = d.address;
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.email !== undefined) patch.email = d.email;
    if (d.directorName !== undefined) patch.directorName = d.directorName;
    if (d.capacity !== undefined) patch.capacity = d.capacity;
    if (d.status !== undefined) patch.status = d.status;
    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationStudyCenters).set(patch).where(and(eq(educationStudyCenters.id, request.params.id), eq(educationStudyCenters.tenantId, tenantId), eq(educationStudyCenters.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "STUDY_CENTER_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/study-centers/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const [deleted] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.delete(educationStudyCenters).where(and(eq(educationStudyCenters.id, request.params.id), eq(educationStudyCenters.tenantId, tenantId), eq(educationStudyCenters.institutionId, institutionId))).returning({ id: educationStudyCenters.id }),
    );
    return deleted ? reply.send({ success: true }) : reply.code(404).send({ success: false, error: "STUDY_CENTER_NOT_FOUND" });
  });

  // ── Library Items ────────────────────────────────────────────────────────────────────────────────
  const libraryInput = z.object({
    isbn: z.string().trim().max(48).optional(),
    title: z.string().trim().min(1).max(240),
    author: z.string().trim().max(180).optional(),
    category: z.string().trim().max(80).optional(),
    copiesTotal: z.coerce.number().int().min(1).optional(),
    copiesAvailable: z.coerce.number().int().min(0).optional(),
    location: z.string().trim().max(120).optional(),
    status: z.enum(["available", "checked_out", "archived"]).optional(),
  });

  app.get("/api/v1/education/library", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "read");
    const items = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.select().from(educationLibraryItems).where(and(eq(educationLibraryItems.tenantId, tenantId), eq(educationLibraryItems.institutionId, institutionId))).orderBy(asc(educationLibraryItems.title)),
    );
    return reply.send({ success: true, data: items });
  });

  app.post("/api/v1/education/library", async (request, reply) => {
    const parsed = libraryInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "create");
    const d = parsed.data;
    const total = d.copiesTotal ?? 1;
    const [created] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.insert(educationLibraryItems).values({
        tenantId,
        institutionId,
        isbn: d.isbn ?? "",
        title: d.title,
        author: d.author ?? "",
        category: d.category ?? "General",
        copiesTotal: total,
        copiesAvailable: d.copiesAvailable ?? total,
        location: d.location ?? "",
        status: d.status ?? "available",
      }).returning(),
    );
    return reply.code(201).send({ success: true, data: created });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/education/library/:id", async (request, reply) => {
    const parsed = libraryInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "update");
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.isbn !== undefined) patch.isbn = d.isbn;
    if (d.title !== undefined) patch.title = d.title;
    if (d.author !== undefined) patch.author = d.author;
    if (d.category !== undefined) patch.category = d.category;
    if (d.copiesTotal !== undefined) patch.copiesTotal = d.copiesTotal;
    if (d.copiesAvailable !== undefined) patch.copiesAvailable = d.copiesAvailable;
    if (d.location !== undefined) patch.location = d.location;
    if (d.status !== undefined) patch.status = d.status;
    const [updated] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.update(educationLibraryItems).set(patch).where(and(eq(educationLibraryItems.id, request.params.id), eq(educationLibraryItems.tenantId, tenantId), eq(educationLibraryItems.institutionId, institutionId))).returning(),
    );
    return updated ? reply.send({ success: true, data: updated }) : reply.code(404).send({ success: false, error: "LIBRARY_ITEM_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/v1/education/library/:id", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    await requireEducationPermission(request, tenantId, "delete");
    const [deleted] = await withInstitution(tenantId, key, (tx, institutionId) =>
      tx.delete(educationLibraryItems).where(and(eq(educationLibraryItems.id, request.params.id), eq(educationLibraryItems.tenantId, tenantId), eq(educationLibraryItems.institutionId, institutionId))).returning({ id: educationLibraryItems.id }),
    );
    return deleted ? reply.send({ success: true }) : reply.code(404).send({ success: false, error: "LIBRARY_ITEM_NOT_FOUND" });
  });

  // ── Public Credential Verification & Student Self-Service Portal ─────────────────────────────────
  app.get("/api/public/education/verify", async (request, reply) => {
    const query = request.query as { code?: string; reg_no?: string };
    const code = (query.code ?? query.reg_no ?? "").trim();
    if (!code) return reply.code(400).send({ valid: false, error: "VERIFICATION_CODE_REQUIRED" });
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const match = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx
        .select({ student: educationStudents, program: educationPrograms })
        .from(educationStudents)
        .leftJoin(educationPrograms, and(eq(educationPrograms.id, educationStudents.programId), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId)))
        .where(and(
          eq(educationStudents.tenantId, tenantId),
          eq(educationStudents.institutionId, institutionId),
          eq(educationStudents.registrationNumber, code),
        ))
        .limit(1);
      return row ?? null;
    });
    if (!match) return reply.code(404).send({ valid: false, error: "CREDENTIAL_NOT_FOUND" });
    const dto = publicStudent(match.student, match.program ?? undefined);
    return reply.send({
      valid: true,
      data: {
        reg_no: dto.reg_no,
        student_name: dto.full_name,
        program_name: dto.program_name,
        status: dto.status,
        enrollment_status: dto.enrollment_status,
        faculty: dto.faculty,
        department: dto.department,
        academic_year: dto.academic_year,
      },
    });
  });

  app.get("/api/v1/education/student/profile", async (request, reply) => {
    const { tenantId, key } = await resolveEducationContext(request, options.config);
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) return reply.code(401).send({ success: false, error: "UNAUTHENTICATED" });
    const payload = await withInstitution(tenantId, key, async (tx, institutionId) => {
      const [row] = await tx
        .select({ student: educationStudents, program: educationPrograms })
        .from(educationStudents)
        .leftJoin(educationPrograms, and(eq(educationPrograms.id, educationStudents.programId), eq(educationPrograms.tenantId, tenantId), eq(educationPrograms.institutionId, institutionId)))
        .where(and(
          eq(educationStudents.tenantId, tenantId),
          eq(educationStudents.institutionId, institutionId),
          eq(educationStudents.email, identity.user.email.toLowerCase()),
        ))
        .limit(1);
      if (!row) return null;
      const [enrollments, grades, finance] = await Promise.all([
        tx.select().from(educationEnrollments).where(and(eq(educationEnrollments.tenantId, tenantId), eq(educationEnrollments.institutionId, institutionId), eq(educationEnrollments.studentId, row.student.id))),
        tx.select().from(educationGrades).where(and(eq(educationGrades.tenantId, tenantId), eq(educationGrades.institutionId, institutionId), eq(educationGrades.studentId, row.student.id))),
        tx.select().from(educationFinanceTransactions).where(and(eq(educationFinanceTransactions.tenantId, tenantId), eq(educationFinanceTransactions.institutionId, institutionId), eq(educationFinanceTransactions.studentId, row.student.id))),
      ]);
      return {
        student: publicStudent(row.student, row.program ?? undefined),
        enrollments,
        grades,
        financeTransactions: finance,
      };
    });
    if (!payload) return reply.code(404).send({ success: false, error: "STUDENT_RECORD_NOT_FOUND" });
    return reply.send({ success: true, data: payload });
  });
}

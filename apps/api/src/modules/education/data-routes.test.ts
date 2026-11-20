import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  educationStaff,
  educationStudents,
  educationStudyCenters,
} from "@bazion/database";
import { educationDataRoutes } from "./data-routes.js";

const mocks = vi.hoisted(() => ({
  resolveRequestTenantId: vi.fn(),
  isTenantModuleEnabled: vi.fn(),
  assertTenantNotInMaintenance: vi.fn(),
  isVerifiedTenantHost: vi.fn(),
  getCurrentIdentity: vi.fn(),
  requireActiveTenantPermission: vi.fn(),
  withTenantTransaction: vi.fn(),
}));

vi.mock("../../lib/tenant-resolution.js", () => ({
  resolveRequestTenantId: mocks.resolveRequestTenantId,
  resolveTenantId: mocks.resolveRequestTenantId,
}));
vi.mock("../../lib/tenant-modules.js", () => ({
  isTenantModuleEnabled: mocks.isTenantModuleEnabled,
}));
vi.mock("../../lib/tenant-maintenance.js", () => ({
  assertTenantNotInMaintenance: mocks.assertTenantNotInMaintenance,
}));
vi.mock("../../lib/database.js", () => ({
  pool: { query: vi.fn() },
  withTenantTransaction: mocks.withTenantTransaction,
}));
vi.mock("@bazion/auth/server", () => ({
  auth: { api: { setActiveOrganization: vi.fn() } },
  isVerifiedTenantHost: mocks.isVerifiedTenantHost,
}));
vi.mock("@bazion/auth", () => ({
  getCurrentIdentity: mocks.getCurrentIdentity,
  requireActiveTenantPermission: mocks.requireActiveTenantPermission,
}));

const genericTenantId = "22222222-2222-4222-8222-222222222222";
const genericInstitutionId = "33333333-3333-4333-8333-333333333333";

function createInMemoryEducationStore() {
  let seq = 1;
  const nextUuid = () => {
    const hex = String(seq++).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  };

  const tables = new Map<unknown, Array<Record<string, unknown>>>([
    [
      educationInstitutions,
      [
        {
          id: genericInstitutionId,
          tenantId: genericTenantId,
          institutionKey: "default",
          name: "St. Jude Seminary",
          legalName: "St. Jude Seminary Trust",
          status: "active",
          websiteTemplateId: "school-portal",
          websiteConfigurationSchemaVersion: "1.0.0",
          websiteOverrides: {},
          phones: [],
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    ],
    [educationPrograms, []],
    [educationStudyCenters, []],
    [educationStaff, []],
    [educationCourses, []],
    [educationCourseSections, []],
    [educationApplications, []],
    [educationApplicationLogs, []],
    [educationEnrollments, []],
    [educationStudents, []],
    [educationGrades, []],
    [educationGradeAppeals, []],
    [educationFinanceTransactions, []],
    [educationLibraryItems, []],
  ]);

  const rowsFor = (table: unknown) => {
    const arr = tables.get(table);
    if (!arr) {
      const created: Array<Record<string, unknown>> = [];
      tables.set(table, created);
      return created;
    }
    return arr;
  };

  const makeTx = () => ({
    execute: vi.fn(async () => ({ rows: [] })),
    select: (fields?: Record<string, unknown>) => {
      let currentTable: unknown = null;
      let joined = false;
      let limitCount: number | null = null;
      const run = () => {
        const list = rowsFor(currentTable);
        let result: Array<Record<string, unknown>> = list;
        if (joined && currentTable === educationStudents) {
          result = list.map((student) => ({ student, program: null }));
        } else if (fields) {
          result = list.map((row) => ({ ...row }));
        }
        return limitCount !== null ? result.slice(0, limitCount) : result;
      };
      const builder: Record<string, unknown> = {
        from(t: unknown) {
          currentTable = t;
          return builder;
        },
        leftJoin() {
          joined = true;
          return builder;
        },
        where() {
          return builder;
        },
        orderBy() {
          return builder;
        },
        groupBy() {
          return builder;
        },
        for() {
          return builder;
        },
        limit(n: number) {
          limitCount = n;
          return builder;
        },
        offset() {
          return builder;
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(run()).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
    insert: (table: unknown) => ({
      values(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
        const list = rowsFor(table);
        const items = Array.isArray(payload) ? payload : [payload];
        const inserted = items.map((item) => {
          const now = new Date();
          const record: Record<string, unknown> = {
            id: nextUuid(),
            createdAt: now,
            updatedAt: now,
            submittedAt: now,
            enrolledAt: now,
            ...item,
          };
          list.push(record);
          return record;
        });
        return {
          returning: async () => inserted,
          then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            return Promise.resolve(inserted).then(onFulfilled, onRejected);
          },
        };
      },
    }),
    update: (table: unknown) => ({
      set(patch: Record<string, unknown>) {
        const list = rowsFor(table);
        const apply = () => {
          const target = list[list.length - 1];
          if (!target) return [];
          for (const [key, val] of Object.entries(patch)) {
            if (key === "enrolledCount" && typeof target.enrolledCount === "number" && typeof val !== "number") {
              target[key] = target.enrolledCount + 1;
            } else {
              target[key] = val;
            }
          }
          return [target];
        };
        const builder: Record<string, unknown> = {
          where() {
            return builder;
          },
          returning: async () => apply(),
          then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            return Promise.resolve(apply()).then(onFulfilled, onRejected);
          },
        };
        return builder;
      },
    }),
    delete: (table: unknown) => ({
      where() {
        const list = rowsFor(table);
        const popOne = () => (list.length ? [list.pop()!] : []);
        return {
          returning: async () => popOne(),
          then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
            return Promise.resolve(popOne()).then(onFulfilled, onRejected);
          },
        };
      },
    }),
  });

  return { tables, makeTx };
}

describe("educationDataRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestTenantId.mockResolvedValue(genericTenantId);
    mocks.isTenantModuleEnabled.mockResolvedValue(true);
    mocks.assertTenantNotInMaintenance.mockResolvedValue(undefined);
    mocks.isVerifiedTenantHost.mockResolvedValue(true);
    mocks.requireActiveTenantPermission.mockResolvedValue({
      tenantId: genericTenantId,
      email: "registrar@stjude.edu",
    });
    mocks.getCurrentIdentity.mockResolvedValue({
      user: { email: "ada.okafor@example.org" },
    });
  });

  it("resolves any tenant with education-ums enabled and completes admissions -> student provisioning -> verification workflow", async () => {
    const store = createInMemoryEducationStore();
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, cb: (tx: unknown) => Promise<unknown>) =>
      cb(store.makeTx()),
    );

    const app = Fastify();
    await app.register(educationDataRoutes, {
      config: { NODE_ENV: "test" } as never,
    });

    // 1. Public application submission on generic non-BMI tenant host
    const applyRes = await app.inject({
      method: "POST",
      url: "/api/public/education/applications",
      headers: { host: "portal.stjude.test" },
      payload: {
        first_name: "Ada",
        last_name: "Okafor",
        email: "ada.okafor@example.org",
        phone: "+254712000111",
        program: "Bachelor of Divinity",
        depositRequiredMinor: 5000,
      },
    });
    expect(applyRes.statusCode).toBe(201);
    const applicationId = applyRes.json().application_id as string;

    // 2. Registrar lists applications and admits applicant
    const listAppsRes = await app.inject({
      method: "GET",
      url: "/api/v1/education/applications",
      headers: { host: "ums.stjude.test" },
    });
    expect(listAppsRes.statusCode).toBe(200);
    expect(listAppsRes.json().data).toHaveLength(1);

    const admitRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/education/applications/${applicationId}/status`,
      headers: { host: "ums.stjude.test" },
      payload: { status: "accepted", reviewerNotes: "All transcripts verified" },
    });
    expect(admitRes.statusCode).toBe(200);
    expect(admitRes.json().data.status).toBe("accepted");

    // 3. Applicant checks decision and accepts offer (provisions student + deposit invoice)
    const decisionRes = await app.inject({
      method: "GET",
      url: `/api/public/education/admissions/decision/${applicationId}`,
      headers: { host: "portal.stjude.test" },
    });
    expect(decisionRes.statusCode).toBe(200);
    expect(decisionRes.json().data.decision).toBe("admit");

    const acceptRes = await app.inject({
      method: "POST",
      url: "/api/public/education/admissions/accept",
      headers: { host: "portal.stjude.test" },
      payload: { application_id: applicationId },
    });
    expect(acceptRes.statusCode).toBe(200);
    const regNo = acceptRes.json().provisioningResult.regNo as string;
    const studentId = acceptRes.json().provisioningResult.studentId as string;
    expect(regNo).toBeTruthy();

    // Verify deposit transaction was created
    const finRes = await app.inject({
      method: "GET",
      url: "/api/v1/education/finance/transactions",
      headers: { host: "ums.stjude.test" },
    });
    expect(finRes.statusCode).toBe(200);
    expect(finRes.json().data).toHaveLength(1);
    expect(finRes.json().data[0].amountMinor).toBe(5000);

    // 4. Public credential verification confirms the provisioned student
    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/public/education/verify?code=${encodeURIComponent(regNo)}`,
      headers: { host: "portal.stjude.test" },
    });
    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.json()).toMatchObject({
      valid: true,
      data: {
        reg_no: regNo,
        student_name: "Ada Okafor",
      },
    });

    // 5. Student self-service portal profile returns student + finance record
    const profileRes = await app.inject({
      method: "GET",
      url: "/api/v1/education/student/profile",
      headers: { host: "portal.stjude.test" },
    });
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.json().data.student.id).toBe(studentId);
    expect(profileRes.json().data.financeTransactions).toHaveLength(1);

    await app.close();
  });

  it("persists courses, sections, enrollments, grades, appeals, staff, study centers, and library items", async () => {
    const store = createInMemoryEducationStore();
    mocks.withTenantTransaction.mockImplementation(async (_tenantId: string, cb: (tx: unknown) => Promise<unknown>) =>
      cb(store.makeTx()),
    );

    const app = Fastify();
    await app.register(educationDataRoutes, {
      config: { NODE_ENV: "test" } as never,
    });

    // Course + Section + Enrollment
    const courseRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/courses",
      payload: { code: "THEO101", title: "Systematic Theology I", credits: 3 },
    });
    expect(courseRes.statusCode).toBe(201);
    const courseId = courseRes.json().data.id as string;

    const sectionRes = await app.inject({
      method: "POST",
      url: `/api/v1/education/courses/${courseId}/sections`,
      payload: { sectionCode: "SEC-A", instructor: "Dr. Mensah", capacity: 30 },
    });
    expect(sectionRes.statusCode).toBe(201);
    const sectionId = sectionRes.json().data.id as string;

    const studentUuid = "44444444-4444-4444-8444-444444444444";
    const enrollRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/enrollments",
      payload: { studentId: studentUuid, courseId, sectionId, agreementSigned: true },
    });
    expect(enrollRes.statusCode).toBe(201);

    // Grade + Appeal -> approved revisedGrade updates grade
    const gradeRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/grades",
      payload: { studentId: studentUuid, courseId, numericGrade: 78 },
    });
    expect(gradeRes.statusCode).toBe(201);
    expect(gradeRes.json().data.letterGrade).toBe("C");
    const gradeId = gradeRes.json().data.id as string;

    const appealRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/grade-appeals",
      payload: { gradeId, studentId: studentUuid, reason: "Exam question regrade" },
    });
    expect(appealRes.statusCode).toBe(201);
    const appealId = appealRes.json().data.id as string;

    const approveAppealRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/education/grade-appeals/${appealId}`,
      payload: { status: "approved", revisedGrade: 92, reviewerNotes: "Recalculated" },
    });
    expect(approveAppealRes.statusCode).toBe(200);
    expect(store.tables.get(educationGrades)?.[0]?.letterGrade).toBe("A");

    // Staff, Study Center, Library
    const staffRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/staff",
      payload: { firstName: "Grace", lastName: "Mwangi", email: "g.mwangi@stjude.edu" },
    });
    expect(staffRes.statusCode).toBe(201);

    const centerRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/study-centers",
      payload: { code: "NBO", name: "Nairobi Campus", city: "Nairobi", country: "Kenya" },
    });
    expect(centerRes.statusCode).toBe(201);

    const libraryRes = await app.inject({
      method: "POST",
      url: "/api/v1/education/library",
      payload: { title: "Biblical Hermeneutics", author: "Gordon Fee", copiesTotal: 5 },
    });
    expect(libraryRes.statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: "/api/v1/education/library" })).json().data).toHaveLength(1);

    await app.close();
  });
});

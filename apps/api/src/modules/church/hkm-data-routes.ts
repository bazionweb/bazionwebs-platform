import { fromNodeHeaders } from "better-auth/node";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { auth, isVerifiedTenantHost } from "@bazion/auth/server";
import { getActiveTenantContext, getCurrentIdentity, requireActiveTenantPermission } from "@bazion/auth";
import {
  churchContactMessages,
  churchInventoryAssetEvents,
  churchInventoryAssets,
  hkmSmsLogs,
  hkmVisitorFollowUps,
  hkmVisitors,
  hkmAttendanceRecords,
  hkmBranches,
  hkmGivingTransactions,
  hkmMemberAttendanceRecords,
  hkmMembers,
  tenants,
} from "@bazion/database";
import { defaultHkmTenantConfig } from "@bazion/church-management/config";
import type { AppConfig } from "../../config.js";
import { withTenantTransaction } from "../../lib/database.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { assertTenantNotInMaintenance } from "../../lib/tenant-maintenance.js";

const branchInput = z.object({
  name: z.string().trim().min(2).max(160), location: z.string().trim().max(240).optional(),
  pastorName: z.string().trim().max(160).optional(), contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().email().max(254).optional(), status: z.enum(["active", "inactive"]).optional(),
});
const memberInput = z.object({
  membershipNumber: z.string().trim().min(2).max(48).optional(), membership_number: z.string().trim().min(2).max(48).optional(),
  firstName: z.string().trim().min(1).max(100).optional(), first_name: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(), last_name: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().max(80).optional(), department: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254).optional(), phone: z.string().trim().max(40).optional(), branchId: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(), status: z.enum(["active", "inactive", "transferred", "pending_fee", "Active", "Inactive", "Transferred", "Pending Fee"]).optional(),
  role: z.string().trim().max(80).optional(), gender: z.string().trim().max(24).optional(), avatar: z.string().trim().max(2000).nullable().optional(),
  avatarTransform: z.object({ scale: z.number(), positionX: z.number(), positionY: z.number() }).nullable().optional(),
  avatar_transform: z.object({ scale: z.number(), positionX: z.number(), positionY: z.number() }).nullable().optional(),
  address: z.string().trim().max(1000).nullable().optional(), occupation: z.string().trim().max(160).nullable().optional(),
  maritalStatus: z.string().trim().max(24).nullable().optional(), marital_status: z.string().trim().max(24).nullable().optional(),
  joinedAt: z.string().date().nullable().optional(), joined_at: z.string().date().nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(), date_of_birth: z.string().date().nullable().optional(),
  baptismDate: z.string().date().nullable().optional(), baptism_date: z.string().date().nullable().optional(),
}).passthrough();
const attendanceInput = z.object({
  branchId: z.string().uuid().optional(), branch_id: z.string().uuid().optional(), serviceDate: z.string().date().optional(), service_date: z.string().date().optional(), date: z.string().date().optional(),
  serviceType: z.string().trim().min(2).max(120).optional(), service_type: z.string().trim().min(2).max(120).optional(), service: z.string().trim().min(2).max(120).optional(),
  countMen: z.coerce.number().int().min(0).optional(), count_men: z.coerce.number().int().min(0).optional(),
  countWomen: z.coerce.number().int().min(0).optional(), count_women: z.coerce.number().int().min(0).optional(),
  countChildren: z.coerce.number().int().min(0).optional(), count_children: z.coerce.number().int().min(0).optional(),
}).passthrough();
const memberAttendanceBatchInput = z.object({
  serviceDate: z.string().date(), serviceType: z.string().trim().min(2).max(120),
  records: z.array(z.object({ memberId: z.string().uuid(), status: z.enum(["Present", "Absent", "Late"]) })).max(5000),
}).strict();
const givingInput = z.object({
  memberId: z.string().uuid().nullable().optional(),
  member_id: z.string().uuid().nullable().optional(),
  branchId: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  amount: z.coerce.number().positive().max(10_000_000),
  givingType: z.string().trim().min(2).max(48).optional(),
  transactionType: z.string().trim().min(2).max(48).optional(),
  category: z.string().trim().min(2).max(48).optional(),
  transactionKind: z.enum(["income", "expense", "Income", "Expense"]).optional(),
  type: z.enum(["income", "expense", "Income", "Expense"]).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  nonMemberName: z.string().trim().max(160).nullable().optional(),
  non_member_name: z.string().trim().max(160).nullable().optional(),
  isAnonymous: z.boolean().optional(),
  is_anonymous: z.boolean().optional(),
  transactionDate: z.string().trim().min(4).max(64).optional(),
  transactionDateLegacy: z.string().trim().min(4).max(64).optional(),
  date: z.string().trim().min(4).max(64).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  receiptNumber: z.string().trim().max(80).optional(),
  paymentStatus: z.enum(["pending", "verified", "failed"]).optional(),
}).passthrough();
const assetInput = z.object({
  name: z.string().trim().min(2).max(160), assetTag: z.string().trim().min(2).max(60).optional(), category: z.string().trim().min(2).max(80),
  location: z.string().trim().max(180).optional(), condition: z.enum(["excellent", "good", "fair", "needs_repair", "retired", "Excellent", "Good", "Fair", "Needs Repair", "Retired"]).optional(),
  status: z.enum(["available", "in_use", "maintenance", "reserved", "retired", "Good", "In Use", "Maintenance", "Reserved", "Retired"]).optional(),
  serialNumber: z.string().trim().max(100).optional(), serial_number: z.string().trim().max(100).optional(), description: z.string().max(4000).optional(), notes: z.string().max(4000).optional(),
  purchaseValueMinor: z.coerce.number().int().min(0).optional(), purchase_price: z.coerce.number().min(0).optional(), acquiredOn: z.string().date().optional(), purchase_date: z.string().date().optional(),
}).passthrough();

function fail(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

function statusToDb(status?: string) {
  const value = status?.toLowerCase().replaceAll(" ", "_");
  return value === "transferred" ? "transferred" : value === "inactive" ? "inactive" : value === "pending_fee" ? "pending_fee" : "active";
}

function memberDto(row: typeof hkmMembers.$inferSelect, branchName = "") {
  return {
    id: row.id, membershipNumber: row.membershipNumber, membership_number: row.membershipNumber,
    firstName: row.firstName, first_name: row.firstName, lastName: row.lastName, last_name: row.lastName,
    title: row.title, department: row.department, gender: row.gender, avatar: row.avatarUrl,
    avatarTransform: row.avatarTransform, address: row.address, occupation: row.occupation, maritalStatus: row.maritalStatus,
    joinedAt: row.joinedAt, joined_at: row.joinedAt,
    phone: row.phone, email: row.email, branchId: row.branchId, branch_id: row.branchId, branchName,
    status: row.status === "active" ? "Active" : row.status === "transferred" ? "Transferred" : row.status === "pending_fee" ? "Pending Fee" : "Inactive", role: row.role,
    dateOfBirth: row.dateOfBirth, baptismDate: row.baptismDate, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function attendanceDto(row: typeof hkmAttendanceRecords.$inferSelect) {
  const totalAttendance = row.countMen + row.countWomen + row.countChildren;
  return {
    id: row.id, serviceDate: row.serviceDate, service_date: row.serviceDate, date: row.serviceDate,
    serviceType: row.serviceType, service_type: row.serviceType, service: row.serviceType,
    countMen: row.countMen, count_men: row.countMen, countWomen: row.countWomen, count_women: row.countWomen,
    countChildren: row.countChildren, count_children: row.countChildren, totalAttendance,
    branchId: row.branchId, branch_id: row.branchId,
  };
}

export async function hkmDataRoutes(app: FastifyInstance, options: { config: AppConfig }): Promise<void> {
  async function tenantFor(request: FastifyRequest): Promise<string> {
    const tenantId = await resolveRequestTenantId(request, options.config);
    if (options.config.NODE_ENV === "production" && !(await isVerifiedTenantHost(request.hostname))) {
      throw fail("A verified domain is required for church operations.", 404, "HKM_HOST_NOT_VERIFIED");
    }
    if (!(await isTenantModuleEnabled(tenantId, "church-ministry"))) throw fail("Church management is not enabled for this tenant.", 404, "CHURCH_MODULE_DISABLED");
    await assertTenantNotInMaintenance(tenantId);
    return tenantId;
  }

  async function adminContext(request: FastifyRequest, permission: "read" | "update") {
    const tenantId = await tenantFor(request);
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: [permission] });
    if (context.tenantId !== tenantId) throw fail("Your active organization does not match HKM Ministries.", 403, "HKM_TENANT_MISMATCH");
    return { tenantId, context };
  }

  async function portalMember(request: FastifyRequest) {
    const tenantId = await tenantFor(request);
    const identity = await getCurrentIdentity(request.headers);
    const active = await getActiveTenantContext(request.headers);
    if (!identity || !active || active.tenantId !== tenantId || identity.tenant?.status !== "active") {
      throw fail("Sign in to the HKM member portal to continue.", 401, "UNAUTHENTICATED");
    }
    const [member] = await withTenantTransaction(tenantId, (tx) => tx.select().from(hkmMembers).where(and(
      eq(hkmMembers.tenantId, tenantId), eq(hkmMembers.email, identity.user.email.toLowerCase()), eq(hkmMembers.status, "active"),
    )).limit(1));
    if (!member) throw fail("This account is not linked to an active HKM member record.", 403, "HKM_MEMBER_LINK_REQUIRED");
    return { tenantId, member };
  }

  app.get("/api/church/hkm/config", async (request, reply) => {
    const tenantId = await tenantFor(request);
    return reply.send({ success: true, tenantId, config: defaultHkmTenantConfig });
  });

  const activateAdminSession = async (request: FastifyRequest, reply: import("fastify").FastifyReply) => {
    const tenantId = await tenantFor(request);
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    const [tenant] = await withTenantTransaction(tenantId, (tx) => tx.select({ authOrganizationId: tenants.authOrganizationId })
      .from(tenants).where(eq(tenants.id, tenantId)).limit(1));
    if (!tenant?.authOrganizationId) throw fail("The HKM workspace is not linked to the identity service.", 503, "HKM_WORKSPACE_NOT_LINKED");
    if (identity.organization?.id !== tenant.authOrganizationId) {
      await auth.api.setActiveOrganization({ headers: fromNodeHeaders(request.headers), body: { organizationId: tenant.authOrganizationId } });
    }
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    if (context.tenantId !== tenantId || !context.roles.some((role) => role === "owner" || role === "admin")) {
      throw fail("HKM management access is restricted to tenant administrators.", 403, "HKM_ADMIN_REQUIRED");
    }
    const activeIdentity = await getCurrentIdentity(request.headers);
    reply.header("cache-control", "no-store");
    return reply.send({ success: true, identity: activeIdentity });
  };
  app.get("/api/church/hkm/admin/session/activate", activateAdminSession);
  app.post("/api/church/hkm/admin/session/activate", activateAdminSession);

  app.get("/api/church/hkm/members", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const query = request.query as { search?: string; status?: string; page?: string; perPage?: string };
    const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
    const perPage = Math.max(1, Math.min(250, Number.parseInt(query.perPage ?? "100", 10) || 100));
    const filters = [eq(hkmMembers.tenantId, tenantId)];
    if (query.status && query.status.toLowerCase() !== "all") filters.push(eq(hkmMembers.status, statusToDb(query.status)));
    if (query.search?.trim()) {
      const search = `%${query.search.trim().slice(0, 100)}%`;
      filters.push(sql`(${hkmMembers.firstName} ILIKE ${search} OR ${hkmMembers.lastName} ILIKE ${search} OR ${hkmMembers.membershipNumber} ILIKE ${search} OR ${hkmMembers.email} ILIKE ${search})`);
    }
    const rows = await withTenantTransaction(tenantId, (tx) => tx.select({ member: hkmMembers, branchName: hkmBranches.name }).from(hkmMembers)
      .leftJoin(hkmBranches, and(eq(hkmBranches.id, hkmMembers.branchId), eq(hkmBranches.tenantId, tenantId)))
      .where(and(...filters)).orderBy(asc(hkmMembers.lastName), asc(hkmMembers.firstName)).limit(perPage).offset((page - 1) * perPage));
    const [total] = await withTenantTransaction(tenantId, (tx) => tx.select({ total: count() }).from(hkmMembers).where(and(...filters)));
    return reply.send({ success: true, data: { items: rows.map(({ member, branchName }) => memberDto(member, branchName ?? "")), total: total?.total ?? 0, page, perPage } });
  });

  app.post("/api/church/hkm/members", async (request, reply) => {
    const parsed = memberInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    const input = parsed.data;
    const membershipNumber = input.membershipNumber ?? input.membership_number ?? `HKM-${randomUUID().slice(0, 8).toUpperCase()}`;
    const firstName = input.firstName ?? input.first_name;
    const lastName = input.lastName ?? input.last_name;
    let branchId = input.branchId ?? input.branch_id;
    if (!firstName || !lastName || !input.email) return reply.code(400).send({ success: false, error: "MEMBER_FIELDS_REQUIRED" });
    try {
      const [row] = await withTenantTransaction(tenantId, async (tx) => {
        if (!branchId) {
          const [defaultBranch] = await tx.select({ id: hkmBranches.id }).from(hkmBranches)
            .where(and(eq(hkmBranches.tenantId, tenantId), eq(hkmBranches.status, "active"))).orderBy(asc(hkmBranches.name)).limit(1);
          branchId = defaultBranch?.id;
        }
        if (!branchId) throw fail("Create an active branch before adding members.", 409, "HKM_ACTIVE_BRANCH_REQUIRED");
        const [branch] = await tx.select({ id: hkmBranches.id }).from(hkmBranches).where(and(eq(hkmBranches.id, branchId), eq(hkmBranches.tenantId, tenantId))).limit(1);
        if (!branch) throw fail("Branch not found for this tenant.", 400, "HKM_BRANCH_NOT_FOUND");
        return tx.insert(hkmMembers).values({
          tenantId, branchId, membershipNumber, firstName, lastName, title: input.title ?? "", email: input.email!.toLowerCase(), phone: input.phone ?? "",
          department: input.department ?? "", gender: input.gender ?? "Male", avatarUrl: input.avatar ?? null,
          avatarTransform: input.avatarTransform ?? input.avatar_transform ?? null, address: input.address ?? null, occupation: input.occupation ?? null,
          maritalStatus: input.maritalStatus ?? input.marital_status ?? null, joinedAt: input.joinedAt ?? input.joined_at ?? null,
          status: statusToDb(input.status), role: input.role ?? "Member", dateOfBirth: input.dateOfBirth ?? input.date_of_birth ?? null,
          baptismDate: input.baptismDate ?? input.baptism_date ?? null,
        }).returning();
      });
      return reply.code(201).send({ success: true, member: row ? memberDto(row) : null });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "MEMBER_IDENTITY_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/church/hkm/members/:id", async (request, reply) => {
    const parsed = memberInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    const input = parsed.data;
    const [row] = await withTenantTransaction(tenantId, (tx) => tx.update(hkmMembers).set({
      ...((input.membershipNumber ?? input.membership_number) !== undefined ? { membershipNumber: input.membershipNumber ?? input.membership_number } : {}),
      ...((input.firstName ?? input.first_name) !== undefined ? { firstName: input.firstName ?? input.first_name } : {}),
      ...((input.lastName ?? input.last_name) !== undefined ? { lastName: input.lastName ?? input.last_name } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}), ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}), ...(input.avatar !== undefined ? { avatarUrl: input.avatar } : {}),
      ...((input.avatarTransform !== undefined ? input.avatarTransform : input.avatar_transform) !== undefined ? { avatarTransform: input.avatarTransform !== undefined ? input.avatarTransform : input.avatar_transform } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}), ...(input.occupation !== undefined ? { occupation: input.occupation } : {}),
      ...((input.maritalStatus !== undefined ? input.maritalStatus : input.marital_status) !== undefined ? { maritalStatus: input.maritalStatus !== undefined ? input.maritalStatus : input.marital_status } : {}),
      ...((input.joinedAt !== undefined ? input.joinedAt : input.joined_at) !== undefined ? { joinedAt: input.joinedAt !== undefined ? input.joinedAt : input.joined_at } : {}),
      ...((input.branchId ?? input.branch_id) !== undefined ? { branchId: input.branchId ?? input.branch_id } : {}),
      ...(input.status !== undefined ? { status: statusToDb(input.status) } : {}), ...(input.role !== undefined ? { role: input.role } : {}),
      ...((input.dateOfBirth ?? input.date_of_birth) !== undefined ? { dateOfBirth: input.dateOfBirth ?? input.date_of_birth } : {}),
      ...((input.baptismDate ?? input.baptism_date) !== undefined ? { baptismDate: input.baptismDate ?? input.baptism_date } : {}), updatedAt: new Date(),
    }).where(and(eq(hkmMembers.id, request.params.id), eq(hkmMembers.tenantId, tenantId))).returning());
    return row ? reply.send({ success: true, member: memberDto(row) }) : reply.code(404).send({ success: false, error: "MEMBER_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/members/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [row] = await withTenantTransaction(tenantId, (tx) => tx.update(hkmMembers).set({ status: "inactive", updatedAt: new Date() }).where(and(
      eq(hkmMembers.id, request.params.id), eq(hkmMembers.tenantId, tenantId),
    )).returning({ id: hkmMembers.id }));
    return row ? reply.send({ success: true, data: { deactivated: true } }) : reply.code(404).send({ success: false, error: "MEMBER_NOT_FOUND" });
  });

  app.get("/api/church/hkm/branches", async (_request, reply) => {
    const { tenantId } = await adminContext(_request, "read");
    const rows = await withTenantTransaction(tenantId, (tx) => tx.select().from(hkmBranches).where(eq(hkmBranches.tenantId, tenantId)).orderBy(asc(hkmBranches.name)));
    return reply.send({ success: true, data: rows.map((row) => ({ id: row.id, name: row.name, location: row.location, pastorName: row.pastorName, contactPhone: row.contactPhone, contactEmail: row.contactEmail, status: row.status, is_active: row.status === "active" })) });
  });

  app.post("/api/church/hkm/branches", async (request, reply) => {
    const parsed = branchInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    try {
      const [row] = await withTenantTransaction(tenantId, (tx) => tx.insert(hkmBranches).values({ tenantId, ...parsed.data }).returning());
      return reply.code(201).send({ success: true, data: row });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "BRANCH_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/church/hkm/branches/:id", async (request, reply) => {
    const parsed = branchInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    const [row] = await withTenantTransaction(tenantId, (tx) => tx.update(hkmBranches).set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.location !== undefined ? { location: parsed.data.location } : {}),
      ...(parsed.data.pastorName !== undefined ? { pastorName: parsed.data.pastorName } : {}),
      ...(parsed.data.contactPhone !== undefined ? { contactPhone: parsed.data.contactPhone } : {}),
      ...(parsed.data.contactEmail !== undefined ? { contactEmail: parsed.data.contactEmail } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}), updatedAt: new Date(),
    }).where(and(eq(hkmBranches.id, request.params.id), eq(hkmBranches.tenantId, tenantId))).returning());
    return row ? reply.send({ success: true, data: row }) : reply.code(404).send({ success: false, error: "BRANCH_NOT_FOUND" });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/branches/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [row] = await withTenantTransaction(tenantId, (tx) => tx.update(hkmBranches).set({ status: "inactive", updatedAt: new Date() })
      .where(and(eq(hkmBranches.id, request.params.id), eq(hkmBranches.tenantId, tenantId))).returning({ id: hkmBranches.id }));
    return row ? reply.send({ success: true, data: { deactivated: true } }) : reply.code(404).send({ success: false, error: "BRANCH_NOT_FOUND" });
  });

  app.get("/api/church/hkm/attendance", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const rows = await withTenantTransaction(tenantId, (tx) => tx.select().from(hkmAttendanceRecords).where(eq(hkmAttendanceRecords.tenantId, tenantId)).orderBy(desc(hkmAttendanceRecords.serviceDate)).limit(500));
    return reply.send({ success: true, data: rows.map(attendanceDto) });
  });

  app.post("/api/church/hkm/attendance", async (request, reply) => {
    const parsed = attendanceInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, context } = await adminContext(request, "update");
    const input = parsed.data;
    const branchId = input.branchId ?? input.branch_id;
    const serviceDate = input.serviceDate ?? input.service_date ?? input.date;
    const serviceType = input.serviceType ?? input.service_type ?? input.service;
    if (!branchId || !serviceDate || !serviceType) return reply.code(400).send({ success: false, error: "ATTENDANCE_FIELDS_REQUIRED" });
    const [row] = await withTenantTransaction(tenantId, (tx) => tx.insert(hkmAttendanceRecords).values({
      tenantId, branchId, serviceDate, serviceType, countMen: input.countMen ?? input.count_men ?? 0,
      countWomen: input.countWomen ?? input.count_women ?? 0, countChildren: input.countChildren ?? input.count_children ?? 0, recordedBy: context.userId,
    }).returning());
    return reply.code(201).send({ success: true, data: row ? attendanceDto(row) : null });
  });

  app.get("/api/church/hkm/member-attendance", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const rows = await withTenantTransaction(tenantId, (tx) => tx.select({ attendance: hkmMemberAttendanceRecords, member: hkmMembers })
      .from(hkmMemberAttendanceRecords)
      .innerJoin(hkmMembers, and(eq(hkmMembers.id, hkmMemberAttendanceRecords.memberId), eq(hkmMembers.tenantId, tenantId)))
      .where(eq(hkmMemberAttendanceRecords.tenantId, tenantId))
      .orderBy(desc(hkmMemberAttendanceRecords.serviceDate), asc(hkmMembers.lastName), asc(hkmMembers.firstName)).limit(1000));
    return reply.send({ success: true, data: rows.map(({ attendance, member }) => ({
      id: attendance.id, date: attendance.serviceDate, service: attendance.serviceType,
      memberId: member.id, memberName: `${member.firstName} ${member.lastName}`.trim(), status: attendance.status,
      branchId: attendance.branchId,
    })) });
  });

  app.post("/api/church/hkm/member-attendance/batch", async (request, reply) => {
    const parsed = memberAttendanceBatchInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId, context } = await adminContext(request, "update");
    const input = parsed.data;
    const uniqueRecords = [...new Map(input.records.map((record) => [record.memberId, record])).values()];
    const saved = await withTenantTransaction(tenantId, async (tx) => {
      const [existing] = await tx.select({ id: hkmMemberAttendanceRecords.id }).from(hkmMemberAttendanceRecords).where(and(
        eq(hkmMemberAttendanceRecords.tenantId, tenantId), eq(hkmMemberAttendanceRecords.serviceDate, input.serviceDate),
        eq(hkmMemberAttendanceRecords.serviceType, input.serviceType),
      )).limit(1);
      const memberIds = uniqueRecords.map((record) => record.memberId);
      const members = memberIds.length ? await tx.select({ id: hkmMembers.id, branchId: hkmMembers.branchId }).from(hkmMembers).where(and(
        eq(hkmMembers.tenantId, tenantId), eq(hkmMembers.status, "active"), inArray(hkmMembers.id, memberIds),
      )) : [];
      const memberById = new Map(members.map((member) => [member.id, member]));
      const values = uniqueRecords.flatMap((record) => {
        const member = memberById.get(record.memberId);
        return member ? [{ tenantId, memberId: member.id, branchId: member.branchId, serviceDate: input.serviceDate,
          serviceType: input.serviceType, status: record.status, recordedBy: context.userId, updatedAt: new Date() }] : [];
      });
      if (existing) {
        await tx.delete(hkmMemberAttendanceRecords).where(and(
          eq(hkmMemberAttendanceRecords.tenantId, tenantId), eq(hkmMemberAttendanceRecords.serviceDate, input.serviceDate),
          eq(hkmMemberAttendanceRecords.serviceType, input.serviceType),
        ));
      }
      return values.length ? tx.insert(hkmMemberAttendanceRecords).values(values).returning({ id: hkmMemberAttendanceRecords.id }) : [];
    });
    return reply.send({ success: true, data: { saved: saved.length } });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/member-attendance/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) => tx.delete(hkmMemberAttendanceRecords).where(and(
      eq(hkmMemberAttendanceRecords.id, request.params.id), eq(hkmMemberAttendanceRecords.tenantId, tenantId),
    )).returning({ id: hkmMemberAttendanceRecords.id }));
    return deleted ? reply.send({ success: true, data: { deleted: true } }) : reply.code(404).send({ success: false, error: "ATTENDANCE_RECORD_NOT_FOUND" });
  });

  function parseDateOrNow(raw?: string | null): Date {
    if (!raw) return new Date();
    const parsedDate = new Date(raw.length === 10 ? `${raw}T12:00:00.000Z` : raw);
    if (Number.isNaN(parsedDate.getTime())) throw fail("Invalid transaction date.", 400, "INVALID_DATE");
    return parsedDate;
  }

  function formatMaintenanceDescription(type: string, cost: number, status: string, description: string): string {
    const cleanDesc = description.trim();
    return `[${type}|${cost}|${status}] ${cleanDesc}`.trim();
  }

  function parseMaintenanceEvent(event: typeof churchInventoryAssetEvents.$inferSelect) {
    const match = event.description.match(/^\[([^|\]]+)\|([^|\]]+)\|([^|\]]+)\]\s*(.*)$/);
    const costValue = match ? Number.parseFloat(match[2] ?? "0") : 0;
    return {
      id: event.id,
      equipmentId: event.assetId,
      date: event.occurredAt.toISOString().split("T")[0] ?? "",
      type: match?.[1] ?? "Inspection",
      cost: Number.isFinite(costValue) ? costValue : 0,
      status: match?.[3] ?? "Completed",
      description: match?.[4] ?? event.description,
      recordedBy: event.recordedBy,
    };
  }

  function transactionDto(giving: typeof hkmGivingTransactions.$inferSelect, member: typeof hkmMembers.$inferSelect | null) {
    const contributorName = giving.isAnonymous
      ? "Anonymous"
      : member
        ? `${member.firstName} ${member.lastName}`.trim()
        : (giving.nonMemberName ?? undefined);
    return {
      id: giving.id,
      date: giving.transactionDate.toISOString().split("T")[0],
      category: giving.givingType,
      type: giving.transactionKind === "expense" ? "Expense" : "Income",
      transactionKind: giving.transactionKind === "expense" ? "Expense" : "Income",
      amount: giving.amountMinor / 100,
      description: giving.description ?? "",
      memberId: giving.memberId ?? undefined,
      member_id: giving.memberId ?? undefined,
      memberName: contributorName ?? "Anonymous",
      memberPhone: member?.phone ?? undefined,
      nonMemberName: giving.nonMemberName ?? undefined,
      isAnonymous: giving.isAnonymous,
      transactionType: giving.givingType,
      givingType: giving.givingType,
      transactionDate: giving.transactionDate.toISOString(),
      paymentMethod: giving.paymentMethod,
      receiptNumber: giving.receiptNumber,
      branchId: giving.branchId,
      paymentStatus: giving.paymentStatus,
    };
  }

  app.get("/api/church/hkm/transactions", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const rows = await withTenantTransaction(tenantId, (tx) =>
      tx
        .select({ giving: hkmGivingTransactions, member: hkmMembers })
        .from(hkmGivingTransactions)
        .leftJoin(hkmMembers, and(eq(hkmMembers.id, hkmGivingTransactions.memberId), eq(hkmMembers.tenantId, tenantId)))
        .where(eq(hkmGivingTransactions.tenantId, tenantId))
        .orderBy(desc(hkmGivingTransactions.transactionDate))
        .limit(500),
    );
    return reply.send({ success: true, data: rows.map(({ giving, member }) => transactionDto(giving, member)) });
  });

  app.post("/api/church/hkm/transactions", async (request, reply) => {
    const parsed = givingInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    const input = parsed.data;
    const memberId = input.memberId ?? input.member_id ?? null;
    const explicitBranchId = input.branchId ?? input.branch_id ?? null;
    const transactionKindRaw = (input.transactionKind ?? input.type ?? "income").toLowerCase();
    const transactionKind = transactionKindRaw === "expense" ? "expense" : "income";
    const isAnonymous = Boolean(input.isAnonymous ?? input.is_anonymous ?? false);
    const nonMemberName = (input.nonMemberName ?? input.non_member_name ?? null)?.trim() || null;
    const txDate = parseDateOrNow(input.transactionDate ?? input.transactionDateLegacy ?? input.date);
    const receiptNumber = input.receiptNumber?.trim() || `HKM-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      const [row] = await withTenantTransaction(tenantId, async (tx) => {
        let resolvedBranchId = explicitBranchId;
        if (memberId) {
          const [member] = await tx.select().from(hkmMembers).where(and(eq(hkmMembers.id, memberId), eq(hkmMembers.tenantId, tenantId))).limit(1);
          if (!member) throw fail("Selected member was not found.", 400, "HKM_MEMBER_NOT_FOUND");
          if (resolvedBranchId && member.branchId !== resolvedBranchId) {
            throw fail("An active member in the selected branch is required.", 400, "HKM_MEMBER_NOT_FOUND");
          }
          resolvedBranchId = resolvedBranchId ?? member.branchId;
        } else if (!resolvedBranchId) {
          const [defaultBranch] = await tx
            .select({ id: hkmBranches.id })
            .from(hkmBranches)
            .where(and(eq(hkmBranches.tenantId, tenantId), eq(hkmBranches.status, "active")))
            .orderBy(asc(hkmBranches.createdAt))
            .limit(1);
          resolvedBranchId = defaultBranch?.id ?? null;
        }

        if (!resolvedBranchId) throw fail("Create an active church branch before recording transactions.", 400, "BRANCH_REQUIRED");

        return tx.insert(hkmGivingTransactions).values({
          tenantId,
          memberId,
          branchId: resolvedBranchId,
          amountMinor: Math.round(input.amount * 100),
          givingType: input.givingType ?? input.transactionType ?? input.category ?? "Offering",
          transactionKind,
          description: input.description ?? null,
          nonMemberName,
          isAnonymous,
          transactionDate: txDate,
          paymentMethod: input.paymentMethod ?? "manual",
          receiptNumber,
          paymentStatus: input.paymentStatus ?? "verified",
        }).returning();
      });
      return reply.code(201).send({ success: true, transaction: row });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "RECEIPT_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/church/hkm/transactions/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const patchSchema = givingInput.partial();
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const input = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.amount !== undefined) patch.amountMinor = Math.round(input.amount * 100);
    if (input.givingType !== undefined || input.transactionType !== undefined || input.category !== undefined) {
      patch.givingType = input.givingType ?? input.transactionType ?? input.category;
    }
    if (input.transactionKind !== undefined || input.type !== undefined) {
      patch.transactionKind = (input.transactionKind ?? input.type)!.toLowerCase() === "expense" ? "expense" : "income";
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.memberId !== undefined || input.member_id !== undefined) patch.memberId = input.memberId ?? input.member_id ?? null;
    if (input.nonMemberName !== undefined || input.non_member_name !== undefined) {
      patch.nonMemberName = (input.nonMemberName ?? input.non_member_name ?? null)?.trim() || null;
    }
    if (input.isAnonymous !== undefined || input.is_anonymous !== undefined) {
      patch.isAnonymous = Boolean(input.isAnonymous ?? input.is_anonymous);
    }
    if (input.transactionDate !== undefined || input.transactionDateLegacy !== undefined || input.date !== undefined) {
      patch.transactionDate = parseDateOrNow(input.transactionDate ?? input.transactionDateLegacy ?? input.date);
    }
    if (input.paymentStatus !== undefined) patch.paymentStatus = input.paymentStatus;

    const [updated] = await withTenantTransaction(tenantId, (tx) =>
      tx.update(hkmGivingTransactions).set(patch).where(and(eq(hkmGivingTransactions.tenantId, tenantId), eq(hkmGivingTransactions.id, request.params.id))).returning(),
    );
    if (!updated) return reply.code(404).send({ success: false, error: "TRANSACTION_NOT_FOUND" });
    return reply.send({ success: true, transaction: updated });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/transactions/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) =>
      tx.delete(hkmGivingTransactions).where(and(eq(hkmGivingTransactions.tenantId, tenantId), eq(hkmGivingTransactions.id, request.params.id))).returning({ id: hkmGivingTransactions.id }),
    );
    if (!deleted) return reply.code(404).send({ success: false, error: "TRANSACTION_NOT_FOUND" });
    return reply.send({ success: true });
  });

  app.get("/api/church/hkm/equipment", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const { assets, events } = await withTenantTransaction(tenantId, async (tx) => {
      const [assetRows, eventRows] = await Promise.all([
        tx.select().from(churchInventoryAssets).where(eq(churchInventoryAssets.tenantId, tenantId)).orderBy(asc(churchInventoryAssets.name)),
        tx.select().from(churchInventoryAssetEvents).where(and(eq(churchInventoryAssetEvents.tenantId, tenantId), eq(churchInventoryAssetEvents.eventType, "maintenance"))).orderBy(desc(churchInventoryAssetEvents.occurredAt)),
      ]);
      return { assets: assetRows, events: eventRows };
    });
    const maintenanceByAsset = new Map<string, ReturnType<typeof parseMaintenanceEvent>[]>();
    for (const event of events) {
      const list = maintenanceByAsset.get(event.assetId) ?? [];
      list.push(parseMaintenanceEvent(event));
      maintenanceByAsset.set(event.assetId, list);
    }
    return reply.send({ success: true, data: assets.map((asset) => ({
      id: asset.id, name: asset.name, category: asset.category, location: asset.location,
      status: asset.status, condition: asset.condition, serialNumber: asset.assetTag, serial_number: asset.assetTag,
      purchase_price: asset.purchaseValueMinor === null ? null : asset.purchaseValueMinor / 100,
      purchase_date: asset.acquiredOn, description: asset.notes ?? "", assetTag: asset.assetTag,
      maintenanceRecords: maintenanceByAsset.get(asset.id) ?? [],
    })) });
  });

  app.post("/api/church/hkm/equipment", async (request, reply) => {
    const parsed = assetInput.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    const input = parsed.data;
    const assetTag = input.assetTag ?? input.serialNumber ?? input.serial_number ?? `HKM-ASSET-${Date.now()}`;
    try {
      const [asset] = await withTenantTransaction(tenantId, (tx) => tx.insert(churchInventoryAssets).values({
        tenantId, name: input.name, assetTag, category: input.category, location: input.location ?? "Main Campus",
        condition: (input.condition ?? "good").toLowerCase().replaceAll(" ", "_"),
        status: (input.status ?? "available").toLowerCase().replaceAll(" ", "_"),
        notes: input.notes ?? input.description ?? null,
        purchaseValueMinor: input.purchaseValueMinor ?? (input.purchase_price === undefined ? null : Math.round(input.purchase_price * 100)),
        acquiredOn: input.acquiredOn ?? input.purchase_date ?? null,
      }).returning());
      return reply.code(201).send({ success: true, data: asset });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") return reply.code(409).send({ success: false, error: "ASSET_TAG_ALREADY_EXISTS" });
      throw error;
    }
  });

  app.patch<{ Params: { id: string } }>("/api/church/hkm/equipment/:id", async (request, reply) => {
    const parsed = assetInput.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const { tenantId } = await adminContext(request, "update");
    const input = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.category !== undefined) patch.category = input.category;
    if (input.location !== undefined) patch.location = input.location;
    if (input.condition !== undefined) patch.condition = input.condition.toLowerCase().replaceAll(" ", "_");
    if (input.status !== undefined) patch.status = input.status.toLowerCase().replaceAll(" ", "_");
    if (input.notes !== undefined || input.description !== undefined) patch.notes = input.notes ?? input.description ?? null;
    if (input.purchaseValueMinor !== undefined || input.purchase_price !== undefined) {
      patch.purchaseValueMinor = input.purchaseValueMinor ?? (input.purchase_price === undefined ? null : Math.round(input.purchase_price * 100));
    }
    if (input.acquiredOn !== undefined || input.purchase_date !== undefined) patch.acquiredOn = input.acquiredOn ?? input.purchase_date ?? null;

    const [updated] = await withTenantTransaction(tenantId, (tx) =>
      tx.update(churchInventoryAssets).set(patch).where(and(eq(churchInventoryAssets.tenantId, tenantId), eq(churchInventoryAssets.id, request.params.id))).returning(),
    );
    if (!updated) return reply.code(404).send({ success: false, error: "EQUIPMENT_NOT_FOUND" });
    return reply.send({ success: true, data: updated });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/equipment/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) =>
      tx.delete(churchInventoryAssets).where(and(eq(churchInventoryAssets.tenantId, tenantId), eq(churchInventoryAssets.id, request.params.id))).returning({ id: churchInventoryAssets.id }),
    );
    if (!deleted) return reply.code(404).send({ success: false, error: "EQUIPMENT_NOT_FOUND" });
    return reply.send({ success: true });
  });

  app.get<{ Params: { id: string } }>("/api/church/hkm/equipment/:id/maintenance", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const rows = await withTenantTransaction(tenantId, (tx) =>
      tx
        .select()
        .from(churchInventoryAssetEvents)
        .where(and(
          eq(churchInventoryAssetEvents.tenantId, tenantId),
          eq(churchInventoryAssetEvents.assetId, request.params.id),
          eq(churchInventoryAssetEvents.eventType, "maintenance"),
        ))
        .orderBy(desc(churchInventoryAssetEvents.occurredAt)),
    );
    return reply.send({ success: true, data: rows.map(parseMaintenanceEvent) });
  });

  app.post<{ Params: { id: string } }>("/api/church/hkm/equipment/:id/maintenance", async (request, reply) => {
    const { tenantId, context } = await adminContext(request, "update");
    const maintenanceSchema = z.object({
      date: z.string().trim().min(4).max(64).optional(),
      type: z.string().trim().min(2).max(80).default("Inspection"),
      cost: z.coerce.number().min(0).default(0),
      description: z.string().trim().max(4000).default(""),
      status: z.string().trim().min(2).max(40).default("Pending"),
    });
    const parsed = maintenanceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });

    const event = await withTenantTransaction(tenantId, async (tx) => {
      const [asset] = await tx
        .select({ id: churchInventoryAssets.id })
        .from(churchInventoryAssets)
        .where(and(eq(churchInventoryAssets.tenantId, tenantId), eq(churchInventoryAssets.id, request.params.id)))
        .limit(1);
      if (!asset) return null;
      const [created] = await tx
        .insert(churchInventoryAssetEvents)
        .values({
          tenantId,
          assetId: asset.id,
          eventType: "maintenance",
          description: formatMaintenanceDescription(parsed.data.type, parsed.data.cost, parsed.data.status, parsed.data.description),
          occurredAt: parseDateOrNow(parsed.data.date),
          recordedBy: context.email,
        })
        .returning();
      return created;
    });
    if (!event) return reply.code(404).send({ success: false, error: "EQUIPMENT_NOT_FOUND" });
    return reply.code(201).send({ success: true, data: parseMaintenanceEvent(event) });
  });

  app.patch<{ Params: { eventId: string } }>("/api/church/hkm/equipment/maintenance/:eventId", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const maintenancePatchSchema = z.object({
      date: z.string().trim().min(4).max(64).optional(),
      type: z.string().trim().min(2).max(80).optional(),
      cost: z.coerce.number().min(0).optional(),
      description: z.string().trim().max(4000).optional(),
      status: z.string().trim().min(2).max(40).optional(),
    });
    const parsed = maintenancePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });

    const updated = await withTenantTransaction(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(churchInventoryAssetEvents)
        .where(and(eq(churchInventoryAssetEvents.tenantId, tenantId), eq(churchInventoryAssetEvents.id, request.params.eventId)))
        .limit(1);
      if (!existing) return null;
      const prev = parseMaintenanceEvent(existing);
      const nextDescription = formatMaintenanceDescription(
        parsed.data.type ?? prev.type,
        parsed.data.cost ?? prev.cost,
        parsed.data.status ?? prev.status,
        parsed.data.description ?? prev.description,
      );
      const [row] = await tx
        .update(churchInventoryAssetEvents)
        .set({
          description: nextDescription,
          ...(parsed.data.date ? { occurredAt: parseDateOrNow(parsed.data.date) } : {}),
        })
        .where(and(eq(churchInventoryAssetEvents.tenantId, tenantId), eq(churchInventoryAssetEvents.id, existing.id)))
        .returning();
      return row;
    });
    if (!updated) return reply.code(404).send({ success: false, error: "MAINTENANCE_RECORD_NOT_FOUND" });
    return reply.send({ success: true, data: parseMaintenanceEvent(updated) });
  });

  app.delete<{ Params: { eventId: string } }>("/api/church/hkm/equipment/maintenance/:eventId", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) =>
      tx
        .delete(churchInventoryAssetEvents)
        .where(and(eq(churchInventoryAssetEvents.tenantId, tenantId), eq(churchInventoryAssetEvents.id, request.params.eventId)))
        .returning({ id: churchInventoryAssetEvents.id }),
    );
    if (!deleted) return reply.code(404).send({ success: false, error: "MAINTENANCE_RECORD_NOT_FOUND" });
    return reply.send({ success: true });
  });

  app.get("/api/church/hkm/visitors", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const { visitors, followUps } = await withTenantTransaction(tenantId, async (tx) => {
      const [visitorRows, followUpRows] = await Promise.all([
        tx.select().from(hkmVisitors).where(eq(hkmVisitors.tenantId, tenantId)).orderBy(desc(hkmVisitors.visitDate), desc(hkmVisitors.createdAt)),
        tx.select().from(hkmVisitorFollowUps).where(eq(hkmVisitorFollowUps.tenantId, tenantId)).orderBy(desc(hkmVisitorFollowUps.date), desc(hkmVisitorFollowUps.createdAt)),
      ]);
      return { visitors: visitorRows, followUps: followUpRows };
    });

    const followUpsByVisitor = new Map<string, Array<{
      id: string;
      visitorId: string;
      date: string;
      interactionType: string;
      notes: string;
      nextFollowUpDate?: string | undefined;
      outcome: string;
    }>>();
    for (const fu of followUps) {
      const list = followUpsByVisitor.get(fu.visitorId) ?? [];
      list.push({
        id: fu.id,
        visitorId: fu.visitorId,
        date: fu.date,
        interactionType: fu.method,
        notes: fu.notes,
        nextFollowUpDate: fu.nextFollowUpDate ?? undefined,
        outcome: fu.outcome,
      });
      followUpsByVisitor.set(fu.visitorId, list);
    }

    return reply.send({
      success: true,
      data: visitors.map((v) => {
        const initials = v.name.split(/\s+/).filter(Boolean).map((p) => p[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "V";
        return {
          id: v.id,
          name: v.name,
          initials,
          phone: v.phone ?? "",
          email: v.email ?? undefined,
          heardFrom: v.howHeard ?? "",
          firstVisit: v.visitDate,
          registeredDate: v.createdAt.toISOString().split("T")[0],
          status: v.followUpStatus,
          followUps: followUpsByVisitor.get(v.id) ?? [],
        };
      }),
    });
  });

  app.post("/api/church/hkm/visitors", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const visitorSchema = z.object({
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().email().max(254).optional().nullable(),
      heardFrom: z.string().trim().max(80).optional(),
      howHeard: z.string().trim().max(80).optional(),
      firstVisit: z.string().trim().min(4).max(32).optional(),
      visitDate: z.string().trim().min(4).max(32).optional(),
      status: z.string().trim().max(32).optional(),
      notes: z.string().max(4000).optional(),
    });
    const parsed = visitorSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const d = parsed.data;
    const visitDate = (d.visitDate ?? d.firstVisit ?? new Date().toISOString()).slice(0, 10);
    const [created] = await withTenantTransaction(tenantId, (tx) =>
      tx
        .insert(hkmVisitors)
        .values({
          tenantId,
          name: d.name,
          phone: d.phone ?? null,
          email: d.email ? d.email.toLowerCase() : null,
          howHeard: d.howHeard ?? d.heardFrom ?? null,
          visitDate,
          followUpStatus: d.status ?? "New",
          notes: d.notes ?? null,
        })
        .returning(),
    );
    return reply.code(201).send({ success: true, data: created });
  });

  app.patch<{ Params: { id: string } }>("/api/church/hkm/visitors/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const visitorPatchSchema = z.object({
      name: z.string().trim().min(2).max(160).optional(),
      phone: z.string().trim().max(40).optional().nullable(),
      email: z.string().trim().email().max(254).optional().nullable(),
      heardFrom: z.string().trim().max(80).optional().nullable(),
      howHeard: z.string().trim().max(80).optional().nullable(),
      firstVisit: z.string().trim().min(4).max(32).optional(),
      visitDate: z.string().trim().min(4).max(32).optional(),
      status: z.string().trim().max(32).optional(),
      convertedToMember: z.boolean().optional(),
      notes: z.string().max(4000).optional().nullable(),
    });
    const parsed = visitorPatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) patch.name = d.name;
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.email !== undefined) patch.email = d.email ? d.email.toLowerCase() : null;
    if (d.howHeard !== undefined || d.heardFrom !== undefined) patch.howHeard = d.howHeard ?? d.heardFrom ?? null;
    if (d.visitDate !== undefined || d.firstVisit !== undefined) patch.visitDate = (d.visitDate ?? d.firstVisit)!.slice(0, 10);
    if (d.status !== undefined) {
      patch.followUpStatus = d.status;
      if (d.status === "Converted") patch.convertedToMember = true;
    }
    if (d.convertedToMember !== undefined) patch.convertedToMember = d.convertedToMember;
    if (d.notes !== undefined) patch.notes = d.notes;

    const [updated] = await withTenantTransaction(tenantId, (tx) =>
      tx.update(hkmVisitors).set(patch).where(and(eq(hkmVisitors.tenantId, tenantId), eq(hkmVisitors.id, request.params.id))).returning(),
    );
    if (!updated) return reply.code(404).send({ success: false, error: "VISITOR_NOT_FOUND" });
    return reply.send({ success: true, data: updated });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/visitors/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) =>
      tx.delete(hkmVisitors).where(and(eq(hkmVisitors.tenantId, tenantId), eq(hkmVisitors.id, request.params.id))).returning({ id: hkmVisitors.id }),
    );
    if (!deleted) return reply.code(404).send({ success: false, error: "VISITOR_NOT_FOUND" });
    return reply.send({ success: true });
  });

  app.post<{ Params: { id: string } }>("/api/church/hkm/visitors/:id/follow-ups", async (request, reply) => {
    const { tenantId, context } = await adminContext(request, "update");
    const followUpSchema = z.object({
      date: z.string().trim().min(4).max(32).optional(),
      interactionType: z.string().trim().min(2).max(40).optional(),
      method: z.string().trim().min(2).max(40).optional(),
      notes: z.string().trim().min(1).max(4000),
      outcome: z.string().trim().max(80).default("Reached"),
      nextFollowUpDate: z.string().trim().min(4).max(32).optional().nullable(),
    });
    const parsed = followUpSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const d = parsed.data;
    const created = await withTenantTransaction(tenantId, async (tx) => {
      const [visitor] = await tx
        .select({ id: hkmVisitors.id })
        .from(hkmVisitors)
        .where(and(eq(hkmVisitors.tenantId, tenantId), eq(hkmVisitors.id, request.params.id)))
        .limit(1);
      if (!visitor) return null;
      const [followUp] = await tx
        .insert(hkmVisitorFollowUps)
        .values({
          tenantId,
          visitorId: visitor.id,
          date: (d.date ?? new Date().toISOString()).slice(0, 10),
          method: d.method ?? d.interactionType ?? "Phone Call",
          notes: d.notes,
          outcome: d.outcome,
          nextFollowUpDate: d.nextFollowUpDate ? d.nextFollowUpDate.slice(0, 10) : null,
          followedUpBy: context.email,
        })
        .returning();
      return followUp;
    });
    if (!created) return reply.code(404).send({ success: false, error: "VISITOR_NOT_FOUND" });
    return reply.code(201).send({ success: true, data: created });
  });

  app.delete<{ Params: { followUpId: string } }>("/api/church/hkm/visitors/follow-ups/:followUpId", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) =>
      tx
        .delete(hkmVisitorFollowUps)
        .where(and(eq(hkmVisitorFollowUps.tenantId, tenantId), eq(hkmVisitorFollowUps.id, request.params.followUpId)))
        .returning({ id: hkmVisitorFollowUps.id }),
    );
    if (!deleted) return reply.code(404).send({ success: false, error: "FOLLOW_UP_NOT_FOUND" });
    return reply.send({ success: true });
  });

  app.get("/api/church/hkm/sms", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const query = request.query as { since?: string };
    const filters = [eq(hkmSmsLogs.tenantId, tenantId)];
    if (query.since && /^\d{4}-\d{2}-\d{2}$/.test(query.since)) {
      filters.push(sql`${hkmSmsLogs.sentAt} >= ${new Date(`${query.since}T00:00:00.000Z`)}`);
    }
    const logs = await withTenantTransaction(tenantId, (tx) =>
      tx.select().from(hkmSmsLogs).where(and(...filters)).orderBy(desc(hkmSmsLogs.sentAt)).limit(500),
    );
    return reply.send({
      success: true,
      data: logs.map((row) => ({
        id: row.id,
        recipientCount: row.recipientCount,
        message: row.message,
        status: row.status === "Pending" || row.status === "Failed" ? row.status : "Sent",
        date: row.sentAt.toISOString().split("T")[0],
        recipients: row.recipients,
        recipientGroup: row.recipientGroup,
        sentBy: row.sentBy,
      })),
    });
  });

  app.post("/api/church/hkm/sms", async (request, reply) => {
    const { tenantId, context } = await adminContext(request, "update");
    const smsSchema = z.object({
      recipients: z.array(z.string().trim().max(40)).max(2000).default([]),
      recipientGroup: z.string().trim().max(120).optional(),
      recipientCount: z.coerce.number().int().min(1).max(100000).optional(),
      message: z.string().trim().min(1).max(2000),
      status: z.enum(["Sent", "Pending", "Failed"]).default("Sent"),
      branchId: z.string().uuid().optional().nullable(),
      date: z.string().trim().max(64).optional(),
    });
    const parsed = smsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_INPUT", details: parsed.error.flatten() });
    const d = parsed.data;
    const countValue = d.recipientCount ?? Math.max(1, d.recipients.length);
    const [created] = await withTenantTransaction(tenantId, (tx) =>
      tx
        .insert(hkmSmsLogs)
        .values({
          tenantId,
          recipients: d.recipients,
          recipientGroup: d.recipientGroup ?? null,
          message: d.message,
          status: d.status,
          sentBy: context.email,
          recipientCount: countValue,
          branchId: d.branchId ?? null,
          sentAt: d.date ? parseDateOrNow(d.date) : new Date(),
        })
        .returning(),
    );
    return reply.code(201).send({ success: true, data: created });
  });

  app.delete<{ Params: { id: string } }>("/api/church/hkm/sms/:id", async (request, reply) => {
    const { tenantId } = await adminContext(request, "update");
    const [deleted] = await withTenantTransaction(tenantId, (tx) =>
      tx.delete(hkmSmsLogs).where(and(eq(hkmSmsLogs.tenantId, tenantId), eq(hkmSmsLogs.id, request.params.id))).returning({ id: hkmSmsLogs.id }),
    );
    if (!deleted) return reply.code(404).send({ success: false, error: "SMS_LOG_NOT_FOUND" });
    return reply.send({ success: true });
  });

  app.get("/api/church/hkm/stats", async (request, reply) => {
    const { tenantId } = await adminContext(request, "read");
    const stats = await withTenantTransaction(tenantId, async (tx) => {
      const [[memberCount], [branchCount], [equipmentCount], [attendance]] = await Promise.all([
        tx.select({ total: count() }).from(hkmMembers).where(and(eq(hkmMembers.tenantId, tenantId), eq(hkmMembers.status, "active"))),
        tx.select({ total: count() }).from(hkmBranches).where(and(eq(hkmBranches.tenantId, tenantId), eq(hkmBranches.status, "active"))),
        tx.select({ total: count() }).from(churchInventoryAssets).where(eq(churchInventoryAssets.tenantId, tenantId)),
        tx.select({ total: sql<number>`coalesce(sum(${hkmAttendanceRecords.countMen} + ${hkmAttendanceRecords.countWomen} + ${hkmAttendanceRecords.countChildren}),0)` }).from(hkmAttendanceRecords).where(eq(hkmAttendanceRecords.tenantId, tenantId)),
      ]);
      const [giving] = await tx.select({ total: sql<number>`coalesce(sum(${hkmGivingTransactions.amountMinor}),0)` }).from(hkmGivingTransactions)
        .where(and(eq(hkmGivingTransactions.tenantId, tenantId), eq(hkmGivingTransactions.paymentStatus, "verified")));
      return {
        totalMembers: memberCount?.total ?? 0, totalBranches: branchCount?.total ?? 0, totalEquipment: equipmentCount?.total ?? 0,
        totalGiving: Number(giving?.total ?? 0) / 100, latestAttendance: attendance?.total ?? 0,
      };
    });
    return reply.send({ success: true, stats });
  });

  // Portal sign-in looks up the membership record, then delegates password
  // verification and session issuance to Better Auth. PIN login is not enabled
  // until a verified SMS/email delivery provider is configured.
  app.post("/api/church/hkm/portal/login-password", async (request, reply) => {
    const tenantId = await tenantFor(request);
    const parsed = z.object({ membershipNumber: z.string().trim().min(2).max(48), password: z.string().min(1).max(256) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ success: false, error: "INVALID_CREDENTIALS" });
    const [member] = await withTenantTransaction(tenantId, (tx) => tx.select().from(hkmMembers).where(and(
      eq(hkmMembers.tenantId, tenantId), eq(hkmMembers.membershipNumber, parsed.data.membershipNumber.toUpperCase()), eq(hkmMembers.status, "active"),
    )).limit(1));
    if (!member) return reply.code(401).send({ success: false, error: "INVALID_CREDENTIALS" });
    const tenantRows = await withTenantTransaction(tenantId, (tx) => tx.select({ authOrganizationId: tenants.authOrganizationId }).from(tenants).where(eq(tenants.id, tenantId)).limit(1));
    const organizationId = tenantRows[0]?.authOrganizationId;
    if (!organizationId) return reply.code(503).send({ success: false, error: "HKM_WORKSPACE_NOT_LINKED" });
    try {
      const signedIn = await auth.api.signInEmail({
        headers: fromNodeHeaders(request.headers),
        body: { email: member.email, password: parsed.data.password },
        returnHeaders: true,
      });
      const token = signedIn.response?.token;
      if (!token) return reply.code(401).send({ success: false, error: "INVALID_CREDENTIALS" });
      const sessionHeaders = fromNodeHeaders(request.headers);
      const setCookies = signedIn.headers.getSetCookie?.() ?? [];
      const sessionCookie = setCookies.map((cookie) => cookie.split(";", 1)[0]).filter(Boolean).join("; ");
      if (!sessionCookie) return reply.code(401).send({ success: false, error: "AUTH_SESSION_UNAVAILABLE" });
      sessionHeaders.set("cookie", sessionCookie);
      await auth.api.setActiveOrganization({ headers: sessionHeaders, body: { organizationId } });
      if (setCookies.length) reply.header("Set-Cookie", setCookies);
      reply.header("cache-control", "no-store");
      return reply.send({ success: true, member: memberDto(member) });
    } catch {
      return reply.code(401).send({ success: false, error: "INVALID_CREDENTIALS" });
    }
  });

  app.get("/api/church/hkm/portal/me", async (request, reply) => {
    const { member } = await portalMember(request);
    reply.header("cache-control", "no-store");
    return reply.send({ success: true, member: memberDto(member) });
  });

  app.get("/api/church/hkm/portal/dashboard", async (request, reply) => {
    const { tenantId, member } = await portalMember(request);
    const { transactions, attendance } = await withTenantTransaction(tenantId, async (tx) => {
      const [txRows, attRows] = await Promise.all([
        tx.select().from(hkmGivingTransactions).where(and(
          eq(hkmGivingTransactions.tenantId, tenantId), eq(hkmGivingTransactions.memberId, member.id), eq(hkmGivingTransactions.paymentStatus, "verified"),
        )).orderBy(desc(hkmGivingTransactions.transactionDate)).limit(250),
        tx.select().from(hkmMemberAttendanceRecords).where(and(
          eq(hkmMemberAttendanceRecords.tenantId, tenantId), eq(hkmMemberAttendanceRecords.memberId, member.id),
        )).orderBy(desc(hkmMemberAttendanceRecords.serviceDate)).limit(100),
      ]);
      return { transactions: txRows, attendance: attRows };
    });
    return reply.header("cache-control", "no-store").send({
      member: {
        id: member.id,
        first_name: member.firstName,
        last_name: member.lastName,
        email: member.email,
        phone: member.phone,
        department: member.department || member.role,
        address: member.address ?? "",
        occupation: member.occupation ?? "",
        marital_status: member.maritalStatus ?? "",
        avatar: member.avatarUrl ?? "",
        status: member.status,
        joined_at: member.createdAt.toISOString(),
      },
      transactions: transactions.map((row) => ({
        id: row.id, date: row.transactionDate.toISOString(), category: row.givingType,
        amount: row.amountMinor / 100, description: row.receiptNumber,
      })),
      attendance: attendance.map((row) => ({
        id: row.id,
        date: row.serviceDate,
        service: row.serviceType,
        status: row.status,
      })),
    });
  });

  app.patch("/api/church/hkm/portal/me", async (request, reply) => {
    const { tenantId, member } = await portalMember(request);
    const profilePatchSchema = z.object({
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().email().max(254).optional(),
      address: z.string().trim().max(1000).nullable().optional(),
      occupation: z.string().trim().max(160).nullable().optional(),
      maritalStatus: z.string().trim().max(24).nullable().optional(),
      marital_status: z.string().trim().max(24).nullable().optional(),
      avatarUrl: z.string().trim().max(10000).nullable().optional(),
      avatar: z.string().trim().max(10000).nullable().optional(),
    });
    const parsed = profilePatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.phone !== undefined) patch.phone = d.phone;
    if (d.email !== undefined) patch.email = d.email.toLowerCase();
    if (d.address !== undefined) patch.address = d.address;
    if (d.occupation !== undefined) patch.occupation = d.occupation;
    if (d.maritalStatus !== undefined || d.marital_status !== undefined) {
      patch.maritalStatus = d.maritalStatus ?? d.marital_status ?? null;
    }
    if (d.avatarUrl !== undefined || d.avatar !== undefined) patch.avatarUrl = d.avatarUrl ?? d.avatar ?? null;

    try {
      const [updated] = await withTenantTransaction(tenantId, (tx) =>
        tx.update(hkmMembers).set(patch).where(and(eq(hkmMembers.tenantId, tenantId), eq(hkmMembers.id, member.id))).returning(),
      );
      if (!updated) return reply.code(404).send({ error: "HKM_MEMBER_NOT_FOUND" });
      return reply.send({ success: true, member: memberDto(updated) });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "EMAIL_IN_USE", message: "That email address is already registered to another member." });
      }
      throw error;
    }
  });

  app.post("/api/church/hkm/portal/helpdesk", async (request, reply) => {
    const { tenantId, member } = await portalMember(request);
    const ticketSchema = z.object({
      department: z.string().trim().max(60).optional(),
      subject: z.string().trim().min(2).max(200),
      message: z.string().trim().min(2).max(4000).optional(),
      body: z.string().trim().min(2).max(4000).optional(),
    });
    const parsed = ticketSchema.safeParse(request.body);
    const bodyText = parsed.success ? (parsed.data.message ?? parsed.data.body) : undefined;
    if (!parsed.success || !bodyText) {
      return reply.code(400).send({ error: "INVALID_INPUT", message: "Subject and message body are required." });
    }
    const [ticket] = await withTenantTransaction(tenantId, (tx) =>
      tx
        .insert(churchContactMessages)
        .values({
          tenantId,
          fullName: `${member.firstName} ${member.lastName}`.trim().slice(0, 160),
          email: member.email,
          telephone: member.phone || null,
          subject: parsed.data.subject,
          message: bodyText,
          category: (parsed.data.department || "Member Portal Helpdesk").slice(0, 60),
          status: "new",
          consentAt: new Date(),
        })
        .returning(),
    );
    return reply.code(201).send({ success: true, ticket });
  });

  app.get("/api/church/hkm/portal/giving-history", async (request, reply) => {
    const { tenantId, member } = await portalMember(request);
    const rows = await withTenantTransaction(tenantId, (tx) => tx.select().from(hkmGivingTransactions).where(and(
      eq(hkmGivingTransactions.tenantId, tenantId), eq(hkmGivingTransactions.memberId, member.id), eq(hkmGivingTransactions.paymentStatus, "verified"),
    )).orderBy(desc(hkmGivingTransactions.transactionDate)).limit(500));
    const totalGiven = rows.reduce((sum, row) => sum + row.amountMinor, 0) / 100;
    return reply.header("cache-control", "no-store").send({ success: true, memberId: member.id, totalGiven, currency: "KES", transactions: rows });
  });

  app.get("/api/church/hkm/portal/statement", async (request, reply) => {
    const { tenantId, member } = await portalMember(request);
    const year = String((request.query as { year?: string }).year ?? new Date().getUTCFullYear());
    if (!/^\d{4}$/.test(year)) return reply.code(400).send({ error: "INVALID_YEAR" });
    const rows = await withTenantTransaction(tenantId, (tx) => tx.select().from(hkmGivingTransactions).where(and(
      eq(hkmGivingTransactions.tenantId, tenantId), eq(hkmGivingTransactions.memberId, member.id), eq(hkmGivingTransactions.paymentStatus, "verified"),
      sql`extract(year from ${hkmGivingTransactions.transactionDate}) = ${year}`,
    )).orderBy(desc(hkmGivingTransactions.transactionDate)));
    const amountFor = (predicate: (type: string) => boolean) => rows.filter((row) => predicate(row.givingType.toLowerCase())).reduce((sum, row) => sum + row.amountMinor, 0) / 100;
    const totalTithe = amountFor((type) => type === "tithe");
    const totalOffering = amountFor((type) => type === "offering");
    const totalOther = rows.filter((row) => !["tithe", "offering"].includes(row.givingType.toLowerCase())).reduce((sum, row) => sum + row.amountMinor, 0) / 100;
    return reply.header("cache-control", "no-store").send({
      churchName: defaultHkmTenantConfig.churchName, statementYear: year,
      member: { name: `${member.firstName} ${member.lastName}`, membershipNumber: member.membershipNumber, email: member.email, phone: member.phone },
      summary: { totalTithe, totalOffering, totalOther, grandTotal: totalTithe + totalOffering + totalOther, currency: "KES" }, transactions: rows,
    });
  });

  app.post("/api/church/hkm/portal/logout", async (request, reply) => {
    const result = await auth.api.signOut({ headers: fromNodeHeaders(request.headers), returnHeaders: true });
    const setCookies = result.headers.getSetCookie?.() ?? [];
    if (setCookies.length) reply.header("Set-Cookie", setCookies);
    return reply.send({ success: true });
  });

  app.post("/api/church/hkm/portal/login-pin", async (_request, reply) => reply.code(503).send({
    error: "PIN_LOGIN_UNAVAILABLE",
    message: "PIN sign-in is disabled until a verified one-time-code delivery provider is configured. Use your member account password.",
  }));
  app.post("/api/church/hkm/portal/set-password", async (_request, reply) => reply.code(410).send({ error: "PASSWORD_RESET_UNAVAILABLE", message: "Contact the church office to link your member record to a verified account." }));
  app.post("/api/church/hkm/portal/request-pin", async (_request, reply) => reply.code(503).send({ error: "PIN_DELIVERY_UNAVAILABLE", message: "Contact the church office to request access." }));
}

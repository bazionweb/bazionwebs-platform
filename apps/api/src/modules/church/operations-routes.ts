import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import {
  departmentInputSchema,
  departmentUpdateSchema,
  smallGroupInputSchema,
  smallGroupUpdateSchema,
  publicGroupJoinRequestSchema,
  groupMembershipStatusUpdateSchema,
  volunteerTeamInputSchema,
  volunteerTeamUpdateSchema,
  publicVolunteerApplicationSchema,
  volunteerApplicationStatusUpdateSchema,
  inventoryAssetInputSchema,
  inventoryAssetUpdateSchema,
  inventoryAssetEventInputSchema,
} from "@bazion/church-ministry-contracts";
import { slugifyContentTitle } from "@bazion/church-ministry-domain";
import {
  churchDepartments,
  churchSmallGroups,
  churchGroupMemberships,
  churchVolunteerTeams,
  churchVolunteerApplications,
  churchInventoryAssets,
  churchInventoryAssetEvents,
} from "@bazion/database";
import { requireActiveTenantPermission } from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { withTenantTransaction } from "../../lib/database.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { assertTenantNotInMaintenance } from "../../lib/tenant-maintenance.js";

async function assertChurchEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "church-ministry"))) {
    throw Object.assign(new Error("The church ministry module is not enabled for this tenant."), {
      statusCode: 404,
      code: "CHURCH_MODULE_DISABLED",
    });
  }
}

export async function registerChurchOperationsRoutes(app: FastifyInstance, options: { config: AppConfig }) {
  const { config } = options;
  const tenantForRequest = (request: FastifyRequest) => {
    return resolveRequestTenantId(request, config);
  };
  // ── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────

  // GET /v1/public/church/directory
  // Returns ONLY active, public departments, small groups (without private addresses),
  // and volunteer teams. Inventory assets and private members are NEVER returned.
  app.get("/public/church/directory", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);
    await assertTenantNotInMaintenance(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const departments = await tx
        .select({
          id: churchDepartments.id,
          name: churchDepartments.name,
          slug: churchDepartments.slug,
          description: churchDepartments.description,
          icon: churchDepartments.icon,
          leaderName: churchDepartments.leaderName,
          leaderRole: churchDepartments.leaderRole,
          meetingSchedule: churchDepartments.meetingSchedule,
        })
        .from(churchDepartments)
        .where(and(
          eq(churchDepartments.tenantId, tenantId),
          eq(churchDepartments.isPublic, true),
          eq(churchDepartments.status, "active"),
        ))
        .orderBy(churchDepartments.displayOrder);

      const smallGroups = await tx
        .select({
          id: churchSmallGroups.id,
          name: churchSmallGroups.name,
          slug: churchSmallGroups.slug,
          category: churchSmallGroups.category,
          description: churchSmallGroups.description,
          leaderName: churchSmallGroups.leaderName,
          meetingSchedule: churchSmallGroups.meetingSchedule,
          publicLocationLabel: churchSmallGroups.publicLocationLabel,
          acceptingMembers: churchSmallGroups.acceptingMembers,
        })
        .from(churchSmallGroups)
        .where(and(
          eq(churchSmallGroups.tenantId, tenantId),
          eq(churchSmallGroups.isPublic, true),
          eq(churchSmallGroups.status, "active"),
        ));

      const volunteerTeams = await tx
        .select({
          id: churchVolunteerTeams.id,
          name: churchVolunteerTeams.name,
          slug: churchVolunteerTeams.slug,
          description: churchVolunteerTeams.description,
          requirements: churchVolunteerTeams.requirements,
          coordinatorName: churchVolunteerTeams.coordinatorName,
          acceptingApplications: churchVolunteerTeams.acceptingApplications,
        })
        .from(churchVolunteerTeams)
        .where(and(
          eq(churchVolunteerTeams.tenantId, tenantId),
          eq(churchVolunteerTeams.isPublic, true),
          eq(churchVolunteerTeams.status, "active"),
        ));

      return reply.send({ departments, smallGroups, volunteerTeams });
    });
  });

  // POST /v1/public/church/groups/:id/join-requests
  app.post<{ Params: { id: string } }>("/public/church/groups/:id/join-requests", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);
    await assertTenantNotInMaintenance(tenantId);

    const parsed = publicGroupJoinRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(tenantId, async (tx) => {
      const [group] = await tx
        .select()
        .from(churchSmallGroups)
        .where(and(
          eq(churchSmallGroups.tenantId, tenantId),
          eq(churchSmallGroups.id, request.params.id),
          eq(churchSmallGroups.status, "active"),
          eq(churchSmallGroups.isPublic, true),
        ))
        .limit(1);

      if (!group) {
        return reply.code(404).send({ error: "GROUP_NOT_FOUND", message: "Small group not found or not currently active." });
      }

      if (!group.acceptingMembers) {
        return reply.code(409).send({ error: "NOT_ACCEPTING_MEMBERS", message: "This group is currently at capacity or not accepting new members." });
      }

      const [membership] = await tx
        .insert(churchGroupMemberships)
        .values({
          tenantId,
          groupId: group.id,
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          telephone: parsed.data.telephone,
          role: "member",
          status: "requested",
          privacyConsentAt: new Date(),
          notes: parsed.data.notes,
        })
        .onConflictDoUpdate({
          target: [churchGroupMemberships.tenantId, churchGroupMemberships.groupId, churchGroupMemberships.email],
          set: {
            fullName: parsed.data.fullName,
            telephone: parsed.data.telephone,
            status: "requested",
            notes: parsed.data.notes,
            privacyConsentAt: new Date(),
            updatedAt: new Date(),
          },
        })
        .returning({ id: churchGroupMemberships.id });

      return reply.code(201).send({ success: true, membershipId: membership?.id });
    });
  });

  // POST /v1/public/church/volunteer-teams/:id/applications
  app.post<{ Params: { id: string } }>("/public/church/volunteer-teams/:id/applications", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);
    await assertTenantNotInMaintenance(tenantId);

    const parsed = publicVolunteerApplicationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(tenantId, async (tx) => {
      const [team] = await tx
        .select()
        .from(churchVolunteerTeams)
        .where(and(
          eq(churchVolunteerTeams.tenantId, tenantId),
          eq(churchVolunteerTeams.id, request.params.id),
          eq(churchVolunteerTeams.status, "active"),
          eq(churchVolunteerTeams.isPublic, true),
        ))
        .limit(1);

      if (!team) {
        return reply.code(404).send({ error: "TEAM_NOT_FOUND", message: "Volunteer team not found or not currently active." });
      }

      if (!team.acceptingApplications) {
        return reply.code(409).send({ error: "NOT_ACCEPTING_APPLICATIONS", message: "This volunteer team is not accepting applications at this time." });
      }

      const [application] = await tx
        .insert(churchVolunteerApplications)
        .values({
          tenantId,
          teamId: team.id,
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          telephone: parsed.data.telephone,
          availability: parsed.data.availability,
          message: parsed.data.message,
          status: "pending",
          privacyConsentAt: new Date(),
        })
        .returning({ id: churchVolunteerApplications.id });

      return reply.code(201).send({ success: true, applicationId: application?.id });
    });
  });

  // ── ADMIN: DEPARTMENTS ──────────────────────────────────────────────────────

  // GET /v1/admin/church/departments
  app.get("/admin/church/departments", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const departments = await tx
        .select()
        .from(churchDepartments)
        .where(eq(churchDepartments.tenantId, context.tenantId))
        .orderBy(churchDepartments.displayOrder);
      return reply.send({ departments });
    });
  });

  // POST /v1/admin/church/departments
  app.post("/admin/church/departments", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = departmentInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    const slug = parsed.data.slug || slugifyContentTitle(parsed.data.name, "dept");

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [department] = await tx
        .insert(churchDepartments)
        .values({
          tenantId: context.tenantId,
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          icon: parsed.data.icon,
          leaderName: parsed.data.leaderName,
          leaderRole: parsed.data.leaderRole,
          meetingSchedule: parsed.data.meetingSchedule,
          contactEmail: parsed.data.contactEmail,
          isPublic: parsed.data.isPublic,
          displayOrder: parsed.data.displayOrder,
          status: parsed.data.status,
        })
        .returning();
      return reply.code(201).send({ department });
    });
  });

  // PUT /v1/admin/church/departments/:id
  app.put<{ Params: { id: string } }>("/admin/church/departments/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = departmentUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [updated] = await tx
        .update(churchDepartments)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(and(eq(churchDepartments.tenantId, context.tenantId), eq(churchDepartments.id, request.params.id)))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "DEPARTMENT_NOT_FOUND", message: "Department not found." });
      }
      return reply.send({ department: updated });
    });
  });

  // DELETE /v1/admin/church/departments/:id (archives department)
  app.delete<{ Params: { id: string } }>("/admin/church/departments/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [archived] = await tx
        .update(churchDepartments)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(churchDepartments.tenantId, context.tenantId), eq(churchDepartments.id, request.params.id)))
        .returning();

      if (!archived) {
        return reply.code(404).send({ error: "DEPARTMENT_NOT_FOUND", message: "Department not found." });
      }
      return reply.send({ success: true, status: "archived" });
    });
  });

  // ── ADMIN: SMALL GROUPS & MEMBERSHIPS ──────────────────────────────────────

  // GET /v1/admin/church/groups
  app.get("/admin/church/groups", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const groups = await tx
        .select()
        .from(churchSmallGroups)
        .where(eq(churchSmallGroups.tenantId, context.tenantId))
        .orderBy(desc(churchSmallGroups.createdAt));
      return reply.send({ groups });
    });
  });

  // POST /v1/admin/church/groups
  app.post("/admin/church/groups", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = smallGroupInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    const slug = parsed.data.slug || slugifyContentTitle(parsed.data.name, "cell");

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [group] = await tx
        .insert(churchSmallGroups)
        .values({
          tenantId: context.tenantId,
          name: parsed.data.name,
          slug,
          category: parsed.data.category,
          description: parsed.data.description,
          leaderName: parsed.data.leaderName,
          meetingSchedule: parsed.data.meetingSchedule,
          publicLocationLabel: parsed.data.publicLocationLabel,
          privateAddress: parsed.data.privateAddress,
          departmentId: parsed.data.departmentId,
          capacity: parsed.data.capacity,
          isPublic: parsed.data.isPublic,
          acceptingMembers: parsed.data.acceptingMembers,
          status: parsed.data.status,
        })
        .returning();
      return reply.code(201).send({ group });
    });
  });

  // PUT /v1/admin/church/groups/:id
  app.put<{ Params: { id: string } }>("/admin/church/groups/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = smallGroupUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [updated] = await tx
        .update(churchSmallGroups)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(and(eq(churchSmallGroups.tenantId, context.tenantId), eq(churchSmallGroups.id, request.params.id)))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "GROUP_NOT_FOUND", message: "Group not found." });
      }
      return reply.send({ group: updated });
    });
  });

  // DELETE /v1/admin/church/groups/:id
  app.delete<{ Params: { id: string } }>("/admin/church/groups/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [archived] = await tx
        .update(churchSmallGroups)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(churchSmallGroups.tenantId, context.tenantId), eq(churchSmallGroups.id, request.params.id)))
        .returning();

      if (!archived) {
        return reply.code(404).send({ error: "GROUP_NOT_FOUND", message: "Group not found." });
      }
      return reply.send({ success: true, status: "archived" });
    });
  });

  // GET /v1/admin/church/groups/memberships
  app.get<{ Querystring: { groupId?: string } }>("/admin/church/groups/memberships", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const query = tx
        .select({
          id: churchGroupMemberships.id,
          groupId: churchGroupMemberships.groupId,
          groupName: churchSmallGroups.name,
          fullName: churchGroupMemberships.fullName,
          email: churchGroupMemberships.email,
          telephone: churchGroupMemberships.telephone,
          role: churchGroupMemberships.role,
          status: churchGroupMemberships.status,
          privacyConsentAt: churchGroupMemberships.privacyConsentAt,
          notes: churchGroupMemberships.notes,
          createdAt: churchGroupMemberships.createdAt,
        })
        .from(churchGroupMemberships)
        .innerJoin(churchSmallGroups, eq(churchGroupMemberships.groupId, churchSmallGroups.id))
        .where(
          request.query.groupId
            ? and(eq(churchGroupMemberships.tenantId, context.tenantId), eq(churchGroupMemberships.groupId, request.query.groupId))
            : eq(churchGroupMemberships.tenantId, context.tenantId),
        )
        .orderBy(desc(churchGroupMemberships.createdAt));

      const memberships = await query;
      return reply.send({ memberships });
    });
  });

  // PATCH /v1/admin/church/groups/memberships/:membershipId
  app.patch<{ Params: { membershipId: string } }>("/admin/church/groups/memberships/:membershipId", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = groupMembershipStatusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [updated] = await tx
        .update(churchGroupMemberships)
        .set({
          status: parsed.data.status,
          ...(parsed.data.role ? { role: parsed.data.role } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          updatedAt: new Date(),
        })
        .where(and(
          eq(churchGroupMemberships.tenantId, context.tenantId),
          eq(churchGroupMemberships.id, request.params.membershipId),
        ))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "MEMBERSHIP_NOT_FOUND", message: "Membership record not found." });
      }
      return reply.send({ membership: updated });
    });
  });

  // ── ADMIN: VOLUNTEER TEAMS & APPLICATIONS ──────────────────────────────────

  // GET /v1/admin/church/volunteer-teams
  app.get("/admin/church/volunteer-teams", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const teams = await tx
        .select({
          id: churchVolunteerTeams.id,
          name: churchVolunteerTeams.name,
          slug: churchVolunteerTeams.slug,
          departmentId: churchVolunteerTeams.departmentId,
          departmentName: churchDepartments.name,
          description: churchVolunteerTeams.description,
          requirements: churchVolunteerTeams.requirements,
          coordinatorName: churchVolunteerTeams.coordinatorName,
          isPublic: churchVolunteerTeams.isPublic,
          acceptingApplications: churchVolunteerTeams.acceptingApplications,
          status: churchVolunteerTeams.status,
          createdAt: churchVolunteerTeams.createdAt,
          updatedAt: churchVolunteerTeams.updatedAt,
        })
        .from(churchVolunteerTeams)
        .leftJoin(churchDepartments, eq(churchVolunteerTeams.departmentId, churchDepartments.id))
        .where(eq(churchVolunteerTeams.tenantId, context.tenantId))
        .orderBy(desc(churchVolunteerTeams.createdAt));
      return reply.send({ teams });
    });
  });

  // POST /v1/admin/church/volunteer-teams
  app.post("/admin/church/volunteer-teams", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = volunteerTeamInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    const slug = parsed.data.slug || slugifyContentTitle(parsed.data.name, "team");

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [team] = await tx
        .insert(churchVolunteerTeams)
        .values({
          tenantId: context.tenantId,
          name: parsed.data.name,
          slug,
          departmentId: parsed.data.departmentId,
          description: parsed.data.description,
          requirements: parsed.data.requirements,
          coordinatorName: parsed.data.coordinatorName,
          isPublic: parsed.data.isPublic,
          acceptingApplications: parsed.data.acceptingApplications,
          status: parsed.data.status,
        })
        .returning();
      return reply.code(201).send({ team });
    });
  });

  // PUT /v1/admin/church/volunteer-teams/:id
  app.put<{ Params: { id: string } }>("/admin/church/volunteer-teams/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = volunteerTeamUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [updated] = await tx
        .update(churchVolunteerTeams)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(and(eq(churchVolunteerTeams.tenantId, context.tenantId), eq(churchVolunteerTeams.id, request.params.id)))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "TEAM_NOT_FOUND", message: "Volunteer team not found." });
      }
      return reply.send({ team: updated });
    });
  });

  // DELETE /v1/admin/church/volunteer-teams/:id
  app.delete<{ Params: { id: string } }>("/admin/church/volunteer-teams/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [archived] = await tx
        .update(churchVolunteerTeams)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(churchVolunteerTeams.tenantId, context.tenantId), eq(churchVolunteerTeams.id, request.params.id)))
        .returning();

      if (!archived) {
        return reply.code(404).send({ error: "TEAM_NOT_FOUND", message: "Volunteer team not found." });
      }
      return reply.send({ success: true, status: "archived" });
    });
  });

  // GET /v1/admin/church/volunteer-applications
  app.get<{ Querystring: { teamId?: string } }>("/admin/church/volunteer-applications", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const query = tx
        .select({
          id: churchVolunteerApplications.id,
          teamId: churchVolunteerApplications.teamId,
          teamName: churchVolunteerTeams.name,
          fullName: churchVolunteerApplications.fullName,
          email: churchVolunteerApplications.email,
          telephone: churchVolunteerApplications.telephone,
          availability: churchVolunteerApplications.availability,
          message: churchVolunteerApplications.message,
          status: churchVolunteerApplications.status,
          privacyConsentAt: churchVolunteerApplications.privacyConsentAt,
          reviewedAt: churchVolunteerApplications.reviewedAt,
          reviewedBy: churchVolunteerApplications.reviewedBy,
          notes: churchVolunteerApplications.notes,
          createdAt: churchVolunteerApplications.createdAt,
        })
        .from(churchVolunteerApplications)
        .innerJoin(churchVolunteerTeams, eq(churchVolunteerApplications.teamId, churchVolunteerTeams.id))
        .where(
          request.query.teamId
            ? and(eq(churchVolunteerApplications.tenantId, context.tenantId), eq(churchVolunteerApplications.teamId, request.query.teamId))
            : eq(churchVolunteerApplications.tenantId, context.tenantId),
        )
        .orderBy(desc(churchVolunteerApplications.createdAt));

      const applications = await query;
      return reply.send({ applications });
    });
  });

  // PATCH /v1/admin/church/volunteer-applications/:applicationId
  app.patch<{ Params: { applicationId: string } }>("/admin/church/volunteer-applications/:applicationId", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = volunteerApplicationStatusUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [updated] = await tx
        .update(churchVolunteerApplications)
        .set({
          status: parsed.data.status,
          reviewedAt: new Date(),
          reviewedBy: context.email,
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          updatedAt: new Date(),
        })
        .where(and(
          eq(churchVolunteerApplications.tenantId, context.tenantId),
          eq(churchVolunteerApplications.id, request.params.applicationId),
        ))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "APPLICATION_NOT_FOUND", message: "Application record not found." });
      }
      return reply.send({ application: updated });
    });
  });

  // ── ADMIN: PHYSICAL INVENTORY & ASSETS (PRIVATE MANAGEMENT ONLY) ───────────

  // GET /v1/admin/church/inventory-assets
  app.get("/admin/church/inventory-assets", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const assets = await tx
        .select()
        .from(churchInventoryAssets)
        .where(eq(churchInventoryAssets.tenantId, context.tenantId))
        .orderBy(churchInventoryAssets.category, churchInventoryAssets.name);
      return reply.send({ assets });
    });
  });

  // POST /v1/admin/church/inventory-assets
  app.post("/admin/church/inventory-assets", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = inventoryAssetInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [asset] = await tx
        .insert(churchInventoryAssets)
        .values({
          tenantId: context.tenantId,
          name: parsed.data.name,
          assetTag: parsed.data.assetTag,
          category: parsed.data.category,
          location: parsed.data.location,
          condition: parsed.data.condition,
          status: parsed.data.status,
          assignedTo: parsed.data.assignedTo,
          acquiredOn: parsed.data.acquiredOn,
          purchaseValueMinor: parsed.data.purchaseValueMinor,
          currency: parsed.data.currency,
          notes: parsed.data.notes,
        })
        .returning();

      // Automatically record creation event
      await tx.insert(churchInventoryAssetEvents).values({
        tenantId: context.tenantId,
        assetId: asset!.id,
        eventType: "assignment",
        description: `Asset registered into inventory at ${parsed.data.location}.`,
        recordedBy: context.email,
      });

      return reply.code(201).send({ asset });
    });
  });

  // PUT /v1/admin/church/inventory-assets/:id
  app.put<{ Params: { id: string } }>("/admin/church/inventory-assets/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = inventoryAssetUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(churchInventoryAssets)
        .where(and(eq(churchInventoryAssets.tenantId, context.tenantId), eq(churchInventoryAssets.id, request.params.id)))
        .limit(1);

      if (!existing) {
        return reply.code(404).send({ error: "ASSET_NOT_FOUND", message: "Inventory asset not found." });
      }

      const [updated] = await tx
        .update(churchInventoryAssets)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(and(eq(churchInventoryAssets.tenantId, context.tenantId), eq(churchInventoryAssets.id, request.params.id)))
        .returning();

      // Log status/condition change event if modified
      if (parsed.data.status && parsed.data.status !== existing.status) {
        await tx.insert(churchInventoryAssetEvents).values({
          tenantId: context.tenantId,
          assetId: existing.id,
          eventType: "condition_change",
          description: `Status changed from ${existing.status} to ${parsed.data.status}.`,
          recordedBy: context.email,
        });
      }

      return reply.send({ asset: updated });
    });
  });

  // DELETE /v1/admin/church/inventory-assets/:id (retires asset)
  app.delete<{ Params: { id: string } }>("/admin/church/inventory-assets/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [retired] = await tx
        .update(churchInventoryAssets)
        .set({ status: "retired", condition: "retired", updatedAt: new Date() })
        .where(and(eq(churchInventoryAssets.tenantId, context.tenantId), eq(churchInventoryAssets.id, request.params.id)))
        .returning();

      if (!retired) {
        return reply.code(404).send({ error: "ASSET_NOT_FOUND", message: "Inventory asset not found." });
      }

      await tx.insert(churchInventoryAssetEvents).values({
        tenantId: context.tenantId,
        assetId: retired.id,
        eventType: "condition_change",
        description: "Asset marked as retired from active inventory.",
        recordedBy: context.email,
      });

      return reply.send({ success: true, status: "retired" });
    });
  });

  // GET /v1/admin/church/inventory-assets/:id/events
  app.get<{ Params: { id: string } }>("/admin/church/inventory-assets/:id/events", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const events = await tx
        .select()
        .from(churchInventoryAssetEvents)
        .where(and(
          eq(churchInventoryAssetEvents.tenantId, context.tenantId),
          eq(churchInventoryAssetEvents.assetId, request.params.id),
        ))
        .orderBy(desc(churchInventoryAssetEvents.occurredAt));
      return reply.send({ events });
    });
  });

  // POST /v1/admin/church/inventory-assets/:id/events
  app.post<{ Params: { id: string } }>("/admin/church/inventory-assets/:id/events", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = inventoryAssetEventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [asset] = await tx
        .select({ id: churchInventoryAssets.id })
        .from(churchInventoryAssets)
        .where(and(eq(churchInventoryAssets.tenantId, context.tenantId), eq(churchInventoryAssets.id, request.params.id)))
        .limit(1);

      if (!asset) {
        return reply.code(404).send({ error: "ASSET_NOT_FOUND", message: "Inventory asset not found." });
      }

      const [event] = await tx
        .insert(churchInventoryAssetEvents)
        .values({
          tenantId: context.tenantId,
          assetId: asset.id,
          eventType: parsed.data.eventType,
          description: parsed.data.description,
          recordedBy: parsed.data.recordedBy || context.email,
          occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
        })
        .returning();

      return reply.code(201).send({ event });
    });
  });
}

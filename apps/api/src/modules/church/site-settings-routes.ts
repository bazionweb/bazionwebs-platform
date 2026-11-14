import type { FastifyInstance } from "fastify";
import { and, desc, eq, max } from "drizzle-orm";
import {
  churchSiteSettingsInputSchema,
  siteSettingsPublishInputSchema,
  siteSettingsRollbackInputSchema,
  type ChurchSiteSettingsInput,
} from "@bazion/church-ministry-contracts";
import {
  leadershipProfiles,
  ministryProfiles,
  ministrySettings,
  ministrySiteSettingsVersions,
  tenants,
} from "@bazion/database";
import { requireActiveTenantPermission } from "@bazion/auth";
import { withTenantTransaction } from "../../lib/database.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";

async function assertChurchEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "church-ministry"))) {
    throw Object.assign(new Error("The church ministry module is not enabled for this tenant."), {
      statusCode: 404,
      code: "CHURCH_MODULE_DISABLED",
    });
  }
}

export async function registerChurchSiteSettingsVersionsRoutes(app: FastifyInstance) {
  // GET /v1/admin/church/site-settings/versions
  app.get("/admin/church/site-settings/versions", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const versions = await tx
        .select({
          id: ministrySiteSettingsVersions.id,
          versionNumber: ministrySiteSettingsVersions.versionNumber,
          status: ministrySiteSettingsVersions.status,
          createdBy: ministrySiteSettingsVersions.createdBy,
          createdAt: ministrySiteSettingsVersions.createdAt,
          publishedAt: ministrySiteSettingsVersions.publishedAt,
          publishedBy: ministrySiteSettingsVersions.publishedBy,
          note: ministrySiteSettingsVersions.note,
        })
        .from(ministrySiteSettingsVersions)
        .where(eq(ministrySiteSettingsVersions.tenantId, context.tenantId))
        .orderBy(desc(ministrySiteSettingsVersions.versionNumber));

      return reply.send({ versions });
    });
  });

  // GET /v1/admin/church/site-settings/preview
  app.get("/admin/church/site-settings/preview", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [tenant] = await tx
        .select({ slug: tenants.slug, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, context.tenantId))
        .limit(1);

      // Check draft first, fallback to published
      const [draft] = await tx
        .select()
        .from(ministrySiteSettingsVersions)
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "draft"),
        ))
        .limit(1);

      const [publishedRow] = await tx
        .select({ settingValue: ministrySettings.settingValue })
        .from(ministrySettings)
        .where(and(eq(ministrySettings.tenantId, context.tenantId), eq(ministrySettings.settingKey, "public_site")))
        .limit(1);

      const [profile] = await tx
        .select()
        .from(ministryProfiles)
        .where(eq(ministryProfiles.tenantId, context.tenantId))
        .limit(1);

      const leaders = await tx
        .select()
        .from(leadershipProfiles)
        .where(and(eq(leadershipProfiles.tenantId, context.tenantId), eq(leadershipProfiles.status, "active")))
        .orderBy(leadershipProfiles.displayOrder);

      const siteSettings = draft
        ? draft.settings
        : (publishedRow?.settingValue ? JSON.parse(publishedRow.settingValue) : null);

      return reply.send({
        tenant: tenant ?? null,
        profile: draft ? draft.profile : (profile ?? null),
        leaders: leaders.map(({ name, position, biography, photoUrl }) => ({ name, position, biography, photoUrl })),
        siteSettings,
        isDraft: Boolean(draft),
        versionNumber: draft?.versionNumber ?? null,
      });
    });
  });

  // PUT /v1/admin/church/site-settings/draft
  app.put("/admin/church/site-settings/draft", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = churchSiteSettingsInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", issues: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      // Find highest version number
      const [maxVerRow] = await tx
        .select({ maxVer: max(ministrySiteSettingsVersions.versionNumber) })
        .from(ministrySiteSettingsVersions)
        .where(eq(ministrySiteSettingsVersions.tenantId, context.tenantId));

      const nextVersion = (maxVerRow?.maxVer ?? 0) + 1;

      // Upsert current draft
      const [existingDraft] = await tx
        .select({ id: ministrySiteSettingsVersions.id, versionNumber: ministrySiteSettingsVersions.versionNumber })
        .from(ministrySiteSettingsVersions)
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "draft"),
        ))
        .limit(1);

      if (existingDraft) {
        await tx
          .update(ministrySiteSettingsVersions)
          .set({
            settings: parsed.data.settings,
            profile: parsed.data.profile,
            createdBy: context.email,
            note: (request.body as { note?: string })?.note || "Draft updated",
          })
          .where(and(
            eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
            eq(ministrySiteSettingsVersions.id, existingDraft.id),
          ));

        return reply.send({ success: true, versionNumber: existingDraft.versionNumber, status: "draft" });
      }

      const [newDraft] = await tx
        .insert(ministrySiteSettingsVersions)
        .values({
          tenantId: context.tenantId,
          versionNumber: nextVersion,
          settings: parsed.data.settings,
          profile: parsed.data.profile,
          status: "draft",
          createdBy: context.email,
          note: (request.body as { note?: string })?.note || "Draft created",
        })
        .returning();

      return reply.code(201).send({ success: true, versionNumber: newDraft!.versionNumber, status: "draft" });
    });
  });

  // POST /v1/admin/church/site-settings/publish
  app.post("/admin/church/site-settings/publish", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsedNote = siteSettingsPublishInputSchema.safeParse(request.body || {});
    const note = parsedNote.success ? parsedNote.data.note : undefined;

    return withTenantTransaction(context.tenantId, async (tx) => {
      // Find draft if present
      const [draft] = await tx
        .select()
        .from(ministrySiteSettingsVersions)
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "draft"),
        ))
        .limit(1);

      let settingsToPublish = draft ? (draft.settings as ChurchSiteSettingsInput["settings"]) : null;
      let profileToPublish = draft ? (draft.profile as ChurchSiteSettingsInput["profile"]) : null;

      // If no draft was pending, check if a body was supplied directly to publish
      if (!settingsToPublish || !profileToPublish) {
        const directParse = churchSiteSettingsInputSchema.safeParse(request.body);
        if (directParse.success) {
          settingsToPublish = directParse.data.settings;
          profileToPublish = directParse.data.profile;
        } else {
          return reply.code(400).send({
            error: "NO_DRAFT_TO_PUBLISH",
            message: "No unpublished draft exists. Supply settings in the body to publish directly.",
          });
        }
      }

      // Mark all existing published versions as superseded
      await tx
        .update(ministrySiteSettingsVersions)
        .set({ status: "superseded" })
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "published"),
        ));

      // Calculate version number
      const [maxVerRow] = await tx
        .select({ maxVer: max(ministrySiteSettingsVersions.versionNumber) })
        .from(ministrySiteSettingsVersions)
        .where(eq(ministrySiteSettingsVersions.tenantId, context.tenantId));

      const nextVersion = draft ? draft.versionNumber : ((maxVerRow?.maxVer ?? 0) + 1);

      if (draft) {
        await tx
          .update(ministrySiteSettingsVersions)
          .set({
            status: "published",
            publishedAt: new Date(),
            publishedBy: context.email,
            note: note || "Published changes",
          })
          .where(and(
            eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
            eq(ministrySiteSettingsVersions.id, draft.id),
          ));
      } else {
        await tx.insert(ministrySiteSettingsVersions).values({
          tenantId: context.tenantId,
          versionNumber: nextVersion,
          settings: settingsToPublish,
          profile: profileToPublish,
          status: "published",
          publishedAt: new Date(),
          publishedBy: context.email,
          note: note || "Direct publish",
        });
      }

      // Atomically update ministry_profiles and ministry_settings (public_site)
      await tx
        .insert(ministryProfiles)
        .values({
          tenantId: context.tenantId,
          ministryName: profileToPublish.ministryName,
          logoAssetUrl: profileToPublish.logoUrl,
          description: profileToPublish.tagline,
          vision: profileToPublish.vision,
          mission: profileToPublish.mission,
          outreach: profileToPublish.outreach,
          address: profileToPublish.contact.address,
          email: profileToPublish.contact.email,
          telephoneNumbers: profileToPublish.contact.phones,
          socialLinks: profileToPublish.social,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [ministryProfiles.tenantId],
          set: {
            ministryName: profileToPublish.ministryName,
            logoAssetUrl: profileToPublish.logoUrl,
            description: profileToPublish.tagline,
            vision: profileToPublish.vision,
            mission: profileToPublish.mission,
            outreach: profileToPublish.outreach,
            address: profileToPublish.contact.address,
            email: profileToPublish.contact.email,
            telephoneNumbers: profileToPublish.contact.phones,
            socialLinks: profileToPublish.social,
            updatedAt: new Date(),
          },
        });

      await tx
        .insert(ministrySettings)
        .values({
          tenantId: context.tenantId,
          settingKey: "public_site",
          settingValue: JSON.stringify(settingsToPublish),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [ministrySettings.tenantId, ministrySettings.settingKey],
          set: {
            settingValue: JSON.stringify(settingsToPublish),
            updatedAt: new Date(),
          },
        });

      return reply.send({
        success: true,
        versionNumber: nextVersion,
        publishedAt: new Date().toISOString(),
        publishedBy: context.email,
      });
    });
  });

  // DELETE /v1/admin/church/site-settings/draft
  app.delete("/admin/church/site-settings/draft", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [deleted] = await tx
        .delete(ministrySiteSettingsVersions)
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "draft"),
        ))
        .returning({ id: ministrySiteSettingsVersions.id });

      if (!deleted) {
        return reply.code(404).send({ error: "NO_DRAFT_FOUND", message: "No active draft exists to discard." });
      }

      return reply.send({ success: true, message: "Draft discarded successfully." });
    });
  });

  // POST /v1/admin/church/site-settings/versions/:versionNumber/rollback
  app.post<{ Params: { versionNumber: string } }>("/admin/church/site-settings/versions/:versionNumber/rollback", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const targetVersion = Number(request.params.versionNumber);
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      return reply.code(400).send({ error: "INVALID_VERSION_NUMBER", message: "Target version must be a positive integer." });
    }

    const parsedNote = siteSettingsRollbackInputSchema.safeParse(request.body || {});
    const note = parsedNote.success ? parsedNote.data.note : undefined;

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [targetRow] = await tx
        .select()
        .from(ministrySiteSettingsVersions)
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.versionNumber, targetVersion),
        ))
        .limit(1);

      if (!targetRow) {
        return reply.code(404).send({ error: "VERSION_NOT_FOUND", message: `Version ${targetVersion} not found.` });
      }

      // Mark current published version as superseded
      await tx
        .update(ministrySiteSettingsVersions)
        .set({ status: "superseded" })
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "published"),
        ));

      // Discard any active draft
      await tx
        .delete(ministrySiteSettingsVersions)
        .where(and(
          eq(ministrySiteSettingsVersions.tenantId, context.tenantId),
          eq(ministrySiteSettingsVersions.status, "draft"),
        ));

      // Calculate next version number (immutable history - rollback creates a new version)
      const [maxVerRow] = await tx
        .select({ maxVer: max(ministrySiteSettingsVersions.versionNumber) })
        .from(ministrySiteSettingsVersions)
        .where(eq(ministrySiteSettingsVersions.tenantId, context.tenantId));

      const newVersion = (maxVerRow?.maxVer ?? 0) + 1;
      const rollbackNote = note || `Rolled back to version ${targetVersion}`;

      const [published] = await tx
        .insert(ministrySiteSettingsVersions)
        .values({
          tenantId: context.tenantId,
          versionNumber: newVersion,
          settings: targetRow.settings,
          profile: targetRow.profile,
          status: "published",
          publishedAt: new Date(),
          publishedBy: context.email,
          note: rollbackNote,
        })
        .returning();

      const profile = targetRow.profile as ChurchSiteSettingsInput["profile"];
      const settings = targetRow.settings as ChurchSiteSettingsInput["settings"];

      // Update active settings row
      await tx
        .insert(ministrySettings)
        .values({
          tenantId: context.tenantId,
          settingKey: "public_site",
          settingValue: JSON.stringify(settings),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [ministrySettings.tenantId, ministrySettings.settingKey],
          set: {
            settingValue: JSON.stringify(settings),
            updatedAt: new Date(),
          },
        });

      await tx
        .insert(ministryProfiles)
        .values({
          tenantId: context.tenantId,
          ministryName: profile.ministryName,
          logoAssetUrl: profile.logoUrl,
          description: profile.tagline,
          vision: profile.vision,
          mission: profile.mission,
          outreach: profile.outreach,
          address: profile.contact.address,
          email: profile.contact.email,
          telephoneNumbers: profile.contact.phones,
          socialLinks: profile.social,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [ministryProfiles.tenantId],
          set: {
            ministryName: profile.ministryName,
            logoAssetUrl: profile.logoUrl,
            description: profile.tagline,
            vision: profile.vision,
            mission: profile.mission,
            outreach: profile.outreach,
            address: profile.contact.address,
            email: profile.contact.email,
            telephoneNumbers: profile.contact.phones,
            socialLinks: profile.social,
            updatedAt: new Date(),
          },
        });

      return reply.send({
        success: true,
        versionNumber: newVersion,
        rolledBackFromVersion: targetVersion,
        publishedAt: published!.publishedAt,
        publishedBy: context.email,
      });
    });
  });
}

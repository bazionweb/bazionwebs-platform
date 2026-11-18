import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { requirePlatformRole } from "@bazion/auth";
import { getPlatformTenant, updatePlatformTenantModuleEntitlements } from "@bazion/auth/server";
import {
  churchTemplateCatalog,
  createWhiteLabeledChurchConfig,
  createChurchSiteSettingsOverlay,
  extractWhiteLabelTemplateFromRepoSource,
  type ChurchTheme,
} from "@bazion/church-ministry-template";
import { smeWebsiteTemplateConfigSchema } from "@bazion/sme-website-template";
import {
  buildWhiteLabelPackageOverlay,
  createWhiteLabeledPackageConfig,
  extractWhiteLabelFromRepoSource,
  generateByowDokployCompose,
  isTenantTemplateOverlay,
  platformWhiteLabelPackageCatalog,
  resolveWhiteLabelPackageOverlay,
  universalThemePalettes,
  type WhiteLabelPackageId,
  type WhiteLabelPaletteId,
} from "@bazion/website-contracts";
import {
  ministryProfiles,
  ministrySettings,
  ministrySiteSettingsVersions,
} from "@bazion/database";
import { pool, withTenantTransaction } from "../../lib/database.js";

const auditWriter = new PostgresAuditEventWriter(pool);
const tenantIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const packageIds = [
  "sme-website",
  "ecommerce",
  "professional-services",
  "clinic-management",
  "school-education",
  "ngo-membership",
  "startup-saas",
  "enterprise-erp",
  "church-ministry",
] as const;

const paletteIds = [
  "corporate-slate",
  "emerald-growth",
  "medical-teal",
  "maroon-gold",
  "forest-bronze",
  "royal-navy",
  "living-waters",
  "sanctuary-charcoal",
] as const;

const byowFrameworks = [
  "nextjs",
  "react-vite",
  "astro",
  "remix",
  "wordpress",
  "static",
  "custom-docker",
] as const;

const churchTemplateIds = new Set<string>([
  "gmfc-revival-signature",
  "church-ministry",
  "royal-cathedral",
  "hkm-kingdom-cms",
]);

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an HTTPS URL.");

const brandContactSchema = z
  .object({
    address: z.string().trim().max(500).optional(),
    poBox: z.string().trim().max(200).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    phones: z.array(z.string().trim().min(7).max(30)).max(10).optional(),
    whatsappNumber: z.string().trim().max(30).optional(),
    googleMapsUrl: optionalHttpsUrl.optional(),
  })
  .optional();

const brandPaymentSchema = z
  .object({
    mpesaPaybill: z.string().trim().max(30).optional(),
    accountNo: z.string().trim().max(60).optional(),
    accountName: z.string().trim().max(100).optional(),
    instructions: z.string().trim().max(1000).optional(),
    currency: z.enum(["KES", "USD", "EUR", "GBP"]).optional(),
    suggestedAmounts: z.array(z.number().int().min(10).max(250000)).max(8).optional(),
  })
  .optional();

const brandSocialSchema = z
  .object({
    youtube: optionalHttpsUrl.optional(),
    facebook: optionalHttpsUrl.optional(),
    instagram: optionalHttpsUrl.optional(),
    twitter: optionalHttpsUrl.optional(),
    whatsapp: optionalHttpsUrl.optional(),
    linkedin: optionalHttpsUrl.optional(),
  })
  .optional();

const offeringInputSchema = z.object({
  id: z.string().trim().max(80).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(4).max(600),
  category: z.string().trim().max(80).optional(),
});

const applyTemplateBodySchema = z.object({
  packageId: z.enum(packageIds).optional(),
  templateId: z.string().trim().min(1).max(80).default("sme-corporate-authority"),
  brandName: z.string().trim().min(2).max(180).optional(),
  ministryName: z.string().trim().min(2).max(180).optional(),
  tagline: z.string().trim().max(500).optional(),
  introduction: z.string().trim().max(1200).optional(),
  about: z.string().trim().max(6000).optional(),
  logoUrl: z.string().trim().max(2048).optional(),
  paletteId: z.enum(paletteIds).optional(),
  themePreset: z.enum(paletteIds).optional(),
  primaryColor: z.string().trim().regex(/^#?[0-9a-fA-F]{3,6}$/).optional(),
  secondaryColor: z.string().trim().regex(/^#?[0-9a-fA-F]{3,6}$/).optional(),
  accentColor: z.string().trim().regex(/^#?[0-9a-fA-F]{3,6}$/).optional(),
  includeStarterContent: z.boolean().default(true),
  contact: brandContactSchema,
  payment: brandPaymentSchema,
  giving: brandPaymentSchema,
  social: brandSocialSchema,
  offerings: z.array(offeringInputSchema).max(20).optional(),
});

const importRepoBodySchema = z.object({
  repoUrl: z.string().trim().url().max(500),
  branch: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._/-]+$/)
    .default("main"),
  packageId: z.enum([...packageIds, "auto"]).default("auto"),
  mode: z.enum(["whitelabel-storefront", "byow-compose"]).default("whitelabel-storefront"),
  framework: z.enum(byowFrameworks).default("nextjs"),
  applyToTenant: z.boolean().default(true),
  primaryDomain: z.string().trim().max(255).optional(),
  configTs: z.string().max(100_000).optional(),
  tokensCss: z.string().max(100_000).optional(),
  packageJson: z.string().max(100_000).optional(),
  brandOverrides: z
    .object({
      brandName: z.string().trim().min(2).max(180).optional(),
      ministryName: z.string().trim().min(2).max(180).optional(),
      tagline: z.string().trim().max(500).optional(),
      primaryColor: z.string().trim().regex(/^#?[0-9a-fA-F]{3,6}$/).optional(),
      secondaryColor: z.string().trim().regex(/^#?[0-9a-fA-F]{3,6}$/).optional(),
      accentColor: z.string().trim().regex(/^#?[0-9a-fA-F]{3,6}$/).optional(),
      includeStarterContent: z.boolean().optional(),
      contact: brandContactSchema,
      payment: brandPaymentSchema,
      giving: brandPaymentSchema,
      social: brandSocialSchema,
    })
    .optional(),
});

function parseGitHubRepoSlug(repoUrl: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com") {
      return null;
    }
    const match = parsed.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
    if (!match?.[1] || !match[2]) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

async function fetchGitHubRawCandidate(
  owner: string,
  repo: string,
  branch: string,
  paths: string[],
): Promise<string | undefined> {
  for (const candidatePath of paths) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${candidatePath}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4_500) });
      if (response.ok) {
        const text = await response.text();
        if (text.trim().length > 0 && text.length <= 100_000) {
          return text;
        }
      }
    } catch {
      // Ignore network/timeout errors gracefully.
    }
  }
  return undefined;
}

function toChurchPreset(paletteId: WhiteLabelPaletteId | undefined): ChurchTheme["preset"] | undefined {
  if (
    paletteId === "maroon-gold" ||
    paletteId === "forest-bronze" ||
    paletteId === "royal-navy" ||
    paletteId === "living-waters" ||
    paletteId === "sanctuary-charcoal"
  ) {
    return paletteId;
  }
  return undefined;
}

function buildOptionalContact(contact: z.infer<typeof brandContactSchema>) {
  if (!contact) return undefined;
  return {
    ...(contact.address !== undefined ? { address: contact.address } : {}),
    ...(contact.poBox !== undefined ? { poBox: contact.poBox } : {}),
    ...(contact.email !== undefined ? { email: contact.email } : {}),
    ...(contact.phones !== undefined ? { phones: contact.phones } : {}),
    ...(contact.whatsappNumber !== undefined ? { whatsappNumber: contact.whatsappNumber } : {}),
    ...(contact.googleMapsUrl !== undefined ? { googleMapsUrl: contact.googleMapsUrl } : {}),
  };
}

function buildOptionalPayment(payment: z.infer<typeof brandPaymentSchema>) {
  if (!payment) return undefined;
  return {
    ...(payment.mpesaPaybill !== undefined ? { mpesaPaybill: payment.mpesaPaybill } : {}),
    ...(payment.accountNo !== undefined ? { accountNo: payment.accountNo } : {}),
    ...(payment.accountName !== undefined ? { accountName: payment.accountName } : {}),
    ...(payment.instructions !== undefined ? { instructions: payment.instructions } : {}),
    ...(payment.currency !== undefined ? { currency: payment.currency } : {}),
    ...(payment.suggestedAmounts !== undefined ? { suggestedAmounts: payment.suggestedAmounts } : {}),
  };
}

function buildOptionalSocial(social: z.infer<typeof brandSocialSchema>) {
  if (!social) return undefined;
  return {
    ...(social.youtube !== undefined ? { youtube: social.youtube } : {}),
    ...(social.facebook !== undefined ? { facebook: social.facebook } : {}),
    ...(social.instagram !== undefined ? { instagram: social.instagram } : {}),
    ...(social.twitter !== undefined ? { twitter: social.twitter } : {}),
    ...(social.whatsapp !== undefined ? { whatsapp: social.whatsapp } : {}),
    ...(social.linkedin !== undefined ? { linkedin: social.linkedin } : {}),
  };
}

async function enablePackageModules(tenantId: string, modules: readonly string[], actorUserId: string) {
  await updatePlatformTenantModuleEntitlements({
    tenantId,
    moduleIds: modules,
    enabled: true,
    actorUserId,
  });
}

async function persistPackageSettingKey(
  tenantId: string,
  settingKey: string,
  value: unknown,
): Promise<void> {
  const now = new Date();
  await withTenantTransaction(tenantId, async (tx) => {
    await tx
      .insert(ministrySettings)
      .values({
        tenantId,
        settingKey,
        settingValue: JSON.stringify(value),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [ministrySettings.tenantId, ministrySettings.settingKey],
        set: {
          settingValue: JSON.stringify(value),
          updatedAt: now,
        },
      });
  });
}

async function persistChurchSiteSettings(params: {
  tenantId: string;
  tenantSlug: string;
  actorEmail: string;
  note: string;
  siteSettingsInput: ReturnType<typeof createWhiteLabeledChurchConfig>["siteSettingsInput"];
  packageSettings: unknown;
  updateMode?: "automatic" | "pinned";
}): Promise<number> {
  const { profile, settings } = params.siteSettingsInput;
  const settingsOverlay = createChurchSiteSettingsOverlay({
    tenantSlug: params.tenantSlug,
    ministryName: profile.ministryName,
    settings,
    ...(params.updateMode ? { updateMode: params.updateMode } : {}),
  });
  const settingsValue = JSON.stringify(settingsOverlay);
  const now = new Date();

  return withTenantTransaction(params.tenantId, async (tx) => {
    await tx
      .update(ministrySiteSettingsVersions)
      .set({ status: "superseded" })
      .where(
        and(
          eq(ministrySiteSettingsVersions.tenantId, params.tenantId),
          eq(ministrySiteSettingsVersions.status, "published"),
        ),
      );

    const [maxVerRow] = await tx
      .select({ maxVer: max(ministrySiteSettingsVersions.versionNumber) })
      .from(ministrySiteSettingsVersions)
      .where(eq(ministrySiteSettingsVersions.tenantId, params.tenantId));

    const nextVersion = (maxVerRow?.maxVer ?? 0) + 1;

    await tx.insert(ministrySiteSettingsVersions).values({
      tenantId: params.tenantId,
      versionNumber: nextVersion,
      settings: settingsOverlay,
      profile,
      status: "published",
      publishedAt: now,
      publishedBy: params.actorEmail,
      note: params.note,
    });

    await tx
      .insert(ministryProfiles)
      .values({
        tenantId: params.tenantId,
        ministryName: profile.ministryName,
        logoAssetUrl: profile.logoUrl || null,
        description: profile.tagline,
        vision: profile.vision,
        mission: profile.mission,
        outreach: profile.outreach,
        address: profile.contact.address,
        email: profile.contact.email || null,
        telephoneNumbers: profile.contact.phones,
        socialLinks: profile.social,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [ministryProfiles.tenantId],
        set: {
          ministryName: profile.ministryName,
          logoAssetUrl: profile.logoUrl || null,
          description: profile.tagline,
          vision: profile.vision,
          mission: profile.mission,
          outreach: profile.outreach,
          address: profile.contact.address,
          email: profile.contact.email || null,
          telephoneNumbers: profile.contact.phones,
          socialLinks: profile.social,
          updatedAt: now,
        },
      });

    for (const [settingKey, settingValue] of [
      ["public_site", settingsValue],
      ["package_whitelabel_config", JSON.stringify(params.packageSettings)],
    ] as const) {
      await tx
        .insert(ministrySettings)
        .values({
          tenantId: params.tenantId,
          settingKey,
          settingValue,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [ministrySettings.tenantId, ministrySettings.settingKey],
          set: {
            settingValue,
            updatedAt: now,
          },
        });
    }

    return nextVersion;
  });
}

function parseJsonSafe(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function websiteOnboardingRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { tenantId: string } }>(
    "/admin/platform/tenants/:tenantId/website-onboarding",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      if (!tenantIdPattern.test(tenantId)) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }

      await requirePlatformRole(request.headers, ["platform_owner"]);
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) {
        return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      }

      const snapshot = await withTenantTransaction(tenantId, async (tx) => {
        const [profileRow] = await tx
          .select({
            ministryName: ministryProfiles.ministryName,
            description: ministryProfiles.description,
            address: ministryProfiles.address,
            email: ministryProfiles.email,
            updatedAt: ministryProfiles.updatedAt,
          })
          .from(ministryProfiles)
          .where(eq(ministryProfiles.tenantId, tenantId))
          .limit(1);

        const settingsRows = await tx
          .select({
            settingKey: ministrySettings.settingKey,
            settingValue: ministrySettings.settingValue,
            updatedAt: ministrySettings.updatedAt,
          })
          .from(ministrySettings)
          .where(
            and(
              eq(ministrySettings.tenantId, tenantId),
              inArray(ministrySettings.settingKey, [
                "public_site",
                "package_whitelabel_config",
                "byow_compose_blueprint",
              ]),
            ),
          );

        const latestVersions = await tx
          .select({
            versionNumber: ministrySiteSettingsVersions.versionNumber,
            publishedAt: ministrySiteSettingsVersions.publishedAt,
            note: ministrySiteSettingsVersions.note,
          })
          .from(ministrySiteSettingsVersions)
          .where(
            and(
              eq(ministrySiteSettingsVersions.tenantId, tenantId),
              eq(ministrySiteSettingsVersions.status, "published"),
            ),
          )
          .orderBy(desc(ministrySiteSettingsVersions.versionNumber))
          .limit(1);

        return { profileRow, settingsRows, latestVersion: latestVersions[0] ?? null };
      });

      const byowRow = snapshot.settingsRows.find((r) => r.settingKey === "byow_compose_blueprint");
      const packageRow = snapshot.settingsRows.find(
        (r) => r.settingKey === "package_whitelabel_config",
      );
      const storedPackageConfig = parseJsonSafe(packageRow?.settingValue);
      const activePackageConfig = resolveWhiteLabelPackageOverlay(storedPackageConfig, tenant.slug);
      const overlay = isTenantTemplateOverlay(storedPackageConfig) ? storedPackageConfig : null;
      const rawPackageSettings = storedPackageConfig && typeof storedPackageConfig === "object"
        ? ((storedPackageConfig as Record<string, unknown>).packageSettings
          && typeof (storedPackageConfig as Record<string, unknown>).packageSettings === "object"
          ? (storedPackageConfig as Record<string, unknown>).packageSettings as Record<string, unknown>
          : storedPackageConfig as Record<string, unknown>)
        : null;
      const activeConfigRecord = activePackageConfig && typeof activePackageConfig === "object"
        ? activePackageConfig as Record<string, unknown>
        : null;
      const templatePackageId = overlay?.packageId
        ?? rawPackageSettings?.packageId
        ?? activeConfigRecord?.packageId;
      const templateId = overlay?.templateId
        ?? rawPackageSettings?.templateId
        ?? activeConfigRecord?.templateId;
      const currentPackage = platformWhiteLabelPackageCatalog.find((item) => item.packageId === templatePackageId);
      const currentTemplate = currentPackage?.templates.find((item) => item.id === templateId);
      const configuredVersion = overlay?.templateVersion
        ?? (typeof rawPackageSettings?.templateVersion === "string" ? rawPackageSettings.templateVersion : currentTemplate?.version);
      const hasPinnedSource = rawPackageSettings?.updateMode === "pinned"
        || typeof rawPackageSettings?.repoUrl === "string"
        || typeof rawPackageSettings?.sourceRepoUrl === "string";
      const storedSiteRow = snapshot.settingsRows.find((row) => row.settingKey === "public_site");
      const storedSiteSettings = parseJsonSafe(storedSiteRow?.settingValue);
      const storedSiteRecord = storedSiteSettings && typeof storedSiteSettings === "object"
        ? storedSiteSettings as Record<string, unknown>
        : null;
      const storedSiteOverlay = isTenantTemplateOverlay(storedSiteSettings) ? storedSiteSettings : null;
      const nestedSiteOverrides = storedSiteRecord?.overrides && typeof storedSiteRecord.overrides === "object"
        ? storedSiteRecord.overrides as Record<string, unknown>
        : null;
      const churchTemplateId = storedSiteOverlay?.templateId
        ?? storedSiteRecord?.templateId
        ?? nestedSiteOverrides?.templateId;
      const currentChurchTemplate = churchTemplateCatalog.find((item) => item.id === churchTemplateId);
      const churchConfiguredVersion = storedSiteOverlay?.templateVersion
        ?? (typeof storedSiteRecord?.templateVersion === "string" ? storedSiteRecord.templateVersion : undefined)
        ?? (typeof nestedSiteOverrides?.templateVersion === "string" ? nestedSiteOverrides.templateVersion : undefined)
        ?? (currentChurchTemplate ? "1.0.0" : undefined);
      const websiteTemplateRelease = currentTemplate ? {
        templateId: currentTemplate.id,
        configuredVersion: configuredVersion ?? currentTemplate.version,
        currentVersion: currentTemplate.version,
        updateMode: overlay?.updateMode ?? (hasPinnedSource ? "pinned" as const : "automatic" as const),
      } : currentChurchTemplate ? {
        templateId: currentChurchTemplate.id,
        configuredVersion: churchConfiguredVersion ?? currentChurchTemplate.version,
        currentVersion: currentChurchTemplate.version,
        updateMode: storedSiteOverlay?.updateMode ?? (storedSiteRecord?.updateMode === "pinned" ? "pinned" as const : "automatic" as const),
      } : null;

      return reply.send({
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          status: tenant.status,
        },
        packages: platformWhiteLabelPackageCatalog,
        palettes: universalThemePalettes,
        templates: churchTemplateCatalog,
        currentProfile: snapshot.profileRow ?? null,
        activePackageConfig,
        templateRelease: websiteTemplateRelease,
        hasStoredSiteSettings: snapshot.settingsRows.some(
          (r) => r.settingKey === "public_site" && Boolean(r.settingValue),
        ),
        latestPublishedVersion: snapshot.latestVersion,
        byowBlueprint: parseJsonSafe(byowRow?.settingValue),
      });
    },
  );

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/tenants/:tenantId/website-onboarding/apply-template",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      if (!tenantIdPattern.test(tenantId)) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }

      const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) {
        return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      }

      const parsed = applyTemplateBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          details: parsed.error.flatten(),
        });
      }

      const body = parsed.data;
      const inferredPackageId: WhiteLabelPackageId =
        body.packageId ??
        (churchTemplateIds.has(body.templateId) ? "church-ministry" : "sme-website");
      const brandName = body.brandName ?? body.ministryName ?? tenant.name;
      const paletteId = body.paletteId ?? body.themePreset;
      const contact = buildOptionalContact(body.contact);
      const payment = buildOptionalPayment(body.payment ?? body.giving);
      const social = buildOptionalSocial(body.social);
      const normalizedOfferings = body.offerings?.map((item) => ({
        ...(item.id !== undefined ? { id: item.id } : {}),
        name: item.name,
        description: item.description,
        ...(item.category !== undefined ? { category: item.category } : {}),
      }));

      const universal = createWhiteLabeledPackageConfig({
        packageId: inferredPackageId,
        templateId: body.templateId,
        tenantSlug: tenant.slug,
        brandName,
        ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
        ...(body.introduction !== undefined ? { introduction: body.introduction } : {}),
        ...(body.about !== undefined ? { about: body.about } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
        ...(paletteId !== undefined ? { paletteId } : {}),
        themeOverrides: {
          ...(body.primaryColor ? { primaryColor: body.primaryColor } : {}),
          ...(body.secondaryColor ? { secondaryColor: body.secondaryColor } : {}),
          ...(body.accentColor ? { accentColor: body.accentColor } : {}),
        },
        ...(contact ? { contact } : {}),
        ...(payment ? { payment } : {}),
        ...(social ? { social } : {}),
        ...(normalizedOfferings ? { offerings: normalizedOfferings } : {}),
        includeStarterContent: body.includeStarterContent,
      });
      const packageOverlay = buildWhiteLabelPackageOverlay(universal, {
        tenantSlug: tenant.slug,
        brandName,
      });

      await enablePackageModules(tenantId, universal.assignableModules, operator.userId);

      let churchConfig: ReturnType<typeof createWhiteLabeledChurchConfig>["config"] | null = null;
      let versionNumber: number | null = null;

      if (universal.packageDescriptor.packageId === "church-ministry") {
        const churchTemplateId = churchTemplateIds.has(body.templateId)
          ? (body.templateId as "gmfc-revival-signature" | "church-ministry" | "royal-cathedral" | "hkm-kingdom-cms")
          : "gmfc-revival-signature";
        const preset = toChurchPreset(paletteId);
        const generatedChurch = createWhiteLabeledChurchConfig({
          tenantSlug: tenant.slug,
          ministryName: brandName,
          templateId: churchTemplateId,
          ...(body.tagline !== undefined ? { tagline: body.tagline } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(preset !== undefined ? { themePreset: preset } : {}),
          themeOverrides: {
            ...(body.primaryColor ? { primaryColor: body.primaryColor } : {}),
            ...(body.secondaryColor ? { secondaryColor: body.secondaryColor } : {}),
            ...(body.accentColor ? { accentColor: body.accentColor } : {}),
          },
          ...(contact ? { contact } : {}),
          ...(payment ? { giving: payment } : {}),
          ...(social ? { social } : {}),
          includeStarterContent: body.includeStarterContent,
        });
        churchConfig = generatedChurch.config;
        versionNumber = await persistChurchSiteSettings({
          tenantId,
          tenantSlug: tenant.slug,
          actorEmail: operator.userId,
          note: `Applied white-label package ${universal.packageDescriptor.packageId} (${universal.template.id})`,
          siteSettingsInput: generatedChurch.siteSettingsInput,
          packageSettings: packageOverlay,
        });
      } else {
        if (universal.packageDescriptor.packageId === "sme-website") {
          smeWebsiteTemplateConfigSchema.parse(universal.smeConfig);
        }
        await persistPackageSettingKey(tenantId, "package_whitelabel_config", {
          ...packageOverlay,
        });
      }

      await auditWriter
        .append({
          actorType: "user",
          actorId: operator.userId,
          actorRole: operator.role,
          tenantId,
          action: "platform.tenant.package_whitelabel.apply",
          outcome: "succeeded",
          resourceType: "tenant_website_package",
          resourceId: tenantId,
          requestId: request.id,
          metadata: {
            packageId: universal.packageDescriptor.packageId,
            templateId: universal.template.id,
            templateVersion: universal.template.version,
            paletteId: universal.palette.id,
            ...(versionNumber !== null ? { versionNumber } : {}),
          },
        })
        .catch(() => undefined);

      return reply.send({
        applied: true,
        packageId: universal.packageDescriptor.packageId,
        packageName: universal.packageDescriptor.name,
        versionNumber,
        template: universal.template,
        palette: universal.palette,
        website: universal.website,
        smeConfig: universal.smeConfig,
        packageSettings: universal.packageSettings,
        assignableModules: universal.assignableModules,
        ...(churchConfig ? { config: churchConfig } : {}),
      });
    },
  );

  app.post<{ Params: { tenantId: string } }>(
    "/admin/platform/tenants/:tenantId/website-onboarding/import-repo",
    async (request, reply) => {
      const tenantId = request.params.tenantId.trim();
      if (!tenantIdPattern.test(tenantId)) {
        return reply.code(400).send({ error: "INVALID_INPUT" });
      }

      const operator = await requirePlatformRole(request.headers, ["platform_owner"]);
      const tenant = await getPlatformTenant(tenantId);
      if (!tenant) {
        return reply.code(404).send({ error: "TENANT_NOT_FOUND" });
      }

      const parsed = importRepoBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "INVALID_INPUT",
          details: parsed.error.flatten(),
        });
      }

      const body = parsed.data;
      let { configTs, tokensCss, packageJson } = body;

      const githubSlug = parseGitHubRepoSlug(body.repoUrl);
      if (githubSlug) {
        const [fetchedConfig, fetchedTokens, fetchedPkg] = await Promise.all([
          configTs
            ? Promise.resolve(configTs)
            : fetchGitHubRawCandidate(githubSlug.owner, githubSlug.repo, body.branch, [
                "src/lib/config.ts",
                "lib/config.ts",
                "src/config.ts",
                "config/site.ts",
              ]),
          tokensCss
            ? Promise.resolve(tokensCss)
            : fetchGitHubRawCandidate(githubSlug.owner, githubSlug.repo, body.branch, [
                "src/styles/tokens.css",
                "src/app/globals.css",
                "app/globals.css",
                "src/index.css",
              ]),
          packageJson
            ? Promise.resolve(packageJson)
            : fetchGitHubRawCandidate(githubSlug.owner, githubSlug.repo, body.branch, ["package.json"]),
        ]);
        configTs = fetchedConfig;
        tokensCss = fetchedTokens;
        packageJson = fetchedPkg;
      }

      const overrides = body.brandOverrides;
      const targetName = overrides?.brandName ?? overrides?.ministryName ?? tenant.name;
      const contact = buildOptionalContact(overrides?.contact);
      const payment = buildOptionalPayment(overrides?.payment ?? overrides?.giving);
      const social = buildOptionalSocial(overrides?.social);

      const universalExtract = extractWhiteLabelFromRepoSource({
        repoUrl: body.repoUrl,
        packageId: body.packageId,
        ...(configTs ? { configSource: configTs } : {}),
        ...(tokensCss ? { styleSource: tokensCss } : {}),
        ...(packageJson ? { packageJson } : {}),
        targetBrand: {
          tenantSlug: tenant.slug,
          brandName: targetName,
          ...(overrides?.tagline !== undefined ? { tagline: overrides.tagline } : {}),
          ...(overrides?.primaryColor ? { primaryColor: overrides.primaryColor } : {}),
          ...(overrides?.secondaryColor ? { secondaryColor: overrides.secondaryColor } : {}),
          ...(overrides?.accentColor ? { accentColor: overrides.accentColor } : {}),
          ...(contact ? { contact } : {}),
          ...(payment ? { payment } : {}),
          ...(social ? { social } : {}),
          ...(overrides?.includeStarterContent !== undefined
            ? { includeStarterContent: overrides.includeStarterContent }
            : {}),
        },
      });

      const resolvedPackageId = universalExtract.inferredPackageId;
      const importedPackageOverlay = buildWhiteLabelPackageOverlay(
        universalExtract.generated,
        { tenantSlug: tenant.slug, brandName: targetName },
        "pinned",
      );
      const byowCompose = generateByowDokployCompose({
        tenantId,
        tenantSlug: tenant.slug,
        packageId: resolvedPackageId,
        ...(body.primaryDomain ? { primaryDomain: body.primaryDomain } : {}),
        repoUrl: body.repoUrl,
        branch: body.branch,
        framework: body.framework,
      });

      let churchConfig: ReturnType<typeof createWhiteLabeledChurchConfig>["config"] | null = null;
      let churchSiteSettingsInput:
        | ReturnType<typeof createWhiteLabeledChurchConfig>["siteSettingsInput"]
        | null = null;

      if (resolvedPackageId === "church-ministry") {
        const churchExtract = extractWhiteLabelTemplateFromRepoSource({
          repoUrl: body.repoUrl,
          ...(configTs ? { configTs } : {}),
          ...(tokensCss ? { tokensCss } : {}),
          ...(packageJson ? { packageJson } : {}),
          targetBrand: {
            tenantSlug: tenant.slug,
            ministryName: targetName,
            ...(overrides?.tagline !== undefined ? { tagline: overrides.tagline } : {}),
            ...(overrides?.primaryColor ? { primaryColor: overrides.primaryColor } : {}),
            ...(overrides?.secondaryColor ? { secondaryColor: overrides.secondaryColor } : {}),
            ...(overrides?.accentColor ? { accentColor: overrides.accentColor } : {}),
            ...(contact ? { contact } : {}),
            ...(payment ? { giving: payment } : {}),
            ...(social ? { social } : {}),
            ...(overrides?.includeStarterContent !== undefined
              ? { includeStarterContent: overrides.includeStarterContent }
              : {}),
          },
        });
        churchConfig = churchExtract.generated.config;
        churchSiteSettingsInput = churchExtract.generated.siteSettingsInput;
      }

      let versionNumber: number | null = null;
      if (body.applyToTenant) {
        if (body.mode === "whitelabel-storefront") {
          await enablePackageModules(
            tenantId,
            universalExtract.generated.assignableModules,
            operator.userId,
          );
          if (resolvedPackageId === "church-ministry" && churchSiteSettingsInput) {
            versionNumber = await persistChurchSiteSettings({
              tenantId,
              tenantSlug: tenant.slug,
              actorEmail: operator.userId,
              note: `White-labeled repository import (${body.repoUrl})`,
              siteSettingsInput: churchSiteSettingsInput,
              packageSettings: importedPackageOverlay,
              updateMode: "pinned",
            });
          } else {
            await persistPackageSettingKey(tenantId, "package_whitelabel_config", {
              ...importedPackageOverlay,
            });
          }
        } else {
          await persistPackageSettingKey(tenantId, "byow_compose_blueprint", byowCompose);
        }
      }

      await auditWriter
        .append({
          actorType: "user",
          actorId: operator.userId,
          actorRole: operator.role,
          tenantId,
          action: "platform.tenant.website_repo.import",
          outcome: "succeeded",
          resourceType: "tenant_website_package",
          resourceId: tenantId,
          requestId: request.id,
          metadata: {
            packageId: resolvedPackageId,
            mode: body.mode,
            templateId: universalExtract.generated.template.id,
            templateVersion: universalExtract.generated.template.version,
            framework: universalExtract.detectedFramework,
            appliedToTenant: body.applyToTenant,
            variableCount: universalExtract.whiteLabelVariables.length,
          },
        })
        .catch(() => undefined);

      return reply.send({
        mode: body.mode,
        packageId: resolvedPackageId,
        inferredPackageId: resolvedPackageId,
        appliedToTenant: body.applyToTenant,
        versionNumber,
        detectedFramework: universalExtract.detectedFramework,
        detectedSourceBrand: universalExtract.detectedSourceBrand,
        whiteLabelVariables: universalExtract.whiteLabelVariables,
        byowCompose,
        website: universalExtract.generated.website,
        smeConfig: universalExtract.generated.smeConfig,
        packageSettings: universalExtract.generated.packageSettings,
        assignableModules: universalExtract.generated.assignableModules,
        ...(churchConfig ? { config: churchConfig } : {}),
      });
    },
  );
}

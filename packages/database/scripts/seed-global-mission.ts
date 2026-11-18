import { Pool } from "pg";
import {
  createChurchSiteSettingsOverlay,
  globalMissionConfig,
} from "@bazion/church-ministry-template";
import { churchSiteSettingsInputSchema } from "@bazion/church-ministry-contracts";
import { mapGlobalMissionEvents } from "../src/global-mission-migration.js";
import { globalMissionEvents } from "../../../templates/global-mission.events.js";

const TENANT_ID = "7a80eaae-6f8c-44c1-b22a-3dca458f0ec1";
const connectionString = process.env.MIGRATION_DATABASE_URL;
const dryRun = process.argv.includes("--dry-run");

class SeedSkippedError extends Error {}

const { ministryName } = globalMissionConfig;
const input = churchSiteSettingsInputSchema.parse({
  profile: {
    ministryName,
    tagline: globalMissionConfig.tagline,
    logoUrl: globalMissionConfig.branding.logoUrl,
    vision: globalMissionConfig.vision.statement,
    mission: globalMissionConfig.mission.statement,
    outreach: globalMissionConfig.outreach.statement,
    contact: {
      address: globalMissionConfig.contact.address,
      email: globalMissionConfig.contact.email,
      phones: globalMissionConfig.contact.phones,
    },
    social: globalMissionConfig.social,
  },
  settings: {
    templateId: "gmfc-revival-signature",
    theme: globalMissionConfig.theme,
    branding: {
      primaryColor: globalMissionConfig.branding.primaryColor,
      secondaryColor: globalMissionConfig.branding.secondaryColor,
      accentColor: globalMissionConfig.branding.accentColor,
      logoUrl: globalMissionConfig.branding.logoUrl,
      heroImageUrl: globalMissionConfig.branding.heroBgUrl,
    },
    navigation: globalMissionConfig.navigation,
    pages: globalMissionConfig.pages,
    hero: globalMissionConfig.hero,
    statistics: globalMissionConfig.statistics,
    serviceTimes: globalMissionConfig.serviceTimes,
    locations: globalMissionConfig.locations,
    visitorInfo: globalMissionConfig.visitorInfo,
    online: globalMissionConfig.online,
    scripture: globalMissionConfig.scripture,
    departments: globalMissionConfig.departments,
    ministries: globalMissionConfig.ministries,
    groups: globalMissionConfig.groups,
    volunteerTeams: globalMissionConfig.volunteerTeams,
    testimonies: globalMissionConfig.testimonies,
    galleryImages: globalMissionConfig.galleryImages,
    faqs: globalMissionConfig.faqs,
    giving: globalMissionConfig.giving,
    coreValues: globalMissionConfig.coreValues,
    leadership: globalMissionConfig.leadership.map(({ name, role, bio, photoUrl }) => ({ name, role, bio, photoUrl })),
    statementOfFaith: globalMissionConfig.statementOfFaith,
    metadata: globalMissionConfig.metadata,
  },
});

const settingsOverlay = createChurchSiteSettingsOverlay({
  tenantSlug: globalMissionConfig.tenantSlug,
  ministryName,
  settings: input.settings,
});
const mappedEvents = mapGlobalMissionEvents(globalMissionEvents);

if (dryRun) {
  console.log(`GMFC seed preview: ${globalMissionConfig.leadership.length} baseline leaders, ${globalMissionConfig.galleryImages.length} gallery items, ${mappedEvents.events.length} public events, and a template-backed site settings overlay.`);
  process.exit(0);
}
if (!connectionString) {
  throw new Error("MIGRATION_DATABASE_URL is required to seed Global Mission tenant data.");
}

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["bazion:seed:global-mission"]);

  const existingTenant = await client.query<{ id: string; slug: string; status: string }>(
    "SELECT id, slug, status FROM public.tenants WHERE slug = $1 OR id = $2 FOR UPDATE",
    [globalMissionConfig.tenantSlug, TENANT_ID],
  );
  const tenantBySlug = existingTenant.rows.find((tenant) => tenant.slug === globalMissionConfig.tenantSlug);
  const tenantById = existingTenant.rows.find((tenant) => tenant.id === TENANT_ID);
  if (tenantById && tenantById.slug !== globalMissionConfig.tenantSlug) {
    throw new Error(`Refusing to seed GMFC: stable tenant ID belongs to '${tenantById.slug}'.`);
  }

  let tenantId = tenantBySlug?.id;
  if (!tenantId && !tenantById) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO public.tenants (id, slug, name, default_currency, status)
       VALUES ($1, $2, $3, 'KES', 'active')
       RETURNING id`,
      [TENANT_ID, globalMissionConfig.tenantSlug, ministryName],
    );
    tenantId = inserted.rows[0]?.id;
  } else {
    tenantId ??= tenantById?.id;
  }
  if (!tenantId) throw new Error("Could not resolve the Global Mission tenant ID.");

  const status = tenantBySlug?.status ?? tenantById?.status ?? "active";
  if (status !== "active") {
    await client.query("ROLLBACK");
    console.log(`Skipped GMFC website seed because tenant status is '${status}'.`);
    process.exitCode = 0;
  } else {
    await client.query("SELECT set_config($1, $2, true)", ["app.tenant_id", tenantId]);

    for (const [moduleId, enabled] of [["church-ministry", true], ["commerce", false]] as const) {
      await client.query(
        `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
         VALUES ($1, $2, $3, 'system:gmfc-template-seed')
         ON CONFLICT (tenant_id, module_id) DO NOTHING`,
        [tenantId, moduleId, enabled],
      );
    }
    const churchModule = await client.query<{ enabled: boolean }>(
      "SELECT enabled FROM public.tenant_module_entitlements WHERE tenant_id = $1 AND module_id = 'church-ministry'",
      [tenantId],
    );
    if (churchModule.rows[0]?.enabled !== true) {
      throw new SeedSkippedError("Skipped GMFC content seed because Church Ministry is explicitly disabled.");
    }

    await client.query(
      `INSERT INTO public.ministry_profiles
         (tenant_id, ministry_name, logo_asset_url, description, vision, mission, outreach, address, email, telephone_numbers, social_links)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [
        tenantId,
        input.profile.ministryName,
        input.profile.logoUrl || null,
        input.profile.tagline,
        input.profile.vision,
        input.profile.mission,
        input.profile.outreach,
        input.profile.contact.address,
        input.profile.contact.email,
        JSON.stringify(input.profile.contact.phones),
        JSON.stringify(input.profile.social),
      ],
    );

    const storedSettings = await client.query<{ setting_value: string | null }>(
      `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value)
       VALUES ($1, 'public_site', $2)
       ON CONFLICT (tenant_id, setting_key) DO NOTHING
       RETURNING setting_value`,
      [tenantId, JSON.stringify(settingsOverlay)],
    );
    if (storedSettings.rowCount) {
      const versionResult = await client.query<{ version_number: number }>(
        "SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number FROM public.ministry_site_settings_versions WHERE tenant_id = $1",
        [tenantId],
      );
      await client.query(
        `INSERT INTO public.ministry_site_settings_versions
           (tenant_id, version_number, status, profile, settings, note, created_by, published_at, published_by)
         VALUES ($1,$2,'published',$3::jsonb,$4::jsonb,'Initial template-backed GMFC site seed','system:gmfc-template-seed',now(),'system:gmfc-template-seed')
         ON CONFLICT (tenant_id, version_number) DO NOTHING`,
        [tenantId, versionResult.rows[0]?.version_number ?? 1, JSON.stringify(input.profile), JSON.stringify(settingsOverlay)],
      );
    }

    for (const [displayOrder, leader] of globalMissionConfig.leadership.entries()) {
      await client.query(
        `INSERT INTO public.leadership_profiles
           (tenant_id, name, position, biography, photo_url, display_order, status)
         SELECT $1,$2,$3,$4,$5,$6,'active'
         WHERE NOT EXISTS (
           SELECT 1 FROM public.leadership_profiles
           WHERE tenant_id = $1 AND name = $2 AND position = $3
         )`,
        [tenantId, leader.name, leader.role, leader.bio ?? null, leader.photoUrl ?? null, displayOrder],
      );
    }

    for (const event of mappedEvents.events) {
      await client.query(
        `INSERT INTO public.church_events
           (tenant_id, title, slug, description, poster_url, venue, starts_at, ends_at, registration_enabled, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9)
         ON CONFLICT (tenant_id, slug) DO NOTHING`,
        [tenantId, event.title, event.slug, event.description, event.posterUrl, event.venue, event.startsAt, event.endsAt, event.status],
      );
    }

    await client.query("COMMIT");
    console.log(`Seeded GMFC tenant ${tenantId}: template-backed public site, ${globalMissionConfig.leadership.length} baseline leaders and ${mappedEvents.events.length} public events (existing admin values preserved).`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  if (error instanceof SeedSkippedError) {
    console.log(error.message);
  } else {
    throw error;
  }
} finally {
  client.release();
  await pool.end();
}

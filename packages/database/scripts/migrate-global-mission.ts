import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { mapGlobalMissionEvents, type SourceEvent } from "../src/global-mission-migration.js";
import { globalMissionConfig, sampleAssets } from "@bazion/church-ministry-template";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const inputArgument = args.find((value) => value.startsWith("--input="))?.slice("--input=".length);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const inputFile = resolve(repoRoot, inputArgument ?? "data/migrations/global-mission-events.json");
const tenantId = process.env.GMFC_TENANT_ID ?? process.env.DEFAULT_TENANT_ID;
const connectionString = process.env.MIGRATION_DATABASE_URL;

if (!tenantId) throw new Error("Set GMFC_TENANT_ID (or DEFAULT_TENANT_ID) to the local GMFC tenant UUID.");
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
  throw new Error("GMFC_TENANT_ID must be a UUID.");
}

let eventExport: { source?: unknown; events?: unknown };
try {
  eventExport = JSON.parse(await readFile(inputFile, "utf8")) as typeof eventExport;
} catch {
  throw new Error(`Could not read ${inputFile}. Export the source's public events first.`);
}
if (eventExport.source !== "global-mission-fc" || !Array.isArray(eventExport.events)) {
  throw new Error("The import file is not a Global Mission public event export.");
}

const { events: eventRows, skipped: skippedEvents } = mapGlobalMissionEvents(eventExport.events as SourceEvent[]);

const { ministryName, tagline, branding, hero, contact, social, vision, mission, outreach } = globalMissionConfig;
const galleryDirectory = join(repoRoot, "apps/storefront/public/images/gallery");
const galleryEntries = await readdir(galleryDirectory, { withFileTypes: true }).catch(() => []);
const galleryImages = galleryEntries
  .filter((entry) => entry.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name))
  .map((entry) => ({
    imageUrl: `/images/gallery/${encodeURIComponent(entry.name)}`,
    alt: "Global Mission for Christ International ministry gallery photo",
  }));
const profile = {
  ministryName,
  tagline,
  logoUrl: branding.logoUrl,
  vision: vision.statement,
  mission: mission.statement,
  outreach: outreach.statement,
  contact: { address: contact.address, email: contact.email, phones: contact.phones },
  social,
};
const settings = {
  theme: globalMissionConfig.theme,
  branding: {
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    heroImageUrl: branding.heroBgUrl,
  },
  hero,
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
  galleryImages,
  faqs: globalMissionConfig.faqs,
  giving: globalMissionConfig.giving,
  coreValues: globalMissionConfig.coreValues,
  leadership: globalMissionConfig.leadership.map(({ name, role, bio, photoUrl }) => ({ name, role, bio, photoUrl })),
  statementOfFaith: globalMissionConfig.statementOfFaith,
  metadata: globalMissionConfig.metadata,
};

console.log(`Previewing ${globalMissionConfig.ministryName} → tenant ${tenantId}`);
console.log(`Site profile/settings: 1; valid public events: ${eventRows.length}; skipped events with incomplete identifiers/dates: ${skippedEvents}.`);
console.log(`Target database: local PostgreSQL only; source contact messages, prayer requests, donations and subscribers are excluded.`);
if (!apply) {
  console.log("Dry run only. Add --apply to write the profile, public settings, and event records.");
  process.exit(0);
}
if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required.");
const databaseUrl = new URL(connectionString);
if (!["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)) {
  throw new Error("This importer is restricted to local PostgreSQL. Remote database migration requires a separately reviewed process.");
}

const pool = new Pool({ connectionString, max: 1 });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const tenantResult = await client.query<{ id: string; slug: string; name: string }>(
    "SELECT id, slug, name FROM public.tenants WHERE id = $1 OR slug = $2 FOR UPDATE",
    [tenantId, globalMissionConfig.tenantSlug],
  );
  const tenantById = tenantResult.rows.find((row) => row.id === tenantId);
  const tenantBySlug = tenantResult.rows.find((row) => row.slug === globalMissionConfig.tenantSlug);
  if (tenantById && tenantById.slug !== globalMissionConfig.tenantSlug) {
    throw new Error(`Tenant UUID already belongs to '${tenantById.slug}'. Choose a new GMFC_TENANT_ID; existing tenant data was left untouched.`);
  }
  if (tenantBySlug && tenantBySlug.id !== tenantId) {
    throw new Error(`'${globalMissionConfig.tenantSlug}' already belongs to another UUID. Existing tenant data was left untouched.`);
  }
  if (!tenantById) {
    await client.query(
      "INSERT INTO public.tenants (id, slug, name, default_currency) VALUES ($1, $2, $3, 'KES')",
      [tenantId, globalMissionConfig.tenantSlug, globalMissionConfig.ministryName],
    );
  }
  await client.query(
    `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
     VALUES ($1, 'commerce', false, 'system:gmfc-baseline')
     ON CONFLICT (tenant_id, module_id) DO NOTHING`,
    [tenantId],
  );
  const entitlement = await client.query<{ enabled: boolean }>(
    "SELECT enabled FROM public.tenant_module_entitlements WHERE tenant_id = $1 AND module_id = 'church-ministry'",
    [tenantId],
  );
  if (entitlement.rows[0]?.enabled === false) {
    throw new Error("Church Ministry is explicitly disabled for this tenant. Enable it in the platform tenant settings before import.");
  }
  await client.query(
    `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
     VALUES ($1, 'church-ministry', true, 'system:gmfc-baseline')
     ON CONFLICT (tenant_id, module_id) DO NOTHING`,
    [tenantId],
  );
  await client.query(
    `INSERT INTO public.tenant_domains (tenant_id, hostname, status, verified_at)
     VALUES ($1, $2, 'active', now())
     ON CONFLICT (hostname) DO NOTHING`,
    [tenantId, `${globalMissionConfig.tenantSlug}.localhost`],
  );

  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
  await client.query(
    `INSERT INTO public.ministry_profiles
       (tenant_id, ministry_name, logo_asset_url, description, vision, mission, outreach, address, email, telephone_numbers, social_links)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
     ON CONFLICT (tenant_id) DO UPDATE SET
       ministry_name=EXCLUDED.ministry_name, logo_asset_url=EXCLUDED.logo_asset_url,
       description=EXCLUDED.description, vision=EXCLUDED.vision, mission=EXCLUDED.mission,
       outreach=EXCLUDED.outreach, address=EXCLUDED.address, email=EXCLUDED.email,
       telephone_numbers=EXCLUDED.telephone_numbers, social_links=EXCLUDED.social_links, updated_at=now()`,
    [tenantId, profile.ministryName, profile.logoUrl, profile.tagline, profile.vision, profile.mission,
      profile.outreach, profile.contact.address, profile.contact.email, JSON.stringify(profile.contact.phones), JSON.stringify(profile.social)],
  );
  await client.query(
    `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value)
     VALUES ($1, 'public_site', $2)
     ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value, updated_at=now()`,
    [tenantId, JSON.stringify(settings)],
  );

  // Record initial published version in ministry_site_settings_versions
  await client.query(
    `INSERT INTO public.ministry_site_settings_versions
       (tenant_id, version_number, status, profile, settings, note, created_by, published_at, published_by)
     VALUES ($1, 1, 'published', $2::jsonb, $3::jsonb, 'Initial GMFC baseline import', 'system:gmfc-baseline', now(), 'system:gmfc-baseline')
     ON CONFLICT (tenant_id, version_number) DO NOTHING`,
    [tenantId, JSON.stringify(profile), JSON.stringify(settings)],
  );

  // Seed departments into church_departments
  for (const [idx, dept] of (globalMissionConfig.departments ?? []).entries()) {
    const slug = dept.id || dept.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await client.query(
      `INSERT INTO public.church_departments
         (tenant_id, name, slug, description, icon, leader_name, leader_role, meeting_schedule, contact_email, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [tenantId, dept.name, slug, dept.description, dept.icon ?? null, dept.leaderName ?? null, dept.leaderRole ?? null, dept.meetingSchedule ?? null, dept.contactEmail ?? null, idx],
    );
  }

  // Seed small groups into church_small_groups
  for (const grp of globalMissionConfig.groups ?? []) {
    const slug = grp.id || grp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await client.query(
      `INSERT INTO public.church_small_groups
         (tenant_id, name, slug, category, description, leader_name, meeting_schedule, public_location_label, accepting_members, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,'active')
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [tenantId, grp.name, slug, grp.category, grp.description ?? null, grp.leaderName, grp.meetingSchedule, grp.locationOrVirtual],
    );
  }

  // Seed volunteer teams into church_volunteer_teams
  for (const vol of globalMissionConfig.volunteerTeams ?? []) {
    const slug = vol.id || vol.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await client.query(
      `INSERT INTO public.church_volunteer_teams
         (tenant_id, name, slug, description, requirements, coordinator_name, accepting_applications, status)
       VALUES ($1,$2,$3,$4,$5,$6,true,'active')
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [tenantId, vol.title, slug, vol.description, vol.requirements ?? null, vol.coordinatorName ?? null],
    );
  }

  // Seed private equipment inventory into church_inventory_assets
  for (const asset of sampleAssets) {
    const assetTag = asset.id.toUpperCase();
    await client.query(
      `INSERT INTO public.church_inventory_assets
         (tenant_id, name, asset_tag, category, location, condition, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, asset_tag) DO NOTHING`,
      [tenantId, asset.name, assetTag, asset.category, asset.location, asset.condition, asset.status, asset.notes ?? null],
    );
  }

  let insertedEvents = 0;
  for (const event of eventRows) {
    const result = await client.query(
      `INSERT INTO public.church_events
         (tenant_id, title, slug, description, poster_url, venue, starts_at, ends_at, registration_enabled, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9)
       ON CONFLICT (tenant_id, slug) DO NOTHING`,
      [tenantId, event.title, event.slug, event.description, event.posterUrl, event.venue, event.startsAt, event.endsAt, event.status],
    );
    insertedEvents += result.rowCount ?? 0;
  }
  await client.query("COMMIT");
  console.log(`Migration applied. Tenant site settings saved; ${insertedEvents} new events inserted; existing same-slug events were preserved.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { mapGlobalMissionEvents, type SourceEvent } from "../src/global-mission-migration.js";
import { globalMissionConfig } from "@bazion/church-ministry-template";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const NON_GALLERY_FILES = new Set([
  "hero-bg.png",
  "hero-bg-optimized.jpg",
  "anthony-githui.jpeg",
  "apostle-shadrach.jpeg",
  "dr-young.jpg",
  "pastor-betty.jpg",
  "pastor-kamwaga.jpeg",
  "rev-bishop.jpeg",
  "camp.png",
  "conference.png",
]);

function altFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return (
    base
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, (c) => c.toUpperCase()) || "Gallery photo"
  );
}

async function discoverGalleryImages(repoRoot: string): Promise<Array<{ imageUrl: string; alt: string }>> {
  const imagesDir = join(repoRoot, "apps/storefront/public/images/images");
  const primaryEntries = await readdir(imagesDir, { withFileTypes: true }).catch(() => []);
  const primaryImages = primaryEntries
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = entry.name.slice(entry.name.lastIndexOf(".")).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext) && !NON_GALLERY_FILES.has(entry.name);
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60)
    .map((entry) => ({
      imageUrl: `/images/images/${encodeURIComponent(entry.name)}`,
      alt: altFromFilename(entry.name),
    }));

  if (primaryImages.length > 0) return primaryImages;

  const fallbackDir = join(repoRoot, "apps/storefront/public/images/gallery");
  const fallbackEntries = await readdir(fallbackDir, { withFileTypes: true }).catch(() => []);
  return fallbackEntries
    .filter((entry) => entry.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60)
    .map((entry) => ({
      imageUrl: `/images/gallery/${encodeURIComponent(entry.name)}`,
      alt: altFromFilename(entry.name),
    }));
}

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
const galleryImages = await discoverGalleryImages(repoRoot);

const { ministryName, tagline, branding, hero, contact, social, vision, mission, outreach } = globalMissionConfig;
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
  navigation: globalMissionConfig.navigation,
  pages: globalMissionConfig.pages,
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

console.log(`Previewing clean-slate import for ${globalMissionConfig.ministryName} → tenant ${tenantId}`);
console.log(
  `Site profile/settings: 1; leaders: ${globalMissionConfig.leadership.length}; gallery images: ${galleryImages.length}; valid public events: ${eventRows.length}; skipped events: ${skippedEvents}.`,
);
console.log("Target database: local PostgreSQL only; existing GMFC tenant data will be deleted and replaced cleanly.");
if (!apply) {
  console.log("Dry run only. Add --apply to reset and re-import GMFC.");
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

  // Clean-slate deletion of all existing GMFC tenant data (child tables before parent tables)
  const deleteTables = [
    "church_event_registrations",
    "church_events",
    "sermons",
    "sermon_categories",
    "church_group_memberships",
    "church_small_groups",
    "church_volunteer_applications",
    "church_volunteer_teams",
    "church_departments",
    "church_inventory_asset_events",
    "church_inventory_assets",
    "church_payment_transactions",
    "church_donations",
    "donation_campaigns",
    "church_contact_messages",
    "church_prayer_requests",
    "church_newsletter_subscribers",
    "leadership_profiles",
    "ministry_site_settings_versions",
    "ministry_settings",
    "ministry_profiles",
  ] as const;

  for (const table of deleteTables) {
    await client.query(`DELETE FROM public.${table} WHERE tenant_id = $1`, [tenantId]);
  }

  await client.query(
    `INSERT INTO public.ministry_profiles
       (tenant_id, ministry_name, logo_asset_url, description, vision, mission, outreach, address, email, telephone_numbers, social_links)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,
    [
      tenantId,
      profile.ministryName,
      profile.logoUrl,
      profile.tagline,
      profile.vision,
      profile.mission,
      profile.outreach,
      profile.contact.address,
      profile.contact.email,
      JSON.stringify(profile.contact.phones),
      JSON.stringify(profile.social),
    ],
  );

  await client.query(
    `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value)
     VALUES ($1, 'public_site', $2)`,
    [tenantId, JSON.stringify(settings)],
  );

  await client.query(
    `INSERT INTO public.ministry_site_settings_versions
       (tenant_id, version_number, status, profile, settings, note, created_by, published_at, published_by)
     VALUES ($1, 1, 'published', $2::jsonb, $3::jsonb, 'Initial GMFC live site import', 'system:gmfc-baseline', now(), 'system:gmfc-baseline')`,
    [tenantId, JSON.stringify(profile), JSON.stringify(settings)],
  );

  for (const [displayOrder, leader] of globalMissionConfig.leadership.entries()) {
    await client.query(
      `INSERT INTO public.leadership_profiles
         (tenant_id, name, position, biography, photo_url, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')`,
      [tenantId, leader.name, leader.role, leader.bio ?? null, leader.photoUrl ?? null, displayOrder],
    );
  }

  let insertedEvents = 0;
  for (const event of eventRows) {
    const result = await client.query(
      `INSERT INTO public.church_events
         (tenant_id, title, slug, description, poster_url, venue, starts_at, ends_at, registration_enabled, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9)`,
      [
        tenantId,
        event.title,
        event.slug,
        event.description,
        event.posterUrl,
        event.venue,
        event.startsAt,
        event.endsAt,
        event.status,
      ],
    );
    insertedEvents += result.rowCount ?? 0;
  }

  await client.query("COMMIT");
  console.log(
    `Clean-slate import applied: profile & public_site saved, ${globalMissionConfig.leadership.length} leaders inserted, ${galleryImages.length} gallery images stored, ${insertedEvents} events inserted.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

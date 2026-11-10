# Global Mission tenant migration

Global Mission is migrated as a tenant instance. The shared church template, its demo seed, and the generic storefront are left unchanged. The importer only targets a local PostgreSQL database and only creates or updates the `global-mission-fc` tenant's public site profile/settings, public events, and initial optional-module entitlement defaults.

## Source data included

- Public event title, slug, dates, description/excerpt, public image URL, and location from the source Supabase `events` table.
- The GMFC-specific profile, brand, contact links, leadership, giving instructions, beliefs, values, and metadata already held in `templates/global-mission.config.ts`.
- The 15 local GMFC gallery assets already present under `apps/storefront/public/images/gallery`, plus event posters mapped to the locally copied images.

Private contact submissions, prayer requests, donations, registrations, and newsletter subscribers are not queried or migrated. The source site's sermons page only links to its YouTube channel; individual sermons need their video IDs and publication details before they can be imported as sermon records. Events missing a usable slug or date are skipped. Imported events have registration disabled until their registration process is confirmed.

The source snapshot currently contains four dated events, all ending before 9 November 2026. They will appear as past events, and the upcoming-events panel will remain empty until current dates are added.

## Export and preview

From the repository root, export the public event data from the read-only source project. The script reads `D:\new-gmfc\.env.local` without displaying credentials and writes only public event fields:

```powershell
node scripts/migration/export-global-mission-events.mjs --source D:\new-gmfc
```

The default output is `data/migrations/global-mission-events.json` (ignored by Git). Start Docker Desktop, then initialize the local database:

```powershell
pnpm db:up
pnpm db:migrate
pnpm db:auth:migrate
```

Do not run the generic `pnpm db:seed` for this tenant setup. It seeds the reusable commerce demo tenant. The GMFC commands use a separate local tenant UUID (`7a80eaae-6f8c-44c1-b22a-3dca458f0ec1`), leaving the demo tenant and shared template untouched.

Preview the migration first. Preview is the default and performs no writes:

```powershell
pnpm gmfc:migrate
```

After reviewing the counts and source export, apply it to the local database:

```powershell
pnpm gmfc:migrate:apply
```

The importer is transactional, preserves existing same-slug events, and will stop if the selected UUID or `global-mission-fc` slug belongs to a different tenant. It explicitly blocks non-local database hosts.

## Open the local site

Port 3000 is the reusable demo storefront; the separate GMFC preview uses storefront port 3100, platform console port 3001, and API port 4100. From the repo root, start the GMFC API, storefront, platform console, and notification worker together:

```powershell
pnpm dev:gmfc
```

Then visit [http://localhost:3100](http://localhost:3100). The GMFC ministry admin portal is at [http://localhost:3100/admin](http://localhost:3100/admin); it requires a signed-in user who belongs to the GMFC tenant workspace. The Bazion platform control plane has its own root at [http://localhost:3001](http://localhost:3001) and is limited by platform API permissions. After applying the new database migration with `pnpm db:migrate`, GMFC's optional Commerce module is disabled and its admin link is hidden. The generic tenant seed is intentionally not changed by this migration.

## Public launch

The local preview does not publish a public website. For launch, the production tenant must be provisioned with an owner, the Church Ministry module enabled, and a verified domain attached through the platform. Point that domain's DNS to the storefront host configured for the deployment, configure the platform's HTTPS/API origins, and then the public site is accessed at that ministry domain. A production hostname and owner account have not been supplied, so no live URL or admin login is assumed here.

Before accepting donations on a public launch, confirm the Paybill/account instructions with the ministry. Before publishing event registration, confirm each event's dates, venue, capacity, and registration workflow.

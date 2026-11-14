# Church and ministry module

## Current status

The church module is **partial**. It provides tenant-scoped public ministry websites, profile and site settings, published sermons, events and registrations, giving campaigns and donation attempts, contact enquiries, prayer requests, and newsletter opt-ins. It is a reusable website template and starter content editor, not a complete church-management product. The research and public feature map are in [church-ministry-website-research.md](church-ministry-website-research.md).

### Package & Application Boundaries

- `apps/storefront` (`@bazion/storefront`): Public church website serving read-only published content, public directory (departments, small groups, volunteer teams, campuses), events, sermons, and giving intake.
- `apps/ministry-admin` (`@bazion/ministry-admin`): Dedicated church staff administration console for managing website drafts/publishing/versions, theme presets, departments, cell groups, volunteer applications, and private physical equipment inventory.
- `apps/admin` (`@bazion/admin`): Bazion platform operator console for tenant provisioning, hosting, and module lifecycle management.
- `@bazion/church-ministry-contracts` owns ministry input schemas, operations contracts (`operations.ts`), site settings version schemas (`site-versions.ts`), and public-site settings types. `@bazion/api-contracts` remains for commerce contracts.
- `@bazion/church-ministry-domain` owns content slug generation, tenant-unique slug selection, ministry operations use cases (`MinistryOperationsRepository`), and site-settings read/save/version/rollback use cases (`MinistrySiteSettingsRepository`, `MinistrySiteSettingsVersionsRepository`).
- Fastify checks the active tenant and permissions, then supplies the tenant-scoped PostgreSQL transaction adapter. No ministry business data, private inventory, or tenant credentials move into shared public defaults.

The storefront reads a tenant profile and validated `public_site` settings from `ministry_settings`. The signed-in editor can configure identity, logo, contact/social links, palette, hero, visitor information, service times, locations, online stream link, ministries, FAQs, leaders, gallery, values, faith statement, giving instructions and search description. Public service, location and gallery content stays empty until a ministry publishes it. Site colors require a 4.5:1 contrast ratio against white. The profile editor writes profile columns and validated public settings in the same tenant-scoped transaction. Every tenant uses the same media library UI and upload controls, while uploaded files and references remain tenant-scoped.

Uploads are sent to the authenticated API, which checks the file signature against its declared type and enforces an 8 MB limit for JPEG, PNG, WebP and AVIF. Object keys are generated under the active tenant's prefix; the browser cannot choose a tenant ID or storage key. The library is read-only after upload so deleting an asset cannot silently break a live page. Gallery descriptions are edited as required alt text; other image slots use the associated ministry, sermon or event title as their accessible text. Local development uses a temporary local adapter. Production must use an S3-compatible bucket with a public HTTPS CDN/custom domain configured through the `MEDIA_STORAGE_*` variables in `.env.example`.

## Implemented routes

Public routes are mounted under `/v1/public/church`:

- `GET /site` returns the tenant profile, active leaders, validated `siteSettings`, and `siteSettingsStored: boolean` (preventing defaulted schema values from masking static tenant fallbacks).
- `GET /directory` returns the public directory of active departments, small groups (with public location labels only), and volunteer teams. Private home addresses, member rosters, and physical equipment inventory are strictly excluded.
- `POST /groups/:id/join-requests` records a public join request for a small group with privacy consent timestamp.
- `POST /volunteer-teams/:id/applications` records a public volunteer application with privacy consent timestamp.
- `GET /admin/church/media` lists the active tenant's most recently uploaded image assets.
- `POST /admin/church/media` validates and stores a tenant-scoped image upload.
- `GET /public/church/media/:key` serves local-development assets; production assets are served from the configured CDN URL.
- `GET /sermons` and `GET /sermons/:slug` return published messages.
- `GET /events` and `GET /events/:slug` return non-cancelled events.
- `POST /events/:eventId/register` creates a tenant-bound registration, checking event state and capacity under a row lock and recording consent time.
- `GET /campaigns` lists active campaigns.
- `POST /donations/mpesa-stk` initiates a Daraja STK Push when credentials are configured. Without them, the endpoint returns unavailable; the storefront displays manual Paybill instructions only when those details are configured for its reference template, otherwise it asks donors to contact the ministry.
- `POST /donations/mpesa-callback` verifies the per-attempt callback token, provider references, amount and phone before marking a donation verified.
- `GET /donations/status` returns attempt state to the holder of a random client status token.
- Contact, prayer-request and newsletter intake routes persist tenant-scoped submissions. Contact, prayer, event registration, donation and newsletter forms require a privacy acknowledgement; contact and prayer records store its time.

Protected routes are under `/v1/admin/church`:

- Site settings versioning & publishing:
  - `GET /site-settings/versions` lists immutable version snapshots (`draft`, `published`, `superseded`).
  - `GET /site-settings/preview` returns the current draft (if any) or published settings for staff preview.
  - `PUT /site-settings/draft` saves unpublished draft changes without affecting the live storefront.
  - `POST /site-settings/publish` publishes settings live and records an immutable version snapshot.
  - `DELETE /site-settings/draft` discards an unpublished draft.
  - `POST /site-settings/versions/:versionNumber/rollback` restores any historical version and publishes it live.
- Ministry operations (tenant-scoped with forced RLS):
  - `GET / POST / PATCH / DELETE /departments`: manage church ministry departments.
  - `GET / POST / PATCH / DELETE /groups` and `/groups/:id/memberships`: manage cell groups/fellowship circles and member join requests.
  - `GET / POST / PATCH / DELETE /volunteer-teams` and `/volunteer-teams/:id/applications`: manage volunteer teams and review applications.
  - `GET / POST / PATCH / DELETE /inventory-assets` and `/inventory-assets/:id/events`: manage private physical equipment and facility inventory (audio/visual, vehicles, generators, tents) and log maintenance/assignment events.
- Content & inbox: overview, media, sermons, events, campaigns, registrations, donations, enquiries, prayer requests and email opt-ins. Donor, attendee, enquiry, prayer-request, subscriber, membership, volunteer application, and physical inventory records require `churchprivate`, granted to `owner` and `admin`.

## M-Pesa configuration and release state

Set `MPESA_ENVIRONMENT`, `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_BUSINESS_SHORT_CODE`, `MPESA_PASSKEY` and `MPESA_CALLBACK_URL` together. The callback base URL must be publicly reachable; the API derives these callback paths from its origin:

- `/v1/public/church/donations/mpesa-callback`
- `/v1/public/commerce/payments/mpesa-callback`

For commerce checkout, set `PAYMENT_PROVIDER=mpesa`. The checkout supports KES amounts in whole shillings. It reserves inventory before requesting the STK Push, holds the order as unpaid until the callback, and releases the reservation when Safaricom reports failure. Callback and status tokens are stored as hashes. API request URLs and payment-status headers are redacted from application logs; ingress and reverse-proxy access logs must also redact callback query strings. Provider credentials are process-wide environment settings rather than tenant-specific encrypted accounts, so separate tenant settlement accounts are not supported yet.

Production startup rejects the mock provider, sandbox credentials and non-HTTPS callback URLs. The Daraja integration has not been exercised against the ministry's live merchant account in this repository. Complete a sandbox end-to-end cycle and production merchant callback validation before accepting real payments. Missing callbacks still need an operator reconciliation path; refunds and payment reversals are not implemented.

## Database and tenancy

Migration `0008_church_ministry_domain.sql` adds the core church data tables. `0009_church_integrity_and_payment_callbacks.sql` adds tenant-aware relationship constraints and donation callback/idempotency fields. `0010_commerce_mpesa_callbacks.sql` adds durable commerce callback and status-token fields. `0011_church_site_and_privacy.sql` adds consent timestamps to new event, donation, contact and prayer submissions. `0026_church_ministry_operations.sql` adds normalized tables with forced RLS (`tenant_isolation`) for `church_departments`, `church_small_groups`, `church_group_memberships`, `church_volunteer_teams`, `church_volunteer_applications`, `church_inventory_assets`, and `church_inventory_asset_events`. `0027_church_site_settings_versions.sql` adds `ministry_site_settings_versions` with forced RLS for draft staging, version history, and rollback. The migrations stop when existing relationships are missing or cross-tenant rather than silently rewriting data. Church and commerce records use forced PostgreSQL RLS and tenant-scoped transactions.

## Remaining work

- Store provider credentials per tenant and route payment requests to that tenant's merchant account before onboarding ministries with separate settlement accounts.
- Add newsletter delivery, preference center and secure user-facing unsubscribe.
- Add sermon editing/scheduling, category management and a fuller page builder.
- Build member, household, attendance and volunteer workflows.
- Add fine-grained finance and pastoral roles, data-retention automation and audit coverage for ministry administration.
- Add callback-loss reconciliation, payment reversal/refund handling and operational alerts.
- Validate Daraja sandbox and live merchant behavior, inventory races and callback retries in a staged environment.

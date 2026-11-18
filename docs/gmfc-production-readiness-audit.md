# GMFC production-readiness audit

**Audit date:** 18 November 2026  
**Tenant:** Global Mission for Christ International (`global-mission-fc`)  
**Code baseline:** `origin/main` at `6707bfc`

## Executive finding

The repository does not support a production-ready sign-off yet. There are confirmed admin-to-public synchronization defects in the ministry directory and website publishing workflow. GMFC's checked-in tenant defaults and migration notes also leave important public content and payment details needing confirmation.

This is a source audit, not a live deployment certification. The signed-in browser was unavailable to this audit session, and no production tenant database or credentials were supplied. Therefore, the report does not claim that the running GMFC site has the same data as the checked-in defaults. Items marked **verify live** need evidence from the deployed tenant before launch.

## Confirmed implementation gaps

| Priority | Gap | Evidence and impact | Required completion evidence |
|---|---|---|---|
| **P0** | **Operations records do not feed the public ministry directory.** | The API has a tenant-scoped `/v1/public/church/directory` endpoint backed by department, small-group, and volunteer-team tables. The public `/ministries` page instead consumes `useMinistrySite()`, which reads same-named arrays from `public_site` settings or static fallback config. The admin tabs write the operation tables. As a result, an admin can add a department, group, or team and see it in the admin while the public directory remains empty or stale. | Wire the storefront directory to the public endpoint (preserving the endpoint's active/public filtering and private-field exclusions). Verify create, edit, hide/archive, and delete behavior on the public site after a fresh load. |
| **P0** | **Publishing can publish a different version than the editor shows.** | The editor loads `/v1/admin/church/site-settings` (published settings), reads version summaries, and submits its current form to `/publish`. It does not load the existing draft from `/preview`. The API publish handler prefers an already stored draft over the submitted request body. If a draft exists, the UI can show one state while the server publishes another. | Load the actual draft and its profile into the editor, expose a draft preview, and publish the exact draft revision the user reviewed. Add a stale-revision conflict response rather than silently publishing an older version. Verify with two browser sessions and an existing draft. |
| **P1** | **Storefront API failures are hidden behind fallback content and a one-shot client cache.** | `use-ministry-site.ts` caches the first request promise by tenant slug. A failed/non-OK request resolves to `null`; the UI then keeps fallback content and the promise is not retried during that module lifetime. Visitors and editors receive no freshness/error indication. | Add retry/cache invalidation and a visible site-data state (live version/time or unavailable). Simulate an API outage, recovery, and a publish while the page is already open; verify the new version becomes visible without a full application restart. |
| **P1** | **Empty settings cannot reliably clear fallback content.** | The site adapter replaces empty arrays for departments, ministries, groups, volunteer teams, testimonies, gallery, FAQs, core values, and faith statement with fallback arrays. For a tenant with non-empty defaults, deleting all entries in the editor can make old default content reappear publicly. | Define explicit override/clear semantics (for example, distinguish absent fields from intentionally empty arrays). Verify that clearing each editable section removes it from the public site. |
| **P1** | **Admin data-load errors look like empty data.** | The ministry dashboard uses `Promise.allSettled`; non-summary failures are converted to empty arrays. A single failure among private-resource requests makes a shared `sensitiveAccess` flag false for all private tabs. This can hide whether the issue is permissions, network, or genuinely no records. | Show per-resource loading/error/empty states with retry. Keep permission errors distinct from server failures and empty collections. Confirm each role sees the intended tabs and errors. |
| **P1** | **Several admin content paths are create/delete/status only.** | The operations API has update routes for departments, groups, and volunteer teams, but the current admin panels expose add/delete controls without edit controls. Sermon and event APIs expose create, delete, and status changes but no update route. Corrections currently require workarounds or delete-and-recreate. | Add safe edit flows for records, with validation and confirmation for destructive operations. Verify public changes reflect the edited record and preserve registrations/history where applicable. |
| **P1** | **The site editor does not cover all content rendered by the template.** | The GMFC fallback config contains statistics, but `ChurchPublicSiteSettings` has no statistics field. The settings editor also has no testimony editor. Page enablement/navigation can be changed, but most page section copy/layout is implemented in storefront components rather than edited as page content. | Decide which page content should be CMS-managed. Add schema/editor/public rendering support or label truly static sections as template-managed. Do not require code changes for routine ministry updates. |
| **P1** | **Leadership can have competing records.** | The public site response returns legacy `leadershipProfiles` alongside `public_site` settings. The storefront chooses settings leadership when site settings are stored and otherwise falls back to profile leaders/config. Updating only one source can leave the other stale or ignored. | Make one source authoritative, migrate/merge existing records, and verify admin changes, ordering, photos, and biographies on the public leadership section. |

## GMFC tenant content and migration gaps to verify

These items are facts about the checked-in GMFC configuration and migration snapshot, not proof of what is currently deployed.

| Priority | Item | Repository evidence | Launch check |
|---|---|---|---|
| **P0** | Service information is blank in defaults. | `templates/global-mission.config.ts` has empty `serviceTimes` and `locations`; visitor information fields are empty. | Confirm worship/service schedules, venue(s), map links, access/parking/children details, and online service link with the tenant owner. Publish only approved details. |
| **P0** | Giving instructions need owner confirmation. | Defaults hardcode Paybill `247 247`, account reference `262518`, and account label `GLOBAL · YINV`. The settings editor explicitly notes that M-Pesa prompts need a separately configured platform provider. | Have GMFC verify the recipient/account and instructions. Confirm provider credentials, callback URL/signature, idempotency, payment status reconciliation, and test/reversal procedure before accepting money. Do not use a live donation as the test. |
| **P1** | The imported public event snapshot is stale, and sermon records were not imported. | `docs/global-mission-migration.md` says the source snapshot had four dated events ending before 9 November 2026, no upcoming events, and only a YouTube channel link for sermons (no individual sermon records). As of this audit date, all those imported events are past. | Obtain current event details and individual sermon metadata/video IDs from the authorized GMFC owner. Check dates, venues, registration rules, and publication consent before making records public. |
| **P1** | Public claims and profiles are not owner-verified in the code. | Defaults contain numeric reach/ministry statistics and named leaders, titles, bios, contact details, and social URLs. | Obtain written approval for statistics, contacts, leadership/title/photo use, doctrine/mission wording, and social accounts. Remove unsupported claims and outdated contacts. |
| **P1** | External-source import is one-time, not ongoing sync. | The migration script/document is a local, transactional importer of selected public fields. It intentionally excludes private contact/prayer/donation/registration/newsletter records. | Confirm the platform database is the source of truth after cutover. If the legacy site remains authoritative, define a scoped recurring import and conflict rules; do not copy private submissions without a separate approved migration and consent basis. |
| **P2** | Migration excludes private historical submissions. | The migration notes explicitly exclude private contact submissions, prayer requests, donations, registrations, and newsletter subscribers. | This is privacy-preserving by default. If any historical transfer is requested, approve scope, consent, retention, access, reconciliation, and deletion handling before importing. |

## Production checks not provable from this repository

Verify each item in the deployed GMFC tenant before calling it production-ready:

- **Domain and TLS:** approved production hostname is attached to the right tenant; DNS resolves to the intended origin; TLS is valid for both browser-to-edge and edge-to-origin; canonical host and redirects work. Staging wildcard routing does not prove the production tenant's custom domain.
- **Identity and permissions:** tenant owner and staff can sign in; least-privilege roles are assigned; every dashboard action is tenant-scoped; private records are not exposed to public routes or other tenants.
- **Forms and notifications:** contact, prayer, newsletter, event registration, and volunteer application submissions appear in the correct admin queue; consent is captured where needed; responsible staff receive/triage submissions; failure and retry behavior is known.
- **Giving:** verify the correct live provider setup and complete a provider-approved test flow, including callback, pending/failed/success states, duplicate callback/idempotency behavior, and reconciliation.
- **Backups and recovery:** scheduled backups include the GMFC tenant's platform database and uploaded assets; confirm retention and perform a documented restore into an isolated environment.
- **Operations:** monitoring/alerts cover storefront, API, database, payment callbacks, and email delivery; someone owns incidents and content updates.
- **Quality:** test desktop/mobile layouts, accessibility basics, page metadata/social previews, broken links/images, performance, and all public calls to action against the actual tenant domain.

## Recommended order

1. Fix the two P0 sync/publish defects and add visible error states for storefront/admin data loading.
2. Reconcile GMFC records from the authorized owner; verify giving setup before enabling donations.
3. Run the production checks above against the actual deployed tenant and capture evidence.
4. Treat the checklist in [`templates/church-ministry/production-readiness.md`](../templates/church-ministry/production-readiness.md) as a required gate for every future Church/Ministry tenant.

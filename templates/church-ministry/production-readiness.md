# Church/Ministry tenant production-readiness checklist

Use this checklist for every Church/Ministry tenant provisioned from the reusable template. Keep tenant-specific data in the tenant configuration/database. Never copy GMFC-specific names, contacts, payment instructions, imagery, or claims into shared defaults.

Record the tenant, production hostname, release/commit, reviewer, date, and evidence links before marking a launch complete. A blank field is not a pass.

## 1. Source of truth and migration

- [ ] Name the system of record for public profile, website settings, events, sermons, departments, groups, volunteer teams, giving, and submissions.
- [ ] Record migration source, snapshot timestamp, included/excluded datasets, and reconciliation owner.
- [ ] Confirm whether legacy systems become read-only after cutover. If sync continues, define direction, frequency, conflict rules, retries, duplicate handling, and failure alerts.
- [ ] Exclude private personal data by default. Approve and document any historical migration of contact, prayer, giving, registration, or newsletter records separately.
- [ ] Verify tenant ID and slug isolation for every imported row, file, and configured domain.

## 2. Tenant content and assets

- [ ] Obtain owner approval for ministry name, tagline, mission, beliefs, leadership names/titles/bios/photos, statistics, and public contact/social details.
- [ ] Add and verify service times, physical locations, visitor/accessibility information, online gathering details, and map links.
- [ ] Add current/upcoming events with confirmed dates, time zone, venue, registration capacity, cancellation contact, and registration consent.
- [ ] Add sermon records with approved titles, speakers, dates, video URLs/IDs, thumbnails, and publication status.
- [ ] Populate ministries, departments, small groups, volunteer teams, FAQs, testimonies, gallery, and giving copy only with reviewed tenant content.
- [ ] Remove all sample/demo content and unsupported statistics. Do not allow an empty saved field to silently resurrect old fallback/demo values.
- [ ] Confirm every image/video is tenant-approved, loads on the production domain, has useful alternative text, and is not hot-linked from an unstable source.
- [ ] Use the shared tenant media library for approved image sets. Review suggested metadata, add context-appropriate alt text, and confirm image usage before making the assets public.
- [ ] Review every page's title, description, social preview, canonical URL, links, and contact/giving calls to action.

## 3. Admin-to-public synchronization

- [ ] Maintain a field map from each admin editor/API/table to the public page/API that consumes it; name one source of truth per field.
- [ ] Confirm website draft load, edit, save, preview, publish, and rollback all operate on the same version. The preview must render the draft, not the currently published site.
- [ ] Confirm publish detects stale revisions and cannot silently publish an older draft than the one shown in the editor.
- [ ] Verify create, edit, publish/unpublish, archive, and delete transitions for sermons, events, departments, groups, volunteer teams, and campaigns on the public site.
- [ ] Verify operational directory records are sourced from the tenant-scoped public directory endpoint, filtered to active/public entries, and never expose private leader contact details or private addresses.
- [ ] Submit every public form and confirm it appears in the correct tenant's admin queue with the expected status and consent timestamp.
- [ ] Verify public changes become visible in an already-open storefront after the documented refresh/cache interval; test retry after API outage and ensure stale data is not presented as live.
- [ ] Distinguish empty data from failed requests in every dashboard panel. Show per-resource errors and a retry path.
- [ ] Confirm one authoritative leadership source and verify its ordering and edits on the public site.
- [ ] Confirm every routinely updated public field has an admin editor; document any remaining code-managed page sections and their owner.

## 4. Identity, privacy, and tenant boundaries

- [ ] Verify the tenant owner can sign in and recover the account; confirm staff invitations and role changes work.
- [ ] Assign least-privilege roles for website editing, operations, giving, and private submissions.
- [ ] Check that private submissions and payment details require the intended permission and are absent from public APIs, logs, analytics, and URLs.
- [ ] Verify consent text/timestamps, staff response handling, retention, export, and deletion procedures for personal data.
- [ ] Verify tenant isolation with at least two test tenants for reads, writes, media, and domain routing.

## 5. Domain, security, and payments

- [ ] Attach the verified production domain to the correct tenant; verify DNS, HTTP-to-HTTPS, canonical host, certificate names/expiry, and origin TLS mode.
- [ ] Verify tenant preview subdomains route to the correct storefront and cannot select another tenant by changing a host/header.
- [ ] Confirm payment recipient/account details directly with the tenant owner before enabling public giving.
- [ ] Confirm payment provider credentials and callback configuration are production values stored outside source control.
- [ ] Run the provider's approved test flow; verify success, pending, failure, duplicate callbacks, idempotency, receipts, and reconciliation before live giving.
- [ ] Confirm all admin and public endpoints enforce authentication/authorization and tenant scope.

## 6. Reliability, accessibility, and launch sign-off

- [ ] Confirm scheduled database and media backups include this tenant; record retention and complete an isolated restore exercise.
- [ ] Confirm health checks, error tracking, uptime alerts, database capacity, and an incident contact/rollback owner.
- [ ] Review mobile and desktop layouts, keyboard navigation, labels/contrast, page speed, links, image loads, and form error states.
- [ ] Walk the entire visitor journey: arrive, find service details, contact the ministry, register, apply to volunteer, and give (using the provider-approved test path).
- [ ] Capture evidence for each check and obtain tenant-owner approval for public content and launch.

## Known template limitations to close before calling the shared product production-ready

- [ ] Wire the public ministry directory to the same tenant-scoped operational records edited in admin.
- [ ] Make draft load/preview/publish revision-safe and visibly distinguish draft from live content.
- [ ] Add observable failure/retry states for storefront settings and each admin data source.
- [ ] Give operations, event, and sermon records complete edit workflows; add CMS coverage for all content the template renders or mark it explicitly code-managed.
- [ ] Define explicit clear/empty semantics so empty tenant content never falls back to stale content.
- [ ] Replace single-file-only image inputs with the shared batch/folder media-import workflow; preserve per-file validation, progress, retry, and review.
- [ ] Release template updates through a versioned preview/rebase flow that updates inherited fields while preserving tenant overrides and providing conflict review and rollback.

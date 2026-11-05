# Bazion Web — Reusable Module Catalogue

Living implementation checklist. Reviewed 5 November 2026.

**Update this file whenever a capability is implemented, tested, reviewed and merged.** This is the module backlog and status source of truth.

## Definition of done

A folder, interface or mock adapter does not make a module complete. Mark a module implemented only when its domain rules, tenant-scoped persistence, permissions, API/UI where applicable, automated tests, operational controls and documentation are merged to main.

- [x] Implemented and merged to main.
- [~] Foundation/interface exists, partial, or work not yet merged.
- [ ] Not implemented.
- [!] Production blocker or required hardening.

## Architecture rule

Build capabilities once and assemble client products with tenant configuration, templates, permissions and module entitlements. Do not fork the platform for each client. Keep the initial architecture as a modular monolith: applications call explicit package/service interfaces; domain packages do not depend on Fastify, Next.js, or vendor SDKs.

# A. Platform foundations

| Status | Module | Capability / completion criteria |
|---|---|---|
| [x] | Identity and authentication | Better Auth, email/password, sessions, email verification, password reset, secure cookies, rate limits and HTTP integration tests. |
| [x] | Organizations and memberships | Multi-organization membership, invitations, active organization, tenant roles and separate platform roles. |
| [x] | Tenant registry and context | Internal tenant UUID, organization-to-tenant mapping, trusted server-side resolution and verified-host lookup. |
| [x] | Tenant isolation | Application tenant filters, forced PostgreSQL RLS, tenant-aware foreign keys, least-privilege DB roles and cross-tenant tests. Extend this requirement to every new tenant-owned table. |
| [x] | Client workspace administration | /admin workspace metrics, team listing, invitations, role changes and member removal; PR #5 is merged. |
| [ ] | Platform-owner administration | Global tenant directory/lifecycle, platform-member management, assign client owners, suspend/close tenants, support tools and global audit. Separate from client administration. |
| [~] | Client provisioning | Organization-to-tenant reservation/mapping exists. Still add onboarding workflow, failure reconciliation, initial workspace configuration and provisioning status. |
| [ ] | Tenant settings and branding | Logo, colors, typography, favicon, locale, timezone, currency, contact/legal details, navigation and configurable defaults. |
| [~] | Custom domains | Verified-domain lookup exists. Add DNS challenge, domain ownership workflow, retries, TLS/SSL lifecycle, redirects, removal and domain settings UI. |
| [ ] | Module catalogue and entitlements | Per-tenant enabled modules, dependencies, plan entitlements, defaults, safe enable/disable and upgrade handling. |
| [ ] | Permission registry | Central resource/action vocabulary, module-owned permission declarations, role mapping and server enforcement. |
| [ ] | Audit log | Append-only records of sensitive actions: actor, tenant, action, target, timestamp, correlation ID and safe change metadata. Not the same as analytics. |
| [ ] | API keys and service accounts | Scoped machine identities, hashed secrets, expiry, rotation, revocation, tenant binding, rate limits and audit events. |
| [ ] | Webhook platform | Tenant-configured outbound endpoints, subscriptions, signing secrets, attempts, retries, replay protection and delivery logs. Separate from inbound payment webhooks. |
| [ ] | Localization foundation | Language/locale, timezone, translated messages, currency/date formatting, regional address rules and time-zone-safe scheduling. |
| [ ] | Feature flags and quotas | Per-tenant feature gates and limits for seats, storage, domains, API calls, deployments and background jobs. |
| [ ] | Platform billing | Bazion client plans, subscriptions, invoices, grace periods, usage metering, cancellations and entitlements. Separate from a client's customer checkout. |

# B. Reusable website and application modules

| Status | Module | Capability / completion criteria |
|---|---|---|
| [ ] | CMS / content management | Tenant-scoped pages and content, drafts, publishing, scheduling, revisions, authors, approvals and navigation. |
| [ ] | Page builder and block library | Schema-driven reusable sections, layouts, responsive variants, preview, validated configuration and safe custom fields. |
| [ ] | Template catalogue | Versioned corporate, ecommerce, school, church and booking templates with manifests, previews, compatibility and upgrade strategy. |
| [~] | Design system | A basic Button exists. Build tokens, typography, forms, tables, navigation, dashboard shell, accessibility states and tenant themes. |
| [~] | Media and document storage | Storage interface and tenant object-key helper exist. Add provider adapters, metadata, signed uploads, MIME/size validation, transformations, retention and deletion. |
| [ ] | SEO and site discovery | Metadata, canonical URLs, redirects, sitemap, robots, structured data, social previews and image alt text. |
| [ ] | Forms and lead capture | Form schema/builder, validation, consent, spam protection, submissions, exports, autoresponders and routing. |
| [ ] | Search | Tenant-filtered search, indexing/reindexing, ranking and autocomplete. Start with PostgreSQL before adding another service. |
| [ ] | Navigation and menus | Nested menus, ordering, internal/external links, visibility rules and responsive rendering. |
| [ ] | Localization of content | Translated records/pages, fallback language, localized slugs and translated SEO metadata. |
| [ ] | Document generation | Tenant-branded PDFs/print templates for invoices, receipts, certificates, statements, reports and letters. |
| [ ] | Customer/contact directory | People, companies/households, tags, consent, notes, communication preferences, import/export and relationships to orders/bookings/members. |
| [~] | Notifications | Email/SMS provider interface exists. Add durable outbox, worker, templates, preferences, delivery status and retry handling. |
| [ ] | Workflow and background jobs | Durable jobs, schedules, retry/backoff, dead letters, idempotent handlers and tenant-aware payloads. |
| [~] | Booking and calendar | Basic booking types/window validation exist. Add availability, resources, recurring rules, timezone correctness, conflict detection, blackout dates and reminders. |
| [~] | Analytics | Basic tenant event/sink interface exists. Add privacy rules, tenant dashboards, conversions, reports, export and retention. Do not use it as an audit log. |
| [ ] | Reviews and testimonials | Moderation, ratings, replies, publication state, abuse reporting and tenant-scoped display. |
| [ ] | Support desk | Customer conversations, internal notes, assignment, status, SLA/priority, attachments and canned replies. |
| [ ] | Integration hub | Provider connections, scoped credentials, health, sync cursors, mapping, retries and revocation. |
| [ ] | Consent and privacy | Consent records, cookie preferences, export/deletion, retention schedules, privacy notices and request tracking. |

# C. Commerce modules

The repository has an early Bazion-owned commerce implementation. Extend it deliberately; do not introduce a second commerce engine without an architecture decision.

| Status | Module | Capability / completion criteria |
|---|---|---|
| [~] | Product catalogue | Product listing and records exist. Add editor, categories, variants, attributes, images, publication, bulk actions and import/export. |
| [~] | Cart and checkout | Guest cart, cart items, order creation and idempotency foundation exist. Add authenticated carts, promotions, tax/shipping calculation and checkout recovery. |
| [~] | Orders | Order/order-item persistence exists. Add lifecycle, fulfilment status, admin actions, cancellation, returns/refunds and customer history. |
| [~] | Payments | Provider contract and mock flow exist. Add real adapters, verified callbacks/webhooks, reconciliation, refunds and failure handling. |
| [ ] | Inventory | Stock locations, availability/reservations, adjustments, transfers, expiry and reconciliation. |
| [ ] | Pricing and promotions | Price lists, scheduled prices, coupons, discounts, bundles and promotion rules. |
| [ ] | Tax | Jurisdiction/rate setup, inclusive/exclusive rules and invoice snapshots. |
| [ ] | Shipping and fulfilment | Zones, rates, carriers, packages, tracking, split fulfilment and delivery notifications. |
| [ ] | Returns and refunds | Return requests, approval, returned stock, refund workflow and payment-provider reconciliation. |
| [ ] | Loyalty and store credit | Points, rewards, credit ledger, expiry and adjustments. Build when a real client use case requires it. |
| [ ] | Customer commerce portal | Profile, addresses, saved carts, order history, tracking, returns and preferences. |

Commerce payments and Bazion platform subscription billing must have separate ledgers, permissions, credentials and reports.

# D. Reusable vertical solution packs

Vertical packs are configurations of shared modules, not independent copies of platform code.

| Status | Pack | Modules assembled |
|---|---|---|
| [ ] | Corporate / professional website | CMS, page builder, templates, media, forms, SEO, search, analytics and contacts. |
| [ ] | Ecommerce | Commerce, payments, inventory, shipping, tax, CMS, media, customer portal, notifications and analytics. |
| [ ] | Church / ministry management | Members/families, groups/cells, attendance, services/events, volunteers, giving/donations, pastoral-care records, communications and reports. |
| [ ] | School management | Admissions, students/guardians, classes/terms, subjects, timetable, attendance, assessments, fees, reports, communication and optional transport/library. |
| [ ] | Booking / professional services | Service catalogue, staff/resources, availability, appointments, deposits/payments, reminders, cancellations and customer records. |
| [ ] | Membership / association / NGO | Member registry, membership plans/renewals, events, contributions/donations and member portal. |
| [ ] | Events and ticketing | Events, venues, tickets, registration, payments, check-in, certificates and notifications. |
| [ ] | Property / accommodation | Listings, availability, enquiries, reservations, guest records, housekeeping/maintenance and payments. |

Each pack needs a manifest specifying required/optional modules, default roles, navigation, page templates, tenant settings and migration dependencies.

# E. Operations and developer platform

| Status | Module | Capability / completion criteria |
|---|---|---|
| [ ] | Client project provisioner | Create client projects from templates, apply configuration, create resources, record ownership and show setup status. |
| [ ] | GitHub integration | Repository connection/creation, branch and PR automation, Actions, deployment status and webhooks. Keep GitHub as the initial forge. |
| [ ] | Deployment adapters | Static/server builds, deployments, preview environments, environment binding, rollback and history. Provider-specific details stay behind adapters. |
| [ ] | Environment and secrets | Per-client dev/staging/prod variables, scoped secrets, rotation and redaction. |
| [ ] | Database lifecycle | Provisioning, migrations, seeding, upgrades, archival, tenant retirement and recovery. |
| [ ] | Backups and recovery | Automated DB/object backups, retention, off-site copies, point-in-time recovery where supported and scheduled restore drills. |
| [ ] | Observability | Structured logs, metrics, traces, correlation IDs, error reporting and tenant-safe operations views. |
| [ ] | Uptime and status | Health/synthetic checks, incidents, maintenance notices and client status page. |
| [ ] | Usage metering | Seats, storage, bandwidth where measurable, domains, deployments, jobs and API usage. |
| [ ] | Security operations | Dependency/secret scanning, vulnerability response, security headers, rate limits, incident log and access reviews. |
| [ ] | Release management | Versioned packages/templates, compatibility checks, migration release notes, previews and rollback procedures. |
| [ ] | CLI and scaffolding | Generate a module, adapter, template or client project using approved conventions. |
| [ ] | Developer documentation | Module/API references, setup, deployment runbooks, client handover and upgrade guides. |
| [ ] | MCP / AI integration | Permission-checked tools calling application services/APIs, scoped agents, approvals for consequential actions, audit and rate limits. Never expose privileged database access to agents. |

# F. Open-source and free-tier candidates

These are candidates, not blanket commitments. Re-check licensing, edition boundaries, advisories, maintenance and hosting limits before adoption.

| Capability | Candidate | Decision guidance |
|---|---|---|
| Auth | Better Auth | Already adopted; self-hosted TypeScript auth foundation. |
| Tenant enforcement | PostgreSQL RLS + explicit app scoping | Already adopted. Every new tenant table needs RLS, grants and isolation tests. |
| CMS | Payload CMS | MIT; its multi-tenant plugin supports tenant filtering and rejects writes to unassigned tenants. Run a proof of concept; Bazion still owns API authorization and DB boundaries. |
| Commerce reference | Medusa modules | Useful domain decomposition reference (product, cart, order, pricing, payment, inventory, fulfilment, tax). Its core is MIT but separately licensed Enterprise materials exist; do not add a duplicate engine casually. |
| Jobs | pg-boss | MIT and PostgreSQL-backed; at-least-once delivery means handlers must be idempotent. It can avoid adding Redis before we need it. |
| Object storage | Cloudflare R2 initially | Managed, not open source; current free tier lists 10 GB-month storage, 1M Class A and 10M Class B operations/month, and no egress charge. Keep it behind our storage port. |
| Self-hosted object storage | SeaweedFS | Apache-2.0 S3-compatible candidate. Avoid standardizing on MinIO: its upstream repo was archived on 25 April 2026. |
| Analytics | Umami | MIT, self-hostable and privacy-oriented. Keep the Bazion event interface provider-neutral. |
| Telemetry | OpenTelemetry | Vendor-neutral instrumentation for logs, metrics and traces; not itself a storage/dashboard backend. |
| Search | PostgreSQL FTS first; Meilisearch CE later | PostgreSQL already supports full-text search. Meilisearch CE is MIT; some Enterprise features are BSL/commercial. |
| Secrets | Hosted environment secrets initially; OpenBao later | OpenBao is a self-hostable secrets manager under MPL-2.0; operating it adds responsibility. |
| Support | Chatwoot optional integration | FOSS version is MIT; integrate as a service rather than coupling internals. |
| Forms/surveys | Bazion-owned form module first | Formbricks core is AGPLv3 and its project says it is not offered as a white-label product. Review terms before embedding/rebranding. |
| Uptime | Uptime Kuma | MIT-licensed self-hosted monitoring/status candidate. |
| PostgreSQL backups | pgBackRest | MIT-licensed backup/restore candidate. |
| Experiments/flags | GrowthBook only if needed | Mostly MIT, but some Enterprise directories are commercial. Use only reviewed permissive components or start with simple internal tenant entitlements. |

Research links:
- [Better Auth Organization](https://better-auth.com/docs/plugins/organization)
- [PostgreSQL Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Payload multi-tenant plugin](https://payloadcms.com/docs/plugins/multi-tenant) · [Payload MIT licence](https://github.com/payloadcms/payload/blob/main/LICENSE.md)
- [Medusa commerce modules](https://docs.medusajs.com/resources/commerce-modules) · [Medusa repository/licensing](https://github.com/medusajs/medusa)
- [pg-boss](https://pgboss.io/introduction)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [SeaweedFS](https://github.com/seaweedfs/seaweedfs) · [MinIO archive notice](https://github.com/minio/minio)
- [Umami](https://github.com/umami-software/umami) · [OpenTelemetry](https://opentelemetry.io/docs/)
- [Meilisearch editions](https://github.com/meilisearch/meilisearch) · [OpenBao](https://openbao.org/docs/)
- [Chatwoot terms/licensing](https://www.chatwoot.com/terms-of-service) · [Formbricks licence](https://github.com/formbricks/formbricks)
- [Uptime Kuma licensing](https://uptimekuma.io/licensing/) · [pgBackRest licence](https://github.com/pgbackrest/pgbackrest/blob/main/LICENSE)

**Free-tier warning:** a free managed service is not open-source software. We may use free tiers while keeping our own interface portable. Free limits, uptime guarantees and retention terms must be documented per client.

# G. Multi-agent delivery protocol

Agents can work concurrently only when their ownership boundaries are explicit. Each agent uses a separate branch/worktree and submits a focused PR.

| Agent lane | Owns | Shared files requiring integration-lead approval |
|---|---|---|
| Integration lead | Architecture, dependency graph, release order and PR integration | Root manifests, workspace config, CI, shared contracts |
| Platform/security | Auth, tenant context, permissions and security tests | Auth policies, tenant resolver, RLS standards |
| Database integrator | Migration sequence, grants, RLS, DB test setup | All SQL migrations and migration runner |
| CMS/templates | CMS adapter, content/block schemas, template manifests | Shared tenant/auth contracts |
| Storage/media | Storage port, R2/S3 adapter, upload validation, media metadata | Shared SQL migrations |
| Notifications/jobs | Outbox, provider interfaces, workers, retries and tests | Auth schema and root workspace files |
| Booking | Availability, calendar/resource domain, conflict/time-zone tests | Shared tenant/auth contracts |
| Analytics/audit | Event taxonomy, analytics sink, audit event contract | Shared SQL migration sequence |
| UI/design system | Tokens, components and component tests in its package | Global CSS and other agents' dashboard routes |
| Vertical packs | Church/school/corporate/ecommerce manifests and requirements | Shared module implementations |

Mandatory rules:

1. One branch and worktree per agent. Never share a working directory or feature branch.
2. The integration lead owns platform contracts, API contracts, root manifests, lockfile, CI and shared architecture decisions.
3. The database integrator assigns migration numbers. The current runner sorts NNNN_name.sql filenames and records each filename in schema_migrations; agents must not independently choose colliding numbers.
4. Every new tenant-owned table needs a tenant key, explicit filters, forced RLS, correct grants, tenant-aware relationships and cross-tenant tests.
5. Import another package through its public exports, never private source paths. Keep domain code free of framework and vendor SDK imports.
6. Provider credentials and SDK types stay inside adapter packages.
7. Do not have concurrent agents edit the root package manifest or lockfile. The integration lead integrates dependency changes and updates the lockfile.
8. Module feature gates default off until tenant provisioning and permissions are wired.
9. One focused PR per module, including contract, implementation, permissions, tests, migration request, docs and rollback/recovery notes.
10. Merge only after frozen install, typecheck, unit/API tests, migration validation, tenant-isolation tests where applicable and production build pass.

## Required module manifest before coding

- [ ] Module ID/name, owner and intended clients/use cases.
- [ ] Public exports, routes and API contract.
- [ ] Domain entities and tenant ownership.
- [ ] Permission resources/actions and default roles.
- [ ] Tables, indexes, foreign keys, RLS policy and assigned migration owner.
- [ ] Events emitted/consumed and background jobs.
- [ ] Tenant configuration, provider adapters and secrets.
- [ ] Dependencies and compatible module versions.
- [ ] Feature entitlement and navigation behavior.
- [ ] Unit, API, authorization and tenant-isolation tests.
- [ ] Logs, audit events, metrics, retention and recovery.
- [ ] Enable/disable, upgrade and documentation procedure.

# H. Recommended implementation sequence

## Gate 1 — finish the shared platform shell
- [ ] Build the platform-owner dashboard and tenant lifecycle.
- [ ] Complete tenant provisioning reconciliation and custom-domain verification.
- [ ] Implement the module registry, tenant entitlements and tenant settings.
- [ ] Add platform audit logs and API keys/service accounts.
- [ ] Update README/architecture docs to reflect merged authentication, lockfile, migrations and client dashboard.

## Gate 2 — reusable delivery primitives
- [ ] Durable notification outbox and worker.
- [ ] Media library and storage adapter.
- [ ] CMS, page/block builder and template manifests.
- [ ] Shared UI/design system and admin shell.
- [ ] Forms and lead capture.
- [ ] Workflow/job scheduling and event contracts.
- [ ] Search and analytics integrations.

## Gate 3 — business modules
- [ ] Commerce hardening: inventory, real payments, tax, shipping, fulfilment, returns/refunds and customer portal.
- [ ] Booking/reservations.
- [ ] CRM/customer management.
- [ ] Platform billing and usage metering.
- [ ] Document generation and support workflows.

## Gate 4 — vertical solutions
- [ ] Corporate website pack.
- [ ] Ecommerce pack.
- [ ] Church/ministry management pack.
- [ ] School management pack.
- [ ] Booking/professional services pack.
- [ ] Membership/NGO and events packs as demand justifies.

## Gate 5 — operations and AI
- [ ] Project provisioning, deployments, domains and environments.
- [ ] Backups, restore drills, observability, monitoring and status.
- [ ] CLI/scaffolding, package versioning and module catalogue UI.
- [ ] Permission-checked MCP servers and agent workflows.

## Release rule

A module is complete only when its implementation and tests are merged to main, its migrations are applied safely, its tenant boundary is verified, and its runbook/upgrade path is documented. A feature in an unmerged branch stays [~], not [x].

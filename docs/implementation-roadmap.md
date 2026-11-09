# Bazion Web implementation roadmap

Reviewed 5 November 2026. This is the delivery order for the 111 advertised capabilities mapped in `products/catalog.json`. Each phase ships reusable modules first and solution bundles second.

## Operating principles

- Build a modular monolith first; extract services only when scaling, isolation or team boundaries prove the need.
- Start with the smallest complete customer workflow, not the broadest list of screens.
- Prefer open-source packages with permissive licences. Use free managed tiers where economical, behind Bazion-owned adapters.
- Do not add dependencies or empty packages until a planned vertical slice will consume them.
- One migration integrator assigns migration numbers. Every tenant table must have explicit tenant filters, forced RLS, tenant-aware relationships and cross-tenant tests.
- Every module is feature-gated by tenant entitlement and defaults off until permissions and provisioning are wired.
- A feature is complete only after tests, security review, runbook and rollback/upgrade path are merged.

## Phase 0 — Stabilize engineering and secure the platform

**Goal:** keep the current foundation reliable before widening the feature surface.

Deliver:
- Complete and merge the tenant provisioning reconciliation work in PR #8 after review; preserve unmatched/conflicting rows for manual inspection.
- Keep PR #7's encrypted notification outbox as the foundation for durable transactional messages; add a dedicated notification worker and connect Better Auth verification/reset/invitation callbacks.
- Split notification enqueue and worker DB roles from the tenant-provisioner role.
- Add platform audit-event contract and a first append-only audit implementation for sensitive admin/security actions.
- Create a permission registry and a versioned module-manifest validation command.
- Fix CI so active jobs are not cancelled, PRs are validated once, CI is read-only, and no lockfile commits are pushed from workflows.
- Remove stale status documentation and keep catalogue status aligned with main.

**Exit gate:** CI install/migrate/typecheck/test/build is stable; tenant recovery is permission-gated and tested; sensitive notifications survive worker restarts; no production onboarding relies on fire-and-forget email.

**Repository delivery status — 5 November 2026:** PR #8 (tenant reconciliation), PR #9 (catalogue/CI), PR #10 (durable authentication notifications) and PR #11 (append-only audit and module permission registry) are merged. PR #10 and PR #11 each passed their full GitHub Actions PR validation (install, migrations, typecheck, tests and build). The code-side Phase 0 deliverables are therefore implemented.

**Operational exit gate still outstanding:** on the target environment, provision the notification enqueue/worker roles if the PostgreSQL volume predates migration 0004; apply migrations 0004 and 0005; set a unique protected 32-byte notification encryption key; configure verified SMTP; deploy the notification worker under a supervisor; and demonstrate normal delivery plus lease recovery after an interrupted worker. Confirm queue-age/dead-letter monitoring and document the approved audit retention policy. Do not call Phase 0 production-complete until these environment checks have been evidenced.

## Phase 1 — Platform control plane

**Goal:** make Bazion able to create, configure, enable, suspend and support client workspaces.

Deliver:
- Platform-owner app in `apps/admin`, separate from each client's workspace admin.
- Tenant directory, lifecycle states, provisioning status, ownership assignment, suspension and closure workflow.
- Tenant settings: brand logo/colors, typography, favicon, locale, timezone, currency, contacts, legal details and defaults.
- Module registry, dependency graph, per-tenant module enablement, plan entitlements, quotas and safe enable/disable.
- Verified custom-domain ownership workflow: DNS challenge, retry, TLS readiness, redirects and removal.
- Platform membership/roles and scoped API keys/service accounts.
- Append-only admin audit log, correlation IDs and platform support actions.
- Initial usage metering for seats, storage, domains, deployments and jobs.

**Exit gate:** a platform owner can provision a client, assign an owner, enable modules, set branding/domain and safely suspend or restore access without direct SQL.

## Phase 2 — Shared design system and website factory

**Goal:** turn website packages into configuration-driven products rather than separate codebases.

Deliver:
- Expand `packages/ui`: design tokens, typography, navigation, buttons, inputs, forms, tables, dialogs, uploaders, menus and accessibility states.
- Tenant theme provider with constrained design tokens; prevent arbitrary unsafe script injection.
- CMS proof of concept using Payload; confirm Better Auth integration, tenant permissions, migration strategy and RLS boundary before adoption.
- Puck proof of concept for visual page composition using Bazion-owned blocks and data schemas.
- Content pages, posts/news, revisions, drafts, scheduled publishing, multi-author workflow and menus.
- Versioned template manifests: corporate, SME, professional services, startup and campaign pages.
- SEO metadata, canonical/redirect rules, robots/sitemap and structured data.
- Reusable responsive block library: hero, feature grid, pricing, testimonials, logos, CTA, FAQs, gallery, maps and contact sections.

**Exit gate:** produce a new SME/client site using template + tenant configuration + content without copying application source or forking the platform.

## Phase 3 — Lead capture, contacts and shared content services

**Goal:** provide the reusable functions needed by nearly every business website.

Deliver:
- Form schema/builder, validation, conditional logic, uploads, spam controls, consent and submission records.
- Contact/customer directory: individuals, organizations, household relationships, tags, notes and communication preferences.
- Lead pipeline and assignment, import/export, deduplication and consent audit.
- Image transforms, durable metadata, retention/usage controls and guarded deletion for the shared media library; keep S3-compatible providers behind the storage adapter.
- Document hub and permission-checked document vault.
- Localization primitives for language, timezone, formatting, content translations and translated slugs.
- Search begins with PostgreSQL full-text search; add Meilisearch only after measurement.
- Newsletter subscriber consent and campaign-provider adapter; keep campaigns separate from transactional email.
- WhatsApp and Maps as optional provider integrations, not assumptions in domain logic.

**Exit gate:** website enquiries are securely captured, assigned and followed up; content/media/docs are tenant-isolated; basic search and SEO work end-to-end.

## Phase 4 — Customer portals, booking and business workflows

**Goal:** reuse customer/contact data for higher-value interactive applications.

Deliver:
- Customer portal framework with profile, documents, requests, appointments and account activity.
- Booking availability engine, resources/staff, recurring windows, timezone-safe scheduling, conflict prevention, blackout periods, cancellation and reminders.
- Notification templates/preferences, delivery receipts, retry visibility and operator requeue.
- Background worker supervision, job idempotency, retry/backoff, dead letters and scheduled tasks.
- Support desk: conversations, assignment, internal notes, priority, SLA timers and attachments.
- Integration hub: scoped credentials, provider health, event/webhook subscriptions, signed delivery, retries, replay and revocation.
- Document generation for PDFs, statements, invoices, certificates and printable reports.

**Exit gate:** a service-business client can receive an enquiry, create a customer record, schedule a booking, exchange documents and communicate through one tenant workspace.

## Phase 5 — Production ecommerce

**Goal:** turn the starter commerce flow into a real commercial system.

Deliver:
- Product editor, categories, variants, attributes, images, publication and bulk import/export.
- Cart persistence for guests and signed-in customers; price revalidation and checkout recovery.
- Order lifecycle, fulfilment state, customer history, administration, cancellations and returns.
- Inventory ledger, locations, reservations, expiry/reconciliation, adjustments and stock alerts.
- Pricing rules, promotion schedules, coupons, discounts, bundles and multi-currency precision.
- Tax calculation interface with market-specific rules and invoice snapshots.
- Shipping zones/rates, courier adapters, shipment tracking and delivery proof.
- Validate the existing Safaricom Daraja STK Push in sandbox and with a live merchant, add callback-loss reconciliation and reversals, then add a card provider based on customer demand.
- Verify signatures, amount, currency, merchant account and event identity on webhooks; implement idempotent inbox, reconciliation, refunds and dispute state.
- Abandoned-cart messages and order notifications through the durable outbox.
- B2B/marketplace and recurring subscriptions only after ordinary single-merchant commerce is stable.

**Exit gate:** live payment is verified and reconciled; duplicate callbacks do not double-fulfil orders; inventory and tenant boundaries pass integration tests. Never use the mock-payment flow for real money.

## Phase 6 — Hosting, deployment and care operations

**Goal:** operationalise the hosting, managed-cloud and care packages advertised by Bazion.

Deliver:
- Provider-neutral hosting/resource provisioning interface.
- GitHub repo/deployment integration, builds, preview/staging, promotion, rollback and deployment history.
- Environment and secret management with scoped access and rotation.
- Custom domains, DNS verification, TLS lifecycle, redirects and domain handover.
- Managed database provisioning, migrations, seeding, archival and offboarding.
- Object/database backups, off-site retention, restore drills and documented RPO/RTO.
- OpenTelemetry instrumentation, structured logs, metrics, traces and tenant-safe dashboards.
- Uptime and synthetic checks, performance/Core Web Vitals monitoring, incident management and status pages.
- Resource/usage metering and quotas for compute, storage, jobs, seats, domains and deployments.
- Maintenance plans, update windows, security scans, SLA evidence, priority support and client reporting.
- Integrate mailbox services/provider APIs for corporate email first; do not operate a self-hosted mail server until there is a tested operational reason.

**Exit gate:** a client can be deployed, monitored, backed up, restored and supported with measurable service levels. Hosting plan differences are configured as resource/retention entitlements rather than separate products.

## Phase 7 — Vertical solution packs

**Goal:** turn common modules into sellable solutions using manifests and templates.

Recommended sequence:
1. SME/business corporate website — first repeatable website offer.
2. Professional services — adds contacts, booking, client portal and documents.
3. Ecommerce — shared website engine plus hardened commerce modules.
4. Startup SaaS — tenant control plane, module entitlements and platform billing.
5. Church/ministry — members, family/groups, attendance, events, volunteer, giving and reporting.
6. School/LMS — admissions, students/guardians, classes, timetable, attendance, assessments, fees, learning and certificates.
7. NGO/membership — member registry, programs, events, contributions and reporting.
8. Clinic management — controlled patient administration and appointment/billing workflows; separate security/legal review before handling clinical records.
9. Enterprise ERP — staged finance, procurement, inventory and supply-chain domains based on a signed requirements scope.

For every pack, define manifest, default roles, menu, page templates, required/optional modules, tenant defaults, sample data, upgrade notes and acceptance tests.

**Exit gate:** a new client solution is created from a manifest and configuration, not a fork; module enablement and role defaults are validated by automated tests.

## Phase 8 — Commercial operations and enterprise expansion

**Goal:** operationalise the sales, delivery and service plans without mixing them into client runtime domains.

Deliver:
- Commercial SKU/offer registry mapped to module entitlements and service scope.
- Quote builder, discovery/specification workflow, estimates and approval.
- Project delivery milestones, client review, revision rounds, change requests and handover.
- Platform subscription billing, invoices, grace periods, cancellation and usage metering.
- Care/hosting plan entitlements and SLA reports.
- Advanced ERP/finance integrations and enterprise data exchange only after vertical validation.
- Release management, package/template compatibility, migrations and rollback.
- CLI/scaffolding and developer documentation.

**Exit gate:** a quote is assembled from reusable modules and service scope; acceptance and handover are auditable; subscription billing is separated from customers' ecommerce payments.

## Phase 9 — AI/MCP and automation

**Goal:** let agents operate the platform safely after its APIs, permissions and audit controls are mature.

Deliver:
- MCP tools that call existing application services/API use cases.
- Tenant-scoped, role-checked tools for pages, content, enquiries, bookings, orders, reporting and support.
- Human approval for payments/refunds, domain changes, tenant suspension, access changes and destructive actions.
- Per-agent service identities, quotas, audit trail, redacted logs and revocation.
- Scaffolding agents and validated module generators.

**Exit gate:** agents have no direct privileged database access, every action is permission-checked, and consequential operations are auditable and approval-gated.

## Cross-phase release gates

Every module PR must include:
- Manifest and ownership declaration.
- API/contract changes and backward-compatibility notes.
- Database migration request, tenant ownership, indexes, grants and RLS when applicable.
- Unit, integration, authorization and tenant-isolation tests.
- UI/accessibility tests when there is a UI.
- Provider adapter tests with mocked/sandboxed boundaries.
- Logs, audit events, metrics, rate limits and failure handling.
- Data retention, export/deletion, backup and restore implications.
- Runbook, enable/disable, migration, upgrade and rollback instructions.

## Parallel work strategy

Parallelize by ownership lane, not by arbitrary feature count:
- Platform/security and permissions.
- Database/migration integrator.
- Website content/page builder/templates.
- Storage/media/documents.
- Notifications/jobs/integrations.
- Commerce/payment/inventory/fulfilment.
- Booking and CRM.
- Education and ministry solution packs.
- UI/design system.
- Operations/deployment/observability.

Each lane uses its own branch/worktree and PR. The integration lead owns shared contracts, root workspace files, lockfile, CI and migration sequence. Do not let multiple agents edit shared files concurrently. Merge only after the CI gates pass.

## Scope discipline

Do not build all phases at once. Finish one vertical slice that creates visible client value, then add the next module. Use managed free tiers initially where they fit, but document the limits and keep interfaces portable. Do not self-host a component solely because it is open source; operating and securing it is also a cost.

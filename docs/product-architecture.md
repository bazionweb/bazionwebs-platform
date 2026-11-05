# Bazion Web product architecture

## 1. Product strategy

Bazion Web is a reusable platform and delivery engine, not a collection of client-specific website repositories.

The public commercial catalogue describes **what Bazion sells**. The module catalogue describes **which reusable capabilities implement those offers**. A solution manifest describes **how selected modules are assembled for a client type**.

Keep these three things separate:

1. Capability: a discrete feature or provider integration.
2. Module: a cohesive domain boundary that owns business rules and public interfaces.
3. Offer/solution: a configuration, entitlement, template and delivery scope composed from modules.

The repository now registers 111 advertised capabilities, 36 reusable module boundaries, 35 commercial offer IDs and nine initial solution manifests. It intentionally does not create one package for each capability.

## 2. Target repository layout

```text
apps/
  api/                    Fastify HTTP API and module orchestration
  storefront/             Tenant-facing websites, portals and client workspace UI
  admin/                  Platform-owner control plane (reserved; distinct from client admin)
  worker/                 One supervised process for durable jobs and notification delivery (planned)

packages/
  platform-contracts/     Tenant, principal, actor and shared platform types
  api-contracts/          Zod request/response contracts
  database/               Drizzle schema, SQL migrations, role grants and RLS tests
  auth/                    Better Auth, sessions, organization membership and authorization
  ui/                      Shared design system; expand the existing package
  commerce-domain/         Commerce business rules; extend the existing package
  payments/                Payment ports and provider adapters
  storage/                 Object storage port and provider adapters
  notifications/           Encrypted notification outbox and delivery contracts
  booking/                 Booking domain rules
  analytics/               Tenant-aware event/sink contracts

  module-registry/         Module manifests, dependencies and tenant entitlements (planned)
  audit/                   Append-only audit domain (planned)
  content/                 Tenant-scoped pages and publishing (planned)
  page-builder/            Visual composition and safe block schemas (planned)
  forms/                   Forms, submissions, spam protection and consent (planned)
  contacts/                CRM/contact directory and relationships (planned)
  documents/               Secure file/document records and PDF generation (planned)
  search/                  Tenant-aware search contract and indexing (planned)
  localization/            Locale, translation and formatting services (planned)
  inventory/               Stock ledger and reservations (planned)
  fulfilment/              Shipping, carrier and returns workflows (planned)
  billing/                 Platform subscriptions, plans and invoices (planned)
  education/               School and LMS domain (planned)
  ministry/                Church/ministry domain (planned)
  healthcare/              Clinic administration domain (planned)
  erp/                     Enterprise finance/procurement/supply-chain domains (planned)
  integrations/             External APIs, inbound/outbound webhooks and connectors (planned)
  jobs/                    General background/scheduled job contract (planned)
  hosting/                 Hosting/resource provisioning adapters (planned)
  domains/                 Domain ownership, DNS and TLS workflows (planned)
  deployments/              Build/deploy/preview/rollback adapters (planned)
  backups/                  Backup, restore and recovery orchestration (planned)
  observability/            Telemetry, health and SLO contracts (planned)
  security-ops/              Security scan, key/access review and incident processes (planned)
  support/                  Support tickets, care plans and SLA workflows (planned)
  sales/                    Commercial catalogue, quotes and estimation (planned)
  projects/                 Discovery, delivery, revisions and handover (planned)
  marketing/                Campaigns and newsletter subscriptions (planned)

products/
  catalog.json
  commercial-offerings.json
  module-manifest.schema.json
  solution-manifest.schema.json

solutions/
  sme-website/manifest.json
  professional-services/manifest.json
  startup-saas/manifest.json
  church-ministry/manifest.json
  school-education/manifest.json
  ngo-membership/manifest.json
  ecommerce/manifest.json
  clinic-management/manifest.json
  enterprise-erp/manifest.json

templates/
  <solution>/<template>/   Versioned page/block/theme compositions (planned)

docs/
  adr/                     Architecture decision records
  operations/               Runbooks and recovery procedures
  product-architecture.md
  implementation-roadmap.md
```

The tree is a target map, not a request to create empty package directories. A package is added to the pnpm workspace when it owns a real domain boundary, has a consumer and can meet the module definition of done.

## 3. Runtime boundaries

### Apps

- `apps/api` owns HTTP routing, transport validation, authentication middleware, rate limits and application orchestration.
- `apps/storefront` renders public tenant sites and tenant-facing portals. Its current `/admin` is the client workspace administration UI.
- `apps/admin` is reserved for Bazion platform-owner operations: global tenant lifecycle, module catalogue, entitlements, domains, support and platform audit. Do not confuse it with an individual client's admin.
- `apps/worker` will host supervised background processing. Prefer one worker deployment with well-isolated handlers over a separate process for every module.

### Packages

- Domain packages contain entities, value objects, invariants and use cases. They do not import Fastify, Next.js, React or provider SDKs.
- Application services coordinate domain operations and repositories.
- Provider packages implement ports behind adapters. Never leak an M-Pesa/Stripe/Mailchimp/Cloudflare-specific payload into core domain contracts.
- Database repositories and migrations own persistence constraints. Apps must not bypass repositories with ad hoc SQL.
- UI components consume contracts and route actions; they do not own authorization.

### Solution packs

A solution is a manifest that composes reusable modules, navigation, templates, default roles, tenant settings and feature entitlements. It may include a small domain extension when genuine vertical rules require it, but must not fork shared auth, forms, media, payments, documents or analytics.

## 4. Module internal layout

When a module is ready to be implemented, use this shape:

```text
packages/<module>/
  package.json
  module.manifest.json
  src/
    domain/                Entities, policies and invariants
    application/           Use cases and orchestration ports
    ports/                 Repository, provider and event interfaces
    adapters/              Database/provider implementations (when module-owned)
    index.ts               Public exports only
  test/
    unit/
    integration/
    authorization/
    tenant-isolation/
  README.md                Setup, operations, migration and upgrade notes
```

Not every module needs every directory. Keep domain logic pure. Export only supported public entry points. Avoid importing another package's private `src/*` paths.

The API routes live in `apps/api/src/modules/<module>/` and delegate to package use cases. Admin/portal UI lives in the appropriate app, with shared components in `packages/ui`.

## 5. Data and security rules

1. Determine ownership before creating a table: tenant-owned, platform-owned or provider/infrastructure-owned.
2. Every tenant-owned row carries `tenant_id`; every query has an explicit tenant predicate and PostgreSQL RLS is enabled and forced.
3. Tenant-aware foreign keys must include tenant identity. Test cross-tenant reads, writes, references and missing tenant context.
4. Never accept a tenant ID from an untrusted request as the authority. Derive active tenant from the verified session/domain context.
5. Permission resources/actions are declared centrally; a hidden UI button is not authorization.
6. Sensitive platform operations require platform roles, audit events and least-privilege DB roles.
7. Keep PII, payment references, document metadata and message payloads out of logs. Encrypt secrets and sensitive queued message content.
8. Use provider-specific credentials per tenant/environment. Do not share credentials or secrets across clients.
9. Define retention, export, deletion, restore and offboarding before collecting customer data.
10. High-sensitivity modules (especially clinic/health data and finance) require a dedicated threat model and legal/compliance review before production use.

## 6. Integrations and open-source product strategy

- Keep GitHub as the initial code forge and CI system. There is no need to self-host a forge before the product requires it.
- Evaluate Payload CMS for structured content and editorial workflow; its multi-tenant plugin supports tenant filtering and rejects writes to unassigned tenants. It must remain behind Bazion tenant authorization and PostgreSQL security, not replace them. See [Payload multi-tenant docs](https://payloadcms.com/docs/plugins/multi-tenant).
- Evaluate Puck for visual composition of Bazion-approved React blocks. Puck is MIT and lets the application own the content data. See [Puck docs](https://puckeditor.com/docs).
- Use the existing PostgreSQL full-text search before adding a separate search cluster.
- The notification outbox is specialized encrypted delivery state. Decide in an ADR whether general jobs use pg-boss or the existing worker mechanism before creating a second general queue. pg-boss is PostgreSQL-backed, MIT, and at-least-once; its handlers must be idempotent. See [pg-boss docs](https://pgboss.io/introduction).
- Use Cloudflare R2 as a replaceable managed storage adapter where free-tier economics make sense; it is not open-source software. See [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- Start with Umami as an optional analytics integration and OpenTelemetry instrumentation for observability. Keep event contracts and instrumentation vendor-neutral.
- Free managed tiers are cost-saving deployment choices, not open-source software or uptime guarantees. Preserve provider portability and document limits.

## 7. What should not be built

- Do not create 111 pnpm packages.
- Do not make one website project per client when the site uses the same product purpose. Configure solution manifests, themes, content and entitlements.
- Do not create separate website/ecommerce/hosting/care engines for each price tier.
- Do not build a proprietary SMTP/mailbox server as an early milestone; first integrate a mailbox provider and isolate transactional mail from customer email hosting.
- Do not add microservices, Redis, Kubernetes, a search cluster or self-hosted control-plane tooling before a measured need.
- Do not embed a second full commerce platform inside the existing Bazion-owned commerce domain without an explicit architecture decision.
- Do not allow AI/MCP tools to connect directly to privileged database roles; expose permission-checked application actions only.

## 8. Definition of done

A module is stable only after:

- Domain rules and public contracts are defined.
- Tenant/platform ownership and all permissions are documented.
- Migration, indexes, grants, RLS and cross-tenant tests are reviewed.
- API and UI are usable where applicable; provider adapters are isolated.
- Unit, integration, authorization and regression tests pass.
- Logs, audit, metrics, rate limits and error handling are added.
- Backups, retention, deletion, restore and offboarding are documented.
- Enable/disable, compatibility, upgrade and rollback paths exist.
- The feature is merged to main and the solution manifests/catalogue reflect its real status.

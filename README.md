# Bazion Web Platform

An ownership-first, modular platform for building and operating reusable websites and client applications. The repository is a **modular monorepo / modular monolith**: shared domain packages, a Fastify API, a Next.js tenant-facing application, PostgreSQL and provider adapters. It is deliberately not split into microservices before there is a measured need.

> **Current maturity:** multi-tenant platform foundation with a separate superadmin, audited tenant controls, module entitlements, shared-RLS isolation, and tenant database-routing contracts. The storefront has reusable church and ecommerce experiences, while the CMS/page builder, tenant-neutral site factory, domain/TLS lifecycle, and production deployment adapters remain incomplete. Daraja checkout and church donation callbacks still need sandbox and merchant-account validation.

## Product catalogue and roadmap

- [Product architecture](docs/product-architecture.md): module boundaries and intended project structure.
- [Reusable module contract](docs/module-development-contract.md): package ownership, app adapters, manifest rules and release criteria.
- [Product catalogue](products/catalog.json): 111 advertised capabilities mapped to 37 reusable modules.
- [Commercial offerings](products/commercial-offerings.json): website/ecommerce/custom-system/hosting/care packages and add-ons mapped to their modules.
- [Solution packs](solutions/): nine initial tenant solution manifests.
- [Product manifests](products/): versioned product compositions validated against their solution, module, template, app and database schema dependencies.
- [Implementation roadmap](docs/implementation-roadmap.md): phase-gated delivery sequence and acceptance criteria.

Do not create one package per advertised capability. Build reusable domain modules, then compose client solutions from manifests, templates, permissions and entitlements.

## What is currently implemented

- Better Auth 1.7.17 with email/password, sessions, verification/reset flows and organization membership.
- Separate platform roles and client-organization roles.
- Tenant registry and organization-to-tenant mapping; trusted server-side tenant context and verified-host lookup.
- PostgreSQL forced RLS, tenant-aware relationships, least-privilege application/auth/resolver/provisioner roles and cross-tenant integration tests.
- Client workspace /admin with tenant-scoped metrics, member listing, invitations and membership management.
- Separate platform superadmin with tenant directory/lifecycle controls, owner assignment, audited module overrides, tenant settings, audit history and initial usage reporting.
- Foundational commerce domain and API: product listing, guest carts, checkout order creation, a development-only mock adapter and a Daraja M-Pesa STK Push adapter with token-protected callbacks and inventory settlement.
- Provider ports for payment, object storage, notifications, booking and analytics.
- Encrypted PostgreSQL notification outbox connected to Better Auth verification/reset/invitation callbacks, with idempotency, atomic claims, lease recovery, retry/backoff, dead-letter controls and a separate supervised SMTP worker.
- Partial church module with tenant-scoped sermon, event, registration, campaign, donation, prayer-request and contact records, plus owner/admin-protected ministry operations.
- Tenant-scoped ministry media uploads and a reusable media library; local and S3-compatible storage adapters.
- Tenant database bindings for shared and dedicated tiers. Dedicated routing fails closed until a provider installs the production secret-resolution and provisioning adapters.
- pnpm 12 workspace, Turborepo, committed lockfile and GitHub Actions validation.

## Technology choices

- Node.js 26, pnpm 12 and Turborepo.
- TypeScript, Next.js 16, Fastify 5, PostgreSQL, Drizzle ORM, Zod and Vitest.
- Better Auth for identity and organization membership.
- PostgreSQL RLS for tenant data isolation.
- Keep provider-specific integrations behind Bazion-owned ports. Free managed tiers may be used initially, but they are not open-source software and must remain replaceable.

## Local setup

1. Install the supported Node.js version used by CI and Git.
2. Install the pinned pnpm version:

   ~~~powershell
   npm install --global pnpm@12.18.0
   pnpm --version
   ~~~

3. Copy .env.example to .env and replace any development values as required.
4. Install from the committed lockfile and start PostgreSQL:

   ~~~powershell
   pnpm install --frozen-lockfile
   docker compose up -d db
   ~~~

   On a fresh PostgreSQL volume, the init script creates the application, migration, authentication, tenant-resolver and tenant-provisioner roles. Docker init scripts only run when the volume is first created. Do not run docker compose down -v if you need to preserve local data.

5. Apply migrations and seed the demo tenant/products:

   ~~~powershell
   pnpm db:migrate
   pnpm db:auth:migrate
   pnpm db:seed
   ~~~

6. Start the API and tenant-facing application:

   ~~~powershell
   pnpm dev
   ~~~

   API health: http://localhost:4000/health

   Storefront: http://localhost:3000

## Test and build

~~~powershell
pnpm typecheck
pnpm test
pnpm build
~~~

The repository CI runs a frozen dependency install, starts PostgreSQL with least-privilege roles, applies migrations twice, migrates the matching Better Auth schema, typechecks, runs unit/auth/tenant-isolation tests and builds all workspaces.

## Production gates still open

- Configure production SMTP, encryption keys and least-privilege notification roles; supervise the worker and demonstrate delivery, restart recovery and queue monitoring.
- Complete production domain routing, TLS issuance/renewal, redirects, handover and safe removal with the chosen hosting provider. Platform admin can issue and verify DNS TXT challenges and disable domains, but those controls do not provision TLS or route traffic by themselves.
- Complete tenant onboarding/recovery workflows, broaden entitlement enforcement to supported modules, and add usage quotas and metering.
- Add production secret-manager and deployment-provider adapters before activating dedicated databases or tenant release routing.
- Validate Daraja callbacks against the Safaricom sandbox and live merchant account; add callback-loss reconciliation, refunds and payment reversals. Production startup requires `PAYMENT_PROVIDER=mpesa`, live Daraja credentials and an HTTPS callback base URL; the mock remains development-only.
- Complete product variants, stock ledger, shipping, taxes, promotions and returns.
- Build the tenant-neutral CMS/page builder, reusable page templates and forms; add image transformation and finish the solution-pack onboarding workflow.
- Add production backups/restore drills, observability, incident response and deployment automation.

Do not use the mock payment endpoint, demo secrets or static development tenant settings for real customers or money.

## Authentication and tenant architecture

- [Authentication and tenant isolation](docs/architecture/authentication-and-tenant-isolation.md)
- [Mermaid architecture source](docs/architecture/authentication-and-tenant-isolation.mmd)
- [Rendered SVG diagram](docs/architecture/authentication-and-tenant-isolation.svg)
- [Platform owner bootstrap](docs/platform-owner-bootstrap.md)
- [Authentication operations](docs/authentication-operations.md)
- [Security guide](docs/security.md)

For the current implementation state, see [implementation status](docs/implementation-status.md).

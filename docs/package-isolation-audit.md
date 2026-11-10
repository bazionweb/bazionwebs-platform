# Package isolation audit and roadmap

Reviewed 10 November 2026. This audit covers the 15 workspace packages and three applications in this repository. It describes ownership boundaries and migration order; it does not recommend turning every catalogue entry into a package.

## Findings

The repository has useful package boundaries already, but application use cases and persistence are still concentrated in the API. The largest pressure points are tenant/module control-plane logic, commerce, and church/ministry workflows. Database ownership is partially split, while the migration runner and schema exports remain central. The product catalogue also contains roadmap capabilities that do not yet have an implemented module; these are not package-isolation defects.

There are no private `@bazion/*/src` deep imports in the audited workspace. Keep package exports as the only cross-package entry points and add a boundary check to CI so this remains true.

## Package and boundary inventory

| Area | Current packages / paths | Assessment | Recommended action |
|---|---|---|---|
| Authentication | `@bazion/auth`; `apps/api/src/lib/auth.ts` | Good adapter boundary around Better Auth and session/auth policy. | Keep identity reconciliation and platform entitlements out of the auth adapter; retain provider-specific auth integration here. |
| Tenant identity and module registry | `@bazion/platform-identity` (currently provisioning reconciliation); `apps/api/src/lib/tenant-modules.ts`, `apps/api/src/modules/admin/module-catalog.ts`, `apps/api/src/modules/admin/routes.ts`, `apps/admin/lib/platform.ts`, plus tenant setup in auth | Highest-priority control-plane gap: registry, tenant lifecycle, module dependencies/entitlements, and platform actions are spread across packages/apps. | Grow provider-neutral identity/registry use cases and ports. Make one manifest registry authoritative; leave HTTP, DB, and Better Auth adapters at edges. |
| Commerce | `@bazion/commerce-domain`, `@bazion/payments`, `@bazion/api-contracts`; `apps/api/src/modules/commerce/routes.ts` and `admin-routes.ts` | Domain inventory/payment settlement rules and API contracts are extracted. HTTP handlers still own most checkout, order, catalog, reservation and payment persistence transactions. | Extract commerce application use cases and repository ports, then implement PostgreSQL adapters in the API/database boundary. Keep Daraja protocol translation inside `@bazion/payments`. |
| Church/ministry | `@bazion/church-ministry-domain`, `@bazion/church-ministry-contracts`; `apps/api/src/modules/church/routes.ts` | Domain rules/contracts are beginning to separate; the route module still owns a large set of workflows and Drizzle persistence. | Extract one use case/repository slice at a time (events/registrations, sermons/content, campaigns/giving, contact/prayer/newsletter). Keep website rendering in the storefront. |
| Database | `@bazion/database/src/schema.ts`, `src/schema/*`, migrations and migration registry | Commerce and tenant schemas have ownership files, but shared platform, audit/notification and ministry schema definitions remain centralized. The migration registry/runner must remain a single authority. | Finish schema ownership split by domain; preserve one ordered registry, migration runner, production preflight, and cross-domain integration gate. Require RLS/tenant relationship declarations for each tenant table. |
| Admin read side | `apps/api/src/modules/admin/routes.ts`, platform audit and usage queries | Platform lifecycle, module controls, audit-history reads and metrics are mixed in one application boundary. | Move audit reads behind `@bazion/audit`; add a real analytics port only when a consuming workflow is defined. Keep Fastify authorization/orchestration in API. |
| UI and templates | `@bazion/ui`, `apps/storefront` | The package name implies generic primitives, but much of its current style/component ownership is church-template-specific. | Separate accessible generic primitives/tokens from church-specific composition and theme. Scope CSS and validate each template before reuse. |
| Reusable infrastructure | `@bazion/storage`, `@bazion/payments`, `@bazion/notifications`, `@bazion/audit`, `@bazion/api-contracts` | Relatively clear adapter/contract boundaries with real consumers. | Keep provider SDKs behind adapters; maintain consumer contract tests and explicit exports. |
| Thin/unused packages | `@bazion/analytics`, `@bazion/booking`, `@bazion/platform-contracts` | These currently lack a complete consuming vertical slice and/or package tests. | Do not broaden abstractions yet. Either add a real workflow, tests, and consumer, or defer/remove the unused package until that work is scheduled. |

The workspace currently has 15 packages: analytics, API contracts, audit, auth, booking, church-ministry contracts, church-ministry domain, commerce domain, database, notifications, payments, platform contracts, platform identity, storage, and UI. The three applications are admin, API, and storefront.

## Phased isolation roadmap

### Phase 0 — Keep package synchronization reliable

- Keep workspace dependencies on `workspace:*`, public package exports explicit, and the pnpm lockfile synchronized with every package change.
- Run package tests/typechecks/builds through Turbo with bounded concurrency and isolated Vitest cache paths.
- Add CI checks for private deep imports, manifest-to-package references, migration registry parity, and package scripts/tests.
- Assign one integrator for root workspace files, lockfile, migration numbering, CI, and shared contracts.

**Exit:** a clean install, full test/typecheck/build, catalog validation, and migration parity all pass in CI without package-boundary exceptions.

### Phase 1 — Tenant identity and module registry

- Define provider-neutral tenant lifecycle, module registry, dependency closure, entitlement decisions, and provisioning ports in the platform identity/control-plane package.
- Make manifests the single source for module identity/dependencies and have API, admin and validation scripts consume the same contract.
- Keep PostgreSQL, Better Auth, secret-manager, HTTP and UI implementations as adapters.
- Add tests for lifecycle, dependency enable/disable, authorization scope, reconciliation conflicts and audit requirements.

**Exit:** platform control-plane decisions can be tested without Fastify, Drizzle, Better Auth or a cloud provider, and duplicate catalogue/entitlement definitions are removed.

### Phase 2 — Commerce application layer and database integrity

- Move checkout, cart/order transitions, inventory reservation/consume/release and payment settlement into application use cases with repository ports.
- Keep route schemas in `@bazion/api-contracts`; keep provider callback parsing/signature checks in `@bazion/payments`; make PostgreSQL adapters own transactions and locking.
- Add callback idempotency/replay, payment failure, stock contention, reservation expiry/reconciliation, refund/reversal and tenant-boundary integration coverage.
- Add an inventory ledger and reconciliation policy before enabling broader production stock workflows. Preserve migration `0015_commerce_inventory_reservation_guard.sql` as a database-level guard against untracked products retaining reservations.

**Exit:** application behavior is testable without PostgreSQL; concurrency and replay safety are verified against PostgreSQL; payment pending state never becomes paid without verified settlement.

### Phase 3 — Church/ministry application layer

- Extract use cases and repository ports by workflow from `apps/api/src/modules/church/routes.ts`.
- Move domain validation/contracts to church-owned packages; leave web presentation and tenant-specific theme in storefront.
- Add authorization, privacy, tenant isolation, audit and retention tests to each private-record workflow.

**Exit:** route handlers are thin transport adapters and each public/private ministry workflow has explicit ownership and access tests.

### Phase 4 — Schema ownership split

- Split remaining central schema definitions into owner modules (platform, audit, notifications, ministry and other domains).
- Keep one migration registry, one runner and one production-preflight entry point. Assign migration numbers through one integrator only.
- For every tenant table, require tenant-aware keys, forced RLS, grants, indexes, migration rollback/upgrade notes and cross-tenant tests.
- Keep the API's dedicated-database check tied to the current registry version and verify all registered migrations before routing traffic.

**Exit:** schema ownership is clear without introducing competing migration authorities; shared and dedicated databases pass the same migration/RLS verification suite.

### Phase 5 — Admin read models, UI and package maturity

- Extract audit queries from platform admin routes into audit read APIs and define an analytics consumer before adding analytics infrastructure.
- Split generic UI primitives from template-specific composition and verify keyboard, reduced-motion, responsive and theme behavior.
- Add consumer-backed tests to booking/platform contracts/analytics when their workflows are implemented; otherwise defer them rather than expanding empty abstractions.

**Exit:** admin routes coordinate use cases, UI package scope matches its name, and every retained reusable package has a consumer or a scheduled vertical slice.

### Phase 6 — Add planned modules as vertical slices

- Build contacts/CRM, website content/CMS, forms, booking, documents and fulfillment only when a complete customer workflow is scoped.
- Each slice includes manifest, contracts, domain/application logic, persistence, permissions, migrations, UI integration, tests, operational notes and a consumer.
- Do not create packages for catalogue-only capabilities or split services merely to match catalogue categories.

**Exit:** new tenant solutions are composed from tested modules/configuration instead of copied application code.

## Parallel work and synchronization

Parallel lanes can work on platform identity, commerce application use cases, church/ministry use cases, and generic UI after their owners agree on contracts. Database schema/migration numbering, root workspace files, public contracts and lockfile updates need a single integration owner. Agents should work in separate branches/worktrees, publish the owned file list and contract assumptions, and avoid overlapping shared-file edits. Merge each lane only after its package tests plus the affected application integration tests pass.

Catalogue-only capabilities such as contacts/CRM and website content are planned product scope, not a reason to add empty packages. The catalogue validator should keep distinguishing advertised capabilities from manifest-backed, buildable modules.

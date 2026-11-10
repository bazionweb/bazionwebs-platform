# Product factory survey audit and implementation roadmap

Reviewed 10 November 2026 against local checkout `b3c72d5` on `feature/church-ministry-platform`. The supplied survey says it inspected GitHub `main`; this review compares its claims with this checkout, which contains changes made after that snapshot. Product and module counts below were verified with `pnpm catalog:validate`.

## Executive assessment

The survey's strategic direction is sound: retain the modular monolith, separate product definitions from customer data, distinguish managed hosting from source-code delivery, publish immutable releases, and avoid treating each capability or customer as a new codebase. It correctly warns that a manifest is not proof that a sellable product exists.

Its repository comparison is stale in several important places. This checkout already has tenant module entitlements, a separate platform control plane, tenant-domain verification controls, dedicated-database routing, extensive migration and RLS validation, and a CI job that starts PostgreSQL and runs database-backed tests. Those foundations should be extended, not rebuilt.

The central gap remains the **product lifecycle layer**. The repository can describe capabilities and solution compositions and can operate a partially configurable, multi-tenant application. It cannot yet define a product release that binds a solution, template, supported modules, configuration schema and runtime/database compatibility; record a customer's installed product version; provision that product through a workflow; or offer a controlled upgrade path. Independent application deployment and customer-owned source delivery are not implemented.

The right approach is to build one customer workflow through the current architecture, make the catalogue and runtime consume one validated source, then add installation/version tracking and release automation only when the workflow needs them. Do not add every proposed registry table/package at once.

## What the survey gets right

- **Keep the monorepo and modular monolith.** The workspace already uses pnpm/Turborepo and has a clear application-versus-package distinction. There is no demonstrated need for microservices or customer forks.
- **Separate module, solution, template and offer.** These represent different concerns. Commerce is a capability, Ecommerce is a solution, a theme is presentation, and an offer can include software plus service scope.
- **Distinguish the three delivery modes.** One shared managed runtime, independently deployed software, and customer-owned generated source have materially different operational and update promises.
- **Do not confuse manifests with working products.** Readiness must be proven by APIs, permissions, persistence, UI, provisioning, tests and operations.
- **Treat customer configuration as typed, versioned data.** Product defaults, tenant-owned settings and separately managed secrets should not be conflated in an arbitrary JSON blob.
- **Use immutable releases and compatibility checks.** Application artifacts, schema migrations and customer data need independent lifecycles and explicit compatibility.
- **Use Copier only for customer-owned source projects.** It should not generate the hosted platform or create a repository for every managed tenant.
- **Require update and isolation scenarios, not just unit tests.** Two customers receiving different configuration, an update conflict, an entitlement denial and a cross-tenant access attempt are the right acceptance shape.

## Claim-by-claim comparison

| Survey claim or recommendation | Current repository state | Assessment |
|---|---|---|
| Modular monolith and shared packages are implemented | Three applications and 15 workspace packages exist. Several packages are active foundations; `platform-identity` is still a narrow reconciliation use case, while `analytics`, `booking` and `platform-contracts` have limited consumers. | Correct direction; package maturity varies. Do not call every package a complete product module. |
| Product capability catalogue and commercial offerings exist | Validator reports 111 capabilities, 37 module records, 35 offers, nine solution manifests, and nine manifest-backed modules. | Correct, with an important caveat: this is a catalogue and validation layer, not a product publication or entitlement billing system. |
| Per-tenant entitlements are not implemented | `tenant_module_entitlements` exists; the platform admin can update audited overrides. Commerce and church/ministry API routes enforce module enablement; analytics has a permission gate. | Survey is stale. Enforcement is partial across the implemented surfaces and needs one shared policy source. |
| Tenant identity and RLS are implemented | Tenant registry, tenant-aware relationships, forced RLS, least-privilege DB roles, integration tests, domain challenge/verification controls and bounded shared/dedicated routing exist. Dedicated routing verifies all registered migrations and fails closed. | Strong foundation. Dedicated provisioning, production secret resolution, domain/TLS operations, backups and restore drills remain operational gaps. |
| Managed application mode exists | Storefront/API/admin can serve tenant-scoped functionality from a shared codebase. Tenant settings and GMFC configuration already demonstrate tenant-specific content/branding. | Partially implemented and the best first delivery mode. There is no product-installation lifecycle or generic website factory yet. |
| Independent installation mode is available | Dedicated database bindings and bounded pools exist. They do not provision a separate app deployment, storage boundary, deployment inventory, customer release pin or production database automatically. | Partial data-plane isolation is not an independent product deployment. Keep the mode unavailable as a product promise until deployment, secret, backup and restore paths are proven. |
| Customer-owned source mode is available | No Copier templates, generated-project workflow, package publication contract or source-delivery process exists. | Correctly identified as missing; intentionally defer it until product boundaries and releases stabilize. |
| Product and template versions are not established | Solution manifests have versions/readiness. Module manifests have versions. There is no product manifest linking a solution, template, modules, configuration contract, delivery modes and compatible runtime/schema releases; templates are currently a few source/config files without their own registry/version lifecycle. | Major gap. Add a validated product descriptor before a mutable database registry or admin editor. |
| Customer customization engine is incomplete | Tenant platform settings are validated/versioned with optimistic concurrency. Church ministry has typed site settings and a theme provider; commerce has store settings. GMFC has tenant-specific configuration. There is no general page/content CMS, reusable neutral theme catalogue, page builder or config migration framework. | Correct, but some tenant customization already exists. Generalize the proven pattern rather than replace it. |
| Product release manager is missing | CI validates catalogues, migrations, typechecks, tests and builds. The migration registry has a current schema marker. There are no published OCI application releases, release channels, signed artifact metadata, installation compatibility checks, update proposals/jobs or deployment history. | Correct. CI validation is a foundation, not a release/update service. |
| Database should add product/template/install/update tables | No `product_installations`, product/template release, config-history or update-job tables exist. Static manifests currently live in Git; tenant state lives in PostgreSQL. | The logical entities are useful later, but the proposed table list is premature. Git should remain the first authority for immutable definitions. Persist installation/config/deployment state only as a concrete workflow needs it. |
| Add a Product Factory area to superadmin | `apps/admin` already owns platform tenant lifecycle, owners, module overrides, settings, domains, audit and initial usage. It has no product publication/install/update experience. | Correct extension point. Add product management after product definitions and validation rules are stable. |
| Start with SME website, then Ecommerce | `solutions/sme-website` is roadmap-only because content, page experience, forms and related modules are not implemented. Church/ministry is the only solution currently marked buildable; Ecommerce is explicitly roadmap/experimental. | The SME-first strategy is sensible for a horizontal factory proof, but the SME solution must first become a real vertical slice. Use the existing GMFC/church tenant as the immediate managed-mode test while building the neutral SME slice. |
| Resolve a previously failing audit DB integration | The current CI starts PostgreSQL, applies app and auth migrations, and runs database-backed test suites. The audit integration has passed in the current local run. | No known current audit failure was found in this review. Preserve the test and CI coverage; investigate any new failure from a reproducible current log. |

## Current strengths

### Platform and tenancy

- Authentication, platform roles, tenant memberships and tenant resolution are separate concerns.
- Tenant tables have forced RLS and tenant-aware relationships; runtime database roles are intentionally narrower than migration roles.
- Domain ownership checks and module overrides are guarded by platform permissions and audit writes.
- Dedicated tenant database routing is bounded, fails closed, and checks the running schema registry. This is a useful foundation for later isolation tiers.
- PostgreSQL integration tests exercise tenant isolation, ministry onboarding, commerce checkout, audit append-only behavior and notification role boundaries.

### Module and release engineering

- Module/solution/catalogue schemas and validators check many relationships, including dependency closure, ownership, migrations and RLS declarations.
- The migration registry is a single ordered authority, and CI verifies the database against migrations and tests.
- Workspace dependencies use `workspace:*`, packages export public entry points, and the audit previously found no private package deep imports.
- The implementation policy already says not to create one package for every catalogue item.

### Actual customer-facing proof

- The GMFC tenant configuration demonstrates that the reusable platform can carry brand/content differences without changing the core tenant model.
- Church/ministry has real tenant-scoped site settings, public content, protected private records and a second-ministry API onboarding integration.
- Commerce has checkout idempotency, M-Pesa callback validation, stock reservation/settlement rules and database-level inventory integrity guards.

## Gaps and weaknesses to address

### P0 — Conflicting descriptions and repeated registries

The repo still repeats module identity/status/defaults in module manifests, `products/catalog.json`, `apps/api/src/modules/admin/module-catalog.ts`, entitlement defaults in `apps/api/src/lib/tenant-modules.ts`, and prose in READMEs. Their purposes differ, but there is no explicit generator/ownership contract for keeping them aligned.

Two concrete stale claims illustrate the problem:

- `apps/admin/README.md` says the runtime catalogue is a snapshot of seven modules; the current API catalogue has eight entries and the repository has nine manifest-backed module records.
- That README says only commerce enforces tenant entitlements; the church/ministry routes also check their entitlement.
- `docs/deployment.md` says CI only runs typecheck, available unit tests and build and still needs a database test service. `.github/workflows/ci.yml` now starts PostgreSQL, applies migrations, and runs tests against it.

This drift weakens product-readiness decisions: an operator can see a module/solution described as available when the runtime does not support it, or underestimate an existing control. Phase 0 should make one source authoritative and make stale documentation fail review through generated status or a consistency check.

### P0 — A catalogue entry is not a provisionable product

`products/catalog.json` and `solutions/*/manifest.json` describe capabilities/compositions. They do not define an installable release with supported template IDs and versions, configuration schema, application artifact, migration compatibility, release channel or delivery mode. Current validation says nine solutions exist but only one is buildable. That is an honest readiness signal, but the commercial offers and solution records are not yet a product factory.

### P1 — Tenant, product and installation are not distinct models

The existing system mostly treats a tenant/workspace as the customer boundary. There is no explicit product installation identity, no way to record one tenant's selected product/template/runtime release, and no update history. This is sufficient for current shared-runtime tenants but becomes ambiguous if one customer owns multiple websites/products or an independently deployed instance.

Define these entities before adding tables:

- **Tenant/workspace:** customer identity, memberships, billing/support boundary and data isolation context.
- **Product definition/release:** immutable Bazion-owned software composition.
- **Installation:** one running use of one product for one tenant, with mode, selected release/template and lifecycle.
- **Configuration version:** validated tenant-owned settings/content version associated with an installation.
- **Deployment:** provider-specific runtime resource and release digest, when independent deployment is supported.

Do not collapse an installation into a tenant if the platform intends a tenant to own more than one product.

### P1 — Configuration is present but not a general customization system

Site settings and tenant platform settings are good patterns to extend. A reusable website product still needs a constrained configuration schema for brand tokens, navigation, page sections, media, locale/timezone, SEO and product settings, with draft/publish and versioned transformations. `templates/client.config.example.json` is only an example file; it is not a runtime schema or provisioning contract.

### P1 — Generic presentation layer is not ready for multiple industries

`@bazion/ui` contains useful elements but is church-themed and ships church-specific composition/styles under a generic package name. The storefront contains church and commerce experiences, not a theme registry or general website renderer. An SME product should not be represented as ready until its UI no longer depends on church template assumptions.

### P1 — Release artifacts and update safety are absent

CI proves the source can pass current checks. It does not publish immutable application images or product release manifests, retain SBOM/provenance/checksums/signatures, evaluate release compatibility, stage a rollout, track tenant installations, or recover from failed deployment. Database migration rollback is not a substitute for application rollback; migrations should remain additive/backward-compatible across rollout windows.

### P1 — Independent deployments are a larger commitment than dedicated DB routing

An independent installation needs app deployment, runtime secrets, database provisioning/migration, object storage, domains/TLS, backups, monitoring, update policy and support. The two VPS illustration is a topology sketch, not an HA design. Two VPS nodes alone do not provide database failover, shared durable storage or disaster recovery. Do not expose this tier as ready until restore and node-failure behavior are demonstrated.

### P2 — Thin abstractions and future features can distract

Analytics, booking and platform contracts should earn scope through a real workflow. Product registry/release/customization packages should likewise be created only when multiple consumers or an application layer require them. A product manifest schema and validator may be enough for the first increments.

## Evaluation of named tools and architectural proposals

### Puck

Puck is a reasonable proof-of-concept candidate: its core editor is MIT-licensed and designed for React components that the product owns. It is a visual editing surface, not tenant identity, content storage, permissions, publishing or release management. Test it only after there is an allowlisted, typed block catalog and tenant-safe content write/publish API. Saved blocks need schema versions and migration functions; the renderer must never execute arbitrary customer code. [Puck project](https://github.com/puckeditor/puck), [Puck product site](https://puckeditor.com/).

### Payload CMS

Payload is open-source/MIT and officially supports Postgres through a Drizzle-backed adapter; it also has a multi-tenant plugin. That makes it a legitimate CMS option, not an automatic fit. This repo already has a central Drizzle schema, migration registry, RLS model, Better Auth identity and API authorization. Payload introduces its own config/admin/API/database-adapter and migration workflow. A proof must demonstrate that the adapter can live within Bazion's tenant identity, role, RLS, migration and audit rules without bypasses or two schema authorities. [Payload license overview](https://payloadcms.com/get-started), [Payload Postgres adapter](https://payloadcms.com/docs/database/postgres), [Payload multi-tenant plugin](https://payloadcms.com/docs/plugins/multi-tenant), [Payload migrations](https://payloadcms.com/docs/database/migrations).

**Recommendation:** start with a small Bazion-owned content model/use case and Puck as an optional editor experiment. Run a time-boxed Payload spike only if editorial revisions, scheduling and asset workflows make a homegrown content layer materially more expensive. Do not migrate identity or permissions to Payload.

### Copier

Copier is appropriate only for the later source-owned mode. Its update model needs Git-tagged templates, the generated project's `.copier-answers.yml`, a clean Git worktree and explicit human review of conflicts; it attempts to preserve changes but does not guarantee conflict-free merges. The official docs explicitly describe conflict markers/rejection files and manual review. [Copier update workflow](https://copier.readthedocs.io/en/stable/updating/).

**Recommendation:** defer Copier until the platform has a stable product/template boundary, an explicit source license/support offer, and an integration test that updates two differently customized generated apps. A customer-owned source offer is not satisfied by a container image or access to the central repository.

### Product/installation database tables

The survey's proposed logical entities cover important concerns, but do not create all of them in the first migration. Keep versioned product/solution/template definitions in Git and release artifacts for the first managed product. Add a tenant-owned installation/config-history model when onboarding/update workflows need to query it. Add update jobs only when a real deployment adapter can execute and observe them. This avoids a database registry that duplicates Git without yet providing product administration.

## Recommended implementation roadmap

The order below preserves the survey's goal while accounting for actual code and operational readiness. Each phase has a single integration owner for public contracts, workspace files, CI and database migrations.

### Phase 0 — Reconcile sources and readiness claims

**Goal:** make the current platform accurately describe itself before adding the product layer.

- Update stale deployment/admin/status documentation to match the current PostgreSQL-enabled CI and actual entitlement gates.
- Decide the authority for module IDs, dependencies, default enablement, status and permissions. Prefer manifest data for module metadata; keep platform-only invariants explicit. Generate runtime snapshots or validate exact parity instead of hand-maintaining three lists.
- Separate catalogue capability inventory, manifest-backed module, solution readiness, commercial offer, and provisionable product in naming and docs.
- Add/retain CI gates for catalogue/manifest parity, deep-import boundaries, migration parity and generated-file drift.
- Audit default entitlement behavior and ensure every active module endpoint checks one shared policy; avoid treating a tenant's ability to select a feature as a product entitlement decision.

**Exit criteria:** all docs and admin UI status counts agree with validators/runtime; each module ID has one declared owner; no roadmap-only feature appears as activatable or sellable.

### Phase 1 — Lock the product and distribution contracts

**Goal:** describe a product without yet adding installation tables or deployment automation.

- Record ADRs for product/solution/template/module boundaries, delivery modes, configuration ownership, release immutability and migration compatibility. The existing modular-monolith and tenant-isolation ADRs remain authoritative where they already answer the question.
- Add `products/product-manifest.schema.json` (or an equivalent naming agreed in ADR) and a validator. The manifest binds a product to one solution, required/optional implemented modules, template IDs/versions, configuration schema/version, supported distribution modes, status/channel and compatible app/schema release.
- Add at least one product manifest for the current Church/Ministry solution and one for the intended SME website only when its required capabilities are implemented. Do not mark Ecommerce buildable while fulfilment, inventory/pricing and payment/reconciliation requirements are missing.
- Validate dependency closure and implementation readiness against modules, package exports, API routes, permissions, tables/migrations, RLS tests, templates and applications. Manifest presence alone must not pass publication readiness.

**Exit criteria:** invalid or unsupported product compositions fail CI; current catalogue/solution contracts continue to validate; readiness is reproducible from code rather than prose.

### Phase 2 — Deliver one managed product through configuration

**Goal:** prove Mode A (shared managed runtime) without a fork.

- Continue using the existing GMFC tenant as the live-shaped church/ministry tenant. Keep the reusable church template separate from GMFC configuration and sample content.
- Build the smallest horizontal SME website slice as the first factory acceptance: shared responsive shell, typed branding/navigation/SEO settings, a small allowlisted section set, media, and a tenant-scoped enquiry flow. Do not begin with a full visual CMS.
- Split generic tokens/primitives from church-specific composition in `@bazion/ui`; do not rewrite the whole storefront at once.
- Provision two tenant installations with different brands, content and navigation; show the same application/template renders each correctly and disabling an entitlement removes protected routes/actions.
- Keep secrets in environment/secret-manager storage and customer data in tenant-owned tables.

**Exit criteria:** a second customer site can be launched by validated data/config and manifest selection, with no source copy or customer-specific branch; both tenants pass public-route and RLS isolation tests.

### Phase 3 — Add installation and configuration version state

**Goal:** make product ownership and customer changes auditable without duplicating the static release catalogue.

- Finalize whether one tenant may own multiple product installations. Model `product_installations` separately from tenant if yes (recommended for future use); include tenant FK, product ID, status, distribution mode, selected template/release digest, timestamps and idempotency.
- Store product defaults in versioned Git releases; store tenant overrides/content separately. Store a configuration schema version and checksum with a version/history record. Do not put secrets in config snapshots.
- Enforce RLS, tenant-aware foreign keys, unique active-install constraints where needed, and audit lifecycle changes. Add safe export/offboard behavior.
- Add schema transformation functions and tests for configuration upgrades. Preserve data on rollback; do not silently replace customer values with new defaults.
- Avoid `products`, `templates` and `module_releases` database tables until operator-authored product definitions or runtime queries require a database registry.

**Exit criteria:** configuration changes are validated, versioned, attributable and reversible; a release default change does not overwrite tenant choices.

### Phase 4 — Provisioning and superadmin Product Factory

**Goal:** let a platform operator create a product installation without direct SQL.

- Add a platform-owned provisioning use case/port that resolves the product manifest, checks module dependency and entitlement constraints, creates the installation, applies typed defaults, initializes tenant settings/content and verifies readiness.
- Make provisioning idempotent, auditable and stateful (`requested → provisioning → ready/failed`); failures must be resumable and not leave a half-enabled installation.
- Add Product Factory UI to the existing `apps/admin` after the contract is stable: products/readiness, solution/template composition, install history and validation errors. Do not let a UI toggle make an unimplemented module available.
- Keep Fastify, PostgreSQL and UI as adapters around the application use case. This is a natural future expansion of `@bazion/platform-identity`, but only move complete use cases rather than adding a broad empty package.

**Exit criteria:** platform owner provisions a second product tenant through UI/API; failed provisioning can be resumed safely; all actions are permission-checked and audited.

### Phase 5 — Product releases and managed update lifecycle

**Goal:** make source changes distributable and upgrades compatible.

- Publish immutable app artifacts keyed by commit and image digest; produce release notes, migration bundle/version, configuration compatibility range, SBOM and provenance/checksum/signature metadata.
- Define stable/beta/security channels and a release compatibility matrix covering app artifact, product manifest, required module versions, template/block schema, config schema and database schema.
- For the shared managed runtime, deploy the application centrally through staging/health checks; tenant-specific compatibility gates must prevent incompatible data/config from being served. Do not imply per-tenant code pins in one shared process.
- For tenant-specific deployments later, record proposed/running releases, serialized update job state, migration outcome, health check, approval and rollback reference. Lock against concurrent upgrades.
- Maintain expand/contract migration discipline: candidate and previous app versions must coexist during rolling deployment where possible. Test backup/restore before destructive schema changes.

**Exit criteria:** deploy one backward-compatible release to staging then managed tenants; verify customer branding/content remains unchanged; injected deployment failure leaves a documented recoverable state.

### Phase 6 — Independent installations

**Goal:** support Mode B as an operational product tier, not just a database-routing option.

- Define provider-neutral deployment/database/object-storage/secret/DNS/back-up ports and one real staging adapter (Docker/Dokploy or another selected provider after evaluation).
- Provision isolated app runtime, database credentials, storage prefixes/buckets, domain/TLS, monitoring and quotas from installation metadata. Never expose Docker socket or platform secrets to customer containers.
- Add move/restore and offboarding/export procedures; prove database and object restore into another node/provider.
- Pilot one non-production customer installation and one controlled update. Document capacity limits and node/database failure behavior; two VPS nodes are not by themselves HA.

**Exit criteria:** deployment, update, rollback, backup, restore and tenant-data isolation are demonstrated end to end; operational cost and support ownership are known.

### Phase 7 — Customer-owned source distribution

**Goal:** offer Mode C only for contracts that include source ownership/customization.

- Create product-specific Copier generators outside the core platform runtime. Track template tags and answers; define supported custom extension points and license/private-package access.
- Generate two independent customer repos with different configuration and code extensions. Release a template update; `copier update` must create a reviewable branch/PR, preserve non-conflicting customization and surface conflicts without auto-deploying.
- Test upgrades across template major versions, removed/renamed files, package access, database migrations and a recovery path. Document source transfer and support boundaries.

**Exit criteria:** a customer-owned project can be generated, customized, updated and supported without copying internal platform/admin infrastructure or claiming that merge conflicts never occur.

### Phase 8 — Expand product capabilities by evidence

Add CMS/editor, CRM, booking, fulfillment, subscriptions, analytics and other modules only when the next product workflow requires them. Use small vertical slices. Evaluate Puck/Payload in isolated spikes with explicit tenant-security, migration, content portability, accessibility and operating-cost acceptance. Build a feature only when a product can consume it end to end.

**Exit criteria:** additional solution packs are buildable from existing releases/configuration, not merely listed in catalogue manifests.

## Cross-phase acceptance matrix

| Scenario | Required outcome |
|---|---|
| Two managed tenants install the same product release | Same app artifact, separate tenant identity/data/config, distinct brand/content. |
| Disable a module entitlement | Protected API and UI operations become unavailable; existing data follows the documented retention/export policy. |
| Publish new product defaults | Existing tenant overrides survive; configuration migration is explicit and testable. |
| Incompatible app/schema/config release | Installation is blocked with an actionable compatibility reason. |
| Duplicate provisioning/update request | Idempotent result or explicit conflict; no duplicate installation/migration. |
| Cross-tenant API/DB query | API authorization and PostgreSQL RLS both deny access. |
| Failed migration/deployment | No silent success; release state, restore point and operator action are recorded. |
| Copier template update | Non-conflicting customization is preserved; conflicts are visible and reviewed. |
| Product publication | Requires buildable dependencies, live tests, permissions, UI, tenant isolation, migrations, operations and rollback notes. |

## Recommended PR/ownership plan

1. **PR A — Status and source-of-truth reconciliation:** fix stale docs; define/generated runtime module catalogue parity and product readiness language. Owner: platform integration lead.
2. **PR B — Product contract:** product manifest schema, product validator, ADR updates and one manifest for the current buildable solution. Owner: product architecture with validator maintainer.
3. **PR C — Neutral website vertical slice:** generic UI primitives/theme/config and enquiry flow; preserve the existing church/GMFC template. Owner: storefront/UI plus API/contracts.
4. **PR D — Two-tenant factory proof:** test provisioning/config separation and entitlement behavior against PostgreSQL. Owner: platform/API/database integrator.
5. **PR E — Installation/config history model:** migration only after entity/cardinality decisions; RLS, export and upgrade transformations. Owner: single DB migration integrator.
6. **PR F — Product provisioning control plane:** API use case/port and superadmin workflow. Owner: platform identity/control-plane.
7. **PR G — Immutable managed release pipeline:** artifact and compatibility metadata, staging promotion and failed rollout behavior. Owner: CI/release lane.
8. **PR H — Independent deployment pilot:** provider adapter, isolated resources and restore test. Owner: operations lane.
9. **PR I — Source-owned Copier pilot:** only after product releases stabilize. Owner: template/distribution lane.

The database integrator must own migration numbering, schema ownership, grants, RLS and the shared database package. Other lanes may work in parallel on UI, pure manifest validation and provider research, but must not concurrently edit the root workspace, public contracts, lockfile or migration registry.

## Immediate recommendation

Proceed with **Phase 0 and Phase 1 only** as the next implementation increment. First correct repository status drift, decide the tenant-versus-installation model and define the product manifest/validator. Keep GMFC operating as a reusable-template tenant. Then prove the generic SME factory with two differently configured tenants before creating release-manager or deployment database tables. This preserves the current template, avoids premature infrastructure, and moves directly toward a repeatable product factory rather than a larger catalogue.

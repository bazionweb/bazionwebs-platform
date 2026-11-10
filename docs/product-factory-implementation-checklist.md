# Product factory implementation checklist

This is the execution checklist for turning the modular platform into a repeatable product factory. Tick an item only after its evidence is merged. Every code slice must pass focused checks, `pnpm catalog:validate`, and `pnpm test` before it is committed. PostgreSQL-backed integration tests must run with the CI database roles before database/security gates are marked complete.

## Current position

- [x] Audit the supplied repository survey and commit findings/roadmap (`dd9f1be`).
- [x] Correct stale CI, runtime catalogue and entitlement descriptions.
- [x] Add versioned product/template manifest schemas and the Church/Ministry composition.
- [x] Validate product, solution, module, template, workspace-package and database-schema references in CI.
- [x] Add validator tests for valid composition, module-version drift and missing hard dependencies.
- [x] Run PostgreSQL integration tests with local least-privilege roles and the auth/outbox database roles; CI now forwards their activation variables and does not cache test tasks.
- [x] Finish Phase 0 PostgreSQL integration evidence: full `pnpm test` passed (24 Turborepo tasks); focused runs passed with no skips for database 15/15, notifications 6/6, audit 4/4, auth 35/35 (email verification enabled), checkout 3/3 and church onboarding 2/2.
- [x] Finish Phase 1 product contract decisions and readiness checks (`pnpm catalog:validate`; stable release readiness remains blocked for partial dependencies).
- [x] Phase 2 contract slice: add versioned website branding, navigation, SEO and page-section schemas; adopt them in tenant-owned Church/Ministry settings.
- [ ] Phase 2 remaining: migrate remaining church-only layout/form styles; complete the SME contact/enquiry vertical slice and two-tenant proof.

Foundational completed slices: `cbe1851` product manifests, `e2271ac` runtime catalogue generation, `00743e3` tenant/installation boundary, `35117b2` stable readiness enforcement. The current CI integration-test reliability slice is recorded in the Phase 0 evidence below.

## Phase 0 — Reconcile sources and readiness claims

**Owner lane:** platform integration. **Prerequisite:** audit findings committed.

- [x] Update deployment documentation to match frozen-lockfile, PostgreSQL-backed CI, migrations, tests and build.
- [x] Update admin and implementation-status documentation for the eight-entry runtime catalogue and actual entitlement checks.
- [x] Make module manifests authoritative for module identity, version, status, tenant model and implementation dependencies.
- [x] Put only runtime-specific policy in a small explicit registry: description, entitlement defaults, required/assignable flags and entitlement dependency edges.
- [x] Generate the API runtime module catalogue from those sources; add a check mode that fails CI when the generated file is stale.
- [x] Derive tenant default entitlement states from the runtime catalogue so the same defaults are not maintained twice.
- [x] Add tests for generated catalogue metadata, policy dependency integrity and stale generated output.
- [x] Decide whether one tenant may own multiple product installations; record the choice and consequences in an ADR before creating installation tables.
- [x] Document the difference between module implementation dependencies and runtime entitlement dependencies.
- [x] Run PostgreSQL tenant-isolation, commerce, church onboarding, notification, audit and auth integration tests with the least-privilege roles from the local environment; focused runs passed with no skips, including auth email verification through the encrypted outbox.

**Exit gate:** runtime metadata matches source manifests and runtime policy; every entitlement dependency resolves; no stale generated catalogue can pass CI; the tenant/installation boundary is documented; database integration evidence is available. **Completed:** CI test environment regression guard is included in the current slice; full test suite passed and focused PostgreSQL/auth integration runs completed without skips.

## Phase 1 — Lock product and template contracts

**Owner lane:** product architecture + platform integration. **Prerequisite:** Phase 0 contract ownership is clear.

- [x] Define product and template manifest JSON Schemas.
- [x] Add one partial Church/Ministry product bound to its buildable solution, required modules, optional modules, applications, template, configuration schema and current database schema.
- [x] Add cross-reference validation and wire it into `pnpm catalog:validate` and CI.
- [x] Add positive and negative tests for product composition validation.
- [x] Record an ADR for product, solution, module and template identity/version boundaries; status/maturity; configuration ownership; release immutability; and migration compatibility.
- [x] Validate product references against module API/permission/table/RLS/test manifests and prevent stable status while the solution, modules or templates are partial.
- [x] Define template compatibility and configuration migration policy before changing any live tenant config schema.
- [x] Keep SME and Ecommerce products unpublishable until their solution readiness gates are met.

**Exit gate:** an invalid reference or incompatible version fails locally and in CI; “stable” is only allowed when every required runtime, permission, database, UI and operations gate is evidenced. **Completed:** the Church/Ministry composition remains `partial` and the stable-readiness validator rejects it until dependent solution, module and template gates clear.

## Phase 2 — Prove a managed website product

**Owner lane:** storefront/UI + API/contracts. **Prerequisite:** Phase 1 schemas and readiness rules.

- [x] Preserve GMFC as tenant-owned content/configuration on the reusable Church/Ministry template; keep customer content out of shared defaults. The tenant template is a dedicated `@bazion/church-ministry-template` workspace package with explicit contract dependencies and a conformance test.
- [x] Extract role-based design tokens, responsive container/section/grid and accessible form primitives into `@bazion/ui`; use them on the ministry contact page.
- [x] Move primary website navigation to a template-neutral shared primitive while preserving the Church/Ministry configuration adapter.
- [ ] Continue replacing church-only layout and form styles as product slices adopt the shared primitives.
- [x] Define a constrained, versioned website configuration contract for branding, navigation, SEO and allowed page sections in `@bazion/website-contracts`; Church/Ministry settings reuse the schemas, apply a backwards-compatible `1.0.0` default, and preserve tenant-specific navigation in the domain port.
- [x] Bind public navigation to tenant site settings; disabled or unconfigured internal pages and unsafe destinations are filtered, while valid HTTPS partner links remain available.
- [x] Expose tenant page visibility and navigation editing in the admin UI; validate the saved site contract and keep the home page enabled.
- [x] Hide disabled routes, including event and sermon detail routes, after tenant settings resolve; set `noindex, nofollow` and show an accessible unavailable state.
- [x] Return a server-side 404 for disabled public routes, including event and sermon detail routes, so crawlers and direct requests receive correct HTTP behavior.
- [ ] Implement a small reusable SME website vertical slice: home, service/about page, contact/enquiry form, SEO and accessible responsive states.
- [ ] Add tenant-scoped enquiry persistence, consent/spam controls, authorization and retention/export behavior.
- [ ] Configure two tenants with different brands/content/navigation using the same runtime and template.
- [ ] Verify feature entitlement changes protect API operations as well as UI links.
- [ ] Add visual/accessibility checks and PostgreSQL cross-tenant denial coverage for the SME slice.

**Exit gate:** a second site can be configured without copying application code or adding a customer branch; both tenants pass route, accessibility and RLS checks.

## Phase 3 — Model installations and configuration history

**Owner lane:** database integrator + platform identity. **Prerequisite:** tenant/install cardinality ADR and Phase 2 evidence.

- [x] Define product installation identity separately from tenant identity where one tenant can own multiple sites/products.
- [ ] Define how verified domains map to an installation before supporting multiple independently branded sites in one tenant.
- [ ] Specify lifecycle, idempotency, selected product/template versions, distribution mode and tenant ownership constraints.
- [ ] Specify configuration version/checksum history separately from product definitions and secret storage.
- [ ] Design PostgreSQL keys, indexes, least-privilege grants, forced RLS, tenant-aware foreign keys and uniqueness rules.
- [ ] Add export/offboarding and retention behavior before storing customer configuration history.
- [ ] Implement forward configuration transforms with explicit validation and a recovery/rollback plan.
- [ ] Add integration tests for isolation, duplicate requests, migration upgrades and rollback preservation.

**Exit gate:** installation/config state is attributable, tenant-isolated, idempotent and recoverable; no secrets are stored in product/config snapshots.

## Phase 4 — Provisioning API and Product Factory UI

**Owner lane:** platform identity/control plane + admin UI. **Prerequisite:** Phase 3 data contracts.

- [ ] Define a provider-neutral provisioning use case and ports.
- [ ] Resolve and validate product manifests, compatibility, entitlements and defaults before changing tenant state.
- [ ] Implement resumable provisioning state (`requested → provisioning → ready/failed`) with idempotency keys and audit events.
- [ ] Initialize tenant-owned website settings/content without overwriting existing customer values.
- [ ] Add platform-owner API endpoints with permission checks, conflict handling and actionable errors.
- [ ] Add Product Factory UI for product readiness, template selection, installation history and provisioning status.
- [ ] Test failure/retry behavior and authorization against PostgreSQL.

**Exit gate:** a platform operator provisions a second configured product through UI/API with no direct SQL; failure is safe to resume and fully auditable.

## Phase 5 — Immutable managed releases and updates

**Owner lane:** release engineering + database integrator. **Prerequisite:** Phase 1/3 compatibility contracts and Phase 4 provisioning.

- [ ] Build immutable application artifacts keyed by commit and image digest.
- [ ] Produce release metadata, migration bundle, config/template compatibility range, SBOM, provenance, checksums and signatures.
- [ ] Define stable/beta/security release channels and an app/module/template/config/database compatibility matrix.
- [ ] Deploy through staging health checks before managed production rollout.
- [ ] Preserve customer branding/content during release-default changes.
- [ ] Track update proposal, approval, migration outcome, health result and rollback reference.
- [ ] Keep migrations backward-compatible across rolling app deployment; prove backup/restore before destructive changes.
- [ ] Add failure injection for deployment and migration recovery.

**Exit gate:** a backward-compatible release moves through staging and a managed tenant; failed rollout leaves an actionable, recoverable state.

## Phase 6 — Independent installations

**Owner lane:** operations/deployment + database integrator. **Prerequisite:** managed release and recovery gates.

- [ ] Define provider-neutral deployment, database, object storage, secret, DNS/TLS, backup and observability ports.
- [ ] Select one provider using a cost, security and support comparison; prove it in staging before customer use.
- [ ] Provision isolated app runtime, database roles/secrets, storage boundaries, domains/TLS and monitoring from installation state.
- [ ] Add migration, update, rollback, restore, export and offboarding operations.
- [ ] Test node/database failure, capacity limits and credential rotation; never expose host Docker control or platform secrets to tenant containers.
- [ ] Document RPO/RTO and operator support ownership.

**Exit gate:** one non-production installation completes deployment, update, rollback and restore on the selected provider; security/cost/support boundaries are documented.

## Phase 7 — Customer-owned source distribution

**Owner lane:** template/distribution engineering. **Prerequisite:** stable product releases and documented extension boundaries.

- [ ] Decide eligible products, licences, private package access and support scope for source delivery.
- [ ] Build product-specific Copier generators outside the core platform runtime.
- [ ] Generate two independent customer repositories with different configuration and code extensions.
- [ ] Test `copier update` across template changes, renamed/removed files and product major versions.
- [ ] Ensure updates create reviewable changes and surface conflicts without auto-deploying.
- [ ] Document source transfer, security updates, package access and long-term support responsibilities.

**Exit gate:** a customer-owned repo can be generated, customized and updated without copying platform/admin internals or promising conflict-free merges.

## Phase 8 — Expand modules only by product evidence

**Owner lane:** the domain lane consuming the feature, with platform/database integration review. **Prerequisite:** a signed product workflow and a consuming vertical slice.

- [ ] Add CMS/editor, CRM, booking, fulfilment, subscriptions, advanced analytics or ministry operations only when a product slice needs them end to end.
- [ ] For each module, define ownership, public contracts, dependencies, permissions, tenant model, migration/RLS, feature gate and operational controls before implementation.
- [ ] Add the module to a real product composition and acceptance workflow; do not create empty packages for catalogue rows.
- [ ] Evaluate third-party components in isolated spikes for security, migration, accessibility, portability and operating cost.

**Exit gate:** every new module is consumed by a working product path and its support, migration, security and upgrade costs are understood.

## Per-slice completion routine

- [x] Add/update focused tests with the code change.
- [x] Run focused tests and `pnpm catalog:validate`.
- [x] Run full `pnpm test`; note any database integration skips and why.
- [x] Restore the temporary local PostgreSQL test instance to its original stopped state and remove its workspace log.
- [x] Review `git diff --check`, status docs and the checklist.
- [x] Commit only the tested slice with a descriptive message.
- [x] Tick completed checklist items only after the corresponding evidence exists.

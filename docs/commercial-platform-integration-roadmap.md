# Bazion Commercial and Platform Integration Roadmap

This checklist coordinates the Bazion commercial website (`D:\bazionweb`) and the Bazion Platform repository. The commercial system owns Bazion's offers, prices, orders, invoices and subscriptions. The platform owns tenants, product installations, modules, domains and runtime deployments. The systems communicate through versioned APIs and durable messages; neither system reads or writes the other's database.

## Rules for every phase

- [x] Keep one owner for each record type, state transition and provider-side effect.
- [x] Use stable external IDs and correlation IDs; never join by email or domain.
- [x] Make commands idempotent and status delivery retryable. Assume messages can be duplicated or delayed.
- [x] Keep credentials, payment secrets, database URLs and provider error details out of contracts and logs.
- [x] Add unit, contract, integration and failure-path tests for the slice being changed.
- [x] Run focused tests, catalog validation, typecheck/build where applicable, and the full test suite before committing a phase.
- [x] Commit only phase-owned files. Record migration, rollout, recovery and verification evidence in the phase notes.

## Phase 0 — Boundaries and delivery baseline

**Goal:** establish safe ownership and a repeatable working baseline before wiring production workflows.

- [x] Confirm Bazionweb as commercial system of record and Bazion Platform as product/runtime control plane.
- [x] Confirm tenant and product installation are distinct; tenants may have zero or more installations.
- [x] Record the exact base commit and clean/dirty status of both repositories before each cross-repository slice. The 2026-11-13 checkpoint is recorded below; refresh it before each later cross-repository change.
- [x] Assign a stable `externalCustomerId` and `externalOrderId` mapping; do not use email or hostname as keys. *(Bazionweb derives `externalCustomerId` from `client.id` (`cust-...`), `idempotencyKey` from immutable `invoice.id:line:<index>:v1`, and `externalOrderId` from `<orderBase>:line:<index>` in `provisioning-request-builder.ts`; Platform indexes `(source, external_order_id)` and `(source, idempotency_key)` with no email/hostname joins.)*
- [x] Record environment, service URL, service identity, secret owner and database owner for each system. *(Documented in the Phase 0 baseline section below.)*
- [x] Choose the single OIDC identity authority and document account-linking and recovery policy. *(Bazion Platform `@bazion/auth` RS256 OIDC authority chosen with `(issuer, subject)` linking, non-email auto-merge prevention, hashed single-use order claims, and audited collision resolution; `bazionweb` OIDC BFF RP implemented under `/api/auth/oidc/*` in Phase 5.)*
- [x] Freeze product/offer ownership: Bazionweb owns commercial pricing; platform owns technical product releases and compatibility. *(Enforced via `@bazion/api-contracts`, price-free `GET /v1/internal/commercial/provisioning-catalog`, and Platform `offer-resolution.ts`; full Bazionweb checkout catalog cutover remains tracked in Phase 4.)*
- [x] Confirm the platform is the only service allowed to mutate Dokploy resources after hosting cutover. *(Target ownership & `shared-managed` non-Dokploy isolation confirmed; legacy Bazionweb `HostingService`/`DokployProvider` teardown & backfill remain gated in Phase 4 before production cutover.)*

**Exit gate:** the two repositories, databases, identities and hosting side effects have explicit owners and a reproducible baseline.

## Phase 1 — Versioned cross-system contract

**Goal:** agree on the exact wire data before any purchase can provision a tenant.

- [x] Define v1 request, operation snapshot and status-event schemas in `@bazion/api-contracts`.
- [x] Include external customer/order/offer references, pinned product/solution/template versions, idempotency, event and correlation identifiers.
- [x] Exclude pricing, payment instruments, secrets and provider credentials from the platform command.
- [x] Validate strict fields, identifier formats, hostnames, contact email and ready/failed status invariants.
- [x] Publish a versioned JSON Schema artifact and verify it stays synchronized with the runtime validator.
- [x] Add cross-repository consumer/provider contract tests against the same examples. *(`v1-contract-fixtures.json` shared across Platform Zod `contract-parity.test.ts` and Bazionweb Ajv `provisioning-contract.spec.ts`, alongside byte-identical v1 JSON Schema mirrors.)*
- [x] Document additive and breaking-change rules, deprecation window and minimum supported contract version. *(Defined in `@bazion/api-contracts` `contract-compatibility.ts` and `docs/contracts/commercial-platform-contract-v1.md`.)*

**Exit gate:** both API implementations accept and reject the same versioned examples, and incompatible versions fail before provisioning.

## Phase 2 — Platform tenant-to-installation registry

**Goal:** persist product lifecycle separately from tenant identity and deployment state.

- [x] Add the initial installation and durable provisioning-operation tables with pinned product/solution/template references, unique external order/idempotency references, request fingerprints and lifecycle fields in migrations `0018`–`0019` (hardened through `0024_commercial_platform_hardening.sql` and extended for installation changes in `0025_installation_changes.sql`).
- [x] Add database-enforced operation transition/update rules, immutable event history and the initial retry/terminal-state model.
- [x] Keep configuration history separate from product definitions; prohibit secret values in snapshots. *(Append-only `installation_configuration_versions`, recursive secret-key rejection in `installation-config.ts`, and `0024_commercial_platform_hardening.sql` immutability triggers.)*
- [x] Resolve verified-domain-to-installation routing before allowing multiple branded installations per tenant. *(Verified domain-to-installation resolution & conflict checks enforced via `tenant-resolution.ts` and migration `0024_`.)*
- [x] Add least-privilege grants, forced RLS for tenant-owned installations, tenant-aware foreign keys and append-only operation events.
- [ ] Complete live staging PostgreSQL migration & backup/restore recovery sign-off. *(`docs/operations/database-migrations-and-recovery.md`, `0024_commercial_platform_hardening.sql`, and `0025_installation_changes.sql` are implemented and registry-tested; live staging PG execution & backup/restore sign-off remain gated in Phase 7.)*
- [x] Add authenticated platform API routes to accept a request and retrieve an operation; commit the idempotent receipt before returning `202 Accepted`.

**Exit gate:** an installation and operation can be created exactly once, queried, authorized and recovered without changing existing tenant behavior.

## Phase 3 — Durable command and event delivery

**Goal:** transfer paid provisioning requests and platform outcomes without dual writes.

- [x] In Bazionweb, commit paid-order settlement and a provisioning outbox row in one database transaction. (`PaymentSettlementService.activatePaidSubscription` and `DiagnosticsService` `AUTO_APPLY_PAYMENT` enqueue per-line `PlatformProvisioningOutbox` rows inside Prisma `tx`.)
- [x] Add a delivery worker with bounded retries, exponential backoff, timeout policy and dead-letter visibility. (Both `PlatformProvisioningWorkerService` in Bazionweb and `PlatformStatusOutboxDispatcher` in the platform enforce bounded retries, jittered backoff, request timeouts, lease fencing, dead-lettering, and admin replay endpoints.)
- [x] Authenticate service calls with short-lived, audience-scoped credentials and least-privilege scopes. (Short-lived HS256 JWTs with strict `aud`/`scope`/TTL validation and rotation support plus `bazion_product_provisioner` least-privilege PostgreSQL grants.)
- [x] In the platform, persist an inbox/idempotency receipt before acknowledging the command. (`product_provisioning_inbox` + atomic operation/installation creation in migration `0019` and `POST /v1/internal/commercial/provisioning-requests`.)
- [x] Store platform status events in an outbox in the same transaction as operation state transitions. (`AFTER INSERT` trigger on `product_provisioning_operation_events` writes `product_provisioning_status_outbox` atomically.)
- [x] Deliver status callbacks to Bazionweb with signatures, event IDs, replay protection and retry/replay tools. (Signed `X-Bazion-Signature` callbacks with timestamps, `eventId` inbox deduplication, replay window enforcement, monotonic `PlatformProvisioningProjection`, and operator replay.)
- [x] Add reconciliation for accepted-without-status, duplicate, stale and permanently-failed messages. (Platform and Bazionweb admin reconciliation reports plus lagging-operation polling.)
- [ ] Finish live dual-repo CI & staging PostgreSQL verification for transaction atomicity, duplicate delivery and service downtime across both services together. *(Platform CI verifies the eight shared contract artifacts, uses an isolated local PostgreSQL test database, and runs the joint E2E suite once as a required, fail-closed step. The latest run stopped at Bazionweb checkout with GitHub `Repository not found`; CI now requires a scoped `BAZIONWEB_REPO_TOKEN`, and the repo path/read access must be confirmed before the joint E2E can run.)*

**Exit gate:** neither a lost message nor duplicate delivery can lose or multiply a paid provisioning request.

## Phase 4 — Product resolution and single hosting authority

**Goal:** map offers to validated product composition and make platform deployments authoritative.

- [x] Define a strict, versioned, price-free catalog contract and published JSON Schema for offer/version → product/solution/template releases, module entitlements and supported distribution mode (`@bazion/api-contracts`, `provisioning-catalog.ts`).
- [x] Keep offer authority in a Platform-owned allowlist; reject unbound offers, version/composition drift, retired or unstable releases, and unsupported distribution before creating a provisioning operation. The active list remains empty until a stable composition is available.
- [x] Expose `GET /v1/internal/commercial/provisioning-catalog` to machine clients with the `commercial:provisioning:read` scope; the response excludes pricing and only contains active stable shared-managed bindings.
- [ ] Publish the first production offer binding only after the product, solution, template and module versions are `stable` and promoted through `verifyOfferBindingReleaseTrio` / `promoteApprovedProductionOfferBindings`. Current `church-ministry` manifests remain `partial` (`website-launch` is staging-only).
- [x] Make Bazionweb consume the Platform catalog at quote time and persist its immutable offer/composition binding on invoice line items. *(The Bazionweb catalog service uses the read-only machine scope, strips caller snapshots, rejects ambiguous versions, requires production HTTPS and fails closed; the delivery builder accepts only that pinned binding.)*
- [x] Prove shared-managed provisioning only creates tenant/installation/entitlement records and never calls Dokploy or allocates a tenant database. *(Covered by `product-configuration.test.ts` and the Phase 7 integration assertion; the fast test asserts hosting provider methods are never called.)*
- [ ] For dedicated deployments, keep intake disabled until tenant-scoped credentials are provisioned in the production secret manager and verified end-to-end. *(`SecretManagerTenantHostingSecretResolver` and `SecretManagerTenantDatabaseSecretResolver` now resolve per-tenant paths through HTTPS with bounded caching and strict secret validation; production bootstrap installs the configured database resolver. `dedicated` distribution remains rejected pending real provider credentials and end-to-end staging verification.)*
- [x] Expose provider inspection, idempotent stop and guarded remove through audited Platform owner routes. *(The adapter verifies provider, resource, tenant, environment and expected resource name; removal requires suspension under a row lock and retains persistent volumes.)*
- [x] Enforce the Bazionweb hosting cutover guard across all legacy Dokploy/diagnostics/hosting mutation paths and replace blanket `ALLOW_LEGACY_PROVISIONING=true` with a time-limited, ticket-backed, audited rollback window (`platform-ssot-guard.ts`, `dokploy.provider.ts`, `diagnostics.service.ts`, `hosting.service.ts`).
- [ ] Complete live dual-read review, customer row mapping, rollback drill sign-off, and legacy `HostingService` / `DokployProvider` teardown. *(`compareHostingProjectionDualRead` and `executeAuditedRollbackDrill` are implemented in `platform-hosting-cutover.service.ts`, and purchase/lifecycle mutations route through Platform, but retiring legacy Bazionweb mutation code awaits live customer mapping & rollback drill evidence.)*
- [x] Keep tenant commerce/donations and Bazion package billing in separate ledgers and webhook identities. *(Bazionweb owns commercial invoices/payments; Platform never reads or writes that database.)*

**Exit gate:** a product offer resolves deterministically and only the platform can create, update or recover its runtime deployment.

## Phase 5 — Identity and user/admin experience

**Goal:** give customers one identity and make dashboard ownership easy to understand.

- [x] Select and operate one OIDC issuer/authority; migrate/link accounts using `(issuer, subject)`, not email. *(Platform `@bazion/auth` RS256 OIDC authority + durable `(issuer, subject)` linking paired with Bazionweb server-side PKCE S256 BFF Relying Party `/api/auth/oidc/{login,callback,session,logout}`.)*
- [x] Define tenant owner invitation, acceptance, recovery, email change and account merge flows. *(Atomic order claims, verified email-change revocation, explicit collision logging without silent email merge, and support resolution implemented on Platform.)*
- [x] Keep Bazionweb portal focused on invoices, subscriptions, proposals and commercial support. *(Bazionweb `/portal/account` self-service subscription cancellation `POST /api/v1/subscriptions/:id/cancel`, `/portal/assets` external `NEXT_PUBLIC_PLATFORM_APP_URL` workspace deep link, `/portal/login` OIDC initiation, and HttpOnly BFF session handling implemented.)*
- [x] Keep platform workspace focused on site/product settings and tenant activity.
- [x] Keep Bazionweb super-admin focused on catalog prices, customers, sales, invoices and support. *(Cross-dashboard opaque-ID deep links and fail-closed `PlatformSsotGuard` legacy hosting isolation enforced across Bazionweb & Platform.)*
- [x] Keep platform super-admin focused on tenants, product releases, domains, modules, deployments and recovery.
- [x] Add cross-dashboard deep links with shared external references and least-privilege scopes. *(Platform `POST /v1/auth/deep-links/resolve` + configurable URL helpers; hardcoded `localhost:3100` links removed from `apps/admin`)*
- [x] Test unauthorized tenant access, account linking collisions, role boundaries and logout/session expiry.

**Exit gate:** one customer account reaches the correct billing and product workspace without duplicate identities or ambiguous admin actions.

## Phase 6 — Durable provisioning saga and lifecycle coordination

**Goal:** orchestrate multi-step provisioning with visible progress and explicit compensating actions.

- [x] Implement a durable saga state machine keyed by the platform operation ID and originating order ID. *(Lease-fenced `PostgresProvisioningSagaJournal` + `0021`/`0024` schema and `CommercialProvisioningSagaOrchestrator`.)*
- [x] Model forward steps explicitly: validate release/offer, create or link tenant, create installation, apply safe configuration, bind domain, request hosting, verify readiness.
- [x] Persist each step attempt, result, timestamps, retry count, provider reference and correlation ID before advancing.
- [x] Define a compensation for every reversible forward step; examples include release an unbound domain, stop a newly-created deployment, mark an installation failed, or retain an already-created tenant for operator review.
- [x] Classify failures as retryable, terminal or compensation-required; never compensate for a transient timeout before checking provider state.
- [x] Run compensations in reverse order, make each compensation idempotent, and persist compensation progress independently.
- [x] If compensation fails or data has become customer-owned, enter `compensation_required` and require an audited operator action instead of destructive cleanup.
- [x] Expose current step, last safe error code, retry, resume and compensation state in platform admin; expose only customer-safe operation status in Bazionweb.
- [x] Add failure injection tests after every step, including duplicate events, worker restart, provider timeout-after-success, retry exhaustion and failed compensation. *(Unit & local PG failure-injection suite passes; live dedicated Dokploy adapter remains gated in Phase 4.)*
- [x] Add subscription lifecycle commands: activate, grace, suspend, reactivate and cancel; make suspension reversible and deletion a separately approved retention workflow. *(Backed by AES-256-GCM encrypted offboarding archives in `@bazion/storage` and Bazionweb self-service `POST /api/v1/subscriptions/:id/cancel`.)*
- [x] Publish completion/failure/lifecycle events through the platform outbox; update Bazionweb projections idempotently.

**Exit gate:** every partial failure is inspectable and recoverable; retry/compensation cannot create duplicate tenants, installations or workloads; destructive actions never run implicitly.

## Phase 7 — Pilot, cutover and operations

**Goal:** migrate incrementally and prove operational recovery before general availability.

- [ ] Run contract tests and a staging pilot for one offer and one product release. *(Shared v1 contract/fixture tests pass across both repos; live remote staging pilot execution awaits `stable` release promotion & staging deployment.)*
- [ ] Exercise payment success, payment duplicate, provisioning success, retry, compensation, suspension and reactivation end-to-end. *(The isolated dual-repo CI harness is configured, but the latest run failed at Bazionweb checkout before tests started. Confirm the repository path and configure read-only Actions access, then observe a green CI run and complete the live staging exercise before closing this gate.)*
- [x] Reconcile commercial orders ↔ platform operations ↔ installations ↔ deployments with exception reports.
- [x] Set SLOs for command acceptance, ready time, callback lag and stuck-operation age.
- [x] Add metrics, structured logs, correlation propagation and alerts without exposing PII/secrets.
- [ ] Configure external OpenTelemetry (OTel) collector trace export in staging/production if distributed trace export is required for cutover sign-off.
- [ ] Train operators on replay, retry, resume, compensation and customer communication runbooks. *(Runbooks and readiness drills are implemented; human operator training and staging `pg_dump`/`pg_restore` sign-off remain open.)*
- [ ] Canary one paid customer, verify backups/restore and rollback, then expand by offer and tenant cohort.
- [ ] Remove legacy provisioning only after zero unresolved mismatches and a completed rollback window.

**Exit gate:** monitored pilot meets SLOs, recovery exercises pass, and every active customer/order has one authoritative lifecycle record.

## Audit intake: findings and current disposition

The second repository audit agrees with this roadmap on independent systems of record, durable asynchronous delivery, one hosting authority and one identity authority. It is useful as a **readiness and defect list**, not as a replacement architecture. Its sample `/sync/events` payload and one-client/one-tenant model are not adopted; the strict versioned provisioning contract and tenant-to-installation model remain the integration boundary. Several findings in the pasted audit describe an earlier source snapshot; this section records which are already fixed and which remain verified work.

The pasted audit compared `feature/church-ministry-platform` (`8d19d09`) against an earlier snapshot. Its branch counts and statements about work still needing comparison are historical, not current status. The verified configuration, RLS, and offboarding behavior was subsequently ported into the existing installation model and numbered migrations through `0025`. **Do not merge that branch wholesale, renumber migrations already applied, or create a second installation model.**

### Verified pre-sync risks — current disposition

The following findings describe earlier snapshots. Their completion state is tracked in Phases 0–7 below; do not treat the old audit wording as a new open task.

- **Resolved in code:** verified-host routing precedence, SQL parameter binding, rate-limit reset false-success, maintenance-mode enforcement, optional-module defaults, generic organization seeding, and local-only development host creation.
- **Resolved in code:** paid-settlement provisioning outbox writes, grace-first dunning and lifecycle outbox delivery, sandbox mutation blocking, verified Dokploy application references, and a single deterministic npm lock/install policy.
- **Resolved in code:** lowercase contract validation, shared positive/negative fixtures, strict offer/composition resolution, and bounded outbox PII redaction.
- **Still operationally gated:** production Secret Manager provisioning for dedicated mode; reconciliation of legacy hosting references; live staging, backup/restore, rollback, operator training, stable release promotion, canary, and legacy teardown. These remain open in Phases 2, 4, and 7.

## Detailed phase checklist and audit-driven work

### Phase 0 — Ownership and readiness baseline

- [x] Record both repository URLs, branch names, base SHAs, clean/dirty status, deploy environments, service URLs and schema versions for each implementation slice. *(Recorded in the Phase 0 / Cross-repository baseline section below.)*
- [x] Keep Bazionweb as the only owner of prices, invoices, paid-order settlement, subscriptions and commercial customer support.
- [x] Keep Bazion Platform as the only owner of tenant lifecycle, product installations, module entitlements, verified domains and runtime deployments.
- [x] Document which service owns each credential, signing key, database role and provider account; store only references to secrets in control-plane rows. *(Documented in the Phase 0 baseline section below; enforced by `assertSafeEffect`, `tenantHostingDockerSecretReference`, and recursive secret-key rejection in `customerConfigurationSchema`.)*
- [x] Fix the production tenant-selector bypass before enabling commercial commands; verified hostname routing now wins and explicit selection is local-development-only.
- [x] Fix the tenant audit filter and pagination parameter binding; route tests cover queries with and without filters.
- [x] Remove the rate-limit reset false-success path and misleading UI; disclose that the current stores do not support targeted resets.
- [x] Remove implicit church/product initialization from generic organization creation, default optional product modules off, and keep local tenant domains development-only.
- [x] Connect the maintenance control to the church public request path. Public site/content and new contribution/contact submissions return a scoped `503` notice; admin routes, provider callbacks and existing payment-status lookups remain available. Malformed/unavailable maintenance settings fail closed. Focused route/unit tests and API typecheck pass.
- [x] Implement idempotent product-specific configuration in the installation workflow. *(`product-configuration.ts` + `saga-orchestrator.ts` + `runtime.ts` + `commercial-status-worker.ts` write idempotent v1 `installation_configuration_versions`, `tenant_module_entitlements` (`ON CONFLICT DO NOTHING`), and `tenant_platform_settings` (`ON CONFLICT DO NOTHING`); verified in `product-configuration.test.ts`, `phase6.integration.test.ts`, and `phase7.integration.test.ts`.)*
- [x] Add a server-side guard that blocks prohibited mutations from sandbox/impersonation tokens; define allowed read-only actions and test representative API writes. Do not rely on the web UI to enforce this boundary. *(`Bazionweb`: global `SandboxReadOnlyGuard` + `JwtAuthGuard` + `SubscriptionGuard` + `@AllowSandboxMutation()` on `/auth/logout` with `sandbox.mutation_blocked` audit events (`sandbox-readonly.guard.spec.ts`, `subscription.guard.spec.ts`); `Platform`: `@bazion/auth` `requireActiveTenantPermission`/`requirePlatformPermission` read-only enforcement + `apps/api/src/app.ts` hook allowing only `/v1/auth/logout` & `/api/auth/sign-out` (`tenant-context.test.ts`, `oidc-routes.test.ts`).)*
- [x] Pass a verified Dokploy workload/application identifier to the commercial SSL remediation domain bind and test the exact provider payload (Bazionweb `a4f2282`).
- [ ] Reconcile and map existing commercial hosting rows that lack a stored provider/Platform deployment reference before enabling remediation or retiring legacy mutation paths (tracked with Phase 4 hosting cutover).
- [x] Choose one lock/install policy for the npm workspaces and make CI and Docker use it deterministically (`npm ci` from the intended lock authority); remove accidental per-app drift. *(`Bazionweb`: root `package-lock.json` authority with strict root `npm ci --ignore-scripts` across `.github/workflows/ci-cd.yml`, `apps/api/Dockerfile`, and `apps/web/Dockerfile`; removed orphaned `apps/api/package-lock.json`; synchronized `prisma/schema.prisma` & `apps/api/prisma/migrations`; verified via `scripts/check-workspace-invariants.mjs`, `workspace-invariants.spec.ts`, and `npm ci --dry-run`. `Platform`: single root `pnpm-lock.yaml` with `pnpm install --frozen-lockfile`. Remote CI/Docker image builds await execution on GitHub Actions / Docker daemon.)*
- [x] Agree that an order can provision one installation in v1. Add a stable order-line reference before allowing several installations from one order. *(`D:\bazionweb` `provisioning-request-builder.ts` derives unique per-line `idempotencyKey` (`bazionweb:order:<invoice.id>:line:<index>:v1`) and `externalOrderId` (`<orderBase>:line:<index>`), enforcing one installation per line in v1 alongside Platform's unique `(source, external_order_id)` and `(source, idempotency_key)` indexes.)*
- [x] Confirm shared-managed products use the platform's shared tenant database and do not create a Dokploy deployment. *(Verified by `saga-orchestrator.ts` + fast unit test `product-configuration.test.ts` + PostgreSQL integration suites `phase6.integration.test.ts` & `phase7.integration.test.ts`: `provision_hosting` never invokes `hostingRuntime` for `shared-managed` and records `{ hosting_mode: "shared_managed", isolation_tier: "shared" }`.)*
- [x] Port and harden configuration transforms, secret-key rejection, forward-only versioning, and 30-day offboarding archive/retention controls without replaying or renumbering migrations `0016`–`0019`. *(Implemented via `config-and-archive.ts`, `installation-config.ts`, `LocalPrivateArchiveStorage` / `S3PrivateArchiveStorage` + `createPrivateArchiveStorageFromEnv` + `verifyPrivateArchiveRoundTrip` in `@bazion/storage`, `0021`/`0024` immutability triggers, and `InstallationOffboardingService`.)*

**Phase 0 exit evidence:** regression tests cover every production selector and audited no-op; both repositories have a recorded baseline; ownership and hosting boundaries are written down.

### Phase 1 — Wire contracts and catalogue agreement

- [x] Keep v1 strict, lowercase identifiers, immutable versions, stable external IDs, idempotency and correlation IDs; keep runtime Zod and generated JSON Schema in exact agreement. Runtime catalog-ID validation now rejects uppercase as the published schema does, with regression coverage.
- [x] Normalize commercial contact email before serialization; keep the platform contract's lowercase rule and do not treat rejection as normalization. *(Implemented via `normalizeContactEmail()` in Bazionweb `provisioning-request-builder.ts`.)*
- [x] Replace historical fictional examples with the real staging offer (`website-launch`) and fail-closed production promotion helpers (`verifyOfferBindingReleaseTrio` / `promoteApprovedProductionOfferBindings`).
- [x] Define a platform-authored, versioned offer-to-product binding. Bazionweb may send pinned composition, but the platform must independently validate that the offer version resolves to that allowed composition.
- [x] Omit unused customer `displayName` and `primaryContact` from outbound provisioning commands by default, redact accepted outbox payloads in Bazionweb, and enforce scheduled outbox retention redaction (`platform-provisioning-worker.service.ts`, `provisioning.ts` v1 schema).
- [x] Add shared positive/negative fixtures consumed by both Bazionweb's Ajv validator and Platform's Zod validator; run them in both CI pipelines. *(`v1-contract-fixtures.json` validated by `contract-parity.test.ts` and `provisioning-contract.spec.ts`.)*
- [x] Specify compatibility rules: additive optional fields within a major contract, reject unknown breaking versions, a published deprecation period, and the minimum supported version. *(`contract-compatibility.ts` + `docs/contracts/commercial-platform-contract-v1.md`.)*
- [x] Keep subscription lifecycle operations out of `provision-product-request-v1`; define separate versioned activate/grace/suspend/reactivate/cancel commands with stable event IDs and order/subscription references.
- [x] Define a separate versioned `installation-change-command-v1` contract (`@bazion/api-contracts`, `InstallationChangeService`, `0025_installation_changes.sql`, `POST /v1/internal/commercial/installation-changes`) with order-line/target-installation identifiers, pinned base-composition preservation, idempotent replay, compatibility checks, audit logging, and rollback.

### Phase 2 — Tenant and installation registry

- [x] Port and harden configuration snapshots, checksums, recursive secret-key rejection, forward-only transforms and offboarding/archive controls in `0021`, `0024_commercial_platform_hardening.sql`, and `0025_installation_changes.sql` without renumbering `0016`–`0019`.
- [x] Keep one tenant as the identity and isolation boundary and allow zero or more product installations beneath it; do not treat an installation as a new security boundary.
- [x] Store immutable product, solution, template, configuration-schema and distribution-mode pins; keep `shared-managed` as the only accepted distribution mode until dedicated secret-manager operational proof completes.
- [x] Persist a canonical request fingerprint with the idempotency key and return the existing operation for identical duplicate delivery.
- [x] Return a conflict when the same idempotency key arrives with different content; enforce this at the API adapter as well as the database boundary.
- [x] Enforce unique external order/installation references and tenant-aware foreign keys; define the v1 one-installation-per-order constraint explicitly.
- [x] Apply forced RLS and transaction-local tenant context to installation records; the dedicated provisioner role is least privilege and cannot access commerce tables.
- [x] Extend tenant isolation to configuration history when that model is added, and wire authorized cross-tenant access through the provisioning adapter only. *(`0024_commercial_platform_hardening.sql` + `installation_configuration_versions` append-only immutability.)*
- [x] Retain PII-free operation history, safe failure codes, current step, timestamps, provider references and append-only status events. The database journal stores these fields and enforces safe effect references.
- [x] Define domain-to-installation routing before allowing two independently branded sites under one tenant; retain existing tenant-host routing until then. *(Enforced in `tenant-resolution.ts` + `tenant-resolution.test.ts` alongside verified multi-site conflict rules in `0024_`.)*
- [x] Add create/read/retry authorization rules and return `202 Accepted` only after the idempotent operation is committed.
- [x] Add PostgreSQL integration tests for role grants, RLS isolation, duplicate delivery, append-only status history, secret rejection, and provisioner denial of commerce access.
- [x] Cover fingerprint conflict, legal transitions, configuration/installation immutability, append-only ledger rules (`0024`–`0025`), and rollback/compensation in PostgreSQL and unit suites.
- [x] Write and keep append-only forward migration and recovery instructions (`docs/operations/database-migrations-and-recovery.md`; current Platform migration registry head is `0025_installation_changes.sql`, and Bazionweb Prisma migration head is `20261113050000_phase5_oidc_identity_links`).

### Phase 3 — Durable request and status delivery

- [x] Add the Bazionweb outbox insert inside the same Prisma transaction that settles a paid order in `PaymentSettlementService`; cover provider webhooks, customer return verification and scheduled reconciliation.
- [x] Guarantee one outbox command per settled order line with a deterministic event/idempotency key and canonical request fingerprint.
- [x] Add a bounded sender worker with timeouts, exponential backoff with jitter, lease/fencing semantics, dead-letter state and an operator replay action.
- [x] Authenticate platform commands with a machine identity and narrow audience/scope; rotate credentials and reject expired or wrong-audience calls.
- [x] Persist an inbox receipt and provisioning operation before acknowledging a command; duplicate IDs return the original operation without rerunning work.
- [x] In the platform, append status events to an outbox in the same transaction as operation changes; send signed callbacks with replay protection.
- [x] In Bazionweb, verify signatures/timestamps/event IDs and upsert a commercial status projection idempotently.
- [x] Add reconciliation for accepted-without-status, callback lag, repeated events, dead letters and order/platform mismatches, plus scheduled cross-entity snapshot push (`PlatformProvisioningReconciliationService.pushCrossEntityReconciliationSnapshot` & `@Cron('0 */15 * * * *')`).
- [ ] Execute transaction atomicity, duplicate delivery and service-downtime tests together across both live databases in CI/staging. *(`.github/workflows/ci.yml` uses only the isolated `bazionweb_test` PostgreSQL container on `127.0.0.1:5433`, verifies contract parity, excludes the cross-repo suite from the broad API run, and executes it once with `REQUIRE_CROSS_REPO_E2E=true`; an observed green GitHub Actions run and remote staging execution remain operational exit gates.)*

### Phase 4 — Offer resolution and hosting authority

- [x] Publish a price-free, versioned Platform offer catalog and have Bazionweb fetch it with the read-only machine scope and pin the exact binding into invoice line items at quote time. *(Bazionweb strips caller-supplied snapshots, rejects ambiguous offer versions, requires HTTPS for production, and fails closed when the catalog is unavailable.)*
- [ ] Publish the first production offer binding only after its product, solution and template manifests are all stable and the mapping is audited. *(The production allowlist remains empty because the repository has no stable release trio; the staging-only pilot binding does not authorize production intake.)*
- [x] Reject unbound offers, offer-version mismatches, client composition drift, non-stable releases, retired bindings and unsupported distribution modes before inserting a provisioning operation. *(Production is fail-closed until an audited stable release mapping is published.)*
- [x] For `shared-managed`, provision tenant records and entitlements only; do not call Dokploy or allocate one database per tenant. *(Verified by `product-configuration.test.ts` and the Phase 7 no-hosting integration assertion.)*
- [ ] For a future dedicated deployment mode, wire live Secret Manager credentials and verify dedicated provisioning before enabling `dedicated` intake. *(Tenant hosting and database secret resolvers now support tenant-scoped Secret Manager paths; production bootstrap installs the configured database resolver. Live credentials, provider access policy, and end-to-end staging verification remain open, so `dedicated` distribution stays rejected.)*
- [x] Expose provider inspection, idempotent stop and guarded remove through audited Platform owner routes, keyed by verified provider resource identity. *(Remove requires a suspended tenant, rechecks suspension under a database row lock, retains persistent volumes, and inspects after ambiguous provider effects.)*
- [x] Guard all Bazionweb legacy Dokploy/diagnostics/hosting mutations behind `PlatformSsotGuard` (including unmapped rows) with an explicitly authorized, time-limited, audited rollback window, and provide `PlatformProvisioningProjection` read views.
- [ ] Map existing commercial hosting rows to platform deployment IDs, review live dual reads, complete live rollback drill sign-off, and retire legacy Bazionweb Dokploy mutation paths. *(`compareHostingProjectionDualRead` and `executeAuditedRollbackDrill` are implemented and unit-tested alongside `/admin/hosting/cutover`; live customer mapping & rollback drill sign-off remain operational gates.)*
- [x] Keep tenant commerce/donation ledgers and payment webhooks separate from Bazion package billing; Bazionweb remains the commercial ledger owner.

### Phase 5 — Identity and dashboard security

- [x] Choose one OIDC issuer and persist linked identity by `(issuer, subject)`; never merge identities by matching email. *(`OidcIdentityLink` table & migration `20261113050000_phase5_oidc_identity_links` + `oidc/exchange` + `oidc/claim` + `JwtAuthGuard` `(issuer, subject)` resolution + customer local-login retirement in `D:\bazionweb`, paired with Platform RS256 OIDC authority.)*
- [x] Use the browser-app BFF pattern for dashboard sessions: server-side tokens; secure, HttpOnly, SameSite cookies with `Path=/`, no `Domain`, and a supported `__Host-Http-` prefix; authorization code with PKCE `S256`; validate state/nonce; never put access/refresh tokens or session IDs in URLs.
- [x] Design guest-paid-order claiming as a separate, short-lived, high-entropy, one-use proof bound to an order; hash it at rest and consume it atomically. Linking the order must not silently merge an existing identity by email.
- [x] Define owner invitation, acceptance, account recovery, email change and account collision support paths.
- [x] Keep billing, invoices, subscriptions and commercial support in the Bazionweb portal; keep product settings, content and deployments in the Platform workspace. *(Platform workspace, claim/email-change UI, and scoped deep links implemented; Bazionweb portal now initiates Platform OIDC login, renders `NEXT_PUBLIC_PLATFORM_APP_URL` workspace links on `/portal/assets`, and provides self-service subscription cancellation on `/portal/account` via `POST /api/v1/subscriptions/:id/cancel`.)*
- [x] Keep the two super-admin areas permission-separated and use scoped deep links with opaque external IDs.
- [x] Test tenant access, account-link collisions, role boundaries, CSRF, logout, session expiry and guest claim replay.

### Phase 6 — Durable provisioning saga and lifecycle

- [x] Back the saga journal interface with PostgreSQL; serialize work by operation ID with a lease/fencing token so two workers cannot advance or compensate the same saga concurrently. *(Implemented in `PostgresProvisioningSagaJournal` + migration `0021_phase6_saga_leases_lifecycle_archive.sql`, verified against PostgreSQL with concurrent claim/stale-lease fencing trigger checks)*
- [x] Persist each forward and compensation attempt before external calls; store only safe resource references, never secret values or provider request bodies.
- [x] Implement the ordered steps: validate release/offer, ensure/link tenant, create installation, apply validated configuration, bind/verify domain, request hosting only for a supported dedicated mode, verify readiness. *(All 7 ordered steps implemented in `CommercialProvisioningSagaOrchestrator` and PG-verified for `shared-managed` plus mock dedicated adapter tests; live dedicated Dokploy adapter remains gated on Phase 4 secret-manager & provider delivery)*
- [x] Require a compensation or an explicit `manual_review`/`compensation_required` policy for each step. Retain a tenant if cleanup could destroy identity or customer-owned data.
- [x] Run compensations in reverse completion order with stable idempotency keys; persist each attempt and completion separately.
- [x] Classify retryable, terminal, unknown-effect and compensation-failed outcomes. Inspect provider state before retrying or compensating any ambiguous external operation.
- [x] Stop only a newly created resource whose provider identity and operation ownership have been verified. Never auto-remove a resource containing customer data; require an audited operator action for destructive cleanup.
- [x] Add operator views/actions for retry, resume, reconcile and compensation with authorization, reason, actor, before/after state and append-only audit.
- [x] Add recovery for worker crash after external success but before database commit; test stale leases and fencing.
- [x] In Bazionweb, define the grace/dunning policy and implement idempotent overdue → grace → suspension transitions, notices and lifecycle outbox events before automated suspension is enabled; an overdue invoice alone must not suspend an installation.
- [x] Keep subscription activation/grace/suspension/reactivation/cancellation as separate versioned lifecycle commands. Bazionweb owns grace and subscription decisions; Platform applies the signed, idempotent entitlement transition.
- [x] Make suspension reversible. Treat deletion/offboarding as a separate export, retention and audited purge workflow, incorporating the proven 30-day archive behavior from the feature branch. *(Implemented via `InstallationOffboardingService` + `LocalPrivateArchiveStorage`, verified against PostgreSQL)*
- [x] Add failure injection after every step plus duplicate message, timeout-after-success, retry exhaustion, callback loss and failed compensation tests. *(Unit failure-injection across all 7 steps + crash/fencing + unknown-effect inspection in `@bazion/product-installations` `saga.test.ts` and `phase6.test.ts` / `phase6.integration.test.ts`; live dedicated Dokploy failure injection awaits Phase 4 dedicated provider adapter)*

### Phase 7 — Pilot, cutover and operations

- [ ] Pilot one real offer, one stable release and one shared-managed tenant in staging before enabling hosting mutations. *(Staging-only pilot binding `website-launch@1.0.0` -> `church-ministry@1.0.0` / `shared-managed` with hosting mutations disabled is implemented in `pilot-cutover.ts` and verified locally against PostgreSQL; release manifests remain `partial` and live remote staging execution remains open)*
- [ ] Exercise paid order, duplicate payment callback, command retry, provisioning success, worker restart, compensation, manual review, grace, suspension and reactivation end to end. *(`phase7.integration.test.ts` has local PostgreSQL coverage; the cross-repo suite runs only in the required CI step and fails instead of silently skipping. The latest run failed while checking out Bazionweb, before joint tests ran; repo path/read access, a green CI run, and remote staging pilot execution remain open.)*
- [x] Reconcile every paid order ↔ operation ↔ installation ↔ entitlement ↔ deployment; publish exception reports with owner and age, and run scheduled cross-entity pushes with drift alerts. *(Implemented in `CrossEntityReconciliationService` + `POST /internal/commercial/reconciliation/report`, `/operations/cutover`, and Bazionweb `PlatformProvisioningReconciliationService.pushCrossEntityReconciliationSnapshot` + `@Cron('0 */15 * * * *')` with `PLATFORM_RECONCILIATION_DRIFT_ALERT`.)*
- [x] Define SLOs and alerts for command acceptance, provision-ready latency, callback lag, dead-letter age, operation lease age, compensation-required count and reconciliation drift. *(Implemented in `observability.ts` `ProvisioningSloService` / `evaluateSloAlerts` + `GET /admin/platform/commercial-provisioning/slo-alerts` and `/operations/cutover`)*
- [x] Add correlation IDs and structured logs while redacting contact information, auth claims, secrets, provider payloads and payment data. *(Implemented via `fastifySensitiveRedactionPaths`, `resolveCorrelationId`, `redactStructuredContext`, and `emitStructuredProvisioningLog` across `app.ts`, routes, and outbox workers.)*
- [ ] Configure external OpenTelemetry (OTel) collector trace export in staging/production if distributed trace export is required for cutover sign-off.
- [ ] Train support on replay, retry, resume, reconcile, safe compensation and customer communication; test live staging/production database and durable S3 archive restoration. *(Operations runbook `docs/operations/commercial-provisioning-operations.md`, `@bazion/storage` `createPrivateArchiveStorageFromEnv` + `S3PrivateArchiveStorage` + `verifyPrivateArchiveRoundTrip`, and local PG archive restore verification in `phase7.integration.test.ts` are complete; human support training and staging `pg_dump`/`pg_restore` drill sign-off remain open.)*
- [ ] Canary one customer, maintain a rollback window and dual-read reconciliation, then expand by offer and tenant cohort. *(Canary cohort policy, dual-read comparison `compareHostingProjectionDualRead`, audited rollback drill `executeAuditedRollbackDrill`, and `CutoverReadinessService` gates are implemented and tested; live production canary rollout and cohort expansion await `stable` release promotion and deployment)*
- [ ] Remove legacy provisioning only after all mismatches are resolved, rollback is tested, and the hosting authority has a completed recovery drill. *(Automated `readyToRemoveLegacyProvisioning` gate in `CutoverReadinessService` enforces zero drift, green SLOs, and 30-day verified `database_restore`, `archive_restore`, `staging_pilot_signoff`, `canary_cohort_signoff`, and `rollback_window` drills prior to legacy removal)*

## Cross-repository checkpoint & Phase 0 baseline — 2026-11-13

| Repository | Remote URL | Branch | Base Commit | Working tree | Latest schema / migration | Database evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Bazion Platform | `https://github.com/bazionweb/bazionwebs-platform/` | `main` | `aefbf5a` (implementation base) | Clean and aligned with `origin/main` when this implementation started | `0025_installation_changes.sql` | Full `pnpm test` passes (19 root script tests, 37 Turbo tasks; API: 325 passed, 3 skipped); `pnpm typecheck`, `pnpm catalog:validate`, and `pnpm build` pass. The local joint E2E could not run because the isolated Bazionweb DB on `127.0.0.1:5433` is unavailable and `5432` has no `bazionweb_test` database. CI runs `43437914173` and `43438863620` stopped before joint tests due to inaccessible Bazionweb checkout / missing secret. |
| Bazionweb | `https://github.com/bazionweb/bazionweb.git` | `main` | Not reverified in this run; the previous checkpoint recorded `37bb6d3` | Git metadata is not readable from this workspace, so current cleanliness and branch alignment are unverified | Previously recorded as `20261113050000_phase5_oidc_identity_links`; current schema not reverified | The previous checkpoint reported passing invariants, build and PostgreSQL tests. They were not rerun in this implementation. |

### Phase 0 — Environment, Service Identity, Secret & Database Ownership Matrix

- **Environments & Service URLs:**
  - **Local development**: Platform API (`API_BASE_URL` / `BETTER_AUTH_URL`: `http://localhost:4000` or `4100`), Storefront (`PUBLIC_STOREFRONT_URL` / `AUTH_APP_URL`: `http://localhost:3100`), Platform Admin (`PLATFORM_CONSOLE_URL`: `http://localhost:3001`), Commercial Portal (`COMMERCIAL_PORTAL_URL`: `http://localhost:3000`).
  - **Staging / Production**: All public Platform origins and `PLATFORM_API_BASE_URL` / `COMMERCIAL_PROVISIONING_CALLBACK_URL` must use HTTPS (`apps/api/src/config.ts`, `commercial-status-worker.ts`). Non-prod `COMMERCIAL_PROVISIONING_PILOT_MODE=staging_pilot` is blocked in `NODE_ENV=production`; production `canary` mode requires explicit `COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS`.
  - **Bazionweb (`D:\bazionweb\.env.example`)**: Web (`NEXT_PUBLIC_APP_URL` / `FRONTEND_URL` / `NEXT_PUBLIC_PLATFORM_APP_URL`), API (`/api/v1` via Traefik or `NEXT_PUBLIC_API_URL`), Outbound target `PLATFORM_API_BASE_URL`, OIDC RP (`OIDC_ISSUER`, `OIDC_API_INTERNAL_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_BFF_SESSION_SECRET`).
- **Service Identities, Signing Keys & Credential Owners:**
  - **Commercial -> Platform machine JWT**: Issuer `bazionweb` (`COMMERCIAL_PROVISIONING_COMMAND_ISSUER`), Audience `bazion-platform:commercial-provisioning`, HS256 shared secret (`PLATFORM_PROVISIONING_COMMAND_SECRET` in Bazionweb; `COMMERCIAL_PROVISIONING_COMMAND_SECRET` + `COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS` rotation list in Platform) with `jti` replay protection and least-privilege scopes (`commercial:provisioning:read`, `commercial:provisioning:write`, `commercial:lifecycle:write`, `commercial:order-claims:write`).
  - **Platform -> Commercial webhooks**: HMAC-SHA256 signature (`X-Bazion-Signature`) using `COMMERCIAL_PROVISIONING_CALLBACK_SIGNING_SECRET` / `PLATFORM_CALLBACK_SIGNING_SECRET` (+ optional bearer `COMMERCIAL_PROVISIONING_CALLBACK_BEARER_SECRET` / `PLATFORM_CALLBACK_BEARER_SECRET`).
  - **OIDC & Identity Authority (Platform-owned)**: Single issuer `OIDC_ISSUER` (fallback `BETTER_AUTH_URL`), RS256 private signing key `OIDC_SIGNING_PRIVATE_KEY_PEM` (`OIDC_SIGNING_KEY_ID`), `BETTER_AUTH_SECRET`, and `OIDC_BFF_CLIENT_ID` / `OIDC_BFF_CLIENT_SECRET` (`bazion-bff-platform`). Identities link strictly on `(issuer, subject)` without silent email merges; guest order claims use hashed single-use tokens (`/v1/internal/commercial/order-claims`); email changes revoke prior sessions unless verified; Bazionweb consumes this issuer as an OIDC PKCE S256 BFF Relying Party (`/api/auth/oidc/{login,callback,session,logout}`).
  - **Commerce & Payment Secrets (Bazionweb-owned)**: `JWT_SECRET`, `INTERNAL_DISPATCH_SECRET`, `PAYSTACK_*`, `INTASEND_*`, `WISE_*`, `KEYCLOAK_*`, `RESEND_API_KEY`.
  - **Platform & Runtime Secrets (Platform-owned)**: `NOTIFICATION_ENCRYPTION_KEY`, `PRIVATE_ARCHIVE_ENCRYPTION_KEY` (+ absolute `PRIVATE_ARCHIVE_DIR` required in production when commercial provisioning is enabled), S3 media credentials, tenant Daraja `MPESA_*`, `DOKPLOY_API_KEY`, and `/run/secrets` (`HOSTING_SECRET_DIRECTORY`; dedicated-mode secret-manager lookup remains gated in Phase 4). Control-plane rows store references only (`assertSafeEffect`, `customerConfigurationSchema`).
- **Database Ownership & Least-Privilege Roles:**
  - **Bazionweb (`bazionweb` PostgreSQL)**: Owned solely by Bazionweb (`DATABASE_URL` pooled / `DATABASE_URL_UNPOOLED` Prisma migrations); holds commercial catalogs, prices, invoices, subscriptions, and commercial support tickets. Platform never accesses this DB.
  - **Bazion Platform (`bazion_platform` PostgreSQL)**: Owned solely by Platform (`packages/database/init/001-create-roles.sh`): `bazion_migrator` (DDL migrations), `bazion_app` (tenant runtime w/ RLS), `bazion_auth_runtime` (`auth` schema DML), `bazion_tenant_resolver` (domain/tenant lookup), `bazion_tenant_provisioner` (tenant + entitlement control), `bazion_product_provisioner` (inbox/operations/saga/installations/archives w/ RLS), `bazion_notification_enqueuer`, `bazion_notification_worker`, and `bazion_hosting_reconciler`. Bazionweb never accesses this DB.

The commercial delivery feature is committed in Bazionweb (`5dcdf2f`) and the platform (`355f7d7`, with the dual-system test harness in `80ef1de`). The standalone SSL test determinism fix is `4e41822`; billing test injection updates are `50bc559`.

## Current implementation status

### Code-Complete & Verified in Repository

- **Contracts & Parity (`@bazion/api-contracts` ↔ `D:\bazionweb`)**: All 7 v1 schemas and JSON Schemas are synchronized (`provision-product-request-v1` with optional contact PII, `installation-change-command-v1`, lifecycle, catalog, reconciliation, and shared `v1-contract-fixtures.json`). Email normalization runs in `provisioning-request-builder.ts`; Bazionweb omits `displayName` and `primaryContact` by default and redacts accepted outbox payloads + runs scheduled outbox retention redaction (`platform-provisioning-worker.service.ts`).
- **Ownership & Security Guard (`D:\bazionweb`)**: `PlatformSsotGuard` blocks legacy Dokploy/hosting/diagnostics mutations (`DokployProvider`, `DiagnosticsService`, `HostingService.updateAccount`) including unmapped rows, with blanket `ALLOW_LEGACY_PROVISIONING=true` replaced by an explicit ticket/actor-attributed, time-limited (<= 24h), operation-scoped, audited rollback window (`evaluateLegacyProvisioningRollbackWindow`).
- **OIDC Customer Identity Bridge (`D:\bazionweb` ↔ Platform `@bazion/auth`)**: Audited 1-to-1 `OidcIdentityLink` `(issuer, subject)` model + migration (`20261113050000_phase5_oidc_identity_links`), `POST /auth/oidc/{exchange,claim}`, server-side `(issuer, subject)` resolution in `JwtAuthGuard`, customer local-auth retirement (staff policy separate), and Portal OIDC primary initiation (`apps/web`).
- **Target Installation Changes (`@bazion/api`, `@bazion/database`)**: `0025_installation_changes.sql` append-only ledger + `InstallationChangeService` + `POST /v1/internal/commercial/installation-changes` apply idempotent add-on grants, revokes, upgrades, and rollbacks without mutating pinned base composition on `product_installations`.
- **Reconciliation, Dual-Read, Rollback & Recovery (`D:\bazionweb` ↔ Platform)**: Scheduled cross-entity reconciliation (`@Cron('0 */15 * * * *')` + drift `AuditLog` alert), `compareHostingProjectionDualRead` + `executeAuditedRollbackDrill`, `verifyOfferBindingReleaseTrio` / `promoteApprovedProductionOfferBindings` (default production allowlist remains `[]` / fail-closed), `SecretManagerTenantHostingSecretResolver` (dedicated mode stays disabled by default), `createPrivateArchiveStorageFromEnv` + `verifyPrivateArchiveRoundTrip`, and the cross-repo E2E suite in a dedicated required CI step with a fail-closed local database guard.

### Remaining Live Staging/Production Operational Cutover Gates

- Promote one complete release trio (`church-ministry` v1.0.0 manifests currently `"status": "partial"`) to `stable` and publish the audited production binding via `promoteApprovedProductionOfferBindings`.
- Observe a green required CI run of the joint cross-repo E2E suite, then execute it in staging with both PostgreSQL instances and verify zero unresolved drift.
- Complete live staging `pg_dump`/`pg_restore` and S3 offboarding archive round-trip sign-off, live customer hosting row mapping, dual-read parity review, rollback drill evidence, human operator training, and then retire Bazionweb's legacy `HostingService` / `DokployProvider` mutation paths.
- Keep `dedicated` distribution mode disabled until tenant-scoped Secret Manager credentials are provisioned and verified in live infrastructure.
- Do not mark a phase complete until its exit gate has evidence in CI and a commit. Migrations already applied are immutable; schema changes require new numbered migrations.

## Security references

- [RFC 9700 — Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 7636 — Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636.html)
- [RFC 10017 — OAuth 2.0 for Browser-Based Applications](https://www.rfc-editor.org/rfc/rfc10017.html)

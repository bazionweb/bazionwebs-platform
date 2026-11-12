# Bazion Commercial and Platform Integration Roadmap

This checklist coordinates the Bazion commercial website (`D:\bazionweb`) and the Bazion Platform repository. The commercial system owns Bazion's offers, prices, orders, invoices and subscriptions. The platform owns tenants, product installations, modules, domains and runtime deployments. The systems communicate through versioned APIs and durable messages; neither system reads or writes the other's database.

## Rules for every phase

- [ ] Keep one owner for each record type, state transition and provider-side effect.
- [ ] Use stable external IDs and correlation IDs; never join by email or domain.
- [ ] Make commands idempotent and status delivery retryable. Assume messages can be duplicated or delayed.
- [ ] Keep credentials, payment secrets, database URLs and provider error details out of contracts and logs.
- [ ] Add unit, contract, integration and failure-path tests for the slice being changed.
- [ ] Run focused tests, catalog validation, typecheck/build where applicable, and the full test suite before committing a phase.
- [ ] Commit only phase-owned files. Record migration, rollout, recovery and verification evidence in the phase notes.

## Phase 0 — Boundaries and delivery baseline

**Goal:** establish safe ownership and a repeatable working baseline before wiring production workflows.

- [x] Confirm Bazionweb as commercial system of record and Bazion Platform as product/runtime control plane.
- [x] Confirm tenant and product installation are distinct; tenants may have zero or more installations.
- [x] Record the exact base commit and clean/dirty status of both repositories before each cross-repository slice. The 2026-11-12 checkpoint is recorded below; repeat before every later cross-repository change.
- [ ] Assign a stable `externalCustomerId` and `externalOrderId` mapping; do not use email or hostname as keys.
- [ ] Record environment, service URL, service identity, secret owner and database owner for each system.
- [ ] Choose the single OIDC identity authority and document account-linking and recovery policy.
- [ ] Freeze product/offer ownership: Bazionweb owns commercial pricing; platform owns technical product releases and compatibility.
- [ ] Confirm the platform is the only service allowed to mutate Dokploy resources after hosting cutover.

**Exit gate:** the two repositories, databases, identities and hosting side effects have explicit owners and a reproducible baseline.

## Phase 1 — Versioned cross-system contract

**Goal:** agree on the exact wire data before any purchase can provision a tenant.

- [x] Define v1 request, operation snapshot and status-event schemas in `@bazion/api-contracts`.
- [x] Include external customer/order/offer references, pinned product/solution/template versions, idempotency, event and correlation identifiers.
- [x] Exclude pricing, payment instruments, secrets and provider credentials from the platform command.
- [x] Validate strict fields, identifier formats, hostnames, contact email and ready/failed status invariants.
- [x] Publish a versioned JSON Schema artifact and verify it stays synchronized with the runtime validator.
- [ ] Add cross-repository consumer/provider contract tests against the same examples.
- [ ] Document additive and breaking-change rules, deprecation window and minimum supported contract version.

**Exit gate:** both API implementations accept and reject the same versioned examples, and incompatible versions fail before provisioning.

## Phase 2 — Platform tenant-to-installation registry

**Goal:** persist product lifecycle separately from tenant identity and deployment state.

- [x] Add the initial installation and durable provisioning-operation tables with pinned product/solution/template references, unique external order/idempotency references, request fingerprints and lifecycle fields in migrations `0018`–`0019`.
- [x] Add database-enforced operation transition/update rules, immutable event history and the initial retry/terminal-state model.
- [ ] Keep configuration history separate from product definitions; prohibit secret values in snapshots.
- [ ] Resolve verified-domain-to-installation routing before allowing multiple branded installations per tenant.
- [x] Add least-privilege grants, forced RLS for tenant-owned installations, tenant-aware foreign keys and append-only operation events.
- [ ] Complete migration recovery guidance and PostgreSQL coverage for all legal transitions, fingerprint conflicts, immutability and partial failure.
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
- [ ] Finish PostgreSQL-backed integration verification for transaction atomicity, duplicate delivery and service downtime in both systems. The platform delivery integration passed locally; Bazionweb's database suite and the dual-repository HTTP/PostgreSQL suite are implemented but their 3 database tests were skipped because `BAZIONWEB_TEST_DATABASE_URL` is unset. The available local `bazionweb_test` database has no tables and `bazion_migrator` cannot create objects in `public`; Bazionweb's configured `.env` points to remote Neon and must not be used for local tests. A dedicated local test database or CI database wiring remains an exit-gate requirement.

**Exit gate:** neither a lost message nor duplicate delivery can lose or multiply a paid provisioning request.

## Phase 4 — Product resolution and single hosting authority

**Goal:** map offers to validated product composition and make platform deployments authoritative.

- [x] Define a strict, versioned, price-free catalog contract for offer/version → product/solution/template releases, module entitlements and supported distribution mode (`@bazion/api-contracts`, `provisioning-catalog.ts`).
- [x] Keep offer authority in a Platform-owned allowlist; reject unbound offers, version/composition drift, retired or unstable releases, and unsupported distribution before creating a provisioning operation. The active list remains empty until a stable composition is available.
- [x] Expose `GET /v1/internal/commercial/provisioning-catalog` to machine clients with the `commercial:provisioning:read` scope; the response excludes pricing and only contains active stable shared-managed bindings.
- [ ] Publish the first real binding only after the product, solution, template and module versions are stable and the manifest consistency test passes. Current church-ministry product, solution and template manifests are `partial`.
- [ ] Make Bazionweb consume the Platform catalog when composing the purchase quote, persist the selected offer and composition versions on the order line, and use those immutable pins for delivery; remove fallback offer versions and guessed composition pins.
- [ ] Prove shared-managed provisioning only creates tenant/installation/entitlement records and never calls Dokploy or allocates a tenant database. Add a committed fast unit test in addition to the database integration test.
- [ ] For dedicated deployments, keep intake disabled until tenant-scoped credentials are resolved through a production secret manager; Docker secret file mounts are not the production credential contract.
- [ ] Expose provider inspection and idempotent stop through an authorized Platform API/saga adapter, and expose remove only with verified provider identity, operation ownership, audit history and non-destructive data-retention behavior.
- [ ] Move purchase-triggered deployment requests behind the platform hosting provider port.
- [ ] Reuse platform hosting operation, lease, recovery and reconciliation records.
- [ ] Represent Bazionweb hosting data as a read model keyed by platform deployment ID.
- [ ] Migrate existing hosting records with an auditable mapping and compare both systems before cutover.
- [ ] Remove duplicate Dokploy mutation paths only after rollback and recovery are proven.
- [ ] Keep tenant commerce/donations and Bazion package billing in separate ledgers and webhook identities.

**Exit gate:** a product offer resolves deterministically and only the platform can create, update or recover its runtime deployment.

## Phase 5 — Identity and user/admin experience

**Goal:** give customers one identity and make dashboard ownership easy to understand.

- [x] Select and operate one OIDC authority; migrate/link accounts using `(issuer, subject)`, not email. *(Platform OIDC authority, RS256 JWKS, and durable `(issuer, subject)` linking implemented; cross-repo `bazionweb` RP wiring pending coordination)*
- [x] Define tenant owner invitation, acceptance, recovery, email change and account merge flows. *(Atomic order claims, verified email-change revocation, explicit collision logging without silent email merge, and support resolution implemented on Platform)*
- [ ] Keep Bazionweb portal focused on invoices, subscriptions, proposals and commercial support. *(Scoped deep-link boundary and contracts implemented in Platform; Bazionweb portal UI remains in `bazionweb`)*
- [x] Keep platform workspace focused on site/product settings and tenant activity.
- [ ] Keep Bazionweb super-admin focused on catalog prices, customers, sales, invoices and support. *(Super-admin boundary and opaque-ID deep links implemented in Platform; Bazionweb super-admin remains in `bazionweb`)*
- [x] Keep platform super-admin focused on tenants, product releases, domains, modules, deployments and recovery.
- [x] Add cross-dashboard deep links with shared external references and least-privilege scopes. *(Platform `POST /v1/auth/deep-links/resolve` + configurable URL helpers; hardcoded `localhost:3100` links removed from `apps/admin`)*
- [x] Test unauthorized tenant access, account linking collisions, role boundaries and logout/session expiry.

**Exit gate:** one customer account reaches the correct billing and product workspace without duplicate identities or ambiguous admin actions.

## Phase 6 — Durable provisioning saga and lifecycle coordination

**Goal:** orchestrate multi-step provisioning with visible progress and explicit compensating actions.

- [ ] Implement a durable saga state machine keyed by the platform operation ID and originating order ID.
- [ ] Model forward steps explicitly: validate release/offer, create or link tenant, create installation, apply safe configuration, bind domain, request hosting, verify readiness.
- [ ] Persist each step attempt, result, timestamps, retry count, provider reference and correlation ID before advancing.
- [ ] Define a compensation for every reversible forward step; examples include release an unbound domain, stop a newly-created deployment, mark an installation failed, or retain an already-created tenant for operator review.
- [ ] Classify failures as retryable, terminal or compensation-required; never compensate for a transient timeout before checking provider state.
- [ ] Run compensations in reverse order, make each compensation idempotent, and persist compensation progress independently.
- [ ] If compensation fails or data has become customer-owned, enter `compensation_required` and require an audited operator action instead of destructive cleanup.
- [ ] Expose current step, last safe error code, retry, resume and compensation state in platform admin; expose only customer-safe operation status in Bazionweb.
- [ ] Add failure injection tests after every step, including duplicate events, worker restart, provider timeout-after-success, retry exhaustion and failed compensation.
- [ ] Add subscription lifecycle commands: activate, grace, suspend, reactivate and cancel; make suspension reversible and deletion a separately approved retention workflow.
- [ ] Publish completion/failure/lifecycle events through the platform outbox; update Bazionweb projections idempotently.

**Exit gate:** every partial failure is inspectable and recoverable; retry/compensation cannot create duplicate tenants, installations or workloads; destructive actions never run implicitly.

## Phase 7 — Pilot, cutover and operations

**Goal:** migrate incrementally and prove operational recovery before general availability.

- [ ] Run contract tests and a staging pilot for one offer and one product release.
- [ ] Exercise payment success, payment duplicate, provisioning success, retry, compensation, suspension and reactivation end-to-end.
- [ ] Reconcile commercial orders ↔ platform operations ↔ installations ↔ deployments with exception reports.
- [ ] Set SLOs for command acceptance, ready time, callback lag and stuck-operation age.
- [ ] Add metrics, structured logs, trace/correlation propagation and alerts without exposing PII/secrets.
- [ ] Train operators on replay, retry, resume, compensation and customer communication runbooks.
- [ ] Canary one paid customer, verify backups/restore and rollback, then expand by offer and tenant cohort.
- [ ] Remove legacy provisioning only after zero unresolved mismatches and a completed rollback window.

**Exit gate:** monitored pilot meets SLOs, recovery exercises pass, and every active customer/order has one authoritative lifecycle record.

## Audit intake: findings to incorporate

The second repository audit agrees with this roadmap on independent systems of record, durable asynchronous delivery, one hosting authority and one identity authority. It is useful as a **readiness and defect list**, not as a replacement architecture. Its sample `/sync/events` payload and one-client/one-tenant model are not adopted; the strict versioned provisioning contract and tenant-to-installation model remain the integration boundary. Several findings in the pasted audit describe an earlier source snapshot; this section records which are already fixed and which remain verified work.

The audited divergent branch, `feature/church-ministry-platform` (`8d19d09` at the time of that audit), remains locally present. At this checkpoint it has 11 commits absent from the current branch; the current branch has 144 commits absent from it. The current branch already has the initial `product_installations` / provisioning-operation model in `packages/database/migrations/0018_product_installations_provisioning_sagas.sql` and command-delivery schema in `0019_commercial_provisioning_delivery.sql`; hosting owns `0016`–`0017`. The feature branch contains additional configuration checksums/transforms, forced RLS and offboarding/retention behavior that still need comparison. **Do not merge that branch wholesale, renumber migrations already applied, or create a second installation model.** Port only verified reusable behavior and assign future migrations after the current head.

### Verified pre-sync risks

- In `apps/api/src/lib/tenant-resolution.ts`, an explicit `x-bazion-tenant` selector was resolved before the verified hostname. This is fixed in the current slice: mapped hostnames take precedence, and the explicit selector is accepted only on non-production loopback hosts. Tests cover production spoofing, unknown production hosts, local selection, tenant-specific localhost precedence and non-loopback development hosts.
- In `apps/api/src/modules/admin/routes.ts`, the tenant audit action filter emitted `ILIKE 2` instead of a parameter placeholder. Pagination values were passed as bind parameters while the query rendered their numeric positions as literals. The query now binds all filter and pagination values correctly; route tests assert SQL placeholders and value arrays with and without filters.
- The rate-limit reset route previously reported success even though neither configured rate-limit store exposes a supported targeted reset API. The false-success path and misleading UI control are removed; the route now returns `501 RATE_LIMIT_RESET_UNAVAILABLE`, audits the failed attempt, and the inspector declares reset unsupported. The maintenance-mode request-path gap is also fixed in Platform commit `89c2b04`: public tenant site reads and new submissions receive a safe tenant-scoped `503`, while admin recovery and payment completion/status paths remain available.
- The generated module catalogue previously defaulted optional `commerce`, `analytics`, and `church-ministry` modules on. `afterCreateOrganization` seeded church content and entitlement for every organization, and created `<slug>.localhost` as active in every environment. Optional modules now default off, product seeding has been removed from the generic identity hook, and local host creation is development-only. The installation workflow still needs to grant modules and initialize configuration idempotently from the purchased composition.
- Hosting secrets currently resolve from pre-mounted Docker Swarm files under `/run/secrets`, and the current hosting package has no completed saga adapter for stop/remove compensation. Keep shared-managed RLS products out of per-tenant Dokploy provisioning. Enable dedicated deployment only after secret-manager provisioning, provider identity checks, idempotent stop/remove operations, and recovery tests exist.
- In `D:\bazionweb`, settlement paths in `PaymentSettlementService` update Prisma directly and do not all emit the `invoice.paid` event used by `BillingService.markPaid`. Place the provisioning outbox write in the settlement transaction itself so webhooks, return verification, and reconciliation share the same atomic path.
- The commercial app currently marks overdue invoices and alerts administrators; it does not yet implement the grace-expiry-to-suspension lifecycle assumed by Phase 6. Add an explicit grace policy and idempotent subscription lifecycle events before relying on automated suspension.
- The commercial audit flags sandbox impersonation writes, a Dokploy domain bind missing an application ID, and the absence of `apps/web/package-lock.json`. The missing application ID is fixed in Bazionweb commit `a4f2282`: hosting stores the provider/workload reference, and SSL remediation passes the verified ID to Dokploy with regression coverage. Existing hosting rows still need reference reconciliation before remediation is enabled for them. The sandbox claim still needs a server-side route/guard audit and mutation-blocking tests; frontend read-only behavior is not an API security control. Lockfiles are mixed today: there is a root workspace lock and an API nested lock, but no web nested lock; CI installs the web from its app directory with `npm install`. Choose and enforce one reproducible lock/install policy across CI and Docker rather than adding a lockfile by guesswork.
- The contract's runtime catalog-ID regex previously accepted uppercase while its generated JSON Schema did not. Runtime validation now matches the lowercase schema and has regression coverage; cross-repository shared fixtures remain open. The example offer `church-ministry-launch` is not in the platform's `products/commercial-offerings.json`; replace it with a real versioned offer once the binding is published. The request's `composition` is an assertion of requested pins, not authority: the platform must resolve the offer/version from its own catalogue and reject any mismatch before creating an installation.

## Detailed phase checklist and audit-driven work

### Phase 0 — Ownership and readiness baseline

- [ ] Record both repository URLs, branch names, base SHAs, clean/dirty status, deploy environments, service URLs and schema versions for each implementation slice.
- [ ] Keep Bazionweb as the only owner of prices, invoices, paid-order settlement, subscriptions and commercial customer support.
- [ ] Keep Bazion Platform as the only owner of tenant lifecycle, product installations, module entitlements, verified domains and runtime deployments.
- [ ] Document which service owns each credential, signing key, database role and provider account; store only references to secrets in control-plane rows.
- [x] Fix the production tenant-selector bypass before enabling commercial commands; verified hostname routing now wins and explicit selection is local-development-only.
- [x] Fix the tenant audit filter and pagination parameter binding; route tests cover queries with and without filters.
- [x] Remove the rate-limit reset false-success path and misleading UI; disclose that the current stores do not support targeted resets.
- [x] Remove implicit church/product initialization from generic organization creation, default optional product modules off, and keep local tenant domains development-only.
- [x] Connect the maintenance control to the church public request path. Public site/content and new contribution/contact submissions return a scoped `503` notice; admin routes, provider callbacks and existing payment-status lookups remain available. Malformed/unavailable maintenance settings fail closed. Focused route/unit tests and API typecheck pass.
- [ ] Implement idempotent product-specific configuration in the installation workflow.
- [ ] Add a server-side guard that blocks prohibited mutations from sandbox/impersonation tokens; define allowed read-only actions and test representative API writes. Do not rely on the web UI to enforce this boundary.
- [x] Pass a verified Dokploy workload/application identifier to the commercial SSL remediation domain bind and test the exact provider payload (Bazionweb `a4f2282`); reconcile legacy hosting rows that lack the stored reference.
- [ ] Choose one lock/install policy for the npm workspaces and make CI and Docker use it deterministically (`npm ci` from the intended lock authority); remove accidental per-app drift.
- [ ] Agree that an order can provision one installation in v1. Add a stable order-line reference before allowing several installations from one order.
- [ ] Confirm shared-managed products use the platform's shared tenant database and do not create a Dokploy deployment.
- [ ] Compare the feature-branch configuration transforms, secret-key rejection and retention/offboarding code against the current model; selectively port useful behavior without replaying or renumbering migrations `0016`–`0019`.

**Phase 0 exit evidence:** regression tests cover every production selector and audited no-op; both repositories have a recorded baseline; ownership and hosting boundaries are written down.

### Phase 1 — Wire contracts and catalogue agreement

- [x] Keep v1 strict, lowercase identifiers, immutable versions, stable external IDs, idempotency and correlation IDs; keep runtime Zod and generated JSON Schema in exact agreement. Runtime catalog-ID validation now rejects uppercase as the published schema does, with regression coverage.
- [ ] Normalize commercial contact email before serialization; keep the platform contract's lowercase rule and do not treat rejection as normalization.
- [ ] Remove the fictional `church-ministry-launch` example and use a real commercial offer once its product binding is published.
- [ ] Define a platform-authored, versioned offer-to-product binding. Bazionweb may send pinned composition, but the platform must independently validate that the offer version resolves to that allowed composition.
- [ ] Document whether customer display/contact fields are necessary for provisioning; do not persist them in operation, saga, or audit tables unless a defined platform workflow requires them.
- [ ] Add shared positive/negative fixtures consumed by both Bazionweb's Ajv validator and Platform's Zod validator; run them in both CI pipelines.
- [ ] Specify compatibility rules: additive optional fields within a major contract, reject unknown breaking versions, a published deprecation period, and the minimum supported version.
- [ ] Keep subscription lifecycle operations out of `provision-product-request-v1`; define separate versioned activate/grace/suspend/reactivate/cancel commands with stable event IDs and order/subscription references.
- [ ] Decide how upgrades and add-ons identify an order line, target installation, and compatible release without mutating an existing pinned composition.

### Phase 2 — Tenant and installation registry

- [ ] Reconcile the current schema with `feature/church-ministry-platform` before widening it; port its safe configuration snapshots, checksums, recursive secret-key rejection, forward-only transforms and retention/offboarding controls where they fit.
- [ ] Keep one tenant as the identity and isolation boundary and allow zero or more product installations beneath it; do not treat an installation as a new security boundary.
- [ ] Store immutable product, solution, template, configuration-schema and distribution-mode pins; keep `shared-managed` as the only accepted distribution mode until another mode has operational proof.
- [x] Persist a canonical request fingerprint with the idempotency key and return the existing operation for identical duplicate delivery.
- [ ] Return a conflict when the same idempotency key arrives with different content; enforce this at the API adapter as well as the database boundary.
- [ ] Enforce unique external order/installation references and tenant-aware foreign keys; define the v1 one-installation-per-order constraint explicitly.
- [x] Apply forced RLS and transaction-local tenant context to installation records; the dedicated provisioner role is least privilege and cannot access commerce tables.
- [ ] Extend tenant isolation to configuration history when that model is added, and wire authorized cross-tenant access through the provisioning adapter only.
- [x] Retain PII-free operation history, safe failure codes, current step, timestamps, provider references and append-only status events. The database journal stores these fields and enforces safe effect references.
- [ ] Define domain-to-installation routing before allowing two independently branded sites under one tenant; retain existing tenant-host routing until then.
- [ ] Add create/read/retry authorization rules and return `202 Accepted` only after the idempotent operation is committed.
- [x] Add PostgreSQL integration tests for role grants, RLS isolation, duplicate delivery, append-only status history, secret rejection, and provisioner denial of commerce access.
- [ ] Extend PostgreSQL tests to cover fingerprint conflict, all legal transitions, immutability, and rollback after partial failure.
- [ ] Write and exercise forward migration and recovery instructions. Migrations are append-only; do not renumber migrations already applied to a database. Migration `0018` is applied locally; later changes must use a new migration.

### Phase 3 — Durable request and status delivery

- [x] Add the Bazionweb outbox insert inside the same Prisma transaction that settles a paid order in `PaymentSettlementService`; cover provider webhooks, customer return verification and scheduled reconciliation.
- [x] Guarantee one outbox command per settled order line with a deterministic event/idempotency key and canonical request fingerprint.
- [x] Add a bounded sender worker with timeouts, exponential backoff with jitter, lease/fencing semantics, dead-letter state and an operator replay action.
- [x] Authenticate platform commands with a machine identity and narrow audience/scope; rotate credentials and reject expired or wrong-audience calls.
- [x] Persist an inbox receipt and provisioning operation before acknowledging a command; duplicate IDs return the original operation without rerunning work.
- [x] In the platform, append status events to an outbox in the same transaction as operation changes; send signed callbacks with replay protection.
- [x] In Bazionweb, verify signatures/timestamps/event IDs and upsert a commercial status projection idempotently.
- [x] Add reconciliation for accepted-without-status, callback lag, repeated events, dead letters and order/platform mismatches.
- [ ] Run transaction atomicity, duplicate delivery and service-downtime tests with a safe Bazionweb test database and both live service adapters. Platform PostgreSQL delivery integration passed; Bazionweb's PostgreSQL cases and cross-repository database tests were skipped because no safe `BAZIONWEB_TEST_DATABASE_URL` is configured. Never hydrate or migrate the configured remote Neon database for this test suite.

### Phase 4 — Offer resolution and hosting authority

- [ ] Publish a versioned offer binding from the platform-owned product/solution/template catalogue and make Bazionweb consume it without copying prices into the platform. The Platform intake now has a fail-closed binding registry, but it is intentionally empty: the current product, solution and template releases are not all stable, and no audited commercial offer maps to a stable composition yet.
- [x] Reject unbound offers, offer-version mismatches, client composition drift, non-stable releases, retired bindings and unsupported distribution modes before inserting a provisioning operation. Production has no active binding until an audited stable release mapping is published.
- [ ] For `shared-managed`, provision tenant records and entitlements only; do not call Dokploy or allocate one database per tenant.
- [ ] For a future dedicated deployment mode, first implement provider-neutral secret-manager lookup and tenant-scoped credentials; remove dependence on manually pre-mounted Swarm files.
- [ ] Expose provider inspection, idempotent stop and guarded remove through an authorized Platform API/saga adapter, keyed by verified provider resource identity. The provider interface has stop/destroy methods, but the current HTTP hosting surface does not expose teardown actions. A timeout-after-success must trigger inspect/reconcile before replay or compensation.
- [ ] Keep all Dokploy create/update/stop/remove mutations in Bazion Platform. Bazionweb stores a read projection keyed by platform deployment ID.
- [ ] Map existing commercial hosting rows to platform deployment IDs and compare results before removing old mutation paths.
- [ ] Keep tenant commerce/donation ledgers and payment webhooks separate from Bazion package billing.

### Phase 5 — Identity and dashboard security

- [x] Choose one OIDC issuer and persist linked identity by `(issuer, subject)`; never merge identities by matching email.
- [x] Use the browser-app BFF pattern for dashboard sessions: server-side tokens; secure, HttpOnly, SameSite cookies with `Path=/`, no `Domain`, and a supported `__Host-Http-` prefix; authorization code with PKCE `S256`; validate state/nonce; never put access/refresh tokens or session IDs in URLs.
- [x] Design guest-paid-order claiming as a separate, short-lived, high-entropy, one-use proof bound to an order; hash it at rest and consume it atomically. Linking the order must not silently merge an existing identity by email.
- [x] Define owner invitation, acceptance, account recovery, email change and account collision support paths.
- [ ] Keep billing, invoices, subscriptions and commercial support in the Bazionweb portal; keep product settings, content and deployments in the Platform workspace. *(Platform workspace, claim/email-change UI, and scoped deep links implemented; Bazionweb commercial portal changes remain in `bazionweb`)*
- [x] Keep the two super-admin areas permission-separated and use scoped deep links with opaque external IDs.
- [x] Test tenant access, account-link collisions, role boundaries, CSRF, logout, session expiry and guest claim replay.

### Phase 6 — Durable provisioning saga and lifecycle

- [ ] Back the saga journal interface with PostgreSQL; serialize work by operation ID with a lease/fencing token so two workers cannot advance or compensate the same saga concurrently.
- [ ] Persist each forward and compensation attempt before external calls; store only safe resource references, never secret values or provider request bodies.
- [ ] Implement the ordered steps: validate release/offer, ensure/link tenant, create installation, apply validated configuration, bind/verify domain, request hosting only for a supported dedicated mode, verify readiness.
- [ ] Require a compensation or an explicit `manual_review`/`compensation_required` policy for each step. Retain a tenant if cleanup could destroy identity or customer-owned data.
- [ ] Run compensations in reverse completion order with stable idempotency keys; persist each attempt and completion separately.
- [ ] Classify retryable, terminal, unknown-effect and compensation-failed outcomes. Inspect provider state before retrying or compensating any ambiguous external operation.
- [ ] Stop only a newly created resource whose provider identity and operation ownership have been verified. Never auto-remove a resource containing customer data; require an audited operator action for destructive cleanup.
- [ ] Add operator views/actions for retry, resume, reconcile and compensation with authorization, reason, actor, before/after state and append-only audit.
- [ ] Add recovery for worker crash after external success but before database commit; test stale leases and fencing.
- [ ] In Bazionweb, define the grace/dunning policy and implement idempotent overdue → grace → suspension transitions, notices and lifecycle outbox events before automated suspension is enabled; an overdue invoice alone must not suspend an installation.
- [ ] Keep subscription activation/grace/suspension/reactivation/cancellation as separate versioned lifecycle commands. Bazionweb owns grace and subscription decisions; Platform applies the signed, idempotent entitlement transition.
- [ ] Make suspension reversible. Treat deletion/offboarding as a separate export, retention and audited purge workflow, incorporating the proven 30-day archive behavior from the feature branch.
- [ ] Add failure injection after every step plus duplicate message, timeout-after-success, retry exhaustion, callback loss and failed compensation tests.

### Phase 7 — Pilot, cutover and operations

- [ ] Pilot one real offer, one stable release and one shared-managed tenant in staging before enabling hosting mutations.
- [ ] Exercise paid order, duplicate payment callback, command retry, provisioning success, worker restart, compensation, manual review, grace, suspension and reactivation end to end.
- [ ] Reconcile every paid order ↔ operation ↔ installation ↔ entitlement ↔ deployment; publish exception reports with owner and age.
- [ ] Define SLOs and alerts for command acceptance, provision-ready latency, callback lag, dead-letter age, operation lease age, compensation-required count and reconciliation drift.
- [ ] Add correlation IDs to logs/traces while redacting contact information, auth claims, secrets, provider payloads and payment data.
- [ ] Train support on replay, retry, resume, reconcile, safe compensation and customer communication; test database and archive restoration.
- [ ] Canary one customer, maintain a rollback window and dual-read reconciliation, then expand by offer and tenant cohort.
- [ ] Remove legacy provisioning only after all mismatches are resolved, rollback is tested, and the hosting authority has a completed recovery drill.

## Cross-repository checkpoint — 2026-11-12

| Repository | Branch | Commit at checkpoint | Working tree | Database evidence |
| --- | --- | --- | --- | --- |
| Bazion Platform | `feat/provider-neutral-deployment-contract` | `8470440453b8e4eb051c98062451c57f034ec3d8` | Only pre-existing untracked `.agents/` audit artifacts; preserved | Local `bazion_platform` includes migrations `0018`–`0019`; platform PostgreSQL delivery integration passes. |
| Bazionweb | `main` | `50bc5595631bce5e40533f2792bc1f7fded1a5c3` | Clean | The new outbox migration is committed but not applied to the empty local `bazionweb_test`; do not use the remote Neon URL for tests. |

The commercial delivery feature is committed in Bazionweb (`5dcdf2f`) and the platform (`355f7d7`, with the dual-system test harness in `80ef1de`). The standalone SSL test determinism fix is `4e41822`; billing test injection updates are `50bc559`.

## Current implementation status

- Phase 1's strict request/operation/event contract and generated JSON Schema are committed. The uppercase catalog-ID validator drift is corrected and covered by tests. The fixture-sharing, offer binding, and compatibility tasks remain open.
- Phase 2 is in progress: the initial installation/operation schema, dedicated database role, Drizzle declarations, inbox/routes and PostgreSQL integration tests are implemented in migrations `0018`–`0019`. The platform registry integration passed locally, but branch-feature reconciliation, configuration history/transform coverage, migration recovery evidence and remaining authorization/fingerprint-conflict cases are still required before closing the phase.
- The audited tenant-selector bypass is fixed; six focused tests verify production host authority and local-only explicit selection.
- Tenant-scoped audit filtering and pagination now use PostgreSQL bind placeholders consistently; route tests cover filtered and unfiltered pagination.
- Rate-limit reset now fails explicitly with an audited `501` while the configured stores lack reset APIs; the dashboard no longer offers a nonfunctional unblock form. Maintenance-mode enforcement is committed in Platform `89c2b04` and blocks public tenant reads and new submissions while preserving admin recovery and payment completion/status paths.
- Generic auth organization creation now only links its reserved tenant and creates a local hostname outside production. Optional commerce, analytics and church-ministry entitlements default off; the installation workflow must explicitly enable the purchased composition.
- Church maintenance mode now gates public website and new request/submission paths with a tenant-specific, safe `503` notice while preserving admin recovery and payment completion/status paths. Four utility tests and the 24-test church route suite passed; API typecheck passed. The repository-wide Turbo test task now completes all 34 tasks using the installed workspace dependencies; database-dependent integration tests remain skipped without safe local database URLs. Running the `pnpm test` entry point under the repository-pinned pnpm version still needs CI verification.
- Phase 3 command/status delivery is committed in both repositories. The platform PostgreSQL delivery integration passed. Bazionweb's full test run passed 595 API and 576 web tests, but its PostgreSQL integration suite skipped 3 database cases; the dual-repository integration test also skipped because no safe local Bazionweb test URL is configured. Current evidence does not support claiming a live Bazionweb or dual-database PostgreSQL run. CI/safe local database wiring, database-backed saga execution/compensation, product offer bindings (Phase 4), provider compensation, cross-repo Bazionweb Phase 5 RP wiring, and pilot remain outstanding.
- Phase 4 intake resolves requests against a Platform-owned immutable binding allowlist before creating an operation, verifies exact offer/version and composition pins, and rejects unstable releases or non-`shared-managed` distribution. A machine-authenticated, price-free catalog endpoint is implemented and tested; Bazionweb does not yet consume it. The production allowlist is deliberately empty because there is no stable product/solution/template release trio to bind. The first real binding, cross-repository catalog pinning, shared-managed no-Dokploy proof, provider lifecycle API, hosting projection/migration, and removal of Bazionweb's duplicate Dokploy mutations remain Phase 4 exit work.
- Phase 5 platform identity & BFF security is implemented on `feat/provider-neutral-deployment-contract` (`0020_phase5_identity_oidc_bff.sql`, `@bazion/api-contracts`, `@bazion/auth` OIDC/PKCE/BFF vault/identity lifecycle/deep-links, `apps/api` OIDC/BFF/auth/admin collision endpoints + CSRF origin guard, `apps/storefront` redirect hardening + order-claim/email-change UI, and `apps/admin` configurable storefront URLs + collision resolution panel) and verified locally against PostgreSQL; Bazionweb commercial portal/RP updates remain separate in `bazionweb`.
- Do not mark a phase complete until its exit gate has evidence in CI and a commit. Migrations already applied locally are immutable; follow-up schema changes require a new numbered migration.

## Security references

- [RFC 9700 — Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 7636 — Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636.html)
- [RFC 10017 — OAuth 2.0 for Browser-Based Applications](https://www.rfc-editor.org/rfc/rfc10017.html)

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
- [ ] Record the exact base commit and clean/dirty status of both repositories before each cross-repository slice.
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

- [ ] Design an installation table with tenant FK, immutable product/solution/template releases, configuration schema version and lifecycle timestamps.
- [ ] Add installation-scoped unique external references and a durable provisioning-operation record with idempotency constraints.
- [ ] Define legal transitions, retry ownership, cancellation behavior and terminal states.
- [ ] Keep configuration history separate from product definitions; prohibit secret values in snapshots.
- [ ] Resolve verified-domain-to-installation routing before allowing multiple branded installations per tenant.
- [ ] Add least-privilege grants, forced RLS where tenant-owned, tenant-aware FKs and audit records.
- [ ] Add migrations, rollback/recovery guidance and PostgreSQL integration tests for isolation and duplicate requests.
- [ ] Add authenticated platform API routes to accept a request and retrieve an operation; return `202 Accepted` for accepted work.

**Exit gate:** an installation and operation can be created exactly once, queried, authorized and recovered without changing existing tenant behavior.

## Phase 3 — Durable command and event delivery

**Goal:** transfer paid provisioning requests and platform outcomes without dual writes.

- [ ] In Bazionweb, commit paid-order settlement and a provisioning outbox row in one database transaction.
- [ ] Add a delivery worker with bounded retries, exponential backoff, timeout policy and dead-letter visibility.
- [ ] Authenticate service calls with short-lived, audience-scoped credentials and least-privilege scopes.
- [ ] In the platform, persist an inbox/idempotency receipt before acknowledging the command.
- [ ] Store platform status events in an outbox in the same transaction as operation state transitions.
- [ ] Deliver status callbacks to Bazionweb with signatures, event IDs, replay protection and retry/replay tools.
- [ ] Add reconciliation for accepted-without-status, duplicate, stale and permanently-failed messages.
- [ ] Add PostgreSQL-backed integration tests for transaction atomicity, duplicate delivery and service downtime.

**Exit gate:** neither a lost message nor duplicate delivery can lose or multiply a paid provisioning request.

## Phase 4 — Product resolution and single hosting authority

**Goal:** map offers to validated product composition and make platform deployments authoritative.

- [ ] Create a versioned offer-to-product binding: offer/version → product/solution/template release and module entitlements.
- [ ] Reject unknown offers, partial/unstable releases and incompatible module compositions before changing tenant state.
- [ ] Move purchase-triggered deployment requests behind the platform hosting provider port.
- [ ] Reuse platform hosting operation, lease, recovery and reconciliation records.
- [ ] Represent Bazionweb hosting data as a read model keyed by platform deployment ID.
- [ ] Migrate existing hosting records with an auditable mapping and compare both systems before cutover.
- [ ] Remove duplicate Dokploy mutation paths only after rollback and recovery are proven.
- [ ] Keep tenant commerce/donations and Bazion package billing in separate ledgers and webhook identities.

**Exit gate:** a product offer resolves deterministically and only the platform can create, update or recover its runtime deployment.

## Phase 5 — Identity and user/admin experience

**Goal:** give customers one identity and make dashboard ownership easy to understand.

- [ ] Select and operate one OIDC authority; migrate/link accounts using `(issuer, subject)`, not email.
- [ ] Define tenant owner invitation, acceptance, recovery, email change and account merge flows.
- [ ] Keep Bazionweb portal focused on invoices, subscriptions, proposals and commercial support.
- [ ] Keep platform workspace focused on site/product settings and tenant activity.
- [ ] Keep Bazionweb super-admin focused on catalog prices, customers, sales, invoices and support.
- [ ] Keep platform super-admin focused on tenants, product releases, domains, modules, deployments and recovery.
- [ ] Add cross-dashboard deep links with shared external references and least-privilege scopes.
- [ ] Test unauthorized tenant access, account linking collisions, role boundaries and logout/session expiry.

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

The second repository audit agrees with this roadmap on independent systems of record, durable asynchronous delivery, one hosting authority and one identity authority. It is useful as a **readiness and defect list**, not as a replacement architecture. Its sample `/sync/events` payload and one-client/one-tenant model are not adopted; the strict versioned provisioning contract and tenant-to-installation model remain the integration boundary.

The audit also found a divergent local branch, `feature/church-ministry-platform` (`8d19d09`), with 11 commits not in the current branch and 136 current-branch commits absent from it. It contains a `@bazion/product-installations` implementation, configuration checksums and forward transforms, forced RLS, and guarded offboarding/30-day retention. Its migrations `0016`–`0021` conflict with the current branch's hosting migrations `0016`–`0017` and the new provisioning migration `0018`. **Do not merge that branch wholesale or create a second installation model.** Review and port the reusable behavior, reconcile schema differences, and assign all new migration numbers after the current migration head.

### Verified pre-sync risks

- In `apps/api/src/lib/tenant-resolution.ts`, an explicit `x-bazion-tenant` selector was resolved before the verified hostname. This is fixed in the current slice: mapped hostnames take precedence, and the explicit selector is accepted only on non-production loopback hosts. Tests cover production spoofing, unknown production hosts, local selection, tenant-specific localhost precedence and non-loopback development hosts.
- In `apps/api/src/modules/admin/routes.ts`, the tenant audit action filter emits `ILIKE 2` instead of a parameter placeholder. Pagination values are also passed as bind parameters while the query renders their numeric positions as literals, so PostgreSQL receives unused parameters. Test the route with and without filters and repair parameter binding.
- The troubleshooting API writes `maintenance_mode`, but no storefront/API reader enforces it. The rate-limit reset route reports success even when the optional `app.rateLimit.resetKey` hook is absent or does nothing. Connect each control to a real, scoped behavior or remove the misleading control; never report success for a no-op.
- The generated module catalogue currently defaults optional `commerce`, `analytics`, and `church-ministry` modules on. `afterCreateOrganization` seeds church content, a church entitlement, and an active `<slug>.localhost` domain for every new organization. Move product-specific initialization to an explicit, idempotent product workflow; keep local hostname behavior development-only and derive entitlements from the purchased composition.
- Hosting secrets currently resolve from pre-mounted Docker Swarm files under `/run/secrets`, and the current hosting package has no completed saga adapter for stop/remove compensation. Keep shared-managed RLS products out of per-tenant Dokploy provisioning. Enable dedicated deployment only after secret-manager provisioning, provider identity checks, idempotent stop/remove operations, and recovery tests exist.
- In `D:\bazionweb`, settlement paths in `PaymentSettlementService` update Prisma directly and do not all emit the `invoice.paid` event used by `BillingService.markPaid`. Place the provisioning outbox write in the settlement transaction itself so webhooks, return verification, and reconciliation share the same atomic path.
- The commercial app currently marks overdue invoices and alerts administrators; it does not yet implement the grace-expiry-to-suspension lifecycle assumed by Phase 6. Add an explicit grace policy and idempotent subscription lifecycle events before relying on automated suspension.
- The commercial audit also flags sandbox impersonation writes, a Dokploy domain bind missing an application ID, and the absence of `apps/web/package-lock.json`. Verify each with a focused test before changing it. The root lockfile appears to be the monorepo lock authority; do not restore a nested lockfile until workspace policy confirms it is intended.
- The contract's runtime catalog-ID regex previously accepted uppercase while its generated JSON Schema did not. Runtime validation now matches the lowercase schema; regression and cross-repository tests are required before marking the fix complete. The example offer `church-ministry-launch` is not in `products/commercial-offerings.json`; use a real, versioned offer binding in the contract examples before any live sender is enabled.

## Detailed phase checklist and audit-driven work

### Phase 0 — Ownership and readiness baseline

- [ ] Record both repository URLs, branch names, base SHAs, clean/dirty status, deploy environments, service URLs and schema versions for each implementation slice.
- [ ] Keep Bazionweb as the only owner of prices, invoices, paid-order settlement, subscriptions and commercial customer support.
- [ ] Keep Bazion Platform as the only owner of tenant lifecycle, product installations, module entitlements, verified domains and runtime deployments.
- [ ] Document which service owns each credential, signing key, database role and provider account; store only references to secrets in control-plane rows.
- [x] Fix the production tenant-selector bypass before enabling commercial commands; verified hostname routing now wins and explicit selection is local-development-only.
- [ ] Fix the admin audit parameter bug, ineffective maintenance/rate-limit controls and implicit church defaults before enabling commercial commands.
- [ ] Verify and either fix or explicitly defer the commercial sandbox mutation guard and domain-bind application identity; test both.
- [ ] Confirm whether npm workspaces use only the root `package-lock.json`; make `npm ci`/lockfile policy explicit in CI.
- [ ] Agree that an order can provision one installation in v1. Add a stable order-line reference before allowing several installations from one order.
- [ ] Confirm shared-managed products use the platform's shared tenant database and do not create a Dokploy deployment.
- [ ] Record that the installation features on `feature/church-ministry-platform` are unmerged source work and reconcile their migration history before porting them.

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

- [ ] Add the Bazionweb outbox insert inside the same Prisma transaction that settles a paid order in `PaymentSettlementService`; cover provider webhooks, customer return verification and scheduled reconciliation.
- [ ] Guarantee one outbox command per settled order line with a deterministic event/idempotency key and canonical request fingerprint.
- [ ] Add a bounded sender worker with timeouts, exponential backoff with jitter, lease/fencing semantics, dead-letter state and an operator replay action.
- [ ] Authenticate platform commands with a machine identity and narrow audience/scope; rotate credentials and reject expired or wrong-audience calls.
- [ ] Persist an inbox receipt and provisioning operation before acknowledging a command; duplicate IDs return the original operation without rerunning work.
- [ ] In the platform, append status events to an outbox in the same transaction as operation changes; send signed callbacks with replay protection.
- [ ] In Bazionweb, verify signatures/timestamps/event IDs and upsert a commercial status projection idempotently.
- [ ] Add reconciliation for accepted-without-status, callback lag, repeated events, dead letters and order/platform mismatches.
- [ ] Test transaction atomicity and system downtime with PostgreSQL and both service adapters.

### Phase 4 — Offer resolution and hosting authority

- [ ] Publish a versioned offer binding from the platform-owned product/solution/template catalogue and make Bazionweb consume it without copying prices into the platform.
- [ ] Reject unknown offers, unstable releases, incompatible module sets and unsupported distribution modes before creating tenants or installations.
- [ ] For `shared-managed`, provision tenant records and entitlements only; do not call Dokploy or allocate one database per tenant.
- [ ] For a future dedicated deployment mode, first implement provider-neutral secret-manager lookup and tenant-scoped credentials; remove dependence on manually pre-mounted Swarm files.
- [ ] Implement provider inspection, idempotent stop, and guarded remove by verified provider resource identity. A timeout-after-success must trigger inspect/reconcile before any replay or compensation.
- [ ] Keep all Dokploy create/update/stop/remove mutations in Bazion Platform. Bazionweb stores a read projection keyed by platform deployment ID.
- [ ] Map existing commercial hosting rows to platform deployment IDs and compare results before removing old mutation paths.
- [ ] Keep tenant commerce/donation ledgers and payment webhooks separate from Bazion package billing.

### Phase 5 — Identity and dashboard security

- [ ] Choose one OIDC issuer and persist linked identity by `(issuer, subject)`; never merge identities by matching email.
- [ ] Use the browser-app BFF pattern for dashboard sessions: server-side tokens; secure, HttpOnly, SameSite cookies with `Path=/`, no `Domain`, and a supported `__Host-Http-` prefix; authorization code with PKCE `S256`; validate state/nonce; never put access/refresh tokens or session IDs in URLs.
- [ ] Design guest-paid-order claiming as a separate, short-lived, high-entropy, one-use proof bound to an order; hash it at rest and consume it atomically. Linking the order must not silently merge an existing identity by email.
- [ ] Define owner invitation, acceptance, account recovery, email change and account collision support paths.
- [ ] Keep billing, invoices, subscriptions and commercial support in the Bazionweb portal; keep product settings, content and deployments in the Platform workspace.
- [ ] Keep the two super-admin areas permission-separated and use scoped deep links with opaque external IDs.
- [ ] Test tenant access, account-link collisions, role boundaries, CSRF, logout, session expiry and guest claim replay.

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
- [ ] Keep subscription activation/grace/suspension/reactivation/cancellation as separate lifecycle commands. Commercial rules decide grace; Platform applies the signed entitlement transition.
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

## Current implementation status

- Phase 1's strict request/operation/event contract and generated JSON Schema are committed. The uppercase catalog-ID validator drift is corrected and covered by tests. The fixture-sharing, offer binding, and compatibility tasks remain open.
- Phase 2 is in progress: a platform installation/operation/saga journal migration, dedicated database role, Drizzle declarations and PostgreSQL integration test are implemented in the current slice. Migration `0018_product_installations_provisioning_sagas.sql` applied locally. The full workspace suite, including PostgreSQL-backed registry integration, passes locally; CI evidence and remaining registry/API authorization cases are still required before closing the phase.
- The audited tenant-selector bypass is fixed in the current working slice; six focused tests verify production host authority and local-only explicit selection. The admin audit query, maintenance/rate-limit controls and default church initialization are still open Phase 0 blockers.
- The database-backed saga adapter, inbox/outbox delivery, authenticated API routes, commercial sender/callback projection, product offer bindings, provider compensation adapter, identity flow and pilot remain outstanding.
- Do not mark a phase complete until its exit gate has evidence in CI and a commit. Migrations already applied locally are immutable; follow-up schema changes require a new numbered migration.

## Security references

- [RFC 9700 — Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 7636 — Proof Key for Code Exchange](https://www.rfc-editor.org/rfc/rfc7636.html)
- [RFC 10017 — OAuth 2.0 for Browser-Based Applications](https://www.rfc-editor.org/rfc/rfc10017.html)

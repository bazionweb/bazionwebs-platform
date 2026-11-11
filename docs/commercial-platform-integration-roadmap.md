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

## Current implementation slice

Phase 1 is in progress in `packages/api-contracts/src/provisioning.ts`. The v1 schemas, validation tests and generated JSON Schema artifact define the request boundary. Cross-repository consumer/provider tests, the platform persistence/API, a Bazionweb sender, durable outboxes and the saga worker remain outstanding. Do not mark a phase complete until its exit gate has evidence in CI and a commit.

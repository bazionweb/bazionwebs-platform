# Phase 1 — Platform Control Plane Implementation Plan

**Status:** planning baseline  
**Branch:** `docs/phase-1-control-plane-plan`  
**Base:** `main`  
**Repository reviewed:** 6 November 2026

This plan translates Phase 1 of `docs/implementation-roadmap.md` into an incremental, testable delivery sequence. It is intentionally a plan, not a claim that the platform control plane has been implemented.

## 1. Current verified baseline

The repository is a pnpm/Turborepo modular monolith with:
- `apps/api`: Fastify API, Better Auth integration, client administration and commerce routes.
- `apps/storefront`: Next.js customer storefront and client workspace UI.
- `apps/admin`: currently a placeholder reserved for the Bazion platform-owner application.
- `packages/auth`: Better Auth, client organization roles, platform roles and trusted tenant context.
- `packages/database`: PostgreSQL migrations, least-privilege roles, tenant-aware foreign keys and forced RLS.
- `packages/audit`: append-only platform audit writer.
- `packages/notifications`: encrypted transactional outbox and separately supervised SMTP worker.
- `packages/payments` and `packages/storage`: provider-neutral interfaces; production adapters are not yet implemented.

Existing platform primitives include:
- `public.tenants` with provisioning, active, suspended and closed states.
- `public.platform_members` with platform_owner, platform_admin and platform_support roles.
- Better Auth organization-to-tenant mapping.
- Verified-host lookup through `tenant_domain_directory`.
- Permission-gated tenant provisioning reconciliation.
- Client workspace administration inside the storefront; this is distinct from the platform-owner control plane.

Current release constraints:
- Production preflight blocks `PAYMENT_PROVIDER=mock`; production checkout requires live Daraja credentials and an HTTPS callback endpoint, with merchant validation still outstanding.
- The platform-owner UI, tenant lifecycle API, module entitlements, tenant settings, full domain verification/TLS lifecycle and usage metering are not implemented.
- `main` currently has branch protection disabled.
- PR #16 is open and its latest observed GitHub Actions validation run passed all 12 validation steps. Do not treat an open PR as merged or include its changes in the `main` baseline.
- CI is read-only and validates install, migrations, catalogue, typecheck, tests and build.

## 2. Architecture decisions

1. Keep the modular monolith. Do not create microservices for the control plane.
2. Build the platform-owner application in `apps/admin`; do not reuse or elevate the client workspace UI at `apps/storefront/app/admin`.
3. All platform-owner mutations must be authorized server-side with platform roles and explicit permission checks. Hiding UI controls is not authorization.
4. Platform roles remain separate from client organization roles. A client tenant administrator must never gain platform-owner permissions.
5. Resolve tenant IDs from trusted server-side registry/domain/session context. Never accept tenant identity from a user-controlled body, query parameter or arbitrary forwarded header.
6. Use narrowly scoped database roles and explicit repository predicates. Preserve forced RLS for tenant-owned data and test cross-tenant access with real PostgreSQL roles.
7. Audit every sensitive platform action. Audit events must not contain passwords, session tokens, invitation URLs, payment secrets or unnecessary personal data.
8. Add schema migrations sequentially and coordinate migration numbers through one integrator.
9. Make module enablement default-off. A module is usable only when its manifest, dependencies, entitlement, permission checks and provisioning are all valid.
10. No direct writes to `main`; implement through feature branches and reviewed pull requests.

## 3. Delivery sequence

### Step 0 — Repository and release guardrails

Deliver:
- Review and resolve open PR #16 separately; do not silently merge it as part of this plan.
- Enable branch protection/rules for `main`: require pull requests, required CI checks, block force pushes and deletion. Confirm the exact GitHub settings and whether administrator bypass is permitted.
- Add a security review checklist to pull requests touching auth, tenant resolution, migrations, billing, payments or platform administration.
- Keep the implementation status and roadmap documents aligned with merged code.

Acceptance:
- Main branch requires successful CI and review before changes can merge.
- No secrets or production credentials are placed in repository files or CI logs.

### Step 1 — Platform authorization contract

Deliver:
- Define platform permissions independently from Better Auth client organization roles.
- Define explicit permissions for platform overview, tenant list/read, tenant create, tenant update, tenant suspend/restore, tenant close, ownership assignment, module catalogue read, tenant module update, tenant settings read/update, domain verification, audit read and usage read.
- Implement a single server-side authorization boundary for platform routes.
- Add negative tests proving client roles, unauthenticated users and platform_support cannot perform owner/admin-only actions.
- Define support access as least-privilege and time-bounded if future support impersonation is introduced; do not implement silent impersonation.

Acceptance:
- Every platform endpoint rejects missing/invalid sessions and insufficient roles.
- Client organization roles never satisfy platform authorization checks.
- Denied sensitive actions are recorded without leaking secrets.

### Step 2 — Tenant lifecycle service and API

Deliver:
- A service layer for tenant list/detail, create/reserve, update metadata, assign owner, suspend, restore and close.
- Explicit state-transition rules and idempotency for retryable provisioning operations.
- Prevent closure or suspension from deleting tenant data.
- A safe owner-assignment flow that verifies the target identity and membership before granting ownership.
- Reconciliation visibility for provisioning, unmatched and conflicted records.
- Audit events and request correlation IDs for every state-changing operation.
- Pagination, filtering and bounded query limits for the tenant directory.

Acceptance:
- A platform owner can create a tenant reservation and track provisioning to active.
- Repeated requests do not create duplicate tenants or duplicate owners.
- Suspended tenants are denied access according to an explicit policy, without destroying records.
- Tenant state changes are tested for concurrency and rollback behavior.

### Step 3 — Platform admin application

Deliver:
- Protected platform-owner login/session gate.
- Admin shell with overview, tenant directory, tenant detail, activity/audit and system health navigation.
- Tenant directory with search, filters, pagination and state badges.
- Tenant detail view showing owner, domains, lifecycle status, enabled modules and usage.
- Safe confirmation flows for suspension, restoration and closure.
- Clear separation between platform administration and client workspace administration.
- Accessible loading, empty, error and permission-denied states.

Acceptance:
- Platform roles see only the screens/actions they are authorized to use.
- Client administrators cannot access platform routes by guessing URLs.
- UI calls the platform API; it never connects directly to PostgreSQL or embeds privileged secrets.

### Step 4 — Tenant settings and branding

Deliver:
- Tenant-scoped settings contract for business display name, logo, favicon, constrained color/typography tokens, locale, timezone, currency, contact details and legal metadata.
- Validation and safe defaults; prevent arbitrary HTML, script injection and unsafe CSS.
- Settings read/update API with audit history.
- Versioning or updated-at concurrency checks to avoid overwriting simultaneous edits.

Acceptance:
- Settings persist per tenant and cannot be read or changed by another tenant.
- Branding can be consumed by the storefront without granting access to secrets or internal tenant metadata.

### Step 5 — Module registry and entitlements

Deliver:
- Canonical registry of versioned module manifests, dependencies and capability declarations.
- Tenant module assignment and plan/entitlement model.
- Default-off enablement, dependency validation, quota enforcement and safe disable semantics.
- API authorization that checks both permission and entitlement.
- Audit events for module/plan changes.
- Initial usage dimensions: seats, storage, custom domains, deployments and background jobs.

Acceptance:
- A tenant cannot use a module merely because a route exists.
- Enabling a module with missing dependencies fails safely.
- Disabling a module blocks new use without deleting historical tenant data.
- Usage limits are enforced at the API/service boundary, not only in the UI.

### Step 6 — Custom-domain ownership and lifecycle

Deliver:
- Domain request and normalized hostname validation.
- DNS ownership challenge using high-entropy one-time tokens stored only as hashes.
- Verification polling/retry with rate limits and expiration.
- Unique hostname reservation and protection against domain takeover.
- Lifecycle states for pending, verified, provisioning TLS, active, failed and disabled.
- TLS readiness integration through the chosen hosting/edge provider adapter.
- Redirect/canonical-host policy and safe domain removal.
- Audit events for request, verification, activation and removal.

Acceptance:
- An unverified hostname never resolves to a tenant.
- A verified hostname cannot be attached to two tenants.
- DNS challenge tokens are not logged or exposed in API responses after creation.
- Removing a domain safely stops routing after a defined propagation period.

### Step 7 — Operational metering and audit visibility

Deliver:
- Minimal append-only usage events for seats, storage, domains, deployments and jobs.
- Aggregated tenant usage views with time windows and pagination.
- Permissioned audit reader for platform owners/admins, with tenant-scoped filters and redaction.
- Retention/archive policy and alerts for queue age, dead letters, provisioning failures and abnormal usage.

Acceptance:
- Metering is idempotent and cannot be inflated by replayed events.
- Audit read access is explicitly authorized and itself audited where appropriate.
- Retention and export behavior are documented and tested.

## 4. Security test matrix

Required tests before Phase 1 sign-off:
- Anonymous request to every platform endpoint.
- Client tenant admin calling every platform endpoint.
- Platform support attempting owner/admin-only mutations.
- Platform admin attempting owner-only actions.
- Cross-tenant settings/domain/module/usage access.
- Forged tenant IDs in bodies, query strings and headers.
- Forged `X-Forwarded-Host` and `Origin` values.
- Duplicate hostname and concurrent domain-verification attempts.
- Replayed tenant creation, owner assignment and module-enable requests.
- Suspended/closed tenant session and API behavior.
- Audit database unavailable during a privileged mutation (fail-closed policy).
- Database role checks confirming runtime API roles cannot bypass RLS or perform migrations.

## 5. Deployment and operational boundaries

- Keep the current Vercel deployment for the existing storefront while it remains compatible and economical.
- Do not migrate production workloads to VPS until deployment, backups, monitoring, rollback and operational ownership are tested.
- Keep PostgreSQL backups encrypted and off-host; perform restore drills before onboarding paying customers.
- Keep object storage, SMTP, payment credentials and tenant-specific secrets outside Git and browser bundles.
- Production sign-off remains blocked until notification worker restart/recovery, production preflight, backup restore, verified tenant-domain routing, and Daraja sandbox/live callback behavior have been demonstrated. Payment callback-loss reconciliation and refunds also remain open.

## 6. Suggested pull-request breakdown

1. `chore/repo-guardrails`: branch protection configuration/runbook and PR security checklist.
2. `feat/platform-permission-contract`: platform permission registry and authorization tests.
3. `feat/tenant-lifecycle-service`: state transitions, service layer, API contracts and tests.
4. `feat/platform-admin-shell`: protected `apps/admin` application shell and navigation.
5. `feat/tenant-settings`: schema, API, audit and settings UI.
6. `feat/module-entitlements`: registry, dependency resolution, tenant assignments and quota checks.
7. `feat/custom-domain-lifecycle`: DNS challenge, verification, TLS adapter and routing tests.
8. `feat/platform-usage-audit`: usage aggregation and permissioned audit viewer.

Each PR should be small enough to review, include migrations only when necessary, add unit and integration tests, update operational documentation and pass the existing full CI workflow.

## 7. Explicit non-goals for Phase 1

- Rewriting the storefront or replacing the existing Vercel deployment.
- Introducing Kubernetes or microservices.
- Building the visual page builder/CMS (Phase 2).
- Shipping live M-PESA/card payments (commerce/payment phase).
- Enabling all 111 catalogue capabilities at once.
- Giving an AI agent direct database or unrestricted platform-owner credentials.

## 8. Definition of Phase 1 complete

A verified platform owner can create a client, assign its owner, configure brand and locale, verify a custom domain, enable entitled modules, inspect usage/audit history and suspend/restore the tenant. Every operation is tenant-safe, permission-checked, audited, observable, tested and recoverable without direct SQL.

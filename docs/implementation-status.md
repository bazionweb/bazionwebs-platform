# Bazion Web implementation status

Reviewed 5 November 2026 against `main` after PRs #7–#11 were merged. Phase 0 repository foundations are implemented and CI-validated; deployment of the notification worker and production operational verification remain outstanding.

## Implemented foundations

- pnpm/Turborepo monorepo with frozen lockfile and GitHub Actions CI.
- Better Auth 1.7.17 email/password authentication, sessions, email verification and password reset flows.
- Organization membership, invitations, tenant roles and separately stored platform roles.
- Tenant registry and mapping from verified Better Auth organization IDs to Bazion tenant IDs.
- Permission-gated tenant provisioning reconciliation route; unmatched and conflicting reservations remain available for manual inspection.
- Trusted server-side tenant context and verified custom-host lookup.
- PostgreSQL forced RLS, tenant-aware foreign keys, least-privilege roles and integration tests for tenant isolation.
- Client workspace administration in the storefront: tenant-scoped metrics, member listing, invitations, role updates and removal.
- Commerce starter: product listing, guest cart, cart items, checkout order creation and development-only mock payments.
- Durable auth notifications: awaited Better Auth password-reset, verification and invitation enqueue; AES-256-GCM PostgreSQL outbox; separate enqueue/worker roles; standalone SMTP worker with lease recovery, retry/backoff and dead letters (PR #10).
- Basic ports/interfaces for payments, storage, booking and analytics.
- Product/solution capability catalogue, nine initial solution manifests and strict CI catalogue validation.
- Append-only audit-event contract/writer with database mutation protection and initial audit coverage for platform provisioning reconciliation and sensitive client team administration (PR #11).
- Versioned module-owned permission registry (18 declarations) and seven module manifests, validated in CI and checked against Better Auth's static role adapter (PR #11).

## Partial modules

| Module | Existing foundation | Still required |
|---|---|---|
| Auth and tenant platform | Better Auth, organizations, memberships, tenant registry, tenant/platform roles and RLS; 18 module-owned permission declarations checked against Better Auth's static statement and role map | Broader platform/service permissions, platform-owner dashboard, service identities and full tenant lifecycle |
| Client provisioning | Tenant reservation/mapping, reconciliation route and role-gated recovery | Platform configuration UI, DNS ownership proof, full custom-domain/TLS lifecycle and tenant settings |
| Notifications | Auth callbacks await durable encrypted enqueue; enqueue and worker DB roles are separated; standalone SMTP worker and PostgreSQL role/idempotency/lease-recovery tests are merged in PR #10 | Provision roles on existing databases, generate/store production encryption key, configure verified SMTP and supervise the worker; perform live restart/recovery test; add SMS adapter, dead-letter operator UI and queue-age/dead-letter alerting |
| Commerce | Product/cart/order foundation and mock payment flow | Product editor/variants, inventory ledger, real payments/webhooks, taxes, shipping, promotions, returns/refunds and customer portal |
| Payments | Provider contract and mock implementation | Real Safaricom Daraja, card and optional PayPal/Paystack adapters; signature verification, reconciliation and refunds |
| Storage | Provider-neutral storage interface and tenant object-key helper | R2/S3 adapter, media metadata, signed uploads, validation, transformations and retention |
| Booking | Basic type and booking-window validation | Availability, resources, time zones, conflict prevention, recurring rules, reminders and cancellation |
| Analytics | Event/sink contract and initial permission declaration | Privacy controls, event ingestion, dashboards, conversion reporting, exports and retention |
| Audit | Append-only event contract, PostgreSQL writer, UPDATE/DELETE trigger and API INSERT-only grants; initial sensitive admin-action coverage | Permissioned audit reader, approved retention/archive policy, monitoring and wider coverage of security-sensitive actions |
| UI | Shared Button component | Design tokens, complete component system, forms, tables, navigation, admin shell and tenant theming |

## Not yet implemented

- Platform-owner admin application and complete tenant control plane.
- Tenant module registry, dependencies, per-tenant entitlements, quotas and feature flags.
- CMS, page builder, block library, versioned templates and visual editor.
- Forms/lead management, contacts/CRM, newsletter campaigns and customer support desk.
- Document vault/generation, search, SEO automation and localization.
- Complete school, church, clinic, NGO, professional-services and ERP solution packs.
- Production hosting/deployment provisioning, backup orchestration, restore drills and operational monitoring.
- Commercial quote/project delivery workflows and platform subscription billing.
- Permission-checked MCP/AI integration.

## Phase 0 status

**Repository implementation is complete; the operational exit gate remains open.** PR #10 delivered durable authentication notification enqueue and the separately supervised worker; PR #11 delivered append-only audit storage, initial privileged-action audit coverage, the permission registry and manifest validation. PR #11's full CI run passed install, catalogue/module validation, PostgreSQL and Better Auth migrations, workspace typecheck, all unit/auth/tenant tests and full build. Before closing Phase 0 operationally, provision the two notification roles on the target persistent database, apply migrations, provision a unique production encryption key, configure verified SMTP, deploy the worker under systemd or an equivalent supervisor, and demonstrate delivery plus expired-lease recovery after a worker interruption. Review audit event coverage and approve retention/monitoring policy. The repository CI result does not prove production delivery or disaster recovery.

## CI verification

- PR #7 merged the encrypted outbox foundation.
- PR #8 merged the permission-gated tenant provisioning reconciliation route and its tests.
- PR #9 merged the product/solution catalogue, roadmap and read-only/non-cancelling CI hardening.
- PR #10 merged durable authentication notifications; the final PR revision passed all CI steps including PostgreSQL migrations, Better Auth migration, typecheck, tests and full build.
- PR #11 merged append-only audit tests, module manifest validation and role-registry consistency tests. Full CI run 42111950897 passed all 12 validation steps, including the full build.
- PR #10 adds a PostgreSQL integration suite for enqueue-role restrictions, idempotency, encrypted-at-rest payloads, concurrent claims and expired-lease recovery.
- PR #11 tests audit serialization/redaction and verifies Better Auth role maps against module-owned permission definitions.

## Production release rule

A module is not production-ready because its types or interface exist. Require implementation, API/UI as appropriate, tenant/RLS proof, permission tests, operational monitoring, retention/recovery, provider failure handling and documentation. Never use the development mock payment route or development credentials for live customers.

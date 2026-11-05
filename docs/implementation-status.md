# Bazion Web implementation status

Reviewed 5 November 2026 against `main` after PRs #7, #8 and #9 were merged. Notification end-to-end work is being delivered in the current Phase 0 branch and is not production-enabled until its PR passes CI, is merged and the worker is deployed.

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
- Encrypted PostgreSQL notification outbox foundation, idempotent enqueue, atomic claiming, leases, retry/backoff and dead letters.
- Basic ports/interfaces for payments, storage, booking and analytics.
- Product/solution capability catalogue, nine initial solution manifests and strict CI catalogue validation.

## Partial modules

| Module | Existing foundation | Still required |
|---|---|---|
| Auth and tenant platform | Better Auth, organizations, memberships, tenant registry, tenant/platform roles and RLS | Central module-aware permission registry, append-only audit events, platform-owner dashboard, service identities and full tenant lifecycle |
| Client provisioning | Tenant reservation/mapping, reconciliation route and role-gated recovery | Platform configuration UI, DNS ownership proof, full custom-domain/TLS lifecycle and tenant settings |
| Notifications | Encrypted outbox foundation. Current Phase 0 branch connects auth callbacks, separates enqueue/worker roles, adds an SMTP worker and PostgreSQL integration tests | Merge and deploy the worker under a process supervisor; configure production secrets/SMTP; add SMS adapter, dead-letter operator UI and queue-age/dead-letter alerting |
| Commerce | Product/cart/order foundation and mock payment flow | Product editor/variants, inventory ledger, real payments/webhooks, taxes, shipping, promotions, returns/refunds and customer portal |
| Payments | Provider contract and mock implementation | Real Safaricom Daraja, card and optional PayPal/Paystack adapters; signature verification, reconciliation and refunds |
| Storage | Provider-neutral storage interface and tenant object-key helper | R2/S3 adapter, media metadata, signed uploads, validation, transformations and retention |
| Booking | Basic type and booking-window validation | Availability, resources, time zones, conflict prevention, recurring rules, reminders and cancellation |
| Analytics | Event/sink contract | Privacy controls, event ingestion, dashboards, conversion reporting, exports and retention |
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

Phase 0 remains open until the notification work is merged and deployed, the platform audit-event contract/append-only store is implemented, and the central permission registry is adopted by API authorization. CI/catalogue validation, tenant reconciliation and roadmap/status refresh are already merged. Do not mark Phase 0 complete based only on the queue library or this feature branch.

## CI verification

- PR #7 merged the encrypted outbox foundation.
- PR #8 merged the permission-gated tenant provisioning reconciliation route and its tests.
- PR #9 merged the product/solution catalogue, roadmap and read-only/non-cancelling CI hardening.
- This branch adds a PostgreSQL integration test suite for enqueue-role restrictions, idempotency, encrypted-at-rest payloads, concurrent claims, expired-lease recovery and successful state transition. Its PR validation result is the authority for whether those tests pass.

## Production release rule

A module is not production-ready because its types or interface exist. Require implementation, API/UI as appropriate, tenant/RLS proof, permission tests, operational monitoring, retention/recovery, provider failure handling and documentation. Never use the development mock payment route or development credentials for live customers.

# Bazion Web implementation status

Reviewed 5 November 2026 against `main` after PRs #7, #8, #9 and #10 were merged. Durable auth notification delivery is merged but still requires production secrets, SMTP configuration and worker deployment.

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
- Current Phase 0 branch adds the append-only audit-event contract/writer, DB mutation protection, initial audit coverage for platform reconciliation and client team administration, and a versioned permission registry checked against Better Auth's static role adapter.

## Partial modules

| Module | Existing foundation | Still required |
|---|---|---|
| Auth and tenant platform | Better Auth, organizations, memberships, tenant registry, tenant/platform roles and RLS; versioned permission registry and module-owned grants in the current Phase 0 PR | Broader platform/service permissions, platform-owner dashboard, service identities and full tenant lifecycle |
| Client provisioning | Tenant reservation/mapping, reconciliation route and role-gated recovery | Platform configuration UI, DNS ownership proof, full custom-domain/TLS lifecycle and tenant settings |
| Notifications | Auth callbacks await durable encrypted enqueue; enqueue and worker DB roles are separated; standalone SMTP worker and PostgreSQL recovery tests are merged in PR #10 | Provision roles on existing databases, generate/store production encryption key, configure verified SMTP and supervise the worker; add SMS adapter, dead-letter operator UI and queue-age/dead-letter alerting |
| Commerce | Product/cart/order foundation and mock payment flow | Product editor/variants, inventory ledger, real payments/webhooks, taxes, shipping, promotions, returns/refunds and customer portal |
| Payments | Provider contract and mock implementation | Real Safaricom Daraja, card and optional PayPal/Paystack adapters; signature verification, reconciliation and refunds |
| Storage | Provider-neutral storage interface and tenant object-key helper | R2/S3 adapter, media metadata, signed uploads, validation, transformations and retention |
| Booking | Basic type and booking-window validation | Availability, resources, time zones, conflict prevention, recurring rules, reminders and cancellation |
| Analytics | Event/sink contract and initial permission declaration | Privacy controls, event ingestion, dashboards, conversion reporting, exports and retention |
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

Phase 0 remains open until the notification worker is deployed and restart/recovery is demonstrated in the target environment, the audit/permission PR passes CI and is merged, and the final permission/audit coverage review is complete. PR #10's notification CI passed install, migrations, Better Auth schema migration, typecheck, all tests and build. CI/catalogue hardening and tenant reconciliation are already merged. Do not mark Phase 0 complete based only on source code or a green CI run; production secrets, worker supervision and real restart recovery still matter.

## CI verification

- PR #7 merged the encrypted outbox foundation.
- PR #8 merged the permission-gated tenant provisioning reconciliation route and its tests.
- PR #9 merged the product/solution catalogue, roadmap and read-only/non-cancelling CI hardening.
- PR #10 merged durable authentication notifications; the final PR revision passed all CI steps including PostgreSQL migrations, Better Auth migration, typecheck, tests and full build.
- Current audit/permission PR adds append-only audit tests, module manifest validation and role-registry consistency tests; its PR CI is the final validation for those changes.
- PR #10 adds a PostgreSQL integration suite for enqueue-role restrictions, idempotency, encrypted-at-rest payloads, concurrent claims and expired-lease recovery.
- The current Phase 0 branch tests audit serialization/redaction and verifies Better Auth role maps against module-owned permission definitions.

## Production release rule

A module is not production-ready because its types or interface exist. Require implementation, API/UI as appropriate, tenant/RLS proof, permission tests, operational monitoring, retention/recovery, provider failure handling and documentation. Never use the development mock payment route or development credentials for live customers.

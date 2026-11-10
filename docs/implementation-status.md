# Implementation status

Reviewed 10 November 2026. This status describes the repository snapshot and its current release limits. A compiled interface or sandbox callback is not evidence of live production readiness.

## Implemented foundations

- pnpm/Turborepo monorepo with workspace CI and product/module manifest validation.
- Better Auth email/password, sessions, verification/reset flows, organization membership and distinct platform roles.
- Tenant registry, verified-host resolution, forced PostgreSQL RLS and tenant-aware foreign keys.
- Client workspace administration for membership and invitations; a separate platform-owner tenant-control path.
- Separate platform superadmin for tenant lifecycle, owner assignment, tenant settings, module overrides, audit history and initial usage reporting.
- Shared and dedicated tenant-database binding model with fail-closed routing. Dedicated production connections still require provider provisioning and secret-resolution adapters.
- Encrypted PostgreSQL notification outbox connected to Better Auth callbacks, plus a separately supervised SMTP worker.
- Append-only audit storage and initial audit coverage for platform and client team operations.
- Commerce product/cart/order flow with stock reservations. Development uses the mock payment path; Daraja M-Pesa STK Push and token-protected callbacks are available when configured.
- Partial church website and ministry module for tenant profiles, editable site settings, visit planning, ministries/FAQs, curated gallery, sermons, events, campaigns, registrations, giving attempts, contact/prayer intake and newsletter opt-ins. Research and remaining public site boundaries are documented in church-ministry-website-research.md.
- Owner/admin-only access to private ministry records. Public event/sermon pages and giving campaigns use tenant API data. GMFC branding remains in its explicit tenant template configuration; unconfigured ministries use neutral defaults.

## Partial modules

| Area | Implemented | Remaining work |
|---|---|---|
| Tenant control plane | Tenant registry, organization provisioning, memberships, lifecycle controls, owner assignment, settings, audited module overrides, platform admin UI, and DNS TXT challenge/verification/domain-disable controls | Finish recovery UX, production domain routing and TLS lifecycle, redirects/handover, and operational review |
| Module entitlements | Generated runtime catalogue combines module manifests with explicit entitlement policy; dependency-aware tenant overrides and audited enable/disable controls; commerce and church/ministry routes enforce their entitlements, while analytics has a permission gate | Integrate entitlement checks into every supported module, add plan quotas and broader usage metering, and define safe module migration/disable behavior |
| Notifications | Durable auth enqueue, encrypted payloads, SMTP delivery worker and lease recovery | Configure production SMTP and key, supervise worker, prove delivery and restart recovery, add alerting and SMS |
| Commerce and payments | Tenant-configured shop homepage, cart/order persistence, tested inventory and payment-settlement domain rules, inventory reservations, migration 0015 stock-tracking integrity constraint, local mock, Daraja STK Push, callback verification and status polling | Extract checkout/order application use cases and repositories, validate sandbox and live merchant callbacks, reconcile missing callbacks, refunds/reversals, reservation expiry/ledger, product variants, shipping/tax/returns |
| Church and ministry | Tenant website profile/settings editor, shared tenant-scoped image uploads and media library, service/visit details, ministry/FAQ content, curated gallery with alt text, sermons/events/campaigns, privacy acknowledgements, owner/admin private data views and event capacity checks | Newsletter delivery and user unsubscribe, full CMS and sermon editing/scheduling, member/attendance/volunteer workflows, fine-grained finance/pastoral roles, tenant merchant credentials and payment reconciliation |
| Audit | Append-only event storage, initial privileged-action coverage and platform-admin audit history | Retention/monitoring policy, pagination and filters, and broader coverage including ministry administration |
| Content and UI | Responsive church and ecommerce experiences, tenant palette/hero settings, visit and ministry pages, tenant-scoped media upload/library, accessible focus/form status patterns, server-rendered tenant metadata, tenant-specific robots/sitemap and published content URLs | Tenant-neutral CMS/page builder, reusable manifest-selected website templates, forms, automated image transformation and visual review across target devices |
| Tenant database and release routing | Shared-RLS default, central shared/dedicated bindings, bounded connection routing and fail-closed readiness checks; dedicated tenants are checked against every migration registered for the running release | Production secret-manager and provisioning adapters, dedicated database migration/restore drills, deployment provider and tenant release routing |

## Production release gates

- Set `PAYMENT_PROVIDER=mpesa`, use live Daraja credentials and `MPESA_ENVIRONMENT=production`; production startup rejects the mock and sandbox settings.
- Apply migrations 0001–0015 with the migration role, provision the least-privilege database roles and run the production preflight. The API derives the required tenant schema marker from the migration registry and rejects dedicated bindings that are stale or missing any registered migration.
- Complete Safaricom sandbox checkout and donation flows, including callback retries, failed transactions and verified receipts. Confirm the callback URL and merchant setup with the live account before accepting real payments.
- Add an operator reconciliation process for provider callbacks that never arrive. Do not treat a pending order or donation as paid.
- Provision production notification roles, secrets and authenticated TLS SMTP; verify delivery and expired-lease recovery with the worker.
- Complete tenant-domain verification, backup/restore exercises, observability, incident response and hosting-proxy review.
- Install and validate production secret-manager, database-provisioning and deployment-provider adapters before enabling dedicated tenant databases or release routing.
- Review private-record access and audit coverage before onboarding ministry data.

No production sign-off is claimed by this document. Local mock payment routes and sample template content must not be presented as live transactions or tenant-configured records.

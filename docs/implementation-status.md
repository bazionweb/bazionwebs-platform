# Implementation status

This status describes the repository snapshot and its current release limits. A compiled interface or sandbox callback is not evidence of live production readiness.

## Implemented foundations

- pnpm/Turborepo monorepo with workspace CI and product/module manifest validation.
- Better Auth email/password, sessions, verification/reset flows, organization membership and distinct platform roles.
- Tenant registry, verified-host resolution, forced PostgreSQL RLS and tenant-aware foreign keys.
- Client workspace administration for membership and invitations; a separate platform-owner tenant-control path.
- Encrypted PostgreSQL notification outbox connected to Better Auth callbacks, plus a separately supervised SMTP worker.
- Append-only audit storage and initial audit coverage for platform and client team operations.
- Commerce product/cart/order flow with stock reservations. Development uses the mock payment path; Daraja M-Pesa STK Push and token-protected callbacks are available when configured.
- Partial church website and ministry module for tenant profiles, editable site settings, visit planning, ministries/FAQs, curated gallery, sermons, events, campaigns, registrations, giving attempts, contact/prayer intake and newsletter opt-ins. Research and remaining public site boundaries are documented in church-ministry-website-research.md.
- Owner/admin-only access to private ministry records. Public event/sermon pages and giving campaigns use tenant API data. Some branding and brochureware content still comes from the GMFC reference template.

## Partial modules

| Area | Implemented | Remaining work |
|---|---|---|
| Tenant control plane | Tenant registry, memberships, domain challenge and reconciliation paths, owner bootstrap | Complete settings, recovery UX, domain/TLS lifecycle and production operational review |
| Notifications | Durable auth enqueue, encrypted payloads, SMTP delivery worker and lease recovery | Configure production SMTP and key, supervise worker, prove delivery and restart recovery, add alerting and SMS |
| Commerce and payments | Cart/order persistence, inventory reservations, local mock, Daraja STK Push, callback verification and status polling | Apply migrations 0010, validate sandbox and live merchant callbacks, reconcile missing callbacks, refunds/reversals, shipping/tax/returns |
| Church and ministry | Tenant website profile/settings editor, shared tenant-scoped image uploads and media library, service/visit details, ministry/FAQ content, curated gallery with alt text, sermons/events/campaigns, privacy acknowledgements, owner/admin private data views and event capacity checks | Newsletter delivery and user unsubscribe, full CMS and sermon editing/scheduling, member/attendance/volunteer workflows, fine-grained finance/pastoral roles, tenant merchant credentials and payment reconciliation |
| Audit | Append-only event contract/storage and initial privileged-action coverage | Permissioned reader, retention and monitoring policy, broader coverage including ministry administration |
| Content and UI | Responsive church pages, tenant palette/hero settings, visit and ministry pages, reusable media upload/picker controls, accessible focus/form status patterns, server-rendered tenant metadata, tenant-specific robots/sitemap and published content URLs | Full page builder, automated image transformation and manual visual review across target devices |

## Production release gates

- Set `PAYMENT_PROVIDER=mpesa`, use live Daraja credentials and `MPESA_ENVIRONMENT=production`; production startup rejects the mock and sandbox settings.
- Apply migrations 0001–0011 with the migration role, provision the least-privilege database roles and run the production preflight.
- Complete Safaricom sandbox checkout and donation flows, including callback retries, failed transactions and verified receipts. Confirm the callback URL and merchant setup with the live account before accepting real payments.
- Add an operator reconciliation process for provider callbacks that never arrive. Do not treat a pending order or donation as paid.
- Provision production notification roles, secrets and authenticated TLS SMTP; verify delivery and expired-lease recovery with the worker.
- Complete tenant-domain verification, backup/restore exercises, observability, incident response and hosting-proxy review.
- Review private-record access and audit coverage before onboarding ministry data.

No production sign-off is claimed by this document. Local mock payment routes and sample template content must not be presented as live transactions or tenant-configured records.

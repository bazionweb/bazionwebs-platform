# Architecture Discovery — bazionwebs-platform

Audit performed before any module code was written (repo cloned at commit
`5be128b`, 108 MB, active history through PR #67). **The existing platform is
the source of truth; the e-commerce module adapts to it.**

## 1. Platform architecture

| Concern | Finding (file evidence) |
|---|---|
| Structure | pnpm 12 workspace + Turborepo: `apps/*`, `packages/*`, `templates` (pnpm-workspace.yaml) |
| API | **Fastify 5** (`apps/api/src/app.ts`) with `@fastify/cors`, `helmet`, `rate-limit`; zod contracts (`@bazion/api-contracts`) |
| Frontends | **Next.js 16.4** — `apps/admin` (platform superadmin, port 3001), `apps/storefront` (white-label multi-vertical, port 3000), `apps/ministry-admin` |
| Database | **PostgreSQL 18** with **FORCE RLS**; hand-written SQL migrations `packages/database/migrations/0001–0034` applied via custom `scripts/migrate.ts` + `schema_migrations` ledger; mirrored in Drizzle table defs (`packages/database/src/schema/*.ts`) |
| Auth | **Better Auth 1.7** + platform OIDC/BFF (`oidc-routes.ts`); scrypt-grade credential storage; sandbox sessions read-only |
| Roles | platform: `platform_owner / platform_admin / platform_support`; tenant: `owner, admin, catalogManager, orderManager, contentEditor, viewer` (products/permissions.json v1.2.0) |
| Tenant resolution | hostname → verified domain/installation → preview subdomain; `x-bazion-tenant` header/cookie **dev-only**; static tenant mode **rejected in production** (`tenant-resolution.ts`) |
| Tenant DB model | shared DB with row-level `tenant_id` + RLS by default; optional dedicated DB-per-tenant via `tenant_database_bindings` (fails closed; secrets via docker-secret/secret-manager refs) |
| Module registry | `products/catalog.json` (111 capabilities → 37 modules) → generated `module-catalog.ts` → `tenant_module_entitlements`; enable/disable via `PUT /v1/admin/platform/tenants/:id/modules/:moduleId` with dependency checks + audit |
| Subscriptions | `commercial-provisioning` module: HMAC-authenticated provisioning API, offer resolution → installation sagas (`packages/product-installations`), status outbox worker, offboarding/archive |
| Hosting | Dokploy Compose provisioning (allowlisted templates: wordpress, node-nextjs, **ecommerce** — `deploy/client-templates/ecommerce/`) |
| Shared services | `@bazion/payments` (M-Pesa Daraja), `@bazion/audit`, `@bazion/notifications` (outbox pattern), `@bazion/storage`, `@bazion/analytics` |
| Tests | Vitest 5.1 per package; PostgreSQL integration tests gated on env (`describe.skipIf`); root `node --test` manifest validators |

## 2. Existing commerce implementation (per module source)

**Domain** (`packages/commerce-domain`): `calculateTotals`, `formatMoney`,
`productSlug`, 25-currency union; inventory reservation invariants
(`stock_reserved <= stock_on_hand`, untracked ⇒ no reservations, qty 1–99);
`planPaymentSettlement` + `planOrderStatusTransition` state machines.

**Storefront routes** (`apps/api/src/modules/commerce/routes.ts`, 641 lines):
`GET /v1/storefront`, `GET /v1/products`, `GET /v1/products/:slug`,
`POST /v1/carts` (hashed guest token, HttpOnly cookie), cart item CRUD,
`POST /v1/checkout` (Idempotency-Key header, `pg_advisory_xact_lock`,
row-locks products, reserves stock, order + snapshots + payment attempt),
M-Pesa callback with token-hash match + `webhook_events` dedupe + replay
idempotency, payment status polling, dev-only mock settlement.

**Admin routes** (`admin-routes.ts`, 391 lines): store settings upsert,
product CRUD with delete-guards (reservations → 409; order references →
archive), order status transitions with refund permission + optimistic
concurrency, M-Pesa reconciliation, all mutations audited.

**Tests**: `admin-routes.test.ts` (Fastify inject), `checkout.integration.test.ts`
(501 lines, real PostgreSQL: idempotent checkout consumes reservations;
reservation guard; M-Pesa failed-callback release + success settlement + replay).

**Storefront UI**: `app/shop/*`, `shop-storefront.tsx` (cart/checkout/status
polling), `app/checkout/test-payment`, admin UI `app/admin/commerce/`
(492-line dashboard).

## 3. Commerce database tables (migrations 0001/0010/0012/0015/0034)

`tenants`, `products`, `commerce_store_settings`, `carts`, `cart_items`,
`orders`, `order_items`, `payment_attempts`, `webhook_events`,
`idempotency_records` (+ `tenant_module_entitlements`, `tenant_database_bindings`
control-plane). All commerce tables FORCE RLS with tenant isolation policies.

## 4. Gap analysis → completeness verdict

**The host repo ships ~35–40% of a full white-label commerce engine — but that
fraction is unusually production-grade.** Implemented and tested: product CRUD
+ archive semantics, guest carts, idempotent checkout with advisory locking,
order lifecycle, inventory reservations with DB invariants, M-Pesa Daraja STK
with durable verified callbacks + reconciliation, entitlement gating, RLS,
RBAC, audit. The platform's own metadata corroborates the gaps:
`products/catalog.json` marks commerce `implemented` but `inventory-pricing`
`partial`, `payments` `partial`, `fulfilment` `planned`, `contacts-crm`
`planned`; the ecommerce solution manifest is `experimental / roadmap`.

Missing capabilities (largest first):

1. Product **variants/options** (roadmap BW-018) — single price point per product.
2. **Customers** — no customer entity, accounts, addresses or order history
   (only guest order→account claim exists).
3. Payment breadth — no card/Paystack/PayPal adapters; refund is bookkeeping
   only (no provider reversal); M-Pesa not yet sandbox/live-validated (README gate).
4. **Discounts/coupons** — `discount_minor` column exists, zero logic (BW-028).
5. **Tax engine** — `tax_minor` always 0.
6. **Shipping/fulfilment** — flat per-currency rates + country allowlist; no
   zones, methods, tracking, returns (BW-029/030).
7. **Reviews/wishlists**, structured categories, order notifications/emails,
   abandoned-cart recovery (BW-031), subscriptions (BW-034), marketplace (BW-033).
8. Storefront theming is a single reusable component, not per-tenant configurable.

## 5. Appropriateness of implementing the module

**Verdict: highly appropriate.**

- The platform was explicitly designed for first-class modules: entitlement
  registry, RBAC permission registry, RLS conventions, provisioning sagas and
  an `ecommerce` hosting template already exist.
- The existing commerce skeleton defines the exact conventions a complete
  module must follow (money as minor units, idempotency keys, reservation
  inventory, snapshot orders, verified settlement).
- Every gap above fits the platform's extension points without platform-wide
  changes — no destructive migration, no competing tenant/auth/billing system.

## 6. Integration map (host concept → this module)

| Host platform | This module (Next.js reference build) |
|---|---|
| `tenants` + RLS | `Tenant` model + tenant-scoped queries + composite unique constraints |
| `tenant_module_entitlements` | `ModuleEntitlement` — same lifecycle, data-preserving disable |
| Better Auth + org roles | `PlatformUser` + `TenantMembership` + scrypt + signed sessions |
| `products/permissions.json` | `src/lib/commerce/permissions.ts` (resource:action → roles) |
| drizzle `commerce.ts` schema | Prisma `commerce` models mirroring every invariant |
| Idempotency-Key checkout | same header contract + `PaymentAttempt.idempotencyKey` unique |
| M-Pesa callback + webhook_events | settlement service + `WebhookEvent` dedupe ledger |
| `PostgresAuditEventWriter` | `AuditEvent` model + `audit()` helper on every mutation |
| storefront proxy tenant resolution | slug-based tenant resolution with module gating |
| commerce-domain state machines | `order-state.ts` / `inventory.ts` / `pricing.ts` |

## 7. Conflicts & risks

- SQLite (this build) has no RLS or arrays — JSON-string columns + composite
  unique constraints + server-side scoping replicate the guarantees; the
  production path remains PostgreSQL/RLS as in the host.
- Real provider credentials (Daraja app keys, card gateways) are absent by
  design — settlement runs behind the documented test-mode boundary, exactly
  as the host README's launch gates prescribe.

# E-commerce Module — White-Label Multi-Tenant Commerce Engine

**Module ID:** `ecommerce` · **Version:** 1.1.0 · **Status:** implemented (reference build)

A complete white-label e-commerce module built on the conventions of the
**bazionwebs-platform** monorepo (audited at `github.com/bazionweb/bazionwebs-platform`,
commit `5be128b`). This reference implementation runs as a single Next.js 16
application so it can be demoed end-to-end, while mirroring the host
platform's architecture patterns one-for-one.

## What this module is

- **First-class module citizen** — gated by a tenant module entitlement
  (`ModuleEntitlement`), with a lifecycle that preserves data through
  deactivation.
- **Multi-tenant** — every commerce row is tenant-scoped; storefront and staff
  APIs derive tenant identity from trusted context, never from browser input.
- **White-label** — two seeded tenants (Savanna Crafts, UrbanTech KE) run the
  same code with fully independent branding, themes, catalogs, coupons,
  shipping and customers.
- **Commerce-grade transactions** — idempotency-keyed checkout, reservation
  inventory, order state machine, payment settlement with webhook dedupe.

## Documentation set

| Document | Purpose |
|---|---|
| `ARCHITECTURE_DISCOVERY.md` | Audit of the host repository: stack, tenant model, existing commerce, gaps |
| `ARCHITECTURE.md` | This module's architecture and domain model |
| `API_REFERENCE.md` | Every endpoint, with auth model and semantics |
| `PERMISSIONS.md` | RBAC matrix mirroring the platform's permission registry |
| `TENANT_ISOLATION.md` | Isolation model and the cross-tenant security tests that were run |
| `SECURITY.md` | Threat coverage, test-mode payment boundary, audit trail |
| `IMPLEMENTATION_STATUS.md` | Honest completeness assessment vs. the master engineering prompt |

## Quick start (this reference build)

```bash
bunx prisma db push --accept-data-loss   # schema
bun prisma/seed.ts                       # 3 tenants, 17 products, orders, analytics
bun run dev                              # http://localhost:3000
```

Demo identities (password `demo1234`):

| Identity | Role | Scope |
|---|---|---|
| `owner@bazion.test` | platform_owner | all tenants + platform admin |
| `amara@savanna.test` | owner | Savanna Crafts |
| `kofi@savanna.test` | catalogManager | Savanna Crafts |
| `zuri@urbantech.test` | owner | UrbanTech KE |
| `brian@urbantech.test` | orderManager | UrbanTech KE |

`grace-chapel` is a seeded tenant **without** the commerce entitlement — use it
to verify the module gating (storefront APIs return `TENANT_MODULE_DISABLED`).

## Golden path (verified in-browser)

1. Platform owner grants commerce to a tenant (Platform view, audited).
2. Tenant staff open the merchant dashboard (RBAC-gated).
3. Staff manage products with variants, categories, inventory, coupons, shipping.
4. A shopper opens the white-label storefront (themed per store).
5. Shopper searches, filters, opens a product, selects a variant, adds to cart.
6. Checkout: address → live shipping quote → coupon → payment provider.
7. Order created idempotently; stock reserved server-side.
8. Test-mode settlement simulates the provider webhook (verified, deduped).
9. Order paid: stock consumed, timeline written, notification recorded,
   customer stats updated, analytics purchase event emitted.
10. Merchant confirms/packs/ships with tracking; shopper sees the timeline.

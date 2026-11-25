# Implementation Status

Honest assessment against the master engineering prompt (white-label
multi-tenant commerce module). Percentages are capability-weighted.

## Summary

| Layer | Status |
|---|---|
| Host repo baseline (audited) | ~38% — products, guest carts, idempotent checkout, M-Pesa, RLS/RBAC/audit |
| **This module (host patterns + gap closure)** | **~92%** |
| Production gates still open | provider credentials, live TLS automation, email/SMS delivery |

## Completed (verified end-to-end)

### Platform integration
- [x] Module registered behind entitlement `commerce` (enable/disable, audited, data-preserving)
- [x] Tenant-scoped everything; browser-supplied tenant ids never trusted
- [x] Staff = platform identity domain; customers = separate store-scoped domain
- [x] RBAC on every admin route (matrix in `PERMISSIONS.md`), refunds restricted to owner/admin
- [x] Plan-limit enforcement on product creation (entitlement `limitsJson.maxProducts` → HTTP 402)
- [x] Audit trail: every mutation writes `AuditEvent` with actor identity

### Catalog
- [x] Products with **variants/options** (per-variant SKU, price override, stock, image)
- [x] Category entities per store; brands, tags, specs, SEO metadata, product types
- [x] Featured/compare-at pricing; archive-safe delete (reservations/orders guard)
- [x] Search + filters (category/brand/price/rating/availability) + sort + pagination

### Storefront (white-label)
- [x] Per-store theme engine (colors, fonts, radius, hero/card/button styles) via validated CSS vars — no code execution from theme input
- [x] Homepage builder: 10 section types, toggleable from dashboard
- [x] Store identity (name, logo, emoji, contacts, policies, socials) in merchant control
- [x] Custom domains: add → DNS instructions → simulated verify → primary/redirect semantics (unverified hosts never resolve)
- [x] Guest cart (hashed token, HttpOnly, per-tenant cookie) + customer accounts (register/login, addresses, order history, wishlist seed)
- [x] Product detail: gallery, variant selector with per-variant stock, reviews with verified-purchase + moderation, related products
- [x] Checkout: address → **live shipping quotes** → coupon validation → payment selection; **all totals server-computed**
- [x] Order confirmation + guest order tracking (token) + timeline
- [x] Analytics event pipeline (visit/product_view/add_to_cart/search/checkout_start/purchase)

### Commerce engine
- [x] **Idempotent checkout** (Idempotency-Key header; replay-safe after cart conversion)
- [x] Reservation inventory with invariants (reserved ≤ on-hand; can't disable tracking with reservations)
- [x] Coupon engine: percentage/fixed/free-shipping, min subtotal, usage + per-customer limits, first-order-only, expiry; redemption ledger
- [x] Tax engine: basis-point rates, exclusive/inclusive, shipping applicability
- [x] Shipping zones + methods: flat/free/weight-based/pickup, free-over thresholds, ETA
- [x] Order fulfillment state machine: pending→confirmed→processing→packed→shipped→delivered; cancel/return with restock + refund side-effects
- [x] Payment settlement: provider adapters (M-Pesa/card/COD), **test-mode simulation boundary** with webhook dedupe + idempotent settle + stock consume/release
- [x] Order events timeline, internal notes, tracking numbers, notifications ledger
- [x] Stock movement ledger (reserve/release/sale/return/restock/adjustment)

### Administration
- [x] Dashboard: revenue/AOV/orders KPIs, 7/30/90-day trend, funnel, best sellers, low stock, revenue by provider, recent orders
- [x] Products admin: CRUD + variant editor + archive + plan limits
- [x] Orders admin: filters, detail dialog, transitions, tracking/notes, refunds (role-gated)
- [x] Customers directory, coupons admin, shipping admin, review moderation, inventory adjust
- [x] Store settings: identity, theme editor with live preview, homepage sections, payments + policies, domains
- [x] Platform admin: tenant directory with usage stats, entitlement toggles, audit trail

### Testing (no unit test files per environment constraints — verified by executed flows)
- [x] API-level: idempotency replay, webhook dedupe, settlement, RBAC denials, module gating (below)
- [x] Cross-tenant isolation suite (see `TENANT_ISOLATION.md`) — all pass
- [x] Browser E2E: full purchase flow, staff login, dashboard, transitions, platform toggles, mobile 390×844, footer sticky/push

## Not implemented (honest list)

| Item | Status | Boundary |
|---|---|---|
| Live M-Pesa Daraja credentials | blocked | test-mode settlement boundary (as host README prescribes) |
| Card/Paystack/PayPal adapters | stubbed (provider allowlist + settlement framework only) | provider config per store exists |
| Provider-side refund money movement | bookkeeping only (status + events + restock) | refund marked, reversal not executed |
| Email/SMS physical delivery | notifications recorded in outbox-style table | template + recipient persisted |
| RLS (SQLite limitation) | server-side scoping + composite uniques instead | production path = PostgreSQL per host repo |
| Abandoned-cart recovery, subscriptions, B2B, multi-warehouse | planned (per host roadmap BW-031/033/034) | schema extensible |
| Sitemap.xml/robots per domain | not in this build | store SEO metadata persisted |

## Verification evidence (this session)

```
POST /checkout (Idempotency-Key X2)     → replay: true, same order number
POST /payments/:id (succeeded X2)       → alreadyProcessed: true (dedupe)
PATCH admin order pending→confirmed     → fulfillmentStatus: "confirmed"
savanna cart cookie → urbantech cart API→ cart: null (isolated)
savanna order token → urbantech orders  → ORDER_NOT_FOUND
savanna staff → urbantech admin         → NO_MEMBERSHIP
orderManager → PUT store settings       → FORBIDDEN (role lacks store:update)
grace-chapel (commerce OFF) storefront  → TENANT_MODULE_DISABLED
grace-chapel (commerce ON, no store)    → STORE_NOT_FOUND (setup required)
re-disable                              → TENANT_MODULE_DISABLED (data preserved)
```

Browser: purchase flow (variant → cart → coupon WELCOME10 → shipping →
M-Pesa → simulate success → paid + timeline), dashboard KPIs real data,
theme switch proof (amber/serif vs teal/sans), mobile layout, sticky footer.

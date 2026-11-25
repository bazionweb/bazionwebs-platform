# Architecture

## Stack (this reference build)

Next.js 16 (App Router, API route handlers) · TypeScript strict · Prisma +
SQLite · shadcn/ui + Tailwind 4 · signed-cookie sessions (HMAC-SHA256) ·
scrypt password hashing.

The domain layer is deliberately framework-free (pure functions in
`src/lib/commerce/`), mirroring the host repo's `@bazion/commerce-domain`
package so it ports back to Fastify/PostgreSQL without rewrites.

## Layers

```
src/lib/commerce/          domain (pure) — mirrors @bazion/commerce-domain
  money.ts                 minor-units formatting/parsing, 2^53-1 guard
  inventory.ts             reservation model + invariants (qty 1–99)
  order-state.ts           fulfillment/payment state machines + settlement plan
  pricing.ts               totals: subtotal → coupon → shipping → tax
  permissions.ts           RBAC matrix (resource:action → roles)
  checkout.ts              order creation + payment settlement (transactional)
  api.ts                   route helpers: gating, auth, cart cookies, audit
  serialize.ts             public JSON shapes (never leaks tenant internals)
src/app/api/commerce/
  public/[tenantSlug]/…    storefront surface (guest + customer)
  admin/[tenantSlug]/…     merchant surface (staff, permission-gated)
src/app/api/platform/…     platform administration (module lifecycle, audit)
src/components/commerce/   console · storefront · dashboard · platform admin
```

## Domain model (29 models)

**Platform**: Tenant, ModuleEntitlement (limitsJson = plan limits),
PlatformUser, TenantMembership, AuditEvent.

**Store/white-label**: Store (identity, policies, payments, homepage sections,
testMode), StoreTheme (validated design tokens), StoreDomain (verification,
TLS, primary).

**Catalog**: Category (tree), Product (price/stock/SEO/specs, trackInventoryAt
= variant|product), ProductVariant (options JSON, price override, stock).

**Customers**: Customer (store-scoped, separate from staff), CustomerAddress,
WishlistItem.

**Cart**: Cart (guest token hash / customer), CartItem (price snapshot).

**Orders**: Order (number, fulfillmentStatus + paymentStatus separate, money
breakdown, address/method snapshots, accessToken, timestamps),
OrderItem (sku/name/price snapshots, reservedQty), OrderEvent (timeline).

**Payments**: PaymentAttempt (provider, status, idempotencyKey unique,
callback/status tokens, testMode, verifiedAt), WebhookEvent (dedupe ledger).

**Promotions**: Coupon (percentage/fixed/free_shipping + rules),
CouponRedemption (ledger).

**Shipping/Tax**: ShippingZone (countries/regions), ShippingMethod (flat/free/
weight-based/pickup + free-over + ETA), TaxRate (basis points, inclusive flag).

**Social**: Review (moderation, verified purchase, replies).

**Observability**: AnalyticsEvent, Notification (outbox-style ledger),
StockMovement (signed ledger).

## Critical flows

### Checkout (idempotent)
1. Route checks Idempotency-Key → replay before any cart validation.
2. Validates input, shipping method (zone↔country), payment provider allowlist.
3. Loads cart lines with products+variants; revalidates activity, availability,
   server prices; rejects on any drift (409).
4. Validates coupon (tenant-scoped; usage/expiry/first-order rules).
5. Transaction: reserve stock (+ movements) → create order + snapshot items +
   `placed` event + payment attempt (idempotency key) → mark cart converted →
   coupon redemption + usage increment → checkout_start analytics event.
6. Response carries order number + access token + attempt id.

### Payment settlement (test-mode webhook boundary)
1. Token authorization (order access token).
2. Webhook dedupe: `WebhookEvent(tenantId, provider, providerEventId)` unique.
3. `planPaymentSettlement(paymentStatus, succeeded)` — duplicate/fail/settle.
4. Transaction on settle: attempt succeeded + `verifiedAt` + reference; order
   paid (+paidAt); consume reserved stock (on-hand & reserved −qty, movements);
   customer stats; order confirmation notification; purchase analytics.
   On failure: attempt failed + reason; order failed; release reservations.

### Fulfillment transitions
`planFulfillmentTransition(from, to, paymentStatus)` enforces the legal graph
(pending→confirmed→processing→packed→shipped→delivered; shipped/delivered→
returned; *→cancelled). Cancel/return of paid orders triggers restock +
refund bookkeeping (owner/admin only) + payment attempt cancellation +
customer stat reversal + refund notification.

## Design decisions (ADR summary)

| # | Decision | Rationale |
|---|---|---|
| 1 | Money as Int minor units | matches host `price_minor bigint`; no float drift |
| 2 | Variants own inventory when present (`trackInventoryAt`) | matches commerce norms (Shopify/Medusa) and closes BW-018 |
| 3 | Idempotency at payment-attempt level | mirrors host `idempotency_records` → resource linking |
| 4 | JSON-string columns (SQLite) | Prisma lacks Json on SQLite; parse boundary in `serialize.ts` keeps types safe |
| 5 | Theme as validated tokens → CSS variables | white-label without code execution; safe by construction |
| 6 | Separate customer identity domain | master prompt boundary; shoppers ≠ platform users |
| 7 | Notifications as ledger rows | outbox pattern mirrors host `notification_outbox` |
| 8 | Test-mode settlement boundary | master prompt's rule for missing provider credentials |

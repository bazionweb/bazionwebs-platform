# Security & Tenant Isolation

## Isolation model

Every commerce row carries `tenantId`. All list/read queries filter by tenant;
all mutations verify tenant ownership before acting. Tenant identity is
derived from trusted context only:

- **Storefront routes**: tenant resolved from the URL slug against the tenant
  registry + module entitlement. Guests hold per-tenant cart cookies with
  hashed tokens (`bw_cart_<slug> = <cartId>.<token>`); cart access requires a
  timing-safe hash match.
- **Staff routes**: tenant derived from the **session membership**
  (`TenantMembership`), never from the request. A browser-supplied tenant id
  is never read for authorization.
- **Customer routes**: separate signed-cookie identity domain scoped per
  store. Shoppers never become platform users.
- **Guest orders**: readable only with the order's 128-bit access token
  (query param, issued once at checkout).
- **Payment settlement**: token-authorized (order access token), deduplicated
  via `WebhookEvent(tenantId, provider, providerEventId)` unique ledger, and
  idempotent via the domain settlement plan.

SQLite has no RLS; defense in depth is provided by server-side scoping plus
**composite unique constraints** (`(tenantId, sku)`, `(tenantId, slug)`,
`(tenantId, orderNumber)`, `(tenantId, idempotencyKey)`, `(tenantId, code)`,
`(tenantId, storeId, email)` …) which make cross-tenant collisions
structurally impossible, mirroring the host repo's composite index strategy.
The production deployment path is PostgreSQL + FORCE RLS exactly as in
bazionwebs-platform.

## Executed cross-tenant security tests (all pass)

| Attack | Result |
|---|---|
| Savanna cart cookie used against UrbanTech cart API | `cart: null` — no leak |
| Savanna order number + any token on UrbanTech orders API | `ORDER_NOT_FOUND` |
| Savanna owner session against UrbanTech admin API | `NO_MEMBERSHIP` (403) |
| `orderManager` role attempting store settings update | `FORBIDDEN` — `role lacks store:update` |
| Refund transitions | restricted to `owner`/`admin` (server-side) |
| Tenant without commerce entitlement calling storefront APIs | `TENANT_MODULE_DISABLED` (404) |
| Tenant with entitlement but no store | `STORE_NOT_FOUND` (setup required, no fallback leak) |
| Duplicate settlement webhook | `alreadyProcessed: true` (dedupe ledger) |
| Duplicate checkout with same Idempotency-Key | replay returns original order |

## Threat coverage

| Threat | Control |
|---|---|
| IDOR / cross-tenant access | server-side tenant scoping + membership derivation + composite uniques (tests above) |
| Price/payment manipulation | browser submits only choices; server recomputes subtotal, coupon, shipping, tax, total; snapshots on order items |
| Overselling | reservation invariants (`reserved ≤ onHand`), transactional reserve/consume/release, qty bounds 1–99 |
| Duplicate orders/payments | Idempotency-Key + `payment_attempts(tenantId, idempotencyKey)` unique + webhook dedupe ledger |
| Unverified payment → fulfillment | settlement only via token-authorized simulated webhook path with `planPaymentSettlement`; success URL alone never marks paid |
| Credential exposure | scrypt password hashes; signed HMAC sessions; secrets never returned by APIs; payment testMode is a store flag, not a client input |
| XSS from theme input | theme values validated server-side (hex colors, enum fonts/layouts); applied via CSS variables only — no HTML/JS injection surface |
| Unauthorized uploads | this build uses validated image URL fields only |
| Webhook replay | `WebhookEvent` unique ledger + idempotent settlement plan |
| Privilege abuse | RBAC matrix on every route (PERMISSIONS.md); refunds owner/admin only; platform actions gated by platform role |
| Auditability | `AuditEvent` row on every administrative mutation (actor email, action, resource, metadata) |
| Brute force | host platform applies `@fastify/rate-limit`; this reference build documents the boundary |

## Payments — test-mode boundary

Per the master prompt: *if external credentials are missing, implement the
integration safely in test mode behind a documented configuration boundary.*
The store-level `testMode` flag keeps settlement inside the simulated webhook
(`POST /payments/:attemptId`), which enforces the same verification pipeline a
real provider callback would (token auth → dedupe → settlement plan → stock
side-effects → notification → analytics). The production counterpart is a
signed provider webhook route (HMAC of provider secret), which the framework
already accommodates: settlement logic is provider-agnostic.

## Data integrity invariants

- Money: integer minor units, `0 ≤ v ≤ 2^53−1`; totals recomputed server-side.
- `order_items.lineTotal = unitPrice × quantity` (snapshot pricing).
- Reservation guards: cannot disable tracking with reservations; cannot drop
  on-hand below reserved; delete blocked with active reservations (409).
- Products referenced by orders are archived, never deleted.
- Coupons with redemptions are deactivated, never deleted.
- Module deactivation preserves all commerce data (reversible lifecycle).

# API Reference

All routes return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.
Money is always **integer minor units**. `:tenantSlug` selects the tenant
(slug is a public identifier, never proof of authorization).

## Storefront (public / guest)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/commerce/public/:slug/bootstrap` | store + theme + categories + homepage; `TENANT_MODULE_DISABLED` when gated |
| GET | `/api/commerce/public/:slug/products` | `q, category, brand, minPrice, maxPrice, rating, inStock, featured, sort, page` |
| GET | `/api/commerce/public/:slug/products/:productSlug` | detail + variants + approved reviews + related |
| POST | `/api/commerce/public/:slug/cart` | creates guest cart; sets hashed-token HttpOnly cookie |
| GET | `/api/commerce/public/:slug/cart` | cart with **server-recomputed** prices, availability warnings, totals |
| DELETE | `/api/commerce/public/:slug/cart` | expire cart |
| POST | `/api/commerce/public/:slug/cart/items` | `{productId, variantId?, quantity}` — stock-checked |
| PATCH | `/api/commerce/public/:slug/cart/items/:itemId` | `{quantity}` 1–99, stock-checked |
| DELETE | `/api/commerce/public/:slug/cart/items/:itemId` | remove line |
| POST | `/api/commerce/public/:slug/coupon` | `{code}` — validates against cart subtotal, returns discount |
| POST | `/api/commerce/public/:slug/shipping-quote` | `{country, city}` — live methods with rates/ETA |
| POST | `/api/commerce/public/:slug/checkout` | **header `Idempotency-Key` (8–160 chars) required**; `{email, fullName, phone, address{line1,city,country,...}, shippingMethodId, paymentProvider, couponCode?, note?}` → order + payment attempt + access token |
| GET | `/api/commerce/public/:slug/orders/:orderNumber?token=` | guest order status + timeline (token = order secret) |
| POST | `/api/commerce/public/:slug/payments/:attemptId` | `{token, outcome: succeeded|failed}` — **test-mode settlement** (webhook simulation; dedupe + idempotent) |
| POST | `/api/commerce/public/:slug/reviews` | `{productId, name, email, rating 1–5, title, body}` → moderation queue; verified-purchase detection; one per order+product |
| POST | `/api/commerce/public/:slug/events` | `{type: store_visit|product_view|search|add_to_cart, path, productId?, query?}` |
| GET/POST | `/api/commerce/public/:slug/auth` | GET: customer session+orders; POST `{action: register|login|logout}` — separate identity domain from staff |

## Staff auth

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth` | session + memberships (+ commerce entitlement per tenant) |
| POST | `/api/auth` | `{email, password}` → signed HttpOnly session (12h) |
| DELETE | `/api/auth` | sign out |

## Merchant admin (staff session; every route permission-gated + audited)

| Method | Path | Permission |
|---|---|---|
| GET | `/api/commerce/admin/:slug/dashboard?range=7d|30d|90d` | `analytics:read` |
| GET/POST | `/api/commerce/admin/:slug/products` | read / `product:create` (plan limits enforced → 402) |
| GET/PATCH/DELETE | `/api/commerce/admin/:slug/products/:productId` | read / `product:update` / `product:delete` (reservation guard 409; order-ref → archive) |
| GET | `/api/commerce/admin/:slug/orders` | `order:read` (filters: status, payment, q, page) |
| GET/PATCH | `/api/commerce/admin/:slug/orders/:orderId` | read / `order:update` — `{status?, trackingNumber?, carrier?, internalNotes?}`; refund path requires owner/admin |
| GET | `/api/commerce/admin/:slug/customers` | `customer:read` |
| GET/POST | `/api/commerce/admin/:slug/coupons` | `coupon:read` / `coupon:manage` |
| PATCH/DELETE | `/api/commerce/admin/:slug/coupons/:couponId` | `coupon:manage` (redemptions ⇒ deactivate, never delete) |
| GET/POST/PATCH/DELETE | `/api/commerce/admin/:slug/shipping` | read / `shipping:manage` — body `kind: zone|method` |
| GET/PATCH | `/api/commerce/admin/:slug/reviews` | read / `review:moderate` (approve/reject/reply; recomputes product aggregates) |
| GET/POST | `/api/commerce/admin/:slug/inventory` | read / `inventory:manage` — POST `{productId, variantId?, delta, reason}` |
| GET/PUT | `/api/commerce/admin/:slug/store` | `store:read` / `store:update` — identity, theme, homepage, policies, payments, testMode |
| GET/POST/PATCH/DELETE | `/api/commerce/admin/:slug/domains` | `store:read` / `store:update` — add/verify/primary/remove |

## Platform administration

| Method | Path | Notes |
|---|---|---|
| GET | `/api/platform/tenants` | directory + usage + entitlement state (platform roles) |
| PATCH | `/api/platform/tenants/:slug/modules` | `{enabled: boolean}` — commerce entitlement lifecycle (audited) |
| GET | `/api/platform/audit?tenant=` | recent platform-wide audit events |

## Error codes (representative)

`TENANT_NOT_FOUND`, `TENANT_MODULE_DISABLED`, `STORE_NOT_FOUND`,
`CART_FORBIDDEN`, `CART_EMPTY`, `OUT_OF_STOCK`, `INVALID_QUANTITY`,
`IDEMPOTENCY_KEY_REQUIRED`, `COUPON_INVALID`, `SHIPPING_ZONE_MISMATCH`,
`PAYMENT_PROVIDER_DISABLED`, `PRODUCT_UNAVAILABLE`, `VARIANT_UNAVAILABLE`,
`TRANSITION_INVALID`, `INVARIANT`, `PLAN_LIMIT`, `DUPLICATE`,
`NO_MEMBERSHIP`, `FORBIDDEN`, `UNAUTHENTICATED`, `REVIEW_EXISTS`.

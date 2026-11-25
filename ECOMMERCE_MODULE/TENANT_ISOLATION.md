# Tenant Isolation

## Model

Every commerce entity is tenant-scoped (`tenantId` on every row). The module
resolves tenant identity from trusted context only:

| Surface | Identity source | Untrusted input ignored |
|---|---|---|
| Storefront APIs | URL slug → tenant registry + entitlement check | any tenant id in body |
| Staff APIs | session cookie → membership lookup | tenant id/slug in body or query |
| Customer APIs | signed customer cookie (store-scoped) | tenant id in body |
| Guest order access | order number + 128-bit order access token | — |
| Settlement | payment attempt + order access token | success URLs, client amounts |
| Background-style processing (settlement, transitions) | DB-resolved order/attempt rows | forged tenant context |

Isolation mechanisms (SQLite reference build):

1. Server-side scoping — every query filters by tenant; every mutation loads
   the row scoped by tenant first.
2. Composite unique constraints per tenant — `products(tenantId, sku)`,
   `products(tenantId, slug)`, `variants(tenantId, sku)`,
   `orders(tenantId, orderNumber)`, `payment_attempts(tenantId, idempotencyKey)`,
   `coupons(tenantId, code)`, `customers(tenantId, storeId, email)`,
   `webhook_events(tenantId, provider, providerEventId)` …
3. Cookie namespaces per tenant — `bw_cart_<slug>`, `bw_customer_<slug>`.
4. Entitlement gate before any commerce access —
   `requireStorefrontTenant` / `requireStaffPermission` both verify
   `ModuleEntitlement(commerce).enabled`.

In the host platform deployment, these layer on PostgreSQL **FORCE RLS**
row-level security exactly as bazionwebs-platform does for its commerce
tables (`tenant_isolation` policies, migration 0001).

## Module lifecycle isolation

- Commerce **disabled** → storefront 404 `TENANT_MODULE_DISABLED`; staff routes
  404 `TENANT_MODULE_DISABLED`; data fully preserved.
- Commerce **enabled, store not provisioned** → `STORE_NOT_FOUND` (no leakage
  of other tenants' stores, no fallback).
- Commerce **re-enabled** → identical data returns (verified this session by
  toggling `grace-chapel` off → on → off through the platform admin API).

## Verified test matrix (executed)

| # | Test | Result |
|---|---|---|
| 1 | Tenant A cart cookie on Tenant B cart API | `cart: null` — no data returned |
| 2 | Tenant A order number on Tenant B orders API | `ORDER_NOT_FOUND` |
| 3 | Tenant A staff session on Tenant B admin API | `NO_MEMBERSHIP` (403) |
| 4 | Role escalation (`orderManager` → store settings) | `FORBIDDEN` |
| 5 | Refund action by non-owner/admin role | blocked server-side |
| 6 | Commerce-disabled tenant storefront access | `TENANT_MODULE_DISABLED` |
| 7 | Commerce-enabled tenant without store | `STORE_NOT_FOUND` (correct, non-leaky) |
| 8 | Replayed webhook | `alreadyProcessed: true` |
| 9 | Replayed checkout (same Idempotency-Key) | original order returned, no duplicate |
| 10 | Entitlement toggle | audited, reversible, data preserved |

## Cache/storage keys

This build has no cross-request caches; analytics/notifications are
tenant-scoped rows. Any future cache keys must embed tenant id (host
platform convention: tenant identity in cache keys, storage paths, queue
messages — enforced here by schema design).

# Commerce module — initial domain and API contract

## First-release scope

- Product catalogue read endpoints (basic active product list).
- Guest cart creation and item add/update/remove.
- Server-side price and stock revalidation at checkout.
- Order and order-item snapshots.
- Inventory reservation during payment pending state.
- Idempotent checkout key storage.
- Payment provider port and development-only mock.

## Deliberately deferred

Customer accounts, catalog administration, variants/options, coupons/promotions, shipping-rate quotes, tax engines, multiple warehouses, subscription commerce, refunds/chargebacks, real M-Pesa/Stripe adapters, webhook retry queue, reservation expiry worker and production reconciliation.

## Money and quantities

Prices are integer minor units (`priceMinor`). KES 1.00 is represented as 100 minor units. The API returns `currency` and `unitPriceMinor` rather than relying on client-side decimal arithmetic. Currency exponent rules need a currency metadata module before adding zero-decimal or three-decimal currencies.

## Checkout sequence

1. Guest creates cart; API sets a per-cart HttpOnly cookie with a one-time random token and stores only the token hash.
2. Browser sends the HttpOnly per-cart cookie automatically for cart operations.
3. Checkout requires an `Idempotency-Key` and valid cart token.
4. In one transaction, API serializes same idempotency key, validates cart, locks products, recalculates prices, checks stock, creates immutable order item snapshots, reserves inventory, creates payment attempt and stores idempotency record.
5. Payment provider session creation happens outside the DB transaction. Retries reuse the order/payment intent and provider-side idempotency key.
6. Only verified server-to-server provider events transition an order to paid and consume stock reservations.
7. Failed/expired payment releases reservations through an idempotent state transition/worker (not yet implemented in this MVP).

## Current API routes

- `GET /v1/products`
- `POST /v1/carts`
- `GET /v1/carts/:cartId`
- `POST /v1/carts/:cartId/items`
- `PATCH /v1/carts/:cartId/items/:itemId`
- `DELETE /v1/carts/:cartId/items/:itemId`
- `POST /v1/checkout`
- Development only: `POST /v1/_dev/orders/:orderId/pay`

## Error behavior

- 400 invalid input/header.
- 401 missing/invalid guest token.
- 404 cart/product/item not found in this tenant.
- 409 invalid cart state, stock unavailable, idempotency key reused with a different payload, or checkout conflict.
- 500 unexpected server failure (generic client message; detailed logs server-side).

## Next commerce milestones

1. Add automated integration tests against ephemeral PostgreSQL and test RLS with two tenants.
2. Add a payment attempt state machine and real provider adapter (Daraja for M-Pesa and/or Stripe).
3. Add webhook signature verification, durable webhook inbox, retry/reconciliation and idempotent fulfillment.
4. Add tax/shipping/discount ports and immutable pricing snapshots.
5. Add admin catalog/order management, customer accounts and order history.
6. Add inventory reservation expiry, audit trail and operational metrics.

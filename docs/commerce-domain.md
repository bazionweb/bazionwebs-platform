# Commerce module — initial domain and API contract

## First-release scope

- Product catalogue read endpoints (basic active product list).
- Guest cart creation and item add/update/remove.
- Server-side price and stock revalidation at checkout.
- Order and order-item snapshots.
- Inventory reservation during payment pending state.
- Idempotent checkout key storage.
- Payment adapter boundary, development-only mock and Daraja M-Pesa STK Push with token-protected callback validation. Refunds and missed-callback reconciliation are not implemented.

## Deliberately deferred

Customer accounts, catalog administration, variants/options, coupons/promotions, shipping-rate quotes, tax engines, multiple warehouses, subscription commerce, refunds/chargebacks, card/PayPal adapters, callback-loss reconciliation, reservation expiry worker and production merchant validation.

## Money and quantities

Prices are integer minor units (`priceMinor`). KES 1.00 is represented as 100 minor units. The API returns `currency` and `unitPriceMinor` rather than relying on client-side decimal arithmetic. Currency exponent rules need a currency metadata module before adding zero-decimal or three-decimal currencies.

## Checkout sequence

1. Guest creates cart; API sets a per-cart HttpOnly cookie with a one-time random token and stores only the token hash.
2. Browser sends the HttpOnly per-cart cookie automatically for cart operations.
3. Checkout requires an `Idempotency-Key` and valid cart token.
4. In one transaction, API serializes same idempotency key, validates cart, locks products, recalculates prices, checks stock, creates immutable order item snapshots, reserves inventory, creates payment attempt and stores idempotency record.
5. Daraja STK Push initiation happens outside the DB transaction. A same-key retry reuses the persisted order/payment attempt; a conditional state claim prevents the API from issuing a second provider request for that attempt.
6. Only verified server-to-server provider events transition an order to paid and consume stock reservations.
7. A failed provider callback releases reservations. An expiry worker and callback-loss reconciliation are still needed for attempts that never receive a callback.

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
2. Validate Daraja in sandbox and with the live merchant; add callback-loss reconciliation, refunds/reversals and tenant-specific merchant credentials.
3. Add a durable provider callback inbox, retries/reconciliation and idempotent fulfillment. Add provider-signature verification for future providers that support signed webhooks.
4. Add tax/shipping/discount ports and immutable pricing snapshots.
5. Add admin catalog/order management, customer accounts and order history.
6. Add inventory reservation expiry, audit trail and operational metrics.

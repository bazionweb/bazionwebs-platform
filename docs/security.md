# Security baseline and go-live checklist

This repository is a development foundation, not a security certification. Review the checklist with each client and hosting environment.

## Tenant isolation

- Resolve tenant ID from verified identity/domain configuration, not user-controlled payloads.
- Include tenant ID in every repository predicate and tenant-aware foreign key.
- Apply RLS to all tenant-owned tables. The migration uses `current_setting('app.tenant_id', true)` set locally inside each DB transaction. Never use a session-level tenant setting on a pooled connection.
- Run application queries as a dedicated non-owner role without superuser or `BYPASSRLS`. Table owners and privileged roles can bypass ordinary RLS behavior unless configured otherwise. The local Docker setup creates `bazion_app` and `bazion_migrator` separately; migrations and seed scripts use the latter, while the API uses the former.
- Test negative cases: tenant A cannot read, update, reference or infer tenant B's products, carts, orders or webhooks.

## Commerce and checkout

- Client-submitted prices, discounts, taxes, delivery charges, totals, stock and payment status are untrusted.
- Re-query products and calculate totals on the server during checkout.
- Store money as integer minor units; never use binary floating point for financial totals.
- Use transactions and row locks for inventory reservation; create idempotency records for checkout requests.
- Treat guest cart tokens as bearer secrets: cryptographically random, returned once, stored only as a hash, stored in a host-only HttpOnly cookie, never exposed to frontend JavaScript, logged or placed in URLs.
- Keep the cart cookie first-party: the storefront calls its own `/v1/*` path and its Next.js server rewrites that path to the API. This lets a client use its own custom domain without depending on third-party cookies. Keep the API origin in server-only `API_BASE_URL`; do not expose it through `NEXT_PUBLIC_*` for browser cart calls.
- Create orders before redirecting/initiating payment, but do not mark orders paid or fulfill them from a browser return URL.
- Verify provider callbacks/webhooks, amount, currency, merchant/order reference and provider transaction reference. Persist event IDs and make fulfillment idempotent.
- Support late/out-of-order notifications and reconciliation; do not assume webhooks arrive exactly once or in order.
- Do not store card PAN/CVV or M-Pesa PIN/OTP. Prefer hosted/tokenized payment collection.

## API and application security

- TLS in production; secure, HttpOnly, SameSite cookies for authenticated sessions.
- Central authentication provider; short-lived access credentials and rotation/revocation strategy.
- Enforce authorization at the API boundary for every object and action.
- Validate inputs with shared schemas; set request body limits and rate limits.
- Strict CORS allowlist; configure trusted proxies explicitly; do not blindly trust forwarded headers.
- Store secrets in the host's secret manager, not Git, .env files in commits, browser bundles or logs.
- Redact auth headers, cookies, guest cart tokens, payment provider secrets and personal data from logs.
- Add CSRF protection where cookie-authenticated state-changing browser requests are used.
- Add security headers, dependency scanning, secret scanning and regular patching.

## Operational controls

- Least-privilege DB roles, encrypted backups, restore drills, database migration review.
- Audit sensitive admin actions; log payment state transitions without logging payment secrets.
- Alert on repeated payment failures, webhook verification failures, stock anomalies and order status inconsistencies.
- Set retention/deletion policies for customer data and logs, and document each client's privacy/legal obligations.

## Local-only features

`PAYMENT_PROVIDER=mock`, static tenant resolution and `/_dev/*` routes are development conveniences. Production boot rejects the first two settings, and dev routes are only registered in non-production mode. Do not weaken these guards to make a deployment pass.

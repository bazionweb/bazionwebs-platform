# E-commerce template

## Research decisions

This template follows a commerce flow that keeps the buying path visible and short: product discovery, useful product detail, basket review, delivery details, server-side price and stock checks, provider-confirmed payment, then order fulfillment. The storefront includes category filters, product search and sorting, sale prices, image descriptions, persistent guest baskets, product detail URLs, delivery estimates, and order confirmation. The workspace covers product publishing, inventory, orders, tenant store identity, regional preferences, and fulfillment status.

Accessibility and performance choices come from current primary guidance:

- [WCAG 2.2 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) sets a 24 by 24 CSS pixel minimum target size, with spacing and other exceptions. The shop uses large action buttons and clear spacing, plus visible keyboard focus.
- [WCAG 2.2 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) recommends a way to disable non-essential movement. The shop honors `prefers-reduced-motion`.
- [web.dev Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds) define good field targets at the 75th percentile: LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1. The template server-renders its first catalog page, caps a catalog request at 100 items, debounces search, lazy-loads catalog images, and avoids an animation library.
- [web.dev animation performance guidance](https://web.dev/articles/animations-and-performance) recommends limiting motion to `transform` and `opacity` where possible. The decorative motion and transitions use those properties and have reduced-motion overrides.
- The [OWASP Multi-Tenant Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) recommends server-verified tenant context, tenant-scoped queries, transaction-local PostgreSQL context, RLS tests, and tenant-aware audit. These controls are applied to the commerce store settings and admin endpoints.
- For future card and global payment integrations, [Stripe's Checkout fulfillment guidance](https://docs.stripe.com/checkout/fulfillment) requires webhook-based, idempotent payment confirmation; a browser return page alone is not proof of payment. The current commerce flow preserves server-side payment confirmation and idempotency patterns.

## Tenant model and data boundaries

- The solution manifest describes a reusable template; it contains no tenant's product, branding, or payment secrets.
- Each store has a `commerce_store_settings` row keyed by `tenant_id`. Homepage selection, display name, locale, timezone, default country, supported currencies, delivery regions, and flat delivery estimates belong to that tenant.
- Products carry tenant-specific slugs, images, categories, pricing, stock, and publication state.
- Public requests resolve the tenant from the verified hostname. Admin routes resolve it from the authenticated active workspace membership. The browser does not send a tenant ID as authority.
- Admin queries use `withTenantTransaction`, which establishes transaction-local `app.tenant_id`, and also include tenant predicates. Product, settings, order, and order-item writes stay inside the active tenant.
- The migration enables and forces RLS on `commerce_store_settings`. The commerce integration suite includes settings in its RLS inventory and checks that another tenant's settings cannot be read or changed.
- Product and store mutations use tenant permissions and create audit events. Order fulfillment is restricted to paid orders and the `order:update` permission.
- Guest checkout keeps its access token in a tenant-scoped HttpOnly cookie; cart IDs in browser storage are identifiers, not credentials. Checkout recalculates prices, checks stock, reserves inventory, and uses an idempotency key.

## Local and international selling

Store owners can enable KES, USD, EUR, GBP, CAD, AUD, NZD, CHF, SGD, ZAR, NGN, GHS, INR, AED, BRL, MXN, SAR, CNY, HKD, SEK, NOK, DKK, PLN, THB, and PHP. Each price is stored as a separate two-decimal price list; the template does not convert prices using a hidden or stale exchange rate. Store settings can set the locale, time zone, default delivery country, allowed delivery countries, and a flat delivery estimate for each enabled currency.

This is a configurable storefront foundation, not a complete global payments or tax service. The application currently has the M-Pesa adapter and a development-only mock adapter; live card/PayPal providers and tenant-specific payment credentials are not implemented. The starter does not automatically calculate sales tax, VAT, customs, duties, or country-specific delivery zones. Do not enable a currency or country in production until an appropriate live provider, tax treatment, shipping policy, and local business obligations are configured.

Product variants, customer accounts, coupons, refunds, subscription commerce, carrier-rate quotes, multiple warehouses, tax engines, automated fulfillment labels, and callback-loss reconciliation remain future modules.

## Setup

1. Apply `packages/database/migrations/0012_ecommerce_template.sql` using the migration database role.
2. Enable the commerce module for the intended tenant and sign in with a tenant owner/admin or the appropriate catalog/order manager role.
3. Open `/admin/commerce`, add products, and configure store name, locale, currencies, country list, and delivery estimates.
4. Keep **Use this shop as the public homepage** off to leave that tenant's existing homepage in place; enable it only for the tenant whose storefront should own `/`.
5. Preview `/shop`, product detail links, basket, checkout, and `/admin/commerce` on the tenant's verified host.
6. Before accepting production orders in a new region, connect and test a live payment adapter, review tax/shipping rules, and measure field Core Web Vitals for the tenant's product images and traffic.

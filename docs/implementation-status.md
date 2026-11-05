# Implementation status

## Included in this starter

- TypeScript pnpm/Turborepo workspace and a shared package layout.
- Platform contracts for tenant and principal context.
- Basic ports/interfaces for auth, payment providers, storage, notifications, booking and analytics.
- Shared UI button and client configuration example.
- PostgreSQL schema and initial migration for tenants, products, carts, orders, item snapshots, stock reservations, payment attempts, webhook events and idempotency.
- Explicit local PostgreSQL admin, migration and application roles; tenant-table RLS policies; restricted application table grants.
- Fastify routes for product listing, guest cart creation, cart read/update/delete, order checkout and a non-production mock-payment action.
- Next.js demo storefront with product catalogue, interactive cart, checkout form and a development-only payment simulation page.
- Architecture, security, onboarding, deployment, research-source, GitHub setup and ADR documentation.
- Initial CI and Dependabot configuration.

## Verified in the build environment

- 30 JSON files parsed successfully.
- 28 TypeScript/TSX files parsed without syntax errors.
- PostgreSQL role-init shell script passed `bash -n`.
- `@bazion/commerce-domain` compiled with the installed TypeScript compiler and passed a Node smoke test for money totals and empty-cart rejection.

## Not verified in this environment

The execution environment did not have the repository's npm dependencies installed, PostgreSQL/`psql`, Docker or network access to download dependencies. Therefore a full workspace typecheck/build, Vitest run, SQL migration execution, RLS integration test and browser end-to-end test were not performed. The repository must pass those checks after dependency installation and database startup on the developer machine or CI.

## Not production-ready yet

- Static tenant selection remains in place for the demo; add a trusted host/domain and/or identity-claim tenant resolver.
- No real authentication provider or admin authorization implementation is configured.
- Mock payments only. No real Safaricom Daraja or Stripe adapter, signature verification, webhook inbox/retry worker or reconciliation is implemented.
- Payment failure, cancellation, refund and expired-reservation state transitions need implementation and tests.
- Shipping quotes, taxes, promotions/discounts, product variants and currency metadata are deferred.
- Product/order admin UI and customer accounts are deferred.
- The initial `pnpm-lock.yaml` has not been generated; create it on the first successful install and switch CI to frozen installs.
- No remote GitHub repository has been created or pushed from this environment.

Do not use the mock payment route or static tenant resolution for real customers or real money. The production startup guards are intentional.

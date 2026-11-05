# Bazion Web Platform

An ownership-first, modular platform for building and operating reusable websites and client applications. This repository starts as a **modular monorepo**: shared domain packages, a Fastify API, a Next.js storefront example, and a PostgreSQL database. It is deliberately not split into microservices at the beginning.

> **Status:** foundation / commerce MVP starter. The local mock payment driver is for development only. This is not a production payment integration and must not be used to accept real payments.

## What is included

- Shared platform contracts: tenant and principal boundaries.
- Commerce domain: integer-money calculations and cart rules.
- PostgreSQL schema: tenants, products, carts, orders, inventory reservations, payment attempts, webhook events, and idempotency records. The local setup uses separate least-privilege application and migration roles so RLS is exercised by the API.
- Fastify API: product listing, guest carts, cart-item management, checkout order creation, and a development-only payment simulator.
- Next.js storefront starter.
- Ports for authentication, payment providers, storage, notifications, booking, and analytics.
- SQL migration with row-level security (RLS) policies.
- CI starter and architecture/security documentation.

## Technology choices

- Node.js 26 Active LTS is the recommended production runtime. This starter declares Node >=22.16 to remain usable on compatible development machines; use an up-to-date supported LTS line in production.
- pnpm 12 workspaces + Turborepo.
- TypeScript, Next.js 16, Fastify 5, PostgreSQL 18, Drizzle ORM, Zod, and Vitest.

## Local setup (Windows PowerShell or macOS/Linux)

1. Install Node.js 26.13.0 LTS and Git.
2. Install the pinned pnpm version globally. Node.js 25 and newer no longer bundle Corepack, so use npm to install pnpm:

   ```powershell
   npm install --global pnpm@12.18.0
   pnpm --version
   ```

3. Copy `.env.example` to `.env`. The example credentials are for local development only; change them before sharing the environment.
4. Install dependencies and start PostgreSQL. On a fresh database volume, the init script creates separate application, migration, authentication, tenant-resolver and tenant-provisioner roles. Business API queries use `bazion_app`; Better Auth uses `bazion_auth_runtime`; public tenant lookups use `bazion_tenant_resolver`; organization provisioning uses `bazion_tenant_provisioner`; migrations use `bazion_migrator`.

   ```powershell
   pnpm install
   docker compose up -d db
   ```

   The database role bootstrap runs only when PostgreSQL creates a new data volume. To reset this disposable local database after changing bootstrap credentials, run `docker compose down -v` and start it again. This deletes local database data.

5. Apply the SQL migration and seed the demo tenant/products:

   ```powershell
   pnpm db:migrate
   pnpm db:auth:migrate
   pnpm db:seed
   ```

6. Start the API and storefront (the root script loads `.env` for local commands):

   ```powershell
   pnpm dev
   ```

   API health: `http://localhost:4000/health`

   Storefront: `http://localhost:3000` (the browser calls same-origin `/v1/*` and `/api/auth/*` paths; Next.js rewrites it to the API so the HttpOnly cart cookie stays first-party on each client's custom domain).

The initial archive does not include `pnpm-lock.yaml` because package downloads were unavailable in the build environment. Run `pnpm install` once, commit the generated lockfile, and then change CI to `pnpm install --frozen-lockfile` and enable pnpm caching. The current CI workflow is bootstrap-friendly until that lockfile is committed.

### First commerce API walkthrough

The starter uses a static default tenant only for local development. The API runtime database role is not a table owner or RLS-bypass role. Static tenant selection is not an authentication system or production tenant resolver.

1. List products:

   ```http
   GET http://localhost:4000/v1/products
   ```

2. Create a guest cart:

   ```http
   POST http://localhost:4000/v1/carts
   Content-Type: application/json

   { "currency": "KES" }
   ```

   The API stores the guest access token in a per-cart `HttpOnly` cookie. Browsers send it automatically; do not try to read or expose it in JavaScript.

3. Add a product:

   ```http
   POST http://localhost:4000/v1/carts/CART_ID/items
   Cookie: bw_cart_CARTIDWITHOUTDASHES=... (browser-managed; use the cookie jar created with cart POST)
   Content-Type: application/json

   { "productId": "PRODUCT_ID", "quantity": 1 }
   ```

4. Create a checkout order:

   ```http
   POST http://localhost:4000/v1/checkout
   Cookie: bw_cart_CARTIDWITHOUTDASHES=... (browser-managed; use the cookie jar created with cart POST)
   Idempotency-Key: a-random-unique-value-of-at-least-8-chars
   Content-Type: application/json

   {
     "cartId": "CART_ID",
     "customer": {
       "name": "Demo Customer",
       "email": "customer@example.test",
       "phone": "+254700000000"
     },
     "shippingAddress": {
       "line1": "1 Demo Road",
       "city": "Nairobi",
       "countryCode": "KE",
       "postalCode": "00100"
     }
   }
   ```

5. For local testing only, simulate payment success:

   ```http
   POST http://localhost:4000/v1/_dev/orders/ORDER_ID/pay
   x-dev-secret: local-dev-only-change-me
   ```

   This route is never registered in production. A real provider adapter and authenticated provider webhook must replace it before launch.

## Important production gates

The API intentionally refuses to start in production while `PAYMENT_PROVIDER=mock`, `TENANT_RESOLUTION_MODE=static`, email verification is disabled, or SMTP is not configured. Before a real client launch, Bazion must implement and test:

- A trusted tenant resolver using verified identity claims and/or verified custom-domain mapping.
- Review Better Auth authentication, organization membership, the platform-member bootstrap, tenant mapping and RBAC integration tests before enabling client administration.
- A real payment adapter (e.g. Safaricom Daraja M-Pesa or Stripe) with signature/authenticity verification and provider-side reconciliation.
- Persistent webhook idempotency and failure/retry handling.
- Shipping, tax, discounts, refunds, stock reservation expiry/reconciliation, audit logs, privacy/retention, backups and monitoring.
- Production database roles (the app role must not own tables, be superuser, or have `BYPASSRLS`); the local Compose setup demonstrates separate app and migration roles.
- HTTPS, secrets management, rate limits, alerting, and tested restore procedures.

See [`docs/`](docs/) for architecture, security, client onboarding, deployment, research sources, GitHub setup, implementation status and the commerce roadmap.

## Authentication and tenant architecture

The target identity and access model is documented in [Authentication and tenant isolation](docs/architecture/authentication-and-tenant-isolation.md), with an editable [Mermaid source](docs/architecture/authentication-and-tenant-isolation.mmd) and a rendered [SVG diagram](docs/architecture/authentication-and-tenant-isolation.svg). This is an architecture decision, not a claim that authentication has already been implemented. See [ADR 0005](docs/adr/0005-authentication-and-tenant-identity.md).


### Authentication development walkthrough

1. Open `http://localhost:3000/login` and create an account. Verification links are printed in the API console when SMTP is not configured locally.
2. Verify the email, then sign in. Better Auth stores the session in an HttpOnly cookie; browser JavaScript cannot read the session token.
3. Read the signed-in identity from `GET /v1/auth/me` (for local API testing: `http://localhost:4000/v1/auth/me`).
4. Before an account can create a client organization, bootstrap its verified user ID as a Bazion platform member. Follow [Platform owner bootstrap](docs/platform-owner-bootstrap.md). Only active `platform_owner` or `platform_admin` accounts may create client organizations.
5. Client owners and staff join organizations through invitations. New organizations are created with a tenant `admin` role for the platform operator; assigning the stronger tenant `owner` role is restricted to a verified Bazion platform owner/admin. Tenant roles do not grant platform-wide privileges.

Better Auth tables live in the separate PostgreSQL `auth` schema. Migrate them with `pnpm db:auth:migrate`; the API runtime role has DML-only access. See [Authentication operations](docs/authentication-operations.md) for existing-volume role upgrades, SMTP configuration and production deployment requirements.

**Existing local database volume:** Docker's init scripts only run when PostgreSQL initializes a fresh data volume. Do not run `docker compose down -v` if you need to preserve local data. Follow [Authentication operations](docs/authentication-operations.md) to create the additional roles safely before applying the new migrations.

### Better Auth schema migration version note

The Better Auth core package is pinned to **1.7.17**. The separate npm CLI package currently publishes **1.7.14**, so the migration script checks that an exactly matching `auth@1.7.17` CLI exists before applying the schema. It intentionally refuses to run an older CLI against the newer runtime. Once Better Auth publishes the matching CLI package, `pnpm db:auth:migrate` will run it through `pnpm dlx`. Until then, the auth runtime/schema migration step is pending; do not manually create a guessed schema or bypass the version check.

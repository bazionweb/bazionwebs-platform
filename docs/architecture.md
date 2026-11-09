# Bazion Web Platform Architecture

## Architectural goal

Build common capabilities once and reuse them across independent client solutions. Share source code and contracts, not client data, secrets, or deployment state.

## Recommended shape: modular monorepo + modular monolith

```text
Client projects / storefronts / admin portals
                 |
          Shared packages
  UI | contracts | domain | integrations
                 |
          Application APIs
      Fastify modular API (v1)
                 |
       PostgreSQL + provider APIs
                 |
     Operations: CI, secrets, backups,
      monitoring, domains, deployments
```

### Why not microservices immediately?

A modular monolith keeps transactions, local development, deployment and debugging simpler while Bazion validates the business modules. Modules have explicit boundaries and can be extracted later if independent scaling, team ownership, or deployment needs justify it. Do not split a service just because it is a folder.

## Repository map

- `apps/api`: server-side HTTP API and application orchestration.
- `apps/storefront`: customer-facing Next.js example.
- `apps/admin`: reserved for the Bazion platform-owner control plane; the current client workspace admin is /admin inside apps/storefront.
- `packages/platform-contracts`: cross-cutting tenant/principal types.
- `packages/api-contracts`: Zod schemas shared by clients and server.
- `packages/commerce-domain`: pure cart/order rules; no database or HTTP dependencies.
- `packages/database`: Drizzle schema, SQL migrations, seed and database helpers.
- `packages/payments`: payment-provider port and normalized result types.
- `packages/auth`: Better Auth runtime, sessions, organization membership, platform/client role checks and trusted tenant context.
- `packages/ui`: shared design-system components.
- `packages/notifications`: durable authentication email outbox, enqueue-only and delivery-worker database roles, and a separately supervised SMTP worker; SMS and operator-facing dead-letter tooling remain planned.
- `packages/audit`: append-only audit-event contract and PostgreSQL writer for privileged platform and tenant administration actions.
- `packages/storage`: tenant object-key helpers, local development adapter and S3-compatible object-storage adapter used by the shared church media library.
- `packages/booking`: initial booking types and booking-window validation; availability/resources/conflict management remain planned.
- `packages/analytics`: initial privacy-aware event/sink contract; ingestion and tenant reports remain planned.
- `mcp`: MCP server design. MCP adapters call the same API/domain capabilities; MCP is not the website's cart implementation.
- `templates`: per-client configuration examples, not copies of business logic.

## Dependency direction

Allowed: apps -> packages -> domain contracts.
Avoid: domain packages importing apps, database packages importing storefronts, or one client app importing another client's data/configuration.

`commerce-domain` must remain framework- and provider-independent. HTTP handlers validate/authorize requests, call the application/service layer, and map domain errors to HTTP responses. Database repositories enforce tenant scoping and persistence constraints.

## Client isolation

- Every business-owned row includes `tenant_id`.
- Every query includes tenant scope even when PostgreSQL RLS is enabled.
- Composite tenant-aware foreign keys prevent accidental cross-tenant references.
- RLS is defense in depth, not a substitute for authentication or explicit tenant filters.
- Resolve tenant context from a trusted source. Never trust a tenant ID supplied in an arbitrary body or query string.
- Never share payment credentials, storage buckets, API keys or personal data between clients.
- Use separate production environments/secrets per client where isolation or contractual requirements justify it. A shared database with RLS is not a blanket guarantee of compliance.

## Deployment topology

Start with one API deployment and one Postgres database for the Bazion demo environment. For actual client work, choose per-client database/schema/deployment boundaries according to risk, scale and budget. Static sites can deploy independently to Cloudflare Pages or another host. Do not force all clients into one deployment.

## Extension points

- Add features through small packages and explicit ports.
- Add adapters for providers (payments, mail, storage) without leaking vendor SDK types into domain logic.
- Version reusable packages with semver. Publish packages only when there is a real cross-repository need; workspace dependencies are simplest initially.
- Add MCP server tools only for controlled, authenticated business actions. Reuse APIs and domain functions; never expose privileged database access directly to an agent.

## Logical component diagram

```mermaid
flowchart TB
  subgraph ClientApps[Client-facing applications]
    Store[Storefront / website]
    Admin[Client admin portal]
    Portal[Client-specific app]
  end
  subgraph Shared[Reusable Bazion packages]
    UI[Design system]
    Contracts[API and platform contracts]
    Domain[Commerce and other domain rules]
    Auth[Auth / authorization ports]
    Adapters[Payments / storage / notifications]
  end
  API[Fastify application API]
  DB[(PostgreSQL with tenant keys and RLS)]
  Providers[External provider APIs]
  MCP[Bazion MCP adapters - optional]
  Ops[GitHub CI / secrets / backups / monitoring]

  Store --> UI
  Admin --> UI
  Portal --> UI
  Store --> Contracts
  Admin --> Contracts
  Portal --> Contracts
  Contracts --> API
  API --> Domain
  API --> Auth
  API --> Adapters
  API --> DB
  Adapters --> Providers
  MCP --> API
  Ops -. governs and deploys .-> ClientApps
  Ops -. governs and deploys .-> API
```

## Checkout sequence

```mermaid
sequenceDiagram
  participant Browser
  participant API
  participant DB as PostgreSQL
  participant Pay as Payment provider
  Browser->>API: Create guest cart
  API->>DB: Store cart and token hash
  API-->>Browser: Cart ID + HttpOnly cookie
  Browser->>API: Add/update cart items
  API->>DB: Validate products and persist quantities
  Browser->>API: Checkout + Idempotency-Key
  API->>DB: Lock cart and product rows
  API->>DB: Recalculate prices, reserve stock, create order/payment attempt
  API->>Pay: Create provider session (outside transaction)
  Pay-->>API: Provider reference / checkout URL
  API-->>Browser: Order reference + redirect URL
  Browser->>Pay: Customer completes payment
  Pay->>API: Authenticated provider callback/webhook
  API->>API: Verify signature, order, amount, currency and event identity
  API->>DB: Idempotently mark paid and consume reservation
```

The running starter implements the cart/order path, a development-only mock and a Safaricom Daraja M-Pesa STK Push path. Daraja callbacks use per-attempt random capabilities and validate the provider request IDs, amount, currency and phone before order settlement. Callback-loss reconciliation, refunds/reversals and live merchant validation remain production milestones.

## Authentication and tenant identity

The selected self-hosted, open-source authentication design is documented in [Authentication and tenant isolation](architecture/authentication-and-tenant-isolation.md), including the Better Auth organization model, trusted tenant resolution, server-side RBAC, database-role boundaries and PostgreSQL RLS. The architecture source and SVG are maintained beside that document. See [ADR 0005](adr/0005-authentication-and-tenant-identity.md).

This is the target design; runtime authentication and tenant resolution remain implementation work.


## Advertised products and delivery plan

The product map now lives in [products/catalog.json](../products/catalog.json), with 111 advertised capabilities mapped to reusable domain modules. Versioned module contracts live under `modules/`, and the module-owned permission registry is `products/permissions.json`. [Commercial offerings](../products/commercial-offerings.json) keep service tiers and add-ons separate from implementation packages. Nine initial solution manifests are under solutions/.

See [Product architecture](product-architecture.md) for the target package/app layout and [Implementation roadmap](implementation-roadmap.md) for phase gates and exit criteria.

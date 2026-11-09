# Authentication and tenant operations

## Database roles

| Role | Purpose | Expected access |
|---|---|---|
| `bazion_auth_runtime` | Better Auth sessions, users, accounts, organizations and membership | DML on the `auth` schema; no CREATE |
| `bazion_app` | Commerce/API business operations | Explicitly granted business-table access; tenant-owned tables remain protected by RLS |
| `bazion_tenant_resolver` | Resolve verified hostnames and platform-member roles | Read-only tenant registry views/tables |
| `bazion_tenant_provisioner` | Organization hook and registry writes | SELECT/INSERT/UPDATE on tenant registry, tenant domains and platform members only |
| `bazion_migrator` | Numbered SQL and Better Auth schema migrations | DDL; never used as an application runtime role |

The auth tables are placed in PostgreSQL's `auth` schema using the connection's `search_path`. The Better Auth runtime pool uses `AUTH_DATABASE_URL`; the CLI migration process uses `AUTH_MIGRATION_DATABASE_URL` and the migrator role.

## Existing PostgreSQL volume upgrade

The Docker init script only runs for a new empty data volume. If you created your current database before the auth roles were added, preserve the existing volume and connect as the local PostgreSQL administrator. Run the following statements, substituting the local-only passwords from your `.env`:

```sql
CREATE ROLE bazion_auth_runtime LOGIN PASSWORD 'REPLACE_AUTH_PASSWORD'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE bazion_tenant_resolver LOGIN PASSWORD 'REPLACE_RESOLVER_PASSWORD'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE bazion_tenant_provisioner LOGIN PASSWORD 'REPLACE_PROVISIONER_PASSWORD'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE bazion_platform
  TO bazion_auth_runtime, bazion_tenant_resolver, bazion_tenant_provisioner;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION bazion_migrator;
GRANT USAGE ON SCHEMA auth TO bazion_auth_runtime;
GRANT USAGE, CREATE ON SCHEMA auth TO bazion_migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE bazion_migrator IN SCHEMA auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bazion_auth_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE bazion_migrator IN SCHEMA auth
  GRANT USAGE, SELECT ON SEQUENCES TO bazion_auth_runtime;

GRANT USAGE ON SCHEMA public TO bazion_tenant_resolver, bazion_tenant_provisioner;
```

The numbered application migration grants registry permissions after creating `tenant_domains` and `platform_members`. Do not grant the provisioner role access to products, carts, orders or payment tables.

## Migration order

```powershell
pnpm db:migrate
pnpm db:auth:migrate
pnpm db:seed
```

Application migrations are tracked in `public.schema_migrations`; SQL files are applied in numeric order. Better Auth schema migrations are generated from the configured Better Auth plugins using the built-in Kysely/PostgreSQL adapter and run with the migration URL.

## Email

- In development, leave SMTP blank. Verification, password-reset and invitation links are printed to the API console.
- In production, configure an authenticated SMTP transport, a verified sender identity, TLS as supported by the provider, and email verification.
- A mail library does not provide a free email-delivery service. SMTP hosting/provider costs and sending limits remain separate operating concerns.

## Trusted domains

The resolver only recognizes records exposed by `tenant_domain_directory`, which filters for active and verified custom domains. This branch does not yet provide a domain-verification UI or DNS challenge workflow. Do not mark a domain active until ownership has been independently verified. Domain provisioning should become an audited platform-admin operation.

## Proxy and host headers

Fastify defaults to `TRUST_PROXY=false`. When the API runs behind a reverse proxy, set `TRUST_PROXY=true` only if the API is not reachable directly and the proxy strips/replaces client-supplied `X-Forwarded-Host` and `X-Forwarded-Proto` headers. Do not trust arbitrary forwarding headers from the public internet.

## Production gates

Production startup requires `PAYMENT_PROVIDER=mpesa` with live Safaricom Daraja credentials and an HTTPS callback URL, verified-domain tenant resolution, email verification, SMTP and a non-development Better Auth secret. Authentication and tenant code still require integration testing under the actual hosting proxy, email domain, cookie origin and database privileges before client data is onboarded.


### Better Auth schema migration version note

The Better Auth core package is pinned to **1.7.17**. The separate npm CLI package currently publishes **1.7.10**, so the migration script checks that an exactly matching `auth@1.7.17` CLI exists before applying the schema. It intentionally refuses to run an older CLI against the newer runtime. Once Better Auth publishes the matching CLI package, `pnpm db:auth:migrate` will run it through `pnpm dlx`. Until then, the auth runtime/schema migration step is pending; do not manually create a guessed schema or bypass the version check.



## Next.js-to-Fastify tenant host forwarding

The Next.js 16 `apps/storefront/proxy.ts` runs only for the `/v1/*` and `/api/auth/*` proxy paths. It deletes caller-supplied `X-Forwarded-Host` and `X-Forwarded-Proto` headers and sets replacement values from the original incoming Next.js request URL. This preserves the custom client hostname when Next.js rewrites the request to Fastify.

Fastify accepts forwarded metadata only from the exact addresses/CIDRs in `TRUSTED_PROXY_ADDRESSES`. The deployment must restrict direct network access to the Fastify origin so only the trusted ingress/proxy can reach it. If a platform cannot provide stable trusted egress addresses, use an authenticated private service network or signed tenant-routing assertion rather than enabling trust-all proxy mode.

## Authentication email delivery limitation

The current Nodemailer callbacks start SMTP delivery without blocking the Better Auth response, following Better Auth's guidance to avoid timing differences in auth endpoints. Delivery errors are logged. This is not a durable queue: a process termination can lose an in-flight message. Before production onboarding depends on verification, invitations or password recovery, implement a durable transactional outbox plus retrying worker and monitor delivery failures.


### Tenant origin validation

Verified client origins must use HTTPS in production and the default HTTPS port. Localhost origins are allowed only in non-production development. Both Fastify CORS and Better Auth's trusted-origin resolver reject user-info components and non-standard ports for tenant origins.

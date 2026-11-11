# Authentication and tenant operations

## Database roles

| Role | Purpose | Expected access |
|---|---|---|
| `bazion_auth_runtime` | Better Auth sessions, users, accounts, organizations and membership | DML on the `auth` schema; no CREATE |
| `bazion_app` | Commerce/API business operations | Explicitly granted business-table access; tenant-owned tables remain protected by RLS |
| `bazion_tenant_resolver` | Resolve verified hostnames and platform-member roles | Read-only tenant registry views/tables |
| `bazion_tenant_provisioner` | Organization hook and registry writes | SELECT/INSERT/UPDATE on tenant registry, tenant domains and platform members only |
| `bazion_product_provisioner` | Authenticated commercial command receiver and saga worker | Tenant-scoped installation DML plus provisioning operations, attempts and event history; no commerce or auth records |
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

Migration `0018_product_installations_provisioning_sagas.sql` also grants access to `bazion_product_provisioner` when that role exists. On a database volume created before the role was added, provision it with a unique local password before starting the provisioning API. If migration 0018 has already been applied while the role was absent, run the following grants as the local PostgreSQL administrator after creating the role; the role remains subject to forced RLS on `product_installations` and must set the transaction-local `app.tenant_id` for installation access:

```sql
CREATE ROLE bazion_product_provisioner LOGIN PASSWORD 'REPLACE_PRODUCT_PROVISIONER_PASSWORD'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE bazion_platform TO bazion_product_provisioner;
GRANT USAGE ON SCHEMA public TO bazion_product_provisioner;
GRANT REFERENCES (id) ON public.tenants TO bazion_product_provisioner;
GRANT REFERENCES (id, tenant_id) ON public.product_installations TO bazion_product_provisioner;
GRANT REFERENCES ON public.product_provisioning_operations TO bazion_product_provisioner;
GRANT SELECT, INSERT, UPDATE ON public.product_installations,
  public.product_provisioning_operations, public.product_provisioning_step_attempts
  TO bazion_product_provisioner;
GRANT SELECT, INSERT ON public.product_provisioning_operation_events TO bazion_product_provisioner;
GRANT EXECUTE ON FUNCTION public.enforce_product_installation_update() TO bazion_product_provisioner;
GRANT EXECUTE ON FUNCTION public.enforce_product_provisioning_operation_update() TO bazion_product_provisioner;
GRANT EXECUTE ON FUNCTION public.record_product_provisioning_operation_event() TO bazion_product_provisioner;
GRANT EXECUTE ON FUNCTION public.is_safe_product_provisioning_effect(jsonb) TO bazion_product_provisioner;
```

Set `PRODUCT_PROVISIONER_DATABASE_URL` and `BAZION_PRODUCT_PROVISIONER_PASSWORD` to the matching credential. Never reuse the API, tenant-provisioner or migration password. The normal Docker role initializer creates the role only for a fresh empty volume.

## Migration order

```powershell
pnpm db:migrate
pnpm db:auth:migrate
pnpm db:seed
```

Application migrations are tracked in `public.schema_migrations`; SQL files are applied in numeric order. Better Auth schema migrations are generated from the configured Better Auth plugins using the built-in Kysely/PostgreSQL adapter and run with the migration URL.

## Email

- The tenant sign-in page and the separate platform sign-in page both provide **Forgot your password?** recovery. The reset request always gives the same confirmation for known and unknown email addresses.
- Password-reset links expire after one hour and are single-use. The new password follows the 12–128 character policy, all existing sessions are revoked, and a password-change notice is queued to the account email.
- Reset pages send `Referrer-Policy: no-referrer`, remove the token from the browser address bar after capture, and do not load third-party page assets.
- Verification, invitation, reset, and password-change messages are encrypted in the notification outbox and delivered by the notification worker. A queued record does not mean the provider delivered it or that it reached the inbox.
- For local development, `pnpm run dev:gmfc` starts the API, tenant storefront, platform console, and notification worker together. Configure the SMTP settings in `.env` if you need to receive the email. Check the notification worker and outbox state when it is not delivered; reset links are not printed to the API console.
- In production, configure an authenticated SMTP transport, verified sender identity, TLS as supported by the provider, and alerts for old pending/dead notifications. Email provider pricing and sending limits are separate operating concerns.

## If the account holder cannot access their email

- Email reset is the only self-service password recovery method currently implemented. Do not use security questions, ask users to disclose an old password, or send a reset token/password in chat.
- For a tenant account, an existing tenant owner can invite a replacement administrator using a new verified email address and then remove or suspend the inaccessible account through tenant access management. If no tenant owner is available, the Bazion platform owner must use the audited tenant access workflow.
- For a Bazion platform owner, use the audited platform ownership-transfer or role-management workflow with another verified account. If every platform owner is locked out, treat it as a break-glass incident: require independent identity verification and a second operator's approval, record the change in the incident/audit log, and notify all platform owners through an independent channel. Never restore access by silently editing a password hash or granting tenant-wide access.
- Support staff must not impersonate users. First restore control of the account's verified email address with its provider when possible, then use the normal password-reset flow.

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

## Authentication email delivery operations

Auth callbacks await durable enqueue to the encrypted notification outbox. The worker retries transient SMTP failures and marks exhausted notifications dead. Operators still need to monitor queue age and dead-letter counts, investigate provider bounces, and confirm the sender domain's SPF/DKIM/DMARC configuration before relying on production account recovery.


### Tenant origin validation

Verified client origins must use HTTPS in production and the default HTTPS port. Localhost origins are allowed only in non-production development. Both Fastify CORS and Better Auth's trusted-origin resolver reject user-info components and non-standard ports for tenant origins.

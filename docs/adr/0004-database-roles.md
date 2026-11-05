# ADR 0004: Separate database runtime and migration roles

- Status: Accepted
- Date: 2026-11-05

## Context

PostgreSQL row-level security is not a reliable isolation control if the application's database user owns protected tables, is a superuser, or has `BYPASSRLS`. Combining migrations and API runtime under one broad database account undermines the intended tenant boundary.

## Decision

- `bazion_admin` bootstraps the local PostgreSQL instance and creates roles.
- `bazion_migrator` owns schema objects and runs SQL migrations and seeds.
- `bazion_app` is the API runtime role, has only the table DML privileges required by the app, and does not own tenant tables or bypass RLS.
- Tenant context is applied transaction-locally via `set_config('app.tenant_id', ..., true)`.

## Consequences

Local development now exercises the RLS policies with the same least-privilege model expected in production. Any production deployment must provision equivalent roles and store their credentials separately. Changes to the local bootstrap roles require recreating the disposable database volume.

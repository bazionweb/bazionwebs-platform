# ADR 0002: Tenant-aware data model and PostgreSQL RLS

- Status: Accepted for initial platform
- Date: 2026-11-05

## Decision

Every tenant-owned record stores `tenant_id`, all repository reads/writes are explicitly tenant-scoped, tenant-aware foreign keys prevent cross-tenant links, and PostgreSQL RLS policies provide defense in depth. The runtime DB role must not be table owner, superuser or `BYPASSRLS`.

The initial API uses a static default tenant only for local demo setup and refuses production startup in that mode. Production tenant resolution must be designed and verified with authentication/custom-domain routing before client data is onboarded.

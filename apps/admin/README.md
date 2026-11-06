# Bazion Superadmin Application

The superadmin application is the platform operator control plane. It is intentionally separate from tenant workspaces and storefront sessions.

## Current implementation boundary

The platform API exposes a permission-guarded tenant directory and tenant detail lookup under:

- `GET /v1/admin/platform/tenants` — bounded pagination and lifecycle status filter; requires `tenant.list`.
- `GET /v1/admin/platform/tenants/:tenantId` — read-only tenant details; requires `tenant.read`.
- `PATCH /v1/admin/platform/tenants/:tenantId/lifecycle` — audited suspend, restore, and soft-close; requires the matching lifecycle permission.

The frontend is not yet implemented. Do not expose platform routes through a tenant workspace or storefront UI. The eventual superadmin UI must authenticate through Better Auth, use same-origin secure session cookies, and rely on server-side API permission checks rather than client-side role checks.

## Planned UI

1. Platform overview and tenant directory.
2. Tenant detail, lifecycle history, owner assignment and entitlements.
3. Module catalogue and tenant configuration.
4. Audit history and usage visibility.

Tenant creation remains in the existing Better Auth organization provisioning flow; do not add a competing creation path.

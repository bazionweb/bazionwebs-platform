# Bazion Superadmin Application

The superadmin application is the platform operator control plane, separate from tenant workspaces and storefront sessions.

## Run locally

- Admin UI: `pnpm --filter @bazion/admin dev` (port 3001).
- API: `pnpm --filter @bazion/api dev` (port 4000).
- Configure `API_BASE_URL=http://localhost:4000` for the admin app.

The Next.js app proxies `/v1/*` and `/api/auth/*` to the API. Server-rendered platform reads forward the incoming session cookie server-to-server; browser mutations use same-origin requests. Do not expose API secrets to browser code.

## Implemented

- `GET /v1/admin/platform/tenants` — bounded pagination and lifecycle status filter; requires `tenant.list`.
- `GET /v1/admin/platform/tenants/:tenantId` — read-only tenant details; requires `tenant.read`.
- `PATCH /v1/admin/platform/tenants/:tenantId/lifecycle` — audited suspend, restore, and soft-close; requires the matching lifecycle permission.
- Overview/tenant directory, status filtering, page navigation, tenant detail, Better Auth email/password sign-in, and lifecycle controls.

Search currently filters the loaded page only. The API does not yet provide full-text search. The UI intentionally displays registry metadata only.

## Security boundary

- The UI is not an authorization boundary. The API checks platform permissions on every request.
- A tenant workspace role does not grant platform access.
- Tenant IDs are identifiers, never authority.
- Lifecycle changes are audited; closing is terminal and requires a suspended tenant.
- Tenant creation remains in the existing Better Auth organization provisioning flow. Do not add a competing creation path.

## Next modules

Owner assignment and transfer, module catalogue and tenant entitlements, tenant settings, audit history and usage visibility are not yet implemented. Implement each as separately permission-checked and audited API operations before exposing controls in the UI.

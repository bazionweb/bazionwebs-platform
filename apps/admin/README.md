# Bazion Superadmin Application

The superadmin application is the platform operator control plane, separate from tenant workspaces and storefront sessions.

## Run locally

- Admin UI: `pnpm --filter @bazion/admin dev` (port 3001).
- API: `pnpm --filter @bazion/api dev` (port 4000).
- Configure `API_BASE_URL=http://localhost:4000` for the admin app.

The Next.js app proxies `/v1/*` and `/api/auth/*` to the API. Server-rendered platform reads forward the incoming session cookie server-to-server; browser mutations use same-origin requests. Do not expose API secrets to browser code. In each environment, include the admin origin (for example, `https://admin.bazionweb.com`) in both `CORS_ORIGINS` and `BETTER_AUTH_TRUSTED_ORIGINS`; otherwise the API's origin and Better Auth checks will reject sign-in or lifecycle mutations.

## Implemented

- `GET /v1/admin/platform/tenants` and `GET /v1/admin/platform/tenants/:tenantId` — permission-checked tenant directory and detail metadata.
- `PATCH /v1/admin/platform/tenants/:tenantId/lifecycle` — audited suspend, restore and soft-close transitions.
- `GET /v1/admin/platform/tenants/:tenantId/owner-candidates` and `POST /v1/admin/platform/tenants/:tenantId/owner` — platform-owner-only verified member selection, initial assignment and atomic audited transfer.
- `GET /v1/admin/platform/modules` and tenant module endpoints — manifest-backed catalogue, effective tenant entitlements and audited enable/disable overrides.
- Tenant settings GET/PATCH endpoints — validated, versioned configuration with optimistic concurrency.
- Tenant audit history and usage endpoints — append-only audit reads and live member/product/order counters.
- Superadmin tenant directory, tenant detail, lifecycle, ownership, module, configuration, audit and usage interfaces.
- Better Auth email/password sign-in and server-side session forwarding.

The module catalogue is currently a runtime snapshot of the checked-in manifests for the seven platform modules. Planned modules are visible but cannot be activated. Existing tenants retain the commerce and analytics defaults unless an explicit entitlement override is saved. The commerce routes enforce the commerce entitlement. Usage reporting currently covers member, product and order counts; storage, bandwidth and API-request metering are not yet collected.

## Security boundary

- The UI is not an authorization boundary. The API checks platform permissions on every request.
- A tenant workspace role does not grant platform access.
- Tenant IDs are identifiers, never authority.
- Lifecycle changes are audited; closing is terminal and requires a suspended tenant.
- Tenant creation remains in the existing Better Auth organization provisioning flow. Do not add a competing creation path.

## Remaining platform work

- Add full API-request, storage, bandwidth, deployment and job usage metering.
- Add audit-history pagination/action filters in the UI.
- Integrate entitlements into future modules as their APIs are implemented.
- Add tenant domain verification management and platform billing when those foundations are ready.

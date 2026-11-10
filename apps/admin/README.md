# Bazion Superadmin Application

The superadmin application is the platform operator control plane, with its own root URL separate from tenant workspaces.

## Run locally

- Platform control plane: `pnpm dev:platform` (port 3001), or start it with the GMFC environment using `pnpm dev:gmfc`.
- Platform dashboard root: `http://localhost:3001/`.
- Tenant website and tenant admin: `http://localhost:3100/` and `http://localhost:3100/admin`.
- API: `pnpm --filter @bazion/api dev` (port 4000).
- Configure `API_BASE_URL=http://localhost:4000` for the admin app.

The Next.js app proxies `/v1/*` and `/api/auth/*` to the API. Server-rendered platform reads forward the incoming session cookie server-to-server; browser mutations use same-origin requests. Do not expose API secrets to browser code. In production, deploy this app separately at a platform-owned host such as `https://platform.bazionweb.com`, set `PLATFORM_CONSOLE_URL` to that origin in the storefront, and include it in both `CORS_ORIGINS` and `BETTER_AUTH_TRUSTED_ORIGINS`. Tenant websites and their admin paths remain on their own tenant hosts. The platform dashboard must not be mounted under a tenant's domain.

## Implemented

- `GET /v1/admin/platform/tenants` and `GET /v1/admin/platform/tenants/:tenantId` — permission-checked tenant directory and detail metadata.
- `PATCH /v1/admin/platform/tenants/:tenantId/lifecycle` — audited suspend, restore and soft-close transitions.
- `GET /v1/admin/platform/tenants/:tenantId/owner-candidates` and `POST /v1/admin/platform/tenants/:tenantId/owner` — platform-owner-only verified member selection, initial assignment and atomic audited transfer.
- `GET /v1/admin/platform/modules` and tenant module endpoints — manifest-backed catalogue, effective tenant entitlements and audited enable/disable overrides.
- Tenant settings GET/PATCH endpoints — validated, versioned configuration with optimistic concurrency.
- Tenant domain endpoints — issue/rotate a DNS TXT challenge, verify ownership, list domains and disable a domain; the tenant detail UI shows challenge instructions and verification state.
- Tenant audit history and usage endpoints — append-only audit reads and live member/product/order counters.
- Superadmin tenant directory, tenant detail, lifecycle, ownership, module, configuration, audit and usage interfaces.
- Better Auth email/password sign-in and server-side session forwarding.

The API currently maintains a runtime catalogue of eight entries; it is not generated from module manifests, so keep the two sources aligned as part of module work. Planned modules are visible but cannot be activated. Existing tenants retain the commerce and analytics defaults unless an explicit entitlement override is saved. Commerce and church/ministry routes enforce their tenant entitlements; analytics has a permission gate but is not yet covered by the same module-entitlement check. Usage reporting currently covers member, product and order counts; storage, bandwidth and API-request metering are not yet collected.

## Security boundary

- The UI is not an authorization boundary. The API checks platform permissions on every request.
- The dedicated control-plane pages verify the signed-in identity on the server and require the global `platform_owner` role before loading the tenant directory. API authorization remains mandatory for each operation.
- A tenant workspace role does not grant platform access.
- The tenant `/admin` experience is scoped by active tenant membership. Workspace switching lists only organizations where that user is a member; tenant team controls never grant or enumerate other tenants.
- Tenant IDs are identifiers, never authority.
- Lifecycle changes are audited; closing is terminal and requires a suspended tenant.
- Tenant creation remains in the existing Better Auth organization provisioning flow. Do not add a competing creation path.

## Remaining platform work

- Add full API-request, storage, bandwidth, deployment and job usage metering.
- Add audit-history pagination/action filters in the UI.
- Integrate entitlements into future modules as their APIs are implemented.
- Complete production domain routing, TLS issuance/renewal, redirects and handover/removal with the chosen hosting provider; add platform billing when those foundations are ready.

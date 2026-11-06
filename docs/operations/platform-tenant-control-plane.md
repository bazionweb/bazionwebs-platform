# Platform tenant control plane

This document describes the superadmin tenant controls backed by the platform API.

## Ownership

Owner candidates are members of the tenant's mapped Better Auth organization. The owner-selection endpoint is protected by `tenant.owner.assign`, which is restricted to `platform_owner`. Only verified email accounts are eligible. The transfer operation locks the organization and membership rows, revalidates the target inside the transaction, promotes the new owner, and demotes the prior owner to administrator while preserving other role grants. Generic invitation and member-role APIs cannot grant the owner role.

## Module catalogue and effective entitlements

The API exposes a versioned catalogue snapshot sourced from the module manifests. The runtime catalog deliberately distinguishes tenant-assignable modules from required platform capabilities and planned modules. A planned or platform-owned module cannot be activated through tenant entitlements.

The `tenant_module_entitlements` table stores explicit per-tenant overrides. When no override exists, the catalogue default applies. Current defaults keep commerce and analytics enabled for existing tenants; platform identity, audit and notifications remain platform capabilities. The current commerce API checks the effective commerce entitlement before serving tenant routes. Future modules must add the same server-side gate before they can be safely exposed as toggles.

Disabling a module does not delete tenant data. It blocks only entrypoints that enforce the entitlement gate. Do not expose a module toggle until its API entrypoints and background jobs enforce the same check.

## Tenant configuration

Tenant configuration is stored separately from the tenant registry in `tenant_platform_settings`. The API accepts only a strict allowlist of locale, time zone, default currency, brand display name, primary color and support email fields. Currency updates are written to the existing tenant registry column in the same transaction as the versioned settings update; the currency is not duplicated in the settings JSON. Updates require an expected version; the tenant registry row is locked during the update and stale versions return HTTP 409. The settings endpoint never accepts arbitrary JSON keys.

## Audit history

Platform audit events remain append-only. The new tenant audit endpoint only reads events scoped to the requested tenant and requires `audit.read`. The migration grants SELECT to the API database role; authorization remains enforced on every API request. Do not expose raw request bodies, credentials, message payloads or personal contact details through audit metadata.

## Usage reporting

The current usage view derives member counts from Better Auth tenant memberships and product/order counts from the tenant-scoped database transaction. It is a live count snapshot, not billing-grade metering. Storage bytes, bandwidth, API requests, background-job volume and deployment usage are intentionally reported as unavailable until dedicated metering is implemented.

## Database and operations

Migration `0007_platform_tenant_control_plane.sql` creates platform-owned entitlement and configuration tables and grants the read-only resolver and narrow tenant provisioner roles only the required privileges. It grants the application role SELECT on module entitlements for runtime feature checks and SELECT on the append-only audit table for the permission-checked audit reader. These registry tables are accessed through permission-checked platform services and are not tenant business tables. The audit table remains immutable; only SELECT was added for the API reader.

Before production rollout:
1. Apply database migrations.
2. Verify the tenant resolver and provisioner role grants.
3. Confirm the new endpoints are deployed behind the platform admin origin and trusted-origin configuration.
4. Confirm all future module APIs/jobs enforce the entitlement they expose.
5. Review usage definitions before using them for billing or plan enforcement.

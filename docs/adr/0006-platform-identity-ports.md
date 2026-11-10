# ADR 0006: Platform identity application ports

- Status: accepted
- Date: 10 November 2026
- Scope: first extraction slice for `platform-identity`

## Context

Tenant identity currently combines Better Auth organization records, the platform tenant registry, and PostgreSQL adapters inside `@bazion/auth`. A crash during organization creation can leave a tenant reservation in `provisioning`. The reconciliation behavior is independent of Better Auth and PostgreSQL, but was located in the auth adapter package.

## Agreed boundary

`@bazion/platform-identity` owns identity and tenant-control-plane use cases plus provider-neutral contracts. It must not import HTTP frameworks, Better Auth, database drivers, or app code. `@bazion/auth` remains the composition and persistence adapter: it creates database pools, queries Better Auth and the tenant registry, and implements the ports.

The first port is `TenantProvisioningReconciliationPort`:

- `findStaleProvisioningTenants(staleMinutes, limit)` returns bounded tenant reservations and any existing organization mapping.
- `findOrganizationsBySlugs(slugs)` resolves organization identity by the reserved tenant slug.
- `activateTenant({ tenantId, organizationId, organizationName })` performs a conditional transition and returns `false` when the reservation changed or conflicts.

The use case owns validation of operator limits, slug matching, conflict reporting, and the rule that it never deletes reservations or overwrites a conflicting mapping. The adapter must implement activation as a conditional update. The current implementation uses independent Better Auth and tenant-registry database pools, so the operation is intentionally idempotent and does not claim a cross-database transaction.

## Adapter and authorization ownership

The platform API continues to authenticate the caller and enforce the platform permission before invoking reconciliation. The auth adapter supplies the port implementation. Better Auth setup, session validation, PostgreSQL queries, HTTP request/response types, and audit logging stay outside the domain package. Existing auth-package imports remain supported through a compatibility re-export during the transition.

## Follow-on ports

These areas remain in `@bazion/auth` until extracted as complete use cases with an adapter and authorization coverage:

- tenant lifecycle and owner assignment/transfer;
- verified-domain challenge and activation;
- tenant module entitlements and tenant settings;
- notification enqueueing for identity events.

Each follow-on interface must express domain inputs and outcomes only. It must not expose SQL rows, framework request objects, Better Auth plugin types, or provider-specific SDK types. API authorization and tenant context remain enforced at the trusted server boundary.

## Consequences

- Catalog and module manifests identify `@bazion/platform-identity` as the reusable domain package and `@bazion/auth` as its current API adapter.
- The extraction proceeds incrementally; identity persistence and Better Auth remain in the existing runtime package.
- Future extraction work must preserve conditional state transitions, audited platform access, and tenant-isolation guarantees.

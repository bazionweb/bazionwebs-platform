# ADR 0011: Runtime module catalogue sources

- Status: accepted
- Date: 10 November 2026
- Scope: module metadata and tenant entitlement catalogue

## Context

Module identity and status appeared in module manifests, `products/catalog.json`, the API's `module-catalog.ts`, and a separate default-entitlement object. This allowed runtime metadata and tenant defaults to drift. There is also a meaningful distinction between implementation dependencies (for example, Church/Ministry depends on media storage) and runtime entitlement dependencies (the tenant must have platform identity enabled).

## Decision

- `modules/*/manifest.json` owns module ID, name, version, status, tenant model, implementation entrypoints and implementation dependency edges.
- `products/catalog.json` remains the broader capability inventory. Its module status is a checked projection of module-manifest status, not another runtime source.
- `products/runtime-module-policy.json` owns runtime-only fields: operator-facing display name and description, tenant default enablement, required/non-assignable flags, tenant assignability and runtime entitlement dependency edges.
- `scripts/generate-runtime-module-catalog.mjs` combines module manifests and runtime policy into `apps/api/src/modules/admin/module-catalog.ts`. Do not hand-edit the generated file. Use `pnpm modules:generate`; `pnpm catalog:validate` checks that the committed output is current.
- Tenant entitlement fallback defaults come from this generated catalogue. Database overrides remain authoritative when present.
- Implementation dependencies and entitlement dependencies are separate graphs. A low-level dependency such as media storage must not become a tenant entitlement toggle unless it is explicitly added to runtime policy and supported by the API.

## Consequences

- Runtime identity, version, status and tenant model cannot drift silently from module manifests.
- Tenant exposure and enablement defaults remain explicit platform policy rather than being inferred from technical dependencies.
- The API catalogue is a generated source artifact checked into Git for simple runtime consumption; CI enforces deterministic parity.
- Future changes to module identity or status start in the manifest; changes to tenant availability/defaults start in runtime policy.

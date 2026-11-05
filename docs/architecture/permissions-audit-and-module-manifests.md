# Permissions and module manifests

## Permission registry

`products/permissions.json` is the versioned declaration point for authorization capabilities. Each permission has a stable ID, owning reusable module, scope, Better Auth resource/action pair, and the tenant roles that receive the grant by default.

Module teams own their permission declarations: add the permission to the registry under the module ID, then add the matching resource/action to that module's `modules/<module-id>/manifest.json`. The manifest validator rejects undeclared grants, missing module manifests, duplicate permission IDs/tuples, unknown modules/roles, and invalid manifest versions.

The Better Auth adapter remains static at runtime. `packages/auth/src/permissions.ts` expresses the runtime statement and role definitions supported by Better Auth; its tests compare them to the registry so authorization code cannot silently drift from the module-owned catalogue. The registry is not a source of dynamic runtime grants. New permissions are introduced by code review, migration/API authorization changes and tests.

Run:

```sh
pnpm catalog:validate
pnpm --filter @bazion/auth test
```

## Module manifests

Module manifests are versioned capability contracts under `modules/<module-id>/manifest.json`. They describe entrypoints, tenant ownership model, permission declarations, dependencies and operational requirements. They do not imply that a planned module is already implemented. The manifest schema is `products/module-manifest.schema.json`; module `version` follows semantic versioning.

A module manifest may declare no entrypoints while it is planned. Before marking a module stable, require implementation, API/UI as applicable, tenant/RLS proof, permission tests, migration/rollback guidance, observability, retention and recovery evidence.

## Audit events

`@bazion/audit` defines a small append-only audit-event contract and PostgreSQL writer. The platform table stores actor type/ID/role, optional tenant, action, resource, outcome, request correlation ID, timestamp and restricted scalar metadata. The database rejects UPDATE/DELETE through a trigger and the runtime API role receives INSERT only.

Do not log credentials, one-time URLs/tokens, contact details, raw request/response bodies or provider payloads. The writer rejects common sensitive metadata key names. Read access is intentionally not granted to the application role until a separately permissioned audit reader is implemented.

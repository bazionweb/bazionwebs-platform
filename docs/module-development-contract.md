# Reusable module development contract

Reviewed 10 November 2026. This contract governs reusable product modules in the Bazion monorepo. A module boundary is a code and ownership boundary; it does not require a separate Git repository or deployment.

## Source layout

- `modules/<module-id>/manifest.json` declares product ownership, implementation mode, permissions, tenant model, dependencies, data tables, operations, tests and documentation.
- `packages/*` contains reusable workspace packages. A package owns framework-independent domain rules or a stable application interface and can be consumed by multiple apps.
- `apps/api` owns HTTP adapters: request validation, session/tenant authorization, request-to-use-case mapping and response formatting. Business rules should live behind package interfaces.
- `apps/storefront` and `apps/admin` own Next.js composition and presentation. Shared UI belongs in `packages/ui`; tenant content and branding come from tenant configuration.
- `packages/database` is the central schema and migration runner. Module manifests declare the tables and migration files a module owns. A single migration integrator assigns unique migration numbers.
- `solutions/*/manifest.json` composes modules, roles, navigation and defaults. Tenant-specific values and uploaded assets belong to tenant records, not shared module code or a client-name fallback.

`modules/*` currently stores manifests; it is not included as a pnpm workspace. Runtime implementations are deliberately marked with one of these modes so the current code boundary and extraction work are visible:

| Mode | Meaning | Current use |
|---|---|---|
| `workspace-package` | Reusable runtime code is in a package under `packages/*` or `apps/*` and named in the manifest. | Auth, analytics, audit and notifications. |
| `host-adapter` | The implementation is still hosted inside an app. Keep the app adapter thin and extract reusable logic as a bounded step. | Church/ministry API and storefront composition. |
| `hybrid` | A reusable package supplies domain rules; app code provides the HTTP or UI adapter. | Commerce domain plus API. |
| `manifest-only` | Product metadata exists, but no runtime implementation is available. | Planned website content and contacts modules. |

Do not label a module `stable` while its reusable business logic is hidden in an app adapter or its declared tests, docs, data ownership and permissions are incomplete.

## Required module contract

Every module manifest must declare:

1. Stable module ID, owner, version and implementation mode.
2. Existing entrypoint paths and workspace package name when package-backed.
3. Tenant ownership model and permission actions, matching the permission registry.
4. Module-owned tables, migration filenames, and forced RLS for tenant-scoped tables.
5. Declared dependencies, provider ports and emitted/consumed events where applicable.
6. Existing test and documentation paths.
7. Logging/metrics claims, retention and recovery approach, and safe enable/disable behavior.

The manifest validator checks package names against actual workspace packages and checks that source, test, documentation and migration paths exist. Run `pnpm modules:validate` when adding or changing a module.

## Change and release rules

- Prefer a complete vertical slice over new empty packages or one package per advertised capability.
- Domain packages must not import Fastify, Next.js apps, another client's configuration, or provider SDK types. Put provider details behind Bazion-owned ports.
- Resolve tenant identity from trusted server context. Every tenant query also filters by tenant ID; RLS and tenant-aware foreign keys remain defense in depth.
- Every tenant-configurable feature must have a neutral default and tests proving two tenant configurations cannot inherit one another's content or credentials.
- A tenant module toggle is valid only when relevant API routes enforce it and disabling the module preserves authorized export/retention behavior.
- A module change includes focused unit tests, authorization tests, tenant-isolation tests when data is involved, migration upgrade checks, and a rollback/disable note.
- Keep source in this monorepo while Bazion is the primary consumer. Publish a package only after its interface is stable, versioned, documented, and a second app/project consumes it independently. Split its Git repository only when ownership or release cadence is genuinely independent.

## Adoption order

1. Keep all existing manifests explicit about their implementation mode and validate that each reference points to real code.
2. Use church/ministry as the first boundary pilot: keep Fastify and Next.js as adapters, extract bounded reusable logic rather than moving the whole route file at once, and keep Global Mission content in tenant configuration. The first extracted rule is tenant-scoped unique content slugs in `@bazion/church-ministry-domain`; image signature detection and safe upload filenames now belong to the reusable `@bazion/storage` package, while request authorization and upload limits stay in the API adapter.
3. Provision a second ministry with different identity and content. The PostgreSQL isolation suite now verifies separate ministry profiles, saved public-site settings, sermons, and module overrides across two tenant fixtures. Storefront default tests and API route tests cover neutral branding, tenant-prefixed media, and disabled-module gating. Still run an end-to-end second-tenant onboarding check in the running site before declaring the pilot passed.
4. Apply the same contract to commerce and the next module only after the pilot passes the module and tenant-isolation checks.
5. Revisit package publication after an independent consumer exists; do not turn the current module catalogue into 37 separately released repositories.

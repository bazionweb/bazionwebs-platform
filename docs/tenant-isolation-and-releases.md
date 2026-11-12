# Tenant database and release isolation

## Decision

- Keep shared-RLS PostgreSQL as the default tier for cost-efficient tenants.
- Offer a dedicated business-data database tier when a tenant's contract, risk profile or workload requires a smaller data blast radius.
- Keep identity, tenant-to-host resolution, tenant metadata, platform entitlements and platform audit in a protected control plane. A tenant binding stores secret-manager references only; it never stores credentials. The current deployment keeps these logical control-plane records in the same physical PostgreSQL database as shared-tier business data under separate runtime roles.
- Build one immutable artifact per source revision. Promote by digest through staging, canary and stable runtime groups. A tenant that needs a freeze can pin to a previously validated digest.
- Do not activate a dedicated database or claim a release pin until a provider adapter has provisioned it, migrations and health checks have passed, and the control plane confirms the binding as ready.

## Isolation boundaries

### Shared database

Shared-tier tenants use the existing explicit tenant predicates and PostgreSQL row-level security. Each request must resolve tenant identity from a verified host or authenticated organization membership; a request body or query parameter is never authority. Tenant data queries set the transaction-local `app.tenant_id`. The shared model remains appropriate for most small tenants when the runtime role cannot bypass RLS and tenant-isolation checks remain in CI.

### Dedicated database

Dedicated-tier tenants receive separate runtime and migration credentials. Runtime credentials are least-privilege and cannot run DDL. The control plane stores secret references and a schema version, not connection strings. The API reads the binding with the read-only tenant-directory role, obtains the secret through a provider-neutral secret adapter, and uses a bounded pool cache. Missing, failed, draining or not-yet-migrated bindings fail closed; they never silently fall back to the shared database. Before a tenant transaction begins, the target database must contain exactly one tenant row matching the requested tenant and every migration registered for the running release.

Provisioning must create the database, apply every migration in the database package's required migration registry, create the one local tenant identity row required by current foreign keys, verify required tables and RLS, seed only tenant-owned configuration, and mark the binding ready only after checks pass. The API derives its required schema version from the latest migration in that registry and rejects stale `TENANT_DATABASE_SCHEMA_VERSION` configuration or any dedicated database missing a registered migration. Production preflight requires that setting and verifies it matches the release. Local development supports `env://TENANT_DATABASE_<NAME>` references. Production API startup installs `DockerSecretTenantDatabaseSecretResolver`; each ready dedicated binding must contain a tenant-matched reference such as `docker-secret://bazion-tenant-db-<tenant-uuid>`. The adapter reads only that tenant's mounted `bazion-tenant-db-<tenant-uuid>` file, expects a JSON object containing exactly `DATABASE_URL`, rejects symlinks and unsafe file permissions, and never logs the credential. Grant or mount each secret only to the API service that needs it. Docker Swarm secrets are encrypted in transit and at rest in Swarm's Raft log and are mounted into authorized service tasks; use a secrets-capable production runtime and verify its mount behavior before enabling dedicated bindings. Rotations should use a new secret name/reference and update the binding so the API rebuilds its cached pool against the new credential. Backups and restore drills run per dedicated database. Central auth and platform audit remain available independently of a tenant data-plane outage.

## Release process

1. CI builds API and storefront artifacts once from a commit and publishes immutable SHA-256 image digests with a release manifest (source revision, artifact digests, and schema compatibility range).
2. Deploy the candidate to a production-like staging tenant and run health and smoke checks.
3. Move a small canary tenant group to the candidate digest. Watch error rate, latency, database failures and tenant-specific business outcomes.
4. Promote deliberately to the stable group. Record the actor, artifact, tenant group, approval and outcome in append-only audit events.
5. If signals breach their thresholds, stop promotion and route affected tenants to the previous digest. Treat database rollback separately: prefer expand/contract migrations and forward fixes; restore backups only through a reviewed recovery procedure.

Release rings are deployment targets, not just flags. Tenant module entitlements can switch a capability on or off, but they cannot make an old code version run. Per-tenant pins require independent runtime targets plus a host/ingress adapter capable of routing the tenant to the chosen digest.

## Migration compatibility

Use expand/contract changes: add nullable columns or new tables first, deploy code that can read both forms and safely write the new form, backfill in bounded batches, then remove old schema only after every runtime and tenant has moved past the compatibility window. Each database records its applied migration version. A shared database migration changes the schema for all shared-tier tenants, so shared migrations must preserve compatibility with the currently active and candidate artifacts.

## Provider-neutral interfaces

The platform contracts define database binding/secret lookup, provisioning/migration/verification/backup operations and deployment staging/traffic-shift/promotion/rollback operations. The API routes ready dedicated bindings and preserves shared RLS as the default. The production API now has a mounted Docker secret adapter for dedicated database credentials, but the repository still has no production database provisioning or release-routing adapter and no admin workflow to create dedicated databases. Dedicated routing therefore remains unavailable until operations provisions the database, applies migrations, creates and mounts its secret, and records a verified ready binding. Release pins remain contracts only; there is no release-routing adapter. Local Docker Compose is for development.

## Research basis

- Google SRE describes canarying as a partial, time-limited deployment that is evaluated before proceeding, and calls for reproducible artifacts, automated builds and small deployments: [Canarying Releases](https://sre.google/workbook/canarying-releases/).
- AWS Well-Architected recommends safe rollout strategies, explicit rollback plans, pre-production validation and automated rollback: [Operational Excellence Pillar](https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/ops_mitigate_deployment_risks.html).
- PostgreSQL row security is default-deny after enabling RLS, but table owners and roles with `BYPASSRLS` can bypass it: [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- Kubernetes documents that a digest uniquely identifies an image version, unlike a mutable tag: [Container Images](https://kubernetes.io/docs/concepts/containers/images/#image-digests).

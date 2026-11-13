# Database Migrations, Role Least-Privilege & Recovery Guide

This guide governs schema migrations, PostgreSQL role isolation, row-level security (RLS), and backup/restore verification for `@bazion/database`.

---

## 1. Append-Only Migration Rules

1. **Dedicated migrator credentials only:** Migrations must execute using `MIGRATION_DATABASE_URL` via `pnpm --filter @bazion/database migrate` ([`packages/database/scripts/migrate.ts`](../../packages/database/scripts/migrate.ts)). Never grant DDL privileges to `bazion_app`, `bazion_auth_runtime`, `bazion_notification_enqueuer`, `bazion_notification_worker`, `bazion_product_provisioner`, `bazion_tenant_provisioner`, or `bazion_hosting_reconciler`.
2. **Strictly append-only:** Applied SQL files recorded in `public.schema_migrations` must never be edited, renumbered, or deleted (for example, both historical `0018_*` filenames remain registered because deployed databases record exact filenames in `schema_migrations`). Any schema fix or privilege tightening requires a **new** numbered migration (`0024_*`, etc.) appended to `requiredDatabaseMigrations` in [`packages/database/src/migration-registry.ts`](../../packages/database/src/migration-registry.ts).
3. **Manifest schema synchronization:** Whenever `currentDatabaseSchemaVersion` changes, update product manifests (`products/*/manifest.json` `databaseSchemaVersion`) and run `pnpm catalog:validate` to verify synchronization.

---

## 2. Database Role Separation & Least Privilege

| Role | Responsibility | Key Boundaries |
|---|---|---|
| `bazion_app` | Primary API tenant & application runtime | Enforces `FORCE ROW LEVEL SECURITY` scoped by `app.tenant_id` (`app_tenant_id_or_null()`). May `SELECT` on `public.platform_audit_events` for admin inspection, but cannot `UPDATE`/`DELETE` audit logs. |
| `bazion_auth_runtime` | Better Auth & OIDC core identity (`user`, `session`, `account`, `verification`, OIDC tables) | Narrow grants only; cannot read/write commerce, church domain, provisioning saga, or archive tables. |
| `bazion_tenant_provisioner` | Dedicated tenant provisioning / onboarding / lifecycle helper | Manages tenant creation & verified-domain binding; isolated from commerce ledger internals. |
| `bazion_product_provisioner` | Commercial provisioning receiver, saga worker, installation registry, lifecycle & archive service (`PRODUCT_PROVISIONER_DATABASE_URL`) | Owns CRUD on `product_installations`, `installation_configuration_versions` (`INSERT`/`SELECT` only — immutable history), `product_provisioning_*`, `commercial_lifecycle_*`, `installation_offboarding_archives`, plus narrow read projection on `tenant_hosting_deployments` and `tenant_domains`. Has **no access** to `commerce_*` payment/order tables or raw `auth` secret columns. |
| `bazion_hosting_reconciler` | Dedicated Dokploy/hosting worker | Limited to `tenant_hosting_*` tables; zero access to auth sessions or commercial provisioning inbox/saga tables. |
| `bazion_notification_enqueuer` / `bazion_notification_worker` | Notification outbox enqueue & delivery | Limited to notification outbox/delivery tables only. |

---

## 3. Production Preflight & Drift Checks

Before starting production `@bazion/api` or promoting a deployment, run:

```bash
pnpm --filter @bazion/database preflight
```

[`packages/database/src/production-preflight.ts`](../../packages/database/src/production-preflight.ts) fails closed on:
- Missing or unapplied migrations in `requiredDatabaseMigrations` (exact match against `public.schema_migrations`).
- Database runtime URLs connecting as superuser, table owner (`BYPASSRLS`), or outside expected role identities (`bazion_app`, `bazion_tenant_provisioner`, `bazion_product_provisioner`, `bazion_hosting_reconciler`).
- Missing `FORCE ROW LEVEL SECURITY` (`relforcerowsecurity`) on tenant-isolated tables.
- Impermissible grants (e.g., `bazion_app` `UPDATE`/`DELETE` on `platform_audit_events`, or `bazion_product_provisioner` access to commerce tables / `UPDATE` on `installation_configuration_versions`).
- Missing production security env settings (non-HTTPS callback URLs, missing OIDC signing/BFF secrets, non-absolute `PRIVATE_ARCHIVE_DIR`, non-`s3` media driver in production).

---

## 4. Backup, Restore & Partial-Failure Recovery

1. **Snapshot & Isolated Restore Drill:**
   - Capture snapshot: `pg_dump --format=custom "$MIGRATION_DATABASE_URL" -f bazion_platform.dump`
   - Restore to clean isolated DB: `pg_restore --clean --if-exists --no-owner -d "$RECOVERY_DATABASE_URL" bazion_platform.dump`
   - Re-verify forward migrations and security posture:
     ```bash
     MIGRATION_DATABASE_URL="$RECOVERY_DATABASE_URL" pnpm --filter @bazion/database migrate
     pnpm --filter @bazion/database preflight
     pnpm production:preflight
     ```
2. **Failed Migration Transaction Recovery:**
   - Every migration file executes inside an explicit `BEGIN` ... `COMMIT` transaction in `scripts/migrate.ts`; any SQL error rolls back the DDL statement automatically without inserting into `public.schema_migrations`.
   - Fix the defect by correcting a failing unapplied script (only if never applied anywhere) or adding the follow-up migration after reviewing `public.schema_migrations`.
3. **Partial Saga / Outbox Recovery:**
   - Expired saga leases (`lease_expires_at < now()`) are reclaimed with incremented `fencing_token` via `POST /v1/admin/platform/commercial-provisioning/operations/:operationId/resume` or the worker loop.
   - `unknown` / interrupted external steps enter `compensation_required` and inspect provider state (`POST .../reconcile` or `complete-manual-review`) before continuing forward or executing reverse compensation.
   - Dead-letter status callbacks are re-driven via `POST /v1/admin/platform/commercial-provisioning/status-outbox/:outboxId/replay`.

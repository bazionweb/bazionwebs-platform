# Commercial Provisioning Operations, Recovery & Cutover Runbook

This runbook governs Phase 7 day-2 operations, staging pilot verification, canary rollout, disaster recovery drills, and legacy-provisioning cutover for `@bazion/api` and `@bazion/admin`.

---

## 1. Safety Invariants & Staging Pilot Isolation

- **Production allowlist stays closed by default:** `platformProvisioningOfferBindings` in [`offer-resolution.ts`](../../apps/api/src/modules/commercial-provisioning/offer-resolution.ts) remains `[]` until manifests reach `status: "stable"`.
- **Staging pilot binding:** Setting `COMMERCIAL_PROVISIONING_PILOT_MODE=staging_pilot` (blocked from starting in `NODE_ENV=production`) activates the single pilot binding in [`pilot-cutover.ts`](../../apps/api/src/modules/commercial-provisioning/pilot-cutover.ts):
  - Commercial offer: `website-launch@1.0.0` (verified in [`commercial-offerings.json`](../../products/commercial-offerings.json))
  - Platform release triad: `church-ministry@1.0.0` (`product`, `solution` with `readiness: "buildable"`, `template`)
  - Distribution mode: `shared-managed` only (`COMMERCIAL_PROVISIONING_HOSTING_MUTATIONS_ENABLED=false` guarantees Dokploy/dedicated hosting providers are never mutated)
  - Optional customer cohort restriction: `COMMERCIAL_PROVISIONING_PILOT_CUSTOMERS=cust-1,cust-2`
- **Strict redaction & correlation propagation:**
  - Every API request and commercial status/lifecycle outbox callback carries a valid UUID in `X-Correlation-Id` (and `X-Bazion-Correlation-Id` on callbacks).
  - Secrets, payment payloads, auth claims, raw provider payloads, database URLs, and contact emails/phones are redacted from HTTP request/response logs via `fastifySensitiveRedactionPaths` in Fastify logger config, and sanitized via `redactStructuredContext` / `emitStructuredProvisioningLog` for structured provisioning logs and validation issue responses; callers also omit PII from `platform_audit_events` metadata.

---

## 2. SLOs, Metrics & Alert Response

Query live metrics at `/operations/cutover` or `GET /v1/admin/platform/commercial-provisioning/slo-alerts` (`platform_owner` or `platform_admin`).

| Alert / Section ID | Metric & Default Threshold | Severity | Owner | Immediate Operator Action |
|---|---|---|---|---|
| `command-acceptance-failures` | `commandAcceptanceSuccessRate < 0.99` | Critical | `platform_ops` | Check M2M bearer secret/issuer/audience, offer cohort filters, and PostgreSQL availability (`bazion_product_provisioner`). |
| `command-acceptance-latency` | `commandAcceptanceP95Ms > 1500` | Warning | `platform_ops` | Inspect PostgreSQL lock contention on `product_provisioning_inbox` / `product_provisioning_operations`. |
| `saga-recovery-and-resume` | `provisionReadyP95Seconds > 300` or `maxOperationLeaseAgeSeconds > 180` | Warning / Critical | `platform_ops` | Confirm `commercial-status-worker` is running (`COMMERCIAL_PROVISIONING_WORKER_ENABLED=true`). Use `/operations` **Resume** once stale lease expires. |
| `outbox-replay` | `callbackMaxLagSeconds > 120` or `deadLetterCount > 0` | Warning / Critical | `platform_ops` | Check Bazionweb callback URL health & HMAC secret parity, then trigger audited outbox replay (Section 3.1). |
| `safe-compensation` | `compensationRequiredCount > 0` | Critical | `platform_ops` | Halt retries; follow manual review & safe compensation playbook (Section 3.3). |
| `reconciliation-exceptions` | `reconciliationDriftCount > 0` | Critical | Routed per exception | Run 5-way reconciliation report and clear mismatches by owner (Section 3.4). |

---

## 3. Operator Recovery Procedures

### 3.1 Replay Status or Lifecycle Outbox Callbacks {#outbox-replay}

1. Open **Provisioning Sagas** (`/operations`) or **SLOs & Cutover** (`/operations/cutover`) to identify the failing operation / outbox ID.
2. Verify Bazionweb callback endpoint reachability and signing secret (`COMMERCIAL_PROVISIONING_CALLBACK_SIGNING_SECRET`).
3. Replay status outbox callback (`platform_owner` only):
   - `POST /v1/admin/platform/commercial-provisioning/status-outbox/:outboxId/replay`
4. Lifecycle outbox recovery:
   - `PlatformLifecycleOutboxDispatcher.replayOutboxEntry(outboxId)` resets dead/failed lifecycle outbox entries programmatically in `bazion_product_provisioner`; no separate HTTP `/lifecycle-outbox/:outboxId/replay` route is exposed in v1.
5. Confirm status moves from `dead` -> `pending` -> `delivered` and dead-letter alert clears.

### 3.2 Retry, Fenced Resume, and State Reconcile {#saga-recovery-and-resume}

- **Transient failure (`status = failed`, `failureDisposition = retry`):**
  1. Confirm downstream dependency recovery (database, entitlement store, or network).
  2. Click **Retry** in `/operations` (or `POST /v1/admin/platform/commercial-provisioning/operations/:operationId/retry` with an audited reason >= 8 chars).
- **Worker crash / expired lease (fenced saga recovery):**
  1. Wait until `leaseExpiresAt` passes (`PostgresProvisioningSagaJournal` defaults to `30s`; `commercial-status-worker` configures `120s` via `COMMERCIAL_STATUS_WORKER_LEASE_SECONDS`).
  2. Click **Resume** (`POST .../operations/:operationId/resume`). A monotonically higher `fencing_token` prevents stale zombie workers from overwriting state.
- **External state uncertainty:**
  1. Click **Reconcile** (`POST .../operations/:operationId/reconcile`) to query adapters idempotently before retrying forward.

### 3.3 Manual Review & Safe Compensation {#safe-compensation}

Use ONLY when an operation enters `compensation_required` (e.g., partial external failure or ambiguous side-effect state):

1. Inspect **Step Attempts Journal** and external tenant / hosting deployment state in `/operations`.
2. **If forward resources are valid and healthy:** Submit **Complete Manual Review** with resolution `resume_forward` and a factual verification note (records `platform_audit_events`).
3. **If failure is confirmed terminal before activation:** Submit **Complete Manual Review** with `mark_failed` or `trigger_compensate` (`platform_owner` only).
4. **Destructive Compensation (`compensate`):**
   - Check **"Confirm destructive compensation (owner only)"** and enter an audited reason (`>= 8` characters).
   - Compensation runs idempotently in reverse (`release_hosting_deployment` -> `revoke_module_entitlements` -> `suspend_or_close_tenant`) and leaves an immutable audit trail without deleting historical ledger/invoice records.

### 3.4 Five-Way Cross-Entity Reconciliation & Owner Routing {#reconciliation-exceptions}

Run live cross-entity checks via:
- `GET /v1/admin/platform/commercial-provisioning/reconciliation-exceptions` (platform-side state)
- `POST /v1/admin/platform/commercial-provisioning/reconciliation-exceptions` or `POST /v1/internal/commercial/reconciliation/report` with Bazionweb paid-order snapshots (`paidOrders[]`, zero customer PII) for five-way verification:
  **Paid Orders <-> Operations <-> Installations <-> Module Entitlements <-> `tenant_hosting_deployments`**.

Default exception routing:
- `commercial_billing`: Missing operation for paid order, stale billing projection status, orphan operation missing paid order.
- `hosting_control`: Dedicated deployment missing or drifted, OR unexpected `tenant_hosting_deployments` row created for a `shared-managed` installation.
- `customer_support`: Missing 30-day archive manifest for an offboarded installation.
- `platform_ops`: Stale leases, missing module entitlements, tenant/installation status drift, dual-read tenant divergence, `compensation_required`, or dead-letter outbox backlogs.

---

## 4. Customer Support Communication Playbook

When communicating with customers about provisioning or lifecycle delays:
- **Never share internal UUIDs, correlation tokens, stack traces, database error codes, or provider resource IDs.** Reference only the public order reference and expected SLA.
- **Transient provisioning delay (> 3 minutes):** Inform the customer setup is in progress and automated recovery is active; quote an update window (15 minutes). Escalate to `platform_ops` if stuck in `compensation_required`.
- **Billing grace / suspension (`grace` -> `suspended`):** Confirm suspension only revokes runtime access while preserving configuration & data intact during grace/suspension; access restores automatically upon payment settlement (`reactivate`).
- **Offboarding & 30-day archive restore:** Confirm configuration snapshots remain restorable in private encrypted archive storage for 30 days (`POST /v1/admin/platform/tenants/:tenantId/installations/:installationId/restore`) before automated purge eligibility.

---

## 5. Disaster Recovery & Restoration Drills

Run both drills in staging before canary, and every 30 days thereafter:

### 5.1 Database Backup & Restore Verification Drill
1. Take a clean logical/physical snapshot of `bazion_platform` (`pg_dump --format=custom`).
2. Restore into an isolated recovery database (`pg_restore`).
3. Run `pnpm --filter @bazion/database migrate` and `pnpm production:preflight` to verify schema version, triggers, RLS policies, and role grants (`bazion_product_provisioner`, `bazion_app`, `bazion_tenant_provisioner`).
4. Verify zero cross-entity reconciliation drift against test operations.
5. Record the verified drill via `/operations/cutover` (`drillType: "database_restore"`).

### 5.2 30-Day Archive Restoration Drill
1. Offboard a staging installation (`status = offboarding`) via `POST /v1/admin/platform/tenants/:tenantId/installations/:installationId/offboard` (backed by `InstallationOffboardingService.offboardInstallation(...)`).
2. Verify an integrity-checksummed archive artifact exists under `PRIVATE_ARCHIVE_DIR` with `retention_expires_at >= created_at + 30 days`.
3. Trigger `POST /v1/admin/platform/tenants/:tenantId/installations/:installationId/restore` (`platform_owner` or `platform_admin`).
4. Confirm SHA-256 integrity validation succeeds, configuration history in `installation_configuration_versions` remains intact, and tenant entitlements plus active status restore cleanly.
5. Record the verified drill via `/operations/cutover` (`drillType: "archive_restore"`).

---

## 6. Canary Rollout, Rollback Window & Legacy Removal Gate

### 6.1 Canary Cohort Rollout
1. Verify **Staging Pilot Ready** and **Canary Cohort Ready** gates pass in `/operations/cutover`.
2. Promote manifest releases to `status: "stable"` and bind approved production offers in `platformProvisioningOfferBindings`.
3. Configure canary cohort env vars:
   - `COMMERCIAL_PROVISIONING_PILOT_MODE=canary`
   - `COMMERCIAL_PROVISIONING_ALLOWED_OFFERS=<offerId>@<offerVersion>`
   - `COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS=<explicit-cohort-customer-ids>` (with optional `COMMERCIAL_PROVISIONING_PILOT_CUSTOMERS`)
   - `COMMERCIAL_PROVISIONING_DUAL_READ_RECONCILIATION_ENABLED=true`
4. Keep `COMMERCIAL_PROVISIONING_LEGACY_FALLBACK_ENABLED=true` during the soak/rollback window and run 5-way reconciliation scheduled reports.

### 6.2 Immediate Rollback Procedure (During Rollback Window)
1. Stop routing new commercial orders by setting `COMMERCIAL_PROVISIONING_PILOT_MODE=disabled` (or clearing `COMMERCIAL_PROVISIONING_PILOT_CUSTOMERS`) on `@bazion/api`.
2. Leave workers (`commercial-status-worker`) running so in-flight sagas and status callbacks finish draining cleanly.
3. Re-route new orders through legacy provisioning while comparing any dual-read mismatches in `reconciliation-exceptions`.

### 6.3 Legacy Provisioning Decommission Criteria
Do **not** remove legacy Bazionweb provisioning until `readyToRemoveLegacyProvisioning === true` on `GET /v1/admin/platform/commercial-provisioning/cutover-readiness`:
- All blocking gates pass (`zero_reconciliation_drift`, `zero_compensation_and_dlq_backlog`, `slo_health_green`).
- Recent verified drills (<= 30 days) exist for `staging_pilot_signoff`, `database_restore`, `archive_restore`, `canary_cohort_signoff`, and `rollback_window`.


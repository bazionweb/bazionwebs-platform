# Tenant hosting status reconciler

The hosting reconciler is a separate, long-running worker for the platform control plane. It periodically inspects already-recorded Dokploy Compose resources and reconciles observed state into `tenant_hosting_deployments`.

## Safety boundary

The worker is inspection-only. It cannot create, deploy, stop, or delete provider resources. It does not load tenant Docker secrets or template files. It only uses the Dokploy API key to call the provider inspection endpoint and a dedicated PostgreSQL login to update reconciliation metadata and append deployment events.

The worker does not retry ambiguous provider creation when no resource ID was saved. Those `unknown` records remain a manual recovery case because the provider reference needed for a safe inspection is unavailable. Do not create a second Dokploy resource to clear such a record; first reconcile the existing resource in Dokploy and persist its exact resource ID through an approved recovery procedure.

## Reconciliation behavior

- Claims due rows using a transaction with `FOR UPDATE SKIP LOCKED` and a per-row lease, so multiple worker instances do not inspect the same deployment concurrently.
- Inspects only resources that already have a persisted provider resource ID.
- Records a state transition only when the observed provider state differs from the stored state. Events are appended to the immutable hosting event table.
- Records the last inspection time and schedules the next normal inspection (default: 60 seconds).
- On provider/API errors or an inconclusive `unknown` provider state, it preserves the last known deployment state and releases the lease with exponential retry backoff (default: 30 seconds, capped at 30 minutes).
- To keep the append-only event stream useful during outages, it records the first inspection failure and then failures at powers of two (2, 4, 8, 16, ...), rather than creating an event on every poll.
- Defaults to five concurrent inspections per batch, with a 180-second lease.

The worker never interprets a successful HTTP response alone as a running deployment. The provider's inspection result is the source of deployment state.

## Database permissions

The worker uses the dedicated `bazion_hosting_reconciler` role, not `bazion_app` or the migration role. It receives:

- SELECT on `tenant_hosting_deployments`;
- UPDATE only on `state`, `error_code`, lease, inspection/scheduling, failure-count, and timestamp columns;
- INSERT on `tenant_hosting_deployment_events`.

It has no permission to INSERT or DELETE deployment rows and no access to tenant business tables.

### Fresh database initialization

The repository's Postgres init script creates this role from `BAZION_HOSTING_RECONCILER_PASSWORD`. Set a unique strong password in the database deployment environment before initializing a fresh database. The numbered migration grants the worker's table and column permissions.

### Existing database initialized before this role was added

Postgres init scripts run only when the data directory is first initialized. For an existing database, provision the role once using a database administrator connection after applying migration `0017_hosting_reconciliation_schedule.sql`:

```sql
CREATE ROLE bazion_hosting_reconciler
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE bazion_platform TO bazion_hosting_reconciler;
GRANT USAGE ON SCHEMA public TO bazion_hosting_reconciler;
GRANT SELECT ON public.tenant_hosting_deployments TO bazion_hosting_reconciler;
GRANT UPDATE (
  state, error_code, lease_token, lease_expires_at, last_deployed_at,
  updated_at, next_reconcile_at, last_inspected_at, reconcile_failure_count
) ON public.tenant_hosting_deployments TO bazion_hosting_reconciler;
GRANT INSERT ON public.tenant_hosting_deployment_events TO bazion_hosting_reconciler;
```

Set its password using the interactive PostgreSQL `\password bazion_hosting_reconciler` command, then enable login:

```sql
ALTER ROLE bazion_hosting_reconciler LOGIN;
```

Do not put a database password in shell history, Git, or the SQL migration. The migration intentionally does not create roles or elevate the non-privileged migration account.

## Worker environment

Create `/etc/bazionweb/hosting-reconciler.env` with root ownership and read access only for the `bazion` service group (for example, mode `0640`). Use the internal database hostname reachable from the systemd host; do not expose PostgreSQL publicly.

```dotenv
HOSTING_PROVIDER=dokploy
HOSTING_RECONCILER_DATABASE_URL=postgresql://bazion_hosting_reconciler:URL_ENCODED_PASSWORD@127.0.0.1:5432/bazion_platform
DOKPLOY_BASE_URL=https://server.bazionweb.com
DOKPLOY_API_KEY=REPLACE_WITH_A_DEDICATED_DOKPLOY_API_KEY
DOKPLOY_ENVIRONMENT_ID=REPLACE_WITH_DOKPLOY_ENVIRONMENT_ID
# DOKPLOY_SERVER_ID=OPTIONAL_SERVER_ID

HOSTING_RECONCILER_BATCH_SIZE=5
HOSTING_RECONCILER_IDLE_MS=15000
HOSTING_RECONCILER_LEASE_SECONDS=180
HOSTING_RECONCILER_INTERVAL_SECONDS=60
HOSTING_RECONCILER_RETRY_BASE_SECONDS=30
HOSTING_RECONCILER_RETRY_MAX_SECONDS=1800
```

The Dokploy API key should be dedicated to the worker where the provider supports scoped keys. The worker needs only read/inspection access. Keep this file separate from the API's provisioning credentials where practical. URL-encode special characters in the database password.

## Build and service installation

Build the API workspace so `apps/api/dist/hosting-worker.js` exists. Install the unit file at `/etc/systemd/system/bazion-hosting-reconciler.service`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bazion-hosting-reconciler
sudo systemctl status bazion-hosting-reconciler --no-pager
sudo journalctl -u bazion-hosting-reconciler -n 100 --no-pager
```

The service runs as the unprivileged `bazion` user with systemd filesystem and privilege restrictions. It restarts on failure and drains its current batch on SIGTERM/SIGINT.

Do not enable the worker until the schema migration has been applied, the dedicated role is configured, the environment file is secured, and the Dokploy API endpoint/key have been verified. This code change does not install or start the worker on a VPS and does not make any live Dokploy API calls.

# Notification outbox operations

## Delivery architecture

Authentication email is committed to PostgreSQL before Better Auth completes the callback:

1. Better Auth invokes the password-reset, email-verification or organization-invitation callback.
2. The callback encrypts the message payload with AES-256-GCM and awaits the outbox insert.
3. A separate `@bazion/notifications` worker claims pending rows with `FOR UPDATE SKIP LOCKED`.
4. The worker sends email through the configured SMTP transport and marks successful messages as sent.
5. Failures are retried with exponential backoff (30 seconds up to six hours); after the configured attempt limit they enter the dead-letter state.
6. Expired processing leases are reclaimed by the next worker after a crash or restart.

A successful auth callback therefore means the notification was durably queued, not that it reached the recipient's inbox. If the database enqueue fails, the callback fails rather than silently dropping a security email.

## Runtime commands

Build and run the worker as a process separate from the HTTP API:

```sh
pnpm --filter @bazion/notifications build
pnpm --filter @bazion/notifications start:worker
```

For local development, use a disposable SMTP sink such as Mailpit and point `NOTIFICATION_SMTP_HOST` and `NOTIFICATION_SMTP_PORT` at it. The worker verifies the SMTP connection before polling. It handles SIGINT/SIGTERM by finishing the current batch and closing its database/SMTP resources. Run it under a real process supervisor (systemd, a container orchestrator or an equivalent) with restart-on-failure enabled; the worker intentionally exits non-zero on fatal startup or polling errors. SMTP connection, greeting and socket timeouts are bounded (10/10/30 seconds), and the worker caps each batch at five messages so sequential delivery stays comfortably inside the five-minute outbox lease. Scale throughput with additional supervised workers rather than raising this batch limit without implementing lease heartbeats.

Required worker settings:

- `NOTIFICATION_WORKER_DATABASE_URL`: connects as `bazion_notification_worker`.
- `NOTIFICATION_ENCRYPTION_KEY`: Base64 encoding of the same 32-byte key used by the API enqueuer.
- `NOTIFICATION_SMTP_HOST`, `NOTIFICATION_SMTP_PORT`, `NOTIFICATION_SMTP_SECURE`, `NOTIFICATION_SMTP_REQUIRE_TLS`.
- `NOTIFICATION_EMAIL_FROM`: verified sender address.
- `NOTIFICATION_SMTP_REQUIRE_AUTH` defaults to `true` in production. Configure both `NOTIFICATION_SMTP_USER` and `NOTIFICATION_SMTP_PASSWORD`; configure neither only for an approved trusted private relay with `NOTIFICATION_SMTP_REQUIRE_AUTH=false`.
- Production SMTP uses implicit TLS or required STARTTLS with TLS 1.2 or newer; plaintext SMTP is rejected.

The API additionally requires `NOTIFICATION_ENQUEUER_DATABASE_URL` and the same `NOTIFICATION_ENCRYPTION_KEY`. The local `.env.example` key is deliberately rejected by production API configuration and preflight. Never put the worker database URL or SMTP credentials in the browser bundle.

## Database access and rollout

The queue is platform infrastructure, not tenant-owned business data, so it deliberately has no tenant RLS policy. It has no public/application-role access. Migration `0004_notification_runtime_roles.sql` removes the temporary tenant-provisioner grant and assigns:

- `bazion_notification_enqueuer`: INSERT on the six required enqueue columns and SELECT on only `id`, `payload_hash` and `idempotency_key`. It cannot read ciphertext, claim work, update state or delete rows.
- `bazion_notification_worker`: SELECT and UPDATE on the outbox to decrypt, claim, complete, retry and requeue messages. It cannot insert or delete rows.
- `bazion_tenant_provisioner`: no outbox privileges.

For a new local PostgreSQL volume, the updated Docker Compose/init script creates these login roles. For an existing persistent volume, init scripts do not rerun. Before applying migration 0004, connect to the target database as a PostgreSQL administrator (or a role with `CREATEROLE`) and provision the two login roles. The commands below are for a database named `bazion_platform`; use the actual database name if different.

```sql
CREATE ROLE bazion_notification_enqueuer
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE bazion_notification_worker
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

GRANT CONNECT ON DATABASE bazion_platform
  TO bazion_notification_enqueuer, bazion_notification_worker;
GRANT USAGE ON SCHEMA public
  TO bazion_notification_enqueuer, bazion_notification_worker;
```

Set each password interactively in `psql` (so it is not embedded in shell history):

```text
\\password bazion_notification_enqueuer
\\password bazion_notification_worker
```

If either role already exists, use `ALTER ROLE <role> WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;` and set its password instead of creating it again. Store the passwords in your secret manager and build separate connection strings for the API and worker. Then apply migration 0004, followed by migration 0005 for audit events. Do not reuse the tenant-provisioner password.

## Encryption key

Generate one fresh 32-byte key for each environment and store its Base64 value in the deployment secret manager:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The API enqueuer and worker must use the same key. Never commit it, put it in tenant configuration, or log decrypted payloads. Back it up securely: losing the key makes queued messages unreadable. Key rotation requires draining or re-encrypting existing queued messages before retiring the old key.

## Delivery guarantees and operations

The queue is **at-least-once**, not exactly-once. A worker can send a message and crash before marking it sent; a later worker may deliver it again. Use provider idempotency support where available and make templates/recipient workflows tolerate duplicates.

- `sent` means the SMTP adapter reported success; it does not prove inbox placement or recipient action.
- `dead` messages need inspection before manual requeue.
- Error codes are sanitized class/code names only; do not store provider response bodies, credentials, URLs or message text in `last_error_code`.
- Monitor pending queue age, processing lease age, dead-letter count, worker restarts and SMTP connection failures. Alert thresholds depend on the service's agreed delivery objective.
- SMS rows are not dispatched by the initial SMTP worker; they fail safely and retry/dead-letter rather than being treated as sent. Add an SMS provider adapter before enabling SMS notifications.
- The database integration suite runs when `NOTIFICATION_ENQUEUER_DATABASE_URL`, `NOTIFICATION_WORKER_DATABASE_URL` and `NOTIFICATION_ENCRYPTION_KEY` are present. CI provisions both restricted roles and runs this coverage against PostgreSQL.

## Current scope

Authentication password-reset, verification and invitation callbacks now await durable enqueue. This is the transactional notification foundation, not a full messaging product: SMTP is the only active channel, there is no operator UI for dead letters, and queue-age/dead-letter alerting remains an operations deliverable.

## Production preflight

The repository now exposes one command that runs both the PostgreSQL/security checks and SMTP connectivity verification:

```sh
pnpm production:preflight
```

Run it in an environment where the production variables are exported. For Linux, a root-managed environment file can be loaded without printing the values:

```sh
set -a
. /etc/bazionweb/production-preflight.env
set +a
pnpm production:preflight
```

Protect that environment file with mode `0600`. It must contain the production URLs for `DATABASE_URL`, `AUTH_DATABASE_URL`, `AUTH_MIGRATION_DATABASE_URL`, `MIGRATION_DATABASE_URL`, `TENANT_RESOLVER_DATABASE_URL`, `TENANT_PROVISIONER_DATABASE_URL`, `NOTIFICATION_ENQUEUER_DATABASE_URL` and `NOTIFICATION_WORKER_DATABASE_URL`, plus the HTTPS origins, Better Auth secret, notification encryption key, SMTP settings, proxy addresses and `NODE_ENV=production`. The command never prints credentials or encryption keys.

The database preflight connects as each declared role, verifies that the two numbered migrations are applied, verifies role attributes, checks the precise outbox and audit grants, confirms the append-only audit trigger and confirms the Better Auth user/session tables exist. The SMTP preflight verifies the configured SMTP connection, credentials and TLS negotiation.

**A green preflight is not a substitute for a test message or a worker-interruption recovery test.** Send a controlled test email and prove the five-minute lease recovery in staging before production.

The preflight also intentionally reports a blocker for the current API: only the mock payment provider is implemented, and the API rejects mock payments in production. A real payment adapter and authenticated webhook/reconciliation tests must be merged before the full production API can pass its production gate. Do not weaken that safeguard or claim production sign-off while it is reported as a blocker.

## Production worker deployment (systemd example)

The repository contains `deploy/systemd/bazion-notification-worker.service`. It assumes the code is deployed at `/opt/bazionwebs-platform`, with a Unix service account named `bazion`. Adjust these values to the host layout rather than weakening the service sandbox.

1. Build the worker with the locked workspace dependencies:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @bazion/notifications build
   ```

2. Create `/etc/bazionweb/notification-worker.env` as root with mode `0600`. Include `NODE_ENV=production` and `NOTIFICATION_SMTP_REQUIRE_TLS=true`. Keep `NOTIFICATION_SMTP_REQUIRE_AUTH=true` (the default) and set both SMTP credential variables unless an approved private-relay exception is documented. Set `NOTIFICATION_WORKER_DATABASE_URL`, `NOTIFICATION_ENCRYPTION_KEY`, `NOTIFICATION_SMTP_HOST`, `NOTIFICATION_SMTP_PORT`, `NOTIFICATION_SMTP_SECURE`, `NOTIFICATION_EMAIL_FROM`, and optionally both SMTP credential variables. The API deployment separately receives `NOTIFICATION_ENQUEUER_DATABASE_URL` and the identical encryption key. Never put these variables in a public frontend environment.

3. Install and activate the service:

   ```sh
   sudo install -d -m 0750 -o root -g bazion /etc/bazionweb
   sudo chown root:bazion /etc/bazionweb/notification-worker.env
   sudo chmod 0600 /etc/bazionweb/notification-worker.env
   sudo install -m 0644 deploy/systemd/bazion-notification-worker.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now bazion-notification-worker
   sudo systemctl status bazion-notification-worker
   ```

4. Send a controlled test email to a mailbox you own and inspect the worker logs:

   ```sh
   sudo journalctl -u bazion-notification-worker -f
   ```

5. Verify the service restarts cleanly:

   ```sh
   sudo systemctl restart bazion-notification-worker
   sudo systemctl is-active bazion-notification-worker
   ```

   This confirms process supervision and graceful restart. It is not, by itself, proof of lease-recovery after an abrupt process death. In staging, interrupt a worker while it holds a test delivery, wait longer than the five-minute lease, start/restart the worker, and confirm the pending item is reclaimed and reaches the controlled test inbox. Check the outbox attempt count and final state using a privileged operational database connection. Because delivery is at-least-once, a message that the SMTP server accepted before the worker died may be delivered again.

Do not declare production readiness until both ordinary delivery and the interrupted-worker recovery test have been evidenced in the target environment. Keep the outbox encryption key backed up with restricted recovery access.

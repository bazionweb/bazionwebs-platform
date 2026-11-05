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

For local development, use a disposable SMTP sink such as Mailpit and point `NOTIFICATION_SMTP_HOST` and `NOTIFICATION_SMTP_PORT` at it. The worker verifies the SMTP connection before polling. It handles SIGINT/SIGTERM by finishing the current batch and closing its database/SMTP resources. Run it under a real process supervisor (systemd, a container orchestrator or an equivalent) with restart-on-failure enabled; the worker intentionally exits non-zero on fatal startup or polling errors.

Required worker settings:

- `NOTIFICATION_WORKER_DATABASE_URL`: connects as `bazion_notification_worker`.
- `NOTIFICATION_ENCRYPTION_KEY`: Base64 encoding of the same 32-byte key used by the API enqueuer.
- `NOTIFICATION_SMTP_HOST`, `NOTIFICATION_SMTP_PORT`, `NOTIFICATION_SMTP_SECURE`.
- `NOTIFICATION_EMAIL_FROM`: verified sender address.
- Optional `NOTIFICATION_SMTP_USER` and `NOTIFICATION_SMTP_PASSWORD`; configure both or neither.

The API additionally requires `NOTIFICATION_ENQUEUER_DATABASE_URL` and the same `NOTIFICATION_ENCRYPTION_KEY`. Never put the worker database URL or SMTP credentials in the browser bundle.

## Database access and rollout

The queue is platform infrastructure, not tenant-owned business data, so it deliberately has no tenant RLS policy. It has no public/application-role access. Migration `0004_notification_runtime_roles.sql` removes the temporary tenant-provisioner grant and assigns:

- `bazion_notification_enqueuer`: INSERT on the six required enqueue columns and SELECT on only `id`, `payload_hash` and `idempotency_key`. It cannot read ciphertext, claim work, update state or delete rows.
- `bazion_notification_worker`: SELECT and UPDATE on the outbox to decrypt, claim, complete, retry and requeue messages. It cannot insert or delete rows.
- `bazion_tenant_provisioner`: no outbox privileges.

For a new local PostgreSQL volume, the updated Docker Compose/init script creates these login roles. For an existing persistent volume, init scripts do not rerun: create the two roles and grant database/schema CONNECT/USAGE using the deployment's database administrator, set distinct strong passwords, and update the corresponding connection strings before applying migration 0004. Do not reuse the tenant-provisioner password. Production secret provisioning must happen before the migration.

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

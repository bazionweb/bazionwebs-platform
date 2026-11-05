# Notification outbox operations

## What this adds

The notifications package now includes a PostgreSQL-backed outbox with:

- AES-256-GCM encrypted message payloads (including recipients and one-time links).
- Idempotent enqueueing, with a payload-hash check to reject a reused key with different content.
- Atomic batch claiming with `FOR UPDATE SKIP LOCKED`.
- Worker leases so messages left in `processing` after a crash can be reclaimed.
- Exponential retry delay, bounded to six hours, and a dead-letter state after the configured attempt limit.
- Explicit dead-letter requeue for an operator-controlled retry.

The queue is at-least-once, not exactly-once. A worker can send a message and crash before marking it sent; a later worker may deliver it again. Delivery handlers should use provider idempotency support where available and should tolerate duplicate delivery.

## Database access

Migration `0003_notification_outbox.sql` creates the infrastructure queue. This is deliberately not a tenant-owned table with RLS: one trusted worker needs to claim deliveries for all tenants. The table carries a nullable tenant routing ID, but message content is encrypted. Only `bazion_tenant_provisioner` receives SELECT/INSERT/UPDATE; `bazion_app` and `bazion_tenant_resolver` are explicitly denied.

The existing role is used temporarily because auth hooks already connect through the restricted tenant-provisioner pool. Before scaling workers, split queue permissions into dedicated `bazion_notification_worker` and enqueue-only roles.

## Encryption key

Generate a fresh 32-byte key and store its Base64 value in your deployment secret store:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Pass the decoded 32-byte key to `createOutboxPayloadCodec`. Never commit it, put it in tenant configuration, or log decrypted payloads. Back it up securely: losing the key makes queued messages unreadable. Key rotation requires draining or re-encrypting existing queued messages before retiring the old key.

## Worker integration still required

This PR provides the queue, encryption codec and batch-delivery runner. The existing Better Auth email callbacks are not switched over here, and no worker process is started automatically yet. Do not mark durable authentication email delivery as production-complete until:

1. Auth callbacks enqueue messages and await the database commit.
2. A supervised worker process polls `deliverOutboxBatch` and dispatches email/SMS through provider adapters.
3. Production deployment configures the encryption key and the least-privilege queue role.
4. Integration tests cover enqueue, claim, retry, crash recovery, duplicate idempotency keys and tenant metadata.
5. Operators have alerts for queue age, dead letters and worker health.

## Operational semantics

- A successful enqueue means the encrypted message is committed to PostgreSQL, not that it has been delivered.
- `sent` means the delivery adapter reported success; it does not prove inbox placement or SMS receipt.
- `dead` messages need inspection before manual requeue.
- Error codes are truncated and sanitized; do not store provider response bodies, credentials, URLs or message text in `last_error_code`.

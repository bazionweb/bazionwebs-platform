-- Dedicated least-privilege access for the encrypted notification outbox.
-- The queue is platform infrastructure, not tenant-owned business data, so it
-- intentionally has no tenant RLS policy. Encrypted payloads remain inaccessible
-- to the enqueue role; the delivery worker is the only runtime reader.

REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox
  FROM bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;

-- Auth callbacks may insert and inspect only the idempotency result. They cannot
-- read ciphertext or mutate queue state.
GRANT INSERT (tenant_id, channel, payload_ciphertext, payload_hash, idempotency_key, max_attempts)
  ON TABLE public.notification_outbox TO bazion_notification_enqueuer;
GRANT SELECT (id, payload_hash, idempotency_key)
  ON TABLE public.notification_outbox TO bazion_notification_enqueuer;

-- Only the worker can inspect ciphertext or change delivery state.
GRANT SELECT, UPDATE ON TABLE public.notification_outbox TO bazion_notification_worker;

COMMENT ON TABLE public.notification_outbox IS
  'Encrypted platform delivery queue. Runtime access is split between the enqueue-only and delivery-worker roles.';

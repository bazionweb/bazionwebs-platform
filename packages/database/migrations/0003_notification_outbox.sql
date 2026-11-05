-- Durable, encrypted delivery queue shared by platform and tenant notifications.
-- This is an infrastructure table, not a tenant-owned business table: a delivery
-- worker must claim messages across tenants. Its encrypted payload and restricted
-- database grants are the isolation boundary; the application role has no access.

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  channel varchar(8) NOT NULL CHECK (channel IN ('email', 'sms')),
  payload_ciphertext text NOT NULL,
  payload_hash varchar(64) NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error_code varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_outbox_idempotency_uq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON public.notification_outbox (available_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS notification_outbox_processing_lease_idx
  ON public.notification_outbox (locked_at)
  WHERE status = 'processing';

COMMENT ON TABLE public.notification_outbox IS
  'Encrypted platform delivery queue. Not tenant-owned; only the notification/provisioning service role may access it.';

REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox FROM bazion_app;
REVOKE ALL PRIVILEGES ON TABLE public.notification_outbox FROM bazion_tenant_resolver;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_outbox TO bazion_tenant_provisioner;

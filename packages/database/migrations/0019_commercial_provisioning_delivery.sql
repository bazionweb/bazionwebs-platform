-- Commercial provisioning durable inbox receipts and transactional status outbox.
-- Runs as the migration role (MIGRATION_DATABASE_URL). Never modifies 0018.

CREATE OR REPLACE FUNCTION public.is_safe_commercial_status_event_payload(p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_operation jsonb;
  v_key text;
  v_top_count integer := 0;
  v_op_count integer := 0;
  v_failure jsonb;
BEGIN
  IF jsonb_typeof(p_payload) <> 'object' THEN RETURN false; END IF;

  FOR v_key IN SELECT key FROM jsonb_object_keys(p_payload) AS key LOOP
    v_top_count := v_top_count + 1;
    IF v_key NOT IN ('schemaVersion', 'eventType', 'eventId', 'correlationId', 'occurredAt', 'source', 'operation') THEN
      RETURN false;
    END IF;
  END LOOP;
  IF v_top_count <> 7 THEN RETURN false; END IF;

  IF p_payload->>'schemaVersion' <> '1.0.0'
     OR p_payload->>'eventType' <> 'product.provisioning.status.v1'
     OR p_payload->>'source' <> 'bazion-platform' THEN
    RETURN false;
  END IF;

  v_operation := p_payload->'operation';
  IF v_operation IS NULL OR jsonb_typeof(v_operation) <> 'object' THEN RETURN false; END IF;

  FOR v_key IN SELECT key FROM jsonb_object_keys(v_operation) AS key LOOP
    v_op_count := v_op_count + 1;
    IF v_key NOT IN (
      'schemaVersion',
      'operationId',
      'correlationId',
      'externalOrderId',
      'status',
      'currentStep',
      'tenantId',
      'installationId',
      'failure',
      'updatedAt'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  IF v_op_count <> 10 THEN RETURN false; END IF;

  v_failure := v_operation->'failure';
  IF v_failure IS NOT NULL AND jsonb_typeof(v_failure) <> 'null' THEN
    IF jsonb_typeof(v_failure) <> 'object' THEN RETURN false; END IF;
    FOR v_key IN SELECT key FROM jsonb_object_keys(v_failure) AS key LOOP
      IF v_key NOT IN ('code', 'retryable') THEN
        RETURN false;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

CREATE TABLE public.product_provisioning_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(32) NOT NULL CHECK (source = 'bazionweb'),
  event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key varchar(200) NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 200),
  external_order_id varchar(128) NOT NULL CHECK (char_length(external_order_id) BETWEEN 1 AND 128),
  request_fingerprint char(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  operation_id uuid NOT NULL REFERENCES public.product_provisioning_operations(id) ON DELETE RESTRICT,
  received_count integer NOT NULL DEFAULT 1 CHECK (received_count >= 1),
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_provisioning_inbox_idempotency_uq UNIQUE (source, idempotency_key),
  CONSTRAINT product_provisioning_inbox_event_uq UNIQUE (source, event_id),
  CONSTRAINT product_provisioning_inbox_order_uq UNIQUE (source, external_order_id)
);

CREATE INDEX product_provisioning_inbox_operation_idx
  ON public.product_provisioning_inbox (operation_id);

CREATE TABLE public.product_provisioning_status_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.product_provisioning_operations(id) ON DELETE CASCADE,
  operation_event_id uuid NOT NULL REFERENCES public.product_provisioning_operation_events(id) ON DELETE CASCADE,
  idempotency_key varchar(240) NOT NULL,
  event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  destination varchar(32) NOT NULL DEFAULT 'bazionweb' CHECK (destination = 'bazionweb'),
  status_snapshot varchar(32) NOT NULL CHECK (status_snapshot IN (
    'accepted',
    'validating',
    'provisioning_tenant',
    'configuring_installation',
    'provisioning_hosting',
    'ready',
    'compensating',
    'compensation_required',
    'compensated',
    'failed'
  )),
  payload jsonb NOT NULL CHECK (public.is_safe_commercial_status_event_payload(payload)),
  payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 50),
  lease_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_http_status integer,
  last_error_code varchar(64) CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z][A-Z0-9_:-]{1,63}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  dead_lettered_at timestamptz,
  CONSTRAINT product_provisioning_status_outbox_idempotency_uq UNIQUE (idempotency_key),
  CONSTRAINT product_provisioning_status_outbox_event_uq UNIQUE (event_id),
  CONSTRAINT product_provisioning_status_outbox_op_event_uq UNIQUE (operation_event_id)
);

CREATE INDEX product_provisioning_status_outbox_due_idx
  ON public.product_provisioning_status_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX product_provisioning_status_outbox_operation_idx
  ON public.product_provisioning_status_outbox (operation_id, created_at);

CREATE OR REPLACE FUNCTION public.enqueue_product_provisioning_status_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op public.product_provisioning_operations%ROWTYPE;
  v_failure jsonb;
  v_occurred_at text;
  v_updated_at text;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_op
  FROM public.product_provisioning_operations
  WHERE id = NEW.operation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Missing operation row for provisioning event %', NEW.operation_id;
  END IF;

  IF v_op.failure_code IS NOT NULL THEN
    v_failure := jsonb_build_object(
      'code', v_op.failure_code,
      'retryable', COALESCE(v_op.failure_retryable, false)
    );
  ELSE
    v_failure := NULL;
  END IF;

  v_occurred_at := to_char((NEW.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_updated_at := to_char((v_op.updated_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  v_payload := jsonb_build_object(
    'schemaVersion', '1.0.0',
    'eventType', 'product.provisioning.status.v1',
    'eventId', NEW.id::text,
    'correlationId', v_op.correlation_id::text,
    'occurredAt', v_occurred_at,
    'source', 'bazion-platform',
    'operation', jsonb_build_object(
      'schemaVersion', '1.0.0',
      'operationId', v_op.id::text,
      'correlationId', v_op.correlation_id::text,
      'externalOrderId', v_op.external_order_id,
      'status', v_op.status,
      'currentStep', CASE WHEN v_op.current_step IS NULL THEN to_jsonb(NULL::text) ELSE to_jsonb(v_op.current_step) END,
      'tenantId', CASE WHEN v_op.tenant_id IS NULL THEN to_jsonb(NULL::text) ELSE to_jsonb(v_op.tenant_id::text) END,
      'installationId', CASE WHEN v_op.installation_id IS NULL THEN to_jsonb(NULL::text) ELSE to_jsonb(v_op.installation_id::text) END,
      'failure', COALESCE(v_failure, 'null'::jsonb),
      'updatedAt', v_updated_at
    )
  );

  INSERT INTO public.product_provisioning_status_outbox (
    operation_id,
    operation_event_id,
    idempotency_key,
    event_id,
    correlation_id,
    status_snapshot,
    payload,
    payload_hash
  )
  VALUES (
    v_op.id,
    NEW.id,
    'status:' || v_op.id::text || ':' || NEW.id::text,
    NEW.id,
    v_op.correlation_id,
    v_op.status,
    v_payload,
    encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex')
  )
  ON CONFLICT (operation_event_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER product_provisioning_events_enqueue_status_outbox
  AFTER INSERT ON public.product_provisioning_operation_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_product_provisioning_status_outbox();

REVOKE ALL ON public.product_provisioning_inbox, public.product_provisioning_status_outbox
  FROM PUBLIC, bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_provisioning_inbox TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_provisioning_status_outbox TO bazion_product_provisioner';
  END IF;
END
$$;

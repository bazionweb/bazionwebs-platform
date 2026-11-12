-- Expose the control-plane hosting deployment UUID through the existing signed
-- provisioning status outbox. Provider resource IDs remain private to Platform.
-- Commercial hosting uses the saga's deterministic provision_hosting idempotency
-- key; shared-managed operations have no matching deployment and publish null.

-- Widen the existing payload allowlist without weakening required fields. Existing
-- rows retain their original 10-key operation payload and remain valid.
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
  v_hosting_deployment_id jsonb;
  v_requested_domain jsonb;
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
      'requestedDomain',
      'hostingDeploymentId',
      'failure',
      'updatedAt'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  IF v_op_count NOT IN (10, 11, 12) THEN RETURN false; END IF;
  IF NOT (v_operation ?& ARRAY[
    'schemaVersion', 'operationId', 'correlationId', 'externalOrderId', 'status',
    'currentStep', 'tenantId', 'installationId', 'failure', 'updatedAt'
  ]) THEN
    RETURN false;
  END IF;

  IF v_operation ? 'hostingDeploymentId' THEN
    v_hosting_deployment_id := v_operation->'hostingDeploymentId';
    IF jsonb_typeof(v_hosting_deployment_id) <> 'null'
       AND (jsonb_typeof(v_hosting_deployment_id) <> 'string'
         OR (v_hosting_deployment_id #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN
      RETURN false;
    END IF;
  END IF;

  IF v_operation ? 'requestedDomain' THEN
    v_requested_domain := v_operation->'requestedDomain';
    IF jsonb_typeof(v_requested_domain) <> 'null'
       AND (jsonb_typeof(v_requested_domain) <> 'string'
         OR length(v_requested_domain #>> '{}') NOT BETWEEN 1 AND 253) THEN
      RETURN false;
    END IF;
  END IF;

  v_failure := v_operation->'failure';
  IF v_failure IS NOT NULL AND jsonb_typeof(v_failure) <> 'null' THEN
    IF jsonb_typeof(v_failure) <> 'object' THEN RETURN false; END IF;
    FOR v_key IN SELECT key FROM jsonb_object_keys(v_failure) AS key LOOP
      IF v_key NOT IN ('code', 'retryable') THEN
        RETURN false;
      END IF;
    END LOOP;
    IF (SELECT count(*) FROM jsonb_object_keys(v_failure)) <> 2
       OR NOT (v_failure ?& ARRAY['code', 'retryable']) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_product_provisioning_status_outbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_op public.product_provisioning_operations%ROWTYPE;
  v_failure jsonb;
  v_hosting_deployment_id uuid;
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

  SELECT id INTO v_hosting_deployment_id
  FROM public.tenant_hosting_deployments
  WHERE tenant_id = v_op.tenant_id
    AND idempotency_key = v_op.id::text || ':provision_hosting:forward'
  LIMIT 1;

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
      'requestedDomain', CASE WHEN v_op.requested_domain IS NULL THEN to_jsonb(NULL::text) ELSE to_jsonb(v_op.requested_domain) END,
      'hostingDeploymentId', CASE WHEN v_hosting_deployment_id IS NULL THEN to_jsonb(NULL::text) ELSE to_jsonb(v_hosting_deployment_id::text) END,
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

-- Commercial product installations and inspectable, recoverable provisioning operations.
-- Credentials and contact PII are deliberately not copied into these control-plane records.

CREATE TABLE public.product_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  source varchar(24) NOT NULL DEFAULT 'bazionweb' CHECK (source = 'bazionweb'),
  external_customer_id varchar(120) NOT NULL,
  external_order_id varchar(120) NOT NULL,
  product_id varchar(120) NOT NULL,
  product_version varchar(64) NOT NULL,
  solution_id varchar(120) NOT NULL,
  solution_version varchar(64) NOT NULL,
  template_id varchar(120) NOT NULL,
  template_version varchar(64) NOT NULL,
  configuration_schema_version varchar(64) NOT NULL,
  distribution_mode varchar(24) NOT NULL DEFAULT 'shared-managed' CHECK (distribution_mode = 'shared-managed'),
  idempotency_key varchar(200) NOT NULL,
  request_fingerprint varchar(64) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'provisioning', 'ready', 'suspended', 'failed', 'offboarding', 'offboarded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  suspended_at timestamptz,
  offboarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_installations_customer_ck CHECK (length(trim(external_customer_id)) BETWEEN 1 AND 120),
  CONSTRAINT product_installations_order_ck CHECK (length(trim(external_order_id)) BETWEEN 1 AND 120),
  CONSTRAINT product_installations_product_ck CHECK (length(trim(product_id)) BETWEEN 1 AND 120 AND length(trim(product_version)) BETWEEN 1 AND 64),
  CONSTRAINT product_installations_solution_ck CHECK (length(trim(solution_id)) BETWEEN 1 AND 120 AND length(trim(solution_version)) BETWEEN 1 AND 64),
  CONSTRAINT product_installations_template_ck CHECK (length(trim(template_id)) BETWEEN 1 AND 120 AND length(trim(template_version)) BETWEEN 1 AND 64),
  CONSTRAINT product_installations_idempotency_ck CHECK (idempotency_key = btrim(idempotency_key) AND length(idempotency_key) BETWEEN 16 AND 200),
  CONSTRAINT product_installations_fingerprint_ck CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  CONSTRAINT product_installations_lifecycle_ck CHECK (
    (status NOT IN ('ready', 'suspended', 'offboarding', 'offboarded') OR ready_at IS NOT NULL)
    AND (status <> 'offboarded' OR offboarded_at IS NOT NULL)
  ),
  CONSTRAINT product_installations_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT product_installations_source_order_uq UNIQUE (source, external_order_id),
  CONSTRAINT product_installations_tenant_idempotency_uq UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX product_installations_tenant_status_idx
  ON public.product_installations (tenant_id, status, created_at DESC);

CREATE FUNCTION public.enforce_product_installation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.tenant_id, NEW.source, NEW.external_customer_id, NEW.external_order_id,
      NEW.product_id, NEW.product_version, NEW.solution_id, NEW.solution_version,
      NEW.template_id, NEW.template_version, NEW.configuration_schema_version, NEW.distribution_mode,
      NEW.idempotency_key, NEW.request_fingerprint, NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.source, OLD.external_customer_id, OLD.external_order_id,
      OLD.product_id, OLD.product_version, OLD.solution_id, OLD.solution_version,
      OLD.template_id, OLD.template_version, OLD.configuration_schema_version, OLD.distribution_mode,
      OLD.idempotency_key, OLD.request_fingerprint, OLD.created_at) THEN
    RAISE EXCEPTION 'product installation composition is immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'requested' AND NEW.status IN ('provisioning', 'offboarding')) OR
    (OLD.status = 'provisioning' AND NEW.status IN ('ready', 'failed', 'offboarding')) OR
    (OLD.status = 'ready' AND NEW.status IN ('suspended', 'offboarding')) OR
    (OLD.status = 'suspended' AND NEW.status IN ('ready', 'offboarding')) OR
    (OLD.status = 'failed' AND NEW.status IN ('provisioning', 'offboarding')) OR
    (OLD.status = 'offboarding' AND NEW.status = 'offboarded')
  ) THEN
    RAISE EXCEPTION 'invalid product installation status transition: % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' THEN
    NEW.ready_at := coalesce(OLD.ready_at, now());
  ELSIF NEW.ready_at IS DISTINCT FROM OLD.ready_at THEN
    RAISE EXCEPTION 'The ready timestamp is maintained by lifecycle transitions.' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'offboarded' AND OLD.status IS DISTINCT FROM 'offboarded' THEN
    NEW.offboarded_at := coalesce(OLD.offboarded_at, now());
  ELSIF NEW.offboarded_at IS DISTINCT FROM OLD.offboarded_at THEN
    RAISE EXCEPTION 'The offboarded timestamp is maintained by lifecycle transitions.' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_installations_enforce_update
  BEFORE UPDATE ON public.product_installations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_installation_update();

ALTER TABLE public.product_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_installations FORCE ROW LEVEL SECURITY;
CREATE POLICY product_installations_tenant_isolation ON public.product_installations
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE TABLE public.product_provisioning_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version varchar(16) NOT NULL CHECK (schema_version = '1.0.0'),
  source varchar(24) NOT NULL CHECK (source = 'bazionweb'),
  event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  request_fingerprint varchar(64) NOT NULL CHECK (request_fingerprint ~ '^[a-f0-9]{64}$'),
  external_customer_id varchar(120) NOT NULL,
  external_order_id varchar(120) NOT NULL,
  offer_id varchar(120) NOT NULL,
  offer_version varchar(64) NOT NULL,
  product_id varchar(120) NOT NULL,
  product_version varchar(64) NOT NULL,
  solution_id varchar(120) NOT NULL,
  solution_version varchar(64) NOT NULL,
  template_id varchar(120) NOT NULL,
  template_version varchar(64) NOT NULL,
  requested_domain varchar(253),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  installation_id uuid,
  status varchar(32) NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'ready', 'compensating', 'compensation_required', 'compensated', 'failed')),
  current_step varchar(80),
  failure_code varchar(80),
  failure_retryable boolean,
  failure_disposition varchar(24),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT product_provisioning_operations_idempotency_uq UNIQUE (source, idempotency_key),
  CONSTRAINT product_provisioning_operations_event_uq UNIQUE (source, event_id),
  CONSTRAINT product_provisioning_operations_order_uq UNIQUE (source, external_order_id),
  CONSTRAINT product_provisioning_operations_installation_fk
    FOREIGN KEY (installation_id, tenant_id)
    REFERENCES public.product_installations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT product_provisioning_operations_failure_ck CHECK (
    (status = 'failed' AND failure_code IS NOT NULL AND failure_retryable IS NOT NULL
      AND failure_disposition IN ('retry', 'compensate'))
    OR (status = 'compensation_required' AND failure_code IS NOT NULL AND failure_retryable IS NOT NULL
      AND failure_disposition IN ('unknown', 'compensation_failed'))
    OR (status NOT IN ('failed', 'compensation_required') AND failure_code IS NULL
      AND failure_retryable IS NULL AND failure_disposition IS NULL)
  ),
  CONSTRAINT product_provisioning_operations_ready_ck CHECK (
    status <> 'ready' OR (tenant_id IS NOT NULL AND installation_id IS NOT NULL AND finished_at IS NOT NULL)
  ),
  CONSTRAINT product_provisioning_operations_installation_tenant_ck CHECK (
    installation_id IS NULL OR tenant_id IS NOT NULL
  ),
  CONSTRAINT product_provisioning_operations_finished_ck CHECK (
    (status IN ('ready', 'compensated') AND finished_at IS NOT NULL) OR status NOT IN ('ready', 'compensated')
  ),
  CONSTRAINT product_provisioning_operations_domain_ck CHECK (
    requested_domain IS NULL OR (requested_domain = lower(requested_domain) AND length(requested_domain) <= 253)
  )
);

CREATE INDEX product_provisioning_operations_recovery_idx
  ON public.product_provisioning_operations (status, updated_at)
  WHERE status NOT IN ('ready', 'compensated', 'failed');
CREATE INDEX product_provisioning_operations_tenant_idx
  ON public.product_provisioning_operations (tenant_id, accepted_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE FUNCTION public.enforce_product_provisioning_operation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.schema_version, NEW.source, NEW.event_id, NEW.correlation_id, NEW.idempotency_key, NEW.request_fingerprint,
      NEW.external_customer_id, NEW.external_order_id, NEW.offer_id, NEW.offer_version,
      NEW.product_id, NEW.product_version, NEW.solution_id, NEW.solution_version,
      NEW.template_id, NEW.template_version, NEW.requested_domain, NEW.accepted_at)
     IS DISTINCT FROM
     (OLD.schema_version, OLD.source, OLD.event_id, OLD.correlation_id, OLD.idempotency_key, OLD.request_fingerprint,
      OLD.external_customer_id, OLD.external_order_id, OLD.offer_id, OLD.offer_version,
      OLD.product_id, OLD.product_version, OLD.solution_id, OLD.solution_version,
      OLD.template_id, OLD.template_version, OLD.requested_domain, OLD.accepted_at) THEN
    RAISE EXCEPTION 'provisioning request is immutable' USING ERRCODE = '23514';
  END IF;
  IF (OLD.tenant_id IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id)
    OR (OLD.installation_id IS NOT NULL AND NEW.installation_id IS DISTINCT FROM OLD.installation_id) THEN
    RAISE EXCEPTION 'provisioning references cannot be reassigned' USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'accepted' AND NEW.status IN ('validating', 'failed')) OR
    (OLD.status = 'validating' AND NEW.status IN ('provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'provisioning_tenant' AND NEW.status IN ('configuring_installation', 'provisioning_hosting', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'configuring_installation' AND NEW.status IN ('provisioning_tenant', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'provisioning_hosting' AND NEW.status IN ('configuring_installation', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'failed' AND ((NEW.status = 'validating' AND OLD.failure_disposition = 'retry') OR
      (NEW.status = 'compensating' AND OLD.failure_disposition = 'compensate'))) OR
    (OLD.status = 'compensating' AND NEW.status IN ('compensated', 'compensation_required')) OR
    (OLD.status = 'compensation_required' AND NEW.status = 'compensating' AND OLD.failure_disposition = 'compensation_failed')
  ) THEN
    RAISE EXCEPTION 'invalid provisioning operation status transition: % -> %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  IF NEW.status IN ('ready', 'compensated') THEN NEW.finished_at := coalesce(NEW.finished_at, now()); END IF;
  IF NEW.status IN ('validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating') THEN
    NEW.failure_code := NULL;
    NEW.failure_retryable := NULL;
    NEW.failure_disposition := NULL;
    NEW.finished_at := NULL;
  END IF;
  IF NEW.status NOT IN ('failed', 'compensation_required') THEN
    NEW.failure_code := NULL;
    NEW.failure_retryable := NULL;
    NEW.failure_disposition := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_provisioning_operations_enforce_update
  BEFORE UPDATE ON public.product_provisioning_operations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_provisioning_operation_update();

CREATE FUNCTION public.is_safe_product_provisioning_effect(p_effect jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  entry record;
  item_count integer := 0;
BEGIN
  IF jsonb_typeof(p_effect) <> 'object' THEN RETURN false; END IF;
  FOR entry IN SELECT key, value FROM jsonb_each(p_effect) LOOP
    item_count := item_count + 1;
    IF item_count > 20
      OR entry.key !~ '^[a-z][a-z0-9_]{0,63}$'
      OR entry.key ~* '(secret|token|password|credential|dsn|database_url|environment)'
      OR jsonb_typeof(entry.value) <> 'string'
      OR length(trim(entry.value #>> '{}')) NOT BETWEEN 1 AND 255 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE TABLE public.product_provisioning_step_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.product_provisioning_operations(id) ON DELETE RESTRICT,
  step_name varchar(80) NOT NULL CHECK (step_name ~ '^[a-z][a-z0-9_]{0,79}$'),
  direction varchar(12) NOT NULL CHECK (direction IN ('forward', 'compensate')),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status varchar(16) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed', 'unknown')),
  effect_refs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (public.is_safe_product_provisioning_effect(effect_refs)),
  error_code varchar(80),
  retryable boolean,
  failure_disposition varchar(24),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT product_provisioning_step_attempts_number_uq UNIQUE (operation_id, step_name, direction, attempt_number),
  CONSTRAINT product_provisioning_step_attempts_result_ck CHECK (
    (status = 'running' AND finished_at IS NULL AND error_code IS NULL AND retryable IS NULL AND failure_disposition IS NULL) OR
    (status = 'succeeded' AND finished_at IS NOT NULL AND error_code IS NULL AND retryable IS NULL AND failure_disposition IS NULL) OR
    (status = 'failed' AND finished_at IS NOT NULL AND error_code IS NOT NULL AND retryable IS NOT NULL
      AND failure_disposition IN ('retry', 'compensate', 'compensation_failed')) OR
    (status = 'unknown' AND finished_at IS NOT NULL AND error_code IS NOT NULL AND retryable IS NOT NULL
      AND failure_disposition = 'unknown')
  )
);

CREATE INDEX product_provisioning_step_attempts_history_idx
  ON public.product_provisioning_step_attempts (operation_id, started_at);
CREATE INDEX product_provisioning_step_attempts_recovery_idx
  ON public.product_provisioning_step_attempts (started_at)
  WHERE status = 'running';

CREATE TABLE public.product_provisioning_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.product_provisioning_operations(id) ON DELETE RESTRICT,
  event_type varchar(32) NOT NULL CHECK (event_type IN ('accepted', 'status_changed', 'step_changed', 'tenant_attached', 'installation_attached', 'failure_recorded')),
  status varchar(32) NOT NULL,
  current_step varchar(80),
  failure_code varchar(80),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_provisioning_operation_events_history_idx
  ON public.product_provisioning_operation_events (operation_id, occurred_at, id);

CREATE FUNCTION public.record_product_provisioning_operation_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  change_type varchar(32);
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.product_provisioning_operation_events (operation_id, event_type, status, current_step)
    VALUES (NEW.id, 'accepted', NEW.status, NEW.current_step);
    RETURN NEW;
  END IF;

  change_type := CASE
    WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_changed'
    WHEN NEW.current_step IS DISTINCT FROM OLD.current_step THEN 'step_changed'
    WHEN NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN 'tenant_attached'
    WHEN NEW.installation_id IS DISTINCT FROM OLD.installation_id THEN 'installation_attached'
    WHEN NEW.failure_code IS DISTINCT FROM OLD.failure_code THEN 'failure_recorded'
    ELSE NULL
  END;
  IF change_type IS NOT NULL THEN
    INSERT INTO public.product_provisioning_operation_events
      (operation_id, event_type, status, current_step, failure_code)
    VALUES (NEW.id, change_type, NEW.status, NEW.current_step, NEW.failure_code);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_provisioning_operations_record_event
  AFTER INSERT OR UPDATE ON public.product_provisioning_operations
  FOR EACH ROW EXECUTE FUNCTION public.record_product_provisioning_operation_event();

CREATE FUNCTION public.reject_product_provisioning_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'provisioning operation events are append-only' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER product_provisioning_events_immutable
  BEFORE UPDATE OR DELETE ON public.product_provisioning_operation_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_product_provisioning_event_mutation();

-- The existing app and tenant provisioner roles receive no access to these tables.
-- The dedicated service role can run the cross-tenant provisioning control plane,
-- while installation rows remain protected by tenant RLS and app.tenant_id.
REVOKE ALL ON public.product_installations, public.product_provisioning_operations,
  public.product_provisioning_step_attempts, public.product_provisioning_operation_events
  FROM PUBLIC, bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;
REVOKE ALL ON FUNCTION public.enforce_product_installation_update(),
  public.enforce_product_provisioning_operation_update(),
  public.record_product_provisioning_operation_event(),
  public.reject_product_provisioning_event_mutation(),
  public.is_safe_product_provisioning_effect(jsonb) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'GRANT REFERENCES (id) ON public.tenants TO bazion_product_provisioner';
    EXECUTE 'GRANT REFERENCES (id, tenant_id) ON public.product_installations TO bazion_product_provisioner';
    EXECUTE 'GRANT REFERENCES ON public.product_provisioning_operations TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_installations TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_provisioning_operations TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_provisioning_step_attempts TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT ON public.product_provisioning_operation_events TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enforce_product_installation_update() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enforce_product_provisioning_operation_update() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.record_product_provisioning_operation_event() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_safe_product_provisioning_effect(jsonb) TO bazion_product_provisioner';
  END IF;
END;
$$;

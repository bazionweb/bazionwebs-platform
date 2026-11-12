-- Phase 6: Durable provisioning saga leases & fencing tokens, forward config versioning,
-- 30-day private offboarding archive retention, and signed subscription lifecycle sync.

-- ─── 1. Extend product_installations for dedicated mode, config versioning, and 30d offboarding ───
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.product_installations'::regclass
      AND con.contype = 'c'
      AND (
        pg_get_constraintdef(con.oid) LIKE '%distribution_mode%'
        OR con.conname = 'product_installations_lifecycle_ck'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.product_installations DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE public.product_installations
  ADD COLUMN IF NOT EXISTS current_configuration_version integer NOT NULL DEFAULT 0
    CHECK (current_configuration_version >= 0),
  ADD COLUMN IF NOT EXISTS created_by varchar(128) NOT NULL DEFAULT 'commercial-provisioning',
  ADD COLUMN IF NOT EXISTS suspended_reason varchar(80),
  ADD COLUMN IF NOT EXISTS offboarding_previous_status varchar(24),
  ADD COLUMN IF NOT EXISTS offboarding_archive_id uuid,
  ADD COLUMN IF NOT EXISTS offboarding_started_at timestamptz;

ALTER TABLE public.product_installations
  ADD CONSTRAINT product_installations_distribution_ck
    CHECK (distribution_mode IN ('shared-managed', 'dedicated')),
  ADD CONSTRAINT product_installations_lifecycle_ck CHECK (
    (status NOT IN ('ready', 'suspended') OR ready_at IS NOT NULL)
    AND (status <> 'offboarded' OR offboarded_at IS NOT NULL)
  ),
  ADD CONSTRAINT product_installations_offboarding_prev_ck CHECK (
    offboarding_previous_status IS NULL
    OR offboarding_previous_status IN ('requested', 'provisioning', 'ready', 'failed', 'suspended')
  ),
  ADD CONSTRAINT product_installations_offboarding_state_ck CHECK (
    (status = 'offboarding' AND offboarding_previous_status IS NOT NULL
      AND offboarding_archive_id IS NOT NULL AND offboarding_started_at IS NOT NULL)
    OR status <> 'offboarding'
  );

CREATE OR REPLACE FUNCTION public.enforce_product_installation_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.tenant_id, NEW.source, NEW.external_customer_id, NEW.external_order_id,
      NEW.product_id, NEW.product_version, NEW.solution_id, NEW.solution_version,
      NEW.template_id, NEW.template_version, NEW.distribution_mode,
      NEW.idempotency_key, NEW.request_fingerprint, NEW.created_at, NEW.created_by)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.source, OLD.external_customer_id, OLD.external_order_id,
      OLD.product_id, OLD.product_version, OLD.solution_id, OLD.solution_version,
      OLD.template_id, OLD.template_version, OLD.distribution_mode,
      OLD.idempotency_key, OLD.request_fingerprint, OLD.created_at, OLD.created_by) THEN
    RAISE EXCEPTION 'product installation composition is immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW.current_configuration_version < OLD.current_configuration_version THEN
    RAISE EXCEPTION 'configuration version cannot move backwards' USING ERRCODE = '23514';
  END IF;

  IF NEW.configuration_schema_version IS DISTINCT FROM OLD.configuration_schema_version
     AND NEW.current_configuration_version <= OLD.current_configuration_version THEN
    RAISE EXCEPTION 'configuration schema version advance requires incrementing current_configuration_version'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'requested' AND NEW.status IN ('provisioning', 'offboarding')) OR
    (OLD.status = 'provisioning' AND NEW.status IN ('ready', 'failed', 'offboarding')) OR
    (OLD.status = 'ready' AND NEW.status IN ('suspended', 'offboarding')) OR
    (OLD.status = 'suspended' AND NEW.status IN ('ready', 'offboarding')) OR
    (OLD.status = 'failed' AND NEW.status IN ('provisioning', 'offboarding')) OR
    (OLD.status = 'offboarding' AND (
      NEW.status = 'offboarded' OR NEW.status = OLD.offboarding_previous_status
    ))
  ) THEN
    RAISE EXCEPTION 'invalid product installation status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' THEN
    IF OLD.status <> 'offboarding' THEN
      NEW.ready_at := coalesce(OLD.ready_at, now());
    END IF;
    NEW.suspended_at := NULL;
    NEW.suspended_reason := NULL;
    IF OLD.status = 'offboarding' THEN
      NEW.offboarding_previous_status := NULL;
      NEW.offboarding_archive_id := NULL;
      NEW.offboarding_started_at := NULL;
    END IF;
  ELSIF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    NEW.suspended_at := coalesce(NEW.suspended_at, now());
    IF OLD.status = 'offboarding' THEN
      NEW.offboarding_previous_status := NULL;
      NEW.offboarding_archive_id := NULL;
      NEW.offboarding_started_at := NULL;
    END IF;
  ELSIF OLD.status = 'offboarding' AND NEW.status = OLD.offboarding_previous_status THEN
    NEW.offboarding_previous_status := NULL;
    NEW.offboarding_archive_id := NULL;
    NEW.offboarding_started_at := NULL;
  ELSIF NEW.status = 'offboarding' AND OLD.status IS DISTINCT FROM 'offboarding' THEN
    NEW.offboarding_previous_status := coalesce(OLD.offboarding_previous_status, OLD.status);
    NEW.offboarding_archive_id := coalesce(NEW.offboarding_archive_id, OLD.offboarding_archive_id, gen_random_uuid());
    NEW.offboarding_started_at := coalesce(NEW.offboarding_started_at, OLD.offboarding_started_at, now());
  ELSIF NEW.status = 'offboarded' AND OLD.status IS DISTINCT FROM 'offboarded' THEN
    NEW.offboarded_at := coalesce(OLD.offboarded_at, now());
  ELSIF NEW.ready_at IS DISTINCT FROM OLD.ready_at THEN
    RAISE EXCEPTION 'The ready timestamp is maintained by lifecycle transitions.' USING ERRCODE = '23514';
  ELSIF NEW.offboarded_at IS DISTINCT FROM OLD.offboarded_at THEN
    RAISE EXCEPTION 'The offboarded timestamp is maintained by lifecycle transitions.' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─── 2. Installation Configuration Versions & 30-day Offboarding Archives ───
CREATE TABLE IF NOT EXISTS public.installation_configuration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  installation_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  configuration_schema_version varchar(64) NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  checksum char(64) NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
  created_by varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT installation_configuration_versions_installation_fk
    FOREIGN KEY (installation_id, tenant_id)
    REFERENCES public.product_installations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT installation_configuration_versions_uq UNIQUE (installation_id, version)
);

CREATE INDEX IF NOT EXISTS installation_configuration_versions_tenant_idx
  ON public.installation_configuration_versions (tenant_id, installation_id, version DESC);

ALTER TABLE public.installation_configuration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_configuration_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY installation_configuration_versions_tenant_isolation
  ON public.installation_configuration_versions
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.installation_offboarding_archives (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  installation_id uuid NOT NULL,
  archive_key text NOT NULL,
  archive_checksum char(64) NOT NULL CHECK (archive_checksum ~ '^[a-f0-9]{64}$'),
  object_checksum char(64) NOT NULL CHECK (object_checksum ~ '^[a-f0-9]{64}$'),
  archive_size_bytes integer NOT NULL CHECK (archive_size_bytes BETWEEN 1 AND 52428800),
  format_version varchar(40) NOT NULL,
  configuration_version integer NOT NULL CHECK (configuration_version >= 0),
  configuration_schema_version varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retention_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  recovered_at timestamptz,
  recovered_by varchar(128),
  configuration_purged_at timestamptz,
  archive_purged_at timestamptz,
  CONSTRAINT installation_offboarding_archives_installation_fk
    FOREIGN KEY (installation_id, tenant_id)
    REFERENCES public.product_installations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT installation_offboarding_archives_retention_ck
    CHECK (retention_expires_at >= created_at + interval '30 days')
);

CREATE INDEX IF NOT EXISTS installation_offboarding_archives_retention_idx
  ON public.installation_offboarding_archives (tenant_id, retention_expires_at)
  WHERE archive_purged_at IS NULL;

ALTER TABLE public.installation_offboarding_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_offboarding_archives FORCE ROW LEVEL SECURITY;
CREATE POLICY installation_offboarding_archives_tenant_isolation
  ON public.installation_offboarding_archives
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- ─── 3. Provisioning Saga Leases, Monotonic Fencing Tokens & Operator Controls ───
ALTER TABLE public.product_provisioning_operations
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  ADD COLUMN IF NOT EXISTS worker_id varchar(128),
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS retry_after_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_review_note text,
  ADD COLUMN IF NOT EXISTS last_operator_actor_id varchar(128);

CREATE INDEX IF NOT EXISTS product_provisioning_operations_claim_idx
  ON public.product_provisioning_operations (status, retry_after_at, lease_expires_at, accepted_at)
  WHERE status NOT IN ('ready', 'compensated');

ALTER TABLE public.product_provisioning_step_attempts
  ADD COLUMN IF NOT EXISTS fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  ADD COLUMN IF NOT EXISTS correlation_id uuid;

CREATE OR REPLACE FUNCTION public.enforce_product_provisioning_operation_update()
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

  IF NEW.fencing_token < OLD.fencing_token THEN
    RAISE EXCEPTION 'provisioning operation fencing_token cannot decrease (% -> %)', OLD.fencing_token, NEW.fencing_token
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'accepted' AND NEW.status IN ('validating', 'provisioning_tenant', 'failed', 'compensating')) OR
    (OLD.status = 'validating' AND NEW.status IN ('provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'provisioning_tenant' AND NEW.status IN ('configuring_installation', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'configuring_installation' AND NEW.status IN ('provisioning_tenant', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'provisioning_hosting' AND NEW.status IN ('configuring_installation', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'failed' AND NEW.status IN ('validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating')) OR
    (OLD.status = 'compensating' AND NEW.status IN ('compensated', 'compensation_required', 'failed')) OR
    (OLD.status = 'compensation_required' AND NEW.status IN ('validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'compensating', 'failed'))
  ) THEN
    RAISE EXCEPTION 'invalid provisioning operation status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := now();
  IF NEW.status IN ('ready', 'compensated') THEN
    NEW.finished_at := coalesce(NEW.finished_at, OLD.finished_at, now());
    NEW.lease_token := NULL;
    NEW.lease_expires_at := NULL;
    NEW.worker_id := NULL;
    NEW.retry_after_at := NULL;
  END IF;
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

-- ─── 4. Subscription Lifecycle Command Inbox & Outbox ───
CREATE TABLE IF NOT EXISTS public.product_subscription_lifecycle_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(24) NOT NULL CHECK (source = 'bazionweb'),
  event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  subscription_id varchar(120) NOT NULL,
  external_customer_id varchar(120) NOT NULL,
  external_order_id varchar(120) NOT NULL,
  action varchar(24) NOT NULL CHECK (action IN ('activate', 'grace', 'suspend', 'reactivate', 'cancel')),
  reason_code varchar(80) NOT NULL,
  effective_at timestamptz NOT NULL,
  grace_ends_at timestamptz,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  installation_id uuid,
  resulting_installation_status varchar(24),
  applied boolean NOT NULL DEFAULT true,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_sub_lifecycle_inbox_idempotency_uq UNIQUE (source, idempotency_key),
  CONSTRAINT product_sub_lifecycle_inbox_event_uq UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS product_sub_lifecycle_inbox_sub_idx
  ON public.product_subscription_lifecycle_inbox (subscription_id, effective_at DESC);

CREATE TABLE IF NOT EXISTS public.product_subscription_lifecycle_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_inbox_id uuid NOT NULL
    REFERENCES public.product_subscription_lifecycle_inbox(id) ON DELETE RESTRICT,
  idempotency_key varchar(240) NOT NULL UNIQUE,
  event_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  destination varchar(32) NOT NULL DEFAULT 'bazionweb',
  payload jsonb NOT NULL,
  payload_hash char(64) NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'dead')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 50),
  lease_token uuid,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_http_status integer,
  last_error_code varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  dead_lettered_at timestamptz
);

CREATE INDEX IF NOT EXISTS product_sub_lifecycle_outbox_due_idx
  ON public.product_subscription_lifecycle_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'processing');

REVOKE ALL ON public.installation_configuration_versions,
  public.installation_offboarding_archives,
  public.product_subscription_lifecycle_inbox,
  public.product_subscription_lifecycle_outbox
  FROM PUBLIC, bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.installation_configuration_versions TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.installation_offboarding_archives TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_subscription_lifecycle_inbox TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.product_subscription_lifecycle_outbox TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enforce_product_installation_update() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enforce_product_provisioning_operation_update() TO bazion_product_provisioner';
  END IF;
END;
$$;


-- Commercial platform hardening (Phase 2 / Phase 6 / Role Isolation / Lifecycle Outbox):
-- 1. Recursive secret-key rejection & monotonic semver configuration history helpers.
-- 2. Immutable installation_configuration_versions triggers & offboarded-only purge.
-- 3. Verified domain-to-installation routing column and security-barrier view.
-- 4. Fix enforce_product_installation_update() ELSIF timestamp guard bypass.
-- 5. Fix enforce_product_provisioning_operation_update() failure_disposition & compensating transition guards.
-- 6. Strict allowlist SQL check on product_subscription_lifecycle_outbox payloads.
-- 7. Least-privilege revocations across unrelated worker/auth roles & narrow hosting projection read for provisioner.

-- ─── 1. Recursive secret-key rejection & forward semver comparison ───

CREATE OR REPLACE FUNCTION public.product_configuration_contains_secret_key(document jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
DECLARE
  member record;
BEGIN
  IF jsonb_typeof(document) = 'object' THEN
    FOR member IN SELECT key, value FROM jsonb_each(document) LOOP
      IF member.key ~* '(password|secret|credential|token|private[-_]?key|api[-_]?key)'
         OR public.product_configuration_contains_secret_key(member.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR member IN SELECT value FROM jsonb_array_elements(document) LOOP
      IF public.product_configuration_contains_secret_key(member.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.product_configuration_version_not_older(
  candidate varchar,
  baseline varchar
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
  SELECT ROW(
           split_part(candidate, '.', 1)::numeric,
           split_part(candidate, '.', 2)::numeric,
           split_part(candidate, '.', 3)::numeric
         )
      >= ROW(
           split_part(baseline, '.', 1)::numeric,
           split_part(baseline, '.', 2)::numeric,
           split_part(baseline, '.', 3)::numeric
         )
$$;

-- ─── 2. Installation schema format checks & explicit v1 order-line rule ───

ALTER TABLE public.product_installations
  DROP CONSTRAINT IF EXISTS product_installations_config_schema_ck;

ALTER TABLE public.product_installations
  ADD CONSTRAINT product_installations_config_schema_ck
    CHECK (configuration_schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$');

COMMENT ON CONSTRAINT product_installations_source_order_uq ON public.product_installations
  IS 'v1 enforces one product installation per commercial order line (source, external_order_id).';

-- ─── 3. Fix enforce_product_installation_update() (snapshot, forward-only, independent timestamp guards) ───

CREATE OR REPLACE FUNCTION public.enforce_product_installation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  snapshot_exists boolean;
BEGIN
  IF OLD.status = 'offboarded' THEN
    RAISE EXCEPTION 'Offboarded installations are immutable.' USING ERRCODE = '23514';
  END IF;

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

  IF NEW.configuration_schema_version IS DISTINCT FROM OLD.configuration_schema_version
     AND NOT public.product_configuration_version_not_older(
       NEW.configuration_schema_version,
       OLD.configuration_schema_version
     ) THEN
    RAISE EXCEPTION 'The active configuration schema cannot move backwards.' USING ERRCODE = '23514';
  END IF;

  IF NEW.current_configuration_version IS DISTINCT FROM OLD.current_configuration_version THEN
    IF NEW.current_configuration_version <> OLD.current_configuration_version + 1 THEN
      RAISE EXCEPTION 'Configuration history versions must advance by exactly one.' USING ERRCODE = '23514';
    END IF;
    SELECT EXISTS (
      SELECT 1
      FROM public.installation_configuration_versions AS version
      WHERE version.tenant_id = NEW.tenant_id
        AND version.installation_id = NEW.id
        AND version.version = NEW.current_configuration_version
        AND version.configuration_schema_version = NEW.configuration_schema_version
    ) INTO snapshot_exists;
    IF NOT snapshot_exists THEN
      RAISE EXCEPTION 'The current configuration version must have an immutable snapshot.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.configuration_schema_version IS DISTINCT FROM OLD.configuration_schema_version THEN
    RAISE EXCEPTION 'Configuration schema changes require a new immutable snapshot.'
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

  -- Check both timestamps independently before computing transition values so
  -- combined updates (e.g., setting status='ready' while forging offboarded_at) never bypass checks.
  IF NEW.ready_at IS DISTINCT FROM OLD.ready_at
     AND NOT (NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready') THEN
    RAISE EXCEPTION 'The ready timestamp is maintained by lifecycle transitions.' USING ERRCODE = '23514';
  END IF;
  IF NEW.offboarded_at IS DISTINCT FROM OLD.offboarded_at
     AND NOT (NEW.status = 'offboarded' AND OLD.status IS DISTINCT FROM 'offboarded') THEN
    RAISE EXCEPTION 'The offboarded timestamp is maintained by lifecycle transitions.' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' THEN
    IF OLD.status <> 'offboarding' THEN
      NEW.ready_at := coalesce(OLD.ready_at, now());
    ELSE
      NEW.ready_at := OLD.ready_at;
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
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─── 4. Harden installation_configuration_versions: no secrets, sequential, forward, immutable ───

ALTER TABLE public.installation_configuration_versions
  DROP CONSTRAINT IF EXISTS installation_configuration_versions_version_ck,
  DROP CONSTRAINT IF EXISTS installation_configuration_versions_object_ck,
  DROP CONSTRAINT IF EXISTS installation_configuration_versions_schema_ck,
  DROP CONSTRAINT IF EXISTS installation_configuration_versions_checksum_ck,
  DROP CONSTRAINT IF EXISTS installation_configuration_versions_no_secrets_ck;

ALTER TABLE public.installation_configuration_versions
  ADD CONSTRAINT installation_configuration_versions_version_ck
    CHECK (version > 0),
  ADD CONSTRAINT installation_configuration_versions_object_ck
    CHECK (jsonb_typeof(configuration) = 'object'),
  ADD CONSTRAINT installation_configuration_versions_schema_ck
    CHECK (configuration_schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  ADD CONSTRAINT installation_configuration_versions_checksum_ck
    CHECK (checksum ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT installation_configuration_versions_no_secrets_ck
    CHECK (NOT public.product_configuration_contains_secret_key(configuration));

CREATE OR REPLACE FUNCTION public.installation_configuration_guard_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  installation public.product_installations%ROWTYPE;
BEGIN
  SELECT * INTO installation
  FROM public.product_installations AS product_installation
  WHERE product_installation.tenant_id = NEW.tenant_id
    AND product_installation.id = NEW.installation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Installation does not exist in the active tenant context.' USING ERRCODE = '23503';
  END IF;
  IF installation.status IN ('offboarding', 'offboarded') THEN
    RAISE EXCEPTION 'Configuration cannot change while an installation is offboarding.' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> installation.current_configuration_version + 1 THEN
    RAISE EXCEPTION 'Configuration history versions must be sequential.' USING ERRCODE = '23514';
  END IF;
  IF NOT public.product_configuration_version_not_older(
    NEW.configuration_schema_version,
    installation.configuration_schema_version
  ) THEN
    RAISE EXCEPTION 'Configuration schema versions can only advance.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS installation_configuration_guard_insert
  ON public.installation_configuration_versions;
CREATE TRIGGER installation_configuration_guard_insert
  BEFORE INSERT ON public.installation_configuration_versions
  FOR EACH ROW EXECUTE FUNCTION public.installation_configuration_guard_insert();

CREATE OR REPLACE FUNCTION public.installation_configuration_advance_current_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.product_installations
     SET current_configuration_version = NEW.version,
         configuration_schema_version = NEW.configuration_schema_version
   WHERE tenant_id = NEW.tenant_id
     AND id = NEW.installation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS installation_configuration_advance_current_version
  ON public.installation_configuration_versions;
CREATE TRIGGER installation_configuration_advance_current_version
  AFTER INSERT ON public.installation_configuration_versions
  FOR EACH ROW EXECUTE FUNCTION public.installation_configuration_advance_current_version();

CREATE OR REPLACE FUNCTION public.installation_configuration_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  installation_status varchar(24);
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Installation configuration snapshots are append-only and immutable.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT status INTO installation_status
      FROM public.product_installations
     WHERE tenant_id = OLD.tenant_id
       AND id = OLD.installation_id;
    IF installation_status IS DISTINCT FROM 'offboarded' THEN
      RAISE EXCEPTION 'Installation configuration history may only be purged after installation offboarding.'
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS installation_configuration_immutable_update
  ON public.installation_configuration_versions;
CREATE TRIGGER installation_configuration_immutable_update
  BEFORE UPDATE ON public.installation_configuration_versions
  FOR EACH ROW EXECUTE FUNCTION public.installation_configuration_immutable();

DROP TRIGGER IF EXISTS installation_configuration_purge_only_delete
  ON public.installation_configuration_versions;
CREATE TRIGGER installation_configuration_purge_only_delete
  BEFORE DELETE ON public.installation_configuration_versions
  FOR EACH ROW EXECUTE FUNCTION public.installation_configuration_immutable();

-- ─── 5. Verified domain-to-installation routing foundation ───

ALTER TABLE public.tenant_domains
  ADD COLUMN IF NOT EXISTS installation_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_domains'::regclass
      AND conname = 'tenant_domains_installation_tenant_fk'
  ) THEN
    ALTER TABLE public.tenant_domains
      ADD CONSTRAINT tenant_domains_installation_tenant_fk
      FOREIGN KEY (installation_id, tenant_id)
      REFERENCES public.product_installations (id, tenant_id)
      ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tenant_domains_installation_idx
  ON public.tenant_domains (tenant_id, installation_id);

CREATE OR REPLACE VIEW public.tenant_domain_directory
WITH (security_barrier = true)
AS
SELECT hostname, tenant_id, installation_id
FROM public.tenant_domains
WHERE status = 'active' AND verified_at IS NOT NULL;

-- ─── 6. Restore failure_disposition & compensating transition guards on operations ───

CREATE OR REPLACE FUNCTION public.enforce_product_provisioning_operation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  has_operator_actor boolean;
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

  has_operator_actor := NEW.last_operator_actor_id IS NOT NULL AND btrim(NEW.last_operator_actor_id) <> '';

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'accepted' AND NEW.status IN ('validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'failed', 'compensating')) OR
    (OLD.status = 'validating' AND NEW.status IN ('provisioning_tenant', 'configuring_installation', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'provisioning_tenant' AND NEW.status IN ('configuring_installation', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'configuring_installation' AND NEW.status IN ('provisioning_tenant', 'provisioning_hosting', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'provisioning_hosting' AND NEW.status IN ('configuring_installation', 'ready', 'failed', 'compensating', 'compensation_required')) OR
    (OLD.status = 'failed' AND (
      (NEW.status IN ('validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting')
        AND (OLD.failure_disposition = 'retry' OR has_operator_actor))
      OR (NEW.status = 'compensating' AND (OLD.failure_disposition = 'compensate' OR has_operator_actor))
    )) OR
    (OLD.status = 'compensating' AND NEW.status IN ('compensated', 'compensation_required')) OR
    (OLD.status = 'compensation_required' AND (
      (NEW.status IN ('validating', 'provisioning_tenant', 'configuring_installation', 'provisioning_hosting')
        AND has_operator_actor)
      OR (NEW.status = 'compensating'
        AND (OLD.failure_disposition IN ('compensation_failed', 'unknown') OR has_operator_actor))
      OR (NEW.status = 'failed' AND NEW.failure_disposition = 'compensate' AND has_operator_actor)
    ))
  ) THEN
    RAISE EXCEPTION 'invalid provisioning operation status transition: % -> % (disposition: %)',
      OLD.status, NEW.status, COALESCE(OLD.failure_disposition, 'none')
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

-- ─── 7. Lifecycle outbox payload PII/shape enforcement ───

CREATE OR REPLACE FUNCTION public.is_safe_lifecycle_outbox_payload(p_payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lifecycle jsonb;
  v_key text;
  v_top_count integer := 0;
  v_life_count integer := 0;
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
BEGIN
  IF jsonb_typeof(p_payload) <> 'object' THEN RETURN false; END IF;

  FOR v_key IN SELECT key FROM jsonb_object_keys(p_payload) AS key LOOP
    v_top_count := v_top_count + 1;
    IF v_key NOT IN ('schemaVersion', 'eventType', 'eventId', 'correlationId', 'occurredAt', 'source', 'lifecycle') THEN
      RETURN false;
    END IF;
  END LOOP;
  IF v_top_count <> 7 THEN RETURN false; END IF;

  IF p_payload->>'schemaVersion' <> '1.0.0'
     OR p_payload->>'eventType' <> 'product.subscription.lifecycle.status.v1'
     OR p_payload->>'source' <> 'bazion-platform'
     OR (p_payload->>'eventId') !~* v_uuid_re
     OR (p_payload->>'correlationId') !~* v_uuid_re
     OR jsonb_typeof(p_payload->'occurredAt') <> 'string' THEN
    RETURN false;
  END IF;

  v_lifecycle := p_payload->'lifecycle';
  IF v_lifecycle IS NULL OR jsonb_typeof(v_lifecycle) <> 'object' THEN RETURN false; END IF;

  FOR v_key IN SELECT key FROM jsonb_object_keys(v_lifecycle) AS key LOOP
    v_life_count := v_life_count + 1;
    IF v_key NOT IN (
      'schemaVersion',
      'commandId',
      'action',
      'subscriptionId',
      'externalOrderId',
      'tenantId',
      'installationId',
      'installationStatus',
      'applied',
      'reasonCode',
      'effectiveAt',
      'updatedAt'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  IF v_life_count <> 12 THEN RETURN false; END IF;

  IF v_lifecycle->>'schemaVersion' <> '1.0.0'
     OR (v_lifecycle->>'commandId') !~* v_uuid_re
     OR (v_lifecycle->>'action') NOT IN ('activate', 'grace', 'suspend', 'reactivate', 'cancel')
     OR length(btrim(COALESCE(v_lifecycle->>'subscriptionId', ''))) NOT BETWEEN 1 AND 120
     OR length(btrim(COALESCE(v_lifecycle->>'externalOrderId', ''))) NOT BETWEEN 1 AND 120
     OR jsonb_typeof(v_lifecycle->'applied') <> 'boolean'
     OR (v_lifecycle->>'reasonCode') !~ '^[A-Z][A-Z0-9_]{1,79}$'
     OR jsonb_typeof(v_lifecycle->'effectiveAt') <> 'string'
     OR jsonb_typeof(v_lifecycle->'updatedAt') <> 'string' THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_lifecycle->'tenantId') <> 'null'
     AND (jsonb_typeof(v_lifecycle->'tenantId') <> 'string' OR (v_lifecycle->>'tenantId') !~* v_uuid_re) THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_lifecycle->'installationId') <> 'null'
     AND (jsonb_typeof(v_lifecycle->'installationId') <> 'string' OR (v_lifecycle->>'installationId') !~* v_uuid_re) THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_lifecycle->'installationStatus') <> 'null'
     AND (jsonb_typeof(v_lifecycle->'installationStatus') <> 'string'
       OR (v_lifecycle->>'installationStatus') NOT IN ('requested', 'provisioning', 'ready', 'suspended', 'failed', 'offboarding', 'offboarded')) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

ALTER TABLE public.product_subscription_lifecycle_outbox
  DROP CONSTRAINT IF EXISTS product_sub_lifecycle_outbox_safe_payload_ck;

ALTER TABLE public.product_subscription_lifecycle_outbox
  ADD CONSTRAINT product_sub_lifecycle_outbox_safe_payload_ck
    CHECK (public.is_safe_lifecycle_outbox_payload(payload));

-- ─── 8. Least-privilege revocations & narrow hosting projection read ───

REVOKE ALL ON FUNCTION public.product_configuration_contains_secret_key(jsonb),
  public.product_configuration_version_not_older(varchar, varchar),
  public.is_safe_lifecycle_outbox_payload(jsonb),
  public.installation_configuration_guard_insert(),
  public.installation_configuration_advance_current_version(),
  public.installation_configuration_immutable() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.product_configuration_contains_secret_key(jsonb) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_configuration_version_not_older(varchar, varchar) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_safe_lifecycle_outbox_payload(jsonb) TO PUBLIC;

DO $$
DECLARE
  v_role text;
BEGIN
  FOR v_role IN
    SELECT unnest(ARRAY[
      'bazion_auth_runtime',
      'bazion_notification_enqueuer',
      'bazion_notification_worker',
      'bazion_hosting_reconciler'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_role) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE
           public.product_installations,
           public.product_provisioning_operations,
           public.product_provisioning_step_attempts,
           public.product_provisioning_operation_events,
           public.product_provisioning_inbox,
           public.product_provisioning_status_outbox,
           public.installation_configuration_versions,
           public.installation_offboarding_archives,
           public.product_subscription_lifecycle_inbox,
           public.product_subscription_lifecycle_outbox
         FROM %I',
        v_role
      );
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_hosting_reconciler') THEN
    EXECUTE 'REVOKE ALL ON TABLE
      public.federated_identity_links,
      public.identity_link_collisions,
      public.oidc_clients,
      public.oidc_authorization_codes,
      public.oidc_bff_auth_transactions,
      public.oidc_bff_sessions,
      public.commercial_order_claim_proofs,
      public.account_email_change_requests
    FROM bazion_hosting_reconciler';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'REVOKE ALL ON TABLE
      public.federated_identity_links,
      public.identity_link_collisions,
      public.oidc_clients,
      public.oidc_authorization_codes,
      public.oidc_bff_auth_transactions,
      public.oidc_bff_sessions,
      public.account_email_change_requests
    FROM bazion_product_provisioner';

    EXECUTE 'REVOKE UPDATE ON public.installation_configuration_versions FROM bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON public.installation_configuration_versions TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT (id, tenant_id, idempotency_key, state, error_code, updated_at) ON public.tenant_hosting_deployments TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enforce_product_installation_update() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.enforce_product_provisioning_operation_update() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.installation_configuration_guard_insert() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.installation_configuration_advance_current_version() TO bazion_product_provisioner';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.installation_configuration_immutable() TO bazion_product_provisioner';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_tenant_provisioner') THEN
    EXECUTE 'GRANT REFERENCES (id, tenant_id) ON public.product_installations TO bazion_tenant_provisioner';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_tenant_resolver') THEN
    EXECUTE 'GRANT SELECT ON public.tenant_domain_directory TO bazion_tenant_resolver';
  END IF;
END;
$$;


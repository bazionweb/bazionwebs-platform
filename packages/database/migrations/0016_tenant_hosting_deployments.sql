-- Durable, tenant-scoped hosting deployments.
-- Provider references and operational metadata only: never store environment values,
-- API keys, database URLs, or secret-manager payloads here.

CREATE TABLE IF NOT EXISTS public.tenant_hosting_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  provider varchar(40) NOT NULL,
  template varchar(32) NOT NULL CHECK (template IN ('wordpress', 'node-nextjs', 'ecommerce')),
  template_version varchar(80) NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  provider_resource_id varchar(255),
  state varchar(24) NOT NULL DEFAULT 'provisioning'
    CHECK (state IN ('provisioning', 'ready', 'deploying', 'running', 'stopped', 'failed', 'unknown')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  requested_by varchar(128) NOT NULL,
  request_id varchar(128),
  error_code varchar(64),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_deployed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_hosting_deployments_idempotency_uq UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT tenant_hosting_deployments_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT tenant_hosting_deployments_lease_ck
    CHECK ((lease_token IS NULL) = (lease_expires_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_hosting_provider_resource_uq
  ON public.tenant_hosting_deployments(provider, provider_resource_id)
  WHERE provider_resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tenant_hosting_deployments_tenant_created_idx
  ON public.tenant_hosting_deployments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tenant_hosting_deployments_recovery_idx
  ON public.tenant_hosting_deployments(state, lease_expires_at)
  WHERE state IN ('provisioning', 'deploying', 'unknown');

CREATE TABLE IF NOT EXISTS public.tenant_hosting_deployment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  event_type varchar(64) NOT NULL,
  from_state varchar(24),
  to_state varchar(24),
  actor_type varchar(16) NOT NULL CHECK (actor_type IN ('user', 'service', 'system')),
  actor_id varchar(128) NOT NULL,
  request_id varchar(128),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_hosting_events_deployment_tenant_fk
    FOREIGN KEY (deployment_id, tenant_id)
    REFERENCES public.tenant_hosting_deployments(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS tenant_hosting_events_tenant_occurred_idx
  ON public.tenant_hosting_deployment_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tenant_hosting_events_deployment_occurred_idx
  ON public.tenant_hosting_deployment_events(deployment_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.reject_tenant_hosting_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'tenant hosting deployment events are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS tenant_hosting_events_append_only
  ON public.tenant_hosting_deployment_events;
CREATE TRIGGER tenant_hosting_events_append_only
  BEFORE UPDATE OR DELETE ON public.tenant_hosting_deployment_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_tenant_hosting_event_mutation();

REVOKE ALL PRIVILEGES ON TABLE public.tenant_hosting_deployments,
  public.tenant_hosting_deployment_events FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.tenant_hosting_deployments TO bazion_app;
GRANT SELECT, INSERT ON public.tenant_hosting_deployment_events TO bazion_app;
REVOKE ALL PRIVILEGES ON FUNCTION public.reject_tenant_hosting_event_mutation() FROM PUBLIC;

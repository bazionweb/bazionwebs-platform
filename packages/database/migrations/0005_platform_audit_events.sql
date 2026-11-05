-- Platform audit trail: a shared append-only record for privileged actions.
-- No tenant RLS: events may describe platform actions or tenant-scoped actions.
-- Runtime API inserts only; reads are reserved for a future explicit auditor role.

CREATE TABLE IF NOT EXISTS public.platform_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  actor_type varchar(16) NOT NULL CHECK (actor_type IN ('user', 'service', 'system')),
  actor_id varchar(128) NOT NULL,
  actor_role varchar(64),
  action varchar(128) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id varchar(128),
  outcome varchar(16) NOT NULL CHECK (outcome IN ('succeeded', 'denied', 'failed')),
  request_id varchar(128),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS platform_audit_events_occurred_idx
  ON public.platform_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_events_tenant_occurred_idx
  ON public.platform_audit_events (tenant_id, occurred_at DESC)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_audit_events_actor_occurred_idx
  ON public.platform_audit_events (actor_type, actor_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.reject_platform_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'platform audit events are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS platform_audit_events_append_only ON public.platform_audit_events;
CREATE TRIGGER platform_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.platform_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_platform_audit_event_mutation();

REVOKE ALL PRIVILEGES ON TABLE public.platform_audit_events
  FROM PUBLIC, bazion_app, bazion_auth_runtime, bazion_tenant_resolver,
       bazion_tenant_provisioner, bazion_notification_enqueuer, bazion_notification_worker;
GRANT INSERT ON TABLE public.platform_audit_events TO bazion_app;

REVOKE ALL PRIVILEGES ON FUNCTION public.reject_platform_audit_event_mutation() FROM PUBLIC;

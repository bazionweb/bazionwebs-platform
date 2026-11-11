-- Scheduling and least-privilege access for the tenant hosting status reconciler.
-- The worker can inspect provider resources and update only hosting status metadata.
-- It cannot create/delete deployments or read tenant application data.

ALTER TABLE public.tenant_hosting_deployments
  ADD COLUMN IF NOT EXISTS next_reconcile_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_inspected_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconcile_failure_count integer NOT NULL DEFAULT 0
    CHECK (reconcile_failure_count >= 0);

CREATE INDEX IF NOT EXISTS tenant_hosting_deployments_reconcile_due_idx
  ON public.tenant_hosting_deployments(provider, next_reconcile_at, lease_expires_at, created_at)
  WHERE provider_resource_id IS NOT NULL;

-- Runtime roles are provisioned by packages/database/init/001-create-roles.sh.
-- Existing databases that predate this role must provision it using the operations
-- procedure before starting the worker. Migration credentials remain non-privileged.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_hosting_reconciler') THEN
    EXECUTE 'GRANT SELECT ON public.tenant_hosting_deployments TO bazion_hosting_reconciler';
    EXECUTE 'GRANT UPDATE (state,error_code,lease_token,lease_expires_at,last_deployed_at,updated_at,next_reconcile_at,last_inspected_at,reconcile_failure_count) ON public.tenant_hosting_deployments TO bazion_hosting_reconciler';
    EXECUTE 'GRANT INSERT ON public.tenant_hosting_deployment_events TO bazion_hosting_reconciler';
  END IF;
END;
$$;

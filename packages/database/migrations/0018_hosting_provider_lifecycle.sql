-- Record provider resource removal without deleting customer persistent volumes.
-- The provider_resource_id is cleared so the read-only reconciler will not poll a removed resource.
ALTER TABLE public.tenant_hosting_deployments
  DROP CONSTRAINT IF EXISTS tenant_hosting_deployments_state_check,
  DROP CONSTRAINT IF EXISTS tenant_hosting_deployments_state_ck;

ALTER TABLE public.tenant_hosting_deployments
  ADD CONSTRAINT tenant_hosting_deployments_state_ck
  CHECK (state IN ('provisioning', 'ready', 'deploying', 'running', 'stopped', 'failed', 'unknown', 'removed'));

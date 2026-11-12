-- Commercial provisioning checks for an existing hosting deployment when it
-- replays an idempotent request. Keep that check least-privileged: the
-- provisioner only needs identity columns and must not read hosting details.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'GRANT SELECT (id, tenant_id, idempotency_key) ON TABLE public.tenant_hosting_deployments TO bazion_product_provisioner';
  END IF;
END;
$$;

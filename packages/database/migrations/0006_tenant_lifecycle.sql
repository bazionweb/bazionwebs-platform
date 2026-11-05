-- Explicit lifecycle timestamps and safe soft-closure metadata.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS tenants_status_created_idx
  ON public.tenants(status, created_at DESC);

-- The resolver remains read-only. Lifecycle writes are performed only by the
-- narrowly scoped tenant provisioner service role.
GRANT SELECT ON public.tenants TO bazion_tenant_resolver;
GRANT SELECT, UPDATE ON public.tenants TO bazion_tenant_provisioner;

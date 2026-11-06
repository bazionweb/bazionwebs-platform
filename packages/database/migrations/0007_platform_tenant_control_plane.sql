-- Platform control-plane extensions: tenant module overrides and settings.
-- These are platform registry tables, not tenant business tables. Access is
-- through permission-checked platform API services rather than tenant RLS.

CREATE TABLE IF NOT EXISTS public.tenant_module_entitlements (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  module_id varchar(64) NOT NULL,
  enabled boolean NOT NULL,
  updated_by varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_id),
  CONSTRAINT tenant_module_entitlements_module_id_ck
    CHECK (module_id ~ '^[a-z][a-z0-9-]{1,63}$')
);

CREATE INDEX IF NOT EXISTS tenant_module_entitlements_module_enabled_idx
  ON public.tenant_module_entitlements (module_id, enabled, tenant_id);

CREATE TABLE IF NOT EXISTS public.tenant_platform_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE RESTRICT,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(settings) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_by varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The resolver can read explicit overrides; only the provisioner can mutate
-- these tables. Audit reads are exposed through the permission-checked API.
GRANT SELECT ON public.tenant_module_entitlements, public.tenant_platform_settings
  TO bazion_tenant_resolver;
GRANT SELECT ON public.tenant_module_entitlements TO bazion_app;
GRANT SELECT, INSERT, UPDATE ON public.tenant_module_entitlements, public.tenant_platform_settings
  TO bazion_tenant_provisioner;
GRANT SELECT ON public.platform_audit_events TO bazion_app;

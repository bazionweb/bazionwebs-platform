-- Tenant business-data routing metadata. The registry stores secret references,
-- never database URLs, passwords or other credential material.
CREATE TABLE IF NOT EXISTS public.tenant_database_bindings (
  tenant_id uuid PRIMARY KEY
    REFERENCES public.tenants(id) ON DELETE RESTRICT,
  tier varchar(16) NOT NULL DEFAULT 'shared'
    CHECK (tier IN ('shared', 'dedicated')),
  state varchar(16) NOT NULL DEFAULT 'shared'
    CHECK (state IN ('shared', 'provisioning', 'ready', 'failed', 'draining')),
  runtime_secret_ref varchar(512),
  migration_secret_ref varchar(512),
  schema_version varchar(255),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_database_bindings_shared_ck CHECK (
    tier <> 'shared' OR (
      state = 'shared'
      AND runtime_secret_ref IS NULL
      AND migration_secret_ref IS NULL
      AND schema_version IS NULL
    )
  ),
  CONSTRAINT tenant_database_bindings_ready_ck CHECK (
    state <> 'ready' OR (
      tier = 'dedicated'
      AND runtime_secret_ref IS NOT NULL
      AND migration_secret_ref IS NOT NULL
      AND schema_version IS NOT NULL
    )
  )
);

-- Make the default explicit for current tenants. New tenants without a row are
-- also interpreted as shared by the runtime resolver until a platform
-- provisioning workflow writes a dedicated binding.
INSERT INTO public.tenant_database_bindings (tenant_id, tier, state)
SELECT id, 'shared', 'shared'
  FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

REVOKE ALL PRIVILEGES ON TABLE public.tenant_database_bindings FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.tenant_database_bindings
  FROM bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;

-- Runtime tenant routing can read only the binding fields it needs. Migration
-- credentials remain visible only to the audited platform provisioning role.
GRANT SELECT (tenant_id, tier, state, runtime_secret_ref, schema_version, updated_at)
  ON TABLE public.tenant_database_bindings TO bazion_tenant_resolver;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tenant_database_bindings
  TO bazion_tenant_provisioner;

-- Runtime verifies the target tenant database has applied the binding's
-- declared migration version before opening a business transaction.
GRANT SELECT ON TABLE public.schema_migrations TO bazion_app;

COMMENT ON TABLE public.tenant_database_bindings IS
  'Central routing metadata for shared or dedicated tenant business databases; contains secret references only.';

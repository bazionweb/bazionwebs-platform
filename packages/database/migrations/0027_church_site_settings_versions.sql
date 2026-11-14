-- Migration 0027: Church Site Settings Versions and Rollback with forced RLS

CREATE TABLE IF NOT EXISTS ministry_site_settings_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  version_number integer NOT NULL,
  settings jsonb NOT NULL,
  profile jsonb NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'superseded')),
  created_by varchar(160),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by varchar(160),
  note varchar(250),
  CONSTRAINT ministry_site_settings_versions_tenant_version_uq UNIQUE (tenant_id, version_number)
);
CREATE INDEX IF NOT EXISTS ministry_site_settings_versions_tenant_status_idx ON ministry_site_settings_versions(tenant_id, status);

-- Enforce forced Row Level Security
DO $$
BEGIN
  EXECUTE 'ALTER TABLE ministry_site_settings_versions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE ministry_site_settings_versions FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON ministry_site_settings_versions';
  EXECUTE $policy$CREATE POLICY tenant_isolation ON ministry_site_settings_versions USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$policy$;
END $$;

-- Grants for bazion_app role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      ministry_site_settings_versions
    TO bazion_app;
  END IF;
END $$;


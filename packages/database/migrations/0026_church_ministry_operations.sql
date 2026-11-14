-- Migration 0026: Private Church Ministry Operations Records with forced RLS

CREATE TABLE IF NOT EXISTS church_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(120) NOT NULL,
  slug varchar(140) NOT NULL,
  description text NOT NULL,
  icon varchar(32),
  leader_name varchar(160),
  leader_role varchar(120),
  meeting_schedule varchar(200),
  contact_email varchar(254),
  is_public boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_departments_tenant_slug_uq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS church_departments_tenant_order_idx ON church_departments(tenant_id, display_order);

CREATE TABLE IF NOT EXISTS church_small_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(120) NOT NULL,
  slug varchar(140) NOT NULL,
  category varchar(80) NOT NULL DEFAULT 'Home Fellowship',
  description text,
  leader_name varchar(160) NOT NULL,
  meeting_schedule varchar(200) NOT NULL,
  public_location_label varchar(300) NOT NULL,
  private_address text,
  department_id uuid REFERENCES church_departments(id) ON DELETE SET NULL,
  capacity integer,
  is_public boolean NOT NULL DEFAULT true,
  accepting_members boolean NOT NULL DEFAULT true,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_small_groups_tenant_slug_uq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS church_small_groups_tenant_status_idx ON church_small_groups(tenant_id, status);

CREATE TABLE IF NOT EXISTS church_group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  group_id uuid NOT NULL REFERENCES church_small_groups(id) ON DELETE CASCADE,
  full_name varchar(160) NOT NULL,
  email varchar(254) NOT NULL,
  telephone varchar(30) NOT NULL,
  role varchar(24) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'leader', 'host')),
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('requested', 'active', 'inactive', 'declined')),
  privacy_consent_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_group_memberships_tenant_group_email_uq UNIQUE (tenant_id, group_id, email)
);
CREATE INDEX IF NOT EXISTS church_group_memberships_tenant_group_idx ON church_group_memberships(tenant_id, group_id);

CREATE TABLE IF NOT EXISTS church_volunteer_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(120) NOT NULL,
  slug varchar(140) NOT NULL,
  department_id uuid REFERENCES church_departments(id) ON DELETE SET NULL,
  description text NOT NULL,
  requirements text,
  coordinator_name varchar(160),
  is_public boolean NOT NULL DEFAULT true,
  accepting_applications boolean NOT NULL DEFAULT true,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_volunteer_teams_tenant_slug_uq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS church_volunteer_teams_tenant_status_idx ON church_volunteer_teams(tenant_id, status);

CREATE TABLE IF NOT EXISTS church_volunteer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  team_id uuid NOT NULL REFERENCES church_volunteer_teams(id) ON DELETE CASCADE,
  full_name varchar(160) NOT NULL,
  email varchar(254) NOT NULL,
  telephone varchar(30) NOT NULL,
  availability varchar(300),
  message text,
  status varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn')),
  privacy_consent_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by varchar(160),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS church_volunteer_apps_tenant_team_idx ON church_volunteer_applications(tenant_id, team_id);

CREATE TABLE IF NOT EXISTS church_inventory_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(160) NOT NULL,
  asset_tag varchar(60) NOT NULL,
  category varchar(80) NOT NULL,
  location varchar(180) NOT NULL DEFAULT 'Main Campus',
  condition varchar(24) NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'needs_repair', 'retired')),
  status varchar(24) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'maintenance', 'reserved', 'retired')),
  assigned_to varchar(160),
  acquired_on date,
  purchase_value_minor integer,
  currency varchar(3) NOT NULL DEFAULT 'KES',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_inventory_assets_tenant_tag_uq UNIQUE (tenant_id, asset_tag)
);
CREATE INDEX IF NOT EXISTS church_inventory_assets_tenant_category_idx ON church_inventory_assets(tenant_id, category);

CREATE TABLE IF NOT EXISTS church_inventory_asset_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  asset_id uuid NOT NULL REFERENCES church_inventory_assets(id) ON DELETE CASCADE,
  event_type varchar(32) NOT NULL CHECK (event_type IN ('maintenance', 'assignment', 'condition_change', 'reservation', 'note')),
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_by varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS church_asset_events_tenant_asset_idx ON church_inventory_asset_events(tenant_id, asset_id);

-- Enforce forced Row Level Security across all operations tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'church_departments',
    'church_small_groups',
    'church_group_memberships',
    'church_volunteer_teams',
    'church_volunteer_applications',
    'church_inventory_assets',
    'church_inventory_asset_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      $policy$CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)$policy$,
      t
    );
  END LOOP;
END $$;

-- Grants for bazion_app role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      church_departments,
      church_small_groups,
      church_group_memberships,
      church_volunteer_teams,
      church_volunteer_applications,
      church_inventory_assets,
      church_inventory_asset_events
    TO bazion_app;
  END IF;
END $$;


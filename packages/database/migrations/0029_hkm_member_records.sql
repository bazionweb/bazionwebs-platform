CREATE TABLE IF NOT EXISTS public.hkm_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL,
  location varchar(240) NOT NULL DEFAULT '',
  pastor_name varchar(160) NOT NULL DEFAULT '',
  contact_phone varchar(40) NOT NULL DEFAULT '',
  contact_email varchar(254) NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS hkm_branches_tenant_status_idx ON public.hkm_branches(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.hkm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL,
  membership_number varchar(48) NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(40) NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'transferred')),
  role varchar(80) NOT NULL DEFAULT 'Member',
  date_of_birth date,
  baptism_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, membership_number),
  UNIQUE (tenant_id, email),
  FOREIGN KEY (branch_id, tenant_id) REFERENCES public.hkm_branches(id, tenant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS hkm_members_tenant_status_idx ON public.hkm_members(tenant_id, status);
CREATE INDEX IF NOT EXISTS hkm_members_tenant_name_idx ON public.hkm_members(tenant_id, last_name, first_name);

CREATE TABLE IF NOT EXISTS public.hkm_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL,
  service_date date NOT NULL,
  service_type varchar(120) NOT NULL,
  count_men integer NOT NULL DEFAULT 0 CHECK (count_men >= 0),
  count_women integer NOT NULL DEFAULT 0 CHECK (count_women >= 0),
  count_children integer NOT NULL DEFAULT 0 CHECK (count_children >= 0),
  recorded_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, tenant_id) REFERENCES public.hkm_branches(id, tenant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS hkm_attendance_tenant_date_idx ON public.hkm_attendance_records(tenant_id, service_date);

CREATE TABLE IF NOT EXISTS public.hkm_giving_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP')),
  giving_type varchar(48) NOT NULL,
  transaction_date timestamptz NOT NULL DEFAULT now(),
  payment_method varchar(40) NOT NULL DEFAULT 'manual',
  receipt_number varchar(80) NOT NULL,
  payment_status varchar(24) NOT NULL DEFAULT 'verified' CHECK (payment_status IN ('pending', 'verified', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, tenant_id) REFERENCES public.hkm_members(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id, tenant_id) REFERENCES public.hkm_branches(id, tenant_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, receipt_number)
);
CREATE INDEX IF NOT EXISTS hkm_giving_tenant_member_date_idx ON public.hkm_giving_transactions(tenant_id, member_id, transaction_date);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['hkm_branches','hkm_members','hkm_attendance_records','hkm_giving_transactions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.hkm_branches, public.hkm_members,
      public.hkm_attendance_records, public.hkm_giving_transactions TO bazion_app;
  END IF;
END $$;

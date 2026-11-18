CREATE TABLE IF NOT EXISTS public.hkm_member_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  service_date date NOT NULL,
  service_type varchar(120) NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
  recorded_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (member_id, tenant_id) REFERENCES public.hkm_members(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id, tenant_id) REFERENCES public.hkm_branches(id, tenant_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, member_id, service_date, service_type)
);
CREATE INDEX IF NOT EXISTS hkm_member_attendance_tenant_service_idx
  ON public.hkm_member_attendance_records(tenant_id, service_date, service_type);

ALTER TABLE public.hkm_member_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hkm_member_attendance_records FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.hkm_member_attendance_records;
CREATE POLICY tenant_isolation ON public.hkm_member_attendance_records
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.hkm_member_attendance_records TO bazion_app;
  END IF;
END $$;

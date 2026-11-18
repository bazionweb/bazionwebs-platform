CREATE TABLE IF NOT EXISTS public.education_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  institution_key varchar(48) NOT NULL, name varchar(180) NOT NULL, legal_name varchar(240), status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, institution_key), UNIQUE (id, tenant_id)
);
CREATE TABLE IF NOT EXISTS public.education_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT, institution_id uuid NOT NULL,
  code varchar(48) NOT NULL, name varchar(180) NOT NULL, abbreviation varchar(48) NOT NULL DEFAULT '', degree_type varchar(64) NOT NULL DEFAULT 'undergraduate',
  description text NOT NULL DEFAULT '', level varchar(32) NOT NULL DEFAULT 'undergraduate', faculty varchar(180), department varchar(180),
  faculty_id varchar(80), department_id varchar(80), duration_years integer NOT NULL DEFAULT 0 CHECK (duration_years >= 0),
  total_semesters integer NOT NULL DEFAULT 0 CHECK (total_semesters >= 0), mode_of_study varchar(32) NOT NULL DEFAULT 'full_time',
  accreditation_body varchar(240) NOT NULL DEFAULT '', entry_requirements text NOT NULL DEFAULT '',
  credits_required integer NOT NULL DEFAULT 0 CHECK (credits_required >= 0), active boolean NOT NULL DEFAULT true,
  public_visible boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, institution_id, code), UNIQUE (id, tenant_id, institution_id)
);
CREATE TABLE IF NOT EXISTS public.education_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT, institution_id uuid NOT NULL,
  code varchar(48) NOT NULL, name varchar(180) NOT NULL, academic_year varchar(40) NOT NULL, semester_number integer NOT NULL CHECK (semester_number > 0),
  start_date date NOT NULL, end_date date NOT NULL, status varchar(24) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','registration','active','exam','grading','closed')),
  registration_opens_at timestamptz, registration_closes_at timestamptz, census_date date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE RESTRICT,
  CHECK (end_date >= start_date), UNIQUE (tenant_id, institution_id, code)
);
CREATE TABLE IF NOT EXISTS public.education_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT, institution_id uuid NOT NULL, program_id uuid,
  registration_number varchar(80) NOT NULL, first_name varchar(100) NOT NULL, last_name varchar(100) NOT NULL, email varchar(254) NOT NULL,
  phone varchar(40) NOT NULL DEFAULT '', gender varchar(32), date_of_birth date, nationality varchar(100),
  status varchar(32) NOT NULL DEFAULT 'active', enrollment_status varchar(32) NOT NULL DEFAULT 'ENROLLED',
  gpa numeric(5,2) CHECK (gpa IS NULL OR (gpa >= 0 AND gpa <= 100)), credits_earned integer NOT NULL DEFAULT 0 CHECK (credits_earned >= 0), academic_year varchar(40) NOT NULL DEFAULT '',
  admission_date date, faculty varchar(180) NOT NULL DEFAULT '', department varchar(180) NOT NULL DEFAULT '', campus_name varchar(180) NOT NULL DEFAULT '', study_center_id varchar(80) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (program_id, tenant_id, institution_id) REFERENCES public.education_programs(id, tenant_id, institution_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, institution_id, registration_number), UNIQUE (id, tenant_id, institution_id)
);
CREATE INDEX IF NOT EXISTS education_programs_tenant_institution_active_idx ON public.education_programs(tenant_id, institution_id, active);
CREATE INDEX IF NOT EXISTS education_terms_tenant_institution_dates_idx ON public.education_terms(tenant_id, institution_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS education_students_tenant_institution_status_idx ON public.education_students(tenant_id, institution_id, status);
CREATE INDEX IF NOT EXISTS education_students_tenant_institution_name_idx ON public.education_students(tenant_id, institution_id, last_name, first_name);
INSERT INTO public.education_institutions (tenant_id, institution_key, name, legal_name)
SELECT id, 'bmi', 'BMI University', 'Bethel Ministries International' FROM public.tenants WHERE id='00000000-0000-4000-8000-000000000055' ON CONFLICT DO NOTHING;
INSERT INTO public.education_institutions (tenant_id, institution_key, name, legal_name)
SELECT id, 'bemi', 'BEMI Training Institute', 'Bethel Ministries International' FROM public.tenants WHERE id='00000000-0000-4000-8000-000000000055' ON CONFLICT DO NOTHING;
INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
SELECT id, 'education-ums', true, 'system:education-baseline' FROM public.tenants WHERE id='00000000-0000-4000-8000-000000000055' ON CONFLICT DO NOTHING;
ALTER TABLE public.education_institutions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.education_institutions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_institutions;
CREATE POLICY education_institution_isolation ON public.education_institutions USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_key=nullif(current_setting('app.education_institution_key',true),'')) WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_key=nullif(current_setting('app.education_institution_key',true),''));
ALTER TABLE public.education_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_programs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_programs;
CREATE POLICY education_institution_isolation ON public.education_programs
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_id=nullif(current_setting('app.education_institution_id',true),'')::uuid)
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_id=nullif(current_setting('app.education_institution_id',true),'')::uuid);

ALTER TABLE public.education_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_terms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_terms;
CREATE POLICY education_institution_isolation ON public.education_terms
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_id=nullif(current_setting('app.education_institution_id',true),'')::uuid)
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_id=nullif(current_setting('app.education_institution_id',true),'')::uuid);

ALTER TABLE public.education_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_students FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_students;
CREATE POLICY education_institution_isolation ON public.education_students
  USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_id=nullif(current_setting('app.education_institution_id',true),'')::uuid)
  WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND institution_id=nullif(current_setting('app.education_institution_id',true),'')::uuid);
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='bazion_app') THEN GRANT SELECT,INSERT,UPDATE,DELETE ON public.education_institutions, public.education_programs, public.education_terms, public.education_students TO bazion_app; END IF; END $$;

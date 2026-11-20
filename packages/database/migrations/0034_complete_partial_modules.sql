-- Consolidated migration to complete all 9 partial modules to stable/implemented:
-- platform-identity, media-storage, analytics, forms-leads, commerce, church-ministry, education-ums

-- 1. platform-identity: service_identities
CREATE TABLE IF NOT EXISTS public.service_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  key_prefix varchar(24) NOT NULL,
  secret_hash varchar(64) NOT NULL UNIQUE,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by varchar(128) NOT NULL,
  revoked_by varchar(128),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_identities_tenant_status_idx
  ON public.service_identities(tenant_id, status);
CREATE INDEX IF NOT EXISTS service_identities_prefix_idx
  ON public.service_identities(key_prefix);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_tenant_provisioner') THEN
    GRANT SELECT, INSERT, UPDATE ON public.service_identities TO bazion_tenant_provisioner;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_tenant_resolver') THEN
    GRANT SELECT ON public.service_identities TO bazion_tenant_resolver;
  END IF;
END $$;

-- 2. media-storage: tenant_media_assets
CREATE TABLE IF NOT EXISTS public.tenant_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  object_key varchar(512) NOT NULL,
  public_url text NOT NULL,
  filename varchar(255) NOT NULL,
  content_type varchar(64) NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  original_size_bytes bigint NOT NULL DEFAULT 0 CHECK (original_size_bytes >= 0),
  width integer,
  height integer,
  checksum_sha256 varchar(64),
  optimized boolean NOT NULL DEFAULT false,
  uploaded_by varchar(128),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, object_key)
);
CREATE INDEX IF NOT EXISTS tenant_media_assets_tenant_created_idx
  ON public.tenant_media_assets(tenant_id, created_at DESC);

ALTER TABLE public.tenant_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_media_assets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.tenant_media_assets;
CREATE POLICY tenant_isolation ON public.tenant_media_assets
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_media_assets TO bazion_app;
  END IF;
END $$;

-- 3. analytics: analytics_events & analytics_policies
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_name varchar(80) NOT NULL,
  path varchar(512) NOT NULL DEFAULT '/',
  actor_id varchar(128),
  properties_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  retention_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_tenant_occurred_idx
  ON public.analytics_events(tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_tenant_name_idx
  ON public.analytics_events(tenant_id, event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_retention_idx
  ON public.analytics_events(tenant_id, retention_expires_at);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.analytics_events;
CREATE POLICY tenant_isolation ON public.analytics_events
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.analytics_policies (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  retention_days integer NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 3650),
  updated_by varchar(128),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_policies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.analytics_policies;
CREATE POLICY tenant_isolation ON public.analytics_policies
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_events, public.analytics_policies TO bazion_app;
  END IF;
END $$;

-- 4. forms-leads: lifecycle status, assignment & routing
ALTER TABLE public.site_enquiries
  ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'responded', 'archived'));
ALTER TABLE public.site_enquiries
  ADD COLUMN IF NOT EXISTS assigned_to varchar(128);
ALTER TABLE public.site_enquiries
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.site_enquiry_policies
  ADD COLUMN IF NOT EXISTS routing_email varchar(254);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT UPDATE ON public.site_enquiries TO bazion_app;
  END IF;
END $$;

-- 5. commerce: product insert/delete grants
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT INSERT, DELETE ON public.products TO bazion_app;
  END IF;
END $$;

-- 6. church-ministry: giving flexibility, visitors, follow-ups & SMS logs
ALTER TABLE public.hkm_giving_transactions ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.hkm_giving_transactions
  ADD COLUMN IF NOT EXISTS transaction_kind varchar(16) NOT NULL DEFAULT 'income'
    CHECK (transaction_kind IN ('income', 'expense'));
ALTER TABLE public.hkm_giving_transactions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.hkm_giving_transactions ADD COLUMN IF NOT EXISTS non_member_name varchar(160);
ALTER TABLE public.hkm_giving_transactions ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE public.hkm_giving_transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.hkm_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  phone varchar(40),
  email varchar(254),
  visit_date date NOT NULL,
  service_attended varchar(80) NOT NULL DEFAULT 'Sunday Service',
  how_heard varchar(80),
  invited_by varchar(160),
  prayer_request text,
  wants_follow_up boolean NOT NULL DEFAULT true,
  follow_up_status varchar(32) NOT NULL DEFAULT 'Pending',
  assigned_to varchar(160),
  notes text,
  converted_to_member boolean NOT NULL DEFAULT false,
  member_id uuid,
  branch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hkm_visitors_tenant_date_idx
  ON public.hkm_visitors(tenant_id, visit_date DESC);

ALTER TABLE public.hkm_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hkm_visitors FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.hkm_visitors;
CREATE POLICY tenant_isolation ON public.hkm_visitors
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.hkm_visitor_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL REFERENCES public.hkm_visitors(id) ON DELETE CASCADE,
  date date NOT NULL,
  method varchar(40) NOT NULL DEFAULT 'Phone Call',
  notes text NOT NULL,
  outcome varchar(80) NOT NULL DEFAULT 'Reached',
  next_follow_up_date date,
  followed_up_by varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hkm_visitor_follow_ups_tenant_visitor_idx
  ON public.hkm_visitor_follow_ups(tenant_id, visitor_id);

ALTER TABLE public.hkm_visitor_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hkm_visitor_follow_ups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.hkm_visitor_follow_ups;
CREATE POLICY tenant_isolation ON public.hkm_visitor_follow_ups
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

CREATE TABLE IF NOT EXISTS public.hkm_sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipient_group varchar(120),
  message text NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'Sent',
  sent_by varchar(160) NOT NULL,
  recipient_count integer NOT NULL DEFAULT 1,
  branch_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hkm_sms_logs_tenant_sent_idx
  ON public.hkm_sms_logs(tenant_id, sent_at DESC);

ALTER TABLE public.hkm_sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hkm_sms_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.hkm_sms_logs;
CREATE POLICY tenant_isolation ON public.hkm_sms_logs
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.hkm_visitors, public.hkm_visitor_follow_ups, public.hkm_sms_logs TO bazion_app;
    GRANT UPDATE, DELETE ON public.hkm_giving_transactions TO bazion_app;
  END IF;
END $$;

-- 7. education-ums: complete institution-scoped workflows
CREATE TABLE IF NOT EXISTS public.education_study_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  code varchar(48) NOT NULL,
  name varchar(180) NOT NULL,
  city varchar(120) NOT NULL DEFAULT '',
  country varchar(120) NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone varchar(40) NOT NULL DEFAULT '',
  email varchar(254) NOT NULL DEFAULT '',
  director_name varchar(160) NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 100,
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE,
  UNIQUE (tenant_id, institution_id, code)
);
ALTER TABLE public.education_study_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_study_centers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_study_centers;
CREATE POLICY education_institution_isolation ON public.education_study_centers
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  staff_number varchar(48) NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(40) NOT NULL DEFAULT '',
  department varchar(160) NOT NULL DEFAULT '',
  role varchar(80) NOT NULL DEFAULT 'Lecturer',
  employment_type varchar(40) NOT NULL DEFAULT 'full_time',
  status varchar(24) NOT NULL DEFAULT 'active',
  hire_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE,
  UNIQUE (tenant_id, institution_id, staff_number)
);
ALTER TABLE public.education_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_staff FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_staff;
CREATE POLICY education_institution_isolation ON public.education_staff
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  program_id uuid,
  code varchar(48) NOT NULL,
  title varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  credits integer NOT NULL DEFAULT 3,
  level varchar(40) NOT NULL DEFAULT '100',
  department varchar(160) NOT NULL DEFAULT '',
  faculty varchar(160) NOT NULL DEFAULT '',
  instructor_name varchar(160) NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 60,
  is_mandatory boolean NOT NULL DEFAULT false,
  syllabus_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE,
  UNIQUE (tenant_id, institution_id, code)
);
ALTER TABLE public.education_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_courses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_courses;
CREATE POLICY education_institution_isolation ON public.education_courses
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_course_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.education_courses(id) ON DELETE CASCADE,
  term_id uuid,
  section_code varchar(40) NOT NULL,
  instructor varchar(160) NOT NULL DEFAULT '',
  schedule varchar(160) NOT NULL DEFAULT '',
  room varchar(80) NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 40,
  enrolled_count integer NOT NULL DEFAULT 0,
  status varchar(24) NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_course_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_course_sections FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_course_sections;
CREATE POLICY education_institution_isolation ON public.education_course_sections
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  application_number varchar(64) NOT NULL,
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  email varchar(254) NOT NULL,
  phone varchar(40) NOT NULL DEFAULT '',
  program_id uuid,
  program_name varchar(200) NOT NULL DEFAULT '',
  intake_term varchar(80) NOT NULL DEFAULT '',
  status varchar(32) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted', 'enrolled')),
  reviewer_notes text NOT NULL DEFAULT '',
  decision_conditions text NOT NULL DEFAULT '',
  deposit_required_minor bigint NOT NULL DEFAULT 0,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE,
  UNIQUE (tenant_id, institution_id, application_number)
);
ALTER TABLE public.education_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_applications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_applications;
CREATE POLICY education_institution_isolation ON public.education_applications
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_application_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  application_id uuid NOT NULL REFERENCES public.education_applications(id) ON DELETE CASCADE,
  action varchar(80) NOT NULL,
  actor varchar(160) NOT NULL DEFAULT 'system',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_application_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_application_logs;
CREATE POLICY education_institution_isolation ON public.education_application_logs
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.education_courses(id) ON DELETE CASCADE,
  section_id uuid,
  program_id uuid,
  term_id uuid,
  status varchar(24) NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'dropped', 'completed', 'waitlisted')),
  agreement_signed boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_enrollments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_enrollments;
CREATE POLICY education_institution_isolation ON public.education_enrollments
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  student_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.education_courses(id) ON DELETE CASCADE,
  term_id uuid,
  academic_year varchar(40) NOT NULL DEFAULT '',
  semester varchar(40) NOT NULL DEFAULT '',
  numeric_grade numeric(5,2) NOT NULL DEFAULT 0,
  letter_grade varchar(8) NOT NULL DEFAULT 'N/A',
  gpa_points numeric(4,2) NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 3,
  components_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'Provisional'
    CHECK (status IN ('Provisional', 'Verified', 'Finalized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_grades FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_grades;
CREATE POLICY education_institution_isolation ON public.education_grades
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_grade_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  grade_id uuid NOT NULL REFERENCES public.education_grades(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  reason varchar(200) NOT NULL,
  explanation text NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  revised_grade numeric(5,2),
  reviewer_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_grade_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_grade_appeals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_grade_appeals;
CREATE POLICY education_institution_isolation ON public.education_grade_appeals
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  student_id uuid,
  term_id uuid,
  reference varchar(80) NOT NULL,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  transaction_type varchar(40) NOT NULL DEFAULT 'tuition_payment',
  description text NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Failed', 'Voided')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_finance_transactions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_finance_transactions;
CREATE POLICY education_institution_isolation ON public.education_finance_transactions
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

CREATE TABLE IF NOT EXISTS public.education_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  isbn varchar(48) NOT NULL DEFAULT '',
  title varchar(240) NOT NULL,
  author varchar(180) NOT NULL DEFAULT '',
  category varchar(80) NOT NULL DEFAULT 'General',
  copies_total integer NOT NULL DEFAULT 1,
  copies_available integer NOT NULL DEFAULT 1,
  location varchar(120) NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE CASCADE
);
ALTER TABLE public.education_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_library_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_library_items;
CREATE POLICY education_institution_isolation ON public.education_library_items
  USING (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  )
  WITH CHECK (
    tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    AND institution_id = nullif(current_setting('app.education_institution_id', true), '')::uuid
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.education_study_centers,
      public.education_staff,
      public.education_courses,
      public.education_course_sections,
      public.education_applications,
      public.education_application_logs,
      public.education_enrollments,
      public.education_grades,
      public.education_grade_appeals,
      public.education_finance_transactions,
      public.education_library_items
    TO bazion_app;
  END IF;
END $$;

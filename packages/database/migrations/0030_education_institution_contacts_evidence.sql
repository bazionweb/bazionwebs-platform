ALTER TABLE public.education_institutions
  ADD COLUMN IF NOT EXISTS admissions_email varchar(254),
  ADD COLUMN IF NOT EXISTS registrar_email varchar(254),
  ADD COLUMN IF NOT EXISTS finance_email varchar(254),
  ADD COLUMN IF NOT EXISTS admin_email varchar(254),
  ADD COLUMN IF NOT EXISTS phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS website_url varchar(2048);

-- These contacts come from the existing BMI/BEMI white-label configuration.
-- Keep each institution's record separate even though both share tenant 055.
SELECT set_config('app.tenant_id', '00000000-0000-4000-8000-000000000055', true);
SELECT set_config('app.education_institution_key', 'bmi', true);
UPDATE public.education_institutions
SET admissions_email = 'admissions@bmiuniversities.org',
    registrar_email = 'registrar@bmiuniversities.org',
    finance_email = 'finance@bmiuniversities.org',
    admin_email = 'admin@bmiuniversities.org',
    phones = '["+254 721 341 793", "+254 704 500 872", "704-607-5540"]'::jsonb,
    address = 'Mukurwe-ini Plaza, Nyeri County, Kenya & Charlotte, NC, USA',
    website_url = 'https://bmiuniversities.org',
    updated_at = now()
WHERE tenant_id = '00000000-0000-4000-8000-000000000055' AND institution_key = 'bmi'
  AND admissions_email IS NULL;

SELECT set_config('app.education_institution_key', 'bemi', true);
UPDATE public.education_institutions
SET admissions_email = 'admissions@bmiuniversities.org',
    registrar_email = 'registrar@bmiuniversities.org',
    finance_email = 'finance@bmiuniversities.org',
    admin_email = 'admin@bmiuniversities.org',
    phones = '["+254 721 341 793", "+254 704 500 872"]'::jsonb,
    address = 'Mukurwe-ini Plaza, Mukurweini Road, Nyeri County, Kenya',
    website_url = 'https://bemi.org',
    updated_at = now()
WHERE tenant_id = '00000000-0000-4000-8000-000000000055' AND institution_key = 'bemi'
  AND admissions_email IS NULL;

CREATE TABLE IF NOT EXISTS public.education_regulatory_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  institution_id uuid NOT NULL,
  title varchar(240) NOT NULL,
  evidence_type varchar(80) NOT NULL,
  authority varchar(240) NOT NULL,
  reference_number varchar(120),
  status varchar(24) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'pending_review', 'verified', 'expired', 'superseded', 'withdrawn', 'rejected')),
  issued_on date,
  expires_on date,
  evidence_url varchar(2048),
  notes text NOT NULL DEFAULT '',
  recorded_by varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institution_id, tenant_id) REFERENCES public.education_institutions(id, tenant_id) ON DELETE RESTRICT,
  UNIQUE (id, tenant_id, institution_id),
  CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);
CREATE INDEX IF NOT EXISTS education_regulatory_evidence_tenant_institution_status_idx
  ON public.education_regulatory_evidence(tenant_id, institution_id, status);

ALTER TABLE public.education_regulatory_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_regulatory_evidence FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS education_institution_isolation ON public.education_regulatory_evidence;
CREATE POLICY education_institution_isolation ON public.education_regulatory_evidence
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
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.education_regulatory_evidence TO bazion_app;
  END IF;
END $$;

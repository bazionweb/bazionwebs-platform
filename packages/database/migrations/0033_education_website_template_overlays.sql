-- Persist institution-owned website deltas separately from the current school template.
-- Existing rows receive the current template binding and an empty overlay; no tenant copy is overwritten.
ALTER TABLE public.education_institutions
  ADD COLUMN IF NOT EXISTS website_template_id varchar(120) NOT NULL DEFAULT 'school-portal',
  ADD COLUMN IF NOT EXISTS website_template_version varchar(64) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS website_configuration_schema_version varchar(64) NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS website_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.education_institutions'::regclass
       AND conname = 'education_institutions_website_template_ck'
  ) THEN
    ALTER TABLE public.education_institutions
      ADD CONSTRAINT education_institutions_website_template_ck
      CHECK (
        length(trim(website_template_id)) BETWEEN 1 AND 120
        AND website_template_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
        AND website_configuration_schema_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'
        AND jsonb_typeof(website_overrides) = 'object'
      );
  END IF;
END $$;

COMMENT ON COLUMN public.education_institutions.website_overrides IS
  'Tenant- and institution-scoped sparse template overlay; website defaults remain in the versioned school template.';

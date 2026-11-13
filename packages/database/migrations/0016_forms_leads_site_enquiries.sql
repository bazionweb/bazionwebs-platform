-- Generic website lead capture is isolated from the Church/Ministry inbox.
-- The API supplies tenant identity, consent evidence and retention deadlines.
CREATE TABLE public.site_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  form_id varchar(80) NOT NULL DEFAULT 'contact',
  full_name varchar(160) NOT NULL,
  email varchar(254),
  telephone varchar(30),
  subject varchar(200),
  message text NOT NULL,
  privacy_consent_at timestamptz NOT NULL,
  privacy_notice_version varchar(40) NOT NULL,
  retention_expires_at timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_enquiries_contact_ck CHECK (email IS NOT NULL OR telephone IS NOT NULL),
  CONSTRAINT site_enquiries_retention_ck CHECK (retention_expires_at > created_at),
  CONSTRAINT site_enquiries_form_id_ck CHECK (form_id ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$'),
  CONSTRAINT site_enquiries_privacy_version_ck CHECK (privacy_notice_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$')
);

CREATE INDEX site_enquiries_tenant_created_idx
  ON public.site_enquiries (tenant_id, created_at DESC, id DESC);
CREATE INDEX site_enquiries_expiration_idx
  ON public.site_enquiries (tenant_id, retention_expires_at);

CREATE TABLE public.site_enquiry_policies (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  enabled boolean NOT NULL DEFAULT false,
  privacy_notice text NOT NULL DEFAULT '',
  privacy_notice_version varchar(40) NOT NULL DEFAULT '1.0.0',
  retention_days integer NOT NULL DEFAULT 180,
  published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_enquiry_policies_retention_ck CHECK (retention_days BETWEEN 1 AND 3650),
  CONSTRAINT site_enquiry_policies_version_ck CHECK (privacy_notice_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  CONSTRAINT site_enquiry_policies_publish_ck CHECK (
    NOT enabled OR (length(btrim(privacy_notice)) >= 40 AND published_at IS NOT NULL)
  )
);

ALTER TABLE public.site_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_enquiries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.site_enquiries
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE public.site_enquiry_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_enquiry_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.site_enquiry_policies
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, DELETE ON public.site_enquiries TO bazion_app;
GRANT SELECT, INSERT, UPDATE ON public.site_enquiry_policies TO bazion_app;

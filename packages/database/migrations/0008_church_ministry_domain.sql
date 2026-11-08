-- Migration 0008: Church and Ministry Domain Entities with forced RLS

CREATE TABLE IF NOT EXISTS ministry_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  ministry_name varchar(180) NOT NULL,
  logo_asset_url text,
  description text,
  vision text,
  mission text,
  outreach text,
  founding_date varchar(40),
  address text,
  email varchar(254),
  telephone_numbers jsonb,
  social_links jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ministry_profiles_tenant_uq UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS ministry_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  setting_key varchar(80) NOT NULL,
  setting_value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ministry_settings_tenant_key_uq UNIQUE (tenant_id, setting_key)
);

CREATE TABLE IF NOT EXISTS leadership_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(160) NOT NULL,
  position varchar(120) NOT NULL,
  biography text,
  photo_url text,
  display_order integer NOT NULL DEFAULT 0,
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS leadership_profiles_tenant_order_idx ON leadership_profiles(tenant_id, display_order);

CREATE TABLE IF NOT EXISTS sermon_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name varchar(80) NOT NULL,
  slug varchar(80) NOT NULL,
  CONSTRAINT sermon_categories_tenant_slug_uq UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS sermons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  title varchar(200) NOT NULL,
  slug varchar(140) NOT NULL,
  description text,
  speaker varchar(160) NOT NULL,
  category_id uuid,
  youtube_video_id varchar(64),
  thumbnail_url text,
  scripture_reference varchar(160),
  notes_json jsonb,
  published_at timestamptz,
  status varchar(24) NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sermons_tenant_slug_uq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS sermons_tenant_status_pub_idx ON sermons(tenant_id, status, published_at);

CREATE TABLE IF NOT EXISTS church_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  title varchar(200) NOT NULL,
  slug varchar(140) NOT NULL,
  description text,
  poster_url text,
  venue varchar(180),
  address text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  registration_enabled boolean NOT NULL DEFAULT true,
  registration_capacity integer,
  status varchar(24) NOT NULL DEFAULT 'upcoming',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_events_tenant_slug_uq UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS church_events_tenant_starts_idx ON church_events(tenant_id, starts_at);

CREATE TABLE IF NOT EXISTS church_event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  event_id uuid NOT NULL REFERENCES church_events(id),
  full_name varchar(160) NOT NULL,
  email varchar(254) NOT NULL,
  telephone varchar(30) NOT NULL,
  registration_reference varchar(40) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_event_reg_tenant_ref_uq UNIQUE (tenant_id, registration_reference)
);
CREATE INDEX IF NOT EXISTS church_event_reg_tenant_event_idx ON church_event_registrations(tenant_id, event_id);

CREATE TABLE IF NOT EXISTS donation_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  title varchar(180) NOT NULL,
  slug varchar(120) NOT NULL,
  description text,
  target_amount_minor bigint NOT NULL CHECK (target_amount_minor >= 0),
  raised_amount_minor bigint NOT NULL DEFAULT 0 CHECK (raised_amount_minor >= 0),
  currency varchar(3) NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES','USD','EUR','GBP')),
  starts_at timestamptz,
  ends_at timestamptz,
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donation_campaigns_tenant_slug_uq UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS church_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  campaign_id uuid,
  donor_name varchar(160),
  donor_email varchar(254),
  donor_phone varchar(30),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES','USD','EUR','GBP')),
  giving_category varchar(80) NOT NULL,
  payment_method varchar(40) NOT NULL,
  payment_status varchar(32) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','verified','failed')),
  anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS church_donations_tenant_created_idx ON church_donations(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS church_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  donation_id uuid NOT NULL REFERENCES church_donations(id),
  provider varchar(40) NOT NULL,
  provider_reference varchar(160),
  checkout_request_id varchar(160),
  merchant_request_id varchar(160),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL DEFAULT 'KES',
  transaction_status varchar(32) NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  raw_callback_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS church_payment_tx_tenant_donation_idx ON church_payment_transactions(tenant_id, donation_id);

CREATE TABLE IF NOT EXISTS church_contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  full_name varchar(160) NOT NULL,
  email varchar(254) NOT NULL,
  telephone varchar(30),
  subject varchar(200),
  message text NOT NULL,
  category varchar(60) NOT NULL DEFAULT 'General Enquiry',
  status varchar(24) NOT NULL DEFAULT 'new',
  assigned_to varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS church_contact_msg_tenant_status_idx ON church_contact_messages(tenant_id, status);

CREATE TABLE IF NOT EXISTS church_prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  full_name varchar(160) NOT NULL,
  email varchar(254),
  telephone varchar(30),
  request_text text NOT NULL,
  privacy_preference varchar(30) NOT NULL DEFAULT 'confidential',
  status varchar(24) NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS church_prayer_req_tenant_status_idx ON church_prayer_requests(tenant_id, status);

CREATE TABLE IF NOT EXISTS church_newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  email varchar(254) NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  unsubscribe_at timestamptz,
  status varchar(24) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_newsletter_tenant_email_uq UNIQUE (tenant_id, email)
);

-- Force PostgreSQL RLS for all tenant-scoped church tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ministry_profiles',
    'ministry_settings',
    'leadership_profiles',
    'sermon_categories',
    'sermons',
    'church_events',
    'church_event_registrations',
    'donation_campaigns',
    'church_donations',
    'church_payment_transactions',
    'church_contact_messages',
    'church_prayer_requests',
    'church_newsletter_subscribers'
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
      ministry_profiles,
      ministry_settings,
      leadership_profiles,
      sermon_categories,
      sermons,
      church_events,
      church_event_registrations,
      donation_campaigns,
      church_donations,
      church_payment_transactions,
      church_contact_messages,
      church_prayer_requests,
      church_newsletter_subscribers
    TO bazion_app;
  END IF;
END $$;

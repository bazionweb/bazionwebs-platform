-- Tenant editable church website content is stored in ministry_settings.
-- Consent timestamps record the opt-in supplied for new public form submissions.
ALTER TABLE church_event_registrations
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

ALTER TABLE church_donations
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

ALTER TABLE church_contact_messages
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

ALTER TABLE church_prayer_requests
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

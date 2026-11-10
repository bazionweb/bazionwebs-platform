-- Migration 0009: tenant-aware church relationships and provider callback tokens.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM sermons s
    LEFT JOIN sermon_categories c ON c.id = s.category_id AND c.tenant_id = s.tenant_id
    WHERE s.category_id IS NOT NULL AND c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration 0009 blocked: sermons contain a missing or cross-tenant category reference.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM church_event_registrations r
    LEFT JOIN church_events e ON e.id = r.event_id AND e.tenant_id = r.tenant_id
    WHERE e.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration 0009 blocked: event registrations contain a missing or cross-tenant event reference.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM church_payment_transactions p
    LEFT JOIN church_donations d ON d.id = p.donation_id AND d.tenant_id = p.tenant_id
    WHERE d.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration 0009 blocked: payment transactions contain a missing or cross-tenant donation reference.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM church_donations d
    LEFT JOIN donation_campaigns c ON c.id = d.campaign_id AND c.tenant_id = d.tenant_id
    WHERE d.campaign_id IS NOT NULL AND c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Migration 0009 blocked: donations contain a missing or cross-tenant campaign reference.';
  END IF;
END $$;

ALTER TABLE sermon_categories
  ADD CONSTRAINT sermon_categories_id_tenant_uq UNIQUE (id, tenant_id);
ALTER TABLE sermons
  ADD CONSTRAINT sermons_category_tenant_fk
    FOREIGN KEY (category_id, tenant_id) REFERENCES sermon_categories(id, tenant_id);

ALTER TABLE church_events
  ADD CONSTRAINT church_events_id_tenant_uq UNIQUE (id, tenant_id),
  ADD CONSTRAINT church_events_capacity_positive_ck CHECK (registration_capacity IS NULL OR registration_capacity > 0),
  ADD CONSTRAINT church_events_time_order_ck CHECK (ends_at IS NULL OR ends_at >= starts_at);

ALTER TABLE donation_campaigns
  ADD CONSTRAINT donation_campaigns_id_tenant_uq UNIQUE (id, tenant_id);

ALTER TABLE church_donations
  ADD CONSTRAINT church_donations_id_tenant_uq UNIQUE (id, tenant_id),
  ADD CONSTRAINT church_donations_campaign_tenant_fk
    FOREIGN KEY (campaign_id, tenant_id) REFERENCES donation_campaigns(id, tenant_id);

ALTER TABLE church_event_registrations
  DROP CONSTRAINT IF EXISTS church_event_registrations_event_id_fkey,
  ADD CONSTRAINT church_event_registrations_event_tenant_fk
    FOREIGN KEY (event_id, tenant_id) REFERENCES church_events(id, tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS church_event_registrations_id_tenant_uq
  ON church_event_registrations(id, tenant_id);

ALTER TABLE church_payment_transactions
  DROP CONSTRAINT IF EXISTS church_payment_transactions_donation_id_fkey,
  ADD COLUMN IF NOT EXISTS callback_token_hash varchar(64),
  ADD COLUMN IF NOT EXISTS status_token_hash varchar(64),
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(160),
  ADD CONSTRAINT church_payment_transactions_donation_tenant_fk
    FOREIGN KEY (donation_id, tenant_id) REFERENCES church_donations(id, tenant_id),
  ADD CONSTRAINT church_payment_transactions_status_ck
    CHECK (transaction_status IN ('pending', 'succeeded', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS church_payment_callback_token_uq
  ON church_payment_transactions(callback_token_hash) WHERE callback_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS church_payment_status_token_uq
  ON church_payment_transactions(status_token_hash) WHERE status_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS church_payment_idempotency_uq
  ON church_payment_transactions(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS church_payment_transactions_id_tenant_uq
  ON church_payment_transactions(id, tenant_id);

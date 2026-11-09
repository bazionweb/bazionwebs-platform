-- Migration 0010: durable M-Pesa checkout callback correlation.

ALTER TABLE payment_attempts
  ADD COLUMN callback_token_hash varchar(64),
  ADD COLUMN status_token_hash varchar(64),
  ADD COLUMN checkout_request_id varchar(160),
  ADD COLUMN merchant_request_id varchar(160),
  ADD COLUMN verified_at timestamptz;

CREATE UNIQUE INDEX payment_attempts_callback_token_uq
  ON payment_attempts(callback_token_hash) WHERE callback_token_hash IS NOT NULL;
CREATE UNIQUE INDEX payment_attempts_status_token_uq
  ON payment_attempts(status_token_hash) WHERE status_token_hash IS NOT NULL;
CREATE UNIQUE INDEX payment_attempts_checkout_request_uq
  ON payment_attempts(checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX payment_attempts_provider_receipt_uq
  ON payment_attempts(provider, provider_reference) WHERE provider_reference IS NOT NULL;

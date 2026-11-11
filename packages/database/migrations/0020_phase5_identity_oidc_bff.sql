-- Phase 5: Single OIDC Authority, Federated (issuer, subject) Identity Links,
-- RFC 9700 Confidential BFF Session/Transaction Vault, Single-Use Guest Order Claim
-- Proofs, and Audited Email Change / Collision Support Workflows.

CREATE TABLE IF NOT EXISTS public.federated_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer varchar(255) NOT NULL,
  subject varchar(255) NOT NULL,
  user_id varchar(128) NOT NULL,
  email_at_link varchar(254) NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'conflicted')),
  linked_via varchar(32) NOT NULL CHECK (linked_via IN ('oidc_login', 'owner_claim', 'admin_link', 'migration_backfill')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT federated_identity_links_issuer_subject_uq UNIQUE (issuer, subject),
  CONSTRAINT federated_identity_links_nonempty_ck CHECK (
    btrim(issuer) <> ''
    AND btrim(subject) <> ''
    AND btrim(user_id) <> ''
    AND email_at_link = lower(email_at_link)
  )
);

CREATE INDEX IF NOT EXISTS federated_identity_links_user_idx
  ON public.federated_identity_links (user_id);

CREATE INDEX IF NOT EXISTS federated_identity_links_email_idx
  ON public.federated_identity_links (lower(email_at_link));

CREATE TABLE IF NOT EXISTS public.identity_link_collisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collision_type varchar(32) NOT NULL CHECK (
    collision_type IN ('subject_rebind', 'email_collision', 'email_change_conflict', 'order_claim_collision')
  ),
  issuer varchar(255),
  subject varchar(255),
  existing_user_id varchar(128),
  conflicting_user_id varchar(128),
  external_reference varchar(128),
  status varchar(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved_linked', 'resolved_rejected')),
  resolution_note varchar(500),
  resolved_by varchar(128),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_link_collisions_status_created_idx
  ON public.identity_link_collisions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS identity_link_collisions_users_idx
  ON public.identity_link_collisions (existing_user_id, conflicting_user_id);

CREATE TABLE IF NOT EXISTS public.oidc_clients (
  client_id varchar(128) PRIMARY KEY,
  client_name varchar(160) NOT NULL,
  client_type varchar(24) NOT NULL CHECK (client_type IN ('confidential_bff', 'public_pkce')),
  client_secret_hash varchar(64),
  redirect_uris jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(redirect_uris) = 'array'),
  post_logout_redirect_uris jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(post_logout_redirect_uris) = 'array'),
  allowed_scopes jsonb NOT NULL DEFAULT '["openid","profile","email"]'::jsonb CHECK (jsonb_typeof(allowed_scopes) = 'array'),
  require_pkce boolean NOT NULL DEFAULT true,
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oidc_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash varchar(64) NOT NULL UNIQUE,
  client_id varchar(128) NOT NULL REFERENCES public.oidc_clients(client_id) ON DELETE RESTRICT,
  user_id varchar(128) NOT NULL,
  redirect_uri varchar(1024) NOT NULL,
  scope varchar(512) NOT NULL,
  code_challenge varchar(128) NOT NULL,
  code_challenge_method varchar(16) NOT NULL CHECK (code_challenge_method = 'S256'),
  nonce varchar(256) NOT NULL,
  state_hash varchar(64) NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  auth_time timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oidc_authorization_codes_expires_idx
  ON public.oidc_authorization_codes (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.oidc_bff_auth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_hash varchar(64) NOT NULL UNIQUE,
  client_id varchar(128) NOT NULL,
  state_hash varchar(64) NOT NULL,
  nonce varchar(256) NOT NULL,
  code_verifier_ciphertext text NOT NULL,
  return_to varchar(512) NOT NULL DEFAULT '/workspace',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oidc_bff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash varchar(64) NOT NULL UNIQUE,
  user_id varchar(128) NOT NULL,
  issuer varchar(255) NOT NULL,
  subject varchar(255) NOT NULL,
  client_id varchar(128) NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  scope varchar(512) NOT NULL,
  id_token_jti varchar(128) NOT NULL,
  access_token_ciphertext text NOT NULL,
  refresh_token_ciphertext text,
  access_token_expires_at timestamptz NOT NULL,
  session_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oidc_bff_sessions_user_active_idx
  ON public.oidc_bff_sessions (user_id, session_expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.commercial_order_claim_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_hash varchar(64) NOT NULL UNIQUE,
  external_order_id varchar(128) NOT NULL,
  external_customer_id varchar(128) NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  installation_id uuid REFERENCES public.product_installations(id) ON DELETE SET NULL,
  issued_by_client varchar(64) NOT NULL DEFAULT 'bazionweb',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  claimed_by_user_id varchar(128),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_order_claim_proofs_consumed_ck CHECK (
    (consumed_at IS NULL AND claimed_by_user_id IS NULL AND claimed_at IS NULL)
    OR (consumed_at IS NOT NULL AND claimed_by_user_id IS NOT NULL AND claimed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS commercial_order_claim_proofs_order_tenant_idx
  ON public.commercial_order_claim_proofs (external_order_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.account_email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar(128) NOT NULL,
  current_email varchar(254) NOT NULL,
  new_email varchar(254) NOT NULL,
  token_hash varchar(64) NOT NULL UNIQUE,
  status varchar(24) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'confirmed', 'cancelled', 'conflicted', 'expired')
  ),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_email_change_requests_lower_ck CHECK (
    current_email = lower(current_email)
    AND new_email = lower(new_email)
    AND current_email <> new_email
  )
);

CREATE INDEX IF NOT EXISTS account_email_change_requests_user_idx
  ON public.account_email_change_requests (user_id, created_at DESC);

-- Least-privilege isolation: storefront/app runtime role has zero direct access to
-- OIDC codes, client secrets, BFF token vaults, collision logs, or claim proofs.
REVOKE ALL PRIVILEGES ON TABLE
  public.federated_identity_links,
  public.identity_link_collisions,
  public.oidc_clients,
  public.oidc_authorization_codes,
  public.oidc_bff_auth_transactions,
  public.oidc_bff_sessions,
  public.commercial_order_claim_proofs,
  public.account_email_change_requests
  FROM PUBLIC, bazion_app, bazion_auth_runtime, bazion_tenant_resolver,
       bazion_notification_enqueuer, bazion_notification_worker;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.federated_identity_links,
  public.identity_link_collisions,
  public.oidc_clients,
  public.oidc_authorization_codes,
  public.oidc_bff_auth_transactions,
  public.oidc_bff_sessions,
  public.commercial_order_claim_proofs,
  public.account_email_change_requests
  TO bazion_tenant_provisioner;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.commercial_order_claim_proofs TO bazion_product_provisioner';
  END IF;
END
$$;


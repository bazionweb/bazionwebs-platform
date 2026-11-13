-- P1 Target Installation Change & Add-on Entitlement Command Ledger (append-only, immutable).
-- Preserves pinned base composition on public.product_installations while tracking versioned
-- add-on grants, revokes, upgrades, and rollbacks with idempotent replay protection.

CREATE TABLE IF NOT EXISTS public.product_installation_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source varchar(24) NOT NULL DEFAULT 'bazionweb' CHECK (source = 'bazionweb'),
  event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  installation_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  external_customer_id varchar(120) NOT NULL,
  external_order_id varchar(120) NOT NULL,
  order_line_id varchar(120) NOT NULL,
  invoice_id varchar(120) NOT NULL,
  subscription_id varchar(120),
  change_type varchar(24) NOT NULL
    CHECK (change_type IN ('addon_grant', 'addon_revoke', 'plan_upgrade', 'rollback')),
  preserve_pinned_base_composition boolean NOT NULL DEFAULT true
    CHECK (preserve_pinned_base_composition = true),
  expected_base_composition jsonb NOT NULL,
  enable_modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  disable_modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  entitlement_overrides jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(entitlement_overrides) = 'object' AND NOT public.product_configuration_contains_secret_key(entitlement_overrides)),
  previous_modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  resulting_modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  rollback_of_event_id uuid,
  actor_client_id varchar(128) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_installation_changes_installation_fk
    FOREIGN KEY (installation_id, tenant_id)
    REFERENCES public.product_installations(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT product_installation_changes_idempotency_uq UNIQUE (source, idempotency_key),
  CONSTRAINT product_installation_changes_event_uq UNIQUE (source, event_id),
  CONSTRAINT product_installation_changes_rollback_shape_ck CHECK (
    (change_type = 'rollback' AND rollback_of_event_id IS NOT NULL)
    OR (change_type <> 'rollback' AND rollback_of_event_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS product_installation_changes_installation_idx
  ON public.product_installation_changes (installation_id, applied_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS product_installation_changes_rollback_once_uq
  ON public.product_installation_changes (installation_id, rollback_of_event_id)
  WHERE rollback_of_event_id IS NOT NULL;

REVOKE ALL ON public.product_installation_changes
  FROM PUBLIC, bazion_app, bazion_tenant_resolver, bazion_tenant_provisioner;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bazion_product_provisioner') THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.product_installation_changes TO bazion_product_provisioner';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.tenant_module_entitlements TO bazion_product_provisioner';
  END IF;
END;
$$;


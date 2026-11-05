-- Tenant registry and Better Auth organization mapping.
-- The auth schema itself is managed by the Better Auth 1.7.17 migration CLI.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS auth_organization_id varchar(128);

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS status varchar(24) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tenants_status_ck'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_status_ck
      CHECK (status IN ('provisioning', 'active', 'suspended', 'closed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_auth_organization_id_uq
  ON public.tenants(auth_organization_id)
  WHERE auth_organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  hostname varchar(253) NOT NULL,
  verification_token_hash varchar(64),
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_domains_hostname_lower_ck CHECK (hostname = lower(hostname)),
  CONSTRAINT tenant_domains_hostname_uq UNIQUE (hostname)
);

CREATE INDEX IF NOT EXISTS tenant_domains_tenant_idx
  ON public.tenant_domains(tenant_id);

-- Expose only verified active hostnames to the read-only resolver role.
-- The token hash and pending/disabled records are not visible through this view.
CREATE OR REPLACE VIEW public.tenant_domain_directory
WITH (security_barrier = true)
AS
SELECT hostname, tenant_id
FROM public.tenant_domains
WHERE status = 'active' AND verified_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_members (
  user_id varchar(128) PRIMARY KEY,
  email varchar(254) NOT NULL,
  role varchar(32) NOT NULL CHECK (role IN ('platform_owner', 'platform_admin', 'platform_support')),
  status varchar(24) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_members_email_uq
  ON public.platform_members(lower(email));

-- Application routes need only a tenant registry lookup for their already-
-- resolved tenant UUID; no platform-member or domain-verification secrets.
GRANT SELECT ON public.tenants TO bazion_app;

-- Better Auth organization hooks use a narrowly scoped provisioner. This role
-- can provision registry rows but cannot read/write products, carts or orders.
GRANT SELECT, INSERT, UPDATE ON public.tenants TO bazion_tenant_provisioner;
GRANT SELECT, INSERT, UPDATE ON public.tenant_domains TO bazion_tenant_provisioner;
GRANT SELECT, INSERT, UPDATE ON public.platform_members TO bazion_tenant_provisioner;

-- Read-only lookups for verified public hostnames and platform role membership.
GRANT SELECT ON public.tenants, public.platform_members TO bazion_tenant_resolver;
GRANT SELECT ON public.tenant_domain_directory TO bazion_tenant_resolver;

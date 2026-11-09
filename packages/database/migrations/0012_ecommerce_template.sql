-- Reusable tenant commerce storefront and catalog fields.
ALTER TABLE public.products
  ADD COLUMN slug varchar(180),
  ADD COLUMN category varchar(80) NOT NULL DEFAULT 'General',
  ADD COLUMN image_url text,
  ADD COLUMN image_alt varchar(180),
  ADD COLUMN compare_at_price_minor bigint,
  ADD COLUMN featured boolean NOT NULL DEFAULT false;

-- Products use forced tenant RLS, including for the migration role. Backfill
-- each tenant under its transaction-local scope rather than bypassing RLS.
DO $$
DECLARE tenant_scope uuid;
BEGIN
  FOR tenant_scope IN SELECT id FROM public.tenants LOOP
    PERFORM set_config('app.tenant_id', tenant_scope::text, true);
    UPDATE public.products
    SET slug = left(
      left(coalesce(nullif(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), ''), 'product'), 140)
      || '-' || id::text,
      180
    )
    WHERE tenant_id = tenant_scope AND slug IS NULL;
  END LOOP;
END $$;

ALTER TABLE public.products
  ALTER COLUMN slug SET NOT NULL,
  ADD CONSTRAINT products_compare_at_safe_ck
    CHECK (compare_at_price_minor IS NULL OR compare_at_price_minor BETWEEN price_minor AND 9007199254740991);
CREATE UNIQUE INDEX products_tenant_slug_uq ON public.products(tenant_id, slug);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_currency_ck,
  DROP CONSTRAINT IF EXISTS products_currency_check,
  ADD CONSTRAINT products_currency_ck CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'ZAR', 'NGN', 'GHS', 'INR', 'AED', 'BRL', 'MXN', 'SAR', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'PHP'));
ALTER TABLE public.carts
  DROP CONSTRAINT IF EXISTS carts_currency_ck,
  DROP CONSTRAINT IF EXISTS carts_currency_check,
  ADD CONSTRAINT carts_currency_ck CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'ZAR', 'NGN', 'GHS', 'INR', 'AED', 'BRL', 'MXN', 'SAR', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'PHP'));
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_currency_ck,
  DROP CONSTRAINT IF EXISTS orders_currency_check,
  ADD CONSTRAINT orders_currency_ck CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'ZAR', 'NGN', 'GHS', 'INR', 'AED', 'BRL', 'MXN', 'SAR', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'PHP'));
ALTER TABLE public.payment_attempts
  DROP CONSTRAINT IF EXISTS payment_attempts_currency_ck,
  DROP CONSTRAINT IF EXISTS payment_attempts_currency_check,
  ADD CONSTRAINT payment_attempts_currency_ck CHECK (currency IN ('KES', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'ZAR', 'NGN', 'GHS', 'INR', 'AED', 'BRL', 'MXN', 'SAR', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'PHP'));

CREATE TABLE public.commerce_store_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  store_name varchar(160) NOT NULL DEFAULT 'Our Store',
  tagline varchar(240) NOT NULL DEFAULT 'Thoughtfully selected for you.',
  support_email varchar(254) NOT NULL DEFAULT '',
  is_home_page boolean NOT NULL DEFAULT false,
  locale varchar(16) NOT NULL DEFAULT 'en-KE',
  time_zone varchar(64) NOT NULL DEFAULT 'Africa/Nairobi',
  default_country_code varchar(2) NOT NULL DEFAULT 'KE'
    CHECK (default_country_code ~ '^[A-Z]{2}$'),
  default_currency varchar(3) NOT NULL DEFAULT 'KES'
    CHECK (default_currency IN ('KES', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SGD', 'ZAR', 'NGN', 'GHS', 'INR', 'AED', 'BRL', 'MXN', 'SAR', 'CNY', 'HKD', 'SEK', 'NOK', 'DKK', 'PLN', 'THB', 'PHP')),
  supported_currencies text[] NOT NULL DEFAULT ARRAY['KES']::text[],
  shipping_rates jsonb NOT NULL DEFAULT '{"KES":0}'::jsonb,
  shipping_countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commerce_store_supported_currencies_ck
    CHECK (cardinality(supported_currencies) > 0 AND default_currency = ANY(supported_currencies))
);

ALTER TABLE public.commerce_store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_store_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON public.commerce_store_settings
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON public.commerce_store_settings TO bazion_app;

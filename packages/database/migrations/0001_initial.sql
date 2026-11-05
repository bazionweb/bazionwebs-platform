-- gen_random_uuid() is built into supported PostgreSQL versions; no extension is required.

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(80) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  default_currency varchar(3) NOT NULL DEFAULT 'KES',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  sku varchar(80) NOT NULL,
  name varchar(180) NOT NULL,
  description text,
  currency varchar(3) NOT NULL DEFAULT 'KES' CHECK (currency IN ('KES','USD','EUR','GBP')),
  price_minor bigint NOT NULL CHECK (price_minor BETWEEN 0 AND 9007199254740991),
  stock_tracked boolean NOT NULL DEFAULT true,
  stock_on_hand integer NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  stock_reserved integer NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_stock_reserved_ck CHECK (stock_reserved <= stock_on_hand),
  CONSTRAINT products_tenant_sku_uq UNIQUE (tenant_id, sku),
  CONSTRAINT products_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS products_tenant_active_idx ON products(tenant_id, active);

CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  currency varchar(3) NOT NULL CHECK (currency IN ('KES','USD','EUR','GBP')),
  status varchar(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open','converted','expired')),
  guest_token_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carts_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS carts_tenant_status_idx ON carts(tenant_id, status);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  cart_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_cart_fk FOREIGN KEY (cart_id, tenant_id) REFERENCES carts(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT cart_items_product_fk FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id),
  CONSTRAINT cart_items_cart_product_uq UNIQUE (cart_id, product_id),
  CONSTRAINT cart_items_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS cart_items_tenant_cart_idx ON cart_items(tenant_id, cart_id);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  order_number varchar(40) NOT NULL,
  cart_id uuid NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','cancelled','fulfilled','refunded')),
  currency varchar(3) NOT NULL CHECK (currency IN ('KES','USD','EUR','GBP')),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor BETWEEN 0 AND 9007199254740991),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor BETWEEN 0 AND 9007199254740991),
  shipping_minor bigint NOT NULL DEFAULT 0 CHECK (shipping_minor BETWEEN 0 AND 9007199254740991),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor BETWEEN 0 AND 9007199254740991),
  total_minor bigint NOT NULL CHECK (total_minor BETWEEN 0 AND 9007199254740991),
  customer_name varchar(120) NOT NULL,
  customer_email varchar(254) NOT NULL,
  customer_phone varchar(24) NOT NULL,
  shipping_address jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_total_consistency_ck CHECK (discount_minor <= subtotal_minor AND total_minor = subtotal_minor - discount_minor + shipping_minor + tax_minor),
  CONSTRAINT orders_cart_fk FOREIGN KEY (cart_id, tenant_id) REFERENCES carts(id, tenant_id),
  CONSTRAINT orders_tenant_number_uq UNIQUE (tenant_id, order_number),
  CONSTRAINT orders_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON orders(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  sku_snapshot varchar(80) NOT NULL,
  name_snapshot varchar(180) NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor BETWEEN 0 AND 9007199254740991),
  line_total_minor bigint NOT NULL CHECK (line_total_minor BETWEEN 0 AND 9007199254740991),
  CONSTRAINT order_items_line_total_ck CHECK (line_total_minor = unit_price_minor * quantity),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id, tenant_id) REFERENCES orders(id, tenant_id),
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id, tenant_id) REFERENCES products(id, tenant_id),
  CONSTRAINT order_items_id_tenant_uq UNIQUE (id, tenant_id)
);
CREATE INDEX IF NOT EXISTS order_items_tenant_order_idx ON order_items(tenant_id, order_id);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  provider varchar(24) NOT NULL,
  provider_reference varchar(160),
  status varchar(32) NOT NULL DEFAULT 'created' CHECK (status IN ('created','requires_action','processing','succeeded','failed','cancelled')),
  amount_minor bigint NOT NULL CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  currency varchar(3) NOT NULL CHECK (currency IN ('KES','USD','EUR','GBP')),
  checkout_url text,
  idempotency_key varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_attempts_order_fk FOREIGN KEY (order_id, tenant_id) REFERENCES orders(id, tenant_id),
  CONSTRAINT payment_attempts_id_tenant_uq UNIQUE (id, tenant_id),
  CONSTRAINT payment_attempts_tenant_idem_uq UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS payment_attempts_tenant_order_idx ON payment_attempts(tenant_id, order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  provider varchar(24) NOT NULL,
  provider_event_id varchar(200) NOT NULL,
  event_type varchar(100) NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_tenant_provider_event_uq UNIQUE (tenant_id, provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  key varchar(160) NOT NULL,
  request_hash varchar(64) NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_tenant_key_uq UNIQUE (tenant_id, key),
  CONSTRAINT idempotency_resource_fk FOREIGN KEY (resource_id, tenant_id) REFERENCES orders(id, tenant_id)
);

-- Tenant-owned tables use a transaction-local app.tenant_id. Apply with a migration role.
-- The runtime API role must not own these tables and must not have BYPASSRLS.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','carts','cart_items','orders','order_items','payment_attempts','webhook_events','idempotency_records']
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


-- Explicit least-privilege grants for the API runtime role. Future tables are
-- not exposed automatically; grant access in the migration that introduces them.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bazion_app;
GRANT SELECT, UPDATE ON products TO bazion_app;
GRANT SELECT, INSERT, UPDATE ON carts TO bazion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cart_items TO bazion_app;
GRANT SELECT, INSERT, UPDATE ON orders, order_items, payment_attempts TO bazion_app;
GRANT SELECT, INSERT ON webhook_events, idempotency_records TO bazion_app;
REVOKE ALL PRIVILEGES ON TABLE tenants FROM bazion_app;

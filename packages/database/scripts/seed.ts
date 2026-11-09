import { randomUUID } from "node:crypto";
import { Pool } from "pg";

const connectionString = process.env.MIGRATION_DATABASE_URL;
const tenantId = process.env.DEFAULT_TENANT_ID ?? "11111111-1111-4111-8111-111111111111";
if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required; run the seed with the migration database role.");
const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query(
    `INSERT INTO tenants (id, slug, name, default_currency) VALUES ($1, 'bazion-demo', 'Bazion Demo Store', 'KES') ON CONFLICT (id) DO NOTHING`,
    [tenantId],
  );
  await client.query("BEGIN");
  await client.query("SELECT set_config($1, $2, true)", ["app.tenant_id", tenantId]);
  await client.query(
    `INSERT INTO commerce_store_settings (tenant_id, store_name, tagline, locale, time_zone, default_country_code, default_currency, supported_currencies)
     VALUES ($1, 'Bazion Demo Store', 'Useful things, thoughtfully chosen.', 'en-KE', 'Africa/Nairobi', 'KE', 'KES', ARRAY['KES']::text[])
     ON CONFLICT (tenant_id) DO NOTHING`,
    [tenantId],
  );
  const demoProducts = [
    [randomUUID(), tenantId, "BW-TEE-001", "bazion-classic-t-shirt", "Bazion Classic T-Shirt", "Comfortable everyday cotton T-shirt", "KES", 150000, 20],
    [randomUUID(), tenantId, "BW-MUG-001", "bazion-ceramic-mug", "Bazion Ceramic Mug", "Ceramic coffee mug", "KES", 65000, 35],
    [randomUUID(), tenantId, "BW-BAG-001", "bazion-everyday-tote", "Bazion Everyday Tote", "Reusable canvas tote bag", "KES", 95000, 15],
  ];
  for (const product of demoProducts) {
    await client.query(
      `INSERT INTO products (id, tenant_id, sku, slug, name, description, currency, price_minor, stock_on_hand)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (tenant_id, sku) DO NOTHING`,
      product,
    );
  }
  await client.query("COMMIT");
  console.log(`Seeded tenant ${tenantId} and demo products.`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

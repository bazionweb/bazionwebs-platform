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
  const demoProducts = [
    [randomUUID(), tenantId, "BW-TEE-001", "Bazion Classic T-Shirt", "Comfortable everyday cotton T-shirt", "KES", 150000, 20],
    [randomUUID(), tenantId, "BW-MUG-001", "Bazion Ceramic Mug", "Ceramic coffee mug", "KES", 65000, 35],
    [randomUUID(), tenantId, "BW-BAG-001", "Bazion Everyday Tote", "Reusable canvas tote bag", "KES", 95000, 15],
  ];
  for (const product of demoProducts) {
    await client.query(
      `INSERT INTO products (id, tenant_id, sku, name, description, currency, price_minor, stock_on_hand)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (tenant_id, sku) DO NOTHING`,
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

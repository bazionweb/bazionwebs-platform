import pg from "../apps/api/node_modules/pg/lib/index.js";

const client = new pg.Client({
  connectionString: "postgres://postgres:postgres@localhost:5432/bazion_platform",
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT id, slug, name FROM public.tenants WHERE status = 'active'");
  for (const tenant of res.rows) {
    console.log(`Seeding baseline data for tenant ${tenant.name} (${tenant.slug})...`);

    await client.query(
      `INSERT INTO public.ministry_profiles (tenant_id, ministry_name, description, vision, mission, outreach, telephone_numbers, social_links)
       VALUES ($1, $2, $3, 'To love God and serve people.', 'Preach truth, hope and love.', 'Community outreach and fellowship.', '[]'::jsonb, '{}'::jsonb)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenant.id, tenant.name, `Welcome to ${tenant.name}`],
    );

    await client.query(
      `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value)
       VALUES ($1, 'public_site', '{"theme":{"primaryColor":"#193a31","secondaryColor":"#315e50","accentColor":"#8b5b29"},"pages":{"sermons":true,"events":true,"give":true,"ministries":true,"about":true,"contact":true}}')
       ON CONFLICT (tenant_id, setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value`,
      [tenant.id],
    );

    await client.query(
      `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
       VALUES ($1, 'church-ministry', true, 'system:baseline')
       ON CONFLICT (tenant_id, module_id) DO NOTHING`,
      [tenant.id],
    );

    await client.query(
      `INSERT INTO public.tenant_domains (tenant_id, hostname, status, verified_at)
       VALUES ($1, $2, 'active', now())
       ON CONFLICT (hostname) DO NOTHING`,
      [tenant.id, `${tenant.slug}.localhost`],
    );
  }
  console.log("Baseline data seeded successfully for all active tenants!");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

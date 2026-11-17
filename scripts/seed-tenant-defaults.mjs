import pg from "../apps/api/node_modules/pg/lib/index.js";

const client = new pg.Client({
  connectionString:
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/bazion_platform",
});

const EDUCATION_TENANTS = [
  {
    id: "00000000-0000-4000-8000-000000000055",
    slug: "bmi",
    name: "Bethel Ministries International University (BMI University)",
    domains: [
      "bmi.localhost",
      "bmi-university.localhost",
      "bmiuniversities.org",
      "www.bmiuniversities.org",
      "bmi.ac.ke",
      "www.bmi.ac.ke",
      "portal.bmi.ac.ke",
      "ums.bmi.ac.ke",
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000056",
    slug: "bemi",
    name: "BEMI Training Institute (Africa Regional Hub)",
    domains: [
      "bemi.localhost",
      "bemi-institute.localhost",
      "bemi.org",
      "www.bemi.org",
      "bemi.ac.ke",
      "www.bemi.ac.ke",
    ],
  },
];

const CHURCH_MANAGEMENT_TENANTS = [
  {
    id: "00000000-0000-4000-8000-000000000077",
    slug: "hkm",
    name: "Heavenly God Kingdom Churches (HKM Ministries)",
    domains: [
      "hkm.localhost",
      "hkm-ministries.localhost",
      "admin.hkmministries.org",
      "hkmministries.org",
      "www.hkmministries.org",
    ],
    modules: ["church-ministry", "forms-leads", "media-storage", "analytics", "notifications"],
  },
];

async function main() {
  await client.connect();

  // 1. Ensure BMI University & BEMI Training Institute exist as active tenants with verified domains
  for (const edu of EDUCATION_TENANTS) {
    console.log(`Seeding education tenant ${edu.name} (${edu.id})...`);
    await client.query(
      `INSERT INTO public.tenants (id, slug, name, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, status = 'active'`,
      [edu.id, edu.slug, edu.name],
    );

    await client.query("BEGIN");
    await client.query("SELECT set_config($1, $2, true)", ["app.tenant_id", edu.id]);

    for (const domain of edu.domains) {
      await client.query(
        `DELETE FROM public.tenant_domains WHERE hostname = $1 AND tenant_id <> $2`,
        [domain, edu.id],
      );
      await client.query(
        `INSERT INTO public.tenant_domains (tenant_id, hostname, status, verified_at)
         VALUES ($1, $2, 'active', now())
         ON CONFLICT (hostname) DO UPDATE
         SET tenant_id = EXCLUDED.tenant_id, status = 'active', verified_at = COALESCE(public.tenant_domains.verified_at, now())`,
        [edu.id, domain],
      );
    }

    for (const moduleId of ["forms-leads", "media-storage", "analytics"]) {
      await client.query(
        `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
         VALUES ($1, $2, true, 'system:bmi-seed')
         ON CONFLICT (tenant_id, module_id) DO UPDATE
         SET enabled = true, updated_by = 'system:bmi-seed'`,
        [edu.id, moduleId],
      );
    }
    await client.query("COMMIT");
  }

  // 2. Ensure HKM Church Management exists as active tenant with verified domains & entitlements
  for (const church of CHURCH_MANAGEMENT_TENANTS) {
    console.log(`Seeding church management tenant ${church.name} (${church.id})...`);
    await client.query(
      `INSERT INTO public.tenants (id, slug, name, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name, status = 'active'`,
      [church.id, church.slug, church.name],
    );

    await client.query("BEGIN");
    await client.query("SELECT set_config($1, $2, true)", ["app.tenant_id", church.id]);

    for (const domain of church.domains) {
      await client.query(
        `DELETE FROM public.tenant_domains WHERE hostname = $1 AND tenant_id <> $2`,
        [domain, church.id],
      );
      await client.query(
        `INSERT INTO public.tenant_domains (tenant_id, hostname, status, verified_at)
         VALUES ($1, $2, 'active', now())
         ON CONFLICT (hostname) DO UPDATE
         SET tenant_id = EXCLUDED.tenant_id, status = 'active', verified_at = COALESCE(public.tenant_domains.verified_at, now())`,
        [church.id, domain],
      );
    }

    for (const moduleId of church.modules) {
      await client.query(
        `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
         VALUES ($1, $2, true, 'system:hkm-seed')
         ON CONFLICT (tenant_id, module_id) DO UPDATE
         SET enabled = true, updated_by = 'system:hkm-seed'`,
        [church.id, moduleId],
      );
    }

    await client.query(
      `INSERT INTO public.ministry_profiles (tenant_id, ministry_name, description, vision, mission, outreach, telephone_numbers, social_links)
       VALUES ($1, $2, $3, 'To raise a kingdom generation advancing God’s purposes on earth.', 'Expository preaching, discipleship, community prayer, and pastoral care.', 'Community evangelism, youth mentorship, and benevolent missions.', '[]'::jsonb, '{}'::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE
       SET ministry_name = EXCLUDED.ministry_name, description = EXCLUDED.description`,
      [church.id, church.name, `Welcome to ${church.name}`],
    );

    await client.query(
      `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value)
       VALUES ($1, 'public_site', '{"theme":{"preset":"forest-bronze","primaryColor":"#193a31","secondaryColor":"#315e50","accentColor":"#8b5b29"},"pages":{"portal":true,"sermons":true,"events":true,"give":true,"ministries":true,"about":true,"contact":true}}')
       ON CONFLICT (tenant_id, setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value`,
      [church.id],
    );

    await client.query("COMMIT");
  }

  // 3. Seed baseline ministry data for non-education/non-hkm active tenants
  const res = await client.query(
    `SELECT id, slug, name FROM public.tenants
     WHERE status = 'active'
       AND id NOT IN ('00000000-0000-4000-8000-000000000055', '00000000-0000-4000-8000-000000000056', '00000000-0000-4000-8000-000000000077')`,
  );
  for (const tenant of res.rows) {
    await client.query("BEGIN");
    await client.query("SELECT set_config($1, $2, true)", ["app.tenant_id", tenant.id]);

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

    await client.query("COMMIT");
  }
  console.log("BMI University, BEMI Institute, HKM Ministries, and active tenant defaults seeded successfully!");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

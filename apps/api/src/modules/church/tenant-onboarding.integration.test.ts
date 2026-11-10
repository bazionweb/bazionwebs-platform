import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTenantObjectKey, LocalObjectStorage } from "@bazion/storage";
import type { AppConfig } from "../../config.js";

type MinistryFixture = {
  tenantId: string;
  slug: string;
  hostname: string;
  ministryName: string;
  heroTitle: string;
  sermonTitle: string;
  moduleEnabled: boolean;
  mediaKey: string;
};

const enabled = Boolean(
  process.env.TENANT_ISOLATION_TEST_DATABASE_URL
  && process.env.MIGRATION_DATABASE_URL
  && process.env.TENANT_RESOLVER_DATABASE_URL,
);

async function withTenant<T>(pool: Pool, tenantId: string, run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

describe.skipIf(!enabled)("second ministry live API onboarding", () => {
  let migrationPool: Pool;
  let appPool: Pool;
  let app: FastifyInstance;
  let storage: LocalObjectStorage;
  let storageDirectory: string;
  const fixtures: MinistryFixture[] = [];

  async function seedMinistry(label: string, moduleEnabled: boolean): Promise<MinistryFixture> {
    const nonce = randomUUID();
    const suffix = nonce.slice(0, 8);
    const slug = `onboarding-${label}-${suffix}`;
    const ministryName = `Onboarding ${label} ministry ${suffix}`;
    const hostname = `${slug}.verified.example.test`;
    const tenantResult = await migrationPool.query<{ id: string }>(
      `INSERT INTO public.tenants (slug, name, default_currency, status)
       VALUES ($1, $2, 'KES', 'active') RETURNING id`,
      [slug, ministryName],
    );
    const fixture: MinistryFixture = {
      tenantId: tenantResult.rows[0]!.id,
      slug,
      hostname,
      ministryName,
      heroTitle: `Welcome ${label} ${suffix}`,
      sermonTitle: `A message for ${label} ${suffix}`,
      moduleEnabled,
      mediaKey: "",
    };
    fixtures.push(fixture);

    await withTenant(appPool, fixture.tenantId, async (client) => {
      await client.query(
        `INSERT INTO public.ministry_profiles (tenant_id, ministry_name, email, vision, mission)
         VALUES ($1, $2, $3, $4, $5)`,
        [fixture.tenantId, ministryName, `${label}-${suffix}@ministry.example.test`, `Vision ${label}`, `Mission ${label}`],
      );
      await client.query(
        `INSERT INTO public.ministry_settings (tenant_id, setting_key, setting_value)
         VALUES ($1, 'public_site', $2)`,
        [fixture.tenantId, JSON.stringify({ hero: { title: fixture.heroTitle } })],
      );
      await client.query(
        `INSERT INTO public.sermons (tenant_id, title, slug, speaker, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [fixture.tenantId, fixture.sermonTitle, `message-${label}-${suffix}`, `Pastor ${label}`, `Content for ${label}`],
      );
    });

    await migrationPool.query(
      `INSERT INTO public.tenant_domains (tenant_id, hostname, verification_token_hash, status, verified_at)
       VALUES ($1, $2, $3, 'active', now())`,
      [fixture.tenantId, fixture.hostname, createHash("sha256").update(nonce).digest("hex")],
    );
    await migrationPool.query(
      `INSERT INTO public.tenant_module_entitlements (tenant_id, module_id, enabled, updated_by)
       VALUES ($1, 'church-ministry', $2, $3)`,
      [fixture.tenantId, moduleEnabled, `onboarding-test:${nonce}`],
    );
    return fixture;
  }

  beforeAll(async () => {
    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 });
    appPool = new Pool({ connectionString: process.env.TENANT_ISOLATION_TEST_DATABASE_URL, max: 2 });
    await migrationPool.query("SELECT 1");
    await appPool.query("SELECT 1");

    const enabledMinistry = await seedMinistry("alpha", true);
    await seedMinistry("beta", true);
    storageDirectory = await mkdtemp(join(tmpdir(), "bazion-onboarding-media-test-"));
    storage = new LocalObjectStorage(storageDirectory);
    enabledMinistry.mediaKey = buildTenantObjectKey(enabledMinistry.tenantId, randomUUID(), "welcome.png");
    await storage.putObject({
      tenantId: enabledMinistry.tenantId,
      key: enabledMinistry.mediaKey,
      body: Buffer.from("89504e470d0a1a0a0000000049454e44", "hex"),
      contentType: "image/png",
    });

    const { churchRoutes } = await import("./routes.js");
    app = Fastify();
    await app.register(churchRoutes, {
      prefix: "/v1",
      config: { NODE_ENV: "test", TENANT_RESOLUTION_MODE: "dynamic" } as unknown as AppConfig,
      storage,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    for (const fixture of fixtures) {
      try {
        await withTenant(appPool, fixture.tenantId, async (client) => {
          await client.query("DELETE FROM public.sermons WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.ministry_settings WHERE tenant_id = $1", [fixture.tenantId]);
          await client.query("DELETE FROM public.ministry_profiles WHERE tenant_id = $1", [fixture.tenantId]);
        });
        await migrationPool.query("DELETE FROM public.tenant_domains WHERE tenant_id = $1", [fixture.tenantId]);
        await migrationPool.query("DELETE FROM public.tenant_module_entitlements WHERE tenant_id = $1", [fixture.tenantId]);
        await migrationPool.query("DELETE FROM public.tenants WHERE id = $1", [fixture.tenantId]);
      } catch {
        // Preserve the original test result while attempting cleanup for each fixture.
      }
    }
    if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
    await Promise.all([migrationPool, appPool].filter(Boolean).map((pool) => pool.end()));
  });

  it("serves each ministry's own public identity, settings, and sermons by verified hostname", async () => {
    const alpha = fixtures[0]!;
    const beta = fixtures[1]!;

    const alphaSite = await app.inject({ method: "GET", url: "/v1/public/church/site", headers: { host: alpha.hostname } });
    const betaSite = await app.inject({ method: "GET", url: "/v1/public/church/site", headers: { host: beta.hostname } });
    expect(alphaSite.statusCode).toBe(200);
    expect(betaSite.statusCode).toBe(200);
    expect(alphaSite.json().tenant.slug).toBe(alpha.slug);
    expect(betaSite.json().tenant.slug).toBe(beta.slug);
    expect(alphaSite.json().profile.ministryName).toBe(alpha.ministryName);
    expect(betaSite.json().profile.ministryName).toBe(beta.ministryName);
    expect(alphaSite.json().siteSettings.hero.title).toBe(alpha.heroTitle);
    expect(betaSite.json().siteSettings.hero.title).toBe(beta.heroTitle);
    expect(JSON.stringify(alphaSite.json())).not.toContain(beta.ministryName);
    expect(JSON.stringify(betaSite.json())).not.toContain(alpha.ministryName);

    const alphaSermons = await app.inject({ method: "GET", url: "/v1/public/church/sermons", headers: { host: alpha.hostname } });
    const betaSermons = await app.inject({ method: "GET", url: "/v1/public/church/sermons", headers: { host: beta.hostname } });
    expect(alphaSermons.statusCode).toBe(200);
    expect(betaSermons.statusCode).toBe(200);
    expect(alphaSermons.json().items.map((item: { title: string }) => item.title)).toEqual([alpha.sermonTitle]);
    expect(betaSermons.json().items.map((item: { title: string }) => item.title)).toEqual([beta.sermonTitle]);

    await migrationPool.query(
      `UPDATE public.tenant_module_entitlements SET enabled = false
        WHERE tenant_id = $1 AND module_id = 'church-ministry'`,
      [beta.tenantId],
    );
    const disabledBetaSite = await app.inject({ method: "GET", url: "/v1/public/church/site", headers: { host: beta.hostname } });
    expect(disabledBetaSite.statusCode).toBe(404);
    expect(disabledBetaSite.json().message).toBe("The church ministry module is not enabled for this tenant.");
  });

  it("serves uploaded local media only through the owning ministry hostname", async () => {
    const alpha = fixtures[0]!;
    const beta = fixtures[1]!;
    const alphaMedia = await app.inject({
      method: "GET",
      url: `/v1/public/church/media/${alpha.mediaKey}`,
      headers: { host: alpha.hostname },
    });
    const betaMedia = await app.inject({
      method: "GET",
      url: `/v1/public/church/media/${alpha.mediaKey}`,
      headers: { host: beta.hostname },
    });

    expect(alphaMedia.statusCode).toBe(200);
    expect(alphaMedia.headers["content-type"]).toBe("image/png");
    expect(betaMedia.statusCode).toBe(404);
  });
});

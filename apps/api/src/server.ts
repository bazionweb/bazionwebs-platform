import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { closeTenantDatabaseResources, configureTenantDatabaseSecretResolver, pool } from "./lib/database.js";
import { createTenantDatabaseSecretResolver } from "./lib/tenant-database-secrets.js";
import { closeAuthResources } from "@bazion/auth/server";

const config = loadConfig();
if (config.NODE_ENV === "production") {
  configureTenantDatabaseSecretResolver(createTenantDatabaseSecretResolver({
    backend: config.TENANT_DATABASE_SECRET_BACKEND,
    secretDirectory: config.hosting.secretDirectory,
    ...(config.TENANT_DATABASE_SECRET_MANAGER_URL
      ? { secretManagerUrl: config.TENANT_DATABASE_SECRET_MANAGER_URL }
      : {}),
    ...(config.TENANT_DATABASE_SECRET_MANAGER_TOKEN
      ? { secretManagerToken: config.TENANT_DATABASE_SECRET_MANAGER_TOKEN }
      : {}),
    ...(config.TENANT_DATABASE_SECRET_MANAGER_PREFIX
      ? { secretManagerPrefix: config.TENANT_DATABASE_SECRET_MANAGER_PREFIX }
      : {}),
    ...(config.TENANT_DATABASE_SECRET_MANAGER_VERSION
      ? { secretManagerVersion: config.TENANT_DATABASE_SECRET_MANAGER_VERSION }
      : {}),
    secretManagerCacheTtlMs: config.TENANT_DATABASE_SECRET_MANAGER_CACHE_TTL_MS,
  }));
}
const app = await buildApp(config);

try {
  await app.listen({ host: "0.0.0.0", port: config.PORT });
} catch (error) {
  app.log.error(error);
  await Promise.all([pool.end(), closeTenantDatabaseResources(), closeAuthResources()]);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await Promise.all([pool.end(), closeTenantDatabaseResources(), closeAuthResources()]);
    process.exit(0);
  });
}

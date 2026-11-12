import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { closeTenantDatabaseResources, configureTenantDatabaseSecretResolver, pool } from "./lib/database.js";
import { DockerSecretTenantDatabaseSecretResolver } from "./lib/tenant-database-secrets.js";
import { closeAuthResources } from "@bazion/auth/server";

const config = loadConfig();
if (config.NODE_ENV === "production") {
  configureTenantDatabaseSecretResolver(new DockerSecretTenantDatabaseSecretResolver(config.hosting.secretDirectory));
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

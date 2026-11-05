import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { pool } from "./lib/database.js";

const config = loadConfig();
const app = await buildApp(config);

try {
  await app.listen({ host: "0.0.0.0", port: config.PORT });
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

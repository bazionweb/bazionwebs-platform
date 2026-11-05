import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) {
  throw new Error("MIGRATION_DATABASE_URL is required; never run schema migrations with the application role.");
}

const pool = new Pool({ connectionString, max: 1 });
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "../migrations");

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version varchar(255) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  for (const filename of files) {
    const existing = await pool.query(
      "SELECT 1 FROM public.schema_migrations WHERE version = $1",
      [filename],
    );
    if (existing.rowCount) {
      console.log(`Skipping ${filename} (already applied)`);
      continue;
    }

    const sqlText = await readFile(join(migrationsDir, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query(
        "INSERT INTO public.schema_migrations (version) VALUES ($1)",
        [filename],
      );
      await client.query("COMMIT");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required; do not run migrations with the application database role.");
const pool = new Pool({ connectionString });
const here = dirname(fileURLToPath(import.meta.url));
try {
  const sql = await readFile(resolve(here, "../migrations/0001_initial.sql"), "utf8");
  await pool.query(sql);
  console.log("Bazion database migration 0001 applied.");
} finally {
  await pool.end();
}

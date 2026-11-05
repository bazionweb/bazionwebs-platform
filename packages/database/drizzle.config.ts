import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations/generated",
  dbCredentials: { url: process.env.MIGRATION_DATABASE_URL ?? "postgres://bazion_migrator:bazion_migrator_local_only@localhost:5432/bazion_platform" },
});

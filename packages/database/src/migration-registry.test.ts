import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { currentDatabaseSchemaVersion, requiredDatabaseMigrations } from "./migration-registry.js";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "../migrations");

describe("database migration registry", () => {
  it("lists every numbered migration exactly once", () => {
    const files = readdirSync(migrationsDirectory)
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
      .sort();
    expect(requiredDatabaseMigrations).toEqual(files);
  });

  it("requires the current commerce, tenant-routing and hosting migrations", () => {
    expect(requiredDatabaseMigrations).toContain("0012_ecommerce_template.sql");
    expect(requiredDatabaseMigrations).toContain("0013_tenant_database_routing.sql");
    expect(requiredDatabaseMigrations).toContain("0014_global_mission_commerce_entitlement.sql");
    expect(requiredDatabaseMigrations).toContain("0015_commerce_inventory_reservation_guard.sql");
    expect(requiredDatabaseMigrations).toContain("0016_tenant_hosting_deployments.sql");
    expect(requiredDatabaseMigrations).toContain("0017_hosting_reconciliation_schedule.sql");
    expect(requiredDatabaseMigrations).toContain("0018_product_installations_provisioning_sagas.sql");
    expect(currentDatabaseSchemaVersion).toBe(requiredDatabaseMigrations.at(-1));
    expect(currentDatabaseSchemaVersion).toBe("0018_product_installations_provisioning_sagas.sql");
  });

  it("persists installation identity and inspectable saga evidence without customer contact data", () => {
    const migration = readFileSync(join(migrationsDirectory, "0018_product_installations_provisioning_sagas.sql"), "utf8");
    expect(migration).toContain("product_installations_tenant_isolation");
    expect(migration).toContain("product_provisioning_operations_idempotency_uq");
    expect(migration).toContain("product_provisioning_step_attempts_number_uq");
    expect(migration).toContain("product_provisioning_events_immutable");
    expect(migration).toContain("is_safe_product_provisioning_effect");
    expect(migration).toContain("bazion_product_provisioner");
    const operationColumns = migration.split("CREATE TABLE public.product_provisioning_operations (")[1]?.split("\n);")[0] ?? "";
    expect(operationColumns).not.toMatch(/^\s*(email|contact_email|password|secret|payment_token)\s/m);
  });
});

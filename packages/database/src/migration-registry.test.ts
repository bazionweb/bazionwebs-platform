import { readdirSync } from "node:fs";
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

  it("requires the current commerce, tenant-routing and forms-leads migrations", () => {
    expect(requiredDatabaseMigrations).toContain("0012_ecommerce_template.sql");
    expect(requiredDatabaseMigrations).toContain("0013_tenant_database_routing.sql");
    expect(requiredDatabaseMigrations).toContain("0014_global_mission_commerce_entitlement.sql");
    expect(requiredDatabaseMigrations).toContain("0015_commerce_inventory_reservation_guard.sql");
    expect(requiredDatabaseMigrations).toContain("0016_forms_leads_site_enquiries.sql");
    expect(currentDatabaseSchemaVersion).toBe(requiredDatabaseMigrations.at(-1));
    expect(currentDatabaseSchemaVersion).toBe("0016_forms_leads_site_enquiries.sql");
  });
});

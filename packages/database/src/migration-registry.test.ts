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
    expect(requiredDatabaseMigrations).toContain("0018_hosting_provider_lifecycle.sql");
    expect(requiredDatabaseMigrations).toContain("0018_product_installations_provisioning_sagas.sql");
    expect(requiredDatabaseMigrations).toContain("0019_commercial_provisioning_delivery.sql");
    expect(requiredDatabaseMigrations).toContain("0020_phase5_identity_oidc_bff.sql");
    expect(requiredDatabaseMigrations).toContain("0021_phase6_saga_leases_lifecycle_archive.sql");
    expect(currentDatabaseSchemaVersion).toBe(requiredDatabaseMigrations.at(-1));
    expect(currentDatabaseSchemaVersion).toBe("0021_phase6_saga_leases_lifecycle_archive.sql");
  });

  it("enforces Phase 6 saga lease/fencing tokens, 30-day archive retention, and lifecycle delivery tables", () => {
    const migration = readFileSync(join(migrationsDirectory, "0021_phase6_saga_leases_lifecycle_archive.sql"), "utf8");
    expect(migration).toContain("fencing_token");
    expect(migration).toContain("lease_token");
    expect(migration).toContain("installation_configuration_versions");
    expect(migration).toContain("installation_offboarding_archives");
    expect(migration).toContain("product_subscription_lifecycle_inbox");
    expect(migration).toContain("product_subscription_lifecycle_outbox");
    expect(migration).toContain("bazion_product_provisioner");
  });

  it("enforces federated (issuer, subject) uniqueness, PKCE S256 OIDC state, and single-use claim proofs", () => {
    const migration = readFileSync(join(migrationsDirectory, "0020_phase5_identity_oidc_bff.sql"), "utf8");
    expect(migration).toContain("federated_identity_links_issuer_subject_uq");
    expect(migration).toContain("code_challenge_method = 'S256'");
    expect(migration).toContain("oidc_bff_sessions");
    expect(migration).toContain("commercial_order_claim_proofs");
    expect(migration).toContain("account_email_change_requests");
    expect(migration).toContain("bazion_tenant_provisioner");
  });

  it("enforces inbox uniqueness, outbox safety validation, and provisioner-only delivery access", () => {
    const migration = readFileSync(join(migrationsDirectory, "0019_commercial_provisioning_delivery.sql"), "utf8");
    expect(migration).toContain("product_provisioning_inbox");
    expect(migration).toContain("product_provisioning_status_outbox");
    expect(migration).toContain("is_safe_commercial_status_event_payload");
    expect(migration).toContain("enqueue_product_provisioning_status_outbox");
    expect(migration).toContain("bazion_product_provisioner");
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

import { describe, expect, it } from "vitest";
import {
  getCrossRepoE2ePrerequisiteFailures,
  isSafeBazionwebTestDatabaseUrl,
} from "./cross-repo-e2e-config.js";

describe("cross-repository E2E database guard", () => {
  it("allows a local PostgreSQL test database for developer runs", () => {
    expect(isSafeBazionwebTestDatabaseUrl("postgresql://user:pass@localhost:5432/bazionweb_test")).toBe(true);
  });

  it("rejects non-PostgreSQL URLs and remote databases by default", () => {
    expect(isSafeBazionwebTestDatabaseUrl("https://localhost/bazionweb_test")).toBe(false);
    expect(isSafeBazionwebTestDatabaseUrl("postgresql://user:pass@db.example.test:5432/bazionweb_test")).toBe(false);
  });

  it("allows remote databases only for explicit non-required local runs", () => {
    const url = "postgresql://user:pass@db.example.test:5432/bazionweb_test";
    expect(isSafeBazionwebTestDatabaseUrl(url, { allowRemoteTestDb: true })).toBe(true);
    expect(isSafeBazionwebTestDatabaseUrl(url, {
      allowRemoteTestDb: true,
      requireIsolatedTestDatabase: true,
    })).toBe(false);
  });

  it("requires the isolated CI endpoint when the cross-repo suite is required", () => {
    expect(isSafeBazionwebTestDatabaseUrl(
      "postgresql://bazionweb:testpassword@127.0.0.1:5433/bazionweb_test",
      { requireIsolatedTestDatabase: true },
    )).toBe(true);
    expect(isSafeBazionwebTestDatabaseUrl(
      "postgresql://bazionweb:testpassword@127.0.0.1:5432/bazionweb_test",
      { requireIsolatedTestDatabase: true },
    )).toBe(false);
    expect(isSafeBazionwebTestDatabaseUrl(
      "postgresql://bazionweb:testpassword@127.0.0.1:5433/platform",
      { requireIsolatedTestDatabase: true },
    )).toBe(false);
  });

  it("reports missing prerequisites without exposing database URLs", () => {
    expect(getCrossRepoE2ePrerequisiteFailures({
      requireIsolatedTestDatabase: true,
      bazionwebTestDatabaseUrl: "postgresql://secret@remote.example/db",
    }, false)).toEqual([
      "MIGRATION_DATABASE_URL",
      "PRODUCT_PROVISIONER_DATABASE_URL",
      "BAZIONWEB_TEST_DATABASE_URL must target 127.0.0.1:5433/bazionweb_test",
      "Bazionweb phase3-e2e-bridge.ts checkout",
    ]);
  });
});

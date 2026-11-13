export interface CrossRepoE2eEnvironment {
  migrationDatabaseUrl?: string | undefined;
  productProvisionerDatabaseUrl?: string | undefined;
  bazionwebTestDatabaseUrl?: string | undefined;
  allowRemoteTestDb?: boolean | undefined;
  requireIsolatedTestDatabase?: boolean | undefined;
}

export function isSafeBazionwebTestDatabaseUrl(
  urlString: string | undefined,
  options: Pick<CrossRepoE2eEnvironment, "allowRemoteTestDb" | "requireIsolatedTestDatabase"> = {},
): boolean {
  if (!urlString?.trim()) return false;

  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return false;

    if (options.requireIsolatedTestDatabase) {
      return parsed.hostname === "127.0.0.1"
        && parsed.port === "5433"
        && parsed.pathname === "/bazionweb_test";
    }

    if (options.allowRemoteTestDb) return true;
    return (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
      && parsed.pathname.toLowerCase().includes("test");
  } catch {
    return false;
  }
}

export function getCrossRepoE2ePrerequisiteFailures(
  env: CrossRepoE2eEnvironment,
  bazionwebBridgeExists: boolean,
): string[] {
  const failures: string[] = [];
  if (!env.migrationDatabaseUrl?.trim()) failures.push("MIGRATION_DATABASE_URL");
  if (!env.productProvisionerDatabaseUrl?.trim()) failures.push("PRODUCT_PROVISIONER_DATABASE_URL");
  if (!isSafeBazionwebTestDatabaseUrl(env.bazionwebTestDatabaseUrl, env)) {
    failures.push(
      env.requireIsolatedTestDatabase
        ? "BAZIONWEB_TEST_DATABASE_URL must target 127.0.0.1:5433/bazionweb_test"
        : "BAZIONWEB_TEST_DATABASE_URL must target a local test database",
    );
  }
  if (!bazionwebBridgeExists) failures.push("Bazionweb phase3-e2e-bridge.ts checkout");
  return failures;
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.js";

const testKey = Buffer.from("a-distinct-test-key-for-bazion-32", "utf8").subarray(0, 32).toString("base64");

const environment: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://bazion_app:test@localhost:5432/bazion_platform",
  AUTH_DATABASE_URL: "postgres://bazion_auth_runtime:test@localhost:5432/bazion_platform",
  TENANT_RESOLVER_DATABASE_URL: "postgres://bazion_tenant_resolver:test@localhost:5432/bazion_platform",
  TENANT_PROVISIONER_DATABASE_URL: "postgres://bazion_tenant_provisioner:test@localhost:5432/bazion_platform",
  NOTIFICATION_ENQUEUER_DATABASE_URL: "postgres://bazion_notification_enqueuer:test@localhost:5432/bazion_platform",
  NOTIFICATION_ENCRYPTION_KEY: testKey,
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_SECRET: "a-development-test-secret-that-is-at-least-32-characters",
  BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000,http://localhost:4000",
  AUTH_APP_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3000,http://localhost:4000",
  PUBLIC_STOREFRONT_URL: "http://localhost:3000",
  PAYMENT_PROVIDER: "mock",
  TRUSTED_PROXY_ADDRESSES: "",
};

describe("API runtime configuration", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(environment)) vi.stubEnv(key, value);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps tenant hosting disabled unless a provider is explicitly configured", () => {
    expect(loadConfig().hosting.provider).toBe("disabled");
    expect(loadConfig().hosting.dokploy).toBeNull();
  });

  it("requires complete secure Dokploy configuration before enabling hosting", () => {
    vi.stubEnv("HOSTING_PROVIDER", "dokploy");
    expect(() => loadConfig()).toThrow(/requires DOKPLOY_BASE_URL/);

    vi.stubEnv("DOKPLOY_BASE_URL", "https://server.example.test");
    vi.stubEnv("DOKPLOY_API_KEY", "test-api-key");
    vi.stubEnv("DOKPLOY_ENVIRONMENT_ID", "environment-1");
    expect(loadConfig().hosting).toMatchObject({
      provider: "dokploy",
      dokploy: { baseUrl: "https://server.example.test", environmentId: "environment-1" },
    });
  });

  it("rejects insecure Dokploy URLs and relative secret directories", () => {
    vi.stubEnv("HOSTING_PROVIDER", "dokploy");
    vi.stubEnv("DOKPLOY_BASE_URL", "http://server.example.test");
    vi.stubEnv("DOKPLOY_API_KEY", "test-api-key");
    vi.stubEnv("DOKPLOY_ENVIRONMENT_ID", "environment-1");
    expect(() => loadConfig()).toThrow(/HTTPS URL/);

    vi.stubEnv("DOKPLOY_BASE_URL", "https://server.example.test");
    vi.stubEnv("HOSTING_SECRET_DIRECTORY", "secrets");
    expect(() => loadConfig()).toThrow(/absolute path/);
  });

  it("requires an absolute mounted secret directory in production even when hosting is disabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOSTING_SECRET_DIRECTORY", "secrets");
    expect(() => loadConfig()).toThrow(/HOSTING_SECRET_DIRECTORY must be an absolute path when Docker secrets are enabled/);
  });

  it("requires tenant-scoped Secret Manager configuration and secure URLs when selected", () => {
    vi.stubEnv("TENANT_DATABASE_SECRET_BACKEND", "secret-manager");
    expect(() => loadConfig()).toThrow(/requires TENANT_DATABASE_SECRET_MANAGER_URL and TENANT_DATABASE_SECRET_MANAGER_TOKEN/);

    vi.stubEnv("TENANT_DATABASE_SECRET_MANAGER_URL", "http://secrets.example.test");
    vi.stubEnv("TENANT_DATABASE_SECRET_MANAGER_TOKEN", "test-reader-token");
    expect(() => loadConfig()).toThrow(/must use HTTPS/);

    vi.stubEnv("TENANT_DATABASE_SECRET_MANAGER_URL", "https://secrets.example.test");
    expect(loadConfig()).toMatchObject({
      TENANT_DATABASE_SECRET_BACKEND: "secret-manager",
      TENANT_DATABASE_SECRET_MANAGER_URL: "https://secrets.example.test",
      TENANT_DATABASE_SECRET_MANAGER_CACHE_TTL_MS: 30_000,
    });
  });

  it("rejects tenant Secret Manager credentials when the Docker backend is selected", () => {
    vi.stubEnv("TENANT_DATABASE_SECRET_MANAGER_TOKEN", "stale-token");
    expect(() => loadConfig()).toThrow(/settings require TENANT_DATABASE_SECRET_BACKEND=secret-manager/);
  });

  it("accepts a canonical Base64 32-byte notification key", () => {
    expect(loadConfig().NOTIFICATION_ENCRYPTION_KEY).toBe(testKey);
  });

  it("defaults media uploads to the local development adapter", () => {
    expect(loadConfig().mediaStorage.driver).toBe("local");
  });

  it("allows staging to use the mock payment adapter while preserving production-mode security checks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true");
    vi.stubEnv("MEDIA_STORAGE_DRIVER", "s3");
    vi.stubEnv("MEDIA_STORAGE_ENDPOINT", "https://account.r2.cloudflarestorage.com");
    vi.stubEnv("MEDIA_STORAGE_BUCKET", "bazionweb-public-media");
    vi.stubEnv("MEDIA_STORAGE_ACCESS_KEY_ID", "staging-access-key");
    vi.stubEnv("MEDIA_STORAGE_SECRET_ACCESS_KEY", "staging-secret-key");
    vi.stubEnv("MEDIA_STORAGE_PUBLIC_BASE_URL", "https://media.bazionweb.com");
    vi.stubEnv("TENANT_RESOLUTION_MODE", "verified_domain");
    vi.stubEnv("TRUSTED_PROXY_ADDRESSES", "172.20.0.0/24");
    vi.stubEnv("BETTER_AUTH_SECRET", "staging-grade-better-auth-secret-at-least-32");
    vi.stubEnv("BETTER_AUTH_URL", "https://platform-api-staging.bazionweb.com");
    vi.stubEnv("AUTH_APP_URL", "https://platform-staging.bazionweb.com");
    vi.stubEnv("PUBLIC_STOREFRONT_URL", "https://church-staging.bazionweb.com");
    vi.stubEnv("PLATFORM_CONSOLE_URL", "https://platform-staging.bazionweb.com");
    vi.stubEnv("CORS_ORIGINS", "https://platform-staging.bazionweb.com,https://church-staging.bazionweb.com");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://platform-staging.bazionweb.com,https://church-staging.bazionweb.com");
    vi.stubEnv("PAYMENT_PROVIDER", "mock");
    vi.stubEnv("DEV_PAYMENT_SECRET", "staging-only-random-payment-secret-value");
    vi.stubEnv("OIDC_SIGNING_PRIVATE_KEY_PEM", `-----BEGIN PRIVATE KEY-----\\n${"A".repeat(100)}\\n-----END PRIVATE KEY-----`);
    vi.stubEnv("OIDC_BFF_CLIENT_SECRET", "staging-grade-oidc-bff-secret-at-least-32");

    const config = loadConfig();
    expect(config.APP_ENV).toBe("staging");
    expect(config.PAYMENT_PROVIDER).toBe("mock");
    expect(config.OIDC_SIGNING_PRIVATE_KEY_PEM).toContain("\n");
    vi.stubEnv("MPESA_ENVIRONMENT", "production");
    expect(() => loadConfig()).toThrow(/cannot be used outside the production application environment/);
    vi.stubEnv("MPESA_ENVIRONMENT", "sandbox");
    vi.stubEnv("APP_ENV", "production");
    expect(() => loadConfig()).toThrow(/M-Pesa payment adapter/);
  });

  it("rejects partially configured S3 media storage", () => {
    vi.stubEnv("MEDIA_STORAGE_ENDPOINT", "https://account.r2.cloudflarestorage.com");
    expect(() => loadConfig()).toThrow(/Configure all MEDIA_STORAGE_ENDPOINT/);
  });

  it("requires S3-compatible media storage in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true");
    expect(() => loadConfig()).toThrow(/configure S3-compatible object storage/);
  });

  it("rejects a malformed or non-32-byte notification key", () => {
    vi.stubEnv("NOTIFICATION_ENCRYPTION_KEY", Buffer.from("too-short").toString("base64"));
    expect(() => loadConfig()).toThrow(/canonical Base64-encoded 32-byte key/);
  });

  it("requires PRODUCT_PROVISIONER_DATABASE_URL and >=32-char non-placeholder secret when commercial provisioning is enabled", () => {
    expect(loadConfig().commercialProvisioning.enabled).toBe(false);

    vi.stubEnv("COMMERCIAL_PROVISIONING_ENABLED", "true");
    expect(() => loadConfig()).toThrow(/requires PRODUCT_PROVISIONER_DATABASE_URL and COMMERCIAL_PROVISIONING_COMMAND_SECRET/);
    vi.stubEnv("COMMERCIAL_PROVISIONING_COMMAND_SECRET", "short-secret");
    vi.stubEnv("PRODUCT_PROVISIONER_DATABASE_URL", "");
    expect(() => loadConfig()).toThrow(/requires PRODUCT_PROVISIONER_DATABASE_URL/);

    vi.stubEnv("PRODUCT_PROVISIONER_DATABASE_URL", "postgres://bazion_product_provisioner:test@localhost:5432/bazion_platform");
    expect(() => loadConfig()).toThrow(/at least 32 characters/);

    vi.stubEnv("COMMERCIAL_PROVISIONING_COMMAND_SECRET", "production-grade-commercial-secret-value-32");
    expect(loadConfig().commercialProvisioning.enabled).toBe(true);
    expect(loadConfig().commercialProvisioning).toMatchObject({
      commandIssuer: "bazionweb",
      commandAudience: "bazion-platform:commercial-provisioning",
    });

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_REQUIRE_EMAIL_VERIFICATION", "true");
    vi.stubEnv("MEDIA_STORAGE_DRIVER", "s3");
    vi.stubEnv("MEDIA_STORAGE_ENDPOINT", "https://r2.cloudflarestorage.com");
    vi.stubEnv("MEDIA_STORAGE_BUCKET", "bazion-media");
    vi.stubEnv("MEDIA_STORAGE_ACCESS_KEY_ID", "test-key");
    vi.stubEnv("MEDIA_STORAGE_SECRET_ACCESS_KEY", "test-secret");
    vi.stubEnv("MEDIA_STORAGE_PUBLIC_BASE_URL", "https://media.bazion-demo.org");
    vi.stubEnv("PAYMENT_PROVIDER", "mpesa");
    vi.stubEnv("MPESA_ENVIRONMENT", "production");
    vi.stubEnv("MPESA_CONSUMER_KEY", "k");
    vi.stubEnv("MPESA_CONSUMER_SECRET", "s");
    vi.stubEnv("MPESA_BUSINESS_SHORT_CODE", "174379");
    vi.stubEnv("MPESA_PASSKEY", "p");
    vi.stubEnv("MPESA_CALLBACK_URL", "https://api.bazion-demo.org/v1/cb");
    vi.stubEnv("TENANT_RESOLUTION_MODE", "verified_domain");
    vi.stubEnv("NOTIFICATION_ENCRYPTION_KEY", Buffer.from("prod-test-key-for-bazion-platform-32", "utf8").subarray(0, 32).toString("base64"));
    vi.stubEnv("TRUSTED_PROXY_ADDRESSES", "10.0.0.1");
    vi.stubEnv("BETTER_AUTH_SECRET", "production-grade-better-auth-secret-32chars");
    vi.stubEnv("BETTER_AUTH_URL", "https://api.bazion-demo.org");
    vi.stubEnv("AUTH_APP_URL", "https://app.bazion-demo.org");
    vi.stubEnv("PUBLIC_STOREFRONT_URL", "https://store.bazion-demo.org");
    vi.stubEnv("CORS_ORIGINS", "https://app.bazion-demo.org");
    vi.stubEnv("BETTER_AUTH_TRUSTED_ORIGINS", "https://app.bazion-demo.org");
    vi.stubEnv("COMMERCIAL_PROVISIONING_COMMAND_SECRET", "dev-only-secret-that-must-not-run-in-production");
    expect(() => loadConfig()).toThrow(/replace the development commercial provisioning secret/);

    vi.stubEnv("COMMERCIAL_PROVISIONING_COMMAND_SECRET", "production-grade-commercial-secret-32chars");
    vi.stubEnv("COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS", "too-short");
    expect(() => loadConfig()).toThrow(/COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS must be at least 32 characters/);

    vi.stubEnv("COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS", "previous-commercial-secret-at-least-32chars");
    vi.stubEnv("PRIVATE_ARCHIVE_ENCRYPTION_KEY", "not-valid-base64-key");
    expect(() => loadConfig()).toThrow(/PRIVATE_ARCHIVE_ENCRYPTION_KEY must be a canonical Base64-encoded 32-byte key/);

    vi.stubEnv("PRIVATE_ARCHIVE_ENCRYPTION_KEY", "");
    expect(() => loadConfig()).toThrow(/PRIVATE_ARCHIVE_DIR must be configured when commercial provisioning is enabled/);

    vi.stubEnv("PRIVATE_ARCHIVE_DIR", process.platform === "win32" ? "D:\\bazion\\archives" : "/var/lib/bazion/archives");
    expect(() => loadConfig()).toThrow(/PRIVATE_ARCHIVE_ENCRYPTION_KEY must be configured when commercial provisioning is enabled/);

    const archiveKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");
    vi.stubEnv("PRIVATE_ARCHIVE_ENCRYPTION_KEY", archiveKey);
    vi.stubEnv("PLATFORM_CONSOLE_URL", "https://console.bazion-demo.org");
    vi.stubEnv(
      "OIDC_SIGNING_PRIVATE_KEY_PEM",
      `-----BEGIN PRIVATE KEY-----\n${"A".repeat(80)}\n-----END PRIVATE KEY-----`,
    );
    vi.stubEnv("OIDC_BFF_CLIENT_SECRET", "production-grade-oidc-bff-secret-32chars");
    const prodConfig = loadConfig();
    expect(prodConfig.commercialProvisioning.commandPreviousSecrets).toEqual(["previous-commercial-secret-at-least-32chars"]);
    expect(prodConfig.commercialProvisioning.privateArchiveEncryptionKey).toBe(archiveKey);
  });
});

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

  it("accepts a canonical Base64 32-byte notification key", () => {
    expect(loadConfig().NOTIFICATION_ENCRYPTION_KEY).toBe(testKey);
  });

  it("rejects a malformed or non-32-byte notification key", () => {
    vi.stubEnv("NOTIFICATION_ENCRYPTION_KEY", Buffer.from("too-short").toString("base64"));
    expect(() => loadConfig()).toThrow(/canonical Base64-encoded 32-byte key/);
  });
});

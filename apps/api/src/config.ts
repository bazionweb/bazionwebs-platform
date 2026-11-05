import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DEFAULT_TENANT_ID: z.string().uuid().optional(),
  TENANT_RESOLUTION_MODE: z.enum(["static", "verified_domain"]).default("static"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:4000"),
  PUBLIC_STOREFRONT_URL: z.string().url().default("http://localhost:3000"),
  PAYMENT_PROVIDER: z.enum(["mock"]).default("mock"),
  DEV_PAYMENT_SECRET: z.string().min(12).default("local-dev-only-change-me"),
  AUTH_DATABASE_URL: z.string().min(1),
  TENANT_RESOLVER_DATABASE_URL: z.string().min(1),
  TENANT_PROVISIONER_DATABASE_URL: z.string().min(1),
  NOTIFICATION_ENQUEUER_DATABASE_URL: z.string().min(1),
  NOTIFICATION_ENCRYPTION_KEY: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:4000"),
  AUTH_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("true"),
  DEFAULT_TENANT_CURRENCY: z.enum(["KES", "USD", "EUR", "GBP"]).default("KES"),
  TRUSTED_PROXY_ADDRESSES: z.string().default(""),
});

export function loadConfig() {
  const config = envSchema.parse(process.env);
  if (config.NODE_ENV === "production" && config.PAYMENT_PROVIDER === "mock") {
    throw new Error("Production startup blocked: configure a real payment adapter; mock payments are development-only.");
  }
  if (config.NODE_ENV === "production" && config.TENANT_RESOLUTION_MODE === "static") {
    throw new Error("Production startup blocked: use verified-domain tenant resolution before onboarding clients.");
  }
  if (config.NODE_ENV === "production" && config.AUTH_REQUIRE_EMAIL_VERIFICATION !== "true") {
    throw new Error("Production startup blocked: require verified email accounts.");
  }
  const notificationKey = Buffer.from(config.NOTIFICATION_ENCRYPTION_KEY, "base64");
  const canonicalNotificationKey = notificationKey.toString("base64") === config.NOTIFICATION_ENCRYPTION_KEY;
  const exampleNotificationKey = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");
  if (notificationKey.byteLength !== 32 || !canonicalNotificationKey) {
    throw new Error("NOTIFICATION_ENCRYPTION_KEY must be a canonical Base64-encoded 32-byte key.");
  }
  if (config.NODE_ENV === "production" && config.NOTIFICATION_ENCRYPTION_KEY === exampleNotificationKey) {
    throw new Error("Production startup blocked: replace the repository's development notification key with a fresh random key.");
  }
  const trustedProxyAddresses = config.TRUSTED_PROXY_ADDRESSES.split(",").map((value) => value.trim()).filter(Boolean);
  if (config.NODE_ENV === "production" && trustedProxyAddresses.length === 0) {
    throw new Error("Production startup blocked: configure the trusted ingress proxy IPs/CIDRs and block direct public access to the API.");
  }
  if (config.NODE_ENV === "production" && /dev-only|ci-only|change-me|replace-with|local-dev/i.test(config.BETTER_AUTH_SECRET)) {
    throw new Error("Production startup blocked: replace the development or example Better Auth secret.");
  }
  if (config.NODE_ENV === "production") {
    for (const [name, value] of [
      ["BETTER_AUTH_URL", config.BETTER_AUTH_URL],
      ["AUTH_APP_URL", config.AUTH_APP_URL],
      ["PUBLIC_STOREFRONT_URL", config.PUBLIC_STOREFRONT_URL],
    ] as const) {
      if (!value.startsWith("https://")) {
        throw new Error(`Production startup blocked: ${name} must use HTTPS.`);
      }
    }
  }

  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    trustedOrigins: config.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    requireEmailVerification: config.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    trustProxy: trustedProxyAddresses.length ? trustedProxyAddresses : false,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;

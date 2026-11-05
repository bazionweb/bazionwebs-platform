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
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:4000"),
  AUTH_APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("true"),
  AUTH_SMTP_HOST: z.string().optional(),
  AUTH_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  AUTH_SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  AUTH_SMTP_USER: z.string().optional(),
  AUTH_SMTP_PASSWORD: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().default("Bazion Web <noreply@example.test>"),
  DEFAULT_TENANT_CURRENCY: z.enum(["KES", "USD", "EUR", "GBP"]).default("KES"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
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
  if (config.NODE_ENV === "production" && !config.AUTH_SMTP_HOST) {
    throw new Error("Production startup blocked: configure authenticated email delivery.");
  }
  if (config.NODE_ENV === "production" && config.BETTER_AUTH_SECRET.toLowerCase().includes("change-me")) {
    throw new Error("Production startup blocked: replace the development Better Auth secret.");
  }

  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    trustedOrigins: config.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    requireEmailVerification: config.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    trustProxy: config.TRUST_PROXY === "true",
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;

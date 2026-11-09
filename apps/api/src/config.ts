import { isIP } from "node:net";
import { z } from "zod";
import type { DarajaConfig } from "@bazion/payments";

const optionalEnv = z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).optional());

function validateCallbackUrl(value: string, production: boolean): void {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("MPESA_CALLBACK_URL must not contain credentials, query parameters or a fragment.");
  }
  if (production && (url.protocol !== "https:" || isIP(hostname) !== 0 || !hostname.includes(".") ||
      ["localhost", "local", "internal", "test", "example", "invalid"].some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)) ||
      ["example.com", "example.org", "example.net"].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)))) {
    throw new Error("Production MPESA_CALLBACK_URL must use HTTPS on a public DNS hostname.");
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DEFAULT_TENANT_ID: z.string().uuid().optional(),
  TENANT_RESOLUTION_MODE: z.enum(["static", "verified_domain"]).default("static"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:4000"),
  PUBLIC_STOREFRONT_URL: z.string().url().default("http://localhost:3000"),
  PAYMENT_PROVIDER: z.enum(["mock", "mpesa"]).default("mock"),
  MPESA_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  MPESA_CONSUMER_KEY: optionalEnv,
  MPESA_CONSUMER_SECRET: optionalEnv,
  MPESA_BUSINESS_SHORT_CODE: optionalEnv,
  MPESA_PASSKEY: optionalEnv,
  MPESA_CALLBACK_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
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
  const darajaValues = [config.MPESA_CONSUMER_KEY, config.MPESA_CONSUMER_SECRET, config.MPESA_BUSINESS_SHORT_CODE, config.MPESA_PASSKEY, config.MPESA_CALLBACK_URL];
  const darajaConfiguredCount = darajaValues.filter(Boolean).length;
  if (darajaConfiguredCount !== 0 && darajaConfiguredCount !== darajaValues.length) {
    throw new Error("Configure all MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_BUSINESS_SHORT_CODE, MPESA_PASSKEY and MPESA_CALLBACK_URL values together.");
  }
  if (config.MPESA_ENVIRONMENT === "production" && config.NODE_ENV !== "production") {
    throw new Error("Production Daraja credentials cannot be used by a non-production API process.");
  }
  if (config.MPESA_CALLBACK_URL) validateCallbackUrl(config.MPESA_CALLBACK_URL, config.NODE_ENV === "production");
  if (config.NODE_ENV === "production" && config.PAYMENT_PROVIDER === "mock") {
    throw new Error("Production startup blocked: configure the M-Pesa payment adapter; mock payments are development-only.");
  }
  if (config.PAYMENT_PROVIDER === "mpesa" && darajaConfiguredCount !== darajaValues.length) {
    throw new Error("PAYMENT_PROVIDER=mpesa requires all MPESA_* credentials and callback settings.");
  }
  if (config.NODE_ENV === "production" && config.PAYMENT_PROVIDER === "mpesa" && config.MPESA_ENVIRONMENT !== "production") {
    throw new Error("Production checkout requires MPESA_ENVIRONMENT=production.");
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
  if (config.NODE_ENV === "production") {
    const configuredOrigins = [
      ...config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
      ...config.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    ];
    if (configuredOrigins.some((origin) => !origin.startsWith("https://"))) {
      throw new Error("Production startup blocked: every CORS and Better Auth trusted origin must use HTTPS.");
    }
  }

  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    trustedOrigins: config.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    requireEmailVerification: config.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    trustProxy: trustedProxyAddresses.length ? trustedProxyAddresses : false,
    mpesa: darajaConfiguredCount === darajaValues.length
      ? {
          environment: config.MPESA_ENVIRONMENT,
          consumerKey: config.MPESA_CONSUMER_KEY!,
          consumerSecret: config.MPESA_CONSUMER_SECRET!,
          businessShortCode: config.MPESA_BUSINESS_SHORT_CODE!,
          passkey: config.MPESA_PASSKEY!,
          callbackUrl: config.MPESA_CALLBACK_URL!,
        } satisfies DarajaConfig
      : null,
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;

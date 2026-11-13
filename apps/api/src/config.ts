import { isIP } from "node:net";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { DarajaConfig } from "@bazion/payments";

const optionalEnv = z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).optional());
const defaultHostingTemplateDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../deploy/client-templates");
const defaultPrivateArchiveDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.private-archives");

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
  TENANT_DATABASE_SCHEMA_VERSION: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().trim().regex(/^\d+_[a-z0-9_-]+\.sql$/i).optional(),
  ),
  DEFAULT_TENANT_ID: z.string().uuid().optional(),
  TENANT_RESOLUTION_MODE: z.enum(["static", "verified_domain"]).default("static"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:4000"),
  PUBLIC_STOREFRONT_URL: z.string().url().default("http://localhost:3000"),
  MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  MEDIA_STORAGE_LOCAL_DIRECTORY: optionalEnv,
  MEDIA_STORAGE_ENDPOINT: optionalEnv,
  MEDIA_STORAGE_REGION: z.string().trim().min(1).default("auto"),
  MEDIA_STORAGE_BUCKET: optionalEnv,
  MEDIA_STORAGE_ACCESS_KEY_ID: optionalEnv,
  MEDIA_STORAGE_SECRET_ACCESS_KEY: optionalEnv,
  MEDIA_STORAGE_PUBLIC_BASE_URL: optionalEnv,
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
  HOSTING_PROVIDER: z.enum(["disabled", "dokploy"]).default("disabled"),
  DOKPLOY_BASE_URL: optionalEnv,
  DOKPLOY_API_KEY: optionalEnv,
  DOKPLOY_ENVIRONMENT_ID: optionalEnv,
  DOKPLOY_SERVER_ID: optionalEnv,
  HOSTING_SECRET_BACKEND: z.enum(["docker", "secret-manager"]).default("docker"),
  HOSTING_SECRET_DIRECTORY: z.string().trim().min(1).default("/run/secrets"),
  HOSTING_SECRET_MANAGER_URL: optionalEnv,
  HOSTING_SECRET_MANAGER_TOKEN: optionalEnv,
  HOSTING_SECRET_MANAGER_PREFIX: optionalEnv,
  HOSTING_SECRET_MANAGER_VERSION: optionalEnv,
  HOSTING_TEMPLATE_DIRECTORY: z.string().trim().min(1).default(defaultHostingTemplateDirectory),
  COMMERCIAL_PROVISIONING_ENABLED: z.enum(["true", "false"]).default("false"),
  COMMERCIAL_PROVISIONING_WORKER_ENABLED: z.enum(["true", "false"]).default("false"),
  COMMERCIAL_PROVISIONING_PILOT_MODE: z.enum(["disabled", "staging_pilot", "canary"]).default("disabled"),
  COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS: optionalEnv,
  COMMERCIAL_PROVISIONING_PILOT_CUSTOMERS: optionalEnv,
  COMMERCIAL_PROVISIONING_ALLOWED_OFFERS: optionalEnv,
  COMMERCIAL_PROVISIONING_HOSTING_MUTATIONS_ENABLED: z.enum(["true", "false"]).optional(),
  COMMERCIAL_PROVISIONING_LEGACY_FALLBACK_ENABLED: z.enum(["true", "false"]).default("true"),
  COMMERCIAL_PROVISIONING_DUAL_READ_RECONCILIATION_ENABLED: z.enum(["true", "false"]).default("true"),
  COMMERCIAL_PROVISIONING_SUPPORTED_DISTRIBUTION_MODES: optionalEnv,
  COMMERCIAL_PROVISIONING_PROMOTE_APPROVED_OFFERS: z.enum(["true", "false"]).default("false"),
  PRODUCT_PROVISIONER_DATABASE_URL: optionalEnv,
  COMMERCIAL_PROVISIONING_COMMAND_SECRET: optionalEnv,
  COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS: optionalEnv,
  COMMERCIAL_PROVISIONING_COMMAND_ISSUER: z.string().trim().min(1).default("bazionweb"),
  COMMERCIAL_PROVISIONING_COMMAND_AUDIENCE: z.string().trim().min(1).default("bazion-platform:commercial-provisioning"),
  PRIVATE_ARCHIVE_DIR: optionalEnv,
  PRIVATE_ARCHIVE_ENCRYPTION_KEY: optionalEnv,
  PLATFORM_CONSOLE_URL: z.string().url().default("http://localhost:3001"),
  COMMERCIAL_PORTAL_URL: z.string().url().optional(),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_SIGNING_PRIVATE_KEY_PEM: z.string().min(100).optional(),
  OIDC_SIGNING_KEY_ID: z.string().trim().min(1).max(64).optional(),
  OIDC_BFF_CLIENT_ID: z.string().trim().min(1).max(128).default("bazion-bff-platform"),
  OIDC_BFF_CLIENT_SECRET: z.string().min(32).optional(),
});

export function loadConfig() {
  const config = envSchema.parse(process.env);
  if (config.NODE_ENV === "production" && config.HOSTING_SECRET_BACKEND === "docker" && !isAbsolute(config.HOSTING_SECRET_DIRECTORY)) {
    throw new Error("HOSTING_SECRET_DIRECTORY must be an absolute path in production.");
  }
  const mediaStorageValues = [
    config.MEDIA_STORAGE_ENDPOINT,
    config.MEDIA_STORAGE_BUCKET,
    config.MEDIA_STORAGE_ACCESS_KEY_ID,
    config.MEDIA_STORAGE_SECRET_ACCESS_KEY,
    config.MEDIA_STORAGE_PUBLIC_BASE_URL,
  ];
  const mediaStorageConfiguredCount = mediaStorageValues.filter(Boolean).length;
  if (mediaStorageConfiguredCount !== 0 && mediaStorageConfiguredCount !== mediaStorageValues.length) {
    throw new Error("Configure all MEDIA_STORAGE_ENDPOINT, MEDIA_STORAGE_BUCKET, MEDIA_STORAGE_ACCESS_KEY_ID, MEDIA_STORAGE_SECRET_ACCESS_KEY and MEDIA_STORAGE_PUBLIC_BASE_URL values together.");
  }
  if (config.MEDIA_STORAGE_DRIVER === "s3" && mediaStorageConfiguredCount !== mediaStorageValues.length) {
    throw new Error("MEDIA_STORAGE_DRIVER=s3 requires endpoint, bucket, access key, secret key and public base URL settings.");
  }
  if (config.NODE_ENV === "production" && config.MEDIA_STORAGE_DRIVER !== "s3") {
    throw new Error("Production startup blocked: configure S3-compatible object storage for tenant media uploads.");
  }
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
  const dokployValues = [config.DOKPLOY_BASE_URL, config.DOKPLOY_API_KEY, config.DOKPLOY_ENVIRONMENT_ID];
  const dokployConfiguredCount = dokployValues.filter(Boolean).length;
  if (dokployConfiguredCount !== 0 && dokployConfiguredCount !== dokployValues.length) {
    throw new Error("Configure DOKPLOY_BASE_URL, DOKPLOY_API_KEY and DOKPLOY_ENVIRONMENT_ID together.");
  }
  if (config.HOSTING_PROVIDER === "dokploy" && dokployConfiguredCount !== dokployValues.length) {
    throw new Error("HOSTING_PROVIDER=dokploy requires DOKPLOY_BASE_URL, DOKPLOY_API_KEY and DOKPLOY_ENVIRONMENT_ID.");
  }
  if (config.HOSTING_PROVIDER === "disabled" && (dokployConfiguredCount > 0 || config.DOKPLOY_SERVER_ID)) {
    throw new Error("DOKPLOY_* credentials are configured while HOSTING_PROVIDER is disabled.");
  }
  if (config.HOSTING_PROVIDER === "dokploy") {
    const dokployUrl = new URL(config.DOKPLOY_BASE_URL!);
    if (dokployUrl.protocol !== "https:" || dokployUrl.username || dokployUrl.password || dokployUrl.search || dokployUrl.hash) {
      throw new Error("DOKPLOY_BASE_URL must be an HTTPS URL without credentials, query parameters or a fragment.");
    }
    if (config.HOSTING_SECRET_BACKEND === "docker" && !isAbsolute(config.HOSTING_SECRET_DIRECTORY)) {
      throw new Error("HOSTING_SECRET_DIRECTORY must be an absolute path when hosting is enabled.");
    }
    if (
      config.HOSTING_SECRET_BACKEND === "secret-manager"
      && (!config.HOSTING_SECRET_MANAGER_URL || !config.HOSTING_SECRET_MANAGER_TOKEN)
    ) {
      throw new Error("HOSTING_SECRET_BACKEND=secret-manager requires HOSTING_SECRET_MANAGER_URL and HOSTING_SECRET_MANAGER_TOKEN.");
    }
  }
  const hasProvisionerUrl = Boolean(config.PRODUCT_PROVISIONER_DATABASE_URL);
  const hasCommandSecret = Boolean(config.COMMERCIAL_PROVISIONING_COMMAND_SECRET);
  const commercialProvisioningEnabled = config.COMMERCIAL_PROVISIONING_ENABLED === "true";
  if (hasCommandSecret && !hasProvisionerUrl) {
    throw new Error("COMMERCIAL_PROVISIONING_COMMAND_SECRET requires PRODUCT_PROVISIONER_DATABASE_URL.");
  }
  if (commercialProvisioningEnabled && (!hasProvisionerUrl || !hasCommandSecret)) {
    throw new Error("COMMERCIAL_PROVISIONING_ENABLED requires PRODUCT_PROVISIONER_DATABASE_URL and COMMERCIAL_PROVISIONING_COMMAND_SECRET.");
  }
  if (config.COMMERCIAL_PROVISIONING_COMMAND_SECRET) {
    if (config.COMMERCIAL_PROVISIONING_COMMAND_SECRET.length < 32) {
      throw new Error("COMMERCIAL_PROVISIONING_COMMAND_SECRET must be at least 32 characters.");
    }
    if (config.NODE_ENV === "production" && /dev-only|ci-only|change-me|replace-with|local-dev/i.test(config.COMMERCIAL_PROVISIONING_COMMAND_SECRET)) {
      throw new Error("Production startup blocked: replace the development commercial provisioning secret.");
    }
  }

  if (config.PRIVATE_ARCHIVE_DIR && !isAbsolute(config.PRIVATE_ARCHIVE_DIR)) {
    throw new Error("PRIVATE_ARCHIVE_DIR must be an absolute path.");
  }
  const previousCommandSecrets = (config.COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS?.split(",") ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  for (const prevSecret of previousCommandSecrets) {
    if (prevSecret.length < 32) {
      throw new Error("Each entry in COMMERCIAL_PROVISIONING_COMMAND_PREVIOUS_SECRETS must be at least 32 characters.");
    }
  }
  if (config.PRIVATE_ARCHIVE_ENCRYPTION_KEY) {
    const trimmedKey = config.PRIVATE_ARCHIVE_ENCRYPTION_KEY.trim();
    const decodedKey = Buffer.from(trimmedKey, "base64");
    if (decodedKey.byteLength !== 32 || decodedKey.toString("base64") !== trimmedKey) {
      throw new Error("PRIVATE_ARCHIVE_ENCRYPTION_KEY must be a canonical Base64-encoded 32-byte key.");
    }
  }
  if (config.NODE_ENV === "production" && commercialProvisioningEnabled) {
    if (!config.PRIVATE_ARCHIVE_DIR) {
      throw new Error("Production startup blocked: PRIVATE_ARCHIVE_DIR must be configured when commercial provisioning is enabled.");
    }
    if (!config.PRIVATE_ARCHIVE_ENCRYPTION_KEY) {
      throw new Error("Production startup blocked: PRIVATE_ARCHIVE_ENCRYPTION_KEY must be configured when commercial provisioning is enabled.");
    }
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
      ["PLATFORM_CONSOLE_URL", config.PLATFORM_CONSOLE_URL],
    ] as const) {
      if (!value.startsWith("https://")) {
        throw new Error(`Production startup blocked: ${name} must use HTTPS.`);
      }
    }
    if (config.COMMERCIAL_PORTAL_URL && !config.COMMERCIAL_PORTAL_URL.startsWith("https://")) {
      throw new Error("Production startup blocked: COMMERCIAL_PORTAL_URL must use HTTPS.");
    }
    if (config.OIDC_ISSUER && !config.OIDC_ISSUER.startsWith("https://")) {
      throw new Error("Production startup blocked: OIDC_ISSUER must use HTTPS.");
    }
    if (!config.OIDC_SIGNING_PRIVATE_KEY_PEM) {
      throw new Error("Production startup blocked: configure OIDC_SIGNING_PRIVATE_KEY_PEM for OIDC RS256 signing.");
    }
    if (!config.OIDC_BFF_CLIENT_SECRET) {
      throw new Error("Production startup blocked: configure an explicit OIDC_BFF_CLIENT_SECRET.");
    }
    if (/dev-only|ci-only|change-me|replace-with|local-dev/i.test(config.OIDC_BFF_CLIENT_SECRET)) {
      throw new Error("Production startup blocked: replace the development OIDC_BFF_CLIENT_SECRET.");
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
    mediaStorage: {
      driver: config.MEDIA_STORAGE_DRIVER,
      localDirectory: config.MEDIA_STORAGE_LOCAL_DIRECTORY,
      ...(config.MEDIA_STORAGE_DRIVER === "s3" ? {
        s3: {
          endpoint: config.MEDIA_STORAGE_ENDPOINT!,
          region: config.MEDIA_STORAGE_REGION,
          bucket: config.MEDIA_STORAGE_BUCKET!,
          accessKeyId: config.MEDIA_STORAGE_ACCESS_KEY_ID!,
          secretAccessKey: config.MEDIA_STORAGE_SECRET_ACCESS_KEY!,
          publicBaseUrl: config.MEDIA_STORAGE_PUBLIC_BASE_URL!,
        },
      } : {}),
    },
    hosting: {
      provider: config.HOSTING_PROVIDER,
      secretBackend: config.HOSTING_SECRET_BACKEND,
      secretDirectory: config.HOSTING_SECRET_DIRECTORY,
      ...(config.HOSTING_SECRET_MANAGER_URL ? { secretManagerUrl: config.HOSTING_SECRET_MANAGER_URL } : {}),
      ...(config.HOSTING_SECRET_MANAGER_TOKEN ? { secretManagerToken: config.HOSTING_SECRET_MANAGER_TOKEN } : {}),
      ...(config.HOSTING_SECRET_MANAGER_PREFIX ? { secretManagerPrefix: config.HOSTING_SECRET_MANAGER_PREFIX } : {}),
      ...(config.HOSTING_SECRET_MANAGER_VERSION ? { secretManagerVersion: config.HOSTING_SECRET_MANAGER_VERSION } : {}),
      templateDirectory: config.HOSTING_TEMPLATE_DIRECTORY,
      dokploy: config.HOSTING_PROVIDER === "dokploy" ? {
        baseUrl: config.DOKPLOY_BASE_URL!,
        apiKey: config.DOKPLOY_API_KEY!,
        environmentId: config.DOKPLOY_ENVIRONMENT_ID!,
        ...(config.DOKPLOY_SERVER_ID ? { serverId: config.DOKPLOY_SERVER_ID } : {}),
      } : null,
    },
    requireEmailVerification: config.AUTH_REQUIRE_EMAIL_VERIFICATION === "true",
    platformConsoleUrl: config.PLATFORM_CONSOLE_URL,
    commercialPortalUrl: config.COMMERCIAL_PORTAL_URL,
    oidc: {
      issuer: config.OIDC_ISSUER ?? config.BETTER_AUTH_URL,
      privateKeyPem: config.OIDC_SIGNING_PRIVATE_KEY_PEM,
      keyId: config.OIDC_SIGNING_KEY_ID,
      bffClientId: config.OIDC_BFF_CLIENT_ID,
      bffClientSecret: config.OIDC_BFF_CLIENT_SECRET,
    },
    commercialProvisioning: {
      enabled: commercialProvisioningEnabled,
      workerEnabled: config.COMMERCIAL_PROVISIONING_WORKER_ENABLED === "true",
      databaseUrl: config.PRODUCT_PROVISIONER_DATABASE_URL,
      commandSecret: config.COMMERCIAL_PROVISIONING_COMMAND_SECRET,
      commandPreviousSecrets: previousCommandSecrets,
      commandIssuer: config.COMMERCIAL_PROVISIONING_COMMAND_ISSUER,
      commandAudience: config.COMMERCIAL_PROVISIONING_COMMAND_AUDIENCE,
      privateArchiveDir: config.PRIVATE_ARCHIVE_DIR ?? defaultPrivateArchiveDirectory,
      privateArchiveEncryptionKey: config.PRIVATE_ARCHIVE_ENCRYPTION_KEY,
      pilotMode: config.COMMERCIAL_PROVISIONING_PILOT_MODE,
      allowedCustomerIds: [
        ...(config.COMMERCIAL_PROVISIONING_CANARY_CUSTOMERS?.split(",") ?? []),
        ...(config.COMMERCIAL_PROVISIONING_PILOT_CUSTOMERS?.split(",") ?? []),
      ]
        .map((value) => value.trim())
        .filter(Boolean),
      allowedOffers: (config.COMMERCIAL_PROVISIONING_ALLOWED_OFFERS?.split(",") ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
      hostingMutationsEnabled:
        config.COMMERCIAL_PROVISIONING_HOSTING_MUTATIONS_ENABLED !== undefined
          ? config.COMMERCIAL_PROVISIONING_HOSTING_MUTATIONS_ENABLED === "true"
          : config.HOSTING_PROVIDER === "dokploy",
      legacyFallbackEnabled: config.COMMERCIAL_PROVISIONING_LEGACY_FALLBACK_ENABLED === "true",
      dualReadReconciliationEnabled: config.COMMERCIAL_PROVISIONING_DUAL_READ_RECONCILIATION_ENABLED === "true",
      ...(config.COMMERCIAL_PROVISIONING_SUPPORTED_DISTRIBUTION_MODES
        ? {
            supportedDistributionModes: config.COMMERCIAL_PROVISIONING_SUPPORTED_DISTRIBUTION_MODES
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean) as ("shared-managed" | "dedicated")[],
          }
        : {}),
      promoteApprovedOffers: config.COMMERCIAL_PROVISIONING_PROMOTE_APPROVED_OFFERS === "true",
    },
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

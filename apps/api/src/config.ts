import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  DEFAULT_TENANT_ID: z.string().uuid(),
  TENANT_RESOLUTION_MODE: z.enum(["static"]).default("static"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  PUBLIC_STOREFRONT_URL: z.string().url().default("http://localhost:3000"),
  PAYMENT_PROVIDER: z.enum(["mock"]).default("mock"),
  DEV_PAYMENT_SECRET: z.string().min(12).default("local-dev-only-change-me"),
});

export function loadConfig() {
  const config = envSchema.parse(process.env);
  if (config.NODE_ENV === "production" && config.PAYMENT_PROVIDER === "mock") {
    throw new Error("Production startup blocked: configure a real payment adapter; mock payments are development-only.");
  }
  if (config.NODE_ENV === "production" && config.TENANT_RESOLUTION_MODE === "static") {
    throw new Error("Production startup blocked: implement a trusted tenant resolver before onboarding clients.");
  }
  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;

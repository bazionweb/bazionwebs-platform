import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { fromNodeHeaders } from "better-auth/node";
import { auth, isVerifiedTenantHost } from "@bazion/auth/server";
import type { AppConfig } from "./config.js";
import { commerceRoutes } from "./modules/commerce/routes.js";
import { commerceAdminRoutes } from "./modules/commerce/admin-routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { churchRoutes } from "./modules/church/routes.js";
import { hostingRoutes } from "./modules/hosting/routes.js";
import { hostingRecoveryRoutes } from "./modules/hosting/recovery-routes.js";
import { createHostingProvisioningRuntime } from "./modules/hosting/runtime.js";
import { commercialProvisioningRoutes } from "./modules/commercial-provisioning/routes.js";
import { createCommercialProvisioningRuntime } from "./modules/commercial-provisioning/runtime.js";

const MEDIA_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

export async function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Daraja carries its unguessable callback capability in the query string.
      // Redact the URL at the request logger boundary so access logs cannot leak it.
      redact: ["req.url", "req.headers.authorization", "req.headers.cookie", "req.headers.x-cart-token", "req.headers.x-dev-secret", "req.headers.x-donation-status-token", "req.headers.x-payment-status-token", "req.headers['set-cookie']"],
    },
    bodyLimit: 1_048_576,
    // Enable only when the API is reachable exclusively through a trusted
    // reverse proxy that strips client-supplied forwarded headers.
    trustProxy: config.trustProxy,
  });

  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: MEDIA_UPLOAD_LIMIT_BYTES }, (_request, body, done) => {
    done(null, body);
  });

  const configuredOrigins = new Set(config.corsOrigins);
  const originIsAllowed = async (origin: string): Promise<boolean> => {
    if (configuredOrigins.has(origin)) return true;
    try {
      const parsed = new URL(origin);
      const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (local && config.NODE_ENV !== "production") return true;
      if (parsed.protocol !== "https:" || (parsed.port !== "" && parsed.port !== "443")) return false;
      if (parsed.username || parsed.password) return false;
      return await isVerifiedTenantHost(parsed.hostname);
    } catch {
      return false;
    }
  };

  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      void originIsAllowed(origin)
        .then((allowed) => callback(null, allowed ? origin : false))
        .catch((error: Error) => callback(error, false));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Donation-Status-Token", "X-Payment-Status-Token", "X-Requested-With"],
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.addHook("onRequest", async (request, reply) => {
    if (["POST", "PATCH", "DELETE", "PUT"].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !(await originIsAllowed(origin))) return reply.code(403).send({ error: "ORIGIN_NOT_ALLOWED" });
    }
  });

  const authHandler = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    try {
      const url = new URL(request.url, config.BETTER_AUTH_URL);
      const headers = fromNodeHeaders(request.headers);
      headers.delete("host");
      headers.delete("content-length");
      const body = request.body === undefined ? undefined : JSON.stringify(request.body);
      const authRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
      });
      const response = await auth.handler(authRequest);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== "set-cookie") reply.header(key, value);
      });
      const setCookies = response.headers.getSetCookie?.() ?? [];
      if (setCookies.length) reply.header("Set-Cookie", setCookies);
      const responseBody = await response.text();
      return reply.code(response.status).send(responseBody.length ? responseBody : null);
    } catch (error) {
      request.log.error({ errorName: error instanceof Error ? error.name : "UnknownError" }, "Authentication handler failed");
      return reply.code(500).send({ error: "AUTHENTICATION_FAILURE" });
    }
  };

  app.route({ method: ["GET", "POST"], url: "/api/auth/*", handler: authHandler });
  app.route({ method: ["GET", "POST"], url: "/api/auth", handler: authHandler });

  const releaseId = process.env.APP_RELEASE_ID?.trim() || process.env.GITHUB_SHA?.trim() || "local";
  app.get("/health", async () => ({ status: "ok", service: "bazion-api", environment: config.NODE_ENV, releaseId }));
  await app.register(authRoutes, { prefix: "/v1" });
  await app.register(adminRoutes, { prefix: "/v1" });
  await app.register(commerceRoutes, { prefix: "/v1", config });
  await app.register(commerceAdminRoutes, { prefix: "/v1" });
  await app.register(churchRoutes, { prefix: "/v1", config });
  const hostingRuntime = createHostingProvisioningRuntime(config.hosting);
  await app.register(hostingRoutes, {
    prefix: "/v1",
    runtime: hostingRuntime,
  });
  await app.register(hostingRecoveryRoutes, {
    prefix: "/v1",
    runtime: hostingRuntime,
  });
  const commercialProvisioningRuntime = createCommercialProvisioningRuntime(config.commercialProvisioning);
  await app.register(commercialProvisioningRoutes, {
    prefix: "/v1",
    runtime: commercialProvisioningRuntime,
  });
  app.addHook("onClose", async () => {
    await commercialProvisioningRuntime?.close();
  });

  app.setErrorHandler((error, request, reply) => {
    const candidate = error as { statusCode?: unknown; code?: unknown };
    const statusCode = typeof candidate.statusCode === "number" ? candidate.statusCode : 500;
    const code = typeof candidate.code === "string" ? candidate.code : "INTERNAL_ERROR";
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : "Request failed.";
    if (statusCode >= 500) request.log.error({ errorName, errorCode: code }, "Unhandled API error");
    return reply.code(statusCode).send({
      error: code,
      message: statusCode >= 500 ? "An unexpected error occurred." : message,
    });
  });

  return app;
}

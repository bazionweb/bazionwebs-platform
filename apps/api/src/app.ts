import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { fromNodeHeaders } from "better-auth/node";
import { evaluateCsrfOriginGuard } from "@bazion/auth";
import { auth, isVerifiedTenantHost } from "@bazion/auth/server";
import type { AppConfig } from "./config.js";
import { commerceRoutes } from "./modules/commerce/routes.js";
import { commerceAdminRoutes } from "./modules/commerce/admin-routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { oidcDiscoveryRoutes, oidcRoutes } from "./modules/auth/oidc-routes.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { adminIdentityRoutes } from "./modules/admin/identity-routes.js";
import { churchRoutes } from "./modules/church/routes.js";
import { hostingRoutes } from "./modules/hosting/routes.js";
import { hostingRecoveryRoutes } from "./modules/hosting/recovery-routes.js";
import { createHostingProvisioningRuntime } from "./modules/hosting/runtime.js";
import { commercialProvisioningRoutes } from "./modules/commercial-provisioning/routes.js";
import { fastifySensitiveRedactionPaths } from "./modules/commercial-provisioning/observability.js";
import { createCommercialProvisioningRuntime } from "./modules/commercial-provisioning/runtime.js";

const MEDIA_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

export async function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Daraja carries its unguessable callback capability in the query string and
      // commercial endpoints carry signed tokens and customer contacts in headers/bodies.
      redact: [...fastifySensitiveRedactionPaths],
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

  const baseTrustedOrigins = Array.from(
    new Set(
      [
        ...config.corsOrigins,
        config.BETTER_AUTH_URL,
        config.AUTH_APP_URL,
        config.PUBLIC_STOREFRONT_URL,
        config.PLATFORM_CONSOLE_URL,
        config.COMMERCIAL_PORTAL_URL,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => {
          try {
            return new URL(value).origin;
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  );

  app.addHook("onRequest", async (request, reply) => {
    if (!["POST", "PATCH", "DELETE", "PUT"].includes(request.method)) return;

    const pathname = request.url.split("?")[0] ?? request.url;
    const headerValue = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw);
    const sandboxHeader = headerValue(request.headers["x-bazion-sandbox"])?.trim().toLowerCase();
    const impersonatingHeader = headerValue(request.headers["x-bazion-impersonating"])?.trim().toLowerCase();
    const allowSandboxLogout =
      pathname === "/v1/auth/logout"
      || pathname === "/v1/bff/logout"
      || pathname === "/api/auth/sign-out";

    if (!allowSandboxLogout && (sandboxHeader === "true" || sandboxHeader === "1" || impersonatingHeader === "true" || impersonatingHeader === "1")) {
      return reply.code(403).send({
        error: "SANDBOX_IMPERSONATION_FORBIDDEN",
        message: "Support sandbox or impersonation requests are read-only and cannot perform mutations.",
      });
    }

    // Machine/webhook backchannel endpoints authenticate via HMAC signatures or client credentials, never browser cookies.
    if (
      pathname.startsWith("/v1/webhooks/")
      || pathname.startsWith("/v1/internal/commercial/")
      || pathname === "/v1/oidc/token"
    ) {
      return;
    }

    const cookieHeader = headerValue(request.headers.cookie) ?? "";
    if (!allowSandboxLogout && cookieHeader.includes("better-auth.")) {
      const sessionDetails = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) }).catch(() => null);
      const impersonatedBy = (sessionDetails as { session?: { impersonatedBy?: unknown } } | null)?.session?.impersonatedBy;
      if (impersonatedBy) {
        return reply.code(403).send({
          error: "SANDBOX_IMPERSONATION_FORBIDDEN",
          message: "Support impersonation sessions are read-only and cannot perform mutations.",
        });
      }
    }

    const originHeader = headerValue(request.headers.origin);
    const refererHeader = headerValue(request.headers.referer);
    const secFetchSiteHeader = headerValue(request.headers["sec-fetch-site"]);

    const dynamicTrustedOrigins = [...baseTrustedOrigins];
    if (originHeader && (await originIsAllowed(originHeader))) {
      dynamicTrustedOrigins.push(originHeader);
    }
    if (refererHeader) {
      try {
        const refererOrigin = new URL(refererHeader).origin;
        if (await originIsAllowed(refererOrigin)) {
          dynamicTrustedOrigins.push(refererOrigin);
        }
      } catch {
        // evaluateCsrfOriginGuard rejects malformed referer origins below
      }
    }

    const isProtectedSessionRoute =
      pathname.startsWith("/v1/bff/")
      || pathname.startsWith("/v1/auth/")
      || pathname.startsWith("/v1/admin/")
      || pathname === "/api/auth"
      || pathname.startsWith("/api/auth/");

    const hasAuthSessionCookie =
      cookieHeader.includes("bazion_bff_session=")
      || cookieHeader.includes("bazion_oidc_tx=")
      || cookieHeader.includes("better-auth.");

    const csrfResult = evaluateCsrfOriginGuard({
      method: request.method,
      originHeader: originHeader ?? null,
      refererHeader: refererHeader ?? null,
      secFetchSiteHeader: secFetchSiteHeader ?? null,
      cookieHeaderPresent: isProtectedSessionRoute ? Boolean(cookieHeader) : hasAuthSessionCookie,
      trustedOrigins: dynamicTrustedOrigins,
      allowSameOriginlessNonBrowser: !(
        pathname.startsWith("/v1/bff/")
        || (isProtectedSessionRoute && Boolean(cookieHeader))
        || hasAuthSessionCookie
      ),
    });

    if (!csrfResult.allowed) {
      return reply.code(csrfResult.statusCode ?? 403).send({
        error: csrfResult.code ?? "ORIGIN_NOT_ALLOWED",
        message: csrfResult.message ?? "Untrusted cross-site request rejected.",
      });
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
  await app.register(oidcDiscoveryRoutes, { config });
  await app.register(authRoutes, { prefix: "/v1", config });
  await app.register(oidcRoutes, { prefix: "/v1", config });
  await app.register(adminRoutes, { prefix: "/v1" });
  await app.register(adminIdentityRoutes, { prefix: "/v1" });
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
  const commercialProvisioningRuntime = createCommercialProvisioningRuntime({
    ...config.commercialProvisioning,
    nodeEnv: config.NODE_ENV,
    tenantProvisionerDatabaseUrl: config.TENANT_PROVISIONER_DATABASE_URL,
    auditDatabaseUrl: config.DATABASE_URL,
    privateArchiveDirectory: config.commercialProvisioning.privateArchiveDir,
    privateArchiveEncryptionKey: config.commercialProvisioning.privateArchiveEncryptionKey,
    commandPreviousSecrets: config.commercialProvisioning.commandPreviousSecrets,
    hostingRuntime,
  });
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
    if (statusCode >= 500 && code !== "TENANT_MAINTENANCE") {
      request.log.error({ errorName, errorCode: code }, "Unhandled API error");
    }
    return reply.code(statusCode).send({
      error: code,
      message: code === "TENANT_MAINTENANCE" ? message : statusCode >= 500 ? "An unexpected error occurred." : message,
    });
  });

  return app;
}

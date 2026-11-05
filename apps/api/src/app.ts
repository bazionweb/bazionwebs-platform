import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { AppConfig } from "./config.js";
import { commerceRoutes } from "./modules/commerce/routes.js";

export async function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-cart-token", "req.headers.x-dev-secret", "req.headers['set-cookie']"],
    },
    bodyLimit: 1_048_576,
    trustProxy: false,
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.corsOrigins, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  const allowedOrigins = new Set(config.corsOrigins);
  app.addHook("onRequest", async (request, reply) => {
    if (["POST", "PATCH", "DELETE"].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        return reply.code(403).send({ error: "ORIGIN_NOT_ALLOWED" });
      }
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "bazion-api", environment: config.NODE_ENV }));
  await app.register(commerceRoutes, { prefix: "/v1", config });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof (error as { statusCode?: number }).statusCode === "number" ? (error as { statusCode: number }).statusCode : 500;
    const code = (error as { code?: string }).code ?? "INTERNAL_ERROR";
    if (statusCode >= 500) {
      request.log.error({ errorName: error.name, errorCode: code }, "Unhandled API error");
    }
    return reply.code(statusCode).send({ error: code, message: statusCode >= 500 ? "An unexpected error occurred." : error.message });
  });

  return app;
}

import type { FastifyInstance } from "fastify";
import { getCurrentIdentity } from "@bazion/auth";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/me", async (request, reply) => {
    const identity = await getCurrentIdentity(request.headers);
    if (!identity) return reply.code(401).send({ error: "UNAUTHENTICATED" });
    return reply.send(identity);
  });
}

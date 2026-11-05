import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const enabled = process.env.AUTH_INTEGRATION_TESTS === "1";

describe.skipIf(!enabled)("Better Auth HTTP integration", () => {
  let auth: (typeof import("./server.js"))["auth"];
  let closeAuthResources: (typeof import("./server.js"))["closeAuthResources"];

  beforeAll(async () => {
    const server = await import("./server.js");
    auth = server.auth;
    closeAuthResources = server.closeAuthResources;
  });

  afterAll(async () => {
    await closeAuthResources?.();
  });

  it("registers, signs in, resolves a session, rejects a bad password, and signs out", async () => {
    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:4000";
    const email = `auth-test-${randomUUID()}@example.test`;
    const password = "Bazion-Integration-Password-2026!";

    const signUp = await auth.handler(new Request(new URL("/api/auth/sign-up/email", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ name: "Integration User", email, password }),
    }));
    expect(signUp.status).toBeLessThan(400);

    const badSignIn = await auth.handler(new Request(new URL("/api/auth/sign-in/email", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email, password: "Definitely-Wrong-Password!" }),
    }));
    expect(badSignIn.status).toBeGreaterThanOrEqual(400);

    const signIn = await auth.handler(new Request(new URL("/api/auth/sign-in/email", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email, password }),
    }));
    expect(signIn.status).toBeLessThan(400);
    const cookies = signIn.headers.getSetCookie().map((value) => value.split(";", 1)[0]).filter(Boolean);
    expect(cookies.length).toBeGreaterThan(0);
    const cookie = cookies.join("; ");

    const sessionResponse = await auth.handler(new Request(new URL("/api/auth/get-session", baseUrl), {
      headers: { cookie },
    }));
    expect(sessionResponse.status).toBe(200);
    const session = await sessionResponse.json() as { user?: { email?: string } } | null;
    expect(session?.user?.email).toBe(email);

    const signOut = await auth.handler(new Request(new URL("/api/auth/sign-out", baseUrl), {
      method: "POST",
      headers: { cookie, "content-type": "application/json", origin: baseUrl },
      body: "{}",
    }));
    expect(signOut.status).toBeLessThan(400);

    const afterSignOut = await auth.handler(new Request(new URL("/api/auth/get-session", baseUrl), {
      headers: { cookie },
    }));
    expect(afterSignOut.status).toBe(200);
    expect(await afterSignOut.json()).toBeNull();
  });
});

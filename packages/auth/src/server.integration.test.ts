import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createOutboxPayloadCodec } from "@bazion/notifications";

const enabled = process.env.AUTH_INTEGRATION_TESTS === "1";

describe.skipIf(!enabled)("Better Auth HTTP integration", () => {
  let auth: (typeof import("./server.js"))["auth"];
  let authPool: (typeof import("./server.js"))["authPool"];
  let closeAuthResources: (typeof import("./server.js"))["closeAuthResources"];
  let notificationPool: Pool | undefined;
  let testEmail: string | undefined;

  beforeAll(async () => {
    const server = await import("./server.js");
    auth = server.auth;
    authPool = server.authPool;
    closeAuthResources = server.closeAuthResources;

    if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "false") {
      const workerUrl = process.env.NOTIFICATION_WORKER_DATABASE_URL;
      if (!workerUrl) throw new Error("NOTIFICATION_WORKER_DATABASE_URL is required for verified auth integration tests.");
      notificationPool = new Pool({ connectionString: workerUrl, max: 1 });
    }
  });

  afterAll(async () => {
    if (testEmail) {
      await authPool.query('DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)', [testEmail]);
      await authPool.query('DELETE FROM "account" WHERE "userId" IN (SELECT id FROM "user" WHERE email = $1)', [testEmail]);
      await authPool.query('DELETE FROM "verification" WHERE identifier = $1', [testEmail]);
      await authPool.query('DELETE FROM "verification" WHERE value IN (SELECT id FROM "user" WHERE email = $1)', [testEmail]);
      await authPool.query('DELETE FROM "user" WHERE email = $1', [testEmail]);
    }
    await closeAuthResources?.();
    await notificationPool?.end();
  });

  it("registers, verifies, signs in, resets the password, revokes sessions, and signs out", async () => {
    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:4000";
    const email = `auth-test-${randomUUID()}@example.test`;
    testEmail = email;
    const password = "Bazion-Integration-Password-2026!";

    const signUp = await auth.handler(new Request(new URL("/api/auth/sign-up/email", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ name: "Integration User", email, password }),
    }));
    expect(signUp.status).toBeLessThan(400);

    if (notificationPool) {
      const queued = await notificationPool.query<{ payload_ciphertext: string }>(
        `SELECT payload_ciphertext
           FROM public.notification_outbox
          WHERE channel = 'email' AND created_at >= now() - interval '2 minutes'
          ORDER BY created_at DESC
          LIMIT 100`,
      );
      const codec = createOutboxPayloadCodec(Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY ?? "", "base64"));
      const verificationEmail = queued.rows
        .map(({ payload_ciphertext }) => JSON.parse(codec.decrypt(payload_ciphertext)) as {
          to?: string;
          template?: string;
          variables?: { url?: string };
        })
        .find((payload) => payload.to === email && payload.template === "auth.email-verification");
      const verificationUrl = verificationEmail?.variables?.url;
      expect(verificationUrl).toBeTruthy();

      const verified = await auth.handler(new Request(verificationUrl!, {
        headers: { origin: baseUrl },
      }));
      expect(verified.status).toBeLessThan(400);
    }

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

    const unknownReset = await auth.handler(new Request(new URL("/api/auth/request-password-reset", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email: `missing-${email}`, redirectTo: `${baseUrl}/reset-password` }),
    }));
    const unknownResetResult = await unknownReset.json() as { status?: boolean; message?: string };
    expect(unknownResetResult.status).toBe(true);

    const requestReset = await auth.handler(new Request(new URL("/api/auth/request-password-reset", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email, redirectTo: `${baseUrl}/reset-password` }),
    }));
    const requestResetResult = await requestReset.json() as { status?: boolean; message?: string };
    expect(requestResetResult).toEqual(unknownResetResult);

    const userResult = await authPool.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [email]);
    const resetTokenResult = await authPool.query<{ identifier: string }>(
      `SELECT identifier FROM "verification"
        WHERE value = $1 AND identifier LIKE 'reset-password:%'
        ORDER BY "createdAt" DESC LIMIT 1`,
      [userResult.rows[0]?.id],
    );
    const resetToken = resetTokenResult.rows[0]?.identifier.replace(/^reset-password:/, "");
    expect(resetToken).toBeTruthy();

    const resetCallback = await auth.handler(new Request(new URL(`/api/auth/reset-password/${resetToken}?callbackURL=${encodeURIComponent(`${baseUrl}/reset-password`)}`, baseUrl), {
      headers: { origin: baseUrl },
      redirect: "manual",
    }));
    expect(resetCallback.status).toBeGreaterThanOrEqual(300);
    expect(resetCallback.status).toBeLessThan(400);
    expect(new URL(resetCallback.headers.get("location")!).searchParams.get("token")).toBe(resetToken);

    const newPassword = "Bazion-Recovered-Password-2026!";
    const reset = await auth.handler(new Request(new URL("/api/auth/reset-password", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ token: resetToken, newPassword }),
    }));
    expect(reset.status).toBeLessThan(400);

    const replay = await auth.handler(new Request(new URL("/api/auth/reset-password", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ token: resetToken, newPassword }),
    }));
    expect(replay.status).toBeGreaterThanOrEqual(400);

    const revokedSessionResponse = await auth.handler(new Request(new URL("/api/auth/get-session", baseUrl), {
      headers: { cookie },
    }));
    expect(await revokedSessionResponse.json()).toBeNull();

    const oldPasswordSignIn = await auth.handler(new Request(new URL("/api/auth/sign-in/email", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email, password }),
    }));
    expect(oldPasswordSignIn.status).toBeGreaterThanOrEqual(400);

    const recoveredSignIn = await auth.handler(new Request(new URL("/api/auth/sign-in/email", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ email, password: newPassword }),
    }));
    expect(recoveredSignIn.status).toBeLessThan(400);
    const recoveredCookies = recoveredSignIn.headers.getSetCookie().map((value) => value.split(";", 1)[0]).filter(Boolean);
    expect(recoveredCookies.length).toBeGreaterThan(0);

    const signOut = await auth.handler(new Request(new URL("/api/auth/sign-out", baseUrl), {
      method: "POST",
      headers: { cookie: recoveredCookies.join("; "), "content-type": "application/json", origin: baseUrl },
      body: "{}",
    }));
    expect(signOut.status).toBeLessThan(400);

    const afterSignOut = await auth.handler(new Request(new URL("/api/auth/get-session", baseUrl), {
      headers: { cookie: recoveredCookies.join("; ") },
    }));
    expect(afterSignOut.status).toBe(200);
    expect(await afterSignOut.json()).toBeNull();
  });
});

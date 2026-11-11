import { generateKeyPairSync, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signMachineBearerToken, DEFAULT_COMMAND_AUDIENCE, DEFAULT_COMMAND_ISSUER } from "../commercial-provisioning/auth.js";

const runIntegration =
  process.env.AUTH_INTEGRATION_TESTS === "true"
  && Boolean(
    process.env.AUTH_DATABASE_URL
    && process.env.MIGRATION_DATABASE_URL
    && process.env.TENANT_PROVISIONER_DATABASE_URL
    && process.env.TENANT_RESOLVER_DATABASE_URL
    && process.env.DATABASE_URL,
  );

function extractSessionCookie(setCookieHeader: string | string[] | undefined, namePrefix: string): string {
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
  const found = list.find((entry) => entry.startsWith(`${namePrefix}=`));
  return found ? found.split(";", 1)[0]! : "";
}

describe.skipIf(!runIntegration)("Phase 5 live PostgreSQL HTTP OIDC, BFF, claim proof, email change, and collision flows", () => {
  let app: FastifyInstance | null = null;
  let migrationPool: Pool | null = null;
  let serverModule: typeof import("@bazion/auth/server") | null = null;

  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdClientIds: string[] = [];

  const savedEnv: Record<string, string | undefined> = {};
  const commercialCommandSecret = "phase5-integ-commercial-secret-minimum-32-chars";
  const rsa = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  const runSuffix = randomUUID().slice(0, 8);
  const ownerEmail = `phase5-http-owner-${runSuffix}@integration.test`;
  const claimantEmail = `phase5-http-claimant-${runSuffix}@integration.test`;
  const adminEmail = `phase5-http-admin-${runSuffix}@integration.test`;
  const userPassword = "Phase5!StrongTestPassword#2026";

  let ownerUserId = "";
  let claimantUserId = "";
  let adminUserId = "";
  let ownedTenantId = "";
  let unclaimedTenantId = "";

  let ownerCookie = "";
  let claimantCookie = "";
  let adminCookie = "";
  let trustedOrigin = "http://localhost:3000";

  beforeAll(async () => {
    for (const key of [
      "NODE_ENV",
      "NOTIFICATION_ENCRYPTION_KEY",
      "OIDC_SIGNING_PRIVATE_KEY_PEM",
      "OIDC_SIGNING_KEY_ID",
      "PLATFORM_CONSOLE_URL",
      "COMMERCIAL_PORTAL_URL",
      "OIDC_ISSUER",
      "COMMERCIAL_PROVISIONING_ENABLED",
      "COMMERCIAL_PROVISIONING_COMMAND_SECRET",
      "PRODUCT_PROVISIONER_DATABASE_URL",
    ]) {
      savedEnv[key] = process.env[key];
    }

    process.env.NODE_ENV = "test";
    process.env.NOTIFICATION_ENCRYPTION_KEY = Buffer.alloc(32, 0x37).toString("base64");
    process.env.OIDC_SIGNING_PRIVATE_KEY_PEM = rsa.privateKey;
    process.env.OIDC_SIGNING_KEY_ID = `phase5-http-${runSuffix}`;
    process.env.PLATFORM_CONSOLE_URL = "http://localhost:3001";
    process.env.COMMERCIAL_PORTAL_URL = "https://portal.bazion.test";
    process.env.OIDC_ISSUER = process.env.BETTER_AUTH_URL ?? "http://localhost:4000";

    const originCandidate = process.env.PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
    trustedOrigin = new URL(originCandidate).origin;

    migrationPool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL! });
    serverModule = await import("@bazion/auth/server");
    const { buildApp } = await import("../../app.js");
    const { loadConfig } = await import("../../config.js");

    const config = loadConfig();
    app = await buildApp(config);

    // Register a standalone commercial claim-issuance route backed by the commercial command secret
    // so the full cross-plane claim issuance endpoint works even when full delivery worker isn't configured.
    const { issueOrderClaimProofInputSchema } = await import("@bazion/api-contracts");
    const { verifyMachineBearerToken } = await import("../commercial-provisioning/auth.js");
    app.post("/v1/test-internal/commercial/order-claims", async (request, reply) => {
      const claims = verifyMachineBearerToken(request.headers as Record<string, unknown>, {
        secret: commercialCommandSecret,
        expectedIssuer: DEFAULT_COMMAND_ISSUER,
        expectedAudience: DEFAULT_COMMAND_AUDIENCE,
        requiredScopes: ["commercial:order-claims:write"],
      });
      const parsed = issueOrderClaimProofInputSchema.parse(request.body);
      const issued = await serverModule!.issueGuestOrderClaim({
        externalOrderId: parsed.externalOrderId,
        externalCustomerId: parsed.externalCustomerId,
        tenantId: parsed.tenantId,
        installationId: parsed.installationId ?? null,
        issuedByClient: claims.sub,
        expiresInSeconds: parsed.expiresInSeconds,
      });
      return reply.code(201).send(issued);
    });

    async function createAndSignInUser(email: string, name: string): Promise<{ userId: string; cookie: string }> {
      const signup = await serverModule!.auth.api.signUpEmail({
        body: { email, password: userPassword, name },
      });
      const userId = signup.user.id;
      createdUserIds.push(userId);

      await migrationPool!.query(`UPDATE auth."user" SET "emailVerified" = true WHERE id = $1`, [userId]);

      const signInRes = await app!.inject({
        method: "POST",
        url: "/api/auth/sign-in/email",
        headers: {
          "content-type": "application/json",
          origin: trustedOrigin,
        },
        payload: { email, password: userPassword },
      });
      expect(signInRes.statusCode).toBe(200);
      const cookie = extractSessionCookie(signInRes.headers["set-cookie"], "better-auth.session_token");
      expect(cookie).toContain("better-auth.session_token=");
      return { userId, cookie };
    }

    const owner = await createAndSignInUser(ownerEmail, "HTTP Phase5 Owner");
    ownerUserId = owner.userId;
    ownerCookie = owner.cookie;

    const claimant = await createAndSignInUser(claimantEmail, "HTTP Phase5 Claimant");
    claimantUserId = claimant.userId;
    claimantCookie = claimant.cookie;

    const admin = await createAndSignInUser(adminEmail, "HTTP Phase5 Admin");
    adminUserId = admin.userId;
    adminCookie = admin.cookie;

    // Seed owned active tenant + organization + membership for ownerUserId
    const org1Id = randomUUID();
    createdOrgIds.push(org1Id);
    const slug1 = `phase5-http-owned-${runSuffix}`;
    await serverModule.authPool.query(
      `INSERT INTO "organization" (id, name, slug, "createdAt") VALUES ($1, $2, $3, now())`,
      [org1Id, `Owned ${runSuffix}`, slug1],
    );
    await serverModule.authPool.query(
      `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt") VALUES ($1, $2, $3, 'owner', now())`,
      [randomUUID(), org1Id, ownerUserId],
    );
    const t1 = await migrationPool.query(
      `INSERT INTO public.tenants (slug, name, default_currency, auth_organization_id, status)
       VALUES ($1, $2, 'KES', $3, 'active') RETURNING id`,
      [slug1, `Owned ${runSuffix}`, org1Id],
    );
    ownedTenantId = String(t1.rows[0].id);
    createdTenantIds.push(ownedTenantId);

    // Activate org1 on owner's Better Auth session so getCurrentIdentity resolves active tenant context
    const setActiveRes = await app.inject({
      method: "POST",
      url: "/api/auth/organization/set-active",
      headers: {
        "content-type": "application/json",
        cookie: ownerCookie,
        origin: trustedOrigin,
      },
      payload: { organizationId: org1Id },
    });
    expect(setActiveRes.statusCode).toBe(200);

    // Seed unclaimed tenant without any owner membership yet
    const org2Id = randomUUID();
    createdOrgIds.push(org2Id);
    const slug2 = `phase5-http-claimable-${runSuffix}`;
    await serverModule.authPool.query(
      `INSERT INTO "organization" (id, name, slug, "createdAt") VALUES ($1, $2, $3, now())`,
      [org2Id, `Claimable ${runSuffix}`, slug2],
    );
    const t2 = await migrationPool.query(
      `INSERT INTO public.tenants (slug, name, default_currency, auth_organization_id, status)
       VALUES ($1, $2, 'KES', $3, 'active') RETURNING id`,
      [slug2, `Claimable ${runSuffix}`, org2Id],
    );
    unclaimedTenantId = String(t2.rows[0].id);
    createdTenantIds.push(unclaimedTenantId);

    // Promote adminUserId to platform_admin in public.platform_members
    await migrationPool.query(
      `INSERT INTO public.platform_members (user_id, email, role, status)
       VALUES ($1, $2, 'platform_admin', 'active')`,
      [adminUserId, adminEmail],
    );
  }, 60_000);

  afterAll(async () => {
    try {
      for (const userId of createdUserIds) {
        await migrationPool?.query("DELETE FROM public.platform_members WHERE user_id = $1", [userId]);
        await migrationPool?.query("DELETE FROM public.account_email_change_requests WHERE user_id = $1", [userId]);
        await migrationPool?.query("DELETE FROM public.oidc_bff_sessions WHERE user_id = $1", [userId]);
        await migrationPool?.query("DELETE FROM public.oidc_authorization_codes WHERE user_id = $1", [userId]);
        await migrationPool?.query("DELETE FROM public.federated_identity_links WHERE user_id = $1", [userId]);
        await migrationPool?.query(
          "DELETE FROM public.identity_link_collisions WHERE existing_user_id = $1 OR conflicting_user_id = $1",
          [userId],
        );
      }
      for (const tenantId of createdTenantIds) {
        await migrationPool?.query("DELETE FROM public.commercial_order_claim_proofs WHERE tenant_id = $1::uuid", [tenantId]);
        try {
          await migrationPool?.query("DELETE FROM public.tenants WHERE id = $1::uuid", [tenantId]);
        } catch {
          // Audit log rows are strictly append-only (ON DELETE RESTRICT); close synthetic test tenant when audited.
          await migrationPool?.query("UPDATE public.tenants SET status = 'closed', auth_organization_id = NULL WHERE id = $1::uuid", [tenantId]).catch(() => undefined);
        }
      }
      for (const clientId of createdClientIds) {
        await migrationPool?.query("DELETE FROM public.oidc_bff_auth_transactions WHERE client_id = $1", [clientId]);
        await migrationPool?.query("DELETE FROM public.oidc_clients WHERE client_id = $1", [clientId]);
      }
      await migrationPool?.query("DELETE FROM public.oidc_bff_auth_transactions WHERE client_id = $1", ["bazion-bff-platform"]);
      for (const orgId of createdOrgIds) {
        await serverModule?.authPool.query('DELETE FROM "member" WHERE "organizationId" = $1', [orgId]);
        await serverModule?.authPool.query('DELETE FROM "organization" WHERE id = $1', [orgId]);
      }
      for (const userId of createdUserIds) {
        await serverModule?.authPool.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
        await serverModule?.authPool.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
        await serverModule?.authPool.query('DELETE FROM "user" WHERE id = $1', [userId]);
      }
    } finally {
      await app?.close();
      await migrationPool?.end();
      await serverModule?.closeAuthResources();
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }, 60_000);

  it("executes real OIDC PKCE BFF HTTP flow against PostgreSQL, encrypts vault tokens at rest, and revokes on logout", async () => {
    const discovery = await app!.inject({ method: "GET", url: "/.well-known/openid-configuration" });
    expect(discovery.statusCode).toBe(200);

    // 1. Start BFF login with hostile redirect target -> sanitized to /workspace and __Host-Http- cookie on HTTPS proxy
    const loginRes = await app!.inject({
      method: "GET",
      url: "/v1/bff/login?redirect=https://evil.attacker/steal&mode=json",
      headers: { "x-forwarded-proto": "https" },
    });
    expect(loginRes.statusCode).toBe(200);
    const loginJson = loginRes.json() as { authorizeUrl: string; state: string; returnTo: string };
    expect(loginJson.returnTo).toBe("/workspace");

    const txCookie = extractSessionCookie(loginRes.headers["set-cookie"], "__Host-Http-bazion_oidc_tx");
    expect(txCookie).toContain("__Host-Http-bazion_oidc_tx=");

    const authorizeUrl = new URL(loginJson.authorizeUrl);
    const authorizePath = `${authorizeUrl.pathname}${authorizeUrl.search}`;

    // 2. Sandbox header on authorize must fail closed even for real authenticated user
    const sandboxDenied = await app!.inject({
      method: "GET",
      url: authorizePath,
      headers: { cookie: ownerCookie, "x-bazion-sandbox": "true" },
    });
    expect(sandboxDenied.statusCode).toBe(403);
    expect(sandboxDenied.json()).toMatchObject({ error: "SANDBOX_IMPERSONATION_FORBIDDEN" });

    // 3. Real authorize issues code + state redirect without any tokens
    const authzRes = await app!.inject({
      method: "GET",
      url: authorizePath,
      headers: { cookie: ownerCookie },
    });
    expect(authzRes.statusCode).toBe(302);
    const callbackTarget = new URL(String(authzRes.headers.location));
    const authCode = callbackTarget.searchParams.get("code");
    const callbackState = callbackTarget.searchParams.get("state");
    expect(authCode).toBeTruthy();
    expect(callbackState).toBe(loginJson.state);

    // 4. BFF callback exchanges code via PKCE + stores AES-256-GCM encrypted vault payload in PostgreSQL
    const callbackRes = await app!.inject({
      method: "GET",
      url: `/v1/bff/callback?code=${encodeURIComponent(authCode!)}&state=${encodeURIComponent(callbackState!)}`,
      headers: {
        "x-forwarded-proto": "https",
        cookie: txCookie,
      },
    });
    expect(callbackRes.statusCode).toBe(302);
    expect(callbackRes.headers.location).toBe("/workspace");
    const bffCookie = extractSessionCookie(callbackRes.headers["set-cookie"], "__Host-Http-bazion_bff_session");
    expect(bffCookie).toContain("__Host-Http-bazion_bff_session=");

    // Verify encrypted vault columns in Postgres have zero plaintext JWTs
    const vaultRows = await migrationPool!.query(
      `SELECT access_token_ciphertext, revoked_at FROM public.oidc_bff_sessions WHERE user_id = $1`,
      [ownerUserId],
    );
    expect(vaultRows.rowCount).toBeGreaterThanOrEqual(1);
    const latestVault = vaultRows.rows[vaultRows.rows.length - 1]!;
    expect(String(latestVault.access_token_ciphertext)).toMatch(/^v1\./);
    expect(String(latestVault.access_token_ciphertext)).not.toContain("eyJ");
    expect(latestVault.revoked_at).toBeNull();

    // 5. GET /v1/bff/session returns verified session claims cleanly
    const sessionRes = await app!.inject({
      method: "GET",
      url: "/v1/bff/session",
      headers: { "x-forwarded-proto": "https", cookie: bffCookie },
    });
    expect(sessionRes.statusCode).toBe(200);
    expect(sessionRes.json()).toMatchObject({
      userId: ownerUserId,
      tenantId: ownedTenantId,
      user: { email: ownerEmail, emailVerified: true },
    });

    // 6. Code replay rejected cleanly on callback/token
    const login2Res = await app!.inject({
      method: "GET",
      url: "/v1/bff/login?redirect=/workspace&mode=json",
      headers: { "x-forwarded-proto": "https" },
    });
    const txCookie2 = extractSessionCookie(login2Res.headers["set-cookie"], "__Host-Http-bazion_oidc_tx");
    const login2State = (login2Res.json() as { state: string }).state;
    const replayRes = await app!.inject({
      method: "GET",
      url: `/v1/bff/callback?code=${encodeURIComponent(authCode!)}&state=${encodeURIComponent(login2State)}`,
      headers: { "x-forwarded-proto": "https", cookie: txCookie2 },
    });
    expect(replayRes.statusCode).toBe(400);

    // 7. CSRF cross-site and originless POST /v1/bff/logout blocked 403
    const csrfBlocked = await app!.inject({
      method: "POST",
      url: "/v1/bff/logout",
      headers: { cookie: bffCookie, "sec-fetch-site": "cross-site", origin: trustedOrigin },
    });
    expect(csrfBlocked.statusCode).toBe(403);

    // 8. Trusted origin logout revokes session in PostgreSQL and clears cookie
    const logoutRes = await app!.inject({
      method: "POST",
      url: "/v1/bff/logout",
      headers: {
        "x-forwarded-proto": "https",
        cookie: bffCookie,
        origin: trustedOrigin,
        "sec-fetch-site": "same-origin",
      },
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toEqual({ signedOut: true, revokedBff: true });

    const postLogoutSession = await app!.inject({
      method: "GET",
      url: "/v1/bff/session",
      headers: { "x-forwarded-proto": "https", cookie: bffCookie },
    });
    expect(postLogoutSession.statusCode).toBe(401);
    expect(postLogoutSession.json()).toMatchObject({ error: "SESSION_EXPIRED" });
  }, 30_000);

  it("enforces atomic single-use order claims, verified email changes without merge, and collision resolution", async () => {
    // 1. Commercial service mints short-lived order claim proof for unclaimedTenantId
    const serviceBearer = signMachineBearerToken(
      {
        issuer: DEFAULT_COMMAND_ISSUER,
        audience: DEFAULT_COMMAND_AUDIENCE,
        subject: "svc-bazionweb",
        scopes: ["commercial:order-claims:write"],
      },
      commercialCommandSecret,
    );
    const issuedRes = await app!.inject({
      method: "POST",
      url: "/v1/test-internal/commercial/order-claims",
      headers: {
        authorization: `Bearer ${serviceBearer}`,
        "content-type": "application/json",
      },
      payload: {
        externalOrderId: `ord-http-${runSuffix}`,
        externalCustomerId: `cust-http-${runSuffix}`,
        tenantId: unclaimedTenantId,
      },
    });
    expect(issuedRes.statusCode).toBe(201);
    const { proofToken } = issuedRes.json() as { proofToken: string };

    // 2. Unclaimed tenant claimed atomically by verified claimant
    const claimRes = await app!.inject({
      method: "POST",
      url: "/v1/auth/claim-order",
      headers: {
        cookie: claimantCookie,
        origin: trustedOrigin,
        "content-type": "application/json",
      },
      payload: { proofToken },
    });
    expect(claimRes.statusCode).toBe(200);
    expect(claimRes.json()).toMatchObject({
      claimed: true,
      tenantId: unclaimedTenantId,
      membershipRole: "owner",
    });

    // 3. Replaying claim proof fails atomically with 409 CLAIM_PROOF_ALREADY_USED
    const replayClaimRes = await app!.inject({
      method: "POST",
      url: "/v1/auth/claim-order",
      headers: {
        cookie: ownerCookie,
        origin: trustedOrigin,
        "content-type": "application/json",
      },
      payload: { proofToken },
    });
    expect(replayClaimRes.statusCode).toBe(409);
    expect(replayClaimRes.json()).toMatchObject({ error: "CLAIM_PROOF_ALREADY_USED" });

    // 4. Email change to conflicting address returns 409 EMAIL_CHANGE_CONFLICT and logs open collision in DB
    const conflictEmailRes = await app!.inject({
      method: "POST",
      url: "/v1/auth/email-change/request",
      headers: {
        cookie: ownerCookie,
        origin: trustedOrigin,
        "content-type": "application/json",
      },
      payload: { newEmail: claimantEmail },
    });
    expect(conflictEmailRes.statusCode).toBe(409);
    const conflictBody = conflictEmailRes.json() as { error: string; collisionId?: string };
    expect(conflictBody.error).toBe("EMAIL_CHANGE_CONFLICT");
    expect(conflictBody.collisionId).toBeTruthy();

    // 5. Non-owner client cannot list or resolve collisions, platform_admin can
    const clientCollisionDeny = await app!.inject({
      method: "GET",
      url: "/v1/admin/platform/identity/collisions?status=open",
      headers: { cookie: ownerCookie },
    });
    expect(clientCollisionDeny.statusCode).toBe(403);

    const adminListRes = await app!.inject({
      method: "GET",
      url: "/v1/admin/platform/identity/collisions?status=open",
      headers: { cookie: adminCookie },
    });
    expect(adminListRes.statusCode).toBe(200);
    const listedIds = (adminListRes.json() as { items: Array<{ id: string }> }).items.map((i) => i.id);
    expect(listedIds).toContain(conflictBody.collisionId!);

    const adminRejectRes = await app!.inject({
      method: "POST",
      url: `/v1/admin/platform/identity/collisions/${conflictBody.collisionId!}/resolve`,
      headers: {
        cookie: adminCookie,
        origin: trustedOrigin,
        "content-type": "application/json",
      },
      payload: {
        action: "reject",
        note: "Confirmed two distinct account holders; auto-merge refused.",
      },
    });
    expect(adminRejectRes.statusCode).toBe(200);
    expect(adminRejectRes.json()).toMatchObject({
      collision: { id: conflictBody.collisionId, status: "resolved_rejected" },
    });

    // 6. Fresh email change request + confirmation updates user email and revokes active BFF sessions
    const freshEmail = `phase5-http-updated-${runSuffix}@integration.test`;
    const reqChangeRes = await app!.inject({
      method: "POST",
      url: "/v1/auth/email-change/request",
      headers: {
        cookie: ownerCookie,
        origin: trustedOrigin,
        "content-type": "application/json",
      },
      payload: { newEmail: freshEmail },
    });
    expect(reqChangeRes.statusCode).toBe(202);
    const verificationToken = (reqChangeRes.json() as { testVerificationToken?: string }).testVerificationToken;
    expect(verificationToken).toBeTruthy();

    const confirmRes = await app!.inject({
      method: "POST",
      url: "/v1/auth/email-change/confirm",
      headers: {
        cookie: ownerCookie,
        origin: trustedOrigin,
        "content-type": "application/json",
      },
      payload: { token: verificationToken },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json()).toMatchObject({
      updated: true,
      newEmail: freshEmail,
      reauthenticationRequired: true,
    });
  }, 30_000);
});

import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseCookieHeader } from "@bazion/auth";
import { buildApp } from "../../app.js";
import { loadConfig } from "../../config.js";

const testKeyPair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const publicJwk = (() => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const exported = publicKey.export({ format: "jwk" });
  return { kty: exported.kty, n: exported.n, e: exported.e, alg: "RS256", use: "sig", kid: "test-rsa-kid-1" };
})();

const mocks = vi.hoisted(() => {
  class MockOidcSecurityError extends Error {
    constructor(
      public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 503,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }

  class MockIdentityLifecycleError extends Error {
    constructor(
      public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 410,
      public readonly code: string,
      message: string,
      public readonly collisionId?: string,
    ) {
      super(message);
    }
  }

  return {
    MockOidcSecurityError,
    MockIdentityLifecycleError,
    getCurrentIdentity: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
    isVerifiedTenantHost: vi.fn(),
    dbQuery: vi.fn(),
    auditEvents: [] as Array<Record<string, unknown>>,
    authorityUpsertClient: vi.fn(),
    authorityCreateAuthCode: vi.fn(),
    authorityExchangeToken: vi.fn(),
    authorityGetUserinfo: vi.fn(),
    authorityBeginBffTransaction: vi.fn(),
    authorityCompleteBffCallback: vi.fn(),
    authorityGetBffSession: vi.fn(),
    authorityRevokeBffSession: vi.fn(),
    claimGuestOrder: vi.fn(),
    requestEmailChange: vi.fn(),
    confirmEmailChange: vi.fn(),
    issueGuestOrderClaim: vi.fn(),
  };
});

vi.mock("@bazion/audit", () => ({
  PostgresAuditEventWriter: class {
    append(event: Record<string, unknown>) {
      mocks.auditEvents.push(event);
      return Promise.resolve();
    }
  },
}));

vi.mock("@bazion/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bazion/auth")>();
  return {
    ...actual,
    getCurrentIdentity: mocks.getCurrentIdentity,
  };
});

vi.mock("@bazion/auth/server", () => ({
  OidcSecurityError: mocks.MockOidcSecurityError,
  IdentityLifecycleError: mocks.MockIdentityLifecycleError,
  assertNoSandboxImpersonation: (claims: Record<string, unknown>) => {
    if (
      claims.is_sandbox === true
      || claims.isSandbox === true
      || claims.impersonating === true
      || Boolean(claims.impersonatedBy)
    ) {
      throw new mocks.MockOidcSecurityError(
        403,
        "SANDBOX_IMPERSONATION_FORBIDDEN",
        "Support sandbox or impersonation claims cannot mint or bridge production OIDC sessions.",
      );
    }
  },
  isVerifiedTenantHost: mocks.isVerifiedTenantHost,
  auth: {
    handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    api: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
    },
  },
  getOidcAuthority: (options: { issuer: string }) => ({
    getDiscoveryDocument: () => ({
      issuer: options.issuer,
      authorization_endpoint: `${options.issuer}/v1/oidc/authorize`,
      token_endpoint: `${options.issuer}/v1/oidc/token`,
      userinfo_endpoint: `${options.issuer}/v1/oidc/userinfo`,
      jwks_uri: `${options.issuer}/v1/oidc/jwks`,
      end_session_endpoint: `${options.issuer}/v1/bff/logout`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "profile", "email", "tenant:admin", "platform:control", "commercial:billing:read"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      code_challenge_methods_supported: ["S256"],
      claims_supported: ["sub", "iss", "aud", "exp", "iat", "nonce", "email", "email_verified", "name", "tenant_id", "tenant_slug", "platform_role"],
    }),
    getJwks: () => ({ keys: [publicJwk] }),
    upsertClient: mocks.authorityUpsertClient,
    authorize: mocks.authorityCreateAuthCode,
    exchangeToken: mocks.authorityExchangeToken,
    getUserinfo: mocks.authorityGetUserinfo,
    beginBffTransaction: mocks.authorityBeginBffTransaction,
    completeBffCallback: mocks.authorityCompleteBffCallback,
    getBffSession: mocks.authorityGetBffSession,
    revokeBffSession: mocks.authorityRevokeBffSession,
  }),
  claimGuestOrder: mocks.claimGuestOrder,
  requestEmailChange: mocks.requestEmailChange,
  confirmEmailChange: mocks.confirmEmailChange,
  issueGuestOrderClaim: mocks.issueGuestOrderClaim,
}));

vi.mock("../../lib/database.js", () => ({
  pool: { query: mocks.dbQuery },
}));

const ENV_KEYS = [
  "NODE_ENV",
  "TENANT_RESOLUTION_MODE",
  "TRUSTED_PROXY_ADDRESSES",
  "DATABASE_URL",
  "AUTH_DATABASE_URL",
  "TENANT_RESOLVER_DATABASE_URL",
  "TENANT_PROVISIONER_DATABASE_URL",
  "NOTIFICATION_ENQUEUER_DATABASE_URL",
  "NOTIFICATION_ENCRYPTION_KEY",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "AUTH_APP_URL",
  "PUBLIC_STOREFRONT_URL",
  "PLATFORM_CONSOLE_URL",
  "COMMERCIAL_PORTAL_URL",
  "OIDC_ISSUER",
  "OIDC_SIGNING_PRIVATE_KEY_PEM",
  "CORS_ORIGINS",
  "MEDIA_STORAGE_DRIVER",
  "MEDIA_STORAGE_ENDPOINT",
  "MEDIA_STORAGE_BUCKET",
  "MEDIA_STORAGE_ACCESS_KEY_ID",
  "MEDIA_STORAGE_SECRET_ACCESS_KEY",
  "MEDIA_STORAGE_PUBLIC_BASE_URL",
  "PAYMENT_PROVIDER",
  "MPESA_ENVIRONMENT",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_BUSINESS_SHORT_CODE",
  "MPESA_PASSKEY",
  "MPESA_CALLBACK_URL",
] as const;

const savedEnv: Record<string, string | undefined> = {};
const validNotificationKeyBase64 = Buffer.alloc(32, 0x42).toString("base64");

function seedBaseTestEnv(overrides: Record<string, string | undefined> = {}) {
  const base: Record<string, string> = {
    NODE_ENV: "test",
    DATABASE_URL: "postgres://bazion:test@localhost:5432/bazion",
    AUTH_DATABASE_URL: "postgres://bazion:test@localhost:5432/bazion",
    TENANT_RESOLVER_DATABASE_URL: "postgres://bazion:test@localhost:5432/bazion",
    TENANT_PROVISIONER_DATABASE_URL: "postgres://bazion:test@localhost:5432/bazion",
    NOTIFICATION_ENQUEUER_DATABASE_URL: "postgres://bazion:test@localhost:5432/bazion",
    NOTIFICATION_ENCRYPTION_KEY: validNotificationKeyBase64,
    BETTER_AUTH_URL: "http://localhost:4000",
    BETTER_AUTH_SECRET: "test-better-auth-secret-minimum-32-chars",
    BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000,http://localhost:3100,http://localhost:3001,http://localhost:4000",
    AUTH_APP_URL: "http://localhost:3000",
    PUBLIC_STOREFRONT_URL: "http://localhost:3100",
    PLATFORM_CONSOLE_URL: "http://localhost:3001",
    COMMERCIAL_PORTAL_URL: "https://portal.bazion.test",
    OIDC_ISSUER: "http://localhost:4000",
    OIDC_SIGNING_PRIVATE_KEY_PEM: testKeyPair.privateKey,
    CORS_ORIGINS: "http://localhost:3000,http://localhost:3100,http://localhost:3001",
  };
  const merged = { ...base, ...overrides };
  for (const key of ENV_KEYS) {
    if (merged[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = merged[key];
    }
  }
}

describe("Phase 5 OIDC, BFF cookies, CSRF, claim-order, email lifecycle, and deep-link routes", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    seedBaseTestEnv();
    vi.clearAllMocks();
    mocks.auditEvents.length = 0;
    mocks.dbQuery.mockResolvedValue({ rows: [{ slug: "acme-church" }] });
    mocks.isVerifiedTenantHost.mockResolvedValue(false);
    mocks.authorityUpsertClient.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
    mocks.getSession.mockResolvedValue({ session: { id: "sess-1" } });
    mocks.getCurrentIdentity.mockResolvedValue({
      user: {
        id: "user-tenant-owner",
        email: "owner@acme.test",
        name: "Acme Owner",
        emailVerified: true,
      },
      organization: { id: "org-1", role: "owner" },
      tenant: {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "acme-church",
        name: "Acme Church",
        currency: "KES",
        status: "active",
      },
      platformRole: null,
    });
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("enforces HTTPS URLs and OIDC RS256 private key PEM in production configuration", () => {
    seedBaseTestEnv({
      NODE_ENV: "production",
      TENANT_RESOLUTION_MODE: "verified_domain",
      TRUSTED_PROXY_ADDRESSES: "127.0.0.1",
      BETTER_AUTH_URL: "https://api.bazion.co.ke",
      AUTH_APP_URL: "https://app.bazion.co.ke",
      PUBLIC_STOREFRONT_URL: "https://sites.bazion.co.ke",
      PLATFORM_CONSOLE_URL: "http://admin.bazion.co.ke",
      COMMERCIAL_PORTAL_URL: "https://portal.bazion.co.ke",
      OIDC_ISSUER: "https://api.bazion.co.ke",
      MEDIA_STORAGE_DRIVER: "s3",
      MEDIA_STORAGE_ENDPOINT: "https://s3.bazion.co.ke",
      MEDIA_STORAGE_BUCKET: "bazion-media",
      MEDIA_STORAGE_ACCESS_KEY_ID: "key-1",
      MEDIA_STORAGE_SECRET_ACCESS_KEY: "secret-1",
      MEDIA_STORAGE_PUBLIC_BASE_URL: "https://cdn.bazion.co.ke",
      PAYMENT_PROVIDER: "mpesa",
      MPESA_ENVIRONMENT: "production",
      MPESA_CONSUMER_KEY: "mpesa-consumer-key",
      MPESA_CONSUMER_SECRET: "mpesa-consumer-secret",
      MPESA_BUSINESS_SHORT_CODE: "174379",
      MPESA_PASSKEY: "mpesa-passkey-123456",
      MPESA_CALLBACK_URL: "https://api.bazion.co.ke/v1/webhooks/mpesa",
      CORS_ORIGINS: "https://app.bazion.co.ke,https://admin.bazion.co.ke",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://app.bazion.co.ke,https://admin.bazion.co.ke",
    });
    expect(() => loadConfig()).toThrow(/PLATFORM_CONSOLE_URL must use HTTPS/);

    process.env.PLATFORM_CONSOLE_URL = "https://admin.bazion.co.ke";
    process.env.COMMERCIAL_PORTAL_URL = "http://portal.bazion.co.ke";
    expect(() => loadConfig()).toThrow(/COMMERCIAL_PORTAL_URL must use HTTPS/);

    process.env.COMMERCIAL_PORTAL_URL = "https://portal.bazion.co.ke";
    process.env.OIDC_ISSUER = "http://api.bazion.co.ke";
    expect(() => loadConfig()).toThrow(/OIDC_ISSUER must use HTTPS/);

    process.env.OIDC_ISSUER = "https://api.bazion.co.ke";
    delete process.env.OIDC_SIGNING_PRIVATE_KEY_PEM;
    expect(() => loadConfig()).toThrow(/OIDC_SIGNING_PRIVATE_KEY_PEM/);

    process.env.OIDC_SIGNING_PRIVATE_KEY_PEM = testKeyPair.privateKey;
    const prod = loadConfig();
    expect(prod.platformConsoleUrl).toBe("https://admin.bazion.co.ke");
    expect(prod.commercialPortalUrl).toBe("https://portal.bazion.co.ke");
    expect(prod.oidc.issuer).toBe("https://api.bazion.co.ke");
  });

  it("exposes OIDC discovery metadata and public RS256 JWKS with zero private key fields", async () => {
    const app = await buildApp(loadConfig());
    try {
      const discovery = await app.inject({ method: "GET", url: "/.well-known/openid-configuration" });
      expect(discovery.statusCode).toBe(200);
      expect(discovery.json()).toMatchObject({
        issuer: "http://localhost:4000",
        authorization_endpoint: "http://localhost:4000/v1/oidc/authorize",
        token_endpoint: "http://localhost:4000/v1/oidc/token",
        userinfo_endpoint: "http://localhost:4000/v1/oidc/userinfo",
        jwks_uri: "http://localhost:4000/v1/oidc/jwks",
        end_session_endpoint: "http://localhost:4000/v1/bff/logout",
        code_challenge_methods_supported: ["S256"],
        id_token_signing_alg_values_supported: ["RS256"],
      });

      const jwks = await app.inject({ method: "GET", url: "/v1/oidc/jwks" });
      expect(jwks.statusCode).toBe(200);
      const keys = jwks.json().keys as Array<Record<string, unknown>>;
      expect(keys).toHaveLength(1);
      expect(keys[0]).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig" });
      for (const secretField of ["d", "p", "q", "dp", "dq", "qi"]) {
        expect(keys[0]).not.toHaveProperty(secretField);
      }
    } finally {
      await app.close();
    }
  });

  it("rejects sandbox impersonation, plain PKCE, and leaks zero tokens in authorize redirects", async () => {
    const app = await buildApp(loadConfig());
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");

    try {
      // Unauthenticated request rejected 401
      mocks.getCurrentIdentity.mockResolvedValueOnce(null);
      const unauth = await app.inject({
        method: "GET",
        url: `/v1/oidc/authorize?client_id=bazion-bff-platform&redirect_uri=${encodeURIComponent("http://localhost:4000/v1/bff/callback")}&response_type=code&scope=openid&state=state_1234567890&nonce=nonce_1234567890&code_challenge=${challenge}&code_challenge_method=S256`,
      });
      expect(unauth.statusCode).toBe(401);

      // Sandbox impersonation blocked 403 and audited
      mocks.getSession.mockResolvedValueOnce({
        session: { id: "sess-sandbox", impersonatedBy: "support-admin-1" },
      });
      const sandbox = await app.inject({
        method: "GET",
        url: `/v1/oidc/authorize?client_id=bazion-bff-platform&redirect_uri=${encodeURIComponent("http://localhost:4000/v1/bff/callback")}&response_type=code&scope=openid&state=state_1234567890&nonce=nonce_1234567890&code_challenge=${challenge}&code_challenge_method=S256`,
      });
      expect(sandbox.statusCode).toBe(403);
      expect(sandbox.json()).toMatchObject({ error: "SANDBOX_IMPERSONATION_FORBIDDEN" });
      expect(mocks.auditEvents).toContainEqual(
        expect.objectContaining({ action: "oidc.authorize", outcome: "denied" }),
      );

      // Plain PKCE rejected by strict contract validation
      const plainPkce = await app.inject({
        method: "GET",
        url: `/v1/oidc/authorize?client_id=bazion-bff-platform&redirect_uri=${encodeURIComponent("http://localhost:4000/v1/bff/callback")}&response_type=code&scope=openid&state=state_1234567890&nonce=nonce_1234567890&code_challenge=${challenge}&code_challenge_method=plain`,
      });
      expect(plainPkce.statusCode).toBe(400);

      // Valid S256 authorize redirect returns code + state ONLY (never tokens)
      mocks.authorityCreateAuthCode.mockResolvedValueOnce({
        code: "authcode_high_entropy_0123456789",
        redirectTo: "http://localhost:4000/v1/bff/callback?code=authcode_high_entropy_0123456789&state=state_1234567890",
      });
      const validAuthz = await app.inject({
        method: "GET",
        url: `/v1/oidc/authorize?client_id=bazion-bff-platform&redirect_uri=${encodeURIComponent("http://localhost:4000/v1/bff/callback")}&response_type=code&scope=openid%20profile&state=state_1234567890&nonce=nonce_1234567890&code_challenge=${challenge}&code_challenge_method=S256`,
      });
      expect(validAuthz.statusCode).toBe(302);
      expect(validAuthz.headers["cache-control"]).toBe("no-store");
      expect(validAuthz.headers["referrer-policy"]).toBe("no-referrer");
      const redirectUrl = new URL(String(validAuthz.headers.location));
      expect(redirectUrl.searchParams.get("code")).toBe("authcode_high_entropy_0123456789");
      expect(redirectUrl.searchParams.get("state")).toBe("state_1234567890");
      expect(redirectUrl.searchParams.get("access_token")).toBeNull();
      expect(redirectUrl.searchParams.get("id_token")).toBeNull();
      expect(redirectUrl.hash).toBe("");
    } finally {
      await app.close();
    }
  });

  it("supports RFC 6749 form-urlencoded /v1/oidc/token exchange and maps invalid_grant cleanly", async () => {
    const app = await buildApp(loadConfig());
    const verifier = randomBytes(32).toString("base64url");

    try {
      mocks.authorityExchangeToken.mockResolvedValueOnce({
        token_type: "Bearer",
        expires_in: 600,
        scope: "openid profile",
        id_token: "id.jwt.token",
        access_token: "access.jwt.token",
      });

      const form = new URLSearchParams({
        grant_type: "authorization_code",
        code: "authcode_high_entropy_0123456789",
        redirect_uri: "http://localhost:4000/v1/bff/callback",
        client_id: "bazion-bff-platform",
        code_verifier: verifier,
      }).toString();

      const ok = await app.inject({
        method: "POST",
        url: "/v1/oidc/token",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: form,
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.headers["cache-control"]).toBe("no-store");
      expect(ok.json()).toMatchObject({
        token_type: "Bearer",
        id_token: "id.jwt.token",
        access_token: "access.jwt.token",
      });

      mocks.authorityExchangeToken.mockRejectedValueOnce(
        new mocks.MockOidcSecurityError(400, "OIDC_INVALID_GRANT", "Authorization code has already been used."),
      );
      const replay = await app.inject({
        method: "POST",
        url: "/v1/oidc/token",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: form,
      });
      expect(replay.statusCode).toBe(400);
      expect(replay.json()).toEqual({
        error: "invalid_grant",
        error_description: "Authorization code has already been used.",
      });
    } finally {
      await app.close();
    }
  });

  it("sanitizes BFF login redirects, enforces __Host-Http- cookies under HTTPS, and blocks CSRF", async () => {
    const app = await buildApp(loadConfig());
    try {
      mocks.authorityBeginBffTransaction.mockImplementationOnce(async (input: { returnTo: string }) => ({
        txToken: "tx_high_entropy_token_value_123456",
        state: "state_value_1234567890",
        nonce: "nonce_value_1234567890",
        codeChallenge: "S256_challenge_value_1234567890_abcde",
        codeChallengeMethod: "S256",
        returnTo: input.returnTo,
      }));

      // Open redirect attempt sanitized back to /workspace, __Host-Http- cookie emitted on x-forwarded-proto: https
      const loginRes = await app.inject({
        method: "GET",
        url: "/v1/bff/login?redirect=https://evil.attacker/phish&mode=json",
        headers: { "x-forwarded-proto": "https" },
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json()).toMatchObject({
        returnTo: "/workspace",
        codeChallengeMethod: "S256",
      });
      const txSetCookie = String(loginRes.headers["set-cookie"]);
      expect(txSetCookie).toContain("__Host-Http-bazion_oidc_tx=");
      expect(txSetCookie).toContain("HttpOnly");
      expect(txSetCookie).toContain("Secure");
      expect(txSetCookie).toContain("Path=/");
      expect(txSetCookie).toContain("SameSite=Lax");
      expect(txSetCookie).not.toMatch(/\bDomain=/i);

      // BFF callback exchanges code via backchannel and sets HttpOnly session cookie with zero tokens in redirect URL
      mocks.authorityCompleteBffCallback.mockResolvedValueOnce({
        sessionToken: "bff_session_high_entropy_0123456789",
        returnTo: "http://localhost:3100/admin",
        user: { sub: "user-tenant-owner", platformRole: null, tenantId: "11111111-1111-4111-8111-111111111111" },
      });

      const callbackRes = await app.inject({
        method: "GET",
        url: "/v1/bff/callback?code=authcode_high_entropy_0123456789&state=state_value_1234567890",
        headers: {
          "x-forwarded-proto": "https",
          cookie: "__Host-Http-bazion_oidc_tx=tx_high_entropy_token_value_123456",
        },
      });
      expect(callbackRes.statusCode).toBe(302);
      expect(callbackRes.headers.location).toBe("http://localhost:3100/admin");
      const callbackCookies = Array.isArray(callbackRes.headers["set-cookie"])
        ? callbackRes.headers["set-cookie"]
        : [String(callbackRes.headers["set-cookie"])];
      expect(callbackCookies.some((c) => c.startsWith("__Host-Http-bazion_oidc_tx=;") && c.includes("Max-Age=0"))).toBe(true);
      const sessionCookie = callbackCookies.find((c) => c.startsWith("__Host-Http-bazion_bff_session="));
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie).toContain("HttpOnly");
      expect(sessionCookie).toContain("Secure");
      expect(sessionCookie).toContain("Path=/");
      expect(sessionCookie).toContain("SameSite=Lax");
      expect(sessionCookie).not.toMatch(/\bDomain=/i);

      const sessionCookiePair = sessionCookie!.split(";", 1)[0]!;
      const parsedCookies = parseCookieHeader(sessionCookiePair);
      expect(parsedCookies["__Host-Http-bazion_bff_session"]).toBe("bff_session_high_entropy_0123456789");

      // Expired / revoked BFF session clears cookie cleanly and returns 401 SESSION_EXPIRED
      mocks.authorityGetBffSession.mockResolvedValueOnce(null);
      const expiredSession = await app.inject({
        method: "GET",
        url: "/v1/bff/session",
        headers: { "x-forwarded-proto": "https", cookie: sessionCookiePair },
      });
      expect(expiredSession.statusCode).toBe(401);
      expect(expiredSession.json()).toMatchObject({ error: "SESSION_EXPIRED" });
      expect(String(expiredSession.headers["set-cookie"])).toContain("Max-Age=0");

      // CSRF protection blocks cross-site, untrusted origin, and originless cookie mutations
      const crossSiteLogout = await app.inject({
        method: "POST",
        url: "/v1/bff/logout",
        headers: {
          cookie: sessionCookiePair,
          "sec-fetch-site": "cross-site",
          origin: "http://localhost:3100",
        },
      });
      expect(crossSiteLogout.statusCode).toBe(403);
      expect(crossSiteLogout.json()).toMatchObject({ error: "CSRF_CROSS_SITE_BLOCKED" });

      const evilOriginLogout = await app.inject({
        method: "POST",
        url: "/v1/bff/logout",
        headers: {
          cookie: sessionCookiePair,
          origin: "https://evil.attacker",
        },
      });
      expect(evilOriginLogout.statusCode).toBe(403);
      expect(evilOriginLogout.json()).toMatchObject({ error: "CSRF_UNTRUSTED_ORIGIN" });

      const missingOriginLogout = await app.inject({
        method: "POST",
        url: "/v1/bff/logout",
        headers: { cookie: sessionCookiePair },
      });
      expect(missingOriginLogout.statusCode).toBe(403);
      expect(missingOriginLogout.json()).toMatchObject({ error: "CSRF_ORIGIN_REQUIRED" });

      // Trusted origin logout revokes BFF session and clears cookies
      mocks.authorityRevokeBffSession.mockResolvedValueOnce(true);
      const validLogout = await app.inject({
        method: "POST",
        url: "/v1/bff/logout",
        headers: {
          "x-forwarded-proto": "https",
          origin: "http://localhost:3100",
          "sec-fetch-site": "same-site",
          cookie: sessionCookiePair,
        },
      });
      expect(validLogout.statusCode).toBe(200);
      expect(validLogout.json()).toEqual({ signedOut: true, revokedBff: true });
      expect(mocks.authorityRevokeBffSession).toHaveBeenCalledWith("bff_session_high_entropy_0123456789");
    } finally {
      await app.close();
    }
  });

  it("handles order claims, email changes with BFF invalidation, and scoped deep-link boundary isolation", async () => {
    const app = await buildApp(loadConfig());
    try {
      // Guest order claim success
      mocks.claimGuestOrder.mockResolvedValueOnce({
        claimId: "22222222-2222-4222-8222-222222222222",
        tenantId: "11111111-1111-4111-8111-111111111111",
        organizationId: "org-1",
        membershipRole: "owner",
        status: "claimed",
      });
      const claimOk = await app.inject({
        method: "POST",
        url: "/v1/auth/claim-order",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: { proofToken: "claim_proof_high_entropy_token_minimum_32_chars" },
      });
      expect(claimOk.statusCode).toBe(200);
      expect(claimOk.json()).toMatchObject({ claimed: true, membershipRole: "owner" });

      // Claim replay propagates 409 CLAIM_PROOF_ALREADY_USED
      mocks.claimGuestOrder.mockRejectedValueOnce(
        new mocks.MockIdentityLifecycleError(409, "CLAIM_PROOF_ALREADY_USED", "This order claim token has already been used."),
      );
      const claimReplay = await app.inject({
        method: "POST",
        url: "/v1/auth/claim-order",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: { proofToken: "claim_proof_high_entropy_token_minimum_32_chars" },
      });
      expect(claimReplay.statusCode).toBe(409);
      expect(claimReplay.json()).toMatchObject({ error: "CLAIM_PROOF_ALREADY_USED" });

      // Email change conflict returns 409 without merging accounts
      mocks.requestEmailChange.mockRejectedValueOnce(
        new mocks.MockIdentityLifecycleError(
          409,
          "EMAIL_CHANGE_CONFLICT",
          "Target email already belongs to another account.",
          "33333333-3333-4333-8333-333333333333",
        ),
      );
      const emailConflict = await app.inject({
        method: "POST",
        url: "/v1/auth/email-change/request",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: { newEmail: "existing-other@acme.test" },
      });
      expect(emailConflict.statusCode).toBe(409);
      expect(emailConflict.json()).toMatchObject({
        error: "EMAIL_CHANGE_CONFLICT",
        collisionId: "33333333-3333-4333-8333-333333333333",
      });

      // Confirm email change revokes Better Auth + BFF session cookies
      mocks.confirmEmailChange.mockResolvedValueOnce({
        requestId: "44444444-4444-4444-8444-444444444444",
        userId: "user-tenant-owner",
        previousEmail: "owner@acme.test",
        newEmail: "newowner@acme.test",
        confirmedAt: "2026-11-11T00:00:00.000Z",
      });
      const emailConfirm = await app.inject({
        method: "POST",
        url: "/v1/auth/email-change/confirm",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: { token: "email_change_verification_token_minimum_32_chars" },
      });
      expect(emailConfirm.statusCode).toBe(200);
      expect(emailConfirm.json()).toMatchObject({
        updated: true,
        newEmail: "newowner@acme.test",
        reauthenticationRequired: true,
      });
      expect(String(emailConfirm.headers["set-cookie"])).toContain("Max-Age=0");

      // Deep-link isolation: tenant owner cannot open platform console
      const platformLinkDenied = await app.inject({
        method: "POST",
        url: "/v1/auth/deep-links/resolve",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: { area: "platform_console_deployments", tenantId: "11111111-1111-4111-8111-111111111111" },
      });
      expect(platformLinkDenied.statusCode).toBe(403);
      expect(platformLinkDenied.json()).toMatchObject({ error: "DEEP_LINK_FORBIDDEN" });

      // Deep-link isolation: tenant owner of tenant A cannot deep-link tenant B
      mocks.dbQuery.mockResolvedValueOnce({ rows: [{ slug: "other-tenant" }] });
      const crossTenantDenied = await app.inject({
        method: "POST",
        url: "/v1/auth/deep-links/resolve",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: {
          area: "tenant_workspace_admin",
          tenantId: "55555555-5555-4555-8555-555555555555",
        },
      });
      expect(crossTenantDenied.statusCode).toBe(403);
      expect(crossTenantDenied.json()).toMatchObject({ error: "DEEP_LINK_FORBIDDEN" });

      // Scoped commercial billing deep-link succeeds with opaque identifiers and zero tokens/PII
      const billingLinkOk = await app.inject({
        method: "POST",
        url: "/v1/auth/deep-links/resolve",
        headers: { origin: "http://localhost:3100", "content-type": "application/json" },
        payload: {
          area: "commercial_billing",
          externalRef: "ord_12345",
        },
      });
      expect(billingLinkOk.statusCode).toBe(200);
      const billingJson = billingLinkOk.json() as { boundary: string; targetUrl: string; opaqueReferences: Record<string, string> };
      expect(billingJson.boundary).toBe("commercial_portal");
      expect(billingJson.targetUrl).toContain("https://portal.bazion.test/portal/billing");
      expect(billingJson.targetUrl).toContain("ref=ord_12345");
      expect(billingJson.opaqueReferences).toMatchObject({
        tenantId: "11111111-1111-4111-8111-111111111111",
        externalRef: "ord_12345",
      });
      expect(billingJson.targetUrl).not.toContain("owner@acme.test");
      expect(billingJson.targetUrl).not.toContain("token");
    } finally {
      await app.close();
    }
  });
});

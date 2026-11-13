import { describe, expect, it } from "vitest";
import {
  buildBffSessionCookieOptions,
  buildOidcTransactionCookieOptions,
  evaluateCsrfOriginGuard,
  parseCookieHeader,
  resolveSafeRedirectTarget,
  serializeClearCookieHeader,
  serializeSetCookieHeader,
  shouldUseStrictHostCookies,
} from "./bff-cookies.js";
import {
  DeepLinkPolicyError,
  buildTenantStorefrontUrl,
  buildTenantWorkspacePickerUrl,
  resolveScopedDeepLink,
} from "./deep-links.js";
import {
  OidcSecurityError,
  assertNoSandboxImpersonation,
  computePkceS256Challenge,
  decryptVaultSecret,
  encryptVaultSecret,
  exportPublicJwks,
  loadOrGenerateOidcSigningKey,
  signOidcJwt,
  verifyOidcJwt,
  verifyPkceS256,
} from "./oidc.js";

describe("Phase 5 BFF cookie and CSRF security", () => {
  it("builds RFC 9700 __Host-Http- BFF cookies for HTTPS/production with Path=/ and no Domain", () => {
    expect(shouldUseStrictHostCookies({ nodeEnv: "production" })).toBe(true);
    expect(shouldUseStrictHostCookies({ baseUrl: "https://auth.bazion.example" })).toBe(true);
    expect(shouldUseStrictHostCookies({ forwardedProto: "https" })).toBe(true);
    expect(shouldUseStrictHostCookies({ nodeEnv: "development", baseUrl: "http://localhost:3000" })).toBe(false);

    const sessionCookie = buildBffSessionCookieOptions({ strictHostCookie: true });
    expect(sessionCookie.name).toBe("__Host-Http-bazion_bff_session");
    expect(sessionCookie.path).toBe("/");
    expect(sessionCookie.domain).toBeUndefined();
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.secure).toBe(true);

    const setHeader = serializeSetCookieHeader({ ...sessionCookie, value: "opaque-token-123" });
    expect(setHeader).toContain("__Host-Http-bazion_bff_session=opaque-token-123");
    expect(setHeader).toContain("Path=/");
    expect(setHeader).toContain("SameSite=Lax");
    expect(setHeader).toContain("HttpOnly");
    expect(setHeader).toContain("Secure");
    expect(setHeader).not.toContain("Domain=");

    const txCookie = buildOidcTransactionCookieOptions({ strictHostCookie: true });
    expect(txCookie.name).toBe("__Host-Http-bazion_oidc_tx");

    const clearHeader = serializeClearCookieHeader(sessionCookie);
    expect(clearHeader).toContain("Max-Age=0");
    expect(clearHeader).not.toContain("Domain=");
  });

  it("refuses insecure __Host-Http- serialization and safely parses Cookie headers", () => {
    expect(() =>
      serializeSetCookieHeader({
        name: "__Host-Http-broken",
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 60,
        value: "abc",
      }),
    ).toThrow(/requires Secure/);

    expect(parseCookieHeader("__Host-Http-bazion_bff_session=abc%3D123; other=ok")).toEqual({
      "__Host-Http-bazion_bff_session": "abc=123",
      other: "ok",
    });
  });

  it("rejects open redirect vectors and preserves safe local and allowlisted URLs", () => {
    const allowedOrigins = ["https://portal.bazion.example"];
    expect(resolveSafeRedirectTarget("/admin?tab=orders#list", { allowedOrigins })).toBe("/admin?tab=orders#list");
    expect(resolveSafeRedirectTarget("https://portal.bazion.example/dashboard", { allowedOrigins })).toBe(
      "https://portal.bazion.example/dashboard",
    );

    for (const malicious of [
      "https://evil.test/phish",
      "//evil.test/steal",
      "/\\evil.test",
      "///evil.test",
      "/user@evil.test",
      "javascript:alert(1)",
      "/admin\r\nSet-Cookie: pwn=1",
    ]) {
      expect(resolveSafeRedirectTarget(malicious, { allowedOrigins, fallback: "/admin" })).toBe("/admin");
    }
  });

  it("blocks cross-site CSRF requests via Sec-Fetch-Site and Origin/Referer checks", () => {
    const trustedOrigins = ["https://app.bazion.example", "https://console.bazion.example"];

    expect(evaluateCsrfOriginGuard({ method: "GET", trustedOrigins }).allowed).toBe(true);

    expect(
      evaluateCsrfOriginGuard({
        method: "POST",
        secFetchSiteHeader: "cross-site",
        trustedOrigins,
      }),
    ).toMatchObject({ allowed: false, code: "CSRF_CROSS_SITE_BLOCKED" });

    expect(
      evaluateCsrfOriginGuard({
        method: "POST",
        originHeader: "https://attacker.test",
        trustedOrigins,
      }),
    ).toMatchObject({ allowed: false, code: "CSRF_UNTRUSTED_ORIGIN" });

    expect(
      evaluateCsrfOriginGuard({
        method: "DELETE",
        cookieHeaderPresent: true,
        trustedOrigins,
      }),
    ).toMatchObject({ allowed: false, code: "CSRF_ORIGIN_REQUIRED" });

    expect(
      evaluateCsrfOriginGuard({
        method: "POST",
        originHeader: "https://app.bazion.example",
        secFetchSiteHeader: "same-site",
        trustedOrigins,
      }).allowed,
    ).toBe(true);
  });
});

describe("Phase 5 OIDC S256 PKCE, RS256 JWKS, Vault, and Sandbox isolation", () => {
  it("computes and verifies RFC 7636 S256 challenges and rejects weak or mismatched verifiers", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-123456";
    const challenge = computePkceS256Challenge(verifier);
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256(`${verifier}tampered`, challenge)).toBe(false);
    expect(verifyPkceS256("short", challenge)).toBe(false);
  });

  it("signs RS256 OIDC JWTs, exports public JWKS without private exponents, and rejects bad nonces/tampering", () => {
    expect(() => loadOrGenerateOidcSigningKey({ nodeEnv: "production" })).toThrow(/OIDC_SIGNING_PRIVATE_KEY_PEM/);

    const keyPair = loadOrGenerateOidcSigningKey({ nodeEnv: "test", keyId: "test-key-1" });
    const jwks = exportPublicJwks(keyPair);
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig", kid: "test-key-1" });
    expect(jwks.keys[0]).not.toHaveProperty("d");

    const now = Math.floor(Date.now() / 1000);
    const token = signOidcJwt(
      {
        iss: "https://auth.bazion.example",
        sub: "user_1",
        aud: "bazion-bff-platform",
        nonce: "nonce-1234567890abcdef",
        exp: now + 300,
        iat: now,
      },
      keyPair,
    );

    const verified = verifyOidcJwt(token, keyPair, {
      expectedIssuer: "https://auth.bazion.example",
      expectedAudience: "bazion-bff-platform",
      expectedNonce: "nonce-1234567890abcdef",
      nowSeconds: now,
    });
    expect(verified.sub).toBe("user_1");

    expect(() =>
      verifyOidcJwt(token, keyPair, {
        expectedIssuer: "https://auth.bazion.example",
        expectedAudience: "bazion-bff-platform",
        expectedNonce: "wrong-nonce-value-123456",
        nowSeconds: now,
      }),
    ).toThrow(OidcSecurityError);

    const [h, p, s] = token.split(".");
    expect(s).toBeDefined();
    const tamperedSignature = `${s!.startsWith("A") ? "B" : "A"}${s!.slice(1)}`;
    expect(() =>
      verifyOidcJwt(`${h}.${p}.${tamperedSignature}`, keyPair, {
        expectedIssuer: "https://auth.bazion.example",
      }),
    ).toThrow(/signature/i);
  });

  it("blocks sandbox impersonation claims and protects BFF vault secrets via AES-256-GCM", () => {
    expect(() => assertNoSandboxImpersonation({ sub: "u1", is_sandbox: true })).toThrow(/sandbox/i);
    expect(() => assertNoSandboxImpersonation({ sub: "u1", impersonating: true })).toThrow(OidcSecurityError);

    const keyPair = loadOrGenerateOidcSigningKey({ nodeEnv: "test" });
    expect(() => signOidcJwt({ sub: "u1", is_sandbox: true }, keyPair)).toThrow(OidcSecurityError);

    const secret = "a-very-strong-development-secret-key-at-least-32-chars";
    const encrypted = encryptVaultSecret("eyJhbGciOiJSUzI1NiJ9.access", secret);
    expect(encrypted).not.toContain("eyJhbGci");
    expect(decryptVaultSecret(encrypted, secret)).toBe("eyJhbGciOiJSUzI1NiJ9.access");
    expect(() => decryptVaultSecret(`${encrypted}x`, secret)).toThrow();
    expect(() => decryptVaultSecret(`${encrypted.slice(0, -4)}AAAA`, secret)).toThrow();
  });
});

describe("Phase 5 scoped deep links & dashboard boundaries", () => {
  const origins = {
    commercialPortalUrl: "https://portal.bazion.example",
    platformConsoleUrl: "https://admin.bazion.example",
    publicStorefrontUrl: "https://app.bazion.example",
  };
  const tenantA = "00000000-0000-4000-8000-00000000000a";
  const tenantB = "00000000-0000-4000-8000-00000000000b";

  it("builds storefront and workspace URLs from configured origins without hardcoded hosts", () => {
    expect(buildTenantStorefrontUrl("https://sites.bazion.example/ignored", "grace")).toBe(
      "https://sites.bazion.example/?tenant=grace",
    );
    expect(
      buildTenantWorkspacePickerUrl("https://sites.bazion.example", {
        organizationId: "org_1",
        tenantSlug: "grace",
      }),
    ).toBe("https://sites.bazion.example/workspace?select=org_1&workspace=grace&redirect=%2Fadmin");
  });

  it("enforces role and tenant boundaries on deep links and omits sensitive tokens from URLs", () => {
    expect(() =>
      resolveScopedDeepLink({
        area: "platform_console_deployments",
        actorUserId: "u_client",
        actorPlatformRole: null,
        actorTenantId: tenantA,
        actorOrgRoles: ["owner"],
        targetTenantId: tenantA,
        origins,
      }),
    ).toThrow(DeepLinkPolicyError);

    expect(() =>
      resolveScopedDeepLink({
        area: "platform_console_tenant",
        actorUserId: "u_admin_a",
        actorPlatformRole: "platform_admin",
        actorTenantId: tenantA,
        actorOrgRoles: [],
        targetTenantId: tenantB,
        origins,
      }),
    ).toThrow(DeepLinkPolicyError);

    expect(() =>
      resolveScopedDeepLink({
        area: "commercial_billing",
        actorUserId: "u_support_a",
        actorPlatformRole: "platform_support",
        actorTenantId: tenantA,
        actorOrgRoles: [],
        targetTenantId: tenantB,
        origins,
      }),
    ).toThrow(/Tenant scope is outside your granted assignment/);

    expect(() =>
      resolveScopedDeepLink({
        area: "tenant_workspace_admin",
        actorUserId: "u_owner_a",
        actorPlatformRole: null,
        actorTenantId: tenantA,
        actorOrgRoles: ["owner"],
        targetTenantId: tenantB,
        targetTenantSlug: "tenant-b",
        origins,
      }),
    ).toThrow(/permission/);

    const ownerConsole = resolveScopedDeepLink({
      area: "platform_console_deployments",
      actorUserId: "u_platform_owner",
      actorPlatformRole: "platform_owner",
      actorTenantId: null,
      actorOrgRoles: [],
      targetTenantId: tenantB,
      origins,
    });
    expect(ownerConsole.targetUrl).toBe(`https://admin.bazion.example/tenants/${tenantB}#hosting`);

    expect(() =>
      resolveScopedDeepLink({
        area: "platform_console_domains",
        actorUserId: "u_support",
        actorPlatformRole: "platform_support",
        actorTenantId: tenantA,
        actorOrgRoles: [],
        targetTenantId: tenantA,
        origins,
      }),
    ).toThrow(DeepLinkPolicyError);

    const commercialBilling = resolveScopedDeepLink({
      area: "commercial_invoices",
      actorUserId: "u_owner_a",
      actorPlatformRole: null,
      actorTenantId: tenantA,
      actorOrgRoles: ["owner"],
      targetTenantId: tenantA,
      externalRef: "ext_ten_123",
      origins,
    });
    expect(commercialBilling.boundary).toBe("commercial_portal");
    expect(commercialBilling.targetUrl).toBe("https://portal.bazion.example/portal/invoices?ref=ext_ten_123");
    expect(commercialBilling.targetUrl).not.toMatch(/token|secret|password|email/i);
  });
});

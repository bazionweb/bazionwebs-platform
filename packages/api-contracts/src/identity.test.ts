import { describe, expect, it } from "vitest";
import {
  consumeOrderClaimProofInputSchema,
  issueOrderClaimProofInputSchema,
  oidcAuthorizationRequestSchema,
  oidcIdentityClaimsSchema,
  oidcTokenExchangeRequestSchema,
  resolveIdentityCollisionInputSchema,
  scopedDeepLinkRequestSchema,
} from "./index.js";

describe("Phase 5 identity & OIDC API contracts", () => {
  it("requires S256 PKCE, state, and nonce on authorization requests", () => {
    const valid = oidcAuthorizationRequestSchema.safeParse({
      client_id: "bazionweb-bff",
      redirect_uri: "https://portal.bazion.example/api/auth/callback",
      response_type: "code",
      scope: "openid profile email",
      state: "0123456789abcdef0123456789abcdef",
      nonce: "fedcba9876543210fedcba9876543210",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
    });
    expect(valid.success).toBe(true);

    const plainPkce = oidcAuthorizationRequestSchema.safeParse({
      client_id: "bazionweb-bff",
      redirect_uri: "https://portal.bazion.example/api/auth/callback",
      response_type: "code",
      scope: "openid profile",
      state: "0123456789abcdef0123456789abcdef",
      nonce: "fedcba9876543210fedcba9876543210",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "plain",
    });
    expect(plainPkce.success).toBe(false);
  });

  it("rejects sandbox impersonation claims inside OIDC identity tokens", () => {
    const baseClaims = {
      iss: "https://auth.bazion.example",
      sub: "user_123",
      aud: "bazionweb-bff",
      exp: 1_900_000_600,
      iat: 1_900_000_000,
      auth_time: 1_900_000_000,
      jti: "jti-1",
      email: "owner@example.test",
      email_verified: true,
      name: "Owner",
      platform_role: null,
      tenant_id: null,
      tenant_slug: null,
      org_roles: ["owner"],
    };

    expect(oidcIdentityClaimsSchema.safeParse(baseClaims).success).toBe(true);
    expect(oidcIdentityClaimsSchema.safeParse({ ...baseClaims, is_sandbox: true }).success).toBe(false);
  });

  it("validates PKCE verifier length/charset, order claim proofs, collision resolution, and scoped deep links", () => {
    expect(oidcTokenExchangeRequestSchema.safeParse({
      grant_type: "authorization_code",
      code: "0123456789abcdef0123456789abcdef",
      redirect_uri: "https://portal.bazion.example/callback",
      client_id: "bazionweb-bff",
      code_verifier: "too-short",
    }).success).toBe(false);

    expect(issueOrderClaimProofInputSchema.safeParse({
      externalOrderId: "ORD-101",
      externalCustomerId: "CUS-202",
      tenantId: "00000000-0000-4000-8000-000000000001",
    }).success).toBe(true);

    expect(consumeOrderClaimProofInputSchema.safeParse({ proofToken: "short" }).success).toBe(false);

    expect(resolveIdentityCollisionInputSchema.safeParse({
      action: "resolve_link",
      note: "Verified user ticket #42",
    }).success).toBe(false);

    expect(scopedDeepLinkRequestSchema.safeParse({
      area: "commercial_invoices",
      tenantId: "00000000-0000-4000-8000-000000000001",
    }).success).toBe(true);
  });
});


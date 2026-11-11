import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";
import { generateHighEntropyToken, resolveOrLinkFederatedIdentity, sha256Hex, type SqlPool } from "./identity-lifecycle.js";
import { resolveSafeRedirectTarget } from "./bff-cookies.js";
import type { PlatformRole } from "./security-policy.js";

export class OidcSecurityError extends Error {
  constructor(
    public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 503,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "OidcSecurityError";
  }
}

export interface OidcSigningKeyPair {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
  publicJwk: Record<string, unknown>;
}

export interface OidcTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  auth_time: number;
  jti: string;
  nonce?: string;
  email: string;
  email_verified: boolean;
  name: string;
  platform_role: PlatformRole | null;
  tenant_id: string | null;
  tenant_slug: string | null;
  org_roles: string[];
  is_sandbox?: false;
}

export interface OidcClientRecord {
  clientId: string;
  clientName: string;
  clientType: "confidential_bff" | "public_pkce";
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  allowedScopes: string[];
  requirePkce: boolean;
  status: "active" | "disabled";
}

let cachedDevKeyPair: OidcSigningKeyPair | null = null;

function computePublicKeyKid(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64url").slice(0, 16);
}

/**
 * Load the configured RSA signing key for OIDC RS256 ID/access tokens.
 * Production startup fails closed when no explicit private key PEM is configured.
 */
export function loadOrGenerateOidcSigningKey(options: {
  privateKeyPem?: string | undefined;
  keyId?: string | undefined;
  nodeEnv?: string | undefined;
} = {}): OidcSigningKeyPair {
  const pem = options.privateKeyPem?.trim();
  if (pem) {
    const privateKey = createPrivateKey(pem.replace(/\\n/g, "\n"));
    const publicKey = createPublicKey(privateKey);
    const jwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    if (jwk.kty !== "RSA" || !jwk.n || !jwk.e) {
      throw new Error("OIDC_SIGNING_PRIVATE_KEY_PEM must be an RSA key.");
    }
    const kid = options.keyId?.trim() || computePublicKeyKid(publicKey);
    return {
      kid,
      privateKey,
      publicKey,
      publicJwk: { kty: "RSA", use: "sig", alg: "RS256", kid, n: jwk.n, e: jwk.e },
    };
  }

  if (options.nodeEnv === "production") {
    throw new Error("Production startup blocked: configure OIDC_SIGNING_PRIVATE_KEY_PEM for RS256 OIDC signing.");
  }

  if (!cachedDevKeyPair) {
    const generated = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = generated.publicKey.export({ format: "jwk" }) as Record<string, unknown>;
    const kid = options.keyId?.trim() || computePublicKeyKid(generated.publicKey);
    cachedDevKeyPair = {
      kid,
      privateKey: generated.privateKey,
      publicKey: generated.publicKey,
      publicJwk: { kty: "RSA", use: "sig", alg: "RS256", kid, n: jwk.n, e: jwk.e },
    };
  }
  return cachedDevKeyPair;
}

export function exportPublicJwks(keys: OidcSigningKeyPair | readonly OidcSigningKeyPair[]): {
  keys: Array<Record<string, unknown>>;
} {
  const list = Array.isArray(keys) ? keys : [keys];
  return {
    keys: list.map((item) => ({ ...item.publicJwk })),
  };
}

const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function computePkceS256Challenge(codeVerifier: string): string {
  if (!PKCE_VERIFIER_PATTERN.test(codeVerifier)) {
    throw new OidcSecurityError(400, "OIDC_INVALID_PKCE_VERIFIER", "PKCE code_verifier violates RFC 7636 constraints.");
  }
  return createHash("sha256").update(codeVerifier, "ascii").digest("base64url");
}

export function verifyPkceS256(codeVerifier: string, expectedChallenge: string): boolean {
  if (!PKCE_VERIFIER_PATTERN.test(codeVerifier) || !expectedChallenge) {
    return false;
  }
  const actual = Buffer.from(computePkceS256Challenge(codeVerifier), "utf8");
  const expected = Buffer.from(expectedChallenge, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Reject sandbox / View-As impersonation claims cleanly across OIDC minting,
 * token exchange, and BFF verification boundaries.
 */
export function assertNoSandboxImpersonation(claims: Record<string, unknown>): void {
  if (
    claims.is_sandbox === true
    || claims.isSandbox === true
    || claims.impersonating === true
    || Boolean(claims.impersonatedBy)
  ) {
    throw new OidcSecurityError(
      403,
      "SANDBOX_IMPERSONATION_FORBIDDEN",
      "Support sandbox or impersonation claims cannot mint or bridge production OIDC sessions.",
    );
  }
}

export function signOidcJwt(
  payload: Record<string, unknown>,
  signingKey: OidcSigningKeyPair,
): string {
  assertNoSandboxImpersonation(payload);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid: signingKey.kid }), "utf8").toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signingInput = `${header}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput, "utf8");
  signer.end();
  const signature = signer.sign(signingKey.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyOidcJwt<T extends Record<string, unknown>>(
  token: string,
  keys: OidcSigningKeyPair | readonly OidcSigningKeyPair[],
  options: {
    expectedIssuer: string;
    expectedAudience?: string;
    expectedNonce?: string;
    nowSeconds?: number;
    clockSkewSeconds?: number;
  },
): T {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new OidcSecurityError(401, "OIDC_TOKEN_MALFORMED", "JWT format is invalid.");
  }
  const [encodedHeader, encodedPayload, encodedSig] = parts;
  let header: Record<string, unknown>;
  let payload: T;
  try {
    header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as Record<string, unknown>;
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
  } catch {
    throw new OidcSecurityError(401, "OIDC_TOKEN_MALFORMED", "JWT header or payload could not be decoded.");
  }
  if (header.alg !== "RS256") {
    throw new OidcSecurityError(401, "OIDC_TOKEN_ALG_UNSUPPORTED", "Only RS256 JWTs are accepted.");
  }

  const keyList = Array.isArray(keys) ? keys : [keys];
  const matchedKey = header.kid ? keyList.find((k) => k.kid === header.kid) : keyList[0];
  if (!matchedKey) {
    throw new OidcSecurityError(401, "OIDC_SIGNING_KEY_UNKNOWN", "Unknown JWT signing key identifier.");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`, "utf8");
  verifier.end();
  if (!verifier.verify(matchedKey.publicKey, Buffer.from(encodedSig, "base64url"))) {
    throw new OidcSecurityError(401, "OIDC_TOKEN_SIGNATURE_INVALID", "JWT signature verification failed.");
  }

  assertNoSandboxImpersonation(payload);

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const skew = options.clockSkewSeconds ?? 30;
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);
  if (!Number.isFinite(exp) || exp + skew <= now) {
    throw new OidcSecurityError(401, "OIDC_TOKEN_EXPIRED", "JWT has expired.");
  }
  if (!Number.isFinite(iat) || iat - skew > now) {
    throw new OidcSecurityError(401, "OIDC_TOKEN_NOT_YET_VALID", "JWT issued-at claim is in the future.");
  }
  if (payload.iss !== options.expectedIssuer) {
    throw new OidcSecurityError(401, "OIDC_TOKEN_ISSUER_MISMATCH", "JWT issuer mismatch.");
  }
  if (options.expectedAudience) {
    const aud = payload.aud;
    const validAud = Array.isArray(aud) ? aud.includes(options.expectedAudience) : aud === options.expectedAudience;
    if (!validAud) {
      throw new OidcSecurityError(401, "OIDC_TOKEN_AUDIENCE_MISMATCH", "JWT audience mismatch.");
    }
  }
  if (options.expectedNonce !== undefined) {
    const actualNonce = typeof payload.nonce === "string" ? Buffer.from(payload.nonce, "utf8") : Buffer.alloc(0);
    const expectedNonce = Buffer.from(options.expectedNonce, "utf8");
    if (actualNonce.length === 0 || actualNonce.length !== expectedNonce.length || !timingSafeEqual(actualNonce, expectedNonce)) {
      throw new OidcSecurityError(401, "OIDC_NONCE_MISMATCH", "ID token nonce verification failed.");
    }
  }

  return payload;
}

function deriveVaultKey(secretMaterial: string): Buffer {
  if (!secretMaterial || secretMaterial.length < 32) {
    throw new Error("Vault encryption requires at least 32 characters of secret material.");
  }
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secretMaterial, "utf8"), Buffer.from("bazion:oidc-bff:v1", "utf8"), Buffer.from("aes-256-gcm", "utf8"), 32),
  );
}

export function encryptVaultSecret(plaintext: string, secretMaterial: string): string {
  const key = deriveVaultKey(secretMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptVaultSecret(encoded: string, secretMaterial: string): string {
  const parts = encoded.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new OidcSecurityError(401, "BFF_VAULT_CORRUPT", "Encrypted BFF token payload format is invalid.");
  }
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  if (
    iv.byteLength !== 12
    || tag.byteLength !== 16
    || iv.toString("base64url") !== ivB64
    || tag.toString("base64url") !== tagB64
    || ciphertext.toString("base64url") !== ctB64
  ) {
    throw new OidcSecurityError(401, "BFF_VAULT_CORRUPT", "Encrypted BFF token encoding is non-canonical.");
  }
  const key = deriveVaultKey(secretMaterial);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function constantTimeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length > 0 && bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export interface OidcAuthorityOptions {
  issuer: string;
  identityPool: SqlPool;
  authPool: SqlPool;
  signingKey: OidcSigningKeyPair;
  vaultSecret: string;
  trustedRedirectOrigins?: readonly string[];
}

export function createOidcAuthority(options: OidcAuthorityOptions) {
  const issuer = options.issuer.replace(/\/+$/, "");

  async function resolveUserClaims(userId: string, tenantIdHint?: string | null) {
    const userRes = await options.authPool.query(
      `SELECT id, email, "emailVerified" AS email_verified, name FROM "user" WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const user = userRes.rows[0];
    if (!user) {
      throw new OidcSecurityError(404, "OIDC_USER_NOT_FOUND", "Authenticated user account was not found.");
    }

    const platformRes = await options.identityPool.query(
      `SELECT role, status FROM public.platform_members WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const platformMember = platformRes.rows[0];
    if (platformMember && platformMember.status !== "active") {
      throw new OidcSecurityError(403, "OIDC_PLATFORM_MEMBER_SUSPENDED", "Platform account access has been suspended.");
    }
    const platformRole = (platformMember?.role as PlatformRole | undefined) ?? null;

    let resolvedTenantId: string | null = null;
    let resolvedTenantSlug: string | null = null;
    let orgRoles: string[] = [];

    if (tenantIdHint) {
      const tenantRes = await options.identityPool.query(
        `SELECT id, slug, auth_organization_id, status FROM public.tenants WHERE id = $1::uuid LIMIT 1`,
        [tenantIdHint],
      );
      const tenant = tenantRes.rows[0];
      if (tenant?.auth_organization_id && tenant.status === "active") {
        const memRes = await options.authPool.query(
          `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2 LIMIT 1`,
          [tenant.auth_organization_id, userId],
        );
        if (memRes.rows[0]) {
          resolvedTenantId = String(tenant.id);
          resolvedTenantSlug = String(tenant.slug);
          orgRoles = String(memRes.rows[0].role).split(",").map((r) => r.trim()).filter(Boolean);
        }
      }
    }

    const federated = await resolveOrLinkFederatedIdentity({
      identityPool: options.identityPool,
      authPool: options.authPool,
      issuer,
      subject: String(user.id),
      email: String(user.email),
      emailVerified: Boolean(user.email_verified),
      explicitUserId: String(user.id),
      linkedVia: "oidc_login",
    });

    return {
      userId: String(user.id),
      subject: federated.subject,
      email: String(user.email),
      emailVerified: Boolean(user.email_verified),
      name: String(user.name ?? ""),
      platformRole,
      tenantId: resolvedTenantId,
      tenantSlug: resolvedTenantSlug,
      orgRoles,
    };
  }

  return {
    issuer,

    getDiscoveryDocument() {
      return {
        issuer,
        authorization_endpoint: `${issuer}/v1/oidc/authorize`,
        token_endpoint: `${issuer}/v1/oidc/token`,
        userinfo_endpoint: `${issuer}/v1/oidc/userinfo`,
        jwks_uri: `${issuer}/v1/oidc/jwks`,
        end_session_endpoint: `${issuer}/v1/bff/logout`,
        response_types_supported: ["code"] as const,
        grant_types_supported: ["authorization_code"] as const,
        subject_types_supported: ["public"] as const,
        id_token_signing_alg_values_supported: ["RS256"] as const,
        code_challenge_methods_supported: ["S256"] as const,
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"] as const,
        scopes_supported: ["openid", "profile", "email", "tenant:admin", "platform:control", "commercial:billing:read"],
        claims_supported: ["sub", "iss", "aud", "exp", "iat", "nonce", "email", "email_verified", "name", "platform_role", "tenant_id", "tenant_slug", "org_roles"],
      };
    },

    getJwks() {
      return exportPublicJwks(options.signingKey);
    },

    async upsertClient(input: {
      clientId: string;
      clientName: string;
      clientType: "confidential_bff" | "public_pkce";
      clientSecret?: string | null;
      redirectUris: string[];
      postLogoutRedirectUris?: string[];
      allowedScopes?: string[];
    }): Promise<void> {
      const secretHash = input.clientType === "confidential_bff" && input.clientSecret
        ? sha256Hex(input.clientSecret)
        : null;
      await options.identityPool.query(
        `INSERT INTO public.oidc_clients
           (client_id, client_name, client_type, client_secret_hash, redirect_uris, post_logout_redirect_uris, allowed_scopes, require_pkce, status)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, true, 'active')
         ON CONFLICT (client_id) DO UPDATE
           SET client_name = EXCLUDED.client_name,
               client_type = EXCLUDED.client_type,
               client_secret_hash = COALESCE(EXCLUDED.client_secret_hash, public.oidc_clients.client_secret_hash),
               redirect_uris = EXCLUDED.redirect_uris,
               post_logout_redirect_uris = EXCLUDED.post_logout_redirect_uris,
               allowed_scopes = EXCLUDED.allowed_scopes,
               updated_at = now()`,
        [
          input.clientId,
          input.clientName,
          input.clientType,
          secretHash,
          JSON.stringify(input.redirectUris),
          JSON.stringify(input.postLogoutRedirectUris ?? []),
          JSON.stringify(input.allowedScopes ?? ["openid", "profile", "email"]),
        ],
      );
    },

    async authorize(input: {
      clientId: string;
      redirectUri: string;
      responseType: string;
      scope: string;
      state: string;
      nonce: string;
      codeChallenge: string;
      codeChallengeMethod: string;
      userId: string;
      tenantId?: string | null;
      isSandboxSession?: boolean;
    }): Promise<{ code: string; state: string; redirectTo: string }> {
      if (input.isSandboxSession) {
        throw new OidcSecurityError(403, "SANDBOX_IMPERSONATION_FORBIDDEN", "Sandbox sessions cannot authorize OIDC clients.");
      }
      if (input.responseType !== "code") {
        throw new OidcSecurityError(400, "OIDC_UNSUPPORTED_RESPONSE_TYPE", "Only response_type=code is supported.");
      }
      if (input.codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(input.codeChallenge)) {
        throw new OidcSecurityError(400, "OIDC_PKCE_S256_REQUIRED", "PKCE with code_challenge_method=S256 is required.");
      }
      if (!input.state || input.state.length < 16 || !input.nonce || input.nonce.length < 16) {
        throw new OidcSecurityError(400, "OIDC_STATE_NONCE_REQUIRED", "High-entropy state and nonce are required.");
      }

      const clientRes = await options.identityPool.query(
        `SELECT * FROM public.oidc_clients WHERE client_id = $1 AND status = 'active' LIMIT 1`,
        [input.clientId],
      );
      const client = clientRes.rows[0];
      if (!client) {
        throw new OidcSecurityError(400, "OIDC_UNKNOWN_CLIENT", "Unknown or disabled OIDC client.");
      }

      const redirectUris = Array.isArray(client.redirect_uris) ? (client.redirect_uris as string[]) : [];
      if (!redirectUris.includes(input.redirectUri)) {
        throw new OidcSecurityError(400, "OIDC_REDIRECT_URI_MISMATCH", "redirect_uri is not registered for this client.");
      }

      const allowedScopes = new Set(Array.isArray(client.allowed_scopes) ? (client.allowed_scopes as string[]) : ["openid"]);
      const requestedScopes = input.scope.split(/\s+/).map((s) => s.trim()).filter(Boolean);
      if (!requestedScopes.includes("openid") || requestedScopes.some((s) => !allowedScopes.has(s))) {
        throw new OidcSecurityError(400, "OIDC_INVALID_SCOPE", "Requested scope is invalid or not allowed for this client.");
      }

      const code = generateHighEntropyToken(32);
      const codeHash = sha256Hex(code);
      const stateHash = sha256Hex(input.state);
      const expiresAt = new Date(Date.now() + 300_000).toISOString();

      await options.identityPool.query(
        `INSERT INTO public.oidc_authorization_codes
           (code_hash, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, nonce, state_hash, tenant_id, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'S256', $7, $8, $9::uuid, $10::timestamptz)`,
        [
          codeHash,
          input.clientId,
          input.userId,
          input.redirectUri,
          requestedScopes.join(" "),
          input.codeChallenge,
          input.nonce,
          stateHash,
          input.tenantId ?? null,
          expiresAt,
        ],
      );

      const redirectTarget = new URL(input.redirectUri);
      redirectTarget.searchParams.set("code", code);
      redirectTarget.searchParams.set("state", input.state);
      return { code, state: input.state, redirectTo: redirectTarget.toString() };
    },

    async exchangeToken(input: {
      grantType: string;
      code: string;
      redirectUri: string;
      clientId: string;
      clientSecret?: string;
      codeVerifier: string;
    }) {
      if (input.grantType !== "authorization_code") {
        throw new OidcSecurityError(400, "OIDC_UNSUPPORTED_GRANT_TYPE", "Only authorization_code grant is supported.");
      }

      const clientRes = await options.identityPool.query(
        `SELECT * FROM public.oidc_clients WHERE client_id = $1 AND status = 'active' LIMIT 1`,
        [input.clientId],
      );
      const client = clientRes.rows[0];
      if (!client) {
        throw new OidcSecurityError(401, "OIDC_INVALID_CLIENT", "Unknown or disabled client.");
      }
      if (client.client_type === "confidential_bff") {
        const expectedHash = typeof client.client_secret_hash === "string" ? client.client_secret_hash : "";
        const actualHash = input.clientSecret ? sha256Hex(input.clientSecret) : "";
        if (!expectedHash || !actualHash || !constantTimeHexEqual(actualHash, expectedHash)) {
          throw new OidcSecurityError(401, "OIDC_CLIENT_AUTH_FAILED", "Confidential OIDC client authentication failed.");
        }
      }

      const codeHash = sha256Hex(input.code.trim());
      const consumedRes = await options.identityPool.query(
        `UPDATE public.oidc_authorization_codes
            SET consumed_at = now()
          WHERE code_hash = $1
            AND client_id = $2
            AND consumed_at IS NULL
            AND expires_at > now()
        RETURNING *`,
        [codeHash, input.clientId],
      );
      const codeRow = consumedRes.rows[0];
      if (!codeRow) {
        throw new OidcSecurityError(400, "OIDC_INVALID_GRANT", "Authorization code is invalid, expired, or already used.");
      }
      if (String(codeRow.redirect_uri) !== input.redirectUri) {
        throw new OidcSecurityError(400, "OIDC_REDIRECT_URI_MISMATCH", "redirect_uri does not match authorization request.");
      }
      if (!verifyPkceS256(input.codeVerifier, String(codeRow.code_challenge))) {
        throw new OidcSecurityError(400, "OIDC_PKCE_VERIFICATION_FAILED", "PKCE code_verifier verification failed.");
      }

      const claimsUser = await resolveUserClaims(
        String(codeRow.user_id),
        codeRow.tenant_id ? String(codeRow.tenant_id) : null,
      );

      const nowSeconds = Math.floor(Date.now() / 1000);
      const idJti = randomUUID();
      const accessJti = randomUUID();
      const authTimeSeconds = Math.floor(new Date(String(codeRow.auth_time)).getTime() / 1000);

      const idTokenPayload: OidcTokenClaims = {
        iss: issuer,
        sub: claimsUser.subject,
        aud: input.clientId,
        exp: nowSeconds + 900,
        iat: nowSeconds,
        auth_time: authTimeSeconds,
        jti: idJti,
        nonce: String(codeRow.nonce),
        email: claimsUser.email,
        email_verified: claimsUser.emailVerified,
        name: claimsUser.name,
        platform_role: claimsUser.platformRole,
        tenant_id: claimsUser.tenantId,
        tenant_slug: claimsUser.tenantSlug,
        org_roles: claimsUser.orgRoles,
        is_sandbox: false,
      };

      const accessTokenPayload = {
        iss: issuer,
        sub: claimsUser.subject,
        aud: `${issuer}/userinfo`,
        scope: String(codeRow.scope),
        exp: nowSeconds + 900,
        iat: nowSeconds,
        jti: accessJti,
        platform_role: claimsUser.platformRole,
        tenant_id: claimsUser.tenantId,
        org_roles: claimsUser.orgRoles,
        is_sandbox: false,
      };

      const idToken = signOidcJwt(idTokenPayload as unknown as Record<string, unknown>, options.signingKey);
      const accessToken = signOidcJwt(accessTokenPayload, options.signingKey);

      return {
        token_type: "Bearer" as const,
        expires_in: 900,
        scope: String(codeRow.scope),
        id_token: idToken,
        access_token: accessToken,
        idTokenJti: idJti,
        claims: idTokenPayload,
      };
    },

    async getUserinfo(bearerToken: string) {
      const payload = verifyOidcJwt<Record<string, unknown>>(bearerToken, options.signingKey, {
        expectedIssuer: issuer,
        expectedAudience: `${issuer}/userinfo`,
      });
      const sub = String(payload.sub ?? "");
      const claimsUser = await resolveUserClaims(sub, payload.tenant_id ? String(payload.tenant_id) : null);
      return {
        sub: claimsUser.subject,
        email: claimsUser.email,
        email_verified: claimsUser.emailVerified,
        name: claimsUser.name,
        platform_role: claimsUser.platformRole,
        tenant_id: claimsUser.tenantId,
        tenant_slug: claimsUser.tenantSlug,
        org_roles: claimsUser.orgRoles,
      };
    },

    async beginBffTransaction(input: {
      clientId: string;
      returnTo?: string;
    }) {
      const safeReturnTo = resolveSafeRedirectTarget(input.returnTo, {
        allowedOrigins: options.trustedRedirectOrigins ?? [],
        fallback: "/workspace",
      });
      const txToken = generateHighEntropyToken(32);
      const state = generateHighEntropyToken(24);
      const nonce = generateHighEntropyToken(24);
      const codeVerifier = generateHighEntropyToken(48);
      const codeChallenge = computePkceS256Challenge(codeVerifier);
      const verifierCiphertext = encryptVaultSecret(codeVerifier, options.vaultSecret);
      const expiresAt = new Date(Date.now() + 600_000).toISOString();

      await options.identityPool.query(
        `INSERT INTO public.oidc_bff_auth_transactions
           (tx_hash, client_id, state_hash, nonce, code_verifier_ciphertext, return_to, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
        [sha256Hex(txToken), input.clientId, sha256Hex(state), nonce, verifierCiphertext, safeReturnTo, expiresAt],
      );

      return {
        txToken,
        state,
        nonce,
        codeChallenge,
        codeChallengeMethod: "S256" as const,
        returnTo: safeReturnTo,
        expiresAt,
      };
    },

    async completeBffCallback(input: {
      txToken: string;
      code: string;
      state: string;
      clientId: string;
      clientSecret?: string;
      redirectUri: string;
      sessionTtlSeconds?: number;
    }) {
      const txRes = await options.identityPool.query(
        `UPDATE public.oidc_bff_auth_transactions
            SET consumed_at = now()
          WHERE tx_hash = $1
            AND client_id = $2
            AND consumed_at IS NULL
            AND expires_at > now()
        RETURNING *`,
        [sha256Hex(input.txToken), input.clientId],
      );
      const tx = txRes.rows[0];
      if (!tx) {
        throw new OidcSecurityError(400, "BFF_TX_INVALID", "OIDC login transaction is invalid, expired, or already used.");
      }

      const incomingStateHash = sha256Hex(input.state);
      if (!constantTimeHexEqual(incomingStateHash, String(tx.state_hash))) {
        throw new OidcSecurityError(400, "OIDC_STATE_MISMATCH", "OIDC state parameter does not match the active browser transaction.");
      }

      const codeVerifier = decryptVaultSecret(String(tx.code_verifier_ciphertext), options.vaultSecret);
      const tokens = await this.exchangeToken({
        grantType: "authorization_code",
        code: input.code,
        redirectUri: input.redirectUri,
        clientId: input.clientId,
        ...(input.clientSecret !== undefined ? { clientSecret: input.clientSecret } : {}),
        codeVerifier,
      });

      const verifiedId = verifyOidcJwt<OidcTokenClaims & Record<string, unknown>>(
        tokens.id_token,
        options.signingKey,
        {
          expectedIssuer: issuer,
          expectedAudience: input.clientId,
          expectedNonce: String(tx.nonce),
        },
      );

      const sessionToken = generateHighEntropyToken(32);
      const ttl = Math.min(Math.max(input.sessionTtlSeconds ?? 43_200, 300), 86_400);
      const sessionExpiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      const accessExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      await options.identityPool.query(
        `INSERT INTO public.oidc_bff_sessions
           (session_hash, user_id, issuer, subject, client_id, tenant_id, scope, id_token_jti, access_token_ciphertext, access_token_expires_at, session_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10::timestamptz, $11::timestamptz)`,
        [
          sha256Hex(sessionToken),
          verifiedId.sub,
          issuer,
          verifiedId.sub,
          input.clientId,
          verifiedId.tenant_id ?? null,
          tokens.scope,
          verifiedId.jti,
          encryptVaultSecret(tokens.access_token, options.vaultSecret),
          accessExpiresAt,
          sessionExpiresAt,
        ],
      );

      return {
        sessionToken,
        expiresAt: sessionExpiresAt,
        returnTo: resolveSafeRedirectTarget(String(tx.return_to), {
          allowedOrigins: options.trustedRedirectOrigins ?? [],
          fallback: "/workspace",
        }),
        user: {
          sub: verifiedId.sub,
          email: verifiedId.email,
          emailVerified: verifiedId.email_verified,
          name: verifiedId.name,
          platformRole: verifiedId.platform_role,
          tenantId: verifiedId.tenant_id,
          tenantSlug: verifiedId.tenant_slug,
          orgRoles: verifiedId.org_roles,
        },
      };
    },

    async getBffSession(sessionToken: string) {
      if (!sessionToken || sessionToken.length < 24) return null;
      const result = await options.identityPool.query(
        `UPDATE public.oidc_bff_sessions
            SET last_seen_at = now()
          WHERE session_hash = $1
            AND revoked_at IS NULL
            AND session_expires_at > now()
        RETURNING id, user_id, issuer, subject, client_id, tenant_id, scope, session_expires_at`,
        [sha256Hex(sessionToken)],
      );
      const row = result.rows[0];
      if (!row) return null;

      const userRes = await options.authPool.query(
        `SELECT id, email, "emailVerified" AS email_verified, name FROM "user" WHERE id = $1 LIMIT 1`,
        [row.user_id],
      );
      const user = userRes.rows[0];
      if (!user) return null;

      const platformRes = await options.identityPool.query(
        `SELECT role, status FROM public.platform_members WHERE user_id = $1 LIMIT 1`,
        [row.user_id],
      );
      const platformMember = platformRes.rows[0];
      if (platformMember && platformMember.status !== "active") return null;

      return {
        sessionId: String(row.id),
        userId: String(row.user_id),
        issuer: String(row.issuer),
        subject: String(row.subject),
        clientId: String(row.client_id),
        tenantId: row.tenant_id ? String(row.tenant_id) : null,
        scope: String(row.scope),
        expiresAt: new Date(String(row.session_expires_at)).toISOString(),
        user: {
          email: String(user.email),
          emailVerified: Boolean(user.email_verified),
          name: String(user.name ?? ""),
          platformRole: (platformMember?.role as PlatformRole | undefined) ?? null,
        },
      };
    },

    async revokeBffSession(sessionToken: string): Promise<boolean> {
      if (!sessionToken || sessionToken.length < 24) return false;
      const result = await options.identityPool.query(
        `UPDATE public.oidc_bff_sessions SET revoked_at = now() WHERE session_hash = $1 AND revoked_at IS NULL`,
        [sha256Hex(sessionToken)],
      );
      return result.rowCount === 1;
    },
  };
}

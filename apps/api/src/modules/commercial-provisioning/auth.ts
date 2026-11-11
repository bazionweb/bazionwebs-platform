import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const DEFAULT_COMMAND_ISSUER = "bazionweb";
export const DEFAULT_COMMAND_AUDIENCE = "bazion-platform:commercial-provisioning";
export const DEFAULT_CALLBACK_ISSUER = "bazion-platform";
export const DEFAULT_CALLBACK_AUDIENCE = "bazionweb:provisioning-status";
export const DEFAULT_MAX_TOKEN_TTL_SECONDS = 600;
export const DEFAULT_CLOCK_SKEW_SECONDS = 30;

export class CommercialMachineAuthError extends Error {
  constructor(
    public readonly statusCode: 401 | 403,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommercialMachineAuthError";
  }
}

export interface MachineTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  scope: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface VerifyMachineBearerOptions {
  secret: string;
  expectedIssuer?: string;
  expectedAudience?: string;
  requiredScopes: readonly string[];
  maxTtlSeconds?: number;
  clockSkewSeconds?: number;
  nowSeconds?: number;
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecodeToString(segment: string): string {
  return Buffer.from(segment, "base64url").toString("utf8");
}

function parseBearerToken(headers: Record<string, unknown>): string {
  const raw = headers.authorization ?? headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (typeof header !== "string") {
    throw new CommercialMachineAuthError(401, "MACHINE_AUTH_REQUIRED", "Machine authorization bearer token is required.");
  }
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1]) {
    throw new CommercialMachineAuthError(401, "MACHINE_AUTH_MALFORMED", "Authorization header must carry a Bearer token.");
  }
  return match[1];
}

function parseScopes(scopeClaim: unknown): Set<string> {
  if (typeof scopeClaim === "string") {
    return new Set(scopeClaim.split(/\s+/).map((item) => item.trim()).filter(Boolean));
  }
  if (Array.isArray(scopeClaim) && scopeClaim.every((item) => typeof item === "string")) {
    return new Set(scopeClaim.map((item) => item.trim()).filter(Boolean));
  }
  return new Set();
}

/** Verify a short-lived audience-scoped HMAC-SHA256 machine JWT and narrow scopes. */
export function verifyMachineBearerToken(
  headers: Record<string, unknown>,
  options: VerifyMachineBearerOptions,
): MachineTokenClaims {
  if (!options.secret || options.secret.length < 32) {
    throw new CommercialMachineAuthError(401, "MACHINE_AUTH_UNCONFIGURED", "Machine credential verifier is not configured.");
  }

  const token = parseBearerToken(headers);
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_INVALID", "Malformed machine token.");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_INVALID", "Malformed machine token.");
  }

  let parsedHeader: Record<string, unknown>;
  let parsedPayload: Record<string, unknown>;
  try {
    parsedHeader = JSON.parse(base64UrlDecodeToString(encodedHeader)) as Record<string, unknown>;
    parsedPayload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as Record<string, unknown>;
  } catch {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_INVALID", "Malformed machine token encoding.");
  }

  if (parsedHeader.alg !== "HS256" || (parsedHeader.typ !== undefined && parsedHeader.typ !== "JWT")) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_UNSUPPORTED_ALG", "Unsupported machine token algorithm.");
  }

  const expectedSignature = createHmac("sha256", options.secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_INVALID", "Malformed machine signature.");
  }

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_SIGNATURE_INVALID", "Invalid machine token signature.");
  }

  const expectedIssuer = options.expectedIssuer ?? DEFAULT_COMMAND_ISSUER;
  const expectedAudience = options.expectedAudience ?? DEFAULT_COMMAND_AUDIENCE;
  const maxTtlSeconds = options.maxTtlSeconds ?? DEFAULT_MAX_TOKEN_TTL_SECONDS;
  const clockSkewSeconds = options.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (parsedPayload.iss !== expectedIssuer) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_ISSUER_INVALID", "Invalid machine token issuer.");
  }
  const audienceMatches = Array.isArray(parsedPayload.aud)
    ? parsedPayload.aud.includes(expectedAudience)
    : parsedPayload.aud === expectedAudience;
  if (!audienceMatches) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_AUDIENCE_INVALID", "Invalid machine token audience.");
  }

  const sub = typeof parsedPayload.sub === "string" ? parsedPayload.sub.trim() : "";
  const jti = typeof parsedPayload.jti === "string" ? parsedPayload.jti.trim() : "";
  if (!sub || !jti || jti.length > 128) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_CLAIMS_INVALID", "Machine token must identify subject and jti.");
  }

  const iat = parsedPayload.iat;
  const exp = parsedPayload.exp;
  if (typeof iat !== "number" || typeof exp !== "number" || !Number.isFinite(iat) || !Number.isFinite(exp)) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_CLAIMS_INVALID", "Machine token must specify iat and exp.");
  }
  if (exp - iat <= 0 || exp - iat > maxTtlSeconds) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_TTL_EXCEEDED", "Machine token lifetime exceeds permitted bound.");
  }
  if (iat > nowSeconds + clockSkewSeconds) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_NOT_YET_VALID", "Machine token issued-at time is in the future.");
  }
  if (exp <= nowSeconds - clockSkewSeconds) {
    throw new CommercialMachineAuthError(401, "MACHINE_TOKEN_EXPIRED", "Machine token has expired.");
  }

  const grantedScopes = parseScopes(parsedPayload.scope);
  for (const required of options.requiredScopes) {
    if (!grantedScopes.has(required)) {
      throw new CommercialMachineAuthError(403, "MACHINE_SCOPE_INSUFFICIENT", "Machine token lacks required scope.");
    }
  }

  return {
    iss: expectedIssuer,
    sub,
    aud: expectedAudience,
    scope: Array.from(grantedScopes).join(" "),
    iat,
    exp,
    jti,
  };
}

/** Mint a short-lived audience-scoped HS256 machine JWT for internal service calls. */
export function signMachineBearerToken(
  input: {
    subject: string;
    issuer?: string;
    audience?: string;
    scopes: readonly string[];
    ttlSeconds?: number;
    nowSeconds?: number;
    jti?: string;
  },
  secret: string,
): string {
  if (!secret || secret.length < 32) {
    throw new Error("MACHINE_SIGNING_SECRET_TOO_SHORT");
  }
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.min(Math.max(input.ttlSeconds ?? 120, 10), DEFAULT_MAX_TOKEN_TTL_SECONDS);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: input.issuer ?? DEFAULT_CALLBACK_ISSUER,
    sub: input.subject,
    aud: input.audience ?? DEFAULT_CALLBACK_AUDIENCE,
    scope: input.scopes.join(" "),
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
    jti: input.jti ?? randomUUID(),
  }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Format timestamped HMAC-SHA256 webhook signature header `t=<unixSec>,v1=<hex>`. */
export function createWebhookSignatureHeader(
  rawBody: string | Buffer,
  secret: string,
  timestampSeconds = Math.floor(Date.now() / 1000),
): string {
  if (!secret || secret.length < 32) {
    throw new Error("WEBHOOK_SIGNING_SECRET_TOO_SHORT");
  }
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const signedInput = Buffer.concat([Buffer.from(`${timestampSeconds}.`, "utf8"), bodyBuffer]);
  const digest = createHmac("sha256", secret).update(signedInput).digest("hex");
  return `t=${timestampSeconds},v1=${digest}`;
}

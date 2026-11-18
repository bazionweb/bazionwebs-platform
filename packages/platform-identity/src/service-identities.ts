import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type ServiceIdentityStatus = "active" | "revoked" | "expired";

export interface ServiceIdentityRecord {
  id: string;
  tenantId: string | null;
  name: string;
  keyPrefix: string;
  secretHash: string;
  scopes: string[];
  status: ServiceIdentityStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string;
  revokedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateServiceIdentityInput {
  tenantId: string | null;
  name: string;
  scopes: string[];
  expiresAt?: string | null;
  createdBy: string;
}

export interface ServiceIdentityPort {
  create(input: CreateServiceIdentityInput & { keyPrefix: string; secretHash: string }): Promise<ServiceIdentityRecord>;
  list(filters?: { tenantId?: string | null; includeRevoked?: boolean }): Promise<ServiceIdentityRecord[]>;
  findBySecretHash(secretHash: string): Promise<ServiceIdentityRecord | null>;
  revoke(id: string, revokedBy: string): Promise<ServiceIdentityRecord | null>;
}

const VALID_SCOPE = /^[a-z][a-z0-9_.-]*:[a-z][a-z0-9_.*-]*$/;

export function normalizeServiceIdentityScopes(scopes: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const raw of scopes) {
    const scope = raw.trim();
    if (!scope || !VALID_SCOPE.test(scope)) {
      throw new Error(`Invalid service identity scope: ${raw}`);
    }
    unique.add(scope);
  }
  if (unique.size === 0) {
    throw new Error("At least one service identity scope is required.");
  }
  return [...unique].sort();
}

export function hashServiceIdentitySecret(secret: string): string {
  return createHash("sha256").update(secret.trim()).digest("hex");
}

export function generateServiceIdentityToken(): {
  plaintextToken: string;
  keyPrefix: string;
  secretHash: string;
} {
  const prefixId = randomBytes(4).toString("hex");
  const secretPart = randomBytes(24).toString("base64url");
  const keyPrefix = `bzn_sk_${prefixId}`;
  const plaintextToken = `${keyPrefix}_${secretPart}`;
  return {
    plaintextToken,
    keyPrefix,
    secretHash: hashServiceIdentitySecret(plaintextToken),
  };
}

export function parseBearerServiceToken(authorizationHeader: string | undefined | null): string | null {
  if (typeof authorizationHeader !== "string") return null;
  const trimmed = authorizationHeader.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  if (!token.startsWith("bzn_sk_") || token.length < 24 || token.length > 200) return null;
  return token;
}

export function verifyServiceIdentitySecretHash(candidateToken: string, storedHashHex: string): boolean {
  const computed = Buffer.from(hashServiceIdentitySecret(candidateToken), "hex");
  const stored = Buffer.from(storedHashHex, "hex");
  if (computed.byteLength !== stored.byteLength) return false;
  return timingSafeEqual(computed, stored);
}

export function evaluateServiceIdentityAccess(
  identity: ServiceIdentityRecord,
  requiredScope: string,
  options: { tenantId?: string | null; now?: Date } = {},
): { allowed: true } | { allowed: false; reason: "REVOKED" | "EXPIRED" | "TENANT_MISMATCH" | "INSUFFICIENT_SCOPE" } {
  if (identity.status === "revoked" || identity.revokedAt !== null) {
    return { allowed: false, reason: "REVOKED" };
  }
  const now = options.now ?? new Date();
  if (identity.status === "expired" || (identity.expiresAt && new Date(identity.expiresAt).getTime() <= now.getTime())) {
    return { allowed: false, reason: "EXPIRED" };
  }
  if (identity.tenantId !== null && options.tenantId !== undefined && identity.tenantId !== options.tenantId) {
    return { allowed: false, reason: "TENANT_MISMATCH" };
  }
  if (requiredScope && !identity.scopes.includes(requiredScope) && !identity.scopes.includes("*:*")) {
    const [resource] = requiredScope.split(":");
    if (!resource || !identity.scopes.includes(`${resource}:*`)) {
      return { allowed: false, reason: "INSUFFICIENT_SCOPE" };
    }
  }
  return { allowed: true };
}

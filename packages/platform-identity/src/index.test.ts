import { describe, expect, it } from "vitest";
import {
  evaluateServiceIdentityAccess,
  generateServiceIdentityToken,
  hashServiceIdentitySecret,
  normalizeServiceIdentityScopes,
  parseBearerServiceToken,
  reconcileTenantProvisioning,
  verifyServiceIdentitySecretHash,
  type ServiceIdentityRecord,
  type TenantProvisioningReconciliationPort,
} from "./index.js";

describe("service identities domain", () => {
  it("generates prefixed secrets and verifies their SHA-256 hashes in constant time", () => {
    const { plaintextToken, keyPrefix, secretHash } = generateServiceIdentityToken();
    expect(plaintextToken.startsWith(`${keyPrefix}_`)).toBe(true);
    expect(secretHash).toBe(hashServiceIdentitySecret(plaintextToken));
    expect(verifyServiceIdentitySecretHash(plaintextToken, secretHash)).toBe(true);
    expect(verifyServiceIdentitySecretHash(`${plaintextToken}x`, secretHash)).toBe(false);
    expect(parseBearerServiceToken(`Bearer ${plaintextToken}`)).toBe(plaintextToken);
    expect(parseBearerServiceToken("Bearer short")).toBeNull();
  });

  it("normalizes scopes and enforces revocation, expiry, tenant binding, and scopes", () => {
    const scopes = normalizeServiceIdentityScopes(["audit:read", "analytics:read", "audit:read"]);
    expect(scopes).toEqual(["analytics:read", "audit:read"]);

    const base: ServiceIdentityRecord = {
      id: "si-1",
      tenantId: "tenant-1",
      name: "Reporting Sync",
      keyPrefix: "bzn_sk_abcd1234",
      secretHash: "a".repeat(64),
      scopes,
      status: "active",
      expiresAt: "2030-01-01T00:00:00.000Z",
      lastUsedAt: null,
      createdBy: "user-1",
      revokedBy: null,
      revokedAt: null,
      createdAt: "2026-11-01T00:00:00.000Z",
    };

    expect(evaluateServiceIdentityAccess(base, "audit:read", { tenantId: "tenant-1" })).toEqual({ allowed: true });
    expect(evaluateServiceIdentityAccess(base, "product:delete", { tenantId: "tenant-1" })).toEqual({ allowed: false, reason: "INSUFFICIENT_SCOPE" });
    expect(evaluateServiceIdentityAccess(base, "audit:read", { tenantId: "tenant-2" })).toEqual({ allowed: false, reason: "TENANT_MISMATCH" });
    expect(evaluateServiceIdentityAccess({ ...base, status: "revoked" }, "audit:read")).toEqual({ allowed: false, reason: "REVOKED" });
    expect(evaluateServiceIdentityAccess({ ...base, expiresAt: "2020-01-01T00:00:00.000Z" }, "audit:read", {
      now: new Date("2026-11-01T00:00:00.000Z"),
    })).toEqual({ allowed: false, reason: "EXPIRED" });
  });
});

describe("reconcileTenantProvisioning", () => {
  it("activates stale matched reservations without overwriting mismatched mappings", async () => {
    const activatedIds: string[] = [];
    const port: TenantProvisioningReconciliationPort = {
      async findStaleProvisioningTenants() {
        return [
          { id: "t1", slug: "alpha", authOrganizationId: null },
          { id: "t2", slug: "beta", authOrganizationId: "wrong-org" },
          { id: "t3", slug: "gamma", authOrganizationId: null },
        ];
      },
      async findOrganizationsBySlugs() {
        return [
          { id: "org-1", slug: "alpha", name: "Alpha" },
          { id: "org-2", slug: "beta", name: "Beta" },
        ];
      },
      async activateTenant({ tenantId }) {
        activatedIds.push(tenantId);
        return true;
      },
    };

    const result = await reconcileTenantProvisioning(port, { staleMinutes: 10, limit: 50 });
    expect(result.activated).toBe(1);
    expect(activatedIds).toEqual(["t1"]);
    expect(result.conflicted).toEqual([{ tenantId: "t2", slug: "beta", reason: "ORGANIZATION_MAPPING_MISMATCH" }]);
    expect(result.unmatched).toEqual([{ tenantId: "t3", slug: "gamma" }]);
  });
});

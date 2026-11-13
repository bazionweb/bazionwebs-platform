import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EncryptedPrivateArchiveStorage } from "./encrypted-private-archive.js";
import {
  createPrivateArchiveStorageFromEnv,
  LocalPrivateArchiveStorage,
  S3PrivateArchiveStorage,
  verifyPrivateArchiveRoundTrip,
} from "./private-archive.js";

describe("private offboarding archive storage", () => {
  const dir = mkdtempSync(join(tmpdir(), "bazion-archive-test-"));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes idempotent checksum-addressed archives, rejects tampering, and enforces tenant isolation", async () => {
    const storage = new LocalPrivateArchiveStorage(dir);
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const archiveId = randomUUID();
    const body = Buffer.from(JSON.stringify({ installationId: randomUUID(), version: 1 }), "utf8");

    const stored = await storage.putArchive({ tenantId, archiveId, body });
    const replayed = await storage.putArchive({ tenantId, archiveId, body });
    expect(replayed).toEqual(stored);

    const loaded = await storage.getArchive({ tenantId, key: stored.key, checksum: stored.checksum });
    expect(loaded).not.toBeNull();
    expect(Buffer.from(loaded!.body).equals(body)).toBe(true);

    // Cross-tenant read must be rejected
    await expect(
      storage.getArchive({ tenantId: otherTenantId, key: stored.key, checksum: stored.checksum }),
    ).rejects.toThrow("outside the active tenant's private archive area");

    // Checksum tampering on disk must fail integrity verification
    writeFileSync(join(dir, ...stored.key.split("/")), Buffer.from("{\"tampered\":true}", "utf8"));
    await expect(
      storage.getArchive({ tenantId, key: stored.key, checksum: stored.checksum }),
    ).rejects.toThrow("checksum does not match");

    await storage.deleteArchive({ tenantId, key: stored.key, checksum: stored.checksum });
    await expect(
      storage.getArchive({ tenantId, key: stored.key, checksum: stored.checksum }),
    ).resolves.toBeNull();
  });

  it("encrypts archives at rest with AES-256-GCM bound to tenant and archive identity", async () => {
    const key = randomBytes(32).toString("base64");
    const inner = new LocalPrivateArchiveStorage(dir);
    const encrypted = new EncryptedPrivateArchiveStorage(inner, key);
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const archiveId = randomUUID();
    const secretPayload = JSON.stringify({ installationId: randomUUID(), sensitiveSetting: "super-secret-value" });
    const body = Buffer.from(secretPayload, "utf8");

    const stored = await encrypted.putArchive({ tenantId, archiveId, body });
    const rawOnDisk = readFileSync(join(dir, ...stored.key.split("/")));
    expect(rawOnDisk.toString("utf8")).not.toContain("super-secret-value");
    expect(rawOnDisk.subarray(0, 6).toString("ascii")).toBe("BZARC1");

    const loaded = await encrypted.getArchive({ tenantId, key: stored.key, checksum: stored.checksum });
    expect(loaded).not.toBeNull();
    expect(Buffer.from(loaded!.body).toString("utf8")).toBe(secretPayload);

    // Wrong encryption key must fail GCM tag authentication even with valid checksum
    const wrongKeyEncrypted = new EncryptedPrivateArchiveStorage(inner, randomBytes(32).toString("base64"));
    await expect(
      wrongKeyEncrypted.getArchive({ tenantId, key: stored.key, checksum: stored.checksum }),
    ).rejects.toThrow();

    // Cross-tenant key prefix and AAD mismatch must reject
    await expect(
      encrypted.getArchive({ tenantId: otherTenantId, key: stored.key, checksum: stored.checksum }),
    ).rejects.toThrow("outside the active tenant's private archive area");

    await encrypted.deleteArchive({ tenantId, key: stored.key, checksum: stored.checksum });
    await expect(
      encrypted.getArchive({ tenantId, key: stored.key, checksum: stored.checksum }),
    ).resolves.toBeNull();
  });

  it("enforces durable archive backend selection from env and verifies encrypted round-trip integrity", async () => {
    expect(() =>
      createPrivateArchiveStorageFromEnv({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow("Production offboarding archives require S3 storage");

    const s3Backed = createPrivateArchiveStorageFromEnv({
      NODE_ENV: "production",
      PRIVATE_ARCHIVE_S3_ENDPOINT: "https://s3.eu-central-1.amazonaws.com",
      PRIVATE_ARCHIVE_S3_BUCKET: "bazion-archives-prod",
      PRIVATE_ARCHIVE_S3_REGION: "eu-central-1",
      PRIVATE_ARCHIVE_S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
      PRIVATE_ARCHIVE_S3_SECRET_ACCESS_KEY: "super-secret-key",
    } as NodeJS.ProcessEnv);
    expect(s3Backed).toBeInstanceOf(S3PrivateArchiveStorage);

    const devStorage = createPrivateArchiveStorageFromEnv(
      { NODE_ENV: "test" } as NodeJS.ProcessEnv,
      { privateArchiveDirectory: dir },
    );
    const encrypted = new EncryptedPrivateArchiveStorage(devStorage, randomBytes(32).toString("base64"));
    const probe = await verifyPrivateArchiveRoundTrip(encrypted, randomUUID());
    expect(probe.verified).toBe(true);
    expect(probe.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});


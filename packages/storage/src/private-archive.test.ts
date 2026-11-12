import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { LocalPrivateArchiveStorage } from "./private-archive.js";

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
});


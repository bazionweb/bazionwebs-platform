import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PrivateArchiveResult, PrivateArchiveStorage, StoredPrivateArchive } from "./private-archive.js";

const ARCHIVE_ENVELOPE_MAGIC = Buffer.from("BZARC1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

function parseEncryptionKey(key: string | Uint8Array): Buffer {
  if (key instanceof Uint8Array) {
    if (key.byteLength !== 32) {
      throw new Error("Private archive encryption key must be 32 bytes.");
    }
    return Buffer.from(key);
  }
  const trimmed = key.trim();
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.byteLength !== 32 || decoded.toString("base64") !== trimmed) {
    throw new Error("Private archive encryption key must be a canonical Base64-encoded 32-byte key.");
  }
  return decoded;
}

function buildArchiveAad(tenantId: string, archiveId: string): Buffer {
  return Buffer.from(`bazion-archive-v1:${tenantId}:${archiveId}`, "utf8");
}

function encryptEnvelope(key: Buffer, tenantId: string, archiveId: string, plaintext: Uint8Array): Buffer {
  if (!archiveId || Buffer.byteLength(archiveId, "utf8") > 255) {
    throw new Error("Archive identifier is invalid for authenticated encryption.");
  }
  const archiveIdBytes = Buffer.from(archiveId, "utf8");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(buildArchiveAad(tenantId, archiveId));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([
    ARCHIVE_ENVELOPE_MAGIC,
    Buffer.from([archiveIdBytes.byteLength]),
    archiveIdBytes,
    iv,
    tag,
    encrypted,
  ]);
}

function decryptEnvelope(key: Buffer, tenantId: string, envelope: Uint8Array): Buffer {
  const buf = Buffer.from(envelope);
  const minHeader = ARCHIVE_ENVELOPE_MAGIC.byteLength + 1 + IV_BYTES + TAG_BYTES;
  if (buf.byteLength < minHeader || !buf.subarray(0, ARCHIVE_ENVELOPE_MAGIC.byteLength).equals(ARCHIVE_ENVELOPE_MAGIC)) {
    throw new Error("Private archive payload is not a valid encrypted envelope.");
  }
  let offset = ARCHIVE_ENVELOPE_MAGIC.byteLength;
  const archiveIdLength = buf.readUInt8(offset);
  offset += 1;
  if (archiveIdLength < 1 || buf.byteLength < minHeader + archiveIdLength) {
    throw new Error("Private archive envelope header is malformed.");
  }
  const archiveId = buf.subarray(offset, offset + archiveIdLength).toString("utf8");
  offset += archiveIdLength;
  const iv = buf.subarray(offset, offset + IV_BYTES);
  offset += IV_BYTES;
  const tag = buf.subarray(offset, offset + TAG_BYTES);
  offset += TAG_BYTES;
  const ciphertext = buf.subarray(offset);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(buildArchiveAad(tenantId, archiveId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Authenticates and encrypts offboarding archives at rest using AES-256-GCM before delegating
 * storage to the underlying Local or S3 backend, binding each ciphertext to tenantId and archiveId.
 */
export class EncryptedPrivateArchiveStorage implements PrivateArchiveStorage {
  private readonly key: Buffer;

  constructor(
    private readonly inner: PrivateArchiveStorage,
    encryptionKey: string | Uint8Array,
  ) {
    this.key = parseEncryptionKey(encryptionKey);
  }

  async putArchive(input: {
    tenantId: string;
    archiveId: string;
    body: Uint8Array;
  }): Promise<PrivateArchiveResult> {
    const encryptedBody = encryptEnvelope(this.key, input.tenantId, input.archiveId, input.body);
    return this.inner.putArchive({
      tenantId: input.tenantId,
      archiveId: input.archiveId,
      body: encryptedBody,
    });
  }

  async getArchive(input: {
    tenantId: string;
    key: string;
    checksum: string;
  }): Promise<StoredPrivateArchive | null> {
    const loaded = await this.inner.getArchive(input);
    if (!loaded) return null;
    const plaintext = decryptEnvelope(this.key, input.tenantId, loaded.body);
    return {
      key: loaded.key,
      checksum: loaded.checksum,
      sizeBytes: loaded.sizeBytes,
      body: plaintext,
    };
  }

  async deleteArchive(input: {
    tenantId: string;
    key: string;
    checksum: string;
  }): Promise<void> {
    await this.inner.deleteArchive(input);
  }
}


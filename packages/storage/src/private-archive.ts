import { createHash, randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_PRIVATE_ARCHIVE_BYTES = 50 * 1024 * 1024;

export interface PrivateArchiveResult {
  key: string;
  checksum: string;
  sizeBytes: number;
}

export interface StoredPrivateArchive extends PrivateArchiveResult {
  body: Uint8Array;
}

export interface PrivateArchiveStorage {
  putArchive(input: { tenantId: string; archiveId: string; body: Uint8Array }): Promise<PrivateArchiveResult>;
  getArchive(input: { tenantId: string; key: string; checksum: string }): Promise<StoredPrivateArchive | null>;
  deleteArchive(input: { tenantId: string; key: string; checksum: string }): Promise<void>;
}

export interface S3PrivateArchiveStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function validateUuid(value: string, name: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${name} must be a UUID.`);
  }
  return value.toLowerCase();
}

function archiveKey(tenantId: string, archiveId: string, checksum: string): string {
  const tenant = validateUuid(tenantId, "Tenant ID");
  const archive = validateUuid(archiveId, "Archive ID");
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Archive checksum must be a lowercase SHA-256 digest.");
  return `${tenant}/archives/${archive}/${checksum}.json`;
}

function assertArchiveKey(tenantId: string, key: string, checksum: string): void {
  const tenant = validateUuid(tenantId, "Tenant ID");
  const segments = key.split("/");
  if (
    segments.length !== 4
    || segments[0] !== tenant
    || segments[1] !== "archives"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(segments[2] ?? "")
    || !/^[a-f0-9]{64}$/.test(checksum)
    || segments[3] !== `${checksum}.json`
  ) {
    throw new Error("The archive key is outside the active tenant's private archive area.");
  }
}

function archiveChecksum(body: Uint8Array): string {
  if (body.byteLength < 1 || body.byteLength > MAX_PRIVATE_ARCHIVE_BYTES) {
    throw new RangeError("Private archives must contain between 1 byte and 50 MiB.");
  }
  return createHash("sha256").update(body).digest("hex");
}

function storageConflict(): Error {
  return new Error("A private archive with this identity already exists with different content.");
}

export class LocalPrivateArchiveStorage implements PrivateArchiveStorage {
  private readonly directory: string;

  constructor(directory: string) {
    if (!isAbsolute(directory)) throw new Error("Private archive directory must be an absolute path.");
    this.directory = resolve(directory);
  }

  private objectPath(tenantId: string, key: string, checksum: string): string {
    assertArchiveKey(tenantId, key, checksum);
    const objectDirectory = resolve(this.directory, ...key.split("/"));
    const relativePath = relative(this.directory, objectDirectory);
    if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === ".." || isAbsolute(relativePath)) {
      throw new Error("The archive key is outside the private archive directory.");
    }
    return objectDirectory;
  }

  async putArchive(input: { tenantId: string; archiveId: string; body: Uint8Array }): Promise<PrivateArchiveResult> {
    const checksum = archiveChecksum(input.body);
    const key = archiveKey(input.tenantId, input.archiveId, checksum);
    const objectPath = this.objectPath(input.tenantId, key, checksum);
    const parentDirectory = resolve(objectPath, "..");
    await mkdir(parentDirectory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(objectPath, input.body, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
      let sameContent = false;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const existing = await readFile(objectPath);
        if (Buffer.from(existing).equals(Buffer.from(input.body))) {
          sameContent = true;
          break;
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
      }
      if (!sameContent) throw storageConflict();
    }
    return { key, checksum, sizeBytes: input.body.byteLength };
  }

  async getArchive(input: { tenantId: string; key: string; checksum: string }): Promise<StoredPrivateArchive | null> {
    const objectPath = this.objectPath(input.tenantId, input.key, input.checksum);
    try {
      const body = await readFile(objectPath);
      if (archiveChecksum(body) !== input.checksum) {
        throw new Error("Stored private archive checksum does not match its key.");
      }
      return { key: input.key, checksum: input.checksum, sizeBytes: body.byteLength, body };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async deleteArchive(input: { tenantId: string; key: string; checksum: string }): Promise<void> {
    const objectPath = this.objectPath(input.tenantId, input.key, input.checksum);
    await unlink(objectPath).catch((error: unknown) => {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
    });
  }
}

export class S3PrivateArchiveStorage implements PrivateArchiveStorage {
  private readonly client: Pick<S3Client, "send">;

  constructor(private readonly config: S3PrivateArchiveStorageConfig, client?: Pick<S3Client, "send">) {
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new Error("Private archive storage endpoint must be a plain HTTPS URL.");
    }
    if (!config.bucket.trim() || !config.accessKeyId.trim() || !config.secretAccessKey.trim()) {
      throw new Error("Private archive storage requires a bucket and credentials.");
    }
    this.client = client ?? new S3Client({
      endpoint: endpoint.toString().replace(/\/$/, ""),
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async putArchive(input: { tenantId: string; archiveId: string; body: Uint8Array }): Promise<PrivateArchiveResult> {
    const checksum = archiveChecksum(input.body);
    const key = archiveKey(input.tenantId, input.archiveId, checksum);
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.body,
        ContentType: "application/json",
        IfNoneMatch: "*",
        ServerSideEncryption: "AES256",
        Metadata: { sha256: checksum },
      }));
    } catch (error) {
      const statusCode = error && typeof error === "object" && "$metadata" in error
        ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
        : undefined;
      const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
      if (statusCode !== 409 && statusCode !== 412 && name !== "PreconditionFailed" && name !== "ConditionalRequestConflict") {
        throw error;
      }
      const existing = await this.getArchive({ tenantId: input.tenantId, key, checksum });
      if (!existing || !Buffer.from(existing.body).equals(Buffer.from(input.body))) throw storageConflict();
    }
    return { key, checksum, sizeBytes: input.body.byteLength };
  }

  async getArchive(input: { tenantId: string; key: string; checksum: string }): Promise<StoredPrivateArchive | null> {
    assertArchiveKey(input.tenantId, input.key, input.checksum);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: input.key })) as {
        Body?: { transformToByteArray(): Promise<Uint8Array> };
      };
      if (!result.Body) return null;
      const body = await result.Body.transformToByteArray();
      const checksum = archiveChecksum(body);
      if (checksum !== input.checksum) {
        throw new Error("Stored private archive checksum does not match its key.");
      }
      return { key: input.key, checksum, sizeBytes: body.byteLength, body };
    } catch (error) {
      const statusCode = error && typeof error === "object" && "$metadata" in error
        ? (error.$metadata as { httpStatusCode?: number }).httpStatusCode
        : undefined;
      const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
      if (statusCode === 404 || name === "NoSuchKey" || name === "NotFound") return null;
      throw error;
    }
  }

  async deleteArchive(input: { tenantId: string; key: string; checksum: string }): Promise<void> {
    assertArchiveKey(input.tenantId, input.key, input.checksum);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: input.key }));
  }
}

export interface ArchiveStorageEnvOptions {
  privateArchiveDirectory?: string;
}

/**
 * Selects a durable archive backend from environment variables.
 * Uses S3PrivateArchiveStorage whenever durable S3 archive coordinates are configured,
 * rejects unverified local-disk storage in production unless ALLOW_LOCAL_ARCHIVE_IN_PRODUCTION=true,
 * and falls back to LocalPrivateArchiveStorage in dev/test.
 */
export function createPrivateArchiveStorageFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options?: ArchiveStorageEnvOptions,
): PrivateArchiveStorage {
  const s3Endpoint = env.PRIVATE_ARCHIVE_S3_ENDPOINT?.trim();
  const s3Bucket = env.PRIVATE_ARCHIVE_S3_BUCKET?.trim();
  const s3AccessKey = env.PRIVATE_ARCHIVE_S3_ACCESS_KEY_ID?.trim();
  const s3SecretKey = env.PRIVATE_ARCHIVE_S3_SECRET_ACCESS_KEY?.trim();

  if (s3Endpoint || s3Bucket || s3AccessKey || s3SecretKey) {
    if (!s3Endpoint || !s3Bucket || !s3AccessKey || !s3SecretKey) {
      throw new Error(
        "Incomplete PRIVATE_ARCHIVE_S3_* configuration: endpoint, bucket, access key, and secret key are all required.",
      );
    }
    return new S3PrivateArchiveStorage({
      endpoint: s3Endpoint,
      region: env.PRIVATE_ARCHIVE_S3_REGION?.trim() || "us-east-1",
      bucket: s3Bucket,
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
    });
  }

  const isProduction = env.NODE_ENV === "production";
  const allowLocalInProd = env.ALLOW_LOCAL_ARCHIVE_IN_PRODUCTION === "true";
  const localDir = options?.privateArchiveDirectory ?? env.PRIVATE_ARCHIVE_DIR?.trim();

  if (isProduction && !allowLocalInProd) {
    throw new Error(
      "Production offboarding archives require S3 storage (PRIVATE_ARCHIVE_S3_*) unless ALLOW_LOCAL_ARCHIVE_IN_PRODUCTION=true is explicitly set with durable shared storage.",
    );
  }
  if (isProduction && !localDir) {
    throw new Error("PRIVATE_ARCHIVE_DIR must be explicitly configured in production.");
  }

  return new LocalPrivateArchiveStorage(localDir ?? join(tmpdir(), "bazion-private-archives"));
}

/**
 * Executes a non-destructive put -> get -> SHA-256 verification -> delete round-trip probe
 * to confirm archive durability and restore integrity across the active backend.
 */
export async function verifyPrivateArchiveRoundTrip(
  storage: PrivateArchiveStorage,
  tenantId: string,
): Promise<{ verified: true; checksum: string; key: string; sizeBytes: number }> {
  const cleanTenantId = validateUuid(tenantId, "Tenant ID");
  const archiveId = randomUUID();
  const probePayload = Buffer.from(
    JSON.stringify({
      probe: "archive_durability_roundtrip",
      tenantId: cleanTenantId,
      archiveId,
      checkedAt: new Date().toISOString(),
    }),
    "utf8",
  );

  const stored = await storage.putArchive({
    tenantId: cleanTenantId,
    archiveId,
    body: probePayload,
  });

  try {
    const loaded = await storage.getArchive({
      tenantId: cleanTenantId,
      key: stored.key,
      checksum: stored.checksum,
    });
    if (!loaded) {
      throw new Error("ARCHIVE_ROUNDTRIP_MISSING_ON_READ");
    }
    if (!Buffer.from(loaded.body).equals(probePayload)) {
      throw new Error("ARCHIVE_ROUNDTRIP_PAYLOAD_MISMATCH");
    }
    return {
      verified: true,
      checksum: stored.checksum,
      key: stored.key,
      sizeBytes: stored.sizeBytes,
    };
  } finally {
    await storage.deleteArchive({
      tenantId: cleanTenantId,
      key: stored.key,
      checksum: stored.checksum,
    }).catch(() => undefined);
  }
}


import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

export {
  detectImageContentType,
  imageContentTypeExtensions,
  imageExtensionForContentType,
  sanitizeImageFilename,
  type SupportedImageContentType,
} from "./image-upload.js";
export {
  EncryptedPrivateArchiveStorage,
} from "./encrypted-private-archive.js";
export {
  LocalPrivateArchiveStorage,
  S3PrivateArchiveStorage,
  type PrivateArchiveResult,
  type PrivateArchiveStorage,
  type S3PrivateArchiveStorageConfig,
  type StoredPrivateArchive,
} from "./private-archive.js";

export interface StoredObject {
  key: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  lastModified: string;
}

export interface StoredFile {
  body: Uint8Array;
  contentType: string;
  sizeBytes: number;
}

export interface ObjectStorage {
  putObject(input: { tenantId: string; key: string; body: Uint8Array; contentType: string }): Promise<void>;
  listObjects(input: { tenantId: string; limit?: number }): Promise<StoredObject[]>;
  /** Complete tenant-prefix listing in bounded pages. The cursor is opaque to callers. */
  listObjectsPage(input: { tenantId: string; limit?: number; cursor?: string }): Promise<{ objects: StoredObject[]; nextCursor: string | null }>;
  getObject(input: { tenantId: string; key: string }): Promise<StoredFile | null>;
  deleteObject(input: { tenantId: string; key: string }): Promise<void>;
  publicUrl(key: string): string;
}

export interface S3ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
}

const extensionContentType: Record<string, string> = {
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function assertTenantKey(tenantId: string, key: string): void {
  if (!key.startsWith(`${tenantId}/`) || key.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("The object key is outside the active tenant's media area.");
  }
}

function contentTypeFromKey(key: string): string {
  return extensionContentType[extname(key).toLowerCase()] ?? "application/octet-stream";
}

function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function buildTenantObjectKey(tenantId: string, objectId: string, filename: string): string {
  const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return `${tenantId}/${objectId}/${safeName || "asset"}`;
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3ObjectStorageConfig) {
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new Error("Media storage endpoint must be a plain HTTPS URL.");
    }
    const publicBaseUrl = new URL(config.publicBaseUrl);
    if (publicBaseUrl.protocol !== "https:" || publicBaseUrl.username || publicBaseUrl.password || publicBaseUrl.search || publicBaseUrl.hash) {
      throw new Error("Media public base URL must be a plain HTTPS URL.");
    }
    this.client = new S3Client({
      endpoint: endpoint.toString().replace(/\/$/, ""),
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  publicUrl(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${encodeObjectKey(key)}`;
  }

  async putObject(input: { tenantId: string; key: string; body: Uint8Array; contentType: string }): Promise<void> {
    assertTenantKey(input.tenantId, input.key);
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }

  async listObjects(input: { tenantId: string; limit?: number }): Promise<StoredObject[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 100, 100));
    const prefix = `${input.tenantId}/`;
    let continuationToken: string | undefined;
    const objects: StoredObject[] = [];
    let pages = 0;
    do {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }));
      for (const object of result.Contents ?? []) {
        if (!object.Key || !object.Key.startsWith(prefix)) continue;
        objects.push({
          key: object.Key,
          url: this.publicUrl(object.Key),
          contentType: contentTypeFromKey(object.Key),
          sizeBytes: object.Size ?? 0,
          lastModified: object.LastModified?.toISOString() ?? "",
        });
      }
      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
      pages += 1;
    } while (continuationToken && pages < 5);
    return objects.sort((a, b) => b.lastModified.localeCompare(a.lastModified)).slice(0, limit);
  }

  async listObjectsPage(input: { tenantId: string; limit?: number; cursor?: string }): Promise<{ objects: StoredObject[]; nextCursor: string | null }> {
    const limit = Math.max(1, Math.min(input.limit ?? 500, 1000));
    const prefix = `${input.tenantId}/`;
    const result = await this.client.send(new ListObjectsV2Command({
      Bucket: this.config.bucket,
      Prefix: prefix,
      ContinuationToken: input.cursor,
      MaxKeys: limit,
    }));
    const objects = (result.Contents ?? []).flatMap((object) => {
      if (!object.Key || !object.Key.startsWith(prefix)) return [];
      return [{
        key: object.Key,
        url: this.publicUrl(object.Key),
        contentType: contentTypeFromKey(object.Key),
        sizeBytes: object.Size ?? 0,
        lastModified: object.LastModified?.toISOString() ?? "",
      }];
    });
    return {
      objects,
      nextCursor: result.IsTruncated ? result.NextContinuationToken ?? null : null,
    };
  }

  async getObject(input: { tenantId: string; key: string }): Promise<StoredFile | null> {
    assertTenantKey(input.tenantId, input.key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: input.key }));
      if (!result.Body) return null;
      const body = await result.Body.transformToByteArray();
      return { body, contentType: result.ContentType ?? contentTypeFromKey(input.key), sizeBytes: body.byteLength };
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "NoSuchKey") return null;
      throw error;
    }
  }

  async deleteObject(input: { tenantId: string; key: string }): Promise<void> {
    assertTenantKey(input.tenantId, input.key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: input.key }));
  }
}

export class LocalObjectStorage implements ObjectStorage {
  private readonly directory: string;

  constructor(directory = join(tmpdir(), "bazion-local-media")) {
    this.directory = resolve(directory);
    if (!isAbsolute(this.directory)) throw new Error("Local media directory must be an absolute path.");
  }

  publicUrl(key: string): string {
    return `/v1/public/church/media/${encodeObjectKey(key)}`;
  }

  private objectPath(tenantId: string, key: string): string {
    assertTenantKey(tenantId, key);
    const objectPath = resolve(this.directory, ...key.split("/"));
    const relativePath = relative(this.directory, objectPath);
    if (!relativePath || relativePath.startsWith(`..${sep}`) || relativePath === ".." || isAbsolute(relativePath)) {
      throw new Error("The object key is outside the local media directory.");
    }
    return objectPath;
  }

  async putObject(input: { tenantId: string; key: string; body: Uint8Array; contentType: string }): Promise<void> {
    const objectPath = this.objectPath(input.tenantId, input.key);
    await mkdir(resolve(objectPath, ".."), { recursive: true });
    await writeFile(objectPath, input.body, { flag: "wx" });
    await writeFile(`${objectPath}.content-type`, input.contentType, { flag: "w" });
  }

  async listObjects(input: { tenantId: string; limit?: number }): Promise<StoredObject[]> {
    const tenantPath = resolve(this.directory, input.tenantId);
    const limit = Math.max(1, Math.min(input.limit ?? 100, 100));
    const files: StoredObject[] = [];
    const walk = async (directory: string): Promise<void> => {
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); }
      catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) { await walk(fullPath); continue; }
        if (!entry.isFile() || entry.name.endsWith(".content-type")) continue;
        const objectPath = relative(this.directory, fullPath).split(sep).join("/");
        if (!objectPath.startsWith(`${input.tenantId}/`)) continue;
        const metadata = await stat(fullPath);
        const contentTypePath = `${fullPath}.content-type`;
        let contentType = contentTypeFromKey(objectPath);
        try { contentType = await readFile(contentTypePath, "utf8"); } catch { /* Fall back to the file extension. */ }
        files.push({ key: objectPath, url: this.publicUrl(objectPath), contentType, sizeBytes: metadata.size, lastModified: metadata.mtime.toISOString() });
      }
    };
    await walk(tenantPath);
    return files.sort((a, b) => b.lastModified.localeCompare(a.lastModified)).slice(0, limit);
  }

  async listObjectsPage(input: { tenantId: string; limit?: number; cursor?: string }): Promise<{ objects: StoredObject[]; nextCursor: string | null }> {
    const tenantPath = resolve(this.directory, input.tenantId);
    const limit = Math.max(1, Math.min(input.limit ?? 500, 1000));
    const files: StoredObject[] = [];
    const walk = async (directory: string): Promise<void> => {
      let entries;
      try { entries = await readdir(directory, { withFileTypes: true }); }
      catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
        throw error;
      }
      for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) { await walk(fullPath); continue; }
        if (!entry.isFile() || entry.name.endsWith(".content-type")) continue;
        const key = relative(this.directory, fullPath).split(sep).join("/");
        if (!key.startsWith(`${input.tenantId}/`)) continue;
        const metadata = await stat(fullPath);
        let contentType = contentTypeFromKey(key);
        try { contentType = await readFile(`${fullPath}.content-type`, "utf8"); } catch { /* Extension fallback. */ }
        files.push({ key, url: this.publicUrl(key), contentType, sizeBytes: metadata.size, lastModified: metadata.mtime.toISOString() });
      }
    };
    await walk(tenantPath);
    files.sort((left, right) => left.key.localeCompare(right.key));
    const startIndex = input.cursor ? files.findIndex((file) => file.key > input.cursor!) : 0;
    const pageStart = startIndex < 0 ? files.length : startIndex;
    const objects = files.slice(pageStart, pageStart + limit);
    const hasMore = pageStart + objects.length < files.length;
    return { objects, nextCursor: hasMore ? objects.at(-1)?.key ?? null : null };
  }

  async getObject(input: { tenantId: string; key: string }): Promise<StoredFile | null> {
    const objectPath = this.objectPath(input.tenantId, input.key);
    try {
      const [body, metadata, contentType] = await Promise.all([
        readFile(objectPath),
        stat(objectPath),
        readFile(`${objectPath}.content-type`, "utf8").catch(() => contentTypeFromKey(input.key)),
      ]);
      return { body, contentType, sizeBytes: metadata.size };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
      throw error;
    }
  }

  async deleteObject(input: { tenantId: string; key: string }): Promise<void> {
    const objectPath = this.objectPath(input.tenantId, input.key);
    await Promise.all([
      unlink(objectPath).catch((error: unknown) => {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }),
      unlink(`${objectPath}.content-type`).catch((error: unknown) => {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }),
    ]);
  }
}

export function createObjectStorage(config: {
  driver: "local" | "s3";
  localDirectory?: string;
  s3?: S3ObjectStorageConfig;
}): ObjectStorage {
  if (config.driver === "s3") {
    if (!config.s3) throw new Error("S3 media storage is missing its endpoint, credentials, bucket or public URL configuration.");
    return new S3ObjectStorage(config.s3);
  }
  return new LocalObjectStorage(config.localDirectory);
}

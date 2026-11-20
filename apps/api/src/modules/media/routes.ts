import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { PostgresAuditEventWriter } from "@bazion/audit";
import { requireActiveTenantPermission } from "@bazion/auth";
import {
  churchEvents,
  leadershipProfiles,
  ministryProfiles,
  ministrySettings,
  products,
  sermons,
  tenantMediaAssets,
} from "@bazion/database";
import {
  buildTenantObjectKey,
  createObjectStorage,
  detectImageContentType,
  IMAGE_VARIANT_PRESETS,
  ImageOptimizationBusyError,
  InvalidUploadedImageError,
  optimizeUploadedImage,
  sanitizeImageFilename,
  transformImageVariant,
  UploadedImageTooLargeError,
  type ImageVariantName,
  type ObjectStorage,
} from "@bazion/storage";
import type { AppConfig } from "../../config.js";
import { pool, withTenantTransaction } from "../../lib/database.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { resolveRequestTenantId } from "../../lib/tenant-resolution.js";

interface MediaRouteOptions {
  config: AppConfig;
  storage?: ObjectStorage;
}

const MEDIA_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const DEFAULT_STORAGE_QUOTA_BYTES = 512 * 1024 * 1024; // 512 MB default per tenant
const auditWriter = new PostgresAuditEventWriter(pool);

function createMediaStorage(config: AppConfig): ObjectStorage {
  return createObjectStorage({
    driver: config.mediaStorage.driver,
    ...(config.mediaStorage.localDirectory ? { localDirectory: config.mediaStorage.localDirectory } : {}),
    ...(config.mediaStorage.s3 ? { s3: config.mediaStorage.s3 } : {}),
  });
}

async function assertMediaEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "media-storage"))) {
    throw Object.assign(new Error("The media-storage module is not enabled for this tenant."), {
      statusCode: 404,
      code: "MEDIA_MODULE_DISABLED",
    });
  }
}

export async function mediaRoutes(app: FastifyInstance, options: MediaRouteOptions): Promise<void> {
  const storage = options.storage ?? createMediaStorage(options.config);

  app.setErrorHandler((error, _request, reply) => {
    const err = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
    return reply.code(statusCode).send({
      error: err.code ?? (statusCode === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR"),
      message: err.message ?? "Request failed.",
    });
  });

  async function tenantForRequest(request: FastifyRequest): Promise<string> {
    return resolveRequestTenantId(request, options.config);
  }

  // GET /v1/public/media/* (optional ?variant=thumbnail|card|hero|canonical)
  app.get<{ Params: { "*": string }; Querystring: { variant?: string } }>("/public/media/*", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertMediaEnabled(tenantId);
    const key = request.params["*"];
    if (!key.startsWith(`${tenantId}/`)) return reply.code(404).send({ error: "MEDIA_NOT_FOUND" });
    const stored = await storage.getObject({ tenantId, key });
    if (!stored) return reply.code(404).send({ error: "MEDIA_NOT_FOUND" });

    const variant = request.query.variant?.trim();
    if (variant && variant in IMAGE_VARIANT_PRESETS) {
      try {
        const transformed = await transformImageVariant(stored.body, variant as ImageVariantName);
        return reply
          .header("Content-Type", transformed.contentType)
          .header("Content-Length", String(transformed.body.byteLength))
          .header("Cache-Control", "public, max-age=31536000, immutable")
          .header("X-Content-Type-Options", "nosniff")
          .send(transformed.body);
      } catch {
        // Fall back to canonical image if transformation is skipped/fails.
      }
    }

    return reply
      .header("Content-Type", stored.contentType)
      .header("Content-Length", String(stored.sizeBytes))
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(stored.body);
  });

  // GET /v1/admin/media
  app.get("/admin/media", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { media: ["read"] });
    await assertMediaEnabled(context.tenantId);

    const dbAssets = await withTenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantMediaAssets)
        .orderBy(desc(tenantMediaAssets.createdAt))
        .limit(200);
      const [totals] = await tx
        .select({
          totalBytes: sql<string>`COALESCE(SUM(${tenantMediaAssets.sizeBytes}), 0)::text`,
          assetCount: sql<string>`COUNT(*)::text`,
        })
        .from(tenantMediaAssets);
      return {
        rows,
        totalBytes: Number(totals?.totalBytes ?? 0),
        assetCount: Number(totals?.assetCount ?? 0),
      };
    });

    const storageItems = dbAssets.rows.length > 0
      ? dbAssets.rows.map((row) => ({
          id: row.id,
          key: row.objectKey,
          url: row.publicUrl,
          filename: row.filename,
          contentType: row.contentType,
          sizeBytes: row.sizeBytes,
          originalSizeBytes: row.originalSizeBytes,
          width: row.width,
          height: row.height,
          optimized: row.optimized,
          lastModified: row.createdAt.toISOString(),
        }))
      : await storage.listObjects({ tenantId: context.tenantId, limit: 100 });

    const totalBytes = dbAssets.totalBytes > 0
      ? dbAssets.totalBytes
      : storageItems.reduce((sum, item) => sum + item.sizeBytes, 0);

    return reply.send({
      items: storageItems,
      usage: {
        assetCount: dbAssets.rows.length > 0 ? dbAssets.assetCount : storageItems.length,
        totalBytes,
        quotaBytes: DEFAULT_STORAGE_QUOTA_BYTES,
      },
    });
  });

  // POST /v1/admin/media
  app.post<{ Querystring: { filename?: string; contentType?: string } }>("/admin/media", {
    bodyLimit: MEDIA_UPLOAD_LIMIT_BYTES,
    config: {
      rateLimit: {
        max: 120,
        timeWindow: "1 minute",
        keyGenerator: (request) => request.ip,
      },
    },
  }, async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { media: ["create"] });
    await assertMediaEnabled(context.tenantId);

    const bytes = request.body;
    if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0) {
      return reply.code(400).send({ error: "MEDIA_EMPTY", message: "Choose an image file to upload." });
    }
    if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) {
      return reply.code(413).send({ error: "MEDIA_TOO_LARGE", message: "Images must be 8 MB or smaller." });
    }

    const currentUsage = await withTenantTransaction(context.tenantId, async (tx) => {
      const [totals] = await tx
        .select({ totalBytes: sql<string>`COALESCE(SUM(${tenantMediaAssets.sizeBytes}), 0)::text` })
        .from(tenantMediaAssets);
      return Number(totals?.totalBytes ?? 0);
    });
    if (currentUsage + bytes.byteLength > DEFAULT_STORAGE_QUOTA_BYTES) {
      return reply.code(413).send({ error: "STORAGE_QUOTA_EXCEEDED", message: "Tenant media storage quota exceeded." });
    }

    const declaredType = request.query.contentType?.trim().toLowerCase() ?? "";
    const actualType = detectImageContentType(bytes);
    if (!actualType || actualType !== declaredType) {
      return reply.code(415).send({ error: "UNSUPPORTED_MEDIA_TYPE", message: "Upload a valid JPEG, PNG, WebP, or AVIF image." });
    }

    let optimized: Awaited<ReturnType<typeof optimizeUploadedImage>>;
    try {
      optimized = await optimizeUploadedImage(bytes, actualType);
    } catch (error) {
      if (error instanceof UploadedImageTooLargeError) {
        return reply.code(413).send({ error: "IMAGE_DIMENSIONS_TOO_LARGE", message: error.message });
      }
      if (error instanceof ImageOptimizationBusyError) {
        return reply.header("retry-after", "5").code(503).send({ error: "IMAGE_PROCESSOR_BUSY", message: error.message });
      }
      if (error instanceof InvalidUploadedImageError) {
        return reply.code(415).send({ error: "INVALID_IMAGE_DATA", message: error.message });
      }
      throw error;
    }

    const filename = sanitizeImageFilename(request.query.filename, optimized.extension);
    const key = buildTenantObjectKey(context.tenantId, randomBytes(16).toString("hex"), filename);
    const url = storage.publicUrl(key);
    const checksumSha256 = createHash("sha256").update(optimized.body).digest("hex");

    await storage.putObject({
      tenantId: context.tenantId,
      key,
      body: optimized.body,
      contentType: optimized.contentType,
    });

    const assetRecord = await withTenantTransaction(context.tenantId, async (tx) => {
      const [inserted] = await tx
        .insert(tenantMediaAssets)
        .values({
          tenantId: context.tenantId,
          objectKey: key,
          publicUrl: url,
          filename,
          contentType: optimized.contentType,
          sizeBytes: optimized.body.byteLength,
          originalSizeBytes: optimized.originalSizeBytes,
          width: optimized.width,
          height: optimized.height,
          checksumSha256,
          optimized: optimized.optimized,
          uploadedBy: context.userId,
        })
        .returning();
      return inserted;
    });

    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId,
        actorRole: context.roles.join(","),
        tenantId: context.tenantId,
        action: "media.asset.uploaded",
        resourceType: "media_asset",
        resourceId: assetRecord?.id ?? key,
        outcome: "succeeded",
        requestId: request.id,
        metadata: {
          contentType: optimized.contentType,
          sizeBytes: optimized.body.byteLength,
          optimized: optimized.optimized,
        },
      });
    } catch {
      // Do not fail upload if audit logging hits transient contention.
    }

    return reply.code(201).send({
      asset: {
        id: assetRecord?.id ?? null,
        key,
        url,
        filename,
        contentType: optimized.contentType,
        sizeBytes: optimized.body.byteLength,
        originalSizeBytes: optimized.originalSizeBytes,
        savedBytes: Math.max(0, optimized.originalSizeBytes - optimized.body.byteLength),
        optimized: optimized.optimized,
        width: optimized.width,
        height: optimized.height,
        checksumSha256,
        lastModified: new Date().toISOString(),
      },
    });
  });

  // DELETE /v1/admin/media/:assetId (guarded deletion)
  app.delete<{ Params: { assetId: string } }>("/admin/media/:assetId", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.headers, { media: ["delete"] });
    await assertMediaEnabled(context.tenantId);

    const assetId = request.params.assetId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId)) {
      return reply.code(400).send({ error: "INVALID_INPUT" });
    }

    const checkResult = await withTenantTransaction(context.tenantId, async (tx) => {
      const [asset] = await tx
        .select()
        .from(tenantMediaAssets)
        .where(and(eq(tenantMediaAssets.tenantId, context.tenantId), eq(tenantMediaAssets.id, assetId)))
        .limit(1);
      if (!asset) return { kind: "not_found" as const };

      const likeKey = `%${asset.objectKey}%`;
      const references: string[] = [];

      const [prodRef] = await tx.select({ id: products.id }).from(products)
        .where(or(eq(products.imageUrl, asset.publicUrl), ilike(products.imageUrl, likeKey))).limit(1);
      if (prodRef) references.push("products");

      const [ministryRef] = await tx.select({ id: ministryProfiles.id }).from(ministryProfiles)
        .where(or(eq(ministryProfiles.logoAssetUrl, asset.publicUrl), ilike(ministryProfiles.logoAssetUrl, likeKey))).limit(1);
      if (ministryRef) references.push("ministry_profiles");

      const [leaderRef] = await tx.select({ id: leadershipProfiles.id }).from(leadershipProfiles)
        .where(or(eq(leadershipProfiles.photoUrl, asset.publicUrl), ilike(leadershipProfiles.photoUrl, likeKey))).limit(1);
      if (leaderRef) references.push("leadership_profiles");

      const [sermonRef] = await tx.select({ id: sermons.id }).from(sermons)
        .where(or(eq(sermons.thumbnailUrl, asset.publicUrl), ilike(sermons.thumbnailUrl, likeKey))).limit(1);
      if (sermonRef) references.push("sermons");

      const [eventRef] = await tx.select({ id: churchEvents.id }).from(churchEvents)
        .where(or(eq(churchEvents.posterUrl, asset.publicUrl), ilike(churchEvents.posterUrl, likeKey))).limit(1);
      if (eventRef) references.push("church_events");

      const [settingRef] = await tx.select({ id: ministrySettings.id }).from(ministrySettings)
        .where(ilike(ministrySettings.settingValue, likeKey)).limit(1);
      if (settingRef) references.push("ministry_settings");

      if (references.length > 0) {
        return { kind: "in_use" as const, references };
      }

      await tx.delete(tenantMediaAssets)
        .where(and(eq(tenantMediaAssets.tenantId, context.tenantId), eq(tenantMediaAssets.id, assetId)));

      return { kind: "deleted" as const, asset };
    });

    if (checkResult.kind === "not_found") {
      return reply.code(404).send({ error: "MEDIA_NOT_FOUND" });
    }
    if (checkResult.kind === "in_use") {
      return reply.code(409).send({
        error: "MEDIA_ASSET_IN_USE",
        message: "Remove references to this asset before deleting it.",
        references: checkResult.references,
      });
    }

    await storage.deleteObject({ tenantId: context.tenantId, key: checkResult.asset.objectKey });

    try {
      await auditWriter.append({
        actorType: "user",
        actorId: context.userId,
        actorRole: context.roles.join(","),
        tenantId: context.tenantId,
        action: "media.asset.deleted",
        resourceType: "media_asset",
        resourceId: assetId,
        outcome: "succeeded",
        requestId: request.id,
        metadata: { sizeBytes: checkResult.asset.sizeBytes },
      });
    } catch {
      // Ignore transient audit failures after deletion.
    }

    return reply.send({ deleted: true, id: assetId });
  });
}

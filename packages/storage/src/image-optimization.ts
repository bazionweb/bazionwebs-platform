import sharp, { type Metadata, type OutputInfo } from "sharp";
import {
  detectImageContentType,
  imageExtensionForContentType,
  type SupportedImageContentType,
} from "./image-upload.js";

export const MAX_IMAGE_INPUT_PIXELS = 40_000_000;
export const MAX_IMAGE_OUTPUT_EDGE = 2_560;
const MAX_CONCURRENT_IMAGE_OPTIMIZATIONS = 2;
const MAX_QUEUED_IMAGE_OPTIMIZATIONS = 8;

// Upload processing shares the API container with tenant and platform traffic.
// Use one libvips thread per image and a small cache; the bounded worker pool
// above prevents a burst from multiplying image-decoder memory use.
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 20 });

export class InvalidUploadedImageError extends Error {
  constructor(message = "The uploaded file is not a readable image.") {
    super(message);
    this.name = "InvalidUploadedImageError";
  }
}

export class UploadedImageTooLargeError extends Error {
  constructor() {
    super(`Images cannot exceed ${MAX_IMAGE_INPUT_PIXELS.toLocaleString()} pixels.`);
    this.name = "UploadedImageTooLargeError";
  }
}

export class ImageOptimizationBusyError extends Error {
  constructor() {
    super("Image processing is busy. Please retry the upload shortly.");
    this.name = "ImageOptimizationBusyError";
  }
}

export interface OptimizedImageUpload {
  body: Uint8Array;
  contentType: SupportedImageContentType;
  extension: string;
  originalSizeBytes: number;
  optimized: boolean;
  width: number;
  height: number;
}

let activeOptimizations = 0;
const optimizationWaiters: Array<() => void> = [];

async function withOptimizationSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (activeOptimizations >= MAX_CONCURRENT_IMAGE_OPTIMIZATIONS) {
    if (optimizationWaiters.length >= MAX_QUEUED_IMAGE_OPTIMIZATIONS) throw new ImageOptimizationBusyError();
    await new Promise<void>((resolve) => optimizationWaiters.push(resolve));
  } else {
    activeOptimizations += 1;
  }

  try {
    return await operation();
  } finally {
    const next = optimizationWaiters.shift();
    if (next) next();
    else activeOptimizations -= 1;
  }
}

function unchangedImage(bytes: Uint8Array, contentType: SupportedImageContentType, width: number, height: number): OptimizedImageUpload {
  const extension = imageExtensionForContentType(contentType);
  if (!extension) throw new InvalidUploadedImageError();
  return { body: bytes, contentType, extension, originalSizeBytes: bytes.byteLength, optimized: false, width, height };
}

/**
 * Normalize tenant uploads into one compact WebP object. Cloudflare creates and
 * edge-caches browser-specific AVIF/WebP responsive sizes at delivery time, so
 * R2 stores one canonical image rather than every width/format combination.
 */
export async function optimizeUploadedImage(
  input: Uint8Array,
  expectedContentType: SupportedImageContentType,
): Promise<OptimizedImageUpload> {
  const detectedType = detectImageContentType(input);
  if (!detectedType || detectedType !== expectedContentType) throw new InvalidUploadedImageError();

  return withOptimizationSlot(async () => {
    let metadata: Metadata;
    try {
      metadata = await sharp(input, {
        failOn: "warning",
        // Metadata reads only image headers; validate dimensions before running
        // the pixel decoder so oversized uploads get a precise rejection.
        limitInputPixels: false,
        sequentialRead: true,
      }).metadata();
    } catch {
      throw new InvalidUploadedImageError();
    }

    const width = metadata.width;
    const height = metadata.height;
    if (!width || !height) throw new InvalidUploadedImageError();
    if (width * height > MAX_IMAGE_INPUT_PIXELS) throw new UploadedImageTooLargeError();

    // Keep animations intact. Sharp's normal single-page pipeline would silently
    // reduce an animated upload to its first frame.
    if ((metadata.pages ?? 1) > 1) return unchangedImage(input, expectedContentType, width, height);

    let encoded: { data: Buffer; info: OutputInfo };
    try {
      encoded = await sharp(input, {
        failOn: "warning",
        limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize({
          width: MAX_IMAGE_OUTPUT_EDGE,
          height: MAX_IMAGE_OUTPUT_EDGE,
          fit: "inside",
          withoutEnlargement: true,
          fastShrinkOnLoad: true,
        })
        .webp({ quality: 84, alphaQuality: 100, effort: 3, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new InvalidUploadedImageError();
    }

    // Never make an upload consume more storage just to change its format or
    // dimensions. Cloudflare still resizes a retained original for delivery.
    if (encoded.data.byteLength >= input.byteLength) {
      return unchangedImage(input, expectedContentType, width, height);
    }

    return {
      body: encoded.data,
      contentType: "image/webp",
      extension: ".webp",
      originalSizeBytes: input.byteLength,
      optimized: true,
      width: encoded.info.width,
      height: encoded.info.height,
    };
  });
}

export const IMAGE_VARIANT_PRESETS = {
  thumbnail: { maxWidth: 320, maxHeight: 320, quality: 78 },
  card: { maxWidth: 800, maxHeight: 800, quality: 82 },
  hero: { maxWidth: 1600, maxHeight: 1600, quality: 84 },
  canonical: { maxWidth: MAX_IMAGE_OUTPUT_EDGE, maxHeight: MAX_IMAGE_OUTPUT_EDGE, quality: 84 },
} as const;

export type ImageVariantName = keyof typeof IMAGE_VARIANT_PRESETS;

export async function transformImageVariant(
  input: Uint8Array,
  variant: ImageVariantName | { width: number; height?: number; quality?: number },
): Promise<{ body: Uint8Array; contentType: "image/webp"; width: number; height: number }> {
  const preset = typeof variant === "string" ? IMAGE_VARIANT_PRESETS[variant] : {
    maxWidth: Math.min(Math.max(variant.width, 32), MAX_IMAGE_OUTPUT_EDGE),
    maxHeight: Math.min(Math.max(variant.height ?? variant.width, 32), MAX_IMAGE_OUTPUT_EDGE),
    quality: Math.min(Math.max(variant.quality ?? 82, 40), 95),
  };

  return withOptimizationSlot(async () => {
    const metadata = await sharp(input, {
      failOn: "warning",
      limitInputPixels: false,
      sequentialRead: true,
    }).metadata();
    if (!metadata.width || !metadata.height) throw new InvalidUploadedImageError();
    if (metadata.width * metadata.height > MAX_IMAGE_INPUT_PIXELS) throw new UploadedImageTooLargeError();

    const encoded = await sharp(input, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_INPUT_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: preset.maxWidth,
        height: preset.maxHeight,
        fit: "inside",
        withoutEnlargement: true,
        fastShrinkOnLoad: true,
      })
      .webp({ quality: preset.quality, alphaQuality: 100, effort: 3, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });

    return {
      body: encoded.data,
      contentType: "image/webp",
      width: encoded.info.width,
      height: encoded.info.height,
    };
  });
}


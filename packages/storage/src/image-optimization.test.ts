import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  ImageOptimizationBusyError,
  InvalidUploadedImageError,
  MAX_IMAGE_INPUT_PIXELS,
  MAX_IMAGE_OUTPUT_EDGE,
  optimizeUploadedImage,
  UploadedImageTooLargeError,
} from "./image-optimization.js";

async function createSolidPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 35, g: 110, b: 80, alpha: 1 } },
  }).png().toBuffer();
}

describe("tenant upload image optimization", () => {
  it("resizes oversized originals and stores one WebP canonical image", async () => {
    const input = await createSolidPng(3_000, 1_500);
    const result = await optimizeUploadedImage(input, "image/png");

    expect(result).toMatchObject({
      contentType: "image/webp",
      extension: ".webp",
      originalSizeBytes: input.byteLength,
      optimized: true,
      width: 2_560,
      height: 1_280,
    });
    expect(result.body.byteLength).toBeLessThan(input.byteLength);
    await expect(sharp(result.body).metadata()).resolves.toMatchObject({ format: "webp", width: 2_560, height: 1_280 });
  });

  it("reduces image storage and removes source EXIF metadata when WebP saves bytes", async () => {
    const width = 900;
    const height = 600;
    const pixels = Buffer.alloc(width * height * 3);
    let seed = 9;
    for (let index = 0; index < pixels.length; index += 1) {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      pixels[index] = seed >>> 24;
    }
    const input = await sharp(pixels, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
    const result = await optimizeUploadedImage(input, "image/png");

    expect(input.byteLength).toBeGreaterThan(500_000);
    expect(result.contentType).toBe("image/webp");
    expect(result.body.byteLength).toBeLessThan(input.byteLength);
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
    const metadata = await sharp(result.body).metadata();
    expect(metadata).toMatchObject({ format: "webp", hasProfile: false });
    expect(metadata.exif).toBeUndefined();
  });

  it("never enlarges a small image solely to change its format", async () => {
    const input = await createSolidPng(1, 1);
    const result = await optimizeUploadedImage(input, "image/png");

    expect(result.body.byteLength).toBeLessThanOrEqual(input.byteLength);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it("rejects malformed image data even when its file signature is allowed", async () => {
    const invalidPng = Buffer.from("89504e470d0a1a0a0000000049454e44", "hex");
    await expect(optimizeUploadedImage(invalidPng, "image/png")).rejects.toBeInstanceOf(InvalidUploadedImageError);
  });

  it("rejects a valid image when its declared format does not match its signature", async () => {
    const input = await createSolidPng(1, 1);
    await expect(optimizeUploadedImage(input, "image/jpeg")).rejects.toBeInstanceOf(InvalidUploadedImageError);
  });

  it("rejects work beyond the bounded image processor queue", async () => {
    const input = await createSolidPng(64, 64);
    const results = await Promise.allSettled(
      Array.from({ length: 11 }, () => optimizeUploadedImage(input, "image/png")),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(10);
    expect(results.filter((result) => result.status === "rejected" && result.reason instanceof ImageOptimizationBusyError)).toHaveLength(1);
  });

  it("rejects images above the pixel safety limit before decoding them", async () => {
    const input = await createSolidPng(6_500, 6_500);
    await expect(optimizeUploadedImage(input, "image/png")).rejects.toBeInstanceOf(UploadedImageTooLargeError);
    expect(6_500 * 6_500).toBeGreaterThan(MAX_IMAGE_INPUT_PIXELS);
  });

  it("keeps canonical image dimensions below the edge transformation ceiling", () => {
    expect(MAX_IMAGE_OUTPUT_EDGE).toBe(2_560);
  });
});

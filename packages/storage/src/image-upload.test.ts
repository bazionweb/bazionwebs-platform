import { describe, expect, it } from "vitest";
import {
  detectImageContentType,
  imageExtensionForContentType,
  sanitizeImageFilename,
} from "./image-upload.js";

describe("detectImageContentType", () => {
  it.each([
    ["PNG", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "image/png"],
    ["JPEG", [0xff, 0xd8, 0xff], "image/jpeg"],
    ["WebP", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], "image/webp"],
    ["AVIF", [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], "image/avif"],
    ["animated AVIF", [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x73], "image/avif"],
  ] as const)("recognizes %s from its file signature", (_name, signature, expected) => {
    expect(detectImageContentType(Uint8Array.from(signature))).toBe(expected);
  });

  it("rejects truncated or unsupported signatures", () => {
    expect(detectImageContentType(Uint8Array.from([0x89, 0x50, 0x4e]))).toBeUndefined();
    expect(detectImageContentType(new TextEncoder().encode("not an image"))).toBeUndefined();
  });
});

describe("image upload metadata", () => {
  it("returns only extensions for supported image content types", () => {
    expect(imageExtensionForContentType("image/jpeg")).toBe(".jpg");
    expect(imageExtensionForContentType("application/octet-stream")).toBeUndefined();
  });

  it("sanitizes paths and replaces the supplied extension", () => {
    expect(sanitizeImageFilename("C:\\private\\family photo.gif", ".webp")).toBe("family_photo.webp");
    expect(sanitizeImageFilename("../.png", ".png")).toBe("image.png");
  });

  it("limits long filenames", () => {
    const filename = sanitizeImageFilename(`${"a".repeat(120)}.jpeg`, ".jpg");
    expect(filename).toBe(`${"a".repeat(80)}.jpg`);
  });
});

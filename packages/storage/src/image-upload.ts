export const imageContentTypeExtensions = {
  "image/avif": ".avif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export type SupportedImageContentType = keyof typeof imageContentTypeExtensions;

function matchesAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (bytes.byteLength < offset + value.length) return false;
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export function detectImageContentType(bytes: Uint8Array): SupportedImageContentType | undefined {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength >= pngSignature.length && pngSignature.every((value, index) => bytes[index] === value)) {
    return "image/png";
  }
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP")) {
    return "image/webp";
  }
  if (matchesAscii(bytes, 4, "ftyp") && (matchesAscii(bytes, 8, "avif") || matchesAscii(bytes, 8, "avis"))) {
    return "image/avif";
  }
  return undefined;
}

export function imageExtensionForContentType(contentType: string): string | undefined {
  return Object.hasOwn(imageContentTypeExtensions, contentType)
    ? imageContentTypeExtensions[contentType as SupportedImageContentType]
    : undefined;
}

export function sanitizeImageFilename(value: string | undefined, extension: string): string {
  const basename = (value ?? "image").replaceAll("\\", "/").split("/").pop() ?? "image";
  const name = basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  const stem = name.replace(/\.[^.]*$/, "").slice(0, 80) || "image";
  return `${stem}${extension}`;
}

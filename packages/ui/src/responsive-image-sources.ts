const RESPONSIVE_WIDTHS = [320, 640, 960, 1280, 1920] as const;

export interface ResponsiveImageSources {
  src: string;
  srcSet?: string;
}

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function isSafeImageSource(value: string): boolean {
  if (!value || value.trim() !== value || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Build same-zone Cloudflare image URLs only for the configured public media origin.
 * Local development paths and third-party tenant URLs pass through unchanged.
 */
export function getResponsiveImageSources(
  source: string,
  publicMediaBaseUrl: string,
  widths: readonly number[] = RESPONSIVE_WIDTHS,
  siteImageTransformsEnabled = false,
  mediaTransformsEnabled = true,
): ResponsiveImageSources {
  const unchanged = { src: source };
  const siteImage = siteImageTransformsEnabled ? getSameZoneImageSources(source, widths) : null;
  if (siteImage) return siteImage;

  const mediaBase = mediaTransformsEnabled ? parseHttpsUrl(publicMediaBaseUrl) : null;
  const imageUrl = parseHttpsUrl(source);
  if (!mediaBase || !imageUrl || imageUrl.origin !== mediaBase.origin) return unchanged;

  const basePath = mediaBase.pathname.replace(/\/+$/, "");
  if (/%(?:2f|5c|2e)/i.test(imageUrl.pathname)) return unchanged;
  const isWithinConfiguredPath = !basePath || imageUrl.pathname === basePath || imageUrl.pathname.startsWith(`${basePath}/`);
  if (!isWithinConfiguredPath || imageUrl.pathname === "/cdn-cgi/image" || imageUrl.pathname.startsWith("/cdn-cgi/image/")) return unchanged;
  if (!widths.length || widths.some((width) => !RESPONSIVE_WIDTHS.includes(width as (typeof RESPONSIVE_WIDTHS)[number]))) return unchanged;

  const buildUrl = (width: number) => {
    const options = `fit=scale-down,width=${width},quality=80,format=auto`;
    const sourcePath = imageUrl.pathname.replace(/^\/+/, "");
    return `${imageUrl.origin}/cdn-cgi/image/${options}/${sourcePath}`;
  };
  const uniqueWidths = [...new Set(widths)].sort((left, right) => left - right);
  const fallbackWidth = uniqueWidths.includes(960) ? 960 : uniqueWidths[uniqueWidths.length - 1];
  return {
    src: buildUrl(fallbackWidth!),
    srcSet: uniqueWidths.map((width) => `${buildUrl(width)} ${width}w`).join(", "),
  };
}

/**
 * Transform only raster assets served by this tenant's own site zone. Keeping
 * this separate from media-origin transforms avoids proxying arbitrary paths
 * or relying on a tenant's media bucket being on the same Cloudflare zone.
 */
function getSameZoneImageSources(source: string, widths: readonly number[]): ResponsiveImageSources | null {
  if (!source.startsWith("/images/") || /[?#\\\u0000-\u001f\u007f]/.test(source)) return null;
  if (!/\.(?:avif|jpe?g|png|webp)$/i.test(source)) return null;
  if (/%(?:2f|5c|2e)/i.test(source)) return null;
  if (!widths.length || widths.some((width) => !RESPONSIVE_WIDTHS.includes(width as (typeof RESPONSIVE_WIDTHS)[number]))) return null;

  const segments = source.slice(1).split("/");
  if (segments.some((segment) => !segment)) return null;
  const safeSegments: string[] = [];
  try {
    for (const segment of segments) {
      const decoded = decodeURIComponent(segment);
      if (decoded === "." || decoded === ".." || decoded.includes("%") || /[\\/\u0000-\u001f\u007f]/.test(decoded)) return null;
      safeSegments.push(encodeURIComponent(decoded));
    }
  } catch {
    return null;
  }

  const uniqueWidths = [...new Set(widths)].sort((left, right) => left - right);
  const fallbackWidth = uniqueWidths.includes(960) ? 960 : uniqueWidths[uniqueWidths.length - 1];
  const sourcePath = safeSegments.join("/");
  const buildUrl = (width: number) => `/cdn-cgi/image/fit=scale-down,width=${width},quality=80,format=auto/${sourcePath}`;
  return {
    src: buildUrl(fallbackWidth!),
    srcSet: uniqueWidths.map((width) => `${buildUrl(width)} ${width}w`).join(", "),
  };
}

"use client";

import { createContext, useContext, type ImgHTMLAttributes, type ReactNode } from "react";
import { getResponsiveImageSources, isSafeImageSource } from "./responsive-image-sources.js";

export interface ResponsiveImageConfig {
  /** The exact HTTPS origin and optional path prefix used by public ministry uploads. */
  publicMediaBaseUrl: string;
  /** Opt-in guard so rollout waits until the Cloudflare zone is configured. */
  imageTransformsEnabled: boolean;
  /** Opt-in for raster assets under /images/ when this storefront host is Cloudflare-proxied. */
  siteImageTransformsEnabled?: boolean;
}

const ResponsiveImageContext = createContext<Required<ResponsiveImageConfig>>({
  publicMediaBaseUrl: "",
  imageTransformsEnabled: false,
  siteImageTransformsEnabled: false,
});

export function ResponsiveImageProvider({
  publicMediaBaseUrl,
  imageTransformsEnabled,
  siteImageTransformsEnabled = false,
  children,
}: ResponsiveImageConfig & { children: ReactNode }) {
  return (
    <ResponsiveImageContext.Provider value={{ publicMediaBaseUrl, imageTransformsEnabled, siteImageTransformsEnabled }}>
      {children}
    </ResponsiveImageContext.Provider>
  );
}

export type ResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> & {
  src: string;
  alt: string;
  sizes?: string;
};

export function ResponsiveImage({
  src,
  sizes = "100vw",
  loading = "lazy",
  decoding = "async",
  ...props
}: ResponsiveImageProps) {
  const { publicMediaBaseUrl, imageTransformsEnabled, siteImageTransformsEnabled } = useContext(ResponsiveImageContext);
  if (!isSafeImageSource(src)) return null;
  const sources = imageTransformsEnabled || siteImageTransformsEnabled
    ? getResponsiveImageSources(src, publicMediaBaseUrl, undefined, siteImageTransformsEnabled, imageTransformsEnabled)
    : { src };
  return (
    <img
      {...props}
      src={sources.src}
      srcSet={sources.srcSet}
      sizes={sources.srcSet ? sizes : undefined}
      loading={loading}
      decoding={decoding}
    />
  );
}

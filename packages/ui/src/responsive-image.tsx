"use client";

import { createContext, useContext, type ImgHTMLAttributes, type ReactNode } from "react";
import { getResponsiveImageSources, isSafeImageSource } from "./responsive-image-sources.js";
import type { ResponsiveImageSources } from "./responsive-image-sources.js";

export interface ResponsiveImageConfig {
  /** The exact HTTPS origin and optional path prefix used by public ministry uploads. */
  publicMediaBaseUrl: string;
  /** Opt-in guard so rollout waits until the Cloudflare zone is configured. */
  imageTransformsEnabled: boolean;
}


const ResponsiveImageContext = createContext<ResponsiveImageConfig>({ publicMediaBaseUrl: "", imageTransformsEnabled: false });

export function ResponsiveImageProvider({
  publicMediaBaseUrl,
  imageTransformsEnabled,
  children,
}: ResponsiveImageConfig & { children: ReactNode }) {
  return (
    <ResponsiveImageContext.Provider value={{ publicMediaBaseUrl, imageTransformsEnabled }}>
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
  const { publicMediaBaseUrl, imageTransformsEnabled } = useContext(ResponsiveImageContext);
  if (!isSafeImageSource(src)) return null;
  const sources = imageTransformsEnabled
    ? getResponsiveImageSources(src, publicMediaBaseUrl)
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

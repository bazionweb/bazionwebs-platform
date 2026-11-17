import type { NextConfig } from "next";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@bazion/ui", "@bazion/auth"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  env: {
    ...(process.env.PUBLIC_STOREFRONT_URL && !process.env.NEXT_PUBLIC_PUBLIC_STOREFRONT_URL
      ? { NEXT_PUBLIC_PUBLIC_STOREFRONT_URL: process.env.PUBLIC_STOREFRONT_URL }
      : {}),
    ...(process.env.TENANT_PREVIEW_BASE_DOMAIN && !process.env.NEXT_PUBLIC_TENANT_PREVIEW_BASE_DOMAIN
      ? { NEXT_PUBLIC_TENANT_PREVIEW_BASE_DOMAIN: process.env.TENANT_PREVIEW_BASE_DOMAIN }
      : {}),
  },
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${apiBaseUrl}/api/auth/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;

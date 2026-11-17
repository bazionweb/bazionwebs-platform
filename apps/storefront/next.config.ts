import type { NextConfig } from "next";
import path from "node:path";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: [
    "@bazion/ui",
    "@bazion/auth",
    "@bazion/education-contracts",
    "@bazion/education-template",
    "@bazion/education-portal",
    "@bazion/education-ums",
  ],
  // Allow an isolated tenant preview to run beside the generic storefront.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  env: {
    ...(process.env.PUBLIC_STOREFRONT_URL && !process.env.NEXT_PUBLIC_PUBLIC_STOREFRONT_URL
      ? { NEXT_PUBLIC_PUBLIC_STOREFRONT_URL: process.env.PUBLIC_STOREFRONT_URL }
      : {}),
    ...(process.env.TENANT_PREVIEW_BASE_DOMAIN && !process.env.NEXT_PUBLIC_TENANT_PREVIEW_BASE_DOMAIN
      ? { NEXT_PUBLIC_TENANT_PREVIEW_BASE_DOMAIN: process.env.TENANT_PREVIEW_BASE_DOMAIN }
      : {}),
  },
  // Keep the guest-cart HttpOnly cookie first-party on each client storefront
  // domain. The browser calls /v1 on this origin; Next proxies it to the API.
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${apiBaseUrl}/api/auth/:path*` },
      { source: "/api/:path*", destination: `${apiBaseUrl}/api/:path*` },
      { source: "/v1/:path*", destination: `${apiBaseUrl}/v1/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@bazion/ui", "@bazion/auth"],
  // Allow an isolated tenant preview to run beside the generic storefront.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Keep the guest-cart HttpOnly cookie first-party on each client storefront
  // domain. The browser calls /v1 on this origin; Next proxies it to the API.
  async rewrites() {
    return [
      { source: "/v1/:path*", destination: `${apiBaseUrl}/v1/:path*` },
      { source: "/api/auth/:path*", destination: `${apiBaseUrl}/api/auth/:path*` },
    ];
  },
  async headers() {
    return [{ source: "/reset-password", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;

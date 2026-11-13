import type { NextConfig } from "next";
import path from "node:path";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4100").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@bazion/auth"],
  env: {
    ...(process.env.PUBLIC_STOREFRONT_URL && !process.env.NEXT_PUBLIC_PUBLIC_STOREFRONT_URL
      ? { NEXT_PUBLIC_PUBLIC_STOREFRONT_URL: process.env.PUBLIC_STOREFRONT_URL }
      : {}),
  },
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

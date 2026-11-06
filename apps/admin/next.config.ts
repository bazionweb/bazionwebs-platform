import type { NextConfig } from "next";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/v1/:path*", destination: `${apiBaseUrl}/v1/:path*` },
      { source: "/api/auth/:path*", destination: `${apiBaseUrl}/api/auth/:path*` },
    ];
  },
};

export default nextConfig;

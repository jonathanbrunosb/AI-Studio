import type { NextConfig } from "next";
import { hstsHeader, staticSecurityHeaders } from "./src/lib/security/headers";

const hsts = hstsHeader();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [...staticSecurityHeaders, ...(hsts ? [hsts] : [])] }];
  },
};

export default nextConfig;

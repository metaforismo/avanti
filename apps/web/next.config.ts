import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@avanti/contracts", "@avanti/core", "@avanti/api", "@avanti/db"],
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@avanti/contracts", "@avanti/core", "@avanti/api", "@avanti/db"],
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/api/**/*": ["../../packages/db/migrations/**/*", "../../packages/api/assets/fonts/**/*"],
  },
  logging: { incomingRequests: false },
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;

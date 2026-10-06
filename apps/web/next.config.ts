import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@avanti/contracts", "@avanti/core", "@avanti/api", "@avanti/db"],
  // The PDF parser worker needs a real Node module path, not a Turbopack module ID.
  serverExternalPackages: ["@electric-sql/pglite", "pdf-lib"],
  outputFileTracingIncludes: {
    "/api/**/*": ["../../packages/db/migrations/**/*", "../../packages/api/assets/fonts/**/*"],
  },
  logging: { incomingRequests: false },
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: true,
};

export default nextConfig;

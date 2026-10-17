import type { NextConfig } from "next";
import { pageSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  headers: async () => pageSecurityHeaders(process.env.NODE_ENV === "production"),
  transpilePackages: ["@avanti/contracts", "@avanti/core", "@avanti/api", "@avanti/db"],
  // The PDF parser worker needs a real Node module path, not a Turbopack module ID.
  serverExternalPackages: ["@electric-sql/pglite", "pdf-lib"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "../../packages/db/migrations/**/*",
      "../../packages/api/assets/fonts/**/*",
      "../../packages/api/assets/pdf-*.cjs",
    ],
  },
  logging: { incomingRequests: false },
  poweredByHeader: false,
  devIndicators: false,
  typedRoutes: true,
};

export default function configureNext(phase: string): NextConfig {
  if (
    phase === "phase-production-server" &&
    process.env.VERCEL !== "1" &&
    process.env.TRUST_PROXY !== "1"
  )
    throw new Error(
      "Next Fetch cannot read the client socket: configure TRUST_PROXY=1 behind a trusted proxy before starting Avanti.",
    );
  return nextConfig;
}

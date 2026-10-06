import type { NextConfig } from "next";

// 'unsafe-inline' scripts: Next inlines its bootstrap; removing it needs a nonce per request.
// blob: frames are the operator's PDF preview, fetched because files are served as attachments.
const pageCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

/** Pages only: the API sets its own headers per response (files are sandboxed attachments). */
async function securityHeaders() {
  if (process.env.NODE_ENV !== "production") return [];
  return [
    {
      source: "/((?!api(?:/|$)).*)",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: pageCsp },
      ],
    },
  ];
}

const nextConfig: NextConfig = {
  headers: securityHeaders,
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

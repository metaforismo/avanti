// 'unsafe-inline' scripts: Next inlines its bootstrap; removing it needs a nonce per request.
// blob: frames are the operator's PDF preview, fetched because files are served as attachments.
export const PAGE_CSP = [
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

// Only the citizen's own page records voice; the console and public pages never need it.
const PERMISSIONS = "camera=(), microphone=(), geolocation=()";
const CITIZEN_PERMISSIONS = "camera=(), microphone=(self), geolocation=()";

type Header = { key: string; value: string };
export type HeaderRule = { source: string; headers: Header[] };

/** Pages only: the API sets its own headers per response (files are sandboxed attachments). */
export function pageSecurityHeaders(production: boolean): HeaderRule[] {
  if (!production) return [];
  return [
    {
      // Matches Vercel's default; on another host the proxy may also send it.
      source: "/:path*",
      headers: [{ key: "Strict-Transport-Security", value: "max-age=63072000" }],
    },
    {
      source: "/((?!api(?:/|$)).*)",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: PERMISSIONS },
        { key: "Content-Security-Policy", value: PAGE_CSP },
        // External links open with noopener; no window may keep a handle on a case page.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      ],
    },
    // Later rules override earlier ones for the same key in Next.
    {
      source: "/pratica/:token",
      headers: [{ key: "Permissions-Policy", value: CITIZEN_PERMISSIONS }],
    },
  ];
}

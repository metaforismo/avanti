import type { MiddlewareHandler } from "hono";
import type { ApiEnv, ApiOptions } from "../context";

function category(path: string) {
  if (path.startsWith("/api/c/")) return "citizen";
  if (
    path.startsWith("/api/cases") ||
    path.startsWith("/api/metrics") ||
    path.startsWith("/api/reports")
  )
    return "operator";
  if (path.startsWith("/api/auth/")) return "auth";
  return "public";
}

export function requestMetadata(logger: ApiOptions["logger"]): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const started = performance.now();
    context.set("requestId", crypto.randomUUID());
    context.header("X-Request-Id", context.get("requestId"));
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Frame-Options", "DENY");
    context.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
    context.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Documents and case data must not be embeddable or readable by another site's page.
    context.header("Cross-Origin-Resource-Policy", "same-origin");
    context.header("Cross-Origin-Opener-Policy", "same-origin");
    try {
      await next();
    } finally {
      logger?.({
        requestId: context.get("requestId"),
        category: category(context.req.path),
        status: context.res.status,
        durationMs: Math.round(performance.now() - started),
      });
    }
  };
}

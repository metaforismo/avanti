import type { MiddlewareHandler } from "hono";
import type { ApiEnv, ApiOptions } from "../context";

function category(path: string) {
  if (path.startsWith("/api/c/")) return "citizen";
  if (path.startsWith("/api/cases") || path.startsWith("/api/metrics")) return "operator";
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

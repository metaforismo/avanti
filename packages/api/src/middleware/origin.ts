import type { MiddlewareHandler } from "hono";
import type { ApiEnv, Services } from "../context";
import { ApiFailure } from "../security";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireOrigin(services: Services): MiddlewareHandler<ApiEnv> {
  const publicOrigin = new URL(services.publicUrl).origin;
  return async (context, next) => {
    if (!safeMethods.has(context.req.method)) {
      const origin = context.req.header("Origin");
      const requestUrl = new URL(context.req.url);
      const allowedOrigins = new Set([requestUrl.origin, publicOrigin]);
      // Next can normalize the URL hostname to localhost while preserving the browser's Host.
      const host = context.req.header("Host");
      if (host) {
        requestUrl.host = host;
        allowedOrigins.add(requestUrl.origin);
      }
      const allowed = origin
        ? allowedOrigins.has(origin)
        : context.req.header("Sec-Fetch-Site") === "same-origin";
      if (!allowed) throw new ApiFailure("forbidden", 403, "Richiesta non autorizzata.");
    }
    await next();
  };
}

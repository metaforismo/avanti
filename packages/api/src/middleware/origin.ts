import type { MiddlewareHandler } from "hono";
import type { ApiEnv, Services } from "../context";
import { ApiFailure } from "../security";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireOrigin(services: Services): MiddlewareHandler<ApiEnv> {
  const publicOrigin = new URL(services.publicUrl).origin;
  return async (context, next) => {
    if (!safeMethods.has(context.req.method)) {
      const origin = context.req.header("Origin");
      const requestOrigin = new URL(context.req.url).origin;
      const allowed = origin
        ? origin === requestOrigin || origin === publicOrigin
        : context.req.header("Sec-Fetch-Site") === "same-origin";
      if (!allowed) throw new ApiFailure("forbidden", 403, "Richiesta non autorizzata.");
    }
    await next();
  };
}

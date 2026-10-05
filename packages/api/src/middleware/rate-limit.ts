import { consumeRateLimit } from "@avanti/db";
import type { MiddlewareHandler } from "hono";
import type { ApiEnv, Services } from "../context";
import { ApiFailure, hashToken } from "../security";

const publicLimits = new Map([
  ["/api/auth/login", { category: "login", limit: 10 }],
  ["/api/intake", { category: "intake", limit: 30 }],
  ["/api/leads", { category: "leads", limit: 5 }],
]);

function policy(path: string, method: string) {
  if (method !== "POST") return null;
  const publicPolicy = publicLimits.get(path);
  if (publicPolicy) return publicPolicy;
  if (/^\/api\/c\/[^/]+\/turn$/.test(path)) return { category: "turn", limit: 120 };
  if (/^\/api\/c\/[^/]+\/documents$/.test(path)) return { category: "upload", limit: 30 };
  return null;
}

export function rateLimit(services: Services): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const rule = policy(context.req.path, context.req.method);
    if (rule) {
      const address = services.trustProxy
        ? context.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
        : "local";
      const result = await consumeRateLimit(
        services.db,
        hashToken(`${rule.category}:${address}`),
        services.clock(),
        rule.limit,
        60,
      );
      if (!result.allowed) {
        context.header("Retry-After", String(result.retryAfterSeconds));
        throw new ApiFailure("rate_limited", 429, "Troppe richieste. Attendi un minuto e riprova.");
      }
    }
    await next();
  };
}

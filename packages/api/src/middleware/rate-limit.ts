import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { consumeRateLimit } from "@avanti/db";
import { LoginRequest } from "@avanti/contracts";
import type { MiddlewareHandler } from "hono";
import type { ApiContext, ApiEnv, Services } from "../context";
import { ApiFailure } from "../security";

const publicLimits = new Map([
  ["/api/auth/login", { category: "login", limit: 10 }],
  ["/api/auth/password", { category: "login", limit: 10 }],
  ["/api/intake", { category: "intake", limit: 30 }],
  ["/api/leads", { category: "leads", limit: 5 }],
]);
function policy(path: string, method: string) {
  if (method === "GET" && /^\/api\/cases\/[^/]+\/export$/.test(path))
    return { category: "export", limit: 20 };
  if (method !== "POST") return null;
  if (/^\/api\/cases\/[^/]+\/requests$/.test(path)) return { category: "translate", limit: 30 };
  const publicPolicy = publicLimits.get(path);
  if (publicPolicy) return publicPolicy;
  if (/^\/api\/c\/[^/]+\/turn$/.test(path)) return { category: "turn", limit: 120 };
  if (/^\/api\/c\/[^/]+\/documents$/.test(path)) return { category: "upload", limit: 30 };
  return null;
}
export function proxyAddress(headers: Headers, vercel: boolean): string | null {
  const candidate = vercel
    ? headers.get("x-real-ip")
    : headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}
export function rateKey(secret: string, category: string, value: string): string {
  return createHmac("sha256", secret).update(`${category}:${value}`).digest("hex");
}
export function remoteAddress(context: ApiContext, services: Services): string | null {
  if (services.trustProxy) return proxyAddress(context.req.raw.headers, services.vercel ?? false);
  const address = services.clientAddress?.(context) ?? context.env?.incoming?.socket.remoteAddress;
  if (address && isIP(address)) return address;
  return null;
}
export function rateLimit(services: Services): MiddlewareHandler<ApiEnv> {
  const secret = services.rateLimitSecret ?? randomBytes(32).toString("hex");
  return async (context, next) => {
    const rule = policy(context.req.path, context.req.method);
    // Password attempts use the authenticated email, never a client-supplied identity.
    if (context.req.path === "/api/auth/password" && !context.get("operator")) return next();
    if (rule && (!["export", "translate"].includes(rule.category) || context.get("operator"))) {
      const identities: string[] = [];
      const address = remoteAddress(context, services);
      if (services.production && !address)
        throw new ApiFailure("bad_request", 400, "Richiesta non valida.");

      if (context.get("operator")) identities.push(`operator:${context.get("operator").id}`);
      if (address) identities.push(`ip:${address}`);
      const capability = /^\/api\/c\/([^/]+)/.exec(context.req.path)?.[1];
      if (capability) identities.push(`capability:${capability}`);
      if (context.req.path === "/api/auth/password") {
        identities.push(`email:${context.get("operator").email}`);
      } else if (rule.category === "login") {
        let raw: unknown;
        try {
          raw = await context.req.json();
        } catch {
          throw new ApiFailure("bad_request", 400, "Richiesta non valida.");
        }
        const parsed = LoginRequest.safeParse(raw);
        if (!parsed.success) throw new ApiFailure("bad_request", 400, "Controlla i dati inseriti.");
        identities.push(`email:${parsed.data.email}`);
      }
      for (const identity of identities) {
        const result = await consumeRateLimit(
          services.db,
          rateKey(secret, rule.category, identity),
          services.clock(),
          rule.limit,
          60,
        );
        if (!result.allowed) {
          context.header("Retry-After", String(result.retryAfterSeconds));
          throw new ApiFailure(
            "rate_limited",
            429,
            "Troppe richieste. Attendi un minuto e riprova.",
          );
        }
      }
    }
    await next();
  };
}

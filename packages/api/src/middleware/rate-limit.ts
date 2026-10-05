import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { consumeRateLimit } from "@avanti/db";
import { LoginRequest } from "@avanti/contracts";
import type { MiddlewareHandler } from "hono";
import type { ApiContext, ApiEnv, Services } from "../context";
import { ApiFailure } from "../security";

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
export function proxyAddress(headers: Headers, vercel: boolean): string | null {
  const candidate = vercel
    ? headers.get("x-real-ip")
    : headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}
export function rateKey(secret: string, category: string, value: string): string {
  return createHmac("sha256", secret).update(`${category}:${value}`).digest("hex");
}
function remoteAddress(context: ApiContext, services: Services): string | null {
  if (services.trustProxy) return proxyAddress(context.req.raw.headers, services.vercel ?? false);
  if (services.clientAddress) return services.clientAddress(context);
  return null;
}
export function rateLimit(services: Services): MiddlewareHandler<ApiEnv> {
  const secret = services.rateLimitSecret ?? randomBytes(32).toString("hex");
  return async (context, next) => {
    const rule = policy(context.req.path, context.req.method);
    if (rule) {
      const identities: string[] = [];
      const address = remoteAddress(context, services);
      if (services.production && !address)
        throw new ApiFailure("internal", 500, "Servizio momentaneamente non disponibile. Riprova.");
      if (address) identities.push(`ip:${address}`);
      const capability = /^\/api\/c\/([^/]+)/.exec(context.req.path)?.[1];
      if (capability) identities.push(`capability:${capability}`);
      if (rule.category === "login") {
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

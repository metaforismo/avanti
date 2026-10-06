import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { consumeRateLimit } from "@avanti/db";
import { LoginRequest } from "@avanti/contracts";
import type { MiddlewareHandler } from "hono";
import type { ApiContext, ApiEnv, Services } from "../context";
import { ApiFailure } from "../security";
import { limitLanguage, limitMessage } from "./limit-message";

interface WindowLimit {
  limit: number;
  seconds: number;
}
interface Policy {
  category: string;
  primary: readonly WindowLimit[];
  ip: readonly WindowLimit[];
}
const minute = (limit: number): WindowLimit => ({ limit, seconds: 60 });
const hour = (limit: number): WindowLimit => ({ limit, seconds: 3600 });
export const RATE_POLICIES = {
  login: { category: "login", primary: [minute(10)], ip: [minute(100)] },
  intake: { category: "intake", primary: [], ip: [minute(40), hour(60)] },
  // Answers are quick taps (a large family can give 30 in a minute) and only free text reaches
  // the AI; the IP ceiling assumes a full waiting room on one Wi-Fi, all tapping at once.
  turn: { category: "turn", primary: [minute(60), hour(400)], ip: [minute(1500), hour(15000)] },
  upload: { category: "upload", primary: [minute(30), hour(120)], ip: [minute(400), hour(4000)] },
  leads: { category: "leads", primary: [], ip: [minute(5)] },
  export: { category: "export", primary: [minute(20)], ip: [minute(200)] },
  translate: { category: "translate", primary: [minute(30)], ip: [minute(300)] },
} satisfies Record<string, Policy>;
function policy(path: string, method: string): Policy | null {
  if (method === "GET" && /^\/api\/cases\/[^/]+\/export$/.test(path)) return RATE_POLICIES.export;
  if (method !== "POST") return null;
  if (/^\/api\/cases\/[^/]+\/requests$/.test(path)) return RATE_POLICIES.translate;
  if (["/api/auth/login", "/api/auth/password"].includes(path)) return RATE_POLICIES.login;
  if (path === "/api/intake") return RATE_POLICIES.intake;
  if (path === "/api/leads") return RATE_POLICIES.leads;
  if (/^\/api\/c\/[^/]+\/turn$/.test(path)) return RATE_POLICIES.turn;
  if (/^\/api\/c\/[^/]+\/documents$/.test(path)) return RATE_POLICIES.upload;
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
      // A busy or abusive capability must exhaust its own quota before charging the shared Wi-Fi.
      const buckets = identities.flatMap((identity) =>
        rule.primary.map((window) => ({ identity, window })),
      );
      if (address)
        buckets.push(...rule.ip.map((window) => ({ identity: `ip:${address}`, window })));
      for (const { identity, window } of buckets) {
        const result = await consumeRateLimit(
          services.db,
          rateKey(secret, `${rule.category}:${window.seconds}`, identity),
          services.clock(),
          window.limit,
          window.seconds,
        );
        if (!result.allowed) {
          context.header("Retry-After", String(result.retryAfterSeconds));
          throw new ApiFailure(
            "rate_limited",
            429,
            limitMessage(await limitLanguage(context, services), result.retryAfterSeconds),
          );
        }
      }
    }
    await next();
  };
}

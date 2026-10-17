import { isIP } from "node:net";
import { consumeRateLimit, operators } from "@avanti/db";
import { eq } from "drizzle-orm";
import { LoginRequest } from "@avanti/contracts";
import type { MiddlewareHandler } from "hono";
import type { ApiContext, ApiEnv, Services } from "../context";
import { ApiFailure } from "../security";
import { limitLanguage, limitMessage } from "./limit-message";
import { recordMfaFailure } from "../mfa";
import { recordActivity } from "../audit-log";
import { rateKey, rateLimitSecret } from "../rate-limit-key";
export { rateKey } from "../rate-limit-key";

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
  renewals: { category: "renewals", primary: [minute(5), hour(20)], ip: [minute(50), hour(200)] },
  renewalsRead: { category: "renewalsRead", primary: [minute(60)], ip: [minute(600)] },
  assistant: {
    category: "assistant",
    primary: [hour(30), { limit: 80, seconds: 86400 }],
    ip: [minute(1500), hour(15000)],
  },
  askDesk: {
    category: "askDesk",
    primary: [{ limit: 5, seconds: 86400 }],
    ip: [minute(1500), hour(15000)],
  },
  transcribe: { category: "transcribe", primary: [hour(20)], ip: [minute(1500), hour(15000)] },
  copilot: { category: "copilot", primary: [hour(60)], ip: [hour(6000)] },
  // Opening a dossier reads three copilot results, nearly always cached for that content
  // version: AI only runs when the content changes, within the monthly budget. 600 an hour
  // covers ~200 dossiers, far above a person's pace, and still stops a runaway loop.
  copilotRead: { category: "copilotRead", primary: [hour(600)], ip: [hour(6000)] },
  mfa: { category: "mfa", primary: [minute(10)], ip: [minute(100)] },
  login: { category: "login", primary: [minute(10)], ip: [minute(100)] },
  intake: { category: "intake", primary: [], ip: [minute(40), hour(60)] },
  // Answers are quick taps (a large family can give 30 in a minute) and only free text reaches
  // the AI; the IP ceiling assumes a full waiting room on one Wi-Fi, all tapping at once.
  turn: { category: "turn", primary: [minute(60), hour(400)], ip: [minute(1500), hour(15000)] },
  conversation: { category: "conversation", primary: [hour(60)], ip: [minute(1500), hour(15000)] },
  upload: { category: "upload", primary: [minute(30), hour(120)], ip: [minute(400), hour(4000)] },
  leads: { category: "leads", primary: [], ip: [minute(5)] },
  export: { category: "export", primary: [minute(20)], ip: [minute(200)] },
  assign: { category: "assign", primary: [minute(20), hour(200)], ip: [minute(200)] },
  link: { category: "link", primary: [minute(20)], ip: [minute(200)] },
  translate: { category: "translate", primary: [minute(30)], ip: [minute(300)] },
} satisfies Record<string, Policy>;
function policy(path: string, method: string): Policy | null {
  if (path === "/api/renewals")
    return method === "POST"
      ? RATE_POLICIES.renewals
      : method === "GET"
        ? RATE_POLICIES.renewalsRead
        : null;
  if (method === "PUT" && /^\/api\/(cases|renewals)\/[^/]+\/renewal-consent$/.test(path))
    return RATE_POLICIES.link;
  if (method === "PUT" && /^\/api\/c\/[^/]+\/renewal-consent$/.test(path))
    return RATE_POLICIES.turn;
  if (method === "GET" && /^\/api\/cases\/[^/]+\/ai\/(brief|consistency|dsu-prefill)$/.test(path))
    return RATE_POLICIES.copilotRead;
  if (method === "POST" && /^\/api\/cases\/[^/]+\/near-ready\/evaluate$/.test(path))
    return RATE_POLICIES.copilot;
  if ((path === "/api/ai/ask" || /^\/api\/cases\/[^/]+\/ai\/ask$/.test(path)) && method === "POST")
    return RATE_POLICIES.copilot;
  if (
    /^\/api\/cases\/[^/]+\/ai\/(brief|request-draft|reply-draft)$/.test(path) &&
    method === "POST"
  )
    return RATE_POLICIES.translate;
  if (method === "GET" && ["/api/reports/pilot", "/api/reports/near-ready"].includes(path))
    return RATE_POLICIES.export;
  if (method === "GET" && path === "/api/audit/export.csv") return RATE_POLICIES.export;
  if (method === "GET" && /^\/api\/cases\/[^/]+\/export$/.test(path)) return RATE_POLICIES.export;
  // The handoff carries the checklist in two languages: an export by another name.
  if (method === "GET" && /^\/api\/cases\/[^/]+\/citizen-handoff$/.test(path))
    return RATE_POLICIES.export;
  if (method !== "POST") return null;
  if (path === "/api/cases/assign") return RATE_POLICIES.assign;
  if (/^\/api\/cases\/[^/]+\/(reuse|documents\/[^/]+\/reuse-check)$/.test(path))
    return RATE_POLICIES.link;
  if (path === "/api/cases/families/search") return RATE_POLICIES.link;
  if (/^\/api\/c\/[^/]+\/assistant$/.test(path)) return RATE_POLICIES.assistant;
  if (/^\/api\/c\/[^/]+\/assistant\/ask-desk$/.test(path)) return RATE_POLICIES.askDesk;
  if (/^\/api\/c\/[^/]+\/transcribe$/.test(path)) return RATE_POLICIES.transcribe;
  if (/^\/api\/cases\/[^/]+\/link$/.test(path)) return RATE_POLICIES.link;
  if (/^\/api\/cases\/[^/]+\/citizen-handoff\/events$/.test(path)) return RATE_POLICIES.link;
  if (/^\/api\/cases\/[^/]+\/requests$/.test(path)) return RATE_POLICIES.translate;
  if (path.startsWith("/api/auth/mfa/")) return RATE_POLICIES.mfa;
  if (["/api/auth/login", "/api/auth/password"].includes(path)) return RATE_POLICIES.login;
  if (path === "/api/intake") return RATE_POLICIES.intake;
  if (path === "/api/leads") return RATE_POLICIES.leads;
  if (/^\/api\/c\/[^/]+\/conversation(?:\/confirm)?$/.test(path)) return RATE_POLICIES.conversation;
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
export function remoteAddress(context: ApiContext, services: Services): string | null {
  if (services.trustProxy) return proxyAddress(context.req.raw.headers, services.vercel ?? false);
  const address = services.clientAddress?.(context) ?? context.env?.incoming?.socket.remoteAddress;
  if (address && isIP(address)) return address;
  return null;
}
export function rateLimit(services: Services): MiddlewareHandler<ApiEnv> {
  const secret = rateLimitSecret(services.rateLimitSecret);
  return async (context, next) => {
    // HEAD runs the GET handler (and its AI calls or exports), so it shares the GET quota.
    const method = context.req.method === "HEAD" ? "GET" : context.req.method;
    let rule = policy(context.req.path, method);
    if (rule?.category === "turn") {
      const input: unknown = await context.req.json().catch(() => null);
      if (input && typeof input === "object" && "type" in input && input.type === "text")
        rule = RATE_POLICIES.conversation;
    }
    const citizenTask = ["assistant", "askDesk", "transcribe"].includes(rule?.category ?? "");
    if (citizenTask && !context.get("citizen")) return next();
    // Password attempts use the authenticated email, never a client-supplied identity.
    if (
      (context.req.path === "/api/auth/password" || rule?.category === "mfa") &&
      !context.get("operator")
    )
      return next();
    if (
      rule &&
      (!["export", "link", "translate", "copilot", "renewals", "renewalsRead", "assign"].includes(
        rule.category,
      ) ||
        context.get("operator"))
    ) {
      const identities: string[] = [];
      let loginEmail: string | undefined;
      const address = remoteAddress(context, services);
      if (services.production && !address)
        throw new ApiFailure("bad_request", 400, "Richiesta non valida.");

      if (context.get("operator")) identities.push(`operator:${context.get("operator").id}`);
      const capability = /^\/api\/c\/([^/]+)/.exec(context.req.path)?.[1];
      if (citizenTask) identities.push(`case:${context.get("citizen").id}`);
      else if (capability) identities.push(`capability:${capability}`);
      if (context.req.path === "/api/auth/password") {
        identities.push(`email:${context.get("operator").email}`);
      } else if (rule.category === "mfa") {
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
        loginEmail = parsed.data.email;
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
          // One event when the limit is crossed: logging every rejected attempt would let an
          // attacker flood the audit log and the database the limit is meant to protect.
          if (rule.category === "mfa" && result.firstRejection)
            await recordMfaFailure(services.db, context.get("operator"), services.clock(), true);
          if (loginEmail && result.firstRejection) {
            const [account] = await services.db
              .select()
              .from(operators)
              .where(eq(operators.email, loginEmail))
              .limit(1);
            await recordActivity(
              services.db,
              account?.organizationId ?? null,
              null,
              "auth.login_failed",
              services.clock(),
              account?.id ?? null,
              { rateLimited: true },
            );
          }
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

import { and, eq, gt, sql } from "drizzle-orm";
import { cases, operators, sessions, settings } from "@avanti/db";
import { getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { ApiContext, ApiEnv, Services } from "../context";
import { ApiFailure, hashToken, notFound, tokenMatches } from "../security";
import { currentCitizenLink } from "../citizen-link";

export const ABSOLUTE_SESSION_SECONDS = 12 * 60 * 60;
export const SESSION_SECONDS = 30 * 60;
export const SESSION_COOKIE = "avanti_session";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function setSessionCookie(
  context: ApiContext,
  token: string,
  production: boolean,
  maxAge = SESSION_SECONDS,
) {
  setCookie(context, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: production,
    sameSite: "Lax",
    path: "/api",
    maxAge,
  });
}

export function authenticateOperator(services: Services): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const token = getCookie(context, SESSION_COOKIE);
    if (!token || !tokenPattern.test(token)) {
      throw new ApiFailure("unauthorized", 401, "Accedi per continuare.");
    }
    const [session] = await services.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
      .limit(1);
    const now = services.clock();
    const readOnly = ["GET", "HEAD", "OPTIONS"].includes(context.req.method);
    if (
      !session ||
      !tokenMatches(token, session.tokenHash) ||
      Date.parse(session.expiresAt) <= now.getTime() ||
      Date.parse(session.createdAt) + ABSOLUTE_SESSION_SECONDS * 1000 <= now.getTime()
    ) {
      if (session && !readOnly)
        await services.db.delete(sessions).where(eq(sessions.id, session.id));
      throw new ApiFailure("unauthorized", 401, "Sessione scaduta. Accedi di nuovo.");
    }
    const [account] = await services.db
      .select({ operator: operators, required: settings.mfaRequired })
      .from(operators)
      .leftJoin(settings, eq(settings.organizationId, operators.organizationId))
      .where(eq(operators.id, session.operatorId))
      .limit(1);
    const operator = account?.operator;
    if (!operator?.active) throw new ApiFailure("unauthorized", 401, "Accedi per continuare.");
    enforceSessionRestrictions(context.req.path, session, operator, account?.required ?? false);
    if (
      session.state === "authenticated" &&
      !context.req.path.startsWith("/api/auth/mfa/") &&
      !["/api/auth/password", "/api/auth/logout"].includes(context.req.path)
    ) {
      await services.db
        .update(sessions)
        .set({
          expiresAt: new Date(
            Math.min(
              now.getTime() + SESSION_SECONDS * 1000,
              Date.parse(session.createdAt) + ABSOLUTE_SESSION_SECONDS * 1000,
            ),
          ).toISOString(),
        })
        .where(eq(sessions.id, session.id));
      setSessionCookie(context, token, services.production);
    }
    context.set("session", session);
    context.set("operator", operator);
    await next();
  };
}

export function authenticateCitizen(services: Services): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const token = context.req.param("token");
    if (!token || !tokenPattern.test(token)) throw notFound();
    const [row] = await services.db
      .select()
      .from(cases)
      .where(eq(cases.tokenHash, hashToken(token)))
      .limit(1);
    if (!row || !tokenMatches(token, row.tokenHash)) throw notFound();
    if (row.status === "closed" || Date.parse(row.expiresAt) <= services.clock().getTime()) {
      throw new ApiFailure(
        "link_expired",
        410,
        "Il link è scaduto. Contatta lo sportello per un nuovo link.",
      );
    }
    context.set("citizen", row);
    await next();
    // Reads and response assembly can overlap a rotation after initial authentication.
    if (context.res.ok) await currentCitizenLink(services.db, row, services.clock());
  };
}

const passwordRoutes = new Set(["/api/auth/me", "/api/auth/password", "/api/auth/logout"]);

const challengeRoutes = new Set([
  "/api/auth/me",
  "/api/auth/mfa/verify",
  "/api/auth/logout",
  "/api/auth/login",
]);
const setupRoutes = new Set([
  ...passwordRoutes,
  "/api/auth/login",
  "/api/auth/mfa/status",
  "/api/auth/mfa/setup/start",
  "/api/auth/mfa/setup/confirm",
]);
function enforceSessionRestrictions(
  path: string,
  session: typeof sessions.$inferSelect,
  operator: typeof operators.$inferSelect,
  required: boolean,
) {
  if (session.state === "mfa_pending") {
    if (!challengeRoutes.has(path))
      throw new ApiFailure(
        "forbidden",
        403,
        "Completa la verifica in due passaggi per continuare.",
      );
    return;
  }
  if (operator.mustChangePassword && !passwordRoutes.has(path))
    throw new ApiFailure("forbidden", 403, "Cambia la password per continuare.");
  if (
    (session.state === "mfa_setup" || (required && !operator.mfaEnabledAt)) &&
    !setupRoutes.has(path)
  )
    throw new ApiFailure("forbidden", 403, "Configura la verifica in due passaggi per continuare.");
}

// Public routes must obey the same gates as operator routes when a live restricted cookie is sent.
export function restrictTemporaryPassword(services: Services): MiddlewareHandler<ApiEnv> {
  return async (context, next) => {
    const token = getCookie(context, SESSION_COOKIE);
    if (token && tokenPattern.test(token)) {
      const now = services.clock().toISOString();
      const [row] = await services.db
        .select({ session: sessions, operator: operators, required: settings.mfaRequired })
        .from(sessions)
        .innerJoin(operators, eq(operators.id, sessions.operatorId))
        .leftJoin(settings, eq(settings.organizationId, operators.organizationId))
        .where(
          and(
            eq(sessions.tokenHash, hashToken(token)),
            eq(operators.active, true),
            gt(sessions.expiresAt, now),
            sql`${sessions.createdAt} + interval '12 hours' > ${now}::timestamptz`,
          ),
        )
        .limit(1);
      if (row)
        enforceSessionRestrictions(
          context.req.path,
          row.session,
          row.operator,
          row.required ?? false,
        );
    }
    await next();
  };
}
